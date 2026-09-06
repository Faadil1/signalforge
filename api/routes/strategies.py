from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from models.strategy import StrategyType
from services.backtester import STRATEGY_DESCRIPTIONS, run_backtest

router = APIRouter(tags=["strategies"])


@router.get("/strategies")
async def list_strategies():
    return {
        "strategies": [
            {
                "id": sid,
                "name": meta["name"],
                "description": meta["description"],
                "signal_weights": meta["signal_weights"],
            }
            for sid, meta in STRATEGY_DESCRIPTIONS.items()
        ]
    }


@router.get("/strategy/{strategy_id}/backtest")
async def backtest(
    strategy_id: StrategyType,
    token: str = Query(default="BTC"),
    period: str = Query(default="90d"),
):
    try:
        result = await run_backtest(strategy_id, token, period)
    except Exception as e:
        raise HTTPException(status_code=502, detail={"error": "Backtest unavailable", "detail": str(e)}) from e

    return {
        "strategy": result.strategy,
        "token": result.token,
        "period": result.period,
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
