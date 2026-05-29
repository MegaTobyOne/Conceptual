# 0072 - v1.36 ISM Review Workbench

- Status: accepted
- Date: 2026-05-29

## Context

ADR 0071 made ISM controls workable assurance entities: operators can map Requirements, set internal implementation posture, link evidence/actions/risks directly to a control, save ISM control views, and review public-safe ISM control posture in Explorer.

That gives the product the right primitives, but the operator still has to inspect the full ISM source-control browser to decide what needs attention next. The missing layer is a review workbench that turns existing control, mapping, direct-link, drift, and implementation-status data into practical queues.

## Decision

Add a v1.36 **ISM Review Workbench** as a no-schema read model over existing data.

Workshop derives review queues from current records:

- `unmapped` — no active `RequirementControlMapping` points at the control.
- `not-assessed` — `SourceControl.implementationStatus` is absent.
- `drift-review` — `SourceControl.statementChangeStatus` is not `unchanged`.
- `needs-direct-work` — the control is mapped to at least one Requirement but has no direct evidence/action/risk links.
- `risk-without-action` — the control has direct risk links but no direct action links.
- `reviewed` — none of the above queues apply.

Workshop exposes the queues as an ISM Review Workbench with metrics, quick filters, and an Open action back to ISM Control Detail. The existing ISM Source Controls browser links to the workbench, and Workshop Home exposes it beside Essential Eight.

Explorer publication mode adds public review cues only. It may label public ISM rows as `Drift review`, `Unmapped`, `Mapped, no direct work`, or `Mapped with direct work` using published mappings, source-control drift, and direct public work-link counts. It must not expose internal implementation status or infer per-control security posture.

## Non-goals

- No schema-axis bump, new entity, new collection, new link verb, or new saved-view scope; in short, no schema-axis bump is introduced.
- No editable Explorer ISM authoring.
- No drag-to-link, Connected View edge editing, or graph editing.
- No private/team saved views.
- No publication of per-control `implementationStatus`.
- No ISM profile picker or runtime network fetch.

## Consequences

Positive:

- Operators get a concrete next-review surface rather than a flat catalogue.
- The slice increases ISM usability without changing the publication contract.
- Explorer reviewers get public-safe triage context for unmapped, drifted, and work-linked controls.

Trade-offs:

- `needs-direct-work` is an operational heuristic, not a compliance claim. It only means a mapped control has no direct control-level work linked yet.
- Explorer cannot show internal implementation gaps, so its cues are intentionally weaker than Workshop's workbench.

## Quality gates

- Workshop registers `PSPF: Open ISM Review Workbench`, exposes it from Home and the ISM Source Controls browser, and renders review queues for unmapped, not-assessed, drift-review, needs-direct-work, and risk-without-action controls.
- Explorer ISM Source Controls and Obligations use public-safe review-state cues without per-control implementation status.
- `VERSION_AXES` remain `1.12.0`; all package versions and `PSPF_SLICE_VERSION` are `1.36.0`.
- `typecheck`, `lint`, Explorer tests, Workshop build, release-candidate checks, and release readiness pass.

## Related

- [adr/0071-v1-35-ism-control-as-workable-entity.md](0071-v1-35-ism-control-as-workable-entity.md)
- [pspf-ism-integration-spec.md](../pspf-ism-integration-spec.md)
- [explorer-screen-workflow-spec.md](../explorer-screen-workflow-spec.md)
