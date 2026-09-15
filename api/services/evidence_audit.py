from __future__ import annotations

from typing import Any

from services.evidence_intelligence import SIGNAL_RAW_DEPENDENCIES

RAW_SOURCE_ORDER = ("ticker", "klines", "open_interest", "funding")


def build_admission_ledger(payload: dict[str, Any]) -> dict[str, Any]:
    """Explain which raw evidence entered the current decision and which did not.

    Admission is intentionally stricter than provider availability: a source must
    pass the freshness gate and actually support at least one currently available
    sub-signal to count as admitted evidence for the Decision Packet.
    """
    source_meta = payload.get("source_meta", {}) if isinstance(payload.get("source_meta"), dict) else {}
    sources = source_meta.get("sources", {}) if isinstance(source_meta.get("sources"), dict) else {}
    freshness = source_meta.get("freshness", {}) if isinstance(source_meta.get("freshness"), dict) else {}
    sub_signals = {
        str(item.get("name")): item
        for item in payload.get("sub_signals", [])
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    }

    entries: list[dict[str, Any]] = []
    for raw_source in RAW_SOURCE_ORDER:
        record = freshness.get(raw_source) if isinstance(freshness.get(raw_source), dict) else {}
        status = str(record.get("status", "unknown"))
        dependent_signals = sorted(name for name, deps in SIGNAL_RAW_DEPENDENCIES.items() if raw_source in deps)
        admitted_signals = sorted(
            name for name in dependent_signals if sub_signals.get(name, {}).get("available") is True
        )

        quality_admitted = status == "fresh"
        decision_admitted = quality_admitted and bool(admitted_signals)
        if decision_admitted:
            reason_code = "ADMITTED"
        elif not quality_admitted:
            reason_code = f"QUALITY_{status.upper()}"
        else:
            reason_code = "NO_AVAILABLE_SIGNAL_DEPENDENCY"

        entries.append(
            {
                "raw_source": raw_source,
                "provider": sources.get(raw_source, "unknown"),
                "freshness_status": status,
                "age_seconds": record.get("age_seconds"),
                "max_age_seconds": record.get("max_age_seconds"),
                "source_timestamp": record.get("source_timestamp"),
                "received_at": record.get("received_at"),
                "dependent_signals": dependent_signals,
                "admitted_signals": admitted_signals,
                "quality_admitted": quality_admitted,
                "decision_admitted": decision_admitted,
                "reason_code": reason_code,
            }
        )

    admitted = [entry["raw_source"] for entry in entries if entry["decision_admitted"]]
    excluded = [entry["raw_source"] for entry in entries if not entry["decision_admitted"]]
    return {
        "policy": "freshness_gate_then_signal_dependency_v1",
        "entries": entries,
        "admitted_raw_sources": admitted,
        "excluded_raw_sources": excluded,
        "admitted_count": len(admitted),
        "excluded_count": len(excluded),
        "execution_authorized": False,
        "epistemic_boundary": (
            "Admission means the raw source passed the current evidence-quality gate and contributes to at least "
            "one available signal. It does not imply provider independence, predictive validity, or execution authority."
        ),
    }
