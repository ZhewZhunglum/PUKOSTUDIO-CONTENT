from typing import Any

import httpx
from loguru import logger
from openai import AsyncOpenAI

from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.config import settings


def _get_openai_key() -> str:
    try:
        from app.modules.settings.router import get_cached_key
        return get_cached_key("api_key_openai", "openai_api_key") or settings.openai_api_key
    except ImportError:
        return settings.openai_api_key


class OpenAIAdapter(AbstractAdapter):
    provider = "openai"

    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None
        self._last_key: str = ""

    def _get_client(self) -> AsyncOpenAI:
        key = _get_openai_key() or "placeholder"
        if self._client is None or key != self._last_key:
            self._client = AsyncOpenAI(api_key=key)
            self._last_key = key
        return self._client

    def supported_capabilities(self) -> list[str]:
        return ["image_gen", "video_gen", "tts", "asr", "embedding"]

    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if capability == "image_gen":
            return await self._image_gen(inputs)
        if capability == "video_gen":
            return await self._video_gen(inputs)
        if capability == "tts":
            return await self._tts(inputs)
        if capability == "asr":
            return await self._asr(inputs)
        if capability == "embedding":
            return await self._embedding(inputs)
        raise ValueError(f"OpenAI adapter does not support capability: {capability}")

    async def _image_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "gpt-image-2")
        prompt = inputs["prompt"]
        size = inputs.get("size", "1024x1024")
        quality = inputs.get("quality", "standard")
        n = inputs.get("n", 1)

        response = await self._get_client().images.generate(
            model=model,
            prompt=prompt,
            size=size,
            quality=quality,
            n=n,
            response_format="b64_json",
        )
        images = [item.b64_json for item in response.data if item.b64_json]
        logger.debug(f"OpenAI image_gen: {len(images)} image(s)")
        return {"images_b64": images, "model": model, "units": len(images)}

    async def _video_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "sora-2")
        prompt = inputs["prompt"]
        payload = {
            "model": model,
            "prompt": prompt,
            "seconds": inputs.get("duration", inputs.get("duration_seconds", 5)),
            "size": inputs.get("size") or inputs.get("resolution", "720x1280"),
        }
        if inputs.get("aspect_ratio"):
            payload["aspect_ratio"] = inputs["aspect_ratio"]

        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=900) as client:
            create_resp = await client.post(
                "https://api.openai.com/v1/videos",
                headers=headers,
                json=payload,
            )
            create_resp.raise_for_status()
            data = create_resp.json()
            video_url = data.get("video_url") or data.get("url")
            video_id = data.get("id")

            if not video_url and video_id:
                video_url = await self._poll_video_url(client, headers, video_id)

        if not video_url:
            raise RuntimeError("OpenAI video generation returned no video URL")
        return {"video_url": video_url, "model": model, "units": 1}

    async def _poll_video_url(
        self, client: httpx.AsyncClient, headers: dict[str, str], video_id: str
    ) -> str | None:
        for _ in range(120):
            resp = await client.get(f"https://api.openai.com/v1/videos/{video_id}", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") in {"failed", "cancelled"}:
                raise RuntimeError(data.get("error") or f"Video {video_id} failed")
            video_url = data.get("video_url") or data.get("url")
            if video_url:
                return str(video_url)
            import asyncio

            await asyncio.sleep(5)
        raise TimeoutError(f"OpenAI video generation timed out: {video_id}")

    async def _tts(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "tts-1-hd")
        text = inputs["text"]
        voice = inputs.get("voice", "nova")
        speed = inputs.get("speed", 1.0)

        response = await self._get_client().audio.speech.create(
            model=model, input=text, voice=voice, speed=speed
        )
        audio_bytes = response.content
        return {"audio_bytes": audio_bytes, "model": model}

    async def _asr(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "whisper-1")
        audio_bytes = inputs["audio_bytes"]
        language = inputs.get("language")
        response_format = inputs.get("response_format", "verbose_json")

        kwargs: dict[str, Any] = {
            "model": model,
            "file": ("audio.mp3", audio_bytes, "audio/mpeg"),
            "response_format": response_format,
        }
        if language:
            kwargs["language"] = language

        transcript = await self._get_client().audio.transcriptions.create(**kwargs)
        return {"text": transcript.text, "model": model}

    async def _embedding(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "text-embedding-3-large")
        if "texts" in inputs and isinstance(inputs["texts"], list):
            texts = inputs["texts"]
        else:
            texts = [inputs["text"]]

        response = await self._get_client().embeddings.create(model=model, input=texts)
        vectors = [item.embedding for item in response.data]
        usage = response.usage
        result: dict[str, Any] = {
            "vectors": vectors,
            "model": model,
            "input_tokens": usage.prompt_tokens,
        }
        if len(vectors) == 1:
            result["embedding"] = vectors[0]
        return result
