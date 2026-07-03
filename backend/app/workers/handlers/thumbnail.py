"""Media thumbnail generation tasks."""
from typing import Any

from loguru import logger
from sqlalchemy import update

from app.core.database import async_session_factory
from app.modules.asset.models import Asset
from app.modules.asset.thumbnails import extract_video_first_frame_from_storage
from app.workers.registry import register_handler


@register_handler("generate_thumbnail")
async def handle_generate_thumbnail(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id: int = payload["asset_id"]

    async with async_session_factory() as session:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise ValueError(f"Asset {asset_id} not found")
        if asset.asset_type != 2:
            return {"skipped": True, "reason": "not a video"}
        if asset.thumbnail_key:
            return {"skipped": True, "reason": "thumbnail already exists"}
        storage_key = asset.storage_key

    thumbnail_key = await extract_video_first_frame_from_storage(storage_key)
    if not thumbnail_key:
        return {"skipped": True, "reason": "thumbnail extraction failed"}

    async with async_session_factory() as session:
        await session.execute(
            update(Asset)
            .where(Asset.id == asset_id)
            .values(thumbnail_key=thumbnail_key)
        )
        await session.commit()

    logger.info("Generated first-frame thumbnail for asset {}", asset_id)
    return {"asset_id": asset_id, "thumbnail_key": thumbnail_key}
