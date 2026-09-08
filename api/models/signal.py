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
    "technical": {
        "name": "Technical",
        "description": "RSI + moving-average structure from daily klines",
    },
    "trend": {
        "name": "Trend",
        "description": "Price direction, higher-high/lower-low structure",
    },
    "funding": {
        "name": "Funding",
        "description": "Funding-rate extreme detection (crowding)",
    },
    "open_interest": {
        "name": "Open Interest",
        "description": "Positioning crowdedness vs. volume",
    },
    "volume": {
        "name": "Volume",
        "description": "Volume surge vs. 10-day average",
    },
}

SignalName = Literal["technical", "trend", "open_interest", "funding", "volume"]

Recommendation = Literal["strong_buy", "buy", "hold", "sell", "strong_sell"]


@dataclass
class SubSignal:
    name: SignalName
    value: float  # 0-100 normalized
    confidence: float  # 0-1
    available: bool  # whether a real source contributed
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


@dataclass
class RawSignalBundle:
    """Real (untransformed) responses fetched from Binance public API."""

    symbol: str
    klines: list[dict] = field(default_factory=list)
    ticker: dict = field(default_factory=dict)
    open_interest: dict = field(default_factory=dict)
    funding: dict | None = None
