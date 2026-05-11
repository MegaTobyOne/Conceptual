# 0010 — Explorer Relationships surface: Board primary, graph deferred

- Status: accepted
- Date: 2026-05-09
- Related: ADR 0004 (Explorer dual-mode), `explorer-screen-workflow-spec.md` § Relationships (Board) screen

## Context

The standalone PSPF Explorer prototype shipped a Cytoscape-based network graph as its only relationship surface, and an unbuilt "Board" mode mentioned in the README. In practice, the operational question users want answered ("what should I work on next?") is much better served by a curated column board than by a force-directed graph, and the graph carries non-trivial accessibility, reduced-motion, keyboard-equivalence, CSP, and bundle-size costs.

The Conceptual rewrite is now small and focused; one good relationship surface beats two competing ones.

## Decision

The v1 Explorer Relationships screen is a **column board**, not a network graph. Lanes are curated and small; cards are entities; an inspector panel shows the connected chain on selection. The prototype's network graph is **deferred** out of the v1 scope and is not on the v1 roadmap.

The lane set in v1 is exactly six (gaps without work; gaps with action in flight; blocked or overdue; open risks by band; Directions awaiting response; recently changed). The set is data-driven and may evolve without a schema change.

## Consequences

- One relationship surface in v1, owned by `explorer-screen-workflow-spec.md`.
- No graph-engine runtime dependency; no Cytoscape (or equivalent) in the bundle. CSP stays tight; bundle stays small.
- Keyboard-equivalence and reduced-motion open questions for the relationship view collapse — the board is keyboard-native and motion-free.
- The existing relationship data model (the `relationships` collection plus implicit entity-side link arrays) is unchanged. A future graph view, if added in a later phase, can reuse the same data.
- The "list-equivalent fallback for the graph view" requirement in earlier drafts is removed; the board *is* the listed surface.

## Alternatives considered

- **Board primary, graph as optional toggle.** Rejected for v1 — preserves the graph at a maintenance cost we have not justified. Can be revisited in a later phase.
- **Board and graph as equal peers.** Rejected — doubles the screen surface for a feature explicitly secondary to the user.
- **Keep graph primary, add Board as alternative layout.** Rejected — contradicts the stated user preference and inherits the graph's accessibility cost.

## Reopening criteria

A future ADR may reintroduce a graph view if all of the following hold:

1. There is concrete, repeated user feedback that a graph would answer a question the board does not.
2. The graph view can be delivered without weakening CSP, bundle size, or keyboard-equivalence guarantees.
3. The graph reuses the existing relationship model without schema additions.
