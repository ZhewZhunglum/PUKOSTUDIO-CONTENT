"""
pipeline handler: end-to-end one-click video production.

Steps:
1. Generate script (Claude) → structured JSON with clip prompts
2. Create VideoProject + VideoClips
3. Queue video_gen task for each ai_video clip
4. Mark pipeline_run as done

Payload:
  pipeline_run_id: int
  product_name: str
  product_description: str | None
  platform: str
  style: str
  duration_seconds: int
  clip_count: int
"""
import json
from typing import Any

from loguru import logger
from sqlalchemy import update

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import async_session_factory
from app.core.task_utils import enqueue_task
from app.core.utils import utcnow
from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset
from app.modules.pipeline.models import PipelineRun
from app.modules.video import service as video_service
from app.modules.video.models import VideoClip
from app.modules.video.schemas import VideoClipCreate, VideoProjectCreate
from app.workers.registry import register_handler

_SCRIPT_PROMPT = """\
You are a viral short-video scriptwriter. Create a {clip_count}-clip video script for:

Product: {product_name}
Description: {description}
Platform: {platform}
Style: {style}
Total duration: {duration_seconds}s (each clip ~{clip_dur}s)

Return ONLY valid JSON with this schema:
{{
  "title": "video title",
  "hook": "opening hook line",
  "clips": [
    {{
      "position": 0,
      "type": "ai_video",
      "prompt": "detailed visual prompt for AI video generation in English",
      "duration_ms": 5000,
      "narration": "optional voiceover text for this clip"
    }}
  ],
  "cta": "call to action",
  "tags": ["tag1", "tag2"]
}}

Rules:
- prompts must be vivid, cinematic, English
- cover hook → problem → solution → proof → CTA arc
- vary clip types: mostly ai_video, 1-2 image clips ok
"""


@register_handler("pipeline")
async def handle_pipeline(payload: dict[str, Any]) -> dict[str, Any]:
    run_id: int = payload["pipeline_run_id"]
    product_name: str = payload["product_name"]
    description: str = payload.get("product_description") or ""
    platform: str = payload.get("platform", "tiktok")
    style: str = payload.get("style", "conversational")
    duration_seconds: int = payload.get("duration_seconds", 30)
    clip_count: int = payload.get("clip_count", 5)
    clip_dur = max(3, duration_seconds // clip_count)

    async def _set_stage(stage: str) -> None:
        async with async_session_factory() as session:
            await session.execute(
                update(PipelineRun)
                .where(PipelineRun.id == run_id)
                .values(stage=stage, updated_at=utcnow())
            )
            await session.commit()

    async def _fail(msg: str) -> None:
        async with async_session_factory() as session:
            await session.execute(
                update(PipelineRun)
                .where(PipelineRun.id == run_id)
                .values(status=2, error_message=msg, updated_at=utcnow())
            )
            await session.commit()

    # ── Step 1: Generate script ────────────────────────────────────────────
    await _set_stage("generating_script")

    prompt = _SCRIPT_PROMPT.format(
        clip_count=clip_count,
        product_name=product_name,
        description=description or "N/A",
        platform=platform,
        style=style,
        duration_seconds=duration_seconds,
        clip_dur=clip_dur,
    )

    response = await ai_gateway.call(
        AIRequest(capability="text_gen", inputs={"prompt": prompt})
    )
    if not response.success:
        await _fail(f"Script generation failed: {response.error}")
        raise RuntimeError(f"Pipeline script gen failed: {response.error}")

    raw = response.outputs.get("text", "")
    script: dict[str, Any] = _parse_json(raw)
    if not script or not script.get("clips"):
        await _fail("Script JSON parse failed or empty clips")
        raise RuntimeError("Invalid script JSON from AI")

    clips_data: list[dict[str, Any]] = script["clips"]
    logger.info(f"Pipeline {run_id}: script generated with {len(clips_data)} clips")

    # ── Step 2: Create VideoProject ────────────────────────────────────────
    await _set_stage("creating_project")

    async with async_session_factory() as session:
        proj_create = VideoProjectCreate(
            name=f"{product_name} — {platform}",
            description=script.get("hook", ""),
            resolution="1080x1920",
            fps=30,
        )
        proj = await video_service.create_project(session, proj_create)
        script_asset = await create_generated_asset(
            session,
            GeneratedAssetInput(
                name=f"一键成片脚本 — {product_name}",
                asset_type=5,
                capability="pipeline_script",
                source_model=response.model_used,
                source_prompt=prompt,
                data=script,
                mime_type="application/json",
                file_format="json",
                description=script.get("hook", ""),
                tags=script.get("tags", []),
            ),
        )

        # ── Step 3: Create clips ───────────────────────────────────────────
        created_clips: list[VideoClip] = []
        for i, clip_data in enumerate(clips_data):
            clip_type = clip_data.get("type", "ai_video")
            if clip_type not in ("footage", "ai_video", "image", "text_overlay", "transition"):
                clip_type = "ai_video"

            clip_create = VideoClipCreate(
                position=i,
                clip_type=clip_type,
                ai_prompt=clip_data.get("prompt"),
                duration_ms=clip_data.get("duration_ms", clip_dur * 1000),
            )
            clip = await video_service.add_clip(session, proj.id, clip_create)
            created_clips.append(clip)

        # Save script + update pipeline_run
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(
                video_project_id=proj.id,
                clip_count=len(created_clips),
                script_json=script,
                stage="queuing_generation",
                updated_at=utcnow(),
            )
        )
        await session.commit()

    # ── Step 4: Queue video_gen for each ai_video clip ─────────────────────
    await _set_stage("queuing_generation")
    queued = 0
    for clip in created_clips:
        if clip.clip_type == "ai_video" and clip.ai_prompt:
            await enqueue_task(
                "video_gen",
                {
                    "video_project_id": proj.id,
                    "clip_id": clip.id,
                    "prompt": clip.ai_prompt,
                    "duration_seconds": (clip.duration_ms or 5000) // 1000,
                    "quality": "default",
                },
                priority=6,
            )
            queued += 1

    # ── Step 5: Mark done ──────────────────────────────────────────────────
    async with async_session_factory() as session:
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(
                status=1,
                stage="generating_videos",
                updated_at=utcnow(),
            )
        )
        await session.commit()

    logger.info(f"Pipeline {run_id} done: project={proj.id}, clips={len(created_clips)}, queued={queued}")
    return {
        "pipeline_run_id": run_id,
        "project_id": proj.id,
        "script_asset_id": script_asset.id,
        "clips": len(created_clips),
        "queued": queued,
    }


def _parse_json(raw: str) -> dict[str, Any]:
    """Extract JSON from Claude response (handles markdown code fences)."""
    import re
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if m:
        raw = m.group(1)
    try:
        return json.loads(raw)
    except Exception:
        return {}
