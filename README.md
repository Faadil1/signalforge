<div align="center">

  <img src="assets/logo.svg" alt="SignalForge logo" width="280" height="64" />

  # SignalForge

  **Evidence-bound market intelligence for humans and agents.**

  Five complementary market evidence channels, explicit provenance, confidence gating,
  and agent-ready Decision Packets built on live Binance public data.
</div>

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-22C55E.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-18181B.svg)](.github/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12-3B82F6.svg)](api/requirements.txt)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-06B6D4.svg)](api/requirements.txt)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-18181B.svg)](web/package.json)
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

Missing evidence is **not** silently converted into a neutral score. Only available evidence contributes to the fusion denominator, while coverage and confidence determine whether a directional recommendation is allowed to exist at all.

SignalForge is built for the **X-Agent AI MCP Hackathon 2026 — Open Innovation track**.

---

## Trust model

Production mode is deliberately fail-closed.

- Binance market evidence is fetched from public spot/futures endpoints.
- Synthetic fallback is disabled by default.
- `ALLOW_MOCK_FALLBACK=true` exists only for an explicitly labelled demo mode.
- Any synthetic result is marked `data_mode=mock`.
- Partial upstream failure is marked `data_mode=live_partial`.
- Every Decision Packet includes source provenance and observed time.
- Every Decision Packet declares `execution_authorized: false`.

A directional recommendation is withheld when coverage or adjusted confidence is below the minimum evidence gate.

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

---

## Judge proof surface

Open:

```text
/judge
```

The page calls the public service directly and shows the raw responses for:

1. `/health`
2. `/.well-known/xagent-verification.json`
3. `/api/v1/decision/BTC`
4. `/api/v1/decision/BTC/delta`
5. `/api/v1/validation/BTC?period_days=120&horizon_days=3`

This keeps the judge-facing evidence separate from marketing copy.

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
  "mock_fallback_enabled": false
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

The Next.js frontend proxies both verification endpoints to the backend so the same public origin can satisfy the judge contract.

---

## Backtesting

SignalForge includes three deterministic experimental strategies:

| Strategy | ID | Logic |
|---|---|---|
| Momentum Rider | `momentum` | Short MA > long MA + rising price |
| Mean Reversion | `mean_reversion` | RSI oversold/overbought |
| Sentiment Flow | `sentiment_flow` | Trend structure + RSI positioning |

Backtests use real Binance OHLCV klines. Transaction costs now worsen both entry and exit prices, and trades are recorded on the actual next-candle execution date rather than the signal candle.

```bash
curl "http://localhost:8000/api/v1/strategy/momentum/backtest?token=BTC&period=90d"
```

---

## Other API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/signal/{token}` | Composite signal + provenance + evidence gate |
| GET | `/api/v1/signals` | Batch signals |
| GET | `/api/v1/overview` | Market overview cards |
| GET | `/api/v1/signal/{token}/history` | Binance OHLCV history |
| GET | `/api/v1/decision/{token}` | Agent Decision Packet |
| GET | `/api/v1/decision/{token}/delta` | Material-change detection |
| GET | `/api/v1/validation/{token}` | Historical calibration lab |
| GET | `/api/v1/strategies` | Strategy catalog when enabled |
| GET | `/api/v1/strategy/{id}/backtest` | Experimental strategy backtest when enabled |
| GET | `/api/v1/playground/endpoints` | Capability catalog |
| GET | `/api/v1/playground/usage` | In-process usage summary |

Webhook alerts still exist behind a feature flag, but are **disabled by default** for the public judge build until multi-tenant ownership and durable storage are completed.

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

The web service proxies `/api/*`, `/health`, and `/.well-known/xagent-verification.json` to `API_URL`.

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
npm run lint
npx tsc --noEmit
npm run build
```

The canonical judge checklist is in [`JUDGE-READY.md`](JUDGE-READY.md). Submission packaging requirements are tracked in [`docs/XAGENT-SUBMISSION-CHECKLIST.md`](docs/XAGENT-SUBMISSION-CHECKLIST.md).

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE).

Copyright (c) 2026 Mobolaji Opeyemi Bolatito.
