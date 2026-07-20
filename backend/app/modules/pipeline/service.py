from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.pipeline.models import PipelineRun
from app.modules.pipeline.schemas import OneClickRequest


async def create_run(db: AsyncSession, req: OneClickRequest) -> PipelineRun:
    now = utcnow()
    run = PipelineRun(
        status=0,
        stage="queued",
        product_name=req.product_name,
        product_description=req.product_description,
        platform=req.platform,
        style=req.style,
        duration_seconds=req.duration_seconds,
        clip_count=req.clip_count,
        created_at=now,
        updated_at=now,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def list_runs(db: AsyncSession, limit: int = 20) -> list[PipelineRun]:
    result = await db.execute(
        select(PipelineRun).order_by(PipelineRun.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def get_run(db: AsyncSession, run_id: int) -> PipelineRun | None:
    return await db.get(PipelineRun, run_id)
