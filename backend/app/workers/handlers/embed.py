"""
Embedding handlers.
- embed_text: generate text-embedding-3-large (3072d) and store in embedding_text
- embed_visual: call SigLIP-2 via Replicate (1024d) and store in embedding_visual
"""
import base64
from typing import Any

from loguru import logger
from sqlalchemy import update

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import async_session_factory
from app.core.storage import storage
from app.modules.asset.models import Asset
from app.workers.registry import register_handler


@register_handler("embed_text")
async def handle_embed_text(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id: int = payload["asset_id"]
    text: str = payload.get("text", "")

    if not text.strip():
        return {"skipped": True, "reason": "empty text"}

    req = AIRequest(
        capability="embedding",
        inputs={"text": text[:8000], "model": "text-embedding-3-large"},
        constraints={"quality_level": "text"},
    )
    response = await ai_gateway.call(req)
    if not response.success:
        raise RuntimeError(f"Embedding failed: {response.error}")

    embedding: list[float] = response.outputs["embedding"]

    async with async_session_factory() as session:
        await session.execute(
            update(Asset).where(Asset.id == asset_id).values(embedding_text=embedding)
        )
        await session.commit()

    logger.info(f"Text embedding stored for asset {asset_id} ({len(embedding)}d)")
    return {"asset_id": asset_id, "dims": len(embedding)}


@register_handler("embed_visual")
async def handle_embed_visual(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id: int = payload["asset_id"]

    async with async_session_factory() as session:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise ValueError(f"Asset {asset_id} not found")
        if asset.asset_type != 1:
            return {"skipped": True, "reason": "not an image"}
        storage_key = asset.storage_key
        mime_type = asset.mime_type or "image/jpeg"

    try:
        data = await storage.get_object_bytes(storage_key)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch image: {e}") from e

    b64 = base64.b64encode(data).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    req = AIRequest(
        capability="embedding",
        inputs={"image": data_url},
        constraints={"quality_level": "visual"},
    )
    response = await ai_gateway.call(req)
    if not response.success:
        raise RuntimeError(f"Visual embedding failed: {response.error}")

    embedding: list[float] = response.outputs["embedding"]

    async with async_session_factory() as session:
        await session.execute(
            update(Asset).where(Asset.id == asset_id).values(embedding_visual=embedding)
        )
        await session.commit()

    logger.info(f"Visual embedding stored for asset {asset_id} ({len(embedding)}d)")
    return {"asset_id": asset_id, "dims": len(embedding)}
