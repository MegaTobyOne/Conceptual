# 0055 - v1.20 Connected View

- Status: accepted
- Date: 2026-05-18

## Context

By v1.19 operators can author Directions, Requirements, Risks, and Actions, link them with the existing closed link taxonomy, and review them in Workshop tables, Explorer panels, and Shop coverage views. None of those surfaces show, at a glance, *how* the chain hangs together. Operators currently re-trace the linkage by jumping between sections, the Relationships Board, and detail panels.

For v1.20 the next useful slice is a single read-only "Connected View" that shows the Directions → Requirements → Risks → Actions chain on one board and lets the operator click a card to highlight the connected chain. This is purely a visualisation slice on top of existing data; it must not change schemas, link verbs, entity fields, or compatibility axes.

## Decision

Add a new `@pspf/connected-view` shared renderer package and surface it in Workshop and Explorer as a Connected View board.

The slice introduces:

- A pure model builder `buildConnectedViewModel({ directions, requirements, risks, actions, links, domains })` that walks the existing closed link verbs (`targets`, `exposed-by`, `treated-by`, `addressed-by`, `supported-by`) and emits oriented `node`/`edge` records grouped into Directions, Requirements (by `Requirement.domain`), Risks, and Actions lanes.
- A pure HTML renderer that emits a static, redaction-safe board shell with selection toolbar, lane chips, and a single hidden JSON payload (`<script type="application/json" data-cv-data>`) for the browser-side enhancer.
- A browser enhancer (`CONNECTED_VIEW_BROWSER_SCRIPT`) that:
  - draws neutral SVG bezier edges between connected card edges and redraws on resize;
  - implements single-select on click, Cmd/Ctrl/Shift-click for multi-add, click-on-sole-selection clears, and Enter/Space keyboard selection;
  - computes the transitive connected chain via BFS and applies `cv-selected`/`cv-connected` classes that dim unrelated cards;
  - emphasises related Requirement cards in the connected chain without adding requirement-to-requirement links;
  - shows card details and direct linked neighbours in a hover/focus popover positioned beside the active card, instead of a fixed inspector panel;
  - exposes a toolbar `Refresh` action that re-renders the Workshop panel from current workspace state and reloads the static Explorer page;
  - opens entity detail on double-click by delegating to the existing `data-command="openEntity"` handler shared by Workshop's shell.

### Surfaces

- **Workshop** ships a new command `pspf.workshop.openConnectedView`, a left-panel title action, and a home-screen button. The Workshop panel defaults to the rich domain-grouped layout (Requirements split per `Requirement.domain` lane) with all of Directions, Requirements, Risks, and Actions visible.
- **Explorer** renders the Connected View as a new `<details id="connected-view">` section after the Relationships Board. The Explorer panel defaults to the compact three-lane layout (Directions + grouped Requirements collapsed into a single Requirements lane, plus Risks and one Actions lane) so the section stays readable inside the static page.
- A single Actions lane is used in both surfaces. Cards stay compact with short reference and title only; status, urgency, and neighbouring records appear in the hover/focus popover rather than on-card badge rows.
- Edges are drawn in a neutral colour; only the highlighted chain uses the accent colour. The view does not introduce new link styling vocabulary.

### Data and redaction

- The Connected View reads only data already present in the Explorer bundle and Workshop runtime: short references, titles, domain codes, assessment status, action status, action impact urgency, risk likelihood/impact, and direction response state. It does not surface restricted fields, free text, or personnel data.
- The renderer treats missing or empty inputs as a no-data state and emits an empty board shell.

## Version and schema impact

- Planned product version: `PSPF_SLICE_VERSION = "1.20.0"`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new compatibility axis, entity type, collection, field, link verb, JSON Schema directory, or bundle file. The slice is additive UI only.

## Consequences

Positive:

- Operators can see and trace the Directions → Requirements → Risks → Actions chain on one board.
- Workshop authoring and Explorer review share the same renderer, so the chain reads the same way pre- and post-export.
- Selection-based highlighting answers "what depends on this?" without changing data, and related Requirements become visible through shared Direction, Risk, or Action neighbours without changing the closed link taxonomy.
- Hover/focus details keep cards compact while still exposing the redaction-safe status and linked-neighbour context on demand.

Trade-offs:

- The browser enhancer must re-implement the model builder and renderer in plain JS to render inside the static Explorer bundle; this duplication is acceptable while the slice stays small and is covered by the same selection contract on both surfaces.
- Workshop and Explorer must keep the existing closed link taxonomy stable; if new link verbs are added later they must be mapped into the oriented edge sets in `@pspf/connected-view` before the board reflects them.
- The board uses neutral edge colours and shared lane styling; richer visual encoding (impact heat, risk colour, domain-coloured edges) is intentionally deferred.
- The hover popover is informational only and does not provide editing, linking, or persistent inspection state.

## Deferred

v1.20 does not add: an editable Explorer Connected View, drag-to-link, edge filtering, impact-weighted layout, Action Impact ranking integration, ISM control overlays, image/PDF export of the board, multi-user collaboration cursors, or any new entity types, fields, link verbs, or compatibility axes.
