import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import storage
from app.core.task_utils import enqueue_task
from app.modules.asset import service as asset_service
from app.modules.asset.models import Asset
from app.modules.asset.schemas import AssetCreate
from app.modules.tag.service import add_tags_to_asset

ASSET_TYPE_FOLDERS = {
    1: "images",
    2: "videos",
    3: "audio",
    4: "subtitles",
    5: "scripts",
    10: "outputs",
    11: "references",
}

ASSET_TYPE_LABELS = {
    1: "图片",
    2: "视频",
    3: "音频",
    4: "字幕",
    5: "脚本",
    10: "成片",
    11: "分析报告",
}


@dataclass
class GeneratedAssetInput:
    name: str
    asset_type: int
    capability: str
    source_model: str
    source_prompt: str | None = None
    data: bytes | str | dict[str, Any] | list[Any] | None = None
    storage_key: str | None = None
    mime_type: str | None = None
    file_format: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    source: int = 2
    source_url: str | None = None
    project_id: int | None = None
    sku_id: int | None = None
    brand_id: int | None = None


async def create_generated_asset(
    db: AsyncSession,
    data: GeneratedAssetInput,
    *,
    enqueue_processing: bool = True,
) -> Asset:
    content, mime_type, file_format = _prepare_content(data)
    storage_key = data.storage_key
    cdn_url = None

    if storage_key is None:
        storage_key = storage.build_key(
            ASSET_TYPE_FOLDERS.get(data.asset_type, "ai_assets"),
            str(uuid.uuid4()),
            file_format,
        )
        cdn_url = await storage.upload_file(storage_key, content, mime_type)

    tags = _generated_tags(data)
    asset = await asset_service.create_asset(
        db,
        AssetCreate(
            name=data.name,
            description=data.description,
            asset_type=data.asset_type,
            storage_key=storage_key,
            mime_type=mime_type,
            file_format=file_format,
            file_size=len(content),
            cdn_url=cdn_url,
            source=data.source,
            source_url=data.source_url,
            source_model=data.source_model,
            source_prompt=data.source_prompt,
            user_tags=tags,
            project_id=data.project_id,
            sku_id=data.sku_id,
            brand_id=data.brand_id,
        ),
    )
    await add_tags_to_asset(db, asset.id, tags, source=3)
    if enqueue_processing:
        await enqueue_generated_asset_processing(asset.id, data.asset_type, _embedding_text(data, tags))
    return asset


async def enqueue_generated_asset_processing(
    asset_id: int,
    asset_type: int,
    text: str | None,
) -> None:
    if asset_type in (1, 2, 10):
        await enqueue_task("ai_tag", {"asset_id": asset_id, "quality": "bulk_local"})
        await enqueue_task("embed_visual", {"asset_id": asset_id})
    if text and asset_type in (3, 4, 5, 10, 11):
        await enqueue_task("embed_text", {"asset_id": asset_id, "text": text})


def _prepare_content(data: GeneratedAssetInput) -> tuple[bytes, str, str]:
    mime_type = data.mime_type or _default_mime_type(data.asset_type)
    file_format = data.file_format or _default_file_format(mime_type)

    if data.storage_key and data.data is None:
        return b"", mime_type, file_format
    if isinstance(data.data, bytes):
        return data.data, mime_type, file_format
    if isinstance(data.data, str):
        return data.data.encode("utf-8"), mime_type, file_format
    if data.data is not None:
        return json.dumps(data.data, ensure_ascii=False, indent=2).encode("utf-8"), mime_type, file_format
    raise ValueError("Generated asset requires either data or storage_key")


def _generated_tags(data: GeneratedAssetInput) -> list[str]:
    tags = [
        "AI生成" if data.source == 2 else "系统输出",
        f"模型:{data.source_model}",
        f"能力:{data.capability}",
        ASSET_TYPE_LABELS.get(data.asset_type, "AI资产"),
    ]
    tags.extend(data.tags or [])
    return list(dict.fromkeys(tag for tag in tags if tag))


def _embedding_text(data: GeneratedAssetInput, tags: list[str]) -> str | None:
    parts = [data.name, data.description or "", data.source_prompt or "", " ".join(tags)]
    if isinstance(data.data, str):
        parts.append(data.data)
    elif isinstance(data.data, (dict, list)):
        parts.append(json.dumps(data.data, ensure_ascii=False))
    text = "\n".join(part for part in parts if part.strip())
    return text or None


def _default_mime_type(asset_type: int) -> str:
    return {
        1: "image/png",
        2: "video/mp4",
        3: "audio/mpeg",
        4: "text/plain",
        5: "text/markdown",
        10: "video/mp4",
        11: "application/json",
    }.get(asset_type, "application/octet-stream")


def _default_file_format(mime_type: str) -> str:
    return {
        "image/png": "png",
        "video/mp4": "mp4",
        "audio/mpeg": "mp3",
        "text/plain": "txt",
        "text/markdown": "md",
        "application/json": "json",
    }.get(mime_type, "bin")
