# SignalForge — Judge Demo Runbook

Goal: demonstrate usefulness, provenance, and refusal behavior in a few minutes without making claims stronger than the evidence.

## Memory sentence

> **Prove the right to conclude.**

## Part A — Runtime identity

1. Open `https://signalforge.faadil-casecraft.workers.dev/judge/`.
2. Show `/health` and confirm the deployed 40-character source commit.
3. Show `/.well-known/xagent-verification.json` and confirm the same slug + commit.
4. State that production runs with synthetic fallback disabled.

## Part B — Live Decision Packet

Open:

```http
GET /api/v1/decision/BTC
```

Point to:

- source provenance;
- per-source freshness and quality;
- evidence admission/exclusion;
- coverage and confidence;
- supporting / contradicting / neutral evidence;
- evidence lease;
- invalidation conditions;
- recovery requirements;
- SHA-256 receipt;
- `execution_authorized: false`.

If the current packet is `insufficient_evidence`, treat that as a valid product outcome rather than a demo failure.

## Part C — Real failure + controlled negative path

Open:

```http
GET /api/v1/evidence/negative-path
```

Explain the separation clearly:

1. The 2025-04-15 AWS Tokyo/Binance incident is a sourced real-world failure reference.
2. SignalForge did **not** capture live requests during that historical incident.
3. The controlled fixture reproduces the relevant evidence-degradation class; it is not a historical replay.
4. Degraded evidence must reduce usable coverage and force abstention rather than false directional confidence.

Expected controlled result:

```text
recommendation = insufficient_evidence
actionability = insufficient_evidence
execution_authorized = false
```

Close with:

```text
AVAILABLE != FRESH != CONSISTENT != ACTIONABLE
```

## Part D — Fragility and recovery

Open:

```http
GET /api/v1/decision/BTC/stress
```

Show that the system can remove currently observed evidence without inventing replacements and report which dropouts force refusal.

Then explain that recovery requirements are **necessary conditions**, not guarantees that future evidence will support a directional handoff.

## Part E — Validation boundary

Open:

```http
GET /api/v1/validation/BTC?period_days=120&horizon_days=3
```

State exactly:

- the current calibration covers the price-derived 3/5 subset;
- funding and open-interest history are omitted;
- `full_composite_validated` remains false;
- no profitability claim is made.

## Part F — Agent integration

Use either REST or MCP.

For MCP:

```http
POST /mcp
MCP-Protocol-Version: 2026-07-28
```

Recommended sequence:

1. `server/discover`
2. `tools/list`
3. `tools/call` → `get_decision_packet`
4. optionally `stress_test_decision` or `verify_decision_receipt`

Emphasize that the MCP surface is stateless, read-only, and side-effect free.

## Claims to avoid

Do not say:

- SignalForge would have prevented losses during the historical AWS incident;
- the historical incident was replayed;
- all five signals are historically validated;
- the evidence channels are statistically independent;
- a valid evidence lease guarantees forecast validity;
- a receipt proves external truth or identity;
- the system authorizes or executes trades;
- an HTTP success response means market evidence is healthy.

## Public verification calls

```bash
curl https://signalforge.faadil-casecraft.workers.dev/health
curl https://signalforge.faadil-casecraft.workers.dev/.well-known/xagent-verification.json
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC/delta
curl "https://signalforge.faadil-casecraft.workers.dev/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/negative-path
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/capabilities
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/resilience-benchmark
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC/stress
```
