"""Tests for Phase 5: pipeline, analyzer, stats."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ─── Pipeline ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_one_click_missing_product_name(client):
    resp = await client.post("/api/pipeline/one-click", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_empty_product_name(client):
    resp = await client.post("/api/pipeline/one-click", json={"product_name": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_invalid_platform(client):
    resp = await client.post(
        "/api/pipeline/one-click",
        json={"product_name": "test", "platform": "invalid_platform"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_invalid_clip_count(client):
    resp = await client.post(
        "/api/pipeline/one-click",
        json={"product_name": "test", "clip_count": 0},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_too_many_clips(client):
    resp = await client.post(
        "/api/pipeline/one-click",
        json={"product_name": "test", "clip_count": 20},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_duration_too_short(client):
    resp = await client.post(
        "/api/pipeline/one-click",
        json={"product_name": "test", "duration_seconds": 5},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_valid_styles(client):
    for _style in ("conversational", "dramatic", "educational", "humorous"):
        resp = await client.post(
            "/api/pipeline/one-click",
            json={"product_name": "Test", "style": "invalid_never"},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_one_click_long_product_name_rejected(client):
    resp = await client.post(
        "/api/pipeline/one-click",
        json={"product_name": "x" * 201},  # max is 200
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_pipeline_runs(client):
    resp = await client.get("/api/pipeline/runs")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_pipeline_run_not_found(client):
    resp = await client.get("/api/pipeline/runs/99999")
    assert resp.status_code == 404


# ─── Analyzer ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analyze_missing_content(client):
    resp = await client.post("/api/analyzer/analyze", json={"input_type": "description"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_content_too_short(client):
    resp = await client.post(
        "/api/analyzer/analyze",
        json={"input_type": "description", "content": "short"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_invalid_input_type(client):
    resp = await client.post(
        "/api/analyzer/analyze",
        json={"input_type": "video_file", "content": "some content here to test"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_success_mock(client):
    mock_result = {
        "title_guess": "Test Video",
        "platform_guess": "douyin",
        "hook": {"type": "question", "text": "Did you know?", "duration_seconds": 3, "analysis": "curiosity"},
        "script_arc": {"structure": "AIDA", "segments": []},
        "visual_patterns": [{"pattern": "close-up", "frequency": "frequent", "effect": "intimacy"}],
        "pacing": {"avg_clip_duration_seconds": 3, "rhythm": "fast", "transitions": "cut", "analysis": "energetic"},
        "emotion_triggers": ["curiosity", "desire"],
        "cta": {"type": "follow", "placement": "end", "text_example": "Follow for more"},
        "replication_tips": ["Use strong hook", "Show before/after"],
        "viral_score": 85,
        "viral_factors": ["strong hook", "social proof"],
    }
    import json

    analysis_asset = MagicMock()
    analysis_asset.id = 456
    with patch("app.modules.analyzer.router.ai_gateway.call", new_callable=AsyncMock) as mock_call, patch(
        "app.modules.analyzer.router.create_generated_asset",
        new_callable=AsyncMock,
        return_value=analysis_asset,
    ):
        mock_response = MagicMock()
        mock_response.success = True
        mock_response.outputs = {"text": f"```json\n{json.dumps(mock_result)}\n```"}
        mock_call.return_value = mock_response

        resp = await client.post(
            "/api/analyzer/analyze",
            json={
                "input_type": "description",
                "content": "A viral douyin video about a skincare product with dramatic before/after shots",
                "platform_hint": "douyin",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["viral_score"] == 85
        assert data["hook"]["type"] == "question"
        assert "curiosity" in data["emotion_triggers"]
        assert data["analysis_asset_id"] == 456


@pytest.mark.asyncio
async def test_analyze_gateway_failure(client):
    with patch("app.modules.analyzer.router.ai_gateway.call", new_callable=AsyncMock) as mock_call:
        mock_response = MagicMock()
        mock_response.success = False
        mock_response.error = "API error"
        mock_call.return_value = mock_response

        resp = await client.post(
            "/api/analyzer/analyze",
            json={
                "input_type": "description",
                "content": "Some viral video description that is long enough",
            },
        )
        assert resp.status_code == 502


@pytest.mark.asyncio
async def test_analyze_url_type(client):
    with patch("app.modules.analyzer.router.ai_gateway.call", new_callable=AsyncMock) as mock_call:
        mock_response = MagicMock()
        mock_response.success = False
        mock_response.error = "API error"
        mock_call.return_value = mock_response

        resp = await client.post(
            "/api/analyzer/analyze",
            json={
                "input_type": "url",
                "content": "https://www.douyin.com/video/example-video-id",
            },
        )
        assert resp.status_code == 502  # fails with mocked gateway error


# ─── Stats ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stats_overview(client):
    resp = await client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "assets" in data
    assert "video_projects" in data
    assert "tasks" in data
    assert "ai_calls" in data
    assert "tags" in data


@pytest.mark.asyncio
async def test_stats_costs_default_period(client):
    resp = await client.get("/api/stats/costs")
    assert resp.status_code == 200
    data = resp.json()
    assert "period_days" in data
    assert data["period_days"] == 30
    assert "total_cost_usd" in data
    assert "by_provider" in data


@pytest.mark.asyncio
async def test_stats_costs_custom_period(client):
    resp = await client.get("/api/stats/costs?days=7")
    assert resp.status_code == 200
    assert resp.json()["period_days"] == 7


@pytest.mark.asyncio
async def test_stats_activity(client):
    resp = await client.get("/api/stats/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert "assets" in data
    assert "ai_calls" in data
    assert isinstance(data["assets"], list)
    assert isinstance(data["ai_calls"], list)


@pytest.mark.asyncio
async def test_stats_storage(client):
    resp = await client.get("/api/stats/storage")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_bytes" in data
    assert "total_gb" in data
    assert "by_type" in data


# ─── Pipeline worker unit tests ──────────────────────────────────────────────


def test_pipeline_parse_json_clean():
    from app.workers.handlers.pipeline import _parse_json
    data = {"clips": [{"position": 0, "prompt": "test"}]}
    import json
    assert _parse_json(json.dumps(data)) == data


def test_pipeline_parse_json_with_code_fence():
    from app.workers.handlers.pipeline import _parse_json
    raw = '```json\n{"title": "test", "clips": []}\n```'
    result = _parse_json(raw)
    assert result["title"] == "test"


def test_pipeline_parse_json_invalid():
    from app.workers.handlers.pipeline import _parse_json
    assert _parse_json("not json at all {{{") == {}


def test_pipeline_parse_json_empty():
    from app.workers.handlers.pipeline import _parse_json
    assert _parse_json("") == {}


# ─── Analyzer unit tests ─────────────────────────────────────────────────────


def test_analyzer_parse_json_with_fence():
    from app.modules.analyzer.router import _parse_json
    raw = '```json\n{"viral_score": 90}\n```'
    assert _parse_json(raw)["viral_score"] == 90


def test_analyzer_parse_json_bare():
    import json

    from app.modules.analyzer.router import _parse_json
    data = {"viral_score": 75, "hook": {"type": "shock"}}
    assert _parse_json(json.dumps(data)) == data


def test_analyzer_parse_json_malformed():
    from app.modules.analyzer.router import _parse_json
    assert _parse_json("{{invalid}}") == {}


# ─── OneClickRequest schema ───────────────────────────────────────────────────


def test_one_click_schema_defaults():
    from app.modules.pipeline.schemas import OneClickRequest
    req = OneClickRequest(product_name="Test")
    assert req.platform == "tiktok"
    assert req.style == "conversational"
    assert req.duration_seconds == 30
    assert req.clip_count == 5


def test_one_click_schema_all_platforms():
    from app.modules.pipeline.schemas import OneClickRequest
    for p in ("tiktok", "youtube", "instagram", "facebook", "x", "linkedin", "douyin"):
        req = OneClickRequest(product_name="Test", platform=p)
        assert req.platform == p


def test_one_click_schema_all_styles():
    from app.modules.pipeline.schemas import OneClickRequest
    for s in ("conversational", "dramatic", "educational", "humorous"):
        req = OneClickRequest(product_name="Test", style=s)
        assert req.style == s
