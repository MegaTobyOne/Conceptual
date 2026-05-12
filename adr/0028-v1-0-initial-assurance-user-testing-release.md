# ADR 0028 — v1.0 initial assurance user testing release

## Status

Accepted.

## Context

v0.9 completed the release-candidate freeze: no new data-model or publication features, refreshed manual validation, active-version readiness reporting, and release-candidate consistency checks. The automated gates and manual scenario now cover the full v1.0 validation surface.

ADR 0022 remains the governing scope decision for v1.0. The release is Core, Workshop, and Explorer publication mode for initial Australian Government assurance user testing. Shop, Pub, Explorer local authoring, chart image export, plan-apply imports, editable posture, numeric benchmark suites, and third-party accessibility audit remain deferred.

## Decision

1. v1.0 is a release cut from v0.9 with no additional data-model, schema, bundle, or workflow features.
2. Package versions and `PSPF_SLICE_VERSION` bump to `1.0.0`.
3. Schema, bundle, and API compatibility axes remain at `1.3.0`; no published-bundle field or entity contract changes are introduced for v1.0.
4. `e2e:v1.0` is the active automated spine and includes personal-data exclusion, integrity-scan, sample-workspace, package-shape, and release-candidate checks.
5. `release:readiness` targets `e2e:v1.0`, all gates, debug-workspace validation, AU-English lint, release-candidate consistency, and writes `.tmp/release-readiness/v1.0.0-readiness-report.md`.
6. Manual acceptance uses `validation-scenario-1-operator-workflow.md`.
7. v1.0 may include one discoverability/usability affordance for initial testers: a PSPF Workshop Activity Bar container with a `Workshop Home` WebviewView that launches existing commands, plus one restrained status bar item showing PSPF version context. This is not a new authoring workflow and does not change any entity or publication contract.

## Consequences

- v1.0 is ready for initial operator validation when automated gates pass and the manual scenario completes without intervention.
- Future feature work starts after v1.0 and requires new ADRs or explicit scope reopening.
- Deferred packages and features must remain clearly labelled as deferred in docs and package folders.
- The Workshop Home view is a task launcher and readiness summary only; detailed navigation remains in existing Workshop panels and commands.

## Quality gates (delta)

- `check:release-candidate` validates `1.0.0` versions, `1.3.0` compatibility axes, v1.0 scripts/docs, manual scenario coverage, Workshop Home/status bar discoverability, and Shop/Pub deferrals.
- `release:readiness` must pass 15/15 tracked gates and write the v1.0 readiness report.
- The manual scenario must show `PSPF v1.0.0` and `Schema/Bundle/API 1.3.0` in Workshop/Explorer surfaces, including PSPF version context in the VS Code status bar.
