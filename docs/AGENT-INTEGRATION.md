# SignalForge Agent Integration

SignalForge is a **pre-action evidence gate for market agents**.

Its job is not to place trades or replace an execution policy. Its job is to answer a narrower question before an agent acts:

> Is the current market evidence usable enough to support a research handoff, or should the agent refuse and refresh evidence?

## Integration surfaces

SignalForge exposes the same bounded product contract through two read-only surfaces:

- REST under `/api/v1/*`
- stateless MCP at `/mcp`, protocol version `2026-07-28`

Both surfaces preserve the same authority boundary: `execution_authorized: false`.

## Preferred agent loop

1. Call `get_decision_packet` through MCP or `GET /api/v1/decision/{token}` through REST.
2. Inspect `actionability`, `coverage`, `confidence`, `data_quality`, and `agent_next_action`.
3. Persist the returned Decision Packet in the caller if material-change tracking matters.
4. Later, send that prior packet to `compare_decision_packet` or `POST /api/v1/decision/{token}/compare`.
5. Never treat SignalForge output as execution authority.

## Decision contract

Current contract version: `1.1`

Current policy version: `evidence-gate-2026-09`

Every successful Decision Packet includes:

- `stance`
- `score`
- `confidence`
- `coverage`
- `actionability`
- supporting / contradicting / neutral evidence
- explicit per-source provenance
- invalidation conditions
- `agent_next_action`
- `execution_authorized: false`
- an immutable-style `snapshot_id` for comparison references

## Safe-failure semantics

| State | `agent_next_action.code` | Intended caller behavior |
| --- | --- | --- |
| Evidence below coverage/confidence policy | `REFRESH_EVIDENCE` | Do not promote the market conclusion; refresh or acquire evidence. |
| Usable evidence but composite in hold band | `OBSERVE_ONLY` | Monitor; do not convert the hold state into invented conviction. |
| Evidence/actionability sufficient | `RESEARCH_HANDOFF` | Hand the bounded research conclusion to the caller's own policy/authority layer. |

All three states preserve `execution_authorized: false`.

## Durable comparison across serverless isolates

`GET /api/v1/decision/{token}/delta` is a convenience endpoint backed by **process-local memory**. It is intentionally labelled non-durable because a serverless Worker may start a new isolate.

For durable agent workflows, use either:

- MCP tool `compare_decision_packet`, or
- `POST /api/v1/decision/{token}/compare`

with a prior Decision Packet as the baseline. SignalForge fetches a fresh packet and compares it to the caller-supplied baseline. This makes the comparison reproducible across isolates without claiming storage SignalForge does not provide.

## Evidence Resilience Benchmark

REST:

`GET /api/v1/evidence/resilience-benchmark`

MCP:

`run_evidence_resilience_benchmark`

This is a deterministic **policy-conformance** benchmark, not a trading-performance benchmark.

It checks that controlled evidence states produce the expected fail-closed behavior across:

- full usable evidence context
- stale + unavailable evidence
- inconsistent evidence removed before fusion
- mock price evidence removed before fusion

The benchmark explicitly does **not** claim historical replay, profitability, or predictive accuracy.

## Agent capability manifest

`GET /api/v1/capabilities`

This endpoint exposes the current tool contracts, state model, side-effect boundary, authority boundary, versions, MCP endpoint, and safe-failure semantics in one machine-readable response.

## MCP 2026-07-28 transport

Endpoint:

`POST /mcp`

SignalForge implements the stateless MCP `2026-07-28` request/response shape needed by its reviewed read-only capability surface.

Supported methods:

- `server/discover`
- `tools/list`
- `tools/call`

Current MCP tools:

- `get_decision_packet`
- `compare_decision_packet`
- `validate_price_signals`
- `inspect_negative_path`
- `run_evidence_resilience_benchmark`

The transport validates the protocol-version, method and tool-name headers against the JSON-RPC body, validates browser `Origin` when present, exposes deterministic tool metadata, and returns both text and `structuredContent` for tool results.

It is intentionally stateless:

- no sticky session requirement
- no server-side baseline storage requirement
- no wallet/session authority
- no execution side effects

`GET /mcp` returns `405`; the reviewed MCP surface is POST request/response rather than a streaming GET transport.

## Side effects and authority

SignalForge's reviewed core is read-only with respect to markets and wallets:

- no order placement
- no wallet access
- no fund movement
- no trading execution
- no hidden mock fallback in production

An external execution authority is always required downstream.

## Errors and retry behavior

REST:

- Invalid token syntax: HTTP `422`
- Invalid/mismatched comparison baseline: HTTP `422`
- Upstream evidence acquisition failure that prevents a packet: fail closed rather than synthesize a live result

MCP:

- malformed JSON-RPC request: JSON-RPC error
- unsupported protocol version: fail closed
- header/body method or tool-name mismatch: fail closed
- invalid tool arguments: tool/request error without market side effects

Callers should retry evidence acquisition with their own bounded backoff policy; a retry must never be treated as authorization to execute.

## Recommended reviewer probes

The currently deployed production version may lag this branch until an exact-commit redeploy. After this branch is deployed and verified, representative probes are:

```bash
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/capabilities
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/resilience-benchmark
```

For MCP, use a client/request that supplies the required MCP `2026-07-28` headers and JSON-RPC metadata to `POST /mcp`.

Do not claim the branch-only MCP/stateless-comparison behavior is live until `/health` reports the exact deployed branch commit and the runtime probes pass.
