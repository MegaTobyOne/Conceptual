# 0041 — v1.7 Tags and filters foundation

- Status: accepted
- Date: 2026-05-16

## Context

PSPF lets an operator assess a fixed Requirements baseline against evidence, actions, risks, and Directions. Operators have asked for a way to mark their own interests and priorities — "this requirement is a personal focus", "track these together for the next reporting cycle", "this is in scope for the security uplift programme" — without overloading `assessmentStatus`, `Action.dueDate`, or notes.

`tag` is already reserved in the canonical model (`pspf-invariants.md` N1/N2/N3 register `tag` / `tags` / `TAG`; `pspf-entity-link-spec.md` § Tag carries a stub `name` + `tagType` shape; `packages/contracts/src/index.ts` exports a `TagEntity` with `title` only). The Explorer screen spec already references tags as a filter affordance on Requirements and the Relationships Board. The shape was placed against a future slice and has not been built out.

ADRs 0034 / 0035 / 0036 / 0037 each deferred tags and saved views explicitly while the local-authoring and import-review loops were stabilised. Those loops are now in place at v1.6, so the foundation can be designed properly before further entity surfaces are added on top of it.

Two design constraints must be settled now, not later:

1. Tags are a cross-cutting concern. They have to round-trip through Core's SQLite store, snapshots, master bundles, Explorer publication mode, Explorer local-authoring mode, and the Workshop import review. Designing them after another entity slice lands risks an asymmetric implementation that some surfaces honour and others ignore.
2. Filtering by tag is the dominant use case. The filter contract (how tags appear in URLs, list controls, pickers, and exports) needs to match the rest of the filter bar, not introduce a parallel UX.

## Decision

Adopt a **Tags and filters foundation** as the v1.7 slice. The slice has two parts: the data design (this ADR) and the implementation gate (a separate PR that lands with `VERSION_AXES = 1.4.0` and `schemas/explorer-bundle/1.4.0/`).

### Scope of v1.7 (in)

- A first-class **`Tag` entity** with the full shape below.
- A new link verb **`tagged-with`**, with `(fromType, toType) = (requirement, tag)` as the only permitted pair in v1.7.
- **Requirements** are the only taggable entity type in v1.7. Tagging other entity types is deferred.
- Tags are **workspace-shared** data, owned by the workspace, included in snapshots and master-bundle exports under `collections/tags.json` and `collections/links.json`.
- Workshop adds tag CRUD, tag application/removal on the Requirement Detail panel, and a tag filter on the Requirements navigator.
- Explorer promotes the existing `tag` filter chip on Requirements and the Relationships Board from deferred to active.
- Master bundles publish a derived `indexes/by-tag.json` summary so Explorer can render tag chips without scanning the link graph.

### Scope of v1.7 (out)

- Tagging Actions, Risks, Directions, Evidence, Domains, or Source Controls. Those land in a later slice once Requirement tagging is validated against real operator workflows.
- **Saved views** (`SVW` / `saved-views`). Still deferred. Tags ship without the named-filter-snapshot surface.
- Per-user / private tags. All tags are workspace-shared. A user wanting a private overlay should use a workspace-clone or local notes; the tag system is not a private-overlay system.
- Tag hierarchies, parents, categories, or implication rules. v1.7 keeps tags flat.
- Tag-driven posture brief sections. Posture brief composition is unchanged.

### Tag entity shape

| Field | Type | Required | Publication | Notes |
|---|---|---|---|---|
| `id` | string | yes | public | `TAG-<UUIDv7>`, time-stripped on publication per ADR 0002 |
| `entityType` | string | yes | public | literal `tag` |
| `schemaVersion` | string | yes | public | active `schemaVersion` |
| `createdAt`, `updatedAt` | string | yes | public | ISO-8601 |
| `sourceProduct` | enum | yes | public | `core` / `workshop` / `explorer` |
| `recordStatus` | enum | yes | public | `active` / `archived` / `inactive` / `deleted` |
| `label` | string | yes | public | Canonical unique key. Trimmed, normalised, case- and whitespace-insensitive uniqueness per E20. Allowed: letters, digits, spaces, hyphens, apostrophes. 1..40 chars |
| `title` | string | yes | public | Display label shown in chips and pickers. Defaults to `label` if the operator does not edit it. 1..60 chars |
| `description` | string | no | **sensitive** | Optional free-text note explaining why the tag exists. Default-deny applies: the field is excluded from bundles unless an export profile opts it in by name |
| `colour` | enum | yes | public | One of the closed set: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `grey`. Theme-aware token, resolved by Workshop and Explorer at render time |
| `emoji` | string | no | public | Optional single grapheme cluster; rendered before the title in chips. Must be a single user-perceived character |

Tags MUST NOT carry person, assignment, or assessment data. Tags are classifications only.

#### Field normalisation and defaults

- `label` is NFC-normalised, trimmed, and collapsed to single spaces before validation and duplicate comparison. The allowed character set is Unicode letters (`\p{L}`), Unicode digits (`\p{N}`), spaces, hyphen (`-`), and apostrophe (`'`).
- New tag forms pre-select `grey` as the default `colour`; the operator may choose another closed-set token before saving.
- `emoji` validation uses the platform `Intl.Segmenter` grapheme segmentation API where available. If a runtime lacks `Intl.Segmenter`, the field is disabled rather than accepted with weaker validation.
- Tag pickers and chip lists sort by `title` case-insensitively, then by `id` for deterministic ties. Archived tags are hidden from pickers.
- The pre-v1.7 stub fields `name` and `tagType` are retired, not aliased. No production migration is required; any import containing those fields is rejected as an unknown-field schema violation.

### Tagged-with link records

A requirement is tagged with a tag by writing a `link` record with:

- `linkType = "tagged-with"`
- `fromType = "requirement"`, `fromId = REQ-…`
- `toType = "tag"`, `toId = TAG-…`

The link record uses the existing canonical `link` envelope and follows existing link rules. Removing a tag from a requirement deletes the link record; the tag itself is unaffected. Archiving a tag does not cascade-delete its links; the link records remain so a snapshot taken before the archive still resolves. Pickers MUST exclude `recordStatus = "archived"` tags.

Workshop exposes archive, not hard-delete, for tags in v1.7. Hard deletion is reserved for internal tombstone handling only: imports, migrations, and debug repair tooling may write `recordStatus = "deleted"`, but normal UI flows MUST NOT orphan existing `tagged-with` links.

When an imported tag has a `label` that collides with an existing local tag after the E20 normalisation rule but carries a different `id`, the import planner MUST keep the local tag by default, drop the incoming tag row, and surface the row in the conflict/rejected list with a link to the existing tag. The importer MUST NOT silently create a second tag by changing the label.

Snapshots include the tag rows and `tagged-with` links that are active at snapshot creation time. A later archive of the tag does not rewrite the snapshot.

### Derived by-tag index

Master bundles MAY include `indexes/by-tag.json` to support fast Explorer tag-chip rendering. When present, it MUST use this shape:

```json
{
	"schemaVersion": "1.4.0",
	"generatedAt": "2026-05-16T00:00:00.000Z",
	"tags": [
		{
			"tagId": "TAG-00000000-0000-7000-8000-000000000001",
			"label": "security uplift",
			"title": "Security uplift",
			"colour": "grey",
			"emoji": "",
			"requirementIds": ["REQ-00000000-0000-7000-8000-000000000001"]
		}
	]
}
```

`tags` is sorted by `title` case-insensitively, then `tagId`. Each `requirementIds` array is sorted by requirement display order where available, otherwise lexicographically by `id`. `description` MUST NOT appear in this index.

### Limits

| Limit | Value | Enforcement |
|---|---|---|
| Tags per workspace | 64 hard cap, 32 soft warning | Core write-time validation; soft warning surfaced in Workshop and Explorer pickers |
| Tags applied per requirement | 16 hard cap | Core write-time validation |
| `label` length | 1..40 chars | Core write-time validation |
| `title` length | 1..60 chars | Core write-time validation |
| `description` length | 0..1000 chars | Core write-time validation |
| Tag label uniqueness | case- and whitespace-insensitive | E20 hard-reject |

### Filter contract

Tag filters MUST behave like the existing filter chips:

- A `tag` filter is multi-select: selecting two tags returns requirements that carry **any** of the selected tags (`OR`). The picker offers a "match all selected" toggle that switches the predicate to `AND` for the selected set. The default is `OR`.
- Active tag filters appear as removable chips in the filter bar (per the reusable filter bar in `explorer-screen-workflow-spec.md` § Filter bar).
- Filter state is reflected in the URL query string as `tags=TAG-…,TAG-…&tagsMode=any|all`.
- Tag filters in Explorer are persisted in `sessionStorage` only (E22). They MUST NOT be written to IndexedDB or appear in any exported bundle.
- The Workshop Requirements navigator gains the same tag filter, with the same `any | all` toggle.
- Tag filters compose with all other filters (domain, status, assurance, evidence coverage, action state, risk severity, text search) using `AND`.

### Surfaces affected

| Surface | Change |
|---|---|
| `packages/contracts` | `TagEntity` expanded; `LINK_TYPES` adds `tagged-with`; `PUBLICATION_FIELD_POLICIES` adds tag fields with the publication policies above |
| `pspf-invariants.md` | V1 link list adds `tagged-with`; new tag invariant block (T1–T4) records limits, colour token set, taggable-entity restriction, and the URL filter contract |
| `pspf-entity-link-spec.md` | Tag section replaced with the full shape; link table adds `tagged-with` row |
| `pspf-explorer-json-bundle-schema-spec.md` | `collections/tags.json` listed as an optional but defined collection; `indexes/by-tag.json` listed as an optional derived index |
| `explorer-screen-workflow-spec.md` | Tag filter promoted from "(v1.7+)" to active on Requirements and the Relationships Board; "My views" management surface remains deferred |
| `pspf-core-workshop-screen-workflow-spec.md` | Requirement Detail gets a tag rail (chips + picker); Workshop Requirements navigator gets a tag filter; Tag management is a webview reached by `Workshop: Manage Tags` |
| `pspf-vscode-extension-surface-spec.md` | Adds Workshop commands `pspf.workshop.manageTags`, `pspf.workshop.applyTag`, `pspf.workshop.removeTag`, `pspf.workshop.filterRequirementsByTag` |
| `pspf-spec-consistency-index.md` | New entry for v1.7; "tags" removed from the deferred-candidates list |

### Implementation gate (v1.7.0 release)

Accepting this ADR does **not** by itself bump the compatibility axes. The implementation PR that lands the Tag CRUD UI, picker, filter chips, and bundle round-trip MUST also:

1. Bump `VERSION_AXES` to `schemaVersion = bundleVersion = apiVersion = 1.4.0` and `PSPF_SLICE_VERSION` to `1.7.0`.
2. Publish a new immutable `schemas/explorer-bundle/1.4.0/` directory containing the tag collection schema and the updated link schema (per E23).
3. Extend the E2E (`scripts/e2e-v01.mjs` or its v1.7 successor) to author one tag, apply it to a requirement, snapshot, export, re-import, and assert the tag and the `tagged-with` link survive intact.
4. Extend `scripts/check-brief-redaction.mjs` to assert `Tag.description` does not appear in the posture brief on the standard fixture.
5. Extend `scripts/check-explorer-publication.mjs` to assert `collections/tags.json` and `indexes/by-tag.json` ship in the default Explorer bundle.
6. Add unit tests for the E20 hard-reject on duplicate tag labels (case- and whitespace-insensitive) and for the per-workspace and per-requirement limits.

The implementation PR MAY be split across more than one merge as long as the axes bump and the E2E land together.

## Out of scope for v1.7

- Saved views (`SVW`). Still deferred. v1.8+ candidate.
- Tagging Actions / Risks / Directions / Evidence. Deferred to a separate ADR.
- Per-user tag overlays. Not a goal; tags are workspace data.
- Tag hierarchies, parent / child, implication rules. Flat namespace only.
- Posture brief tag sections, tag-driven Action Impact, tag-aware Direction filters. Not in v1.7.

## Consequences

- Operators get a stable place to record interests and priorities without overloading existing fields.
- The filter bar gains a feature without changing its contract; URL bookmarking and shareable filter state extend cleanly.
- Cross-product tooling (Core SQLite, snapshot, export, import review, Explorer publication, Explorer local-authoring) all gain tag support in the same slice, avoiding the asymmetric-implementation risk that drove this ADR.
- `linkType = "tagged-with"` is the first addition to V1 since the link taxonomy was closed; this is a deliberate, justified extension and the closed-set rule remains.
- Saved views remain deferred, which keeps v1.7 focused. Operators can bookmark URL filter state in the meantime.

## Alternatives considered

- **Embed `tagIds: string[]` on requirements.** Rejected. It breaks the "links are first-class" rule (E18) and makes the link graph asymmetric: the Relationships Board would have to special-case tags rather than render them through the same graph traversal. It would also make per-import undo (E21) more delicate because tag-application would no longer be a discrete link record.
- **Reuse the existing `associated-with` link verb.** Rejected. `associated-with` is intentionally vague and used as the fallback for cross-domain links that have no better verb. Tag application is specific enough to deserve its own verb so filters, undo, and import review can target it without false positives.
- **Ship saved views in the same slice.** Rejected. Saved views are a separate user-facing surface and a separate entity (`SVW` / `saved-views`); bundling them with tags would double the slice and delay the foundation that the rest of v1.x has been waiting on.
- **Make tags per-user / private.** Rejected. PSPF workspaces are single-operator in practice, snapshots and bundles are the canonical hand-off, and a private overlay that disappears at export would surprise the next person opening the bundle. Workspace-shared tags with publication-policy defaults give the right trade-off.
- **Allow arbitrary colours and free-form icons.** Rejected. A closed colour token set keeps the rendered chips legible across light/dark themes and the AU-government accessibility floor, and a single-grapheme emoji is enough visual differentiation without an icon library.
