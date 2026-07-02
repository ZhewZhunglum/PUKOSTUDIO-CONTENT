"""
AI auto-tagging handler.
Task type: ai_tag
Payload: {"asset_id": int, "force": bool = False, "quality": str = "bulk_local"}

Flow:
1. Load asset from DB
2. Resolve vision source: image → storage_key; video → thumbnail_key/preview_key
3. Call Claude Vision; fallback to text_gen if no image available
4. Write ai_tags + ai_description to asset table
5. Sync tag names into asset_tag junction table (source=2 for AI)
6. Queue embed_text task
"""
import base64
import json
from typing import Any

from loguru import logger
from sqlalchemy import update

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import async_session_factory
from app.core.storage import storage
from app.modules.asset.models import Asset
from app.workers.registry import register_handler

# ── storage helpers ────────────────────────────────────────────────────────────

async def _fetch_b64(key: str) -> str | None:
    """Download a storage object and return base64-encoded bytes."""
    try:
        data = await storage.get_object_bytes(key)
        if data:
            return base64.b64encode(data).decode()
    except Exception as e:
        logger.warning(f"Failed to fetch object {key!r}: {e}")
    return None


def _vision_key_for_asset(asset: Asset) -> str | None:
    """Return the best storage key to use as the vision input for an asset."""
    if asset.asset_type == 1:          # image — use original
        return asset.storage_key
    if asset.asset_type == 2:          # video — prefer thumbnail, then preview
        return asset.thumbnail_key or asset.preview_key
    return None


# ── main handler ───────────────────────────────────────────────────────────────

@register_handler("ai_tag")
async def handle_ai_tag(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id: int = payload["asset_id"]
    force: bool = payload.get("force", False)
    quality: str = payload.get("quality", "bulk_local")

    async with async_session_factory() as session:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise ValueError(f"Asset {asset_id} not found")

        if asset.ai_processing_status == 2 and not force:
            return {"skipped": True, "reason": "already processed"}

        await session.execute(
            update(Asset).where(Asset.id == asset_id).values(ai_processing_status=1)
        )
        await session.commit()

    # Keep a local copy of fields we need after the session closes
    asset_name = asset.name
    asset_type = asset.asset_type
    asset_description = asset.description or ""
    user_tags = asset.user_tags or []

    # ── build AI request ───────────────────────────────────────────────────────
    vision_key = _vision_key_for_asset(asset)
    b64_image = await _fetch_b64(vision_key) if vision_key else None

    if b64_image:
        prompt = _VIDEO_VISION_PROMPT if asset_type == 2 else _IMAGE_VISION_PROMPT
        req = AIRequest(
            capability="vision",
            inputs={"prompt": prompt, "image_b64": b64_image, "max_tokens": 1024},
            constraints={"quality_level": quality},
        )
    else:
        asset_info = f"Name: {asset_name}\nType: {asset_type}\nDescription: {asset_description}"
        req = AIRequest(
            capability="text_gen",
            inputs={
                "prompt": _TEXT_TAG_PROMPT.format(asset_info=asset_info),
                "max_tokens": 512,
                "system": "You are a content tagging assistant. Respond only with valid JSON.",
            },
            constraints={"quality_level": "bulk_local"},
        )

    response = await ai_gateway.call(req)

    if not response.success:
        async with async_session_factory() as session:
            await session.execute(
                update(Asset).where(Asset.id == asset_id).values(ai_processing_status=3)
            )
            await session.commit()
        raise RuntimeError(f"AI tagging call failed: {response.error}")

    parsed = _parse_tag_response(response.outputs.get("text", ""), asset_name)
    tag_names = [t["name"] for t in parsed["tags"]]

    # ── persist results ────────────────────────────────────────────────────────
    async with async_session_factory() as session:
        await session.execute(
            update(Asset)
            .where(Asset.id == asset_id)
            .values(
                ai_tags=parsed["tags"],
                ai_description=parsed["description"],
                ai_processing_status=2,
            )
        )
        await session.commit()

    # Sync ai tags into the asset_tag junction table (source=2 = ai)
    if tag_names:
        await _sync_ai_tags_to_junction(asset_id, tag_names)

    # Queue text embedding with combined context
    await _enqueue_embedding(asset_id, parsed["description"] or asset_name, user_tags)

    logger.info(f"AI tagged asset {asset_id} ({_type_label(asset_type)}): {len(tag_names)} tags")
    return {"asset_id": asset_id, "tag_count": len(tag_names), "asset_type": asset_type}


# ── helpers ────────────────────────────────────────────────────────────────────

def _parse_tag_response(raw: str, fallback_name: str) -> dict[str, Any]:
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])
        data = json.loads(cleaned)
        tags = [{"name": t, "source": "ai", "confidence": 0.8} for t in data.get("tags", [])]
        return {"tags": tags, "description": data.get("description", "")}
    except Exception:
        logger.warning("Failed to parse AI tag response; storing empty tags")
        return {"tags": [], "description": raw[:500] if raw else ""}


async def _sync_ai_tags_to_junction(asset_id: int, tag_names: list[str]) -> None:
    """Write AI-sourced tags into asset_tag junction table AND smart_tags ARRAY (for search)."""
    try:
        async with async_session_factory() as session:
            from app.modules.tag.service import add_tags_to_asset
            await add_tags_to_asset(session, asset_id, tag_names, source=2)
            # Also persist into smart_tags so tag-filter search finds AI-tagged assets
            await session.execute(
                update(Asset)
                .where(Asset.id == asset_id)
                .values(smart_tags=tag_names)
            )
            await session.commit()
    except Exception as e:
        logger.warning(f"Failed to sync AI tags for asset {asset_id}: {e}")


async def _enqueue_embedding(asset_id: int, text: str, user_tags: list[str]) -> None:
    from app.core.task_utils import enqueue_task
    combined = f"{text} {' '.join(user_tags)}".strip()
    await enqueue_task("embed_text", {"asset_id": asset_id, "text": combined})


def _type_label(asset_type: int) -> str:
    return {1: "image", 2: "video", 3: "audio"}.get(asset_type, str(asset_type))


# ── prompts ────────────────────────────────────────────────────────────────────

_IMAGE_VISION_PROMPT = """Analyze this image and return a JSON object:
{
  "description": "1-2 sentence description in Chinese",
  "tags": ["标签1", "标签2", ...]
}

Tag guidelines: 5-15 tags in Chinese covering 场景、人物、情绪、视觉风格、色调、构图.
Respond with the JSON object only, no extra text."""

_VIDEO_VISION_PROMPT = """This is a thumbnail/keyframe from a video. Return a JSON object:
{
  "description": "1-2 sentence description of the video content in Chinese",
  "tags": ["标签1", "标签2", ...]
}

Tag guidelines: 5-15 tags in Chinese covering 场景、动作、情绪、风格、色调、拍摄手法.
Respond with the JSON object only, no extra text."""

_TEXT_TAG_PROMPT = """Based on this asset metadata, generate descriptive tags in Chinese.
Return a JSON object:
{{
  "description": "brief description in Chinese",
  "tags": ["标签1", "标签2", ...]
}}

Asset info:
{asset_info}

Respond with the JSON object only."""
