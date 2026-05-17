# 0045 — v1.11 Explorer change story

- Status: proposed
- Date: 2026-05-17

## Context

v1.10 introduced the canonical `change-record` entity, the `changes` link verb, Core validation, Workshop authoring, bundle export/import, and Explorer's read-only `Why This Changed` view. That means v1.11 does not need a new entity type or bundle shape to let reviewers propose significant changes from Explorer.

The current v1.10 Explorer local-authoring surface already persists local Requirement status overlays, evidence references, Actions, Risks, and saved views in `IndexedDB`, then materialises them into the master bundle for Workshop import review. It does not yet persist local Change Record proposals, include `change-records` in local-authoring exports, update local `posture.changeRecordCount`, or include significant-change signals in the Overview/posture brief.

Recent Workshop validation also showed that operators need edit screens to behave like working surfaces, not one-field dialogs. The Requirement editor now exposes linked Evidence, Actions, Risks, Directions, Tags, and ISM mappings and refreshes after local add/save operations. v1.11 should preserve that system-of-record review path: Explorer can propose significant changes, but Workshop remains where those records are reviewed, edited, and accepted.

## Decision

v1.11 closes the Explorer change story by using the existing v1.10 `change-record` contract in Explorer local-authoring mode.

### Explorer local proposals

Explorer adds a `Propose Significant Change` control in Local Changes for the selected Requirement and for linked local or bundle Actions, Risks, Directions, Tags, and Saved Views where those records are visible. The proposal form captures only fields already defined by `ChangeRecordEntity`:

- `title`
- `summary`
- `changeType`
- `status`
- `persistence`
- `source`
- `raisedAt`
- optional `effectiveAt`
- optional `reviewDueAt`
- optional `reason`
- optional `impactSummary`

Explorer does not capture `decisionOwnerRef`; that remains Workshop-only because it is restricted and may later point at a private people/assignment model.

Each local proposal is persisted in an `IndexedDB` object store scoped to the loaded bundle key. Reset local data clears local change proposals together with status overlays, evidence references, Actions, Risks, and saved views.

### Materialisation and round trip

Explorer materialises each local proposal as:

- one `change-record` entity with `sourceProduct = "explorer"`; and
- one `changes` link from the Change Record to the affected entity.

The exported JSON remains the existing single master bundle with `generator.product = "pspf-explorer"` and `generator.mode = "local-authoring"`. `collections/change-records.json` is included in the local export manifest, and the exported posture singleton updates `changeRecordCount` to match the effective collection.

Workshop import review displays Explorer-proposed Change Records under the existing plan-apply review surface. After apply, the records are available in Workshop Change Records, affected Requirement edit screens, and normal Core export. Undo Import removes imported Change Records and their `changes` links with the rest of the import transaction.

### Explorer presentation

Explorer Overview gains a significant-change summary using effective bundle plus local proposals:

- total Change Records;
- active/proposed Change Records;
- persistent Change Records;
- review-due or overdue Change Records; and
- recent Change Records sorted by `raisedAt` descending.

The posture brief includes a concise `Significant Changes` section using public fields only: title, status, type, persistence, source, raised/effective/review dates, affected record title, and summary. It must not include `reason`, `impactSummary`, or `decisionOwnerRef`.

### Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.11.0"`.
- `VERSION_AXES` remains at `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- No new schema directory is published for v1.11.
- The v1.10 `change-records` schema and `changes` link rules remain the authority.

## Plan of Work

1. **Explorer storage** — add an `IndexedDB` store for local Change Record proposals scoped by bundle key; load, save, list, reset, and restore it with the existing Local Changes flow.
2. **Explorer UI** — add proposal controls from Local Changes, show local proposals beside linked context, and make the global `Why This Changed` view include effective local proposals distinctly from bundle baseline records.
3. **Export materialisation** — include `change-records` in `exportLocalAuthoringBundle()`, materialise local proposals as existing `change-record` plus `changes` link records, and update `posture.changeRecordCount`.
4. **Workshop round trip** — ensure plan-apply import review counts and applies Explorer-authored Change Records and links, and that affected Requirement edit screens show them after import.
5. **Posture brief** — extend the shared brief renderer and Explorer browser renderer with a `Significant Changes` section that uses only publishable fields.
6. **Tests and gates** — extend Explorer local-authoring, Explorer-to-Workshop import, redaction, and release-candidate checks for local Change Record proposals.
7. **Docs** — update validation scenario, README, acceptance gates, and consistency index for v1.11.

## Deferred

v1.11 does not add before/after diff views, automatic field-level history, change-record tagging, approvals, decision-owner people assignment, plan baselines, compliance-history export controls, editable posture, Shop, Pub, chart image export, or a separate PSPF Plan product.

## Consequences

Explorer becomes a portable review and suggestion surface for significant change rationale without becoming the system of record. Workshop remains the decision surface and retains final edit/review responsibility.

The main implementation risk is not schema design; it is keeping the effective local state coherent across Explorer UI, exported manifest counts, posture counts, brief rendering, import review, and undo. The v1.11 gates therefore focus on round-trip behaviour and redaction, not on a compatibility-axis bump.