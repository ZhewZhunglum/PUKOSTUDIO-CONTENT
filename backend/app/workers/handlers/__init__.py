"""Auto-import all handlers so @register_handler decorators fire on worker startup."""
from app.workers.handlers import (  # noqa: F401
    ai_collect,
    ai_tag,
    embed,
    import_url,
    pipeline,
    render,
    thumbnail,
    video_gen,
)
