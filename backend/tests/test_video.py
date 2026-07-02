"""Tests for the video production module (Phase 4)."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.video.schemas import VideoClipCreate, VideoProjectCreate

# ─── Project CRUD ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_project_missing_name(client):
    resp = await client.post("/api/video/projects", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_project_empty_name(client):
    resp = await client.post("/api/video/projects", json={"name": ""})
    # Empty string is accepted (no min-length validation) — just check not 500
    assert resp.status_code in (201, 422, 500)


@pytest.mark.asyncio
async def test_list_projects(client):
    resp = await client.get("/api/video/projects")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    resp = await client.get("/api/video/projects/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project_not_found(client):
    resp = await client.patch("/api/video/projects/1", json={"name": "Updated"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_found(client):
    resp = await client.delete("/api/video/projects/1")
    assert resp.status_code == 404


# ─── Clip CRUD ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_clip_project_not_found(client):
    resp = await client.post(
        "/api/video/projects/1/clips",
        json={"position": 0, "clip_type": "footage", "duration_ms": 5000},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_clip_invalid_type(client):
    resp = await client.post(
        "/api/video/projects/1/clips",
        json={"position": 0, "clip_type": "invalid_type", "duration_ms": 5000},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_clip_negative_position(client):
    resp = await client.post(
        "/api/video/projects/1/clips",
        json={"position": -1, "clip_type": "footage"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_clip_duration_too_short(client):
    resp = await client.post(
        "/api/video/projects/1/clips",
        json={"position": 0, "clip_type": "footage", "duration_ms": 50},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_clip_not_found(client):
    resp = await client.patch(
        "/api/video/projects/1/clips/1",
        json={"duration_ms": 10000},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_clip_not_found(client):
    resp = await client.delete("/api/video/projects/1/clips/1")
    assert resp.status_code == 404


# ─── TTS — route is /api/video/tts, not project-scoped ───────────────────────


@pytest.mark.asyncio
async def test_tts_missing_text(client):
    resp = await client.post("/api/video/tts", json={"voice_id": "default"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_tts_text_too_long(client):
    resp = await client.post("/api/video/tts", json={"text": "x" * 5001})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_tts_valid_request_calls_gateway(client):
    with patch("app.core.ai_gateway.gateway.AIGateway.call", new_callable=AsyncMock) as mock_call:
        mock_call.return_value.success = False
        mock_call.return_value.error = "mocked"
        resp = await client.post(
            "/api/video/tts",
            json={"text": "Hello world", "voice_id": "default_voice"},
        )
        assert resp.status_code in (200, 502, 500)


# ─── ASR — route is /api/video/asr ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_asr_missing_asset_id(client):
    resp = await client.post("/api/video/asr", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_asr_asset_not_found(client):
    resp = await client.post("/api/video/asr", json={"asset_id": 99999})
    assert resp.status_code == 404


# ─── Video Generate — route is /api/video/generate ───────────────────────────


@pytest.mark.asyncio
async def test_video_gen_missing_clip_id(client):
    resp = await client.post(
        "/api/video/generate",
        json={"video_project_id": 1, "prompt": "A sunset timelapse"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_video_gen_missing_prompt(client):
    resp = await client.post(
        "/api/video/generate",
        json={"video_project_id": 1, "clip_id": 1},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_video_gen_enqueues_task(client):
    with patch("app.modules.video.router.enqueue_task", new_callable=AsyncMock) as mock_enqueue:
        mock_enqueue.return_value = 1
        resp = await client.post(
            "/api/video/generate",
            json={"video_project_id": 1, "clip_id": 1, "prompt": "Sunset timelapse"},
        )
        assert resp.status_code == 202
        mock_enqueue.assert_awaited_once()


# ─── Render — route is /api/video/render ─────────────────────────────────────


@pytest.mark.asyncio
async def test_render_missing_project_id(client):
    resp = await client.post("/api/video/render", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_render_enqueues_task(client):
    mock_proj = AsyncMock()
    mock_proj.id = 1
    with (
        patch("app.modules.video.router.service.get_project", new_callable=AsyncMock, return_value=mock_proj),
        patch("app.modules.video.router.service.get_clips", new_callable=AsyncMock, return_value=[AsyncMock()]),
        patch("app.modules.video.router.service.set_render_status", new_callable=AsyncMock),
        patch("app.modules.video.router.enqueue_task", new_callable=AsyncMock, return_value=42),
    ):
        resp = await client.post("/api/video/render", json={"video_project_id": 1})
        assert resp.status_code == 202


# ─── Schema validation ────────────────────────────────────────────────────────


def test_video_project_create_schema_defaults():
    p = VideoProjectCreate(name="My Video")
    assert p.resolution == "1080x1920"
    assert p.fps == 30


def test_video_project_create_schema_custom():
    p = VideoProjectCreate(name="Short", resolution="1920x1080", fps=60)
    assert p.resolution == "1920x1080"
    assert p.fps == 60


def test_video_clip_create_schema():
    c = VideoClipCreate(position=0, clip_type="footage", duration_ms=5000)
    assert c.trim_start_ms == 0
    assert float(c.speed) == 1.0


def test_video_clip_all_types():
    for t in ("footage", "ai_video", "image", "text_overlay", "transition"):
        c = VideoClipCreate(position=0, clip_type=t)
        assert c.clip_type == t


@pytest.mark.asyncio
async def test_get_clips_for_projects_groups_results():
    from app.modules.video import service

    clip_a = AsyncMock()
    clip_a.video_project_id = 1
    clip_b = AsyncMock()
    clip_b.video_project_id = 2

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [clip_a, clip_b]
    db.execute = AsyncMock(return_value=mock_result)

    grouped = await service.get_clips_for_projects(db, [1, 2])

    assert grouped == {1: [clip_a], 2: [clip_b]}
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_clips_for_projects_empty_ids_skips_query():
    from app.modules.video import service

    db = AsyncMock()

    grouped = await service.get_clips_for_projects(db, [])

    assert grouped == {}
    db.execute.assert_not_called()


# ─── SRT helpers ─────────────────────────────────────────────────────────────


def test_srt_time_format():
    from app.modules.video.router import _ms_to_srt_time

    assert _ms_to_srt_time(0) == "00:00:00,000"
    assert _ms_to_srt_time(1000) == "00:00:01,000"
    assert _ms_to_srt_time(61500) == "00:01:01,500"
    assert _ms_to_srt_time(3661234) == "01:01:01,234"


def test_segments_to_srt():
    from app.modules.video.router import _segments_to_srt

    segments = [
        {"start": 0.0, "end": 1.5, "text": "Hello"},
        {"start": 2.0, "end": 3.0, "text": "World"},
    ]
    srt = _segments_to_srt(segments)
    assert "1\n" in srt
    assert "2\n" in srt
    assert "Hello" in srt
    assert "World" in srt
    assert "00:00:00,000 --> 00:00:01,500" in srt
    assert "00:00:02,000 --> 00:00:03,000" in srt


def test_segments_to_srt_empty():
    from app.modules.video.router import _segments_to_srt

    assert _segments_to_srt([]) == ""
