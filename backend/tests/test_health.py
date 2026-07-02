"""Health check and basic smoke tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root(client: AsyncClient) -> None:
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "ContentForge API"


@pytest.mark.asyncio
async def test_healthz_returns_json(client: AsyncClient) -> None:
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "db" in data
    assert "redis" in data
    assert "storage" in data


@pytest.mark.asyncio
async def test_openapi_available(client: AsyncClient) -> None:
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"] == "ContentForge API"


@pytest.mark.asyncio
async def test_ugc_router_is_not_mounted(client: AsyncClient) -> None:
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    assert not any(path.startswith("/api/ugc") for path in paths)
