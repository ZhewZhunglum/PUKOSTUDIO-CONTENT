"""
video_gen handler: calls Seedance 1.0 Pro (or Sora/Veo) via AI gateway,
downloads the result, stores in R2, updates the VideoClip and creates an Asset.

Payload:
  video_project_id: int
  clip_id: int
  prompt: str
  reference_asset_id: int | None
  duration_seconds: int
  quality: str
"""
import base64
from typing import Any

import httpx
from loguru import logger
from sqlalchemy import update

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import async_session_factory
from app.core.storage import storage
from app.core.task_utils import enqueue_task
from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset
from app.modules.asset.models import Asset
from app.modules.video.models import VideoClip
from app.workers.registry import register_handler


@register_handler("video_gen")
async def handle_video_gen(payload: dict[str, Any]) -> dict[str, Any]:
    clip_id: int = payload["clip_id"]
    prompt: str = payload["prompt"]
    reference_asset_id: int | None = payload.get("reference_asset_id")
    duration_seconds: int = payload.get("duration_seconds", 5)
    quality: str = payload.get("quality", "default")

    # Mark clip as generating
    async with async_session_factory() as session:
        await session.execute(
            update(VideoClip).where(VideoClip.id == clip_id).values(ai_status=1)
        )
        await session.commit()

    inputs: dict[str, Any] = {
        "prompt": prompt,
        "duration": duration_seconds,
    }

    if reference_asset_id:
        async with async_session_factory() as session:
            ref = await session.get(Asset, reference_asset_id)
            if ref and ref.asset_type == 1:  # image
                img_bytes = await storage.get_object_bytes(ref.storage_key)
                inputs["image"] = base64.b64encode(img_bytes).decode()

    response = await ai_gateway.call(
        AIRequest(
            capability="video_gen",
            inputs=inputs,
            constraints={"quality_level": quality},
        )
    )

    if not response.success:
        async with async_session_factory() as session:
            await session.execute(
                update(VideoClip).where(VideoClip.id == clip_id).values(ai_status=3)
            )
            await session.commit()
        raise RuntimeError(f"Video gen failed: {response.error}")

    video_url: str = response.outputs.get("video_url", "")
    if not video_url:
        raise RuntimeError("No video_url in response")

    # Download the generated video
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        video_bytes = resp.content

    async with async_session_factory() as session:
        asset = await create_generated_asset(
            session,
            GeneratedAssetInput(
                name=f"AI Video — {prompt[:60]}",
                asset_type=2,
                capability="video_gen",
                source_model=response.model_used,
                source_prompt=prompt,
                data=video_bytes,
                mime_type="video/mp4",
                file_format="mp4",
                description=prompt,
            ),
            enqueue_processing=False,
        )

        await session.execute(
            update(VideoClip)
            .where(VideoClip.id == clip_id)
            .values(asset_id=asset.id, ai_status=2, duration_ms=duration_seconds * 1000)
        )
        await session.commit()

    # Queue text embedding for the prompt
    await enqueue_task("embed_text", {"asset_id": asset.id, "text": prompt})
    await enqueue_task("ai_tag", {"asset_id": asset.id, "quality": "bulk_local"})
    await enqueue_task("embed_visual", {"asset_id": asset.id})

    logger.info(f"Video gen done for clip {clip_id}, asset {asset.id}")
    return {"clip_id": clip_id, "asset_id": asset.id, "bytes": len(video_bytes)}
