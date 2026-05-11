# 0021 - v0.4 readiness and UI resilience

- Status: accepted
- Date: 2026-05-11

## Context

v0.3 validated the ISM source library, Requirement to ISM mapping, mapping quality, and drift detection. Manual validation confirmed the functional slice is working, but the richer v0.3 tables exposed a usability risk: as columns multiply, titles and field values can wrap heavily and make Explorer and Workshop harder to scan.

The v1 target remains much broader than the current implementation. Before adding another large feature surface, the product needs a small hardening release that improves readability, updates readiness documentation, and adds a layout regression check for the publication-mode surface.

## Decision

Define v0.4 as a readiness and UI-resilience slice.

v0.4 does not change the Explorer bundle schema, Core API shape, or entity model. The active compatibility axes remain `schemaVersion = 1.2.0`, `bundleVersion = 1.2.0`, and `apiVersion = 1.2.0`. Product/package version rolls to `0.4.0`.

v0.4 includes:

- table readability hardening in Explorer publication mode and Workshop webviews,
- stable handling for title-like columns, compact status fields, and dense multi-column tables,
- an Explorer layout smoke gate that checks compact validation pills and title columns at desktop and narrow viewports,
- updated readiness documentation that reflects the current v0.3/v0.4 reality rather than the original v0.1 state.

v0.4 explicitly does not start Shop, Pub, Explorer local-authoring mode, Direction overlay, Action Impact ranking, posture editing, or plan-apply import. Those remain candidate v1 feature tranches.

## Consequences

### Positive

- The validated spine becomes more comfortable to use before additional fields and views are added.
- Layout regressions around wrapped pills and cramped tables become testable rather than purely manual.
- v1 planning can proceed from a cleaner readiness baseline.

### Negative / accepted trade-offs

- v0.4 is intentionally light on new domain functionality.
- Some dense tables may use horizontal scrolling at narrow widths instead of forcing every column into the available viewport.

## Alternatives considered

- **Jump directly to v1.** Rejected: the v1 acceptance surface is still materially larger than the implemented Core, Workshop, Explorer publication, and ISM spine.
- **Start Shop or Pub immediately.** Rejected: those are important v1 tranches, but the current operator-facing surfaces should be hardened first.
- **Rely on manual visual review only.** Rejected: the status-pill issue and v0.3 table wrapping showed that basic automated layout checks are worthwhile.