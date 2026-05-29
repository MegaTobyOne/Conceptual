# 0071 - v1.35 ISM control as a workable assurance entity

- Status: proposed
- Date: 2026-05-29

## Context

ISM integration phases 1-3 (ADRs [0017](0017-ism-integration-roadmap.md), [0018](0018-ism-source-library.md), [0019](0019-requirement-control-mapping.md), [0020](0020-ism-mapping-quality-and-drift.md)) gave the product a read-only ISM source library (`SourceControlEntity`, prefix `SRC`), a first-class `RequirementControlMappingEntity` (prefix `MAP`), drift visibility, and an ISM coverage section in the posture brief.

That work made ISM controls **browsable** and **mappable to Requirements**, but it left ISM controls as a catalogue hanging off the Requirement spine rather than a parallel spine in their own right. By contrast a PSPF Requirement is a fully workable assurance object: it carries an assessment status, is navigated by domain and status, and links directly to evidence (`supported-by`), actions (`addressed-by`), risk (`exposed-by`), directions (`targets`), change records (`changes`), and tags (`tagged-with`).

Today an operator cannot do the equivalent for an ISM control. Examining `OPERATOR_LINK_RULES` in `@pspf/contracts` confirms there was **no operator link rule with `source-control` as an endpoint**. The Workshop "Attach Evidence / Create Action / Create Risk" affordances on an ISM control detail panel route through `pickMappedRequirementForSourceControl`: the operator must first map the control to a Requirement, and the work then links to that Requirement, never to the control itself.

As the ISM becomes a more prominent assurance reference, operators increasingly want to read and navigate the ISM directly and to attach evidence, actions, and risk to a control as the unit of work - the same operator spine the product already provides for PSPF Requirements.

## Decision

Establish the ISM control as a workable assurance entity that mirrors the Requirement operator spine, delivered in phases that each respect the locked constraints (closed link taxonomy verbs in ADR 0003, default-deny per-field publication in ADR 0005, UUIDv7 with time-stripping in ADR 0002, OFFICIAL: Sensitive labelling-only in ADR 0011, AU English in ADR 0016, zero runtime egress).

### Phase 4a - v1.35 (this slice): direct control-to-work linking

The first vertical slice lands the link-model foundation and the Workshop affordances, with **no schema-version bump**:

1. Add three canonical operator relationship rules to `OPERATOR_LINK_RULES` in `@pspf/contracts`, reusing existing closed-taxonomy verbs and the already-registered `source-control` entity type:
   - `source-control --supported-by--> evidence`
   - `source-control --addressed-by--> action`
   - `source-control --exposed-by--> risk`
2. Wire Workshop ISM control detail to create and display **direct** control-to-work links (`Link Evidence`, `Link Action`, `Link Risk`), in addition to the existing mapping-derived view, so a control can carry its own evidence, actions, and risk without requiring a Requirement mapping intermediary.

This is safe to ship without touching `VERSION_AXES` because:

- `source-control` is already a member of `V0_1_ENTITY_TYPES`, and `LinkEntity` already serialises generic `fromType`/`toType` endpoints.
- The link verbs (`supported-by`, `addressed-by`, `exposed-by`) already exist in `LINK_TYPES`.
- `OPERATOR_LINK_RULES` is operator-affordance metadata; precedent for adding rules ahead of full UI rollout is set by ADR [0065](0065-v1-29-ux-consistency-and-relationship-manager.md), which kept `VERSION_AXES` unchanged.
- Core link validation (`packages/core/src/service.ts`) constrains links by verb membership and by `fromType`/`toType` matching the referenced entity, not by an endpoint-pair allow-list, so a direct `source-control` link validates and round-trips.

### Phase 4b - v1.36+ (proposed, requires schema bump): control implementation posture

Give the ISM control its own posture, mirroring `Requirement.assessmentStatus`:

- Add `SourceControlEntity.implementationStatus` (candidate values `not-implemented | partial | implemented | not-applicable | under-review`) as operator posture layered on top of the immutable vendored statement. Publication policy `internal` at minimum (it is operator interpretation, not the public ASD catalogue text), declared in `PUBLICATION_FIELD_POLICIES`.
- This is a schema-bearing change: roll `schemaVersion` forward, add a new `schemas/explorer-bundle/<version>/` directory, update validation, redaction defaults, contract tests, and seeded sample data.
- Surface an ISM control browser that mirrors the Requirements browser: navigate by ISM guideline/section then implementation status, with a `workshop-source-controls` saved-view scope.

### Phase 4c - v1.37+ (proposed): bidirectional posture and unified obligation navigation

- Feed control implementation status plus directly-linked evidence/actions/risk into an ISM posture view and the posture brief's ISM section (the inverse of today's mapping-derived coverage).
- Add the symmetric "Requirements this control implements" panel to the control detail, with one-click mapping from either side.
- Explore a shared "obligation" navigation shell presenting PSPF Requirements and ISM Controls with consistent filter/saved-view/detail patterns.

## Non-goals

- No schema-version bump, new entity type, new link verb, new schema directory, or new published collection in v1.35.
- No editing of vendored ISM control statement text (the catalogue remains read-only; ADR 0018).
- No `implementationStatus` field, ISM control browser navigation, or saved-view scope in v1.35 (Phase 4b).
- No runtime network fetch of ISM data in any phase (E1, ADR 0011).
- No mapping to non-ISM control catalogues.

## Consequences

Positive:

- Operators can attach evidence, actions, and risk directly to an ISM control as the unit of work, matching the Requirement spine, without forcing a Requirement mapping first.
- The change is additive and schema-stable, so Explorer bundle compatibility and the v1.34 train are unaffected.
- The mapping-derived view is preserved, so existing Requirement-to-ISM coverage continues to render.

Trade-offs:

- Work can now reach a control by two routes (directly, and via a mapped Requirement). The control detail distinguishes "linked directly" from "linked through mapped Requirements" so the provenance of each relationship stays clear.
- Full parity with the Requirement spine (control posture, dedicated navigation, bidirectional rollups) lands across Phases 4b and 4c, each gated by its own readiness work.

## Quality gates (delta)

- `@pspf/contracts.OPERATOR_LINK_RULES` includes the three `source-control` endpoint rules with canonical verb, label, and phrase; `operator-link-rules.test.ts` covers them.
- Workshop ISM control detail renders direct `Link Evidence`/`Link Action`/`Link Risk` affordances and a "Work Linked Directly To This Control" panel.
- A direct `source-control` link round-trips through `pspf.core.upsertEntities` and core validation without error.
- `typecheck`, `lint`, contracts tests, and the relationship-rule gate pass with `VERSION_AXES` unchanged.

## Related

- [adr/0017-ism-integration-roadmap.md](0017-ism-integration-roadmap.md)
- [adr/0018-ism-source-library.md](0018-ism-source-library.md)
- [adr/0019-requirement-control-mapping.md](0019-requirement-control-mapping.md)
- [adr/0003-link-taxonomy.md](0003-link-taxonomy.md)
- [adr/0065-v1-29-ux-consistency-and-relationship-manager.md](0065-v1-29-ux-consistency-and-relationship-manager.md)
- [pspf-ism-integration-spec.md](../pspf-ism-integration-spec.md)
- [pspf-entity-link-spec.md](../pspf-entity-link-spec.md)
