# 0013 — Monorepo source layout (supersedes ADR 0007 § Repos)

- Status: accepted
- Date: 2026-05-10
- Supersedes: ADR 0007 (source-layout aspect only; the four-extension packaging decision in ADR 0007 stands)

## Context

ADR 0007 settled that PSPF Core, Workshop, Shop, and Pub each ship as their own signed VSIX. An earlier draft of [pspf-developer-pipeline-spec.md](../pspf-developer-pipeline-spec.md) extrapolated that into six separate GitHub repositories (`pspf-contracts`, `pspf-core`, `pspf-workshop`, `pspf-shop`, `pspf-pub`, `pspf-explorer`).

For this team — a single maintainer working in VS Code on macOS with a personal GitHub Pro subscription — that split would impose serious coordination tax:

- every cross-cutting change touching the shared schema becomes a coordinated PR across five repos;
- contract tests must publish-then-consume across repo boundaries before any feature is end-to-end testable;
- ADRs, specs, and runbooks already cross-cut every product and would either fragment or have to live in a sixth repo;
- the three semantic-version axes (`schemaVersion`, `bundleVersion`, `apiVersion`) become release-coordination work in their own right.

Independent VSIX *publishing* is a packaging concern, not a source-layout concern. It can be satisfied from a single repository.

## Decision

Adopt a **single GitHub repository** that houses every PSPF product as a workspace package.

### Repository

- Repository: **`pspf`** (single private repo on the maintainer's GitHub account, hosted under the included GitHub Pro plan).
- Visibility: **private** during v0.1; revisited at v1.0 when public release is considered.
- Default branch: `main`.

### Workspace layout

**Current v1.42 implementation note:** code, schemas, scripts, and packages follow
the monorepo layout below, but authoritative specifications, runbooks, and ADRs
remain at the repository root and `adr/`. The originally planned mechanical move
into `docs/specs`, `docs/runbooks`, and `docs/adr` is deferred because existing
spec links, Marketplace documentation, release checks, and agent instructions all
depend on the root paths. Any future docs move must be a dedicated migration with
a link-rewrite gate; until then, root specs and `adr/` are the source of truth.

```text
pspf/
├── packages/
│   ├── contracts/                # was pspf-contracts
│   │   ├── schema/
│   │   ├── api-contract/
│   │   ├── ids/
│   │   ├── exporter/
│   │   ├── importer/
│   │   ├── ui-tokens/
│   │   ├── brief-renderer/       # shared posture/work-brief renderer
│   │   ├── chart-renderer/       # shared chart renderer
│   │   └── test-fixtures/
│   ├── core/                     # was pspf-core; ships as its own VSIX
│   ├── workshop/                 # was pspf-workshop; ships as its own VSIX
│   ├── shop/                     # was pspf-shop; ships as its own VSIX
│   ├── pub/                      # was pspf-pub; ships as its own VSIX
│   └── explorer/                 # was pspf-explorer; ships as a static site to GitHub Pages
├── docs/
│   ├── adr/                      # all ADRs live here
│   ├── specs/                    # the .md files currently at the repo root move here
│   └── runbooks/
├── schemas/
│   └── explorer-bundle/<schemaVersion>/   # per E23
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .vscode/
│   └── settings.json
├── package.json                  # workspace root (npm/pnpm workspaces)
├── pnpm-workspace.yaml           # if pnpm; otherwise npm workspaces
└── README.md
```

### Tooling choice

- **Package manager**: pnpm workspaces (preferred for fast, deterministic, content-addressed installs and clean per-package `node_modules`). npm workspaces is an acceptable fallback if pnpm proves friction.
- **Task runner**: a single root script set (`build`, `test`, `lint`, `typecheck`, `package`, `bench`) plus per-package equivalents. No Nx/Turborepo dependency in v0.1; revisit at v1.0 if build times warrant it.
- **TypeScript**: project references between packages so editor IntelliSense and incremental builds work correctly.

### Independent releases

Each VSIX-producing package keeps its own version, changelog, and release tag. Tags follow `<package>/<version>` (for example `core/0.1.0`, `workshop/0.1.0`, `explorer/0.1.0`). A single workflow file per product (`core-release.yml`, `workshop-release.yml`, `shop-release.yml`, `pub-release.yml`, `explorer-release.yml`) is triggered by the matching tag and packages/publishes only that package. ADR 0007's "four signed VSIX, one Pages site" packaging decision is unchanged.

### Branch protection and CI

- `main` is protected; PRs require green CI and at least one review (Copilot review counts in solo mode, with a final human approval).
- Required checks per PR: lint, typecheck, unit tests, contract tests, fixture round-trips, accessibility floor, schema-policy gate, personal-data-exclusion gate, performance smoke.
- Heavier benches and the full per-route `axe-core` suite run nightly and on release tags.

### GitHub Pro features used

- **Private repository** with unlimited collaborators (plan default).
- **GitHub Actions** minutes for CI, contract tests, packaging, and Pages deploys.
- **GitHub Pages** for the Explorer site, deployed from a release-tag-triggered workflow under the `github-pages` environment.
- **Required reviews and protected branches** on `main`.
- **Dependabot** for npm/pnpm and GitHub Actions updates.
- **CodeQL** code-scanning on JavaScript/TypeScript.
- **Secret scanning with push protection** (default for GitHub Pro accounts).
- **Repository secrets** for Marketplace publishing tokens (`VSCE_TOKEN`, optionally `OVSX_TOKEN`).
- **GitHub-hosted runners** (Linux for CI, macOS only where Apple-Silicon parity matters for benchmarks).
- **Releases** for each VSIX, with the `.vsix` attached as a release asset and notes generated from PR labels.

## Consequences

### Positive

- One PR can land a coordinated change across schema, API, Core, Workshop, and Explorer.
- Contract tests run in-tree against the same source they will publish; no synthetic version-pinning loop.
- Specs, ADRs, runbooks, and code live together; cross-references stay valid through refactors.
- Lower CI minute usage than five repos' parallel pipelines; matters on a personal GitHub Pro plan.
- Faster local dev loop for a single maintainer in VS Code on macOS.

### Negative / accepted trade-offs

- A single `main` failure blocks all products; mitigated by a small required-checks set and product-scoped folders for code-owners review.
- The repo grows in size; mitigated by keeping fixtures and large bench artefacts out of git (use Git LFS or release artefacts for large fixtures if they ever exceed a few MB).
- If a future contributor wants to take over only Shop or Pub, they'll be working in a polyrepo split's sibling directory rather than their own repo. Acceptable for v1; revisit if the team grows.

### Migration

The code workspace was reorganised into the monorepo package layout, but the
documentation move is explicitly deferred as of v1.42. The authoritative paths
remain the repository root and `adr/`; this avoids a broad link churn while the
T0-T2 remediation work closes higher-risk documentation truth, gate integrity,
and trust-boundary gaps.

## Alternatives considered

- **Polyrepo (six repos)**, as originally drafted in [pspf-developer-pipeline-spec.md](../pspf-developer-pipeline-spec.md). Rejected for the reasons in the Context section.
- **Two repos** (`pspf-platform` for everything except Explorer, `pspf-explorer` standalone). Rejected because Explorer's bundle schema is owned by `contracts` and round-trips through Workshop and Core; keeping it in the same repo lets the per-version schema publication contract (E23) stay trivially in sync.
- **GitHub organisation with per-product repos**. Considered for future scale; not required at v0.1 and would not change the per-VSIX publishing decision.
