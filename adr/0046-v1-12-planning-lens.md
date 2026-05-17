# 0046 — v1.12 Planning lens

- Status: accepted
- Date: 2026-05-17

## Context

The 12-month cyber plan concept in `pspf-plan-spec.md` is valuable, but opening a separate PSPF Plan product now would create a new package, navigation model, schema surface, and release lane before Workshop and Explorer have proved the planning workflow inside the existing assurance loop.

v1.10 added Workshop-owned Change Records, and v1.11 planned Explorer-authored Change Record proposals using that same data model. The current contract already supports the reserved Workshop saved-view scopes `workshop-dashboard` and `workshop-evidence-review`, and Explorer already has the data needed for a planning lens: Requirements, Evidence, Actions, Risks, Directions, Change Records, and Action Impact.

## Decision

v1.12 ships a planning lens through existing Workshop and Explorer surfaces. It does not introduce a PSPF Plan package, new entity types, new bundle collections, or a schema-axis bump.

### Workshop

Workshop activates the reserved saved-view scopes:

- `workshop-dashboard`
- `workshop-evidence-review`

The Saved Views manager can create, rename, archive, and apply these scopes. Applying a Dashboard saved view opens a planning-oriented dashboard slice filtered by the saved view's Requirement filters. Applying an Evidence Review saved view opens an evidence review slice filtered by the saved view's Requirement filters.

Workshop Requirements saved views continue unchanged. Saved views remain convenience records, not workflow approvals or access-control boundaries.

### Explorer

Explorer adds a read-only `Plan Lens` section over the effective bundle state. It shows:

- open Actions, sorted by overdue/due-soon/blocked planning urgency;
- open Risks sorted by likelihood × impact;
- active/proposed Change Records sorted by raised date;
- Direction responses that still need attention; and
- a compact planning summary in Overview.

The Plan Lens is a filtered review surface only. It does not add editable milestones, resources, budgets, or Gantt scheduling.

### Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.12.0"`.
- `VERSION_AXES` remains at `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- No new schema directory is published for v1.12.
- `plan-baseline` snapshot subtype remains deferred because adding it would change the existing snapshot enum and schema.

## Consequences

Positive:

- Operators can test planning workflows without leaving Workshop/Explorer.
- The release reuses existing Actions, Risks, Directions, Change Records, and saved views.
- The implementation keeps the master bundle stable while giving user validation a concrete planning surface.

Trade-offs:

- The Plan Lens is not a full portfolio or project-management tool.
- Planning views remain role-neutral because v1 still has no authentication, RBAC, or team ownership model.
- A separate PSPF Plan product remains a later ADR decision, informed by v1.12 validation.

## Deferred

v1.12 does not add plan baselines, milestone entities, resource or budget entities, workflow approvals, private/team saved views, default-start views, compliance-history export controls, editable posture, Shop, Pub, chart image export, or a separate PSPF Plan package.