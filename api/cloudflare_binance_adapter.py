from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from services import binance_client

# Preferred public market-data routes. Binance remains authoritative when
# reachable. Coinbase Exchange is a secondary public provider used only for
# ticker/klines when both Binance Futures and Binance Spot are unavailable.
SPOT_MARKET_DATA_BASE = "https://data-api.binance.vision"
COINBASE_EXCHANGE_BASE = "https://api.exchange.coinbase.com"
COINBASE_GRANULARITY = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "6h": 21600,
    "1d": 86400,
}


class SourcedKlines(list):
    """A normal list with runtime-only provenance for the Cloudflare adapter."""

    def __init__(self, rows: list[dict[str, Any]], source: str) -> None:
        super().__init__(rows)
        self.source = source


def _iso_to_epoch_ms(value: Any) -> int | None:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        return int(datetime.fromisoformat(text).timestamp() * 1000)
    except (TypeError, ValueError):
        return None


def _normalize_binance_klines(raw: Any, symbol: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return rows
    for k in raw:
        try:
            open_time = int(k[0])
            ts = open_time / 1000
        except (TypeError, ValueError, IndexError):
            continue
        rows.append(
            {
                "date": datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d"),
                "open_time": open_time,
                "close_time": int(k[6]) if len(k) > 6 and k[6] is not None else None,
                "open": binance_client._safe_float(k[1] if len(k) > 1 else None),
                "high": binance_client._safe_float(k[2] if len(k) > 2 else None),
                "low": binance_client._safe_float(k[3] if len(k) > 3 else None),
                "close": binance_client._safe_float(k[4] if len(k) > 4 else None),
                "volume": binance_client._safe_float(k[5] if len(k) > 5 else None),
            }
        )
    if not rows:
        raise binance_client.BinancePublicError(f"Binance spot klines returned no usable rows for {symbol}")
    return rows


def _normalize_coinbase_klines(raw: Any, symbol: str, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return rows
    for candle in raw:
        try:
            # Coinbase Exchange candle schema:
            # [time, low, high, open, close, volume]
            epoch_s = int(candle[0])
        except (TypeError, ValueError, IndexError):
            continue
        rows.append(
            {
                "date": datetime.fromtimestamp(epoch_s, tz=UTC).strftime("%Y-%m-%d"),
                "open_time": epoch_s * 1000,
                "close_time": (epoch_s + 86400 - 1) * 1000,
                "open": binance_client._safe_float(candle[3] if len(candle) > 3 else None),
                "high": binance_client._safe_float(candle[2] if len(candle) > 2 else None),
                "low": binance_client._safe_float(candle[1] if len(candle) > 1 else None),
                "close": binance_client._safe_float(candle[4] if len(candle) > 4 else None),
                "volume": binance_client._safe_float(candle[5] if len(candle) > 5 else None),
            }
        )
    rows.sort(key=lambda row: int(row["open_time"]))
    rows = rows[-max(1, min(limit, 300)) :]
    if not rows:
        raise binance_client.BinancePublicError(f"Coinbase Exchange klines returned no usable rows for {symbol}")
    return rows


async def _coinbase_json(client, path: str, *, params: dict[str, Any] | None = None) -> Any:
    if client.client is None:
        raise binance_client.BinancePublicError("Client not configured")
    response = await client.client.get(f"{COINBASE_EXCHANGE_BASE}{path}", params=params)
    if response.status_code != 200:
        raise binance_client.BinancePublicError(f"Coinbase Exchange {path} -> HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError:
        raise binance_client.BinancePublicError(f"Coinbase Exchange {path} -> invalid JSON body") from None


def install_cloudflare_binance_fallback() -> None:
    """Install an evidence-preserving Cloudflare market-data fallback chain.

    Order of preference:
      1) Binance Futures
      2) Binance public Spot market-data endpoint
      3) Coinbase Exchange public ticker/klines

    Futures-only evidence (open interest and funding) is never synthesized.
    Provider fallback remains explicit in source_meta.
    """

    client_type = binance_client.BinancePublicClient
    if getattr(client_type, "_cloudflare_market_fallback_installed", False):
        return

    binance_client.SPOT_BASE = SPOT_MARKET_DATA_BASE

    original_get_klines = client_type.get_klines
    original_get_spot_ticker = client_type._get_spot_ticker
    original_fetch_signal_sources = client_type.fetch_signal_sources

    async def get_klines(self, symbol: str, interval: str = "1d", limit: int = 200):
        try:
            rows = await original_get_klines(self, symbol, interval=interval, limit=limit)
            return SourcedKlines(rows, "binance_futures")
        except binance_client.BinancePublicError as futures_exc:
            try:
                raw = await self._get(
                    SPOT_MARKET_DATA_BASE,
                    "/api/v3/klines",
                    params={"symbol": f"{symbol}USDT", "interval": interval, "limit": limit},
                )
                return SourcedKlines(_normalize_binance_klines(raw, symbol), "binance_spot")
            except Exception as spot_exc:
                granularity = COINBASE_GRANULARITY.get(interval)
                if granularity is None:
                    raise binance_client.BinancePublicError(
                        f"No Coinbase granularity mapping for interval {interval}"
                    ) from spot_exc
                try:
                    raw = await _coinbase_json(
                        self,
                        f"/products/{symbol.upper()}-USD/candles",
                        params={"granularity": granularity},
                    )
                    rows = _normalize_coinbase_klines(raw, symbol, limit)
                    return SourcedKlines(rows, "coinbase_exchange")
                except Exception as coinbase_exc:
                    raise binance_client.BinancePublicError(
                        "All kline sources failed for "
                        f"{symbol}; futures={futures_exc}; binance_spot={spot_exc}; coinbase={coinbase_exc}"
                    ) from futures_exc

    async def get_spot_ticker(self, symbol: str) -> dict[str, Any]:
        try:
            return await original_get_spot_ticker(self, symbol)
        except Exception as binance_spot_exc:
            try:
                raw = await _coinbase_json(self, f"/products/{symbol.upper()}-USD/ticker")
                price = binance_client._safe_float(raw.get("price"))
                volume = binance_client._safe_float(raw.get("volume"))
                return {
                    "symbol": symbol.upper(),
                    "last_price": price,
                    "price_change_pct": 0.0,
                    "volume": volume,
                    "quote_volume": volume * price if volume > 0 and price > 0 else 0.0,
                    "high": 0.0,
                    "low": 0.0,
                    "open": 0.0,
                    "close_time": _iso_to_epoch_ms(raw.get("time")),
                    "_source_provider": "coinbase_exchange",
                    "_fallback_reason": str(binance_spot_exc),
                }
            except Exception as coinbase_exc:
                raise binance_client.BinancePublicError(
                    f"All spot ticker fallbacks failed for {symbol}; "
                    f"binance_spot={binance_spot_exc}; coinbase={coinbase_exc}"
                ) from binance_spot_exc

    async def fetch_signal_sources(self, symbol: str):
        payload = await original_fetch_signal_sources(self, symbol)
        if not isinstance(payload, dict):
            return payload

        source_meta = payload.get("source_meta", {})
        sources = source_meta.get("sources", {}) if isinstance(source_meta, dict) else {}

        klines = payload.get("klines")
        kline_source = getattr(klines, "source", None)
        if isinstance(sources, dict) and kline_source in {
            "binance_futures",
            "binance_spot",
            "coinbase_exchange",
        }:
            sources["klines"] = kline_source

        ticker = payload.get("ticker")
        ticker_source = ticker.get("_source_provider") if isinstance(ticker, dict) else None
        if isinstance(sources, dict) and ticker_source == "coinbase_exchange":
            sources["ticker"] = "coinbase_exchange"
            ticker.pop("_source_provider", None)
            ticker.pop("_fallback_reason", None)
            ticker["source"] = "coinbase_exchange"

        if isinstance(source_meta, dict) and isinstance(sources, dict):
            if any(value == "coinbase_exchange" for value in sources.values()):
                source_meta["provider"] = "multi_provider_public"
                source_meta["fallback_active"] = True
                source_meta["fallback_provider"] = "coinbase_exchange"
                source_meta["primary_provider"] = "binance_public"

        return payload

    client_type.get_klines = get_klines
    client_type._get_spot_ticker = get_spot_ticker
    client_type.fetch_signal_sources = fetch_signal_sources
    client_type._cloudflare_market_fallback_installed = True
