from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from services import binance_client

# Binance documents this host as the public market-data-only base endpoint for
# Spot endpoints with security type NONE. It is used only as a transparent
# fallback when the Futures API is unavailable from the Cloudflare runtime.
SPOT_MARKET_DATA_BASE = "https://data-api.binance.vision"


class SourcedKlines(list):
    """A normal list with runtime-only provenance for the Cloudflare adapter."""

    def __init__(self, rows: list[dict[str, Any]], source: str) -> None:
        super().__init__(rows)
        self.source = source


def _normalize_klines(raw: Any, symbol: str) -> list[dict[str, Any]]:
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


def install_cloudflare_binance_fallback() -> None:
    """Install a Cloudflare-only, evidence-preserving Binance market-data fallback.

    Futures remains the preferred source. If Futures is rejected/unavailable, only
    public Spot ticker/klines fall back to Binance's official market-data-only host.
    Futures-only evidence (open interest and funding) is never synthesized here.
    """

    client_type = binance_client.BinancePublicClient
    if getattr(client_type, "_cloudflare_market_fallback_installed", False):
        return

    # Existing spot fallback code now targets Binance's official data-only host.
    binance_client.SPOT_BASE = SPOT_MARKET_DATA_BASE

    original_get_klines = client_type.get_klines
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
                return SourcedKlines(_normalize_klines(raw, symbol), "binance_spot")
            except Exception as spot_exc:
                raise binance_client.BinancePublicError(
                    f"All kline sources failed for {symbol}; futures={futures_exc}; spot={spot_exc}"
                ) from futures_exc

    async def fetch_signal_sources(self, symbol: str):
        payload = await original_fetch_signal_sources(self, symbol)
        klines = payload.get("klines") if isinstance(payload, dict) else None
        source = getattr(klines, "source", None)
        if source in {"binance_futures", "binance_spot"}:
            source_meta = payload.get("source_meta", {})
            sources = source_meta.get("sources", {})
            if isinstance(sources, dict) and "klines" in sources:
                sources["klines"] = source
        return payload

    client_type.get_klines = get_klines
    client_type.fetch_signal_sources = fetch_signal_sources
    client_type._cloudflare_market_fallback_installed = True
