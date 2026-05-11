# 0015 — Item Detail surface is a WebviewPanel

- Status: accepted
- Date: 2026-05-10

## Context

[pspf-core-workshop-screen-workflow-spec.md](../pspf-core-workshop-screen-workflow-spec.md) § 6 (Item Detail) currently reads:

> **Type:** preferred as an editor-like panel or focused WebviewPanel; optionally later as a custom editor.

Item Detail is the most-used screen in Workshop. Three different surfaces are sketched (editor-like panel, focused WebviewPanel, custom editor). Keeping the choice open turns every detail-screen feature into a fork in the road and prevents the shared `brief-renderer` and `chart-renderer` packages (introduced by ADR 0013) from being reused inside the detail screen.

The trade-offs:

- A **TextDocument-backed editor** (custom editor) is excellent for files-on-disk, but the system of record is SQLite, not a file. Synthesising a virtual document for every entity edit creates artificial save semantics and makes link panels awkward.
- A **TreeView with inline edits** is cheap to build but cannot host the relationship rail, validation rail, and activity sections in the same viewport without becoming unreadable.
- A **WebviewPanel** can host the full structure (header, main content, relationship rail, validation rail, activity), reuses the shared renderers, and matches the tone of the Reporting and Run Detail panels that are already specified as WebviewPanels.

## Decision

The Workshop **Item Detail** screen is a single **WebviewPanel** in v0.1 and v1.

- One detail-panel implementation per entity type (Requirement, Evidence, Action, Risk; Direction in v0.2; Supplier/Contract/Spend in v0.2 once Shop ships; Person/Role/Team/Assignment in v0.2 once Pub ships).
- The panel is opened by a `pspf.workshop.openItemDetail` command that takes an entity id and resolves to one of the per-entity panel implementations.
- The panel uses the shared `@pspf/contracts/ui-tokens` package and the same renderer packages used by Explorer, so a brief looks identical wherever it appears.
- Save semantics are explicit: the panel's `Save` button calls `pspf.core.updateEntity` and reflects the result; the panel does not fake VS Code's editor `isDirty`/`save` model.
- Multiple detail panels may be open simultaneously; each is its own WebviewPanel instance with its own state.
- The detail panel respects Workspace Trust: in an untrusted workspace it opens in read-only mode.

A custom editor (`CustomTextEditorProvider`) is **not** introduced in v1. If a future need to edit a file representation of an entity arrives, that becomes a separate ADR.

## Consequences

### Positive

- One implementation pattern across all detail screens; renderers and validation surfaces are reusable.
- Aligned with the rest of the rich Workshop surfaces (Run Detail, Report Prep) that are already WebviewPanels.
- Save semantics match the system of record (SQLite via Core API), not a synthesised document model.

### Negative / accepted trade-offs

- WebviewPanels are heavier than TreeViews; opening and closing many in a session has a memory and startup cost. Mitigated by: (a) one panel per entity at a time per Workshop window by default with an explicit "open in new panel" override; (b) a panel pool that disposes panels left unused for >10 minutes; (c) lazy-loaded renderers.
- Webviews require explicit accessibility and CSP discipline. Mitigated by inheriting the same CSP and `axe-core`-aligned accessibility floor used by Explorer (S4, E24).

## Alternatives considered

- **Custom editor with virtual document.** Rejected: introduces synthetic save semantics for SQLite-backed records; complicates relationship rail.
- **TreeView with inline forms.** Rejected: cannot host the relationship + validation + activity panels at the same time without a second view.
- **EditorPane API.** Not generally available; would lock the choice to a specific VS Code engine and removes the option to share renderers with Explorer.
