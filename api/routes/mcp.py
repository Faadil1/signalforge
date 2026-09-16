from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from services.decision_service import compare_with_live_decision, get_decision_packet, get_decision_stress_test
from services.evidence_intelligence import verify_decision_receipt
from services.evidence_service import build_negative_path_evidence, build_resilience_benchmark
from services.rate_limit import rate_limit
from services.recovery_service import get_recovery_plan
from services.symbols import is_valid_token, normalize_token
from services.validation_service import run_signal_validation

router = APIRouter(tags=["mcp"])

MCP_PROTOCOL_VERSION = "2026-07-28"
SERVER_INFO = {"name": "signalforge", "version": "0.6.0"}
SERVER_META = {"io.modelcontextprotocol/serverInfo": SERVER_INFO}

READ_ONLY_ANNOTATIONS = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "idempotentHint": True,
    "openWorldHint": True,
}

TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_decision_packet",
        "title": "Get Evidence-Bound Decision Packet",
        "description": (
            "Evaluate live market evidence for one token. Returns provenance, coverage, confidence, "
            "lineage concentration, recovery requirements, a tamper-evident receipt, and no execution authority."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"token": {"type": "string", "pattern": "^[A-Za-z0-9]{2,10}$"}},
            "required": ["token"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "compare_decision_packet",
        "title": "Compare Decision Packet",
        "description": (
            "Compare a caller-supplied prior SignalForge Decision Packet with a fresh live packet. "
            "Stateless across serverless isolates."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": {"type": "string", "pattern": "^[A-Za-z0-9]{2,10}$"},
                "baseline": {"type": "object"},
            },
            "required": ["token", "baseline"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "stress_test_decision",
        "title": "Stress Test Decision Fragility",
        "description": (
            "Measure how the current Decision Packet changes when already-observed evidence channels or providers "
            "are removed. No replacement values are invented and no historical replay is claimed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"token": {"type": "string", "pattern": "^[A-Za-z0-9]{2,10}$"}},
            "required": ["token"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "plan_evidence_recovery",
        "title": "Plan Evidence Recovery",
        "description": (
            "For the current Decision Packet, quantify evidence debt and return safe reacquisition candidates, "
            "a reevaluation gate, and a content-addressed refusal receipt. Recovery never guarantees actionability."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"token": {"type": "string", "pattern": "^[A-Za-z0-9]{2,10}$"}},
            "required": ["token"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "verify_decision_receipt",
        "title": "Verify Decision Receipt",
        "description": (
            "Verify the SHA-256 receipt embedded in a SignalForge Decision Packet without fetching market data."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"packet": {"type": "object"}},
            "required": ["packet"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "validate_price_signals",
        "title": "Validate Price-Derived Signals",
        "description": (
            "Run bounded historical calibration for the price-derived 3-of-5 subset. "
            "This is not full-composite validation or proof of profitability."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "token": {"type": "string", "pattern": "^[A-Za-z0-9]{2,10}$"},
                "period_days": {"type": "integer", "minimum": 45, "maximum": 365, "default": 120},
                "horizon_days": {"type": "integer", "minimum": 1, "maximum": 7, "default": 3},
            },
            "required": ["token"],
            "additionalProperties": False,
        },
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "inspect_negative_path",
        "title": "Inspect Negative Path",
        "description": (
            "Return the sourced real failure record plus a controlled refusal proof. "
            "The controlled fixture is explicitly not a historical replay."
        ),
        "inputSchema": {"type": "object", "additionalProperties": False},
        "annotations": READ_ONLY_ANNOTATIONS,
    },
    {
        "name": "run_evidence_resilience_benchmark",
        "title": "Run Evidence Resilience Benchmark",
        "description": (
            "Run deterministic policy-conformance cases across healthy, stale, unavailable, "
            "inconsistent, and mock-removed evidence states. Not a market-accuracy benchmark."
        ),
        "inputSchema": {"type": "object", "additionalProperties": False},
        "annotations": READ_ONLY_ANNOTATIONS,
    },
]


def _rpc_error(request_id: Any, code: int, message: str, *, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}},
    )


def _rpc_result(request_id: Any, result: dict[str, Any]) -> JSONResponse:
    return JSONResponse(content={"jsonrpc": "2.0", "id": request_id, "result": result})


def _tool_result(request_id: Any, payload: Any, *, is_error: bool = False) -> JSONResponse:
    serialized = json.dumps(payload, separators=(",", ":"), default=str)
    return _rpc_result(
        request_id,
        {
            "resultType": "complete",
            "_meta": SERVER_META,
            "content": [{"type": "text", "text": serialized}],
            "structuredContent": payload,
            "isError": is_error,
        },
    )


def _normalize_valid_token(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    symbol = normalize_token(value)
    return symbol if is_valid_token(symbol) else None


def _origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True
    own_origin = f"{request.url.scheme}://{request.url.netloc}"
    localhost = {"http://localhost:3000", "http://127.0.0.1:3000"}
    return origin == own_origin or origin in localhost


def _validate_modern_request(request: Request, body: Any) -> JSONResponse | None:
    request_id = body.get("id") if isinstance(body, dict) else None
    if not _origin_allowed(request):
        return _rpc_error(request_id, -32600, "Origin is not allowed", status_code=403)
    if not isinstance(body, dict) or body.get("jsonrpc") != "2.0" or body.get("id") is None:
        return _rpc_error(request_id, -32600, "Invalid JSON-RPC request")

    method = body.get("method")
    if not isinstance(method, str):
        return _rpc_error(request_id, -32600, "Missing JSON-RPC method")

    protocol_header = request.headers.get("mcp-protocol-version")
    method_header = request.headers.get("mcp-method")
    if protocol_header != MCP_PROTOCOL_VERSION:
        return _rpc_error(request_id, -32022, "Unsupported MCP protocol version")
    if method_header != method:
        return _rpc_error(request_id, -32020, "Mcp-Method header does not match request method")

    params = body.get("params")
    if not isinstance(params, dict):
        return _rpc_error(request_id, -32602, "params must be an object")
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        return _rpc_error(request_id, -32602, "params._meta is required")
    if meta.get("io.modelcontextprotocol/protocolVersion") != MCP_PROTOCOL_VERSION:
        return _rpc_error(request_id, -32022, "Request metadata protocol version is unsupported")
    if not isinstance(meta.get("io.modelcontextprotocol/clientCapabilities"), dict):
        return _rpc_error(request_id, -32602, "Client capabilities are required in params._meta")

    if method == "tools/call":
        name = params.get("name")
        if not isinstance(name, str):
            return _rpc_error(request_id, -32602, "Tool name is required")
        if request.headers.get("mcp-name") != name:
            return _rpc_error(request_id, -32020, "Mcp-Name header does not match tool name")
    elif request.headers.get("mcp-name"):
        return _rpc_error(request_id, -32020, "Mcp-Name must be omitted for this method")

    return None


async def _call_tool(name: str, arguments: dict[str, Any]) -> tuple[Any, bool]:
    if name == "get_decision_packet":
        token = _normalize_valid_token(arguments.get("token"))
        if token is None:
            return {"code": "INVALID_TOKEN", "message": "token must match ^[A-Z0-9]{2,10}$"}, True
        result = await get_decision_packet(token)
        return result, not bool(result.get("ok"))

    if name == "compare_decision_packet":
        token = _normalize_valid_token(arguments.get("token"))
        baseline = arguments.get("baseline")
        if token is None or not isinstance(baseline, dict):
            return {"code": "INVALID_ARGUMENTS", "message": "token and baseline Decision Packet are required"}, True
        result = await compare_with_live_decision(token, baseline)
        return result, not bool(result.get("ok"))

    if name == "stress_test_decision":
        token = _normalize_valid_token(arguments.get("token"))
        if token is None:
            return {"code": "INVALID_TOKEN", "message": "token must match ^[A-Z0-9]{2,10}$"}, True
        result = await get_decision_stress_test(token)
        return result, not bool(result.get("ok"))

    if name == "plan_evidence_recovery":
        token = _normalize_valid_token(arguments.get("token"))
        if token is None:
            return {"code": "INVALID_TOKEN", "message": "token must match ^[A-Z0-9]{2,10}$"}, True
        result = await get_recovery_plan(token)
        return result, not bool(result.get("ok"))

    if name == "verify_decision_receipt":
        packet = arguments.get("packet")
        if not isinstance(packet, dict):
            return {"code": "INVALID_ARGUMENTS", "message": "packet with embedded receipt is required"}, True
        result = verify_decision_receipt(packet)
        return result, not bool(result.get("ok"))

    if name == "validate_price_signals":
        token = _normalize_valid_token(arguments.get("token"))
        period_days = arguments.get("period_days", 120)
        horizon_days = arguments.get("horizon_days", 3)
        if token is None or not isinstance(period_days, int) or not 45 <= period_days <= 365:
            return {"code": "INVALID_ARGUMENTS", "message": "token and period_days (45-365) are required"}, True
        if not isinstance(horizon_days, int) or not 1 <= horizon_days <= 7:
            return {"code": "INVALID_ARGUMENTS", "message": "horizon_days must be between 1 and 7"}, True
        try:
            return await run_signal_validation(token, period_days=period_days, horizon_days=horizon_days), False
        except Exception as exc:
            return {"code": "VALIDATION_FAILED", "message": str(exc)}, True

    if name == "inspect_negative_path":
        return build_negative_path_evidence(), False

    if name == "run_evidence_resilience_benchmark":
        result = build_resilience_benchmark()
        return result, not bool(result.get("ok"))

    return {"code": "UNKNOWN_TOOL", "message": f"Unknown tool: {name}"}, True


@router.post("/mcp")
async def mcp_post(request: Request):
    await rate_limit(request, tier="signal")
    try:
        body = await request.json()
    except Exception:
        return _rpc_error(None, -32700, "Parse error")

    invalid = _validate_modern_request(request, body)
    if invalid is not None:
        return invalid

    request_id = body["id"]
    method = body["method"]
    params = body["params"]

    if method == "server/discover":
        return _rpc_result(
            request_id,
            {
                "resultType": "complete",
                "supportedVersions": [MCP_PROTOCOL_VERSION],
                "capabilities": {"tools": {"listChanged": False}},
                "instructions": (
                    "SignalForge is a read-only pre-action evidence gate. Use get_decision_packet first; "
                    "stress_test_decision reveals fragility; when the gate refuses, plan_evidence_recovery "
                    "quantifies evidence debt and safe reacquisition candidates. Reevaluate only after real "
                    "evidence returns and passes quality gates. No tool authorizes execution."
                ),
                "ttlMs": 300000,
                "cacheScope": "public",
                "_meta": SERVER_META,
            },
        )

    if method == "tools/list":
        return _rpc_result(
            request_id,
            {
                "resultType": "complete",
                "tools": TOOLS,
                "ttlMs": 300000,
                "cacheScope": "public",
                "_meta": SERVER_META,
            },
        )

    if method == "tools/call":
        name = params["name"]
        arguments = params.get("arguments", {})
        if not isinstance(arguments, dict):
            return _rpc_error(request_id, -32602, "Tool arguments must be an object")
        known_names = {tool["name"] for tool in TOOLS}
        if name not in known_names:
            return _rpc_error(request_id, -32602, f"Unknown tool: {name}")
        payload, is_error = await _call_tool(name, arguments)
        return _tool_result(request_id, payload, is_error=is_error)

    return _rpc_error(request_id, -32601, f"Method not found: {method}")


@router.get("/mcp")
async def mcp_get():
    return Response(status_code=405, headers={"Allow": "POST"})
