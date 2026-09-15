from __future__ import annotations

import itertools
from typing import Any

from services.evidence_intelligence import _signal_map, _state_after_removal


def build_minimum_sufficient_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    """Find smallest observed signal subsets that still pass the current policy.

    The calculation reuses only currently observed sub-signal values. It is a
    policy-sufficiency diagnostic, not a causal claim and not a guarantee that
    the same subset will remain sufficient after market values change.
    """
    signals = _signal_map(payload)
    available = sorted(name for name, item in signals.items() if item.get("available") is True)
    baseline_actionability = payload.get("actionability", "insufficient_evidence")

    if baseline_actionability == "insufficient_evidence":
        return {
            "baseline_policy_passes": False,
            "minimum_signal_count": None,
            "minimum_sufficient_signal_sets": [],
            "scope": "current_observed_values_only",
            "causal_sufficiency_claimed": False,
            "future_sufficiency_guaranteed": False,
            "execution_authorized": False,
        }

    sufficient: list[dict[str, Any]] = []
    all_available = set(available)
    minimum_size: int | None = None
    for size in range(1, len(available) + 1):
        for subset in itertools.combinations(available, size):
            removed = all_available - set(subset)
            state = _state_after_removal(payload, removed)
            if state["actionability"] != "insufficient_evidence":
                sufficient.append(
                    {
                        "signals": list(subset),
                        "resulting_actionability": state["actionability"],
                        "resulting_recommendation": state["recommendation"],
                        "coverage": state["coverage"],
                        "confidence": state["confidence"],
                        "score": state["score"],
                    }
                )
        if sufficient:
            minimum_size = size
            break

    return {
        "baseline_policy_passes": True,
        "minimum_signal_count": minimum_size,
        "minimum_sufficient_signal_sets": sufficient,
        "scope": "current_observed_values_only",
        "causal_sufficiency_claimed": False,
        "future_sufficiency_guaranteed": False,
        "execution_authorized": False,
    }
