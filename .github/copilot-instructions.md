# PSPF Repository Instructions

This repository implements the PSPF product ecosystem at v1.77.0: five frozen VS Code extensions, a unified Explorer web app, the browser workbench, shared packages, schemas, release tooling, and governing specifications. Keep agent guidance concise and link to the specs rather than repeating them.

## Current Direction (2026-10-05)

- The product is being reframed around the manager's three jobs — J1 capture from conversation, J2 answer ad hoc requests fast, J3 run the team — and towards one browser single-page application that replaces the five VS Code extensions. Read `adr/0101-product-reframe-managers-three-jobs.md`, `adr/0102-browser-first-workbench-supersedes-extensions.md` and `pspf-grand-plan.md` §"Product reframe and browser-first direction (2026-10-05)" before any product, roadmap or architecture work.
- Both ADRs were **accepted 2026-10-05**. The five extensions and dual-mode Explorer remain the shipped product until staged retirement completes; no extension is frozen or deleted ahead of ADR 0102 D8.
- C2–C6, O1–O3, the clean-start workbench design phases and the website/brand brief are **paused** (reason "superseded design centre"); do not resume a slice until its remaining behaviours have a destination or are recorded as no longer required. C0 and C1 are complete.
- Do not start new extension features, new Workshop commands, new Explorer entity routes or new surface-budget work. The first browser slice (`packages/workbench`, ADR 0103, v1.77.0) is implemented; no later slice is allocated. Favour documentation, the W0 owner trial and the W1 preparation items recorded in `pspf-grand-plan.md` §"Next build phases after the first workbench slice (2026-10-10)"; each later slice starts with its own accepted ADR.
- Tenant AI is in scope on the ADR 0101 D4 ladder; public models via personal keys remain out of scope. Every AI output is draft-and-confirm with recorded provenance.
- Team sharing is a requirement under the reframe; redaction applies at the team boundary. The invariants below still govern anything that leaves that boundary.

## First Checks

- For routine code changes, start with `docs/AGENT_ORIENTATION.md` to identify the smallest owning file, test, and spec before loading larger root specifications.
- Read `pspf-grand-plan.md` before roadmap, remediation, Graph, AI, assurance-publishing, CI, diagnostics, or release-sequencing work. It is the active forward plan; its first section records the 2026-10-05 reframe and the paused streams.
- Use `pspf-spec-consistency-index.md` to find the owner spec for a topic before changing architecture, schema, API, workflow, publication policy, or pipeline behaviour.
- Read `pspf-acceptance-and-quality-gates.md` before claiming a slice is done.
- Read `pspf-developer-pipeline-spec.md` before branch, promotion, release, CI, GitHub Actions, Marketplace, or web deployment work.
- Read `pspf-security-redaction-controls.md` and `adr/0005-redaction-default-deny.md` before changing exported, published, AI, Graph, Office, assurance, or externally visible data.
- Superseded host-specific records are archived under `docs/history/`; retained authoritative contracts remain at the repo root and `adr/`.

## Current Workspace

- Package manager: pnpm workspaces, pinned by `packageManager` in `package.json`.
- Current repo version: `1.77.0`; all workspace packages are expected to remain version-aligned. The extensions are frozen and not republished (ADR 0102 D8(i) amendment); `packages/workbench` (`pspf-workbench`) is the first browser-first slice per ADR 0103.
- Shipped VS Code extensions:
  - `packages/core` (`pspf-core`) — local system of record, workspace bootstrap, validation, snapshots, import/export, and Core command API.
  - `packages/assurance` (`pspf-assurance`) — assurance evidence and pentest-workbench surface.
  - `packages/workshop` (`pspf-workshop`) — authoring surface for requirements, evidence, actions, risks, strategy, posture, and reporting workflows.
  - `packages/shop` (`pspf-shop`) — commercial planning surface for suppliers, contracts, spend items, forecast review, and planned savings reporting.
  - `packages/pub` (`pspf-pub`) — people, role, team, assignment, and stakeholder relationship surface.
- Web surface:
  - `packages/explorer` (`pspf-explorer`) — unified Explorer web app (Vite + Lit, hash routing) for publication-mode review, browser-local authoring, and Core exchange round-trip per ADR 0084.
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
- `docs/history/README.md` for legacy extension and dual-mode Explorer records; ADR 0102 governs the browser-first product surface.

## Implementation Rules

- Preserve the local-first contract for the shipped extensions: the five VS Code extensions must remain fully usable with no network access while they remain the shipped product. Under the accepted reframe (ADR 0101/0102) the future browser workbench keeps browser-local storage and file-based exchange; publish-to-folder is its only integration, and Microsoft 365 or AI capability beyond that follows the ADR 0101 D4 ladder with organisational approval.
- Do not start Graph, AI, Office-output, or assurance-publishing implementation before the relevant ADRs are accepted.
- Use AU English in user-facing copy. Code identifiers and JSON keys may use ecosystem-standard US English where appropriate.
- Treat all data as sensitive by default. Every schema field must declare `publication`; missing policy is a failure.
- Never emit `Person.name`, `Person.email`, `Assignment.personId`, restricted fields, or non-public free text in snapshots, export bundles, Explorer artefacts, Graph payloads, AI prompts, Office documents, assurance publications, or external logs.
- Use the three compatibility axes only: `schemaVersion`, `bundleVersion`, and `apiVersion`.
- Use the single manifest-led master bundle format for Explorer exchange. Do not reintroduce retired prototype format tags.
- Prefer small, testable vertical increments that preserve the operator spine: initialise workspace, author evidence-backed assessment data, snapshot, export, view in Explorer, copy posture brief, and round-trip browser-local changes where applicable.
- When adding signing or encryption, use post-quantum-safe choices only, per `pspf-grand-plan.md`; the current ecosystem uses SHA-256 checksums but no encryption or signatures.
