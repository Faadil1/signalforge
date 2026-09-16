# TRACE UI/UX v2 — Prismatic Evidence Foundry

## Canonical design sentence

**SignalForge should feel like a living evidence machine: raw sources enter as colored matter, quality policy cuts away what cannot be trusted, refusal becomes a visible event, recovery becomes a repair path, and receipts make the resulting state inspectable.**

This direction replaces the earlier Seismic Market Atlas as the primary visual system.

## Primary anti-lineages

Do not drift into:

- generic crypto dashboard
- black/navy AI SaaS
- ivory editorial paper
- glassmorphism everywhere
- rounded bento-card product marketing
- neon cyberpunk terminal cosplay
- price charts as the main story
- decorative shaders detached from product state
- random component-library sampling

## Reference routing

### Product flow

- **Mobbin / Pageflows** — task sequencing and progressive disclosure. Apply to the Evidence Lifecycle flow and to the refusal -> recovery -> verification sequence.
- **Femke** — product hierarchy and design-ops discipline. Every visual state must correspond to a named contract/state in the API.
- **UXGoodies / Janus** — AI-product patterns only where agent state, approval/refusal, provenance, or tool state are relevant.
- **Fiona Lim** — conversion logic only for the judge/demo entry path, never for the evidence workflow itself.

### Art direction

- **Studio Thonik** — typography as identity, exposed construction grid, large type, modular geometric rhythm.
- **Annual Report Gallery** — editorial hierarchy, dense information without defaulting to cards, strong numbering systems and graphic data storytelling.
- **Awwwards / SiteInspire / Framer Gallery / Lapa Ninja** — composition and premium web rhythm, not UX authority.
- **Cue Design / Sounazo / Inspora** — anti-generic mechanism and uniqueness audit.
- **The Met / Are.na / Backgrounds Supply** — material and cross-domain research, used only when the visual mechanism strengthens the evidence metaphor.

### Interaction & motion

- **Rare UI** — signature interaction mechanics. Borrow principles such as stepped progression, splitting/recombining shapes and strong state morphs; do not copy skins.
- **Transitions.dev / Motion Primitives** — motion grammar for state changes, disclosures, number changes, drawers and route transitions.
- **60FPS Design / Emil Kowalski** — quality bar and restraint. Motion must clarify state, hierarchy or causality.
- **React Bits / Canvas UI / Codrops / Aceternity** — at most one or two hero-grade effects, implemented in lightweight CSS/Canvas/WebGL only when they encode evidence flow or degradation.
- **BeUI / Fancy Components** — morphing drawers and unusual controls where a conventional component would hide the lifecycle.

### Components & QA

- **shadcn/ui / COSS UI / Component Gallery** — accessible primitives and composable state architecture.
- **UI Skills / Design System Checklist** — keyboard, focus, reduced motion, contrast, responsive and state-completeness audits.
- **ReUI** — dense data mechanisms only on evidence tables/inspection surfaces.
- **OpenSourceUI / 21st.dev / KokonutUI** — implementation discovery, never visual authority.

## Chromatic state system

The new system is intentionally more colorful than the previous Atlas, but every color has one semantic job.

| State | Color | Role |
| --- | --- | --- |
| Raw source | Cobalt `#3257FF` | incoming observation |
| Admitted evidence | Cyan `#00C9E8` | source passed quality gate |
| Freshness lease | Acid lime `#C6F432` | time-bounded freshness |
| Policy gate | Ultraviolet `#6E46FF` | coverage/confidence threshold |
| Refusal | Hot coral `#FF4F73` | fail-closed decision event |
| Evidence debt | Signal orange `#FF8A1F` | missing/insufficient evidence |
| Recovery | Magenta `#E73DFF` | reacquisition / repair path |
| Verified receipt | Ink `#171522` | integrity / closure |
| Background | Porcelain blue `#EEF3FF` | cold light field, never ivory |
| Secondary field | Periwinkle mist `#DDE5FF` | structural depth |

Dark mode is not the signature direction. A dark proof surface may appear locally for raw JSON/code, but the overall product identity remains chromatic/light.

## Layout grammar

1. **No default card grid.** Prefer bands, rails, split sheets, stepped sequences, cut panels and full-width evidence strips.
2. **Numbered lifecycle.** 01 Source -> 02 Admission -> 03 Lineage -> 04 Lease -> 05 Gate -> 06 Fragility -> 07 Refusal -> 08 Debt -> 09 Recovery -> 10 Verification -> 11 Receipt.
3. **One primary visual object per page.** Landing = Lifecycle Engine. Dashboard = Decision Gate. Token = Evidence Dossier. Judge = Proof Chain.
4. **Typography is structural.** Large display headlines can intersect grids; mono labels remain small and functional.
5. **Color blocks signal state changes.** They are not badges sprinkled across neutral cards.

## Signature components

### Lifecycle Engine
A horizontal/scrollable 11-stage machine. Nodes expand on hover/focus and reveal the contract behind each state. The active refusal/recovery stages receive strong chromatic fields.

### Refusal Gate
A large two-threshold gate displaying coverage and confidence. When policy fails, the geometry visibly closes rather than showing a red badge.

### Evidence Lease Dial
A radial/linear hybrid countdown representing freshness only. It explicitly says `FRESHNESS != FORECAST VALIDITY`.

### Evidence Debt Stack
Missing signals become physical-looking stacked blocks. Recovery removes debt blocks only after real evidence is observed.

### Receipt Strip
A near-black monolithic strip containing snapshot ID, SHA-256 digest and execution authority. It visually closes the lifecycle.

### Proof Step Player
Judge page reuses a stepped progression mechanic: exact commit -> verification -> packet -> stress -> recovery -> receipt -> MCP.

## Motion grammar

- Source enters: 220ms translate + opacity.
- Admission: 180ms split/reveal.
- Exclusion: 160ms desaturate + diagonal hatch, no dramatic shake.
- Lease tick: continuous but subtle progress; reduced motion freezes at current state.
- Gate fail: 260ms opposing panels close inward; never loop.
- Refusal: one coral pulse, then static.
- Recovery plan: 280ms path draws from debt to required source.
- Verification: status swaps via blur/slide <= 180ms.
- Receipt: 200ms snap/lock.
- No animation solely because a component supports it.

## Reduced motion

With `prefers-reduced-motion`, all lifecycle motion becomes immediate state substitution. No scanning beams, parallax, floating particles or looped transforms remain.

## Responsive behavior

Desktop: lifecycle can occupy a full-width horizontal band with pinned contextual detail.
Mobile: lifecycle becomes a vertically stepped sequence with sticky stage label and swipe/scroll progression. No tiny compressed desktop diagram.

## Product truth boundary

Visuals must never imply:

- unavailable evidence exists
- recovery succeeded when it did not
- evidence lease guarantees forecast validity
- receipt is a signature or external truth proof
- policy gate pass grants execution authority
- resilience benchmark is trading accuracy

Canonical authority invariant remains `execution_authorized:false`.
