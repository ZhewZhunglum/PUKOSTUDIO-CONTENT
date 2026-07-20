from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import storage
from app.core.utils import utcnow
from app.modules.asset.models import Asset
from app.modules.production.models import AdPerformance, Production
from app.modules.production.schemas import (
    AdPerformanceCreate,
    AdPerformanceOut,
    AdPerformanceUpdate,
    ProductionCreate,
    ProductionListResponse,
    ProductionOut,
    ProductionUpdate,
)


class ProductionAssetError(ValueError):
    """Raised when a production is linked to an invalid asset."""


def _now() -> datetime:
    return utcnow().replace(tzinfo=None)


def _thumbnail_url(asset: Asset | None) -> str | None:
    if not asset:
        return None
    key = asset.thumbnail_key or asset.preview_key or asset.storage_key
    try:
        return storage.public_url(key)
    except Exception:
        return None


def _preview_url(asset: Asset | None) -> str | None:
    if not asset:
        return None
    key = asset.preview_key or asset.thumbnail_key or asset.storage_key
    try:
        return storage.public_url(key)
    except Exception:
        return None


def _build_out(
    prod: Production, asset: Asset | None, ads: list[AdPerformance]
) -> ProductionOut:
    """Pure assembly step — no I/O — shared by the single-row and batched paths."""
    out = ProductionOut.model_validate(prod)
    out.ad_performances = [AdPerformanceOut.model_validate(a) for a in ads]
    out.asset_thumbnail_url = _thumbnail_url(asset)
    out.asset_preview_url = _preview_url(asset)
    out.asset_name = asset.name if asset else None
    out.asset_duration_ms = asset.duration_ms if asset else None
    return out


async def _enrich(db: AsyncSession, prod: Production) -> ProductionOut:
    """Attach asset metadata and ad performances to a single production row."""
    asset_result = await db.execute(select(Asset).where(Asset.id == prod.asset_id))
    asset = asset_result.scalar_one_or_none()

    ad_result = await db.execute(
        select(AdPerformance)
        .where(AdPerformance.production_id == prod.id)
        .order_by(AdPerformance.date_start.desc().nulls_last())
    )
    return _build_out(prod, asset, list(ad_result.scalars()))


async def _enrich_many(db: AsyncSession, prods: list[Production]) -> list[ProductionOut]:
    """Batched version of `_enrich` — 2 queries total instead of 2 per row."""
    if not prods:
        return []

    asset_ids = [p.asset_id for p in prods if p.asset_id]
    assets_by_id: dict[int, Asset] = {}
    if asset_ids:
        asset_result = await db.execute(select(Asset).where(Asset.id.in_(asset_ids)))
        assets_by_id = {a.id: a for a in asset_result.scalars()}

    production_ids = [p.id for p in prods]
    ads_by_production: dict[int, list[AdPerformance]] = {pid: [] for pid in production_ids}
    ad_result = await db.execute(
        select(AdPerformance)
        .where(AdPerformance.production_id.in_(production_ids))
        .order_by(AdPerformance.production_id, AdPerformance.date_start.desc().nulls_last())
    )
    for ad in ad_result.scalars():
        ads_by_production.setdefault(ad.production_id, []).append(ad)

    return [
        _build_out(prod, assets_by_id.get(prod.asset_id), ads_by_production.get(prod.id, []))
        for prod in prods
    ]


# ── Production CRUD ───────────────────────────────────────────────────────────

async def list_productions(
    db: AsyncSession,
    status: int | None = None,
    platform: str | None = None,
    limit: int = 40,
    offset: int = 0,
) -> ProductionListResponse:
    q = select(Production).order_by(Production.created_at.desc())
    if status is not None:
        q = q.where(Production.status == status)
    if platform:
        q = q.where(Production.platform == platform)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    result = await db.execute(q.offset(offset).limit(limit))
    prods = list(result.scalars())

    items = await _enrich_many(db, prods)
    return ProductionListResponse(items=items, total=total)


async def get_production(db: AsyncSession, production_id: int) -> ProductionOut | None:
    result = await db.execute(select(Production).where(Production.id == production_id))
    prod = result.scalar_one_or_none()
    if not prod:
        return None
    return await _enrich(db, prod)


async def create_production(db: AsyncSession, data: ProductionCreate) -> Production:
    asset = await _get_valid_production_asset(db, data.asset_id)
    if not asset:
        raise ProductionAssetError("Asset must be an existing video or output asset")

    now = _now()
    prod = Production(
        asset_id=data.asset_id,
        title=data.title,
        description=data.description,
        platform=data.platform,
        platform_url=data.platform_url,
        published_at=data.published_at,
        status=data.status,
        sku_id=data.sku_id,
        brand_id=data.brand_id,
        video_project_id=data.video_project_id,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(prod)
    await db.flush()
    return prod


async def _get_valid_production_asset(db: AsyncSession, asset_id: int) -> Asset | None:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id,
            Asset.is_deleted.is_(False),
            Asset.asset_type.in_([2, 10]),
        )
    )
    return result.scalar_one_or_none()


async def update_production(
    db: AsyncSession, production_id: int, data: ProductionUpdate
) -> Production | None:
    result = await db.execute(select(Production).where(Production.id == production_id))
    prod = result.scalar_one_or_none()
    if not prod:
        return None

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prod, field, value)
    prod.updated_at = _now()
    await db.flush()
    return prod


async def delete_production(db: AsyncSession, production_id: int) -> bool:
    result = await db.execute(select(Production).where(Production.id == production_id))
    prod = result.scalar_one_or_none()
    if not prod:
        return False
    await db.delete(prod)
    return True


# ── AdPerformance CRUD ────────────────────────────────────────────────────────

async def create_ad_performance(
    db: AsyncSession, production_id: int, data: AdPerformanceCreate
) -> AdPerformance:
    now = _now()
    ad = AdPerformance(
        production_id=production_id,
        platform=data.platform,
        campaign_name=data.campaign_name,
        date_start=data.date_start,
        date_end=data.date_end,
        spend=data.spend,
        currency=data.currency,
        impressions=data.impressions,
        clicks=data.clicks,
        plays=data.plays,
        ctr=data.ctr,
        completion_rate=data.completion_rate,
        likes=data.likes,
        comments=data.comments,
        shares=data.shares,
        conversions=data.conversions,
        revenue=data.revenue,
        roas=data.roas,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(ad)
    await db.flush()
    return ad


async def update_ad_performance(
    db: AsyncSession, ad_id: int, data: AdPerformanceUpdate
) -> AdPerformance | None:
    result = await db.execute(select(AdPerformance).where(AdPerformance.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        return None

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ad, field, value)
    ad.updated_at = _now()
    await db.flush()
    return ad


async def delete_ad_performance(db: AsyncSession, ad_id: int) -> bool:
    result = await db.execute(select(AdPerformance).where(AdPerformance.id == ad_id))
    ad = result.scalar_one_or_none()
    if not ad:
        return False
    await db.delete(ad)
    return True
