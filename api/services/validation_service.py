from __future__ import annotations

import math

from models.signal import RawSignalBundle
from services.binance_client import binance
from services.signal_fusion import compute_composite


def _safe_float(value, default=0.0) -> float:
    try:
        value = float(value)
        return value if math.isfinite(value) else default
    except (TypeError, ValueError):
        return default


async def run_signal_validation(token: str, period_days: int = 120, horizon_days: int = 3) -> dict:
    limit = min(500, max(45, period_days + horizon_days))
    validation_getter = getattr(binance, "get_validation_klines", binance.get_klines)
    candles = await validation_getter(token, interval="1d", limit=limit)
    kline_source = getattr(candles, "source", "binance_public")
    validation_provider = "multi_provider_public" if kline_source == "coinbase_exchange" else "binance_public"

    if len(candles) < 35 + horizon_days:
        raise ValueError(f"Insufficient historical candles: {len(candles)}")
    samples = []
    for idx in range(29, len(candles) - horizon_days):
        window = candles[: idx + 1]
        current = window[-1]
        previous = window[-2]
        current_close = _safe_float(current.get("close"))
        previous_close = _safe_float(previous.get("close"))
        forward_close = _safe_float(candles[idx + horizon_days].get("close"))
        if current_close <= 0 or previous_close <= 0 or forward_close <= 0:
            continue
        ticker = {
            "last_price": current_close,
            "volume": _safe_float(current.get("volume")),
            "price_change_pct": ((current_close - previous_close) / previous_close) * 100.0,
        }
        composite = compute_composite(
            RawSignalBundle(
                symbol=token,
                klines=window,
                ticker=ticker,
                open_interest={},
                funding=None,
                source_meta={
                    "mode": "historical_proxy",
                    "provider": validation_provider,
                    "sources": {"klines": kline_source, "ticker": "derived_from_klines"},
                },
            )
        )
        forward_return = ((forward_close - current_close) / current_close) * 100.0
        samples.append(
            {"date": current.get("date"), "score": composite.score, "forward_return_pct": round(forward_return, 4)}
        )
    buckets = [("0-39", 0, 40), ("40-59", 40, 60), ("60-74", 60, 75), ("75-100", 75, 101)]
    bucket_results = []
    for label, lo, hi in buckets:
        members = [s for s in samples if lo <= s["score"] < hi]
        if not members:
            bucket_results.append(
                {"bucket": label, "samples": 0, "avg_forward_return_pct": None, "positive_rate": None}
            )
            continue
        avg_return = sum(s["forward_return_pct"] for s in members) / len(members)
        positive_rate = sum(1 for s in members if s["forward_return_pct"] > 0) / len(members)
        bucket_results.append(
            {
                "bucket": label,
                "samples": len(members),
                "avg_forward_return_pct": round(avg_return, 3),
                "positive_rate": round(positive_rate, 3),
            }
        )
    directional = [s for s in samples if s["score"] >= 60 or s["score"] < 40]
    correct = sum(
        1
        for s in directional
        if (s["score"] >= 60 and s["forward_return_pct"] > 0) or (s["score"] < 40 and s["forward_return_pct"] < 0)
    )
    accuracy = (correct / len(directional)) if directional else None
    return {
        "ok": True,
        "token": token.upper(),
        "period_days_requested": period_days,
        "candles_used": len(candles),
        "horizon_days": horizon_days,
        "sample_count": len(samples),
        "validation_scope": "price_derived_3_of_5",
        "full_composite_validated": False,
        "included_signals": ["technical", "trend", "volume"],
        "omitted_signals": ["funding", "open_interest"],
        "data_provider": validation_provider,
        "kline_source": kline_source,
        "directional_accuracy": round(accuracy, 3) if accuracy is not None else None,
        "buckets": bucket_results,
        "limitations": [
            "Funding and open-interest history are not included in this calibration.",
            "This is an exploratory calibration of the price-derived portion of SignalForge, not proof of profitability.",
            "No synthetic market data is used by this endpoint.",
        ],
    }
