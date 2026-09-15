from __future__ import annotations

from fastapi import APIRouter, Request

from services.config import Settings, get_settings
from services.usage import usage

router = APIRouter(tags=["playground"])


def _build_endpoints(settings) -> list[dict]:
    endpoints = [
        {
            "method": "GET",
            "path": "/api/v1/signal/{token}",
            "description": "Live composite signal with explicit provenance and confidence gating",
        },
        {
            "method": "GET",
            "path": "/api/v1/decision/{token}",
            "description": "Evidence-bound Decision Packet for agent consumption",
        },
        {
            "method": "GET",
            "path": "/api/v1/decision/{token}/delta",
            "description": "Material-change delta vs the previous observed packet",
        },
        {
            "method": "GET",
            "path": "/api/v1/validation/{token}",
            "description": "Historical calibration of the price-derived signal subset",
        },
        {
            "method": "GET",
            "path": "/api/v1/evidence/negative-path",
            "description": "Real-failure-backed controlled refusal proof with explicit epistemic boundaries",
        },
        {
            "method": "GET",
            "path": "/api/v1/signals",
            "description": "Live signals for multiple tokens (comma-separated)",
        },
        {
            "method": "GET",
            "path": "/api/v1/signal/{token}/history",
            "description": "Historical close/high/low/volume from Binance klines",
        },
        {"method": "GET", "path": "/api/v1/overview", "description": "Market overview cards for major tokens"},
    ]
    if settings.enable_backtests:
        endpoints.append({"method": "GET", "path": "/api/v1/strategies", "description": "List all backtest strategies"})
        endpoints.append(
            {
                "method": "GET",
                "path": "/api/v1/strategy/{id}/backtest",
                "description": "Backtest a strategy on real Binance klines (experimental)",
            }
        )
    if settings.enable_alerts:
        endpoints.append({"method": "GET", "path": "/api/v1/alerts", "description": "List alerts"})
        endpoints.append({"method": "POST", "path": "/api/v1/alerts", "description": "Create a webhook alert"})
        endpoints.append({"method": "DELETE", "path": "/api/v1/alerts/{id}", "description": "Delete an alert"})
        endpoints.append(
            {
                "method": "POST",
                "path": "/api/v1/alerts/evaluate",
                "description": "Evaluate active alerts vs live signal, fire webhooks",
            }
        )
    return endpoints


def _settings_for(request: Request) -> Settings:
    state_settings = getattr(request.app.state, "settings", None)
    return state_settings if state_settings is not None else get_settings()


@router.get("/playground/endpoints")
async def list_endpoints(request: Request):
    return {"endpoints": _build_endpoints(_settings_for(request))}


@router.get("/playground/usage")
async def usage_stats():
    return usage.summary()
