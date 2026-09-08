from __future__ import annotations

from fastapi.testclient import TestClient

from main import create_app
from models.signal import SIGNAL_META, SIGNAL_WEIGHTS, SIGNAL_WEIGHTS_SUM


def test_signals_meta_returns_live_config() -> None:
    client = TestClient(create_app())
    res = client.get("/api/v1/signals/meta")
    assert res.status_code == 200

    body = res.json()
    assert body["signal_count"] == len(SIGNAL_WEIGHTS) == 5
    assert body["total_weight"] == SIGNAL_WEIGHTS_SUM == 1.0

    assert len(body["signals"]) == 5
    for item in body["signals"]:
        assert item["key"] in SIGNAL_WEIGHTS
        assert item["weight"] == SIGNAL_WEIGHTS[item["key"]]
        assert item["name"] == SIGNAL_META[item["key"]]["name"]
        assert item["description"] == SIGNAL_META[item["key"]]["description"]

    weights = [s["weight"] for s in body["signals"]]
    assert sum(weights) == 1.0


def test_signals_meta_thresholds_are_ordered() -> None:
    client = TestClient(create_app())
    thresholds = client.get("/api/v1/signals/meta").json()["recommendation_thresholds"]

    assert [t["recommendation"] for t in thresholds] == ["strong_sell", "sell", "hold", "buy", "strong_buy"]

    prev_max = 0.0
    for t in thresholds:
        assert t["min_score"] == prev_max
        assert t["max_score"] > t["min_score"]
        prev_max = t["max_score"]

    assert thresholds[-1]["max_score"] == 100.0


def test_signals_meta_exposed_in_openapi() -> None:
    client = TestClient(create_app())
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/signals/meta" in paths
