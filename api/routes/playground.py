from __future__ import annotations

from fastapi import APIRouter

from services.usage import usage

router = APIRouter(tags=["playground"])

ENDPOINTS = [
    {
        "method": "GET",
        "path": "/api/v1/signal/{token}",
        "description": "Live composite signal for a token (Binance real data)",
    },
    {"method": "GET", "path": "/api/v1/signals", "description": "Live signals for multiple tokens (comma-separated)"},
    {
        "method": "GET",
        "path": "/api/v1/signal/{token}/history",
        "description": "Historical close/high/low/volume from Binance klines",
    },
    {"method": "GET", "path": "/api/v1/overview", "description": "Market overview cards for major tokens"},
    {"method": "GET", "path": "/api/v1/strategies", "description": "List all strategies and their real signal weights"},
    {
        "method": "GET",
        "path": "/api/v1/strategy/{id}/backtest",
        "description": "Backtest a strategy on real Binance klines",
    },
    {"method": "GET", "path": "/api/v1/alerts", "description": "List alerts"},
    {"method": "POST", "path": "/api/v1/alerts", "description": "Create an alert"},
    {"method": "DELETE", "path": "/api/v1/alerts/{id}", "description": "Delete an alert"},
    {
        "method": "POST",
        "path": "/api/v1/alerts/evaluate",
        "description": "Evaluate active alerts vs live signal, fire webhooks",
    },
]


@router.get("/playground/endpoints")
async def list_endpoints():
    return {"endpoints": ENDPOINTS}


@router.get("/playground/usage")
async def usage_stats():
    return usage.summary()
