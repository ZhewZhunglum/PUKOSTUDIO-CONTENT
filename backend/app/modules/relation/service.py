from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.relation.models import AssetRelation
from app.modules.relation.schemas import RelationCreate


async def create_relation(db: AsyncSession, data: RelationCreate) -> AssetRelation:
    existing = await db.execute(
        select(AssetRelation).where(
            AssetRelation.source_asset_id == data.source_asset_id,
            AssetRelation.target_asset_id == data.target_asset_id,
            AssetRelation.relation_type == data.relation_type,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Relation already exists")

    rel = AssetRelation(
        source_asset_id=data.source_asset_id,
        target_asset_id=data.target_asset_id,
        relation_type=data.relation_type,
        extra_data=data.extra_data,
        created_at=utcnow(),
    )
    db.add(rel)
    await db.flush()
    await db.refresh(rel)
    return rel


async def get_relations(
    db: AsyncSession,
    asset_id: int,
    relation_type: str | None = None,
    direction: str = "both",
) -> list[AssetRelation]:
    if direction == "outgoing":
        cond = AssetRelation.source_asset_id == asset_id
    elif direction == "incoming":
        cond = AssetRelation.target_asset_id == asset_id
    else:
        cond = or_(
            AssetRelation.source_asset_id == asset_id,
            AssetRelation.target_asset_id == asset_id,
        )

    q = select(AssetRelation).where(cond)
    if relation_type:
        q = q.where(AssetRelation.relation_type == relation_type)
    q = q.order_by(AssetRelation.created_at.desc())

    result = await db.execute(q)
    return list(result.scalars().all())


async def delete_relation(db: AsyncSession, relation_id: int) -> bool:
    result = await db.execute(
        select(AssetRelation).where(AssetRelation.id == relation_id)
    )
    rel = result.scalar_one_or_none()
    if not rel:
        return False
    await db.delete(rel)
    await db.flush()
    return True
