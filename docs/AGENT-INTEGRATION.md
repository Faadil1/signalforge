# SignalForge Agent Integration

SignalForge is a **pre-action evidence gate for market agents**.

Its job is not to place trades or replace an execution policy. Its job is to answer a narrower question before an agent acts:

> Is the current market evidence usable enough to support a research handoff, or should the agent refuse and refresh evidence?

## Preferred agent loop

1. `GET /api/v1/decision/{token}`
2. Inspect `actionability`, `coverage`, `confidence`, `data_quality`, and `agent_next_action`.
3. Persist the returned Decision Packet in the caller if material-change tracking matters.
4. Later, send that prior packet to `POST /api/v1/decision/{token}/compare`.
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

For durable agent workflows, use:

`POST /api/v1/decision/{token}/compare`

with a prior Decision Packet as the JSON body. SignalForge fetches a fresh packet and compares it to the caller-supplied baseline. This makes the comparison reproducible across isolates without claiming storage SignalForge does not provide.

## Evidence Resilience Benchmark

`GET /api/v1/evidence/resilience-benchmark`

This is a deterministic **policy-conformance** benchmark, not a trading-performance benchmark.

It checks that controlled evidence states produce the expected fail-closed behavior across:

- full usable evidence context
- stale + unavailable evidence
- inconsistent evidence removed before fusion
- mock price evidence removed before fusion

The benchmark explicitly does **not** claim historical replay, profitability, or predictive accuracy.

## Agent capability manifest

`GET /api/v1/capabilities`

This endpoint exposes the current tool contracts, state model, side-effect boundary, authority boundary, versions, and safe-failure semantics in one machine-readable response.

SignalForge currently exposes a REST capability surface and tool-ready contracts. It does **not** claim that an MCP transport is included in this build.

## Side effects and authority

SignalForge's reviewed core is read-only with respect to markets and wallets:

- no order placement
- no wallet access
- no fund movement
- no trading execution
- no hidden mock fallback in production

An external execution authority is always required downstream.

## Errors and retry behavior

- Invalid token syntax: HTTP `422`
- Invalid/mismatched comparison baseline: HTTP `422`
- Upstream evidence acquisition failure that prevents a packet: fail closed rather than synthesize a live result
- Callers should retry evidence acquisition with their own bounded backoff policy; a retry must not be treated as authorization to execute

## Recommended reviewer probes

```bash
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/capabilities
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/resilience-benchmark
```

The public URLs above describe the currently deployed version. New branch behavior should only be claimed live after an exact-commit redeploy and verification.
