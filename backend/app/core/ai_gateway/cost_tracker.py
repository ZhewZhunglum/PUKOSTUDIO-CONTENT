from decimal import Decimal
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

# Cost per unit by provider+model (USD). Kept simple; update as pricing changes.
_COST_TABLE: dict[str, dict[str, Decimal]] = {
    "anthropic": {
        "claude-sonnet-4-7": Decimal("0.000003"),    # per output token
        "claude-opus-4-7": Decimal("0.000015"),
        "claude-haiku-4-5": Decimal("0.00000025"),
    },
    "openai": {
        "gpt-image-2": Decimal("0.00"),
        "gpt-image-1.5": Decimal("0.00"),
        "gpt-image-1": Decimal("0.04"),              # per image
        "sora-2": Decimal("0.00"),
        "sora-2-pro": Decimal("0.00"),
        "tts-1-hd": Decimal("0.000015"),             # per char
        "whisper-1": Decimal("0.006"),               # per minute
        "text-embedding-3-large": Decimal("0.00000013"),  # per token
    },
    "google": {
        "veo-3.1-generate-preview": Decimal("0.00"),
        "veo-3.1-generate-001": Decimal("0.00"),
    },
    "together": {
        "meta-llama/Llama-3.3-70B-Instruct-Turbo": Decimal("0.00000088"),
        "Qwen/Qwen2.5-VL-72B-Instruct": Decimal("0.0000012"),
    },
    "replicate": {
        "bytedance/seedance-1.5-pro": Decimal("0.00"),
    },  # variable; log units only
}


def estimate_cost(provider: str, model: str, tokens_or_units: dict[str, Any]) -> Decimal:
    rate = _COST_TABLE.get(provider, {}).get(model, Decimal("0"))
    if rate == Decimal("0"):
        return Decimal("0")
    output_tokens = tokens_or_units.get("output_tokens", 0)
    input_tokens = tokens_or_units.get("input_tokens", 0)
    # For text models: charge output tokens (input is cheaper, approximate)
    if output_tokens:
        return rate * Decimal(str(output_tokens + input_tokens // 4))
    units = tokens_or_units.get("units", 1)
    return rate * Decimal(str(units))


async def record_call(
    db: AsyncSession,
    *,
    task_id: int | None,
    capability: str,
    provider: str,
    model: str,
    tokens_or_units: dict[str, Any],
    cost_usd: Decimal,
    latency_ms: int,
    status: int,
    error_code: str | None = None,
) -> None:
    from sqlalchemy import text

    sql = text("""
        INSERT INTO ai_call_log
          (task_id, capability, provider, model,
           input_tokens, output_tokens, total_units, cost_usd,
           latency_ms, status, error_code, created_at)
        VALUES
          (:task_id, :capability, :provider, :model,
           :input_tokens, :output_tokens, :total_units, :cost_usd,
           :latency_ms, :status, :error_code, NOW())
    """)
    try:
        await db.execute(
            sql,
            {
                "task_id": task_id,
                "capability": capability,
                "provider": provider,
                "model": model,
                "input_tokens": tokens_or_units.get("input_tokens"),
                "output_tokens": tokens_or_units.get("output_tokens"),
                "total_units": tokens_or_units.get("units"),
                "cost_usd": cost_usd,
                "latency_ms": latency_ms,
                "status": status,
                "error_code": error_code,
            },
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to record AI call log: {e}")
