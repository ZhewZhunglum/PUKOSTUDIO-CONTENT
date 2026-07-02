from typing import Any

from loguru import logger
from together import AsyncTogether

from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.config import settings


def _get_together_key() -> str:
    try:
        from app.modules.settings.router import get_cached_key
        return get_cached_key("api_key_together", "together_api_key") or settings.together_api_key
    except ImportError:
        return settings.together_api_key


class TogetherAdapter(AbstractAdapter):
    """Together AI Serverless — bulk text + vision (Llama 3.3 70B, Qwen2.5 VL 72B)."""

    provider = "together"

    def __init__(self) -> None:
        self._client: AsyncTogether | None = None
        self._last_key: str = ""

    def _get_client(self) -> AsyncTogether:
        key = _get_together_key()
        if self._client is None or key != self._last_key:
            self._client = AsyncTogether(api_key=key)
            self._last_key = key
        return self._client

    def supported_capabilities(self) -> list[str]:
        return ["text_gen", "vision"]

    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if capability == "text_gen":
            return await self._text_gen(inputs)
        if capability == "vision":
            return await self._vision(inputs)
        raise ValueError(f"Together adapter does not support capability: {capability}")

    async def _text_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "meta-llama/Llama-3.3-70B-Instruct-Turbo")
        messages = inputs.get("messages", [])
        max_tokens = inputs.get("max_tokens", 2048)
        temperature = inputs.get("temperature", 0.7)

        response = await self._get_client().chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        text = response.choices[0].message.content or ""
        usage = response.usage
        logger.debug(f"Together text_gen: {usage.prompt_tokens}in / {usage.completion_tokens}out")
        return {
            "text": text,
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
            "model": model,
        }

    async def _vision(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "Qwen/Qwen2.5-VL-72B-Instruct")
        prompt = inputs.get("prompt", "Describe this image.")
        image_url = inputs.get("image_url", "")
        max_tokens = inputs.get("max_tokens", 1500)

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        response = await self._get_client().chat.completions.create(
            model=model, messages=messages, max_tokens=max_tokens
        )
        text = response.choices[0].message.content or ""
        usage = response.usage
        return {
            "text": text,
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
            "model": model,
        }
