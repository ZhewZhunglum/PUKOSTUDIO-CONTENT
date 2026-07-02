from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.task_utils import enqueue_task
from app.core.utils import utcnow
from app.modules.pipeline.models import PipelineRun
from app.modules.pipeline.schemas import OneClickRequest, PipelineRunOut

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/one-click", response_model=PipelineRunOut, status_code=202)
async def one_click_video(req: OneClickRequest, db: AsyncSession = Depends(get_db)):
    """Create a full AI video from product info. Queues a pipeline worker task."""

    run = PipelineRun(
        status=0,
        stage="queued",
        product_name=req.product_name,
        product_description=req.product_description,
        platform=req.platform,
        style=req.style,
        duration_seconds=req.duration_seconds,
        clip_count=req.clip_count,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    await enqueue_task(
        "pipeline",
        {
            "pipeline_run_id": run.id,
            "product_name": req.product_name,
            "product_description": req.product_description,
            "platform": req.platform,
            "style": req.style,
            "duration_seconds": req.duration_seconds,
            "clip_count": req.clip_count,
        },
        priority=8,
    )
    await db.commit()
    return PipelineRunOut.model_validate(run)


@router.get("/runs", response_model=list[PipelineRunOut])
async def list_runs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(PipelineRun).order_by(PipelineRun.created_at.desc()).limit(limit)
    )
    return [PipelineRunOut.model_validate(r) for r in result.scalars().all()]


@router.get("/runs/{run_id}", response_model=PipelineRunOut)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = await db.get(PipelineRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return PipelineRunOut.model_validate(run)
