from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from routes import alerts, playground, signals, strategies
from services.binance_client import binance
from services.config import Settings, get_settings
from services.usage import usage


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await binance.configure()
        try:
            yield
        finally:
            await binance.aclose()

    app = FastAPI(
        title="SignalForge",
        description="Multi-signal crypto trading intelligence computed from live Binance market data",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.settings = settings

    origins = settings.cors_origins
    if origins == ["*"]:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def track_usage(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = (time.perf_counter() - start) * 1000
        if request.url.path.startswith("/api/"):
            usage.record(request.url.path, latency_ms)
        return response

    app.include_router(signals.router, prefix="/api/v1")
    app.include_router(playground.router, prefix="/api/v1")
    if settings.enable_backtests:
        app.include_router(strategies.router, prefix="/api/v1")
    if settings.enable_alerts:
        app.include_router(alerts.router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "signalforge"}

    return app


app = create_app()
