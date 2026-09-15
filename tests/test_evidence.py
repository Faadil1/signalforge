from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from services.evidence_service import build_negative_path_evidence, build_resilience_benchmark


def test_negative_path_service_refuses_false_confidence() -> None:
    payload = build_negative_path_evidence()
    counter = payload["controlled_counter_case"]
    result = counter["result"]

    assert payload["principle"] == "Real failure > fake success"
    assert payload["real_failure_case"]["epistemic_status"] == "observed_external"
    assert counter["not_a_historical_replay"] is True
    assert counter["passed"] is True
    assert result["available_signals"] == 3
    assert result["recommendation"] == "insufficient_evidence"
    assert result["actionability"] == "insufficient_evidence"
    assert result["execution_authorized"] is False


def test_negative_path_is_public_api_capability() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/evidence/negative-path")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["controlled_counter_case"]["passed"] is True


def test_resilience_benchmark_conforms_across_failure_classes() -> None:
    payload = build_resilience_benchmark()

    assert payload["ok"] is True
    assert payload["scope"] == "controlled_policy_conformance_not_market_accuracy"
    assert payload["not_a_historical_replay"] is True
    assert payload["summary"]["passed"] == 4
    assert payload["summary"]["total"] == 4
    assert payload["summary"]["policy_conformance_rate"] == 1.0

    by_id = {case["id"]: case for case in payload["scenarios"]}
    assert by_id["full-five-channel-context"]["observed"]["actionability"] != "insufficient_evidence"
    assert by_id["full-five-channel-context"]["observed"]["available_signals"] == 5
    assert by_id["stale-oi-unavailable-funding"]["observed"]["available_signals"] == 3
    assert by_id["stale-oi-unavailable-funding"]["observed"]["actionability"] == "insufficient_evidence"
    assert by_id["inconsistent-ticker-removed"]["observed"]["available_signals"] == 1
    assert by_id["mock-price-evidence-removed"]["observed"]["available_signals"] == 0
    assert all(case["observed"]["execution_authorized"] is False for case in payload["scenarios"])
    assert all(case["passed"] is True for case in payload["scenarios"])


def test_resilience_benchmark_is_public_api_capability() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/evidence/resilience-benchmark")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["summary"]["policy_conformance_rate"] == 1.0
