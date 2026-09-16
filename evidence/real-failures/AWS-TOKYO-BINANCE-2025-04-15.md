# Real Failure Record — AWS Tokyo / Binance — 2025-04-15

> Canonical principle: **Real failure > fake success.** A failure stays in the evidence record. It is not rewritten into a clean success story.

## 1. Positive signal / opportunity

Agents can consume market data faster than humans, but speed becomes dangerous when data availability is mistaken for data quality. SignalForge exists to turn multiple market evidence channels into a bounded decision contract with provenance, coverage, confidence, invalidation and explicit abstention.

## 2. Concrete negative event

On **2025-04-15**, a connectivity issue in an AWS Tokyo data center disrupted several cryptocurrency platforms, including Binance. Reuters reported that Binance temporarily suspended withdrawals for about **23 minutes** and that, during the incident, some orders were succeeding while others were failing.

Primary external evidence used by this record:

- Reuters: https://www.reuters.com/technology/binance-services-start-recover-after-network-interruption-2025-04-15/

This repository treats those externally reported facts as **OBSERVED-EXTERNAL**, not as observations made by SignalForge itself.

## 3. Observable impact

- temporary withdrawal interruption;
- partial order failures while upstream infrastructure was degraded;
- operational uncertainty during recovery.

The record does **not** invent a dollar-loss estimate or claim a user-loss figure that the source does not establish.

## 4. Design implication

The incident demonstrates a critical distinction:

`AVAILABLE != FRESH != CONSISTENT != ACTIONABLE`

A successful request or partially functioning upstream does not prove that every evidence channel is fresh enough to support a directional recommendation. SignalForge must therefore treat freshness and availability as evidence properties, not transport details.

## 5. SignalForge mitigation

The hardened build responds to this failure class through:

- explicit per-source provenance;
- per-source freshness status and source timestamp;
- stale/unknown evidence excluded from signal availability;
- coverage and adjusted-confidence gating;
- `insufficient_evidence` as a first-class recommendation/actionability state;
- fail-closed behavior when usable evidence disappears;
- `execution_authorized: false` in every Decision Packet;
- a deterministic controlled negative-path endpoint visible from `/judge`.

## Epistemic boundary

### OBSERVED-EXTERNAL

The AWS/Binance incident occurred and affected Binance services as described above.

### OBSERVED-IN-BUILD

SignalForge's automated tests and controlled negative-path route demonstrate that degraded/stale evidence can force abstention and that complete upstream loss fails closed.

### INFERRED

The real incident motivates the freshness and degradation controls because partial infrastructure failure can produce a mixture of success and failure across operations.

### UNKNOWN

SignalForge was not running with a preserved request trace during the 2025-04-15 incident. Therefore:

- its exact output at that historical moment is unknown;
- the controlled negative-path fixture is **not** a historical replay;
- no claim is made that SignalForge would have prevented a specific financial loss.

That distinction is intentional and judge-visible.
