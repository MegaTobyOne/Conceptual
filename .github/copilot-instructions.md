# PSPF Repository Instructions

This repository implements the PSPF v0.1 working slice for initial Australian Government assurance user validation. Keep agent guidance concise and link to the specs rather than repeating them.

## First Checks

- Read `adr/0014-v0-1-thin-slice.md` before scope decisions. v0.1 is Core, Workshop, and Explorer publication mode only.
- Read `pspf-acceptance-and-quality-gates.md` before claiming a slice is done.
- Read `pspf-developer-pipeline-spec.md` before branch, promotion, release, or deployment work; follow its standing branch, test, and deploy flow.
- Use `pspf-spec-consistency-index.md` to find the owner spec for a topic instead of guessing.
- The docs have not yet been mechanically moved into `docs/`; current authoritative specs still live at the repo root and `adr/`.

## Current Workspace

- Package manager: pnpm workspaces, pinned by `packageManager` in `package.json`.
- Packages in scope: `packages/contracts`, `packages/core`, `packages/workshop`, and `packages/explorer`.
- Deferred package folders: `packages/shop` and `packages/pub` contain deferral notes only for v0.1.
- Per-version Explorer schemas live under `schemas/explorer-bundle/<schemaVersion>/`.

## Commands

- Install: `corepack enable && pnpm install`. If `corepack` or global `pnpm` is unavailable, use `npx pnpm@10.10.0 install`.
- Environment check: `pnpm run doctor` or `npx pnpm@10.10.0 run doctor`. Do not use bare `pnpm doctor`; that invokes pnpm's own command.
- Lint: `pnpm lint`.
- Typecheck: `pnpm typecheck`.
- Build/test all packages when implemented: `pnpm build` and `pnpm test`.

## Governing Specs

- `adr/0013-monorepo-source-layout.md` for repository layout and tooling.
- `pspf-invariants.md` for machine-checkable names, paths, versions, and privacy invariants.
- `pspf-glossary.md` for terminology, AU-English spelling, and UI labels.
- `pspf-security-redaction-controls.md` and `adr/0005-redaction-default-deny.md` for publication policy and redaction behaviour.
- `pspf-entity-link-spec.md` for canonical entity, ID, and link rules.
- `pspf-explorer-json-bundle-schema-spec.md`, `adr/0009-explorer-single-master-bundle.md`, and `adr/0012-explorer-schema-publication.md` for the master export bundle and schema contract.
- `pspf-core-workshop-screen-workflow-spec.md`, `explorer-screen-workflow-spec.md`, and `pspf-vscode-extension-surface-spec.md` for product surfaces and workflows.

## Implementation Rules

- Build v0.1 only unless a task explicitly says otherwise: Core, Workshop, and Explorer publication mode.
- Keep Shop, Pub, Explorer local-authoring mode, Action Impact ranking, editable posture, chart image export, and `plan-apply` import deferred to v0.2+.
- Use AU English in user-facing copy. Code identifiers and JSON keys may use ecosystem-standard US English where appropriate.
- Treat all data as sensitive by default. Every schema field must declare `publication`; missing policy is a failure.
- Never emit `Person.name`, `Person.email`, `Assignment.personId`, restricted fields, or non-public free text in snapshots, export bundles, Explorer artefacts, or external logs.
- Use the three compatibility axes only: `schemaVersion`, `bundleVersion`, and `apiVersion`.
- Use the single manifest-led master bundle format for Explorer exchange. Do not reintroduce retired prototype format tags.
- Prefer small, testable vertical increments that preserve the operator spine: initialise workspace, author evidence-backed assessment data, snapshot, export, view in Explorer, copy posture brief.