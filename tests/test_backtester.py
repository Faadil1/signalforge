from __future__ import annotations

import asyncio
from typing import get_args

from models.strategy import StrategyType
from services.backtester import STRATEGY_DESCRIPTIONS, run_backtest
from services.binance_client import binance


def _candles(n: int, base: float = 100.0, step: float = 1.0) -> list[dict]:
    return [
        {
            "date": f"2024-01-{i + 1:02d}",
            "open": base + i * step - 0.5,
            "high": base + i * step + 0.5,
            "low": base + i * step - 0.9,
            "close": base + i * step,
            "volume": 1000.0,
        }
        for i in range(n)
    ]


async def _klines_ok(n: int, base: float = 100.0, step: float = 1.0, token="", interval="1d", limit=200) -> list[dict]:
    return _candles(n, base=base, step=step)


def test_strategy_descriptions_match_types_and_omit_weights() -> None:
    assert set(STRATEGY_DESCRIPTIONS) == set(get_args(StrategyType))
    assert all("signal_weights" not in meta for meta in STRATEGY_DESCRIPTIONS.values())


def test_backtest_executes_at_next_open_with_fees(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(40))
    result = asyncio.run(run_backtest("momentum", "BTC", "90d"))
    assert result.available is True
    assert result.actual_period == "40d"
    assert result.config == {"fee_bps": 10, "slippage_bps": 5}

    fee_multiplier = 1.0 - (10 + 5) / 10000.0  # 0.9985

    # Monotonic-uptrend data produces exactly one position: entered at the next
    # candle's open (candle 26) after the momentum signal on candle 25, then
    # liquidated at the final close.
    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade["entry_date"] == "2024-01-26"
    assert trade["entry_price"] == round((100 + 26 - 0.5) * fee_multiplier, 2)  # open[26] * multiplier
    assert trade["exit_date"] == "2024-01-40"
    assert trade["exit_price"] == round((100 + 39) * fee_multiplier, 2)  # close[39] * multiplier
    assert trade["pnl_pct"] > 0


def test_backtest_insufficient_data(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(20))
    result = asyncio.run(run_backtest("momentum", "BTC", "90d"))

    assert result.available is False
    assert "Insufficient" in result.error


def test_backtest_fetch_failure(monkeypatch) -> None:
    async def boom(token, interval="1d", limit=200):
        raise RuntimeError("binance down")

    monkeypatch.setattr(binance, "get_klines", boom)
    result = asyncio.run(run_backtest("momentum", "BTC", "90d"))

    assert result.available is False
    assert "Unable to fetch" in result.error


def test_backtest_is_deterministic(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(60, base=50.0, step=1.1))

    first = asyncio.run(run_backtest("mean_reversion", "ETH", "90d"))
    second = asyncio.run(run_backtest("mean_reversion", "ETH", "90d"))

    assert first.available == second.available
    assert first.equity_curve == second.equity_curve
    assert first.trades == second.trades


def test_backtest_sharpe_matches_equity_curve(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(60))
    result = asyncio.run(run_backtest("momentum", "SOL", "90d"))

    assert result.available is True
    assert result.metrics.total_trades == len(result.trades)
    assert isinstance(result.metrics.sharpe_ratio, float)
    assert "%" in result.metrics.max_drawdown
