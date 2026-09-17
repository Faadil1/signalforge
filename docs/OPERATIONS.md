# SignalForge Operations Runbook

SignalForge is operated as a fail-closed, read-only market-evidence service. The operational priority is preserving provenance, authority boundaries, and honest degradation semantics rather than maximizing availability at any cost.

## Operating invariants

These invariants must survive every release:

1. `execution_authorized` remains `false` on every Decision Packet and MCP tool result.
2. Production never silently substitutes mock market data.
3. Provider fallback remains visible in provenance.
4. Stale, unavailable, inconsistent, or mock evidence is removed from usable fusion inputs.
5. `/health` and `/.well-known/xagent-verification.json` identify the exact deployed source commit.
6. Historical calibration never claims full five-channel validation when funding/open-interest history is absent.
7. Controlled resilience fixtures are never described as historical market replays.

## Release process

A production release is verified only when all of the following are true:

1. CI is green for the intended source SHA.
2. Next.js static export succeeds.
3. FastAPI imports with the Cloudflare dependency set.
4. Decision, evidence, recovery, capability, MCP, and provider-fallback contract tests pass.
5. `pywrangler deploy --dry-run` succeeds.
6. Production is deployed with `GIT_COMMIT=<exact 40-char source SHA>`.
7. Public runtime probes confirm the same SHA.

A GitHub merge alone is not deployment proof.

## Required public post-deploy probes

- `GET /health`
- `GET /.well-known/xagent-verification.json`
- `GET /api/v1/decision/BTC`
- `GET /api/v1/decision/BTC/delta`
- `GET /api/v1/validation/BTC?period_days=120&horizon_days=3`
- `GET /api/v1/evidence/negative-path`
- `GET /api/v1/capabilities`
- `GET /api/v1/evidence/resilience-benchmark`
- `GET /api/v1/decision/BTC/stress`
- `POST /api/v1/decision/verify-receipt`
- `POST /mcp` using `server/discover`, `tools/list`, and at least one reviewed `tools/call`

## Provider degradation

Expected provider order for price-derived evidence in the Cloudflare runtime:

1. Binance Futures
2. Binance public Spot
3. Coinbase Exchange public fallback

Funding and open-interest are derivatives-market evidence and must not be synthesized from a price-only fallback.

If Binance paths are unavailable but Coinbase price data remains available, the expected service state is:

- `data_quality.mode = live_partial`
- `data_quality.provider = multi_provider_public`
- ticker/klines provenance = `coinbase_exchange`
- funding/open-interest = unavailable
- no mock sources
- confidence/coverage recomputed from remaining usable evidence
- execution authority remains false

If all supported live price providers fail, SignalForge must fail closed rather than present a synthetic live Decision Packet.

## Evidence-policy regression

If a release allows degraded evidence to remain usable incorrectly:

1. stop promotion of that release;
2. run `GET /api/v1/evidence/resilience-benchmark` locally or against the candidate runtime;
3. inspect the failing controlled scenario;
4. fix source-quality gating before tuning recommendation thresholds;
5. add or strengthen a regression fixture;
6. rerun the exact-commit release gates.

The benchmark is a policy-conformance suite, not a trading-performance benchmark.

## Serverless state

`GET /api/v1/decision/{token}/delta` uses process-local memory and is deliberately non-durable across Worker isolates.

For durable material-change workflows, callers preserve a prior Decision Packet and use:

- `POST /api/v1/decision/{token}/compare`, or
- MCP tool `compare_decision_packet`.

## MCP compatibility

Current reviewed MCP protocol version:

`2026-07-28`

The MCP surface is stateless and read-only. Changes to tool names, required arguments, authority semantics, or response structure require updated conformance tests, capabilities metadata, integration documentation, and exact-commit production verification.

## Contract and policy versioning

Two versions are intentionally separated:

- **Decision contract version** — changes when the machine-readable Decision Packet/tool contract changes materially.
- **Evidence policy version** — changes when thresholds, gating semantics, or evidence-policy behavior changes materially.

A UI redesign alone does not require a policy-version change.

## Rollback

Rollback is acceptable when a release breaks runtime, product-contract, or evidence-policy invariants.

A rollback must point production to a previously verified Worker version/source SHA. After rollback, rerun the public deployment probes and report the exact commit actually serving traffic.

## Reviewer live challenge readiness

SignalForge should be able to demonstrate on demand:

- exact commit binding;
- a fresh Decision Packet with source provenance;
- a refusal under controlled degraded evidence;
- deterministic resilience-benchmark behavior;
- MCP discovery/list/call behavior;
- no execution side effects;
- no hidden production mock fallback.

## Current known limitations

- Full five-channel historical calibration is not yet available.
- Funding/open-interest availability depends on compatible derivatives-market sources.
- Process-memory telemetry is not durable global telemetry.
- The convenience delta endpoint is not durable across isolates.
- SignalForge is research-only and intentionally has no order/wallet execution authority.
