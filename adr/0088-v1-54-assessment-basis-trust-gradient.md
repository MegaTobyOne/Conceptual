# 0088 — v1.54 assessment basis trust gradient (J1)

- Status: accepted
- Date: 2026-08-24

## Context

`docs/ux-improvement-ideas.md` defines J1 — "what is compliant for us, and on what basis" — as the first judgement in the operator judgement set, scored 1/2 at the v1.53.0 baseline: `AssessmentStatus` gradations and evidence freshness data both exist, but no screen states the _basis_ of a headline percentage. An operator reading "87% met" cannot tell how much of that is backed by evidence, let alone recent evidence, without manual cross-referencing.

## Decision

1. Add a single shared trust-gradient derivation to `@pspf/contracts`: `AssessmentBasis` (`asserted | evidenced | evidenced-fresh`), the pure `assessmentBasis()` classifier, `assessmentBasisLabel()` wording, `isWithinFreshnessWindow()` (default 180-day window), and `summariseAssessmentBasis()` for aggregating a population of assessed items. This is the only implementation; Workshop, Explorer, and brief-renderer all call it rather than reimplementing freshness logic.
2. Workshop Home computes the basis of currently "met" requirements from linked evidence and freshness, and states it directly under the headline percentage: "`X`% met · `Y`% evidenced and fresh".
3. Explorer Analytics computes the same basis for `yes` (fully implemented) compliance entries — using evidence recency in place of Workshop's explicit `freshness` field, since Explorer's local evidence model has no separate freshness classification — and renders it as a note under the compliance-mix KPI.
4. The Digital CISO/CSO Magazine and posture brief (`@pspf/brief-renderer`) add a "Met requirements evidenced and fresh" line to the posture snapshot, immediately after overall compliance, so the published brief carries the same basis statement as the interactive surfaces.
5. This slice introduces no entity, link, bundle, API, or Explorer schema change; the basis is derived entirely from existing evidence and link data. `VERSION_AXES` remain `1.14.0`.

## Consequences

- A headline compliance percentage can no longer be read without its evidentiary basis being one glance away, on the three surfaces operators and executives read most (Workshop Home, Explorer Analytics, the published brief).
- Workshop and Explorer use different underlying evidence models (an explicit `freshness` classification vs evidence-timestamp recency); both route through the same shared classifier and freshness-window function so the _definition_ of "fresh" cannot silently diverge between products.
- Full rollout of the basis gradient to every requirement-status pill (Workshop Requirement Workbench, Explorer Requirement/Posture views) remains queued in `docs/ux-improvement-ideas.md`; this slice proves the shared primitive and its three highest-traffic call sites before wider rollout.

## Alternatives considered

- **Compute basis independently per product**: rejected; the ecosystem's own convention (per prior "shared algorithm gate" ADRs) is a single contracts-level implementation to prevent the freshness definition from drifting between Workshop and Explorer.
- **Roll the basis gradient out to every status pill in this slice**: rejected as too large a single vertical increment; the three headline call sites are enough to prove the primitive and are independently regression-tested by `scripts/check-assessment-basis.mjs`.
- **Treat any evidence as sufficient for "fresh"**: rejected; it would make "evidenced" and "evidenced-fresh" the same in practice, defeating the purpose of the trust gradient.
