# PSPF

PSPF is the Australian Government's Protective Security Policy Framework, administered by the Department of Home Affairs. This product helps Australian entities assess and report against PSPF requirements and the ASD Essential Eight, locally and offline.

This repository is starting with the v0.1 working slice: PSPF Core, PSPF Workshop, and PSPF Explorer publication mode. Shop, Pub, Explorer local-authoring mode, editable posture, Action Impact ranking, and plan-apply imports are deferred to v0.2+.

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

The first manual user-validation path is captured in `validation-scenario-1-operator-workflow.md`.

## Debug Slice

Use the VS Code launch configuration `Run PSPF Core + Workshop` to open `debug-workspace/` in an Extension Host. The first validation scenario is:

The debug workspace opts into `pspf.core.initialiseOnActivation`, so `.pspf/` is prepared when the Extension Host starts. The manual `PSPF: Initialise PSPF Workspace` command is still available and idempotent, but you should not need it for the debug launch.

For a clean manual run, close the Extension Host and run `npx pnpm@10.10.0 run debug:reset` from the repository root before relaunching.

1. `PSPF: Create Requirement`
2. `PSPF: Attach Evidence to Requirement`
3. `PSPF: Create Action`
4. `PSPF: Create Risk`
5. `PSPF: Open Assessment Dashboard`
6. `PSPF: Open Evidence Review Queue`
7. `PSPF: Open Item Detail`
8. `PSPF: Copy Posture Brief`
9. `PSPF: Validate Workspace`
10. `PSPF: Verify Integrity`
11. `PSPF: Create Snapshot`
12. `PSPF: Export Master Bundle`
13. `PSPF: Show Writer Lock`

Open `packages/explorer/dist/index.html` in a browser and select the exported `debug-workspace/.pspf/exchange/exports/export-*/bundle.json` file. The Explorer validation panel should pass, and the Requirements table should show the PSPF domain label rather than a raw domain ID.

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

This runs e2e, gates, debug validation, AU-English lint, and writes `.tmp/release-readiness/v0.1-readiness-report.md`. When the report shows all gates passing, the slice is ready for manual operator validation using `validation-scenario-1-operator-workflow.md`.