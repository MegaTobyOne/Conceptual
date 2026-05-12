# PSPF Development Readiness Review

## Purpose

This review records whether the PSPF spec set is ready to move from conceptual design into the v0.1 implementation slice. It also captures development-environment enhancements for the assumed maintainer setup: VS Code on macOS, one private GitHub Pro repo, pnpm workspaces, and GitHub Actions.

## Readiness status

**Status: v0.9 release-candidate freeze implemented. v0.8 first-run and packaging-readiness slice closed; v0.7 engine-hardening slice closed; v0.6 Workshop parity slice closed; v0.5 Directions and Action Impact slice closed; v0.4 readiness and UI-resilience slice closed; v0.3 ISM mapping slice validated.**

The validated spine from the original readiness sequence is fully landed and has now been extended through the v0.9 release-candidate freeze:

- pnpm workspaces with `@pspf/contracts`, `@pspf/brief-renderer`, `pspf-core`, `pspf-workshop`, and the Explorer static SPA.
- Core: workspace bootstrap, SQLite system of record at `.pspf/core/pspf-core.db`, snapshot, integrity check, master-bundle export with manifest hashes, master-bundle import (`full-replace` with pre-replace rollback and `additive-merge`), writer lock, three version axes.
- Workshop: Requirement, Evidence, Action, Risk authoring; Assessment Dashboard, Evidence Review Queue, Item Detail, Copy Posture Brief webview commands; ISM source-control browsing; Requirement to ISM control mapping with confidence, review metadata, and drift visibility.
- Explorer (publication mode only): static dark-mode SPA, bundle load with AJV validation, posture brief view with copy-to-clipboard, compliance donut, Relationships Board read-only, ISM source controls, ISM coverage, mapping quality, drift status, OFFICIAL: Sensitive banner, and active version context.
- Shared `@pspf/brief-renderer` package backs both Workshop and Explorer so the posture brief cannot diverge.
- ISM integration phases 1–3 are implemented for the current seeded source-library slice; see [adr/0017-ism-integration-roadmap.md](adr/0017-ism-integration-roadmap.md), [adr/0018-ism-source-library.md](adr/0018-ism-source-library.md), [adr/0019-requirement-control-mapping.md](adr/0019-requirement-control-mapping.md), and [adr/0020-ism-mapping-quality-and-drift.md](adr/0020-ism-mapping-quality-and-drift.md).
- v0.4 is governed by [adr/0021-v0-4-readiness-and-ui-resilience.md](adr/0021-v0-4-readiness-and-ui-resilience.md). It hardens Explorer/Workshop table readability and readiness documentation without changing the schema, bundle, or API axes from `1.2.0`.
- v0.5 is governed by [adr/0023-v0-5-direction-and-action-impact.md](adr/0023-v0-5-direction-and-action-impact.md). It introduces the `direction` entity (prefix `DIR-`), posture `directionCount`, and derived `action.impact` with deterministic uplift ranking; schema/bundle/API axes bump together to `1.3.0`.
- v0.6 is governed by [adr/0024-v0-6-workshop-parity.md](adr/0024-v0-6-workshop-parity.md). It lifts the v0.5 signals into the Workshop authoring loop (Directions tile and chips, Action Impact top-5 on the Dashboard, inbound Directions and action urgency in Item Detail, Urgent Actions in the Evidence Review Queue, a new `PSPF: Open Direction Detail` panel) and consolidates `enrichActionsWithImpact` in `@pspf/contracts`. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.6.0`.
- v0.7 is governed by [adr/0025-v0-7-engine-hardening.md](adr/0025-v0-7-engine-hardening.md). It adds explicit Core API layers, `runIntegrityScan()` plus `PSPF: Run Integrity Scan`, a broken-link integrity fixture gate, and explicit single-writer policy with stale-lock recovery coverage. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.7.0`.
- v0.8 is governed by [adr/0026-v0-8-first-run-and-packaging-readiness.md](adr/0026-v0-8-first-run-and-packaging-readiness.md). It adds a shared sample-workspace fixture, Workshop Welcome and Load Sample commands, sample-workspace validation, and Core/Workshop package-shape rehearsal. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.8.0`.
- v0.9 is governed by [adr/0027-v0-9-release-candidate-freeze.md](adr/0027-v0-9-release-candidate-freeze.md). It adds no product features; it refreshes the manual validation scenario, makes release-readiness reporting active-version aware, and adds release-candidate consistency checks. Schema, bundle, and API axes stay at `1.3.0`; product version bumps to `0.9.0`.
- v1.0 scope is governed by [adr/0022-v1-0-scope.md](adr/0022-v1-0-scope.md): Core + Workshop + Explorer publication mode plus the v0.5 surface; Shop, Pub, Explorer local authoring, chart export, plan-apply, editable posture, and third-party accessibility audit are deferred past v1.0; performance reference is a current MacBook Air.

The core product decisions remain stable:

- v0.1 scope is pinned by ADR 0014.
- Source layout is pinned by ADR 0013.
- Australian context, AU English, and terminology are pinned by ADR 0016 and `pspf-glossary.md`.
- Item Detail is pinned to a `WebviewPanel` by ADR 0015 (implemented).
- Single-writer behaviour is pinned in `pspf-core-architecture-spec.md`, `pspf-onboarding-spec.md`, and S8 in `pspf-invariants.md` (implemented).
- Acceptance gates distinguish v0.1 from v1, and v0.2 candidate gates for ISM are now listed.

## Gate status

`npx pnpm@10.10.0 run release:readiness` is green at 11/11:

1. Spine workflow (Playwright end-to-end + headless `e2e:v0.1`).
2. Schema-policy.
3. Personal-data exclusion.
4. AU-English lint (current scope: `README.md`, `.github/copilot-instructions.md`, and `docs/**/*.md` — see remaining risk #1).
5. Per-version schema publication (`schemas/explorer-bundle/1.0.0/`).
6. Accessibility floor (`axe-core` via Playwright).
7. Writer lock.
8. Backup / restore dry-run.
9. Brief redaction.
10. Explorer publication smoke.
11. Copy posture brief parity (Workshop ↔ Explorer through the shared renderer).

## Remaining readiness risks

These are open before, during, or after the first manual operator validation. None block the v0.1 release candidate, but each is tracked.

1. **AU-English lint scope** — ADR 0016 expects the lint to scan all user-facing copy, but until docs move to `docs/` (ADR 0013) only two files are effectively in scope. Either (a) extend `scripts/lint-au-english.mjs` to include `pspf-*.md`, `adr/**/*.md`, and `validation-scenario-*.md` while carving out fenced code blocks, or (b) mechanically move docs under `docs/` and update inbound links. The repository's Copilot instructions already acknowledge the docs have not yet moved.
2. **Explorer CSP gap** — the static ecosystem page (`pspf-ecosystem.html`) still allows inline script/style for its own simple behaviour. The product Explorer build at `packages/explorer/dist/index.html` MUST keep meeting S4; do not copy this page's relaxed CSP into Explorer. Spot-check on every Explorer change.
3. **Shop / Pub expectation management** — Shop and Pub are v0.2+, so public copy, release notes, and the README must keep saying "deferred" until the packages exist. `packages/shop/README.md` and `packages/pub/README.md` currently hold deferral notes only.
4. **`chart-renderer` package** — ADR 0014 names a shared `chart-renderer` alongside `brief-renderer`. v0.1 ships only `brief-renderer` because Workshop has no chart surface; the compliance donut is rendered inline by Explorer. The shared package will land in v0.2 when a chart is shared between surfaces. Tracked here so the gap is not forgotten.
5. **Health view** — the v1 spec set references a Core "Health view" in `pspf-acceptance-and-quality-gates.md` Core criterion #2, `pspf-vscode-extension-surface-spec.md`, `pspf-onboarding-spec.md`, `pspf-core-architecture-spec.md`, and `pspf-core-workshop-screen-workflow-spec.md`. v0.1 surfaces the same information through discrete commands (`PSPF: Validate Workspace`, `PSPF: Verify Integrity`, `PSPF: Show Writer Lock`) and does not ship a single Health view webview. The unified view arrives in v0.2.
6. **Command rename in extension surface spec** — `pspf-vscode-extension-surface-spec.md` still lists `pspf.core.exportExplorerBundle`; the implementation correctly uses `pspf.core.exportBundle` per ADR 0009 (single master bundle). The spec text is patched alongside this review; this risk closes when the patch lands.
7. **Core API contract shape** — `pspf-core-api-contract-spec.md` describes a layered `PspfCoreApi` object (`platform`, `queries`, `commands`, `events`). v0.1 exposes a flat object plus VS Code commands; the layered shape is targeted for v0.2 once a second consuming product exists. Documented here rather than treated as drift, because v0.1 has only one consumer.
8. **First operator validation** — the slice has not yet been put in front of an external operator using `validation-scenario-1-operator-workflow.md`. This is the next sequenced activity, not a code task.

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

All eight steps from the original sequence are complete:

1. Monorepo scaffold (docs not yet moved — see remaining risk #1).
2. Contracts package with entity IDs, glossary-driven labels, and publication-policy metadata.
3. Schema-policy and AU-English lint scripts.
4. Core bootstrap and writer lock with tests.
5. Personal-data fixture and fail-closed exporter test.
6. Workshop Requirement / Evidence / Action / Risk authoring.
7. Snapshot, master-bundle export, and Explorer publication-mode load.
8. v0.1 end-to-end spine test (`scripts/e2e-v01.mjs`).

The next sequence is v0.4 validation followed by an explicit decision about the first v1 feature tranche: Action Impact plus Directions, Explorer local-authoring mode, or Shop/Pub foundations.

## Review conclusion

The Core, Workshop, Explorer publication, and ISM mapping spine is implemented end-to-end and gated. v0.4 is the hardening bridge before larger v1 feature tranches: readability, release documentation, and layout regression coverage should be green before starting Shop, Pub, Explorer local authoring, Direction overlay, Action Impact ranking, posture editing, or plan-apply import.
