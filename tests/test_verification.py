from __future__ import annotations

from conftest import make_client


def test_health_binds_exact_commit():
    commit = "a" * 40
    body = make_client(git_commit=commit, project_slug="signalforge").get("/health").json()
    assert body["status"] == "ok"
    assert body["commit"] == commit
    assert body["mock_fallback_enabled"] is False


def test_health_fails_loud_without_review_commit():
    assert make_client(git_commit="unknown").get("/health").json()["status"] == "degraded"


def test_xagent_well_known_binding():
    commit = "b" * 40
    body = make_client(git_commit=commit, project_slug="signalforge").get("/.well-known/xagent-verification.json").json()
    assert body == {"schemaVersion": 1, "slug": "signalforge", "commit": commit}
