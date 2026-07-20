from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.asset.models import Asset
from app.modules.collection.models import Collection, CollectionAsset
from app.modules.collection.schemas import CollectionCreate, CollectionUpdate


async def create_collection(db: AsyncSession, data: CollectionCreate) -> Collection:
    now = utcnow()
    col = Collection(
        name=data.name,
        description=data.description,
        cover_asset_id=data.cover_asset_id,
        is_smart=data.is_smart,
        smart_rules=data.smart_rules,
        sort_order=data.sort_order,
        created_at=now,
        updated_at=now,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col


async def get_collection(db: AsyncSession, col_id: int) -> Collection | None:
    result = await db.execute(select(Collection).where(Collection.id == col_id))
    return result.scalar_one_or_none()


async def list_collections(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[Collection]:
    result = await db.execute(
        select(Collection).order_by(Collection.sort_order, Collection.created_at.desc())
        .limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def update_collection(
    db: AsyncSession, col_id: int, data: CollectionUpdate
) -> Collection | None:
    col = await get_collection(db, col_id)
    if not col:
        return None
    patch = data.model_dump(exclude_none=True)
    for field, value in patch.items():
        setattr(col, field, value)
    col.updated_at = utcnow()
    await db.flush()
    await db.refresh(col)
    return col


async def delete_collection(db: AsyncSession, col_id: int) -> bool:
    col = await get_collection(db, col_id)
    if not col:
        return False
    await db.execute(delete(CollectionAsset).where(CollectionAsset.collection_id == col_id))
    await db.delete(col)
    await db.flush()
    return True


async def add_assets(db: AsyncSession, col_id: int, asset_ids: list[int]) -> int:
    if not asset_ids:
        return 0

    now = utcnow()
    result = await db.execute(
        pg_insert(CollectionAsset)
        .values(
            [
                {"collection_id": col_id, "asset_id": asset_id, "added_at": now}
                for asset_id in asset_ids
            ]
        )
        .on_conflict_do_nothing(index_elements=["collection_id", "asset_id"])
        .returning(CollectionAsset.asset_id)
    )
    added = len(result.fetchall())

    if added:
        await db.execute(
            update(Collection)
            .where(Collection.id == col_id)
            .values(asset_count=Collection.asset_count + added, updated_at=utcnow())
        )
    await db.flush()
    return added


async def remove_asset(db: AsyncSession, col_id: int, asset_id: int) -> bool:
    result = await db.execute(
        select(CollectionAsset).where(
            CollectionAsset.collection_id == col_id,
            CollectionAsset.asset_id == asset_id,
        )
    )
    ca = result.scalar_one_or_none()
    if not ca:
        return False
    await db.delete(ca)
    await db.execute(
        update(Collection)
        .where(Collection.id == col_id, Collection.asset_count > 0)
        .values(asset_count=Collection.asset_count - 1, updated_at=utcnow())
    )
    await db.flush()
    return True


async def get_collection_asset_ids(db: AsyncSession, col_id: int) -> list[int]:
    result = await db.execute(
        select(CollectionAsset.asset_id)
        .where(CollectionAsset.collection_id == col_id)
        .order_by(CollectionAsset.sort_order, CollectionAsset.added_at)
    )
    return list(result.scalars().all())


async def get_collection_assets(db: AsyncSession, col_id: int) -> list[Asset]:
    result = await db.execute(
        select(Asset)
        .join(CollectionAsset, CollectionAsset.asset_id == Asset.id)
        .where(
            CollectionAsset.collection_id == col_id,
            Asset.is_deleted.is_(False),
        )
        .order_by(CollectionAsset.sort_order, CollectionAsset.added_at)
    )
    return list(result.scalars().all())
