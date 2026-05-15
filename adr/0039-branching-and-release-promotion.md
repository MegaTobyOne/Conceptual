# 0039 - Branching and release promotion

- Status: accepted
- Date: 2026-05-15

## Context

The first public deployment path is now real enough that continuing direct work on `main` creates avoidable risk. ADR 0038 defines VentraIP-only web deployment, Marketplace publishing under `tobyharvey`, and human approval for production web and Marketplace release jobs. The repository now needs a branch model that makes those deployment gates meaningful.

The previous pipeline wording treated `main` as both the releasable branch and the day-to-day branch. That is too loose once pushes can trigger deployment workflows.

## Decision

Use a three-level promotion model:

1. **Feature branches** for day-to-day work.
2. **`develop`** as the integration branch and automatic test-deploy source.
3. **`main`** as the protected release branch and tag source only.

### Branch rules

- Do not commit directly to `main`.
- Do not commit directly to `develop` except for emergency maintainer repair where a PR is impossible.
- Feature branches are named by intent, for example `feature/web-release-workflow`, `fix/deploy-smoke-check`, `docs/marketplace-runbook`, or `hotfix/web-rollback`.
- Normal changes merge by PR into `develop` after CI passes.
- Release candidates merge from `develop` into `main` by PR after `release:readiness` passes.
- Release tags are cut only from `main`.

### Deployment mapping

- Push to `develop`: automatic deploy to `test.tobyharvey.online` through the `test-web` environment.
- Push or PR to `develop`/`main`: CI only.
- Tag `explorer/<version>` from `main`: production web deploy to `tobyharvey.online`, requiring `production-web` approval.
- Tag `core/<version>` from `main`: Core Marketplace publish, requiring `marketplace` approval.
- Tag `workshop/<version>` from `main`: Workshop Marketplace publish, requiring `marketplace` approval.

### Hotfix flow

For urgent production defects:

1. Branch from `main` as `hotfix/<short-name>`.
2. Apply the smallest fix.
3. PR into `main` with focused gates.
4. Cut the relevant release tag from `main`.
5. Merge `main` back into `develop` after release so integration does not drift.

## Consequences

- `main` becomes boring and releasable, which is exactly what production deployment needs.
- `develop` gives us automatic test deployment without coupling every day-to-day merge to production readiness.
- Release tags become auditable promotion points, not accidental side effects of normal work.
- GitHub branch protection must be configured for both `main` and `develop`.
- The workflow triggers and pipeline spec must use `develop` for test deployment and reserve `main` for release PRs and tags.
