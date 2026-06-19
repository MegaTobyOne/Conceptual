# 0079 — Team share Git bundle

Status: **accepted**

**Date**: 2026-06-19
**Deciders**: Product owner, engineering

## Context

PSPF operators working in teams need a way to share their compliance posture data with colleagues. The existing `exportBundle` command creates a timestamped export directory suitable for archiving and Explorer publication, but it is not suited to Git-based team collaboration because:

1. Each export writes to a new timestamped directory, producing Git noise rather than diffs.
2. The manifest includes a `generatedAt` timestamp that changes on every export even when no data has changed.
3. Records are ordered by `created_at` which may not be stable across export runs.

This ADR records the decision to add a dedicated **team share bundle** export path that writes a deterministic, redacted JSON bundle to a fixed workspace path suitable for tracking in Git.

## Design Principles (inherited)

- **Local-first**: the feature uses no network access. The bundle is written to the local workspace file system.
- **Default-deny publication**: the same `sanitiseEntityForPublication` redaction used by `exportBundle` applies. Sensitive and restricted fields are stripped.
- **Offline-first**: the fixed bundle path is inside `.pspf/share/` which is inside the workspace folder. Users decide whether to track this in Git — the product does not commit or push on their behalf.
- **Deterministic output**: same data → same file bytes (except for `generatedAt` in the manifest, which is intentionally updated on each export to record freshness but does not affect the per-collection hashes used for integrity verification).

## Decision

Add a `exportTeamShareBundle` function to Core that:

1. Writes a single `bundle.json` to `.pspf/share/bundle.json` — overwriting on each export (no timestamp in the path).
2. Sorts each collection by entity `id` before serialisation, so the record order is stable and Git diffs reflect only genuine data changes.
3. Uses `sanitiseEntityForPublication` for every entity — identical redaction policy to `exportBundle`.
4. Sets `generator.mode` to `"team-share"` to distinguish the artefact from publication-mode bundles.
5. Does **not** include a separate per-collection file tree — the bundle is a single flat `bundle.json` matching the `{ manifest, collections }` shape already used by Explorer's local-authoring import.

A new command `pspf.core.exportTeamShareBundle` is registered in Core and exposed via the Core API.
A new command `pspf.workshop.exportTeamShareBundle` is registered in Workshop and surfaces the feature to operators via the Workshop Home panel and command palette.

## Sensitivity labelling in UX

All fields exported through `sanitiseEntityForPublication` are `"public"` in the publication policy. Fields marked `"sensitive"` or `"restricted"` are stripped before the bundle is written. The Workshop UI labels the command as a "team share" export to make clear that sensitive personal fields (names, email addresses, person IDs, rationale notes) are never included.

## Consequences

- A new `share` path is added to `WorkspacePaths` (`.pspf/share`).
- Operators who track their workspace in Git can commit `.pspf/share/bundle.json` to share their posture data with colleagues.
- Colleagues can import the shared bundle using `pspf.core.importBundle` (additive-merge mode) to receive the exported posture data.
- The `.gitignore` convention for PSPF workspaces should exclude `.pspf/core/`, `.pspf/exchange/`, `.pspf/logs/`, `.pspf/cache/` but **include** `.pspf/share/` when Git-based sharing is desired.
- This feature does not introduce conflict resolution — that remains operator responsibility via standard Git workflows. A later ADR may introduce a reconciliation UI if demand warrants it.

## Out of scope for this ADR

- Automatic Git commit or push on export.
- Conflict resolution between team members.
- Encryption or signing of the shared bundle (deferred to the assurance publication ADR — ADR 0078).
- OneDrive/iCloud workspace resilience (workspace-level concern, not product-managed).
- A dedicated "team share import" command — existing `importBundle` handles this.
