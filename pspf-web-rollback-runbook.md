# PSPF Web Rollback Runbook

## Purpose

Restore `tobyharvey.online` or `test.tobyharvey.online` to a previous static web release after a bad deploy, broken route, header issue, or accidental content problem.

This runbook applies only to the VentraIP-hosted public landing page and Explorer SPA. Marketplace rollback is handled through VS Code extension version management and corrective patch releases.

## Scope

In scope:

- `tobyharvey.online` production web host.
- `test.tobyharvey.online` test web host.
- Static files deployed by `.github/workflows/web-release.yml`.
- Release directories under `~/apps/pspf-web-<env>/releases/<release-id>/`.

Out of scope:

- `.pspf/` operator workspaces.
- SQLite backup and restore.
- Marketplace extension rollback.
- Any user-owned local Explorer data stored in a browser.

## Preconditions

Before the first production deploy, confirm:

1. The VentraIP SSH username is available.
2. SSH/SFTP access works on port `2683` using the relevant deploy key.
3. The production app directory exists, for example `~/apps/pspf-web-prod`.
4. The test app directory exists, for example `~/apps/pspf-web-test`.
5. Each app directory contains `releases/` and a `current` symlink after at least one deploy.
6. The document root path for each hostname is known.

## Rollback Triggers

Rollback immediately if any of these occur after deployment:

- The root page fails to load.
- `/explorer/` fails to load.
- Static assets return 404 or wrong MIME types.
- Security headers are missing or materially weaker than expected.
- Deployment safety, personal-data, or redaction checks are later found to have been bypassed.
- Public content is wrong enough that a patch-forward would take longer than restoring the previous release.

## Standard Rollback Procedure

Use the production values for production and test values for test.

1. SSH to VentraIP:

   ```sh
   ssh -p 2683 <ssh-user>@s04le.syd7.hostingplatform.net.au
   ```

2. Move into the app directory:

   ```sh
   cd ~/apps/pspf-web-prod
   ```

3. List available releases:

   ```sh
   ls -1 releases
   readlink current
   ```

4. Choose the previous known-good release ID.

5. Repoint `current`:

   ```sh
   ln -sfn releases/<previous-release-id> current
   ```

6. Sync `current` into the document root:

   ```sh
   rsync -a --delete current/ <document-root>/
   find <document-root> -type d -exec chmod 755 {} \;
   find <document-root> -type f -exec chmod 644 {} \;
   ```

7. Verify the root and Explorer routes:

   ```sh
   curl --fail --location https://tobyharvey.online/ >/dev/null
   curl --fail --location https://tobyharvey.online/explorer/ >/dev/null
   ```

8. Record the rollback in the release notes or incident log with:

   - time of rollback,
   - bad release ID,
   - restored release ID,
   - trigger,
   - verification result.

## Emergency Disable Procedure

If no previous release is acceptable, replace the document root with a minimal static holding page that contains no user data and no bundle data. Keep it short and plain: product name, maintenance status, and contact path.

Do not copy workspace files, logs, debug exports, VSIX files, `.env` files, or raw bundles into the document root during emergency handling.

## Post-Rollback Actions

1. Keep the bad release directory for inspection unless it contains sensitive content.
2. If sensitive content reached the public document root, remove it from the host and treat the event as a security incident under `pspf-secrets-rotation-and-incident-runbook.md`.
3. Re-run `pnpm run build:web-release`, `pnpm run check:deployment-safety`, `pnpm run check:personal-data`, and `pnpm run lint` before attempting another deploy.
4. Patch forward through the normal workflow once the cause is understood.
