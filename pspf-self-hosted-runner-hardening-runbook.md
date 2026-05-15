# PSPF Self-Hosted Runner Hardening Runbook

## Purpose

Run the VentraIP deployment step from a controlled macOS host with a stable allowlisted IP, without turning the maintainer workstation into a general CI execution surface.

This runbook applies to the self-hosted GitHub Actions runner named `pspf-runner`, labelled `mechastopheles`, and used by `.github/workflows/web-release.yml`.

## Design Decision

Use the self-hosted runner only for the VentraIP SSH deploy jobs. Build, lint, redaction, personal-data, deployment-safety, package-shape, and release-readiness checks continue to run on GitHub-hosted runners before the deploy artefact is handed to the self-hosted runner.

The runner must use a dedicated label:

```text
mechastopheles
```

The workflow targets:

```yaml
runs-on: [self-hosted, macOS, mechastopheles]
```

Do not use this label for pull-request build, test, or review jobs.

## Why GitHub Warns About Public Repositories

Self-hosted runners execute workflow code on your machine. In a public repository, a malicious pull request can try to run arbitrary commands if workflows are configured to use self-hosted runners for PR events.

For PSPF, the mitigation is architectural:

- self-hosted runner jobs are deploy-only,
- deploy jobs are gated by branch/tag conditions,
- production deploys require GitHub environment approval,
- secrets are environment-scoped,
- build artefacts are produced before the runner is used,
- pull-request checks must not target `self-hosted`.

## macOS Host Baseline

Use the dedicated macOS user account `pspf-runner` for the runner.

Recommended account controls:

- standard user, not administrator,
- FileVault enabled on the Mac,
- separate password from the primary user,
- no iCloud, Mail, Messages, browser sync, or personal keychains,
- no saved GitHub, VentraIP, banking, or personal credentials,
- automatic screen lock enabled,
- remote login limited to trusted local administration needs,
- macOS firewall enabled,
- OS updates applied promptly.

Do not run the GitHub runner from your main daily user account.

## GitHub Runner Configuration

Create the runner at repository scope unless a future organisation-level runner group is introduced.

Use labels similar to:

```text
self-hosted
macOS
mechastopheles
```

Use `pspf-runner` as the GitHub runner name. The workflow does not target the runner name directly; it targets the `mechastopheles` label.

Runner configuration requirements:

- assign the runner only to this repository,
- do not give it broad organisation access,
- do not add generic labels such as `deploy` if they might be reused accidentally,
- keep only one purpose-specific runner online for VentraIP deploys,
- remove the runner immediately if the Mac is lost, replaced, or suspected compromised.

## Local Filesystem Layout

Install the runner under the dedicated user's home directory, for example:

```text
/Users/pspf-runner/actions-runner
```

Keep the runner working directory separate from the developer checkout. Do not point the runner at `/Users/toby/Dev/Conceptual`.

The runner must not contain long-lived copies of:

- `.pspf/` workspaces,
- debug exports,
- `.env` files,
- Marketplace tokens,
- VentraIP private keys outside GitHub environment secrets,
- VSIX signing or publishing tokens.

## Network Allowlisting

Allowlist the Mac's current public IP in VentraIP VIPcontrol for SSH/SFTP on port `2683`.

If the public IP changes often, use one of these instead:

- a static IP service from the ISP,
- a small fixed-IP deployment bridge,
- a VPN with a fixed egress IP.

Do not attempt to allowlist all GitHub-hosted Actions ranges for this project; the range list is large and changes over time.

## GitHub Environments and Secrets

Keep the existing environment split:

| Environment | Secret | Purpose |
|---|---|---|
| `test-web` | `VENTRAIP_DEPLOY_KEY_TEST` | Test SSH deploy key |
| `production-web` | `VENTRAIP_DEPLOY_KEY_PROD` | Production SSH deploy key |

Required environment variables remain:

- `SITE_URL`,
- `VENTRAIP_SSH_USER`,
- `VENTRAIP_SSH_HOST`,
- `VENTRAIP_APP_DIR`,
- `VENTRAIP_DOCROOT`.

Production must require manual reviewer approval. Test may deploy automatically from `develop`.

## Workflow Rules

Allowed on the self-hosted runner:

- downloading the already-built web artefact,
- opening SSH to VentraIP,
- uploading static files,
- updating the release symlink,
- syncing to the document root,
- running deployment `curl` checks.

Not allowed on the self-hosted runner:

- pull-request builds,
- arbitrary tests,
- dependency installation from unreviewed PRs,
- Marketplace publishing,
- secret scanning,
- source generation,
- package manager cache priming.

## Operational Procedure

1. Create the dedicated macOS user.
2. Download and configure the GitHub Actions runner from the repository settings.
3. Assign the `mechastopheles` label.
4. Install it as a launchd service for that user.
5. Confirm the runner appears as online in GitHub.
6. Allowlist the Mac public IP in VentraIP.
7. Prefer absolute VentraIP paths in GitHub environment variables, for example `/home/<ssh-user>/apps/pspf-web-test`. The workflow normalises `~/...` against the remote account home, but absolute paths are easier to diagnose.
8. If the runner is not installed as a launchd service, start it manually from the dedicated runner account before validation:

   ```sh
   su - pspf-runner
   cd github-runner
   ./run.sh
   ```

9. Test SSH from the runner user:

   ```sh
   ssh -p 2683 <ventra-user>@s04le.syd7.hostingplatform.net.au
   ```

10. Trigger a manual `web-release` deployment to `test`.
11. Confirm `https://test.tobyharvey.online/` and `https://test.tobyharvey.online/explorer/` load.

## Incident Response

Immediately remove the runner from GitHub and rotate VentraIP deploy keys if:

- the Mac is lost or stolen,
- the runner user account is used interactively for unrelated work,
- an unexpected workflow runs on the self-hosted runner,
- a deploy job prints secrets,
- the runner workspace contains sensitive PSPF data,
- the repository is made public before branch and runner protections are rechecked.

After removal, delete the runner directory and reinstall from a fresh GitHub runner token.

## Public Repository Check

Before making the repository public, verify:

- no PR workflow uses `self-hosted`,
- no `pull_request_target` workflow can reach the self-hosted runner,
- `production-web` and `marketplace` require approval,
- deploy secrets are environment-scoped,
- branch protection blocks direct pushes to `main`,
- Dependabot and CodeQL are enabled,
- the runner label is still unique to VentraIP deploys.