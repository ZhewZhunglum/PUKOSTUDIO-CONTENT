"""Phase 7 tests: brand, sku, project CRUD validation + schema tests."""
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.database import get_db
from app.main import app


def _mock_db():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.get = AsyncMock(return_value=None)
    session.add = MagicMock()
    session.delete = AsyncMock()
    return session


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = _mock_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


def _brand_mock(id: int = 1, name: str = "Test Brand") -> MagicMock:
    b = MagicMock()
    b.id = id
    b.name = name
    b.description = None
    b.logo_asset_id = None
    b.website = None
    b.color_primary = None
    b.notes = None
    b.created_at = datetime.now(UTC)
    b.updated_at = datetime.now(UTC)
    return b


def _sku_mock(id: int = 1, name: str = "Test SKU") -> MagicMock:
    s = MagicMock()
    s.id = id
    s.name = name
    s.brand_id = None
    s.description = None
    s.category = None
    s.price_cny = None
    s.cover_asset_id = None
    s.tags = []
    s.status = 1
    s.notes = None
    s.created_at = datetime.now(UTC)
    s.updated_at = datetime.now(UTC)
    return s


def _project_mock(id: int = 1, name: str = "Test Project") -> MagicMock:
    p = MagicMock()
    p.id = id
    p.name = name
    p.description = None
    p.status = 0
    p.cover_asset_id = None
    p.sku_id = None
    p.brand_id = None
    p.deadline = None
    p.notes = None
    p.created_at = datetime.now(UTC)
    p.updated_at = datetime.now(UTC)
    return p


# ── Brand ──────────────────────────────────────────────────────────────────

class TestBrand:
    async def test_list_brands_200(self, client: AsyncClient):
        with patch("app.modules.brand.service.list_brands", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/api/brands")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_brand_missing_name_422(self, client: AsyncClient):
        resp = await client.post("/api/brands", json={})
        assert resp.status_code == 422

    async def test_get_brand_not_found_404(self, client: AsyncClient):
        with patch("app.modules.brand.service.get_brand", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/brands/999")
        assert resp.status_code == 404

    async def test_get_brand_found_200(self, client: AsyncClient):
        mock = _brand_mock(id=1, name="Lancome")
        with patch("app.modules.brand.service.get_brand", new_callable=AsyncMock, return_value=mock):
            resp = await client.get("/api/brands/1")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Lancome"

    async def test_update_brand_not_found_404(self, client: AsyncClient):
        with patch("app.modules.brand.service.update_brand", new_callable=AsyncMock, return_value=None):
            resp = await client.patch("/api/brands/999", json={"name": "New Name"})
        assert resp.status_code == 404

    async def test_update_brand_200(self, client: AsyncClient):
        mock = _brand_mock(id=1, name="Updated Brand")
        with patch("app.modules.brand.service.update_brand", new_callable=AsyncMock, return_value=mock):
            resp = await client.patch("/api/brands/1", json={"name": "Updated Brand"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Brand"

    async def test_delete_brand_not_found_404(self, client: AsyncClient):
        with patch("app.modules.brand.service.delete_brand", new_callable=AsyncMock, return_value=False):
            resp = await client.delete("/api/brands/999")
        assert resp.status_code == 404

    async def test_delete_brand_204(self, client: AsyncClient):
        with patch("app.modules.brand.service.delete_brand", new_callable=AsyncMock, return_value=True):
            resp = await client.delete("/api/brands/1")
        assert resp.status_code == 204


# ── SKU ────────────────────────────────────────────────────────────────────

class TestSku:
    async def test_list_skus_200(self, client: AsyncClient):
        with patch("app.modules.sku.service.list_skus", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/api/skus")
        assert resp.status_code == 200

    async def test_list_skus_with_brand_filter(self, client: AsyncClient):
        with patch("app.modules.sku.service.list_skus", new_callable=AsyncMock, return_value=[]) as mock_svc:
            resp = await client.get("/api/skus?brand_id=5")
        assert resp.status_code == 200
        call_kwargs = mock_svc.call_args[1]
        assert call_kwargs.get("brand_id") == 5

    async def test_create_sku_missing_name_422(self, client: AsyncClient):
        resp = await client.post("/api/skus", json={})
        assert resp.status_code == 422

    async def test_get_sku_not_found_404(self, client: AsyncClient):
        with patch("app.modules.sku.service.get_sku", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/skus/999")
        assert resp.status_code == 404

    async def test_get_sku_found_200(self, client: AsyncClient):
        mock = _sku_mock(id=2, name="Premium Serum")
        with patch("app.modules.sku.service.get_sku", new_callable=AsyncMock, return_value=mock):
            resp = await client.get("/api/skus/2")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Premium Serum"

    async def test_delete_sku_204(self, client: AsyncClient):
        with patch("app.modules.sku.service.delete_sku", new_callable=AsyncMock, return_value=True):
            resp = await client.delete("/api/skus/1")
        assert resp.status_code == 204

    async def test_delete_sku_not_found(self, client: AsyncClient):
        with patch("app.modules.sku.service.delete_sku", new_callable=AsyncMock, return_value=False):
            resp = await client.delete("/api/skus/999")
        assert resp.status_code == 404


# ── Project ────────────────────────────────────────────────────────────────

class TestProject:
    async def test_list_projects_200(self, client: AsyncClient):
        with patch("app.modules.project.service.list_projects", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/api/projects")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_project_missing_name_422(self, client: AsyncClient):
        resp = await client.post("/api/projects", json={})
        assert resp.status_code == 422

    async def test_get_project_not_found_404(self, client: AsyncClient):
        with patch("app.modules.project.service.get_project", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/projects/99")
        assert resp.status_code == 404

    async def test_get_project_found_200(self, client: AsyncClient):
        mock = _project_mock(id=3, name="Q2 Campaign")
        with patch("app.modules.project.service.get_project", new_callable=AsyncMock, return_value=mock):
            resp = await client.get("/api/projects/3")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Q2 Campaign"

    async def test_delete_project_204(self, client: AsyncClient):
        with patch("app.modules.project.service.delete_project", new_callable=AsyncMock, return_value=True):
            resp = await client.delete("/api/projects/1")
        assert resp.status_code == 204

    async def test_list_projects_status_filter(self, client: AsyncClient):
        with patch("app.modules.project.service.list_projects", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/api/projects?status=1")
        assert resp.status_code == 200


# ── Schema validation ──────────────────────────────────────────────────────

class TestSchemas:
    def test_brand_create_name_required(self):
        from app.modules.brand.schemas import BrandCreate
        with pytest.raises(ValidationError):
            BrandCreate()

    def test_brand_create_defaults(self):
        from app.modules.brand.schemas import BrandCreate
        b = BrandCreate(name="Nike")
        assert b.name == "Nike"
        assert b.description is None
        assert b.website is None

    def test_sku_create_with_tags(self):
        from app.modules.sku.schemas import SkuCreate
        s = SkuCreate(name="Test Prod", tags=["beauty", "skincare"])
        assert s.tags == ["beauty", "skincare"]

    def test_project_create_defaults(self):
        from app.modules.project.schemas import ProjectCreate
        p = ProjectCreate(name="New Project")
        assert p.name == "New Project"
        assert p.status == 0

    def test_project_status_values(self):
        from app.modules.project.schemas import ProjectCreate
        for s in [0, 1, 2, 3]:
            p = ProjectCreate(name="X", status=s)
            assert p.status == s
