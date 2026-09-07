from __future__ import annotations

from datetime import UTC, datetime

from models.signal import SIGNAL_WEIGHTS, SIGNAL_WEIGHTS_SUM, RawSignalBundle
from services.signal_fusion import _recommendation, compute_composite, payload_from_bundle


def _bundle(score: float) -> RawSignalBundle:
    """Build a minimal RawSignalBundle.

    Only klines and ticker are required for technical/trend/volume scorers;
    open_interest and funding are intentionally omitted so those signals fall
    back to a neutral value.
    """
    closes = [50.0 + i * 0.1 for i in range(30)]
    klines = [
        {
            "date": datetime.now(UTC).isoformat(),
            "open": c - 0.05,
            "high": c + 0.1,
            "low": c - 0.1,
            "close": c,
            "volume": 1000.0 + i,
        }
        for i, c in enumerate(closes)
    ]
    return RawSignalBundle(
        symbol="BTC",
        klines=klines,
        ticker={"last_price": 50000.0, "volume": 10000.0},
        open_interest={},
        funding={},
    )


def _full_bundle() -> RawSignalBundle:
    """Bundle where all five signals are available."""
    bundle = _bundle(50.0)
    bundle.open_interest = {"open_interest": 200.0, "mark_price": 50000.0}
    bundle.funding = {"last_funding_rate": 0.0001}
    return bundle


def test_signal_weights_sum_to_one() -> None:
    assert SIGNAL_WEIGHTS_SUM == 1.0
    assert set(SIGNAL_WEIGHTS) == {"technical", "trend", "open_interest", "funding", "volume"}


def test_compute_composite_returns_valid_score() -> None:
    bundle = _bundle(50.0)
    composite = compute_composite(bundle)
    assert 0.0 <= composite.score <= 100.0
    assert composite.score == round(composite.score, 2)
    assert len(composite.sub_signals) == 5


def test_composite_recommendation_mapping() -> None:
    assert _recommendation(80) == "strong_buy"
    assert _recommendation(70) == "buy"
    assert _recommendation(50) == "hold"
    assert _recommendation(30) == "sell"
    assert _recommendation(10) == "strong_sell"


def test_sub_signal_weighted_fusion() -> None:
    bundle = _bundle(50.0)
    composite = compute_composite(bundle)
    manual = sum(s.value * SIGNAL_WEIGHTS[s.name] for s in composite.sub_signals)
    assert abs(manual - composite.score) < 1e-6


def test_funding_none_marks_signal_unavailable() -> None:
    bundle = _full_bundle()
    bundle.funding = None
    composite = compute_composite(bundle)

    funding = next(s for s in composite.sub_signals if s.name == "funding")
    assert funding.available is False
    assert "unavailable" in funding.reason
    assert composite.available_signals == 4
    assert composite.total_signals == 5
    assert composite.coverage == 0.8


def test_full_coverage_scales_confidence() -> None:
    composite = compute_composite(_full_bundle())

    assert composite.available_signals == 5
    assert composite.coverage == 1.0
    confs = [s.confidence for s in composite.sub_signals]
    expected = sum(confs) / len(confs)
    assert composite.confidence == round(expected, 3)


def test_missing_open_interest_reduces_coverage() -> None:
    bundle = _full_bundle()
    bundle.open_interest = {}
    composite = compute_composite(bundle)

    oi = next(s for s in composite.sub_signals if s.name == "open_interest")
    assert oi.available is False
    assert composite.coverage == 0.8
    assert composite.available_signals == 4


def test_coverage_penalizes_adjusted_confidence() -> None:
    full = compute_composite(_full_bundle())
    partial = _full_bundle()
    partial.funding = None
    partial = compute_composite(partial)

    assert full.coverage == 1.0
    assert partial.coverage == 0.8
    assert partial.confidence < full.confidence


def test_payload_includes_coverage_keys() -> None:
    payload = payload_from_bundle(_full_bundle())
    assert payload["ok"] is True
    assert payload["available_signals"] == 5
    assert payload["total_signals"] == 5
    assert payload["coverage"] == 1.0
