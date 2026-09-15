from __future__ import annotations

from fastapi.testclient import TestClient

from main import app

PROTOCOL = "2026-07-28"


def _meta() -> dict:
    return {
        "io.modelcontextprotocol/protocolVersion": PROTOCOL,
        "io.modelcontextprotocol/clientCapabilities": {},
    }


def _headers(method: str, name: str | None = None, **extra: str) -> dict[str, str]:
    headers = {
        "MCP-Protocol-Version": PROTOCOL,
        "Mcp-Method": method,
        **extra,
    }
    if name is not None:
        headers["Mcp-Name"] = name
    return headers


def _request(method: str, request_id: int = 1, **params) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {"_meta": _meta(), **params},
    }


def test_mcp_get_is_not_a_stream_transport() -> None:
    with TestClient(app) as client:
        response = client.get("/mcp")

    assert response.status_code == 405
    assert response.headers["allow"] == "POST"


def test_server_discover_advertises_modern_stateless_tools() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("server/discover"),
            json=_request("server/discover"),
        )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["resultType"] == "complete"
    assert result["supportedVersions"] == [PROTOCOL]
    assert result["capabilities"]["tools"]["listChanged"] is False
    assert result["ttlMs"] == 300000
    assert result["cacheScope"] == "public"
    assert result["_meta"]["io.modelcontextprotocol/serverInfo"]["name"] == "signalforge"


def test_tools_list_is_deterministic_and_read_only() -> None:
    with TestClient(app) as client:
        first = client.post("/mcp", headers=_headers("tools/list"), json=_request("tools/list", 1))
        second = client.post("/mcp", headers=_headers("tools/list"), json=_request("tools/list", 2))

    assert first.status_code == 200
    assert second.status_code == 200
    first_result = first.json()["result"]
    second_result = second.json()["result"]
    assert first_result["resultType"] == "complete"
    assert first_result["tools"] == second_result["tools"]
    assert first_result["ttlMs"] == 300000
    assert first_result["cacheScope"] == "public"

    tools = {tool["name"]: tool for tool in first_result["tools"]}
    assert set(tools) == {
        "get_decision_packet",
        "compare_decision_packet",
        "stress_test_decision",
        "verify_decision_receipt",
        "validate_price_signals",
        "inspect_negative_path",
        "run_evidence_resilience_benchmark",
    }
    assert all(tool["annotations"]["readOnlyHint"] is True for tool in tools.values())
    assert all(tool["annotations"]["destructiveHint"] is False for tool in tools.values())


def test_header_method_mismatch_fails_with_mcp_error_code() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/list"),
            json=_request("server/discover"),
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == -32020


def test_unsupported_protocol_version_fails_closed() -> None:
    body = _request("tools/list")
    body["params"]["_meta"]["io.modelcontextprotocol/protocolVersion"] = "2025-06-18"
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers={"MCP-Protocol-Version": "2025-06-18", "Mcp-Method": "tools/list"},
            json=body,
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == -32022


def test_origin_validation_rejects_untrusted_browser_origin() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/list", Origin="https://malicious.example"),
            json=_request("tools/list"),
        )

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "Origin is not allowed"


def test_tools_call_requires_matching_mcp_name_header() -> None:
    body = _request("tools/call", name="run_evidence_resilience_benchmark", arguments={})
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/call", "inspect_negative_path"),
            json=body,
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == -32020


def test_resilience_benchmark_tool_returns_structured_conformance_result() -> None:
    name = "run_evidence_resilience_benchmark"
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/call", name),
            json=_request("tools/call", name=name, arguments={}),
        )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["resultType"] == "complete"
    assert result["isError"] is False
    assert result["structuredContent"]["ok"] is True
    assert result["structuredContent"]["summary"]["passed"] == 4
    assert result["structuredContent"]["summary"]["total"] == 4
    assert result["structuredContent"]["summary"]["policy_conformance_rate"] == 1.0
    assert result["structuredContent"]["not_a_historical_replay"] is True


def test_receipt_tool_fails_closed_when_receipt_is_missing() -> None:
    name = "verify_decision_receipt"
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/call", name),
            json=_request("tools/call", name=name, arguments={"packet": {"token": "BTC"}}),
        )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["isError"] is True
    assert result["structuredContent"]["ok"] is False
    assert result["structuredContent"]["error"]["code"] == "MISSING_RECEIPT"


def test_unknown_tool_is_invalid_params() -> None:
    name = "definitely_not_a_signalforge_tool"
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers=_headers("tools/call", name),
            json=_request("tools/call", name=name, arguments={}),
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == -32602
