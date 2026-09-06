from __future__ import annotations

from datetime import datetime

from models.strategy import BacktestResult, StrategyMetrics, StrategyType
from services.binance_client import binance

STRATEGY_DESCRIPTIONS: dict[StrategyType, dict] = {
    "momentum": {
        "name": "Momentum Rider",
        "description": "Rides strong price trends (MA structure + volume confirmation). Enters when short-term momentum outpaces the longer-term trend, exits on momentum fade.",
        "signal_weights": {"technical": 0.35, "trend": 0.30, "volume": 0.15, "open_interest": 0.10, "funding": 0.10},
    },
    "mean_reversion": {
        "name": "Mean Reversion",
        "description": "Buys oversold conditions (low RSI, crowded shorts via funding) and sells into overbought strength as price reverts to the mean.",
        "signal_weights": {"technical": 0.30, "funding": 0.25, "open_interest": 0.20, "trend": 0.15, "volume": 0.10},
    },
    "sentiment_flow": {
        "name": "Sentiment Flow",
        "description": "Follows positioning flows (funding rate + open interest shifts) combined with broad trend to front-run crowding, fading extremes.",
        "signal_weights": {"funding": 0.30, "open_interest": 0.30, "trend": 0.20, "technical": 0.10, "volume": 0.10},
    },
}


def _parse_candle(c: dict) -> dict | None:
    """Binance client already returns parsed candles; validate required keys."""
    for key in ("date", "open", "high", "low", "close"):
        if key not in c:
            return None
    try:
        return {
            "date": str(c["date"]),
            "open": float(c["open"]),
            "high": float(c["high"]),
            "low": float(c["low"]),
            "close": float(c["close"]),
        }
    except (TypeError, ValueError):
        return None


def _sma(closes: list[float], period: int, idx: int) -> float | None:
    if idx + 1 < period:
        return None
    window = closes[idx + 1 - period : idx + 1]
    return sum(window) / period


async def run_backtest(strategy: StrategyType, token: str, period: str = "90d") -> BacktestResult:
    """Backtest a strategy on real OHLCV klines from Binance.

    Deterministic rules only — no random or fabricated values. If historical
    data is unavailable, returns an explicit unavailable result instead of
    inventing numbers.
    """
    days = int(period.replace("d", "")) if period.endswith("d") else int(period)
    limit = max(days, 60)

    raw_klines = await binance.get_klines(f"{token}", interval="1d", limit=limit)
    candles = [c for c in (_parse_candle(x) for x in raw_klines) if c]
    if len(candles) < 30:
        raise RuntimeError("Insufficient historical klines for backtest")

    closes = [c["close"] for c in candles]
    equity: list[dict] = []
    trades: list[dict] = []
    capital = 10000.0
    equity_curve = [capital]
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    total_trades = 0
    win_trades = 0
    pnl_values: list[float] = []
    max_equity = capital
    max_drawdown = 0.0

    last_close = closes[0]
    for i, c in enumerate(candles):
        close = c["close"]
        short_sma = _sma(closes, 7, i)
        long_sma = _sma(closes, 25, i)
        rsi = _rsi(closes, 14, i)

        signal = _strategy_signal(strategy, short_sma, long_sma, rsi, close, last_close)

        if signal == "buy" and position <= 0 and i >= 25:
            position = capital / close
            entry_price = close
            entry_date = c["date"]
        elif signal == "sell" and position > 0:
            proceeds = position * close
            pnl = (proceeds - capital) / capital * 100
            total_trades += 1
            if pnl > 0:
                win_trades += 1
            pnl_values.append(pnl)
            trades.append(
                {
                    "id": total_trades,
                    "token": token.upper(),
                    "entry_date": entry_date,
                    "exit_date": c["date"],
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(close, 2),
                    "pnl_pct": round(pnl, 2),
                    "position_size": round(position, 4),
                }
            )
            capital = proceeds
            position = 0.0

        equity_value = close * position if position > 0 else capital
        equity_curve.append(equity_value)
        max_equity = max(max_equity, equity_value)
        if max_equity > 0:
            drawdown = (max_equity - equity_value) / max_equity
            max_drawdown = max(max_drawdown, drawdown)
        last_close = close

        equity.append({"date": c["date"], "value": round(equity_curve[-1], 2)})

    # Liquidate any open position at last close
    if position > 0:
        close = closes[-1]
        proceeds = position * close
        pnl = (proceeds - capital) / capital * 100
        total_trades += 1
        if pnl > 0:
            win_trades += 1
        pnl_values.append(pnl)
        trades.append(
            {
                "id": total_trades,
                "token": token.upper(),
                "entry_date": entry_date,
                "exit_date": candles[-1]["date"],
                "entry_price": round(entry_price, 2),
                "exit_price": round(close, 2),
                "pnl_pct": round(pnl, 2),
                "position_size": round(position, 4),
            }
        )
        capital = proceeds

    total_return = (capital - 10000.0) / 10000.0 * 100.0
    sharpe = _sharpe(equity_curve)
    win_rate = (win_trades / total_trades * 100.0) if total_trades else 0.0

    return BacktestResult(
        strategy=strategy,
        token=token.upper(),
        period=period,
        metrics=StrategyMetrics(
            total_return=f"{total_return:+.1f}%",
            sharpe_ratio=round(sharpe, 2),
            max_drawdown=f"{max_drawdown * 100:.1f}%",
            win_rate=f"{win_rate:.0f}%",
            total_trades=total_trades,
            avg_trade_duration=_avg_duration(trades),
        ),
        equity_curve=equity,
        trades=trades,
    )


def _rsi(closes: list[float], period: int, idx: int) -> float | None:
    if idx < period:
        return None
    gains = 0.0
    losses = 0.0
    for i in range(idx - period + 1, idx + 1):
        diff = closes[i] - closes[i - 1]
        if diff > 0:
            gains += diff
        else:
            losses -= diff
    if gains + losses == 0:
        return 50.0
    if losses == 0:
        return 100.0
    if gains == 0:
        return 0.0
    rs = (gains / period) / (losses / period)
    return 100.0 - (100.0 / (1.0 + rs))


def _strategy_signal(
    strategy: StrategyType,
    short_sma: float | None,
    long_sma: float | None,
    rsi: float | None,
    close: float,
    prev_close: float,
) -> str:
    if short_sma is None or long_sma is None:
        return "hold"
    if strategy == "momentum":
        if short_sma > long_sma and close > prev_close:
            return "buy"
        if short_sma < long_sma:
            return "sell"
        return "hold"
    if strategy == "mean_reversion":
        if rsi is not None and rsi < 30:
            return "buy"
        if rsi is not None and rsi > 70:
            return "sell"
        return "hold"
    if strategy == "sentiment_flow":
        if short_sma > long_sma and rsi is not None and rsi < 60:
            return "buy"
        if short_sma < long_sma:
            return "sell"
        return "hold"
    return "hold"


def _sharpe(equity_curve: list[float]) -> float:
    if len(equity_curve) < 2:
        return 0.0
    returns = [
        (equity_curve[i] - equity_curve[i - 1]) / equity_curve[i - 1]
        for i in range(1, len(equity_curve))
        if equity_curve[i - 1] != 0
    ]
    if not returns:
        return 0.0
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / len(returns)
    std = var**0.5
    if std == 0:
        return 0.0
    return mean / std * (365**0.5)


def _avg_duration(trades: list[dict]) -> str:
    if not trades:
        return "0.0d"
    try:
        durations = []
        for t in trades:
            e = datetime.fromisoformat(t["entry_date"])
            x = datetime.fromisoformat(t["exit_date"])
            durations.append((x - e).total_seconds() / 86400)
        avg = sum(durations) / len(durations)
        return f"{avg:.1f}d"
    except (ValueError, TypeError, KeyError):
        return "n/a"
