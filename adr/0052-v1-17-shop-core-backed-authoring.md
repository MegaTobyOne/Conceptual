# 0052 - v1.17 Shop Core-backed authoring

- Status: accepted
- Date: 2026-05-18

## Context

ADR 0050 introduced Shop as a standalone local JSON experience. ADR 0051 then promoted supplier, contract, and spend-item records into canonical contracts, Core collections, and the v1.8.0 Explorer bundle schema. After v1.16, the remaining mismatch is ownership: Shop records have canonical entity shapes, but the Shop extension still treats `.pspf/shop/shop.json` as its editable system of record.

The next useful slice is to make Core the authoring store for Shop commercial records while preserving a deliberate compatibility path for existing v1.15 and v1.16 local Shop stores. This keeps the product boundary clear: Core remains the workspace system of record; Shop becomes the commercial authoring surface over canonical records.

## Decision

v1.17 makes Shop authoring Core-backed:

- Shop lists suppliers, contracts, and spend items from Core commercial collections when a PSPF workspace is available.
- Shop create/edit/delete commands write canonical commercial records through Core APIs.
- `.pspf/shop/shop.json` is no longer the active system of record; it becomes a compatibility source for explicit operator-initiated import or sync.
- Existing v1.15/v1.16 Shop JSON records are normalised through the current compatibility path before they are written to Core.
- Shop surfaces validation and publishability status from the canonical contracts and publication policy rather than maintaining a separate private status model.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.17.0"`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new entity type, collection, link verb, field, or published JSON Schema directory is introduced.

## Consequences

Positive:

- Shop commercial records participate in snapshots, imports, exports, redaction checks, and Explorer bundles through the existing Core pipeline.
- Operators have one system of record for commercial data instead of a parallel extension-local store.
- The compatibility import path lets early Shop testers keep existing local JSON data without silent migration.

Trade-offs:

- Shop must handle Core unavailable or untrusted workspace states explicitly.
- Existing local-only workflows need a clear import/sync action rather than automatic startup mutation.
- The extension now depends on Core command/API behaviour and writer-lock outcomes.

## Deferred

v1.17 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, Shop-to-Workshop linking UI, chart/PDF export, multi-user commercial plans, or Marketplace publication of the Shop extension.