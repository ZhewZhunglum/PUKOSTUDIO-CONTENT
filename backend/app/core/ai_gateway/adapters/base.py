from abc import ABC, abstractmethod
from typing import Any


class AbstractAdapter(ABC):
    provider: str = ""

    @abstractmethod
    async def call(self, capability: str, inputs: dict[str, Any]) -> dict[str, Any]:
        """Execute the AI call and return raw outputs + usage metadata."""

    def supported_capabilities(self) -> list[str]:
        return []
