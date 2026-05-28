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

### v1.14 release gates (Compliance history export controls, per ADR 0048)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.14.0`; schema, bundle, and API axes remain `1.7.0`; no new schema directory is introduced.
2. **Export toggle gate**: Explorer Local Changes exposes an `Include compliance history` toggle near `Export local JSON`; it defaults on and is visibly scoped to the next export.
3. **History-included gate**: when the toggle is on, Explorer local-authoring export includes the existing `compliance-events` collection and manifest entry when local compliance events are present.
4. **History-excluded gate**: when the toggle is off, Explorer local-authoring export omits `compliance-events` from both `collections` and `manifest.collections` while preserving current-state Requirements and assessment entries.
5. **Import tolerance gate**: Core/Workshop import accepts local-authoring bundles that intentionally omit `compliance-events`.
6. **Privacy/redaction gate**: personal-data exclusion and default-deny publication gates still pass for both history-included and history-excluded exports.
7. **Deferred-scope gate**: v1.14 does not add local history pruning, age-based retention filters, automatic retention windows, signed audit attestations, before/after diff views, change-record tagging, editable posture, Shop, Pub, chart image export, plan baselines, Open VSX publishing, or a separate release channel.
8. **Regression gate**: `e2e:v1.14`, `check:gates`, `check:explorer-local-authoring`, `check:explorer-to-workshop-import`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.16 release gates (Shop canonical commercial entities, per ADR 0051)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.16.0`; schema, bundle, and API axes are `1.8.0`; `schemas/explorer-bundle/1.8.0/` exists and earlier schema directories remain immutable.
2. **Contracts gate**: `@pspf/contracts` defines `supplier`, `contract`, and `spend-item` entity types, collections, ID prefixes, TypeScript interfaces, and default-deny publication policies.
3. **Core collection gate**: Core can count, import, export, and include redacted `suppliers`, `contracts`, and `spend-items` collections through the existing collection-driven bundle pipeline.
4. **Schema gate**: `check:schema-coverage` and `check:schema-policy` pass for the v1.8.0 schemas, including the new commercial collection schemas.
5. **Shop compatibility gate**: Shop uses the shared commercial entity types and normalises v1.15 local records into the v1.16 canonical local store shape.
6. **Privacy/redaction gate**: supplier contact data is restricted, commercial notes and monetary fields are sensitive, and personal-data exclusion remains green.
7. **Deferred-scope gate**: v1.16 does not add Shop-to-Workshop linking UI, editable Explorer commercial views, CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, chart/PDF export, Pub integration, approvals, multi-user commercial plans, or Marketplace publication of Shop.
8. **Regression gate**: `e2e:v1.16`, `check:gates`, `check:schema-coverage`, `check:schema-policy`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.17 release gates (Shop Core-backed authoring, per ADR 0052)

1. **ADR gate**: ADR 0052 records the Shop Core-backed authoring decision before implementation starts.
2. **Core-backed store gate**: Shop creates, edits, lists, and deletes supplier, contract, and spend-item records through Core APIs rather than treating `.pspf/shop/shop.json` as the active system of record.
3. **Compatibility import gate**: operators can explicitly import or sync existing v1.15/v1.16 `.pspf/shop/shop.json` records into Core-backed commercial collections without silently overwriting canonical Core data.
4. **Validation status gate**: Shop shows commercial record validation and publishability status using the canonical contracts and publication policy.
5. **Export visibility gate**: Core snapshots and Explorer master bundles include redacted commercial collections after Shop writes them through Core.
6. **Deferred-scope gate**: v1.17 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, chart/PDF export, multi-user commercial plans, or Marketplace publication of Shop.
7. **Regression gate**: `e2e:v1.17`, `check:gates`, `check:schema-coverage`, `check:schema-policy`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.18 candidate gates (Shop assurance linkage and identity, per ADR 0053)

1. **ADR gate**: ADR 0053 records the Shop assurance-linkage and visual-identity decision before implementation starts.
2. **Commercial link gate**: Shop can create only the permitted commercial links from the closed taxonomy: `supplier supports requirement`, `supplier associated-with risk`, `contract supports requirement`, `contract funds spend-item`, `spend-item supports action`, and `spend-item supports requirement`.
3. **Picker validation gate**: Shop link pickers propose only existing active Core records with valid endpoint types and reject missing, deleted, or mistyped endpoints before writing through Core.
4. **Workshop context gate**: Workshop Requirement, Action, and Risk detail surfaces show compact linked commercial context without exposing sensitive notes, assumptions, primary contacts, or monetary fields inappropriately.
5. **Explorer relationship gate**: exported bundles carry the commercial links as normal `relationships`/`links`, and Explorer Relationships Board can display them using redacted commercial records.
6. **Shop identity gate**: Shop Home/Forecast uses a distinct commercial-planning visual treatment: procurement amber/teal accents, obligation/funding/savings/payback language, linked-assurance coverage, and labelled status cues that do not rely on colour alone.
7. **Deferred-scope gate**: v1.18 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, chart/PDF export, multi-user commercial plans, Marketplace publication of Shop, or new compatibility axes.
8. **Regression gate**: `e2e:v1.18`, `check:gates`, `check:schema-coverage`, `check:schema-policy`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.19 candidate gates (Shop commercial coverage dashboard, per ADR 0054)

1. **ADR gate**: ADR 0054 records the Shop commercial coverage dashboard decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.19.0`; schema, bundle, and API axes remain `1.8.0`; no new schema directory is introduced.
3. **Coverage metric gate**: Shop Home/Forecast shows linked and unlinked coverage counts for suppliers, contracts, and spend items using only active Core records and existing links.
4. **Renewal-risk gate**: Shop identifies contracts ending within the configured near-term review window without adding new contract fields or schema axes.
5. **Funded-action gate**: Shop identifies spend items linked to open, blocked, or overdue Actions through existing `spend-item supports action` links.
6. **Supplier-risk gate**: Shop identifies suppliers associated with high-risk or open Risk records through existing `supplier associated-with risk` links.
7. **Quick-action gate**: coverage cards or rows route operators to the existing v1.18 link commands rather than introducing duplicate linking flows.
8. **Privacy/redaction gate**: coverage and Workshop context surfaces do not expose supplier `primaryContact`, commercial notes, assumptions, service summaries, or monetary values where publication policy excludes them.
9. **Marketplace workflow gate**: CI and Marketplace release workflows package and dry-run Shop as a first-class VSIX target alongside Core and Workshop; dry runs remain visibly non-publishing.
10. **Deferred-scope gate**: v1.19 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, chart/PDF export, multi-user commercial plans, new commercial entity fields, or new compatibility axes.
11. **Regression gate**: `e2e:v1.19`, `check:gates`, `check:schema-coverage`, `check:schema-policy`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.20 candidate gates (Connected View, per ADR 0055)

1. **ADR gate**: ADR 0055 records the Connected View decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.20.0`; schema, bundle, and API axes remain `1.8.0`; no new schema directory is introduced.
3. **Renderer-package gate**: a new `@pspf/connected-view` package exports a pure `buildConnectedViewModel`, a pure HTML renderer, and a single browser enhancer script; the package has no Workshop or Explorer runtime dependencies and no new entity types, fields, or link verbs.
4. **Workshop surface gate**: Workshop registers `pspf.workshop.openConnectedView`, exposes a Home-screen button and left-panel title action, and opens the Connected View in the rich domain-grouped layout (Requirements split per `Requirement.domain`).
5. **Explorer surface gate**: Explorer renders a `connected-view` section after the Relationships Board in the compact three-lane layout (Directions, grouped Requirements, Risks, single Actions lane).
6. **Selection gate**: clicking a card highlights its transitive connected chain; related Requirement cards in the chain receive a distinct visual emphasis; Cmd/Ctrl/Shift-click adds to selection; clicking the sole selected card clears it; Enter/Space replicate the click; double-click opens entity detail through the existing `openEntity` handler.
7. **Edge and refresh gate**: edges are drawn as neutral SVG bezier curves between card edges; only the highlighted chain uses the accent colour; edges redraw on resize; the toolbar exposes `Clear selection` and `Refresh`, with Workshop refresh re-rendering from current workspace state and Explorer refresh reloading the static page.
8. **Hover-details and redaction gate**: cards show only short reference and title by default; hover/focus details surface only short references, titles, domain codes, assessment status, action status, action impact urgency, risk likelihood/impact, direction response state, and direct linked neighbours; no restricted fields, free text, contact data, or personnel data are emitted.
9. **Connector geometry gate**: shared Connected View browser tests render both Workshop and Explorer layouts, toggle between grouped and compact lanes, apply zoom controls, and assert every SVG connector starts and ends on the visible source and target card edge.
10. **Deferred-scope gate**: v1.20 does not add an editable Connected View, drag-to-link, edge filtering, impact-weighted layout, ISM control overlays, image/PDF export, multi-user cursors, or any new entity types, fields, link verbs, or compatibility axes.
11. **Regression gate**: `e2e:v1.20`, `check:gates`, `check:schema-coverage`, `check:schema-policy`, `validate:debug-workspace`, `lint`, and `check:release-candidate` pass.

### v1.20.1 patch gates (Explorer Connected View hotfix, per ADR 0056)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.20.1`; schema, bundle, and API axes remain `1.8.0`; no new schema directory is introduced.
2. **Explorer Connected View regression gate**: `check:explorer-publication` renders a linked Direction -> Requirement -> Risk -> Action chain, verifies cards and SVG edges, selects a Requirement, and confirms the connected chain receives selection/highlight classes.
3. **Explorer local-count refresh gate**: `check:explorer-publication` adds a local Explorer Action, verifies the Overview Action count increments, and verifies the new local Action and edge appear in Connected View.
4. **Deferred-scope gate**: v1.20.1 remains a patch release; it does not add editable Connected View, drag-to-link, edge filtering, impact-weighted layout, ISM overlays, image/PDF export, new entity types, new fields, new link verbs, or compatibility-axis changes.

### v1.21 candidate gates (Shop forecast and management visibility, per ADR 0057)

1. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.21.0`; schema, bundle, and API axes remain `1.8.0`; no new schema directory is introduced.
2. **Monthly forecast gate**: Shop Forecast renders forecast spend by month and by financial year from existing Spend Items, excludes `spent` and `cancelled` spend items from forecast totals, and does not present Actuals.
3. **Planned savings gate**: Shop Forecast renders a planned savings schedule from `expectedSavings`, forecast dates, saving type, confidence, and linked Contract context; annual planned efficiency dividends consolidate those savings by financial year.
4. **Simple reporting gate**: Shop Forecast exposes CSV and Excel-compatible `.xls` table exports for monthly forecast, FY forecast, planned savings schedule, and annual planned efficiency dividends.
5. **Supplier management gate**: every Supplier appears with a lightweight performance measure, contract-management signal, and FOCI check prompt.
6. **Contract artefact gate**: every Contract appears with CPR/Finance source links for value for money, procurement risk, contract management, contract negotiations, accountability/transparency, and supplier conduct artefacts.
7. **System-of-record boundary gate**: Shop copy states that Shop is a commercial planning view, not the contract system of record; v1.21 does not add document storage, new entity types, new fields, new link verbs, or compatibility-axis changes.
8. **Regression gate**: `check:shop-coverage-dashboard`, `check:release-candidate`, `lint`, and `typecheck` pass.

### v1.22 candidate gates (Operator input assistance and review polish, per ADR 0058)

1. **ADR gate**: ADR 0058 records the operator-input assistance and review-polish decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.22.0`; schema, bundle, and API axes remain `1.8.0`; no new schema directory is introduced.
3. **Relative due-date gate**: Workshop Action create/edit accepts `today` in the due-date field and stores the resolved local calendar date as the existing short AU date string, not the relative word.
4. **Prompt visibility gate**: the visible Action due-date prompt and editor placeholder advertise `today` alongside an explicit AU date example.
5. **Export stability gate**: Core records, Explorer bundles, and posture briefs never emit raw relative date tokens for Action due dates after Workshop normalisation.
6. **Explorer Connected View gate**: Explorer opens Connected View to a usable board by default, renders a linked Direction -> Requirement -> Risk -> Action chain with SVG edges, and surfaces a clear message if the shared Connected View script cannot initialise.
7. **Saved Views usability gate**: Workshop Saved Views manager shows active/archived counts, exposes an explicit Open view action for active views, and refreshes the manager after create, rename, or archive operations.
8. **Workshop navigation gate**: Workshop Home exposes Requirements, Evidence, Actions, and Risks browse buttons that open list panels with Open actions and refresh without losing the panel.
9. **Backup JSON gate**: export/import copy and runbook guidance explain that exported master JSON can be used as a restore-oriented backup only through the existing validated import review and undo path.
10. **Deferred-scope gate**: v1.22 does not add Connected View zoom/lane controls, selected-card repositioning, Shop spend-linking cues, broad natural-language date parsing, reminders, recurring actions, notifications, calendars, approvals, Pub assignment workflows, editable Explorer commercial views, chart/PDF export, office/cost-centre fields, new entity types, new fields, new link verbs, or compatibility-axis changes.
11. **Regression gate**: `check:explorer-publication`, `check:release-candidate`, `lint`, `typecheck`, and Workshop unit tests pass.

### v1.23 candidate gates (Connected View controls and commercial planning polish, per ADR 0059)

1. **ADR gate**: ADR 0059 records the Connected View controls and commercial-planning polish decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.23.0`; schema, bundle, and API axes are `1.9.0` because the optional spend-item `costCentre` field is accepted.
3. **Connected View controls gate**: Explorer Connected View exposes zoom in, zoom out, reset, and lane visibility controls that preserve keyboard access and relationship highlighting.
4. **Selected-chain gate**: selecting a Connected View card scrolls the first selected or highlighted card into view and makes the connected chain visually easier to find without changing link semantics.
5. **Shared-boundary gate**: v1.23 records whether graph controls remain Explorer-shell behaviour or move into `@pspf/connected-view` for Workshop reuse; relationship model, redaction, and selection semantics remain shared.
6. **Spend-linking gate**: Shop highlights spend items that lack an existing `contract funds spend-item` link and routes operators to the existing commercial-link flow.
7. **Cost-centre field gate**: v1.23 adds optional `SpendItemEntity.costCentre` text with sensitive publication policy, `schemas/explorer-bundle/1.9.0` publication coverage that excludes the sensitive field, Shop create/edit support, CSV/XLS export columns, and a `pspf.shop.defaultCostCentre` setting used only for new spend-item defaults.
8. **Deferred-scope gate**: v1.23 does not add editable Connected View, drag-to-link, new graph link verbs, reminders, recurring actions, notifications, calendars, approvals, Pub assignment workflows, editable Explorer commercial views, chart/PDF export, or new commercial workflow states.
9. **Regression gate**: `check:explorer-publication`, `check:shop-coverage-dashboard`, `check:release-candidate`, `lint`, and `typecheck` pass.

### v1.24 candidate gates (Workshop Cyber Strategy Map, per ADR 0060)

1. **ADR gate**: ADR 0060 records the Workshop Cyber Strategy Map decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.24.2`; schema, bundle, and API axes are `1.10.0` because the canonical `Strategy` entity is implemented.
3. **Strategy entity gate**: v1.24 introduces one canonical workspace strategy entity with nested strategic choices, outcomes, posture measures, and publication policies for every field.
4. **Hierarchy cap gate**: the model supports only Strategy -> Strategic choice -> Outcome -> Measure or linked existing record in the first slice; deeper nesting is rejected or deferred.
5. **Traceability gate**: strategic choices and outcomes can reference existing Requirements, Risks, Actions, and Directions through validated inline references; missing or wrong-type references fail validation.
6. **Posture-measure gate**: outcome measures capture baseline, target, current value, trend, confidence, and review cadence; capability outcomes are the strategic frame and Essential Eight maturity is one posture evidence set.
7. **Workshop strategy-map gate**: Workshop exposes a Leadership Strategy Map with 3 to 6 strategic choices, outcome summaries, posture gaps, trends, confidence, linked blockers, and linked work.
8. **Working-view gate**: Workshop provides a focused editing view for one strategic choice, its outcomes, measures, rationale, and links without duplicating Action management.
9. **Explorer executive-view gate**: Explorer publishes a sanitised executive strategy view that excludes sensitive rationale, assumptions, constraints, detailed measures, and non-public commentary by default.
10. **Deferred-scope gate**: v1.24 does not add multiple strategy records, standalone strategy-choice entities, Connected View strategy nodes, PMO scheduling, approvals, reminders, calendars, finance reconciliation, Shop workflow changes, or Explorer strategy editing.
11. **Regression gate**: `check:schema-policy`, `check:schema-coverage`, `check:explorer-publication`, `check:release-candidate`, `lint`, and `typecheck` pass.

### v1.25 candidate gates (Workshop operational dashboards, per ADR 0061)

1. **ADR gate**: ADR 0061 records the Workshop operational dashboards decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.25.0`; schema, bundle, and API axes remain `1.10.0`; no new schema directory is introduced.
3. **Master Dashboard gate**: Workshop presents the Data -> Decisions -> PSPF Artefacts -> Measurable Uplift operating spine without extension-file clutter, and keeps N/A requirements excluded from compliance/evidence metrics by default.
4. **Plan of Action grounding gate**: the Plan of Action board supports Action start/end dates, status filtering, impact context, and a Today marker that anchors the timeline to the current date.
5. **Essential Eight dashboard gate**: Workshop exposes dedicated Essential Eight tracking and an uplift plan using existing Requirements, mappings, Evidence, Risks, and Actions.
6. **Strategy Editor gate**: Workshop provides a full-size Strategy Editor for the canonical Strategy entity while preserving the existing sanitised Explorer executive strategy view.
7. **Connected View volume gate**: Workshop and Explorer Connected View can hide Requirements marked not applicable and redraw linked context without changing link semantics.
8. **Evidence opening gate**: Evidence browse, list, review, and editor surfaces can open supported evidence references while preserving explicit save/discard/cancel behaviour for dirty editors.
9. **Deferred-scope gate**: v1.25 does not add new entity types, link verbs, schema axes, editable Explorer strategy, PMO scheduling, approvals, finance reconciliation, or editable Connected View.
10. **Regression gate**: `e2e:v1.25`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.26 candidate gates (Shop assurance spend scenario planning, per ADR 0062)

1. **ADR gate**: ADR 0062 records the Shop assurance spend attribution and scenario-planning decision before implementation starts.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.26.0`; schema, bundle, and API axes remain `1.10.0` unless a later implementation decision accepts new schema-bearing fields.
3. **Attribution gate**: Shop can show forecast spend by Requirement, Action, Requirement tag, domain, supplier, contract, cost centre, financial year, and Spend Item status using existing links and active records.
4. **No-double-counting gate**: headline scenario totals de-duplicate Spend Items, while grouped Requirement, Action, and tag rows disclose multi-linked spend and explain why grouped subtotals may exceed unique spend.
5. **Scenario gate**: forecast views can switch between approved/committed baseline, approved only, and proposed-inclusive scenarios using existing Spend Item statuses; `spent` and `cancelled` are excluded from forward forecast totals by default.
6. **Data-entry gate**: Spend Item create/edit prompts for forecast dates, amount, status, confidence, assumptions, cost centre, and linked Requirement or Action context, and surfaces quick fixes for missing links or weak forecast inputs.
7. **Interrogation gate**: Shop Forecast filters compose across period, financial year, supplier, contract, cost centre, Requirement status, Action status, tag, confidence, savings type, and scenario without mutating source records.
8. **Export gate**: filtered forecast exports include scenario comparison, spend by Requirement, spend by tag, spend by Action, expected savings, net forecast, confidence, and assumptions as CSV and Excel-compatible `.xls` tables.
9. **Maturity-language gate**: Shop may describe cost to reach and sustain target posture only where linked Strategy, Essential Eight, Requirement, or Action data supports that claim; otherwise it labels the view as linked assurance spend and highlights missing target data.
10. **Deferred-scope gate**: v1.26 does not add a scenario entity, finance reconciliation, actual spend import, formal approval workflow, taggable Spend Items or Actions, Pub assignment workflow, or new link verbs.
11. **Regression gate**: `check:shop-coverage-dashboard`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.27 candidate gates (Digital CISO Magazine, per ADR 0063)

1. **ADR gate**: ADR 0063 records the Digital CISO Magazine decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.27.0`; schema, bundle, and API axes remain `1.10.0`; no new schema directory is introduced.
3. **Renderer gate**: `@pspf/brief-renderer` exports a deterministic CISO Magazine model plus Markdown and self-contained HTML renderers.
4. **Issue-structure gate**: generated issues include cover hook, editor's note, posture snapshot, feature stories, attention required, action strip, commercial watch, CISO Master Plan article, reader actions, next issue, source metadata, and `OFFICIAL: Sensitive` labelling.
5. **PSPF Domain extract gate**: `check:ciso-magazine` generates both all-domain and `INFO`-scoped issues from the standard sample bundle.
6. **CISO Master Plan gate**: Workshop exposes a dedicated `CISO Master Plan` button and command that opens an active planning panel over Strategy, Plan of Action streams, phases, dependencies, risks, and Shop milestones; a copy action remains available for share/adapt workflows.
7. **Redaction gate**: generated Markdown and HTML exclude restricted personal fields, sensitive assumptions, and non-public working notes; no external scripts or network assets are emitted.
8. **Print/share gate**: generated HTML includes print CSS and Markdown remains suitable for email-body copy without requiring email sending.
9. **Newsletter review and export gate**: Workshop exposes a newsletter content-review panel before publication, can copy or export the generated issue as Markdown or self-contained HTML, and can include latest timestamped Action commentary in internal newsletter and posture extracts while keeping commentary excluded from Explorer publication bundles by default.
10. **Deferred-scope gate**: v1.27 does not add persisted Report Packs, canonical multi-plan entities, native PDF generation, email sending, subscriber management, RSS/feed publication, Pub people/assignment workflows, copyrighted comic artwork, or third-party comic trade dress.
11. **Regression gate**: `check:ciso-magazine`, `check:brief-redaction`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.28 candidate gates (Pub Marketplace foundation, per ADR 0064)

1. **ADR gate**: ADR 0064 records the Pub Marketplace foundation decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.28.2`; schema, bundle, and API axes remain `1.10.0`; no new schema directory is introduced.
3. **Package-shape gate**: `check-package-shape.mjs` validates Pub as a Marketplace extension with the `pspfPub` Activity Bar container, Home webview, Core extension dependency, and required `pspf.pub.*` commands.
4. **Marketplace dry-run gate**: the Marketplace workflow supports `target=pub`, packages `pspf-pub-${version}.vsix`, verifies `tobyharvey.pspf-pub`, and creates the `pub/${version}` receipt tag after publish.
5. **Local-only boundary gate**: no Pub data is added to Explorer publication bundles, Explorer schemas, sample exports, or public Explorer rendering in v1.28.
6. **Product-copy gate**: README and the ecosystem page describe Pub as an installable local-first people, role, team, assignment, and stakeholder relationship surface, not as a published-data surface.
7. **Deferred-scope gate**: full person CRUD, performance-management workflows, development records, roster planning, rotation planning, team-event history, relationship-note persistence, and Explorer Pub publication remain deferred to later Pub slices.
8. **Regression gate**: `package:check`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.29 candidate gates (UX consistency and relationship manager foundation, per ADR 0065)

1. **ADR gate**: ADR 0065 records the UX consistency and relationship manager foundation decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.29.2`; schema, bundle, and API axes remain `1.10.0`; no new schema directory is introduced.
3. **Export-format direction gate**: ADR 0066 records that PowerPoint and document exports are generated communication artefacts derived from existing brief/report models, not new system-of-record data or schema-bearing entities.
4. **UX coverage gate**: `check:ux-coverage` validates the entity UX coverage matrix and its regression tests for all contract entity types and Pub local record types.
5. **Relationship rule gate**: `@pspf/contracts.OPERATOR_LINK_RULES` covers current Shop and Workshop operator-editable relationship commands with canonical endpoint, link type, label, and phrase metadata.
6. **Relationship UI gate**: `@pspf/webview-shell.relationshipManagerHtml` renders escaped shared relationship actions for command URIs and Workshop command buttons; Shop uses it for assurance coverage quick actions and Supplier, Contract, and Spend Item detail panels; Workshop uses it for Requirement relationship actions.
7. **Pub CRUD gate**: Pub Person, Role, Assignment, and Relationship Note records expose local-only detail and edit panels with complete field coverage; no Pub local record fields are added to Explorer publication.
8. **Consumer gate**: Shop, Workshop, and Pub command tests prevent reverting to ad hoc hardcoded link rules, direct-to-edit Shop tree selection, bespoke Requirement relationship controls, or missing Pub local record detail/edit panels.
9. **Deferred-scope gate**: full relationship-manager rollout beyond the Shop forecast/detail and Workshop Requirement proof points, edit-panel simplification, Pub Explorer publication, new schema-bearing relationship fields, native PPTX/DOCX generation commands, and broader Pub list row-level actions remain deferred.
10. **Regression gate**: `e2e:v1.29`, `check:ux-coverage`, `check:gates`, `package:check`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.30 candidate gates (6clicks risk source integration, per ADR 0067)

1. **ADR gate**: ADR 0067 records the v1.30 6clicks risk source integration decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.30.0`; schema, bundle, and API axes are `1.11.0`; `schemas/explorer-bundle/1.11.0/` is published and earlier schema directories remain immutable.
3. **6clicks source gate**: Workshop exposes a Risk Source panel and commands for configuring, testing, previewing, applying, and viewing runs for the named `6clicks-risk` source.
4. **Configuration gate**: non-secret source settings are mirrored to `.pspf/config/integrations.json`; API key header and bearer token credentials are stored only in VS Code `SecretStorage`; no raw secret is stored in Core data, workspace settings, logs, snapshots, or bundles.
5. **Preview gate**: the fixture-backed preview classifies 6clicks records as new, changed, unchanged, ambiguous, or error with field-level differences for changed records.
6. **Consent gate**: applying changed risks preserves local PSPF-owned fields unless the operator explicitly consents to applying source values for the run.
7. **Publication metadata gate**: imported risks keep integration metadata locally, but Explorer bundles and generated outputs expose only source label and last source update.
8. **Deferred-scope gate**: external write-back, scheduled sync, webhooks, external Actions, technology systems, commercial records, Pub records, operator-managed field mapping, and Explorer runtime integration remain deferred.
9. **Regression gate**: `e2e:v1.30`, `check:risk-source-integration`, `check:gates`, `package:check`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.31 candidate gates (6clicks risk source hardening, per ADR 0068)

1. **ADR gate**: ADR 0068 records the v1.31 6clicks risk source hardening decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.31.2`; schema, bundle, and API axes remain `1.11.0`; no new schema directory is introduced.
3. **Explicit source-mode gate**: 6clicks profiles declare `sourceMode` as `fixture` or `live`; fixture mode is credential-free and tenant-free, while live mode requires an `https://` base URL, endpoint path, auth mode, SecretStorage credential reference, and bounded timeout.
4. **Local log gate**: preview and apply runs write redacted local run logs under `.pspf/logs/risk-source-runs/` with source mode, run status, counts, apply counts, mapping version, and diagnostics that do not expose raw credentials or response bodies.
5. **Fixture hardening gate**: built-in fixture data covers common 6clicks-style field variants and rejected rows; preview keeps rejected rows as `error` decisions while valid rows remain reviewable.
6. **Selected-apply gate**: applying a preview requires operator selection from new and changed records; ambiguous and error rows are excluded from apply.
7. **Non-goal gate**: write-back to 6clicks and operator-managed field mapping are not under consideration for this integration line unless a later product decision explicitly reopens them.
8. **Deferred-scope gate**: endpoint allow-listing, scheduled sync, background polling, webhooks, incremental cursors, additional source adapters, external Actions, technology systems, commercial records, Pub records, and Explorer runtime integration remain out of scope.
9. **Regression gate**: `e2e:v1.31`, `check:risk-source-integration`, `check:gates`, `package:check`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.32 candidate gates (CISO Master Plan and Strategy Editor polish, per ADR 0069)

1. **ADR gate**: ADR 0069 records the v1.32 CISO Master Plan and Strategy Editor polish decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.32.0`; schema, bundle, and API axes remain `1.11.0` unless implementation adds a new published bundle field, collection, link verb, or schema-bearing entity.
3. **Master Plan scan gate**: Workshop CISO Master Plan clearly presents direction, streams, phases, planner tasks, milestones, evidence inputs, risks, actions, and Shop dependencies from existing records without introducing a separate Plan product.
4. **Planning navigation gate**: the Master Plan routes operators to Strategy Map, Strategy Editor, Plan of Action, Master Dashboard, Digital CISO Magazine, and editable source records where applicable.
5. **Strategy Editor readiness gate**: the Strategy Editor keeps staged areas for frame, choices, outcomes, and measures, and adds concise readiness, linked-work, and missing-context cues for the visible area.
6. **Publication-sensitivity gate**: Strategy Editor copy and Master Plan rendering distinguish publication-safe executive content from sensitive assumptions, rationale, constraints, and non-public working detail.
7. **Initiative planning gate**: new roadmap initiatives start as planner frames and do not automatically create four template activities; operators can add tasks and milestones step by step through existing Action records, while the case for action remains editable through existing Evidence records. No canonical roadmap, milestone, resource, budget, or plan-baseline entity is added.
8. **Generated-output gate**: copied/generated Master Plan Markdown excludes restricted personal fields, sensitive assumptions, non-public working notes, raw integration logs, and unpublished Pub data.
9. **Deferred-scope gate**: v1.32 does not add a PSPF Plan product, multiple Strategy records, standalone strategy-choice entities, Explorer strategy editing, editable Connected View, PMO scheduling, approvals, reminders, calendars, finance reconciliation, persisted Report Packs, native PDF generation, email sending, or subscriber management.
10. **Regression gate**: `check:ciso-magazine`, `check:brief-redaction`, `check:ux-coverage`, `check:gates`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.33 candidate gates (questionnaire-driven population, per ADR 0069)

1. **ADR gate**: ADR 0069 records the v1.33 questionnaire-driven population decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.33.0`; schema, bundle, and API axes remain `1.11.0`; no new schema directory is introduced.
3. **Pack-integrity gate**: `check:questionnaire-pack` validates the bundled Starter pack and Domain deep-dive packs: every `requirementRefs[]` resolves to a current PSPF baseline requirement, every prompt and help-text passes AU-English lint, every question declares a publication policy, and pack IDs and question IDs are unique.
4. **Deterministic policy gate**: the answer-to-records policy in `packages/workshop/src/questionnaire/policy.ts` is pure and unit-tested for every supported answer value (`yes-with-link`, `yes`, `partial`, `no`, `unknown`, `na`, and `skipped`); identical inputs produce identical planned writes including identical Action `dueDate` offsets, evidence `nextReview` dates, and supersede-on-flip behaviour.
5. **Run storage gate**: questionnaire runs and answer sets are persisted as JSON files under `.pspf/questionnaire/runs/<runId>.json` with publication policy `internal`; no new SQLite tables, contract entity types, or schema directories are introduced in v1.33.
6. **Update-mode gate**: when prior runs exist the questionnaire offers three modes — `update-stale-or-changed`, `update-all-questions`, and `first-run-style` ("Answer all questions again") — and the mode picker exposes the "Answer all questions again" option to the operator on every re-run.
7. **Snapshot-before-apply gate**: every questionnaire apply is preceded by a Core snapshot of type `questionnaire-run` so the run can be reviewed and rolled back without operator intervention.
8. **Supersede gate**: when a re-run flips a previous answer (for example `no` to `yes-with-link`), the planned writes close the previous outstanding Action with reason `superseded-by-questionnaire-run/<runId>` and create the new Evidence and review-cycle Action instead of duplicating records.
9. **Privacy gate**: free-text answer notes default to publication policy `internal`; the personal-data exclusion gate covers questionnaire answer notes; pack manifests may be exported but operator answers are never auto-published.
10. **Regression gate**: `e2e:v1.33`, `check:questionnaire-pack`, `check:gates`, `package:check`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

### v1.34 candidate gates (Requirements navigation polish, per ADR 0070)

1. **ADR gate**: ADR 0070 records the v1.34 Requirements navigation polish decision before release preparation completes.
2. **Version gate**: all package versions and `PSPF_SLICE_VERSION` are `1.34.0`; schema, bundle, and API axes remain `1.11.0`; no new schema directory is introduced.
3. **Workshop Requirements navigation gate**: Workshop Requirements exposes an `All` tab, PSPF domain tabs, and a `Directions` tab; search, status, saved-view, tab, and Direction-lens state update a visible filtered-count cue with a clear action.
4. **Explorer Requirements navigation gate**: Explorer Requirements exposes the same tab model and visible filtered-count cue while preserving existing search, status, and tag filters.
5. **Directions lens gate**: the `Directions` tab in both Workshop and Explorer lists Requirements targeted by existing Direction links and does not introduce a separate Direction authoring mode, link verb, bundle field, or schema change.
6. **Trend indicator gate**: Strategy and list/table trend fields render labelled red/amber/green/neutral arrow indicators for improving, steady, deteriorating, and unknown values; colour is not the only signal.
7. **Connected View layering gate**: selecting a Connected View card keeps all connector lines, including highlighted selected-chain paths, visually underneath selected and connected cards.
8. **Deferred-scope gate**: v1.34 does not add new Requirement, Direction, saved-view, or navigation entities; schema-bearing fields; link verbs; editable Connected View; drag-to-link; edge filtering; team/private saved views; or tag hierarchy.
9. **Regression gate**: `e2e:v1.34`, `check:explorer-publication`, `check:workshop-navigation`, `check:ux-coverage`, `check:gates`, `package:check`, `validate:debug-workspace`, `lint`, `check:release-candidate`, and `typecheck` pass.

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
