# 0037 - v1.6 Workshop import review and identity

- Status: accepted
- Date: 2026-05-15

## Context

v1.5 introduced `plan-apply` import and undo for Explorer local-authoring exports, and v1.5.1 clarified the product boundary: Workshop is the system of record and decision surface; Explorer is the portable review, briefing, lightweight annotation, and round-trip suggestion surface.

The v1.5 import review used modal confirmation copy plus output-channel details. That was safe but not a proper Workshop review surface. Operators need a durable, scan-friendly surface before accepting Explorer local JSON into the canonical Workshop workspace.

The Explorer identity pass also made Workshop feel comparatively generic. v1.6 should give Workshop its own product expression without making it look like Explorer.

## Decision

v1.6 adds a proper Workshop import review surface for Explorer local JSON plan-apply imports.

The review surface:

- opens as a VS Code webview panel titled `PSPF Workshop Import Review`;
- presents the import as a read-only plan before any writes;
- shows file count, created, updated, unchanged, and write counts;
- shows per-entity-type created, updated, unchanged, and write counts;
- highlights update/conflict examples for operator review;
- offers explicit `Apply Import`, `Show Details`, and `Cancel` actions;
- keeps `Undo Import` available after apply through the existing pre-import undo snapshot.

v1.6 also establishes a Workshop-specific identity variation:

- Workshop is labelled as the `System of record` and decision surface;
- Workshop Home and shared Workshop webview panels use a cooler blue assurance-working treatment;
- sensitivity banners remain visible as `OFFICIAL: Sensitive`;
- Explorer keeps its warmer portable-assurance identity from ADR 0036.

No new entity type, collection, schema directory, compatibility-axis bump, Shop, Pub, editable posture, tags, saved views, or compliance-history export control is introduced in v1.6. Schema, bundle, and API axes remain `1.3.0`; product version bumps to `1.6.0`.

## Consequences

- Explorer local JSON acceptance now happens in a surface that matches Workshop's decision-making role.
- Operators can review import impact by file and entity type before writing canonical records.
- The output channel remains available for detailed logs, but it is no longer the primary review experience.
- Workshop and Explorer now have distinct but related product identities: Workshop is the canonical working surface; Explorer is the portable review surface.
