# PSPF

PSPF is the Australian Government's Protective Security Policy Framework, administered by the Department of Home Affairs. This product helps Australian entities assess and report against PSPF requirements and the ASD Essential Eight, locally and offline.

This repository currently implements the v1.8.0 initial assurance user-testing slice: PSPF Core, PSPF Workshop, PSPF Explorer publication mode, workspace tags for Requirements, Explorer tag filtering, Explorer Requirements saved views, Explorer browser-local Requirement status overlays, Explorer browser-local evidence references, Explorer browser-local Actions, Explorer browser-local Risks, local status conflict display, Workshop import review for Explorer local JSON, plan/review/apply import with last-import undo, browser-refresh bundle restore, and distinct Workshop/Explorer identity passes. Shop, Pub, editable posture, chart image export, per-user/private tags, tag hierarchies, tagging non-Requirement entities, saved views outside Requirements, and compliance-history export controls remain deferred.

Current user-facing improvements include sample workspace loading, Direction and ISM mapping review, Action Impact summaries, compact Workshop edit tabs, AU-formatted due dates, save-and-close edit actions, Tag Manager and Requirement tag rails, Explorer Requirements saved views, a cooler Workshop system-of-record identity, a proper Workshop import review surface, and a warmer Explorer portable assurance view with collapsible sections and tag filters.

## Local Setup

```sh
corepack enable
pnpm install
pnpm doctor
pnpm lint
pnpm typecheck
pnpm test
pnpm run e2e:v0.1
pnpm run check:gates
pnpm run release:readiness
```

The implementation plan is governed by `adr/0014-v0-1-thin-slice.md` and the release gates in `pspf-acceptance-and-quality-gates.md`.

The standing branch, test, and deploy flow is documented in `pspf-developer-pipeline-spec.md` under `Standing branch, test, and deploy flow`. Use it before each change, release-candidate promotion, production release, and hotfix.

The first manual user-validation path is captured in `validation-scenario-1-operator-workflow.md`.

## Debug Slice

Use the VS Code launch configuration `Run PSPF Core + Workshop` to open `debug-workspace/` in an Extension Host. The first validation scenario is:

The debug workspace opts into `pspf.core.initialiseOnActivation`, so `.pspf/` is prepared when the Extension Host starts. The manual `PSPF: Initialise PSPF Workspace` command is still available and idempotent, but you should not need it for the debug launch. For the quickest validation path, use `PSPF: Load Sample Workspace` from Workshop Home before opening the dashboard or Explorer export.

For a clean manual run, close the Extension Host and run `npx pnpm@10.10.0 run debug:reset` from the repository root before relaunching.

1. `PSPF: Load Sample Workspace`
2. `PSPF: Open Assessment Dashboard`
3. `PSPF: Open Evidence Review Queue`
4. `PSPF: Open Item Detail`
5. `PSPF: Open Direction Detail`
6. Optional: create or edit a Requirement, Evidence, Action, Risk, Direction, or ISM mapping.
7. `PSPF: Copy Posture Brief`
8. `PSPF: Validate Workspace`
9. `PSPF: Verify Integrity`
10. `PSPF: Run Integrity Scan`
11. `PSPF: Create Snapshot`
12. `PSPF: Export Master Bundle`
13. `PSPF: Show Writer Lock`

Open `packages/explorer/dist/index.html` in a browser and select the exported `debug-workspace/.pspf/exchange/exports/export-*/bundle.json` file. Explorer should show a posture brief, donut with its status table directly underneath, collapsible record sections, top navigation that opens a target section, a `Close All` control, AU-formatted Action due dates, compact unresolved ISM IDs, and readable Relationships columns.

For v1.8.0 validation, create or apply a Requirement tag in Workshop, confirm it appears in Requirement Detail and `PSPF: Manage Tags`, export to Explorer, and confirm the Requirements and Relationships Board tag filters update the URL/session state. In Explorer Requirements, compose Search, status, and tag filters, save the view, reload the browser, apply the saved view, then export local JSON and confirm the bundle includes `saved-views`. Then open `Local Changes`, change one Requirement status, add one evidence reference, one Action, and one Risk for the same Requirement, refresh Explorer to confirm the latest bundle and local work restore automatically, import the local JSON through Core with `Plan, review, apply`, review the `PSPF Workshop Import Review` surface, apply the import, review the records in Workshop, test `Undo Import`, and then reset local data. The exported JSON remains the standard master bundle format with `generator.mode` set to `local-authoring`.

## Headless v0.1 E2E

Run the automated v0.1 path with:

```sh
npx pnpm@10.10.0 run e2e:v0.1
```

The script creates `.tmp/e2e-v0.1-workspace`, initialises Core, authors one requirement with evidence, action, risk, and links, creates a snapshot, exports a master bundle, validates the manifest and collections against Draft 07 schemas, verifies manifest hashes, and checks that sensitive working notes are not published.

It also imports the exported master bundle into `.tmp/e2e-v0.1-import-workspace` using full-replace mode and validates the restored counts.

The command prints the generated `bundle.json` path. Open `packages/explorer/dist/index.html`, select that bundle, and check that Explorer shows:

- Posture Brief counts: 1 requirement, 1 evidence item, 1 action, and 1 risk.
- Requirements: `Validate governance reporting workflow`.
- Evidence: `Governance committee terms of reference`.
- Actions: `Confirm next governance review date`.
- Risks: `Governance review evidence may become stale`.
- Relationships Board: three links from the requirement to evidence, action, and risk.
- Explorer navigation: collapsed record sections that open from the top buttons and collapse via `Close All`.
- Actions: due dates displayed in short AU format.

## Manual Debug Validation

After running the Extension Host flow and exporting a master bundle, validate the latest debug export with:

```sh
npx pnpm@10.10.0 run validate:debug-workspace
```

The command finds the latest `debug-workspace/.pspf/exchange/exports/export-*/bundle.json`, verifies the export integrity and personal-data exclusion gates, and writes a report under `debug-workspace/.pspf/reports/`.

## Current Hardening Checks

- `pnpm test` builds the workspace and runs the contracts publication-policy tests.
- `pnpm run e2e:v0.1` runs the first complete automated Core to Explorer bundle validation path.
- `pnpm run validate:debug-workspace` validates the latest bundle produced by manual Extension Host testing.
- `pnpm run validate:export -- <export-directory|bundle.json>` validates a specific export path, including manifest/collection schema validation.
- `pnpm run check:accessibility` scans Explorer with Playwright and axe-core and fails on serious or critical findings.
- `pnpm run check:explorer-publication` builds Explorer and checks validation, section navigation, collapsed panels, `Close All`, AU Action dates, compact ISM IDs, wide layout usage, and readable table columns.
- `pnpm run check:explorer-local-authoring` builds Explorer and checks IndexedDB status persistence, saved-view persistence/application/export, remembered-bundle refresh restore, local evidence references, local Actions, local Risks, local-vs-bundle display, local conflict display, local JSON export, reset, and personal-data exclusion.
- `pnpm run check:explorer-to-workshop-import` builds Explorer, exports local-authoring JSON, imports it through Core, and checks Workshop-visible local status, evidence, Actions, Risks, saved views, and links.
- `pnpm run check:writer-lock` confirms a simulated second writer blocks writes.
- `pnpm run check:backup-restore` restores a copied `.pspf` workspace and verifies integrity plus Core validation.
- `pnpm run check:schema-coverage` confirms every v0.1 Explorer collection has a Draft 07 schema file and validates the standard fixture with AJV.
- `pnpm run check:schema-policy` confirms every v0.1 entity type has explicit publication metadata and the standard fixture sanitises cleanly.
- `pnpm run check:personal-data` confirms published fixtures and debug exports do not contain `Person.name`, `Person.email`, or `Assignment.personId`.
- `pnpm run check:gates` runs schema-policy, schema-validation coverage, and personal-data gates together.
- `pnpm run debug:reset` removes `debug-workspace/.pspf` for a clean manual validation run. It is intentionally limited to the debug workspace.

## Release Readiness

Run:

```sh
npx pnpm@10.10.0 run release:readiness
```

This runs e2e, gates, debug validation, AU-English lint, and writes `.tmp/release-readiness/v1.8.0-readiness-report.md`. When the report shows all gates passing, continue manual operator validation using `validation-scenario-1-operator-workflow.md`.

## Planning Notes

- v1.4 validated Explorer local Risks, local status conflict display, and the Explorer-to-Workshop round trip.
- v1.5 validates `plan-apply`, conflict classification, explicit apply confirmation, and last-import undo.
- v1.5.1 records the Workshop/Explorer product boundary, restores the latest Explorer bundle after refresh, and gives Explorer a warmer portable-assurance visual identity.
- v1.6 adds the proper Workshop import review surface for Explorer local JSON and gives Workshop its system-of-record identity treatment.
- v1.7 adds first-class workspace tags for Requirements, `tagged-with` links, default-deny tag publication policy, by-tag export indexes, Workshop tag management, and Explorer tag filtering.
- v1.8 adds durable Explorer Requirements saved views, persisted in browser-local storage and round-tripped through local-authoring bundles as `saved-view` records in `saved-views`. Saved views outside Requirements and compliance-history export controls remain deferred.
- Posture editing remains out of scope unless deliberately reopened.