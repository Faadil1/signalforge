# SignalForge — Adversarial Judge Q&A

These answers are deliberately narrow. They state what the build proves, what it does not prove, and where it refuses certainty.

## Why is SignalForge more than a five-indicator dashboard?

Because the product contract is not the score. The contract includes provenance, per-source quality, coverage, confidence, supporting/contradicting evidence, invalidation, material change, abstention and explicit lack of execution authority. Missing or degraded evidence can suppress the recommendation entirely.

## What real failure motivated the trust model?

The canonical case is the 2025-04-15 AWS Tokyo connectivity incident that affected Binance and other crypto platforms. Reuters reported partial service failures and a temporary Binance withdrawal suspension of about 23 minutes. See `evidence/real-failures/AWS-TOKYO-BINANCE-2025-04-15.md`.

## Are you claiming SignalForge ran during that incident?

No. That would be false. The incident is real external evidence for the failure class. SignalForge's negative-path endpoint is a controlled reproduction of degraded evidence behavior, not a replay of historical Binance request payloads. The exact counterfactual SignalForge output for 2025-04-15 is `UNKNOWN`.

## What happens if Binance is partially available?

Each source carries provenance and freshness status. Stale, unavailable or timestamp-unknown evidence is not allowed to count as healthy signal coverage. Coverage/confidence fall, and the system may return `insufficient_evidence` rather than forcing BUY/SELL/HOLD.

## What happens if all sources fail?

Production fails closed. With `ALLOW_MOCK_FALLBACK=false`, the Binance client raises an upstream error instead of silently fabricating evidence.

## Can mock data ever appear?

Only when `ALLOW_MOCK_FALLBACK=true` is explicitly enabled. That mode is labelled `mock`; it is not permitted for the public judged deployment.

## Why not execute trades automatically?

SignalForge is a decision-intelligence layer, not an execution authority. Every Decision Packet exposes `execution_authorized: false`. A downstream system can decide how to use the packet under its own authorization and risk controls.

## How do you know a source is fresh?

Live Binance responses expose source-side timestamps where available. SignalForge records the source timestamp, local receive time, age and a maximum-age policy. A source can be `fresh`, `stale`, `unavailable`, `unknown` or `mock`. The decision layer treats non-fresh live evidence as degraded.

## Isn't freshness threshold selection arbitrary?

It is a policy boundary, not a statistical guarantee. Thresholds are chosen to be conservative relative to each endpoint's update cadence and are exposed in metadata rather than hidden. The important product behavior is that age is visible and can gate actionability.

## What is actually historically validated?

Only the price-derived 3/5 subset: technical, trend and volume. Funding and open-interest are explicitly omitted from the current historical calibration because aligned historical series are not yet ingested. `full_composite_validated` remains false.

## Does the backtest prove profitability?

No. It is an experimental evaluation surface with corrected transaction-cost direction and next-candle execution timing. It does not establish future profitability.

## Why does Signal Delta use process memory?

For the hackathon implementation, Delta demonstrates material-change detection with a clearly declared process-memory limitation. Cross-instance durable persistence is an operating upgrade, not something the current build pretends to have.

## What if a source returns HTTP 200 with stale data?

Transport success does not override the data-quality gate. If the source timestamp is stale or cannot be established where freshness is required, that source does not count as healthy evidence.

## What if timestamps disagree across sources?

The per-source quality record remains visible. A source outside its maximum-age policy is degraded independently. A future extension can add explicit cross-source skew/consistency thresholds; the current build does not claim that capability beyond per-source freshness gating.

## What is the strongest unresolved risk?

Runtime proof until deployment is frozen. The build is not submission-ready until the public origin exposes the exact review commit on `/health` and `/.well-known/xagent-verification.json`, the judge surface works same-origin, and the verification responses are archived.

## What would make you refuse to submit?

Any mismatch between deployed and reviewed commit, mock evidence presented as live, stale evidence treated as healthy, failed negative-path proof, unsupported performance claims, incomplete source/rights package, or an unreachable API.
