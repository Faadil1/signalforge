from __future__ import annotations

import math
import statistics
from collections.abc import Callable
from datetime import UTC, datetime

from models.signal import SIGNAL_WEIGHTS, CompositeSignal, RawSignalBundle, Recommendation, SignalName, SubSignal

STRONG_BUY_THRESHOLD = 75
BUY_THRESHOLD = 60
SELL_THRESHOLD = 40
STRONG_SELL_THRESHOLD = 25
NEUTRAL_VALUE = 50.0
NEUTRAL_CONFIDENCE = 0.2
MIN_ACTIONABLE_COVERAGE = 0.60
MIN_ACTIONABLE_CONFIDENCE = 0.40


def _safe_float(value: float | int | str | None, default: float = NEUTRAL_VALUE) -> float:
    if value is None:
        return default
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, _safe_float(value, NEUTRAL_VALUE)))


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
    closes = [_safe_float(c.get("close")) for c in bundle.klines if c.get("close") is not None]
    if len(closes) < 20:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient klines for technical signals"
    rsi = _safe_float(_rsi(closes, 14), 50.0)
    short = _sma(closes, 7)
    long_ma = _sma(closes, 25)
    rsi_score = 100.0 - rsi
    ma_score = 50.0
    if short is not None and long_ma is not None:
        ma_score = 80.0 if short > long_ma else 20.0
    score = rsi_score * 0.4 + ma_score * 0.6
    return _clamp(score), 0.7, True, f"RSI={rsi:.1f}, MA7={short and f'{short:.1f}' or 'n/a'}"


def _score_trend(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    klines = bundle.klines
    ticker = bundle.ticker
    if len(klines) < 6 or not ticker:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient data for trend"
    closes = [_safe_float(c.get("close")) for c in klines if c.get("close") is not None]
    if len(closes) < 6:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient close data for trend"
    n = min(5, len(closes))
    denominator = closes[-n] if closes[-n] != 0 else 1.0
    change = (closes[-1] - closes[-n]) / denominator * 100.0
    recent = klines[-6:]
    highs = [_safe_float(c.get("high")) for c in recent[:5]]
    lows = [_safe_float(c.get("low")) for c in recent[:5]]
    last_high = _safe_float(recent[-1].get("high"))
    last_low = _safe_float(recent[-1].get("low"))
    higher_highs = int(last_high > max(highs)) if highs else 0
    higher_lows = int(last_low > min(lows)) if lows else 0
    change_signal = (change + 5.0) / 10.0 * 100.0
    structure_signal = 70.0 if (higher_highs + higher_lows) == 2 else 30.0 if (higher_highs + higher_lows) == 0 else 50.0
    return _clamp(change_signal * 0.7 + structure_signal * 0.3), 0.6, True, f"{change:+.2f}% over {n}d"


def _score_open_interest(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    oi = bundle.open_interest
    ticker = bundle.ticker
    oi_value = _safe_float(oi.get("open_interest"), 0.0)
    if oi_value == 0.0 or not ticker:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No open interest data"
    volume = _safe_float(ticker.get("volume"), 0.0)
    price = _safe_float(ticker.get("last_price") or oi.get("mark_price"), 0.0)
    if volume <= 0 or price <= 0:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Missing volume/price for OI context"
    ratio = (oi_value * price) / (volume * price) if volume else 0.0
    crowding = max(0.0, min(1.0, ratio / 1.5))
    price_change_pct = _safe_float(ticker.get("price_change_pct"), 0.0)
    direction = 1.0 if price_change_pct > 0 else -1.0 if price_change_pct < 0 else 0.0
    score = 50.0 + direction * crowding * 25.0
    return _clamp(score), 0.45, True, f"OI={oi_value:.0f} ({ratio:.2f}x vol), 24h price {price_change_pct:+.2f}%"


def _score_funding(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    funding = bundle.funding
    if funding is None:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Funding rate data unavailable"
    rate = _safe_float(funding.get("last_funding_rate"), None)
    if rate is None:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No funding rate data"
    score = 50.0 - (rate / 0.001) * 50.0
    direction_detail = "crowded long" if rate > 0.0001 else "crowded short" if rate < -0.0001 else "neutral"
    return _clamp(score), 0.55, True, f"Funding={rate:+.5f} ({direction_detail})"


def _score_volume(bundle: RawSignalBundle) -> tuple[float, float, bool, str]:
    ticker = bundle.ticker
    klines = bundle.klines
    if not ticker or len(klines) < 2:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "No volume data"
    closes = [_safe_float(c.get("close")) for c in klines if c.get("close") is not None]
    if len(closes) < 2:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Insufficient close data for volume"
    daily_volume_usd = _safe_float(klines[-1].get("volume"), 0.0) * closes[-1]
    avg_volume_usd = sum(_safe_float(c.get("volume"), 0.0) * _safe_float(c.get("close"), 0.0) for c in klines[-10:]) / min(10, len(klines[-10:]))
    if avg_volume_usd <= 0:
        return NEUTRAL_VALUE, NEUTRAL_CONFIDENCE, False, "Zero average volume"
    ratio = daily_volume_usd / avg_volume_usd
    denominator = closes[-2] if closes[-2] != 0 else 1.0
    price_change = (closes[-1] - closes[-2]) / denominator
    direction = 1.0 if price_change >= 0 else -1.0
    score = 50.0 + (ratio - 1.0) * 50.0 * direction
    return _clamp(score), 0.5, True, f"Vol x{ratio:.2f} vs 10d avg ({'up' if price_change >= 0 else 'down'} {abs(price_change) * 100:.1f}%)"


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
    available_weight = 0.0
    available_count = 0
    for name, scorer in SCORERS.items():
        try:
            value, confidence, available, reason = scorer(bundle)
        except Exception:
            value, confidence, available, reason = NEUTRAL_VALUE, 0.0, False, f"Error computing {name} signal"
        weight = SIGNAL_WEIGHTS[name]
        safe_value = _safe_float(value, NEUTRAL_VALUE)
        safe_confidence = _safe_float(confidence, 0.0)
        sub_signals.append(SubSignal(name=name, value=round(_clamp(safe_value), 2), confidence=round(max(0.0, min(1.0, safe_confidence)), 3), available=available, reason=reason, raw={}))
        if available:
            weighted_sum += safe_value * weight
            available_weight += weight
            available_count += 1
    score = _safe_float(weighted_sum / available_weight if available_weight > 0 else NEUTRAL_VALUE, NEUTRAL_VALUE)
    coverage = available_count / len(SCORERS) if SCORERS else 0.0
    confs = [s.confidence for s in sub_signals if s.available]
    avg_confidence = statistics.mean(confs) if confs else NEUTRAL_CONFIDENCE
    adjusted_confidence = _safe_float(avg_confidence, NEUTRAL_CONFIDENCE) * coverage
    raw_recommendation = _recommendation(_clamp(score))
    if coverage < MIN_ACTIONABLE_COVERAGE or adjusted_confidence < MIN_ACTIONABLE_CONFIDENCE:
        recommendation = None
        actionability = "insufficient_evidence"
    else:
        recommendation = raw_recommendation
        actionability = "observe" if raw_recommendation == "hold" else "actionable"
    last_price = _safe_float(bundle.ticker.get("last_price", 0.0) if isinstance(bundle.ticker, dict) else 0.0, 0.0)
    source_meta = dict(bundle.source_meta or {})
    data_mode = source_meta.get("mode", "unknown")
    if data_mode not in {"live", "live_partial", "mock", "historical_proxy"}:
        data_mode = "unknown"
    return CompositeSignal(
        token=bundle.symbol.upper(), price=last_price, score=round(_clamp(score), 2), confidence=round(max(0.0, min(1.0, adjusted_confidence)), 3),
        sub_signals=sub_signals, recommendation=recommendation, timestamp=datetime.now(UTC).isoformat(), available_signals=available_count,
        total_signals=len(SCORERS), coverage=round(max(0.0, min(1.0, coverage)), 3), actionability=actionability,
        execution_authorized=False, data_mode=data_mode, source_meta=source_meta,
    )


def payload_from_bundle(bundle: RawSignalBundle) -> dict:
    composite = compute_composite(bundle)
    return {
        "ok": True, "token": composite.token, "price": composite.price, "score": composite.score, "confidence": composite.confidence,
        "recommendation": composite.recommendation, "timestamp": composite.timestamp, "available_signals": composite.available_signals,
        "total_signals": composite.total_signals, "coverage": composite.coverage, "actionability": composite.actionability,
        "execution_authorized": composite.execution_authorized, "data_mode": composite.data_mode, "source_meta": composite.source_meta,
        "sub_signals": [{"name": s.name, "value": s.value, "confidence": s.confidence, "available": s.available, "reason": s.reason} for s in composite.sub_signals],
    }
