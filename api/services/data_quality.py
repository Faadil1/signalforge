from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

FRESHNESS_LIMIT_SECONDS = {
    "ticker": 300,
    "klines": 129600,
    "open_interest": 300,
    "funding": 900,
}

_ALLOWED_HEALTHY = {"fresh", "mock"}


def _coerce_epoch_ms(value: Any) -> int | None:
    try:
        if value is None:
            return None
        result = int(value)
        return result if result > 0 else None
    except (TypeError, ValueError):
        return None


def assess_freshness(
    source: str,
    source_timestamp_ms: Any,
    *,
    now: datetime | None = None,
    provider_state: str = "live",
) -> dict[str, Any]:
    """Classify one evidence source without hiding uncertainty.

    `provider_state` may be `live`, `mock` or `unavailable`. Mock evidence is
    explicitly labelled and never confused with fresh live evidence.
    """
    limit = FRESHNESS_LIMIT_SECONDS[source]
    observed_at = now or datetime.now(UTC)

    if provider_state == "unavailable":
        return {
            "status": "unavailable",
            "source_timestamp": None,
            "received_at": observed_at.isoformat(),
            "age_seconds": None,
            "max_age_seconds": limit,
        }
    if provider_state == "mock":
        return {
            "status": "mock",
            "source_timestamp": None,
            "received_at": observed_at.isoformat(),
            "age_seconds": None,
            "max_age_seconds": limit,
        }

    epoch_ms = _coerce_epoch_ms(source_timestamp_ms)
    if epoch_ms is None:
        return {
            "status": "unknown",
            "source_timestamp": None,
            "received_at": observed_at.isoformat(),
            "age_seconds": None,
            "max_age_seconds": limit,
        }

    source_dt = datetime.fromtimestamp(epoch_ms / 1000, tz=UTC)
    age_seconds = (observed_at - source_dt).total_seconds()
    if age_seconds < -60:
        status = "inconsistent"
    elif age_seconds > limit:
        status = "stale"
    else:
        status = "fresh"

    return {
        "status": status,
        "source_timestamp": source_dt.isoformat(),
        "received_at": observed_at.isoformat(),
        "age_seconds": round(age_seconds, 3),
        "max_age_seconds": limit,
    }


def is_usable_quality(record: dict[str, Any] | None) -> bool:
    if not record:
        return False
    return record.get("status") in _ALLOWED_HEALTHY


def source_timestamp_ms(source: str, payload: Any) -> int | None:
    """Extract the source-side timestamp used by the freshness policy."""
    if source == "ticker" and isinstance(payload, dict):
        return _coerce_epoch_ms(payload.get("close_time"))
    if source == "klines" and isinstance(payload, list) and payload:
        latest = payload[-1]
        if isinstance(latest, dict):
            return _coerce_epoch_ms(latest.get("open_time"))
    if source == "open_interest" and isinstance(payload, dict):
        return _coerce_epoch_ms(payload.get("time"))
    if source == "funding" and isinstance(payload, dict):
        return _coerce_epoch_ms(payload.get("time"))
    return None


def summarize_quality(freshness: dict[str, dict[str, Any]]) -> dict[str, Any]:
    buckets: dict[str, list[str]] = {
        "fresh": [],
        "stale": [],
        "unavailable": [],
        "unknown": [],
        "inconsistent": [],
        "mock": [],
    }
    for source, record in freshness.items():
        status = str(record.get("status", "unknown"))
        buckets.setdefault(status, []).append(source)
    return {
        "healthy_sources": sorted(buckets["fresh"]),
        "mock_sources": sorted(buckets["mock"]),
        "stale_sources": sorted(buckets["stale"]),
        "unavailable_sources": sorted(buckets["unavailable"]),
        "unknown_sources": sorted(buckets["unknown"]),
        "inconsistent_sources": sorted(buckets["inconsistent"]),
    }
