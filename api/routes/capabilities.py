from __future__ import annotations

from fastapi import APIRouter

from services.decision_service import DECISION_CONTRACT_VERSION, POLICY_VERSION

router = APIRouter(tags=["agent-contract"])
MCP_PROTOCOL_VERSION = "2026-07-28"


@router.get("/capabilities")
async def capabilities():
    """Machine-readable productization contract for agent integrators and reviewers."""
    return {
        "ok": True,
        "service": "signalforge",
        "job": "Pre-action evidence gate for market agents: verify evidence quality, reveal decision fragility, return a bounded Decision Packet, or refuse when evidence is insufficient.",
        "contract_version": DECISION_CONTRACT_VERSION,
        "policy_version": POLICY_VERSION,
        "agent_native": {
            "rest_api": True,
            "tool_contracts_ready": True,
            "mcp_transport_included": True,
            "mcp_endpoint": "/mcp",
            "mcp_protocol_version": MCP_PROTOCOL_VERSION,
            "mcp_state_model": "stateless",
            "side_effects": "none",
            "execution_authority": "none",
        },
        "authority_boundary": {
            "signalforge": "research_only",
            "execution_authorized": False,
            "external_execution_authority_required": True,
        },
        "state_model": {
            "decision_packet": "stateless_live_read_with_tamper_evident_receipt",
            "stateless_compare": "caller_supplied_baseline",
            "delta_convenience_endpoint": "process_local_memory_non_durable",
            "decision_stress": "bounded_counterfactual_dropout_of_observed_evidence",
            "receipt_verification": "stateless_no_market_fetch",
            "validation": "stateless_bounded_historical_calibration",
            "resilience_benchmark": "deterministic_controlled_policy_conformance",
            "mcp": "stateless_request_response",
        },
        "differentiators": {
            "lineage_concentration": "Maps each available signal to raw inputs and providers without claiming statistical independence.",
            "decision_fragility": "Measures refusal boundaries under single-channel and provider dropouts without inventing replacement values.",
            "recovery_requirements": "Returns necessary recovery conditions while explicitly refusing to claim they guarantee a directional handoff.",
            "decision_receipt": "Binds material Decision Packet fields to a SHA-256 digest for later integrity verification.",
        },
        "tools": [
            {
                "name": "get_decision_packet",
                "method": "GET",
                "path": "/api/v1/decision/{token}",
                "mcp_tool": "get_decision_packet",
                "input": {"token": "uppercase asset symbol, 2-10 alphanumeric characters"},
                "output": "Evidence-bound Decision Packet with provenance, lineage concentration, recovery requirements, receipt, and safe next action.",
                "side_effects": "none",
            },
            {
                "name": "compare_decision_packet",
                "method": "POST",
                "path": "/api/v1/decision/{token}/compare",
                "mcp_tool": "compare_decision_packet",
                "input": {"token": "asset symbol", "body": "prior SignalForge Decision Packet"},
                "output": "Stateless material-change comparison against a fresh live packet.",
                "side_effects": "none",
            },
            {
                "name": "stress_test_decision",
                "method": "GET",
                "path": "/api/v1/decision/{token}/stress",
                "mcp_tool": "stress_test_decision",
                "input": {"token": "asset symbol"},
                "output": "Single-channel and provider-dropout fragility analysis over currently observed evidence.",
                "side_effects": "none",
            },
            {
                "name": "verify_decision_receipt",
                "method": "POST",
                "path": "/api/v1/decision/verify-receipt",
                "mcp_tool": "verify_decision_receipt",
                "input": {"body": "Decision Packet containing its embedded receipt"},
                "output": "SHA-256 integrity verification without a market-data fetch.",
                "side_effects": "none",
            },
            {
                "name": "validate_price_derived_signals",
                "method": "GET",
                "path": "/api/v1/validation/{token}?period_days=120&horizon_days=3",
                "mcp_tool": "validate_price_signals",
                "output": "Bounded 3-of-5 calibration; never represented as full-composite validation.",
                "side_effects": "none",
            },
            {
                "name": "inspect_negative_path",
                "method": "GET",
                "path": "/api/v1/evidence/negative-path",
                "mcp_tool": "inspect_negative_path",
                "output": "Real external failure record plus controlled refusal proof.",
                "side_effects": "none",
            },
            {
                "name": "run_evidence_resilience_benchmark",
                "method": "GET",
                "path": "/api/v1/evidence/resilience-benchmark",
                "mcp_tool": "run_evidence_resilience_benchmark",
                "output": "Deterministic policy-conformance benchmark across healthy and degraded evidence states.",
                "side_effects": "none",
            },
        ],
        "safe_failure_contract": {
            "insufficient_evidence": "REFRESH_EVIDENCE",
            "hold_band": "OBSERVE_ONLY",
            "actionable_research": "RESEARCH_HANDOFF",
            "all_paths_execution_authorized": False,
            "restored_availability_guarantees_handoff": False,
        },
    }
