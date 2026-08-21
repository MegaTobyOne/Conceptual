# PSPF Workshop Connected View Specification

Status: **draft**

## 1. Purpose

Connected View is a read-only Workshop surface for understanding how operational records relate to one another.

It answers:

> What Direction, Requirement, Risk, and Action records are connected to this item?

The view helps an operator trace assurance posture and follow-up work without leaving the current workflow. It does not create, edit, delete, or relink records. Changes are made through the existing Workshop detail and relationship workflows.

## 2. Display

Connected View displays records as cards in lanes:

- **Directions** — the relevant Direction records and their response state.
- **Requirements** — Requirements and their assessment state.
- **Risks** — linked Risks and their severity or closed state.
- **Actions** — linked Actions and their work status, including urgency where available.

Each card displays only:

- a short human-readable reference,
- the record title,
- and predefined status or severity indicators.

The default Workshop layout groups Requirement cards into lanes by domain. A compact layout combines them into one Requirements lane. Directions, Risks, and Actions remain available in both layouts.

The board must remain usable when a lane has no records. Empty lanes display a clear empty state rather than disappearing without explanation. The board supports scrolling when the number of records exceeds the available space.

## 3. Linkage

Connected View displays canonical `Link` records only. It does not infer relationships from titles, shared fields, or proximity on the board.

The supported relationships are:

| From        | Link type                      | To          |
| ----------- | ------------------------------ | ----------- |
| Direction   | `targets`                      | Requirement |
| Requirement | `exposed-by`, `treated-by`     | Risk        |
| Risk        | `addressed-by`, `treated-by`   | Action      |
| Requirement | `supported-by`, `addressed-by` | Action      |
| Direction   | `addressed-by`, `supported-by` | Action      |

Links are oriented consistently for display, even when the stored Link record uses the reverse direction. Unsupported link types, self-links, and links to records not present in the view are ignored without preventing the remaining view from rendering.

A visible connector joins each displayed linked pair. Connector styling may distinguish active, contextual, and inactive relationships, but the relationship must not depend on colour alone.

## 4. Selection and connected chains

Selecting a card highlights:

- the selected card,
- its directly linked neighbours,
- the full transitive chain reachable through displayed links,
- and the connectors belonging to that chain.

Unrelated cards and connectors are visually de-emphasised while a selection is active. A selection summary may show the number of connected Directions, Requirements, Risks, and Actions, together with the direct-neighbour context.

Selection behaviour is:

- click a card to select it;
- Cmd-click or Ctrl-click to add another card to the selection;
- click the sole selected card again, press Escape, or use Clear selection to remove the selection;
- press Enter or Space while a focused card is selected to provide the equivalent keyboard action.

Hover or keyboard focus may show the card reference, status indicators, and direct linked neighbours. The essential relationship information remains available through selection and does not depend on hover.

## 5. View management

The toolbar provides controls to:

- switch between domain-grouped and compact layouts;
- show or hide Directions;
- show or hide Requirements, Risks, and Actions;
- show or hide Requirements assessed as N/A;
- show or hide individual Requirement domains;
- zoom out, zoom in, or reset zoom;
- clear the current selection;
- refresh the view from current Workshop workspace data.

Controls expose their current state to assistive technology. Zoom changes the presentation without changing the underlying records or links. Connector positions are recalculated after layout, visibility, resize, or zoom changes.

Refresh re-reads the current workspace state and rebuilds the view. The current selection is retained when its records still exist; otherwise it is cleared. Refresh does not write data.

Double-clicking a card, or using its Open action, opens the corresponding Workshop detail surface. Opening detail does not change the current Connected View selection unless the user explicitly changes it.

## 6. Data protection and boundaries

Connected View must not display:

- narrative or free-text fields that are not approved for this surface;
- restricted personal information, including person names, email addresses, or assignment person IDs;
- inferred relationships or unsupported Link types;
- editing controls for creating or changing links.

The view must render a useful empty state when workspace data is absent. Invalid or incomplete individual records must not prevent valid records from being displayed.

The shared Connected View model and renderer are the source of truth for the Workshop and Explorer implementations. Workshop owns the interactive workspace refresh and entity-opening behaviour; Explorer may use a different default layout for publication review.

## 7. Acceptance criteria

Connected View is acceptable when:

1. Directions, Requirements, Risks, and Actions render in the expected lanes.
2. Workshop opens with Requirements grouped by domain.
3. The compact layout combines Requirements into one lane.
4. Only the supported canonical Link relationships are displayed and oriented consistently.
5. Connectors remain attached to their cards after scrolling, resizing, visibility changes, and zoom changes.
6. Single selection, multi-selection, chain highlighting, and selection clearing work with mouse and keyboard input.
7. Lane, domain, N/A, layout, zoom, and refresh controls update the view without mutating workspace data.
8. Refresh reflects current workspace records and retains valid selection where possible.
9. A card opens the correct Workshop detail surface.
10. Empty, invalid, and redacted data are handled without exposing restricted fields or breaking the rest of the view.
