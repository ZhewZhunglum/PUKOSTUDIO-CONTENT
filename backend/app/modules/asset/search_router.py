"""
Search endpoints:
  GET  /api/search            — unified RRF search (mode: keyword|semantic|hybrid)
  POST /api/search/visual     — upload image bytes → visual similarity
  GET  /api/search/similar/{asset_id} — find visually similar to existing asset
  POST /api/search/similar/text       — semantic search by text query
  GET  /api/search/history    — recent search queries
  GET  /api/search/hot        — top queries by frequency
"""
import base64
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import get_db
from app.core.utils import utcnow
from app.modules.asset import search as search_service
from app.modules.asset.schemas import AssetListItem

router = APIRouter(prefix="/search", tags=["search"])

_HISTORY_LIMIT = 200  # max rows kept in search_history


# ─────────────────────────────────────────────────────────────────────────────
# Unified RRF search
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AssetListItem])
async def unified_search(
    q: str = Query(min_length=1),
    mode: str = Query(default="hybrid", pattern="^(keyword|semantic|hybrid)$"),
    types: str | None = Query(None, description="Comma-separated asset type IDs"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified 5-dim RRF search.
    mode=keyword: trigram + FTS + tag match
    mode=semantic: text embedding cosine
    mode=hybrid:   all 4 dimensions fused via RRF (default)
    """
    asset_types = _parse_types(types)
    text_embedding: list[float] | None = None

    if mode in ("semantic", "hybrid"):
        text_embedding = await _get_text_embedding(q)

    results = await search_service.rrf_search(
        db, q,
        mode=mode,
        text_embedding=text_embedding,
        asset_types=asset_types,
        limit=limit,
    )

    await _record_history(db, q, mode, len(results))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Visual search — upload image
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/visual", response_model=list[dict[str, Any]])
async def visual_search(
    file: UploadFile = File(...),
    limit: int = Query(20, ge=1, le=100),
    types: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image file and find visually similar assets."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image")

    image_bytes = await file.read()
    b64 = base64.b64encode(image_bytes).decode()

    resp = await ai_gateway.call(
        AIRequest(
            capability="embedding",
            inputs={"image_b64": b64, "media_type": file.content_type},
            constraints={"quality_level": "visual"},
        )
    )
    if not resp.success or "embedding" not in resp.outputs:
        raise HTTPException(status_code=502, detail="Visual embedding failed")

    embedding: list[float] = resp.outputs["embedding"]
    asset_types = _parse_types(types)

    await _record_history(db, f"[visual:{file.filename}]", "visual", 0)
    return await search_service.vector_search_by_image(db, embedding, asset_types, limit)


# ─────────────────────────────────────────────────────────────────────────────
# Similar by existing asset
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/similar/{asset_id}", response_model=list[dict[str, Any]])
async def similar_to_asset(
    asset_id: int,
    mode: str = Query(default="visual", pattern="^(visual|text)$"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Find assets similar to an existing asset (by visual or text embedding)."""
    result = await db.execute(
        text("SELECT embedding_visual, embedding_text FROM asset WHERE id = :id AND is_deleted = false"),
        {"id": asset_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    if mode == "visual":
        if not row["embedding_visual"]:
            raise HTTPException(status_code=422, detail="Asset has no visual embedding")
        return await search_service.vector_search_by_image(db, list(row["embedding_visual"]), limit=limit)
    else:
        if not row["embedding_text"]:
            raise HTTPException(status_code=422, detail="Asset has no text embedding")
        return await search_service.vector_search_by_text(db, list(row["embedding_text"]), limit=limit)


# ─────────────────────────────────────────────────────────────────────────────
# Legacy: semantic by text (kept for backwards compat)
# ─────────────────────────────────────────────────────────────────────────────

class TextSimilarityRequest(BaseModel):
    query: str
    asset_types: list[int] | None = None
    limit: int = 20
    min_similarity: float = 0.3


@router.post("/similar/text", response_model=list[dict[str, Any]])
async def similar_by_text(req: TextSimilarityRequest, db: AsyncSession = Depends(get_db)):
    embedding = await _get_text_embedding(req.query)
    if not embedding:
        raise HTTPException(status_code=502, detail="Embedding unavailable")
    return await search_service.vector_search_by_text(
        db, embedding, asset_types=req.asset_types, limit=req.limit, min_similarity=req.min_similarity
    )


# ─────────────────────────────────────────────────────────────────────────────
# Search history
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/history", response_model=list[dict[str, Any]])
async def search_history(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Recent search queries (newest first)."""
    result = await db.execute(
        text("""
            SELECT query, search_mode, result_count, searched_at
            FROM search_history
            WHERE query NOT LIKE '[visual:%'
            ORDER BY searched_at DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/hot", response_model=list[dict[str, Any]])
async def hot_queries(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Top search queries by frequency over the past N days."""
    result = await db.execute(
        text("""
            SELECT query, COUNT(*) as count, MAX(searched_at) as last_searched
            FROM search_history
            WHERE query NOT LIKE '[visual:%'
              AND searched_at >= NOW() - make_interval(days => :days)
            GROUP BY query
            ORDER BY count DESC, last_searched DESC
            LIMIT :limit
        """),
        {"limit": limit, "days": days},
    )
    return [dict(r) for r in result.mappings().all()]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_types(types: str | None) -> list[int] | None:
    if not types:
        return None
    try:
        return [int(t.strip()) for t in types.split(",") if t.strip()]
    except ValueError:
        return None


async def _get_text_embedding(query: str) -> list[float] | None:
    try:
        resp = await ai_gateway.call(
            AIRequest(
                capability="embedding",
                inputs={"text": query},
                constraints={"quality_level": "text"},
            )
        )
        if resp.success and "embedding" in resp.outputs:
            return resp.outputs["embedding"]
    except Exception as exc:
        logger.debug("_get_text_embedding failed: {}", exc)
    return None


async def _record_history(db: AsyncSession, query: str, mode: str, result_count: int) -> None:
    try:
        await db.execute(
            text("""
                INSERT INTO search_history (query, search_mode, result_count, searched_at)
                VALUES (:q, :mode, :count, :now)
            """),
            {"q": query[:500], "mode": mode, "count": result_count, "now": utcnow()},
        )
        # Prune old entries (keep last 200)
        await db.execute(
            text("""
                DELETE FROM search_history
                WHERE id NOT IN (
                    SELECT id FROM search_history ORDER BY searched_at DESC LIMIT :keep
                )
            """),
            {"keep": _HISTORY_LIMIT},
        )
    except Exception as exc:
        logger.debug("_record_history failed (non-critical): {}", exc)
