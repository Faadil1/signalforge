from __future__ import annotations

from datetime import UTC, datetime, timedelta

from models.signal import RawSignalBundle
from services.signal_fusion import payload_from_bundle

BENCHMARK_EPOCH = datetime(2026, 9, 15, 0, 0, 0, tzinfo=UTC)

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


def _base_klines(now: datetime) -> list[dict]:
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
    return klines


def _quality_meta(
    now: datetime,
    *,
    healthy: list[str],
    stale: list[str] | None = None,
    unavailable: list[str] | None = None,
    inconsistent: list[str] | None = None,
    mock: list[str] | None = None,
    freshness: dict | None = None,
) -> dict:
    return {
        "mode": "live" if len(healthy) >= 4 else "live_partial",
        "provider": "controlled_policy_fixture",
        "fixture": True,
        "historical_replay": False,
        "freshness": freshness or {},
        "quality_summary": {
            "healthy_sources": healthy,
            "mock_sources": mock or [],
            "stale_sources": stale or [],
            "unavailable_sources": unavailable or [],
            "unknown_sources": [],
            "inconsistent_sources": inconsistent or [],
        },
        "observed_at": now.isoformat(),
    }


def _full_evidence_bundle(now: datetime | None = None) -> RawSignalBundle:
    now = now or datetime.now(UTC)
    klines = _base_klines(now)
    last_price = float(klines[-1]["close"])
    return RawSignalBundle(
        symbol="BTC",
        klines=klines,
        ticker={"last_price": last_price, "volume": 25000.0, "price_change_pct": 1.1},
        open_interest={"open_interest": 15000.0, "mark_price": last_price},
        funding={"last_funding_rate": -0.0002},
        source_meta=_quality_meta(
            now,
            healthy=["ticker", "klines", "open_interest", "funding"],
            freshness={
                "ticker": {"status": "fresh", "age_seconds": 5, "max_age_seconds": 300},
                "klines": {"status": "fresh", "age_seconds": 120, "max_age_seconds": 129600},
                "open_interest": {"status": "fresh", "age_seconds": 20, "max_age_seconds": 300},
                "funding": {"status": "fresh", "age_seconds": 60, "max_age_seconds": 900},
            },
        ),
    )


def _controlled_bundle(now: datetime | None = None) -> RawSignalBundle:
    """State after freshness gating removes stale/unavailable evidence."""
    now = now or datetime.now(UTC)
    klines = _base_klines(now)
    last_price = float(klines[-1]["close"])
    return RawSignalBundle(
        symbol="BTC",
        klines=klines,
        ticker={"last_price": last_price, "volume": 25000.0, "price_change_pct": 1.1},
        open_interest={},
        funding=None,
        source_meta=_quality_meta(
            now,
            healthy=["klines", "ticker"],
            stale=["open_interest"],
            unavailable=["funding"],
            freshness={
                "ticker": {"status": "fresh", "age_seconds": 5, "max_age_seconds": 300},
                "klines": {"status": "fresh", "age_seconds": 120, "max_age_seconds": 129600},
                "open_interest": {"status": "stale", "age_seconds": 1800, "max_age_seconds": 300},
                "funding": {"status": "unavailable", "age_seconds": None, "max_age_seconds": 900},
            },
        ),
    )


def _inconsistent_ticker_removed_bundle(now: datetime | None = None) -> RawSignalBundle:
    now = now or datetime.now(UTC)
    return RawSignalBundle(
        symbol="BTC",
        klines=_base_klines(now),
        ticker={},
        open_interest={},
        funding=None,
        source_meta=_quality_meta(
            now,
            healthy=["klines"],
            unavailable=["open_interest", "funding"],
            inconsistent=["ticker"],
            freshness={
                "klines": {"status": "fresh", "age_seconds": 120, "max_age_seconds": 129600},
                "ticker": {"status": "inconsistent", "age_seconds": 4, "max_age_seconds": 300},
            },
        ),
    )


def _mock_removed_bundle(now: datetime | None = None) -> RawSignalBundle:
    now = now or datetime.now(UTC)
    return RawSignalBundle(
        symbol="BTC",
        klines=[],
        ticker={},
        open_interest={},
        funding=None,
        source_meta=_quality_meta(
            now,
            healthy=[],
            unavailable=["open_interest", "funding"],
            mock=["ticker", "klines"],
            freshness={
                "ticker": {"status": "mock", "age_seconds": None, "max_age_seconds": 300},
                "klines": {"status": "mock", "age_seconds": None, "max_age_seconds": 129600},
            },
        ),
    )


def build_negative_path_evidence() -> dict:
    result = payload_from_bundle(_controlled_bundle())
    passed = (
        result["recommendation"] == "insufficient_evidence"
        and result["actionability"] == "insufficient_evidence"
        and result["execution_authorized"] is False
        and result["available_signals"] == 3
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
                "degraded_sources_removed_from_usable_inputs": result["available_signals"] == 3,
                "recommendation_is_insufficient_evidence": result["recommendation"] == "insufficient_evidence",
                "actionability_is_insufficient_evidence": result["actionability"] == "insufficient_evidence",
                "execution_authorized_is_false": result["execution_authorized"] is False,
            },
            "passed": passed,
        },
    }


def build_resilience_benchmark() -> dict:
    """Deterministic policy-conformance benchmark, not a market-accuracy claim."""
    cases = [
        {
            "id": "full-five-channel-context",
            "failure_class": "none",
            "bundle": _full_evidence_bundle(BENCHMARK_EPOCH),
            "expected_actionability": "not_insufficient_evidence",
            "expected_available_signals": 5,
        },
        {
            "id": "stale-oi-unavailable-funding",
            "failure_class": "stale+unavailable",
            "bundle": _controlled_bundle(BENCHMARK_EPOCH),
            "expected_actionability": "insufficient_evidence",
            "expected_available_signals": 3,
        },
        {
            "id": "inconsistent-ticker-removed",
            "failure_class": "inconsistent",
            "bundle": _inconsistent_ticker_removed_bundle(BENCHMARK_EPOCH),
            "expected_actionability": "insufficient_evidence",
            "expected_available_signals": 1,
        },
        {
            "id": "mock-price-evidence-removed",
            "failure_class": "mock",
            "bundle": _mock_removed_bundle(BENCHMARK_EPOCH),
            "expected_actionability": "insufficient_evidence",
            "expected_available_signals": 0,
        },
    ]

    results = []
    for case in cases:
        result = payload_from_bundle(case["bundle"])
        expected_actionability = case["expected_actionability"]
        actionability_passed = (
            result["actionability"] != "insufficient_evidence"
            if expected_actionability == "not_insufficient_evidence"
            else result["actionability"] == expected_actionability
        )
        passed = (
            actionability_passed
            and result["available_signals"] == case["expected_available_signals"]
            and result["execution_authorized"] is False
        )
        results.append(
            {
                "id": case["id"],
                "failure_class": case["failure_class"],
                "expected": {
                    "actionability": expected_actionability,
                    "available_signals": case["expected_available_signals"],
                    "execution_authorized": False,
                },
                "observed": {
                    "actionability": result["actionability"],
                    "recommendation": result["recommendation"],
                    "available_signals": result["available_signals"],
                    "coverage": result["coverage"],
                    "confidence": result["confidence"],
                    "execution_authorized": result["execution_authorized"],
                    "quality_summary": result.get("source_meta", {}).get("quality_summary", {}),
                },
                "passed": passed,
            }
        )

    passed_count = sum(1 for item in results if item["passed"])
    total = len(results)
    return {
        "ok": passed_count == total,
        "benchmark": "evidence_resilience_policy_conformance_v1",
        "scope": "controlled_policy_conformance_not_market_accuracy",
        "fixture_epoch": BENCHMARK_EPOCH.isoformat(),
        "not_a_historical_replay": True,
        "principle": "Degraded evidence must fail closed before confidence becomes fiction.",
        "scenarios": results,
        "summary": {
            "passed": passed_count,
            "total": total,
            "policy_conformance_rate": round(passed_count / total, 3) if total else 0.0,
        },
        "limitations": [
            "This benchmark measures deterministic policy behavior, not trading profitability or predictive accuracy.",
            "Controlled fixtures use a fixed synthetic fixture epoch for reproducibility and are not historical market replays.",
        ],
    }
