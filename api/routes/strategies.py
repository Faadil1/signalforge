from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from models.strategy import StrategyType
from services.backtester import STRATEGY_DESCRIPTIONS, run_backtest
from services.errors import INSUFFICIENT_DATA, INVALID_PERIOD, INVALID_TOKEN, error_token_payload
from services.rate_limit import rate_limit
from services.symbols import is_valid_token, normalize_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["strategies"])

PERIOD_PATTERN = re.compile(r"^\d{1,3}d$")
MIN_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365


async def _backtest_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="backtest")


def _parse_period(period: str) -> int:
    if not PERIOD_PATTERN.match(period):
        error = error_token_payload("", INVALID_PERIOD, "Period must match ^\\d{1,3}d$ (e.g. 30d, 90d)")
        raise HTTPException(status_code=422, detail=error)
    days = int(period[:-1])
    if not (MIN_PERIOD_DAYS <= days <= MAX_PERIOD_DAYS):
        error = error_token_payload(
            "", INVALID_PERIOD, f"Period must be between {MIN_PERIOD_DAYS}d and {MAX_PERIOD_DAYS}d"
        )
        raise HTTPException(status_code=422, detail=error)
    return days


@router.get("/strategies")
async def list_strategies():
    return {
        "strategies": [
            {"id": sid, "name": meta["name"], "description": meta["description"]}
            for sid, meta in STRATEGY_DESCRIPTIONS.items()
        ]
    }


@router.get("/strategy/{strategy_id}/backtest", dependencies=[Depends(_backtest_rate_limited)])
async def backtest(
    strategy_id: StrategyType,
    token: str = Query(default="BTC"),
    period: str = Query(default="90d"),
):
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)
    _parse_period(period)

    result = await run_backtest(strategy_id, symbol, period)

    if not result.available:
        error = error_token_payload(symbol, INSUFFICIENT_DATA, result.error or "Backtest data unavailable")
        raise HTTPException(status_code=502, detail=error)

    return {
        "ok": True,
        "strategy": result.strategy,
        "token": result.token,
        "period": result.period,
        "actual_period": result.actual_period,
        "config": result.config,
        "disclaimer": result.disclaimer,
        "experimental": True,
        "metrics": {
            "total_return": result.metrics.total_return,
            "sharpe_ratio": result.metrics.sharpe_ratio,
            "max_drawdown": result.metrics.max_drawdown,
            "win_rate": result.metrics.win_rate,
            "total_trades": result.metrics.total_trades,
            "avg_trade_duration": result.metrics.avg_trade_duration,
        },
        "equity_curve": result.equity_curve,
        "trades": result.trades,
    }
