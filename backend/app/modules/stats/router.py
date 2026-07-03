"""Data dashboard — aggregate stats from the database."""
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set
from app.core.database import get_db
from app.core.utils import utcnow

router = APIRouter(prefix="/stats", tags=["stats"])

_OVERVIEW_TTL = 30  # seconds


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Top-level counts: assets, projects, tasks, AI calls."""
    cached = await cache_get("stats:overview")
    if cached is not None:
        return cached
    stats: dict[str, Any] = {}

    # Asset counts by type
    try:
        r = await db.execute(
            text("SELECT asset_type, COUNT(*) FROM asset GROUP BY asset_type")
        )
        by_type = {str(row[0]): row[1] for row in r.fetchall()}
        total = sum(by_type.values())
        stats["assets"] = {"total": total, "by_type": by_type}
    except Exception as exc:
        logger.debug("stats overview: asset counts failed — {}", exc)
        stats["assets"] = {"total": 0, "by_type": {}}

    # Video projects + render status
    try:
        r = await db.execute(
            text("SELECT render_status, COUNT(*) FROM video_project GROUP BY render_status")
        )
        by_status = {str(row[0]): row[1] for row in r.fetchall()}
        stats["video_projects"] = {
            "total": sum(by_status.values()),
            "by_status": by_status,
        }
    except Exception as exc:
        logger.debug("stats overview: video project counts failed — {}", exc)
        stats["video_projects"] = {"total": 0, "by_status": {}}

    # Tasks
    try:
        r = await db.execute(
            text("SELECT status, COUNT(*) FROM task GROUP BY status")
        )
        by_status = {str(row[0]): row[1] for row in r.fetchall()}
        stats["tasks"] = {"by_status": by_status}
    except Exception as exc:
        logger.debug("stats overview: task counts failed — {}", exc)
        stats["tasks"] = {"by_status": {}}

    # AI call log totals
    try:
        r = await db.execute(
            text("SELECT COUNT(*), COALESCE(SUM(cost_usd), 0) FROM ai_call_log")
        )
        row = r.fetchone()
        stats["ai_calls"] = {
            "total": row[0] if row else 0,
            "total_cost_usd": float(row[1]) if row else 0.0,
        }
    except Exception as exc:
        logger.debug("stats overview: ai call totals failed — {}", exc)
        stats["ai_calls"] = {"total": 0, "total_cost_usd": 0.0}

    # Tags
    try:
        r = await db.execute(text("SELECT COUNT(*) FROM tag"))
        stats["tags"] = {"total": (r.scalar() or 0)}
    except Exception as exc:
        logger.debug("stats overview: tag count failed — {}", exc)
        stats["tags"] = {"total": 0}

    # Collections
    try:
        r = await db.execute(text("SELECT COUNT(*) FROM collection"))
        stats["collections"] = {"total": (r.scalar() or 0)}
    except Exception as exc:
        logger.debug("stats overview: collection count failed — {}", exc)
        stats["collections"] = {"total": 0}

    # Pipeline runs
    try:
        r = await db.execute(
            text("SELECT status, COUNT(*) FROM pipeline_run GROUP BY status")
        )
        by_status = {str(row[0]): row[1] for row in r.fetchall()}
        stats["pipelines"] = {"by_status": by_status}
    except Exception as exc:
        logger.debug("stats overview: pipeline counts failed — {}", exc)
        stats["pipelines"] = {"by_status": {}}

    await cache_set("stats:overview", stats, ttl=_OVERVIEW_TTL)
    return stats


@router.get("/studio")
async def studio_pulse(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Compact live studio metrics for motion-led UI surfaces."""
    cached = await cache_get("stats:studio")
    if cached is not None:
        return cached

    pulse: dict[str, Any] = {
        "assets_7d": 0,
        "productions_7d": 0,
        "active_pipelines": 0,
        "ai_calls_7d": 0,
        "motion_seed": 1,
        "throughput": [],
    }
    since = utcnow() - timedelta(days=7)

    try:
        r = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM asset
                WHERE is_deleted = false AND imported_at >= :since
            """),
            {"since": since},
        )
        pulse["assets_7d"] = int(r.scalar() or 0)
    except Exception as exc:
        logger.debug("studio pulse: assets_7d failed — {}", exc)

    try:
        r = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM production
                WHERE created_at >= :since
            """),
            {"since": since},
        )
        pulse["productions_7d"] = int(r.scalar() or 0)
    except Exception as exc:
        logger.debug("studio pulse: productions_7d failed — {}", exc)

    try:
        r = await db.execute(text("SELECT COUNT(*) FROM pipeline_run WHERE status = 0"))
        pulse["active_pipelines"] = int(r.scalar() or 0)
    except Exception as exc:
        logger.debug("studio pulse: active_pipelines failed — {}", exc)

    try:
        r = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM ai_call_log
                WHERE created_at >= :since
            """),
            {"since": since},
        )
        pulse["ai_calls_7d"] = int(r.scalar() or 0)
    except Exception as exc:
        logger.debug("studio pulse: ai_calls_7d failed — {}", exc)

    try:
        r = await db.execute(
            text("""
                SELECT date_trunc('day', imported_at) AS day, COUNT(*) AS count
                FROM asset
                WHERE is_deleted = false AND imported_at >= :since
                GROUP BY day
                ORDER BY day ASC
            """),
            {"since": since},
        )
        pulse["throughput"] = [
            {"date": row[0].date().isoformat(), "count": int(row[1])}
            for row in r.fetchall()
        ]
    except Exception as exc:
        logger.debug("studio pulse: throughput failed — {}", exc)

    pulse["motion_seed"] = (
        int(pulse["assets_7d"])
        + int(pulse["productions_7d"]) * 3
        + int(pulse["active_pipelines"]) * 7
        + int(pulse["ai_calls_7d"]) * 11
    ) or 1

    await cache_set("stats:studio", pulse, ttl=_OVERVIEW_TTL)
    return pulse


@router.get("/costs")
async def ai_costs(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """AI spending breakdown by provider and capability for the last N days."""
    since = utcnow() - timedelta(days=days)

    try:
        r = await db.execute(
            text("""
                SELECT provider, capability,
                       COUNT(*) AS calls,
                       COALESCE(SUM(cost_usd), 0) AS total_cost,
                       COALESCE(AVG(latency_ms), 0) AS avg_latency
                FROM ai_call_log
                WHERE created_at >= :since
                GROUP BY provider, capability
                ORDER BY total_cost DESC
            """),
            {"since": since},
        )
        rows = r.fetchall()
        by_provider: dict[str, Any] = {}
        total_cost = 0.0
        for row in rows:
            provider, capability, calls, cost, latency = row
            cost = float(cost)
            total_cost += cost
            if provider not in by_provider:
                by_provider[provider] = {"total_cost": 0.0, "capabilities": []}
            by_provider[provider]["total_cost"] += cost
            by_provider[provider]["capabilities"].append({
                "capability": capability,
                "calls": calls,
                "cost_usd": round(cost, 6),
                "avg_latency_ms": round(float(latency)),
            })

        return {
            "period_days": days,
            "total_cost_usd": round(total_cost, 6),
            "by_provider": by_provider,
        }
    except Exception:
        return {"period_days": days, "total_cost_usd": 0.0, "by_provider": {}}


@router.get("/activity")
async def recent_activity(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Recent assets and AI calls as an activity feed."""
    assets: list[dict[str, Any]] = []
    ai_calls: list[dict[str, Any]] = []

    try:
        r = await db.execute(
            text("""
                SELECT id, name, asset_type, mime_type, source, imported_at
                FROM asset
                WHERE is_deleted = false
                ORDER BY imported_at DESC
                LIMIT :limit
            """),
            {"limit": limit},
        )
        for row in r.fetchall():
            assets.append({
                "id": row[0], "name": row[1], "asset_type": row[2],
                "mime_type": row[3], "source": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
            })
    except Exception as exc:
        logger.debug("activity feed: asset query failed — {}", exc)

    try:
        r = await db.execute(
            text("""
                SELECT id, provider, capability, model, cost_usd, latency_ms, created_at
                FROM ai_call_log
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"limit": limit},
        )
        for row in r.fetchall():
            ai_calls.append({
                "id": row[0], "provider": row[1], "capability": row[2],
                "model": row[3], "cost_usd": float(row[4] or 0),
                "latency_ms": row[5],
                "created_at": row[6].isoformat() if row[6] else None,
            })
    except Exception as exc:
        logger.debug("activity feed: ai_call_log query failed — {}", exc)

    return {"assets": assets, "ai_calls": ai_calls}


@router.get("/storage")
async def storage_stats(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Asset storage usage by type."""
    try:
        r = await db.execute(
            text("""
                SELECT asset_type, COUNT(*), COALESCE(SUM(file_size), 0)
                FROM asset
                GROUP BY asset_type
                ORDER BY SUM(file_size) DESC NULLS LAST
            """)
        )
        rows = r.fetchall()
        total_bytes = 0
        by_type = []
        for row in rows:
            size = int(row[2])
            total_bytes += size
            by_type.append({"asset_type": row[0], "count": row[1], "bytes": size})

        return {
            "total_bytes": total_bytes,
            "total_gb": round(total_bytes / 1e9, 3),
            "by_type": by_type,
        }
    except Exception:
        return {"total_bytes": 0, "total_gb": 0.0, "by_type": []}
