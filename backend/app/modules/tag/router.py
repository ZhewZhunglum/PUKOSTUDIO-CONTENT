from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.tag import service
from app.modules.tag.schemas import (
    AddTagsRequest,
    TagCreate,
    TagMergeRequest,
    TagOut,
    TagUpdate,
)

router = APIRouter(prefix="/tags", tags=["tags"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[TagOut])
async def list_tags(
    db: DbSession,
    category: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[TagOut]:
    tags = await service.list_tags(
        db, category=category, search=search, limit=limit, offset=offset
    )
    return [TagOut.model_validate(t) for t in tags]


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(data: TagCreate, db: DbSession) -> TagOut:
    tag = await service.create_tag(db, data)
    await db.commit()
    return TagOut.model_validate(tag)


@router.post("/merge", response_model=TagOut)
async def merge_tags(req: TagMergeRequest, db: DbSession) -> TagOut:
    tag = await service.merge_tags(db, req.source_ids, req.target_name)
    await db.commit()
    return TagOut.model_validate(tag)


@router.get("/asset/{asset_id}", response_model=list[TagOut])
async def get_asset_tags(asset_id: int, db: DbSession) -> list[TagOut]:
    tags = await service.get_tags_for_asset(db, asset_id)
    return [TagOut.model_validate(t) for t in tags]


@router.post("/asset/{asset_id}", response_model=list[TagOut], status_code=status.HTTP_201_CREATED)
async def add_tags_to_asset(
    asset_id: int, req: AddTagsRequest, db: DbSession
) -> list[TagOut]:
    tags = await service.add_tags_to_asset(db, asset_id, req.tag_names, req.source)
    await db.commit()
    return [TagOut.model_validate(t) for t in tags]


@router.delete("/asset/{asset_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_asset(
    asset_id: int, tag_id: int, db: DbSession
) -> None:
    removed = await service.remove_tag_from_asset(db, asset_id, tag_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Tag not found on asset")
    await db.commit()


@router.get("/{tag_id}", response_model=TagOut)
async def get_tag(tag_id: int, db: DbSession) -> TagOut:
    tag = await service.get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return TagOut.model_validate(tag)


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(tag_id: int, data: TagUpdate, db: DbSession) -> TagOut:
    tag = await service.update_tag(db, tag_id, data)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.commit()
    return TagOut.model_validate(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: int, db: DbSession) -> None:
    deleted = await service.delete_tag(db, tag_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tag not found or is a system tag")
    await db.commit()
