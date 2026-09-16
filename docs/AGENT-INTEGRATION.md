# SignalForge Agent Integration

SignalForge is a **pre-action evidence gate for market agents**.

Its job is not to place trades or replace an execution policy. Its job is to answer a narrower question before an agent acts:

> Is the current market evidence usable enough to support a bounded research handoff, or should the agent refuse and refresh evidence?

## Integration surfaces

SignalForge exposes the same authority boundary through two read-only surfaces:

- REST under `/api/v1/*`
- stateless MCP at `/mcp`, protocol version `2026-07-28`

Both preserve `execution_authorized: false`.

## Preferred agent loop

1. Call `get_decision_packet` through MCP or `GET /api/v1/decision/{token}` through REST.
2. Inspect `actionability`, `coverage`, `confidence`, `data_quality`, and `agent_next_action`.
3. Persist the returned Decision Packet in the caller if durable change tracking matters.
4. Later, send that packet to `compare_decision_packet` or `POST /api/v1/decision/{token}/compare`.
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
- explicit source provenance
- evidence admission ledger
- raw-input/provider lineage
- freshness-bounded evidence lease
- recovery requirements
- invalidation conditions
- `agent_next_action`
- `snapshot_id`
- integrity receipt
- `execution_authorized: false`

## Safe-failure semantics

| State | `agent_next_action.code` | Intended caller behavior |
|---|---|---|
| Evidence below coverage/confidence policy | `REFRESH_EVIDENCE` | Do not promote the market conclusion; refresh or acquire evidence. |
| Usable evidence but composite in hold band | `OBSERVE_ONLY` | Monitor; do not invent conviction. |
| Evidence/actionability sufficient | `RESEARCH_HANDOFF` | Pass the bounded research conclusion to the caller's own policy/authority layer. |

All states preserve `execution_authorized: false`.

## Durable comparison

`GET /api/v1/decision/{token}/delta` is a convenience endpoint backed by process-local memory.

For durable workflows across serverless isolates, use either:

- MCP tool `compare_decision_packet`, or
- `POST /api/v1/decision/{token}/compare`

with a prior Decision Packet as the baseline.

## Evidence resilience

REST:

```text
GET /api/v1/evidence/resilience-benchmark
```

MCP tool:

```text
run_evidence_resilience_benchmark
```

This benchmark checks deterministic policy conformance across controlled evidence states. It is not a trading-performance benchmark and does not claim profitability, predictive accuracy, or historical replay.

## Capability manifest

```text
GET /api/v1/capabilities
```

This endpoint exposes tool contracts, state semantics, side-effect boundaries, authority boundaries, versions, MCP endpoint metadata, and safe-failure behavior in one machine-readable response.

## MCP transport

Endpoint:

```text
POST /mcp
```

Required protocol version:

```text
2026-07-28
```

Supported methods:

- `server/discover`
- `tools/list`
- `tools/call`

Reviewed read-only tools include:

- `get_decision_packet`
- `compare_decision_packet`
- `stress_test_decision`
- `verify_decision_receipt`
- `validate_price_signals`
- `inspect_negative_path`
- `run_evidence_resilience_benchmark`

The transport is intentionally stateless:

- no sticky session requirement;
- no wallet/session authority;
- no server-side execution authority;
- no market side effects.

## Side effects and authority

SignalForge's reviewed core is read-only with respect to markets and wallets:

- no order placement;
- no wallet access;
- no fund movement;
- no trading execution;
- no hidden mock fallback in production.

An external execution authority is always required downstream.

## Errors and retry behavior

REST examples:

- invalid token syntax: HTTP `422`;
- invalid/mismatched comparison baseline: HTTP `422`;
- upstream evidence failure that prevents a packet: fail closed rather than synthesize a live result.

MCP examples:

- malformed JSON-RPC request: JSON-RPC error;
- unsupported protocol version: fail closed;
- header/body method mismatch: fail closed;
- invalid tool arguments: request/tool error without market side effects.

Retries should use bounded caller-side backoff. A retry must never be interpreted as permission to execute.

## Live reviewer probes

```bash
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/capabilities
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/resilience-benchmark
```

For exact production binding, see [`RUNTIME-PROOF.md`](RUNTIME-PROOF.md).
