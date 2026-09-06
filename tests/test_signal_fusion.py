from __future__ import annotations

from datetime import datetime, timezone

from models.signal import SIGNAL_WEIGHTS, SIGNAL_WEIGHTS_SUM, RawSignalBundle
from services.signal_fusion import compute_composite, _recommendation


def _bundle(score: float) -> RawSignalBundle:
    """Build a minimal RawSignalBundle.

    Only klines and ticker are required for technical/trend/volume scorers;
    open_interest and funding are intentionally omitted so those signals fall
    back to a neutral value.
    """
    closes = [50.0 + i * 0.1 for i in range(30)]
    klines = [
        {
            "date": datetime.now(timezone.utc).isoformat(),
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
