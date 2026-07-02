from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.production.schemas import ProductionCreate


@pytest.mark.asyncio
async def test_create_production_rejects_missing_asset() -> None:
    from app.modules.production import service

    db = AsyncMock()
    with patch(
        "app.modules.production.service._get_valid_production_asset",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(service.ProductionAssetError):
            await service.create_production(db, ProductionCreate(asset_id=999, title="Launch"))

    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_production_accepts_video_asset() -> None:
    from app.modules.production import service

    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    with patch(
        "app.modules.production.service._get_valid_production_asset",
        new_callable=AsyncMock,
        return_value=MagicMock(),
    ):
        prod = await service.create_production(
            db,
            ProductionCreate(
                asset_id=10,
                title="Launch",
                platform="tiktok",
                published_at=datetime.now(UTC).replace(tzinfo=None),
            ),
        )

    assert prod.asset_id == 10
    assert prod.platform == "tiktok"
    db.add.assert_called_once()
    db.flush.assert_awaited_once()
