from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

SIGNAL_WEIGHTS = {
    "technical": 0.25,
    "trend": 0.25,
    "open_interest": 0.15,
    "funding": 0.20,
    "volume": 0.15,
}

SIGNAL_WEIGHTS_SUM = sum(SIGNAL_WEIGHTS.values())

SIGNAL_META = {
    "technical": {"name": "Technical", "description": "RSI + moving-average structure from daily klines"},
    "trend": {"name": "Trend", "description": "Price direction, higher-high/lower-low structure"},
    "funding": {"name": "Funding", "description": "Funding-rate extreme detection (crowding)"},
    "open_interest": {
        "name": "Open Interest",
        "description": "Positioning intensity contextualized by price direction",
    },
    "volume": {"name": "Volume", "description": "Directional volume surge vs. 10-day average"},
}

SignalName = Literal["technical", "trend", "open_interest", "funding", "volume"]
Recommendation = Literal[
    "strong_buy",
    "buy",
    "hold",
    "sell",
    "strong_sell",
    "insufficient_evidence",
]
Actionability = Literal["actionable", "observe", "insufficient_evidence"]
DataMode = Literal["live", "live_partial", "mock", "historical_proxy", "unknown"]


@dataclass
class SubSignal:
    name: SignalName
    value: float
    confidence: float
    available: bool
    reason: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompositeSignal:
    token: str
    price: float
    score: float
    confidence: float
    sub_signals: list[SubSignal]
    recommendation: Recommendation
    timestamp: str
    available_signals: int = 0
    total_signals: int = 5
    coverage: float = 0.0
    actionability: Actionability = "insufficient_evidence"
    execution_authorized: bool = False
    data_mode: DataMode = "unknown"
    source_meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class RawSignalBundle:
    """Raw source responses plus explicit provenance metadata."""

    symbol: str
    klines: list[dict] = field(default_factory=list)
    ticker: dict = field(default_factory=dict)
    open_interest: dict = field(default_factory=dict)
    funding: dict | None = None
    source_meta: dict[str, Any] = field(default_factory=dict)
