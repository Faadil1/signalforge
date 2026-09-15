# TRACE Design Direction — Seismic Market Atlas

## Canonical thesis

SignalForge is not a generic fintech dashboard. It is an **evidence instrument** for mapping incomplete, changing market evidence before an agent trusts a conclusion.

Canonical visual sentence:

> **Map the evidence. Refuse the fiction.**

Canonical product sentence:

> Evidence before recommendation. Refusal before false confidence.

## Aesthetic lineage

### Primary lineage

- seismology and topographic surveying
- field instrumentation and telemetry
- cartographic contour systems
- scientific observation boards
- evidence dossiers and calibration surfaces

### Secondary influences

- industrial measurement labels
- survey coordinate systems
- environmental monitoring interfaces
- technical atlases and data plates

### Explicit anti-lineages

Do not drift into:

- ivory / paper / archival editorial surfaces
- blue SaaS dashboard systems
- black / navy AI-agent dashboards
- crypto-neon trading terminals
- glassmorphism
- floating gradient blobs
- generic rounded-card Bento grids
- retro terminal cosplay
- Bloomberg imitation

## Material system

### Base

- mist mineral grey: application field
- ash green-grey: secondary surfaces
- graphite: primary text
- dust white-green: high-contrast instrument surfaces

### Semantic accents

- oxidized teal: live / observed / healthy provenance
- rust orange: tension / secondary trace / calibration
- sulfur yellow: warning / degraded evidence
- muted coral: refusal / invalidity / authority boundary
- mineral green: verified / healthy gate

Color is semantic. Decorative color without information work is forbidden.

## Core TRACE components

### `AtlasPanel`

Purpose: replace generic cards with instrument plates.

Properties:

- clipped survey corner geometry
- coded rail (`OBS-01`, `INSP-B`, `P-06`)
- explicit label + metadata area
- semantic tone: default / live / warning / critical / quiet

### `EvidenceRail`

Purpose: make provenance and exclusions visible at a glance.

Must show:

- evidence source name
- provider
- live / degraded / excluded / mock state
- total coverage

Unavailable data must never look neutral or healthy.

### `ActionabilityGate`

Purpose: make the authority boundary a first-class interface state.

Must show:

- actionability
- coverage
- confidence
- execution authority

`execution_authorized:false` must remain visible whenever the decision packet is being interpreted.

### Evidence strata

Each evidence channel is treated as a layer, not a decorative score card.

States:

- OBSERVED / USED
- DEGRADED
- EXCLUDED / NOT USED
- UNKNOWN

Do not render unavailable channels as a score of 50.

## Page grammar

### Landing `/`

Role: visual thesis + live decision plate.

Above the fold must communicate:

- SignalForge maps evidence rather than predicts with false certainty
- provider provenance
- fail-closed policy
- no execution authority
- live decision packet with coverage + actionability gate

### Observation Field `/dashboard`

Role: market field scan.

Dominant mechanisms:

- market strata list
- per-market evidence contour
- decision core
- source health rail
- quick inspect

Avoid KPI-card mosaics.

### Evidence Inspect `/token`

Role: one-market evidence dossier.

Dominant mechanisms:

- decision plate
- evidence strata
- price trace
- volume trace
- interpretation boundary
- provenance contract

### Judge Proof `/judge`

Role: live evidence dossier.

Must separate:

- OBSERVED_EXTERNAL
- OBSERVED_IN_BUILD
- INFERRED
- UNKNOWN

The AWS Tokyo / Binance case is not a historical replay.

### Agent Interface `/playground`

Role: live contract interrogation.

Usage telemetry is process-local and must never be represented as global uptime analytics.

### Calibration Lab `/strategies`

Role: bounded exploratory calibration.

Never present backtests as proof of profitability.

## Motion & Interaction Grammar

All meaningful motion follows:

`TARGET → TRIGGER → MOTION → TIMING → EXIT/RETURN → INPUT PARITY → REDUCED MOTION → IMPLEMENTATION`

### Scan pass

- TARGET: instrument panel
- TRIGGER: mounted live evidence surface
- MOTION: restrained horizontal scan wash
- TIMING: ~7s linear loop
- PURPOSE: communicate active observation, not decoration
- REDUCED MOTION: disabled by global reduced-motion rule

### Evidence pulse

- TARGET: live provenance dot
- TRIGGER: live state
- MOTION: opacity pulse only
- TIMING: ~2.8s
- PURPOSE: status, not attention capture
- REDUCED MOTION: disabled

### State transition

- TARGET: selected market row / actionability state
- TRIGGER: click or data refresh
- MOTION: border/background state shift
- TIMING: 150–300ms
- INPUT PARITY: keyboard controls remain standard buttons/links

No decorative floating, bounce, zoom, or parallax is permitted unless tied to a specific evidence state.

## Anti-AI-slop rules

1. Every visual element must perform semantic work.
2. No decorative gradient without an information role.
3. Unavailable evidence must never look healthy.
4. Prefer asymmetric field composition over template symmetry.
5. Provenance stays visible near the conclusion.
6. Refusal is a first-class product state.
7. Texture supports the evidence-instrument thesis; it is not aesthetic cosplay.
8. The interface should feel like an observation system, not a startup template.
9. No ivory/paper direction.
10. No navy/black AI-agent default direction.

## Design review gates

A TRACE design review passes only if:

- the page is identifiable as SignalForge without the logo
- provenance is visible before or beside a recommendation
- excluded data is visually distinct from neutral data
- actionability and authority boundaries are readable without opening raw JSON
- responsive layouts preserve evidence hierarchy
- reduced-motion does not hide state information
- the page cannot be reasonably mistaken for a generic SaaS admin template

## Current implementation checkpoint

Implemented on `cloudflare-runtime` after the verified runtime checkpoint. Runtime decision/fallback/validation logic was not changed by this design direction.
