from __future__ import annotations

import asyncio

from services.backtester import run_backtest
from services.binance_client import binance


def _candles(n: int, base: float = 100.0, step: float = 1.0) -> list[dict]:
    return [{"date": f"2024-01-{i + 1:02d}", "open": base + i * step - 0.5, "high": base + i * step + 0.5, "low": base + i * step - 0.9, "close": base + i * step, "volume": 1000.0} for i in range(n)]


async def _klines_ok(n: int, base: float = 100.0, step: float = 1.0, token="", interval="1d", limit=200):
    return _candles(n, base=base, step=step)


def test_backtest_executes_next_open_and_costs_worsen_price(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(40))
    result = asyncio.run(run_backtest("momentum", "BTC", "90d"))
    assert result.available is True
    cost_rate = (10 + 5) / 10000.0
    trade = result.trades[0]
    assert trade["entry_date"] == "2024-01-27"
    assert trade["entry_price"] == round((100 + 26 - 0.5) * (1 + cost_rate), 2)
    assert trade["exit_price"] == round((100 + 39) * (1 - cost_rate), 2)


def test_backtest_insufficient_data(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_klines", lambda token, interval="1d", limit=200: _klines_ok(20))
    assert asyncio.run(run_backtest("momentum", "BTC", "90d")).available is False


def test_backtest_fetch_failure(monkeypatch) -> None:
    async def boom(token, interval="1d", limit=200):
        raise RuntimeError("binance down")
    monkeypatch.setattr(binance, "get_klines", boom)
    result = asyncio.run(run_backtest("momentum", "BTC", "90d"))
    assert result.available is False
    assert "Unable to fetch" in result.error
