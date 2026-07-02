
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.sku import service
from app.modules.sku.schemas import SkuCreate, SkuOut, SkuUpdate

router = APIRouter(prefix="/skus", tags=["skus"])


@router.get("", response_model=list[SkuOut])
async def list_skus(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    brand_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[SkuOut]:
    return await service.list_skus(db, limit=limit, offset=offset, brand_id=brand_id)


@router.post("", response_model=SkuOut, status_code=status.HTTP_201_CREATED)
async def create_sku(
    data: SkuCreate,
    db: AsyncSession = Depends(get_db),
) -> SkuOut:
    return await service.create_sku(db, data)


@router.get("/{sku_id}", response_model=SkuOut)
async def get_sku(
    sku_id: int,
    db: AsyncSession = Depends(get_db),
) -> SkuOut:
    sku = await service.get_sku(db, sku_id)
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")
    return sku


@router.patch("/{sku_id}", response_model=SkuOut)
async def update_sku(
    sku_id: int,
    data: SkuUpdate,
    db: AsyncSession = Depends(get_db),
) -> SkuOut:
    sku = await service.update_sku(db, sku_id, data)
    if sku is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")
    return sku


@router.delete("/{sku_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sku(
    sku_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await service.delete_sku(db, sku_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")
