from __future__ import annotations

import asyncio

import pytest

from services.binance_client import BinancePublicClient, BinancePublicError


async def _raise(*_args, **_kwargs):
    raise BinancePublicError("upstream unavailable")


def _configured_client(*, allow_mock_fallback: bool) -> BinancePublicClient:
    client = BinancePublicClient(allow_mock_fallback=allow_mock_fallback)
    client.client = object()  # Fetch methods are replaced below; only the configured guard matters.
    client._semaphore = asyncio.Semaphore(5)
    client.get_futures_ticker = _raise
    client._get_spot_ticker = _raise
    client.get_klines = _raise
    client.get_open_interest = _raise
    client.get_funding = _raise
    return client


def test_production_mode_fails_closed_when_all_sources_are_unavailable() -> None:
    client = _configured_client(allow_mock_fallback=False)
    with pytest.raises(BinancePublicError, match="All signal sources unavailable"):
        asyncio.run(client.fetch_signal_sources("BTC"))


def test_explicit_mock_mode_is_labelled() -> None:
    client = _configured_client(allow_mock_fallback=True)
    payload = asyncio.run(client.fetch_signal_sources("BTC"))
    assert payload["source_meta"]["mode"] == "mock"
    assert set(payload["source_meta"]["sources"].values()) == {"mock"}
    assert payload["klines"]
    assert payload["ticker"]
