from unittest.mock import AsyncMock, patch

import pytest

from app.modules.asset.generated import GeneratedAssetInput, create_generated_asset


@pytest.mark.asyncio
async def test_generated_helper_creates_image_asset_with_processing_tasks():
    db = AsyncMock()
    asset = AsyncMock()
    asset.id = 42
    asset.asset_type = 1

    with patch(
        "app.modules.asset.generated.storage.upload_file",
        return_value="https://cdn.example/asset.png",
    ), patch(
        "app.modules.asset.generated.asset_service.create_asset",
        new_callable=AsyncMock,
        return_value=asset,
    ) as mock_create, patch(
        "app.modules.asset.generated.add_tags_to_asset",
        new_callable=AsyncMock,
    ), patch(
        "app.modules.asset.generated.enqueue_task",
        new_callable=AsyncMock,
    ) as mock_enqueue:
        result = await create_generated_asset(
            db,
            GeneratedAssetInput(
                name="AI Image",
                asset_type=1,
                capability="image_gen",
                source_model="gpt-image-1.5",
                source_prompt="a product photo",
                data=b"fake image",
                mime_type="image/png",
                file_format="png",
            ),
        )

    assert result.id == 42
    create_data = mock_create.call_args.args[1]
    assert create_data.asset_type == 1
    assert create_data.source_model == "gpt-image-1.5"
    assert "AI生成" in create_data.user_tags
    assert "模型:gpt-image-1.5" in create_data.user_tags
    assert mock_enqueue.await_count == 2


@pytest.mark.asyncio
async def test_generated_helper_creates_text_asset_and_text_embedding_task():
    db = AsyncMock()
    asset = AsyncMock()
    asset.id = 77

    with patch(
        "app.modules.asset.generated.storage.upload_file",
        return_value="https://cdn.example/script.json",
    ), patch(
        "app.modules.asset.generated.asset_service.create_asset",
        new_callable=AsyncMock,
        return_value=asset,
    ) as mock_create, patch(
        "app.modules.asset.generated.add_tags_to_asset",
        new_callable=AsyncMock,
    ), patch(
        "app.modules.asset.generated.enqueue_task",
        new_callable=AsyncMock,
    ) as mock_enqueue:
        await create_generated_asset(
            db,
            GeneratedAssetInput(
                name="AI Script",
                asset_type=5,
                capability="script_gen",
                source_model="claude-sonnet-4-7",
                data={"script": "hello"},
                mime_type="application/json",
                file_format="json",
            ),
        )

    create_data = mock_create.call_args.args[1]
    assert create_data.asset_type == 5
    mock_enqueue.assert_awaited_once()
    assert mock_enqueue.call_args.args[0] == "embed_text"
