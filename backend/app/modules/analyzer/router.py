"""
Viral video analyzer — uses Claude to decompose a video into reusable patterns.
Input: video URL or description text.
Output: structured breakdown with hooks, script arc, visual patterns, pacing, CTAs.
"""
import json
import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import get_db
from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset

router = APIRouter(prefix="/analyzer", tags=["analyzer"])

_ANALYZE_PROMPT = """\
You are an expert viral video analyst. Analyze this video and return a detailed breakdown.

{input_section}

Return ONLY valid JSON with this schema:
{{
  "title_guess": "guessed video title",
  "platform_guess": "platform (tiktok/youtube/instagram/facebook/x/etc)",
  "hook": {{
    "type": "question|shock|promise|story|controversy|curiosity",
    "text": "the hook text or description",
    "duration_seconds": 3,
    "analysis": "why this hook works"
  }},
  "script_arc": {{
    "structure": "AIDA|PAS|StoryBrand|3Act|Custom",
    "segments": [
      {{"name": "hook", "duration_pct": 10, "purpose": "grab attention", "technique": "..."}}
    ]
  }},
  "visual_patterns": [
    {{"pattern": "...", "frequency": "constant|frequent|occasional", "effect": "..."}}
  ],
  "pacing": {{
    "avg_clip_duration_seconds": 3,
    "rhythm": "fast|medium|slow|variable",
    "transitions": "cut|dissolve|zoom|mixed",
    "analysis": "..."
  }},
  "emotion_triggers": ["curiosity", "fear", "desire", "social proof"],
  "cta": {{
    "type": "follow|buy|comment|share|visit",
    "placement": "beginning|end|throughout",
    "text_example": "..."
  }},
  "replication_tips": [
    "Tip 1: ...",
    "Tip 2: ..."
  ],
  "viral_score": 85,
  "viral_factors": ["strong hook", "social proof", "trending audio"]
}}
"""


class AnalyzeRequest(BaseModel):
    input_type: Literal["url", "description", "transcript"] = "description"
    content: str = Field(min_length=10, max_length=5000)
    platform_hint: str | None = None


class AnalyzeResponse(BaseModel):
    title_guess: str
    platform_guess: str
    hook: dict[str, Any]
    script_arc: dict[str, Any]
    visual_patterns: list[dict[str, Any]]
    pacing: dict[str, Any]
    emotion_triggers: list[str]
    cta: dict[str, Any]
    replication_tips: list[str]
    viral_score: int
    viral_factors: list[str]
    analysis_asset_id: int | None = None


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """Decompose a video into reusable viral patterns using Claude."""
    if req.input_type == "url":
        input_section = (
            f"Video URL: {req.content}\n"
            "(Analyze based on what you know about this type of content and URL pattern)"
        )
    elif req.input_type == "transcript":
        input_section = f"Video Transcript:\n{req.content}"
    else:
        input_section = f"Video Description:\n{req.content}"

    if req.platform_hint:
        input_section += f"\nPlatform: {req.platform_hint}"

    prompt = _ANALYZE_PROMPT.format(input_section=input_section)

    response = await ai_gateway.call(
        AIRequest(capability="text_gen", inputs={"prompt": prompt})
    )
    if not response.success:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {response.error}")

    raw = response.outputs.get("text", "")
    result = _parse_json(raw)
    if not result:
        raise HTTPException(status_code=502, detail="Failed to parse analysis response")

    # Fill defaults for any missing fields
    result.setdefault("title_guess", "Unknown Video")
    result.setdefault("platform_guess", req.platform_hint or "unknown")
    result.setdefault("hook", {"type": "unknown", "text": "", "duration_seconds": 3, "analysis": ""})
    result.setdefault("script_arc", {"structure": "Custom", "segments": []})
    result.setdefault("visual_patterns", [])
    result.setdefault(
        "pacing",
        {"avg_clip_duration_seconds": 3, "rhythm": "medium", "transitions": "cut", "analysis": ""},
    )
    result.setdefault("emotion_triggers", [])
    result.setdefault("cta", {"type": "follow", "placement": "end", "text_example": ""})
    result.setdefault("replication_tips", [])
    result.setdefault("viral_score", 50)
    result.setdefault("viral_factors", [])

    logger.info(f"Video analyzed: viral_score={result.get('viral_score')}")
    asset = await create_generated_asset(
        db,
        GeneratedAssetInput(
            name=f"爆款解析 — {result.get('title_guess', 'Unknown Video')}",
            asset_type=11,
            capability="viral_analysis",
            source_model=response.model_used,
            source_prompt=prompt,
            data=result,
            mime_type="application/json",
            file_format="json",
            description=f"Viral score: {result.get('viral_score')}",
            tags=result.get("viral_factors", []) + result.get("emotion_triggers", []),
        ),
    )
    await db.commit()
    result["analysis_asset_id"] = asset.id
    return AnalyzeResponse(**result)


@router.post("/generate-script-from-analysis")
async def generate_script_from_analysis(
    analysis: AnalyzeResponse,
    product_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new script that replicates the analyzed video's viral patterns."""
    prompt = f"""Based on this viral video analysis, create a new script for: {product_name}

Viral patterns to replicate:
- Hook type: {analysis.hook.get("type")} — {analysis.hook.get("analysis")}
- Script structure: {analysis.script_arc.get("structure")}
- Emotion triggers: {", ".join(analysis.emotion_triggers)}
- Pacing: {analysis.pacing.get("rhythm")} rhythm, ~{analysis.pacing.get("avg_clip_duration_seconds")}s per clip
- CTA: {analysis.cta.get("type")} at {analysis.cta.get("placement")}

Return a complete script JSON with 5 clips following the same pattern."""

    response = await ai_gateway.call(
        AIRequest(capability="text_gen", inputs={"prompt": prompt})
    )
    if not response.success:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {response.error}")

    return {"script": response.outputs.get("text", "")}


def _parse_json(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if m:
        raw = m.group(1)
    try:
        return json.loads(raw)
    except Exception:
        return {}
