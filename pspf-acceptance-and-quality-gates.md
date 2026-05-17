# PSPF Acceptance and Quality Gates

## Purpose

This specification defines measurable acceptance criteria and release gates for PSPF v0.1 and v1. It closes the gap between descriptive design intent and verifiable delivery outcomes.

v0.1 is the **thin slice** defined in [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md). v1 remains the eventual target with the full surface in this document.

## v0.1 acceptance criteria (thin slice)

These are the only acceptance criteria for v0.1. Anything in the v1 sections below that is not also listed here is **deferred to v0.2+**.

### v0.1 release gates

A v0.1 release candidate is not eligible for publication unless all gates pass:

1. **Spine workflow gate**: a new operator can install Core+Workshop, run `Initialise PSPF Workspace`, create a Requirement, attach Evidence, take a Snapshot, export a master bundle, open it in Explorer publication mode, and copy a posture brief — without reading the docs. Verified by a Playwright end-to-end test on the standard fixture.
2. **Schema-policy gate**: every entity field declares a `publication` policy. CI fails on missing policy.
3. **Personal-data exclusion gate**: no `Person.name`, `Person.email`, `Assignment.personId`, or any field marked `restricted` appears in any output, for any profile, against the personal-data fixture.
4. **AU-English lint gate**: no US-English variant from the spelling allowlist appears in `docs/**` or extracted UI strings.
5. **Per-version schema publication gate (E23)**: hash-match between runtime validator and served schema for the active `schemaVersion`; no remote `$ref`s.
6. **Accessibility floor gate (E24)**: zero `serious`/`critical` `axe-core` findings on Explorer publication-mode primary routes against the standard fixture.
7. **Writer-lock gate**: a second VS Code window opening the same workspace is detected and degrades to read-only with the holding-window banner.
8. **Backup/restore dry-run gate**: backup procedure documented in [pspf-backup-and-restore-runbook.md](pspf-backup-and-restore-runbook.md) executes cleanly against the standard fixture and a restored copy passes `PRAGMA integrity_check` plus Core validation.

### v0.1 product scope

- Core: workspace bootstrap, SQLite system of record, snapshot create, integrity check, master-bundle export, master-bundle import (`full-replace` and `additive-merge` only), trusted-caller registry, writer lock, three version axes.
- Workshop: Requirement, Evidence, Action, Risk authoring; daily assessment loop; evidence review queue; posture brief render; shareable brief copy.
- Explorer (publication mode only): load a published bundle, browse Requirements/Evidence/Actions/Risks, posture brief view, compliance donut, Relationships Board read-only.
- Australian context: PSPF Domains as primary navigation, AU spelling, AU date/time, ASD Essential Eight on Posture, OFFICIAL: Sensitive banner.

For the deferred items see [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md).

### v0.2 candidate gates (ISM integration, per ADR 0017, ADR 0018, and ADR 0019)

These gates are not enforced in v0.1 and exist here as a forward-looking checklist for the v0.2 ISM phases described in [pspf-ism-integration-spec.md](pspf-ism-integration-spec.md):

1. **OSCAL ingest reproducibility**: regenerating the ISM source library from the same vendored OSCAL snapshot produces byte-identical `SRC-*` records.
2. **ISM provenance gate**: every `SRC-*` record carries `oscalRelease`, `catalog`, and `profile` provenance; missing provenance fails CI.
3. **No runtime egress for ISM**: build- and runtime-time checks confirm Explorer and Workshop never fetch ISM data from a network endpoint at run time.
4. **Mapping redaction gate**: `RequirementControlMapping.rationale` is treated as `sensitive` by default; bundle export tests confirm it never leaks under a `public` publication profile.
5. **Mapping survives round trip**: snapshot → export → import preserves mapping endpoints, `coverageQualifier`, and `applicabilityProfile`.
6. **ISM version-drift detection**: changing the vendored OSCAL release tag flags mappings whose underlying ISM control text has changed.

### v0.3 candidate gates (ISM mapping quality, per ADR 0020)

1. **Mapping quality field gate**: every exported mapping carries `confidence`; legacy mappings default to `medium`; optional review fields validate when present.
2. **Mapping rationale redaction gate**: `RequirementControlMapping.rationale` remains excluded from default published bundles after the v0.3 schema change.
3. **Drift status gate**: every exported source control carries `statementChangeStatus`.
4. **ISM drift gate**: `check:ism-drift` reports mappings affected by changed, new, or removed source-control statements.
5. **Mapping quality round trip**: export → import preserves `confidence`, `lastReviewedAt`, `reviewBy`, endpoints, `coverageQualifier`, and `applicabilityProfile`.

### v0.4 candidate gates (readiness and UI resilience, per ADR 0021)

1. **Explorer table layout gate**: publication smoke tests check compact labels stay single-line, title-like columns keep readable width, and dense tables use local overflow wrappers at desktop and narrow viewports.
2. **Workshop table layout gate**: Workshop webviews use the same field-aware table markup for title-like columns, compact fields, and dense tables.
3. **Compatibility stability gate**: v0.4 keeps schema, bundle, and API axes at `1.2.0`; package/product version rolls to `0.4.0` only.
4. **Readiness documentation gate**: readiness notes reflect the current v0.4 state and identify remaining v1 feature tranches explicitly.

### v0.5 candidate gates (Directions overlay and Action Impact, per ADR 0023)

1. **Directions schema gate**: `schemas/explorer-bundle/1.3.0/directions.schema.json` validates the standard fixture; `1.2.0` and earlier remain byte-identical.
2. **Directions publication gate**: published bundles include the `directions` collection with `reference`, `title`, `responseState`, optional `issuedAt`, and optional `sourceAuthority`; posture record carries `directionCount` equal to `directions.length`.
3. **Action Impact derivation gate**: e2e fixture authors at least one Direction linked to a Requirement; exported Action carries `impact.postureUplift > 0`, deterministic `urgency`, and a non-empty `explanation`.
4. **Workshop authoring gate**: `pspf.workshop.registerDirection` and `pspf.workshop.updateDirectionResponse` route through `pspf.core.upsertEntity`/`upsertEntities` and trip writer-lock, integrity, and validation gates unchanged.
5. **Compatibility gate**: schema, bundle, and API axes bump together to `1.3.0`; product version rolls to `0.5.0`.

### v0.6 candidate gates (Workshop parity for Directions and Action Impact, per ADR 0024)

1. **Dashboard parity gate**: Assessment Dashboard shows a `Directions` metric tile, four always-on response-state chips (`not-set` / `yes` / `no` / `risk-managed`), and an `Action Impact — Top 5` table sorted by total uplift descending. Counts and ranking match the values published in the Explorer bundle for the same workspace.
2. **Item Detail parity gate**: Requirement Item Detail renders `Directions Targeting This Requirement` (inbound `direction → requirement` links) and the `Actions` table includes an `urgency` column matching the export. `PSPF: Open Direction Detail` opens a read-only panel for a chosen Direction.
3. **Queue urgency gate**: Evidence Review Queue renders an `Urgent Actions (Blocked or Overdue)` table and a matching tile; values match the action-impact urgency emitted in the export.
4. **Shared algorithm gate**: `enrichActionsWithImpact` lives in `@pspf/contracts` and is the only implementation; Core and Workshop both import from `@pspf/contracts`.
5. **Compatibility gate**: schema, bundle, and API axes remain at `1.3.0`; only product version rolls to `0.6.0`. No new published-bundle field is introduced.

### v0.7 candidate gates (engine hardening, per ADR 0025)

1. **Layered Core API gate**: `packages/core/src/service.ts` exposes explicit read, write, exchange, and integrity API layer interfaces while preserving `createCoreService()` as the compatibility facade used by extensions and scripts.
2. **Integrity scan gate**: `PSPF: Run Integrity Scan` / `runIntegrityScan()` checks SQLite integrity, entity payload parseability, id/entityType consistency, link target existence/type consistency, and writer-lock state, then writes `.pspf/logs/integrity-scan.json`.
3. **Broken-link fixture gate**: `scripts/check-integrity-scan.mjs` proves a clean workspace passes and a deliberate orphaned link fails with an orphaned-link finding.
4. **Multi-window writer-lock gate**: writer-lock state declares `policy: "single-writer"`; `scripts/check-writer-lock.mjs` proves live second-window writes are blocked and stale locks recover.
5. **Compatibility gate**: schema, bundle, and API axes remain at `1.3.0`; only product version rolls to `0.7.0`. No new published-bundle field is introduced.

### v0.8 candidate gates (first-run and packaging readiness, per ADR 0026)

1. **Sample workspace gate**: `buildSampleWorkspaceEntities()` creates a privacy-safe scenario covering Requirements, Evidence, Actions, Risks, Directions, links, and an ISM mapping when source controls are available.
2. **Workshop first-run gate**: `PSPF: Open Workshop Welcome` renders an `enableScripts: false` first-run panel and `PSPF: Load Sample Workspace` writes the shared sample through Core APIs.
3. **Sample validation gate**: `scripts/check-sample-workspace.mjs` loads the sample into a clean workspace, validates counts, runs `runIntegrityScan()`, exports the bundle, and checks redaction/publication safety.
4. **Packaging rehearsal gate**: `scripts/check-package-shape.mjs` verifies Core and Workshop package manifests, command contributions, built extension entry points, and Workshop's Core extension dependency in line with ADR 0007.
5. **Compatibility gate**: schema, bundle, and API axes remain at `1.3.0`; only product version rolls to `0.8.0`. No new published-bundle field is introduced.

### v0.9 candidate gates (release-candidate freeze, per ADR 0027)

1. **Scope-freeze gate**: no new product entities, published-bundle fields, schema axes, or UI workflows are introduced beyond the v0.8 surface.
2. **Manual scenario gate**: `validation-scenario-1-operator-workflow.md` describes the current v0.9 tester path, including sample workspace load, Directions, Action Impact, integrity scan, export, Explorer review, and posture brief copy.
3. **Release-candidate consistency gate**: `scripts/check-release-candidate.mjs` verifies versions, compatibility axes, v0.9 scripts/docs, manual scenario coverage, and Shop/Pub deferral notes.
4. **Readiness-report gate**: `release:readiness` targets `e2e:v0.9`, runs all automated gates, and writes a versioned readiness report under `.tmp/release-readiness/`.
5. **Compatibility gate**: schema, bundle, and API axes remain at `1.3.0`; only product version rolls to `0.9.0`. No new published-bundle field is introduced.

### v1.0 release gates (initial assurance user testing release, per ADR 0028)

1. **Release cut gate**: v1.0 adds no new product entities, published-bundle fields, schema axes, or authoring workflows beyond v0.9. A Workshop Activity Bar Home view and PSPF version status bar item are allowed as discoverability affordances that launch existing commands.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.0.0`; schema, bundle, and API axes remain `1.3.0`.
3. **Automated spine gate**: `e2e:v1.0`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.
4. **Readiness-report gate**: `release:readiness` writes `.tmp/release-readiness/v1.0.0-readiness-report.md` with all tracked gates passing.
5. **Manual validation gate**: `validation-scenario-1-operator-workflow.md` completes without intervention and confirms Workshop Activity Bar access, status bar version context, Workshop, Explorer, posture brief, integrity scan, Directions, Action Impact, and redaction behaviour.

### v1.0.1 patch gates (validation closure and roadmap decision, per ADR 0030)

1. **Patch-scope gate**: v1.0.1 introduces no new product entities, published-bundle fields, schema axes, import semantics, or Explorer authoring workflows beyond v1.0.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.0.1`; schema, bundle, and API axes remain `1.3.0`.
3. **Manual validation record gate**: current manual validation status is recorded as clean to date in the readiness review and the validation scenario remains the active acceptance path.
4. **Roadmap decision gate**: ADR 0030 records Explorer local-authoring phase 1 as the next feature tranche: `IndexedDB`-backed user-owned compliance/status overlays with standard master-bundle export/import.
5. **Regression gate**: `e2e:v1.0`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass unchanged except for the `1.0.1` version context.

### v1.1 release gates (Explorer local-authoring phase 1, per ADR 0031)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.1.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Local persistence gate**: Explorer persists Requirement `assessmentStatus` overlays in `IndexedDB`, scoped to the loaded bundle/workspace key, and restores them when the same bundle is rendered again.
3. **Visual separation gate**: Explorer shows whether each editable status value is `local` or `from bundle`, and exposes the baseline status beside the local selector.
4. **Export gate**: Explorer exports the effective state as the existing master JSON format with `generator.product = "pspf-explorer"`, `generator.mode = "local-authoring"`, the full collection set, and no restricted personal fields.
5. **Reset/storage gate**: Explorer exposes storage status and a reset-local-data path for the phase-1 store. Local authoring data is not written to `localStorage`.
6. **Deferred-scope gate**: v1.1 does not introduce new entity types, collections, schema directories, `plan-apply`, local evidence/action/risk creation, editable posture, chart image export, Shop, or Pub.
7. **Regression gate**: `e2e:v1.1`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.2 release gates (Explorer local evidence references, per ADR 0032)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.2.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Evidence persistence gate**: Explorer persists local evidence references in `IndexedDB`, scoped to the loaded bundle/workspace key.
3. **Materialisation gate**: each local evidence reference exports as an existing `evidence` entity plus a `supported-by` `link` from the selected Requirement, both with `sourceProduct = "explorer"`.
4. **Export gate**: Explorer exports local status overlays and local evidence references through the existing master JSON bundle format with `generator.mode = "local-authoring"`, the full collection set, and no restricted personal fields.
5. **Reset/storage gate**: reset local data clears both Requirement status overlays and local evidence references; local authoring data is not written to `localStorage`.
6. **Deferred-scope gate**: v1.2 introduces no new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, local Action/Risk creation, editable posture, Shop, or Pub.
7. **Regression gate**: `e2e:v1.2`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.3 release gates (Explorer local Actions, per ADR 0033)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.3.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Action persistence gate**: Explorer persists local Actions in `IndexedDB`, scoped to the loaded bundle/workspace key.
3. **Materialisation gate**: each local Action exports as an existing `action` entity plus an `addressed-by` `link` from the selected Requirement, both with `sourceProduct = "explorer"`.
4. **Export gate**: Explorer exports local status overlays, evidence references, and Actions through the existing master JSON bundle format with `generator.mode = "local-authoring"`, the full collection set, and no restricted personal fields.
5. **Explorer-to-Workshop import gate**: a real Explorer local-authoring export imports through Core into a fresh workspace; Workshop-visible records include the local Requirement status, evidence reference, Action, and links.
6. **Reset/storage gate**: reset local data clears Requirement status overlays, local evidence references, and local Actions; local authoring data is not written to `localStorage`.
7. **Deferred-scope gate**: v1.3 introduces no new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, local Risk creation, editable posture, Shop, or Pub.
8. **Regression gate**: `e2e:v1.3`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.4 release gates (Explorer local Risks and conflicts, per ADR 0034)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.4.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Risk persistence gate**: Explorer persists local Risks in `IndexedDB`, scoped to the loaded bundle/workspace key.
3. **Materialisation gate**: each local Risk exports as an existing `risk` entity plus an `exposed-by` `link` from the selected Requirement, both with `sourceProduct = "explorer"`.
4. **Conflict display gate**: Explorer shows a local status conflict when a saved local status overlay was authored against a different baseline status than the currently loaded bundle.
5. **Export/import gate**: Explorer exports local status overlays, evidence references, Actions, and Risks through the existing master JSON bundle format; Core imports the exported bundle and Workshop-visible records include the local records and links.
6. **Reset/storage gate**: reset local data clears Requirement status overlays, local evidence references, local Actions, and local Risks; local authoring data is not written to `localStorage`.
7. **Deferred-scope gate**: v1.4 introduces no new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, tags, saved views, compliance-history export controls, editable posture, Shop, or Pub.
8. **Regression gate**: `e2e:v1.4`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.5 release gates (plan-apply import and undo, per ADR 0035)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.5.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Plan gate**: Core can build a read-only `plan-apply` import plan that validates the bundle, classifies created/updated/unchanged records, and makes no writes.
3. **Review gate**: VS Code import UI exposes `Plan, review, apply` and requires explicit `Apply Import` confirmation before writing records.
4. **Conflict summary gate**: import summaries include per-type counts, examples, and conflict/update examples for changed records.
5. **Apply gate**: confirmed `plan-apply` imports write the same Explorer local-authoring records as additive merge without changing schema axes.
6. **Undo gate**: additive and plan-applied imports create a pre-import undo snapshot, and `PSPF: Undo Last Import` restores the previous records.
7. **Deferred-scope gate**: v1.5 introduces no new entity type, collection, schema directory, compatibility-axis bump, editable posture, tags, saved views, compliance-history export controls, Shop, or Pub.
8. **Regression gate**: `e2e:v1.5`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.5.1 patch gates (Explorer product boundary and identity, per ADR 0036)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.5.1`; schema, bundle, and API axes remain `1.3.0`.
2. **Decision gate**: ADR 0036 records Workshop as the system of record and Explorer as the portable review, briefing, lightweight annotation, and round-trip suggestion surface.
3. **Identity gate**: Explorer renders a portable assurance masthead, sensitivity/browser-local trust markers, and the `Bundle baseline` / `Local changes` / `Export to Workshop` mode strip.
4. **Copy gate**: the visible Explorer local-editing section is named `Local Changes`; the bundle exchange mode remains `local-authoring` for compatibility.
5. **Refresh gate**: Explorer remembers the latest loaded bundle in browser-local `IndexedDB`, restores it after refresh, and does not retain older bundle history.
6. **Deferred-scope gate**: v1.5.1 introduces no new entity type, collection, schema directory, compatibility-axis bump, editable posture, tags, saved views, compliance-history export controls, Shop, or Pub.
7. **Regression gate**: `e2e:v1.5`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.6 release gates (Workshop import review and identity, per ADR 0037)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.6.0`; schema, bundle, and API axes remain `1.3.0`.
2. **Import review surface gate**: `Plan, review, apply` opens a `PSPF Workshop Import Review` webview before writing Explorer local JSON records.
3. **Review content gate**: the review surface shows created, updated, unchanged, and write counts, per-entity-type counts, and update/conflict examples.
4. **Decision gate**: the review surface exposes explicit `Apply Import`, `Show Details`, and `Cancel` actions; writes happen only after `Apply Import`.
5. **Undo gate**: plan-applied imports continue to create a pre-import undo snapshot and `Undo Import` restores the previous records.
6. **Workshop identity gate**: Workshop Home and shared Workshop webview panels present Workshop as the `System of record` and decision surface, visually distinct from Explorer's portable assurance view.
7. **Deferred-scope gate**: v1.6 introduces no new entity type, collection, schema directory, compatibility-axis bump, editable posture, tags, saved views, compliance-history export controls, Shop, or Pub.
8. **Regression gate**: `e2e:v1.6`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.7 release gates (Tags and filters foundation, per ADR 0041)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.7.0`; schema, bundle, and API axes are `1.4.0`; `schemas/explorer-bundle/1.4.0/` is published and immutable after release.
2. **Contract gate**: `TagEntity`, `TAG_COLOURS`, `DEFAULT_TAG_COLOUR`, `TAG_LIMITS`, `LINK_TYPES`, and publication policies match ADR 0041 and invariants T1-T5.
3. **Tag CRUD gate**: Workshop can create, edit, archive, apply, and remove tags from Requirements; normal UI flows do not hard-delete tags or orphan `tagged-with` links.
4. **Filter gate**: Workshop Requirements, Explorer Requirements, and Explorer Relationships Board expose multi-select tag filtering with `any` / `all` mode; Explorer reflects state as `tags=...&tagsMode=any|all` and persists it only in `sessionStorage`.
5. **Round-trip gate**: E2E authors one tag, applies it to a requirement, snapshots, exports, re-imports, and asserts the tag and `tagged-with` link survive intact.
6. **Bundle gate**: default Explorer bundles include `collections/tags.json` and `indexes/by-tag.json`; `indexes/by-tag.json` contains only public tag fields and sorted requirement-id lists.
7. **Redaction gate**: `Tag.description` does not appear in posture briefs, Explorer publication bundles, derived indexes, external logs, or any default export profile.
8. **Validation gate**: duplicate tag labels are hard-rejected case- and whitespace-insensitively on write and import; per-workspace and per-requirement hard limits reject with actionable diagnostics.
9. **Import review gate**: a tag-label collision with a different `id` appears in Workshop import review as kept-local/rejected by default with a link to the existing tag.
10. **Deferred-scope gate**: v1.7 does not add saved views, per-user/private tags, tag hierarchies, tag-driven posture brief sections, or tagging of Actions/Risks/Directions/Evidence.
11. **Regression gate**: `e2e:v1.7`, `check:gates`, `check:brief-redaction`, `check:explorer-publication`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.8 release gates (Saved views, per ADR 0042)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.8.0`; schema, bundle, and API axes are `1.5.0`; `schemas/explorer-bundle/1.5.0/` is published and immutable after release.
2. **Contract gate**: `SavedViewEntity`, `saved-view`, `saved-views`, `SVW`, saved-view filter enums, presentation enums, and publication policies match ADR 0042 and invariants E19/E20/E22.
3. **Explorer save/apply gate**: Explorer Requirements can save the current filter state as a named saved view, apply it later, rename it, archive it, clear the active view, and restore saved views after refresh.
4. **Session boundary gate**: transient list state remains in `sessionStorage`; saving a view copies only the ADR 0042 allowed subset into IndexedDB and local-authoring exports. Applying a saved view updates active URL/session state rather than mutating Requirements or Tags.
5. **Round-trip gate**: E2E creates a tag, applies a tag/status filter, saves a view, refreshes Explorer, reapplies the view, exports local JSON, imports through Core/Workshop, and verifies the saved view survives intact.
6. **Validation gate**: duplicate `SavedView.name` values are hard-rejected case- and whitespace-insensitively on write and import; invalid domain IDs, invalid enum values, unknown column IDs, and missing required fields reject with actionable diagnostics.
7. **Import review gate**: saved-view creates, updates, unchanged rows, and name collisions appear in Workshop import review under plan-apply with per-type counts and examples.
8. **Redaction gate**: every saved-view field declares a publication policy; the implementation explicitly resolves ADR 0042's `filters.query` publication decision before coding.
9. **Deferred-scope gate**: v1.8 does not add saved views outside Requirements, team/private saved views, default-start views, tag hierarchies, tagging non-Requirement entities, tag-driven posture brief sections, compliance-history export controls, editable posture, Shop, Pub, or chart image export.
10. **Regression gate**: `e2e:v1.8`, `check:gates`, `check:explorer-local-authoring`, `check:explorer-to-workshop-import`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.9 release gates (Saved-view expansion, per ADR 0043)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.9.0`; schema, bundle, and API axes are `1.6.0`; `schemas/explorer-bundle/1.6.0/` is published and immutable after release.
2. **Contract gate**: `SavedViewEntity` supports legacy `requirements`, `explorer-requirements`, `explorer-relationships`, `workshop-requirements`, `workshop-dashboard`, and `workshop-evidence-review` scopes; duplicate saved-view names are rejected within scope rather than globally.
3. **Explorer Relationship view gate**: Explorer Relationships Board can save, apply, rename, archive, and clear a saved view for supported search/tag filter state without capturing selected cards, expanded sections, scroll position, or transient visual state.
4. **Workshop saved-view gate**: Workshop exposes a Saved Views manager that can create, rename, archive, and apply Workshop-owned Requirement views backed by `saved-view` records with `sourceProduct = "workshop"`.
5. **Optional-consumer gate**: Workshop and Explorer may ignore unsupported saved-view scopes from imported bundles without blocking canonical assessment data import.
6. **Schema-change notice gate**: Explorer does not silently blank when a remembered browser-local bundle is incompatible with the current schema/bundle/API/product version; it shows `Reload your PSPF JSON` and asks the user to select the latest bundle.
7. **Deferred-scope gate**: v1.9 does not add private/team ownership, default-start views, compliance-history export controls, tag hierarchies, tagging non-Requirement entities, editable posture, Shop, Pub, or chart image export.
8. **Regression gate**: `e2e:v1.9`, `check:gates`, `check:explorer-local-authoring`, `check:explorer-to-workshop-import`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.10 release gates (Change-record foundation, per ADR 0044)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.10.0`; schema, bundle, and API axes are `1.7.0`; `schemas/explorer-bundle/1.7.0/` is published and immutable after release.
2. **Contract gate**: `ChangeRecordEntity` uses the `CHG` prefix, exports through `change-records`, and every field has an explicit publication policy.
3. **Link gate**: `changes` links are first-class `link` records from `change-record` to `requirement`, `action`, `risk`, `direction`, `tag`, or `saved-view`; invalid endpoints or pairs are rejected on write and import.
4. **Workshop authoring gate**: Workshop can record a significant change, link it to an affected record, list Change Records, and edit public/sensitive/restricted fields through the item editor.
5. **Explorer publication gate**: Explorer renders a read-only "Why This Changed" view using public Change Record fields and affected `changes` links.
6. **Redaction gate**: `reason` and `impactSummary` are redacted from publication by default; `decisionOwnerRef` is restricted and never exported.
7. **Deferred-scope gate**: v1.10 does not add Explorer-authored Change Records, diff views, change-record tagging, plan baselines, Shop, Pub, editable posture, or chart image export.
8. **Regression gate**: `build`, `typecheck`, `lint`, `check:gates`, `validate:debug-workspace`, and `release:readiness` pass.

### v1.11 release gates (Explorer change story, per ADR 0045)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.11.0`; schema, bundle, and API axes remain `1.7.0`; no `schemas/explorer-bundle/1.8.0/` directory is introduced.
2. **Explorer local proposal gate**: Explorer persists local Change Record proposals in `IndexedDB`, scoped to the loaded bundle key, and restores them with the same remembered-bundle flow as status overlays, evidence references, Actions, Risks, and saved views.
3. **Materialisation gate**: each local proposal exports as an existing `change-record` entity plus a `changes` link from that Change Record to the affected Requirement, Action, Risk, Direction, Tag, or Saved View, both with `sourceProduct = "explorer"`.
4. **Export consistency gate**: Explorer local-authoring export includes `collections/change-records.json` in the manifest, updates `posture.changeRecordCount`, and keeps `generator.product = "pspf-explorer"` and `generator.mode = "local-authoring"`.
5. **Workshop round-trip gate**: a real Explorer local-authoring export imports through Core plan-apply; Workshop import review counts the proposed Change Records and `changes` links, Apply Import writes them, Undo Import removes them, and affected Requirement edit screens show the imported changes without reopening stale state.
6. **Brief and Overview gate**: Explorer Overview and the shared posture brief include a significant-change summary using public Change Record fields and affected-record titles.
7. **Redaction gate**: Explorer local proposals and posture briefs do not expose `reason`, `impactSummary`, or `decisionOwnerRef` in default publication or copy output; `decisionOwnerRef` remains Workshop-only.
8. **Reset/storage gate**: reset local data clears local Change Record proposals together with other Explorer local-authoring data; local proposals are not written to `localStorage`.
9. **Deferred-scope gate**: v1.11 does not add before/after diff views, automatic field-level history, change-record tagging, approvals, plan baselines, compliance-history export controls, editable posture, Shop, Pub, chart image export, or a separate PSPF Plan product.
10. **Regression gate**: `e2e:v1.11`, `check:gates`, `check:explorer-local-authoring`, `check:explorer-to-workshop-import`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.12 release gates (Planning lens, per ADR 0046)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.12.0`; schema, bundle, and API axes remain `1.7.0`; no new schema directory is introduced.
2. **Workshop saved-view gate**: Workshop Saved Views can create, rename, archive, and apply `workshop-dashboard` and `workshop-evidence-review` scopes as planning filters over existing Requirement, Evidence, Action, Risk, and Change Record data.
3. **Dashboard planning gate**: applying a Dashboard saved view opens a planning dashboard slice with filtered Requirements, open Actions, open Risks, and recent Change Records.
4. **Evidence planning gate**: applying an Evidence Review saved view opens a filtered evidence review slice with missing-evidence and linked-evidence-needing-review lists.
5. **Explorer Plan Lens gate**: Explorer renders a read-only `Plan Lens` section with open Actions, open Risks, active/proposed Change Records, Directions needing attention, and a compact Overview planning count.
6. **No-new-model gate**: v1.12 does not add plan-baseline snapshots, milestone entities, resource entities, budget entities, approval workflows, or a PSPF Plan package.
7. **Regression gate**: `e2e:v1.12`, `check:gates`, `check:explorer-publication`, `check:explorer-local-authoring`, `check:explorer-to-workshop-import`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.13 release gates (Release assurance, per ADR 0047)

1. **Dry-run visibility gate**: Marketplace workflow run names and job summaries include the selected target and `dry_run` value.
2. **Dry-run non-publication gate**: when `dry_run=true`, Core and Workshop publish jobs state that `vsce publish`, GitHub release creation, and receipt-tag creation were skipped.
3. **Real-publish verification gate**: when `dry_run=false`, each published extension verifies the expected public Marketplace version through the Gallery API before the release is announced.
4. **Receipt-tag gate**: receipt tags remain post-publish artefacts only; a green dry run must not create `core/<version>` or `workshop/<version>` tags.
5. **Status-documentation gate**: README, ecosystem page, and release guidance distinguish repository slice version, packaged VSIX version, Marketplace-listed extension version, and Explorer web publication state.
6. **No-new-model gate**: v1.13 does not add product entities, bundle collections, schema directories, Open VSX publishing, Shop, Pub, editable posture, plan baselines, or compliance-history export controls.
7. **Regression gate**: `e2e:v1.13`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.0 reference-data baseline candidate gates (per ADR 0029)

These gates apply only if v1.0 scope is reopened to ship real PSPF and ISM reference data rather than the existing sample-oriented seed data.

1. **Source integrity gate**: PSPF and ISM source files match recorded source URLs and SHA-256 hashes.
2. **PSPF extraction gate**: PSPF Release 2025 mandatory requirements extract every displayed source row; the current April 2026 PDF yields 217 displayed rows across the 1 through 218 numbering range, with no duplicates and the missing requirement `113` source anomaly recorded.
3. **PSPF domain gate**: the baseline contains exactly the six PSPF Release 2025 domain families: `GOV`, `RISK`, `INFO`, `TECH`, `PER`, and `PHYS`.
4. **Metadata completeness gate**: every PSPF requirement carries statement, section, applicability, start date, release decision, question type, mandatory flag, scored flag, source, licence, and attribution.
5. **ISM OSCAL gate**: the generated ISM source library is reproducible from vendored `v2026.03.24` OSCAL master-catalogue files and carries required provenance.
6. **Mapping gate**: every PSPF-to-ISM mapping is human-reviewable, has confidence/provenance, and references existing PSPF and ISM endpoints.
7. **No-runtime-egress gate**: Core, Workshop, and Explorer do not fetch PSPF or ISM reference data at runtime.
8. **Attribution and redaction gate**: source-text surfaces show required attribution, every new field has publication policy, and redaction gates still pass.

`check:reference-data-baseline` is part of both `check:gates` and `e2e:v1.0` for the implemented v1.0 baseline.

## v1 release gates

A v1 release candidate is not eligible for publication unless all gates pass:

1. Contract gate: API and schema contract tests pass.
2. Data integrity gate: migration tests and integrity checks pass.
3. Workflow gate: critical user workflows pass in Core, Workshop, Shop, Pub, and Explorer.
4. Security gate: redaction and secrets handling checks pass.
5. Accessibility gate: automated `axe-core` scan in CI passes with zero `serious` or `critical` findings on Explorer and on every Core/Workshop/Shop/Pub webview; manual keyboard, focus, and zoom checks pass for the same surfaces.
6. Operational gate: backup and restore dry-run checks pass on representative fixtures.
7. Privacy gate: bundle-export tests confirm no `Person.name`, `Person.email`, `Assignment.personId`, or any field marked `restricted` appears in any output, for any profile, against the personal-data fixture.
8. Schema-policy gate: every entity field declares a `publication` policy. CI fails with no override on missing policy.
9. AU-English lint gate: no US-English variant from the spelling allowlist appears in user-facing copy.

## Core acceptance criteria

1. Workspace initialisation creates canonical `.pspf` layout with no missing required paths.
2. Health view reports trust state, schema compatibility, and integrity summary. (v0.1: surfaced through `pspf.core.validateWorkspace`, `pspf.core.verifyIntegrity`, and `pspf.core.showWriterLock`; the unified Health view arrives in v0.2 — see [pspf-development-readiness-review.md](pspf-development-readiness-review.md) § Remaining readiness risks.)
3. `Validate Workspace` and `Verify Integrity` commands return structured diagnostics with severity and remediation hints.
4. Snapshot and export operations produce traceable artefacts and operation records.
5. Startup behaviour does not run destructive operations without explicit command or approved safe migration logic.

## Workshop acceptance criteria

1. User can create and update Requirement, Evidence, Action, and Risk records without direct DB edits.
2. User can create and inspect at least these links: requirement-evidence, requirement-action, action-risk.
3. Readiness validation flags missing required evidence and stale or inconsistent states.
4. Detail and tree views remain synchronized after create, update, and link operations.
5. Diagnostics presented to user include stable code, severity, and next-step guidance.
6. User can complete the daily assessment workflow: find a requirement or group, review statement/guidance/links, update assessment/readiness/evidence state, link or create evidence, and see overall/domain/Essential Eight posture update.
7. Evidence review queues classify old, incomplete, changed, unverified, missing, and unlinked evidence, group by domain, filter by one or more requirements, and rank by downstream impact.
8. Action Impact ranking shows highest-impact actions for requirement, domain, overall, Essential Eight, and Direction scopes, with visible explanations for every ranked action.
9. User can add a Direction, link affected requirements/domains, assess response state, link evidence/actions/risks, and see Direction response reflected in posture and action-impact summaries.
10. Summary or report-prep output can produce a simple posture brief covering overall, domain, and Essential Eight posture plus a data/evidence-backed action plan.
11. User can copy a shareable brief for a requirement, requirement group, domain, Essential Eight scope, or Direction that remains readable when pasted into email or Teams and excludes restricted or unapproved sensitive fields.

## Shop acceptance criteria

1. User can create/update Supplier, Contract, and Spend item records via Core API.
2. User can create supplier-contract and contract-requirement links.
3. Shop operations fail safely with clear compatibility message when Core API/schema mismatch is detected.
4. User can create spend forecasts showing planned/committed spend, proposed spend, expected savings, net benefit, payback period, confidence, and assumptions.
5. User can identify invest-now-save-later opportunities ranked by expected savings, payback, linked Action Impact, risk reduction, contract optimisation, and confidence.
6. Forecast and savings views remain traceable to suppliers, contracts, spend items, actions, requirements, and risks.

## Pub acceptance criteria

1. User can create/update Person, Role, Team, and Assignment records via Core API.
2. User can create person-team and assignment-target links.
3. Pub operations fail safely with clear compatibility message when Core API/schema mismatch is detected.

## Explorer acceptance criteria

1. Explorer loads valid export bundle and presents overview KPIs and list pages.
2. URL state preserves filters and drill-down navigation context.
3. Bundle incompatibility is surfaced with a user-readable warning and no silent corruption.
4. Keyboard-only navigation is possible across primary navigation, filters, tables, and detail transitions.
5. At 200% zoom, primary pages remain usable without loss of core information.
6. Evidence review supports domain scope and one-or-more requirement scope, and classifies old, incomplete, changed, unverified, missing, and unlinked evidence consistently with Core/Workshop.
7. Directions can be registered, linked to affected requirements/domains, assessed with the Direction response set, evidenced, and included in posture/action-plan outputs.
8. Relationships Board and relevant list views can sort or filter by explainable Action Impact.
9. Posture brief output includes overall, domain, and Essential Eight posture, evidence confidence signals, Direction response state, and top actions with traceable supporting facts.
10. Shareable work brief output can be copied as plain text and Markdown, remains readable when pasted into email or Teams, and applies bundle-equivalent redaction and personal-data exclusions.
11. Explorer provides simple shareable graphics for compliance status donut, action timeline/Gantt-lite, grouped action checklist, and risk impact/likelihood matrix, each with copy/save image, copy summary, and table alternative.
12. Shareable chart image exports include title, scope, generated-at time, active filters, source/freshness caveat, and required classification marking, and exclude restricted or unapproved sensitive fields.
13. When Shop forecast data is included in a bundle, Explorer can show consumer-friendly forecast spend, expected savings, net benefit, payback, and top savings-opportunity graphics with table alternatives and redaction controls.

## Performance targets for v1

These are baseline targets measured on the **reference machine** defined in `pspf-performance-profile-and-benchmarks.md` (Apple Silicon, 16 GB RAM, SSD, no other foreground load). They MUST be validated with the standard fixture against that profile in CI on every release.

1. Core startup health check visible in under 3 seconds for a standard workspace.
2. Requirement list load in under 2 seconds for 5,000 requirements.
3. Snapshot export completes in under 30 seconds for 50,000 total records.
4. Explorer initial render under 3 seconds for the standard bundle size profile.
5. Bundle import rejects out-of-limit bundles in under 1 second (no full parse before limit check).

## Test fixture profiles

Define and maintain at least these fixture profiles:

1. Minimal workspace.
2. Standard workspace.
3. Large workspace.
4. Migration-needed workspace.
5. Broken-link workspace.
6. Daily-assessment workspace with requirements, guidance, evidence, actions, risks, Directions, and posture before/after expectations.
7. Evidence-review workspace with old, incomplete, changed, unverified, missing, and unlinked evidence across multiple domains.
8. Action-impact workspace with actions affecting requirement, domain, overall, Essential Eight, and Direction scopes.
9. Shop-forecast workspace with suppliers, contracts, spend items, savings assumptions, linked actions, linked requirements, and linked risks.

## Evidence required at release

A release must include:

1. Contract test report.
2. Migration test report.
3. Workflow smoke test report.
4. Security/redaction verification report.
5. Accessibility check report.
6. Backup/restore dry-run report.
7. Trusted-caller authorisation verification report.
8. Contract compatibility matrix report.
9. Secrets rotation status and incident drill record.
10. Performance benchmark report with threshold pass/fail outcomes.
