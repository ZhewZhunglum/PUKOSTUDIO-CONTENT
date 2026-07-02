import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

from app.core.auth import verify_token
from app.core.config import settings
from app.core.database import engine
from app.core.logger import setup_logger
from app.core.rate_limit import RateLimitMiddleware
from app.core.storage import storage
from app.modules.auth.admin import ensure_configured_admin


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    setup_logger()
    logger.info(f"ContentForge starting — env={settings.environment}")
    try:
        await ensure_configured_admin()
    except Exception as e:
        logger.warning(f"Configured admin bootstrap skipped: {e}")
    yield
    await engine.dispose()
    logger.info("ContentForge shutdown complete")


app = FastAPI(
    title="ContentForge API",
    description="Personal AI content production system",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Any:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{elapsed}ms"
    logger.debug(f"{request.method} {request.url.path} → {response.status_code} ({elapsed}ms)")
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


@app.get("/healthz", tags=["system"])
async def health_check() -> dict[str, str]:
    status: dict[str, str] = {"status": "ok"}

    # Database
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        status["db"] = "error"
        status["status"] = "degraded"

    # Redis
    try:
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        status["redis"] = "ok"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        status["redis"] = "error"
        status["status"] = "degraded"

    # Storage
    try:
        ok = await storage.check_health()
        status["storage"] = "ok" if ok else "error"
        if not ok:
            status["status"] = "degraded"
    except Exception as e:
        logger.error(f"Storage health check failed: {e}")
        status["storage"] = "error"
        status["status"] = "degraded"

    return status


from app.modules.auth.router import router as auth_router
from app.modules.ai.router import router as ai_router
from app.modules.analyzer.router import router as analyzer_router
from app.modules.asset.router import router as asset_router
from app.modules.asset.search_router import router as search_router
from app.modules.brand.router import router as brand_router
from app.modules.collection.router import router as collection_router
from app.modules.pipeline.router import router as pipeline_router
from app.modules.production.router import router as production_router
from app.modules.project.router import router as project_router
from app.modules.relation.router import router as relation_router
from app.modules.sku.router import router as sku_router
from app.modules.stats.router import router as stats_router
from app.modules.tag.router import router as tag_router
from app.modules.template.router import router as template_router
from app.modules.video.router import router as video_router

# Auth router — public (no JWT required so the login endpoint is reachable)
app.include_router(auth_router)

# All other business routers — JWT required
_jwt = [Depends(verify_token)]
app.include_router(ai_router, dependencies=_jwt)
app.include_router(analyzer_router, prefix="/api", dependencies=_jwt)
app.include_router(asset_router, prefix="/api", dependencies=_jwt)
app.include_router(search_router, prefix="/api", dependencies=_jwt)
app.include_router(brand_router, prefix="/api", dependencies=_jwt)
app.include_router(tag_router, prefix="/api", dependencies=_jwt)
app.include_router(collection_router, prefix="/api", dependencies=_jwt)
app.include_router(pipeline_router, prefix="/api", dependencies=_jwt)
app.include_router(production_router, prefix="/api", dependencies=_jwt)
app.include_router(project_router, prefix="/api", dependencies=_jwt)
app.include_router(relation_router, prefix="/api", dependencies=_jwt)
app.include_router(sku_router, prefix="/api", dependencies=_jwt)
app.include_router(stats_router, prefix="/api", dependencies=_jwt)
app.include_router(template_router, prefix="/api", dependencies=_jwt)
app.include_router(video_router, prefix="/api", dependencies=_jwt)


from app.modules.settings.router import router as settings_router
app.include_router(settings_router, dependencies=_jwt)

@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    return {"service": "ContentForge API", "version": "0.1.0"}
