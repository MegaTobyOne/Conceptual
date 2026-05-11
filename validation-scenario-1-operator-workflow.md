# Validation Scenario 1: Evidence-Backed PSPF Requirement

## Purpose

Validate that a PSPF/security operator can complete the first v0.1 workflow without developer assistance: initialise a local workspace, create an evidence-backed requirement, record action and risk context, inspect the item, export a publication bundle, and confirm Explorer/reporting behaviour.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

In scope:

- PSPF Core workspace initialisation, validation, integrity check, snapshot, and export.
- PSPF Workshop requirement, evidence, action, risk, and item detail commands.
- PSPF Explorer publication-mode bundle loading and validation panel.
- Redaction/default-deny checks for publication output.

Out of scope for v0.1:

- Shop, Pub, Explorer local authoring, plan-apply imports, editable posture, Action Impact ranking, and chart image export.

## Test Data

- Requirement title: `Validate governance reporting workflow`
- Domain: `Governance`
- Assessment status: `In progress`
- Internal summary: `Internal assessment working note that must not be exported.`
- Evidence title: `Governance committee terms of reference`
- Evidence type: `Document`
- Evidence reference: `records/governance-committee-tor.pdf`
- Evidence freshness: `Current`
- Action title: `Confirm next governance review date`
- Action status: `Todo`
- Due date: `30 Jun 2026`
- Risk title: `Governance review evidence may become stale`
- Risk status: `Open`
- Likelihood: `3`
- Impact: `3`

## Manual Extension Host Steps

Optional clean run: close the Extension Host and run `npx pnpm@10.10.0 run debug:reset` from the repository root before relaunching.

1. Launch `Run PSPF Core + Workshop`.
2. Confirm the debug workspace has auto-initialised. If not, run `PSPF: Initialise PSPF Workspace` manually; the command is idempotent.
3. Run `PSPF: Create Requirement` and enter the test requirement details.
4. Run `PSPF: Attach Evidence to Requirement` and enter the test evidence details.
5. Run `PSPF: Create Action` and enter the test action details.
6. Run `PSPF: Create Risk` and enter the test risk details.
7. Run `PSPF: Open Assessment Dashboard` and confirm the requirement, evidence, action, and risk counts look right.
	Confirm the dashboard shows `PSPF v0.1.0`, `Schema 1.0.0`, and `API 1.0.0`.
8. Run `PSPF: Open Evidence Review Queue` and confirm this scenario does not list the requirement as missing evidence.
9. Run `PSPF: Open Item Detail` and select the requirement.
10. Confirm the item detail shows the requirement plus linked evidence, action, risk, relationships, and version context.
11. Run `PSPF: Validate Workspace`.
12. Run `PSPF: Verify Integrity`.
13. Run `PSPF: Create Snapshot`.
14. Run `PSPF: Copy Posture Brief` and paste the brief into a scratch note to confirm it is readable.
15. Run `PSPF: Export Master Bundle`.
16. Run `PSPF: Show Writer Lock` and confirm the current window is writable.
17. Run `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.
18. Open `packages/explorer/dist/index.html` and select the latest debug `bundle.json`.
19. Click `Copy posture brief` in Explorer and paste it into a scratch note.

## Expected Explorer Behaviour

- Bundle Validation shows PASS for versions, collection contract, counts, hashes, posture counts, and redaction checks.
- Explorer visibly shows `PSPF v0.1.0`, `Schema 1.0.0`, `Bundle 1.0.0`, and `API 1.0.0`.
- Posture Brief shows 1 requirement, 1 evidence item, 1 action, and 1 risk for this scenario.
- Compliance Status shows a donut with the met percentage and a table alternative.
- Domain Posture shows domain-level posture bars and a table alternative.
- Needs Attention lists requirements that are not met or need evidence review.
- Explorer section navigation links move cleanly between overview, validation, record lists, and relationships.
- Requirements shows `Validate governance reporting workflow`, the `Governance` domain label, and evidence/action/risk link counts.
- Evidence shows `Governance committee terms of reference` and the linked requirement title.
- Actions shows `Confirm next governance review date` and the linked requirement title.
- Risks shows `Governance review evidence may become stale` and the linked requirement title.
- Relationships Board shows links from the requirement to evidence, action, and risk using readable titles rather than raw IDs.
- The internal summary does not appear in Explorer or exported publication JSON.
- The copied posture brief includes counts and action/risk summary, but excludes internal summaries and restricted personal fields.
- The copied posture brief includes domain summary and groups open actions/risks by linked requirement.
- The Workshop and Explorer copied posture briefs use the same sections and exclude the internal summary.
- The Workshop dashboard shows workspace ready status, validation hints, the current recent requirement, latest activity, and the same core counts as the exported bundle.
- The evidence review queue separates missing evidence, freshness review, and unlinked evidence.

## Automated Baseline

Run:

```sh
npx pnpm@10.10.0 run e2e:v0.1
```

Expected outputs:

- A generated workspace at `.tmp/e2e-v0.1-workspace`.
- A generated bundle path under `.tmp/e2e-v0.1-workspace/.pspf/exchange/exports/`.
- A report at `.tmp/e2e-v0.1-workspace/.pspf/reports/e2e-v0.1-report.md`.
- A full-replace import round-trip into `.tmp/e2e-v0.1-import-workspace`.
- Passing personal-data exclusion and schema validation checks.
- Passing Explorer accessibility scan with zero serious or critical axe-core findings.
- Passing Explorer publication smoke check with visible version context, no validation failures, and a copyable posture brief payload.

Run the broader readiness command with:

```sh
npx pnpm@10.10.0 run release:readiness
```

Expected output:

- A readiness report at `.tmp/release-readiness/v0.1-readiness-report.md`.
- PASS for all automated readiness gates.
- PASS for the Explorer publication smoke and posture brief redaction gates.
- Manual operator validation is the next step.

## Pass Criteria

- The manual Extension Host flow completes without intervention.
- `validate:debug-workspace` passes.
- Explorer renders the latest bundle and its validation panel passes.
- The generated report matches the visible Explorer counts and titles.
- Full-replace import round-trip succeeds on the automated fixture.
- Writer-lock, backup/restore, schema, and personal-data gates pass.
- Accessibility gate passes with zero serious or critical findings.
- Restricted personal fields and internal summaries are absent from publication output.

## Feedback Capture

Record:

- Any prompt wording that caused hesitation.
- Any command order that felt surprising.
- Any Explorer validation failure or unclear label.
- Any mismatch between the report, Explorer, and the operator's expectation.
- The next action needed before another validation session.