# SignalForge demo video — locked narration + shot plan

Target runtime: **~82 seconds**  
Master: **Remotion, 1920×1080, 30 fps**  
Motion opener: **HyperFrames**  
Product capture: **Playwright against the public Cloudflare runtime**

## Narration

Most market agents ask one question: what is the signal? SignalForge asks a stricter one: is the evidence good enough to hand off at all?

SignalForge pulls public market inputs, checks freshness and quality, and excludes evidence that is stale, unavailable, or inconsistent before fusion.

The result is not just a score. It is an evidence-bound Decision Packet that shows supporting and contradicting evidence, usable coverage, confidence, provider lineage, invalidation conditions, and a freshness lease with a clear valid-until time.

If the evidence is not sufficient, SignalForge refuses the directional handoff instead of manufacturing confidence.

Every packet can be verified with a tamper-evident receipt, and the same bounded contract is available through REST and MCP for agents.

SignalForge never authorizes a trade.

The public Cloudflare runtime exposes the exact source commit through health and X-Agent verification, so the live product can be tied back to the code that produced it.

SignalForge: evidence before recommendation.

## Shot plan

| Time | Visual | Purpose |
|---:|---|---|
| 00:00–00:06 | HyperFrames/Remotion opener: `AVAILABLE ≠ FRESH ≠ CONSISTENT ≠ ACTIONABLE` → SignalForge mark | Immediate thesis |
| 00:06–00:17 | Real live homepage capture | Establish product and question |
| 00:17–00:30 | Real dashboard capture + admission/exclusion callout | Show evidence gate |
| 00:30–00:43 | Real token view + Decision Packet callout | Show inspectability |
| 00:43–00:55 | Purpose-built refusal graphic | Make fail-closed behavior memorable |
| 00:55–01:09 | Runtime proof: exact commit + REST/MCP + `execution_authorized: false` | Prove authority boundary and reproducibility |
| 01:09–01:22 | Closing mark + live runtime | Final memory sentence |

## Claim boundaries

The video must not claim:

- guaranteed signal accuracy;
- guaranteed profitability;
- autonomous trading authority;
- full five-signal historical validation;
- that a freshness lease guarantees forecast validity;
- that restoring missing evidence guarantees a directional conclusion.

The video may state that SignalForge:

- excludes stale/unavailable/inconsistent evidence before fusion;
- can refuse directional handoff under insufficient evidence;
- exposes lineage, confidence, coverage, invalidation, freshness lease and receipt fields;
- exposes bounded REST and MCP contracts;
- keeps `execution_authorized: false`;
- binds the public runtime to an exact source commit through `/health` and X-Agent verification.
