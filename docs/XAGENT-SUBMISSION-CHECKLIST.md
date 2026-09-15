# X-Agent Submission Checklist — SignalForge

SignalForge targets the **Open Innovation** track. OlaXBT Nexus MCP is therefore not a hard requirement for this entry.

This file is a packaging checklist, not a submission receipt. Do not replace placeholders with fabricated evidence.

## 0. Assurance cycle

Before packaging, confirm the complete submission chain is inspectable:

`RUBRIC -> PAIN -> PROBLEM -> DIFFERENTIATOR -> EXECUTION -> EVIDENCE -> STORY -> DEMO -> Q&A`

- [x] Rubric mapped to evidence in `docs/SUBMISSION-ASSURANCE.md`.
- [x] Real failure case recorded under `evidence/real-failures/`.
- [x] Negative/refusal path implemented and callable.
- [x] Evidence freshness/data-quality gate implemented.
- [x] OBSERVED / INFERRED / UNKNOWN boundaries documented.
- [x] Positive + negative demo runbook exists in `docs/JUDGE-DEMO.md`.
- [x] Adversarial judge Q&A exists in `docs/ADVERSARIAL-QA.md`.

Canonical rule: **Real failure > fake success.** Failed/degraded states remain part of the evidence record.

## 1. Freeze the review commit

- [ ] Merge the final hardening branch only after backend + frontend quality gates pass.
- [ ] Record the exact 40-character commit that will be deployed.
- [ ] Keep `ALLOW_MOCK_FALLBACK=false`.
- [ ] Keep public alerts disabled unless ownership/persistence is completed.
- [ ] Freeze claims at or below what the evidence proves.

## 2. Deploy the exact reviewed commit

Required evidence:

- [ ] Public API origin is reachable during the review window.
- [ ] Public web/judge origin is reachable.
- [ ] `GET /health` returns `status: ok` and the exact reviewed commit.
- [ ] `/health` reports `mock_fallback_enabled: false` and `evidence_policy: freshness_gated`.
- [ ] `GET /.well-known/xagent-verification.json` returns `slug: signalforge` and the same commit.
- [ ] `/judge` loads all same-origin proof calls successfully.

Do not populate deployment URLs here until the actual deployment exists.

## 3. Verification calls

Run and save the exact responses:

```bash
curl https://YOUR_REAL_HOST/health
curl https://YOUR_REAL_HOST/.well-known/xagent-verification.json
curl https://YOUR_REAL_HOST/api/v1/decision/BTC
curl https://YOUR_REAL_HOST/api/v1/decision/BTC/delta
curl "https://YOUR_REAL_HOST/api/v1/validation/BTC?period_days=120&horizon_days=3"
curl https://YOUR_REAL_HOST/api/v1/evidence/negative-path
```

Verify:

- [ ] live Decision Packet exposes provenance and freshness metadata;
- [ ] stale/unknown/inconsistent live evidence is not represented as healthy;
- [ ] negative path returns `not_a_historical_replay: true`;
- [ ] negative path returns `insufficient_evidence` and `execution_authorized: false`;
- [ ] Validation Lab returns `full_composite_validated: false`;
- [ ] no production response is labelled `mock`.

Then:

- [ ] Save responses under the official submission package's `verification/` directory.
- [ ] Preserve degraded/failure evidence rather than redacting it into a success-only packet.
- [ ] Redact no evidence needed by the reviewer.
- [ ] Never commit secrets or private credentials.

## 4. Official archive package

The X-Agent submission repository requires one project directory containing:

```text
submissions/mcp-hackathon/<team>-signalforge/
├── SUBMISSION.md
├── submission.json
├── RIGHTS.md
├── source/
└── verification/
    └── README.md
```

Before opening the official PR:

- [ ] Copy the **complete reviewed source** into `source/`.
- [ ] Include lockfiles and dependency manifests.
- [ ] Include configuration examples with no secrets.
- [ ] Include the real-failure evidence record and judge-assurance docs.
- [ ] Declare Binance as an external public-data dependency.
- [ ] Declare Reuters only as an external source for the documented historical incident; do not imply ownership of Reuters content.
- [ ] Declare the exact public repository and review commit.
- [ ] Declare the actual API/health URLs only after deployment.
- [ ] Complete the rights/archive authorization truthfully.

An external repository link alone is not sufficient for the official archive.

## 5. Capability statement

Recommended concise framing:

> SignalForge is an evidence-bound crypto market decision layer for agents. It converts live public market data into freshness- and confidence-gated Decision Packets with explicit provenance, supporting and contradicting evidence, invalidation conditions, material-change detection, a reproducible refusal path, and no autonomous execution authority.

Avoid claiming:

- five statistically independent signals;
- guaranteed trading performance;
- full five-signal historical validation;
- autonomous execution authority;
- synthetic data as live market evidence;
- that SignalForge captured or replayed the 2025 AWS/Binance incident;
- that the build prevented a specific historical loss;
- that HTTP success alone proves data freshness or consistency.

## 6. Security / data / operations gate

- [ ] backend lint passes;
- [ ] backend format check passes;
- [ ] backend tests pass;
- [ ] frontend dependency audit has no high/critical production findings;
- [ ] frontend lint passes;
- [ ] TypeScript check passes;
- [ ] frontend production build passes;
- [ ] mock fallback remains disabled in judged runtime;
- [ ] alerts remain disabled unless multi-tenant ownership/persistence is complete;
- [ ] usage/error surfaces expose enough behavior for reviewer diagnosis;
- [ ] external data and historical-event sources are declared accurately.

## 7. Final judge gate

Do not mark the project `SUBMISSION_READY` until all are true:

- [ ] all quality/security gates above pass on the final review commit;
- [ ] public deployment reachable;
- [ ] exact commit binding verified;
- [ ] Decision Packet call verified;
- [ ] Delta call verified;
- [ ] Validation Lab call verified;
- [ ] real-failure/negative-path call verified;
- [ ] positive and negative demo runbook can be executed deterministically;
- [ ] adversarial Q&A has no answer that exceeds current evidence;
- [ ] source archive complete;
- [ ] verification archive complete;
- [ ] rights declaration complete.

Only then convert the final project PR from draft to ready, freeze the review commit, and package the official X-Agent submission.
