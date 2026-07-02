from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.auth.router import RegisterRequest, register


def _scalar_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_first_registered_user_becomes_admin():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(None),
            _scalar_result(None),
            MagicMock(),
        ]
    )

    resp = await register(RegisterRequest(username="sam", password="secret123"), db)

    assert resp.is_admin is True
    assert resp.access_token
    insert_params = db.execute.await_args_list[2].args[1]
    assert insert_params["is_admin"] is True
    db.commit.assert_awaited_once()
