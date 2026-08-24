# 0093 — v1.59 reader-anchored change (J5)

- Status: accepted
- Date: 2026-08-24

## Context

J5 in `docs/ux-improvement-ideas.md` is "what changed since I last looked" — scored 1/2 at the v1.58.0 baseline: Explorer's compliance-event history table is an honest, well-scoped seed ("durable event history; it does not reconstruct an historical posture snapshot"), but it is calendar-anchored (30/90/all) rather than reader-anchored, covers only compliance-state transitions, and is not surfaced where operators actually look (the requirements list). Workshop's Home already anchors to the reader ("Since you were last here: ...") but does not name the anchor date or fold in staleness.

## Decision

1. Add a shared roll-up narrative builder to `@pspf/contracts`: `describeChangeRollup({ improved, regressed, wentStale })` composes "N improved, M regressed, K went stale" from caller-supplied counts, omitting zero categories, so the wording cannot drift between products.
2. Explorer's `AppStore` persists a reader-anchor timestamp (`READER_LAST_VISIT_META_KEY` in the existing `meta` key/value store) captured once per app boot: `lastVisitAt` holds the anchor from the _previous_ session, and the store immediately writes the current time as the new anchor. The anchor is read once and held for the whole session, so repeated in-session navigation does not reset it.
3. Explorer's Analytics view adds a "Since your last visit" option alongside the existing 30/90/all change-period controls, and leads the "Recorded changes over time" panel with a roll-up narrative: improved/regressed are derived from recorded compliance transitions (`toState`/`fromState` against `'yes'`), and "went stale" reuses the S3 staleness-preview count — no new event storage.
4. Explorer's Requirements list badges rows whose compliance state has changed since `lastVisitAt`, using the same reader-anchor and the existing compliance-event store. No badges render on a reader's first-ever visit, since there is no prior anchor to compare against.
5. Workshop Home's existing reader-anchored momentum sentence now names the anchor date explicitly ("Since you were last here on `<date>`: ...") and adds a staleness-delta component (more requirements due to go stale within 90 days since the last visit), extending the local `WorkshopMomentumSnapshot` with an `expiringSoonCount` field. This is VS Code workspace-state, not Core schema, so it carries no version-axis implication.
6. This slice introduces no entity, link, bundle, API, or Explorer schema change. `VERSION_AXES` remain `1.15.0`.

## Consequences

- "What changed" now has a reader-relative answer on both Explorer surfaces (Analytics narrative, Requirements list badges) and a clearer reader-anchored answer on Workshop Home, rather than requiring the operator to pick and interpret a fixed calendar window.
- Explorer's roll-up "improved/regressed" scope remains compliance-state transitions only; risks-opened/closed and actions-slipped as first-class recorded event types are explicitly deferred — the roll-up composes what is already recorded rather than adding new event storage in this slice.
- Workshop's momentum snapshot silently degrades for one release cycle for workspaces that already have a stored (pre-`expiringSoonCount`) baseline: the staleness-delta component simply does not appear until a fresh baseline is captured, rather than failing.

## Alternatives considered

- **Record first-class events for risk-opened/closed and action-slipped**: rejected for this slice; it would require new storage (an IndexedDB migration and new write paths at every risk/action mutation site) disproportionate to the acceptance bar, which the roll-up narrative already meets by composing existing signals.
- **Reset the reader anchor on every view visit**: rejected; it would make "since your last visit" degenerate to "since a few seconds ago" during normal in-session navigation. Anchoring once per app boot is the honest interpretation of "visit".
- **Migrate existing Workshop momentum snapshots to backfill `expiringSoonCount`**: rejected as unnecessary complexity for local, ephemeral workspace state; the field simply populates from the next captured baseline.
