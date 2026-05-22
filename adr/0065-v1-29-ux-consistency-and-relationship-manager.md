# 0065 - v1.29 UX Consistency and Relationship Manager Foundation

- Status: proposed
- Date: 2026-05-22

## Context

The PSPF ecosystem now spans Core, Workshop, Explorer, Shop, and Pub. Similar actions such as editing records, linking records, confirming destructive changes, and reviewing related context must feel consistent across modules. The v1.28 Pub Marketplace foundation made the product family broader, which exposed that relationship actions were still scattered across product-specific command handlers.

## Decision

Adopt v1.29 as the UX consistency and relationship manager foundation release.

The slice introduces a machine-checkable entity UX coverage matrix, a `check:ux-coverage` gate, canonical operator relationship rules in `@pspf/contracts` through `OPERATOR_LINK_RULES`, and the first shared relationship-manager webview primitive in `@pspf/webview-shell`. Shop and Workshop relationship affordances start resolving through the shared rules before the full visual relationship manager is rolled across large edit panels.

## Compatibility

- Product version target: `PSPF_SLICE_VERSION = "1.29.0"`.
- Package version target: `1.29.0`.
- Schema, bundle, and API axes remain `1.10.0`.
- No new entity type, collection, link verb, schema directory, Explorer publication field, or Pub publication path is introduced.

## Scope

- Record the ecosystem UX consistency refactor plan.
- Track list, detail, create, edit, delete, and relationship coverage decisions for every first-class contract entity and Pub local record type.
- Gate the coverage matrix with regression tests so future entity additions require UX decisions.
- Centralise operator-editable relationship rules in contracts.
- Route Shop and Workshop relationship-link affordances through the canonical rule lookup.
- Add a shared relationship-manager renderer and prove it in the Shop assurance coverage flow.

## Deferred

- Full visual relationship manager UI across every module beyond the initial Shop proof point.
- Broad edit-panel simplification for Strategy, Requirement, Action, Shop, and Pub Team editors.
- Pub full person/role/assignment/note CRUD completion.
- Explorer publication of Pub data.
- New schema-bearing relationship fields or link verbs.

## Consequences

- New entity types and Pub local records cannot be added silently without a UX coverage decision.
- Relationship affordance drift becomes testable at the contract layer.
- The next UX slice can focus on visual relationship list/add/remove/archive controls rather than rediscovering allowed endpoint rules.