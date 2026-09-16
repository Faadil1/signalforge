from __future__ import annotations

from copy import deepcopy

from fastapi.testclient import TestClient

from main import app
from services.recovery_service import build_recovery_plan, verify_recovery_progress


def _refused_packet() -> dict:
    return {
        "ok": True,
        "contract_version": "1.1",
        "policy_version": "evidence-gate-2026-09",
        "token": "BTC",
        "snapshot_id": "abc123",
        "actionability": "insufficient_evidence",
        "coverage": 0.6,
        "confidence": 0.36,
        "evidence": {
            "supporting": [
                {"name": "technical", "value": 35.0, "confidence": 0.7, "reason": "test"},
                {"name": "trend", "value": 38.0, "confidence": 0.6, "reason": "test"},
            ],
            "contradicting": [],
            "neutral": [{"name": "volume", "value": 50.0, "confidence": 0.5, "reason": "test"}],
        },
        "data_quality": {
            "mode": "live_partial",
            "provider": "multi_provider_public",
            "sources": {
                "ticker": "coinbase_exchange",
                "klines": "coinbase_exchange",
                "open_interest": "unavailable",
                "funding": "unavailable",
            },
        },
        "execution_authorized": False,
    }


def _partially_repaired_packet() -> dict:
    packet = deepcopy(_refused_packet())
    packet["snapshot_id"] = "def456"
    packet["coverage"] = 0.8
    packet["confidence"] = 0.39
    packet["evidence"]["neutral"].append({"name": "funding", "value": 49.0, "confidence": 0.55, "reason": "reacquired"})
    packet["data_quality"]["sources"]["funding"] = "binance_futures"
    return packet


def _recovered_packet() -> dict:
    packet = _partially_repaired_packet()
    packet["snapshot_id"] = "ghi789"
    packet["coverage"] = 1.0
    packet["confidence"] = 0.45
    packet["actionability"] = "observe"
    packet["evidence"]["neutral"].append({"name": "open_interest", "value": 52.0, "confidence": 0.45, "reason": "reacquired"})
    packet["data_quality"]["sources"]["open_interest"] = "binance_futures"
    return packet


def test_recovery_plan_quantifies_evidence_debt_without_promising_actionability() -> None:
    plan = build_recovery_plan(_refused_packet())
    assert plan["ok"] is True
    assert plan["contract"] == "refusal_recovery_v1"
    assert plan["status"] == "refused"
    assert plan["execution_authorized"] is False
    assert plan["evidence_debt"]["coverage_gap"] == 0.0
    assert plan["evidence_debt"]["confidence_gap"] == 0.04
    assert plan["evidence_debt"]["unavailable_signals"] == ["funding", "open_interest"]
    assert plan["evidence_debt"]["minimum_additional_signals_for_coverage_only"] == 0
    assert any(item["code"] == "CONFIDENCE_BELOW_POLICY" for item in plan["blocking_conditions"])
    assert plan["next_safe_action"] == "REACQUIRE_MINIMUM_EVIDENCE_THEN_REEVALUATE"
    assert all(candidate["safe_action"] == "REACQUIRE_AND_REEVALUATE" for candidate in plan["recovery_candidates"])
    assert any("does not guarantee" in item for item in plan["non_guarantees"])


def test_refusal_receipt_is_content_addressed_and_stable() -> None:
    first = build_recovery_plan(_refused_packet())
    second = build_recovery_plan(_refused_packet())
    assert first["refusal_receipt_id"] == second["refusal_receipt_id"]
    assert len(first["refusal_receipt_id"]) == 24
    changed = _refused_packet()
    changed["confidence"] = 0.35
    third = build_recovery_plan(changed)
    assert third["refusal_receipt_id"] != first["refusal_receipt_id"]


def test_missing_derivatives_are_reacquisition_targets_not_synthetic_inputs() -> None:
    plan = build_recovery_plan(_refused_packet())
    by_signal = {candidate["signal"]: candidate for candidate in plan["recovery_candidates"]}
    assert by_signal["funding"]["source_requirements"][0]["current_state"] == "unavailable"
    assert by_signal["open_interest"]["source_requirements"][0]["current_state"] == "unavailable"
    assert "SignalForge does not synthesize missing funding or open-interest evidence." in plan["non_guarantees"]


def test_recovery_verification_detects_partial_repair_without_false_pass() -> None:
    previous_plan = build_recovery_plan(_refused_packet())
    result = verify_recovery_progress(previous_plan, _partially_repaired_packet())
    assert result["ok"] is True
    assert result["contract"] == "recovery_verification_v1"
    assert result["status"] == "improved_but_still_refused"
    assert result["evidence_repair_observed"] is True
    assert result["policy_gate_passed"] is False
    assert result["delta"]["recovered_signals"] == ["funding"]
    assert result["execution_authorized"] is False


def test_recovery_verification_distinguishes_policy_gate_recovery_from_execution_authority() -> None:
    previous_plan = build_recovery_plan(_refused_packet())
    result = verify_recovery_progress(previous_plan, _recovered_packet())
    assert result["status"] == "policy_gate_recovered"
    assert result["policy_gate_passed"] is True
    assert sorted(result["delta"]["recovered_signals"]) == ["funding", "open_interest"]
    assert result["next_safe_action"] == "RESEARCH_HANDOFF_REQUIRES_EXTERNAL_AUTHORITY"
    assert result["execution_authorized"] is False


def test_recovery_verification_rejects_wrong_token() -> None:
    previous_plan = build_recovery_plan(_refused_packet())
    current = _recovered_packet()
    current["token"] = "ETH"
    result = verify_recovery_progress(previous_plan, current)
    assert result["ok"] is False
    assert result["error"]["code"] == "TOKEN_MISMATCH"


def test_recovery_plan_is_public_read_only_capability(monkeypatch) -> None:
    import routes.decision as decision_route

    async def fake_recovery(_token: str):
        return build_recovery_plan(_refused_packet())

    monkeypatch.setattr(decision_route, "get_recovery_plan", fake_recovery)
    with TestClient(app) as client:
        response = client.get("/api/v1/decision/BTC/recovery-plan")
    assert response.status_code == 200
    body = response.json()
    assert body["contract"] == "refusal_recovery_v1"
    assert body["refusal_receipt_id"]
    assert body["execution_authorized"] is False


def test_recovery_verification_is_public_read_only_capability(monkeypatch) -> None:
    import routes.decision as decision_route

    async def fake_verify(_token: str, previous_plan: dict):
        return verify_recovery_progress(previous_plan, _partially_repaired_packet())

    monkeypatch.setattr(decision_route, "verify_live_recovery", fake_verify)
    previous_plan = build_recovery_plan(_refused_packet())
    with TestClient(app) as client:
        response = client.post("/api/v1/decision/BTC/verify-recovery", json=previous_plan)
    assert response.status_code == 200
    body = response.json()
    assert body["contract"] == "recovery_verification_v1"
    assert body["evidence_repair_observed"] is True
    assert body["policy_gate_passed"] is False
    assert body["execution_authorized"] is False
