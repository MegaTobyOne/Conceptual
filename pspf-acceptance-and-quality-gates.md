# PSPF Acceptance and Quality Gates

## Purpose

This specification defines measurable acceptance criteria and release gates for PSPF v0.1 and v1. It closes the gap between descriptive design intent and verifiable delivery outcomes.

v0.1 is the **thin slice** defined in [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md). v1 remains the eventual target with the full surface in this document.

## v0.1 acceptance criteria (thin slice)

These are the only acceptance criteria for v0.1. Anything in the v1 sections below that is not also listed here is **deferred to v0.2+**.

### v0.1 release gates

A v0.1 release candidate is not eligible for publication unless all gates pass:

1. **Spine workflow gate**: a new operator can install Core+Workshop, run `Initialise PSPF Workspace`, create a Requirement, attach Evidence, take a Snapshot, export a master bundle, open it in Explorer publication mode, and copy a posture brief — without reading the docs. Verified by a Playwright end-to-end test on the standard fixture.
2. **Schema-policy gate**: every entity field declares a `publication` policy. CI fails on missing policy.
3. **Personal-data exclusion gate**: no `Person.name`, `Person.email`, `Assignment.personId`, or any field marked `restricted` appears in any output, for any profile, against the personal-data fixture.
4. **AU-English lint gate**: no US-English variant from the spelling allowlist appears in `docs/**` or extracted UI strings.
5. **Per-version schema publication gate (E23)**: hash-match between runtime validator and served schema for the active `schemaVersion`; no remote `$ref`s.
6. **Accessibility floor gate (E24)**: zero `serious`/`critical` `axe-core` findings on Explorer publication-mode primary routes against the standard fixture.
7. **Writer-lock gate**: a second VS Code window opening the same workspace is detected and degrades to read-only with the holding-window banner.
8. **Backup/restore dry-run gate**: backup procedure documented in [pspf-backup-and-restore-runbook.md](pspf-backup-and-restore-runbook.md) executes cleanly against the standard fixture and a restored copy passes `PRAGMA integrity_check` plus Core validation.

### v0.1 product scope

- Core: workspace bootstrap, SQLite system of record, snapshot create, integrity check, master-bundle export, master-bundle import (`full-replace` and `additive-merge` only), trusted-caller registry, writer lock, three version axes.
- Workshop: Requirement, Evidence, Action, Risk authoring; daily assessment loop; evidence review queue; posture brief render; shareable brief copy.
- Explorer (publication mode only): load a published bundle, browse Requirements/Evidence/Actions/Risks, posture brief view, compliance donut, Relationships Board read-only.
- Australian context: PSPF Domains as primary navigation, AU spelling, AU date/time, ASD Essential Eight on Posture, OFFICIAL: Sensitive banner.

For the deferred items see [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md).

### v0.2 candidate gates (ISM integration, per ADR 0017, ADR 0018, and ADR 0019)

These gates are not enforced in v0.1 and exist here as a forward-looking checklist for the v0.2 ISM phases described in [pspf-ism-integration-spec.md](pspf-ism-integration-spec.md):

1. **OSCAL ingest reproducibility**: regenerating the ISM source library from the same vendored OSCAL snapshot produces byte-identical `SRC-*` records.
2. **ISM provenance gate**: every `SRC-*` record carries `oscalRelease`, `catalog`, and `profile` provenance; missing provenance fails CI.
3. **No runtime egress for ISM**: build- and runtime-time checks confirm Explorer and Workshop never fetch ISM data from a network endpoint at run time.
4. **Mapping redaction gate**: `RequirementControlMapping.rationale` is treated as `sensitive` by default; bundle export tests confirm it never leaks under a `public` publication profile.
5. **Mapping survives round trip**: snapshot → export → import preserves mapping endpoints, `coverageQualifier`, and `applicabilityProfile`.
6. **ISM version-drift detection**: changing the vendored OSCAL release tag flags mappings whose underlying ISM control text has changed.

## v1 release gates

A v1 release candidate is not eligible for publication unless all gates pass:

1. Contract gate: API and schema contract tests pass.
2. Data integrity gate: migration tests and integrity checks pass.
3. Workflow gate: critical user workflows pass in Core, Workshop, Shop, Pub, and Explorer.
4. Security gate: redaction and secrets handling checks pass.
5. Accessibility gate: automated `axe-core` scan in CI passes with zero `serious` or `critical` findings on Explorer and on every Core/Workshop/Shop/Pub webview; manual keyboard, focus, and zoom checks pass for the same surfaces.
6. Operational gate: backup and restore dry-run checks pass on representative fixtures.
7. Privacy gate: bundle-export tests confirm no `Person.name`, `Person.email`, `Assignment.personId`, or any field marked `restricted` appears in any output, for any profile, against the personal-data fixture.
8. Schema-policy gate: every entity field declares a `publication` policy. CI fails with no override on missing policy.
9. AU-English lint gate: no US-English variant from the spelling allowlist appears in user-facing copy.

## Core acceptance criteria

1. Workspace initialisation creates canonical `.pspf` layout with no missing required paths.
2. Health view reports trust state, schema compatibility, and integrity summary. (v0.1: surfaced through `pspf.core.validateWorkspace`, `pspf.core.verifyIntegrity`, and `pspf.core.showWriterLock`; the unified Health view arrives in v0.2 — see [pspf-development-readiness-review.md](pspf-development-readiness-review.md) § Remaining readiness risks.)
3. `Validate Workspace` and `Verify Integrity` commands return structured diagnostics with severity and remediation hints.
4. Snapshot and export operations produce traceable artefacts and operation records.
5. Startup behaviour does not run destructive operations without explicit command or approved safe migration logic.

## Workshop acceptance criteria

1. User can create and update Requirement, Evidence, Action, and Risk records without direct DB edits.
2. User can create and inspect at least these links: requirement-evidence, requirement-action, action-risk.
3. Readiness validation flags missing required evidence and stale or inconsistent states.
4. Detail and tree views remain synchronized after create, update, and link operations.
5. Diagnostics presented to user include stable code, severity, and next-step guidance.
6. User can complete the daily assessment workflow: find a requirement or group, review statement/guidance/links, update assessment/readiness/evidence state, link or create evidence, and see overall/domain/Essential Eight posture update.
7. Evidence review queues classify old, incomplete, changed, unverified, missing, and unlinked evidence, group by domain, filter by one or more requirements, and rank by downstream impact.
8. Action Impact ranking shows highest-impact actions for requirement, domain, overall, Essential Eight, and Direction scopes, with visible explanations for every ranked action.
9. User can add a Direction, link affected requirements/domains, assess response state, link evidence/actions/risks, and see Direction response reflected in posture and action-impact summaries.
10. Summary or report-prep output can produce a simple posture brief covering overall, domain, and Essential Eight posture plus a data/evidence-backed action plan.
11. User can copy a shareable brief for a requirement, requirement group, domain, Essential Eight scope, or Direction that remains readable when pasted into email or Teams and excludes restricted or unapproved sensitive fields.

## Shop acceptance criteria

1. User can create/update Supplier, Contract, and Spend item records via Core API.
2. User can create supplier-contract and contract-requirement links.
3. Shop operations fail safely with clear compatibility message when Core API/schema mismatch is detected.
4. User can create spend forecasts showing planned/committed spend, proposed spend, expected savings, net benefit, payback period, confidence, and assumptions.
5. User can identify invest-now-save-later opportunities ranked by expected savings, payback, linked Action Impact, risk reduction, contract optimisation, and confidence.
6. Forecast and savings views remain traceable to suppliers, contracts, spend items, actions, requirements, and risks.

## Pub acceptance criteria

1. User can create/update Person, Role, Team, and Assignment records via Core API.
2. User can create person-team and assignment-target links.
3. Pub operations fail safely with clear compatibility message when Core API/schema mismatch is detected.

## Explorer acceptance criteria

1. Explorer loads valid export bundle and presents overview KPIs and list pages.
2. URL state preserves filters and drill-down navigation context.
3. Bundle incompatibility is surfaced with a user-readable warning and no silent corruption.
4. Keyboard-only navigation is possible across primary navigation, filters, tables, and detail transitions.
5. At 200% zoom, primary pages remain usable without loss of core information.
6. Evidence review supports domain scope and one-or-more requirement scope, and classifies old, incomplete, changed, unverified, missing, and unlinked evidence consistently with Core/Workshop.
7. Directions can be registered, linked to affected requirements/domains, assessed with the Direction response set, evidenced, and included in posture/action-plan outputs.
8. Relationships Board and relevant list views can sort or filter by explainable Action Impact.
9. Posture brief output includes overall, domain, and Essential Eight posture, evidence confidence signals, Direction response state, and top actions with traceable supporting facts.
10. Shareable work brief output can be copied as plain text and Markdown, remains readable when pasted into email or Teams, and applies bundle-equivalent redaction and personal-data exclusions.
11. Explorer provides simple shareable graphics for compliance status donut, action timeline/Gantt-lite, grouped action checklist, and risk impact/likelihood matrix, each with copy/save image, copy summary, and table alternative.
12. Shareable chart image exports include title, scope, generated-at time, active filters, source/freshness caveat, and required classification marking, and exclude restricted or unapproved sensitive fields.
13. When Shop forecast data is included in a bundle, Explorer can show consumer-friendly forecast spend, expected savings, net benefit, payback, and top savings-opportunity graphics with table alternatives and redaction controls.

## Performance targets for v1

These are baseline targets measured on the **reference machine** defined in `pspf-performance-profile-and-benchmarks.md` (Apple Silicon, 16 GB RAM, SSD, no other foreground load). They MUST be validated with the standard fixture against that profile in CI on every release.

1. Core startup health check visible in under 3 seconds for a standard workspace.
2. Requirement list load in under 2 seconds for 5,000 requirements.
3. Snapshot export completes in under 30 seconds for 50,000 total records.
4. Explorer initial render under 3 seconds for the standard bundle size profile.
5. Bundle import rejects out-of-limit bundles in under 1 second (no full parse before limit check).

## Test fixture profiles

Define and maintain at least these fixture profiles:

1. Minimal workspace.
2. Standard workspace.
3. Large workspace.
4. Migration-needed workspace.
5. Broken-link workspace.
6. Daily-assessment workspace with requirements, guidance, evidence, actions, risks, Directions, and posture before/after expectations.
7. Evidence-review workspace with old, incomplete, changed, unverified, missing, and unlinked evidence across multiple domains.
8. Action-impact workspace with actions affecting requirement, domain, overall, Essential Eight, and Direction scopes.
9. Shop-forecast workspace with suppliers, contracts, spend items, savings assumptions, linked actions, linked requirements, and linked risks.

## Evidence required at release

A release must include:

1. Contract test report.
2. Migration test report.
3. Workflow smoke test report.
4. Security/redaction verification report.
5. Accessibility check report.
6. Backup/restore dry-run report.
7. Trusted-caller authorisation verification report.
8. Contract compatibility matrix report.
9. Secrets rotation status and incident drill record.
10. Performance benchmark report with threshold pass/fail outcomes.
