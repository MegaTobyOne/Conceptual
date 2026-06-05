# PSPF

Local-first tooling for Australian Government PSPF assurance work.

The repository currently ships PSPF v1.41.0 with Core, Workshop, Shop, Pub, and Explorer. The active compatibility axes are `schemaVersion`, `bundleVersion`, and `apiVersion` `1.14.0`.

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

`release:readiness` runs the active gate chain and writes `.tmp/release-readiness/v1.41.0-readiness-report.md`.

## Current Workshop Slice

Workshop is the main operator surface for evidence-backed assessment work. Requirements, Evidence, Actions, and Risks use a consistent list-on-left/edit-panel-on-right workbench so operators can move through records without losing edit context.

Current v1.41 additions include:

- Explorer bundle schema `1.14.0`: adds optional lifecycle decision metadata and sensitive/default-deny evidence link context while preserving earlier schema directories.
- Workshop evidence operations: Action editors can apply tags to linked Requirements, evidence links can capture sensitive section/note context, and Evidence Review can copy a scoped evidence package by domain.
- Executive reports: the broad newsletter is now the Digital CSO Magazine, while the Digital CISO Magazine is a dark Information + Technology edition.
- Pub local ownership: roles can be archived without deleting local records, and team detail shows a compliance status summary from owned controls, owned Requirements, active roles, and assignments.
- UX and IA refinement: Workshop Home is simplified around frequent actions, the Master Dashboard is a portal with actionable decision loops, Strategy Map and ISM browsing are grouped for scanability, and tree views expose browse-panel shortcuts.
- Pub planning context: the Organisation Chart uses team cards with roles on the front and accountable Requirements, controls, and team dates on the back. Team-wide news and dates can be stored locally and optionally surfaced on the Workshop Plan of Action.

Not implemented in v1.41: Pub data is still never published to Explorer bundles; Pub team dates remain local planning context only; there is no automatic conflict resolution, calendar integration, notification engine, Pub delete/archive workflow beyond role archive, roster/performance-management workflow, or post-quantum encrypted master-bundle envelope. Post-quantum protection is a deferred decision item and must preserve the existing single master JSON bundle contract when revisited.

Recent Workshop additions include:

- Digital CISO Magazine: a generated `OFFICIAL: Sensitive` issue for share-ready CISO communication.
- CISO Master Plan: an active roadmap view derived from Strategy, Plan of Action, Risks, Evidence, Shop dependencies, and step-built initiative plans.
- Export-format direction: native slide decks and document exports should be generated from existing brief, magazine, dashboard, and plan models with the same redaction controls as Markdown, HTML, PDF, and bundle outputs.
- Roadmap initiative plans: operators can create an initiative frame, then add tasks and milestones step by step; each task or milestone remains editable as an Action and the case for action remains editable as Evidence.
- Plan of Action: the execution worklist for Actions, with timeline filtering and a single Today legend for the timeline marker.
- Saved views: Workshop saved views can be opened, renamed, archived, and edited so the saved filter definition can change over time.
- ISM controls: direct control-to-evidence/action/risk links, internal implementation posture, control-side Requirement mapping, dedicated ISM control saved views, public-safe ISM posture brief rollups, and Explorer read-only obligation navigation.
- ISM Review Workbench: operators can triage unmapped, not-assessed, drift-review, needs-direct-work, and risk-without-action source controls without adding schema-bearing state.

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

Pub is now a Marketplace-ready local-only people and relationship surface. It provides the Activity Bar entry, Home view, Organisation Chart, Teams, People, Roles, Assignments, and Relationship Log views. v1.41 adds team-card Organisation Chart backs for accountable Requirements/controls and local team-wide news/date items that can optionally appear on the Workshop Plan of Action. Pub data still stays out of Explorer publication bundles.

## Current UX Consistency Slice

v1.29 adds the ecosystem UX coverage matrix and starts the shared relationship-manager foundation. Operator-editable relationship rules are now centralised in contracts and consumed by Shop and Workshop; Shop tree selection opens detail-first panels; Pub local records now have explicit list/detail/edit coverage decisions and local-only CRUD proof points.
