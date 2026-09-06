from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

StrategyType = Literal["momentum", "mean_reversion", "sentiment_flow"]


@dataclass
class StrategyMetrics:
    total_return: str
    sharpe_ratio: float
    max_drawdown: str
    win_rate: str
    total_trades: int
    avg_trade_duration: str


@dataclass
class BacktestResult:
    strategy: StrategyType
    token: str
    period: str
    metrics: StrategyMetrics
    equity_curve: list[dict] = field(default_factory=list)
    trades: list[dict] = field(default_factory=list)


@dataclass
class StrategyMeta:
    id: StrategyType
    name: str
    description: str
    signal_weights: dict[str, float]
