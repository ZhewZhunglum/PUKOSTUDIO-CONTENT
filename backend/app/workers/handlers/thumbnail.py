"""Media thumbnail generation tasks."""
from typing import Any

from loguru import logger
from sqlalchemy import update

from app.core.database import async_session_factory
from app.modules.asset.models import Asset
from app.modules.asset.thumbnails import (
    extract_video_first_frame_from_storage,
    generate_image_thumbnail_from_storage,
)
from app.workers.registry import register_handler


@register_handler("generate_thumbnail")
async def handle_generate_thumbnail(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id: int = payload["asset_id"]

    async with async_session_factory() as session:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise ValueError(f"Asset {asset_id} not found")
        if asset.asset_type not in (1, 2):
            return {"skipped": True, "reason": "not an image or video"}
        if asset.thumbnail_key:
            return {"skipped": True, "reason": "thumbnail already exists"}
        storage_key = asset.storage_key
        asset_type = asset.asset_type

    if asset_type == 2:
        thumbnail_key = await extract_video_first_frame_from_storage(storage_key)
    else:
        thumbnail_key = await generate_image_thumbnail_from_storage(storage_key)
    if not thumbnail_key:
        return {"skipped": True, "reason": "thumbnail extraction failed"}

    async with async_session_factory() as session:
        # Guard against a concurrent task having already written a key —
        # last-writer-wins would strand the first task's uploaded object.
        result = await session.execute(
            update(Asset)
            .where(Asset.id == asset_id, Asset.thumbnail_key.is_(None))
            .values(thumbnail_key=thumbnail_key)
        )
        await session.commit()
        if result.rowcount == 0:
            return {"skipped": True, "reason": "thumbnail set concurrently"}

    logger.info("Generated thumbnail for asset {}", asset_id)
    return {"asset_id": asset_id, "thumbnail_key": thumbnail_key}
