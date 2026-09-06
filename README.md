<div align="center">
  <img src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%2322C55E'/%3E%3Cpath fill='%2309090B' d='M13 10V3L4 14h7v7l9-11h-7z'/%3E%3C/svg%3E" alt="SignalForge" width="72" height="72" />

  # SignalForge

  **5 independent market signals. 1 Composite Signal Score. Zero noise.**

  A multi-signal crypto trading intelligence platform that fuses live Binance
  market data into a single actionable 0-100 score.
</div>

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-22C55E.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-18181B.svg)](.github/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12-3B82F6.svg)](api/requirements.txt)
[![Framework](https://img.shields.io/badge/FastAPI-0.115-06B6D4.svg)](api/requirements.txt)
[![Frontend](https://img.shields.io/badge/Next.js-14.2-18181B.svg)](web/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)](web/package.json)
[![Lint](https://img.shields.io/badge/linting-Ruff-D7FF64.svg)](ruff.toml)
[![Tests](https://img.shields.io/badge/tests-pytest-09DE09.svg)](tests/)
[![Hackathon](https://img.shields.io/badge/X--Agent%20MCP%20Hackathon-2026-A855F7.svg)](https://xagent.com)

</div>

---

## About

SignalForge computes a **Composite Signal Score (0-100)** for any crypto token
by fusing five independent, real-time market signals derived from the free
Binance public API. The score maps to a recommendation: `strong_buy`, `buy`,
`hold`, `sell`, or `strong_sell`.

Built for the **X-Agent AI MCP Hackathon 2026** (Track 2: OlaXBT x X-Agent
Trading Challenge), SignalForge ships a FastAPI backend, a Next.js dashboard,
pre-built backtested strategies, signal-triggered alerts, and an interactive
API playground.

| Spotlight | Value |
|---|---|
| Backend | Python FastAPI + Uvicorn |
| Frontend | Next.js 14 + React 18 + Tailwind CSS 3 + Recharts |
| Data Source | Binance public REST API (keyless) |
| Signals | 5 real sources, weighted fusion |

---

## Signal Fusion

Each signal is normalized to **0-100**, weighted by its reliability, then fused
into a single score. Weights are defined in
[`api/models/signal.py`](api/models/signal.py).

| Signal | Weight | Description |
|--------|--------|-------------|
| Technical | 25% | RSI + moving-average structure from daily klines |
| Trend | 25% | Price direction, higher-high/lower-low structure |
| Funding | 20% | Funding-rate extreme detection (crowding) |
| Open Interest | 15% | Positioning crowdedness vs. volume |
| Volume | 15% | Volume surge vs. 10-day average |

The fused score is threshold-mapped to a recommendation:

| Score | Recommendation |
|-------|----------------|
| >= 75 | `strong_buy` |
| 60 - 74 | `buy` |
| 40 - 59 | `hold` |
| 25 - 39 | `sell` |
| < 25 | `strong_sell` |

---

## Pre-Built Strategies

All strategies are **deterministic** — backtested on real Binance OHLCV klines
with no fabricated values.

| Strategy | Strategy | Logic |
|----------|----------|-------|
| Momentum Rider | `momentum` | Rides trends via MA structure + volume confirmation |
| Mean Reversion | `mean_reversion` | Buys oversold (low RSI, crowded shorts), sells overbought |
| Sentiment Flow | `sentiment_flow` | Front-runs crowding via funding + open-interest shifts |

Run a 90-day BTC backtest through the API:

```bash
curl "http://localhost:8000/api/v1/strategy/momentum/backtest?token=BTC&period=90d"
```

---

## Tech Stack

### Backend ([`api/`](api/))

| Component | Technology |
|-----------|------------|
| Framework | FastAPI 0.115 |
| ASGI Server | Uvicorn 0.30 |
| HTTP Client | httpx 0.27 |
| Validation | Pydantic 2.9 |
| Linting | Ruff |
| Testing | pytest |

### Frontend ([`web/`](web/))

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14.2 |
| UI | React 18.3 |
| Styling | Tailwind CSS 3.4 |
| Charting | Recharts 2.13 |
| Language | TypeScript 5.6 |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm 9+

### 1. Backend

```bash
cd api
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`. Interactive docs at
`http://localhost:8000/docs`.

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`. Next.js proxies `/api/*` to the backend on port
`8000` (see [`web/next.config.js`](web/next.config.js)).

### Run both with Docker

```bash
docker compose up --build
```

> The backend runs on an internal network; the web service is published on port
> `3000`. See [`docker-compose.yml`](docker-compose.yml).

---

## Environment Variables

The backend requires **no** API keys (Binance public data is keyless). The
following optional variable is respected by the web service:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:8000` | Upstream API origin for the Next.js proxy |

Copy `.env.example` to `.env` to configure.

---

## Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — live BTC score preview + strategy results |
| `/dashboard` | KPI cards + signal score table with filtering + detail sidebar |
| `/token` | Token deep dive — score breakdown, price/volume charts, signal drivers |
| `/strategies` | Strategy backtester — equity curves, metrics, trade history, compare mode |
| `/alerts` | Alert management — create threshold alerts + evaluate against live scores |
| `/playground` | API playground — interactive endpoint tester + real usage stats |

---

## API Overview

All endpoints are grouped under `/api/v1` and include live usage tracking.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signals` | Composite signals for the default token set |
| GET | `/api/v1/signal/{token}` | Composite signal for a single token |
| GET | `/api/v1/overview` | Aggregated overview across tokens |
| GET | `/api/v1/strategies` | List pre-built strategies |
| GET | `/api/v1/strategy/{id}/backtest` | Run a deterministic backtest |
| GET/POST | `/api/v1/alerts` | List / create alerts |
| POST | `/api/v1/alerts/{id}/evaluate` | Evaluate an alert against live data |
| GET | `/api/v1/playground/endpoints` | List available endpoints + usage stats |

---

## Project Structure

```
signalforge/
├── .github/workflows/       # CI pipeline (lint, typecheck, test, build)
├── api/                     # Python FastAPI backend
│   ├── main.py              # App entry point + CORS + usage middleware
│   ├── models/              # Dataclasses: signal, strategy, alert
│   ├── routes/              # signals, strategies, alerts, playground
│   └── services/            # binance client, signal fusion, backtester, usage
├── web/                     # Next.js frontend
│   ├── src/app/             # Landing + dashboard pages
│   ├── src/components/      # Sidebar
│   └── src/lib/             # API client helpers (cn, fetch/post/delete)
├── tests/                   # pytest suite
├── Dockerfile               # Backend container image
├── docker-compose.yml       # Multi-service orchestration
├── ruff.toml                # Python lint/format config
└── LICENSE                  # MIT
```

---

## Development

### Backend lint & test

```bash
cd api
ruff check .
ruff format --check .
pytest ../tests
```

### Frontend lint, typecheck & build

```bash
cd web
npm run lint
npx tsc --noEmit
npm run build
```

---

## Contributing

Contributions are welcome. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) first, and review the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Report security issues to the email
address in [`SECURITY.md`](SECURITY.md).

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
Copyright (c) 2026 Mobolaji Opeyemi Bolatito.
