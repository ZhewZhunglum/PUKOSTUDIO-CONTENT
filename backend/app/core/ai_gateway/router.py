from pathlib import Path
from typing import Any

import yaml
from loguru import logger

_CONFIG_PATH = Path("/config/ai_models.yaml")
_FALLBACK_CONFIG = Path(__file__).parent.parent.parent.parent.parent / "config" / "ai_models.yaml"


def _load_config() -> dict[str, Any]:
    path = _CONFIG_PATH if _CONFIG_PATH.exists() else _FALLBACK_CONFIG
    with open(path) as f:
        return yaml.safe_load(f)


class ModelRouter:
    """Selects (provider, model) for a given capability + quality_level."""

    def __init__(self) -> None:
        self._config: dict[str, Any] = {}

    def _ensure_loaded(self) -> None:
        if not self._config:
            self._config = _load_config()

    def resolve(
        self,
        capability: str,
        quality_level: str = "default",
        preferred_model: str | None = None,
    ) -> tuple[str, str]:
        self._ensure_loaded()
        cap_cfg = self._config.get(capability, {})
        if not cap_cfg:
            raise ValueError(f"No configuration for capability: {capability}")

        entry = cap_cfg.get(quality_level) or cap_cfg.get("default")
        if not entry:
            raise ValueError(f"No model config for {capability}/{quality_level}")

        provider: str = entry["provider"]
        model: str = preferred_model or entry["model"]
        logger.debug(f"Router: {capability}/{quality_level} → {provider}/{model}")
        return provider, model


model_router = ModelRouter()
