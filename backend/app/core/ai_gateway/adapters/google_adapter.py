import asyncio
from typing import Any

import httpx

from app.core.ai_gateway.adapters.base import AbstractAdapter
from app.core.config import settings


class GoogleAdapter(AbstractAdapter):
    provider = "google"

    def supported_capabilities(self) -> list[str]:
        return ["video_gen"]

    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if capability == "video_gen":
            return await self._video_gen(inputs)
        raise ValueError(f"Google adapter does not support capability: {capability}")

    async def _video_gen(self, inputs: dict[str, Any]) -> dict[str, Any]:
        model = inputs.get("model", "veo-3.1-generate-001")
        prompt = inputs["prompt"]
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "durationSeconds": inputs.get("duration", inputs.get("duration_seconds", 5)),
                "aspectRatio": inputs.get("aspect_ratio", "9:16"),
                "sampleCount": 1,
            },
        }
        image_url = inputs.get("image_url")
        if image_url:
            payload["instances"][0]["image"] = {"gcsUri": image_url}

        operation = await self._start_prediction(model, payload)
        video_url = await self._poll_operation(operation)
        return {"video_url": video_url, "model": model, "units": 1}

    async def _start_prediction(self, model: str, payload: dict[str, Any]) -> str:
        if not settings.google_project_id:
            raise RuntimeError("GOOGLE_PROJECT_ID is required for Veo video generation")
        url = (
            f"https://{settings.google_location}-aiplatform.googleapis.com/v1/"
            f"projects/{settings.google_project_id}/locations/{settings.google_location}/"
            f"publishers/google/models/{model}:predictLongRunning"
        )
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        operation = data.get("name")
        if not operation:
            raise RuntimeError("Veo did not return a long-running operation name")
        return operation

    async def _poll_operation(self, operation: str) -> str:
        headers = await self._headers()
        url = f"https://{settings.google_location}-aiplatform.googleapis.com/v1/{operation}"
        async with httpx.AsyncClient(timeout=60) as client:
            for _ in range(180):
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                if data.get("done"):
                    if data.get("error"):
                        raise RuntimeError(str(data["error"]))
                    return self._extract_video_url(data)
                await asyncio.sleep(5)
        raise TimeoutError(f"Veo operation timed out: {operation}")

    async def _headers(self) -> dict[str, str]:
        token = settings.google_api_key
        if not token:
            raise RuntimeError("GOOGLE_API_KEY must contain a Vertex AI bearer token")
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _extract_video_url(self, data: dict[str, Any]) -> str:
        response = data.get("response", {})
        predictions = response.get("predictions") or response.get("videos") or []
        first = predictions[0] if predictions else response
        for key in ("gcsUri", "videoUri", "uri", "url"):
            if first.get(key):
                return str(first[key])
        raise RuntimeError("Veo operation completed without a video URL")
