# SignalForge — Judge Verification & Trust Model

This branch turns SignalForge from a dashboard-first signal demo into an evidence-bound market decision layer for agents.

## Review in five calls

```bash
curl https://YOUR_HOST/health
curl https://YOUR_HOST/.well-known/xagent-verification.json
curl https://YOUR_HOST/api/v1/decision/BTC
curl https://YOUR_HOST/api/v1/decision/BTC/delta
curl "https://YOUR_HOST/api/v1/validation/BTC?period_days=120&horizon_days=3"
```

The web build also exposes `/judge`, a reviewer-facing proof surface that runs these calls directly.

## Trust changes

- Production market-data mode is fail-closed.
- Synthetic fallback is opt-in only via `ALLOW_MOCK_FALLBACK=true` and is labelled `data_mode=mock`.
- Missing signals are removed from the fusion denominator instead of silently contributing a neutral 50.
- Coverage and confidence can suppress a directional recommendation entirely.
- Every Decision Packet declares `execution_authorized: false`.
- Open-interest magnitude is treated as a positioning-intensity modifier, not inherently bullish evidence.
- Backtest costs now worsen both entry and exit prices and the recorded entry date matches actual next-candle execution.

## X-Agent deployment binding

For the judged deployment, provide the exact 40-character review commit through one of:

- `GIT_COMMIT`
- `VERCEL_GIT_COMMIT_SHA`
- `CF_PAGES_COMMIT_SHA`

`/health` intentionally reports `degraded` if a valid commit binding is absent. `/.well-known/xagent-verification.json` exposes the same slug and commit for automated review.

Keep `ALLOW_MOCK_FALLBACK=false` during judging.

## Decision Packet

`GET /api/v1/decision/{token}` returns:

- stance and composite score
- coverage and confidence
- actionability gate
- horizon and market regime
- supporting, contradicting and neutral evidence
- source provenance and observed timestamp
- invalidation conditions
- immutable-ish snapshot identifier for comparison/logging
- `execution_authorized: false`

## Signal Delta

`GET /api/v1/decision/{token}/delta` establishes a first baseline and then reports meaningful changes in score, evidence drivers, stance and actionability. The first implementation uses process memory and says so explicitly; durable cross-instance persistence is a post-hackathon operating upgrade.

## Validation Lab

`GET /api/v1/validation/{token}` uses real Binance historical klines to inspect the relationship between SignalForge's **price-derived** score and future returns.

The endpoint deliberately returns:

```json
{
  "validation_scope": "price_derived_3_of_5",
  "full_composite_validated": false,
  "included_signals": ["technical", "trend", "volume"],
  "omitted_signals": ["funding", "open_interest"]
}
```

This is intentional. SignalForge does not claim historical validation for funding/open-interest until aligned historical series are actually ingested.

## Public-build feature posture

Alerts remain disabled by default in `.env.example`. The alert implementation can be re-enabled for controlled/local evaluation, but multi-tenant ownership and durable storage should be completed before treating it as a public shared service.
