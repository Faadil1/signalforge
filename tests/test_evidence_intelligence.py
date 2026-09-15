from __future__ import annotations

from services.evidence_intelligence import (
    build_decision_stress_test,
    build_lineage_analysis,
    build_recovery_requirements,
)


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
                "ticker": {"status": "fresh"},
                "klines": {"status": "fresh"},
                "open_interest": {"status": "unavailable"},
                "funding": {"status": "unavailable"},
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
        name: {"status": "fresh"} for name in ("ticker", "klines", "open_interest", "funding")
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


def test_already_refusing_state_is_not_mislabelled_as_resilient() -> None:
    result = build_decision_stress_test(_partial_payload())

    assert result["fragility_class"] == "already_refusing"
    assert result["minimum_dropouts_to_refusal"] is None
    assert result["execution_authorized"] is False
