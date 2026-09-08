from __future__ import annotations

from fastapi.testclient import TestClient

from main import create_app
from services.binance_client import BinancePublicError, binance
from services.cache import get_cache

TOKENS = ["BTC", "ETH", "SOL", "BNB", "XRP"]


async def _fake_live_ticker(symbol: str) -> dict:
    return {
        "symbol": f"{symbol}USDT",
        "last_price": 1000.0,
        "price_change_pct": 2.5,
        "volume": 123.0,
        "quote_volume": 456.0,
        "high": 1100.0,
        "low": 900.0,
        "open": 950.0,
        "source": "binance_futures",
    }


async def _fake_down_ticker(symbol: str) -> dict:
    raise BinancePublicError("Binance down")


def test_market_tickers_live_shape(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_ticker", _fake_live_ticker)
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/market/tickers")

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["source"] == "live"

    tickers = body["tickers"]
    assert len(tickers) == len(TOKENS)
    assert [t["token"] for t in tickers] == TOKENS

    btc = tickers[0]
    assert btc["symbol"] == "BTCUSDT"
    assert btc["price"] == 1000.0
    assert btc["price_change_pct"] == 2.5
    assert btc["high"] == 1100.0
    assert btc["low"] == 900.0
    assert btc["volume"] == 123.0
    assert btc["quote_volume"] == 456.0
    assert btc["source"] == "binance_futures"
    assert btc["timestamp"]


def test_market_tickers_fallback_to_last_known(monkeypatch) -> None:
    cache = get_cache()
    cache.set(
        "ticker:last:BTC",
        {
            "token": "BTC",
            "symbol": "BTCUSDT",
            "last_price": 64000.0,
            "price_change_pct": 1.1,
            "high": 65000.0,
            "low": 62000.0,
            "volume": 2000.0,
            "quote_volume": 1.3e8,
            "source": "binance_futures",
        },
        ttl=3600,
    )
    monkeypatch.setattr(binance, "get_ticker", _fake_down_ticker)

    with TestClient(create_app()) as client:
        res = client.get("/api/v1/market/tickers")

    assert res.status_code == 200
    tickers = {t["token"]: t for t in res.json()["tickers"]}
    assert tickers["BTC"]["source"] == "last_known"
    assert tickers["BTC"]["price"] == 64000.0
    assert tickers["BTC"]["price_change_pct"] == 1.1
    assert all(t["source"] in ("last_known", "mock") for t in tickers.values())
    assert res.json()["source"] == "fallback"


def test_token_ticker_single(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_ticker", _fake_live_ticker)
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/market/tickers/ETH")

    assert res.status_code == 200
    body = res.json()
    assert body["token"] == "ETH"
    assert body["symbol"] == "ETHUSDT"
    assert body["price"] == 1000.0
    assert body["price_change_pct"] == 2.5
    assert body["source"] == "binance_futures"


def test_token_ticker_invalid_token(monkeypatch) -> None:
    monkeypatch.setattr(binance, "get_ticker", _fake_live_ticker)
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/market/tickers/DOGE%21")
    assert res.status_code == 422


def test_market_tickers_exposed_in_openapi() -> None:
    client = TestClient(create_app())
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/market/tickers" in paths
