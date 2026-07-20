from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.task_utils import enqueue_task
from app.modules.video import service
from app.modules.video.schemas import (
    AsrRequest,
    AsrResponse,
    RenderRequest,
    TtsRequest,
    TtsResponse,
    VideoClipCreate,
    VideoClipOut,
    VideoClipUpdate,
    VideoGenRequest,
    VideoProjectCreate,
    VideoProjectOut,
    VideoProjectUpdate,
)

router = APIRouter(prefix="/video", tags=["video"])


# ─── Projects ─────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=list[VideoProjectOut])
async def list_projects(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    projects = await service.list_projects(db, limit=limit, offset=offset)
    clips_by_project = await service.get_clips_for_projects(db, [p.id for p in projects])
    result = []
    for p in projects:
        out = VideoProjectOut.model_validate(p)
        out.clips = [VideoClipOut.model_validate(c) for c in clips_by_project.get(p.id, [])]
        result.append(out)
    return result


@router.post("/projects", response_model=VideoProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(data: VideoProjectCreate, db: AsyncSession = Depends(get_db)):
    proj = await service.create_project(db, data)
    await db.commit()
    out = VideoProjectOut.model_validate(proj)
    out.clips = []
    return out


@router.get("/projects/{proj_id}", response_model=VideoProjectOut)
async def get_project(proj_id: int, db: AsyncSession = Depends(get_db)):
    proj = await service.get_project(db, proj_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Video project not found")
    clips = await service.get_clips(db, proj_id)
    out = VideoProjectOut.model_validate(proj)
    out.clips = [VideoClipOut.model_validate(c) for c in clips]
    return out


@router.patch("/projects/{proj_id}", response_model=VideoProjectOut)
async def update_project(
    proj_id: int, data: VideoProjectUpdate, db: AsyncSession = Depends(get_db)
):
    proj = await service.update_project(db, proj_id, data)
    if not proj:
        raise HTTPException(status_code=404, detail="Video project not found")
    await db.commit()
    clips = await service.get_clips(db, proj_id)
    out = VideoProjectOut.model_validate(proj)
    out.clips = [VideoClipOut.model_validate(c) for c in clips]
    return out


@router.delete("/projects/{proj_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(proj_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_project(db, proj_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Video project not found")
    await db.commit()


# ─── Clips ────────────────────────────────────────────────────────────────────

@router.post("/projects/{proj_id}/clips", response_model=VideoClipOut, status_code=status.HTTP_201_CREATED)
async def add_clip(proj_id: int, data: VideoClipCreate, db: AsyncSession = Depends(get_db)):
    proj = await service.get_project(db, proj_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Video project not found")
    clip = await service.add_clip(db, proj_id, data)
    await db.commit()
    return VideoClipOut.model_validate(clip)


@router.patch("/projects/{proj_id}/clips/{clip_id}", response_model=VideoClipOut)
async def update_clip(
    proj_id: int, clip_id: int, data: VideoClipUpdate, db: AsyncSession = Depends(get_db)
):
    clip = await service.get_clip(db, clip_id)
    if not clip or clip.video_project_id != proj_id:
        raise HTTPException(status_code=404, detail="Clip not found")
    clip = await service.update_clip(db, clip_id, data)
    await db.commit()
    return VideoClipOut.model_validate(clip)


@router.delete("/projects/{proj_id}/clips/{clip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clip(proj_id: int, clip_id: int, db: AsyncSession = Depends(get_db)):
    clip = await service.get_clip(db, clip_id)
    if not clip or clip.video_project_id != proj_id:
        raise HTTPException(status_code=404, detail="Clip not found")
    deleted = await service.delete_clip(db, clip_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Clip not found")
    await db.commit()


# ─── AI Video Generation ─────────────────────────────────────────────────────

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_video_clip(req: VideoGenRequest, db: AsyncSession = Depends(get_db)):
    """Queue AI video generation for a specific clip (Seedance via Replicate)."""
    task_id = await enqueue_task(
        "video_gen",
        {
            "video_project_id": req.video_project_id,
            "clip_id": req.clip_id,
            "prompt": req.prompt,
            "reference_asset_id": req.reference_asset_id,
            "duration_seconds": req.duration_seconds,
            "quality": req.quality,
        },
        priority=7,
    )
    return {"task_id": task_id, "message": "Video generation queued"}


# ─── TTS ─────────────────────────────────────────────────────────────────────

@router.post("/tts", response_model=TtsResponse)
async def generate_tts(req: TtsRequest, db: AsyncSession = Depends(get_db)):
    """Generate narration audio with OpenAI TTS, optionally save to asset library."""
    from app.core.ai_gateway.gateway import ai_gateway
    from app.core.ai_gateway.schemas import AIRequest
    from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset

    response = await ai_gateway.call(
        AIRequest(
            capability="tts",
            inputs={"text": req.text, "voice": req.voice_id, "speed": req.speed},
        )
    )
    if not response.success:
        raise HTTPException(status_code=502, detail=f"TTS failed: {response.error}")

    audio_bytes: bytes = response.outputs["audio_bytes"]

    asset_id = None
    if req.save_to_library:
        asset = await create_generated_asset(
            db,
            GeneratedAssetInput(
                name=f"TTS — {req.text[:60]}",
                asset_type=3,
                capability="tts",
                source_model=response.model_used,
                source_prompt=req.text,
                data=audio_bytes,
                mime_type="audio/mpeg",
                file_format="mp3",
                description=req.text,
            ),
        )
        await db.commit()
        asset_id = asset.id

    return TtsResponse(
        asset_id=asset_id,
        duration_ms=None,  # estimated from byte length / bitrate later
        model_used=response.model_used,
        cost_usd=float(response.cost_usd),
    )


# ─── ASR ─────────────────────────────────────────────────────────────────────

@router.post("/asr", response_model=AsrResponse)
async def transcribe_audio(req: AsrRequest, db: AsyncSession = Depends(get_db)):
    """Transcribe audio asset with Whisper. Optionally generate SRT subtitle file."""
    from app.core.ai_gateway.gateway import ai_gateway
    from app.core.ai_gateway.schemas import AIRequest
    from app.core.storage import storage
    from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset
    from app.modules.asset.models import Asset

    asset = await db.get(Asset, req.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    audio_bytes = await storage.get_object_bytes(asset.storage_key)

    response = await ai_gateway.call(
        AIRequest(
            capability="asr",
            inputs={
                "audio_bytes": audio_bytes,
                "language": req.language,
                "response_format": "verbose_json",
            },
        )
    )
    if not response.success:
        raise HTTPException(status_code=502, detail=f"ASR failed: {response.error}")

    text: str = response.outputs.get("text", "")
    segments: list = response.outputs.get("segments", [])
    await service.save_transcription(db, asset.id, text, segments)

    srt_content = None
    srt_asset_id = None
    if req.generate_srt and segments:
        srt_content = _segments_to_srt(segments)
        srt_asset = await create_generated_asset(
            db,
            GeneratedAssetInput(
                name=f"字幕 — {asset.name}",
                asset_type=4,
                capability="asr",
                source_model=response.model_used,
                source_prompt=f"Transcribe asset {asset.id}: {asset.name}",
                data=srt_content,
                mime_type="text/plain",
                file_format="srt",
                description=text[:500],
            ),
        )
        srt_asset_id = srt_asset.id
    await db.commit()

    return AsrResponse(
        text=text,
        srt_content=srt_content,
        srt_asset_id=srt_asset_id,
        segments=segments,
        model_used=response.model_used,
    )


# ─── Render ───────────────────────────────────────────────────────────────────

@router.post("/render", status_code=status.HTTP_202_ACCEPTED)
async def render_video(req: RenderRequest, db: AsyncSession = Depends(get_db)):
    """Queue FFmpeg render for a video project."""
    proj = await service.get_project(db, req.video_project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Video project not found")

    clips = await service.get_clips(db, req.video_project_id)
    if not clips:
        raise HTTPException(status_code=422, detail="Project has no clips")

    # Enqueue first; only commit status change after the task is safely queued.
    task_id = await enqueue_task(
        "render_video",
        {"video_project_id": req.video_project_id},
        priority=req.priority,
    )
    await service.set_render_status(db, req.video_project_id, 1)  # rendering
    await db.commit()
    return {"task_id": task_id, "message": "Render queued"}


def _segments_to_srt(segments: list) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start = _ms_to_srt_time(int(seg.get("start", 0) * 1000))
        end = _ms_to_srt_time(int(seg.get("end", 0) * 1000))
        text = seg.get("text", "").strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def _ms_to_srt_time(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms % 3_600_000) // 60_000
    s = (ms % 60_000) // 1000
    sub = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{sub:03d}"
