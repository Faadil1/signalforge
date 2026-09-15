# SignalForge — Submission Assurance Matrix

This document is the canonical map from hackathon rubric to pain, product, evidence, demo and Q&A. It prevents a technically complete build from becoming a weak submission story.

## Canonical cycle

`RUBRIC -> PAIN -> PROBLEM -> DIFFERENTIATOR -> EXECUTION -> EVIDENCE -> STORY -> DEMO -> Q&A`

Every stage must point to an inspectable artifact. A stage that exists only as prose is not considered closed.

## 1. RUBRIC

Official X-Agent review scorecard:

- Real agent/user value — 30
- Demonstrated capability quality — 25
- Engineering and maintainability — 20
- MCP productization readiness — 15
- Adoption and operating potential — 10

Scoring begins only after hard gates pass: complete source, reproducible verification, reachable deployment, exact review-commit binding, and baseline security/licensing/ownership/data-use checks.

Canonical source: `xagentAI/xagt-plugin/docs/review-scorecard.md`.

## 2. PAIN

Market agents can receive a mixture of healthy, partial, stale or unavailable evidence while the surrounding system still appears operational. The 2025-04-15 AWS Tokyo incident affecting Binance is the canonical real-world failure record for this failure class.

Evidence:

- `evidence/real-failures/AWS-TOKYO-BINANCE-2025-04-15.md`
- `evidence/real-failures/aws-tokyo-binance-2025-04-15.json`

## 3. PROBLEM

A raw score is unsafe if the system cannot answer:

- what evidence was actually available;
- how fresh it was;
- what was missing or degraded;
- how much confidence remains;
- whether the system should abstain;
- whether the agent has authority to execute.

## 4. DIFFERENTIATOR

SignalForge is not positioned as a generic five-indicator dashboard. It is an **evidence-bound market decision layer for agents**.

Differentiators:

- provenance per evidence source;
- freshness/data-quality classification;
- missing/stale evidence removed from actionable coverage;
- confidence-gated abstention;
- Decision Packets with supporting/contradicting evidence and invalidation;
- material-change detection through Signal Delta;
- explicit `execution_authorized: false`;
- historical validation scope that says exactly what is and is not validated.

## 5. EXECUTION

Inspectable implementation:

- `api/services/binance_client.py` — upstream collection, provenance, freshness and fail-closed behavior
- `api/services/signal_fusion.py` — evidence fusion and actionability gates
- `api/services/decision_service.py` — Decision Packet / Delta
- `api/services/validation_service.py` — bounded historical validation
- `/api/v1/evidence/negative-path` — controlled counter-case
- `/judge` — reviewer proof surface

## 6. EVIDENCE

Evidence hierarchy:

1. **OBSERVED-EXTERNAL** — sourced real-world event facts.
2. **OBSERVED-IN-BUILD** — runtime responses, tests, CI, deployment proof.
3. **INFERRED** — product/design implications derived from observed facts.
4. **UNKNOWN** — counterfactuals or facts the system did not capture.

Rules:

- Real failure > fake success.
- UNKNOWN is preferred to invented certainty.
- Controlled fixtures must be labelled controlled; they may reproduce a failure class but cannot masquerade as historical replay data.
- Failed checks and degraded states remain part of the evidence record.

## 7. STORY

Core story:

> When market evidence is healthy, SignalForge explains the decision. When evidence degrades, SignalForge reduces confidence or refuses to decide.

Memory sentence:

> **Evidence before recommendation. Refusal before false confidence.**

## 8. DEMO

The judge demo must show both paths:

### Positive path

1. `/health` proves deployment/commit binding.
2. Decision Packet shows live provenance, coverage and no execution authority.
3. Delta shows what materially changed.
4. Validation Lab shows bounded 3/5 historical calibration without overclaiming.

### Negative path

1. Open `/api/v1/evidence/negative-path` from `/judge`.
2. Show the real failure case that motivated the control.
3. Show the controlled degraded-evidence fixture.
4. Verify stale/unavailable sources are not silently treated as usable evidence.
5. Verify the result is `insufficient_evidence` and `execution_authorized: false`.
6. State explicitly that this is a controlled reproduction of the failure class, not a replay of 2025 Binance payloads.

## 9. Q&A

Canonical adversarial answers live in `docs/ADVERSARIAL-QA.md`.

## Mandatory gateways

The project is not `SUBMISSION_READY` until every applicable gate below is closed.

| Gate | Purpose | Current proof |
| --- | --- | --- |
| Eligibility / scope | Correct event/track and package shape | `docs/XAGENT-SUBMISSION-CHECKLIST.md` |
| Rubric fit | Every scoring area mapped to inspectable evidence | this file |
| Real failure | At least one concrete sourced negative event | `evidence/real-failures/` |
| Failure / refusal | Product can abstain/fail closed | tests + negative-path endpoint |
| Freshness / data quality | Availability is not confused with freshness | source metadata + fusion gate |
| Evidence integrity | OBSERVED / INFERRED / UNKNOWN remain distinct | real-failure record |
| Claims discipline | No unsupported performance/authority claims | README + judge docs |
| Security / dependencies | No high/critical production dependency findings | CI `npm audit` gate + backend tests |
| Rights / data use | External data dependency and rights declared | submission package, pending final archive |
| Reproducibility | Clean install/test/build path | CI + README |
| Runtime binding | Public service returns exact review commit | **PENDING DEPLOYMENT** |
| Observability / operations | Error behavior, usage and limits are visible | `/health`, usage, error envelopes, docs |
| Deterministic demo | Positive and negative paths are repeatable | `/judge` + negative-path endpoint |
| Adversarial Q&A | Weaknesses and boundaries pre-answered | `docs/ADVERSARIAL-QA.md` |
| Final snapshot / archive | Source + verification + rights frozen to review commit | **PENDING FINAL DEPLOYMENT** |

## Stop conditions

Do not mark the project submission-ready if any of these are true:

- deployment is unreachable;
- `/health` or verification JSON does not match the review commit;
- mock data is presented as live;
- a stale/unknown source contributes as healthy evidence;
- negative-path behavior cannot be reproduced;
- a claim exceeds the evidence;
- full five-signal validation is implied when only the price-derived 3/5 subset was validated;
- autonomous execution authority is implied;
- source, verification or rights package is incomplete.
