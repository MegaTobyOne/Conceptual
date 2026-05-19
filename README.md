# PSPF

Local-first tooling for Australian Government PSPF assurance work.

The repository currently ships PSPF v1.24.0 with Core, Workshop, Shop, and Explorer. The active compatibility axes are `schemaVersion`, `bundleVersion`, and `apiVersion` `1.10.0`.

## Products

- Core stores the workspace system of record in `.pspf/core/pspf-core.db`.
- Workshop is the operator authoring and review surface.
- Shop is the commercial planning surface for suppliers, contracts, spend items, and explainable forecasts.
- Explorer opens published master bundles and supports browser-local review/authoring round trips.
- Pub remains deferred.

## Setup

```sh
corepack enable
pnpm install
npx pnpm@10.10.0 run doctor
```

## Common Checks

```sh
npx pnpm@10.10.0 build
npx pnpm@10.10.0 typecheck
npx pnpm@10.10.0 test
npx pnpm@10.10.0 release:readiness
```

`release:readiness` runs the v1.24 gate chain and writes `.tmp/release-readiness/v1.24.0-readiness-report.md`.

## Manual Validation

Use the VS Code launch configurations for Core, Workshop, Shop, and the combined debug workspace. The main manual scenario is [validation-scenario-1-operator-workflow.md](validation-scenario-1-operator-workflow.md).

Open Explorer from [packages/explorer/dist/index.html](packages/explorer/dist/index.html) and load a generated `bundle.json` from `debug-workspace/.pspf/exchange/exports/`.

## Governing Docs

- Scope and release gates: [pspf-acceptance-and-quality-gates.md](pspf-acceptance-and-quality-gates.md)
- Spec ownership: [pspf-spec-consistency-index.md](pspf-spec-consistency-index.md)
- Pipeline and release flow: [pspf-developer-pipeline-spec.md](pspf-developer-pipeline-spec.md)
- ADR index: [adr/README.md](adr/README.md)

## Current Shop Slice

Shop authoring is Core-backed and can link suppliers, contracts, and spend items to assurance Requirements, Actions, and Risks. The Shop Forecast view now includes a commercial coverage dashboard for unlinked records, near-term contract review, funded Actions, and supplier Risk links. Existing local Shop JSON can be imported explicitly; procurement import, finance reconciliation, approvals, and Pub integration remain deferred.
