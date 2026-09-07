from __future__ import annotations

import logging

from models.signal import RawSignalBundle
from services.binance_client import BinancePublicError, binance
from services.cache import get_cache
from services.config import get_settings
from services.errors import INTERNAL_ERROR, SIGNAL_FETCH_FAILED, error_token_payload
from services.signal_fusion import payload_from_bundle

logger = logging.getLogger(__name__)


async def get_signal_payload(token: str) -> dict:
    """Return a discriminated {ok: ...} payload for a token.

    Cached per token with single-flight. Ok results are cached with the signal
    TTL; failure results with the short error TTL.
    """
    settings = get_settings()
    cache = get_cache(settings.cache_max_entries)
    symbol = token.upper()

    async def factory() -> tuple[dict, float]:
        try:
            sources = await binance.fetch_signal_sources(symbol)
            payload = payload_from_bundle(RawSignalBundle(**sources))
            return payload, settings.signal_cache_ttl
        except BinancePublicError as exc:
            payload = error_token_payload(symbol, SIGNAL_FETCH_FAILED, f"Upstream data unavailable: {exc}")
            return payload, settings.error_cache_ttl
        except Exception:
            logger.exception("Internal error evaluating signal for %s", symbol)
            payload = error_token_payload(symbol, INTERNAL_ERROR, "Internal error while evaluating signal")
            return payload, settings.error_cache_ttl

    value, _from_cache = await cache.get_or_set(f"signal:{symbol}", factory)
    return value


async def get_candle_history(token: str, days: int) -> list[dict]:
    """Return daily OHLCV history, cached with the candle TTL."""
    settings = get_settings()
    cache = get_cache(settings.cache_max_entries)
    symbol = token.upper()

    async def factory() -> tuple[list[dict], float]:
        klines = await binance.get_klines(symbol, interval="1d", limit=days)
        history = [
            {"date": k["date"], "close": k["close"], "high": k["high"], "low": k["low"], "volume": k["volume"]}
            for k in klines
        ]
        return history, settings.candle_cache_ttl

    value, _from_cache = await cache.get_or_set(f"candles:{symbol}:{days}", factory)
    return value
