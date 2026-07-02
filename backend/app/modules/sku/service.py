from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.sku.models import Sku
from app.modules.sku.schemas import SkuCreate, SkuUpdate


async def create_sku(db: AsyncSession, data: SkuCreate) -> Sku:
    now = utcnow()
    sku = Sku(
        **data.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(sku)
    await db.commit()
    await db.refresh(sku)
    return sku


async def get_sku(db: AsyncSession, sku_id: int) -> Sku | None:
    result = await db.execute(select(Sku).where(Sku.id == sku_id))
    return result.scalar_one_or_none()


async def list_skus(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    brand_id: int | None = None,
) -> list[Sku]:
    query = select(Sku)
    if brand_id is not None:
        query = query.where(Sku.brand_id == brand_id)
    query = query.order_by(Sku.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_sku(
    db: AsyncSession, sku_id: int, data: SkuUpdate
) -> Sku | None:
    sku = await get_sku(db, sku_id)
    if sku is None:
        return None
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(sku, field, value)
    sku.updated_at = utcnow()
    await db.commit()
    await db.refresh(sku)
    return sku


async def delete_sku(db: AsyncSession, sku_id: int) -> bool:
    sku = await get_sku(db, sku_id)
    if sku is None:
        return False
    await db.delete(sku)
    await db.commit()
    return True
