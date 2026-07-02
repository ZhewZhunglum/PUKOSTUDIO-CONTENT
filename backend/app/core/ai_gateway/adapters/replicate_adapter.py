from typing import Any

import replicate
from loguru import logger

from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.config import settings


def _get_replicate_key() -> str:
    try:
        from app.modules.settings.router import get_cached_key
        return get_cached_key("api_key_replicate", "replicate_api_token") or settings.replicate_api_token
    except ImportError:
        return settings.replicate_api_token


class ReplicateAdapter(AbstractAdapter):
    provider = "replicate"

    def __init__(self) -> None:
        self._client: replicate.Client | None = None
        self._last_key: str = ""

    def _get_client(self) -> replicate.Client:
        key = _get_replicate_key()
        if self._client is None or key != self._last_key:
            self._client = replicate.Client(api_token=key)
            self._last_key = key
        return self._client

    def supported_capabilities(self) -> list[str]:
        return ["video_gen", "image_gen", "embedding"]

    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if capability == "video_gen":
            return await self._video_gen(inputs)
        if capability == "image_gen":
            return await self._image_gen(inputs)
        raise ValueError(f"Replicate adapter does not support capability: {capability}")

    async def _video_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "bytedance/seedance-1.5-pro")
        prompt = inputs.get("prompt", "")
        image_url = inputs.get("image_url")  # for image-to-video

        payload: dict[str, Any] = {"prompt": prompt}
        for key in ("duration", "duration_seconds", "aspect_ratio", "resolution", "fps", "seed"):
            if inputs.get(key) is not None:
                payload[key] = inputs[key]
        if image_url:
            payload["image"] = image_url
        elif inputs.get("image"):  # base64 data URL for i2v
            payload["image"] = inputs["image"]

        logger.info(f"Replicate video_gen: model={model}")
        output = await self._get_client().async_run(model, input=payload)

        # Output is typically a URL or list of URLs
        if isinstance(output, list):
            video_url = str(output[0])
        else:
            video_url = str(output)

        return {"video_url": video_url, "model": model, "units": 1}

    async def _image_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "black-forest-labs/flux-1.1-pro-ultra")
        prompt = inputs["prompt"]
        aspect_ratio = inputs.get("aspect_ratio", "1:1")

        output = await self._get_client().async_run(
            model, input={"prompt": prompt, "aspect_ratio": aspect_ratio}
        )
        if isinstance(output, list):
            image_url = str(output[0])
        else:
            image_url = str(output)

        return {"image_url": image_url, "model": model, "units": 1}
