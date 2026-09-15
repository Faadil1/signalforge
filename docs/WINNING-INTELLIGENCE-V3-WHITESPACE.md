# SignalForge — Winning Intelligence v3: Whitespace Exploitation

Status: product-first, before TRACE UI/UX v2.

## Core thesis

SignalForge should not compete by adding more market scores, more tools, more chat, or execution authority.

The strongest underexploited job in the current X-Agent field is:

> After an evidence gate refuses, tell the agent exactly what is missing, what evidence can safely be reacquired, and when reevaluation is allowed — without inventing missing data or promising that recovery will make the decision actionable.

This extends the canonical wedge:

**Evidence before recommendation. Refusal before false confidence. Recovery before retry.**

## Public-field scan

High-signal competing mechanisms observed in the X-Agent submission repository include:

- BHRIGU Temporal Evidence / OlaXBT Evidence Agent: locked past evidence, live comparison, strategy-context trust assessment.
- Contract Guard: deterministic benchmark, consumer-aware impact, reproducible rule engine.
- YAI Agent Core: explicit state model, real MCP productization, runtime adaptability.
- Finfold Growth Mission: claim-to-evidence discipline, idempotency, operating evidence.
- SchemaBridge: narrow typed job, structured errors and explicit limits.
- SafeGate Commerce Outcome: deterministic outcome and strict authority boundary.
- BountyProof: conservative evidence-linked preflight.
- Smart Trade Copilot / PhylaX / ArgosX: trade safety, simulation or execution-oriented flows.
- ChainScribe / MarketMind / Research Terminal: market lookup, research and conversational intelligence.

The public PR scan found no submission positioning `recovery` or `refusal` as a primary capability term at the time of this review. This is a field observation, not proof that no competitor has an internal mechanism with similar semantics.

## Saturated zones to avoid

- generic 0–100 market scoring
- BUY / SELL / HOLD as the product thesis
- more dashboard cards or chart density
- generic “AI agent” positioning
- chat-first crypto research as the core wedge
- MCP tool-count races
- wallet or execution authority
- LLM second-opinion features
- backtest metrics as the primary proof
- synthetic completion of missing derivatives evidence

## Whitespace 1 — Refusal Recovery Contract

Implemented service: `api/services/recovery_service.py`

Contract name: `refusal_recovery_v1`

Purpose:

1. classify why the current packet is refused;
2. quantify evidence debt against policy thresholds;
3. enumerate unavailable evidence channels;
4. map channels to raw source dependencies;
5. identify safe reacquisition candidates;
6. state the conditions under which reevaluation is allowed;
7. preserve `execution_authorized:false`;
8. explicitly state that recovery does not guarantee actionability or direction.

Key outputs:

- `blocking_conditions`
- `evidence_debt.coverage_gap`
- `evidence_debt.confidence_gap`
- `evidence_debt.unavailable_signals`
- `minimum_additional_signals_for_coverage_only`
- `recovery_candidates`
- `next_safe_action`
- `re_evaluate_after`
- `non_guarantees`

## Whitespace 2 — Content-addressed Refusal Receipt

Every refusal recovery plan carries a `refusal_receipt_id` derived from the canonical refusal basis:

- decision contract version
- evidence policy version
- token
- decision snapshot id
- actionability
- coverage
- confidence
- blocking conditions
- unavailable signals

The receipt is not a blockchain claim, signature, or proof of external truth. It is a deterministic content identifier for the exact refusal state.

Why it matters:

- agents can log exactly which refusal they reacted to;
- reviewers can reproduce the same receipt from the same refusal state;
- downstream systems can avoid conflating two different degraded-evidence states;
- retry/recovery can be tied to a prior refusal without granting execution authority.

## Whitespace 3 — Evidence Debt

SignalForge separates “the model has a number” from “the evidence is complete enough to trust the number.”

Evidence debt makes the deficit machine-readable:

- current coverage vs required coverage;
- current confidence vs required confidence;
- missing signal channels;
- raw source states and freshness requirements.

This is intentionally not converted into a fake confidence forecast.

## Whitespace 4 — Recovery is not a counterfactual prediction

A critical differentiation rule:

> Reacquiring one missing source may make policy thresholds satisfiable, but SignalForge must not claim the future Decision Packet will become actionable until the new evidence actually arrives, passes quality gates, and is recomputed.

Therefore the contract uses:

`REACQUIRE_AND_REEVALUATE`

not:

`RECOVER_AND_TRADE`

## Whitespace 5 — UI opportunity created by the product layer

TRACE UI/UX v2 should visualize a state transition rather than a dashboard:

`EVIDENCE ARRIVES`
→ `QUALITY CHALLENGE`
→ `SOURCE EXCLUSION`
→ `EVIDENCE DEBT`
→ `REFUSAL RECEIPT`
→ `RECOVERY PLAN`
→ `REACQUIRE`
→ `REEVALUATE`
→ `REFUSE AGAIN / RESEARCH HANDOFF`

The key visual object becomes a **decision gate with an observable recovery lifecycle**, not another crypto analytics screen.

## Non-goals

Do not add:

- wallet connection or trade execution;
- synthetic funding/open-interest values;
- promises that recovery yields a BUY/SELL state;
- claims that controlled policy fixtures are historical replays;
- claims of statistical independence among the five evidence channels;
- “AI confidence” language that obscures policy thresholds;
- opaque autonomous retry loops.

## Verification target

Before calling this capability live:

1. service unit tests pass;
2. REST route is wired and tested;
3. capability manifest advertises it accurately;
4. MCP parity is added only if the reviewed tool contract is updated and tests stay green;
5. exact merged upstream SHA is deployed;
6. `/health` and X-Agent verification bind to that SHA;
7. a public refusal-recovery call is captured;
8. identical refusal state reproduces the same `refusal_receipt_id`;
9. a changed refusal state produces a different receipt;
10. no recovery output grants execution authority.

Until those gates pass, this document describes branch-level implementation and design intent, not a production claim.
