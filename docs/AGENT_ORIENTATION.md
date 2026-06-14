# Agent Orientation

Status: implemented

Use this short map before loading large root specifications. The goal is to find the smallest owning surface, nearby test, and authoritative spec for the task.

## Default Route

1. Start from the named file, command, failing test, or UI surface.
2. Prefer nearby tests and owning package code before broad repository search.
3. Load the full root spec only when the change touches its contract, policy, or workflow.
4. Keep local-first, default-deny publication, and AU-English user copy intact.

## Common Tasks

| Task                                                 | Start Here                                                                        | Read Full Spec When                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Core storage, import, export, snapshots, writer lock | `packages/core/src/service.ts`, `packages/core/src/service.test.ts`               | Storage path, bundle contract, migration, writer-lock, or import policy changes           |
| Shared entities, versions, redaction helpers         | `packages/contracts/src/index.ts`, package tests                                  | Entity shape, field publication, link taxonomy, or version axes change                    |
| Workshop UI and commands                             | `packages/workshop/src/extension.ts`, `packages/workshop/src/workshop-ui.test.ts` | New workflow, screen, command policy, or user-facing terminology change                   |
| Shop extension                                       | `packages/shop/src/extension.ts`, package tests                                   | Commercial entity contract or publication behaviour changes                               |
| Pub extension                                        | `packages/pub/src/extension.ts`, package tests                                    | People, role, team, assignment, or restricted personal-data behaviour changes             |
| Explorer app                                         | `packages/explorer/src`, `packages/explorer/src/**/*.test.ts`                     | Bundle compatibility, local-authoring, publication rendering, or schema behaviour changes |
| Connected View                                       | `packages/connected-view/src`, connected-view tests                               | Shared renderer contract or Explorer/Workshop parity changes                              |
| Webview shell/design primitives                      | `packages/webview-shell/src`, package tests                                       | Shared UI primitive, accessibility, or design-system behaviour changes                    |
| Reference data and ISM                               | `packages/reference-data`, `packages/ism-source-library`, source-hash scripts     | Baseline source, mapping, provenance, or drift gate changes                               |
| CI, release, Marketplace, web deploy                 | `.github/workflows/`, `scripts/run-release-gates.mjs`, `release-gates.json`       | Branch, promotion, release-readiness, Marketplace, or deployment behaviour changes        |
| Docs/spec consistency                                | Changed spec plus `pspf-spec-consistency-index.md`                                | Architecture, schema, API, workflow, publication policy, or pipeline behaviour changes    |

## Specs To Load Only When Needed

- `pspf-grand-plan.md`: roadmap, remediation, Graph, AI, assurance publishing, diagnostics, or release sequencing.
- `pspf-spec-consistency-index.md`: choosing the owner spec for cross-cutting changes.
- `pspf-acceptance-and-quality-gates.md`: claiming a slice complete or changing gates.
- `pspf-developer-pipeline-spec.md`: CI, release, Marketplace, branch, promotion, or deploy changes.
- `pspf-security-redaction-controls.md` and `adr/0005-redaction-default-deny.md`: exported, published, AI, Graph, Office, assurance, or externally visible data.
- `pspf-explorer-json-bundle-schema-spec.md`: master bundle shape, schema compatibility, import/export exchange.
- `pspf-entity-link-spec.md`: entity IDs, link taxonomy, canonical relationship rules.
- `pspf-glossary.md`: AU-English labels, terms, statuses, and vocabulary.

## Commands

- Install: `corepack enable && pnpm install`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Package tests: `pnpm test`
- Release readiness: `pnpm run release:readiness`
- Focused package test: `pnpm --filter <package-name> test`

## Context Hygiene

- Avoid loading `pnpm-lock.yaml`, generated reference data, `.tmp/`, `debug-workspace/`, `dist/`, coverage, Playwright reports, and versioned schema snapshots unless the task specifically concerns them.
- Use `rg`/targeted search and direct file reads over broad root-spec exploration.
- Prefer one focused validation command for the touched package before wider checks.
