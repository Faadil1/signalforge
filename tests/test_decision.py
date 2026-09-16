from __future__ import annotations

import asyncio

import services.decision_service as decision_service
from services.evidence_intelligence import verify_decision_receipt

SOURCE_AT = "2026-09-14T19:56:00+00:00"
RECEIVED_AT = "2026-09-14T20:00:00+00:00"


def _fresh(max_age_seconds: int) -> dict:
    return {
        "status": "fresh",
        "source_timestamp": SOURCE_AT,
        "received_at": RECEIVED_AT,
        "age_seconds": 240.0,
        "max_age_seconds": max_age_seconds,
    }


def _payload(score=70.0):
    return {
        "ok": True,
        "token": "BTC",
        "price": 70000.0,
        "score": score,
        "confidence": 0.62,
        "recommendation": "buy" if score >= 60 else "hold",
        "timestamp": RECEIVED_AT,
        "available_signals": 5,
        "total_signals": 5,
        "coverage": 1.0,
        "actionability": "actionable" if score >= 60 else "observe",
        "execution_authorized": False,
        "data_mode": "live",
        "source_meta": {
            "provider": "multi_provider_public",
            "sources": {
                "ticker": "coinbase_exchange",
                "klines": "coinbase_exchange",
                "funding": "binance_futures",
                "open_interest": "binance_futures",
            },
            "freshness": {
                "ticker": _fresh(300),
                "klines": _fresh(129600),
                "funding": _fresh(900),
                "open_interest": _fresh(300),
            },
            "quality_summary": {"healthy_sources": ["ticker", "klines", "funding", "open_interest"]},
            "observed_at": RECEIVED_AT,
            "fallback_active": True,
            "primary_provider": "binance_public",
            "fallback_provider": "coinbase_exchange",
        },
        "sub_signals": [
            {"name": "technical", "value": 68.0, "confidence": 0.7, "available": True, "reason": "test"},
            {"name": "trend", "value": score, "confidence": 0.6, "available": True, "reason": "test"},
            {"name": "funding", "value": 45.0, "confidence": 0.55, "available": True, "reason": "test"},
            {"name": "open_interest", "value": 58.0, "confidence": 0.45, "available": True, "reason": "test"},
            {"name": "volume", "value": 65.0, "confidence": 0.5, "available": True, "reason": "test"},
        ],
    }


def test_decision_packet_is_evidence_bound_and_versioned(monkeypatch):
    async def fake(_token):
        return _payload()

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    packet = asyncio.run(decision_service.get_decision_packet("BTC"))

    assert packet["contract_version"] == "1.1"
    assert packet["policy_version"] == "evidence-gate-2026-09"
    assert packet["stance"] == "buy"
    assert packet["execution_authorized"] is False
    assert packet["authority_boundary"]["signalforge_authority"] == "research_only"
    assert packet["authority_boundary"]["external_execution_authority_required"] is True
    assert packet["agent_next_action"]["code"] == "RESEARCH_HANDOFF"
    assert packet["agent_next_action"]["execution_authorized"] is False
    assert packet["data_quality"]["mode"] == "live"
    assert packet["data_quality"]["fallback_active"] is True
    assert packet["evidence"]["supporting"]
    assert packet["evidence_admission_ledger"]["admitted_count"] == 4
    assert packet["evidence_lineage"]["dominant_provider"] == "coinbase_exchange"
    assert packet["evidence_lineage"]["independence_claimed"] is False
    assert packet["evidence_lease"]["status"] == "valid"
    assert packet["evidence_lease"]["limiting_raw_source"] in {"ticker", "open_interest"}
    assert packet["evidence_lease"]["forecast_validity_guaranteed"] is False
    assert packet["recovery_requirements"]["coverage_gate"]["met"] is True
    assert packet["snapshot_id"]
    assert len(packet["receipt"]["digest"]) == 64
    assert verify_decision_receipt(packet)["valid"] is True


def test_decision_receipt_detects_tampering(monkeypatch):
    async def fake(_token):
        return _payload()

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    packet = asyncio.run(decision_service.get_decision_packet("BTC"))
    packet["score"] = 1.0

    verification = verify_decision_receipt(packet)
    assert verification["ok"] is True
    assert verification["valid"] is False


def test_decision_stress_test_is_bounded_and_read_only(monkeypatch):
    async def fake(_token):
        return _payload()

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    result = asyncio.run(decision_service.get_decision_stress_test("BTC"))

    assert result["ok"] is True
    assert result["scope"] == "counterfactual_dropout_of_currently_observed_subsignals_not_market_replay"
    assert result["execution_authorized"] is False
    assert result["minimum_dropouts_to_refusal"] is not None
    assert result["provider_dropouts"]
    assert result["evidence_lease"]["status"] == "valid"
    assert all(item["result"]["execution_authorized"] is False for item in result["provider_dropouts"])


def test_delta_establishes_baseline_then_detects_change(monkeypatch):
    state = {"score": 65.0}

    async def fake(_token):
        return _payload(state["score"])

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    decision_service._clear_decisions()
    first = asyncio.run(decision_service.get_signal_delta("BTC"))
    assert first["baseline_established"] is True
    assert first["persistence"] == "process_memory"
    assert first["execution_authorized"] is False

    state["score"] = 75.0
    second = asyncio.run(decision_service.get_signal_delta("BTC"))
    assert second["material_change"] is True
    assert second["score_delta"] == 10.0
    assert second["persistence"] == "process_memory"
    assert second["execution_authorized"] is False


def test_stateless_compare_survives_process_memory_boundaries(monkeypatch):
    state = {"score": 65.0}

    async def fake(_token):
        return _payload(state["score"])

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    baseline = asyncio.run(decision_service.get_decision_packet("BTC"))

    decision_service._clear_decisions()
    state["score"] = 75.0
    comparison = asyncio.run(decision_service.compare_with_live_decision("BTC", baseline))

    assert comparison["ok"] is True
    assert comparison["material_change"] is True
    assert comparison["score_delta"] == 10.0
    assert comparison["previous_snapshot_id"] == baseline["snapshot_id"]
    assert comparison["baseline_contract_version"] == "1.1"
    assert comparison["persistence"] == "caller_supplied_baseline"
    assert comparison["execution_authorized"] is False


def test_stateless_compare_accepts_legacy_unversioned_packet(monkeypatch):
    async def fake(_token):
        return _payload(70.0)

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    baseline = asyncio.run(decision_service.get_decision_packet("BTC"))
    baseline.pop("contract_version")

    comparison = asyncio.run(decision_service.compare_with_live_decision("BTC", baseline))
    assert comparison["ok"] is True
    assert comparison["baseline_contract_version"] == "legacy_unversioned"


def test_stateless_compare_rejects_mismatched_token(monkeypatch):
    async def fake(_token):
        return _payload(70.0)

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    baseline = asyncio.run(decision_service.get_decision_packet("BTC"))
    baseline["token"] = "ETH"

    comparison = asyncio.run(decision_service.compare_with_live_decision("BTC", baseline))
    assert comparison["ok"] is False
    assert comparison["error"]["code"] == "TOKEN_MISMATCH"


def test_stateless_compare_rejects_incompatible_contract(monkeypatch):
    async def fake(_token):
        return _payload(70.0)

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    baseline = asyncio.run(decision_service.get_decision_packet("BTC"))
    baseline["contract_version"] = "9.9"

    comparison = asyncio.run(decision_service.compare_with_live_decision("BTC", baseline))
    assert comparison["ok"] is False
    assert comparison["error"]["code"] == "BASELINE_CONTRACT_VERSION_MISMATCH"


def test_stateless_compare_rejects_malformed_evidence_without_500(monkeypatch):
    async def fake(_token):
        return _payload(70.0)

    monkeypatch.setattr(decision_service, "get_signal_payload", fake)
    baseline = asyncio.run(decision_service.get_decision_packet("BTC"))
    baseline["evidence"]["supporting"] = {"not": "a list"}

    comparison = asyncio.run(decision_service.compare_with_live_decision("BTC", baseline))
    assert comparison["ok"] is False
    assert comparison["error"]["code"] == "INVALID_BASELINE"
