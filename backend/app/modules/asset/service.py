import uuid
from typing import Any

from sqlalchemy import Select, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import storage
from app.core.task_utils import enqueue_task
from app.core.utils import utcnow
from app.modules.asset.models import Asset
from app.modules.asset.schemas import (
    AssetCreate,
    AssetFacetTag,
    AssetFacetsResponse,
    AssetListItem,
    AssetListRequest,
    AssetListResponse,
    AssetSearchFilters,
    AssetSearchRequest,
    AssetUpdate,
    BulkAITagEstimate,
    BulkAITagRequest,
    BulkAITagResponse,
    IntRangeFilter,
)


async def create_asset(db: AsyncSession, data: AssetCreate) -> Asset:
    now = utcnow()
    asset = Asset(
        uuid=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        asset_type=data.asset_type,
        asset_subtype=data.asset_subtype,
        storage_key=data.storage_key,
        storage_bucket=data.storage_bucket,
        original_filename=data.original_filename,
        mime_type=data.mime_type,
        file_format=data.file_format,
        file_size=data.file_size,
        file_md5=data.file_md5,
        cdn_url=data.cdn_url,
        source=data.source,
        source_url=data.source_url,
        source_model=data.source_model,
        source_prompt=data.source_prompt,
        user_tags=data.user_tags or [],
        favorite=data.favorite,
        rating=data.rating,
        sku_id=data.sku_id,
        brand_id=data.brand_id,
        project_id=data.project_id,
        copyright_status=data.copyright_status,
        imported_at=now,
        updated_at=now,
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    return asset


async def get_asset(db: AsyncSession, asset_id: int) -> Asset | None:
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_asset_by_uuid(db: AsyncSession, asset_uuid: str) -> Asset | None:
    result = await db.execute(
        select(Asset).where(Asset.uuid == asset_uuid, Asset.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def find_by_md5(db: AsyncSession, file_md5: str) -> Asset | None:
    result = await db.execute(
        select(Asset).where(Asset.file_md5 == file_md5, Asset.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def find_by_source_url(db: AsyncSession, source_url: str) -> Asset | None:
    result = await db.execute(
        select(Asset).where(
            Asset.source_url == source_url,
            Asset.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def update_asset(db: AsyncSession, asset_id: int, data: AssetUpdate) -> Asset | None:
    asset = await get_asset(db, asset_id)
    if not asset:
        return None

    patch = data.model_dump(exclude_none=True)
    user_tags = patch.pop("user_tags", None)
    user_tags_add = patch.pop("user_tags_add", None)
    user_tags_remove = patch.pop("user_tags_remove", None)
    for field, value in patch.items():
        setattr(asset, field, value)

    if user_tags is not None or user_tags_add is not None or user_tags_remove is not None:
        from app.modules.tag import service as tag_service

        if user_tags is not None:
            current_tags = {tag.name for tag in await tag_service.get_tags_for_asset(db, asset_id)}
            next_tags = _normalize_tag_list(user_tags)
            await tag_service.remove_tags_from_asset_by_name(
                db,
                asset_id,
                sorted(current_tags - set(next_tags)),
            )
            await tag_service.add_tags_to_asset(db, asset_id, next_tags, source=1)
        if user_tags_remove:
            await tag_service.remove_tags_from_asset_by_name(db, asset_id, user_tags_remove)
        if user_tags_add:
            await tag_service.add_tags_to_asset(db, asset_id, user_tags_add, source=1)
        refreshed = await get_asset(db, asset_id)
        if refreshed:
            asset = refreshed

    asset.updated_at = utcnow()
    await db.flush()
    await db.refresh(asset)
    return asset


async def soft_delete_asset(db: AsyncSession, asset_id: int) -> bool:
    asset = await get_asset(db, asset_id)
    if not asset:
        return False
    asset.is_deleted = True
    asset.deleted_at = utcnow()
    await db.flush()
    return True


async def increment_use_count(db: AsyncSession, asset_id: int) -> None:
    await db.execute(
        update(Asset)
        .where(Asset.id == asset_id)
        .values(use_count=Asset.use_count + 1, last_used_at=utcnow())
    )


def _build_list_query(req: AssetListRequest) -> Select[tuple[Asset]]:
    conditions: list[Any] = [Asset.is_deleted.is_(False)]

    if req.asset_types:
        conditions.append(Asset.asset_type.in_(req.asset_types))
    if req.favorite is not None:
        conditions.append(Asset.favorite == req.favorite)
    if req.rating_gte is not None:
        conditions.append(Asset.rating >= req.rating_gte)
    if req.sku_id is not None:
        conditions.append(Asset.sku_id == req.sku_id)
    if req.imported_after is not None:
        conditions.append(Asset.imported_at >= req.imported_after)
    if req.imported_before is not None:
        conditions.append(Asset.imported_at <= req.imported_before)

    if req.tags_all:
        for tag in req.tags_all:
            conditions.append(
                or_(Asset.user_tags.contains([tag]), Asset.smart_tags.contains([tag]))
            )
    if req.tags_any:
        conditions.append(
            or_(
                *[Asset.user_tags.contains([tag]) for tag in req.tags_any],
                *[Asset.smart_tags.contains([tag]) for tag in req.tags_any],
            )
        )
    if req.tags_not:
        for tag in req.tags_not:
            conditions.append(~Asset.user_tags.contains([tag]))
            conditions.append(~Asset.smart_tags.contains([tag]))

    if req.search and req.search.strip():
        conditions.append(_build_search_condition(req.search))

    if req.cursor is not None:
        if req.sort == "recency":
            conditions.append(Asset.id < req.cursor)

    q = select(Asset).where(and_(*conditions))

    sort_map = {
        "recency": Asset.imported_at.desc(),
        "use_count": Asset.use_count.desc(),
        "rating": Asset.rating.desc(),
        "name": Asset.name.asc(),
    }
    q = q.order_by(sort_map.get(req.sort, Asset.imported_at.desc()), Asset.id.desc())
    return q


def _build_search_query(req: AssetSearchRequest) -> Select[tuple[Asset]]:
    conditions = _build_filter_conditions(req.filters)

    search_text = _join_search_terms(req.query, req.keyword)
    if search_text:
        conditions.append(_build_search_condition(search_text))

    if req.cursor is not None:
        conditions.append(Asset.id < req.cursor)

    q = select(Asset).where(and_(*conditions))
    return q.order_by(*_search_order_by(req.sort, search_text))


def _build_filter_conditions(filters: AssetSearchFilters) -> list[Any]:
    conditions: list[Any] = [Asset.is_deleted.is_(False)]

    if filters.asset_ids:
        conditions.append(Asset.id.in_(filters.asset_ids))
    if filters.asset_type:
        conditions.append(Asset.asset_type.in_(filters.asset_type))
    _append_range_conditions(conditions, Asset.duration_ms, filters.duration_ms)
    _append_range_conditions(conditions, Asset.width, filters.width)
    _append_range_conditions(conditions, Asset.height, filters.height)

    if filters.favorite is not None:
        conditions.append(Asset.favorite == filters.favorite)
    if filters.rating_gte is not None:
        conditions.append(Asset.rating >= filters.rating_gte)
    if filters.imported_after is not None:
        conditions.append(Asset.imported_at >= filters.imported_after)
    if filters.imported_before is not None:
        conditions.append(Asset.imported_at <= filters.imported_before)
    if filters.sku_id is not None:
        conditions.append(Asset.sku_id == filters.sku_id)
    if filters.brand_id is not None:
        conditions.append(Asset.brand_id == filters.brand_id)
    if filters.project_id is not None:
        conditions.append(Asset.project_id == filters.project_id)

    _append_tag_conditions(conditions, filters)
    return conditions


def _append_range_conditions(
    conditions: list[Any],
    field: Any,
    range_filter: IntRangeFilter | None,
) -> None:
    if range_filter is None:
        return
    if range_filter.gte is not None:
        conditions.append(field >= range_filter.gte)
    if range_filter.lte is not None:
        conditions.append(field <= range_filter.lte)


def _append_tag_conditions(conditions: list[Any], filters: AssetSearchFilters) -> None:
    if filters.tags_all:
        for tag in filters.tags_all:
            # Match if tag appears in user_tags OR smart_tags (AI-sourced)
            conditions.append(
                or_(Asset.user_tags.contains([tag]), Asset.smart_tags.contains([tag]))
            )
    if filters.tags_any:
        conditions.append(
            or_(
                *[Asset.user_tags.contains([tag]) for tag in filters.tags_any],
                *[Asset.smart_tags.contains([tag]) for tag in filters.tags_any],
            )
        )
    if filters.tags_not:
        for tag in filters.tags_not:
            # Exclude assets where tag appears in either user_tags or smart_tags
            conditions.append(~Asset.user_tags.contains([tag]))
            conditions.append(~Asset.smart_tags.contains([tag]))


def _build_search_condition(search: str) -> Any:
    escaped = _escape_like(search.strip())
    pattern = f"%{escaped}%"
    text_fields = (
        Asset.name,
        Asset.original_filename,
        Asset.description,
        Asset.ai_description,
        Asset.ocr_text,
        Asset.asr_text,
    )
    return or_(
        *[field.ilike(pattern, escape="\\") for field in text_fields],
        Asset.user_tags.contains([search.strip()]),
        Asset.smart_tags.contains([search.strip()]),
    )


def _join_search_terms(*terms: str | None) -> str | None:
    joined = " ".join(term.strip() for term in terms if term and term.strip())
    return joined or None


def _search_order_by(sort: str, search_text: str | None) -> list[Any]:
    if sort == "use_count":
        return [Asset.use_count.desc(), Asset.id.desc()]
    if sort == "rating":
        return [Asset.rating.desc(), Asset.id.desc()]
    if sort == "name":
        return [Asset.name.asc(), Asset.id.desc()]
    if sort == "relevance" and search_text:
        return [
            Asset.rating.desc(),
            Asset.use_count.desc(),
            Asset.imported_at.desc(),
            Asset.id.desc(),
        ]
    return [Asset.imported_at.desc(), Asset.id.desc()]


def _escape_like(value: str) -> str:
    return (
        value.replace("\\", r"\\")
        .replace("%", r"\%")
        .replace("_", r"\_")
    )


async def list_assets(db: AsyncSession, req: AssetListRequest) -> AssetListResponse:
    q = _build_list_query(req).limit(req.limit + 1)
    result = await db.execute(q)
    rows = result.scalars().all()

    has_more = len(rows) > req.limit
    items = rows[: req.limit]
    next_cursor = items[-1].id if has_more else None

    count_q = select(func.count()).select_from(
        _build_list_query(req).subquery()
    )
    count_result = await db.execute(count_q)
    total_hint = count_result.scalar()

    list_items = [AssetListItem.model_validate(a) for a in items]
    return AssetListResponse(items=list_items, next_cursor=next_cursor, total_hint=total_hint)


async def search_assets(db: AsyncSession, req: AssetSearchRequest) -> AssetListResponse:
    q = _build_search_query(req).limit(req.limit + 1)
    result = await db.execute(q)
    rows = result.scalars().all()

    has_more = len(rows) > req.limit
    items = rows[: req.limit]
    next_cursor = items[-1].id if has_more else None

    count_q = select(func.count()).select_from(_build_search_query(req).subquery())
    count_result = await db.execute(count_q)
    total_hint = count_result.scalar()

    list_items = [AssetListItem.model_validate(a) for a in items]
    return AssetListResponse(items=list_items, next_cursor=next_cursor, total_hint=total_hint)


async def get_facets(db: AsyncSession, tag_limit: int = 24) -> AssetFacetsResponse:
    by_type_result = await db.execute(
        select(Asset.asset_type, func.count())
        .where(Asset.is_deleted.is_(False))
        .group_by(Asset.asset_type)
    )
    by_type = {str(asset_type): count for asset_type, count in by_type_result.fetchall()}

    from app.modules.tag.models import Tag

    tags_result = await db.execute(
        select(Tag.name, Tag.use_count)
        .order_by(Tag.use_count.desc(), Tag.name.asc())
        .limit(tag_limit)
    )
    top_tags = [
        AssetFacetTag(name=name, use_count=use_count)
        for name, use_count in tags_result.fetchall()
    ]
    return AssetFacetsResponse(by_type=by_type, top_tags=top_tags)


async def estimate_bulk_ai_tag(db: AsyncSession) -> BulkAITagEstimate:
    result = await db.execute(
        select(func.count()).select_from(Asset).where(
            Asset.is_deleted.is_(False),
            Asset.ai_processing_status == 0,
            Asset.asset_type.in_([1, 2]),
        )
    )
    count = result.scalar_one()
    return BulkAITagEstimate(
        untagged_count=count,
        estimated_cost_usd=round(count * 0.003, 4),
    )


async def bulk_ai_tag(db: AsyncSession, req: BulkAITagRequest) -> BulkAITagResponse:
    if req.asset_ids:
        result = await db.execute(
            select(Asset).where(
                Asset.id.in_(req.asset_ids),
                Asset.is_deleted.is_(False),
            )
        )
        targets = list(result.scalars())
    else:
        q = select(Asset).where(
            Asset.is_deleted.is_(False),
            Asset.asset_type.in_([1, 2]),
        )
        if not req.force:
            q = q.where(Asset.ai_processing_status == 0)
        result = await db.execute(q.limit(200))
        targets = list(result.scalars())

    enqueued = 0
    for asset in targets:
        await enqueue_task(
            "ai_tag",
            {"asset_id": asset.id, "force": req.force, "quality": req.quality},
            priority=3,
        )
        enqueued += 1

    return BulkAITagResponse(
        enqueued=enqueued,
        message=f"Enqueued {enqueued} AI tagging tasks",
    )


async def enrich_with_cdn_url(asset: Asset) -> None:
    if asset.thumbnail_key:
        asset.cdn_url = storage.public_url(asset.thumbnail_key)


def _normalize_tag_list(tags: list[str]) -> list[str]:
    return list(dict.fromkeys(tag.strip().lower() for tag in tags if tag.strip()))
