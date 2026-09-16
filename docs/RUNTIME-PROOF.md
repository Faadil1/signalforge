# SignalForge Public Runtime Proof

Verified production origin:

```text
https://signalforge.faadil-casecraft.workers.dev
```

## Exact runtime binding

- Source commit: `ada65fe9b2170a910d458f2db9855fe087ca9446`
- Cloudflare Version ID: `a7d93227-a130-4403-aa37-f992c3bd61ea`
- X-Agent slug: `signalforge`
- Mock fallback: disabled
- Execution authority: false

## Public verification results

The following public calls were verified after deployment:

- `/health`
- `/.well-known/xagent-verification.json`
- `/api/v1/decision/BTC`
- `/api/v1/decision/BTC/delta`
- `/api/v1/validation/BTC?period_days=120&horizon_days=3`
- `/api/v1/evidence/negative-path`

Observed assertions:

- health status was `ok`;
- health commit matched the exact source commit above;
- X-Agent verification returned the same commit;
- X-Agent slug was `signalforge`;
- production data mode was not `mock`;
- the BTC Decision Packet preserved `execution_authorized: false`;
- unavailable evidence was excluded instead of synthesized;
- the delta endpoint returned successfully;
- validation disclosed `full_composite_validated: false`;
- the negative-path controlled counter-case passed;
- the negative-path result preserved `execution_authorized: false`.

## Verification snapshot

At the verified snapshot, price-derived evidence was available through Coinbase Exchange fallback while funding and open interest were unavailable. The system therefore produced a live-partial evidence state, excluded the unavailable sources, and refused to promote insufficient confidence into a directional handoff.

The exact numeric market values from that snapshot are intentionally not treated as canonical constants.

## What this proves

This receipt proves that the public Worker served the stated source commit at verification time and that the inspected trust-policy surfaces behaved as asserted.

It does **not** prove:

- future market values or provider mix;
- guaranteed signal accuracy;
- profitability;
- full five-signal historical validation;
- execution authority.

For a reviewer-facing walkthrough, use [`JUDGE-DEMO.md`](JUDGE-DEMO.md).
