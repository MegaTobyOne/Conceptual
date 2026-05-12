# Validation Scenario 1: v1.0 Initial Assurance User Testing Workflow

## Purpose

Validate that a PSPF/security operator can complete the v1.0 initial assurance user testing workflow without developer assistance: initialise a local workspace, load the sample assurance scenario, inspect Directions and Action Impact in Workshop, run integrity checks, export a publication bundle, and confirm Explorer/reporting behaviour.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

In scope:

- PSPF Core workspace initialisation, validation, integrity scan, snapshot, and export.
- PSPF Workshop Welcome, sample workspace loading, dashboard, evidence queue, item detail, Direction detail, and posture brief commands.
- PSPF Explorer publication-mode bundle loading and validation panel.
- Redaction/default-deny checks for publication output.

Out of scope for v1.0:

- Shop, Pub, Explorer local authoring, plan-apply imports, editable posture, chart image export, numeric performance benchmarking, and third-party accessibility audit.

## Test Data

- Use `PSPF: Load Sample Workspace` for the primary run. It loads a privacy-safe fixture with 3 Requirements, 2 Evidence items, 3 Actions, 4 Risks, 2 Directions, 12 links, and 1 ISM mapping when source controls are available.
- Optional manual add-on: create one extra Requirement, Evidence, Action, and Risk using the original governance test data below if the operator wants to exercise Quick Pick authoring after the sample load.
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
3. Run `PSPF: Open Workshop Welcome` and confirm it shows `PSPF v1.0.0`, `Schema 1.3.0`, and `API 1.3.0`.
4. Run `PSPF: Load Sample Workspace`.
5. Run `PSPF: Open Assessment Dashboard` and confirm the sample counts look right: 3 Requirements, 2 Evidence items, 3 Actions, 4 Risks, and 2 Directions.
6. Confirm the dashboard shows Direction response chips and an `Action Impact — Top 5` table with compact Explanation cells.
7. Run `PSPF: Open Evidence Review Queue` and confirm `Urgent Actions (Blocked or Overdue)` appears.
8. Run `PSPF: Open Item Detail` and select a sample Requirement. Confirm linked evidence, actions with urgency, risks, ISM mappings, inbound Directions, relationships, and version context.
9. Run `PSPF: Open Direction Detail` and confirm Direction reference, response state, source authority, issue date, and outbound relationships.
10. Optional: run `PSPF: Create Requirement`, `PSPF: Attach Evidence to Requirement`, `PSPF: Create Action`, and `PSPF: Create Risk` using the add-on test data above.
11. Run `PSPF: Validate Workspace`.
12. Run `PSPF: Verify Integrity`.
13. Run `PSPF: Run Integrity Scan` and confirm it passes.
14. Run `PSPF: Create Snapshot`.
15. Run `PSPF: Copy Posture Brief` and paste the brief into a scratch note to confirm it is readable and includes Directions.
16. Run `PSPF: Export Master Bundle`.
17. Run `PSPF: Show Writer Lock` and confirm the current window is writable or, if another Extension Host owns the lock, that the workspace is clearly read-only.
18. Run `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.
19. Open `packages/explorer/dist/index.html` and select the latest debug `bundle.json`.
20. Click `Copy posture brief` in Explorer and paste it into a scratch note.

## Expected Explorer Behaviour

- Bundle Validation shows PASS for versions, collection contract, counts, hashes, posture counts, and redaction checks.
- Explorer visibly shows `PSPF v1.0.0`, `Schema 1.3.0`, `Bundle 1.3.0`, and `API 1.3.0`.
- Posture Brief shows the sample workspace counts and Direction summary.
- Compliance Status shows a donut with the met percentage and a table alternative.
- Domain Posture shows domain-level posture bars and a table alternative.
- Needs Attention lists requirements that are not met or need evidence review.
- Explorer section navigation links move cleanly between overview, validation, record lists, and relationships.
- Requirements shows `Validate governance reporting workflow`, the `Governance` domain label, and evidence/action/risk link counts.
- Evidence shows `Governance committee terms of reference` and the linked requirement title.
- Actions shows `Confirm next governance review date` and the linked requirement title.
- Actions shows Action Impact where applicable, including Direction uplift and urgency.
- Risks shows `Governance review evidence may become stale` and the linked requirement title.
- Directions shows the sample Home Affairs Directions and response states.
- Relationships Board shows links from the requirement to evidence, action, and risk using readable titles rather than raw IDs.
- The internal summary does not appear in Explorer or exported publication JSON.
- The copied posture brief includes counts and action/risk summary, but excludes internal summaries and restricted personal fields.
- The copied posture brief includes domain summary and groups open actions/risks by linked requirement.
- The Workshop and Explorer copied posture briefs use the same sections and exclude the internal summary.
- The Workshop dashboard shows workspace ready status, validation hints, Direction chips, Action Impact top-5, latest activity, and the same core counts as the exported bundle.
- The evidence review queue separates missing evidence, freshness review, and unlinked evidence.
- The evidence review queue includes Urgent Actions for blocked or overdue actions.

## Automated Baseline

Run:

```sh
npx pnpm@10.10.0 run e2e:v1.0
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

- A readiness report at `.tmp/release-readiness/v1.0.0-readiness-report.md`.
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