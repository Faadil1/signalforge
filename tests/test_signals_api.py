from __future__ import annotations

from conftest import build_settings, make_client
from fastapi.testclient import TestClient

from main import create_app
from services.binance_client import BinancePublicError, binance


def _sources(token: str = "BTC", funding: dict | None = None) -> dict:
    candles = [
        {
            "date": f"2024-01-{i + 1:02d}",
            "open": 100.0 + i,
            "high": 102.0 + i,
            "low": 98.0 + i,
            "close": 100.5 + i,
            "volume": 1000.0,
        }
        for i in range(40)
    ]
    return {
        "symbol": token,
        "klines": candles,
        "ticker": {"last_price": 1000.0, "volume": 100000.0},
        "open_interest": {"open_interest": 500.0, "mark_price": 1000.0},
        "funding": funding,
    }


def _mock_core(monkeypatch, sources=None, exc=None, *, funding_ok=True):
    async def fake(symbol: str):
        if exc is not None:
            raise exc
        return sources or _sources(symbol, funding={"last_funding_rate": 0.0001} if funding_ok else None)

    monkeypatch.setattr(binance, "fetch_signal_sources", fake)
    return fake


def test_single_signal_ok(monkeypatch) -> None:
    _mock_core(monkeypatch)
    client = make_client()

    response = client.get("/api/v1/signal/btc")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["token"] == "BTC"
    assert 0 <= body["score"] <= 100
    assert body["coverage"] == 1.0
    assert body["available_signals"] == 5
    assert body["total_signals"] == 5
    assert all(s["available"] for s in body["sub_signals"])


def test_single_signal_funding_none_marks_unavailable(monkeypatch) -> None:
    _mock_core(monkeypatch, funding_ok=False)
    client = make_client()

    body = client.get("/api/v1/signal/BTC").json()
    assert body["ok"] is True
    assert body["coverage"] == 0.8
    assert body["available_signals"] == 4
    funding = next(s for s in body["sub_signals"] if s["name"] == "funding")
    assert funding["available"] is False


def test_single_signal_invalid_token(monkeypatch) -> None:
    _mock_core(monkeypatch)
    client = make_client()

    response = client.get("/api/v1/signal/bt!")
    assert response.status_code == 422
    assert response.json()["detail"]["error"]["code"] == "INVALID_TOKEN"


def test_single_signal_uses_cache(monkeypatch) -> None:
    calls = {"count": 0}

    async def fake(symbol: str):
        calls["count"] += 1
        return _sources(symbol, funding={"last_funding_rate": 0.0001})

    monkeypatch.setattr(binance, "fetch_signal_sources", fake)
    client = make_client()

    first = client.get("/api/v1/signal/BTC")
    second = client.get("/api/v1/signal/BTC")
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["score"] == second.json()["score"]
    assert calls["count"] == 1


def test_single_signal_upstream_failure_502(monkeypatch) -> None:
    _mock_core(monkeypatch, exc=BinancePublicError("upstream down"))
    client = make_client()

    response = client.get("/api/v1/signal/BTC")
    assert response.status_code == 502
    assert response.json()["detail"]["error"]["code"] == "SIGNAL_FETCH_FAILED"


def test_single_signal_error_is_cached(monkeypatch) -> None:
    calls = {"count": 0}

    async def fake(symbol: str):
        calls["count"] += 1
        raise BinancePublicError("upstream down")

    monkeypatch.setattr(binance, "fetch_signal_sources", fake)
    client = make_client()

    assert client.get("/api/v1/signal/BTC").status_code == 502
    assert client.get("/api/v1/signal/BTC").status_code == 502
    assert calls["count"] == 1


def test_batch_deduplicates_dupes(monkeypatch) -> None:
    _mock_core(monkeypatch)
    client = make_client()

    response = client.get("/api/v1/signals?tokens=BTC,BTC,btc,BTC")
    body = response.json()
    assert response.status_code == 200
    assert body["count"] == 1
    assert body["signals"][0]["token"] == "BTC"


def test_batch_mixed_ok_and_error_cards(monkeypatch) -> None:
    async def fake(symbol: str):
        if symbol == "ETH":
            raise BinancePublicError("boom")
        return _sources(symbol, funding={"last_funding_rate": 0.0001})

    monkeypatch.setattr(binance, "fetch_signal_sources", fake)
    client = make_client()

    response = client.get("/api/v1/signals?tokens=BTC,BTC,btc,ETH,x")
    body = response.json()
    assert body["count"] == 3
    by_token = {c["token"]: c for c in body["signals"]}
    assert by_token["BTC"]["ok"] is True
    assert 0 <= by_token["BTC"]["score"] <= 100
    assert by_token["ETH"]["ok"] is False
    assert by_token["ETH"]["error"]["code"] == "SIGNAL_FETCH_FAILED"
    assert by_token["X"]["ok"] is False
    assert by_token["X"]["error"]["code"] == "INVALID_TOKEN"


def test_batch_too_many_tokens() -> None:
    client = make_client()
    tokens = ",".join(f"T{i}" for i in range(0, 12))
    response = client.get(f"/api/v1/signals?tokens={tokens}")
    assert response.status_code == 422
    assert response.json()["detail"]["error"]["code"] == "TOO_MANY_TOKENS"


def test_batch_empty() -> None:
    client = make_client()
    response = client.get("/api/v1/signals?tokens=")
    assert response.status_code == 422


def test_history_period_bounds() -> None:
    client = make_client()
    assert client.get("/api/v1/signal/BTC/history?days=400").status_code == 422
    assert client.get("/api/v1/signal/BTC/history?days=0").status_code == 422


def test_rate_limit_per_app(monkeypatch) -> None:
    _mock_core(monkeypatch)
    client = make_client(rate_limit_enabled=True, rate_limit_signal=2)

    assert client.get("/api/v1/signal/BTC").status_code == 200
    assert client.get("/api/v1/signal/BTC").status_code == 200
    third = client.get("/api/v1/signal/BTC")
    assert third.status_code == 429
    assert third.json()["detail"]["error"]["code"] == "RATE_LIMITED"
    assert "Retry-After" in third.headers


def test_rate_limit_disabled_allows_many(monkeypatch) -> None:
    _mock_core(monkeypatch)
    client = make_client()
    for _ in range(5):
        assert client.get("/api/v1/signal/BTC").status_code == 200


def test_cors_allowed_origin() -> None:
    app = create_app(build_settings(cors_origins=["https://allowed.example"]))
    client = TestClient(app)

    ok = client.get("/health", headers={"Origin": "https://allowed.example"})
    assert ok.headers.get("access-control-allow-origin") == "https://allowed.example"

    bad = client.get("/health", headers={"Origin": "https://evil.example"})
    assert bad.headers.get("access-control-allow-origin") is None


def test_cors_disabled_credentials_when_wildcard() -> None:
    app = create_app(build_settings(cors_origins=["*"]))
    client = TestClient(app)

    response = client.get("/health", headers={"Origin": "https://anything.example"})
    assert response.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in response.headers
