# SignalForge Public Runtime Proof

Verified production origin:

```text
https://signalforge.faadil-casecraft.workers.dev
```

## Exact runtime binding

- Source commit: `087a9d9db98b5ec53da04bae0e8b07f2a4b7f976`
- Cloudflare Version ID: `e1414c91-2e7b-408b-970c-0e7f4df6f3c6`
- X-Agent slug: `signalforge`
- Mock fallback: disabled
- Execution authority: false

This deployment supersedes the earlier verified runtime bound to source commit `ada65fe9b2170a910d458f2db9855fe087ca9446` and Cloudflare Version ID `a7d93227-a130-4403-aa37-f992c3bd61ea`.

## Deployment evidence

The final public product surface was rebuilt from a clean frontend state after removing cached Next.js artifacts:

- `.next`, `out`, and `tsconfig.tsbuildinfo` were removed locally before the final build;
- Next.js 16.3.5 completed production compilation, TypeScript checking, page-data collection, static generation, and final optimization successfully;
- the exported route set contained `/`, `/alerts`, `/dashboard`, `/healthz`, `/playground`, `/strategies`, and `/token`;
- `/judge` was absent from the exported route set and `web/out/judge` did not exist;
- Cloudflare dry-run completed successfully against 99 exported asset files;
- the production deployment uploaded 36 new or modified static assets;
- the Worker deployed successfully with Version ID `e1414c91-2e7b-408b-970c-0e7f4df6f3c6`.

## Public verification results

The following public checks were observed after deployment:

- `/`
- `/health`
- `/.well-known/xagent-verification.json`
- `/judge/`

Observed assertions:

- homepage returned HTTP `200`;
- homepage content did not contain `Judge proof`, `TRACE V2`, `PRISMATIC EVIDENCE FOUNDRY`, or `14/14`;
- health status was `ok`;
- health commit matched the exact source commit above;
- health reported `project_slug: signalforge`;
- health reported `mock_fallback_enabled: false`;
- X-Agent verification returned the same exact commit;
- X-Agent slug was `signalforge`;
- `/judge/` returned `404`, confirming that the internal judge/barometer route is not part of the final public product surface.

## Prior trust-policy proof

The earlier live proof chain on the same application logic also verified:

- `/api/v1/decision/BTC`
- `/api/v1/decision/BTC/delta`
- `/api/v1/validation/BTC?period_days=120&horizon_days=3`
- `/api/v1/evidence/negative-path`

That proof established that production data mode was not `mock`, unavailable evidence was excluded instead of synthesized, validation disclosed `full_composite_validated: false`, the controlled negative-path case passed, and Decision Packets preserved `execution_authorized: false`.

These trust-policy properties are covered by the repository's current automated backend and Cloudflare bundle gates; the exact market values from any one snapshot are intentionally not treated as canonical constants.

## What this proves

This receipt proves that the public Worker was redeployed from the final public repository commit, that the public homepage serves the cleaned final product surface, that the public health and X-Agent surfaces bind to that exact commit, and that the internal `/judge` barometer route is absent from the deployed product.

It does **not** prove:

- future market values or provider mix;
- guaranteed signal accuracy;
- profitability;
- full five-signal historical validation;
- execution authority.

For a public walkthrough, use [`DEMO.md`](DEMO.md).
