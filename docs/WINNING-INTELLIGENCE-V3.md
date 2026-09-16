# SignalForge — Winning Intelligence v3

Status: **implemented on branch, not deployed**

Canonical product thesis:

> **SignalForge is a pre-action evidence gate that proves when a market agent should refuse to act.**

Supporting rule:

> **Evidence before recommendation. Refusal before false confidence.**

## Why v3 exists

Winning Intelligence v2 established a narrow job, versioned Decision Packets, stateless comparison, deterministic resilience tests, a real read-only MCP surface, and an explicit authority boundary.

V3 asks a harder question:

> What can SignalForge prove about the evidence *behind* a decision that the current X-Agent field generally does not expose?

A scan of current public X-Agent hackathon submissions found many strong implementations of:

- deterministic benchmarks;
- conservative preflight checks;
- typed structured errors;
- exact-commit deployment proof;
- MCP tool surfaces;
- temporal precommit/live comparison;
- authority boundaries;
- live market lookup;
- agent frameworks;
- backtesting and scoring.

The scan did **not** find current submissions explicitly productizing the following bundle:

1. raw-source admission/exclusion ledger;
2. provider lineage concentration across derived signals;
3. freshness-derived evidence lease / `valid_until`;
4. single-channel and provider-dropout decision fragility;
5. minimum currently sufficient evidence subsets;
6. necessary-but-not-sufficient recovery requirements;
7. tamper-evident Decision Packet receipts.

This is the v3 white space.

The claim is deliberately scoped: absence from the public submission scan is not proof that no private or future competitor will implement similar mechanisms.

---

## 1. Evidence Admission Ledger

A raw provider response being reachable is not enough to say it entered a decision.

The ledger records, for each raw source:

- provider;
- freshness status;
- source and receive timestamps;
- age and freshness budget;
- dependent derived signals;
- currently admitted derived signals;
- whether the source passed the quality gate;
- whether it actually contributes to the current decision;
- a machine-readable reason code.

Current reason classes include:

```text
ADMITTED
QUALITY_STALE
QUALITY_UNAVAILABLE
QUALITY_UNKNOWN
QUALITY_INCONSISTENT
QUALITY_MOCK
NO_AVAILABLE_SIGNAL_DEPENDENCY
```

This separates three questions that dashboards often collapse:

```text
provider responded?
source passed quality policy?
source actually entered this decision?
```

Admission does not imply predictive validity or execution authority.

---

## 2. Provider Lineage & Concentration

SignalForge's five channels are complementary, but they are **not claimed to be statistically independent**.

Some derived signals share the same raw inputs:

```text
technical      <- klines
trend          <- klines + ticker
funding        <- funding
open_interest  <- open_interest + ticker
volume         <- klines + ticker
```

V3 maps the lineage of every currently available signal to its raw inputs and providers, then reports:

- unique live providers;
- signals touched by each provider;
- dominant provider;
- dominant-provider signal share;
- shared lineage groups;
- qualitative concentration level.

This makes hidden concentration visible. Five displayed signals can still have a much smaller provider or raw-input diversity footprint.

The concentration analysis is diagnostic. It does not silently alter the actionability gate and does not claim statistical dependence or independence.

---

## 3. Evidence Lease / `valid_until`

Fresh evidence is not fresh forever.

V3 computes a freshness-only lease for the evidence currently admitted to the Decision Packet.

For each contributing raw source:

```text
source freshness deadline = source timestamp + configured max age
```

The Decision Packet's evidence lease is bounded by the **earliest** of those deadlines.

It returns:

- `status`: `valid`, `expired`, or `unknown`;
- `evaluated_at`;
- `valid_until`;
- `remaining_seconds`;
- limiting raw source;
- contributing raw sources;
- per-source deadlines.

Fail-closed semantics:

- if a contributing freshness deadline cannot be proven, lease status becomes `unknown`;
- stale contributing evidence yields `expired`;
- no timestamp is invented;
- mock/unknown freshness cannot become a live lease.

Critical boundary:

> The lease describes evidence freshness only. It does **not** guarantee that price, market regime, recommendation, or forecast remains valid until `valid_until`.

---

## 4. Decision Fragility Stress Test

A Decision Packet can pass policy and still be fragile.

V3 can remove already-observed evidence without inventing replacements and recompute the policy result.

It measures:

- each single-signal dropout;
- minimum number of signal dropouts that force refusal;
- minimum refusal sets;
- provider dropouts based on raw-input lineage;
- downstream signals affected by a provider loss;
- resulting score, confidence, coverage, stance, and actionability.

Provider dropout is especially important because one provider can sit underneath several apparently distinct signals.

Scope:

```text
counterfactual dropout of currently observed evidence
!= historical replay
!= simulated replacement data
!= profit test
```

---

## 5. Minimum Sufficient Evidence

Fragility asks what can be removed before a pass becomes a refusal.

Sufficiency asks the inverse:

> Using only the values actually observed in the current packet, what is the smallest signal subset that still passes the current policy gate?

V3 enumerates bounded subsets of the at-most-five available signals and returns the smallest passing sets.

It records:

- minimum signal count;
- minimum sufficient signal sets;
- resulting actionability;
- resulting recommendation;
- coverage;
- confidence;
- score.

Critical boundary:

```text
current policy sufficiency
!= causal sufficiency
!= future sufficiency
!= proof that omitted evidence is unimportant
```

If the baseline already refuses, SignalForge returns no sufficient subset instead of fabricating one.

---

## 6. Recovery Requirements

A refusal should tell an agent what is missing without pretending to know what restored evidence will say.

V3 reports:

- current coverage vs threshold;
- current adjusted confidence vs threshold;
- gap to each gate;
- missing derived signals;
- raw inputs required by those signals;
- current provider/freshness state of those raw inputs;
- necessary recovery conditions.

The contract explicitly sets:

```json
{
  "guaranteed_recovery": false
}
```

Restoring a source may be necessary, but cannot guarantee a handoff because the future observed value and confidence are still unknown.

---

## 7. Tamper-Evident Decision Receipt

A Decision Packet may be copied into another agent, log, message, or review artifact.

V3 adds a deterministic SHA-256 receipt over canonical material fields including:

- contract and policy version;
- token and snapshot;
- stance, score, confidence, coverage, actionability;
- authority boundary;
- evidence groups;
- data-quality metadata;
- admission ledger;
- lineage analysis;
- evidence lease;
- recovery requirements;
- invalidation conditions;
- next safe action;
- timestamp.

Receipt verification is stateless and requires no market-data fetch:

```http
POST /api/v1/decision/verify-receipt
```

MCP equivalent:

```text
verify_decision_receipt
```

Changing a bound field after issuance invalidates the digest.

This is an integrity mechanism, not a cryptographic signature or proof of who created the packet. No signing-key claim is made.

---

## Agent surface

### Decision Packet

```http
GET /api/v1/decision/BTC
```

Adds:

```text
evidence_admission_ledger
evidence_lineage
evidence_lease
recovery_requirements
receipt
```

### Stress

```http
GET /api/v1/decision/BTC/stress
```

Adds:

```text
single_channel_dropouts
provider_dropouts
minimum_dropouts_to_refusal
minimum_refusal_sets
minimum_sufficient_evidence
evidence_lease
recovery_requirements
```

### Receipt verification

```http
POST /api/v1/decision/verify-receipt
```

### MCP

The MCP surface remains stateless and read-only. V3 adds only two distinct jobs instead of entering a tool-count race:

```text
stress_test_decision
verify_decision_receipt
```

Existing tools remain:

```text
get_decision_packet
compare_decision_packet
validate_price_signals
inspect_negative_path
run_evidence_resilience_benchmark
```

No MCP path grants execution authority.

---

## Competitive interpretation

The public field contains strong ideas worth learning from:

- **Contract Guard** — deterministic judge-runnable benchmark and bounded deterministic core;
- **BHRIGU** — explicit temporal evidence and evidence interpretation around external authority;
- **YAI Agent Core** — serious MCP productization and runtime engineering;
- **Finfold** — claim-to-evidence discipline and operational rigor;
- **SchemaBridge** — narrow typed job and structured errors;
- **SafeGate** — explicit authority boundary and deterministic outcome;
- **BountyProof** — conservative preflight framing;
- **Grid Witness** — reproducible bounded verification.

SignalForge should not imitate those products. It uses the shared lesson: a judge should be able to interrogate the system's claims mechanically.

V3 differentiation is therefore not “more market intelligence.” It is:

> **Decision evidence that can explain admission, dependency, time-bounded freshness, fragility, sufficiency, recovery and integrity before an agent is allowed even a research handoff.**

---

## What SignalForge still refuses to claim

V3 does not justify claims that:

- the five channels are statistically independent;
- provider diversity equals statistical diversity;
- a valid evidence lease guarantees future recommendation validity;
- a minimum sufficient set is causally sufficient;
- restoring a missing source guarantees actionability;
- the controlled stress test replays a historical incident;
- the resilience benchmark proves market accuracy;
- the 3-of-5 validation proves the full composite;
- the receipt is a digital signature;
- SignalForge authorizes execution;
- Winning Intelligence v3 is public/live before an exact-commit deployment is verified.

---

## TRACE UI/UX implications

Do not visualize v3 as another crypto dashboard.

The next interface should make the following chain visible as a first-class object:

```text
RAW SOURCE
    ↓
ADMISSION / EXCLUSION
    ↓
LINEAGE / SHARED DEPENDENCIES
    ↓
FRESHNESS LEASE
    ↓
DERIVED SIGNALS
    ↓
COVERAGE + CONFIDENCE GATE
    ↓
FRAGILITY / MINIMUM SUFFICIENT SET
    ↓
REFUSE or RESEARCH HANDOFF
    ↓
TAMPER-EVIDENT RECEIPT
```

A judge should be able to see why a source disappeared, what other signals depend on the same provider, how long the admitted evidence remains fresh, what loss would collapse the decision, what subset is currently sufficient, what recovery is necessary, and whether the resulting packet was altered later.

That is the design opportunity. Price cards and generic market charts become supporting context, not the visual thesis.

---

## Deployment boundary

This document describes branch functionality.

Until an exact merged SHA is deployed and independently verified through `/health`, `/.well-known/xagent-verification.json`, REST proof calls and MCP proof calls:

```text
WINNING_INTELLIGENCE_V3_LIVE = false
```

Production truth remains whatever exact SHA `/health` reports.
