# SignalForge — Cloudflare Runtime Deployment Runbook

This runbook defines the production deployment posture. It is an execution checklist, not evidence that deployment has already occurred.

## Canonical architecture

SignalForge deploys as **one Cloudflare Worker** from one exact Git commit:

- FastAPI runs as a Cloudflare Python Worker through the ASGI adapter in `api/worker.py`.
- Next.js is built with `CLOUDFLARE_STATIC_EXPORT=1` into `web/out`.
- Workers Static Assets serves the UI directly.
- `assets.run_worker_first` sends only the API/proof paths through FastAPI.

This produces one public origin for the product UI and API proof surface. There is no frontend/backend commit drift and no cross-service proxy dependency.

Worker-first paths:

- `/api/*`
- `/health`
- `/.well-known/*`
- `/docs*`
- `/openapi.json`

All normal UI routes are served as static assets from the same Worker origin.

## Runtime compatibility

Cloudflare Python Workers execute through Pyodide. The Cloudflare-specific dependency set is declared in the root `pyproject.toml` and intentionally does not replace `api/requirements.txt`, which remains the normal Docker/local dependency set.

Cloudflare runtime adaptations:

- `httpx2` is aliased to the existing `httpx` interface before importing SignalForge.
- Pydantic is pinned to the Pyodide-compatible `2.12.5` runtime line.
- reviewed Cloudflare bindings are mirrored into `os.environ` before the existing application configuration is loaded.
- the business logic remains in the existing FastAPI application; `api/worker.py` is a runtime adapter only.

## Build assurance

`.github/workflows/cloudflare-verify.yml` must pass on the exact candidate commit before deployment. It verifies:

1. clean Next.js install and static export;
2. exported product root `/` exists;
3. Cloudflare Python dependencies resolve;
4. the SignalForge FastAPI app imports under the Cloudflare dependency set;
5. `pywrangler deploy --dry-run` successfully compiles the Worker bundle.

A failed compatibility gate is evidence to fix, not something to bypass.

## Production authentication

Production deployment uses GitHub Actions and requires two GitHub repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The token should be scoped to the target Cloudflare account with the minimum permissions required to edit Workers. Never commit either credential.

## Deployment variables

The deploy workflow injects these reviewed non-secret variables into the exact deployed version:

```text
GIT_COMMIT=<exact GitHub Actions SHA>
PROJECT_SLUG=signalforge
ALLOW_MOCK_FALLBACK=false
ENABLE_ALERTS=false
ENABLE_BACKTESTS=true
CORS_ORIGINS=*
RATE_LIMIT_ENABLED=true
```

`GIT_COMMIT` is injected from `GITHUB_SHA`; it must never be replaced with a branch name or shortened commit.

## Deployment workflow

`.github/workflows/deploy-cloudflare.yml` supports manual execution and a controlled marker-file trigger. A push deploy occurs only when the commit changes:

```text
.cloudflare-deploy-trigger
```

Normal code and documentation pushes therefore do not create production deployment runs. After credentials are present, updating the marker file creates one exact deployment commit that is rebuilt, smoke-tested, compiled and then uploaded.

After upload the workflow discovers or accepts the canonical Worker URL and refuses to declare success until runtime verification passes.

## Hard runtime verification

The workflow archives raw proof for all required same-origin calls:

```bash
curl https://<public-origin>/
curl https://<public-origin>/health
curl https://<public-origin>/.well-known/xagent-verification.json
curl https://<public-origin>/api/v1/decision/BTC
curl https://<public-origin>/api/v1/decision/BTC/delta
curl "https://<public-origin>/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://<public-origin>/api/v1/evidence/negative-path
```

Required assertions include:

- product root returns successfully;
- `/health.status == "ok"`;
- `/health.commit == GITHUB_SHA`;
- verification `slug == "signalforge"`;
- verification commit equals `GITHUB_SHA`;
- Decision Packet has `execution_authorized == false`;
- Decision Packet data mode is not `mock`;
- Delta responds successfully;
- Validation Lab still declares `full_composite_validated == false`;
- negative-path reproduction passes;
- negative-path result has `execution_authorized == false`.

The responses, deployment log and a runtime manifest are retained as a GitHub Actions artifact for 90 days.

## Cloudflare plan gate

Workers Free currently permits 10 ms of CPU time per dynamic request. Static asset requests do not invoke the Python Worker unless they match `run_worker_first`.

If a required dynamic endpoint repeatedly returns Cloudflare resource-limit error 1102, do not weaken or remove verification. Either move the Worker to a plan with sufficient CPU allowance or choose another backend runtime, then re-run the complete runtime proof.

## Evidence discipline

A successful `pywrangler --dry-run` proves bundle compatibility, not live deployment. A Cloudflare upload proves deployment, not application correctness. Only the archived public verification calls close the runtime gate.

Never write a successful runtime receipt before those public calls are actually observed.

## Stop conditions

Stop and fix rather than submit if any of these occur:

- public runtime is unreachable;
- health reports a missing, shortened or different commit;
- product UI and API proof paths do not share one public origin;
- API returns mock evidence in production mode;
- stale/unknown evidence is represented as healthy;
- negative path cannot be reproduced;
- runtime requires private authentication for public review;
- Cloudflare CPU/resource limits make required calls unreliable;
- deployment URL is ephemeral or scheduled to expire during the review window.
