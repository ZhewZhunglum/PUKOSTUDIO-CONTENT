import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

# Clear proxy env vars before importing app — tests use in-process ASGI transport,
# no real HTTP calls; a SOCKS proxy without socksio causes import failure.
os.environ.pop("all_proxy", None)
os.environ.pop("ALL_PROXY", None)
os.environ.pop("http_proxy", None)
os.environ.pop("https_proxy", None)

# Use test env defaults before importing app
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://cf:dev@localhost:5432/contentforge")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("S3_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("S3_ACCESS_KEY", "minioadmin")
os.environ.setdefault("S3_SECRET_KEY", "minioadmin")
os.environ.setdefault("S3_BUCKET", "contentforge-assets")
# Force test environment regardless of the container's .env (disables rate limiting etc.)
os.environ["ENVIRONMENT"] = "test"


async def _mock_db():
    """Stub DB session — returns an AsyncMock that satisfies get_db in routes."""
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_result.fetchall.return_value = []
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = None
    mock_mappings.all.return_value = []
    mock_result.mappings.return_value = mock_mappings
    session.get = AsyncMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)
    session.commit = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    yield session


def _override_test_user() -> str:
    """Bypass JWT auth in tests — routes see a fixed authenticated user."""
    return "test-user"


@pytest.fixture(autouse=True)
def _bypass_auth():
    """Apply the auth override for every test, including files with local client fixtures."""
    from app.core.auth import verify_token
    from app.main import app

    app.dependency_overrides[verify_token] = _override_test_user
    yield
    app.dependency_overrides.pop(verify_token, None)


async def _make_client():
    from app.core.auth import verify_token
    from app.core.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = _mock_db
    app.dependency_overrides[verify_token] = _override_test_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(verify_token, None)


@pytest.fixture
async def client():
    async for c in _make_client():
        yield c


@pytest.fixture
async def async_client():
    async for c in _make_client():
        yield c
