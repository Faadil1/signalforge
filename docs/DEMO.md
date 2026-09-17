# SignalForge — Demo Guide

Goal: demonstrate usefulness **and** refusal behavior in a few minutes without making claims stronger than the evidence.

## Memory sentence

> **Evidence before recommendation. Refusal before false confidence.**

## Part A — Runtime binding

1. Open the live app: `https://signalforge.faadil-casecraft.workers.dev/`.
2. Open `/health` and confirm the exact deployed commit.
3. Open `/.well-known/xagent-verification.json` and confirm the same commit and `slug: signalforge`.
4. Confirm that production mock fallback is disabled.

## Part B — Live Decision Packet

1. Open `/api/v1/decision/BTC`.
2. Inspect:
   - source provenance;
   - freshness/data-quality metadata;
   - admission/exclusion ledger;
   - provider/raw-input lineage;
   - coverage;
   - confidence;
   - evidence lease;
   - recovery requirements;
   - invalidation conditions;
   - `execution_authorized: false`.
3. If actionability is `insufficient_evidence`, refusal is the intended result when policy conditions are not met.
4. If the policy gate passes, treat the result as a bounded research handoff, not execution authority.

## Part C — Change and fragility

1. Open `/api/v1/decision/BTC/delta` for the process-local convenience delta.
2. Durable cross-isolate comparison uses the caller-supplied prior packet through the stateless compare path.
3. Use the decision stress endpoint to inspect how evidence dropouts affect current-policy sufficiency without invented replacement evidence.

## Part D — Real failure + controlled negative path

1. Open `/api/v1/evidence/negative-path`.
2. Start with the sourced historical failure class: the 2025-04-15 AWS Tokyo connectivity incident affecting Binance services.
3. Keep the epistemic boundary explicit:
   - the external event is real;
   - SignalForge did not capture live requests during that historical incident;
   - the fixture is a controlled reproduction of the failure class, not a historical replay.
4. Show the controlled degraded evidence state.
5. Show that degraded inputs are removed from usable evidence.
6. Show that the result preserves `execution_authorized: false`.

```text
AVAILABLE != FRESH != CONSISTENT != ACTIONABLE
```

## Part E — Bounded validation

Open:

```text
/api/v1/validation/BTC?period_days=120&horizon_days=3
```

The endpoint intentionally states its scope:

- it evaluates the price-derived 3/5 subset;
- funding and open interest are omitted from this historical calibration;
- `full_composite_validated` remains `false`;
- this is exploratory calibration, not proof of profitability.

## Part F — MCP

1. Open `/api/v1/capabilities`.
2. Use MCP `server/discover` or `tools/list`.
3. Run one read-only tool call such as `get_decision_packet` or `inspect_negative_path`.
4. The MCP surface has no market execution side effects.

## Claims to avoid

Do not claim:

- that SignalForge would have prevented losses during the historical incident;
- that the incident was replayed;
- that all five signals are historically validated;
- that the signals are statistically independent;
- that the evidence lease guarantees forecast validity;
- that restoring missing evidence guarantees a directional result;
- that the receipt is a digital signature;
- that the system can execute trades autonomously.

## Public verification set

```bash
curl https://signalforge.faadil-casecraft.workers.dev/health
curl https://signalforge.faadil-casecraft.workers.dev/.well-known/xagent-verification.json
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/decision/BTC/delta
curl "https://signalforge.faadil-casecraft.workers.dev/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://signalforge.faadil-casecraft.workers.dev/api/v1/evidence/negative-path
```

The currently verified runtime binding is documented in [`RUNTIME-PROOF.md`](RUNTIME-PROOF.md).
