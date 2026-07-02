"""Tests for Phase 3: AI tagging, embedding, search, script/image gen."""
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.ai_gateway.schemas import AIResponse


@pytest.fixture
def mock_ai_response_ok():
    return AIResponse(
        success=True,
        outputs={"text": '{"tags": ["室内", "办公室", "商务"], "description": "一个现代办公室场景"}'},
        model_used="claude-sonnet-4-7",
        provider="anthropic",
        cost_usd=Decimal("0.001"),
        latency_ms=500,
    )


@pytest.fixture
def mock_embedding_response():
    return AIResponse(
        success=True,
        outputs={"embedding": [0.1] * 3072, "vectors": [[0.1] * 3072], "input_tokens": 10},
        model_used="text-embedding-3-large",
        provider="openai",
        cost_usd=Decimal("0.0001"),
        latency_ms=200,
    )


@pytest.fixture
def mock_script_response():
    import json
    script_data = {
        "script": "开场：特写产品...\n台词：这款产品...",
        "hooks": ["你知道吗？", "如果你想要...", "今天我来测评"],
        "tags_suggested": ["测评", "好物", "推荐"],
    }
    return AIResponse(
        success=True,
        outputs={"text": json.dumps(script_data)},
        model_used="claude-sonnet-4-7",
        provider="anthropic",
        cost_usd=Decimal("0.003"),
        latency_ms=1000,
    )


@pytest.fixture
def mock_image_response():
    import base64
    fake_png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100).decode()
    return AIResponse(
        success=True,
        outputs={"images_b64": [fake_png], "model": "gpt-image-1"},
        model_used="gpt-image-1",
        provider="openai",
        cost_usd=Decimal("0.04"),
        latency_ms=5000,
    )


class TestScriptGeneration:
    async def test_generate_script_success(self, async_client, mock_script_response):
        generated_asset = MagicMock()
        generated_asset.id = 123
        with patch(
            "app.modules.ai.router.ai_gateway.call",
            new_callable=AsyncMock,
            return_value=mock_script_response,
        ), patch(
            "app.modules.ai.router.create_generated_asset",
            new_callable=AsyncMock,
            return_value=generated_asset,
        ):
            resp = await async_client.post(
                "/ai/generate/script",
                json={
                    "product_name": "神奇保温杯",
                    "platform": "douyin",
                    "duration_seconds": 30,
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "script" in data
        assert isinstance(data["hooks"], list)
        assert len(data["hooks"]) == 3
        assert isinstance(data["tags_suggested"], list)
        assert data["asset_id"] == 123

    async def test_generate_script_ai_failure(self, async_client):
        with patch(
            "app.modules.ai.router.ai_gateway.call",
            new_callable=AsyncMock,
            return_value=AIResponse(
                success=False, outputs={}, model_used="", provider="", error="API timeout"
            ),
        ):
            resp = await async_client.post(
                "/ai/generate/script",
                json={"product_name": "Test", "platform": "douyin"},
            )
        assert resp.status_code == 502


class TestEmbeddingSearch:
    async def test_fulltext_search_query_required(self, async_client):
        resp = await async_client.get("/api/search")
        assert resp.status_code == 422

    async def test_fulltext_search_mocked(self, async_client):
        with patch(
            "app.modules.asset.search_router.search_service.rrf_search",
            new_callable=AsyncMock,
            return_value=[],
        ), patch(
            "app.modules.asset.search_router._record_history",
            new_callable=AsyncMock,
        ):
            resp = await async_client.get("/api/search?q=test")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_semantic_text_search(self, async_client, mock_embedding_response):
        with patch(
            "app.modules.asset.search_router.ai_gateway.call",
            new_callable=AsyncMock,
            return_value=mock_embedding_response,
        ), patch(
            "app.modules.asset.search_router.search_service.vector_search_by_text",
            new_callable=AsyncMock,
            return_value=[],
        ):
            resp = await async_client.post(
                "/api/search/similar/text",
                json={"query": "办公室场景", "limit": 10},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_similar_asset_invalid_id(self, async_client):
        # Non-integer path param → 422
        resp = await async_client.get("/api/search/similar/abc")
        assert resp.status_code == 422

    async def test_similar_asset_not_found(self, async_client):
        # Valid int but no such asset → 404
        resp = await async_client.get("/api/search/similar/999999")
        assert resp.status_code == 404


class TestTagParsing:
    def test_parse_valid_json(self):
        from app.workers.handlers.ai_tag import _parse_tag_response
        raw = '{"tags": ["室内", "商务"], "description": "办公室场景"}'
        result = _parse_tag_response(raw, "test")
        assert len(result["tags"]) == 2
        assert result["tags"][0]["name"] == "室内"
        assert result["description"] == "办公室场景"

    def test_parse_markdown_fenced(self):
        from app.workers.handlers.ai_tag import _parse_tag_response
        raw = '```json\n{"tags": ["测试"], "description": "描述"}\n```'
        result = _parse_tag_response(raw, "test")
        assert result["tags"][0]["name"] == "测试"

    def test_parse_invalid_json_fallback(self):
        from app.workers.handlers.ai_tag import _parse_tag_response
        raw = "this is not json"
        result = _parse_tag_response(raw, "test")
        assert result["tags"] == []
        assert result["description"] == raw
