# SignalForge — Judge Verification & Trust Model

SignalForge is an evidence-bound market decision layer for agents. The judge contract covers both the positive path and the refusal path.

## Review in six calls

```bash
curl https://YOUR_HOST/health
curl https://YOUR_HOST/.well-known/xagent-verification.json
curl https://YOUR_HOST/api/v1/decision/BTC
curl https://YOUR_HOST/api/v1/decision/BTC/delta
curl "https://YOUR_HOST/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://YOUR_HOST/api/v1/evidence/negative-path
```

The web build exposes `/judge`, a reviewer-facing proof surface that runs these calls directly.

## Trust changes

- Production market-data mode is fail-closed.
- Synthetic fallback is opt-in only via `ALLOW_MOCK_FALLBACK=true` and is labelled `data_mode=mock`.
- Missing signals are removed from the fusion denominator instead of silently contributing a neutral 50.
- Live evidence is freshness-gated before fusion.
- Per-source quality records expose source timestamp, receive time, age, max-age policy and status.
- `stale`, `unknown`, `inconsistent` and `unavailable` live sources do not count as healthy evidence.
- Coverage and confidence can suppress a directional recommendation entirely.
- Every Decision Packet declares `execution_authorized: false`.
- Open-interest magnitude is treated as a positioning-intensity modifier, not inherently bullish evidence.
- Backtest costs worsen both entry and exit prices and the recorded entry date matches actual next-candle execution.

## Real failure evidence

Canonical incident: **AWS Tokyo / Binance — 2025-04-15**.

Reuters reported that a connectivity issue affected Binance services, that some orders succeeded while others failed, and that Binance suspended withdrawals for approximately 23 minutes.

Evidence record:

- `evidence/real-failures/AWS-TOKYO-BINANCE-2025-04-15.md`
- `evidence/real-failures/aws-tokyo-binance-2025-04-15.json`

The record preserves explicit epistemic boundaries:

- **OBSERVED-EXTERNAL** — sourced real-world facts;
- **OBSERVED-IN-BUILD** — tests, CI and runtime behavior;
- **INFERRED** — bounded design implications;
- **UNKNOWN** — counterfactuals the build did not capture.

SignalForge does **not** claim to have replayed or observed the 2025 incident live.

## Negative path

`GET /api/v1/evidence/negative-path` returns:

- the canonical real-failure case;
- a controlled failure-class reproduction;
- explicit `not_a_historical_replay: true`;
- quality state showing fresh price evidence, stale open-interest and unavailable funding;
- the resulting `insufficient_evidence` refusal;
- `execution_authorized: false`.

The controlled fixture proves the refusal mechanism, not the historical incident itself.

Canonical rule:

```text
Real failure > fake success
AVAILABLE != FRESH != CONSISTENT != ACTIONABLE
```

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
- source provenance, freshness and observed timestamp
- invalidation conditions
- snapshot identifier for comparison/logging
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

## Submission assurance

The canonical review cycle is:

```text
RUBRIC -> PAIN -> PROBLEM -> DIFFERENTIATOR -> EXECUTION -> EVIDENCE -> STORY -> DEMO -> Q&A
```

See:

- `docs/SUBMISSION-ASSURANCE.md` — rubric-to-proof matrix and mandatory gates
- `docs/JUDGE-DEMO.md` — deterministic positive + negative demo
- `docs/ADVERSARIAL-QA.md` — bounded answers to likely judge challenges
- `docs/XAGENT-SUBMISSION-CHECKLIST.md` — final packaging and deployment gate

## Public-build feature posture

Alerts remain disabled by default in `.env.example`. The alert implementation can be re-enabled for controlled/local evaluation, but multi-tenant ownership and durable storage should be completed before treating it as a public shared service.

## Final stop condition

This repository can be code-ready while still **not submission-ready**. Do not claim `SUBMISSION_READY` until the public deployment is reachable, same-origin judge calls pass, the exact deployed review commit is returned by both verification endpoints, and the official source/verification/rights archive is frozen to that commit.
