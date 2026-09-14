from __future__ import annotations

import asyncio
import logging
import math
import random
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SPOT_BASE = "https://api.binance.com"
FUTURES_BASE = "https://fapi.binance.com"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}

_MOCK_PRICES = {
    "BTC": 67000.0,
    "ETH": 3400.0,
    "SOL": 150.0,
    "BNB": 580.0,
    "XRP": 0.62,
    "DOGE": 0.16,
    "AVAX": 38.0,
    "ARB": 1.1,
    "ADA": 0.55,
    "LINK": 17.0,
}


class BinancePublicError(RuntimeError):
    """Raised when Binance returns a non-2xx or unexpected shape."""


def _safe_float(value: float | int | str | None, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        result = float(value)
        if not math.isfinite(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


class BinancePublicClient:
    """Keyless Binance client with explicit provenance and fail-closed production mode."""

    def __init__(self, timeout_s: float = 10.0, max_retries: int = 2, max_concurrency: int = 5, allow_mock_fallback: bool = False) -> None:
        self._timeout_s = timeout_s
        self._max_retries = max_retries
        self._max_concurrency = max_concurrency
        self._allow_mock_fallback = allow_mock_fallback
        self.client: httpx.AsyncClient | None = None
        self._semaphore: asyncio.Semaphore | None = None

    async def configure(self, *, timeout_s: float | None = None, max_retries: int | None = None, max_concurrency: int | None = None, allow_mock_fallback: bool | None = None) -> None:
        if timeout_s is not None:
            self._timeout_s = timeout_s
        if max_retries is not None:
            self._max_retries = max_retries
        if max_concurrency is not None:
            self._max_concurrency = max_concurrency
        if allow_mock_fallback is not None:
            self._allow_mock_fallback = allow_mock_fallback
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=self._timeout_s, write=5.0, pool=5.0))
        self._semaphore = asyncio.Semaphore(self._max_concurrency)

    async def aclose(self) -> None:
        if self.client:
            await self.client.aclose()
            self.client = None

    async def _get(self, base: str, path: str, params: dict | None = None) -> Any:
        if self.client is None:
            raise BinancePublicError("Client not configured")
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                resp = await asyncio.wait_for(self.client.get(f"{base}{path}", params=params), timeout=self._timeout_s)
                if resp.status_code in RETRYABLE_STATUS and attempt < self._max_retries:
                    await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                if resp.status_code != 200:
                    raise BinancePublicError(f"Binance {path} -> HTTP {resp.status_code}")
                try:
                    return resp.json()
                except ValueError:
                    raise BinancePublicError(f"Binance {path} -> invalid JSON body") from None
            except (httpx.TimeoutException, httpx.ConnectError, TimeoutError) as exc:
                last_exc = exc
                if attempt < self._max_retries:
                    await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                raise BinancePublicError(f"Binance {path} transport error: {exc}") from exc
        raise BinancePublicError(f"Binance {path} failed after retries: {last_exc}")

    async def get_klines(self, symbol: str, interval: str = "1d", limit: int = 200) -> list[dict]:
        raw = await self._get(FUTURES_BASE, "/fapi/v1/klines", params={"symbol": f"{symbol}USDT", "interval": interval, "limit": limit})
        out = []
        for k in raw:
            try:
                ts = int(k[0]) / 1000
            except (TypeError, ValueError, IndexError):
                continue
            out.append({
                "date": datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d"),
                "open": _safe_float(k[1] if len(k) > 1 else None),
                "high": _safe_float(k[2] if len(k) > 2 else None),
                "low": _safe_float(k[3] if len(k) > 3 else None),
                "close": _safe_float(k[4] if len(k) > 4 else None),
                "volume": _safe_float(k[5] if len(k) > 5 else None),
            })
        if not out:
            raise BinancePublicError(f"Binance klines returned no usable rows for {symbol}")
        return out

    async def get_open_interest(self, symbol: str) -> dict:
        data = await self._get(FUTURES_BASE, "/fapi/v1/openInterest", params={"symbol": f"{symbol}USDT"})
        return {"symbol": symbol.upper(), "open_interest": _safe_float(data.get("openInterest")), "time": data.get("time")}

    async def get_funding(self, symbol: str) -> dict:
        data = await self._get(FUTURES_BASE, "/fapi/v1/premiumIndex", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "mark_price": _safe_float(data.get("markPrice")),
            "index_price": _safe_float(data.get("indexPrice")),
            "last_funding_rate": _safe_float(data.get("lastFundingRate")),
            "next_funding_time": data.get("nextFundingTime"),
        }

    async def get_futures_ticker(self, symbol: str) -> dict:
        data = await self._get(FUTURES_BASE, "/fapi/v1/ticker/24hr", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "last_price": _safe_float(data.get("lastPrice")),
            "price_change_pct": _safe_float(data.get("priceChangePercent")),
            "volume": _safe_float(data.get("volume")),
            "quote_volume": _safe_float(data.get("quoteVolume")),
            "high": _safe_float(data.get("highPrice")),
            "low": _safe_float(data.get("lowPrice")),
            "open": _safe_float(data.get("openPrice")),
        }

    async def _get_spot_ticker(self, symbol: str) -> dict:
        data = await self._get(SPOT_BASE, "/api/v3/ticker/24hr", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "last_price": _safe_float(data.get("lastPrice")),
            "price_change_pct": _safe_float(data.get("priceChangePercent")),
            "volume": _safe_float(data.get("volume")),
            "quote_volume": _safe_float(data.get("quoteVolume")),
            "high": _safe_float(data.get("highPrice")),
            "low": _safe_float(data.get("lowPrice")),
            "open": _safe_float(data.get("openPrice")),
        }

    async def get_ticker(self, symbol: str) -> dict:
        try:
            return {**(await self.get_futures_ticker(symbol)), "source": "binance_futures"}
        except BinancePublicError as futures_exc:
            try:
                return {**(await self._get_spot_ticker(symbol)), "source": "binance_spot"}
            except Exception:
                raise BinancePublicError(f"All ticker sources failed for {symbol}") from futures_exc

    def _mock_price(self, symbol: str) -> float:
        base = _MOCK_PRICES.get(symbol.upper(), 10.0)
        return round(base * (1.0 + random.uniform(-0.02, 0.02)), 6)

    def generate_mock_klines(self, symbol: str, interval: str = "1d", limit: int = 120) -> list[dict]:
        price = self._mock_price(symbol)
        now = datetime.now(UTC)
        out: list[dict] = []
        drift = random.uniform(-0.005, 0.005)
        for i in range(limit):
            ts = now - timedelta(days=(limit - 1 - i))
            price = price * (1.0 + drift + random.uniform(-0.04, 0.04))
            open_price = price * (1.0 + random.uniform(-0.01, 0.01))
            high = max(open_price, price) * (1.0 + random.uniform(0.0, 0.02))
            low = min(open_price, price) * (1.0 - random.uniform(0.0, 0.02))
            out.append({"date": ts.strftime("%Y-%m-%d"), "open": round(open_price, 6), "high": round(high, 6), "low": round(low, 6), "close": round(price, 6), "volume": round(random.uniform(5000, 80000), 2)})
        return out

    def generate_mock_ticker(self, symbol: str) -> dict:
        price = self._mock_price(symbol)
        change = random.uniform(-0.05, 0.05)
        return {"symbol": symbol.upper(), "last_price": price, "price_change_pct": round(change * 100, 2), "volume": round(random.uniform(10000, 200000), 2), "quote_volume": round(random.uniform(1e8, 1e10), 2), "high": round(price * 1.02, 6), "low": round(price * 0.98, 6), "open": round(price * (1.0 - change), 6)}

    def generate_mock_open_interest(self, symbol: str) -> dict:
        return {"symbol": symbol.upper(), "open_interest": round(_MOCK_PRICES.get(symbol.upper(), 10.0) * random.uniform(1000, 5000), 2), "time": int(datetime.now(UTC).timestamp() * 1000)}

    def generate_mock_funding(self, symbol: str) -> dict:
        return {"symbol": symbol.upper(), "mark_price": self._mock_price(symbol), "index_price": self._mock_price(symbol), "last_funding_rate": round(random.uniform(-0.0002, 0.0002), 6), "next_funding_time": int((datetime.now(UTC) + timedelta(hours=8)).timestamp() * 1000)}

    async def fetch_signal_sources(self, symbol: str) -> dict[str, Any]:
        if self._semaphore is None or self.client is None:
            await self.configure()
        provenance: dict[str, str] = {}

        async def _bounded(coro):
            async with self._semaphore:
                return await coro

        async def _fetch_ticker():
            try:
                data = await _bounded(self.get_futures_ticker(symbol))
                provenance["ticker"] = "binance_futures"
                return {**data, "source": "binance_futures"}
            except BinancePublicError as futures_exc:
                try:
                    data = await _bounded(self._get_spot_ticker(symbol))
                    provenance["ticker"] = "binance_spot"
                    return {**data, "source": "binance_spot"}
                except Exception:
                    if self._allow_mock_fallback:
                        provenance["ticker"] = "mock"
                        return self.generate_mock_ticker(symbol)
                    provenance["ticker"] = "unavailable"
                    raise BinancePublicError(f"All ticker sources failed for {symbol}") from futures_exc

        async def _fetch_klines():
            try:
                data = await _bounded(self.get_klines(symbol, interval="1d", limit=120))
                provenance["klines"] = "binance_futures"
                return data
            except BinancePublicError:
                if self._allow_mock_fallback:
                    provenance["klines"] = "mock"
                    return self.generate_mock_klines(symbol, interval="1d", limit=120)
                provenance["klines"] = "unavailable"
                return []

        async def _fetch_oi():
            try:
                data = await _bounded(self.get_open_interest(symbol))
                provenance["open_interest"] = "binance_futures"
                return data
            except BinancePublicError:
                if self._allow_mock_fallback:
                    provenance["open_interest"] = "mock"
                    return self.generate_mock_open_interest(symbol)
                provenance["open_interest"] = "unavailable"
                return {}

        async def _fetch_funding():
            try:
                data = await _bounded(self.get_funding(symbol))
                provenance["funding"] = "binance_futures"
                return data
            except BinancePublicError:
                if self._allow_mock_fallback:
                    provenance["funding"] = "mock"
                    return self.generate_mock_funding(symbol)
                provenance["funding"] = "unavailable"
                return None

        results = await asyncio.gather(_fetch_ticker(), _fetch_klines(), _fetch_oi(), _fetch_funding(), return_exceptions=True)
        ticker_data = results[0] if not isinstance(results[0], Exception) else {}
        klines_data = results[1] if not isinstance(results[1], Exception) else []
        oi_data = results[2] if not isinstance(results[2], Exception) else {}
        funding_data = results[3] if not isinstance(results[3], Exception) else None
        if not ticker_data and not klines_data and not oi_data and funding_data is None:
            raise BinancePublicError(f"All signal sources unavailable for {symbol}")
        sources = list(provenance.values())
        mode = "mock" if any(s == "mock" for s in sources) else "live_partial" if any(s == "unavailable" for s in sources) else "live"
        return {
            "symbol": symbol.upper(),
            "klines": klines_data if isinstance(klines_data, list) else [],
            "ticker": ticker_data if isinstance(ticker_data, dict) else {},
            "open_interest": oi_data if isinstance(oi_data, dict) else {},
            "funding": funding_data,
            "source_meta": {"mode": mode, "provider": "binance_public", "sources": provenance, "observed_at": datetime.now(UTC).isoformat()},
        }


binance = BinancePublicClient()
