from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class AIRequest(BaseModel):
    capability: str  # text_gen / image_gen / video_gen / tts / asr / vision / embedding
    inputs: dict[str, Any]
    constraints: dict[str, Any] | None = None  # max_cost / quality_level / preferred_model
    preferred_model: str | None = None
    metadata: dict[str, Any] | None = None


class AIResponse(BaseModel):
    success: bool
    outputs: dict[str, Any]
    model_used: str
    provider: str
    tokens_or_units: dict[str, Any] = {}
    cost_usd: Decimal = Decimal("0")
    latency_ms: int = 0
    error: str | None = None
