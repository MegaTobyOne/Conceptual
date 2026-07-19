# PSPF Explorer Unification Plan

Status: **active**

Companion to `adr/0084-explorer-unification-pspfexplorer2.md`, which records the decision. This
document records the sequence, the gates, and the open questions. Living document — update as
phases land.

Source snapshot: `https://github.com/MegaTobyOne/pspfexplorer2` (`main`, July 2026,
`2.0.0-alpha.1`). Target: one repo, one friendly Explorer web surface at
`tobyharvey.online/explorer`, exchanging data with the Core extensions via the master bundle.

> Status legend: 🔲 not started · 🟡 in progress · ✅ done

## Hard constraints (apply to every phase)

- The shipped `packages/explorer` stays green and deployable until Phase E cutover completes.
- `packages/explorer-next` is excluded from VSIX packaging, `web-release.yml`, and release
  artefacts until cutover.
- No restricted field (`Person.name`, `Person.email`, `Assignment.personId`, non-public free
  text) is rendered, persisted, or exported by the new surface — default-deny per ADR 0005.
- AU English in all user-facing copy; reconcile pspfexplorer2 strings during Phase D.
- Compatibility axes remain the only version negotiation mechanism (ADR 0008).

## Phase A — Snapshot import and workspace adoption ✅

| #   | Work                                                                                                                                                                                                                                           | Done when                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A.1 | Copy pspfexplorer2 `src/`, `public/`, `tests/`, `scripts/`, configs into `packages/explorer-next` as one commit. Exclude `archive/`, `source-data/`, its `.github/`, `package-lock.json`, and repo-level docs superseded by this repo's specs. | Snapshot builds locally with `vite build`.                    |
| A.2 | Convert to pnpm workspace member: name `pspf-explorer-next`, `"private": true`, version aligned to repo version. Pin the Lit/Vite/Cytoscape dependency set.                                                                                    | `pnpm install` clean; no npm lockfile.                        |
| A.3 | Wire root scripts: package-local `lint`, `typecheck`, `test` participate in `pnpm lint` / `pnpm typecheck` / `pnpm test`. Keep TS 6/ESLint 10 package-local if root alignment is not immediate; record the divergence.                         | Root commands pass with the new package included.             |
| A.4 | Carry over its Vitest + fake-indexeddb unit tests and Playwright a11y/e2e suite; register the perf-budget script as a package script.                                                                                                          | All imported tests pass in CI.                                |
| A.5 | Guard rails: assert `explorer-next` is absent from `web-release.yml` inputs and `release:readiness` artefact checks.                                                                                                                           | Gate added to `release-gates.json` scope or readiness script. |

## Phase B — Single source of PSPF reference data ✅

> Landed: `scripts/generate-pspf-data.mjs` generates the six `src/pspf/*.ts` domain modules from
> `@pspf/reference-data` (217 requirements — the embedded 218th was a duplicate of a TECH
> requirement misfiled as INFO). Each requirement carries `canonicalId` (ADR 0002
> `REQ-PSPF-2025-NNN`) alongside the app-local code, with a `requirementByCanonicalId` lookup
> exported from `src/pspf/index.ts`.

| #   | Work                                                                                                                                                                                                                                         | Done when                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| B.1 | Diff the embedded `src/pspf/*.ts` dataset (218 requirements, six domains, Essential Eight mapping, ISM resources) against `packages/reference-data`. Resolve factual gaps in `reference-data` (curator workflow, attribution/licence gates). | Zero content divergence report.                            |
| B.2 | Replace embedded dataset with a build-time generation step consuming `@pspf/reference-data`; delete `src/pspf/` data modules; keep type definitions where still needed.                                                                      | App renders identical requirement set from generated data. |
| B.3 | Normalise IDs at the data boundary to ADR 0002 format; map pspfexplorer2 branded IDs (`RequirementId` etc.) onto canonical IDs.                                                                                                              | ID round-trip tests pass.                                  |

## Phase C — Master-bundle interop (the load-bearing phase) ✅

> Landed: `src/data/core-bundle.ts` (parse/plan/apply import + export of the manifest-led master
> bundle, axis validation via `@pspf/contracts`, SHA-256 collection hashes, stable ID mapping
> persisted in app meta) and the `Core exchange` view at `/core`. Round-trip proven: the shipped
> Explorer's enterprise sample bundle imports, exports, and re-imports into Core via
> `importBundle(..., 'full-replace')` with validation ok. Deviation from C.3 as written: export
> uses the master-bundle format (ADR 0009) rather than the plan/apply exchange format — Core
> accepts it directly, so the plan/apply path is not required for interop. C.2 is partial
> (classification labelling shipped; full read-only publication overlay deferred). C.4 landed
> minimally in Phase D: SHA-256 checksum verification now runs on every bundle load in the
> Core exchange view (mismatches block the import plan); the full validation panel is retired.

| #   | Work                                                                                                                                                                                                                                                                        | Done when                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| C.1 | Bundle import: load a manifest-led master bundle (file picker + drag-drop), validate axes via the shared `packages/contracts` compatibility helper, map collections (requirements, evidence, actions, risks, directions, change records, ISM coverage) into the app stores. | Current sample bundles (enterprise, home) load and render.                             |
| C.2 | Publication mode: when a bundle is loaded, published entities are read-only with sensitive-labelling-only display (ADR 0011); local additions live in a separate IndexedDB overlay keyed to the bundle identity, mirroring the shipped Explorer's reconnect behaviour.      | Mode banner, read-only enforcement, and overlay reconnect tests pass.                  |
| C.3 | Round-trip export: local changes export in the Workshop-compatible plan/apply import format (ADR 0035, ADR 0037), replacing the `pspf-explorer.v3` backup envelope for interop purposes (local full-backup export may remain as a convenience).                             | Workshop import review accepts an export produced by the new app.                      |
| C.4 | Bundle validation panel parity: schema check against `schemas/explorer-bundle/<schemaVersion>/`, checksum display, and the signature row placeholder from grand-plan Tranche 6.                                                                                             | Validation view reports the same findings as the shipped Explorer for the same bundle. |

## Phase D — Feature parity and AU polish ✅

> Landed. D.1 parity outcomes against the shipped Explorer:
>
> - **Posture brief** — PORTED. `src/data/posture-brief.ts` renders the shared
>   `@pspf/brief-renderer` markdown from the browser-local store; "Copy posture brief" lives on
>   the Posture view and preserves the OFFICIAL: Sensitive banner and operator spine.
> - **Bundle checksum validation** — PORTED into the Core exchange view
>   (`verifyCoreBundleChecksums`); a manifest/content mismatch blocks the import plan with an
>   AU-English remediation message. Closes C.4 minimally.
> - **ISM source-controls table** — RETIRED from the web surface. ISM data still round-trips
>   through the Core exchange unchanged; ISM authoring and review live in Workshop/Core.
> - **Strategy, plan-lens, and change-record views** — RETIRED from the web surface. The
>   collections pass through import/export untouched; authoring lives in Workshop.
> - **Obligations/summary donuts** — COVERED by the Analytics and Coverage views (KPIs, coverage
>   matrix) with e2e tests.
> - **Relationships board (ADR 0010)** — COVERED by the relationship map's board mode
>   (columns by kind, connection lines, multi-select highlight; 8 e2e tests).
>
> D.2 verified: the map builds from store relationships including bundle-imported ones, with
> deep links (`?focus=`) tested. D.3: root `lint:au` scans the package and passes; dates use
> local-friendly display. D.4: axe + perf budget run as blocking package gates and are wired
> into CI/release gates at cutover (Phase E). Note: typescript-eslint type-checked rules are
> disabled in the package until typescript-eslint supports TypeScript 6.

| #   | Work                                                                                                                                                                                                                                               | Done when                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| D.1 | Parity audit against the shipped Explorer: posture-brief copy (brief-renderer output), ISM source controls + coverage views, strategy/plan-lens/change-record views, obligations/summary donuts. Port or consciously retire each with a note here. | Parity table complete; no silent feature loss.     |
| D.2 | Relationship surface: confirm the Cytoscape map + board mode covers ADR 0010 expectations for bundle-sourced relationships (Direction → Requirement → Risk → Action chains).                                                                       | Map renders bundle relationships; deep links work. |
| D.3 | AU English and label audit across all views; date/time display in local-friendly format; compact pills/chips reviewed for wrapping and overflow.                                                                                                   | Copy audit checklist complete.                     |
| D.4 | Accessibility and performance: keep the axe-core Playwright checks and perf budget as blocking package gates.                                                                                                                                      | Both run in CI and pass.                           |

## Phase E — Cutover and retirement 🔲

| #   | Work                                                                                                                                                                                                                                         | Done when                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| E.1 | Rename `packages/explorer-next` → `packages/explorer` (`pspf-explorer`); delete the legacy static generator (`scripts/build-static.mjs` app portions) and plain-DOM app code. Keep sample-bundle generation and schema snapshot publication. | One Explorer package; root gates green.                        |
| E.2 | Wire `web-release.yml` to the Vite build (`base` path `/explorer/`), reuse existing smoke tests or replace with the imported Playwright suite against the built artefact.                                                                    | Test-web deploy verified at `test.tobyharvey.online/explorer`. |
| E.3 | Version and axes: bump product version (minor); bump `schemaVersion`/`bundleVersion` only if the interop work changed the published contract, per ADR 0012 publication flow.                                                                 | `release:readiness` passes.                                    |
| E.4 | Documentation: update `explorer-screen-workflow-spec.md`, `pspf-spec-consistency-index.md`, `.github/copilot-instructions.md` (stack description), and mark ADR 0084 implemented.                                                            | Docs match reality.                                            |
| E.5 | Archive `MegaTobyOne/pspfexplorer2` on GitHub with a README pointer to this repo (user action). Production web deploy.                                                                                                                       | Old repo read-only; production serves the unified Explorer.    |

## Risks and mitigations

- **Toolchain divergence** (TS 6, ESLint 10, Vite 8 vs root TS 5.8, ESLint 9): contain
  package-locally in Phase A; converge or upgrade root before Phase E. Watch for TS 6 syntax
  leaking into shared packages.
- **Dataset drift**: two PSPF datasets exist until B.2; no fact fixes land in the app copy —
  curator workflow only.
- **Interop scope creep**: pspfexplorer2's GRC capture, work log, and import-planning features
  may tempt schema changes. Any new bundle collection or field needs its own ADR first.
- **Local-data expectations**: both apps' browser-local stores start clean at cutover; release
  notes must tell users to export local changes beforehand.
- **Licensing/attribution**: PSPF 2025 source text in the snapshot must pass the existing
  reference-data attribution gates when reconciled in B.1.

## Open questions

1. Does the standalone-authoring mode (no bundle loaded) remain a first-class mode after
   unification, or does the unified Explorer require a bundle for anything beyond evaluation?
   (Current lean: keep it — it is the "home user" story and costs little.)
2. Should saved views and list preferences be included in the round-trip export, or remain
   device-local? (Current lean: device-local.)
3. Root toolchain upgrade (TS 6 / ESLint 10) before or after cutover?
