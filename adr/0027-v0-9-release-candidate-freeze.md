# ADR 0027 — v0.9 release-candidate freeze

## Status

Accepted.

## Context

v0.8 completed the first-run testability and packaging-readiness slice: a shared sample workspace, Workshop Welcome path, sample-workspace gate, and Core/Workshop package-shape rehearsal. The remaining step before v1.0 is not another feature tranche; it is a release-candidate freeze that verifies the v1.0 validation surface is coherent, testable, and free of stale pre-v0.5 documentation.

ADR 0022 remains the governing v1.0 scope. Core, Workshop, and Explorer publication mode are in scope. Shop, Pub, Explorer local authoring, chart image export, plan-apply imports, editable posture, and third-party accessibility audit remain deferred.

## Decision

1. v0.9 is a scope-freeze and release-candidate rehearsal slice. It introduces no new product entities, published-bundle fields, schema axes, or UI workflows.
2. The manual operator validation scenario is refreshed to the current v1.0 surface: sample workspace, Directions, Action Impact, ISM mapping, integrity scan, export, Explorer review, and posture brief copy.
3. `scripts/check-release-candidate.mjs` verifies release-candidate consistency: all package versions match `0.9.0`, `PSPF_SLICE_VERSION` is `0.9.0`, compatibility axes remain `1.3.0`, v0.9 scripts and docs exist, the manual scenario mentions the current test surface, and Shop/Pub remain deferral notes.
4. `release:readiness` now targets the active slice and writes versioned readiness reports using the current package version.
5. `e2e:v0.9` chains the v0.8 automated spine plus release-candidate consistency checks.

## Consequences

- v0.9 is the manual dogfood/release-candidate baseline for v1.0.
- Testers should use `validation-scenario-1-operator-workflow.md` and the v0.8 Welcome/sample path to validate the product without hand-crafting records.
- No schema, bundle, or API compatibility bump is required. `VERSION_AXES` remains `1.3.0`; only package versions and `PSPF_SLICE_VERSION` bump to `0.9.0`.

## Quality gates (delta)

- `check:release-candidate` must pass.
- `release:readiness` must run `e2e:v0.9`, `check:gates`, `validate:debug-workspace`, `lint`, and `check:release-candidate` before writing the readiness report.
- Manual testing uses the refreshed validation scenario plus the generated readiness artefacts.
