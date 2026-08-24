# 0080 — v1.43 Strategy risk → priority → choice

Status: **accepted**

**Date**: 2026-06-19
**Deciders**: Product owner, engineering

## Context

The Workshop Cyber Strategy Map (ADR 0060) represents strategy as a single canonical
record with nested strategic choices, outcomes, posture measures, and inline references
to Requirements, Risks, Actions, and Directions. Operators could link risks to a choice,
but the surface treated every choice as equal: nothing expressed _which_ choices matter
most or _why_. Leadership views (`pspf-cyber-strategy-spec.md`) explicitly call for
showing "top strategic risks" and answering "what are the cyber priorities, why do they
matter, and are they moving in the right direction" — but priority was implied, never
derived.

The strategy model already carries the signals needed to infer priority: each linked
risk has a likelihood and impact, and each choice has a `trend` and `confidence`. The
goal of this slice is to make risk drive priority, and priority drive the choices
leadership attends to first, without adding any new persisted state.

## Decision

Add a derived **strategy priority** read model surfaced on the Strategy Map and Strategy
Editor. A single pure builder, `buildStrategyPrioritySummary(choice, risksById)` in
`packages/workshop/src/continuous-compliance.ts`, computes a priority band for each
strategic choice:

1. Collect the risks referenced by the choice and by its outcomes. Deduplicate risk and
   action references. Deleted or missing risk references are excluded from scoring but
   counted as `unresolvedRiskReferenceCount` repair cues.
2. Each resolved risk contributes a severity score of `likelihood × impact`, consistent
   with the existing risk severity bands.
3. Adjust each risk's score by two choice-level modifiers:
   - **Trend**: deteriorating `+5`, steady `+2`, unknown `+1`, improving `+0`.
   - **Confidence**: low `+3`, medium `+1`, high `+0`.
4. The choice priority **score** is the peak adjusted score across its linked risks (the
   single most pressing risk), so one severe, deteriorating, low-confidence risk is not
   diluted by several minor ones.
5. Map the score to a band:
   - **Critical priority** — `≥ 28`
   - **High priority** — `≥ 20`
   - **Medium priority** — `≥ 10`
   - **Low priority** — `≥ 1`
   - **No risk priority yet** — `< 1`

The summary also exposes the top three blocking risks (by adjusted score), the high-risk
count, the linked action count, the average adjusted score, and a plain-language
rationale string. The Strategy Map record table and choice cards, the Strategy Editor
panel, and strategy area readiness all consume the same builder so the inference cannot
drift between surfaces.

## Consequences

- The feature is a **derived read model only**: no new entity, collection, link verb,
  saved-view scope, schema field, or Explorer publication change. `VERSION_AXES` remain
  `1.14.0` and no new `schemas/explorer-bundle/` directory is introduced.
- Because scoring reads only already-linked risk, action, and strategy references, it
  inherits the existing redaction and publication policy; no personal or restricted data
  is introduced into the strategy surfaces.
- `check:continuous-compliance` asserts that `buildStrategyPrioritySummary` is exported,
  that the five band labels exist, and that the Strategy Map wires the
  `strategy-priority-panel`. The `e2e:v1.43` chain runs this gate.
- The peak-score design is a deliberate choice over summing risks; a later ADR may add a
  weighting or aggregate-pressure option if operators ask for it.

## Out of scope for this ADR

- Persisting a priority value on the strategy record.
- Editing or overriding the derived band manually.
- Publishing priority to Explorer or any external surface.
- Cross-choice ranking or portfolio-level prioritisation beyond per-choice bands.
