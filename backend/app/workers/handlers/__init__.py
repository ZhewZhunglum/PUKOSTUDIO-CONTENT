"""Auto-import all handlers so @register_handler decorators fire on worker startup."""
from app.workers.handlers import ai_collect, ai_tag, embed, import_url, pipeline, render, video_gen  # noqa: F401
