# VentraIP secure hosting reference design

This design is intended for small static sites and single-page apps hosted on a VentraIP cPanel account, with builds performed externally and deployments pushed into a tightly controlled runtime environment.[cite:5][cite:14] For PSPF, this pattern is the **sole approved production static host** per ADR 0038: VentraIP serves the public landing page (`pspf-ecosystem.html`) at the site root and the Explorer publication-mode SPA under `/explorer`. Core and Workshop remain local-first VS Code extensions and are not hosted on VentraIP. GitHub Pages is not used.

## Pinned values for v1.0

| Setting | Value |
|---|---|
| Production host | `tobyharvey.online` |
| Test host | `test.tobyharvey.online` |
| Fallback SSH/SFTP hostname | `s04le.syd7.hostingplatform.net.au` |
| SSH port | `2683` |
| Production deploy key secret | `VENTRAIP_DEPLOY_KEY_PROD` (held in `production-web` environment) |
| Test deploy key secret | `VENTRAIP_DEPLOY_KEY_TEST` (held in `test-web` environment) |
| Production approval | Manual reviewer approval required on `production-web` |
| Test approval | Automatic from `develop` after CI gates pass |
| Marketplace publisher | `tobyharvey` |
| Marketplace token secret | `VSCE_TOKEN` (held in `marketplace` environment, manual approval) |
| Open VSX | Not used in v1.0 |
| Deploy runner | Self-hosted macOS runner labelled `mechastopheles` |

## PSPF fit assessment

VentraIP is a workable production host for the Explorer app shell because Explorer publication mode is static: it serves HTML, JavaScript, CSS, JSON schemas, and optionally a manifest-led JSON bundle. It is not the PSPF system of record, not a Core API host, and not a place to run Workshop, SQLite, package builds, long-running workers, or private collaboration services.

Recommended PSPF use:
- Host the primary public site and production Explorer shell on the primary domain.
- Host a separate test Explorer shell on a test subdomain, such as `test.<domain>` or `preview.<domain>`, before promoting to production.
- Publish PSPF and ISM source/reference text when it is already publicly available online and licence/attribution requirements are met.
- Publish organisation-specific bundles only after the deployment safety gate and the personal-data/redaction gates pass.

Do not publish:
- `.pspf/` workspaces, SQLite databases, snapshots, raw debug workspaces, source repositories, or package-manager caches.
- Any bundle containing fields marked `sensitive` or `restricted` by the schema publication policy.
- Personal data, including `Person.name`, `Person.email`, or `Assignment.personId`.
- Secrets, Marketplace tokens, deploy keys, `.env` files, private certificates, or VSIX release credentials.

## Architecture

The preferred pattern is to keep source control and CI/CD outside the hosting account, then deploy only built artifacts to VentraIP over SSH or SFTP.[cite:5][cite:14] VentraIP supports SSH and SFTP access with IP allowlisting through VIPcontrol, uses SSH port 2683, and supports Git repositories in cPanel.[cite:5][cite:2][cite:14]

Because VentraIP requires SSH/SFTP source IP allowlisting and GitHub-hosted Actions use a large changing set of outbound ranges, PSPF uses a dedicated self-hosted macOS GitHub Actions runner for the final deploy hop. The runner is labelled `mechastopheles` and is used only after the web artefact has been built and safety-checked. See `pspf-self-hosted-runner-hardening-runbook.md`.

| Layer | Recommended role |
|---|---|
| Source control | Private GitHub repository or equivalent.[cite:14] |
| Build | GitHub Actions or another CI runner that produces a static `dist/` or `build/` folder.[cite:14] |
| Deploy transport | SSH key authentication over VentraIP SSH/SFTP from the allowlisted self-hosted deploy runner.[cite:2][cite:5] |
| Runtime | cPanel document root for a subdomain, serving only compiled assets.[cite:14] |
| Scheduling | cPanel cron jobs only for small maintenance tasks, if required.[cite:3] |

## Environment model

Two web environments are used:

| Environment | Hostname | Purpose | Promotion rule |
|---|---|---|---|
| Test | `test.tobyharvey.online` | Validate new Explorer builds, schemas, headers, and sample bundles before release. | Automatic deploy from `develop` after CI gates pass. |
| Production | `tobyharvey.online` | Public landing page at root and Explorer SPA under `/explorer`. | Manual reviewer approval on the `production-web` GitHub Actions environment; only from a signed-off release tag. |

Test must use a separate document root and a separate deploy key (`VENTRAIP_DEPLOY_KEY_TEST`) so a failed preview deployment cannot overwrite production. Release directories are kept separate, for example `~/apps/pspf-web-test` and `~/apps/pspf-web-prod`.

## Secure baseline

Create one subdomain per app or site so each deployment has a separate document root and clearer operational boundaries.[cite:14] Enable SSL on every hostname and keep the account focused on hosting rather than mixing in unrelated workloads where possible.[cite:7][cite:10]

Recommended controls:
- Enable SSH/SFTP only for required source IPs via VIPcontrol.[cite:5]
- Use SSH keys rather than password-based shell access.[cite:2]
- Keep a separate deploy key per application.[cite:2]
- Keep separate deploy keys for test and production.
- Disable directory listing with `.htaccess`, for example `Options All -Indexes`.[cite:13]
- Keep the origin runtime static-first unless dynamic features are genuinely needed.[cite:14]
- Add security headers through `.htaccess`, including a same-origin content security policy for Explorer, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`.
- Cache hashed static assets longer than JSON data. Use conservative or no-store caching for hosted organisation-specific bundle data.

## Recommended directory model

A release-based layout makes rollback and audit simpler than deploying directly into the web root every time.[cite:14]

```text
/home/account/
  apps/
    example-app/
      releases/
        20260514-091500/
        20260515-102000/
      current -> releases/20260515-102000
  public_html/               # or separate subdomain document root
```

Where the hosting plan allows it, point the subdomain document root at the `current/` release path or deploy the `current` contents into the target docroot during promotion.[cite:14] This keeps the live path stable while allowing atomic-style release swaps at the filesystem level.[cite:14]

## Deployment workflow

The safest default is to build in CI and publish only generated assets to the host.[cite:5][cite:14] That avoids placing package managers, repository tokens, or full source trees on the cPanel account.[cite:14]

Suggested workflow:
1. Commit to the private repository.[cite:14]
2. CI installs dependencies and builds the app into `dist/`.[cite:14]
3. CI runs `pnpm run check:deployment-safety`, `pnpm run check:personal-data`, `pnpm run check:explorer-publication`, and the release gates relevant to the change.
4. CI connects over SSH using the environment-specific deploy key authorized in cPanel.[cite:2]
5. CI uploads the release into a timestamped directory using `rsync` or `scp` over SSH port 2683.[cite:5]
6. CI updates the `current` symlink or copies the built files into the document root.[cite:14]
7. CI runs a small verification step such as `curl` against the deployed URL.[cite:14]
8. Production promotion repeats the same process from the signed-off tag, not from an unreviewed working branch.

For PSPF Explorer, the deployable web artefact is `packages/explorer/dist/` plus any deliberately published static `schemas/` or vetted `data/` bundle files. A production deploy must not include `.pspf/`, `debug-workspace/`, `.tmp/`, source TypeScript, repository metadata, VSIX artefacts, or package-manager state.

## GitHub Actions example

The following workflow assumes a static build and SSH deployment to VentraIP over port 2683.[cite:5][cite:2]

```yaml
name: Deploy static site to VentraIP

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Start ssh-agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VENTRAIP_DEPLOY_KEY }}

      - name: Add host to known_hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -p 2683 your-server-hostname >> ~/.ssh/known_hosts

      - name: Create release directory
        env:
          RELEASE: ${{ github.run_number }}-${{ github.sha }}
        run: |
          ssh -p 2683 youruser@your-server-hostname \
            "mkdir -p ~/apps/example-app/releases/$RELEASE"

      - name: Upload build output
        env:
          RELEASE: ${{ github.run_number }}-${{ github.sha }}
        run: |
          rsync -avz --delete \
            -e 'ssh -p 2683' \
            dist/ youruser@your-server-hostname:~/apps/example-app/releases/$RELEASE/

      - name: Promote release
        env:
          RELEASE: ${{ github.run_number }}-${{ github.sha }}
        run: |
          ssh -p 2683 youruser@your-server-hostname << 'SH'
          set -e
          cd ~/apps/example-app
          ln -sfn releases/$RELEASE current
          rsync -av --delete current/ ~/public_html/
          find ~/public_html -type d -exec chmod 755 {} \;
          find ~/public_html -type f -exec chmod 644 {} \;
          SH
```

## Secrets and access

Store the private deploy key in the CI platform secret store and authorize only the matching public key in cPanel SSH Access.[cite:2] Restrict SSH/SFTP access to known source IPs in VIPcontrol wherever practical, because VentraIP exposes SSH/SFTP after allowlisting is configured.[cite:5]

Recommended secret handling:
- One SSH keypair per app and environment.[cite:2]
- No repository write access from the hosting account.[cite:14]
- No build secrets stored on the VentraIP filesystem unless the app genuinely needs runtime secrets.[cite:14]
- Separate production and non-production targets if more than one environment is required.[cite:14]
- Separate Marketplace publishing credentials from VentraIP deployment credentials. `VSCE_TOKEN` is a `marketplace` environment secret only and must never be copied to the hosting account. Open VSX is not configured for v1.0.

GitHub environment variables required by `.github/workflows/web-release.yml`:

| Environment | Variable | Value |
|---|---|---|
| `test-web` | `SITE_URL` | `https://test.tobyharvey.online` |
| `test-web` | `VENTRAIP_SSH_USER` | VentraIP SSH username |
| `test-web` | `VENTRAIP_SSH_HOST` | `s04le.syd7.hostingplatform.net.au` unless cPanel shows a better host |
| `test-web` | `VENTRAIP_APP_DIR` | Suggested: `~/apps/pspf-web-test` |
| `test-web` | `VENTRAIP_DOCROOT` | cPanel document root for `test.tobyharvey.online` |
| `production-web` | `SITE_URL` | `https://tobyharvey.online` |
| `production-web` | `VENTRAIP_SSH_USER` | VentraIP SSH username |
| `production-web` | `VENTRAIP_SSH_HOST` | `s04le.syd7.hostingplatform.net.au` unless cPanel shows a better host |
| `production-web` | `VENTRAIP_APP_DIR` | Suggested: `~/apps/pspf-web-prod` |
| `production-web` | `VENTRAIP_DOCROOT` | cPanel document root for `tobyharvey.online` |

## VS Code Marketplace deployment path

Core and Workshop are published as VS Code extensions, not hosted on VentraIP. The end-to-end release path is:

1. Merge feature work to `develop` only after CI, redaction, schema, AU-English, package-shape, and deployment-safety checks pass; merge `develop` to `main` only for release candidates.
2. Create a signed-off release tag for each extension, such as `core/<version>` or `workshop/<version>`.
3. GitHub Actions packages the relevant extension directory as a VSIX using `vsce`.
4. The workflow attaches the VSIX to the GitHub release for rollback and audit.
5. The workflow publishes to the VS Code Marketplace using `VSCE_TOKEN` from GitHub Actions secrets.
6. A post-publish smoke check installs the published extension into a clean VS Code profile and verifies activation, command registration, Core/Workshop compatibility, and no secret or personal-data leakage in logs.

Marketplace publishing is production-only. For testing new extension features, use local Extension Development Host runs or pre-release VSIX artefacts attached to a GitHub pre-release; do not use VentraIP as an extension distribution channel.

## Deployment safety tests

The publication gate distinguishes public reference material from sensitive operator data:

- PSPF requirement titles and ISM source-control statements that are already publicly available online may be published with attribution.
- Organisation-specific assessment notes, mapping rationale, local applicability notes, personal data, workspace files, and secrets must not be published.
- `pnpm run check:deployment-safety` scans static deployment artefacts and publication bundles for forbidden runtime files and fields marked `sensitive` or `restricted` by the schema publication policy.
- `pnpm run check:personal-data` separately verifies personal-data exclusion for exported fixtures.
- Production deployment is blocked unless these checks pass.

## cPanel features worth using

VentraIP documents Git Version Control in cPanel, which can be useful for simple repository-backed workflows or for keeping a deployment repository server-side.[cite:14] VentraIP also documents cPanel Terminal access and cron jobs, which can support lightweight administration and scheduled maintenance tasks.[cite:4][cite:3]

Practical use of those features:
- Git Version Control for a lightweight server-side deployment repo, if artifact-only deployment is not preferred.[cite:14]
- Terminal for inspection and small operational tasks, not for primary builds.[cite:4]
- Cron jobs for certificate checks, cache refreshes, or cleanup tasks where needed.[cite:3]

## Hardening checklist

- Serve every site over HTTPS.[cite:7][cite:10]
- Use subdomains to isolate workloads.[cite:14]
- Allowlist SSH/SFTP source IPs in VIPcontrol.[cite:5]
- Use SSH keys only, not passwords.[cite:2]
- Keep SSH on VentraIP’s documented port 2683.[cite:5]
- Disable directory indexes in `.htaccess`.[cite:13]
- Deploy compiled output only.[cite:14]
- Apply conservative permissions after deployment, typically 755 for directories and 644 for files.[cite:14]
- Use cron sparingly and only for clearly bounded tasks.[cite:3]
- Prefer static hosting over PHP or database-backed patterns unless dynamic behavior is required.[cite:14]

## When this pattern fits

This approach fits brochure sites, internal low-traffic tools, static documentation, and small SPAs that call external APIs directly from the browser or through a separate backend service.[cite:14] It is less suitable when the application needs strong isolation, custom system packages, long-running workers, private network integration, or complex backend processing, because shared cPanel hosting is intentionally constrained.[cite:5][cite:14]

For PSPF, the fit is strongest for a public production Explorer shell and a test subdomain for release validation. It becomes a poor fit if the product later needs SSO, per-user access control, audit-grade data access logs, live collaboration, Core API hosting, or server-side processing of agency data.
