# 0051 - v1.16 Shop canonical commercial entities

- Status: accepted
- Date: 2026-05-18

## Context

ADR 0050 reopened Shop as a standalone VS Code extension with workspace-local JSON storage. That let operators test the first commercial planning surface without changing Core, Workshop, Explorer, the master bundle, or the canonical version axes.

The next useful slice is to promote Shop's supplier, contract, and spend-item records into the shared PSPF contract model so they can be validated, stored, imported, exported, and schema-checked like other first-class entities. `pspf-entity-link-spec.md` already defines the commercial entities and their fields. The publication model must still treat commercial data as sensitive by default.

## Decision

v1.16 promotes the Shop commercial entities into the canonical PSPF contract and bundle surface:

- `supplier` (`SUP-*`) in the `suppliers` collection;
- `contract` (`CTR-*`) in the `contracts` collection; and
- `spend-item` (`SPD-*`) in the `spend-items` collection.

The slice updates `@pspf/contracts`, Core collection handling, the Explorer bundle schemas, release-candidate gates, and the Shop extension so Shop records use the shared entity definitions.

## Publication policy

Commercial fields default to internal, sensitive, or restricted publication policy:

- supplier identifiers, type, status, and criticality are internal;
- supplier `name` and `notes` are sensitive;
- supplier `primaryContact` is restricted and must never publish;
- contract identifiers, title, supplier link, status, and dates are internal;
- contract reference, value, and service summary are sensitive;
- spend-item identifiers, title, type, status, financial year, savings type, payback period, and confidence are internal; and
- spend amounts, forecast dates, forecast cost, expected savings, assumptions, and notes are sensitive.

Published Explorer bundles may include the commercial collections, but the sanitiser must omit sensitive fields and fail closed on restricted fields or fields without explicit publication metadata.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.16.0"`.
- `VERSION_AXES` becomes `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- `schemas/explorer-bundle/1.8.0/` is introduced with `suppliers`, `contracts`, and `spend-items` collection schemas.
- Existing v1.7.0 bundle schemas remain immutable.

## Consequences

Positive:

- Shop records become first-class PSPF entities rather than a private extension-only store shape.
- Core can store, import, export, count, and validate commercial records through the existing collection-driven pipeline.
- The publication policy makes commercial sensitivity explicit before any cross-product sharing grows around it.

Trade-offs:

- The schema axis now moves, so release-readiness and schema gates must understand v1.16.
- Shop's first local JSON store needs a compatibility read path for v1.15-era records until a migration command is added.
- Explorer receives redacted commercial collections before it has a dedicated commercial UI.

## Deferred

v1.16 does not add Shop-to-Workshop linking UI, editable Explorer commercial views, CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, chart/PDF export, Pub integration, approvals, multi-user commercial plans, or Marketplace publication of the Shop extension.
