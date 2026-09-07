from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SPOT_BASE = "https://api.binance.com"
FUTURES_BASE = "https://fapi.binance.com"

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


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

    def __init__(
        self,
        timeout_s: float = 10.0,
        max_retries: int = 2,
        max_concurrency: int = 5,
    ) -> None:
        self._timeout_s = timeout_s
        self._max_retries = max_retries
        self._max_concurrency = max_concurrency
        self.client: httpx.AsyncClient | None = None
        self._semaphore: asyncio.Semaphore | None = None

    async def configure(self) -> None:
        if self.client is None:
            self.client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=5.0, read=self._timeout_s, write=5.0, pool=5.0),
            )
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
                resp = await self.client.get(f"{base}{path}", params=params)
                if resp.status_code in RETRYABLE_STATUS and attempt < self._max_retries:
                    wait = min(0.25 * (2**attempt), 2.0)
                    logger.warning(
                        "Binance %s HTTP %d (attempt %d), retrying in %.1fs", path, resp.status_code, attempt + 1, wait
                    )
                    await asyncio.sleep(wait)
                    continue
                if resp.status_code != 200:
                    raise BinancePublicError(f"Binance {path} -> HTTP {resp.status_code}")
                return resp.json()
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                last_exc = exc
                if attempt < self._max_retries:
                    wait = min(0.25 * (2**attempt), 2.0)
                    logger.warning(
                        "Binance %s transport error (attempt %d): %s, retrying in %.1fs", path, attempt + 1, exc, wait
                    )
                    await asyncio.sleep(wait)
                    continue
                raise BinancePublicError(f"Binance {path} transport error: {exc}") from exc
        raise BinancePublicError(f"Binance {path} failed after retries: {last_exc}")

    async def get_klines(self, symbol: str, interval: str = "1d", limit: int = 200) -> list[dict]:
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
        data = await self._get(FUTURES_BASE, "/fapi/v1/openInterest", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "open_interest": float(data.get("openInterest") or 0),
            "time": data.get("time"),
        }

    async def get_funding(self, symbol: str) -> dict:
        data = await self._get(FUTURES_BASE, "/fapi/v1/premiumIndex", params={"symbol": f"{symbol}USDT"})
        return {
            "symbol": symbol.upper(),
            "mark_price": float(data.get("markPrice") or 0),
            "index_price": float(data.get("indexPrice") or 0),
            "last_funding_rate": float(data.get("lastFundingRate") or 0),
            "next_funding_time": data.get("nextFundingTime"),
        }

    async def get_futures_ticker(self, symbol: str) -> dict:
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

    async def _get_spot_ticker(self, symbol: str) -> dict:
        data = await self._get(SPOT_BASE, "/api/v3/ticker/24hr", params={"symbol": f"{symbol}USDT"})
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
        """Fetch all real signal sources concurrently with bounded parallelism.

        Returns partial results on partial failure. Returns {symbol, klines, ticker, open_interest, funding}
        where funding may be None if unavailable. Self-configures lazily when
        used outside a FastAPI lifespan.
        """
        if self._semaphore is None or self.client is None:
            await self.configure()

        async def _bounded(coro):
            async with self._semaphore:
                return await coro

        futures_ticker_exc: Exception | None = None
        klines_result = None
        oi_result = None
        funding_result = None
        spot_ticker_result = None

        async def _fetch_ticker():
            nonlocal futures_ticker_exc, spot_ticker_result
            try:
                return await _bounded(self.get_futures_ticker(symbol))
            except BinancePublicError as exc:
                futures_ticker_exc = exc
                try:
                    spot_ticker_result = await _bounded(self._get_spot_ticker(symbol))
                    return spot_ticker_result
                except Exception:
                    raise BinancePublicError(f"All ticker sources failed for {symbol}") from exc

        async def _fetch_klines():
            nonlocal klines_result
            klines_result = await _bounded(self.get_klines(symbol, interval="1d", limit=120))
            return klines_result

        async def _fetch_oi():
            nonlocal oi_result
            oi_result = await _bounded(self.get_open_interest(symbol))
            return oi_result

        async def _fetch_funding():
            nonlocal funding_result
            try:
                funding_result = await _bounded(self.get_funding(symbol))
                return funding_result
            except BinancePublicError as exc:
                logger.warning("Funding unavailable for %s: %s", symbol, exc)
                funding_result = None
                return None

        results = await asyncio.gather(
            _fetch_ticker(),
            _fetch_klines(),
            _fetch_oi(),
            _fetch_funding(),
            return_exceptions=True,
        )

        ticker_data = results[0] if not isinstance(results[0], Exception) else None
        klines_data = results[1] if not isinstance(results[1], Exception) else []
        oi_data = results[2] if not isinstance(results[2], Exception) else {}
        funding_data = results[3] if not isinstance(results[3], Exception) else None

        failed = [type(r).__name__ for r in results if isinstance(r, Exception)]
        if failed:
            logger.warning("Partial upstream failure for %s: %s", symbol, failed)

        if ticker_data is None:
            raise BinancePublicError(f"No ticker data available for {symbol}")

        return {
            "symbol": symbol.upper(),
            "klines": klines_data if isinstance(klines_data, list) else [],
            "ticker": ticker_data,
            "open_interest": oi_data if isinstance(oi_data, dict) else {},
            "funding": funding_data,
        }


binance = BinancePublicClient()
