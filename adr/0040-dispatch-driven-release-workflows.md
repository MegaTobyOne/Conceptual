# 0040 - Dispatch-driven release workflows (web and marketplace)

- Status: accepted
- Date: 2026-05-16

## Context

ADR 0038 established VentraIP-only web hosting and Marketplace publishing under `tobyharvey`, with `production-web` and `marketplace` GitHub environments as the human approval gates. ADR 0039 added a three-level branch model that reserves `main` for release.

The first release pipelines (`explorer-production-tag.yml`, `web-release.yml`, `core-release.yml`, `workshop-release.yml`) used hand-cut `explorer/<v>`, `core/<v>`, and `workshop/<v>` tags as the *trigger* for production deploys and Marketplace publishes. In practice this proved fragile:

- A failed release run freezes the workflow file at the tagged commit; subsequent fixes on `main` cannot reach that tag, so each retry needs a new tag.
- Tags accumulated in the repo for releases that never actually shipped.
- Two near-identical Marketplace workflows duplicated 95% of their steps with no shared composite action.
- There was no cheap way to validate the pipeline end-to-end without performing a real publish or deploy.
- The pipelines were uncached, so every run re-installed pnpm and Playwright Chromium, slowing readiness and adding flake.

The web pipeline was refactored first (single dispatch-driven `web-release.yml` with a `ventraip-deploy` composite action) and proved out the model on the first production deploy to `tobyharvey.online`.

## Decision

Drive Marketplace publishing and Explorer production deploys from `workflow_dispatch` on `main`. Tags become **receipts** created by the workflow after a successful publish or deploy, not triggers.

### Marketplace pipeline

- Single `marketplace.yml` workflow with inputs `target=core|workshop|both` and `dry_run` (default `true`).
- Build job on `ubuntu-latest`: caches pnpm store and Playwright browsers, runs `release:readiness`, `package:check`, `bundle:extensions`, packages the requested VSIX(es) via `@vscode/vsce`, uploads them as an artefact.
- Per-package publish jobs (`publish-core`, `publish-workshop`) gated by `environment: marketplace`. Each downloads the artefact, runs `vsce publish` with `VSCE_TOKEN`, then creates the `core/<version>` or `workshop/<version>` tag and a GitHub release with the VSIX attached.
- `dry_run=true` skips the publish, tag, and GitHub release; it still builds, packages, and uploads the VSIX artefact for human inspection. Dry runs may be dispatched from any branch; real publishes refuse to run unless `github.ref == 'refs/heads/main'`.
- For the first publish Core must ship before Workshop because `pspf-workshop` declares `extensionDependencies: ["tobyharvey.pspf-core"]`. Sequence: `target=core`, wait green, then `target=workshop`.

### Web pipeline

- `web-release.yml` triggers on push to `develop` (auto test deploy) and `workflow_dispatch` with `target=test|production`. Tag trigger is removed.
- Production deploy is gated by `environment: production-web`.
- The legacy `explorer-production-tag.yml` workflow is retired.

### Shared properties

- Build once on a GitHub-hosted runner, upload artefact, deploy or publish from a separate environment-gated job.
- pnpm store and Playwright Chromium are cached via `actions/cache@v4` keyed on `pnpm-lock.yaml`.
- Concurrency is keyed by target so a `core` publish does not block a `workshop` publish.
- Approval lives in the GitHub environment configuration (`Required reviewers`), not in the workflow file.

## Consequences

- Retrying a failed publish or deploy no longer requires a new tag; just re-dispatch the workflow.
- The release history visible on GitHub (releases + tags) reflects only what actually shipped.
- One workflow file owns both extension publishes, with per-package approval still possible via separate environment prompts.
- `dry_run` gives a safe way to validate the publish path without burning a Marketplace version.
- `explorer-production-tag.yml`, `core-release.yml`, and `workshop-release.yml` are deleted.
- Branch protection on `main` plus the per-environment reviewer rule is now the only thing standing between a click in the Actions UI and a production publish; both must remain configured.
- Future Shop and Pub extensions (v0.2+) extend `marketplace.yml` by adding `target` options and matching `publish-<name>` jobs rather than new workflow files.

## References

- ADR 0038 - first deployment baseline (VentraIP + Marketplace publisher `tobyharvey`).
- ADR 0039 - branching and release promotion.
- `.github/workflows/marketplace.yml`, `.github/workflows/web-release.yml`.
- `.github/actions/ventraip-deploy/action.yml`.
