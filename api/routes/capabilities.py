from __future__ import annotations

from fastapi import APIRouter

from services.decision_service import DECISION_CONTRACT_VERSION, POLICY_VERSION

router = APIRouter(tags=["agent-contract"])


@router.get("/capabilities")
async def capabilities():
    """Machine-readable productization contract for agent integrators and reviewers."""
    return {
        "ok": True,
        "service": "signalforge",
        "job": "Pre-action evidence gate for market agents: verify evidence quality, return a bounded Decision Packet, or refuse when evidence is insufficient.",
        "contract_version": DECISION_CONTRACT_VERSION,
        "policy_version": POLICY_VERSION,
        "agent_native": {
            "rest_api": True,
            "tool_contracts_ready": True,
            "mcp_transport_included": False,
            "side_effects": "none",
            "execution_authority": "none",
        },
        "authority_boundary": {
            "signalforge": "research_only",
            "execution_authorized": False,
            "external_execution_authority_required": True,
        },
        "state_model": {
            "decision_packet": "stateless_live_read",
            "stateless_compare": "caller_supplied_baseline",
            "delta_convenience_endpoint": "process_local_memory_non_durable",
            "validation": "stateless_bounded_historical_calibration",
            "resilience_benchmark": "deterministic_controlled_policy_conformance",
        },
        "tools": [
            {
                "name": "get_decision_packet",
                "method": "GET",
                "path": "/api/v1/decision/{token}",
                "input": {"token": "uppercase asset symbol, 2-10 alphanumeric characters"},
                "output": "Evidence-bound Decision Packet with provenance, coverage, confidence, invalidation and next action.",
                "side_effects": "none",
            },
            {
                "name": "compare_decision_packet",
                "method": "POST",
                "path": "/api/v1/decision/{token}/compare",
                "input": {"token": "asset symbol", "body": "prior SignalForge Decision Packet"},
                "output": "Stateless material-change comparison against a fresh live packet.",
                "side_effects": "none",
            },
            {
                "name": "validate_price_derived_signals",
                "method": "GET",
                "path": "/api/v1/validation/{token}?period_days=120&horizon_days=3",
                "output": "Bounded 3-of-5 calibration; never represented as full-composite validation.",
                "side_effects": "none",
            },
            {
                "name": "inspect_negative_path",
                "method": "GET",
                "path": "/api/v1/evidence/negative-path",
                "output": "Real external failure record plus controlled refusal proof.",
                "side_effects": "none",
            },
            {
                "name": "run_evidence_resilience_benchmark",
                "method": "GET",
                "path": "/api/v1/evidence/resilience-benchmark",
                "output": "Deterministic policy-conformance benchmark across healthy and degraded evidence states.",
                "side_effects": "none",
            },
        ],
        "safe_failure_contract": {
            "insufficient_evidence": "REFRESH_EVIDENCE",
            "hold_band": "OBSERVE_ONLY",
            "actionable_research": "RESEARCH_HANDOFF",
            "all_paths_execution_authorized": False,
        },
    }
