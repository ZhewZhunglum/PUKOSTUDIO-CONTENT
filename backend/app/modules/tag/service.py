from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.asset.models import Asset
from app.modules.tag.models import AssetTag, Tag
from app.modules.tag.schemas import TagCreate, TagUpdate


def _normalize_tag_name(name: str) -> str:
    return name.strip().lower()


async def get_or_create_tag(db: AsyncSession, name: str) -> Tag:
    name = _normalize_tag_name(name)
    result = await db.execute(select(Tag).where(Tag.name == name))
    tag = result.scalar_one_or_none()
    if tag:
        return tag

    tag = Tag(name=name, created_at=utcnow())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


async def get_tag(db: AsyncSession, tag_id: int) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    return result.scalar_one_or_none()


async def list_tags(
    db: AsyncSession,
    category: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Tag]:
    q = select(Tag)
    if category:
        q = q.where(Tag.category == category)
    if search:
        escaped = search.replace("%", r"\%").replace("_", r"\_")
        q = q.where(Tag.name.ilike(f"%{escaped}%", escape="\\"))
    q = q.order_by(Tag.use_count.desc(), Tag.name).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_tag(db: AsyncSession, data: TagCreate) -> Tag:
    tag = Tag(
        name=_normalize_tag_name(data.name),
        category=data.category,
        parent_id=data.parent_id,
        aliases=data.aliases,
        color=data.color,
        description=data.description,
        created_at=utcnow(),
    )
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


async def update_tag(db: AsyncSession, tag_id: int, data: TagUpdate) -> Tag | None:
    tag = await get_tag(db, tag_id)
    if not tag:
        return None
    patch = data.model_dump(exclude_none=True)
    for field, value in patch.items():
        setattr(tag, field, value)
    await db.flush()
    await db.refresh(tag)
    return tag


async def rename_category(db: AsyncSession, old_name: str, new_name: str) -> int:
    old = old_name.strip()
    new = new_name.strip()
    if not old or not new or old == new:
        return 0

    old_value = None if old == "未分类" else old
    new_value = None if new == "未分类" else new
    result = await db.execute(
        update(Tag)
        .where(Tag.category.is_(None) if old_value is None else Tag.category == old_value)
        .values(category=new_value)
    )
    await db.flush()
    return result.rowcount or 0


async def delete_tag(db: AsyncSession, tag_id: int) -> bool:
    tag = await get_tag(db, tag_id)
    if not tag or tag.is_system:
        return False
    await db.delete(tag)
    await db.flush()
    return True


async def add_tags_to_asset(
    db: AsyncSession, asset_id: int, tag_names: list[str], source: int
) -> list[Tag]:
    normalized_names = list(
        dict.fromkeys(name for raw in tag_names if (name := _normalize_tag_name(raw)))
    )
    if not normalized_names:
        await _sync_asset_user_tags(db, asset_id)
        return []

    existing_result = await db.execute(select(Tag).where(Tag.name.in_(normalized_names)))
    tags_by_name = {tag.name: tag for tag in existing_result.scalars().all()}

    for name in normalized_names:
        if name in tags_by_name:
            continue
        tag = Tag(name=name, created_at=utcnow())
        db.add(tag)
        tags_by_name[name] = tag

    await db.flush()

    tags = [tags_by_name[name] for name in normalized_names]
    tag_ids = [tag.id for tag in tags]
    linked_result = await db.execute(
        select(AssetTag.tag_id).where(
            AssetTag.asset_id == asset_id,
            AssetTag.tag_id.in_(tag_ids),
        )
    )
    linked_ids = set(linked_result.scalars().all())
    missing_link_ids = [tag_id for tag_id in tag_ids if tag_id not in linked_ids]

    for tag_id in missing_link_ids:
        db.add(
            AssetTag(
                asset_id=asset_id,
                tag_id=tag_id,
                source=source,
                created_at=utcnow(),
            )
        )

    if missing_link_ids:
        await db.execute(
            update(Tag)
            .where(Tag.id.in_(missing_link_ids))
            .values(use_count=Tag.use_count + 1)
        )

    await db.flush()
    await _sync_asset_user_tags(db, asset_id)
    return tags


async def remove_tag_from_asset(db: AsyncSession, asset_id: int, tag_id: int) -> bool:
    result = await db.execute(
        select(AssetTag).where(
            AssetTag.asset_id == asset_id, AssetTag.tag_id == tag_id
        )
    )
    asset_tag = result.scalar_one_or_none()
    if not asset_tag:
        return False
    await db.delete(asset_tag)
    await db.execute(
        update(Tag)
        .where(Tag.id == tag_id, Tag.use_count > 0)
        .values(use_count=Tag.use_count - 1)
    )
    await db.flush()
    await _sync_asset_user_tags(db, asset_id)
    return True


async def remove_tags_from_asset_by_name(
    db: AsyncSession,
    asset_id: int,
    tag_names: list[str],
) -> int:
    normalized_names = list(
        dict.fromkeys(name for raw in tag_names if (name := _normalize_tag_name(raw)))
    )
    if not normalized_names:
        return 0

    result = await db.execute(select(Tag.id).where(Tag.name.in_(normalized_names)))
    tag_ids = list(result.scalars().all())
    if not tag_ids:
        return 0

    link_result = await db.execute(
        select(AssetTag).where(
            AssetTag.asset_id == asset_id,
            AssetTag.tag_id.in_(tag_ids),
        )
    )
    links = list(link_result.scalars().all())
    if not links:
        return 0

    removed_ids = [link.tag_id for link in links]
    for link in links:
        await db.delete(link)

    await db.execute(
        update(Tag)
        .where(Tag.id.in_(removed_ids), Tag.use_count > 0)
        .values(use_count=Tag.use_count - 1)
    )
    await db.flush()
    await _sync_asset_user_tags(db, asset_id)
    return len(links)


async def get_tags_for_asset(db: AsyncSession, asset_id: int) -> list[Tag]:
    result = await db.execute(
        select(Tag)
        .join(AssetTag, AssetTag.tag_id == Tag.id)
        .where(AssetTag.asset_id == asset_id)
        .order_by(Tag.name)
    )
    return list(result.scalars().all())


async def merge_tags(
    db: AsyncSession, source_ids: list[int], target_name: str
) -> Tag:
    target = await get_or_create_tag(db, target_name)
    affected_asset_ids: set[int] = set()
    merged_aliases = set(target.aliases or [])

    for source_id in source_ids:
        if source_id == target.id:
            continue
        source = await get_tag(db, source_id)
        if not source:
            continue

        merged_aliases.add(source.name)
        merged_aliases.update(source.aliases or [])
        result = await db.execute(
            select(AssetTag).where(AssetTag.tag_id == source_id)
        )
        for at in result.scalars().all():
            affected_asset_ids.add(at.asset_id)
            existing = await db.execute(
                select(AssetTag).where(
                    AssetTag.asset_id == at.asset_id, AssetTag.tag_id == target.id
                )
            )
            if not existing.scalar_one_or_none():
                at.tag_id = target.id
            else:
                await db.delete(at)

        if source and not source.is_system:
            await db.delete(source)
        elif source:
            source.use_count = 0

    target.aliases = sorted(alias for alias in merged_aliases if alias != target.name)
    await db.flush()
    count_result = await db.execute(
        select(func.count()).where(AssetTag.tag_id == target.id)
    )
    target.use_count = count_result.scalar() or 0
    for asset_id in affected_asset_ids:
        await _sync_asset_user_tags(db, asset_id)
    await db.flush()
    await db.refresh(target)
    return target


async def _sync_asset_user_tags(db: AsyncSession, asset_id: int) -> None:
    result = await db.execute(
        select(Tag.name)
        .join(AssetTag, AssetTag.tag_id == Tag.id)
        .where(AssetTag.asset_id == asset_id)
        .order_by(Tag.name)
    )
    tag_names = list(result.scalars().all())
    await db.execute(
        update(Asset)
        .where(Asset.id == asset_id)
        .values(user_tags=tag_names, updated_at=utcnow())
    )
