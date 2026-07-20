from unittest.mock import patch


def test_parse_json_extracts_fenced_code_block():
    from app.modules.analyzer.router import _parse_json

    raw = '```json\n{"hook": "value"}\n```'
    assert _parse_json(raw) == {"hook": "value"}


def test_parse_json_logs_and_returns_empty_on_malformed_input():
    from app.modules.analyzer.router import _parse_json

    with patch("app.modules.analyzer.router.logger") as mock_logger:
        result = _parse_json("not json at all")

    assert result == {}
    mock_logger.warning.assert_called_once()
