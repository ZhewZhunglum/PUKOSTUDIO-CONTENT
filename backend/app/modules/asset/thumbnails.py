"""Thumbnail helpers for local asset media."""
from __future__ import annotations

import asyncio
import tempfile
import uuid
from pathlib import Path

from loguru import logger

from app.core.storage import storage


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
