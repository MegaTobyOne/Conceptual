# 0054 - v1.19 Shop commercial coverage dashboard

- Status: proposed
- Date: 2026-05-18

## Context

ADR 0053 made Shop assurance links real: suppliers, contracts, and spend items can now connect to Requirements, Actions, and Risks through existing Core `link` records. The next useful slice is not more ingestion. Operators first need to see whether the commercial records they already have are connected to assurance work and whether any commercial commitments need near-term attention.

v1.19 should make Shop answer practical coverage questions:

- Which suppliers, contracts, and spend items are not linked to assurance context?
- Which contracts are ending soon?
- Which spend items fund open, blocked, or overdue actions?
- Which suppliers are associated with high-risk work?

## Decision

Plan v1.19 as a Shop commercial coverage dashboard slice.

The slice enriches the existing Shop Home/Forecast surface with coverage and renewal-risk summaries derived from Core-backed commercial records and existing links. It does not add new entity types, fields, link verbs, bundle collections, or schema directories.

### Dashboard scope

Shop should show:

- linked-assurance coverage counts for suppliers, contracts, and spend items;
- unlinked supplier, contract, and spend-item counts;
- contracts ending within a near-term review window;
- spend items linked to open, blocked, or overdue Actions;
- suppliers linked to high-risk or open Risk records;
- quick actions that route operators into the existing v1.18 link commands.

Workshop may receive small commercial-context polish only where it makes the v1.19 coverage story clearer, such as better empty states or grouped commercial context rows. Explorer continues to consume existing commercial records and links through the current bundle relationship model.

## Version and schema impact

- Planned product version: `PSPF_SLICE_VERSION = "1.19.0"`.
- `VERSION_AXES` should remain `schemaVersion = bundleVersion = apiVersion = "1.8.0"` unless implementation discovers a real contract need.
- No new compatibility axis, entity type, collection, field, link verb, or JSON Schema directory is planned.

## Consequences

Positive:

- Shop becomes useful as a triage surface, not only a data-entry surface.
- Operators can find missing assurance links before exporting or briefing.
- Commercial renewal and funding signals are visible without introducing a full finance or approvals workflow.

Trade-offs:

- Coverage metrics must be computed from existing records and links, so empty or sparse workspaces need clear no-data states.
- The dashboard must avoid exposing restricted contact fields, sensitive notes, assumptions, service summaries, or monetary values in contexts where publication policy would exclude them.
- The slice adds release-gate expectations for Shop without expanding Pub or Explorer authoring scope.

## Deferred

v1.19 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, chart/PDF export, multi-user commercial plans, new commercial entity fields, or new compatibility axes.