<div align="center">

  <img src="assets/logo.svg" alt="SignalForge logo" width="280" height="64" />

  # SignalForge

  **A pre-action evidence gate for market agents.**

  SignalForge verifies whether market evidence is usable enough for a bounded research handoff —
  and returns a machine-readable refusal when evidence quality is not sufficient.
</div>

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-22C55E.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-18181B.svg)](.github/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12-3B82F6.svg)](api/requirements.txt)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-06B6D4.svg)](api/requirements.txt)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-18181B.svg)](web/package.json)
[![Hackathon](https://img.shields.io/badge/X--Agent%20MCP%20Hackathon-Open%20Innovation-A855F7.svg)](https://xagt.ai/hackathon?lang=en)

</div>

---

## What SignalForge does

Most market tools try to produce another score, forecast, or BUY/SELL/HOLD answer. SignalForge focuses on the step immediately before that answer is trusted by an agent:

> **Is the underlying evidence fresh, consistent, sufficiently covered and safe to hand off — or should the agent refuse and refresh evidence?**

SignalForge turns public crypto-market data into an explainable **Composite Signal Score (0–100)** and, more importantly, an **evidence-bound Decision Packet** with provenance, quality state, actionability, invalidation conditions and an explicit authority boundary.

The system can fuse five complementary evidence channels:

| Evidence channel | Weight | What it measures |
|---|---:|---|
| Technical | 25% | RSI + moving-average structure |
| Trend | 25% | Price direction + market structure |
| Funding | 20% | Funding-rate crowding |
| Open Interest | 15% | Positioning intensity contextualized by price direction |
| Volume | 15% | Directional volume surge vs. recent average |

Missing or degraded evidence is **not** silently converted into a healthy neutral score. Only usable evidence contributes to the fusion denominator, while coverage and confidence determine whether a directional recommendation is allowed to exist at all.

Production uses a **multi-provider public market-data path**. Binance Futures and Spot are attempted where available; price-derived evidence can fail over to Coinbase Exchange with explicit provenance. Funding and open-interest evidence remain unavailable when their supported live source is unavailable rather than being synthesized.

SignalForge is built for the **X-Agent AI MCP Hackathon 2026 — Open Innovation track**.

> **Evidence before recommendation. Refusal before false confidence.**

---

## Why the trust model exists: a real failure

On **2025-04-15**, a connectivity issue in an AWS Tokyo data center disrupted several crypto platforms, including Binance. Reuters reported that some Binance orders were succeeding while others were failing and that withdrawals were temporarily suspended for approximately 23 minutes.

SignalForge does **not** claim it was running during that historical incident. The event is used as real external evidence for the failure class: partial infrastructure degradation can produce a mixture of success, failure and uncertain data quality.

Canonical evidence record:

- [`evidence/real-failures/AWS-TOKYO-BINANCE-2025-04-15.md`](evidence/real-failures/AWS-TOKYO-BINANCE-2025-04-15.md)
- [`evidence/real-failures/aws-tokyo-binance-2025-04-15.json`](evidence/real-failures/aws-tokyo-binance-2025-04-15.json)

Design rule:

```text
AVAILABLE != FRESH != CONSISTENT != ACTIONABLE
```

---

## Trust model

Production mode is deliberately fail-closed.

- Public market evidence is collected through a multi-provider adapter with explicit per-source provenance.
- Binance Futures and Spot are preferred where reachable; Coinbase Exchange is an independent public fallback for price-derived ticker/klines only.
- Synthetic fallback is disabled by default.
- `ALLOW_MOCK_FALLBACK=true` exists only for an explicitly labelled demo mode.
- Any synthetic result is marked `data_mode=mock`.
- Partial upstream failure or freshness degradation is marked `data_mode=live_partial`.
- Live sources carry source timestamp, receive time, age, freshness status and max-age policy.
- Live evidence classified as `stale`, `unknown`, `inconsistent` or `unavailable` is removed before fusion.
- Every Decision Packet includes source provenance and observed time.
- Every Decision Packet declares `execution_authorized: false`.

A directional recommendation is withheld when coverage or adjusted confidence is below the minimum evidence gate.

Freshness states are explicit: `fresh`, `stale`, `unavailable`, `unknown`, `inconsistent`, `mock`.

---

## Agent-native API + MCP

### Capability contract

```http
GET /api/v1/capabilities
```

One machine-readable response describes SignalForge's agent job, tool contracts, state model, contract/policy versions, side-effect boundary, safe-failure semantics, MCP endpoint and execution-authority boundary.

SignalForge exposes the same bounded product contract through two read-only surfaces:

- REST under `/api/v1/*`
- stateless MCP at `POST /mcp`, protocol version `2026-07-28`

Both surfaces preserve `execution_authorized: false`.

### MCP transport

```http
POST /mcp
MCP-Protocol-Version: 2026-07-28
```

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

The MCP surface is stateless, read-only and side-effect free. It validates protocol/method/tool metadata, rejects untrusted browser origins, and exposes deterministic tool annotations. No MCP tool can authorize trading execution.

### Decision Packet

```http
GET /api/v1/decision/BTC
```

Decision contract version: `1.1`

Policy version: `evidence-gate-2026-09`

Returns:

- stance + composite score
- confidence + coverage
- actionability gate
- 1–3 day decision horizon
- market regime
- supporting / contradicting / neutral evidence
- provider + per-source provenance
- source freshness / quality metadata
- invalidation conditions
- `agent_next_action`
- authority boundary
- snapshot identifier
- `execution_authorized: false`

`agent_next_action` is intentionally bounded:

- `REFRESH_EVIDENCE` when evidence is insufficient;
- `OBSERVE_ONLY` for a usable hold-band state;
- `RESEARCH_HANDOFF` when the evidence gate passes.

None of these states authorizes execution.

### Stateless Decision Compare — preferred durable delta path

```http
POST /api/v1/decision/BTC/compare
Content-Type: application/json

<prior SignalForge Decision Packet>
```

SignalForge fetches a fresh live Decision Packet and compares it with the caller-supplied baseline. This path is stateless and reproducible across serverless Worker isolates. The same workflow is available through MCP tool `compare_decision_packet`.

### Process-local Signal Delta — convenience only

```http
GET /api/v1/decision/BTC/delta
```

This endpoint establishes a baseline in process memory and reports material changes in score, evidence drivers, stance and actionability. It is explicitly labelled non-durable and should not be used when cross-isolate persistence matters.

### Validation Lab

```http
GET /api/v1/validation/BTC?period_days=120&horizon_days=3
```

The calibration pass evaluates the **price-derived 3/5 subset** (`technical`, `trend`, `volume`) against future returns using the live runtime's historical-kline provider path. Provider provenance is returned explicitly; the currently verified Cloudflare runtime uses Coinbase Exchange when Binance market endpoints are unavailable from that environment.

It intentionally returns:

```json
{
  "validation_scope": "price_derived_3_of_5",
  "full_composite_validated": false,
  "included_signals": ["technical", "trend", "volume"],
  "omitted_signals": ["funding", "open_interest"]
}
```

SignalForge does not claim full five-signal historical calibration until aligned historical funding and open-interest series are actually ingested.

### Negative path / real-failure proof

```http
GET /api/v1/evidence/negative-path
```

This endpoint combines two things without confusing them:

1. a sourced real-world failure record (AWS Tokyo / Binance, 2025-04-15); and
2. a **controlled failure-class reproduction** showing fresh price evidence alongside stale open-interest and unavailable funding evidence.

The controlled case must resolve to `insufficient_evidence` with `execution_authorized: false`. It is explicitly labelled `not_a_historical_replay: true`.

### Evidence Resilience Benchmark

```http
GET /api/v1/evidence/resilience-benchmark
```

MCP equivalent: `run_evidence_resilience_benchmark`.

A deterministic policy-conformance suite checks whether SignalForge preserves the expected authority/refusal behavior across controlled evidence states:

- full usable evidence context;
- stale open interest + unavailable funding;
- inconsistent ticker removed before fusion;
- mock price evidence removed before fusion.

The benchmark reports a `policy_conformance_rate`. It measures **policy behavior**, not trading profitability, predictive accuracy or historical replay performance.

Agent integration details: [`docs/AGENT-INTEGRATION.md`](docs/AGENT-INTEGRATION.md).

---

## Judge proof surface

Open:

```text
/judge
```

The core deployment-proof gates remain:

1. `/health`
2. `/.well-known/xagent-verification.json`
3. `/api/v1/decision/BTC`
4. `/api/v1/decision/BTC/delta`
5. `/api/v1/validation/BTC?period_days=120&horizon_days=3`
6. `/api/v1/evidence/negative-path`

Winning Intelligence adds three productization probes:

7. `/api/v1/capabilities`
8. `/api/v1/evidence/resilience-benchmark`
9. `POST /mcp` using `server/discover`, `tools/list`, or one of the five reviewed tools

This keeps judge-facing evidence separate from marketing copy and makes both positive-path usefulness and fail-closed behavior independently callable.

Demo runbook: [`docs/JUDGE-DEMO.md`](docs/JUDGE-DEMO.md).

---

## X-Agent deployment binding

The public deployment must expose the exact reviewed Git commit.

`GET /health`

```json
{
  "status": "ok",
  "service": "signalforge",
  "commit": "<40-character-reviewed-commit>",
  "project_slug": "signalforge",
  "mock_fallback_enabled": false,
  "evidence_policy": "freshness_gated",
  "decision_contract_version": "1.1",
  "policy_version": "evidence-gate-2026-09",
  "capabilities": "/api/v1/capabilities",
  "mcp": "/mcp",
  "mcp_protocol_version": "2026-07-28",
  "negative_path": "/api/v1/evidence/negative-path",
  "resilience_benchmark": "/api/v1/evidence/resilience-benchmark"
}
```

`GET /.well-known/xagent-verification.json`

```json
{
  "schemaVersion": 1,
  "slug": "signalforge",
  "commit": "<40-character-reviewed-commit>"
}
```

The commit is read from `GIT_COMMIT`, `VERCEL_GIT_COMMIT_SHA`, or `CF_PAGES_COMMIT_SHA`. `/health` reports `degraded` when no valid 40-character commit binding is available.

The production Cloudflare Worker serves the static Next.js application and FastAPI REST/MCP proof surface from one public origin.

---

## Backtesting

SignalForge includes three deterministic experimental strategies:

| Strategy | ID | Logic |
|---|---|---|
| Momentum Rider | `momentum` | Short MA > long MA + rising price |
| Mean Reversion | `mean_reversion` | RSI oversold/overbought |
| Sentiment Flow | `sentiment_flow` | Trend structure + RSI positioning |

Backtests consume historical OHLCV through the market-data client path. Transaction costs worsen both entry and exit prices, and trades are recorded on the actual next-candle execution date rather than the signal candle. Source provenance must not be generalized beyond what the runtime actually reports.

A backtest is experimental evidence; it is **not** a guarantee of profitability.

```bash
curl "http://localhost:8000/api/v1/strategy/momentum/backtest?token=BTC&period=90d"
```

---

## Other API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/mcp` | Stateless MCP 2026-07-28 discovery/list/call transport |
| GET | `/api/v1/capabilities` | Machine-readable agent capability / state / authority contract |
| GET | `/api/v1/signal/{token}` | Composite signal + provenance + freshness/confidence gate |
| GET | `/api/v1/signals` | Batch signals |
| GET | `/api/v1/overview` | Market overview cards |
| GET | `/api/v1/signal/{token}/history` | Historical OHLCV through the active market-data provider path |
| GET | `/api/v1/decision/{token}` | Versioned Agent Decision Packet |
| POST | `/api/v1/decision/{token}/compare` | Stateless material-change comparison using caller-supplied baseline |
| GET | `/api/v1/decision/{token}/delta` | Process-local material-change convenience endpoint |
| GET | `/api/v1/validation/{token}` | Bounded historical calibration lab |
| GET | `/api/v1/evidence/negative-path` | Real-failure-backed controlled refusal proof |
| GET | `/api/v1/evidence/resilience-benchmark` | Deterministic evidence-policy conformance benchmark |
| GET | `/api/v1/strategies` | Strategy catalog when enabled |
| GET | `/api/v1/strategy/{id}/backtest` | Experimental strategy backtest when enabled |
| GET | `/api/v1/playground/endpoints` | Capability catalog |
| GET | `/api/v1/playground/usage` | In-process usage summary |

Webhook alerts still exist behind a feature flag, but are **disabled by default** for the public judge build until multi-tenant ownership and durable storage are completed.

---

## Submission assurance

SignalForge uses the canonical cycle:

```text
RUBRIC -> PAIN -> PROBLEM -> DIFFERENTIATOR -> EXECUTION -> EVIDENCE -> STORY -> DEMO -> Q&A
```

The complete rubric-to-proof map and mandatory gates live in [`docs/SUBMISSION-ASSURANCE.md`](docs/SUBMISSION-ASSURANCE.md). Adversarial judge questions are pre-answered in [`docs/ADVERSARIAL-QA.md`](docs/ADVERSARIAL-QA.md).

Evidence discipline:

- **OBSERVED-EXTERNAL** — sourced real-world facts;
- **OBSERVED-IN-BUILD** — tests, CI and runtime responses;
- **INFERRED** — bounded design implications;
- **UNKNOWN** — anything not actually captured or proven.

Canonical principle: **Real failure > fake success.**

---

## Local setup

### Backend

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd web
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

---

## Environment

See [`.env.example`](.env.example).

Important judge settings:

```env
ALLOW_MOCK_FALLBACK=false
ENABLE_ALERTS=false
ENABLE_BACKTESTS=true
PROJECT_SLUG=signalforge
GIT_COMMIT=<exact-reviewed-commit>
```

Do not fabricate the commit or deployment URL. The final X-Agent package must bind to the actual reviewed deployment.

---

## Quality gates

Backend:

```bash
cd api
ruff check .
ruff format --check .
pytest ../tests -v
```

Frontend:

```bash
cd web
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npx tsc --noEmit
npm run build
```

The canonical judge checklist is in [`JUDGE-READY.md`](JUDGE-READY.md). Submission packaging requirements are tracked in [`docs/XAGENT-SUBMISSION-CHECKLIST.md`](docs/XAGENT-SUBMISSION-CHECKLIST.md).

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE).

Copyright (c) 2026 Mobolaji Opeyemi Bolatito.
