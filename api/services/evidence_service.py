from __future__ import annotations

from datetime import UTC, datetime, timedelta

from models.signal import RawSignalBundle
from services.signal_fusion import payload_from_bundle

REAL_FAILURE_CASE = {
    "id": "aws-tokyo-binance-2025-04-15",
    "date": "2025-04-15",
    "title": "AWS Tokyo connectivity incident affecting Binance services",
    "epistemic_status": "observed_external",
    "source": {
        "publisher": "Reuters",
        "url": "https://www.reuters.com/technology/binance-services-start-recover-after-network-interruption-2025-04-15/",
    },
    "observed_external": [
        "AWS Tokyo connectivity disruption affected Binance services.",
        "Binance reported that some orders succeeded while others failed during the incident.",
        "Binance temporarily suspended withdrawals for approximately 23 minutes.",
    ],
    "design_implication": "AVAILABLE does not imply FRESH, CONSISTENT or ACTIONABLE.",
    "unknown": [
        "SignalForge did not capture live requests during the historical incident.",
        "The controlled fixture below is not a replay of 2025 Binance payloads.",
        "No claim is made that SignalForge would have prevented a specific financial loss.",
    ],
}


def _controlled_bundle() -> RawSignalBundle:
    now = datetime.now(UTC)
    closes = [50000.0 + i * 50.0 for i in range(30)]
    klines = []
    for i, close in enumerate(closes):
        observed = now - timedelta(days=29 - i)
        klines.append(
            {
                "date": observed.strftime("%Y-%m-%d"),
                "open": close - 20.0,
                "high": close + 80.0,
                "low": close - 80.0,
                "close": close,
                "volume": 1000.0 + i * 5,
            }
        )

    return RawSignalBundle(
        symbol="BTC",
        klines=klines,
        ticker={"last_price": closes[-1], "volume": 25000.0, "price_change_pct": 1.1},
        open_interest={"open_interest": 22000.0, "mark_price": closes[-1]},
        funding={"last_funding_rate": 0.0001},
        source_meta={
            "mode": "live_partial",
            "provider": "controlled_failure_fixture",
            "fixture": True,
            "historical_replay": False,
            "freshness": {
                "ticker": {"status": "fresh", "age_seconds": 5, "max_age_seconds": 300},
                "klines": {"status": "fresh", "age_seconds": 120, "max_age_seconds": 129600},
                "open_interest": {"status": "stale", "age_seconds": 1800, "max_age_seconds": 300},
                "funding": {"status": "unavailable", "age_seconds": None, "max_age_seconds": 900},
            },
            "observed_at": now.isoformat(),
        },
    )


def build_negative_path_evidence() -> dict:
    result = payload_from_bundle(_controlled_bundle())
    passed = (
        result["recommendation"] == "insufficient_evidence"
        and result["actionability"] == "insufficient_evidence"
        and result["execution_authorized"] is False
    )
    return {
        "ok": True,
        "principle": "Real failure > fake success",
        "real_failure_case": REAL_FAILURE_CASE,
        "controlled_counter_case": {
            "kind": "controlled_failure_class_reproduction",
            "not_a_historical_replay": True,
            "scenario": "Market price evidence remains fresh while open-interest is stale and funding is unavailable.",
            "expected_behavior": "Degraded evidence must reduce usable coverage and force abstention rather than false directional confidence.",
            "result": result,
            "assertions": {
                "recommendation_is_insufficient_evidence": result["recommendation"] == "insufficient_evidence",
                "actionability_is_insufficient_evidence": result["actionability"] == "insufficient_evidence",
                "execution_authorized_is_false": result["execution_authorized"] is False,
            },
            "passed": passed,
        },
    }
