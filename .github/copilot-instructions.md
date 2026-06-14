# PSPF Repository Instructions

This repository implements the PSPF product ecosystem at v1.42.0: four VS Code extensions, a static Explorer web app, shared packages, schemas, release tooling, and governing specifications. Keep agent guidance concise and link to the specs rather than repeating them.

## First Checks

- For routine code changes, start with `docs/AGENT_ORIENTATION.md` to identify the smallest owning file, test, and spec before loading larger root specifications.
- Read `pspf-grand-plan.md` before roadmap, remediation, Graph, AI, assurance-publishing, CI, diagnostics, or release-sequencing work. It is the active forward plan and deliberately fixes documentation truthfulness first.
- Use `pspf-spec-consistency-index.md` to find the owner spec for a topic before changing architecture, schema, API, workflow, publication policy, or pipeline behaviour.
- Read `pspf-acceptance-and-quality-gates.md` before claiming a slice is done.
- Read `pspf-developer-pipeline-spec.md` before branch, promotion, release, CI, GitHub Actions, Marketplace, or web deployment work.
- Read `pspf-security-redaction-controls.md` and `adr/0005-redaction-default-deny.md` before changing exported, published, AI, Graph, Office, assurance, or externally visible data.
- The docs have not yet been mechanically moved into `docs/`; current authoritative specs still live at the repo root and `adr/`.

## Current Workspace

- Package manager: pnpm workspaces, pinned by `packageManager` in `package.json`.
- Current repo version: `1.42.0`; all workspace packages are expected to remain version-aligned.
- Shipped VS Code extensions:
  - `packages/core` (`pspf-core`) — local system of record, workspace bootstrap, validation, snapshots, import/export, and Core command API.
  - `packages/workshop` (`pspf-workshop`) — authoring surface for requirements, evidence, actions, risks, strategy, posture, and reporting workflows.
  - `packages/shop` (`pspf-shop`) — commercial planning surface for suppliers, contracts, spend items, forecast review, and planned savings reporting.
  - `packages/pub` (`pspf-pub`) — people, role, team, assignment, and stakeholder relationship surface.
- Web surface:
  - `packages/explorer` (`pspf-explorer`) — static Explorer web app for publication-mode review and browser-local authoring/round-trip workflows.
- Shared packages: `packages/contracts`, `packages/reference-data`, `packages/ism-source-library`, `packages/brief-renderer`, `packages/connected-view`, and `packages/webview-shell`.
- Per-version Explorer schemas live under `schemas/explorer-bundle/<schemaVersion>/`.

## Commands

- Install: `corepack enable && pnpm install`. If `corepack` or global `pnpm` is unavailable, use `npx pnpm@10.10.0 install`.
- Environment check: `pnpm run doctor` or `npx pnpm@10.10.0 run doctor`. Do not use bare `pnpm doctor`; that invokes pnpm's own command.
- Lint: `pnpm lint`.
- Typecheck: `pnpm typecheck`.
- Build: `pnpm build`.
- Test all package tests: `pnpm test`.
- Full release readiness: `pnpm run release:readiness`.

## Governing Specs

- `pspf-grand-plan.md` for the active remediation and connected-capability sequence.
- `adr/0013-monorepo-source-layout.md` for repository layout and tooling.
- `pspf-invariants.md` for machine-checkable names, paths, versions, privacy invariants, and publication rules.
- `pspf-glossary.md` for terminology, AU-English spelling, and UI labels.
- `pspf-security-redaction-controls.md` and `adr/0005-redaction-default-deny.md` for publication policy and redaction behaviour.
- `pspf-entity-link-spec.md` for canonical entity, ID, and link rules.
- `pspf-explorer-json-bundle-schema-spec.md`, `adr/0009-explorer-single-master-bundle.md`, and `adr/0012-explorer-schema-publication.md` for the master export bundle and schema contract.
- `pspf-error-and-diagnostics-model.md` for the intended structured diagnostics model. Treat it as aspirational until Tranche 2 of `pspf-grand-plan.md` implements it.
- `pspf-core-workshop-screen-workflow-spec.md`, `explorer-screen-workflow-spec.md`, and `pspf-vscode-extension-surface-spec.md` for product surfaces and workflows.

## Implementation Rules

- Preserve the local-first contract: the four shipped VS Code extensions must remain fully usable with no network access. Any future Microsoft Graph, Teams, Outlook, or AI capability must be default-off, policy-controlled, and isolated from the existing offline-first workflows as described in `pspf-grand-plan.md`.
- Do not start Graph, AI, Office-output, or assurance-publishing implementation before the relevant ADRs and Tranche 0-2 prerequisites in `pspf-grand-plan.md` are satisfied.
- Use AU English in user-facing copy. Code identifiers and JSON keys may use ecosystem-standard US English where appropriate.
- Treat all data as sensitive by default. Every schema field must declare `publication`; missing policy is a failure.
- Never emit `Person.name`, `Person.email`, `Assignment.personId`, restricted fields, or non-public free text in snapshots, export bundles, Explorer artefacts, Graph payloads, AI prompts, Office documents, assurance publications, or external logs.
- Use the three compatibility axes only: `schemaVersion`, `bundleVersion`, and `apiVersion`.
- Use the single manifest-led master bundle format for Explorer exchange. Do not reintroduce retired prototype format tags.
- Prefer small, testable vertical increments that preserve the operator spine: initialise workspace, author evidence-backed assessment data, snapshot, export, view in Explorer, copy posture brief, and round-trip browser-local changes where applicable.
- When adding signing or encryption, use post-quantum-safe choices only, per `pspf-grand-plan.md`; the current ecosystem uses SHA-256 checksums but no encryption or signatures.
