import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logger import logger

# In-memory sliding window per-path rate limiter (single-process; good enough for personal use)
_windows: dict[str, list[float]] = defaultdict(list)

# Route prefixes that are rate-limited and their (max_calls, window_seconds) config
_LIMITS: dict[str, tuple[int, int]] = {
    "/api/ai/": (30, 60),        # 30 AI calls / minute
    "/api/analyzer/": (10, 60),  # 10 analyzer calls / minute
    "/api/pipeline/": (5, 60),   # 5 pipeline runs / minute
    "/api/video/tts": (20, 60),  # 20 TTS / minute
    "/api/video/generate": (10, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if settings.environment == "test":
            return await call_next(request)

        path = request.url.path

        for prefix, (max_calls, window) in _LIMITS.items():
            if not path.startswith(prefix):
                continue

            key = f"{prefix}"
            now = time.monotonic()
            cutoff = now - window
            hits = _windows[key]

            # Evict old hits
            _windows[key] = [t for t in hits if t > cutoff]
            count = len(_windows[key])

            if count >= max_calls:
                logger.warning("rate limit hit path={} count={}", path, count)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded. Max {max_calls} requests per {window}s."
                    },
                    headers={"Retry-After": str(window)},
                )

            _windows[key].append(now)
            break

        return await call_next(request)
