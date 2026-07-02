"""AI Gateway unit tests (mocked, no real API calls)."""
from unittest.mock import AsyncMock, patch

import pytest

from app.core.ai_gateway.gateway import AIGateway
from app.core.ai_gateway.schemas import AIRequest


@pytest.mark.asyncio
async def test_gateway_text_gen_success() -> None:
    gateway = AIGateway()
    mock_output = {
        "text": "ok",
        "input_tokens": 10,
        "output_tokens": 2,
        "model": "claude-sonnet-4-7",
        "stop_reason": "end_turn",
    }
    with patch.object(
        gateway._adapters["anthropic"],
        "call",
        new=AsyncMock(return_value=mock_output),
    ):
        resp = await gateway.call(
            AIRequest(
                capability="text_gen",
                inputs={"messages": [{"role": "user", "content": "ping"}]},
            )
        )

    assert resp.success is True
    assert resp.outputs["text"] == "ok"
    assert resp.provider == "anthropic"
    assert resp.latency_ms >= 0


@pytest.mark.asyncio
async def test_gateway_text_gen_adapter_error() -> None:
    gateway = AIGateway()
    with patch.object(
        gateway._adapters["anthropic"],
        "call",
        new=AsyncMock(side_effect=Exception("API error")),
    ):
        resp = await gateway.call(
            AIRequest(
                capability="text_gen",
                inputs={"messages": [{"role": "user", "content": "ping"}]},
            )
        )

    assert resp.success is False
    assert resp.error == "API error"


@pytest.mark.asyncio
async def test_gateway_unknown_capability() -> None:
    gateway = AIGateway()
    resp = await gateway.call(
        AIRequest(capability="unknown_cap", inputs={})
    )
    assert resp.success is False
    assert resp.error is not None


@pytest.mark.asyncio
async def test_gateway_bulk_local_routing() -> None:
    gateway = AIGateway()
    mock_output = {
        "text": "hello",
        "input_tokens": 5,
        "output_tokens": 2,
        "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    }
    with patch.object(
        gateway._adapters["together"],
        "call",
        new=AsyncMock(return_value=mock_output),
    ):
        resp = await gateway.call(
            AIRequest(
                capability="text_gen",
                inputs={"messages": [{"role": "user", "content": "hi"}]},
                constraints={"quality_level": "bulk_local"},
            )
        )

    assert resp.success is True
    assert resp.provider == "together"
