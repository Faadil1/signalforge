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


async def get_recovery_plan(token: str) -> dict[str, Any]:
    packet = await get_decision_packet(token)
    if not packet.get("ok"):
        return packet
    return build_recovery_plan(packet)
