from app.core.ai_gateway.adapters.openai_adapter import OpenAIAdapter
from app.core.ai_gateway.adapters.replicate_adapter import ReplicateAdapter
from app.core.ai_gateway.router import ModelRouter


def test_model_router_resolves_upgraded_default_models():
    router = ModelRouter()

    assert router.resolve("image_gen") == ("openai", "gpt-image-2")
    assert router.resolve("video_gen") == ("replicate", "bytedance/seedance-1.5-pro")
    assert router.resolve("video_gen", "premium") == ("openai", "sora-2")
    assert router.resolve("video_gen", "premium_cinematic") == ("openai", "sora-2-pro")
    assert router.resolve("video_gen", "premium_with_audio") == (
        "google",
        "veo-3.1-generate-001",
    )


def test_openai_adapter_supports_image_and_video_generation():
    adapter = OpenAIAdapter()

    assert "image_gen" in adapter.supported_capabilities()
    assert "video_gen" in adapter.supported_capabilities()


async def test_replicate_video_adapter_defaults_to_seedance_15(monkeypatch):
    captured: dict[str, object] = {}
    adapter = ReplicateAdapter()

    async def fake_run(model: str, input: dict[str, object]):
        captured["model"] = model
        captured["input"] = input
        return "https://example.com/video.mp4"

    class FakeClient:
        async_run = staticmethod(fake_run)

    # _client is created lazily per API key — stub the factory, not the client
    monkeypatch.setattr(adapter, "_get_client", lambda: FakeClient())
    result = await adapter.call(
        "video_gen",
        {"prompt": "cinematic product video", "duration": 5, "aspect_ratio": "9:16"},
    )

    assert result["model"] == "bytedance/seedance-1.5-pro"
    assert captured["model"] == "bytedance/seedance-1.5-pro"
    assert captured["input"] == {
        "prompt": "cinematic product video",
        "duration": 5,
        "aspect_ratio": "9:16",
    }
