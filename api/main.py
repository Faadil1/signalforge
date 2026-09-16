from __future__ import annotations

import logging
import re
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import alerts, capabilities, decision, evidence, mcp, playground, signals, strategies, tickers, validation
from services.binance_client import binance
from services.config import Settings, get_settings
from services.decision_service import DECISION_CONTRACT_VERSION, POLICY_VERSION
from services.errors import INTERNAL_ERROR
from services.usage import usage

logger = logging.getLogger(__name__)
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="SignalForge",
        description="Pre-action evidence gate for market agents using freshness-gated, multi-provider public market evidence.",
        version="0.6.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
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

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": {"code": INTERNAL_ERROR, "message": "Internal server error"}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": {"code": "VALIDATION_ERROR", "message": "Request validation failed", "detail": exc.errors()},
            },
        )

    @app.middleware("http")
    async def track_usage(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = (time.perf_counter() - start) * 1000
        if request.url.path.startswith("/api/") or request.url.path == "/mcp":
            usage.record(request.url.path, latency_ms)
        return response

    app.include_router(signals.router, prefix="/api/v1")
    app.include_router(tickers.router, prefix="/api/v1")
    app.include_router(playground.router, prefix="/api/v1")
    app.include_router(decision.router, prefix="/api/v1")
    app.include_router(validation.router, prefix="/api/v1")
    app.include_router(evidence.router, prefix="/api/v1")
    app.include_router(capabilities.router, prefix="/api/v1")
    app.include_router(mcp.router)
    if settings.enable_backtests:
        app.include_router(strategies.router, prefix="/api/v1")
    if settings.enable_alerts:
        app.include_router(alerts.router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        commit_valid = bool(COMMIT_RE.match(settings.git_commit))
        return {
            "status": "ok" if commit_valid else "degraded",
            "service": "signalforge",
            "commit": settings.git_commit,
            "project_slug": settings.project_slug,
            "mock_fallback_enabled": settings.allow_mock_fallback,
            "evidence_policy": "freshness_gated",
            "decision_contract_version": DECISION_CONTRACT_VERSION,
            "policy_version": POLICY_VERSION,
            "capabilities": "/api/v1/capabilities",
            "mcp": "/mcp",
            "mcp_protocol_version": mcp.MCP_PROTOCOL_VERSION,
            "negative_path": "/api/v1/evidence/negative-path",
            "resilience_benchmark": "/api/v1/evidence/resilience-benchmark",
            "decision_stress": "/api/v1/decision/{token}/stress",
            "recovery_plan": "/api/v1/decision/{token}/recovery-plan",
            "receipt_verification": "/api/v1/decision/verify-receipt",
        }

    @app.get("/.well-known/xagent-verification.json")
    async def xagent_verification():
        return {"schemaVersion": 1, "slug": settings.project_slug, "commit": settings.git_commit}

    return app


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = app.state.settings
    await binance.configure(
        timeout_s=settings.binance_timeout_s,
        max_retries=settings.binance_max_retries,
        max_concurrency=settings.binance_max_concurrency,
        allow_mock_fallback=settings.allow_mock_fallback,
    )
    try:
        yield
    finally:
        await binance.aclose()


app = create_app()
