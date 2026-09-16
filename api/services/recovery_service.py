from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from services.decision_service import DECISION_CONTRACT_VERSION, POLICY_VERSION, get_decision_packet
from services.signal_fusion import MIN_ACTIONABLE_CONFIDENCE, MIN_ACTIONABLE_COVERAGE

SIGNAL_POLICY_CONFIDENCE = {
    "technical": 0.70,
    "trend": 0.60,
    "funding": 0.55,
    "open_interest": 0.45,
    "volume": 0.50,
}

SIGNAL_SOURCE_DEPENDENCIES = {
    "technical": ["klines"],
    "trend": ["klines", "ticker"],
    "funding": ["funding"],
    "open_interest": ["open_interest", "ticker"],
    "volume": ["klines", "ticker"],
}

SOURCE_MAX_AGE_SECONDS = {
    "ticker": 300,
    "klines": 129600,
    "open_interest": 300,
    "funding": 900,
}


def _available_signals(packet: dict[str, Any]) -> dict[str, dict[str, Any]]:
    evidence = packet.get("evidence") or {}
    available: dict[str, dict[str, Any]] = {}
    for group_name in ("supporting", "contradicting", "neutral"):
        for item in evidence.get(group_name, []) if isinstance(evidence.get(group_name), list) else []:
            if isinstance(item, dict) and isinstance(item.get("name"), str):
                available[item["name"]] = item
    return available


def _source_state(packet: dict[str, Any], source: str) -> str:
    quality = packet.get("data_quality") or {}
    freshness = quality.get("freshness") or {}
    freshness_item = freshness.get(source) if isinstance(freshness, dict) else None
    if isinstance(freshness_item, dict) and isinstance(freshness_item.get("status"), str):
        return freshness_item["status"]

    summary = quality.get("quality_summary") or {}
    if isinstance(summary, dict):
        for key, state in (
            ("mock_sources", "mock"),
            ("stale_sources", "stale"),
            ("unavailable_sources", "unavailable"),
            ("unknown_sources", "unknown"),
            ("inconsistent_sources", "inconsistent"),
            ("healthy_sources", "fresh"),
        ):
            values = summary.get(key)
            if isinstance(values, list) and source in values:
                return state

    sources = quality.get("sources") or {}
    value = sources.get(source) if isinstance(sources, dict) else None
    if value in {"unavailable", "stale", "unknown", "inconsistent", "mock"}:
        return str(value)
    if value:
        return "fresh"
    return "unknown"


def _receipt_id(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:24]


def build_recovery_plan(packet: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(packet, dict) or not packet.get("ok"):
        return {"ok": False, "error": {"code": "INVALID_DECISION_PACKET", "message": "A valid Decision Packet is required."}}

    available = _available_signals(packet)
    all_signals = list(SIGNAL_POLICY_CONFIDENCE)
    unavailable = [name for name in all_signals if name not in available]
    coverage = float(packet.get("coverage", 0.0) or 0.0)
    confidence = float(packet.get("confidence", 0.0) or 0.0)

    coverage_gap = round(max(0.0, MIN_ACTIONABLE_COVERAGE - coverage), 3)
    confidence_gap = round(max(0.0, MIN_ACTIONABLE_CONFIDENCE - confidence), 3)
    minimum_additional_signals_for_coverage = max(0, math.ceil(coverage_gap * len(all_signals) - 1e-9))

    blocking_conditions: list[dict[str, Any]] = []
    if coverage < MIN_ACTIONABLE_COVERAGE:
        blocking_conditions.append(
            {
                "code": "COVERAGE_BELOW_POLICY",
                "observed": coverage,
                "required": MIN_ACTIONABLE_COVERAGE,
                "gap": coverage_gap,
            }
        )
    if confidence < MIN_ACTIONABLE_CONFIDENCE:
        blocking_conditions.append(
            {
                "code": "CONFIDENCE_BELOW_POLICY",
                "observed": confidence,
                "required": MIN_ACTIONABLE_CONFIDENCE,
                "gap": confidence_gap,
            }
        )

    recovery_candidates = []
    for signal_name in unavailable:
        dependencies = SIGNAL_SOURCE_DEPENDENCIES[signal_name]
        source_requirements = [
            {
                "source": source,
                "current_state": _source_state(packet, source),
                "required_state": "fresh_and_consistent",
                "max_age_seconds": SOURCE_MAX_AGE_SECONDS.get(source),
            }
            for source in dependencies
        ]
        recovery_candidates.append(
            {
                "signal": signal_name,
                "policy_confidence_if_usable": SIGNAL_POLICY_CONFIDENCE[signal_name],
                "coverage_contribution": round(1.0 / len(all_signals), 3),
                "source_requirements": source_requirements,
                "safe_action": "REACQUIRE_AND_REEVALUATE",
            }
        )

    recovery_candidates.sort(
        key=lambda item: (
            sum(1 for req in item["source_requirements"] if req["current_state"] != "fresh"),
            -float(item["policy_confidence_if_usable"]),
            item["signal"],
        )
    )

    status = "refused" if packet.get("actionability") == "insufficient_evidence" else "not_refused"
    if status == "refused" and unavailable:
        next_action = "REACQUIRE_MINIMUM_EVIDENCE_THEN_REEVALUATE"
    elif status == "refused":
        next_action = "REFRESH_CURRENT_EVIDENCE_THEN_REEVALUATE"
    else:
        next_action = "NO_RECOVERY_REQUIRED"

    receipt_basis = {
        "contract_version": DECISION_CONTRACT_VERSION,
        "policy_version": POLICY_VERSION,
        "token": packet.get("token"),
        "snapshot_id": packet.get("snapshot_id"),
        "actionability": packet.get("actionability"),
        "coverage": coverage,
        "confidence": confidence,
        "blocking_conditions": blocking_conditions,
        "unavailable_signals": unavailable,
    }

    return {
        "ok": True,
        "contract": "refusal_recovery_v1",
        "contract_version": DECISION_CONTRACT_VERSION,
        "policy_version": POLICY_VERSION,
        "token": packet.get("token"),
        "decision_snapshot_id": packet.get("snapshot_id"),
        "status": status,
        "execution_authorized": False,
        "evidence_debt": {
            "coverage": coverage,
            "required_coverage": MIN_ACTIONABLE_COVERAGE,
            "coverage_gap": coverage_gap,
            "confidence": confidence,
            "required_confidence": MIN_ACTIONABLE_CONFIDENCE,
            "confidence_gap": confidence_gap,
            "unavailable_signals": unavailable,
            "minimum_additional_signals_for_coverage_only": minimum_additional_signals_for_coverage,
        },
        "blocking_conditions": blocking_conditions,
        "recovery_candidates": recovery_candidates,
        "next_safe_action": next_action,
        "re_evaluate_after": "Only after required sources are reacquired and pass freshness/consistency gating.",
        "non_guarantees": [
            "Recovery does not guarantee that confidence will pass the policy threshold.",
            "Recovery does not guarantee a directional recommendation.",
            "Recovery never grants execution authority.",
            "SignalForge does not synthesize missing funding or open-interest evidence.",
        ],
        "refusal_receipt_id": _receipt_id(receipt_basis),
        "receipt_basis": receipt_basis,
    }


def verify_recovery_progress(previous_plan: dict[str, Any], current_packet: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(previous_plan, dict) or previous_plan.get("contract") != "refusal_recovery_v1":
        return {"ok": False, "error": {"code": "INVALID_RECOVERY_BASELINE", "message": "A prior refusal_recovery_v1 plan is required."}}
    if not isinstance(current_packet, dict) or not current_packet.get("ok"):
        return {"ok": False, "error": {"code": "INVALID_DECISION_PACKET", "message": "A valid current Decision Packet is required."}}
    if previous_plan.get("token") != current_packet.get("token"):
        return {"ok": False, "error": {"code": "TOKEN_MISMATCH", "message": "Recovery baseline token must match the current Decision Packet."}}

    current_plan = build_recovery_plan(current_packet)
    previous_debt = previous_plan.get("evidence_debt") if isinstance(previous_plan.get("evidence_debt"), dict) else {}
    current_debt = current_plan.get("evidence_debt") if isinstance(current_plan.get("evidence_debt"), dict) else {}

    previous_unavailable = set(previous_debt.get("unavailable_signals") or [])
    current_unavailable = set(current_debt.get("unavailable_signals") or [])
    recovered_signals = sorted(previous_unavailable - current_unavailable)
    newly_unavailable = sorted(current_unavailable - previous_unavailable)

    previous_coverage_gap = float(previous_debt.get("coverage_gap", 0.0) or 0.0)
    current_coverage_gap = float(current_debt.get("coverage_gap", 0.0) or 0.0)
    previous_confidence_gap = float(previous_debt.get("confidence_gap", 0.0) or 0.0)
    current_confidence_gap = float(current_debt.get("confidence_gap", 0.0) or 0.0)

    previous_blockers = {item.get("code") for item in previous_plan.get("blocking_conditions", []) if isinstance(item, dict)}
    current_blockers = {item.get("code") for item in current_plan.get("blocking_conditions", []) if isinstance(item, dict)}
    resolved_blockers = sorted(code for code in previous_blockers - current_blockers if code)
    new_blockers = sorted(code for code in current_blockers - previous_blockers if code)

    debt_reduced = (
        current_coverage_gap < previous_coverage_gap
        or current_confidence_gap < previous_confidence_gap
        or len(current_unavailable) < len(previous_unavailable)
    )
    debt_increased = (
        current_coverage_gap > previous_coverage_gap
        or current_confidence_gap > previous_confidence_gap
        or len(current_unavailable) > len(previous_unavailable)
    )
    policy_gate_passed = current_packet.get("actionability") != "insufficient_evidence"

    if policy_gate_passed:
        status = "policy_gate_recovered"
    elif debt_reduced and not debt_increased:
        status = "improved_but_still_refused"
    elif debt_increased:
        status = "degraded_since_refusal"
    else:
        status = "unchanged_refusal"

    return {
        "ok": True,
        "contract": "recovery_verification_v1",
        "token": current_packet.get("token"),
        "prior_refusal_receipt_id": previous_plan.get("refusal_receipt_id"),
        "current_refusal_receipt_id": current_plan.get("refusal_receipt_id"),
        "prior_decision_snapshot_id": previous_plan.get("decision_snapshot_id"),
        "current_decision_snapshot_id": current_packet.get("snapshot_id"),
        "status": status,
        "evidence_repair_observed": bool(debt_reduced or resolved_blockers or recovered_signals),
        "policy_gate_passed": policy_gate_passed,
        "execution_authorized": False,
        "delta": {
            "coverage_gap": round(current_coverage_gap - previous_coverage_gap, 3),
            "confidence_gap": round(current_confidence_gap - previous_confidence_gap, 3),
            "recovered_signals": recovered_signals,
            "newly_unavailable_signals": newly_unavailable,
            "resolved_blockers": resolved_blockers,
            "new_blockers": new_blockers,
        },
        "current_actionability": current_packet.get("actionability"),
        "next_safe_action": (
            "RESEARCH_HANDOFF_REQUIRES_EXTERNAL_AUTHORITY"
            if policy_gate_passed
            else current_plan.get("next_safe_action")
        ),
        "non_guarantees": [
            "Evidence repair does not imply a profitable or correct market direction.",
            "A passed policy gate does not grant execution authority.",
            "Recovery verification compares observed evidence-policy state only; it is not a historical replay or causal proof.",
        ],
    }


async def get_recovery_plan(token: str) -> dict[str, Any]:
    packet = await get_decision_packet(token)
    if not packet.get("ok"):
        return packet
    return build_recovery_plan(packet)


async def verify_live_recovery(token: str, previous_plan: dict[str, Any]) -> dict[str, Any]:
    packet = await get_decision_packet(token)
    if not packet.get("ok"):
        return packet
    return verify_recovery_progress(previous_plan, packet)
