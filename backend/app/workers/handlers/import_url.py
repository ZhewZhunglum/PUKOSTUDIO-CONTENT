"""URL import worker — downloads online media into the asset library."""
from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import tempfile
import uuid
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
from loguru import logger

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.platforms import ImportPlatform, detect_import_platform
from app.core.storage import storage
from app.core.task_utils import enqueue_task
from app.modules.asset import service as asset_service
from app.modules.asset.schemas import AssetCreate
from app.modules.asset.thumbnails import extract_video_first_frame_to_storage
from app.modules.tag.service import add_tags_to_asset
from app.workers.registry import register_handler

_MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024
_THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024
_DIRECT_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv"}
_DIRECT_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
_DIRECT_AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".aac"}
_ASSET_TYPE_MAP = {"image": 1, "video": 2, "audio": 3}


@dataclass(frozen=True)
class RemoteInfo:
    title: str | None
    platform: ImportPlatform
    extractor: str | None
    webpage_url: str
    duration_ms: int | None = None
    uploader: str | None = None
    thumbnail_url: str | None = None
    width: int | None = None
    height: int | None = None
    fps: Decimal | None = None


@dataclass(frozen=True)
class DownloadedFile:
    path: Path
    mime_type: str
    file_ext: str
    file_size: int
    info: RemoteInfo


class ImportUrlError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")


@register_handler("import_url")
async def handle_import_url(payload: dict[str, Any]) -> dict[str, Any]:
    url: str = payload["url"].strip()
    force: bool = bool(payload.get("force", False))
    custom_name: str | None = payload.get("name")
    user_tags: list[str] = payload.get("tags") or []
    sku_id: int | None = payload.get("sku_id")
    brand_id: int | None = payload.get("brand_id")

    existing = await _find_existing_asset(url, force)
    if existing:
        platform = detect_import_platform(url, is_direct_file=bool(_is_direct_file(url)))
        return _existing_result(existing, url, platform)

    logger.info("[import_url] Starting download: {} ({})", url, _platform_label_for_url(url))
    with tempfile.TemporaryDirectory() as tmp_dir:
        downloaded = await _download_to_temp_file(url, tmp_dir)
        result = await _persist_downloaded_asset(
            downloaded,
            url=url,
            custom_name=custom_name,
            user_tags=user_tags,
            sku_id=sku_id,
            brand_id=brand_id,
        )

    await _enqueue_post_processing(result["asset_id"], result["asset_type"])
    logger.info("[import_url] Done — asset_id={} name={!r}", result["asset_id"], result["name"])
    return result


async def _find_existing_asset(url: str, force: bool) -> Any | None:
    if force:
        return None
    async with async_session_factory() as db:
        return await asset_service.find_by_source_url(db, url)


def _existing_result(asset: Any, source_url: str, platform: ImportPlatform) -> dict[str, Any]:
    return {
        "asset_id": asset.id,
        "name": asset.name,
        "platform": platform.label,
        "platform_key": platform.key,
        "strategy": platform.tier,
        "source_url": source_url,
        "asset_type": asset.asset_type,
        "existing": True,
    }


async def _download_to_temp_file(url: str, tmp_dir: str) -> DownloadedFile:
    direct_ext = _is_direct_file(url)
    if direct_ext:
        return await _download_direct(url, direct_ext, tmp_dir)

    info = await _inspect_ytdlp(url)
    return await _download_via_ytdlp(url, tmp_dir, info)


async def _persist_downloaded_asset(
    downloaded: DownloadedFile,
    *,
    url: str,
    custom_name: str | None,
    user_tags: list[str],
    sku_id: int | None,
    brand_id: int | None,
) -> dict[str, Any]:
    info = downloaded.info
    try:
        storage_key = storage.build_key(
            _type_folder(downloaded.mime_type),
            str(uuid.uuid4()),
            f".{downloaded.file_ext}",
        )
        cdn_url = await storage.upload_file_path(storage_key, str(downloaded.path), downloaded.mime_type)
    except Exception as exc:
        raise ImportUrlError("storage_failed", str(exc)) from exc

    asset_type = _asset_type(downloaded.mime_type, downloaded.file_ext)
    thumbnail_key = await _first_available_thumbnail(downloaded, asset_type)
    name = custom_name or info.title or f"{info.platform.label}导入_{uuid.uuid4().hex[:8]}"
    tags = _auto_tags(info, user_tags)

    async with async_session_factory() as db:
        asset = await asset_service.create_asset(
            db,
            AssetCreate(
                name=name,
                description=_description_from_info(info),
                asset_type=asset_type,
                storage_key=storage_key,
                mime_type=downloaded.mime_type,
                file_format=downloaded.file_ext,
                file_size=downloaded.file_size,
                cdn_url=cdn_url,
                source=3,
                source_url=url,
                source_model=info.extractor,
                source_prompt=_source_metadata(info),
                user_tags=tags,
                sku_id=sku_id,
                brand_id=brand_id,
            ),
        )
        _apply_media_metadata(asset, info, thumbnail_key)
        await add_tags_to_asset(db, asset.id, tags, source=1)
        await db.commit()
        asset_id = asset.id
        asset_type = asset.asset_type

    return _success_result(asset_id, name, asset_type, url, info)


def _success_result(asset_id: int, name: str, asset_type: int, source_url: str, info: RemoteInfo) -> dict[str, Any]:
    return {
        "asset_id": asset_id,
        "name": name,
        "platform": info.platform.label,
        "platform_key": info.platform.key,
        "extractor": info.extractor,
        "strategy": info.platform.tier,
        "source_url": source_url,
        "asset_type": asset_type,
    }


async def _download_direct(url: str, ext: str, out_dir: str) -> DownloadedFile:
    platform = detect_import_platform(url, is_direct_file=True)
    path = Path(out_dir) / f"direct{ext}"
    mime_type = mimetypes.guess_type(f"file{ext}")[0] or "application/octet-stream"
    size = 0

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
            async with client.stream("GET", url, headers=_direct_headers()) as resp:
                resp.raise_for_status()
                mime_type = _content_type_or_guess(resp.headers.get("content-type"), ext)
                with path.open("wb") as handle:
                    async for chunk in resp.aiter_bytes():
                        size += len(chunk)
                        if size > _MAX_DOWNLOAD_BYTES:
                            raise ImportUrlError("too_large", "File exceeds 500MB limit")
                        handle.write(chunk)
    except ImportUrlError:
        raise
    except Exception as exc:
        raise ImportUrlError(_classify_error(exc), str(exc)) from exc

    info = RemoteInfo(title=Path(url.split("?", 1)[0]).name or None, platform=platform, extractor=None, webpage_url=url)
    return DownloadedFile(path=path, mime_type=mime_type, file_ext=ext.lstrip("."), file_size=size, info=info)


async def _inspect_ytdlp(url: str) -> RemoteInfo:
    return await asyncio.to_thread(_inspect_ytdlp_sync, url)


def _inspect_ytdlp_sync(url: str) -> RemoteInfo:
    try:
        import yt_dlp  # type: ignore[import-untyped]

        with yt_dlp.YoutubeDL(_ytdlp_opts()) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise ImportUrlError(_classify_error(exc), str(exc)) from exc

    if _is_playlist_info(info):
        raise ImportUrlError("unsupported_url", "Playlist/channel URLs are not imported in this flow")
    return _remote_info_from_ytdlp(url, info)


async def _download_via_ytdlp(url: str, out_dir: str, inspected: RemoteInfo) -> DownloadedFile:
    try:
        file_path, info = await asyncio.to_thread(_download_ytdlp_sync, url, out_dir)
    except ImportUrlError:
        raise
    except Exception as exc:
        raise ImportUrlError(_classify_error(exc), str(exc)) from exc

    size = file_path.stat().st_size
    if size > _MAX_DOWNLOAD_BYTES:
        raise ImportUrlError("too_large", "File exceeds 500MB limit")

    merged_info = _merge_info(inspected, info)
    ext = file_path.suffix.lower().lstrip(".") or "mp4"
    mime_type = mimetypes.guess_type(str(file_path))[0] or "video/mp4"
    return DownloadedFile(path=file_path, mime_type=mime_type, file_ext=ext, file_size=size, info=merged_info)


def _download_ytdlp_sync(url: str, out_dir: str) -> tuple[Path, RemoteInfo]:
    import yt_dlp  # type: ignore[import-untyped]

    with yt_dlp.YoutubeDL(_ytdlp_opts(out_dir)) as ydl:
        info = ydl.extract_info(url, download=True)

    if _is_playlist_info(info):
        raise ImportUrlError("unsupported_url", "Playlist/channel URLs are not imported in this flow")
    file_path = _largest_downloaded_file(out_dir)
    return file_path, _remote_info_from_ytdlp(url, info)


def _ytdlp_opts(out_dir: str | None = None) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "max_filesize": _MAX_DOWNLOAD_BYTES,
        "socket_timeout": 60,
        "retries": 2,
        "fragment_retries": 2,
    }
    if out_dir:
        opts.update({
            "outtmpl": os.path.join(out_dir, "%(title).180B.%(ext)s"),
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
        })
    if settings.ytdlp_cookies_file:
        opts["cookiefile"] = settings.ytdlp_cookies_file
    if settings.ytdlp_proxy:
        opts["proxy"] = settings.ytdlp_proxy
    if settings.ytdlp_user_agent:
        opts["http_headers"] = {"User-Agent": settings.ytdlp_user_agent}
    return opts


def _remote_info_from_ytdlp(url: str, info: dict[str, Any]) -> RemoteInfo:
    extractor = info.get("extractor_key") or info.get("extractor")
    platform = detect_import_platform(url)
    duration = info.get("duration")
    fps = info.get("fps")
    return RemoteInfo(
        title=info.get("title"),
        platform=platform,
        extractor=str(extractor) if extractor else None,
        webpage_url=info.get("webpage_url") or url,
        duration_ms=int(float(duration) * 1000) if duration else None,
        uploader=info.get("uploader") or info.get("channel"),
        thumbnail_url=info.get("thumbnail"),
        width=_safe_int(info.get("width")),
        height=_safe_int(info.get("height")),
        fps=Decimal(str(fps)) if fps else None,
    )


def _merge_info(primary: RemoteInfo, fallback: RemoteInfo) -> RemoteInfo:
    return RemoteInfo(
        title=fallback.title or primary.title,
        platform=primary.platform,
        extractor=fallback.extractor or primary.extractor,
        webpage_url=fallback.webpage_url or primary.webpage_url,
        duration_ms=fallback.duration_ms or primary.duration_ms,
        uploader=fallback.uploader or primary.uploader,
        thumbnail_url=fallback.thumbnail_url or primary.thumbnail_url,
        width=fallback.width or primary.width,
        height=fallback.height or primary.height,
        fps=fallback.fps or primary.fps,
    )


def _largest_downloaded_file(out_dir: str) -> Path:
    files = [path for path in Path(out_dir).iterdir() if path.is_file() and not path.name.endswith((".part", ".ytdl"))]
    if not files:
        raise ImportUrlError("download_failed", "yt-dlp completed but no output file found")
    return max(files, key=lambda path: path.stat().st_size)


async def _upload_thumbnail(info: RemoteInfo) -> str | None:
    if not info.thumbnail_url:
        return None
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(info.thumbnail_url, headers=_direct_headers())
            resp.raise_for_status()
        if len(resp.content) > _THUMBNAIL_MAX_BYTES:
            return None
        ext = mimetypes.guess_extension(resp.headers.get("content-type", "").split(";")[0]) or ".jpg"
        key = storage.build_key("thumbnails", str(uuid.uuid4()), ext)
        await storage.upload_file(key, resp.content, resp.headers.get("content-type") or "image/jpeg")
        return key
    except Exception as exc:
        logger.debug("[import_url] thumbnail upload skipped: {}", exc)
        return None


async def _first_available_thumbnail(downloaded: DownloadedFile, asset_type: int) -> str | None:
    if asset_type == 2:
        thumbnail_key = await extract_video_first_frame_to_storage(downloaded.path)
        if thumbnail_key:
            return thumbnail_key
    return await _upload_thumbnail(downloaded.info)


def _apply_media_metadata(asset: Any, info: RemoteInfo, thumbnail_key: str | None) -> None:
    asset.duration_ms = info.duration_ms
    asset.width = info.width
    asset.height = info.height
    asset.fps = info.fps
    asset.thumbnail_key = thumbnail_key


async def _enqueue_post_processing(asset_id: int, asset_type: int) -> None:
    if settings.auto_ai_tag_on_ingest and asset_type in (1, 2):
        await enqueue_task("ai_tag", {"asset_id": asset_id, "quality": "bulk_local"})
    if settings.auto_embedding_on_ingest and asset_type == 2:
        await enqueue_task("embed_visual", {"asset_id": asset_id})


def _auto_tags(info: RemoteInfo, user_tags: list[str]) -> list[str]:
    tags = [
        f"来源:{info.platform.label}",
        "URL导入",
        f"platform:{info.platform.key}",
        f"strategy:{info.platform.tier}",
    ]
    if info.extractor:
        tags.append(f"extractor:{info.extractor}")
    return list(dict.fromkeys(tags + [tag for tag in user_tags if tag.strip()]))


def _source_metadata(info: RemoteInfo) -> str:
    return json.dumps(
        {
            "title": info.title,
            "uploader": info.uploader,
            "duration_ms": info.duration_ms,
            "thumbnail_url": info.thumbnail_url,
            "extractor": info.extractor,
            "webpage_url": info.webpage_url,
            "platform_key": info.platform.key,
        },
        ensure_ascii=False,
    )


def _description_from_info(info: RemoteInfo) -> str | None:
    parts = [f"Imported from {info.platform.label}"]
    if info.uploader:
        parts.append(f"Uploader: {info.uploader}")
    return " · ".join(parts) if parts else None


def _type_folder(mime_type: str) -> str:
    return {"image": "images", "video": "videos", "audio": "audio"}.get(mime_type.split("/", 1)[0], "assets")


def _asset_type(mime_type: str, ext: str) -> int:
    if f".{ext}" in _DIRECT_IMAGE_EXTS:
        return 1
    if f".{ext}" in _DIRECT_AUDIO_EXTS:
        return 3
    return _ASSET_TYPE_MAP.get(mime_type.split("/", 1)[0], 2)


def _is_direct_file(url: str) -> str | None:
    ext = Path(url.split("?", 1)[0].split("#", 1)[0]).suffix.lower()
    if ext in _DIRECT_VIDEO_EXTS | _DIRECT_IMAGE_EXTS | _DIRECT_AUDIO_EXTS:
        return ext
    return None


def _platform_label_for_url(url: str) -> str:
    return detect_import_platform(url, is_direct_file=bool(_is_direct_file(url))).label


def _content_type_or_guess(content_type: str | None, ext: str) -> str:
    mime = (content_type or "").split(";", 1)[0].strip()
    if mime and mime != "application/octet-stream":
        return mime
    return mimetypes.guess_type(f"file{ext}")[0] or "application/octet-stream"


def _direct_headers() -> dict[str, str]:
    return {"User-Agent": settings.ytdlp_user_agent or "Mozilla/5.0 ContentForge/1.0"}


def _is_playlist_info(info: dict[str, Any]) -> bool:
    return info.get("_type") in {"playlist", "multi_video"} or bool(info.get("entries"))


def _classify_error(exc: Exception) -> str:
    message = str(exc).lower()
    if any(term in message for term in ("sign in", "login", "cookies", "authentication", "private")):
        return "auth_required"
    if any(term in message for term in ("geo", "country", "region", "not available in your location")):
        return "geo_restricted"
    if any(term in message for term in ("unsupported url", "no suitable extractor")):
        return "unsupported_url"
    if any(term in message for term in ("max-filesize", "too large", "file is larger")):
        return "too_large"
    return "download_failed"


def _safe_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
