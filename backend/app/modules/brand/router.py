
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.brand import service
from app.modules.brand.schemas import BrandCreate, BrandOut, BrandUpdate

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandOut])
async def list_brands(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[BrandOut]:
    return await service.list_brands(db, limit=limit, offset=offset)


@router.post("", response_model=BrandOut, status_code=status.HTTP_201_CREATED)
async def create_brand(
    data: BrandCreate,
    db: AsyncSession = Depends(get_db),
) -> BrandOut:
    return await service.create_brand(db, data)


@router.get("/{brand_id}", response_model=BrandOut)
async def get_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
) -> BrandOut:
    brand = await service.get_brand(db, brand_id)
    if brand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return brand


@router.patch("/{brand_id}", response_model=BrandOut)
async def update_brand(
    brand_id: int,
    data: BrandUpdate,
    db: AsyncSession = Depends(get_db),
) -> BrandOut:
    brand = await service.update_brand(db, brand_id, data)
    if brand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await service.delete_brand(db, brand_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
