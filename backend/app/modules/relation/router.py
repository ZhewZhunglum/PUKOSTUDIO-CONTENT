from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.relation import service
from app.modules.relation.schemas import RelationCreate, RelationOut

router = APIRouter(prefix="/relations", tags=["relations"])


@router.get("/asset/{asset_id}", response_model=list[RelationOut])
async def get_asset_relations(
    asset_id: int,
    relation_type: str | None = Query(None),
    direction: str = Query("both", pattern="^(both|incoming|outgoing)$"),
    db: AsyncSession = Depends(get_db),
):
    rels = await service.get_relations(db, asset_id, relation_type=relation_type, direction=direction)
    return [RelationOut.model_validate(r) for r in rels]


@router.post("", response_model=RelationOut, status_code=status.HTTP_201_CREATED)
async def create_relation(data: RelationCreate, db: AsyncSession = Depends(get_db)):
    try:
        rel = await service.create_relation(db, data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    await db.commit()
    return RelationOut.model_validate(rel)


@router.delete("/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relation(relation_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_relation(db, relation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Relation not found")
    await db.commit()
