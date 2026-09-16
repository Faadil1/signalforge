# TRACE v2 live Cloudflare runtime receipt — 2026-09-16

## Verdict

`TRACE_V2_LIVE`

TRACE UI v2 / Prismatic Evidence Foundry was deployed successfully to the canonical Cloudflare Worker and the public runtime proof chain passed against the exact deployed source commit.

## Runtime binding

- Public origin: `https://signalforge.faadil-casecraft.workers.dev`
- Deployed source commit: `ada65fe9b2170a910d458f2db9855fe087ca9446`
- Cloudflare Version ID: `a7d93227-a130-4403-aa37-f992c3bd61ea`
- Branch used for deployment: `trace-ui-v2-maximal`
- Deployment path: local authenticated `pywrangler deploy`
- Mock fallback: `false`
- Execution authority: `false`

## Deployment evidence

Observed operator output:

- Next.js 16.3.5 production build completed successfully.
- 11 static routes were generated.
- `uv sync --locked --all-groups` completed successfully.
- `uv run pywrangler deploy --dry-run` completed successfully.
- Worker bundle contained 501 modules / approximately 9.50 MiB before gzip.
- 107 static files were read from `web/out`.
- 44 new or modified assets were uploaded; 37 were already present.
- Worker startup time reported by Wrangler: 5704 ms.
- Wrangler reported `Uploaded signalforge` and `Deployed signalforge triggers`.
- Cloudflare returned Version ID `a7d93227-a130-4403-aa37-f992c3bd61ea`.

## Public runtime proof chain

The following requests were executed against the public Worker after deployment and all assertions passed.

### `/health`

Observed:

- `status = ok`
- `service = signalforge`
- `commit = ada65fe9b2170a910d458f2db9855fe087ca9446`
- `project_slug = signalforge`
- `mock_fallback_enabled = false`
- `evidence_policy = freshness_gated`
- `decision_contract_version = 1.1`
- `policy_version = evidence-gate-2026-09`

### `/.well-known/xagent-verification.json`

Observed:

- `schemaVersion = 1`
- `slug = signalforge`
- `commit = ada65fe9b2170a910d458f2db9855fe087ca9446`

This independently binds the public X-Agent verification surface to the same source commit as `/health`.

### `/api/v1/decision/BTC`

Observed during this verification snapshot:

- `ok = true`
- `stance = insufficient_evidence`
- `actionability = insufficient_evidence`
- `execution_authorized = false`
- `data_quality.mode = live_partial`
- healthy live sources: `ticker`, `klines`
- unavailable sources: `funding`, `open_interest`
- no mock sources
- evidence lease was valid and freshness-bounded
- recovery requirements explicitly did not guarantee recovery

The numeric market values in this response are time-bound runtime observations, not stable product constants.

### `/api/v1/decision/BTC/delta`

Observed:

- `ok = true`
- baseline established
- `execution_authorized = false`

### `/api/v1/validation/BTC?period_days=120&horizon_days=3`

Observed:

- `ok = true`
- `validation_scope = price_derived_3_of_5`
- `full_composite_validated = false`
- omitted signals: `funding`, `open_interest`
- endpoint explicitly states this is exploratory calibration, not proof of profitability
- no synthetic market data used by the endpoint

### `/api/v1/evidence/negative-path`

Observed:

- `ok = true`
- principle: `Real failure > fake success`
- controlled counter-case `passed = true`
- degraded sources were removed from usable inputs
- recommendation remained `insufficient_evidence`
- actionability remained `insufficient_evidence`
- `execution_authorized = false`

## Assertion result

The operator verification script completed with:

```text
TRACE V2 RUNTIME PROOF: PASS
Commit: ada65fe9b2170a910d458f2db9855fe087ca9446
Cloudflare Version: a7d93227-a130-4403-aa37-f992c3bd61ea
Runtime: https://signalforge.faadil-casecraft.workers.dev
```

No assertion threw.

## GitHub Actions context

The automated production workflow for the same source commit did not deploy because GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` were not configured. Its build, Python setup, FastAPI smoke test, and related pre-deployment checks passed before the credential gate. A separate Cloudflare runtime verification workflow compiled the Worker successfully without deploying it.

This does not invalidate the live deployment receipt above: deployment was subsequently completed through the already-authenticated local Cloudflare session and verified against the public runtime.

## Truth boundaries

- This receipt proves the stated public Worker served the stated Git commit at verification time.
- It proves the inspected policy surfaces behaved as asserted during that verification run.
- It does not claim that future market data will produce the same scores, stance, confidence, coverage, or provider mix.
- It does not grant execution authority.
- It does not claim full composite predictive validation or profitability.
- It does not imply TRACE v2 has been merged into `opeblow/signalforge` upstream.

## Canonical transition

Previous state:

`TRACE_UI_V2_PRISMATIC_EVIDENCE_FOUNDRY_VERIFIED_NOT_DEPLOYED`

New state:

`TRACE_V2_LIVE`

The next product-level gate may now be naming/identity work, while runtime slugs, APIs, and Worker names remain unchanged until an explicit rename migration is authorized.
