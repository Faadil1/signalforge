from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from models.responses import (
    ErrorDetail,
    HistoryResponse,
    MarketCards,
    SignalCard,
    SignalError,
    SignalResponse,
    SignalsBatch,
)
from services.config import get_settings
from services.errors import INVALID_TOKEN, SIGNAL_FETCH_FAILED, TOO_MANY_TOKENS, error_token_payload
from services.rate_limit import rate_limit
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
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)

    payload = await get_signal_payload(symbol)
    if payload["ok"]:
        return payload

    code = payload["error"]["code"]
    status = 502 if code == SIGNAL_FETCH_FAILED else 500
    raise HTTPException(status_code=status, detail=payload)


@router.get("/signals", response_model=SignalsBatch, dependencies=[Depends(_signal_rate_limited)])
async def get_all_signals(tokens: str = Query(default=",".join(DEFAULT_TOKENS))) -> SignalsBatch:
    settings = get_settings()
    raw = [t for t in (tokens or "").split(",") if t.strip()]
    if not raw:
        error = error_token_payload("", INVALID_TOKEN, "Provide at least one token")
        raise HTTPException(status_code=422, detail=error)

    normalized = list(dict.fromkeys(normalize_token(t) for t in raw))
    if len(normalized) > settings.max_batch_tokens:
        error = error_token_payload(
            ",".join(normalized),
            TOO_MANY_TOKENS,
            f"Too many tokens: {len(normalized)} (max {settings.max_batch_tokens})",
        )
        raise HTTPException(status_code=422, detail=error)

    async def _one(token: str) -> SignalCard:
        if not is_valid_token(token):
            inv = error_token_payload(token, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
            return _card_from_payload(inv)
        payload = await get_signal_payload(token)
        return _card_from_payload(payload)

    cards = await asyncio.gather(*(_one(t) for t in normalized))
    return SignalsBatch(signals=list(cards), count=len(cards))


@router.get("/overview", response_model=MarketCards, dependencies=[Depends(_overview_rate_limited)])
async def get_overview() -> MarketCards:
    async def _one(token: str) -> SignalCard:
        payload = await get_signal_payload(token)
        return _card_from_payload(payload)

    cards = await asyncio.gather(*(_one(t) for t in OVERVIEW_TOKENS))
    return MarketCards(market_cards=list(cards))


@router.get("/signal/{token}/history", response_model=HistoryResponse)
async def get_signal_history(token: str, days: int = Query(default=30, ge=1, le=90)) -> HistoryResponse:
    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)
    try:
        history = await get_candle_history(symbol, days)
    except Exception as exc:
        error = error_token_payload(symbol, SIGNAL_FETCH_FAILED, f"Upstream data unavailable: {exc}")
        raise HTTPException(status_code=502, detail=error) from exc
    return HistoryResponse(token=symbol, history=history)
