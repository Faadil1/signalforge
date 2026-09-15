from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from models.responses import (
    ErrorDetail,
    HistoryResponse,
    MarketCards,
    RecommendationThresholdOut,
    SignalCard,
    SignalError,
    SignalMetaOut,
    SignalResponse,
    SignalsBatch,
    SignalsMetaResponse,
)
from models.signal import SIGNAL_META, SIGNAL_WEIGHTS, SIGNAL_WEIGHTS_SUM
from services.config import get_settings
from services.errors import INVALID_TOKEN, SIGNAL_FETCH_FAILED, TOO_MANY_TOKENS, error_token_payload
from services.rate_limit import rate_limit
from services.signal_fusion import BUY_THRESHOLD, SELL_THRESHOLD, STRONG_BUY_THRESHOLD, STRONG_SELL_THRESHOLD
from services.signal_service import get_candle_history, get_signal_payload
from services.symbols import is_valid_token, normalize_token

router = APIRouter(tags=["signals"])
DEFAULT_TOKENS = ["BTC", "ETH", "SOL"]
OVERVIEW_TOKENS = ["BTC", "ETH", "SOL", "BNB", "XRP"]


async def _signal_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="signal")


async def _overview_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="overview")


def _card_from_payload(payload: dict) -> SignalCard:
    if payload["ok"]:
        return SignalCard(
            ok=True,
            token=payload["token"],
            price=payload["price"],
            score=payload["score"],
            confidence=payload["confidence"],
            recommendation=payload["recommendation"],
            actionability=payload.get("actionability"),
            data_mode=payload.get("data_mode"),
        )
    return SignalCard(
        ok=False,
        token=payload["token"],
        error=ErrorDetail(code=payload["error"]["code"], message=payload["error"]["message"]),
    )


@router.get("/signal/{token}", response_model=SignalResponse, dependencies=[Depends(_signal_rate_limited)])
async def get_signal(token: str) -> SignalError | dict:
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        raise HTTPException(
            status_code=422,
            detail=error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$"),
        )
    payload = await get_signal_payload(symbol)
    if payload["ok"]:
        return payload
    code = payload["error"]["code"]
    raise HTTPException(status_code=502 if code == SIGNAL_FETCH_FAILED else 500, detail=payload)


@router.get("/signals/meta", response_model=SignalsMetaResponse)
async def get_signals_meta() -> SignalsMetaResponse:
    signals = [
        SignalMetaOut(
            key=key,
            name=SIGNAL_META[key]["name"],
            weight=SIGNAL_WEIGHTS[key],
            description=SIGNAL_META[key]["description"],
        )
        for key in SIGNAL_WEIGHTS
    ]
    thresholds = [
        RecommendationThresholdOut(
            recommendation="strong_sell",
            min_score=0.0,
            max_score=float(STRONG_SELL_THRESHOLD),
        ),
        RecommendationThresholdOut(
            recommendation="sell",
            min_score=float(STRONG_SELL_THRESHOLD),
            max_score=float(SELL_THRESHOLD),
        ),
        RecommendationThresholdOut(
            recommendation="hold",
            min_score=float(SELL_THRESHOLD),
            max_score=float(BUY_THRESHOLD),
        ),
        RecommendationThresholdOut(
            recommendation="buy",
            min_score=float(BUY_THRESHOLD),
            max_score=float(STRONG_BUY_THRESHOLD),
        ),
        RecommendationThresholdOut(
            recommendation="strong_buy",
            min_score=float(STRONG_BUY_THRESHOLD),
            max_score=100.0,
        ),
    ]
    return SignalsMetaResponse(
        signal_count=len(signals),
        total_weight=SIGNAL_WEIGHTS_SUM,
        signals=signals,
        recommendation_thresholds=thresholds,
    )


@router.get("/signals", response_model=SignalsBatch, dependencies=[Depends(_signal_rate_limited)])
async def get_all_signals(tokens: str = Query(default=",".join(DEFAULT_TOKENS))) -> SignalsBatch:
    settings = get_settings()
    raw = [t for t in (tokens or "").split(",") if t.strip()]
    if not raw:
        raise HTTPException(
            status_code=422,
            detail=error_token_payload("", INVALID_TOKEN, "Provide at least one token"),
        )
    normalized = list(dict.fromkeys(normalize_token(t) for t in raw))
    if len(normalized) > settings.max_batch_tokens:
        raise HTTPException(
            status_code=422,
            detail=error_token_payload(
                ",".join(normalized),
                TOO_MANY_TOKENS,
                f"Too many tokens: {len(normalized)} (max {settings.max_batch_tokens})",
            ),
        )

    async def _one(token: str) -> SignalCard:
        if not is_valid_token(token):
            return _card_from_payload(
                error_token_payload(token, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
            )
        return _card_from_payload(await get_signal_payload(token))

    cards = await asyncio.gather(*(_one(t) for t in normalized))
    return SignalsBatch(signals=list(cards), count=len(cards))


@router.get("/overview", response_model=MarketCards, dependencies=[Depends(_overview_rate_limited)])
async def get_overview() -> MarketCards:
    async def _one(token: str) -> SignalCard:
        return _card_from_payload(await get_signal_payload(token))

    cards = await asyncio.gather(*(_one(t) for t in OVERVIEW_TOKENS))
    return MarketCards(market_cards=list(cards))


@router.get("/signal/{token}/history", response_model=HistoryResponse)
async def get_signal_history(token: str, days: int = Query(default=30, ge=1, le=90)) -> HistoryResponse:
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        raise HTTPException(
            status_code=422,
            detail=error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$"),
        )
    try:
        history = await get_candle_history(symbol, days)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=error_token_payload(symbol, SIGNAL_FETCH_FAILED, f"Upstream data unavailable: {exc}"),
        ) from exc
    return HistoryResponse(token=symbol, history=history)
