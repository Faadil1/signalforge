from __future__ import annotations

from fastapi.testclient import TestClient

from main import create_app


def test_feature_flags_disabled_by_default() -> None:
    client = TestClient(create_app())

    assert client.get("/api/v1/strategies").status_code == 404
    assert client.post("/api/v1/strategies/backtest").status_code == 404

    payload = {
        "token": "BTC",
        "condition": "gte",
        "threshold": 75.0,
        "webhook_url": "https://hooks.example.com/xyz",
    }
    assert client.post("/api/v1/alerts", json=payload).status_code == 404

    paths = [e["path"] for e in client.get("/api/v1/playground/endpoints").json()["endpoints"]]
    assert not any("strateg" in p or "alert" in p for p in paths)


def test_core_endpoints_available_by_default() -> None:
    client = TestClient(create_app())

    assert client.get("/health").status_code == 200
    spec = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/signal/{token}" in spec
    assert "/api/v1/signals" in spec


def test_disabled_routes_removed_from_openapi() -> None:
    client = TestClient(create_app())
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/alerts" not in paths
    assert "/api/v1/strategies" not in paths


def test_enabled_flags_via_settings_object() -> None:
    from services.config import Settings

    app = create_app(Settings(enable_alerts=True, enable_backtests=True, rate_limit_enabled=False))
    client = TestClient(app)

    assert client.get("/api/v1/strategies").status_code == 200
    paths = [e["path"] for e in client.get("/api/v1/playground/endpoints").json()["endpoints"]]
    assert "/api/v1/strategies" in paths
    assert "/api/v1/alerts" in paths


def test_enabled_flags_via_environment(monkeypatch) -> None:
    from services.config import get_settings

    monkeypatch.setenv("ENABLE_ALERTS", "true")
    monkeypatch.setenv("ENABLE_BACKTESTS", "true")
    app = create_app(get_settings(reload=True))
    client = TestClient(app)

    assert client.get("/api/v1/strategies").status_code == 200
    bootstrap = client.get("/api/v1/playground/endpoints").json()["endpoints"]
    assert any("alert" in e["path"] for e in bootstrap)
