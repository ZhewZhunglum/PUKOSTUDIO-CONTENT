from pathlib import Path
from typing import Any

import frontmatter
from jinja2 import Environment, StrictUndefined

_PROMPTS_DIR = Path("/prompts")
_FALLBACK_DIR = Path(__file__).parent.parent.parent.parent.parent / "prompts"

_jinja = Environment(undefined=StrictUndefined, autoescape=False)  # noqa: S701 — prompts are text templates, not HTML


class PromptManager:
    def __init__(self) -> None:
        self._cache: dict[str, frontmatter.Post] = {}

    def _resolve_dir(self) -> Path:
        if _PROMPTS_DIR.exists():
            return _PROMPTS_DIR
        return _FALLBACK_DIR

    def load(self, name: str) -> frontmatter.Post:
        if name in self._cache:
            return self._cache[name]

        base = self._resolve_dir()
        # name like "tagging/image_describe_v1"
        path = base / f"{name}.md"
        if not path.exists():
            raise FileNotFoundError(f"Prompt not found: {path}")

        post = frontmatter.load(str(path))
        self._cache[name] = post
        return post

    def render(self, name: str, variables: dict[str, Any] | None = None) -> str:
        post = self.load(name)
        template = _jinja.from_string(post.content)
        return template.render(**(variables or {}))

    def metadata(self, name: str) -> dict[str, Any]:
        post = self.load(name)
        return dict(post.metadata)

    def invalidate(self, name: str | None = None) -> None:
        if name:
            self._cache.pop(name, None)
        else:
            self._cache.clear()


prompt_manager = PromptManager()
