# 0042 - v1.8 Saved views

- Status: accepted
- Date: 2026-05-16
- Supersedes: none
- Superseded by: none

## Context

v1.7 introduced first-class Requirement tags and active tag filters in Workshop and Explorer. The current Explorer contract deliberately keeps in-flight list state in `sessionStorage` only: filters, sort, column preferences, pagination, and search can survive a refresh in the same tab but do not survive tab close and do not round-trip through bundles.

That is right for transient work, but operators now need a durable way to return to named working views such as "Security uplift not met", "Executive brief candidates", or "High-priority evidence gaps". ADR 0041 explicitly deferred `SavedView` / `saved-views` as the v1.8+ candidate so tags could land first without overloading the v1.7 slice.

## Decision

Adopt **Saved views** as the v1.8 slice.

A Saved view is a durable, user-named filter snapshot over the Explorer Requirements list. It captures enough state to restore a useful working view later, without turning all transient list preferences into durable product data.

### Scope of v1.8 (in)

- A first-class `saved-view` entity with ID prefix `SVW` and collection `saved-views`.
- Saved views are owned by Explorer local-authoring mode and may round-trip through Core/Workshop import/export using the existing master bundle and `plan-apply` review path.
- v1.8 saved views target the **Requirements** list only.
- The saved filter state includes:
  - free-text search query;
  - selected PSPF domain IDs;
  - selected Requirement assessment statuses;
  - selected tag IDs;
  - `tagsMode = any | all`;
  - evidence coverage filter, if present in the current UI;
  - linked Action state filter, if present in the current UI;
  - linked Risk severity/status filter, if present in the current UI.
- The saved presentation state includes only stable, low-risk preferences:
  - sort key;
  - sort direction;
  - visible column IDs.
- Saved views persist in IndexedDB under the loaded bundle/workspace key and are included in Explorer local-authoring exports.
- Explorer exposes a compact `Saved views` control near the Requirements filter bar:
  - save current view;
  - apply saved view;
  - rename saved view;
  - archive saved view;
  - clear active saved view.
- Applying a saved view updates the same active URL/session filter contract as manual filtering. For tags, this means `tags=TAG-...,TAG-...&tagsMode=any|all` remains the canonical active URL state.
- Workshop import review surfaces saved-view creates/updates/rejections through the existing import summary, with per-type counts and examples.

### Scope of v1.8 (out)

- Saved views for Actions, Risks, Evidence, Directions, ISM Coverage, Relationships Board, or Reporting.
- Shared/team saved views, per-user private views, permissions, favourites, pinning, or default-start views.
- Saved views as posture brief sections or Reporting presets.
- Tag hierarchies, tag implication rules, or tagging non-Requirement entities.
- Compliance-history export controls.
- Editable posture, Shop, Pub, chart image export, third-party accessibility audit, or numeric performance benchmarking.

## SavedView entity shape

`SavedView` uses the standard entity envelope:

```ts
interface SavedViewEntity {
  id: `SVW-${string}`;
  entityType: "saved-view";
  schemaVersion: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceProduct: "explorer" | "workshop" | "core";
  recordStatus: "active" | "archived" | "inactive" | "deleted";
  name: string;
  scope: "requirements";
  filters: {
    query?: string;
    domainIds?: string[];
    assessmentStatuses?: string[];
    tagIds?: string[];
    tagsMode?: "any" | "all";
    evidenceCoverage?: "any" | "missing" | "linked";
    actionStates?: string[];
    riskStates?: string[];
  };
  presentation?: {
    sortKey?: string;
    sortDirection?: "asc" | "desc";
    visibleColumns?: string[];
  };
}
```

`title` mirrors `name` for generic list rendering. `name` is the unique user-facing label. `scope` is fixed to `requirements` in v1.8 so future saved-view scopes can be added deliberately without ambiguous payloads.

## Publication policy

Every field must declare a publication policy.

Recommended v1.8 defaults:

| Field | Policy | Rationale |
|---|---|---|
| `id`, `entityType`, `schemaVersion`, `title`, `createdAt`, `updatedAt`, `sourceProduct`, `recordStatus` | public | Standard envelope fields already present in published bundles. |
| `name` | public | User-facing saved-view label. Operators should avoid sensitive names, but the label is needed to render the view. |
| `scope` | public | Non-sensitive enum. |
| `filters` | public | Contains IDs/enums/query terms needed to restore the view. |
| `presentation` | public | Contains display preferences only. |

Decision: `filters.query` is public and round-trips in v1.8. Operators should avoid sensitive saved-view names and query phrases; this matches the broader Explorer local-authoring warning that exported JSON must be handled at the OFFICIAL: Sensitive level.

## Validation rules

- `SavedView.name` is hard-unique per workspace, compared case- and whitespace-insensitively, per E20.
- `name` length: 1-60 characters.
- `filters.tagIds` may only reference existing non-deleted tags at save time. If an imported saved view references missing tags, the saved view is accepted with a warning and the missing tag IDs are ignored when applied.
- `filters.domainIds` must reference known domain IDs.
- `filters.assessmentStatuses`, `tagsMode`, `evidenceCoverage`, `sortDirection`, and `scope` must be closed enums.
- `presentation.visibleColumns` may only include known Requirements table columns.
- Applying a saved view never creates or modifies Requirements, Tags, Links, Evidence, Actions, or Risks.
- Archiving a saved view hides it from normal pickers but preserves it for import history and future review.

## Storage and exchange

Saved views are durable Explorer local-authoring data. They are stored in IndexedDB with other Explorer local-authoring records and exported in the master bundle under `collections/saved-views.json` when non-empty. v1.8 exports active saved views only by default; archived saved views remain local history unless explicitly reactivated before export.

Saved views are not list preferences. E22 remains intact:

- transient active filters, sort, pagination, and search still live in `sessionStorage`;
- saving a view copies the selected subset of state into a `SavedView` entity;
- applying a saved view writes the active state back into URL/session state;
- clearing the active view clears only active filters, not the saved entity.

## Import and conflict handling

- Full-replace imports preserve saved views from the incoming bundle.
- Additive/plan-apply imports hard-reject incoming saved views whose normalised `name` collides with an existing saved view of a different `id`.
- A rejected saved view appears in the import review as kept-local/rejected by default with a link or display reference to the existing saved view.
- If the same `id` is imported with changed filters or presentation, it is treated as an update and shown in the review summary.

## UI behaviour

Explorer Requirements gains a small Saved views control beside the filter/search area:

- `Save view` opens a name input seeded from the current search/filter state.
- `Saved views` opens a picker of active saved views with summary text such as `2 tags · Status: Not met · Domain: GOV`.
- Applying a view opens Requirements, applies the filter state, updates URL/session state, and displays the active saved-view name near the controls.
- `Rename` changes `name`/`title` only.
- `Archive` hides the saved view from the picker but does not delete it from the local store.
- If a saved view references a missing tag, Explorer applies the remaining filters and shows a non-blocking warning.

Workshop does not get a full saved-view management surface in v1.8. It only needs import-review visibility and enough record rendering to make plan-apply understandable.

## Schema and versioning

v1.8 introduces a new published collection shape and therefore bumps all compatibility axes together:

- `schemaVersion = 1.5.0`
- `bundleVersion = 1.5.0`
- `apiVersion = 1.5.0`
- `PSPF_SLICE_VERSION = 1.8.0`

Publish `schemas/explorer-bundle/1.5.0/` with `collections/saved-views.schema.json`. Earlier schema directories remain immutable.

## Implementation gate (v1.8.0 release)

1. Contracts define `SavedViewEntity`, `SavedViewScope`, closed filter/presentation enums, publication policy metadata, and name normalisation helpers.
2. Core validates saved-view uniqueness, enum values, known domains, known tags, column IDs, and import collisions.
3. Explorer can save, apply, rename, archive, persist, refresh-restore, reset, and export Requirements saved views.
4. Workshop/Core import review shows saved-view create/update/reject summaries under `plan-apply`.
5. E2E creates a tag, applies a tag filter and status filter, saves a view, refreshes Explorer, reapplies the view, exports local JSON, imports through Core/Workshop, and verifies the saved view round-trips.
6. Redaction/schema gates prove every saved-view field has a policy and no restricted/personal fields are introduced.
7. Release-candidate checks assert v1.8 versions, axes, schema directory, ADR 0042, saved-view contracts, and E2E script wiring.

## Consequences

### Positive

- v1.7 tags become much more useful because operators can preserve a named working view rather than reconstructing filters.
- The session-vs-durable boundary remains clean: transient list state is cheap and local; intentional saved views are durable and reviewable.
- The slice is user-visible but narrow enough to validate before expanding tagging to other entity types.

### Negative / accepted trade-offs

- v1.8 introduces another schema-axis bump and collection directory.
- Saved search text can be sensitive if operators type sensitive phrases into saved view names or queries. The implementation must make the publication decision explicit before coding.
- Saved views only cover Requirements in v1.8, so users may ask why the Relationships Board cannot save its lane/filter state yet.

## Decisions required before implementation

1. `filters.query` is public and round-trips.
2. v1.8 includes visible column IDs in saved views.
3. Local-authoring export includes active saved views only by default.

## Alternatives considered

- **Keep URL bookmarks only.** Rejected. URL state is useful but brittle and not discoverable as a user-facing saved workflow.
- **Save all list/session preferences automatically.** Rejected. That would violate E22 and turn accidental UI state into durable product data.
- **Ship saved views for every Explorer table in v1.8.** Rejected. It broadens schema, UI, and validation too much before the first saved-view workflow is tested.
- **Combine saved views with tag hierarchies or non-Requirement tagging.** Rejected. Saved views are the immediate payoff from v1.7; other tag expansion should be a later ADR.
