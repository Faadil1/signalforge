from __future__ import annotations

from datetime import UTC, datetime

from models.signal import SIGNAL_WEIGHTS, RawSignalBundle
from services.signal_fusion import _recommendation, compute_composite, payload_from_bundle


def _bundle() -> RawSignalBundle:
    closes = [50.0 + i * 0.1 for i in range(30)]
    klines = [{"date": datetime.now(UTC).isoformat(), "open": c - 0.05, "high": c + 0.1, "low": c - 0.1, "close": c, "volume": 1000.0 + i} for i, c in enumerate(closes)]
    return RawSignalBundle(symbol="BTC", klines=klines, ticker={"last_price": 50000.0, "volume": 10000.0, "price_change_pct": 1.2}, open_interest={}, funding=None, source_meta={"mode": "live_partial", "provider": "binance_public"})


def _full_bundle() -> RawSignalBundle:
    bundle = _bundle()
    bundle.open_interest = {"open_interest": 200.0, "mark_price": 50000.0}
    bundle.funding = {"last_funding_rate": 0.0001}
    bundle.source_meta = {"mode": "live", "provider": "binance_public", "sources": {"ticker": "binance_futures", "klines": "binance_futures", "open_interest": "binance_futures", "funding": "binance_futures"}}
    return bundle


def test_composite_recommendation_mapping() -> None:
    assert _recommendation(80) == "strong_buy"
    assert _recommendation(70) == "buy"
    assert _recommendation(50) == "hold"
    assert _recommendation(30) == "sell"
    assert _recommendation(10) == "strong_sell"


def test_unavailable_signals_do_not_contribute_neutral_weight() -> None:
    composite = compute_composite(_bundle())
    available = [s for s in composite.sub_signals if s.available]
    weight = sum(SIGNAL_WEIGHTS[s.name] for s in available)
    manual = sum(s.value * SIGNAL_WEIGHTS[s.name] for s in available) / weight
    assert abs(manual - composite.score) < 0.02


def test_partial_three_of_five_is_confidence_gated() -> None:
    composite = compute_composite(_bundle())
    assert composite.coverage == 0.6
    assert composite.confidence < 0.4
    assert composite.recommendation is None
    assert composite.actionability == "insufficient_evidence"


def test_full_coverage_has_explicit_no_execution_authority() -> None:
    composite = compute_composite(_full_bundle())
    assert composite.coverage == 1.0
    assert composite.execution_authorized is False
    assert composite.data_mode == "live"


def test_payload_includes_trust_contract() -> None:
    payload = payload_from_bundle(_full_bundle())
    assert payload["ok"] is True
    assert payload["data_mode"] == "live"
    assert payload["source_meta"]["provider"] == "binance_public"
    assert payload["execution_authorized"] is False
