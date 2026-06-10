# PSPF Development Readiness Review

Status: **partial**

## Purpose

This review records whether the PSPF spec set is ready to move from conceptual design into the v0.1 implementation slice. It also captures development-environment enhancements for the assumed maintainer setup: VS Code on macOS, one private GitHub Pro repo, pnpm workspaces, and GitHub Actions.

## Readiness status

**Current implementation note:** v1.42.0 is a schema-neutral UX and local planning patch release on Explorer bundle schemas `1.14.0`. It keeps the v1.39 schema-bearing evidence lifecycle/reporting changes, adds Workshop UX/IA refinements, and adds Pub team-card Organisation Chart backs plus local team news/date items that can optionally appear on the Workshop Plan of Action. Release readiness is expected to run through `e2e:v1.42:run` and validate `VERSION_AXES = 1.14.0`.

**Status: v1.9 saved-view expansion build implemented for test. v1.8 saved views build implemented; v1.7 tags and filters foundation build implemented; v1.6 Workshop import review and identity build implemented; v1.5.1 Explorer product-boundary and visual identity patch implemented; v1.5 plan-apply import and undo implemented; v1.4 Explorer local Risks, conflict display, and improved local-authoring navigation validated manually; v1.3 Explorer local Actions implemented; v1.2 Explorer local evidence references implemented; v1.1 Explorer local-authoring phase 1 validated manually; v1.0.1 patch release prepared; v1.0 initial assurance user testing release implemented; manual validation has been clean to date; v0.9 release-candidate freeze closed; v0.8 first-run and packaging-readiness slice closed; v0.7 engine-hardening slice closed; v0.6 Workshop parity slice closed; v0.5 Directions and Action Impact slice closed; v0.4 readiness and UI-resilience slice closed; v0.3 ISM mapping slice validated.**

The validated spine from the original readiness sequence is fully landed and has now been cut as the v1.0 initial assurance user testing release:

- pnpm workspaces with `@pspf/contracts`, `@pspf/brief-renderer`, `pspf-core`, `pspf-workshop`, and the Explorer static SPA.
- Core: workspace bootstrap, SQLite system of record at `.pspf/core/pspf-core.db`, snapshot, integrity check, master-bundle export with manifest hashes, master-bundle import (`full-replace` with pre-replace rollback and `additive-merge`), writer lock, three version axes.
- Workshop: Requirement, Evidence, Action, Risk authoring; Assessment Dashboard, Evidence Review Queue, Item Detail, Copy Posture Brief webview commands; ISM source-control browsing; Requirement to ISM control mapping with confidence, review metadata, drift visibility, first-class Requirement tags, system-of-record identity, and Explorer local JSON import review.
- Explorer: static SPA, bundle load with AJV validation, posture brief view with copy-to-clipboard, editable posture screen backed by browser-local Requirement status overlays, compliance donut, Relationships Board read-only, Requirement and Relationships tag filters, Requirements and Relationships saved views, schema-change reload guidance for remembered bundles, ISM source controls, ISM coverage, mapping quality, drift status, OFFICIAL: Sensitive + TLP:AMBER+STRICT banner, active version context, v1.1 browser-local Requirement status overlays, v1.2 browser-local evidence references, v1.3 browser-local Actions, v1.4 browser-local Risks plus local status conflict display, v1.5.1 latest-bundle refresh restore, and a warmer portable-assurance visual identity.
- Shared `@pspf/brief-renderer` package backs both Workshop and Explorer so the posture brief cannot diverge.
- ISM integration phases 1–3 are implemented for the current seeded source-library slice; see [adr/0017-ism-integration-roadmap.md](adr/0017-ism-integration-roadmap.md), [adr/0018-ism-source-library.md](adr/0018-ism-source-library.md), [adr/0019-requirement-control-mapping.md](adr/0019-requirement-control-mapping.md), and [adr/0020-ism-mapping-quality-and-drift.md](adr/0020-ism-mapping-quality-and-drift.md).
- v0.4 is governed by [adr/0021-v0-4-readiness-and-ui-resilience.md](adr/0021-v0-4-readiness-and-ui-resilience.md). It hardens Explorer/Workshop table readability and readiness documentation without changing the schema, bundle, or API axes from `1.2.0`.
- v0.5 is governed by [adr/0023-v0-5-direction-and-action-impact.md](adr/0023-v0-5-direction-and-action-impact.md). It introduces the `direction` entity (prefix `DIR-`), posture `directionCount`, and derived `action.impact` with deterministic uplift ranking; schema/bundle/API axes bump together to `1.3.0`.
- v0.6 is governed by [adr/0024-v0-6-workshop-parity.md](adr/0024-v0-6-workshop-parity.md). It lifts the v0.5 signals into the Workshop authoring loop (Directions tile and chips, Action Impact top-5 on the Dashboard, inbound Directions and action urgency in Item Detail, Urgent Actions in the Evidence Review Queue, a new `PSPF: Open Direction Detail` panel) and consolidates `enrichActionsWithImpact` in `@pspf/contracts`. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.6.0`.
- v0.7 is governed by [adr/0025-v0-7-engine-hardening.md](adr/0025-v0-7-engine-hardening.md). It adds explicit Core API layers, `runIntegrityScan()` plus `PSPF: Run Integrity Scan`, a broken-link integrity fixture gate, and explicit single-writer policy with stale-lock recovery coverage. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.7.0`.
- v0.8 is governed by [adr/0026-v0-8-first-run-and-packaging-readiness.md](adr/0026-v0-8-first-run-and-packaging-readiness.md). It adds a shared sample-workspace fixture, Workshop Welcome and Load Sample commands, sample-workspace validation, and Core/Workshop package-shape rehearsal. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.8.0`.
- v0.9 is governed by [adr/0027-v0-9-release-candidate-freeze.md](adr/0027-v0-9-release-candidate-freeze.md). It adds no product features; it refreshes the manual validation scenario, makes release-readiness reporting active-version aware, and adds release-candidate consistency checks. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.9.0`.
- v1.0 is governed by [adr/0028-v1-0-initial-assurance-user-testing-release.md](adr/0028-v1-0-initial-assurance-user-testing-release.md). It is a release cut from v0.9 for initial assurance user testing. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.0.0`.
- v1.0.1 is governed by [adr/0030-v1-0-1-validation-closure-and-explorer-local-authoring-phase-1.md](adr/0030-v1-0-1-validation-closure-and-explorer-local-authoring-phase-1.md). It records clean manual validation to date and the next Explorer local-authoring phase 1 decision. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.0.1`.
- v1.1 is governed by [adr/0031-v1-1-explorer-local-authoring-phase-1.md](adr/0031-v1-1-explorer-local-authoring-phase-1.md). Explorer persists Requirement `assessmentStatus` overlays in `IndexedDB`, visibly separates local from bundle status, and exports a standard local-authoring master bundle. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.1.0`.
- v1.2 is governed by [adr/0032-v1-2-explorer-local-evidence-references.md](adr/0032-v1-2-explorer-local-evidence-references.md). Explorer persists local evidence references in `IndexedDB`, materialises them as existing `evidence` and `supported-by` `link` records, and exports them in the same local-authoring master bundle. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.2.0`.
- v1.3 is governed by [adr/0033-v1-3-explorer-local-actions.md](adr/0033-v1-3-explorer-local-actions.md). Explorer persists local Actions in `IndexedDB`, materialises them as existing `action` and `addressed-by` `link` records, and exports them in the same local-authoring master bundle. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.3.0`.
- v1.4 is governed by [adr/0034-v1-4-explorer-local-risks-and-conflicts.md](adr/0034-v1-4-explorer-local-risks-and-conflicts.md). Explorer persists local Risks in `IndexedDB`, materialises them as existing `risk` and `exposed-by` `link` records, shows informational local status conflicts against refreshed bundle baselines, and exports them in the same local-authoring master bundle. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.4.0`.
- v1.5 is governed by [adr/0035-v1-5-plan-apply-import-and-undo.md](adr/0035-v1-5-plan-apply-import-and-undo.md). Core/Workshop adds `plan-apply` import with read-only planning, explicit apply confirmation, conflict/update examples, and last-import undo for additive and plan-applied imports. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.5.0`.
- v1.5.1 is governed by [adr/0036-v1-5-1-explorer-workshop-product-boundary-and-identity.md](adr/0036-v1-5-1-explorer-workshop-product-boundary-and-identity.md). It records Workshop as the system of record and Explorer as the portable review, briefing, lightweight annotation, and round-trip suggestion surface; Explorer gets the first visible identity pass and default latest-bundle refresh restore. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.5.1`.
- v1.6 is governed by [adr/0037-v1-6-workshop-import-review-and-identity.md](adr/0037-v1-6-workshop-import-review-and-identity.md). It adds a proper `PSPF Workshop Import Review` webview for Explorer local JSON plan-apply imports and gives Workshop its system-of-record visual identity. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `1.6.0`.
- v1.7 is governed by [adr/0041-v1-7-tags-and-filters-foundation.md](adr/0041-v1-7-tags-and-filters-foundation.md). It adds first-class workspace tags for Requirements, `tagged-with` links, by-tag export indexes, Workshop tag management, and Explorer tag filters. Schema, bundle, and API axes bump together to `1.4.0`; product version bumps to `1.7.0`.
- v1.8 is governed by [adr/0042-v1-8-saved-views.md](adr/0042-v1-8-saved-views.md). It adds Requirements-only Explorer saved views as `saved-view` records in `saved-views`, persisted in IndexedDB and round-tripped through local-authoring exports/imports. Schema, bundle, and API axes bump together to `1.5.0`; product version bumps to `1.8.0`.
- v1.9 is governed by [adr/0043-v1-9-saved-view-expansion.md](adr/0043-v1-9-saved-view-expansion.md). It expands saved views to Explorer Relationships and Workshop Requirement views, keeps saved views as optional user convenience records, makes names unique within scope, and adds Explorer reload guidance when remembered browser JSON is from an older schema. Schema, bundle, and API axes bump together to `1.6.0`; product version bumps to `1.9.0`.
- v1.0 scope is governed by [adr/0022-v1-0-scope.md](adr/0022-v1-0-scope.md): Core + Workshop + Explorer publication mode plus the v0.5 surface; Shop, Pub, Explorer local authoring, chart export, plan-apply, and third-party accessibility audit were deferred past v1.0; performance reference is a current MacBook Air. Current Explorer releases now include local authoring and an editable posture screen.

The core product decisions remain stable:

- v0.1 scope is pinned by ADR 0014.
- Source layout is pinned by ADR 0013.
- Australian context, AU English, and terminology are pinned by ADR 0016 and `pspf-glossary.md`.
- Item Detail is pinned to a `WebviewPanel` by ADR 0015 (implemented).
- Single-writer behaviour is pinned in `pspf-core-architecture-spec.md`, `pspf-onboarding-spec.md`, and S8 in `pspf-invariants.md` (implemented).
- Acceptance gates distinguish v0.1 from v1, and v0.2 candidate gates for ISM are now listed.

## Gate status

`npx pnpm@10.10.0 run release:readiness` is expected to be green for v1.42.0:

1. Spine workflow (headless `e2e:v1.42`).
2. Schema-policy.
3. Personal-data exclusion.
4. AU-English lint.
5. Per-version schema publication (`schemas/explorer-bundle/1.14.0/`).
6. Writer lock.
7. Integrity scan.
8. Sample workspace.
9. Package shape.
10. Release-candidate consistency.
11. Backup / restore dry-run.
12. Accessibility floor (`axe-core` via Playwright).
13. Brief redaction.
14. Explorer publication smoke.
15. Explorer local-authoring smoke.
16. Explorer-to-Workshop import smoke.
17. Master-bundle import.
18. Cyber reference dataset diagnostics.
19. UX coverage, including Workshop IA affordances and Pub team-date planning context.

## Remaining readiness risks

These are open before, during, or after the first manual operator validation. None block the v1.0 initial assurance user testing release, but each is tracked.

1. **AU-English lint scope** — ADR 0016 expects the lint to scan all user-facing copy, but until docs move to `docs/` (ADR 0013) only two files are effectively in scope. Either (a) extend `scripts/lint-au-english.mjs` to include `pspf-*.md`, `adr/**/*.md`, and `validation-scenario-*.md` while carving out fenced code blocks, or (b) mechanically move docs under `docs/` and update inbound links. The repository's Copilot instructions already acknowledge the docs have not yet moved.
2. **Explorer CSP gap** — the static ecosystem page (`pspf-ecosystem.html`) still allows inline script/style for its own simple behaviour. The product Explorer build at `packages/explorer/dist/index.html` MUST keep meeting S4; do not copy this page's relaxed CSP into Explorer. Spot-check on every Explorer change.
3. **Pub expectation management** — Pub now has a local-only people/team surface, including team-card organisation charts and local team-date planning context. Public copy must keep saying Pub data is not published to Explorer, team dates are local planning context only, and calendar/notification/performance-management workflows are not implemented.
4. **`chart-renderer` package** — ADR 0014 names a shared `chart-renderer` alongside `brief-renderer`. v0.1 ships only `brief-renderer` because Workshop has no chart surface; the compliance donut is rendered inline by Explorer. The shared package will land in v0.2 when a chart is shared between surfaces. Tracked here so the gap is not forgotten.
5. **Health view** — the v1 spec set references a Core "Health view" in `pspf-acceptance-and-quality-gates.md` Core criterion #2, `pspf-vscode-extension-surface-spec.md`, `pspf-onboarding-spec.md`, `pspf-core-architecture-spec.md`, and `pspf-core-workshop-screen-workflow-spec.md`. v0.1 surfaces the same information through discrete commands (`PSPF: Validate Workspace`, `PSPF: Verify Integrity`, `PSPF: Show Writer Lock`) and does not ship a single Health view webview. The unified view arrives in v0.2.
6. **Command rename in extension surface spec** — `pspf-vscode-extension-surface-spec.md` still lists `pspf.core.exportExplorerBundle`; the implementation correctly uses `pspf.core.exportBundle` per ADR 0009 (single master bundle). The spec text is patched alongside this review; this risk closes when the patch lands.
7. **Core API contract shape** — `pspf-core-api-contract-spec.md` describes a layered `PspfCoreApi` object (`platform`, `queries`, `commands`, `events`). v0.1 exposes a flat object plus VS Code commands; the layered shape is targeted for v0.2 once a second consuming product exists. Documented here rather than treated as drift, because v0.1 has only one consumer.
8. **First operator validation** — manual validation using `validation-scenario-1-operator-workflow.md` has been clean to date. Keep recording any future operator findings against the scenario before expanding post-v1.0 scope.
9. **Post-next-slice diagnostics hardening** — after the current manual-validation sequence, add the next diagnostics/repair tranche without pulling it into the immediate slice:
   - Pub local JSON diagnostics and conservative repair for malformed people, teams, roles, assignments, and relationship notes, including orphaned `assignment.personId`, `assignment.roleId`, `role.teamId`, `role.reportsToRoleId`, `team.parentTeamId`, and `relationshipNote.personId` references. Pub repair must copy `.pspf/pub/pub.json` before writing, create placeholders only where non-destructive, and leave duplicate IDs or cycles diagnostic-only.
   - Core integrity scan expansion for known reference fields beyond `link` rows and Shop `contract.supplierId`, especially requirement-control mappings and any future Core-backed Pub references. Core should stay report-first; broad automatic repair is deferred unless a fix is mechanical, reversible, and product-owned.
   - Workshop should expose clearer integrity findings over Core scan results when useful, but should not get a broad auto-repair tool for assurance records. Workshop repair remains limited to explicit operator-owned, meaning-preserving actions.

## Development environment enhancements

Landed:

- `.node-version`, `packageManager` in root `package.json`, `pnpm-workspace.yaml`.
- Root `doctor` script verifying Node, pnpm, VS Code engine compatibility, and SQLite WAL support.
- `.vscode/extensions.json` recommending the maintainer toolchain.
- `.github/copilot-instructions.md` pointing generated-code work to the spec set.
- `docs/lint/au-english.json` spelling list.

Deferred / outstanding:

- `.devcontainer/` for non-macOS contributors.
- Playwright browser cache hygiene in CI.
- `gh` release-workflow command sequence in `pspf-backup-and-restore-runbook.md` once the first VSIX tag is cut.

## First implementation sequence

The original implementation sequence and the v0.3-v1.0 hardening sequence are complete:

1. Monorepo scaffold (docs not yet moved — see remaining risk #1).
2. Contracts package with entity IDs, glossary-driven labels, and publication-policy metadata.
3. Schema-policy and AU-English lint scripts.
4. Core bootstrap and writer lock with tests.
5. Personal-data fixture and fail-closed exporter test.
6. Workshop Requirement / Evidence / Action / Risk authoring.
7. Snapshot, master-bundle export, and Explorer publication-mode load.
8. v1.0 end-to-end spine test (`scripts/e2e-v01.mjs`, surfaced through `e2e:v1.0`).

The next sequence is manual validation of v1.42.0, including Workshop UX/IA refinement, Pub Organisation Chart card fronts/backs, local team news/date editing, optional Plan of Action team-date context, and the existing Workshop, Explorer, Shop, Pub, import, and release-dry-run regression surfaces.

## Review conclusion

The Core, Workshop, Explorer publication, ISM mapping, Directions, Action Impact, first-run sample, integrity/readiness spine, Requirement tags, Explorer tag filters, Explorer Requirements saved views, Explorer local status overlays, Explorer local evidence references, Explorer local Actions, Explorer local Risks, local status conflict display, Workshop import review, plan-apply import, last-import undo, latest-bundle refresh restore, Workshop/Explorer identity boundary, Shop commercial planning, Pub local CRUD, Workshop UX/IA refinement, and Pub team-date planning context are implemented for v1.42.0 readiness. Manual validation still needs to confirm the visible v1.42 Pub card view and Plan of Action team-date context in the Extension Host.
