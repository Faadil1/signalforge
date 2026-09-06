from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

SPOT_BASE = "https://api.binance.com"
FUTURES_BASE = "https://fapi.binance.com"


class BinancePublicError(RuntimeError):
    """Raised when Binance returns a non-2xx or unexpected shape."""


class BinancePublicClient:
    """Client for Binance's free, key-less public market data endpoints.

    Sources (all real, curl-verifiable):
      - futures klines          GET /fapi/v1/klines
      - future open interest    GET /fapi/v1/openInterest
      - funding / mark price    GET /fapi/v1/premiumIndex
      - futures 24hr ticker     GET /fapi/v1/ticker/24hr
      - spot 24hr ticker        GET /api/v3/ticker/24hr
    """

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(timeout=30)

    async def _get(self, base: str, path: str, params: dict | None = None) -> Any:
        resp = await self.client.get(f"{base}{path}", params=params)
        if resp.status_code != 200:
            raise BinancePublicError(f"Binance {path} -> HTTP {resp.status_code}")
        return resp.json()

    async def get_klines(self, symbol: str, interval: str = "1d", limit: int = 200) -> list[dict]:
        """Real OHLCV klines from Binance futures.

        Returns list of {date, open, high, low, close, volume} dicts.
        """
        raw = await self._get(
            FUTURES_BASE,
            "/fapi/v1/klines",
            params={"symbol": f"{symbol}USDT", "interval": interval, "limit": limit},
        )
        out = []
        for k in raw:
            ts = int(k[0]) / 1000
            dt = datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d")
            out.append(
                {
                    "date": dt,
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                }
            )
        return out

    async def get_open_interest(self, symbol: str) -> dict:
        """Real open interest (in base asset units)."""
        data = await self._get(FUTURES_BASE, "/fapi/v1/openInterest", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "open_interest": float(data.get("openInterest") or 0),
            "time": data.get("time"),
        }

    async def get_funding(self, symbol: str) -> dict:
        """Real funding rate + mark/index price."""
        data = await self._get(FUTURES_BASE, "/fapi/v1/premiumIndex", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "mark_price": float(data.get("markPrice") or 0),
            "index_price": float(data.get("indexPrice") or 0),
            "last_funding_rate": float(data.get("lastFundingRate") or 0),
            "next_funding_time": data.get("nextFundingTime"),
        }

    async def get_futures_ticker(self, symbol: str) -> dict:
        """Real 24h futures ticker."""
        data = await self._get(FUTURES_BASE, "/fapi/v1/ticker/24hr", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "last_price": float(data.get("lastPrice") or 0),
            "price_change_pct": float(data.get("priceChangePercent") or 0),
            "volume": float(data.get("volume") or 0),
            "quote_volume": float(data.get("quoteVolume") or 0),
            "high": float(data.get("highPrice") or 0),
            "low": float(data.get("lowPrice") or 0),
            "open": float(data.get("openPrice") or 0),
        }

    async def fetch_signal_sources(self, symbol: str) -> dict[str, Any]:
        """Fetch all real signal sources for a symbol in one assembled dict.

        Returns a dict compatible with the fusion engine's RawSignalBundle kwargs.
        """
        try:
            futures_ticker = await self.get_futures_ticker(symbol)
        except BinancePublicError:
            ticker = await self._get(SPOT_BASE, "/api/v3/ticker/24hr", params={"symbol": f"{symbol}USDT"})
            futures_ticker = {
                "symbol": symbol.upper(),
                "last_price": float(ticker.get("lastPrice") or 0),
                "price_change_pct": float(ticker.get("priceChangePercent") or 0),
                "volume": float(ticker.get("volume") or 0),
                "quote_volume": float(ticker.get("quoteVolume") or 0),
                "high": float(ticker.get("highPrice") or 0),
                "low": float(ticker.get("lowPrice") or 0),
                "open": float(ticker.get("openPrice") or 0),
            }

        klines = await self.get_klines(symbol, interval="1d", limit=120)
        open_interest = await self.get_open_interest(symbol)

        funding = None
        try:
            funding = await self.get_funding(symbol)
        except BinancePublicError:
            funding = {"last_funding_rate": 0.0, "mark_price": futures_ticker["last_price"]}

        return {
            "symbol": symbol.upper(),
            "klines": klines,
            "ticker": futures_ticker,
            "open_interest": open_interest,
            "funding": funding,
        }


binance = BinancePublicClient()
