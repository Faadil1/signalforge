from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_capability_contract_is_explicit_and_side_effect_free() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/capabilities")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["contract_version"] == "1.1"
    assert body["policy_version"] == "evidence-gate-2026-09"
    assert body["agent_native"]["rest_api"] is True
    assert body["agent_native"]["tool_contracts_ready"] is True
    assert body["agent_native"]["mcp_transport_included"] is True
    assert body["agent_native"]["mcp_endpoint"] == "/mcp"
    assert body["agent_native"]["mcp_protocol_version"] == "2026-07-28"
    assert body["agent_native"]["mcp_state_model"] == "stateless"
    assert body["agent_native"]["side_effects"] == "none"
    assert body["agent_native"]["execution_authority"] == "none"
    assert body["authority_boundary"]["execution_authorized"] is False
    assert body["state_model"]["stateless_compare"] == "caller_supplied_baseline"
    assert body["state_model"]["delta_convenience_endpoint"] == "process_local_memory_non_durable"
    assert body["state_model"]["decision_stress"] == "bounded_counterfactual_dropout_of_observed_evidence"
    assert body["state_model"]["receipt_verification"] == "stateless_no_market_fetch"
    assert body["state_model"]["mcp"] == "stateless_request_response"
    assert body["differentiators"]["lineage_concentration"]
    assert body["differentiators"]["decision_fragility"]
    assert body["differentiators"]["recovery_requirements"]
    assert body["differentiators"]["decision_receipt"]
    assert all(tool["side_effects"] == "none" for tool in body["tools"])
    assert all(tool["mcp_tool"] for tool in body["tools"])
    tool_names = {tool["name"] for tool in body["tools"]}
    assert "stress_test_decision" in tool_names
    assert "verify_decision_receipt" in tool_names
    assert body["safe_failure_contract"]["all_paths_execution_authorized"] is False
    assert body["safe_failure_contract"]["restored_availability_guarantees_handoff"] is False


def test_health_advertises_agent_contract_mcp_and_proof_surfaces() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["decision_contract_version"] == "1.1"
    assert body["policy_version"] == "evidence-gate-2026-09"
    assert body["capabilities"] == "/api/v1/capabilities"
    assert body["mcp"] == "/mcp"
    assert body["mcp_protocol_version"] == "2026-07-28"
    assert body["resilience_benchmark"] == "/api/v1/evidence/resilience-benchmark"
    assert body["decision_stress"] == "/api/v1/decision/{token}/stress"
    assert body["receipt_verification"] == "/api/v1/decision/verify-receipt"
