from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.brand.models import Brand
from app.modules.brand.schemas import BrandCreate, BrandUpdate


async def create_brand(db: AsyncSession, data: BrandCreate) -> Brand:
    now = utcnow()
    brand = Brand(
        **data.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


async def get_brand(db: AsyncSession, brand_id: int) -> Brand | None:
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    return result.scalar_one_or_none()


async def list_brands(db: AsyncSession, limit: int = 20, offset: int = 0) -> list[Brand]:
    result = await db.execute(
        select(Brand).order_by(Brand.id.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def update_brand(
    db: AsyncSession, brand_id: int, data: BrandUpdate
) -> Brand | None:
    brand = await get_brand(db, brand_id)
    if brand is None:
        return None
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(brand, field, value)
    brand.updated_at = utcnow()
    await db.commit()
    await db.refresh(brand)
    return brand


async def delete_brand(db: AsyncSession, brand_id: int) -> bool:
    brand = await get_brand(db, brand_id)
    if brand is None:
        return False
    await db.delete(brand)
    await db.commit()
    return True
