import time

from loguru import logger

from app.core.ai_gateway.adapters.anthropic import AnthropicAdapter
from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.ai_gateway.adapters.google_adapter import GoogleAdapter
from app.core.ai_gateway.adapters.openai_adapter import OpenAIAdapter
from app.core.ai_gateway.adapters.replicate_adapter import ReplicateAdapter
from app.core.ai_gateway.adapters.together_adapter import TogetherAdapter
from app.core.ai_gateway.cost_tracker import estimate_cost
from app.core.ai_gateway.router import model_router
from app.core.ai_gateway.schemas import AIRequest, AIResponse


class AIGateway:
    def __init__(self) -> None:
        self._adapters: dict[str, AbstractAdapter] = {
            "anthropic": AnthropicAdapter(),
            "openai": OpenAIAdapter(),
            "google": GoogleAdapter(),
            "replicate": ReplicateAdapter(),
            "together": TogetherAdapter(),
        }

    def _get_adapter(self, provider: str) -> AbstractAdapter:
        adapter = self._adapters.get(provider)
        if not adapter:
            raise ValueError(f"No adapter registered for provider: {provider}")
        return adapter

    async def call(self, request: AIRequest) -> AIResponse:
        constraints = request.constraints or {}
        quality_level = constraints.get("quality_level", "default")

        start = time.perf_counter()
        provider = ""
        model = ""
        try:
            provider, model = model_router.resolve(
                capability=request.capability,
                quality_level=quality_level,
                preferred_model=request.preferred_model,
            )
            adapter = self._get_adapter(provider)
            inputs = {**request.inputs, "model": model}
            raw = await adapter.call(request.capability, inputs)
            latency_ms = round((time.perf_counter() - start) * 1000)
            tokens_or_units = {
                k: raw.get(k)
                for k in ("input_tokens", "output_tokens", "units")
                if raw.get(k) is not None
            }
            cost = estimate_cost(provider, model, tokens_or_units)
            logger.info(
                f"AI call success: {request.capability} via {provider}/{model} "
                f"({latency_ms}ms, ~${cost:.6f})"
            )
            return AIResponse(
                success=True,
                outputs=raw,
                model_used=model,
                provider=provider,
                tokens_or_units=tokens_or_units,
                cost_usd=cost,
                latency_ms=latency_ms,
            )
        except Exception as exc:
            latency_ms = round((time.perf_counter() - start) * 1000)
            logger.error(f"AI call failed: {request.capability} via {provider}/{model}: {exc}")
            return AIResponse(
                success=False,
                outputs={},
                model_used=model,
                provider=provider,
                latency_ms=latency_ms,
                error=str(exc),
            )


ai_gateway = AIGateway()
