from __future__ import annotations

import hashlib
import json
from copy import deepcopy

from services.signal_service import get_signal_payload

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
        item = {"name": signal.get("name"), "value": value, "confidence": signal.get("confidence"), "reason": signal.get("reason")}
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


def _snapshot_id(packet: dict) -> str:
    canonical = json.dumps({"token": packet["token"], "timestamp": packet["timestamp"], "score": packet["score"], "confidence": packet["confidence"], "evidence": packet["evidence"]}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


async def get_decision_packet(token: str) -> dict:
    payload = await get_signal_payload(token)
    if not payload.get("ok"):
        return payload
    packet = {
        "ok": True,
        "token": payload["token"],
        "stance": payload.get("recommendation") or "insufficient_evidence",
        "score": payload["score"],
        "confidence": payload["confidence"],
        "coverage": payload["coverage"],
        "actionability": payload["actionability"],
        "execution_authorized": False,
        "horizon": "1-3d",
        "regime": _regime(payload),
        "evidence": _evidence(payload),
        "data_quality": {
            "mode": payload.get("data_mode", "unknown"),
            "provider": payload.get("source_meta", {}).get("provider", "unknown"),
            "sources": payload.get("source_meta", {}).get("sources", {}),
            "observed_at": payload.get("source_meta", {}).get("observed_at"),
        },
        "invalidation": _invalidation(payload),
        "timestamp": payload["timestamp"],
        "disclaimer": "Research signal only. No execution authority and not financial advice.",
    }
    packet["snapshot_id"] = _snapshot_id(packet)
    return packet


async def get_signal_delta(token: str) -> dict:
    current = await get_decision_packet(token)
    if not current.get("ok"):
        return current
    symbol = current["token"]
    previous = _last_decisions.get(symbol)
    _last_decisions[symbol] = deepcopy(current)
    if previous is None:
        return {"ok": True, "token": symbol, "baseline_established": True, "material_change": False, "current_snapshot_id": current["snapshot_id"], "previous_snapshot_id": None, "score_delta": 0.0, "changed_drivers": [], "stance_changed": False, "actionability_changed": False, "persistence": "process_memory"}
    old_signals = {item["name"]: item for group in previous["evidence"].values() for item in group}
    new_signals = {item["name"]: item for group in current["evidence"].values() for item in group}
    changed_drivers = []
    for name in sorted(set(old_signals) | set(new_signals)):
        old_value = float(old_signals.get(name, {}).get("value", 50.0))
        new_value = float(new_signals.get(name, {}).get("value", 50.0))
        delta = round(new_value - old_value, 2)
        if abs(delta) >= 5:
            changed_drivers.append({"name": name, "from": old_value, "to": new_value, "delta": delta})
    score_delta = round(float(current["score"]) - float(previous["score"]), 2)
    stance_changed = current["stance"] != previous["stance"]
    actionability_changed = current["actionability"] != previous["actionability"]
    material_change = abs(score_delta) >= 5 or any(abs(float(x["delta"])) >= 10 for x in changed_drivers) or stance_changed or actionability_changed
    return {"ok": True, "token": symbol, "baseline_established": False, "material_change": material_change, "current_snapshot_id": current["snapshot_id"], "previous_snapshot_id": previous["snapshot_id"], "score_delta": score_delta, "changed_drivers": changed_drivers, "stance_changed": stance_changed, "actionability_changed": actionability_changed, "persistence": "process_memory"}
