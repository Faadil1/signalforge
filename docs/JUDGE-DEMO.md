# SignalForge — Judge Demo Runbook

Goal: demonstrate usefulness **and** refusal behavior in under a few minutes without making claims stronger than the evidence.

## Memory sentence

> **Evidence before recommendation. Refusal before false confidence.**

## Part A — Positive path

1. Open `/judge`.
2. Show `/health` and confirm the deployed 40-character review commit.
3. Show `/.well-known/xagent-verification.json` and confirm the same slug + commit.
4. Open the live BTC Decision Packet.
5. Point to:
   - source provenance;
   - freshness/data-quality metadata;
   - coverage;
   - confidence;
   - supporting / contradicting evidence;
   - invalidation;
   - `execution_authorized: false`.
6. Open Signal Delta and explain that it detects material change, with process-memory persistence explicitly disclosed.
7. Open Validation Lab and state exactly: current historical calibration is **price-derived 3/5**; funding/open-interest are not claimed as historically validated.

## Part B — Real failure + controlled negative path

1. Open `GET /api/v1/evidence/negative-path` from `/judge`.
2. Start with the real event:
   - 2025-04-15 AWS Tokyo connectivity incident;
   - Binance services affected;
   - some orders succeeded while others failed;
   - withdrawals paused for approximately 23 minutes;
   - source: Reuters.
3. State the epistemic boundary:
   - the event is real;
   - SignalForge did **not** capture historical requests during that incident;
   - the fixture is a controlled reproduction of the failure class, not a historical replay.
4. Show the controlled evidence quality state:
   - ticker: fresh;
   - klines: fresh;
   - open interest: stale;
   - funding: unavailable.
5. Show the outcome:
   - only 3/5 evidence channels remain usable;
   - adjusted confidence falls below the actionable gate;
   - recommendation: `insufficient_evidence`;
   - actionability: `insufficient_evidence`;
   - `execution_authorized: false`.
6. Close with: **AVAILABLE != FRESH != CONSISTENT != ACTIONABLE.**

## Part C — Failure escalation

If asked what happens when every upstream source is unusable:

- production is configured with `ALLOW_MOCK_FALLBACK=false`;
- the Binance client fails closed rather than replacing evidence with hidden synthetic data;
- the behavior is covered by automated tests.

## Q&A traps to avoid

Do not say:

- “this would have prevented losses during the AWS incident”;
- “we replayed the incident”;
- “all five signals are historically validated”;
- “the signals are statistically independent”;
- “the system can execute trades autonomously”;
- “HTTP 200 means the market evidence is healthy.”

Use `docs/ADVERSARIAL-QA.md` for the bounded answer to each likely challenge.

## Final demo gate

The demo is not final until the public deployment passes all six calls from the same judged origin:

```bash
curl https://YOUR_HOST/health
curl https://YOUR_HOST/.well-known/xagent-verification.json
curl https://YOUR_HOST/api/v1/decision/BTC
curl https://YOUR_HOST/api/v1/decision/BTC/delta
curl "https://YOUR_HOST/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://YOUR_HOST/api/v1/evidence/negative-path
```
