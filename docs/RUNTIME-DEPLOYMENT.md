# SignalForge — Runtime Deployment Runbook

This runbook defines the judged deployment posture. It is an execution checklist, not evidence that deployment has already occurred.

## Architecture

Deploy two services from the same GitHub repository and the same reviewed commit:

1. **signalforge-api** — FastAPI backend, repository root, Dockerfile runtime.
2. **signalforge-web** — Next.js frontend, root directory `/web`.

The frontend is the canonical public judge origin. Its existing Next.js rewrites proxy these routes to the backend:

- `/api/:path*`
- `/health`
- `/.well-known/xagent-verification.json`

This preserves a same-origin judge surface while keeping the API runtime isolated.

## Backend service — signalforge-api

Source:

- Repository: `Faadil1/signalforge`
- Branch/ref: the final reviewed branch or merged `main`
- Root directory: `/`
- Runtime: root `Dockerfile`
- Public networking: enabled
- Healthcheck path: `/health`

Required variables:

```env
GIT_COMMIT=<exact-40-character-reviewed-commit>
PROJECT_SLUG=signalforge
ALLOW_MOCK_FALLBACK=false
ENABLE_ALERTS=false
ENABLE_BACKTESTS=true
RATE_LIMIT_ENABLED=true
CORS_ORIGINS=<canonical-frontend-origin>
```

The Docker image must listen on the platform-provided `PORT`. Do not replace `GIT_COMMIT` with a branch name or shortened SHA.

## Frontend service — signalforge-web

Source:

- Repository: `Faadil1/signalforge`
- Same reviewed commit as the backend
- Root directory: `/web`
- Framework: Next.js
- Public networking: enabled

Required variables:

```env
API_URL=https://<signalforge-api-public-domain>
NEXT_PUBLIC_ENABLE_ALERTS=false
NEXT_PUBLIC_ENABLE_BACKTESTS=true
```

`API_URL` must be present before the production frontend build because the rewrite destination is compiled from `next.config.js`.

## Deployment order

1. Deploy backend first.
2. Generate/record its public HTTPS domain.
3. Verify direct backend `/health` and `/.well-known/xagent-verification.json`.
4. Configure frontend `API_URL` with the backend HTTPS origin.
5. Set backend `CORS_ORIGINS` to the final frontend HTTPS origin once known.
6. Deploy frontend from the exact same reviewed commit.
7. Treat the frontend domain as the canonical judge URL.

## Hard runtime verification

Do not call the submission runtime-ready until all calls below succeed from the **frontend canonical origin**:

```bash
curl https://<judge-origin>/health
curl https://<judge-origin>/.well-known/xagent-verification.json
curl https://<judge-origin>/api/v1/decision/BTC
curl https://<judge-origin>/api/v1/decision/BTC/delta
curl "https://<judge-origin>/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://<judge-origin>/api/v1/evidence/negative-path
```

Required assertions:

- `/health.status == "ok"`
- `/health.commit` is the exact deployed 40-character commit
- `mock_fallback_enabled == false`
- verification `slug == "signalforge"`
- verification commit equals health commit
- Decision Packet never grants execution authority
- provenance is live/live_partial, never hidden mock
- negative path passes and returns `insufficient_evidence`
- Validation Lab still declares `price_derived_3_of_5` and `full_composite_validated=false`

## Evidence capture

Save the raw response bodies, UTC verification timestamp, canonical origin, backend origin, exact commit, deployment identifiers, and CI run into the official verification archive.

Never write a successful runtime receipt before the public calls are actually observed.

## Stop conditions

Stop and fix rather than submit if any of these occur:

- frontend and backend are built from different commits
- health reports a missing/short/different commit
- public rewrites fail or bypass the backend binding
- API returns mock evidence in judged mode
- stale/unknown evidence is represented as healthy
- negative path cannot be reproduced
- runtime requires private authentication for judges
- deployment URL is ephemeral or scheduled to expire during review
