from __future__ import annotations

from copy import deepcopy

from services.evidence_audit import build_admission_ledger
from services.evidence_intelligence import (
    build_decision_stress_test,
    build_evidence_lease,
    build_lineage_analysis,
    build_recovery_requirements,
)

EVALUATED_AT = "2026-09-15T00:04:00+00:00"
SOURCE_AT = "2026-09-15T00:00:00+00:00"


def _fresh(max_age_seconds: int) -> dict:
    return {
        "status": "fresh",
        "source_timestamp": SOURCE_AT,
        "received_at": EVALUATED_AT,
        "age_seconds": 240.0,
        "max_age_seconds": max_age_seconds,
    }


def _unavailable(max_age_seconds: int) -> dict:
    return {
        "status": "unavailable",
        "source_timestamp": None,
        "received_at": EVALUATED_AT,
        "age_seconds": None,
        "max_age_seconds": max_age_seconds,
    }


def _partial_payload() -> dict:
    return {
        "ok": True,
        "token": "BTC",
        "score": 41.0,
        "confidence": 0.36,
        "coverage": 0.6,
        "recommendation": "insufficient_evidence",
        "actionability": "insufficient_evidence",
        "source_meta": {
            "provider": "multi_provider_public",
            "sources": {
                "ticker": "coinbase_exchange",
                "klines": "coinbase_exchange",
                "open_interest": "unavailable",
                "funding": "unavailable",
            },
            "freshness": {
                "ticker": _fresh(300),
                "klines": _fresh(129600),
                "open_interest": _unavailable(300),
                "funding": _unavailable(900),
            },
        },
        "sub_signals": [
            {"name": "technical", "value": 35.0, "confidence": 0.7, "available": True, "reason": "test"},
            {"name": "trend", "value": 40.0, "confidence": 0.6, "available": True, "reason": "test"},
            {"name": "funding", "value": 50.0, "confidence": 0.2, "available": False, "reason": "unavailable"},
            {"name": "open_interest", "value": 50.0, "confidence": 0.2, "available": False, "reason": "unavailable"},
            {"name": "volume", "value": 48.0, "confidence": 0.5, "available": True, "reason": "test"},
        ],
    }


def _full_payload() -> dict:
    payload = _partial_payload()
    payload.update(
        {
            "score": 67.0,
            "confidence": 0.56,
            "coverage": 1.0,
            "recommendation": "buy",
            "actionability": "actionable",
        }
    )
    payload["source_meta"]["sources"] = {
        "ticker": "coinbase_exchange",
        "klines": "coinbase_exchange",
        "open_interest": "binance_futures",
        "funding": "binance_futures",
    }
    payload["source_meta"]["freshness"] = {
        "ticker": _fresh(300),
        "klines": _fresh(129600),
        "open_interest": _fresh(300),
        "funding": _fresh(900),
    }
    payload["sub_signals"] = [
        {"name": "technical", "value": 72.0, "confidence": 0.7, "available": True, "reason": "test"},
        {"name": "trend", "value": 68.0, "confidence": 0.6, "available": True, "reason": "test"},
        {"name": "funding", "value": 61.0, "confidence": 0.55, "available": True, "reason": "test"},
        {"name": "open_interest", "value": 63.0, "confidence": 0.45, "available": True, "reason": "test"},
        {"name": "volume", "value": 70.0, "confidence": 0.5, "available": True, "reason": "test"},
    ]
    return payload


def test_lineage_surfaces_provider_concentration_without_independence_claim() -> None:
    lineage = build_lineage_analysis(_partial_payload())

    assert lineage["dominant_provider"] == "coinbase_exchange"
    assert lineage["dominant_provider_signal_share"] == 1.0
    assert lineage["concentration_level"] == "high"
    assert lineage["independence_claimed"] is False
    assert lineage["policy_effect"] == "diagnostic_only_not_an_actionability_gate"


def test_admission_ledger_explains_admitted_and_excluded_sources() -> None:
    ledger = build_admission_ledger(_partial_payload())
    by_source = {entry["raw_source"]: entry for entry in ledger["entries"]}

    assert ledger["admitted_raw_sources"] == ["ticker", "klines"]
    assert set(ledger["excluded_raw_sources"]) == {"open_interest", "funding"}
    assert by_source["ticker"]["reason_code"] == "ADMITTED"
    assert by_source["funding"]["reason_code"] == "QUALITY_UNAVAILABLE"
    assert by_source["open_interest"]["decision_admitted"] is False
    assert ledger["execution_authorized"] is False


def test_evidence_lease_uses_earliest_contributing_freshness_deadline() -> None:
    lease = build_evidence_lease(_partial_payload())

    assert lease["status"] == "valid"
    assert lease["limiting_raw_source"] == "ticker"
    assert lease["valid_until"] == "2026-09-15T00:05:00+00:00"
    assert lease["remaining_seconds"] == 60.0
    assert lease["freshness_only"] is True
    assert lease["forecast_validity_guaranteed"] is False
    assert lease["execution_authorized"] is False


def test_evidence_lease_fails_closed_when_contributing_deadline_is_unknown() -> None:
    payload = _partial_payload()
    payload["source_meta"]["freshness"]["ticker"]["source_timestamp"] = None
    lease = build_evidence_lease(payload)

    assert lease["status"] == "unknown"
    assert lease["valid_until"] is None
    assert "ticker" in lease["uncertain_raw_sources"]


def test_evidence_lease_reports_expired_if_admitted_source_is_stale() -> None:
    payload = deepcopy(_partial_payload())
    payload["source_meta"]["freshness"]["ticker"]["status"] = "stale"
    lease = build_evidence_lease(payload)

    assert lease["status"] == "expired"
    assert lease["remaining_seconds"] == 0.0
    assert lease["limiting_raw_source"] == "ticker"


def test_recovery_reports_necessary_not_sufficient_conditions() -> None:
    recovery = build_recovery_requirements(_partial_payload())

    assert recovery["coverage_gate"]["met"] is True
    assert recovery["confidence_gate"]["met"] is False
    assert recovery["confidence_gate"]["gap"] == 0.04
    assert recovery["guaranteed_recovery"] is False
    missing = {item["signal"] for item in recovery["missing_signals"]}
    assert missing == {"funding", "open_interest"}


def test_provider_dropout_stress_exposes_hidden_dependency_chain() -> None:
    result = build_decision_stress_test(_full_payload())

    assert result["ok"] is True
    assert result["fragility_class"] in {"single_channel_fragile", "two_channel_fragile", "multi_channel_resilient"}
    coinbase = next(item for item in result["provider_dropouts"] if item["provider"] == "coinbase_exchange")
    assert set(coinbase["impacted_raw_inputs"]) == {"klines", "ticker"}
    assert {"technical", "trend", "volume"}.issubset(set(coinbase["impacted_signals"]))
    assert coinbase["causes_refusal"] is True
    assert coinbase["result"]["execution_authorized"] is False
    assert result["evidence_lease"]["status"] == "valid"

    sufficiency = result["minimum_sufficient_evidence"]
    assert sufficiency["baseline_policy_passes"] is True
    assert sufficiency["minimum_signal_count"] == 4
    assert sufficiency["minimum_sufficient_signal_sets"]
    assert sufficiency["causal_sufficiency_claimed"] is False
    assert sufficiency["future_sufficiency_guaranteed"] is False
    assert sufficiency["execution_authorized"] is False


def test_already_refusing_state_has_no_sufficient_subset() -> None:
    result = build_decision_stress_test(_partial_payload())

    assert result["fragility_class"] == "already_refusing"
    assert result["minimum_dropouts_to_refusal"] is None
    assert result["minimum_sufficient_evidence"]["baseline_policy_passes"] is False
    assert result["minimum_sufficient_evidence"]["minimum_signal_count"] is None
    assert result["minimum_sufficient_evidence"]["minimum_sufficient_signal_sets"] == []
    assert result["execution_authorized"] is False
