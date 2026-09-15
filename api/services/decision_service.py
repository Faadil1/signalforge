from __future__ import annotations

import hashlib
import json
from copy import deepcopy

from services.evidence_intelligence import (
    build_decision_receipt,
    build_decision_stress_test,
    build_evidence_lease,
    build_lineage_analysis,
    build_recovery_requirements,
)
from services.signal_service import get_signal_payload

DECISION_CONTRACT_VERSION = "1.1"
POLICY_VERSION = "evidence-gate-2026-09"
_last_decisions: dict[str, dict] = {}


def _clear_decisions() -> None:
    _last_decisions.clear()


def _regime(payload: dict) -> str:
    by_name = {s["name"]: s for s in payload.get("sub_signals", [])}
    trend_value = float(by_name.get("trend", {}).get("value", 50.0))
    technical_value = float(by_name.get("technical", {}).get("value", 50.0))
    if trend_value >= 60 and technical_value >= 55:
        return "trending_bullish"
    if trend_value <= 40 and technical_value <= 45:
        return "trending_bearish"
    if abs(trend_value - 50) <= 8:
        return "range_or_mixed"
    return "transition"


def _evidence(payload: dict) -> dict:
    score = float(payload.get("score", 50.0))
    bullish = score >= 60
    bearish = score < 40
    supporting, contradicting, neutral = [], [], []
    for signal in payload.get("sub_signals", []):
        if not signal.get("available"):
            continue
        value = float(signal.get("value", 50.0))
        item = {
            "name": signal.get("name"),
            "value": value,
            "confidence": signal.get("confidence"),
            "reason": signal.get("reason"),
        }
        if bullish:
            target = supporting if value >= 55 else contradicting if value <= 45 else neutral
        elif bearish:
            target = supporting if value <= 45 else contradicting if value >= 55 else neutral
        else:
            target = neutral
        target.append(item)
    supporting.sort(key=lambda x: abs(float(x["value"]) - 50), reverse=True)
    contradicting.sort(key=lambda x: abs(float(x["value"]) - 50), reverse=True)
    return {"supporting": supporting, "contradicting": contradicting, "neutral": neutral}


def _invalidation(payload: dict) -> list[str]:
    if payload.get("actionability") == "insufficient_evidence":
        return ["Coverage must remain at or above 60%.", "Confidence must remain at or above 40%."]
    score = float(payload.get("score", 50.0))
    if score >= 60:
        return ["Composite score falls below 60.", "Confidence falls below 40%."]
    if score < 40:
        return ["Composite score rises to 40 or above.", "Confidence falls below 40%."]
    return ["Composite score exits the 40-59 hold band.", "Confidence falls below 40%."]


def _agent_next_action(packet: dict) -> dict:
    actionability = packet.get("actionability")
    if actionability == "insufficient_evidence":
        return {
            "code": "REFRESH_EVIDENCE",
            "reason": "Evidence coverage or confidence is below policy threshold.",
            "safe_for_agent": True,
            "execution_authorized": False,
        }
    if actionability == "observe":
        return {
            "code": "OBSERVE_ONLY",
            "reason": "Evidence is usable but the composite remains in the hold band.",
            "safe_for_agent": True,
            "execution_authorized": False,
        }
    return {
        "code": "RESEARCH_HANDOFF",
        "reason": "Evidence is sufficient for a research handoff; external authority is still required for execution.",
        "safe_for_agent": True,
        "execution_authorized": False,
    }


def _snapshot_id(packet: dict) -> str:
    canonical = json.dumps(
        {
            "token": packet["token"],
            "timestamp": packet["timestamp"],
            "score": packet["score"],
            "confidence": packet["confidence"],
            "evidence": packet["evidence"],
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def _comparison_error(code: str, message: str) -> dict:
    return {"ok": False, "error": {"code": code, "message": message}}


def _validated_signal_map(packet: dict, *, label: str) -> tuple[dict[str, dict] | None, dict | None]:
    evidence = packet.get("evidence")
    if not isinstance(evidence, dict):
        return None, _comparison_error("INVALID_BASELINE", f"{label} evidence must be an object.")

    expected_groups = ("supporting", "contradicting", "neutral")
    signals: dict[str, dict] = {}
    item_count = 0
    for group_name in expected_groups:
        group = evidence.get(group_name)
        if not isinstance(group, list):
            return None, _comparison_error(
                "INVALID_BASELINE",
                f"{label} evidence.{group_name} must be a list.",
            )
        item_count += len(group)
        if item_count > 15:
            return None, _comparison_error("INVALID_BASELINE", f"{label} contains too many evidence items.")
        for item in group:
            if not isinstance(item, dict):
                return None, _comparison_error("INVALID_BASELINE", f"{label} evidence items must be objects.")
            name = item.get("name")
            if not isinstance(name, str) or not name or len(name) > 64:
                return None, _comparison_error("INVALID_BASELINE", f"{label} evidence item name is invalid.")
            try:
                value = float(item.get("value"))
            except (TypeError, ValueError):
                return None, _comparison_error("INVALID_BASELINE", f"{label} evidence value for {name} is invalid.")
            signals[name] = {**item, "value": value}
    return signals, None


async def get_decision_packet(token: str) -> dict:
    payload = await get_signal_payload(token)
    if not payload.get("ok"):
        return payload

    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    packet = {
        "ok": True,
        "contract_version": DECISION_CONTRACT_VERSION,
        "policy_version": POLICY_VERSION,
        "token": payload["token"],
        "stance": payload.get("recommendation") or "insufficient_evidence",
        "score": payload["score"],
        "confidence": payload["confidence"],
        "coverage": payload["coverage"],
        "actionability": payload["actionability"],
        "execution_authorized": False,
        "authority_boundary": {
            "signalforge_authority": "research_only",
            "external_execution_authority_required": True,
        },
        "horizon": "1-3d",
        "regime": _regime(payload),
        "evidence": _evidence(payload),
        "data_quality": {
            "mode": payload.get("data_mode", "unknown"),
            "provider": source_meta.get("provider", "unknown"),
            "sources": source_meta.get("sources", {}),
            "freshness": source_meta.get("freshness", {}),
            "quality_summary": source_meta.get("quality_summary", {}),
            "observed_at": source_meta.get("observed_at"),
            "fallback_active": bool(source_meta.get("fallback_active", False)),
            "primary_provider": source_meta.get("primary_provider"),
            "fallback_provider": source_meta.get("fallback_provider"),
        },
        "evidence_lineage": build_lineage_analysis(payload),
        "evidence_lease": build_evidence_lease(payload),
        "recovery_requirements": build_recovery_requirements(payload),
        "invalidation": _invalidation(payload),
        "timestamp": payload["timestamp"],
        "disclaimer": "Research signal only. No execution authority and not financial advice.",
    }
    packet["agent_next_action"] = _agent_next_action(packet)
    packet["snapshot_id"] = _snapshot_id(packet)
    packet["receipt"] = build_decision_receipt(packet)
    return packet


async def get_decision_stress_test(token: str) -> dict:
    payload = await get_signal_payload(token)
    if not payload.get("ok"):
        return payload
    return build_decision_stress_test(payload)


def compare_decision_packets(previous: dict, current: dict, *, persistence: str = "caller_supplied_baseline") -> dict:
    if not isinstance(previous, dict) or not isinstance(current, dict):
        return _comparison_error("INVALID_BASELINE", "Decision packets must be objects.")
    if not current.get("ok"):
        return current

    symbol = current.get("token")
    previous_symbol = previous.get("token", symbol)
    if previous_symbol != symbol:
        return _comparison_error("TOKEN_MISMATCH", "Baseline token must match current token.")

    required = ("score", "stance", "actionability", "evidence", "snapshot_id")
    if any(key not in previous for key in required):
        return _comparison_error("INVALID_BASELINE", "Baseline must be a prior SignalForge Decision Packet.")

    baseline_version = previous.get("contract_version")
    if baseline_version not in {None, DECISION_CONTRACT_VERSION}:
        return _comparison_error(
            "BASELINE_CONTRACT_VERSION_MISMATCH",
            f"Baseline contract version {baseline_version!r} is not compatible with {DECISION_CONTRACT_VERSION}.",
        )

    old_signals, old_error = _validated_signal_map(previous, label="Baseline")
    if old_error:
        return old_error
    new_signals, new_error = _validated_signal_map(current, label="Current packet")
    if new_error:
        return new_error
    assert old_signals is not None
    assert new_signals is not None

    try:
        previous_score = float(previous["score"])
        current_score = float(current["score"])
    except (TypeError, ValueError):
        return _comparison_error("INVALID_BASELINE", "Decision packet scores must be numeric.")

    changed_drivers = []
    for name in sorted(set(old_signals) | set(new_signals)):
        old_value = float(old_signals.get(name, {}).get("value", 50.0))
        new_value = float(new_signals.get(name, {}).get("value", 50.0))
        delta = round(new_value - old_value, 2)
        if abs(delta) >= 5:
            changed_drivers.append({"name": name, "from": old_value, "to": new_value, "delta": delta})

    score_delta = round(current_score - previous_score, 2)
    stance_changed = current["stance"] != previous["stance"]
    actionability_changed = current["actionability"] != previous["actionability"]
    material_change = (
        abs(score_delta) >= 5
        or any(abs(float(x["delta"])) >= 10 for x in changed_drivers)
        or stance_changed
        or actionability_changed
    )
    return {
        "ok": True,
        "contract_version": DECISION_CONTRACT_VERSION,
        "baseline_contract_version": baseline_version or "legacy_unversioned",
        "token": symbol,
        "baseline_established": False,
        "material_change": material_change,
        "current_snapshot_id": current["snapshot_id"],
        "previous_snapshot_id": previous["snapshot_id"],
        "score_delta": score_delta,
        "changed_drivers": changed_drivers,
        "stance_changed": stance_changed,
        "actionability_changed": actionability_changed,
        "persistence": persistence,
        "execution_authorized": False,
    }


async def compare_with_live_decision(token: str, baseline: dict) -> dict:
    current = await get_decision_packet(token)
    return compare_decision_packets(baseline, current, persistence="caller_supplied_baseline")


async def get_signal_delta(token: str) -> dict:
    current = await get_decision_packet(token)
    if not current.get("ok"):
        return current
    symbol = current["token"]
    previous = _last_decisions.get(symbol)
    _last_decisions[symbol] = deepcopy(current)
    if previous is None:
        return {
            "ok": True,
            "contract_version": DECISION_CONTRACT_VERSION,
            "token": symbol,
            "baseline_established": True,
            "material_change": False,
            "current_snapshot_id": current["snapshot_id"],
            "previous_snapshot_id": None,
            "score_delta": 0.0,
            "changed_drivers": [],
            "stance_changed": False,
            "actionability_changed": False,
            "persistence": "process_memory",
            "execution_authorized": False,
        }
    return compare_decision_packets(previous, current, persistence="process_memory")
