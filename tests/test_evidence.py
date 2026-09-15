from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from services.evidence_service import build_negative_path_evidence


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
