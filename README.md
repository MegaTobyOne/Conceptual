# PSPF

Local-first tooling for Australian Government PSPF assurance work.

The repository currently ships PSPF v1.31.2 with Core, Workshop, Shop, Pub, and Explorer. The active compatibility axes are `schemaVersion`, `bundleVersion`, and `apiVersion` `1.11.0`.

## Products

- Core stores the workspace system of record in `.pspf/core/pspf-core.db`.
- Workshop is the operator authoring and review surface.
- Shop is the commercial planning surface for suppliers, contracts, spend items, and explainable forecasts.
- Pub is the local-first people, role, team, assignment, and stakeholder relationship surface.
- Explorer opens published master bundles and supports browser-local review/authoring round trips.

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

`release:readiness` runs the v1.31 gate chain and writes `.tmp/release-readiness/v1.31.2-readiness-report.md`.

## Current Workshop Slice

Workshop is the main operator surface for evidence-backed assessment work. Requirements, Evidence, Actions, and Risks use a consistent list-on-left/edit-panel-on-right workbench so operators can move through records without losing edit context.

Current v1.27 Workshop additions include:

- Digital CISO Magazine: a generated `OFFICIAL: Sensitive` issue for share-ready CISO communication.
- CISO Master Plan: an active roadmap view derived from Strategy, Plan of Action, Risks, Evidence, Shop dependencies, and staged initiative plans.
- Export-format direction: native slide decks and document exports should be generated from existing brief, magazine, dashboard, and plan models with the same redaction controls as Markdown, HTML, PDF, and bundle outputs.
- Roadmap initiative plans: operators can add idea/initiative work such as an AI Implementation plan with Design, Build, Verify, and Monitor stages; each stage remains editable as an Action and the case for action remains editable as Evidence.
- Plan of Action: the execution worklist for Actions, with timeline filtering and a single Today legend for the timeline marker.
- Saved views: Workshop saved views can be opened, renamed, archived, and edited so the saved filter definition can change over time.

## Manual Validation

Use the VS Code launch configurations for Core, Workshop, Shop, and the combined debug workspace. The main manual scenario is [validation-scenario-1-operator-workflow.md](validation-scenario-1-operator-workflow.md).

Open Explorer from [packages/explorer/dist/index.html](packages/explorer/dist/index.html) and load a generated `bundle.json` from `debug-workspace/.pspf/exchange/exports/`.

## Governing Docs

- Scope and release gates: [pspf-acceptance-and-quality-gates.md](pspf-acceptance-and-quality-gates.md)
- Spec ownership: [pspf-spec-consistency-index.md](pspf-spec-consistency-index.md)
- Pipeline and release flow: [pspf-developer-pipeline-spec.md](pspf-developer-pipeline-spec.md)
- ADR index: [adr/README.md](adr/README.md)

## Current Shop Slice

Shop authoring is Core-backed and can link suppliers, contracts, and spend items to assurance Requirements, Actions, and Risks. The Shop Forecast view now includes a commercial coverage dashboard for unlinked records, near-term contract review, funded Actions, and supplier Risk links. Existing local Shop JSON can be imported explicitly; procurement import, finance reconciliation, and approvals remain deferred.

## Current Pub Slice

Pub is now a Marketplace-ready local-only people and relationship surface. It provides the Activity Bar entry, Home view, Organisation Chart, Teams, People, Roles, Assignments, and Relationship Log views. v1.29 completes local detail/edit panels for Person, Role, Assignment, and Relationship Note records while keeping Pub data out of Explorer publication bundles.

## Current UX Consistency Slice

v1.29 adds the ecosystem UX coverage matrix and starts the shared relationship-manager foundation. Operator-editable relationship rules are now centralised in contracts and consumed by Shop and Workshop; Shop tree selection opens detail-first panels; Pub local records now have explicit list/detail/edit coverage decisions and local-only CRUD proof points.
