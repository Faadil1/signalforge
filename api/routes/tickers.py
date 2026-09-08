from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request

from models.responses import TickerOut, TickersResponse
from routes.signals import OVERVIEW_TOKENS
from services.binance_client import BinancePublicError, binance
from services.cache import get_cache
from services.config import get_settings
from services.rate_limit import rate_limit

router = APIRouter(tags=["tickers"])
logger = logging.getLogger(__name__)

_LAST_KEY = "ticker:last"


async def _ticker_rate_limited(request: Request) -> None:
    await rate_limit(request, tier="ticker")


def _last_key(symbol: str) -> str:
    return f"{_LAST_KEY}:{symbol}"


def _flatten(data: dict) -> dict:
    """Normalize a Binance ticker dict into the shape we serve (as floats)."""
    return {
        "token": data.get("token", data.get("symbol", "").replace("USDT", "")),
        "symbol": data.get("symbol", ""),
        "last_price": float(data.get("last_price") or 0.0),
        "price_change_pct": float(data.get("price_change_pct") or 0.0),
        "high": float(data.get("high") or 0.0),
        "low": float(data.get("low") or 0.0),
        "volume": float(data.get("volume") or 0.0),
        "quote_volume": float(data.get("quote_volume") or 0.0),
        "source": str(data.get("source") or "binance"),
    }


async def _fetch_ticker(symbol: str) -> dict[str, Any]:
    """Return one token's ticker, preferring a live Binance read.

    On upstream failure we serve the last known good snapshot (so the board
    keeps moving from real data) and only fall back to mock values for tokens
    we have never managed to reach.
    """
    settings = get_settings()
    cache = get_cache(settings.cache_max_entries)
    key = f"ticker:{symbol}"

    cached, hit = cache.get(key)
    if hit:
        return cached

    async def factory() -> tuple[dict, float]:
        try:
            data = await binance.get_ticker(symbol)
        except BinancePublicError:
            known, known_hit = cache.get(_last_key(symbol))
            if known_hit:
                return {**known, "source": "last_known"}, settings.error_cache_ttl
            logger.warning("Ticker unavailable for %s — using mock data", symbol)
            mock = binance.generate_mock_ticker(symbol)
            return {**mock, "source": "mock"}, settings.ticker_cache_ttl

        value = _flatten(data)
        cache.set(_last_key(symbol), value, ttl=3600)
        return value, settings.ticker_cache_ttl

    value, _from_cache = await cache.get_or_set(key, factory)
    return value


@router.get("/market/tickers", response_model=TickersResponse, dependencies=[Depends(_ticker_rate_limited)])
async def get_market_tickers() -> TickersResponse:
    raw = await asyncio.gather(*(_fetch_ticker(sym) for sym in OVERVIEW_TOKENS))
    fetched_at = datetime.now(UTC).isoformat()

    tickers = [
        TickerOut(
            token=symbol,
            symbol=data["symbol"] or f"{symbol}USDT",
            price=data["last_price"],
            price_change_pct=data["price_change_pct"],
            high=data["high"],
            low=data["low"],
            volume=data["volume"],
            quote_volume=data["quote_volume"],
            source=data["source"],
            timestamp=fetched_at,
        )
        for symbol, data in zip(OVERVIEW_TOKENS, raw, strict=True)
    ]

    source_kind = "live" if any(t.source.startswith("binance") for t in tickers) else "fallback"
    return TickersResponse(ok=True, source=source_kind, fetched_at=fetched_at, tickers=tickers)


@router.get("/market/tickers/{token}", response_model=TickerOut, dependencies=[Depends(_ticker_rate_limited)])
async def get_token_ticker(token: str) -> TickerOut:
    from fastapi import HTTPException

    from services.errors import INVALID_TOKEN, error_token_payload
    from services.symbols import is_valid_token, normalize_token

    symbol = normalize_token(token)
    if not is_valid_token(symbol):
        error = error_token_payload(symbol, INVALID_TOKEN, "Token must match ^[A-Z0-9]{2,10}$")
        raise HTTPException(status_code=422, detail=error)

    data = await _fetch_ticker(symbol)
    fetched_at = datetime.now(UTC).isoformat()
    return TickerOut(
        token=symbol,
        symbol=data["symbol"] or f"{symbol}USDT",
        price=data["last_price"],
        price_change_pct=data["price_change_pct"],
        high=data["high"],
        low=data["low"],
        volume=data["volume"],
        quote_volume=data["quote_volume"],
        source=data["source"],
        timestamp=fetched_at,
    )
