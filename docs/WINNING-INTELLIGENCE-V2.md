# SignalForge — Winning Intelligence v2

Date: 2026-09-15

Status: post-merge product/competition intelligence pass, before the next UI/UX review.

This document records the reasoning behind the post-merge product changes. It is not a claim that SignalForge has won, nor a claim about other teams' final judging outcomes.

## Official scorecard

The X-Agent MCP Hackathon review scorecard allocates 100 points:

| Area | Weight | SignalForge interpretation |
| --- | ---: | --- |
| Real agent/user value | 30 | Own one meaningful pre-action job rather than becoming another generic market dashboard. |
| Demonstrated capability quality | 25 | Show live results, bounded errors, refusal behavior, explicit limits and reproducible evidence. |
| Engineering and maintainability | 20 | Make serverless/runtime behavior honest, testable and reproducible. |
| MCP productization readiness | 15 | Make tool boundaries, schemas, authority, errors and side effects explicit and callable. |
| Adoption and operating potential | 10 | Show a credible release/runbook/version/support model beyond the demo. |

Hard gates remain more important than score: exact source/deployment binding, complete review source, reproducibility, rights, secret/data-use checks and a reachable API must all pass first.

## Public competitive field scan

Observed from public X-Agent submission PRs available on 2026-09-15. This is a mechanism scan, not a ranking.

### BHRIGU OlaXBT Strategy Evidence Agent — PR #55

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/55

Why it matters:
- closest conceptual overlap with SignalForge;
- asks whether an agent can trust evidence context behind an existing strategy signal;
- read-only authority boundary;
- exposes supports, contradictions, limitations and per-source status;
- real REST + MCP capability evidence.

Important distinction to preserve:
- BHRIGU interprets evidence around an OlaXBT/Nexus strategy whose signal authority remains external;
- SignalForge is an Open Innovation **pre-action evidence gate** built around its own bounded evidence fusion and explicit refusal policy;
- SignalForge's differentiator should therefore be **degradation behavior + refusal conformance**, not a generic claim of "evidence-aware trading".

### Contract Guard — PR #54

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/54

Strong mechanisms:
- deterministic core rather than LLM-only judgement;
- explicit benchmark;
- consumer-aware impact;
- clear MCP tool catalogue;
- reproducible outputs and directly testable claims.

Principle adopted, not product copied:
- a capability becomes stronger when judges can run a deterministic benchmark themselves.

SignalForge translation:
- Evidence Resilience Benchmark measures fail-closed policy conformance under controlled evidence degradation.

### YAI Agent Core — PR #56

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/56

Strong mechanisms:
- library-first/productized agent capability;
- real native + remote MCP tool calls;
- extensive offline test suite;
- explicit rate limiting/history semantics;
- operational keep-warm/review readiness.

Principle adopted:
- agent productization and state semantics must be explicit, not inferred from a web UI.

SignalForge translation:
- stateless MCP transport;
- machine-readable capabilities contract;
- explicit state model;
- caller-supplied baseline for durable comparison.

### Finfold Growth Mission — PR #34

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/34

Strong mechanisms:
- claim-to-evidence discipline;
- idempotency and attribution;
- production benchmark;
- explicit security/retention/log-redaction controls;
- strong operational/reproducibility story.

Principle adopted:
- operating potential is evidence, not roadmap prose.

SignalForge translation:
- exact-commit deployment procedure;
- provider-degradation runbook;
- rollback/version policy;
- reviewer live-challenge readiness.

### SchemaBridge — PR #59

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/59

Strong mechanisms:
- very narrow job;
- typed outputs;
- strict request limits;
- structured failure behavior;
- successful and expected-error public probes.

Principle reinforced:
- errors and limits are part of capability quality.

### SafeGate Commerce Outcome — PR #33

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/33

Strong mechanisms:
- deterministic outcome;
- external evidence verification;
- explicit authority boundary;
- no claim to replace the underlying payment rail.

Principle reinforced:
- preserve system-of-record authority instead of overstating what the agent layer owns.

### ChainScribe — PR #10

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/10

Strong mechanisms:
- zero-config live market UX;
- visible tool provenance;
- multi-step agent calls;
- simple user-facing job.

Collision risk for SignalForge:
- "live market data + AI" is not distinctive enough;
- a chat experience or another market lookup surface would weaken SignalForge's wedge.

### GasPulse — PR #35

Public submission:
https://github.com/xagentAI/xagt-plugin/pull/35

Strong mechanism:
- narrow, deterministic agent-callable score with an explicit non-risk/non-compliance boundary.

Principle reinforced:
- a small legible job can score better than a broad bundle of weak features.

## Saturated patterns in the field

The following are common enough that SignalForge should not rely on them as differentiation:

- generic 0–100 scores;
- BUY/SELL/HOLD-style outputs;
- dashboards with live market cards;
- chat-first market lookup;
- "AI agent" positioning without a narrow job;
- large tool counts as a proxy for usefulness;
- basic MCP wrapping of existing endpoints;
- generic provenance labels without a failure policy;
- backtest metrics presented as the main product proof.

## SignalForge's winning wedge

The product should be understandable in one sentence:

> **SignalForge is a pre-action evidence gate that proves when a market agent should refuse to act.**

The defensible mechanism stack is:

1. **Evidence quality before conviction** — AVAILABLE != FRESH != CONSISTENT != ACTIONABLE.
2. **Real production degradation** — Binance Futures and Spot were actually blocked from the Cloudflare environment; the product learned to fail over transparently rather than hide the problem.
3. **No fake completeness** — Coinbase restores price-derived evidence only; funding/OI remain unavailable instead of being synthesized.
4. **Machine-readable refusal** — insufficient evidence maps to a safe next action, not a neutral-looking pseudo-signal.
5. **Evidence Resilience Benchmark** — deterministic policy-conformance under healthy, stale/unavailable, inconsistent and mock-removed evidence states.
6. **Stateless material-change comparison** — caller-supplied Decision Packets survive serverless isolate boundaries.
7. **Explicit authority boundary** — research handoff never becomes trading authorization.
8. **REST + real stateless MCP** — the same bounded job is callable by agents without depending on the UI.
9. **Exact-commit runtime proof** — deployment identity is part of the product evidence.

## Hidden spots found and applied

### 1. Process-memory Delta was not durable

Before:
- `/decision/{token}/delta` depended on process-local Worker memory.

Applied:
- `POST /api/v1/decision/{token}/compare` accepts a caller-supplied prior Decision Packet;
- MCP `compare_decision_packet` exposes the same stateless workflow;
- the old delta endpoint remains as an explicitly non-durable convenience surface.

### 2. One negative fixture was not enough to prove policy quality

Before:
- one strong controlled negative path.

Applied:
- `GET /api/v1/evidence/resilience-benchmark`;
- MCP `run_evidence_resilience_benchmark`;
- four deterministic conformance scenarios;
- explicit scope: policy behavior, not profitability or historical replay.

### 3. Agent product contract was scattered

Applied:
- versioned Decision Packet contract;
- versioned evidence policy;
- `agent_next_action`;
- authority boundary;
- `/api/v1/capabilities` state/tool/side-effect manifest.

### 4. MCP readiness was weaker than top applicants

Applied:
- stateless MCP `2026-07-28` endpoint at `/mcp`;
- `server/discover`, `tools/list`, `tools/call`;
- five read-only tools;
- deterministic schemas and annotations;
- protocol/method/name checks;
- Origin validation;
- MCP conformance tests in Cloudflare CI.

### 5. Story/runtime provenance drift

Before:
- README still contained Binance-only wording after verified Coinbase fallback.

Applied:
- multi-provider wording;
- bounded 3/5 validation wording;
- explicit provider semantics;
- MCP/product contract reflected in documentation.

### 6. Adoption/operability evidence was implicit

Applied:
- `docs/OPERATIONS.md`;
- release invariants;
- exact-commit deploy/review procedure;
- provider-degradation incident handling;
- rollback policy;
- MCP/contract versioning;
- reviewer live-challenge readiness.

## What not to add just to look bigger

Before the next UI/UX pass, do **not** dilute the wedge with:

- wallet/order execution;
- autonomous trading;
- an LLM-generated second opinion;
- more market evidence channels without a proven semantic role;
- fake historical funding/OI reconstruction;
- additional dashboards whose only value is visual density;
- claims that the five evidence channels are statistically independent;
- security/risk/compliance framing that could approach excluded hackathon scope;
- an MCP tool-count race.

## UI/UX implication for the next TRACE pass

The next interface should not be designed as "a better crypto dashboard".

It must make the winning mechanism visible within seconds:

**Evidence enters → quality is challenged → degraded sources are removed → confidence/coverage changes → the gate either permits a bounded research handoff or visibly refuses.**

The key visual object should therefore be the **Evidence Gate / Refusal Transition**, not price cards or charts.

The Evidence Resilience Benchmark and MCP tool contract should become first-class proof surfaces, but UI work should start only after this product-intelligence branch is merged/redeployed and exact-runtime proof is restored.
