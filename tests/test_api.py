from __future__ import annotations

import socket

from conftest import build_settings, make_client
from fastapi.testclient import TestClient

from main import create_app
from services.binance_client import binance

_PUBLIC_ADDR = "93.184.216.34"


def _fake_getaddrinfo(host, port, family=0, type_=0, proto=0, flags=0):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (_PUBLIC_ADDR, 0))]


def test_health_endpoint() -> None:
    client = make_client()
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "signalforge"


def test_list_strategies() -> None:
    client = make_client()
    response = client.get("/api/v1/strategies")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["strategies"], list)
    ids = {s["id"] for s in body["strategies"]}
    assert ids == {"momentum", "mean_reversion", "sentiment_flow"}
    assert "signal_weights" not in body["strategies"][0]


def test_create_and_delete_alert(monkeypatch) -> None:
    monkeypatch.setattr("services.webhook_safety.socket.getaddrinfo", _fake_getaddrinfo)
    client = make_client()

    payload = {
        "token": "BTC",
        "condition": "gte",
        "threshold": 75.0,
        "notification": "webhook",
        "webhook_url": "https://hooks.example.com/xyz",
    }
    created = client.post("/api/v1/alerts", json=payload)
    assert created.status_code == 200
    alert = created.json()
    assert alert["token"] == "BTC"
    assert alert["condition"] == "gte"
    assert alert["status"] == "active"

    listed = client.get("/api/v1/alerts")
    assert listed.json()["count"] == 1

    deleted = client.delete(f"/api/v1/alerts/{alert['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    missing = client.delete("/api/v1/alerts/does-not-exist")
    assert missing.status_code == 404


def test_alert_requires_webhook_url() -> None:
    client = make_client()
    payload = {"token": "BTC", "condition": "gte", "threshold": 75.0, "notification": "webhook"}
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 422


def test_alert_rejects_plain_http_webhook() -> None:
    client = make_client()
    payload = {
        "token": "BTC",
        "condition": "gte",
        "threshold": 75.0,
        "notification": "webhook",
        "webhook_url": "http://hooks.example.com/xyz",
    }
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 422


def test_alert_rejects_cloud_metadata_webhook() -> None:
    client = make_client()
    payload = {
        "token": "BTC",
        "condition": "gte",
        "threshold": 75.0,
        "notification": "webhook",
        "webhook_url": "https://metadata.google.internal/computeMetadata/v1/",
    }
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 422
    assert "metadata" in response.json()["detail"]["error"]["message"]


def test_alert_rejects_invalid_token() -> None:
    client = make_client()
    payload = {
        "token": "X",
        "condition": "gte",
        "threshold": 75.0,
        "webhook_url": "https://hooks.example.com/xyz",
    }
    response = client.post("/api/v1/alerts", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"]["error"]["code"] == "INVALID_TOKEN"


def test_playground_endpoints_reflect_flags() -> None:
    client = make_client()
    response = client.get("/api/v1/playground/endpoints")
    assert response.status_code == 200
    paths = [e["path"] for e in response.json()["endpoints"]]
    assert "/api/v1/strategies" in paths
    assert any("backtest" in p for p in paths)
    assert "/api/v1/alerts" in paths


def test_lifespan_configure_and_close_binance() -> None:
    with TestClient(create_app(build_settings())) as client:
        assert client.get("/health").status_code == 200
        assert binance.client is not None
    assert binance.client is None
