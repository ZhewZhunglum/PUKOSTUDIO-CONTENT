"""Thumbnail helpers for local asset media."""
from __future__ import annotations

import asyncio
import io
import tempfile
import uuid
from pathlib import Path

from loguru import logger
from PIL import Image, ImageOps

from app.core.storage import storage

THUMBNAIL_MAX_WIDTH = 960


def _downscale_image_to_jpeg(data: bytes, max_width: int = THUMBNAIL_MAX_WIDTH) -> bytes | None:
    """Decode image bytes and re-encode as a JPEG thumbnail (sync, run in a thread)."""
    with Image.open(io.BytesIO(data)) as img:
        img.load()
        oriented = ImageOps.exif_transpose(img) or img
        if oriented.mode in ("RGBA", "LA", "P"):
            # JPEG has no alpha — composite transparency onto white, not black.
            rgba = oriented.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            oriented = background
        elif oriented.mode not in ("RGB", "L"):
            oriented = oriented.convert("RGB")
        if oriented.width > max_width:
            ratio = max_width / oriented.width
            new_size = (max_width, max(1, round(oriented.height * ratio)))
            oriented = oriented.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        oriented.save(buf, "JPEG", quality=85, optimize=True)
        return buf.getvalue()


async def generate_image_thumbnail_from_storage(storage_key: str) -> str | None:
    """Download a stored image and upload a downscaled JPEG cover for it."""
    try:
        data = await storage.get_object_bytes(storage_key)
    except Exception as exc:
        logger.warning("image thumbnail source download failed for {}: {}", storage_key, exc)
        return None
    if not data:
        return None

    try:
        thumb_bytes = await asyncio.to_thread(_downscale_image_to_jpeg, data)
    except Exception as exc:
        logger.warning("image thumbnail generation failed for {}: {}", storage_key, exc)
        return None
    if not thumb_bytes:
        return None

    key = storage.build_key("thumbnails", str(uuid.uuid4()), ".jpg")
    await storage.upload_file(key, thumb_bytes, "image/jpeg")
    return key


async def extract_video_first_frame_to_storage(video_path: Path) -> str | None:
    """Extract a video's first frame as a JPEG thumbnail and upload it to storage."""
    if not video_path.exists():
        return None

    with tempfile.TemporaryDirectory() as tmp_dir:
        thumb_path = Path(tmp_dir) / "first-frame.jpg"
        cmd = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-vf",
            "scale='min(960,iw)':-2",
            "-q:v",
            "3",
            str(thumb_path),
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=45)
        except Exception as exc:
            logger.debug("first-frame thumbnail extraction skipped: {}", exc)
            return None

        if proc.returncode != 0 or not thumb_path.exists() or thumb_path.stat().st_size == 0:
            logger.debug("first-frame thumbnail extraction failed: {}", stderr.decode()[-500:])
            return None

        key = storage.build_key("thumbnails", str(uuid.uuid4()), ".jpg")
        await storage.upload_file_path(key, str(thumb_path), "image/jpeg")
        return key


async def extract_video_first_frame_from_storage(storage_key: str) -> str | None:
    """Download a stored video temporarily and upload its first frame thumbnail."""
    try:
        data = await storage.get_object_bytes(storage_key)
    except Exception as exc:
        logger.debug("thumbnail source download skipped for {}: {}", storage_key, exc)
        return None

    if not data:
        return None

    with tempfile.TemporaryDirectory() as tmp_dir:
        video_path = Path(tmp_dir) / "source-video"
        video_path.write_bytes(data)
        return await extract_video_first_frame_to_storage(video_path)
