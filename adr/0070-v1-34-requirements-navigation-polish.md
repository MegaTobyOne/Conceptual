# 0070 - v1.34 Requirements navigation polish

- Status: proposed
- Date: 2026-05-28

## Context

By v1.33, PSPF has enough assurance data that the Requirements surface is no longer just a flat checklist. Operators move between PSPF domains, Directions, tags, assessment states, and search terms while they are trying to answer one practical question: "what should I look at next?"

The current Workshop Requirements browser and Explorer Requirements table support filtering, but the navigation does not yet make the active scope obvious. A user can reduce the visible set without a strong visual cue, and moving between domains takes more effort than it should. The Strategy surfaces also render trend as plain text, and Connected View highlighted lines can visually compete with a selected card.

v1.34 should improve navigation and visual priority without changing the underlying assurance model.

## Decision

Implement v1.34 as **Requirements navigation polish** across Workshop and Explorer.

The slice provides:

1. A Requirements tab row with `All`, PSPF domain tabs, and a peer `Directions` tab.
2. A `Directions` tab that shows Requirements targeted by existing Direction links, keeping Directions as context rather than a separate authoring mode.
3. A visible filtered-count cue and clear action whenever search, tab, status, tag, or saved-view state reduces the visible Requirements set.
4. Labelled trend indicators in Strategy and list/table surfaces, using red/amber/green/neutral arrows plus text labels rather than colour alone.
5. Explicit Connected View layering so selected cards always remain visually above connector lines, including highlighted paths.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.34.0"`.
- Package version target: `1.34.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.11.0"` because this slice adds no published bundle fields, collections, link verbs, or schema-bearing entities.

## Non-goals

The following remain out of scope for v1.34:

- New Requirement, Direction, saved-view, or navigation entities.
- New published bundle fields, collections, link verbs, or schema directories.
- Direction local-authoring changes.
- Editable Connected View, drag-to-link, edge filtering, or path-routing semantics.
- Tag hierarchy, default-start views, team/private saved views, or saved-view schema changes.
- Reworking the PSPF domain model or reference-data baseline.

## Consequences

Positive:

- Operators can move between domain scopes naturally without losing the familiar Requirements list/table context.
- Reduced-result states are explicit, making search/filter state less surprising during reviews.
- Directions become easier to use as an assurance-navigation lens while preserving existing Direction records and links.
- Trend information becomes faster to scan and remains accessible without relying on colour alone.
- Connected View keeps the selected card as the visual focus when tracing relationship chains.

Trade-offs:

- Workshop and Explorer need matching navigation semantics even though their rendering stacks differ.
- The `Directions` tab is a lens over Requirements, not a full Direction-management surface; deeper Direction workflows continue to live in existing Direction details.
- The filtered-count cue must account for combined filter state, which adds client-side UI state but no data-model state.

## Quality gates (delta)

- Workshop Requirements renders domain tabs, a Directions tab, and a visible count/clear cue when filters reduce the visible set.
- Explorer Requirements renders the same tab model and cue while preserving existing search, status, and tag filtering.
- Trend columns render labelled arrow indicators for improving, steady, deteriorating, and unknown values.
- Connected View selected cards stack above SVG connector lines, including highlighted selected-chain paths.
- Regression validation covers `e2e:v1.34`, `check:explorer-publication`, `check:workshop-navigation`, `check:ux-coverage`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck`.

## Related

- [pspf-design-spec.md](../pspf-design-spec.md)
- [explorer-screen-workflow-spec.md](../explorer-screen-workflow-spec.md)
- [pspf-core-workshop-screen-workflow-spec.md](../pspf-core-workshop-screen-workflow-spec.md)
- [adr/0055-v1-20-connected-view.md](0055-v1-20-connected-view.md)
- [adr/0059-v1-23-connected-view-and-commercial-planning-polish.md](0059-v1-23-connected-view-and-commercial-planning-polish.md)
- [adr/0060-v1-24-workshop-cyber-strategy-map.md](0060-v1-24-workshop-cyber-strategy-map.md)