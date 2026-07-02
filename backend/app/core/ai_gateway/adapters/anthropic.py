from typing import Any

import anthropic
from loguru import logger

from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.config import settings


def _get_anthropic_key() -> str:
    """Prefer DB-stored key, fall back to env var."""
    try:
        from app.modules.settings.router import get_cached_key
        return get_cached_key("api_key_anthropic", "anthropic_api_key") or settings.anthropic_api_key
    except ImportError:
        return settings.anthropic_api_key


class AnthropicAdapter(AbstractAdapter):
    provider = "anthropic"

    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None
        self._last_key: str = ""

    def _get_client(self) -> anthropic.AsyncAnthropic:
        key = _get_anthropic_key()
        if self._client is None or key != self._last_key:
            self._client = anthropic.AsyncAnthropic(api_key=key)
            self._last_key = key
        return self._client

    def supported_capabilities(self) -> list[str]:
        return ["text_gen", "vision"]

    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if capability == "text_gen":
            return await self._text_gen(inputs)
        if capability == "vision":
            return await self._vision(inputs)
        raise ValueError(f"Anthropic adapter does not support capability: {capability}")

    async def _text_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "claude-sonnet-4-7")
        if "prompt" in inputs and not inputs.get("messages"):
            messages = [{"role": "user", "content": inputs["prompt"]}]
        else:
            messages = inputs.get("messages", [])
        system = inputs.get("system", "")
        max_tokens = inputs.get("max_tokens", 2048)
        temperature = inputs.get("temperature", 0.7)

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            kwargs["system"] = system

        response = await self._get_client().messages.create(**kwargs)
        text = response.content[0].text if response.content else ""
        usage = response.usage

        logger.debug(f"Anthropic text_gen: {usage.input_tokens}in / {usage.output_tokens}out")
        return {
            "text": text,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "model": response.model,
            "stop_reason": response.stop_reason,
        }

    async def _vision(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "claude-sonnet-4-7")
        prompt = inputs.get("prompt", "Describe this image.")
        max_tokens = inputs.get("max_tokens", 1500)
        system = inputs.get("system", "")

        if "image_b64" in inputs:
            mime = inputs.get("mime_type", "image/jpeg")
            image_source: dict[str, Any] = {
                "type": "base64",
                "media_type": mime,
                "data": inputs["image_b64"],
            }
        else:
            image_source = {"type": "url", "url": inputs.get("image_url", "")}

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": image_source},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        kwargs: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens}
        if system:
            kwargs["system"] = system

        response = await self._get_client().messages.create(**kwargs)
        text = response.content[0].text if response.content else ""
        usage = response.usage
        return {
            "text": text,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "model": response.model,
        }
