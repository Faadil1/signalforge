from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class SubSignalOut(BaseModel):
    name: str
    value: float
    confidence: float
    available: bool
    reason: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class SignalError(BaseModel):
    ok: Literal[False] = False
    token: str
    error: ErrorDetail


class SignalOk(BaseModel):
    ok: Literal[True] = True
    token: str
    price: float
    score: float
    confidence: float
    recommendation: str
    timestamp: str
    available_signals: int
    total_signals: int
    coverage: float
    sub_signals: list[SubSignalOut]


SignalResponse = Annotated[SignalOk | SignalError, Field(discriminator="ok")]


class SignalCard(BaseModel):
    ok: bool
    token: str
    price: float | None = None
    score: float | None = None
    confidence: float | None = None
    recommendation: str | None = None
    error: ErrorDetail | None = None


class SignalsBatch(BaseModel):
    signals: list[SignalCard]
    count: int


class MarketCards(BaseModel):
    market_cards: list[SignalCard]


class HistoryPoint(BaseModel):
    date: str
    close: float
    high: float
    low: float
    volume: float


class HistoryResponse(BaseModel):
    token: str
    history: list[HistoryPoint]


class SignalMetaOut(BaseModel):
    key: str
    name: str
    weight: float
    description: str


class RecommendationThresholdOut(BaseModel):
    recommendation: str
    min_score: float
    max_score: float


class SignalsMetaResponse(BaseModel):
    signal_count: int
    total_weight: float
    signals: list[SignalMetaOut]
    recommendation_thresholds: list[RecommendationThresholdOut]


class TickerOut(BaseModel):
    token: str
    symbol: str
    price: float
    price_change_pct: float
    high: float
    low: float
    volume: float
    quote_volume: float
    source: str
    timestamp: str


class TickersResponse(BaseModel):
    ok: bool
    source: str
    fetched_at: str
    tickers: list[TickerOut]
