import base64

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_gateway import AIRequest, AIResponse, ai_gateway
from app.core.database import get_db
from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/call", response_model=AIResponse)
async def ai_call(request: AIRequest) -> AIResponse:
    """Direct AI gateway call — for smoke testing and internal use."""
    return await ai_gateway.call(request)


# ────────────────────────────────────────────────────────────
# Script generation
# ────────────────────────────────────────────────────────────

class ScriptGenRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    product_description: str | None = None
    platform: str = "tiktok"
    duration_seconds: int = Field(default=30, ge=5, le=180)
    style: str = "conversational"  # conversational | dramatic | educational
    target_audience: str | None = None
    keywords: list[str] = []
    quality: str = "default"  # default | fast | premium
    save_to_library: bool = True


class ScriptGenResponse(BaseModel):
    script: str
    hooks: list[str]
    tags_suggested: list[str]
    model_used: str
    cost_usd: float
    asset_id: int | None = None


@router.post("/generate/script", response_model=ScriptGenResponse)
async def generate_script(req: ScriptGenRequest, db: AsyncSession = Depends(get_db)):
    kw_line = ", ".join(req.keywords) if req.keywords else "无"
    audience_line = req.target_audience or "通用受众"
    desc_line = req.product_description or ""

    prompt = f"""你是一位专业的短视频文案创作者。请为以下产品创作一个{req.duration_seconds}秒的{req.platform}视频脚本。

产品名称：{req.product_name}
产品描述：{desc_line}
风格：{req.style}
目标受众：{audience_line}
关键词：{kw_line}

请以JSON格式输出，包含：
- "script": 完整视频脚本（包含画面描述和台词）
- "hooks": 3个开场钩子备选（数组）
- "tags_suggested": 10个视频标签（数组）

只输出JSON，不要其他内容。"""

    response = await ai_gateway.call(
        AIRequest(
            capability="text_gen",
            inputs={"prompt": prompt, "max_tokens": 2000},
            constraints={"quality_level": req.quality},
        )
    )

    if not response.success:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {response.error}")

    import json
    raw = response.outputs.get("text", "")
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])
        data = json.loads(cleaned)
    except Exception:
        data = {"script": raw, "hooks": [], "tags_suggested": []}

    asset_id = None
    if req.save_to_library:
        asset = await create_generated_asset(
            db,
            GeneratedAssetInput(
                name=f"AI Script — {req.product_name}",
                asset_type=5,
                capability="script_gen",
                source_model=response.model_used,
                source_prompt=prompt,
                data=data,
                mime_type="application/json",
                file_format="json",
                description=f"{req.platform} {req.duration_seconds}s {req.style} script",
                tags=data.get("tags_suggested", []),
            ),
        )
        await db.commit()
        asset_id = asset.id

    return ScriptGenResponse(
        script=data.get("script", raw),
        hooks=data.get("hooks", []),
        tags_suggested=data.get("tags_suggested", []),
        model_used=response.model_used,
        cost_usd=float(response.cost_usd),
        asset_id=asset_id,
    )


# ────────────────────────────────────────────────────────────
# Image generation
# ────────────────────────────────────────────────────────────

class ImageGenRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    size: str = "1024x1024"
    quality: str = "standard"
    style_preset: str | None = None
    n: int = Field(default=1, ge=1, le=4)
    save_to_library: bool = True


class ImageGenResponse(BaseModel):
    images: list[str]  # storage keys
    cdn_urls: list[str]
    model_used: str
    cost_usd: float
    asset_ids: list[int]


@router.post("/generate/image", response_model=ImageGenResponse)
async def generate_image(req: ImageGenRequest, db: AsyncSession = Depends(get_db)):
    full_prompt = req.prompt
    if req.style_preset:
        full_prompt = f"{req.prompt}, {req.style_preset}"

    response = await ai_gateway.call(
        AIRequest(
            capability="image_gen",
            inputs={"prompt": full_prompt, "size": req.size, "quality": req.quality, "n": req.n},
        )
    )

    if not response.success:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {response.error}")

    images_b64: list[str] = response.outputs.get("images_b64", [])
    storage_keys: list[str] = []
    cdn_urls: list[str] = []
    asset_ids: list[int] = []

    if req.save_to_library:
        for b64 in images_b64:
            img_bytes = base64.b64decode(b64)
            asset = await create_generated_asset(
                db,
                GeneratedAssetInput(
                    name=f"AI Image — {req.prompt[:60]}",
                    asset_type=1,
                    capability="image_gen",
                    source_model=response.model_used,
                    source_prompt=full_prompt,
                    data=img_bytes,
                    mime_type="image/png",
                    file_format="png",
                    description=full_prompt,
                ),
            )
            storage_keys.append(asset.storage_key)
            cdn_urls.append(asset.cdn_url or "")
            asset_ids.append(asset.id)

        await db.commit()

    return ImageGenResponse(
        images=storage_keys,
        cdn_urls=cdn_urls,
        model_used=response.model_used,
        cost_usd=float(response.cost_usd),
        asset_ids=asset_ids,
    )
