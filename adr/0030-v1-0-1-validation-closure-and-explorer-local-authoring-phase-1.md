# ADR 0030 — v1.0.1 validation closure and Explorer local-authoring phase 1

- Status: accepted
- Date: 2026-05-14

## Context

v1.0 reached automated release readiness with all tracked gates passing and the initial manual validation runs have been clean to date. The current product remains Core, Workshop, and Explorer publication mode for initial assurance user testing.

The original Explorer design already specifies local-authoring mode: browser-local `IndexedDB` persistence for a user's own status/compliance work, clear separation from the loaded bundle baseline, and export back through the standard master JSON bundle. ADR 0014 deferred that capability out of v0.1, and ADR 0022/ADR 0028 kept it deferred past v1.0 so the publication spine could stabilise first.

The next release decision should preserve the clean v1.0 validation state while making the post-v1.0 direction explicit.

## Decision

1. Cut v1.0.1 as a patch release over v1.0.0.
2. v1.0.1 records the clean manual validation status to date and keeps the v1.0 product scope unchanged: Core, Workshop, and Explorer publication mode only.
3. v1.0.1 does not introduce new entities, bundle fields, schema directories, import semantics, or Explorer authoring workflows.
4. Package versions and `PSPF_SLICE_VERSION` bump to `1.0.1`.
5. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
6. The next feature tranche after v1.0.1 is **Explorer local-authoring phase 1**: a browser-local working store for user-owned compliance/status overlays, backed by `IndexedDB`, with export/import through the existing master JSON bundle format.
7. Phase 1 must stay deliberately narrow: persistent local status/compliance overlays, storage status/reset/export-first affordances, baseline-vs-local visual separation, personal-data exclusion, zero runtime network egress, and a round-trip test from Explorer export back into Core/Workshop.
8. Phase 1 explicitly excludes full `plan-apply`, broad action/risk/evidence authoring, editable posture, chart image export, Shop, and Pub. Those remain later decisions.

## Consequences

- v1.0.1 is a validation and release-prep patch, not a scope expansion.
- The project has a recorded decision that Explorer local persistence is intended and already part of the product direction, while still respecting that it is not in the current release.
- Future Explorer local-authoring work should start with a narrow ADR or implementation plan for phase 1, rather than attempting the full dual-mode Explorer surface at once.
- The existing `1.3.0` schema/bundle/API axes remain stable for the v1.0.x line.

## Alternatives considered

- **Ship full Explorer local-authoring mode immediately after v1.0.** Rejected: it combines storage, editing, conflict handling, import planning, undo, and redaction risk in one tranche.
- **Leave Explorer local authoring as an unspecified future item.** Rejected: the original spec already defines the direction, and the release roadmap needs a concrete next feature boundary.
- **Treat Explorer as publication-only permanently.** Rejected: ADR 0004 and the Explorer workflow spec intentionally preserve a lightweight user-owned authoring surface distinct from Core/Workshop.