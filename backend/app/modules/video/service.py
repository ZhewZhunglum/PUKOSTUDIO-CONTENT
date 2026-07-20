import uuid as _uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.asset.models import Asset
from app.modules.video.models import VideoClip, VideoProject
from app.modules.video.schemas import (
    VideoClipCreate,
    VideoClipUpdate,
    VideoProjectCreate,
    VideoProjectUpdate,
)


async def create_project(db: AsyncSession, data: VideoProjectCreate) -> VideoProject:
    now = utcnow()
    proj = VideoProject(
        uuid=str(_uuid.uuid4()),
        name=data.name,
        description=data.description,
        sku_id=data.sku_id,
        brand_id=data.brand_id,
        project_id=data.project_id,
        target_duration_ms=data.target_duration_ms,
        resolution=data.resolution,
        fps=data.fps,
        platform=data.platform,
        narration_script=data.narration_script,
        timeline=[],
        created_at=now,
        updated_at=now,
    )
    db.add(proj)
    await db.flush()
    await db.refresh(proj)
    return proj


async def get_project(db: AsyncSession, proj_id: int) -> VideoProject | None:
    result = await db.execute(
        select(VideoProject).where(VideoProject.id == proj_id, VideoProject.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_projects(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[VideoProject]:
    result = await db.execute(
        select(VideoProject)
        .where(VideoProject.is_deleted.is_(False))
        .order_by(VideoProject.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def update_project(
    db: AsyncSession, proj_id: int, data: VideoProjectUpdate
) -> VideoProject | None:
    proj = await get_project(db, proj_id)
    if not proj:
        return None
    patch = data.model_dump(exclude_none=True)
    for field, value in patch.items():
        setattr(proj, field, value)
    proj.updated_at = utcnow()
    await db.flush()
    await db.refresh(proj)
    return proj


async def delete_project(db: AsyncSession, proj_id: int) -> bool:
    proj = await get_project(db, proj_id)
    if not proj:
        return False
    proj.is_deleted = True
    proj.updated_at = utcnow()
    await db.flush()
    return True


async def get_clip(db: AsyncSession, clip_id: int) -> VideoClip | None:
    return await db.get(VideoClip, clip_id)


async def get_clips(db: AsyncSession, proj_id: int) -> list[VideoClip]:
    result = await db.execute(
        select(VideoClip)
        .where(VideoClip.video_project_id == proj_id)
        .order_by(VideoClip.position)
    )
    return list(result.scalars().all())


async def get_clips_for_projects(
    db: AsyncSession, project_ids: list[int]
) -> dict[int, list[VideoClip]]:
    if not project_ids:
        return {}

    result = await db.execute(
        select(VideoClip)
        .where(VideoClip.video_project_id.in_(project_ids))
        .order_by(VideoClip.video_project_id, VideoClip.position)
    )
    grouped: dict[int, list[VideoClip]] = {project_id: [] for project_id in project_ids}
    for clip in result.scalars().all():
        grouped.setdefault(clip.video_project_id, []).append(clip)
    return grouped


async def add_clip(db: AsyncSession, proj_id: int, data: VideoClipCreate) -> VideoClip:
    now = utcnow()
    clip = VideoClip(
        video_project_id=proj_id,
        position=data.position,
        clip_type=data.clip_type,
        asset_id=data.asset_id,
        ai_prompt=data.ai_prompt,
        ai_model=data.ai_model,
        ai_reference_asset_id=data.ai_reference_asset_id,
        duration_ms=data.duration_ms,
        trim_start_ms=data.trim_start_ms,
        volume=data.volume,
        speed=data.speed,
        filters=data.filters,
        text_content=data.text_content,
        text_style=data.text_style,
        created_at=now,
    )
    db.add(clip)
    await db.flush()
    await db.refresh(clip)
    await _recalc_start_times(db, proj_id)
    return clip


async def update_clip(
    db: AsyncSession, clip_id: int, data: VideoClipUpdate
) -> VideoClip | None:
    result = await db.execute(select(VideoClip).where(VideoClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        return None
    patch = data.model_dump(exclude_none=True)
    for field, value in patch.items():
        setattr(clip, field, value)
    await db.flush()
    await _recalc_start_times(db, clip.video_project_id)
    await db.refresh(clip)
    return clip


async def delete_clip(db: AsyncSession, clip_id: int) -> bool:
    result = await db.execute(select(VideoClip).where(VideoClip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        return False
    proj_id = clip.video_project_id
    await db.delete(clip)
    await db.flush()
    await _reorder_clips(db, proj_id)
    await _recalc_start_times(db, proj_id)
    return True


async def _recalc_start_times(db: AsyncSession, proj_id: int) -> None:
    clips = await get_clips(db, proj_id)
    cursor = 0
    for clip in clips:
        if clip.start_ms != cursor:
            clip.start_ms = cursor
        if clip.duration_ms:
            cursor += clip.duration_ms
    await db.flush()


async def _reorder_clips(db: AsyncSession, proj_id: int) -> None:
    clips = await get_clips(db, proj_id)
    for i, clip in enumerate(clips):
        if clip.position != i:
            clip.position = i
    await db.flush()


async def set_render_status(
    db: AsyncSession, proj_id: int, status: int, error: str | None = None, progress: int = 0
) -> None:
    await db.execute(
        update(VideoProject)
        .where(VideoProject.id == proj_id)
        .values(
            render_status=status,
            render_error=error,
            render_progress=progress,
            updated_at=utcnow(),
        )
    )
    await db.flush()


async def save_transcription(
    db: AsyncSession, asset_id: int, text: str, segments: list
) -> None:
    """Persist ASR output onto the source asset (router must not write SQL directly)."""
    await db.execute(
        update(Asset).where(Asset.id == asset_id).values(asr_text=text, asr_segments=segments)
    )
