from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import alerts, playground, signals, strategies, tickers
from services.binance_client import binance
from services.config import Settings, get_settings
from services.errors import INTERNAL_ERROR
from services.usage import usage

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="SignalForge",
        description="Multi-signal crypto trading intelligence computed from live Binance market data",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.settings = settings

    # --- CORS --------------------------------------------------------------
    # Dynamic origins from CORS_ORIGINS env var (comma-separated), or "*".
    # localhost:3000 is always accepted during local dev.
    origins = list(settings.cors_origins)
    allow_credentials = False
    if not origins or origins == ["*"]:
        allow_origins = ["*"]
    else:
        if "http://localhost:3000" not in origins:
            origins = origins + ["http://localhost:3000"]
        allow_origins = origins
        allow_credentials = True
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Global exception handling (never return an HTML 500) --------------
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {
                    "code": INTERNAL_ERROR,
                    "message": "Internal server error",
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "detail": exc.errors(),
                },
            },
        )

    @app.middleware("http")
    async def track_usage(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            raise
        latency_ms = (time.perf_counter() - start) * 1000
        if request.url.path.startswith("/api/"):
            usage.record(request.url.path, latency_ms)
        return response

    app.include_router(signals.router, prefix="/api/v1")
    app.include_router(tickers.router, prefix="/api/v1")
    app.include_router(playground.router, prefix="/api/v1")
    if settings.enable_backtests:
        app.include_router(strategies.router, prefix="/api/v1")
    if settings.enable_alerts:
        app.include_router(alerts.router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "signalforge"}

    return app


@asynccontextmanager
async def lifespan(app: FastAPI):
    await binance.configure()
    try:
        yield
    finally:
        await binance.aclose()


app = create_app()

