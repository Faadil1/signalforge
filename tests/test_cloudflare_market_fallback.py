from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import httpx

from cloudflare_binance_adapter import install_cloudflare_binance_fallback
from services import binance_client


def _coinbase_candles(count: int = 120) -> list[list[float | int]]:
    now_s = int(datetime.now(UTC).timestamp())
    latest_day = now_s - (now_s % 86400)
    rows: list[list[float | int]] = []
    for offset in reversed(range(count)):
        epoch_s = latest_day - (offset * 86400)
        base = 70_000.0 + ((count - offset) * 25.0)
        rows.append([epoch_s, base - 200.0, base + 250.0, base - 50.0, base + 75.0, 1_000.0 + offset])
    return rows


async def _exercise_fallback() -> dict:
    client_type = binance_client.BinancePublicClient
    original_methods = {
        "get_klines": client_type.get_klines,
        "_get_spot_ticker": client_type._get_spot_ticker,
        "fetch_signal_sources": client_type.fetch_signal_sources,
    }
    had_validation_getter = hasattr(client_type, "get_validation_klines")
    original_validation_getter = getattr(client_type, "get_validation_klines", None)
    had_install_flag = hasattr(client_type, "_cloudflare_market_fallback_installed")
    original_install_flag = getattr(client_type, "_cloudflare_market_fallback_installed", None)
    original_spot_base = binance_client.SPOT_BASE

    async def handler(request: httpx.Request) -> httpx.Response:
        host = request.url.host
        path = request.url.path

        if host in {"fapi.binance.com", "data-api.binance.vision", "api.binance.com"}:
            return httpx.Response(403, request=request, json={"code": -1, "msg": "blocked in test"})

        if host == "api.exchange.coinbase.com" and path == "/products/BTC-USD/ticker":
            return httpx.Response(
                200,
                request=request,
                json={
                    "price": "70321.50",
                    "volume": "1245.75",
                    "time": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                },
            )

        if host == "api.exchange.coinbase.com" and path == "/products/BTC-USD/candles":
            return httpx.Response(200, request=request, json=_coinbase_candles())

        return httpx.Response(500, request=request, json={"error": f"unexpected test URL: {request.url}"})

    client: binance_client.BinancePublicClient | None = None
    try:
        if had_install_flag:
            delattr(client_type, "_cloudflare_market_fallback_installed")

        install_cloudflare_binance_fallback()

        client = binance_client.BinancePublicClient(
            allow_mock_fallback=False,
            max_retries=0,
        )
        client.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        client._semaphore = asyncio.Semaphore(5)

        return await client.fetch_signal_sources("BTC")
    finally:
        if client is not None and client.client is not None:
            await client.client.aclose()

        client_type.get_klines = original_methods["get_klines"]
        client_type._get_spot_ticker = original_methods["_get_spot_ticker"]
        client_type.fetch_signal_sources = original_methods["fetch_signal_sources"]

        if had_validation_getter:
            client_type.get_validation_klines = original_validation_getter
        elif hasattr(client_type, "get_validation_klines"):
            delattr(client_type, "get_validation_klines")

        if had_install_flag:
            client_type._cloudflare_market_fallback_installed = original_install_flag
        elif hasattr(client_type, "_cloudflare_market_fallback_installed"):
            delattr(client_type, "_cloudflare_market_fallback_installed")

        binance_client.SPOT_BASE = original_spot_base


def test_binance_403_falls_back_to_coinbase_without_mock_or_synthetic_futures_data() -> None:
    payload = asyncio.run(_exercise_fallback())

    assert payload["source_meta"]["mode"] == "live_partial"
    assert payload["source_meta"]["provider"] == "multi_provider_public"
    assert payload["source_meta"]["fallback_active"] is True
    assert payload["source_meta"]["fallback_provider"] == "coinbase_exchange"
    assert payload["source_meta"]["primary_provider"] == "binance_public"

    sources = payload["source_meta"]["sources"]
    assert sources["ticker"] == "coinbase_exchange"
    assert sources["klines"] == "coinbase_exchange"
    assert sources["open_interest"] == "unavailable"
    assert sources["funding"] == "unavailable"
    assert "mock" not in sources.values()

    assert payload["ticker"]["source"] == "coinbase_exchange"
    assert payload["ticker"]["last_price"] > 0
    assert payload["klines"]
    assert getattr(payload["klines"], "source", None) == "coinbase_exchange"
    assert payload["open_interest"] == {}
    assert payload["funding"] is None

    quality = payload["source_meta"]["quality_summary"]
    assert quality["mock_sources"] == []
    assert set(quality["unavailable_sources"]) == {"funding", "open_interest"}
    assert set(quality["healthy_sources"]) == {"klines", "ticker"}
