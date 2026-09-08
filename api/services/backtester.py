from __future__ import annotations

import logging
import math
from datetime import datetime

from models.strategy import BacktestResult, StrategyMetrics, StrategyType
from services.binance_client import binance
from services.config import get_settings

logger = logging.getLogger(__name__)


def _safe_float(value: float | int | str | None, default: float = 0.0) -> float:
    """Coerce any value to a finite float, returning default for NaN/inf/None."""
    if value is None:
        return default
    try:
        result = float(value)
        if not math.isfinite(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _safe_ratio(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Divide two floats safely, returning default for division by zero or NaN."""
    num = _safe_float(numerator)
    den = _safe_float(denominator)
    if den == 0.0:
        return default
    result = num / den
    return _safe_float(result, default)

STRATEGY_DESCRIPTIONS: dict[StrategyType, dict] = {
    "momentum": {
        "name": "Momentum Rider",
        "description": "Rides strong price trends using moving average crossovers. Enters when short-term momentum outpaces the longer-term trend, exits on momentum fade.",
    },
    "mean_reversion": {
        "name": "Mean Reversion",
        "description": "Buys oversold conditions detected by RSI and sells into overbought strength as price reverts to the moving average.",
    },
    "sentiment_flow": {
        "name": "Sentiment Flow",
        "description": "Combines trend structure with RSI positioning to identify mean-reversion opportunities in trending markets.",
    },
}


def _parse_candle(c: dict) -> dict | None:
    for key in ("date", "open", "high", "low", "close"):
        if key not in c:
            return None
    try:
        o = _safe_float(c["open"])
        h = _safe_float(c["high"])
        low = _safe_float(c["low"])
        cl = _safe_float(c["close"])
        if o <= 0 or h <= 0 or low <= 0 or cl <= 0:
            return None
        return {
            "date": str(c["date"]),
            "open": o,
            "high": h,
            "low": low,
            "close": cl,
        }
    except (TypeError, ValueError):
        return None


def _sma(closes: list[float], period: int, idx: int) -> float | None:
    if idx + 1 < period:
        return None
    window = closes[idx + 1 - period : idx + 1]
    return sum(window) / period


async def run_backtest(strategy: StrategyType, token: str, period: str = "90d") -> BacktestResult:
    settings = get_settings()

    days = int(period.replace("d", "")) if period.endswith("d") else int(period)
    limit = max(days, 60)

    try:
        raw_klines = await binance.get_klines(f"{token}", interval="1d", limit=limit)
    except Exception as exc:
        logger.warning("Backtest klines fetch failed for %s: %s", token, exc)
        return BacktestResult(
            strategy=strategy,
            token=token.upper(),
            period=period,
            available=False,
            error="Unable to fetch historical klines",
            config={"fee_bps": settings.backtest_fee_bps, "slippage_bps": settings.backtest_slippage_bps},
            disclaimer="Experimental - not financial advice",
        )

    candles = [c for c in (_parse_candle(x) for x in raw_klines) if c]
    if len(candles) < settings.backtest_min_candles:
        return BacktestResult(
            strategy=strategy,
            token=token.upper(),
            period=period,
            available=False,
            error=f"Insufficient data: {len(candles)} candles, need {settings.backtest_min_candles}",
            actual_period=f"{len(candles)}d",
            config={"fee_bps": settings.backtest_fee_bps, "slippage_bps": settings.backtest_slippage_bps},
            disclaimer="Experimental - not financial advice",
        )

    fee_multiplier = 1.0 - (settings.backtest_fee_bps + settings.backtest_slippage_bps) / 10000.0

    try:
        result = _run_backtest_loop(
            strategy=strategy,
            token=token,
            period=period,
            candles=candles,
            fee_multiplier=fee_multiplier,
            settings=settings,
        )
        return result
    except Exception as exc:
        logger.warning("Backtest computation failed for %s/%s: %s", strategy, token, exc, exc_info=True)
        return BacktestResult(
            strategy=strategy,
            token=token.upper(),
            period=period,
            available=False,
            error=f"Backtest computation failed: {exc}",
            actual_period=f"{len(candles)}d",
            config={"fee_bps": settings.backtest_fee_bps, "slippage_bps": settings.backtest_slippage_bps},
            disclaimer="Experimental - not financial advice",
        )


def _run_backtest_loop(strategy, token, period, candles, fee_multiplier, settings) -> BacktestResult:
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

    for i in range(1, len(candles)):
        signal_candle = candles[i - 1]
        exec_candle = candles[i]
        signal_close = closes[i - 1]
        prev_signal_close = closes[i - 2] if i >= 2 else signal_close

        short_sma = _sma(closes, 7, i - 1)
        long_sma = _sma(closes, 25, i - 1)
        rsi = _rsi(closes, 14, i - 1)

        signal = _strategy_signal(strategy, short_sma, long_sma, rsi, signal_close, prev_signal_close)

        # Signals are generated on candle t, positions are opened at candle t+1's open.
        if signal == "buy" and position <= 0 and i - 1 >= 25:
            exec_price = exec_candle["open"] * fee_multiplier
            if exec_price > 0:
                position = capital / exec_price
                entry_price = exec_price
                entry_date = signal_candle["date"]
        elif signal == "sell" and position > 0:
            exec_price = exec_candle["open"] * fee_multiplier
            proceeds = position * exec_price if exec_price > 0 else 0.0
            pnl = _safe_ratio(proceeds - capital, capital) * 100
            total_trades += 1
            if pnl > 0:
                win_trades += 1
            pnl_values.append(pnl)
            trades.append(
                {
                    "id": total_trades,
                    "token": token.upper(),
                    "entry_date": entry_date,
                    "exit_date": exec_candle["date"],
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exec_price, 2),
                    "pnl_pct": round(pnl, 2),
                    "position_size": round(position, 4),
                }
            )
            capital = proceeds
            position = 0.0

        equity_value = exec_candle["close"] * position if position > 0 else capital
        equity_curve.append(equity_value)
        max_equity = max(max_equity, equity_value)
        if max_equity > 0:
            drawdown = (max_equity - equity_value) / max_equity
            max_drawdown = max(max_drawdown, drawdown)

        equity.append({"date": exec_candle["date"], "value": round(equity_curve[-1], 2)})

    if position > 0:
        close = closes[-1]
        exec_price = close * fee_multiplier
        proceeds = position * exec_price if exec_price > 0 else 0.0
        pnl = _safe_ratio(proceeds - capital, capital) * 100
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
                "exit_price": round(exec_price, 2),
                "pnl_pct": round(pnl, 2),
                "position_size": round(position, 4),
            }
        )
        capital = proceeds

    total_return = _safe_ratio(capital - 10000.0, 10000.0) * 100.0
    sharpe = _sharpe(equity_curve)
    win_rate = (win_trades / total_trades * 100.0) if total_trades else 0.0

    return BacktestResult(
        strategy=strategy,
        token=token.upper(),
        period=period,
        available=True,
        actual_period=f"{len(candles)}d",
        config={"fee_bps": settings.backtest_fee_bps, "slippage_bps": settings.backtest_slippage_bps},
        disclaimer="Experimental - not financial advice",
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
        _safe_ratio(equity_curve[i] - equity_curve[i - 1], equity_curve[i - 1])
        for i in range(1, len(equity_curve))
        if _safe_float(equity_curve[i - 1]) != 0
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
