# ADR 0024 — v0.6 Workshop parity for Directions and Action Impact

## Status

Accepted.

## Context

ADR 0023 introduced Directions and Action Impact to Explorer and the posture brief.
In v0.5 these signals were visible only in published artefacts. Operators authoring in
the Workshop could not see Direction response state or Action Impact rankings without
re-exporting and opening the static Explorer build. v0.6 lifts those signals into the
Workshop surface so the authoring loop matches what reviewers see.

## Decision

1. The Workshop Assessment Dashboard adds a sixth metric tile (`Directions`) and
   always renders four small chips for the response-state breakdown
   (`not-set`, `yes`, `no`, `risk-managed`), including zero counts. It also renders
   an `Action Impact — Top 5` table using the same deterministic ranking that
   Core uses for export, sorted by total uplift descending.
2. The Requirement Item Detail panel adds a `Directions Targeting This Requirement`
   table (Directions linked inbound to the requirement) and adds an `urgency` column
   to the `Actions` table by enriching actions locally with Action Impact.
3. The Evidence Review Queue adds an `Urgent Actions (Blocked or Overdue)` section
   plus a matching metric tile, so reviewers can triage the most time-sensitive
   actions alongside missing/ageing evidence.
4. A new command `pspf.workshop.openDirectionDetail` (PSPF: Open Direction Detail)
   opens an Item Detail panel for a Direction showing reference, response state,
   source authority, issue date, and outbound relationships. The panel cannot mutate
   state directly because Workshop webviews keep `enableScripts: false`; the panel
   instructs operators to run `PSPF: Update Direction Response` to change the response.
5. The deterministic Action Impact algorithm now lives in `@pspf/contracts` as
   `enrichActionsWithImpact(entities)`. Core re-uses the shared implementation
   instead of carrying a private copy. Workshop uses the same function over the
   `pspf.core.listEntities` result so dashboard, queue, and Item Detail render the
   exact ranking Explorer publishes.

## Consequences

- Operators see Direction posture and the most impactful Actions inside the
  authoring loop without exporting first.
- Schema, bundle, and API axes remain unchanged for v0.6
  (`VERSION_AXES = "1.3.0"`); only `PSPF_SLICE_VERSION` bumps to `0.6.0`.
- Workshop continues to honour the default-deny publication policy and runs all
  views with `enableScripts: false`. Mutations stay on the command palette path.
- Brief content is unchanged from v0.5; this slice is Workshop UI parity only.

## Quality gates (delta)

- `e2e:v0.6` script alias added; `e2e:v0.5` chains to `e2e:v0.6`.
- Existing gates (`check:gates`, `validate:debug-workspace`) remain authoritative;
  no new gate is introduced because the underlying data and published artefacts
  did not change.
