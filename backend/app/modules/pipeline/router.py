from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.task_utils import enqueue_task
from app.modules.pipeline import service
from app.modules.pipeline.schemas import OneClickRequest, PipelineRunOut

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/one-click", response_model=PipelineRunOut, status_code=202)
async def one_click_video(req: OneClickRequest, db: AsyncSession = Depends(get_db)):
    """Create a full AI video from product info. Queues a pipeline worker task."""
    run = await service.create_run(db, req)

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
    runs = await service.list_runs(db, limit)
    return [PipelineRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=PipelineRunOut)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = await service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return PipelineRunOut.model_validate(run)
