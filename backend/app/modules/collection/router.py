from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.task_utils import enqueue_task, get_task_status
from app.modules.asset.schemas import AssetOut
from app.modules.collection import service
from app.modules.collection.schemas import (
    AddAssetsRequest,
    CollectionCreate,
    CollectionOut,
    CollectionUpdate,
)

router = APIRouter(prefix="/collections", tags=["collections"])


# ── AI collect models ──────────────────────────────────────────────────────────

class AICollectRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    collection_name: str | None = None
    max_results: int = Field(default=30, ge=1, le=100)


class AICollectResponse(BaseModel):
    task_id: int
    message: str


class AICollectStatusResponse(BaseModel):
    task_id: int
    status: str            # pending | running | done | failed
    collection_id: int | None = None
    collection_name: str | None = None
    asset_count: int | None = None
    error: str | None = None


@router.post("/ai-collect", response_model=AICollectResponse, status_code=status.HTTP_202_ACCEPTED)
async def ai_collect(req: AICollectRequest, db: AsyncSession = Depends(get_db)) -> AICollectResponse:
    task_id = await enqueue_task(
        "ai_collect",
        {
            "description": req.description,
            "collection_name": req.collection_name,
            "max_results": req.max_results,
        },
        priority=7,
    )
    return AICollectResponse(task_id=task_id, message="AI 素材收集任务已提交")


@router.get("/ai-collect/{task_id}", response_model=AICollectStatusResponse)
async def ai_collect_status(task_id: int, db: AsyncSession = Depends(get_db)) -> AICollectStatusResponse:
    task = await get_task_status(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    resp = AICollectStatusResponse(task_id=task_id, status=task.status)

    if task.status == "done" and task.result:
        resp.collection_id = task.result.get("collection_id")
        resp.collection_name = task.result.get("collection_name")
        resp.asset_count = task.result.get("asset_count")
    elif task.status == "failed":
        resp.error = task.error

    return resp


@router.get("", response_model=list[CollectionOut])
async def list_collections(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    cols = await service.list_collections(db, limit=limit, offset=offset)
    return [CollectionOut.model_validate(c) for c in cols]


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(data: CollectionCreate, db: AsyncSession = Depends(get_db)):
    col = await service.create_collection(db, data)
    await db.commit()
    return CollectionOut.model_validate(col)


@router.get("/{col_id}", response_model=CollectionOut)
async def get_collection(col_id: int, db: AsyncSession = Depends(get_db)):
    col = await service.get_collection(db, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return CollectionOut.model_validate(col)


@router.patch("/{col_id}", response_model=CollectionOut)
async def update_collection(
    col_id: int, data: CollectionUpdate, db: AsyncSession = Depends(get_db)
):
    col = await service.update_collection(db, col_id, data)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.commit()
    return CollectionOut.model_validate(col)


@router.delete("/{col_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(col_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_collection(db, col_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.commit()


@router.get("/{col_id}/assets", response_model=list[int])
async def get_collection_assets(col_id: int, db: AsyncSession = Depends(get_db)):
    col = await service.get_collection(db, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return await service.get_collection_asset_ids(db, col_id)


@router.get("/{col_id}/assets/detail", response_model=list[AssetOut])
async def get_collection_assets_detail(col_id: int, db: AsyncSession = Depends(get_db)):
    col = await service.get_collection(db, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    assets = await service.get_collection_assets(db, col_id)
    return [AssetOut.model_validate(a) for a in assets]


@router.post("/{col_id}/assets", status_code=status.HTTP_201_CREATED)
async def add_assets(col_id: int, req: AddAssetsRequest, db: AsyncSession = Depends(get_db)):
    col = await service.get_collection(db, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    added = await service.add_assets(db, col_id, req.asset_ids)
    await db.commit()
    return {"added": added}


@router.delete("/{col_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_asset(col_id: int, asset_id: int, db: AsyncSession = Depends(get_db)):
    removed = await service.remove_asset(db, col_id, asset_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Asset not in collection")
    await db.commit()
