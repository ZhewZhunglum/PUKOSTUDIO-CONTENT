from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.production import service
from app.modules.production.schemas import (
    AdPerformanceCreate,
    AdPerformanceOut,
    AdPerformanceUpdate,
    ProductionCreate,
    ProductionListResponse,
    ProductionOut,
    ProductionUpdate,
)

router = APIRouter(prefix="/productions", tags=["productions"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


# ── Productions ────────────────────────────────────────────────────────────────

@router.get("", response_model=ProductionListResponse)
async def list_productions(
    db: DbSession,
    prod_status: int | None = Query(None, alias="status", description="0=draft 1=published 2=archived"),
    platform: str | None = Query(None),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ProductionListResponse:
    return await service.list_productions(db, status=prod_status, platform=platform,
                                         limit=limit, offset=offset)


@router.post("", response_model=ProductionOut, status_code=status.HTTP_201_CREATED)
async def create_production(data: ProductionCreate, db: DbSession) -> ProductionOut:
    try:
        prod = await service.create_production(db, data)
    except service.ProductionAssetError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await db.commit()
    out = await service.get_production(db, prod.id)
    if out is None:
        raise HTTPException(status_code=500, detail="Failed to retrieve created production")
    return out


@router.get("/{production_id}", response_model=ProductionOut)
async def get_production(production_id: int, db: DbSession) -> ProductionOut:
    out = await service.get_production(db, production_id)
    if not out:
        raise HTTPException(status_code=404, detail="Production not found")
    return out


@router.patch("/{production_id}", response_model=ProductionOut)
async def update_production(
    production_id: int, data: ProductionUpdate, db: DbSession
) -> ProductionOut:
    prod = await service.update_production(db, production_id, data)
    if not prod:
        raise HTTPException(status_code=404, detail="Production not found")
    await db.commit()
    out = await service.get_production(db, production_id)
    assert out is not None
    return out


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production(production_id: int, db: DbSession) -> None:
    deleted = await service.delete_production(db, production_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Production not found")
    await db.commit()


# ── Ad Performance (nested under production) ───────────────────────────────────

@router.post(
    "/{production_id}/ad-performances",
    response_model=AdPerformanceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_ad_performance(
    production_id: int, data: AdPerformanceCreate, db: DbSession
) -> AdPerformanceOut:
    # Verify production exists
    prod = await service.get_production(db, production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Production not found")
    ad = await service.create_ad_performance(db, production_id, data)
    await db.commit()
    return AdPerformanceOut.model_validate(ad)


@router.patch(
    "/{production_id}/ad-performances/{ad_id}",
    response_model=AdPerformanceOut,
)
async def update_ad_performance(
    production_id: int, ad_id: int, data: AdPerformanceUpdate, db: DbSession
) -> AdPerformanceOut:
    ad = await service.update_ad_performance(db, ad_id, data)
    if not ad:
        raise HTTPException(status_code=404, detail="Ad performance record not found")
    await db.commit()
    return AdPerformanceOut.model_validate(ad)


@router.delete(
    "/{production_id}/ad-performances/{ad_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_ad_performance(
    production_id: int, ad_id: int, db: DbSession
) -> None:
    deleted = await service.delete_ad_performance(db, ad_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ad performance record not found")
    await db.commit()
