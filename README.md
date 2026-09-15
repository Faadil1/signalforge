<div align="center">

  <img src="assets/logo.svg" alt="SignalForge logo" width="280" height="64" />

  # SignalForge

  **Evidence-bound market intelligence for humans and agents.**

  Five complementary market evidence channels, explicit provenance, freshness gating,
  confidence gating, and agent-ready Decision Packets built on live Binance public data.
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

SignalForge turns public crypto-market data into an explainable **Composite Signal Score (0–100)** and, more importantly, an **evidence-bound Decision Packet** for agents.

The system fuses five complementary evidence channels:

| Evidence channel | Weight | What it measures |
|---|---:|---|
| Technical | 25% | RSI + moving-average structure |
| Trend | 25% | Price direction + market structure |
| Funding | 20% | Funding-rate crowding |
| Open Interest | 15% | Positioning intensity contextualized by price direction |
| Volume | 15% | Directional volume surge vs. recent average |

Missing or stale evidence is **not** silently converted into a neutral score. Only usable evidence contributes to the fusion denominator, while coverage and confidence determine whether a directional recommendation is allowed to exist at all.

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

- Binance market evidence is fetched from public spot/futures endpoints.
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

## Agent-native API

### Decision Packet

```http
GET /api/v1/decision/BTC
```

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
- snapshot identifier
- `execution_authorized: false`

### Signal Delta

```http
GET /api/v1/decision/BTC/delta
```

Establishes a baseline and then reports material changes in:

- score
- evidence drivers
- stance
- actionability

The current hackathon implementation stores the comparison baseline in process memory and exposes that limitation explicitly.

### Validation Lab

```http
GET /api/v1/validation/BTC?period_days=120&horizon_days=3
```

The first calibration pass evaluates the **price-derived 3/5 subset** (`technical`, `trend`, `volume`) against future returns using real Binance historical klines.

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

---

## Judge proof surface

Open:

```text
/judge
```

The page calls the public service directly and shows raw responses for:

1. `/health`
2. `/.well-known/xagent-verification.json`
3. `/api/v1/decision/BTC`
4. `/api/v1/decision/BTC/delta`
5. `/api/v1/validation/BTC?period_days=120&horizon_days=3`
6. `/api/v1/evidence/negative-path`

This keeps judge-facing evidence separate from marketing copy and makes both the positive path and refusal path independently callable.

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
  "negative_path": "/api/v1/evidence/negative-path"
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

The Next.js frontend proxies `/api/*`, `/health`, and `/.well-known/xagent-verification.json` to the backend so the same public origin can satisfy the judge contract.

---

## Backtesting

SignalForge includes three deterministic experimental strategies:

| Strategy | ID | Logic |
|---|---|---|
| Momentum Rider | `momentum` | Short MA > long MA + rising price |
| Mean Reversion | `mean_reversion` | RSI oversold/overbought |
| Sentiment Flow | `sentiment_flow` | Trend structure + RSI positioning |

Backtests use real Binance OHLCV klines. Transaction costs worsen both entry and exit prices, and trades are recorded on the actual next-candle execution date rather than the signal candle.

A backtest is experimental evidence; it is **not** a guarantee of profitability.

```bash
curl "http://localhost:8000/api/v1/strategy/momentum/backtest?token=BTC&period=90d"
```

---

## Other API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/signal/{token}` | Composite signal + provenance + freshness/confidence gate |
| GET | `/api/v1/signals` | Batch signals |
| GET | `/api/v1/overview` | Market overview cards |
| GET | `/api/v1/signal/{token}/history` | Binance OHLCV history |
| GET | `/api/v1/decision/{token}` | Agent Decision Packet |
| GET | `/api/v1/decision/{token}/delta` | Material-change detection |
| GET | `/api/v1/validation/{token}` | Historical calibration lab |
| GET | `/api/v1/evidence/negative-path` | Real-failure-backed controlled refusal proof |
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
