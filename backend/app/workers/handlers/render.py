"""
render_video handler: assembles clips into a final MP4 using FFmpeg.

Pipeline:
1. Load video_project + clips from DB
2. Download each clip's asset from R2 to temp dir
3. Build FFmpeg filter_complex command
4. Run FFmpeg (subprocess)
5. Upload output to R2, create Asset, link to video_project.output_asset_id
6. Update render_status → done

Payload: {"video_project_id": int}
"""
import asyncio
import tempfile
from pathlib import Path
from typing import Any

from loguru import logger
from sqlalchemy import select, update

from app.core.database import async_session_factory
from app.core.storage import storage
from app.core.task_utils import enqueue_task
from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset
from app.modules.asset.models import Asset
from app.modules.relation.models import AssetRelation
from app.modules.video.models import VideoClip, VideoProject
from app.workers.registry import register_handler


@register_handler("render_video")
async def handle_render_video(payload: dict[str, Any]) -> dict[str, Any]:
    proj_id: int = payload["video_project_id"]

    async with async_session_factory() as session:
        proj = await session.get(VideoProject, proj_id)
        if not proj:
            raise ValueError(f"VideoProject {proj_id} not found")

        result = await session.execute(
            select(VideoClip)
            .where(VideoClip.video_project_id == proj_id)
            .order_by(VideoClip.position)
        )
        clips = list(result.scalars().all())

    if not clips:
        raise ValueError("No clips to render")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # Download assets
        clip_files = await _download_clips(clips, tmp_path)

        # Build and run FFmpeg
        output_path = tmp_path / "output.mp4"
        await _run_ffmpeg(
            clips, clip_files, output_path, proj.resolution, proj.fps
        )

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("FFmpeg produced no output")

        video_bytes = output_path.read_bytes()

    async with async_session_factory() as session:
        asset = await create_generated_asset(
            session,
            GeneratedAssetInput(
                name=f"渲染输出 — {proj.name}",
                asset_type=10,
                capability="render_video",
                source_model="ffmpeg",
                source_prompt=proj.narration_script,
                data=video_bytes,
                mime_type="video/mp4",
                file_format="mp4",
                description=proj.description,
                source=5,
                project_id=proj.project_id,
                sku_id=proj.sku_id,
                brand_id=proj.brand_id,
            ),
            enqueue_processing=False,
        )
        related_asset_ids: set[int] = set()
        for clip in clips:
            if clip.asset_id:
                if clip.asset_id in related_asset_ids:
                    continue
                related_asset_ids.add(clip.asset_id)
                session.add(
                    AssetRelation(
                        source_asset_id=clip.asset_id,
                        target_asset_id=asset.id,
                        relation_type="used_in",
                        extra_data={"video_project_id": proj_id, "clip_id": clip.id},
                    )
                )
                session.add(
                    AssetRelation(
                        source_asset_id=asset.id,
                        target_asset_id=clip.asset_id,
                        relation_type="composed_of",
                        extra_data={"video_project_id": proj_id, "clip_id": clip.id},
                    )
                )

        await session.execute(
            update(VideoProject)
            .where(VideoProject.id == proj_id)
            .values(
                output_asset_id=asset.id,
                render_status=2,  # done
                render_progress=100,
            )
        )
        await session.commit()

    await enqueue_task("ai_tag", {"asset_id": asset.id, "quality": "bulk_local"})
    await enqueue_task("embed_visual", {"asset_id": asset.id})
    if proj.narration_script:
        await enqueue_task("embed_text", {"asset_id": asset.id, "text": proj.narration_script})

    logger.info(f"Render done for project {proj_id}: {len(video_bytes)} bytes")
    return {"project_id": proj_id, "asset_id": asset.id, "bytes": len(video_bytes)}


async def _download_clips(
    clips: list[VideoClip], tmp: Path
) -> dict[int, Path | None]:
    files: dict[int, Path | None] = {}
    for clip in clips:
        if clip.asset_id is None or clip.clip_type in ("text_overlay", "transition"):
            files[clip.id] = None
            continue
        try:
            async with async_session_factory() as session:
                asset = await session.get(Asset, clip.asset_id)
            if not asset:
                files[clip.id] = None
                continue
            ext = Path(asset.storage_key).suffix or ".mp4"
            dest = tmp / f"clip_{clip.id}{ext}"
            data = await storage.get_object_bytes(asset.storage_key)
            dest.write_bytes(data)
            files[clip.id] = dest
            logger.debug(f"Downloaded clip {clip.id} → {dest.name}")
        except Exception as e:
            logger.warning(f"Clip {clip.id} download failed: {e}")
            files[clip.id] = None
    return files


async def _run_ffmpeg(
    clips: list[VideoClip],
    files: dict[int, Path | None],
    output: Path,
    resolution: str,
    fps: int,
) -> None:
    w, h = (int(x) for x in resolution.split("x"))

    inputs: list[str] = []
    filter_parts: list[str] = []
    concat_labels: list[str] = []

    for i, clip in enumerate(clips):
        src = files.get(clip.id)
        if src is None:
            # Generate black placeholder for missing clips
            dur = (clip.duration_ms or 3000) / 1000
            filter_parts.append(
                f"color=black:s={resolution}:r={fps}:d={dur:.3f}[clip{i}v];"
                f"aevalsrc=0:c=stereo:s=44100:d={dur:.3f}[clip{i}a]"
            )
        else:
            inputs += ["-i", str(src)]
            idx = len([x for x in inputs if x == "-i"]) - 1
            spd = float(clip.speed)
            trim_s = clip.trim_start_ms / 1000
            dur = (clip.duration_ms or 3000) / 1000

            filter_parts.append(
                f"[{idx}:v]trim=start={trim_s:.3f}:duration={dur:.3f},"
                f"setpts={1/spd:.4f}*(PTS-STARTPTS),"
                f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,"
                f"fps={fps}[clip{i}v];"
                f"[{idx}:a]atrim=start={trim_s:.3f}:duration={dur:.3f},"
                f"asetpts=PTS-STARTPTS,"
                f"atempo={spd:.4f}[clip{i}a]"
            )
        concat_labels.append(f"[clip{i}v][clip{i}a]")

    n = len(clips)
    filter_parts.append(f"{''.join(concat_labels)}concat=n={n}:v=1:a=1[outv][outa]")
    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(output),
    ]

    logger.info("Running FFmpeg for project render")
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {stderr.decode()[-2000:]}")

    logger.debug("FFmpeg completed successfully")
