# 0050 - v1.15 Shop commercial planning foundation

- Status: accepted
- Date: 2026-05-17

## Context

ADR 0014 deferred the Shop product to v0.2+, and `packages/shop/` has carried only a deferral note since. The commercial entities the Shop will eventually own — supplier (`SUP`), contract (`CTR`), and spend item (`SPD`) — are already defined in `pspf-entity-link-spec.md`, and the Shop VS Code surface is already sketched in `pspf-vscode-extension-surface-spec.md` (`pspfShop` activity container, suppliers/contracts/spend/forecast views, `pspf.shop.*` command prefix, Marketplace id `tobyharvey.pspf-shop`).

The first user-validation goal is small: an assurance operator should be able to install the Shop extension, capture a handful of suppliers, contracts, and spend items in their workspace, and view a derived spend forecast — without changing the existing Core, Workshop, or Explorer release surface. Wiring Shop into `@pspf/contracts`, the Core storage engine, the master Explorer bundle, and the redaction/publication gates is a much larger change that should follow a working first slice rather than precede it.

## Decision

v1.15 reopens the Shop deferral from ADR 0014 with a tightly scoped **commercial planning foundation** slice that ships the Shop as a standalone VS Code extension with workspace-local JSON storage. It does not change Core, Workshop, Explorer, the master bundle, the schema/bundle/API axes, the link taxonomy, or the published Explorer schemas.

### In scope

- New extension package `packages/shop/` (`pspf-shop`, publisher `tobyharvey`, Marketplace id `tobyharvey.pspf-shop`).
- Activity bar container `pspfShop` with five views per `pspf-vscode-extension-surface-spec.md`:
  - `pspfShop.suppliersView` (Tree)
  - `pspfShop.contractsView` (Tree)
  - `pspfShop.spendView` (Tree)
  - `pspfShop.forecastView` (WebviewView)
  - `pspfShop.welcomeView` (Welcome)
- Commands under the `pspf.shop.*` prefix: `openHome`, `loadSample`, `newSupplier`, `newContract`, `newSpendItem`, `openForecast`.
- Supplier, contract, and spend-item entities captured per `pspf-entity-link-spec.md` lines 507-602, restricted to the minimum fields the first user-validation workflow needs:
  - Supplier: `id`, `name`, `supplierType`, `status`, `criticality`, optional `primaryContact`, optional `notes`.
  - Contract: `id`, `supplierId`, `title`, optional `contractRef`, `status`, optional `startsAt`/`endsAt`, optional `value.amount`/`value.currency`, optional `serviceSummary`.
  - Spend item: `id`, `title`, `spendType`, `status`, `amount`, `financialYear`, optional `forecastStartAt`/`forecastEndAt`, optional `forecastCost`, optional `expectedSavings`, optional `savingsType`, optional `paybackPeriodMonths`, optional `confidence`, optional `assumptions`, optional `notes`.
- Workspace-local JSON store at `.pspf/shop/shop.json`, written atomically by the extension. Schema is internal to the Shop extension at this slice and is versioned with a `shopStoreVersion = "1.0.0"` field independent of `VERSION_AXES`.
- Forecast WebviewView derives a simple spend forecast by financial year from current spend items (sum of `amount`, plus sum of `expectedSavings`). Derivation is computed live; no derived entity is stored.
- All free-text fields (`notes`, `assumptions`, `serviceSummary`, `primaryContact`) and all monetary fields are treated as sensitive at rest: the Shop store is workspace-local only, the extension does not write Shop content to any export, snapshot, log, or telemetry, and the forecast WebviewView renders entirely from the in-memory store without leaving the editor.

### Out of scope (deferred to a later Shop slice)

- Adding supplier/contract/spend-item entity types to `@pspf/contracts`, the Core storage engine, the Explorer master bundle, the published `schemas/explorer-bundle/` directories, or the publication-policy table.
- Bumping `VERSION_AXES` or introducing `schemas/explorer-bundle/1.8.0/`.
- Activating the commercial link verbs (`supplier has contract`, `action related-to contract`, `risk associated-with supplier`, `risk associated-with contract`) — they remain reserved in the closed 22-verb taxonomy and produce no runtime behaviour until a later slice.
- Linking Shop records to Workshop requirements, Actions, Risks, or Directions.
- Pub integration, person assignments, approvals, multi-user commercial plans.
- CSV/procurement import, finance-system reconciliation, realised-vs-expected savings tracking.
- Chart image export, forecast PDF export, or any Shop content reaching Explorer.
- Marketplace publication of `tobyharvey.pspf-shop` (this slice produces the package; publishing follows a later release readiness review).

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.15.0"`.
- `VERSION_AXES` remains at `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- No new entity type, collection, link verb, field, or published JSON Schema directory is introduced.
- Shop store schema is an internal Shop concern; its `shopStoreVersion` is independent of the three canonical axes.

## Consequences

Positive:

- Operators can begin validating the Shop user experience end-to-end against a real workspace.
- Core, Workshop, Explorer, and the existing release-readiness gates are unaffected, so the v1.14 release surface stays green while Shop iterates.
- The narrow surface area lets the next Shop slice promote entities into `@pspf/contracts`, the Core storage engine, and the published bundle with concrete operator feedback rather than speculative modelling.

Trade-offs:

- Shop data lives outside the Core SQLite-backed store and outside the master bundle for this slice, so it is not visible to Workshop, Explorer, the posture brief, or any redaction/publication check.
- The temporary internal `shopStoreVersion` will need a one-time migration into the canonical contracts/schema axes when Shop is promoted.
- The closed link taxonomy already lists commercial verbs even though they remain inert until a later slice; operators reading the taxonomy must understand that listing does not imply availability.

## Deferred

v1.15 does not add Shop-to-Core integration, Shop-to-Workshop linkage, master-bundle Shop collections, published Shop JSON Schemas, redaction policy entries for Shop fields, Marketplace publication of the Shop extension, CSV import, finance reconciliation, savings realisation tracking, chart export, Pub integration, person assignments, approvals, or any change to `VERSION_AXES`.
