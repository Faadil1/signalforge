from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "signalforge"


def test_list_strategies() -> None:
    response = client.get("/api/v1/strategies")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["strategies"], list)
    ids = {s["id"] for s in body["strategies"]}
    assert ids == {"momentum", "mean_reversion", "sentiment_flow"}


def test_create_and_delete_alert() -> None:
    payload = {
        "token": "BTC",
        "condition": "gte",
        "threshold": 75.0,
        "notification": "webhook",
    }
    created = client.post("/api/v1/alerts", json=payload)
    assert created.status_code == 200
    alert = created.json()
    assert alert["token"] == "BTC"
    assert alert["condition"] == "gte"
    assert alert["status"] == "active"

    deleted = client.delete(f"/api/v1/alerts/{alert['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    missing = client.delete("/api/v1/alerts/does-not-exist")
    assert missing.status_code == 404


def test_playground_endpoints() -> None:
    response = client.get("/api/v1/playground/endpoints")
    assert response.status_code == 200
    body = response.json()
    assert "endpoints" in body
