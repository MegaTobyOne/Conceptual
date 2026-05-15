# PSPF Developer and Pipeline Specification

## Overview

This specification defines the development model, repository strategy, CI/CD pipelines, release approach, maintenance process, and agent opportunities for the PSPF ecosystem. It is written to support a local-first VS Code extension platform, a standalone Explorer web application published to VentraIP cPanel (see ADR 0038), and an ongoing maintenance model that uses GitHub Copilot as a core development aid rather than as an autonomous authority.

The delivery model needs to support four realities at once:

- Each PSPF product (Core, Workshop, Shop, Pub) ships as its **own** signed VSIX from a **single GitHub repository** (ADR 0007 + ADR 0013).
- All four extensions share a common platform contract (schema, SDK, API discipline) published as in-repo workspace packages.
- Explorer is a static web application and deploys cleanly to VentraIP cPanel through GitHub Actions over SSH.
- AI assistance is useful across coding, review, migration, and documentation, but must remain bounded by tests, contracts, and explicit human approval.

The development environment assumed by this spec is **VS Code on macOS** with a personal **GitHub Pro** subscription. Linux and Windows are supported by CI; the local dev loop is documented for macOS first.

## Delivery principles

The pipeline should follow these principles:

1. **One platform contract, multiple products** — shared schema, SDK, and API discipline across products.
2. **Local-first confidence** — no build or deployment choice should undermine the local-first security and runtime posture of Core.
3. **Automation for repeatability, not for blind trust** — tests, packaging, docs, and releases should be automated; architecture and assurance decisions should remain deliberate.
4. **Static Explorer delivery** — Explorer should stay simple to deploy, inspect, and roll back through release-directory swaps on the static host.
5. **Compatibility must be explicit** — schema, API, and extension versions must be tracked and validated.

## Repo strategy

### Repo model (ADR 0013)

The ecosystem lives in a **single private GitHub repository** at `https://github.com/MegaTobyOne/Conceptual.git` on the maintainer's GitHub account. Each PSPF product is a workspace package; each VSIX-producing package still releases independently (ADR 0007). The earlier polyrepo proposal (`pspf-contracts` + `pspf-core` + `pspf-workshop` + `pspf-shop` + `pspf-pub` + `pspf-explorer`) is **retired**.

| Path | Contents | Releases as |
|---|---|---|
| `packages/contracts/` | Shared schema, SDK, API contract types, ID utilities, importer/exporter, brief renderer, chart renderer, contract tests, fixtures | Internal workspace packages only |
| `packages/core/` | Core extension (system of record, storage, trust, migrations) | `core/<version>` tag → signed VSIX |
| `packages/workshop/` | Workshop extension (authoring) | `workshop/<version>` tag → signed VSIX |
| `packages/shop/` | Shop extension (suppliers/contracts; v0.2+) | `shop/<version>` tag → signed VSIX |
| `packages/pub/` | Pub extension (people/roles; v0.2+) | `pub/<version>` tag → signed VSIX |
| `packages/explorer/` | Explorer SPA + static-host pipeline | `explorer/<version>` tag → VentraIP production deploy |
| `docs/` | Specs, ADRs, runbooks, glossary, onboarding | Lives with the code |
| `schemas/explorer-bundle/<schemaVersion>/` | Per-version bundle JSON Schemas | Served same-origin from the Explorer site (E23) |

### Why a monorepo (and not the earlier polyrepo)

For a single maintainer working in VS Code on macOS with GitHub Pro, polyrepo coordination was the dominant cost. A monorepo lets one PR land a coordinated change across schema, API, Core, Workshop, and Explorer; it keeps contract tests in-tree against the source they will publish; and it keeps specs, ADRs, and runbooks alongside the code that implements them. Independent VSIX *publishing* is preserved by per-package release tags and per-package release workflows. See ADR 0013 for the full reasoning and trade-offs.

### Repo settings (GitHub Pro features used)

- **Visibility**: private during v0.1; revisited at v1.0.
- **Branch protection** on `develop` and `main`: required PR review, required status checks, linear history, signed commits encouraged. `develop` is the integration and automatic test-deploy branch; `main` is release-only.
- **Secret scanning with push protection** (default for GitHub Pro accounts).
- **Dependabot** for npm/pnpm and GitHub Actions.
- **CodeQL** code scanning on JavaScript/TypeScript.
- **Required status checks**: lint, typecheck, unit tests, contract tests, fixture round-trips, schema-policy gate, personal-data-exclusion gate, AU-English lint, accessibility floor smoke.
- **GitHub Actions minutes**: GitHub Pro allowance covers the v0.1 CI footprint comfortably; macOS runners are reserved for benchmarks that need Apple Silicon parity.
- **Static web host**: Explorer and the public landing page are published from `web-release.yml` to VentraIP cPanel (see ADR 0038). GitHub Pages is not used.
- **Approval environments**: `production-web` (VentraIP production) and `marketplace` (VS Code Marketplace) require manual reviewer approval before any job that holds production secrets can run. `test-web` deploys automatically from `develop` after CI gates pass.
- **Self-hosted deploy runner**: VentraIP SSH allowlisting requires the final web deploy jobs to run on a dedicated macOS self-hosted runner named `pspf-runner` and labelled `mechastopheles`. Build, test, safety, and release-readiness jobs remain on GitHub-hosted runners. See `pspf-self-hosted-runner-hardening-runbook.md`.
- **Releases**: each VSIX is uploaded as a release asset; release notes are generated from PR labels.

## Branching and change model

### Branch strategy

Use the promotion model in ADR 0039:

- short-lived feature branches for day-to-day work,
- `develop` as the integration branch and automatic test-deploy source,
- `main` as the protected release branch,
- release tags cut only from `main` for Marketplace and Explorer production deployments.

Do not work directly on `main`. Normal changes merge feature branches into `develop` by PR, then promote `develop` to `main` by release-candidate PR. Hotfixes branch from `main`, release from `main`, then merge back into `develop`.

Explorer production tags should be created through the `Explorer production tag` GitHub Actions workflow rather than by hand. The workflow must be dispatched from `main`, verifies the requested version matches `package.json`, runs `release:readiness`, creates `explorer/<version>`, and lets the existing `web-release.yml` tag trigger perform the approved production deploy.

### Pull request discipline

Every change should land through a pull request, even for solo development. This creates a stable review point, a reproducible audit trail, and a natural place for Copilot review, automated checks, and release notes generation.

### Change categories

Each PR should be classified in one of these types:

- feature,
- fix,
- refactor,
- schema,
- migration,
- docs,
- pipeline,
- security.

This classification should feed changelog and release note automation.

## Package and workspace structure

### Workspace root

The repo uses **pnpm workspaces** as the primary tooling (npm workspaces is an acceptable fallback). Recommended structure:

```text
pspf/
├── packages/
│   ├── contracts/
│   │   ├── schema/
│   │   ├── api-contract/
│   │   ├── ids/
│   │   ├── exporter/
│   │   ├── importer/
│   │   ├── ui-tokens/
│   │   ├── brief-renderer/
│   │   ├── chart-renderer/
│   │   └── test-fixtures/
│   ├── core/
│   ├── workshop/
│   ├── shop/
│   ├── pub/
│   └── explorer/
├── docs/
│   ├── adr/
│   ├── specs/
│   ├── runbooks/
│   └── lint/au-english.json
├── schemas/
│   └── explorer-bundle/<schemaVersion>/
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .vscode/
│   └── settings.json
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Per-package contents

Each `packages/<name>/` directory has its own `src/`, `tests/`, `package.json`, and `tsconfig.json`. TypeScript project references link them so editor IntelliSense and incremental builds work cleanly. The VSIX-producing packages (`core`, `workshop`, `shop`, `pub`) include a `vsce`-compatible manifest at the package root.

## Package management and versioning

### Version model

Use semantic versioning for:

- schema package,
- SDK package,
- API contract package,
- each extension VSIX (`pspf-core`, `pspf-workshop`, `pspf-shop`, `pspf-pub`),
- Explorer export schema (the bundle `bundleVersion`).

### Compatibility model

Maintain a published compatibility matrix such as:

| Product | Compatible with |
|---|---|
| Shop 0.6.x | Core API 1.2.x, Schema 1.4.x |
| Pub 0.4.x | Core API 1.2.x, Schema 1.4.x |
| Explorer 0.8.x | Export bundle schema 1.4.x |

This should be machine-checked where possible, not just documented.

### Package publishing

Shared packages under `packages/contracts/` should publish as scoped packages only if external reuse becomes necessary. For v0.1 they remain internal workspace packages, consumed through pnpm workspace references. This keeps schema and SDK reuse disciplined without adding a private-package publishing loop.

## Development environments

### Local dev baseline

The single repo should support a simple reproducible local environment with:

- pinned Node version,
- pinned pnpm version through Corepack,
- checked-in `pnpm-lock.yaml`,
- workspace settings and recommended extensions,
- formatter and linter config,
- test commands,
- deterministic fixture generation,
- and a documented bootstrap command (`corepack enable && pnpm install`).

### Recommended local toolchain (macOS + VS Code)

Use the following baseline for the maintainer environment:

- macOS on Apple Silicon where available; CI still covers Linux and Windows for portability.
- VS Code Stable plus the official Extension Test Host flow for extension debugging.
- Node.js LTS pinned in `.node-version` and enforced by CI.
- pnpm pinned in `packageManager` and activated via Corepack.
- SQLite CLI installed locally for ad hoc inspection of `.pspf/core/pspf-core.db` and WAL/SHM behaviour.
- GitHub CLI (`gh`) installed for release tagging, workflow inspection, and issue/PR triage.
- Playwright browsers installed through `pnpm exec playwright install --with-deps` only where needed; avoid global browser state.
- A repo-local `.vscode/extensions.json` recommending ESLint, Playwright Test, GitHub Actions, GitHub Pull Requests, Markdown linting, and GitHub Copilot.

### Development containers and Codespaces

Do not require containers for v0.1 local development. The fastest path is native VS Code on macOS. Add an optional `.devcontainer/` once the first package scaffold exists so GitHub Codespaces can reproduce the CI environment for review and onboarding. The devcontainer should mirror Linux CI, not replace the macOS maintainer loop.

### Environment validation command

Add a root `doctor` script in v0.1 that checks:

- Node and pnpm versions,
- VS Code engine compatibility declared by each extension package,
- SQLite availability and WAL support,
- Playwright browser installation if Explorer tests are enabled,
- GitHub CLI authentication for release tasks,
- required repo secrets names are documented (without printing values),
- and that `.pspf/` sample workspaces can be created under a temporary directory.

The `doctor` script should be safe to run repeatedly and must not mutate the user's real PSPF workspace.

### VS Code extension development

The extension packages should support standard extension dev loops:

- compile,
- lint,
- package,
- run extension host,
- run tests,
- and validate manifest/publishing requirements.

### Explorer development

Explorer should support:

- local dev server,
- production static build,
- static-site base path handling for serving Explorer under `/explorer`,
- JSON fixture loading,
- and static export verification before deployment.

## CI pipeline design

### Pipeline stages

The monorepo should implement a staged CI pipeline:

1. install and restore cache,
2. lint and format verification,
3. typecheck/build,
4. unit tests,
5. integration/contract tests,
6. package/build artefact creation,
7. release or deploy only on approved branch/tag.

### Required checks

Every PR should pass:

- lint,
- typecheck,
- unit tests,
- schema compatibility tests,
- smoke packaging check.

Platform changes that affect schema or APIs should also trigger downstream compatibility checks for Shop, Pub, and Explorer fixtures.

### Specification governance checks

In addition to code checks, PRs that change platform behaviour should pass specification governance checks:

- consistency check against `pspf-spec-consistency-index.md`,
- acceptance-gate alignment check against `pspf-acceptance-and-quality-gates.md`,
- redaction/security alignment check against `pspf-security-redaction-controls.md`,
- diagnostics alignment check against `pspf-error-and-diagnostics-model.md`,
- trusted-caller policy alignment check against `pspf-trusted-caller-policy.md`,
- contract-test governance alignment check against `pspf-contract-test-governance-spec.md`,
- secrets rotation and incident procedure alignment check against `pspf-secrets-rotation-and-incident-runbook.md`,
- performance benchmark alignment check against `pspf-performance-profile-and-benchmarks.md`.

These checks can begin as manual PR checklist gates and should be automated over time using docs linting and policy assertions.

### Security and quality automation

Use automated checks for:

- dependency vulnerabilities,
- secret scanning,
- code scanning,
- licence checks if relevant,
- and artefact integrity.

GitHub Copilot guidance emphasizes that AI-generated code should still be reviewed carefully and checked with tests and tooling, which fits this model directly.

## Platform CI/CD

### Workflow files (single repo)

All workflow files live in `.github/workflows/` at the repo root. Each is scoped by triggers and `paths:` filters so a Workshop-only PR does not run the Pub package's heavy bench job.

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR, push to `develop` or `main` | lint, typecheck, build, unit tests, contract tests across all packages affected by the diff |
| `accessibility.yml` | PR touching `packages/explorer/**` | `axe-core` per primary route on the standard fixture |
| `schema-publish.yml` | PR touching `schemas/**` | hash-match validator vs served schema; remote `$ref` lint; per-version directory check (E23) |
| `personal-data-gate.yml` | every PR | exporter run against personal-data fixture; fail-closed assertion (N6, S7) |
| `deployment-safety.yml` | every PR and release/deploy tag | static deployment and publication-bundle safety scan; blocks hosted sensitive/restricted fields, personal data, secrets, and workspace/runtime artefacts |
| `au-english-lint.yml` | every PR | scan `docs/**` and extracted UI strings against the spelling allowlist |
| `core-release.yml` | tag `core/<v>` | package `packages/core` as signed VSIX, attach to GitHub release, publish to Marketplace |
| `workshop-release.yml` | tag `workshop/<v>` | as above for Workshop |
| `shop-release.yml` | tag `shop/<v>` | as above for Shop (v0.2+) |
| `pub-release.yml` | tag `pub/<v>` | as above for Pub (v0.2+) |
| `web-release.yml` | tag `explorer/<v>` from `main` (production) or push to `develop` (test) | build static bundle, deploy to VentraIP under `production-web` or `test-web` environment |
| `nightly-bench.yml` | nightly | full performance benchmarks against reference machine fixture |

### Marketplace publishing

VS Code extensions publish through `vsce` invoked from GitHub Actions, with the `VSCE_TOKEN` stored as an environment-scoped secret on the `marketplace` environment. The v1.0 Marketplace publisher is `tobyharvey`. Open VSX is not used for v1.0 and should be added later only through a separate decision and environment-scoped `OVSX_TOKEN`.

Release pattern:
- package the `.vsix` in CI from the relevant `packages/<name>/`,
- attach to the GitHub release,
- publish only from signed-off tags,
- generate release notes from PR labels.
- run a post-publish smoke check in a clean VS Code profile before announcing the release.

Marketplace and web deployment are separate channels. `VSCE_TOKEN` is used only by extension release workflows; VentraIP SSH keys are used only by static web deployment workflows.

## Shop and Pub CI/CD

Shop and Pub are deferred to v0.2+ by ADR 0014, but their package directories and release workflows should be reserved from the start so naming and tags do not drift. Until implementation begins, their CI footprint is limited to docs, package metadata, and compatibility-matrix placeholders.

When Shop or Pub becomes active, each package uses the same monorepo checks as Core and Workshop:

- PR CI for lint/build/test scoped by `paths:` filters,
- contract check against supported Core API/schema versions,
- `.vsix` packaging on `shop/<version>` or `pub/<version>` tag,
- Marketplace publish on approved release tag.

If Core API compatibility changes, affected package compatibility suites should fail fast in CI instead of breaking at runtime.

## Explorer CI/CD

### Deployment model

Explorer and the public landing page (`pspf-ecosystem.html` at site root, Explorer SPA under `/explorer`) build as a static bundle and deploy through GitHub Actions to VentraIP cPanel over SSH on port 2683. GitHub Pages is not used. Per ADR 0038, the first production host is `tobyharvey.online` and the test host is `test.tobyharvey.online`. The fallback SSH/SFTP hostname for VentraIP is `s04le.syd7.hostingplatform.net.au`. Test deploys are automatic from `develop`; production deploys require a release tag from `main` and manual approval on the `production-web` environment.

### Explorer workflows

Explorer uses the repo-level workflows listed above. Product-specific Explorer jobs are:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR, push | lint, typecheck, test, build when `packages/explorer/**` changes |
| `preview.yml` | PR | optional preview artefact or test-subdomain preview strategy |
| `web-release.yml` | push to `develop` (test) or release tag from `main` (production) | build static bundle and deploy to VentraIP test or production document root |
| `bundle-verify.yml` | PR touching schema/import/export | validate JSON bundle compatibility |
| `deployment-safety.yml` | PR, push, release tag | run `pnpm run check:deployment-safety` before any static deployment or Marketplace release |

### VentraIP deployment requirements

The web release workflow should:

- build `pspf-ecosystem.html` plus the Explorer SPA into a single static tree, with the SPA mounted under `/explorer`,
- run `pnpm run check:deployment-safety` and `pnpm run check:personal-data`,
- authenticate over SSH on port 2683 using `VENTRAIP_DEPLOY_KEY_TEST` or `VENTRAIP_DEPLOY_KEY_PROD` depending on environment,
- upload to a timestamped release directory and update the `current` symlink,
- run a `curl` smoke check against the deployed URL,
- and surface the deployed URL and release identifier as workflow output.

### Explorer release practice

Explorer should keep deployments reversible and legible:
- one test build per commit to `develop` and one production build per release tag,
- visible build artefacts,
- version displayed in the app footer or about screen,
- and schema/export bundle version displayed where relevant.

For VentraIP deployments, keep separate release directories and deploy keys for test and production. Deploy only `packages/explorer/dist/`, served schemas, and deliberately published `data/` bundle files that have passed deployment-safety and personal-data gates. Public PSPF and ISM reference requirements may be hosted because they are already available online; organisation-specific assessment notes, mapping rationale, local applicability notes, secrets, workspaces, and raw debug exports may not be hosted.

## Test strategy

### Test layers

The ecosystem should use five test layers:

| Layer | Purpose |
|---|---|
| Unit | fast behaviour checks inside packages and components |
| Integration | storage, API, import/export, UI module behaviour |
| Contract | schema/API compatibility across workspace packages |
| Fixture/regression | stable JSON bundles and workspace cases |
| Smoke/end-to-end | packaging, launch, basic workflow execution |

### Golden fixtures

Because Explorer and Core are coupled by JSON bundles, maintain golden fixtures for:

- minimal workspace,
- normal workspace,
- migration workspace,
- broken-link workspace,
- snapshot export bundle,
- Explorer import bundle.

These fixtures are especially useful for AI-assisted refactors because they catch accidental shape changes early.

## Documentation and ADRs

### Documentation layers

The repo should maintain:

- a root README for setup and purpose,
- a contributor guide,
- architecture notes,
- release runbooks,
- troubleshooting runbooks,
- product-specific README files under each package,
- and the spec set under `docs/`.

### ADR practice

Keep Architecture Decision Records in `docs/adr/` for platform decisions and cross-link them from package READMEs where they inherit those decisions.

Recommended ADR subjects:
- repo strategy,
- ID format,
- workspace layout,
- schema evolution,
- API access model,
- snapshot/export design,
- Explorer deployment model,
- AI-assisted development policy.

## Maintenance model

### Release cadence

Use a lightweight cadence:

- continuous integration always,
- release when stable and useful,
- but bundle schema/API changes into explicit version steps.

### Maintenance priorities

Ongoing maintenance should focus on:

1. dependency updates,
2. schema compatibility,
3. export/import reliability,
4. Marketplace compatibility,
5. Explorer deployment health,
6. docs and runbook freshness.

### Support posture

Since the extensions may become public before a formal support model exists, the repo should make this explicit:

- public code,
- public releases,
- best-effort issues,
- no guaranteed support SLA,
- and clear compatibility disclaimers.

## GitHub Copilot use model

### Copilot role

GitHub Copilot should be treated as a high-leverage development assistant for scaffolding, refactors, tests, migration helpers, and review support, but not as an authority on schema correctness, assurance logic, or secure design.

### Safe use rules

Adopt these rules:

- Use Copilot for narrow, well-scoped tasks.
- Provide explicit constraints and examples.
- Require tests for any substantial generated code.
- Never accept generated code without understanding it.
- Use PR review and contract tests to catch hallucinated assumptions.

### Copilot-friendly repo setup

To help Copilot work well, provide:

- strong README and architecture docs,
- concise folder structure,
- examples and fixtures,
- clear naming conventions,
- custom instructions where supported,
- and reusable prompts in docs.

For this repo specifically, keep a concise `.github/copilot-instructions.md` once code exists. It should point Copilot to `pspf-invariants.md`, `pspf-glossary.md`, ADR 0013, ADR 0014, and the security/redaction specs before allowing generated code to touch schema, export, import, or persistence logic.

## Agent opportunities

The ecosystem is a good fit for a few bounded, useful agents. These should be assistant-style automations with clear inputs and outputs, not fully autonomous maintainers.

### 1. Schema impact agent

Purpose:
- detect schema/API changes in PRs,
- identify impacted products,
- suggest compatibility updates,
- and flag missing migrations or fixture updates.

Good inputs:
- changed files under schema, api-contract, importer/exporter.

Good outputs:
- PR comment with affected packages, fixtures, and release notes.

### 2. Fixture and migration agent

Purpose:
- generate or refresh test fixtures from current schema,
- compare expected and actual bundle shapes,
- and propose migration skeletons.

This is especially useful because the platform depends on durable import/export and snapshot behaviour.

### 3. Documentation sync agent

Purpose:
- compare code, commands, and workflows to docs,
- flag stale setup instructions,
- and propose README/runbook updates.

This is valuable because solo or small-team projects often let docs drift first.

### 4. PR review agent

Purpose:
- perform first-pass review for maintainability, missing tests, compatibility hints, and risk areas.

GitHub Copilot supports code review workflows and automatic review features, which makes this a practical early agent use case.

### 5. Release notes agent

Purpose:
- assemble release notes from merged PRs,
- classify schema/API/UI/pipeline changes,
- and highlight breaking changes or required migrations.

### 6. Explorer content integrity agent

Purpose:
- check whether exported bundle fields expected by Explorer are present,
- detect broken narrative summaries,
- and flag stale UI copy or field mismatches before web deployment.

### 7. Release, test, and deploy agent

Purpose:
- enforce ADR 0039 branch promotion rules before release work starts,
- confirm `develop` test deploy readiness and `main` release-tag readiness,
- run or verify `release:readiness`, web staging, deployment safety, and VSIX dry packaging,
- check that GitHub environment approvals and secrets are scoped correctly,
- and produce a concise human-action list before production or Marketplace approval.

This agent is useful here because release work crosses branch policy, cPanel deployment, Marketplace packaging, redaction gates, and rollback. It should assist and verify; it must not approve production or Marketplace release jobs.

## Where not to use agents

Do not delegate these areas fully to agents:

- security model decisions,
- schema authority decisions,
- migration approval,
- release approval,
- trust and assurance language,
- or destructive repair operations.

These areas are too consequential to leave to autonomous tooling.

## GitHub Actions recommendations

### Shared practices

Across all workflows:

- use reusable workflow fragments where sensible,
- pin action versions,
- install Playwright browser binaries before any release job runs `release:readiness`, because the Explorer readiness gates launch Chromium on fresh GitHub-hosted runners,
- store Marketplace and VentraIP credentials as repository secrets, scoped to the `marketplace`, `production-web`, and `test-web` environments,
- and keep environments explicit for release and deploy jobs.

### Recommended secrets

| Secret | Repo | Purpose |
|---|---|---|
| `VSCE_TOKEN` | `Conceptual` / `marketplace` environment | VS Code Marketplace publishing for Core and Workshop under publisher `tobyharvey` |
| `OVSX_TOKEN` | not configured for v1.0 | Reserved for a future Open VSX decision |
| `GITHUB_TOKEN` | `Conceptual` | standard workflow operations |

Web deployment uses environment-scoped `VENTRAIP_DEPLOY_KEY_TEST` and `VENTRAIP_DEPLOY_KEY_PROD` SSH private keys, each authorised against a separate cPanel deploy key for the matching document root. Production deploys require manual reviewer approval on the `production-web` environment.

## Release and rollback

### Release process

Suggested release flow:

1. merge feature branches to `develop`,
2. validate CI and the automatic test deploy are green,
3. open a release-candidate PR from `develop` to `main`,
4. run `release:readiness`,
5. merge to `main`,
6. create the relevant release tag from `main`,
7. approve and run the production web or Marketplace job,
8. publish release notes,
9. verify smoke checks post-release.

### Rollback

Maintain simple rollback paths:

- previous `.vsix` artefacts retained for extension rollback,
- previous Explorer build artefact or VentraIP release directory reference,
- and previous schema snapshot or migration backup for local data recovery.

## Runbooks

Create runbooks for:

- local bootstrap,
- extension packaging,
- Marketplace publish,
- Explorer static deploy to VentraIP,
- broken schema migration recovery,
- fixture refresh,
- release rollback,
- and secret rotation.

## Minimum viable pipeline

For v0.1 (per ADR 0014), the minimum useful CI footprint is:

- `ci.yml` (lint, typecheck, unit tests, contract tests) on every PR.
- `personal-data-gate.yml` and `au-english-lint.yml` on every PR.
- `schema-publish.yml` on PRs that touch `schemas/**`.
- `accessibility.yml` on PRs that touch `packages/explorer/**`.
- `core-release.yml`, `workshop-release.yml`, `web-release.yml` on their respective release tags.

Shop, Pub, and the nightly bench are added in v0.2.

## Specification summary

The delivery model is **one private GitHub repository** (`https://github.com/MegaTobyOne/Conceptual.git`) housing every PSPF product as a workspace package, with each VSIX-producing package releasing independently via per-package release tags. Explorer deploys as a static site to VentraIP cPanel from the same repo (see ADR 0038). CI/CD enforces linting, AU-English spelling, tests, schema/API compatibility, personal-data exclusion, accessibility floor, packaging, and controlled release automation.

GitHub Copilot is used as a bounded development and review assistant, supported by strong fixtures, in-tree contract tests, and PR discipline. The most useful early agent investments are schema-impact analysis, fixture/migration support, PR review, documentation sync, release notes, Explorer bundle integrity checking, and release/test/deploy verification.
