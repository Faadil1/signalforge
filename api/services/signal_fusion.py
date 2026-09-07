from __future__ import annotations

import statistics
from collections.abc import Callable
from datetime import UTC, datetime

from models.signal import (
    SIGNAL_WEIGHTS,
    CompositeSignal,
    RawSignalBundle,
    Recommendation,
    SignalName,
    SubSignal,
)

STRONG_BUY_THRESHOLD = 75
BUY_THRESHOLD = 60
SELL_THRESHOLD = 40
STRONG_SELL_THRESHOLD = 25

NEUTRAL_VALUE = 50.0
NEUTRAL_CONFIDENCE = 0.2


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) <= period:
        return 50.0
    gains = 0.0
    losses = 0.0
    for i in range(len(closes) - period, len(closes)):
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


def _sma(closes: list[float], period: int) -> float | None:
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


def _score_technical(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    closes = [c["close"] for c in bundle.klines]
    if len(closes) < 20:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient klines for technical signals"

    rsi = _rsi(closes, 14)
    short = _sma(closes, 7)
    long_ma = _sma(closes, 25)

    rsi_score = 100.0 - rsi

    ma_score = NEUTRAL_VALUE
    if short is not None and long_ma is not None:
        ma_bullish = short > long_ma
        ma_score = 80.0 if ma_bullish else 20.0

    score = rsi_score * 0.4 + ma_score * 0.6
    confidence = 0.7
    detail = f"RSI={rsi:.1f}, MA7={short and f'{short:.1f}' or 'n/a'}"
    return _clamp(score), confidence, True, detail


def _score_trend(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    klines = bundle.klines
    ticker = bundle.ticker
    if len(klines) < 6 or not ticker:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient data for trend"

    closes = [c["close"] for c in klines]
    n = min(5, len(closes))
    change = (closes[-1] - closes[-n]) / closes[-n] * 100.0

    recent = klines[-6:]
    higher_highs = int(recent[-1]["high"] > max(c["high"] for c in recent[:5]))
    higher_lows = int(recent[-1]["low"] > min(c["low"] for c in recent[:5]))

    change_signal = (change + 5.0) / 10.0 * 100.0
    structure_signal = (
        70.0 if (higher_highs + higher_lows) == 2 else 30.0 if (higher_highs + higher_lows) == 0 else 50.0
    )

    score = change_signal * 0.7 + structure_signal * 0.3
    confidence = 0.6
    return _clamp(score), confidence, True, f"{change:+.2f}% over {n}d"


def _score_open_interest(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    oi = bundle.open_interest
    ticker = bundle.ticker
    oi_value = oi.get("open_interest")
    if oi_value is None or not ticker:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No open interest data"

    volume = ticker.get("volume")
    price = ticker.get("last_price") or oi.get("mark_price")
    if not volume or not price:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Missing volume/price for OI context"

    oi_usd = oi_value * price
    oi_to_volume_ratio = oi_usd / (volume * price) if volume * price else 0.0

    score = (oi_to_volume_ratio / 1.5) * 100.0
    confidence = 0.5
    return _clamp(score), confidence, True, f"OI={oi_value:.0f} ({oi_to_volume_ratio:.2f}x vol)"


def _score_funding(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    funding = bundle.funding
    if funding is None:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Funding rate data unavailable"
    rate = funding.get("last_funding_rate")
    if rate is None:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No funding rate data"

    normalized = (rate / 0.001) * 50.0
    score = 50.0 - normalized
    confidence = 0.55
    direction_detail = "crowded long" if rate > 0.0001 else "crowded short" if rate < -0.0001 else "neutral"
    return _clamp(score), confidence, True, f"Funding={rate:+.5f} ({direction_detail})"


def _score_volume(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    ticker = bundle.ticker
    klines = bundle.klines
    if not ticker or len(klines) < 2:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No volume data"

    closes = [c["close"] for c in klines]
    daily_volume_usd = klines[-1].get("volume", 0) * closes[-1]
    avg_volume_usd = sum(c["volume"] * c["close"] for c in klines[-10:]) / min(10, len(klines[-10:]))

    if avg_volume_usd <= 0:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Zero average volume"

    ratio = daily_volume_usd / avg_volume_usd
    price_change = (closes[-1] - closes[-2]) / closes[-2] if len(closes) >= 2 and closes[-2] else 0.0
    direction = 1.0 if price_change >= 0 else -1.0
    score = 50.0 + (ratio - 1.0) * 50.0 * direction
    confidence = 0.5
    return (
        _clamp(score),
        confidence,
        True,
        f"Vol x{ratio:.2f} vs 10d avg ({'up' if price_change >= 0 else 'down'} {abs(price_change) * 100:.1f}%)",
    )


SCORERS: dict[SignalName, Callable[[RawSignalBundle], tuple[float, float, bool, str]]] = {
    "technical": _score_technical,
    "trend": _score_trend,
    "open_interest": _score_open_interest,
    "funding": _score_funding,
    "volume": _score_volume,
}


def _recommendation(score: float) -> Recommendation:
    if score >= STRONG_BUY_THRESHOLD:
        return "strong_buy"
    if score >= BUY_THRESHOLD:
        return "buy"
    if score >= SELL_THRESHOLD:
        return "hold"
    if score >= STRONG_SELL_THRESHOLD:
        return "sell"
    return "strong_sell"


def compute_composite(bundle: RawSignalBundle) -> CompositeSignal:
    sub_signals: list[SubSignal] = []
    weighted_sum = 0.0
    total_weight = 0.0
    available_count = 0

    for name, scorer in SCORERS.items():
        value, confidence, available, reason = scorer(bundle)
        weight = SIGNAL_WEIGHTS[name]
        sub_signals.append(
            SubSignal(
                name=name,
                value=round(value, 2),
                confidence=round(confidence, 3),
                available=available,
                reason=reason,
                raw={},
            )
        )
        weighted_sum += value * weight
        total_weight += weight
        if available:
            available_count += 1

    score = weighted_sum / total_weight if total_weight > 0 else NEUTRAL_VALUE
    coverage = available_count / len(SCORERS) if SCORERS else 0.0
    confs = [s.confidence for s in sub_signals if s.available]
    avg_confidence = statistics.mean(confs) if confs else NEUTRAL_CONFIDENCE
    adjusted_confidence = avg_confidence * coverage

    ticker = bundle.ticker
    last_price = ticker.get("last_price", 0.0) if isinstance(ticker, dict) else 0.0

    return CompositeSignal(
        token=bundle.symbol.upper(),
        price=last_price,
        score=round(score, 2),
        confidence=round(adjusted_confidence, 3),
        sub_signals=sub_signals,
        recommendation=_recommendation(score),
        timestamp=datetime.now(UTC).isoformat(),
        available_signals=available_count,
        total_signals=len(SCORERS),
        coverage=round(coverage, 3),
    )


def payload_from_bundle(bundle: RawSignalBundle) -> dict:
    composite = compute_composite(bundle)
    return {
        "ok": True,
        "token": composite.token,
        "price": composite.price,
        "score": composite.score,
        "confidence": composite.confidence,
        "recommendation": composite.recommendation,
        "timestamp": composite.timestamp,
        "available_signals": composite.available_signals,
        "total_signals": composite.total_signals,
        "coverage": composite.coverage,
        "sub_signals": [
            {
                "name": s.name,
                "value": s.value,
                "confidence": s.confidence,
                "available": s.available,
                "reason": s.reason,
            }
            for s in composite.sub_signals
        ],
    }
