# 0089 — v1.55 consequence chain (J2)

- Status: accepted
- Date: 2026-08-24

## Context

J2 in `docs/ux-improvement-ideas.md` is "why should we care" — the consequence chain from a requirement to the risks it covers. At the v1.54.0 baseline this scored 0.5/2: requirement-to-risk links exist and `brief-renderer` already scopes open risks per requirement, but no screen renders the chain, and published briefs lead with a percentage rather than a consequence statement.

## Decision

1. Add the shared chain-statement builders to `@pspf/contracts`: `buildConsequenceStatement()` (per-requirement "why care" sentence from met/not-met status and linked open-risk severity) and `summariseUncoveredRisk()` / `buildUncoveredRiskStatement()` (ecosystem-wide "N of M open risks have no met requirement covering them"). Both take pre-computed coverage data from the caller so the shared logic stays independent of each product's link representation (Workshop's link rows vs Explorer's direct `requirementIds` arrays).
2. Workshop's requirement item detail gains a "Consequence" section rendering the per-requirement statement, ahead of the existing Directions/Risks tables that already provide link navigation. Workshop Home renders the ecosystem-wide uncovered-risk statement under the headline.
3. Explorer's requirement detail view gains an equivalent "Consequence" section. The Analytics view leads with the uncovered-risk statement above the headline KPIs, ahead of any percentage.
4. The CISO/CSO Magazine and posture brief lead their posture snapshot with "Open risks with no met requirement covering them" (replacing "Overall compliance" as the first metric) and render the uncovered-risk sentence directly under the cover hook in both the HTML and Markdown outputs.
5. This slice introduces no entity, link, bundle, API, or Explorer schema change; the chain and coverage summaries are derived entirely from existing requirement/risk/direction links. `VERSION_AXES` remain `1.14.0`.

## Consequences

- An operator or executive reading any of the three headline surfaces sees a consequence-framed statement before a percentage, directly answering "why care" without manual cross-referencing between the requirement and risk registers.
- The uncovered-risk coverage computation is shared logic with a per-product coverage map, so Workshop and Explorer cannot diverge on what counts as "covered" even though they represent links differently.
- Full consequence-chain rendering across every requirement list/detail surface (e.g. Explorer's requirements list, Workshop's requirement cards) remains queued in `docs/ux-improvement-ideas.md`; this slice proves the shared primitive at the three highest-traffic call sites, consistent with the S1 pattern.

## Alternatives considered

- **Render the full direction → requirement → risk chain as a graph in this slice**: rejected as too large an increment; a stated sentence with existing linked-record tables for drill-down meets the "chain renders without manual cross-referencing" acceptance bar without a new visualisation.
- **Compute uncovered-risk coverage independently per product**: rejected for the same reason as ADR 0088 — a single shared classifier prevents the definition of "covered" from drifting.
- **Lead the brief with the consequence sentence but leave posture-snapshot ordering unchanged**: rejected; the review finding was specifically that the brief leads with a percentage, so the metric ordering itself needed to change, not just add a sentence alongside it.
