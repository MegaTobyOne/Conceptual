# 0038 - v1.0 first deployment baseline

- Status: accepted
- Date: 2026-05-15

## Context

The pipeline spec, ADR 0007, ADR 0012, ADR 0013, the threat model, the secrets rotation runbook, and `ventraip-secure-hosting-reference.md` had already decided most of the deployment model: four signed VSIX, per-package release tags `<package>/<version>`, per-`schemaVersion` immutable same-origin schemas, default-deny redaction, deployment-safety and personal-data gates, and a clean Marketplace/web credential separation.

What was not yet locked in was the concrete production target for the first deployment: which static host, which hostname, which Marketplace publisher, what level of human approval each channel requires, and where Open VSX sits. The threat model warned that public GitHub Pages is US-jurisdiction and not appropriate for Australian Government sensitive workloads (T07/T08/T09). Keeping two static-host paths open also doubled the operational surface for a single maintainer.

This ADR closes those open points so v1.0 has one approved deployment path end to end.

## Decision

The v1.0 first deployment uses a single public-facing host and a single Marketplace publisher with explicit human gates on anything that reaches production.

### Static web host

- **VentraIP cPanel only** for the public site. GitHub Pages is not used.
- The root of the primary domain serves `pspf-ecosystem.html` as the public landing page.
- `/explorer` serves the Explorer publication-mode SPA bundle from `packages/explorer/dist/`.
- Per-`schemaVersion` JSON Schemas are served same-origin under `/schemas/explorer-bundle/<schemaVersion>/` per ADR 0012.
- No user data, no `.pspf/` workspaces, no SQLite, no organisation-specific sensitive or restricted fields. Public PSPF and ISM reference content is permitted.

### Hostname and environments

- Primary domain: **`tobyharvey.online`** (production).
- Test subdomain: **`test.tobyharvey.online`** (staging).
- Fallback SFTP/SSH hostname for VentraIP: `s04le.syd7.hostingplatform.net.au`, SSH port 2683.
- VIPcontrol IP allowlisting on SSH/SFTP is required. Because GitHub-hosted Actions egress ranges are too broad and changeable for practical allowlisting, the final web deploy jobs run on a dedicated self-hosted macOS runner named `pspf-runner` and labelled `mechastopheles` from a stable allowlisted IP.

### Marketplace publishing

- VS Code Marketplace publisher: **`tobyharvey`**.
- VSIX targets for v1.0: Core and Workshop. Shop and Pub remain deferred per ADR 0014.
- Open VSX is **not** used for v1.0. Revisit after Marketplace stabilises; record as future ADR if adopted.

### Approval gates

- **Test web deploy**: automatic from `develop` after CI gates pass.
- **Production web deploy**: requires manual approval on a GitHub Actions environment named `production-web`.
- **Marketplace publish**: requires manual approval on a GitHub Actions environment named `marketplace`.
- Both production environments hold the relevant secrets and require reviewer approval before the job can run.

### Secrets

- `VENTRAIP_DEPLOY_KEY_TEST` and `VENTRAIP_DEPLOY_KEY_PROD` are separate SSH private keys, each authorised against a separate cPanel deploy key for the matching document root.
- `VSCE_TOKEN` is held only in the `marketplace` environment.
- No `OVSX_TOKEN` for v1.0.
- All secrets follow the 90-day rotation policy in `pspf-secrets-rotation-and-incident-runbook.md` and never leave GitHub Actions.

### Rollback

- **Web**: timestamped release directories under `~/apps/pspf-web-<env>/releases/<RELEASE>/` with a `current` symlink; rollback is repointing `current` to the previous release and re-syncing the document root. A short web rollback runbook is required before the first production deploy.
- **Marketplace**: end users can downgrade or pin the extension version in VS Code, so rollback tooling is intentionally minimal. The process is: unpublish the bad version through `vsce`, or publish a corrective patch version. Each VSIX is also attached to its GitHub release for re-install if needed.

### Deployment safety

Every deploy job runs `pnpm run check:deployment-safety` and `pnpm run check:personal-data` before transport. Production web and Marketplace jobs additionally require `pnpm run release:readiness` to have succeeded on the release tag.

Build, redaction, personal-data, deployment-safety, release-readiness, and package-shape checks run before the self-hosted deploy runner is used. The self-hosted runner is deploy-only and must not be used for pull-request checks or unreviewed code execution.

## Consequences

- One production host, one Marketplace publisher, one approval surface. Easier for a solo maintainer to operate and audit.
- The Australian-jurisdiction concern from the threat model (T09) is addressed by avoiding public US-hosted Pages.
- VentraIP becomes a hard dependency for the public site; its outages affect the public surface but not Core or Workshop, which are locally installed extensions.
- Adopting Open VSX later remains straightforward: add a second publish step gated by a new environment and `OVSX_TOKEN`. No structural change required.
- The pipeline spec, the VentraIP reference, and the secrets runbook must be updated to remove GitHub Pages as an active target and to record the chosen hostnames, publisher, and approval environments.

## Status of related decisions

- Confirms and narrows ADR 0007 (extension packaging) for the first cut: only Core and Workshop publish.
- Confirms ADR 0012 (per-version, same-origin, immutable schemas) on the chosen host.
- Confirms ADR 0013 (monorepo, per-package release tags) as the release-tag convention used by the new workflows.
- Confirms ADR 0014 (v0.1 thin slice) and ADR 0022/0028 (v1.0 scope) for product coverage.
- Supersedes the "GitHub Pages is the reference target" wording in `pspf-developer-pipeline-spec.md`; that spec is updated alongside this ADR.
