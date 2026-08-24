# 0091 — v1.57 schema axis bump: acceptance definition and blocker class (J1b, J3b)

- Status: accepted
- Date: 2026-08-24

## Context

`docs/ux-improvement-ideas.md` reserves S4 as the single batched schema-axis bump for the UX judgement-support stream, funding two additive fields that S1 (basis) and S3 (blockers) identified but could not persist without a schema change: a per-requirement acceptance definition, and an operator-settable override of the blocker classification (including the `supplier` class that S3/ADR 0090 explicitly deferred). Everything since S0 has moved `schemaVersion`/`bundleVersion`/`apiVersion` at `1.14.0`; this is the first slice in the stream that moves them.

## Decision

1. Bump `VERSION_AXES` (`schemaVersion`, `bundleVersion`, `apiVersion`) from `1.14.0` to `1.15.0` together, per the established version-axes convention (ADR 0008).
2. Add `RequirementEntity.acceptanceDefinition` (free text: what an assessor would accept as "met") and `RequirementEntity.acceptanceDefinitionUpdatedAt` (stamped whenever the definition text changes, so a tightened bar renders as "definition changed" rather than "performance dropped"). Both fields are `sensitive` under `pspf-security-redaction-controls.md`, matching the existing treatment of `summary` and `assessmentRationale` — internal operator narrative, not published by default.
3. Add `ActionEntity.blockerClass`, an operator-set override of the classification `@pspf/contracts` derives at render time (`classifyBlocker`, ADR 0090). `BlockerClass` widens from `us | funding | assessor` to include `supplier`, since a persisted, operator-confirmed field can record a supplier blocker that no current link type evidences automatically. `blockerClass` is `sensitive`, matching `commentary` and `effortBasis`.
4. Publish `schemas/explorer-bundle/1.15.0/` as an exact copy of `1.14.0/` with only the version string updated; because both new fields are `sensitive`, no collection schema requires a new property. The historic `1.14.0/` directory remains byte-identical, per existing schema-directory practice.
5. Workshop's requirement editor exposes an "Acceptance definition" field with a "definition last changed" note; Workshop's action editor exposes a "Blocker (who moves next)" override select, defaulting to the automatic classification. Workshop's Blockers section (ADR 0090) prefers the operator override when set, falling back to the derived classification otherwise.
6. `packages/reference-data`'s generator (`GENERATED_SCHEMA_VERSION`) and the standard test fixture move to `1.15.0` alongside `VERSION_AXES`, since Core's dataset diagnostics treat any mismatch between an entity's stamped `schemaVersion` and `VERSION_AXES.schemaVersion` as a reportable inconsistency.

## Consequences

- This is the only schema bump in the UX judgement-support stream (S1–S7); any further field needs discovered after this slice queue for a future `1.16.0` batch rather than dribbling out one bump per slice.
- Because both new fields are `sensitive`, this slice makes no Explorer-publication or bundle-schema-property change beyond the version string — the schema directory copy is mechanical, not a redesign.
- Operators can now correct the ecosystem's guess about who is blocking an action, closing the `supplier` gap ADR 0090 deferred, without waiting for S7's richer supplier data.
- Every workspace on `1.14.0` remains readable: `hasCompatibleMajorVersion` treats `1.14.0` and `1.15.0` as compatible, consistent with every prior minor schema bump in this repository's history.

## Alternatives considered

- **Persist `acceptanceDefinition`/`blockerClass` as `public` fields with schema properties**: rejected; both carry internal operator narrative/triage detail with no established need for Explorer publication, and treating them as `sensitive` avoids an unforced publication-policy decision in this slice.
- **Model acceptance-definition history as a versioned array**: rejected as disproportionate; a single text field plus an updated-at timestamp is enough to distinguish "definition changed" from "performance dropped" without new nested schema shape.
- **Defer the schema bump further and keep composing only derived data**: rejected; J1/J3's remaining gaps (explicit definitions, supplier override) are genuinely not composable from existing fields, so a bump is the honest next step rather than stretching the "no schema change" pattern past its limit.
