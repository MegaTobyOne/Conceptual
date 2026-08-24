# PSPF

Status: **active**

Local-first tooling for Australian Government PSPF assurance work.

The repository currently ships PSPF v1.60.0 with Core, Workshop, Assurance, Shop, Pub, and Explorer. Studio System provides compact, responsive navigation, tables, status chips, and product/domain wayfinding across the ecosystem. The active compatibility axes are `schemaVersion`, `bundleVersion`, and `apiVersion` `1.15.0`.

## Products

- Core stores the workspace system of record in `.pspf/core/pspf-core.db`.
- Workshop is the operator authoring and review surface.
- Shop is the commercial planning surface for suppliers, contracts, spend items, and explainable forecasts.
- Pub is the local-first organisation, learning, skills, development, succession, rotation, and stakeholder relationship surface.
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

`release:readiness` runs the active gate chain and writes `.tmp/release-readiness/v1.60.0-readiness-report.md`.

## Current Product Direction

The next few days are focused on the Explorer and Workshop requirement-to-action journey. The product direction is to treat Explorer as a compliance uplift tool that helps teams turn assessment outcomes into clear decisions, consistent mitigation language, and an actionable work plan rather than just a passive record of status.

Key decisions recorded for the next slice:

- Explorer is positioned as a compliance uplift tool, with the language split across a few variants such as assurance uplift, remediation workflow, and control improvement work-planning surface.
- Standardised mitigation guidance is in scope and should be built as a reusable library keyed to control families and requirement types.
- Assisted action generation is the preferred model: unresolved or risk-managed items propose draft actions, which users can accept, edit, or reject before they become tracked work.
- The ambition is to simplify after proving the pattern, not to over-automate the workflow up front.

See [docs/decision-register.md](docs/decision-register.md) and [pspf-grand-plan.md](pspf-grand-plan.md) for the operating plan and decision log.

## Current Workshop Slice

Workshop is the main operator surface for evidence-backed assessment work and the critical decision point in the compliance uplift workflow. Requirements, Evidence, Actions, and Risks use a consistent list-on-left/edit-panel-on-right workbench so operators can move through records without losing edit context.

Current v1.43 additions:

- Strategy priority inference (risk → priority → choice): strategic choices that link risks now derive a priority band (Critical, High, Medium, Low, or none) from the linked risks' severity (likelihood × impact), adjusted by the choice's trend and confidence. The Strategy Map and Strategy Editor show the band, a plain-language rationale, the top blocking risks, and repair cues for unresolved risk links. This is a derived read model only — no new schema, entity, or link verb, and `VERSION_AXES` remain `1.14.0`.

Earlier v1.42 remediation additions include:

- Explorer bundle schema `1.14.0`: adds optional lifecycle decision metadata and sensitive/default-deny evidence link context while preserving earlier schema directories.
- Workshop evidence operations: Action editors can apply tags to linked Requirements, evidence links can capture sensitive section/note context, and Evidence Review can copy a scoped evidence package by domain.
- Executive reports: the broad newsletter is now the Digital CSO Magazine, while the Digital CISO Magazine is a dark Information + Technology edition.
- Pub local ownership: roles can be archived without deleting local records, and team detail shows a compliance status summary from owned controls, owned Requirements, active roles, and assignments.
- UX and IA refinement: Workshop Home is simplified around frequent actions, the Master Dashboard is a portal with actionable decision loops, Strategy Map and ISM browsing are grouped for scanability, and tree views expose browse-panel shortcuts.
- Pub planning context: the Organisation Chart uses team cards with roles on the front and accountable Requirements, controls, and team dates on the back. Team-wide news and dates can be stored locally and optionally surfaced on the Workshop Plan of Action.

Still deferred after v1.43: Pub data is still never published to Explorer bundles; Pub team dates remain local planning context only; there is no automatic conflict resolution, calendar integration, notification engine, Pub delete/archive workflow beyond role archive, roster/performance-management workflow, or post-quantum encrypted master-bundle envelope. Post-quantum protection is a deferred decision item and must preserve the existing single master JSON bundle contract when revisited.

Recent Workshop additions include:

- Digital CISO Magazine: a generated `OFFICIAL: Sensitive` issue for share-ready CISO communication.
- CISO Master Plan: an active roadmap view derived from Strategy, Plan of Action, Risks, Evidence, Shop dependencies, and step-built initiative plans.
- Export-format direction: native slide decks and document exports should be generated from existing brief, magazine, dashboard, and plan models with the same redaction controls as Markdown, HTML, PDF, and bundle outputs.
- Roadmap initiative plans: operators can create an initiative frame, then add tasks and milestones step by step; each task or milestone remains editable as an Action and the case for action remains editable as Evidence.
- Plan of Action: the execution worklist for Actions, with timeline filtering and a single Today legend for the timeline marker.
- Saved views: Workshop saved views can be opened, renamed, archived, and edited so the saved filter definition can change over time.
- ISM controls: direct control-to-evidence/action/risk links, internal implementation posture, control-side Requirement mapping, dedicated ISM control saved views, public-safe ISM posture brief rollups, and Explorer read-only obligation navigation.
- ISM Review Workbench: operators can triage unmapped, not-assessed, drift-review, needs-direct-work, and risk-without-action source controls without adding schema-bearing state.

## Current UX Judgement-Support Slice

v1.53.0–v1.60.0 (ADRs 0087–0094) deliver a judgement-support review pass across Workshop and Explorer, following a UX review that found the ecosystem's data mostly existed but was never composed into a stated answer. Each release added one shared, tested primitive to `@pspf/contracts` and wired it into the highest-traffic surfaces:

- **Basis** (J1): every headline compliance percentage states whether it is asserted, evidenced, or evidenced-and-fresh.
- **Consequence** (J2): requirement detail and the posture brief lead with the risk consequence of not meeting a requirement, not just a percentage.
- **Blockers** (J3): a fan-in-ranked "who is blocking us, and who moves next" view, with an operator-settable override (including a `supplier` class) added via the v1.57.0 schema bump.
- **Trajectory** (J4): closure velocity and a range-with-stated-assumption projection — never an unqualified date — coupled to the current blocker count, plus a sustain-line note.
- **Reader-anchored change** (J5): Explorer anchors "what changed" to the reader's last visit rather than a fixed calendar window, with a roll-up narrative and in-situ changed-row badges; Workshop's existing reader-anchored momentum sentence now names the anchor date.
- **Supplier verdict** (J6): Shop composes a stated supplier risk verdict from criticality, open linked risk, contract-expiry proximity, and assurance coverage. Explorer publication of supplier data is deliberately deferred pending a dedicated commercial-data publication-policy ADR.

The full judgement set, scoring, and backlog live in [docs/ux-improvement-ideas.md](docs/ux-improvement-ideas.md).

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
