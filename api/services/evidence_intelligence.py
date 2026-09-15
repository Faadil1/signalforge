from __future__ import annotations

import hashlib
import itertools
import json
import math
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from models.signal import SIGNAL_WEIGHTS
from services.signal_fusion import (
    BUY_THRESHOLD,
    MIN_ACTIONABLE_CONFIDENCE,
    MIN_ACTIONABLE_COVERAGE,
    SELL_THRESHOLD,
    STRONG_BUY_THRESHOLD,
    STRONG_SELL_THRESHOLD,
)

SIGNAL_RAW_DEPENDENCIES: dict[str, tuple[str, ...]] = {
    "technical": ("klines",),
    "trend": ("klines", "ticker"),
    "funding": ("funding",),
    "open_interest": ("open_interest", "ticker"),
    "volume": ("klines", "ticker"),
}
SIGNAL_RAW_DEPENDENCIES_RAW_INPUTS = {
    raw_input for dependencies in SIGNAL_RAW_DEPENDENCIES.values() for raw_input in dependencies
}

NON_LIVE_PROVIDERS = {"unavailable", "unknown", "mock", ""}
RECEIPT_VERSION = "decision-receipt-v1"
RECEIPT_ALGORITHM = "sha256"


def _recommendation(score: float) -> str:
    if score >= STRONG_BUY_THRESHOLD:
        return "strong_buy"
    if score >= BUY_THRESHOLD:
        return "buy"
    if score >= SELL_THRESHOLD:
        return "hold"
    if score >= STRONG_SELL_THRESHOLD:
        return "sell"
    return "strong_sell"


def _signal_map(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("name")): item
        for item in payload.get("sub_signals", [])
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    }


def _live_provider(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return None if normalized in NON_LIVE_PROVIDERS else normalized


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _lineage_for_signal(name: str, sources: dict[str, Any]) -> dict[str, Any]:
    raw_inputs = SIGNAL_RAW_DEPENDENCIES.get(name, ())
    providers: set[str] = set()
    raw_lineage: list[dict[str, Any]] = []
    for raw_input in raw_inputs:
        source_value = sources.get(raw_input, "unknown")
        provider = _live_provider(source_value)
        if provider:
            providers.add(provider)
        raw_lineage.append(
            {
                "raw_input": raw_input,
                "provider": source_value,
                "live_provider": provider is not None,
            }
        )
    return {
        "signal": name,
        "raw_inputs": list(raw_inputs),
        "providers": sorted(providers),
        "raw_lineage": raw_lineage,
    }


def build_lineage_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    """Describe shared provider lineage without claiming statistical independence."""
    signals = _signal_map(payload)
    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    sources = source_meta.get("sources", {}) if isinstance(source_meta.get("sources"), dict) else {}

    available_names = sorted(name for name, item in signals.items() if item.get("available") is True)
    lineages = [_lineage_for_signal(name, sources) for name in available_names]

    provider_signal_counts: Counter[str] = Counter()
    lineage_groups: defaultdict[tuple[str, ...], list[str]] = defaultdict(list)
    for lineage in lineages:
        providers = tuple(lineage["providers"])
        lineage_groups[providers].append(lineage["signal"])
        for provider in providers:
            provider_signal_counts[provider] += 1

    available_count = len(available_names)
    dominant_provider = None
    dominant_count = 0
    if provider_signal_counts:
        dominant_provider, dominant_count = provider_signal_counts.most_common(1)[0]
    concentration_ratio = round(dominant_count / available_count, 3) if available_count else 0.0

    if available_count <= 1:
        concentration_level = "insufficient_diversity_to_assess"
    elif concentration_ratio >= 0.8:
        concentration_level = "high"
    elif concentration_ratio >= 0.6:
        concentration_level = "moderate"
    else:
        concentration_level = "distributed"

    shared_lineages = [
        {"providers": list(providers), "signals": sorted(names), "signal_count": len(names)}
        for providers, names in sorted(lineage_groups.items(), key=lambda item: (str(item[0]), item[1]))
        if len(names) > 1
    ]

    return {
        "scope": "provider_and_raw_input_lineage_not_statistical_independence",
        "available_signals": available_names,
        "signal_lineage": lineages,
        "raw_source_providers": {
            key: sources.get(key, "unknown") for key in sorted(SIGNAL_RAW_DEPENDENCIES_RAW_INPUTS)
        },
        "unique_live_providers": sorted(provider_signal_counts),
        "provider_signal_counts": dict(sorted(provider_signal_counts.items())),
        "dominant_provider": dominant_provider,
        "dominant_provider_signal_share": concentration_ratio,
        "concentration_level": concentration_level,
        "shared_lineages": shared_lineages,
        "independence_claimed": False,
        "policy_effect": "diagnostic_only_not_an_actionability_gate",
    }


def _contributing_raw_inputs(payload: dict[str, Any]) -> list[str]:
    signals = _signal_map(payload)
    raw_inputs: set[str] = set()
    for name, item in signals.items():
        if item.get("available") is True:
            raw_inputs.update(SIGNAL_RAW_DEPENDENCIES.get(name, ()))
    return sorted(raw_inputs)


def build_evidence_lease(payload: dict[str, Any]) -> dict[str, Any]:
    """Bound the current evidence set by its earliest contributing source deadline.

    This is an evidence-freshness lease, not a forecast-validity guarantee. It
    only states how long the already-admitted raw evidence remains within its
    configured freshness budget if no newer observation arrives.
    """
    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    freshness = source_meta.get("freshness", {}) if isinstance(source_meta.get("freshness"), dict) else {}
    contributing = _contributing_raw_inputs(payload)

    if not contributing:
        return {
            "status": "unknown",
            "valid_until": None,
            "remaining_seconds": None,
            "limiting_raw_source": None,
            "contributing_raw_sources": [],
            "source_deadlines": [],
            "freshness_only": True,
            "forecast_validity_guaranteed": False,
            "execution_authorized": False,
            "reason": "No admitted evidence sources are available to establish a freshness lease.",
        }

    deadlines: list[dict[str, Any]] = []
    evaluation_times: list[datetime] = []
    uncertain_sources: list[str] = []
    expired_sources: list[str] = []

    for raw_input in contributing:
        record = freshness.get(raw_input)
        if not isinstance(record, dict):
            uncertain_sources.append(raw_input)
            continue

        status = str(record.get("status", "unknown"))
        source_timestamp = _parse_iso(record.get("source_timestamp"))
        received_at = _parse_iso(record.get("received_at"))
        try:
            max_age_seconds = float(record.get("max_age_seconds"))
        except (TypeError, ValueError):
            max_age_seconds = -1.0

        if received_at:
            evaluation_times.append(received_at)
        if status != "fresh":
            if status == "stale":
                expired_sources.append(raw_input)
            else:
                uncertain_sources.append(raw_input)
            continue
        if source_timestamp is None or max_age_seconds < 0:
            uncertain_sources.append(raw_input)
            continue

        deadline = source_timestamp + timedelta(seconds=max_age_seconds)
        deadlines.append(
            {
                "raw_source": raw_input,
                "source_timestamp": source_timestamp.isoformat(),
                "max_age_seconds": max_age_seconds,
                "valid_until": deadline.isoformat(),
            }
        )

    if expired_sources:
        return {
            "status": "expired",
            "valid_until": None,
            "remaining_seconds": 0.0,
            "limiting_raw_source": sorted(expired_sources)[0],
            "contributing_raw_sources": contributing,
            "source_deadlines": deadlines,
            "freshness_only": True,
            "forecast_validity_guaranteed": False,
            "execution_authorized": False,
            "reason": "At least one admitted raw source is already outside its freshness budget.",
        }

    if uncertain_sources or len(deadlines) != len(contributing):
        return {
            "status": "unknown",
            "valid_until": None,
            "remaining_seconds": None,
            "limiting_raw_source": None,
            "contributing_raw_sources": contributing,
            "source_deadlines": deadlines,
            "uncertain_raw_sources": sorted(set(uncertain_sources)),
            "freshness_only": True,
            "forecast_validity_guaranteed": False,
            "execution_authorized": False,
            "reason": "A complete freshness deadline cannot be proven for every admitted raw source.",
        }

    limiting = min(deadlines, key=lambda item: item["valid_until"])
    valid_until = _parse_iso(limiting["valid_until"])
    evaluation_at = max(evaluation_times) if evaluation_times else None
    if valid_until is None or evaluation_at is None:
        return {
            "status": "unknown",
            "valid_until": None,
            "remaining_seconds": None,
            "limiting_raw_source": None,
            "contributing_raw_sources": contributing,
            "source_deadlines": deadlines,
            "freshness_only": True,
            "forecast_validity_guaranteed": False,
            "execution_authorized": False,
            "reason": "Freshness timestamps are incomplete.",
        }

    remaining = round((valid_until - evaluation_at).total_seconds(), 3)
    status = "valid" if remaining >= 0 else "expired"
    return {
        "status": status,
        "evaluated_at": evaluation_at.isoformat(),
        "valid_until": valid_until.isoformat(),
        "remaining_seconds": max(0.0, remaining),
        "limiting_raw_source": limiting["raw_source"],
        "contributing_raw_sources": contributing,
        "source_deadlines": sorted(deadlines, key=lambda item: item["raw_source"]),
        "freshness_only": True,
        "forecast_validity_guaranteed": False,
        "execution_authorized": False,
        "reason": (
            "Lease is bounded by the earliest freshness deadline among raw inputs that currently contribute "
            "to admitted signals."
        ),
    }


def build_recovery_requirements(payload: dict[str, Any]) -> dict[str, Any]:
    """Return necessary recovery conditions without pretending they guarantee a pass."""
    signals = _signal_map(payload)
    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    sources = source_meta.get("sources", {}) if isinstance(source_meta.get("sources"), dict) else {}
    freshness = source_meta.get("freshness", {}) if isinstance(source_meta.get("freshness"), dict) else {}

    available_count = sum(1 for item in signals.values() if item.get("available") is True)
    coverage = float(payload.get("coverage", 0.0) or 0.0)
    confidence = float(payload.get("confidence", 0.0) or 0.0)
    coverage_gap = round(max(0.0, MIN_ACTIONABLE_COVERAGE - coverage), 3)
    confidence_gap = round(max(0.0, MIN_ACTIONABLE_CONFIDENCE - confidence), 3)
    minimum_count_for_coverage = math.ceil(MIN_ACTIONABLE_COVERAGE * len(SIGNAL_WEIGHTS))
    minimum_additional_channels = max(0, minimum_count_for_coverage - available_count)

    missing = []
    for name in sorted(SIGNAL_WEIGHTS):
        item = signals.get(name, {})
        if item.get("available") is True:
            continue
        deps = []
        for raw_input in SIGNAL_RAW_DEPENDENCIES.get(name, ()):
            deps.append(
                {
                    "raw_input": raw_input,
                    "provider": sources.get(raw_input, "unknown"),
                    "freshness_status": (
                        freshness.get(raw_input, {}).get("status", "unknown")
                        if isinstance(freshness.get(raw_input), dict)
                        else "unknown"
                    ),
                }
            )
        missing.append(
            {
                "signal": name,
                "weight": SIGNAL_WEIGHTS[name],
                "reason": item.get("reason", "Signal unavailable"),
                "required_raw_inputs": deps,
            }
        )

    necessary_conditions = []
    if coverage_gap > 0:
        necessary_conditions.append(
            {
                "condition": "restore_usable_channel_coverage",
                "minimum_additional_channels": minimum_additional_channels,
                "target_coverage": MIN_ACTIONABLE_COVERAGE,
            }
        )
    if confidence_gap > 0:
        necessary_conditions.append(
            {
                "condition": "raise_adjusted_confidence_with_real_evidence",
                "confidence_gap": confidence_gap,
                "target_adjusted_confidence": MIN_ACTIONABLE_CONFIDENCE,
            }
        )

    return {
        "current_actionability": payload.get("actionability", "insufficient_evidence"),
        "coverage_gate": {
            "current": round(coverage, 3),
            "minimum": MIN_ACTIONABLE_COVERAGE,
            "met": coverage >= MIN_ACTIONABLE_COVERAGE,
            "gap": coverage_gap,
        },
        "confidence_gate": {
            "current": round(confidence, 3),
            "minimum": MIN_ACTIONABLE_CONFIDENCE,
            "met": confidence >= MIN_ACTIONABLE_CONFIDENCE,
            "gap": confidence_gap,
        },
        "missing_signals": missing,
        "necessary_conditions": necessary_conditions,
        "guaranteed_recovery": False,
        "epistemic_boundary": (
            "Restoring availability is necessary in some states but never guarantees a directional handoff: "
            "future signal values and confidence are unknown until real evidence is observed."
        ),
    }


def _state_after_removal(payload: dict[str, Any], removed: set[str]) -> dict[str, Any]:
    signals = _signal_map(payload)
    remaining = [item for name, item in signals.items() if item.get("available") is True and name not in removed]
    available_count = len(remaining)
    coverage = available_count / len(SIGNAL_WEIGHTS) if SIGNAL_WEIGHTS else 0.0

    weighted_sum = 0.0
    available_weight = 0.0
    confidences: list[float] = []
    for item in remaining:
        name = str(item["name"])
        weight = float(SIGNAL_WEIGHTS.get(name, 0.0))
        weighted_sum += float(item.get("value", 50.0)) * weight
        available_weight += weight
        confidences.append(float(item.get("confidence", 0.0)))

    score = weighted_sum / available_weight if available_weight else 50.0
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    adjusted_confidence = average_confidence * coverage
    raw_recommendation = _recommendation(score)
    if coverage < MIN_ACTIONABLE_COVERAGE or adjusted_confidence < MIN_ACTIONABLE_CONFIDENCE:
        recommendation = "insufficient_evidence"
        actionability = "insufficient_evidence"
    else:
        recommendation = raw_recommendation
        actionability = "observe" if raw_recommendation == "hold" else "actionable"

    return {
        "removed_signals": sorted(removed),
        "remaining_signals": sorted(str(item["name"]) for item in remaining),
        "score": round(score, 2),
        "confidence": round(adjusted_confidence, 3),
        "coverage": round(coverage, 3),
        "recommendation": recommendation,
        "actionability": actionability,
        "execution_authorized": False,
    }


def build_decision_stress_test(payload: dict[str, Any]) -> dict[str, Any]:
    """Measure decision fragility using bounded dropouts of already-observed evidence."""
    signals = _signal_map(payload)
    available_names = sorted(name for name, item in signals.items() if item.get("available") is True)
    baseline = {
        "recommendation": payload.get("recommendation"),
        "actionability": payload.get("actionability"),
        "score": payload.get("score"),
        "confidence": payload.get("confidence"),
        "coverage": payload.get("coverage"),
        "available_signals": available_names,
        "execution_authorized": False,
    }

    single_dropouts = []
    for name in available_names:
        state = _state_after_removal(payload, {name})
        state["causes_refusal"] = state["actionability"] == "insufficient_evidence"
        state["changes_recommendation"] = state["recommendation"] != baseline["recommendation"]
        single_dropouts.append(state)

    minimum_dropouts_to_refusal: int | None = None
    refusal_sets: list[list[str]] = []
    if baseline["actionability"] != "insufficient_evidence":
        for size in range(1, len(available_names) + 1):
            for combo in itertools.combinations(available_names, size):
                state = _state_after_removal(payload, set(combo))
                if state["actionability"] == "insufficient_evidence":
                    minimum_dropouts_to_refusal = size
                    refusal_sets.append(list(combo))
            if refusal_sets:
                break

    lineage = build_lineage_analysis(payload)
    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    sources = source_meta.get("sources", {}) if isinstance(source_meta.get("sources"), dict) else {}
    provider_dropouts = []
    for provider in lineage["unique_live_providers"]:
        impacted_signals = set()
        impacted_raw_inputs = {raw_input for raw_input, value in sources.items() if value == provider}
        for name in available_names:
            dependencies = set(SIGNAL_RAW_DEPENDENCIES.get(name, ()))
            if dependencies & impacted_raw_inputs:
                impacted_signals.add(name)
        state = _state_after_removal(payload, impacted_signals)
        provider_dropouts.append(
            {
                "provider": provider,
                "impacted_raw_inputs": sorted(impacted_raw_inputs),
                "impacted_signals": sorted(impacted_signals),
                "result": state,
                "causes_refusal": state["actionability"] == "insufficient_evidence",
            }
        )

    if baseline["actionability"] == "insufficient_evidence":
        fragility_class = "already_refusing"
    elif minimum_dropouts_to_refusal == 1:
        fragility_class = "single_channel_fragile"
    elif minimum_dropouts_to_refusal == 2:
        fragility_class = "two_channel_fragile"
    elif minimum_dropouts_to_refusal is None:
        fragility_class = "no_refusal_boundary_found"
    else:
        fragility_class = "multi_channel_resilient"

    return {
        "ok": True,
        "scope": "counterfactual_dropout_of_currently_observed_subsignals_not_market_replay",
        "token": payload.get("token"),
        "baseline": baseline,
        "fragility_class": fragility_class,
        "minimum_dropouts_to_refusal": minimum_dropouts_to_refusal,
        "minimum_refusal_sets": refusal_sets,
        "single_channel_dropouts": single_dropouts,
        "provider_dropouts": provider_dropouts,
        "lineage": lineage,
        "evidence_lease": build_evidence_lease(payload),
        "recovery_requirements": build_recovery_requirements(payload),
        "limitations": [
            "Dropout tests remove already-observed evidence; they do not invent replacement values.",
            "Provider concentration is a lineage diagnostic, not a claim that channels are statistically independent or correlated.",
            "The evidence lease bounds source freshness only; it does not guarantee market or forecast validity.",
            "This stress test does not measure trading profitability or historical incident prevention.",
        ],
        "execution_authorized": False,
    }


def _receipt_payload(packet: dict[str, Any]) -> dict[str, Any]:
    fields = (
        "contract_version",
        "policy_version",
        "token",
        "snapshot_id",
        "stance",
        "score",
        "confidence",
        "coverage",
        "actionability",
        "execution_authorized",
        "authority_boundary",
        "regime",
        "evidence",
        "data_quality",
        "evidence_lineage",
        "evidence_lease",
        "recovery_requirements",
        "invalidation",
        "agent_next_action",
        "timestamp",
    )
    return {field: deepcopy(packet.get(field)) for field in fields}


def build_decision_receipt(packet: dict[str, Any]) -> dict[str, Any]:
    canonical_payload = _receipt_payload(packet)
    canonical = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {
        "version": RECEIPT_VERSION,
        "algorithm": RECEIPT_ALGORITHM,
        "canonicalization": "json_sorted_keys_compact_utf8_v1",
        "digest": digest,
        "bound_fields": list(canonical_payload),
    }


def verify_decision_receipt(packet: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(packet, dict):
        return {
            "ok": False,
            "valid": False,
            "error": {"code": "INVALID_PACKET", "message": "Packet must be an object."},
        }
    receipt = packet.get("receipt")
    if not isinstance(receipt, dict):
        return {
            "ok": False,
            "valid": False,
            "error": {"code": "MISSING_RECEIPT", "message": "Decision receipt is required."},
        }
    if receipt.get("version") != RECEIPT_VERSION or receipt.get("algorithm") != RECEIPT_ALGORITHM:
        return {
            "ok": False,
            "valid": False,
            "error": {"code": "UNSUPPORTED_RECEIPT", "message": "Unsupported decision receipt version or algorithm."},
        }
    expected = build_decision_receipt(packet)
    supplied_digest = receipt.get("digest")
    valid = isinstance(supplied_digest, str) and supplied_digest == expected["digest"]
    return {
        "ok": True,
        "valid": valid,
        "receipt_version": RECEIPT_VERSION,
        "algorithm": RECEIPT_ALGORITHM,
        "expected_digest": expected["digest"],
        "supplied_digest": supplied_digest,
        "execution_authorized": False,
    }
