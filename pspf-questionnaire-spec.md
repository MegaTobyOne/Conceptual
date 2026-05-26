# PSPF Questionnaire Specification

## Purpose

This specification defines the **questionnaire-driven workspace population
method** for PSPF Workshop. It governs how the operator answers a curated set
of plain-English questions, how those answers are mapped to PSPF entity
records (Requirements, Evidence, Actions, Risks, and links), how the result
becomes a custom first daily bundle, and how the same flow is re-run later as
a posture refresh.

This spec implements [adr/0069-questionnaire-population.md](adr/0069-questionnaire-population.md)
and slots into the v0.8 first-run test path as a sibling of
`PSPF: Load Sample Workspace`.

## Scope and non-scope

### In scope (this slice)

- One Starter pack (~15 questions) covering the highest-leverage Requirements
  per PSPF Domain.
- Optional Domain deep-dive packs (one per Domain) shipped alongside.
- Save-and-resume drafting; atomic apply behind a pre-apply Snapshot.
- Re-run as **Update** with stale-review filtering and superseded-Action
  auto-close.
- AU-English UI strings; OFFICIAL: Sensitive banner; axe-core clean.

### Out of scope (deferred)

- Operator-authored or community-shared packs.
- Per-Requirement or per-Section full-coverage packs.
- Configurable answer policy.
- Exporting the questionnaire answer manifest in Explorer bundles.
- ISM mapping at the question level (see ADR 0017 ISM roadmap).
- Sharing or publishing a questionnaire run as a standalone artefact.

## Personas

Same as [pspf-onboarding-spec.md](pspf-onboarding-spec.md) § Personas. The
questionnaire is for the **Australian Government assurance practitioner**;
reviewers and developers do not interact with it.

## Concepts

### Question pack

A versioned JSON document declaring an ordered list of questions, the
Requirements they cover, evidence and action templates per answer, and a
publication policy per question. Packs are reference data: read-only at
runtime, hashed, attributed, and CI-validated against the active PSPF
baseline.

| Field                  | Meaning                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `packId`               | Stable kebab-case identifier (`starter-v1`, `deep-gov-v1`).             |
| `packVersion`          | Semver. Additive question additions bump minor; breaking edits bump major. |
| `title`, `description` | AU-English; lint-checked.                                               |
| `domains`              | Set of PSPF Domains covered.                                            |
| `questions`            | Ordered list (see § Question).                                          |
| `publicationPolicy`    | Default per-pack; can be overridden per question.                       |

### Question

| Field                | Meaning                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | Stable identifier (`q.gov.security-plan`). Never reused.                                                                         |
| `domain`             | One of `GOV`, `RISK`, `INFO`, `TECH`, `PER`, `PHYS`.                                                                             |
| `requirementRefs`    | Non-empty list of PSPF Requirement IDs the answer drives. Validated at pack-build time.                                          |
| `prompt`             | Plain-English question. AU-English.                                                                                              |
| `helpText`           | Short explanation of why we ask. May reference Requirement titles but never personal data.                                       |
| `answerType`         | Fixed string `"yes-no-partial-unknown-na"` for this slice.                                                                       |
| `evidenceTemplate`   | Title, type, default review-cycle days, and prompt mode (`url-or-note`, `note-only`, `none`).                                    |
| `actionTemplates`    | One template per answer branch that creates an Action: `yes-no-link`, `partial`, `no`, `unknown`. `yes-with-link` may also create a review-cycle Action via `evidenceTemplate.defaultReviewCycleDays`. |
| `riskTemplate`       | Optional; declares the answer set on which to create a Risk and the default likelihood/consequence.                              |
| `publicationPolicy`  | Per-question override; defaults to the pack's policy.                                                                            |

### Answer

| Field          | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `runId`        | The questionnaire run this answer belongs to.                          |
| `packId`       | Pack the question belongs to.                                          |
| `questionId`   | Question identifier.                                                   |
| `value`        | One of `yes`, `no`, `partial`, `unknown`, `na`, `skipped`.             |
| `link`         | Optional URL when the question asked for one. Validated.               |
| `note`         | Optional operator note. Default publication `internal`.                |
| `naRationale`  | Required when `value = na`.                                            |
| `answeredAt`   | ISO-8601 UTC timestamp.                                                |

### Questionnaire run

| Field         | Meaning                                                              |
| ------------- | -------------------------------------------------------------------- |
| `runId`       | UUID.                                                                |
| `packId`, `packVersion` | Pack identity captured at run start.                       |
| `mode`        | `first-run`, `update`, or `answer-all`.                              |
| `snapshotId`  | The Snapshot taken immediately before apply.                         |
| `startedAt`, `appliedAt` | Timestamps. `appliedAt` null if draft.                    |
| `appliedCounts` | Summary counts: requirements affected, evidence created, actions created/closed, risks created. |

## Answer policy (deterministic)

This table is the **single source of truth** for the mapping. The Workshop
implementation in `packages/workshop/src/questionnaire/policy.ts` mirrors it
exactly; the unit test asserts equivalence on every row.

| Answer                  | Requirement assessment                | Evidence                                                                                | Action                                                                                    | Risk                              |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| `yes` with link/note    | `met`                                 | One Evidence created per `evidenceTemplate`, with `reviewCycleDays` and `nextReview = today + cycle`. | One "Review on `<nextReview>`" Action per Evidence, priority `low`, due = `nextReview`.   | None.                             |
| `yes` without link/note | `partial`                             | None.                                                                                   | One "Attach evidence for `<requirement>`" Action per `requirementRefs`, priority `medium`, due = today + 30 days. | None.                             |
| `partial`               | `partial`                             | Optional Evidence from operator note, type `narrative-note`, no review cycle.           | One uplift Action from `actionTemplates.partial`, due = today + 60 days.                  | Optional per `riskTemplate.applyOn`. |
| `no`                    | `not-met`                             | None.                                                                                   | One "Find out / remediate" Action from `actionTemplates.no`, priority `high`, due = today + 14 days. | Created if `riskTemplate.applyOn` includes `no`. |
| `unknown`               | Unchanged.                            | None.                                                                                   | One "Investigate" Action from `actionTemplates.unknown`, priority `high`, due = today + 14 days. | None.                             |
| `na` with rationale     | `not-applicable`, rationale stored.   | None.                                                                                   | None.                                                                                     | None.                             |
| `skipped`               | Unchanged.                            | None.                                                                                   | None.                                                                                     | None.                             |

Additional rules:

- Apply is atomic. If any single write fails, the entire run is rolled back
  and no records are committed. The pre-apply Snapshot remains as evidence of
  the intent.
- Each created entity is linked to its driving Requirement via the canonical
  link types from [pspf-entity-link-spec.md](pspf-entity-link-spec.md)
  (`supported-by` for Evidence, `addresses` for Action, `posed-by` for Risk).
- Each created entity records `provenance.source = "questionnaire"`,
  `provenance.runId`, `provenance.packId@packVersion`, and
  `provenance.questionId`.

## Re-run / update semantics

### Modes

1. **First run.** No prior run exists for the pack. Every question is shown.
2. **Update** (default when a prior run exists). Shown:
   - Every question whose previous answer was `no`, `unknown`, or `partial`.
   - Every question whose previous evidence has `nextReview <= today`.
   - Every question added in a newer `packVersion` since the last run.
3. **Answer all again.** Shows every question regardless of previous state.

### Answer transitions

When a question's new answer differs from its previous answer:

- **`no` → `yes` (with link).** Previous "Find out" Action is closed with
  reason `superseded-by-questionnaire-run/<runId>`. New Evidence and
  review-cycle Action are created. Requirement assessment moves to `met`.
- **`unknown` → any definite answer.** Previous "Investigate" Action is
  closed with the same reason. New records follow the policy table.
- **`yes` → `no` / `partial`.** Existing Evidence is preserved (history) but
  flagged with `supersededBy = null, supersededAt = now`. New Actions per
  policy.
- **`partial` → `met`.** Previous uplift Action closed with reason
  `superseded-by-questionnaire-run/<runId>`.

When an Evidence's `nextReview` has passed and the operator confirms `yes`
again, the existing Evidence's `reviewedAt` and `nextReview` are bumped; no
new Evidence record is created.

### Audit

Every run produces:

1. A Snapshot of type `questionnaire-run` taken **before** apply.
2. A row in `questionnaire_runs` linking pack identity, mode, snapshot, and
   summary counts.
3. One row per non-skipped answer in `questionnaire_answers`.
4. An entry in the Work-log (no telemetry leaves the device).

## Data model and migration

New SQLite tables (additive; bumps `schemaVersion`):

```sql
CREATE TABLE questionnaire_runs (
  run_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('first-run','update','answer-all')),
  snapshot_id TEXT NOT NULL REFERENCES snapshots(snapshot_id),
  started_at TEXT NOT NULL,
  applied_at TEXT,
  applied_counts_json TEXT
);

CREATE TABLE questionnaire_answers (
  run_id TEXT NOT NULL REFERENCES questionnaire_runs(run_id),
  pack_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  value TEXT NOT NULL CHECK (value IN ('yes','no','partial','unknown','na','skipped')),
  link TEXT,
  note TEXT,
  na_rationale TEXT,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (run_id, pack_id, question_id)
);

CREATE INDEX idx_questionnaire_answers_question
  ON questionnaire_answers (pack_id, question_id);
```

Migration is additive only — no existing tables are altered.

## Core API surface

New API namespace `pspf.core.questionnaire.*`:

| Method                                            | Purpose                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `listPacks()`                                     | Read-only list of installed packs with version and source-hash.               |
| `getLatestAnswers(packId)`                        | Most recent answers per question for an Update-mode picker.                   |
| `startRun({ packId, packVersion, mode })`         | Acquires writer lock, returns a `runId`. Does not write records yet.          |
| `saveDraft(runId, answers[])`                     | Idempotent draft save; survives VS Code restart.                              |
| `apply(runId)`                                    | Atomic: take pre-apply Snapshot, run policy, write records, commit.           |
| `listRuns()` / `getRun(runId)`                    | Read history.                                                                 |

All methods are subject to the writer lock, redaction gate, and trusted-caller
policy unchanged. `apply` is the only mutating method.

## UI surface (Workshop)

A single WebviewPanel `pspf.workshop.questionnaire`:

1. **Pack picker.** Cards for the Starter pack and any installed Domain
   deep-dive packs. Shows pack version and, when a previous run exists,
   "Last run *X days ago*" and "*Y questions stale*".
2. **Mode selector** (only when a prior run exists). Default: Update.
3. **Progress rail.** One segment per Domain in the chosen pack.
4. **Question card.**
   - Prompt and help text.
   - Answer radio group (`Yes` / `No` / `Partial` / `Unknown` / `N/A`).
   - Conditional URL input (validated) and/or note textarea, depending on
     `evidenceTemplate.promptFor`.
   - When `N/A`: required rationale textarea.
   - "Skip for now" link.
   - Disclosure "Why this question?" showing `requirementRefs`.
5. **Save-and-resume.** Draft saved to Core via `saveDraft` after every
   answer change; survives VS Code restart.
6. **Review screen.** Lists every record that will be created, updated, or
   superseded, grouped by Requirement, with the pre-apply Snapshot button.
7. **Result screen.** Counts, with deep-links to Assessment Dashboard,
   Evidence Review Queue, and the run's Snapshot detail.

All screens:

- Render the OFFICIAL: Sensitive banner.
- Pass the axe-core floor on `serious`/`critical` rules.
- Are keyboard-navigable in natural focus order.
- Use AU-English copy.

## Commands and activation

| Command                                       | Purpose                                                  |
| --------------------------------------------- | -------------------------------------------------------- |
| `PSPF: Run Quickstart Questionnaire`          | Opens the panel on the Starter pack.                     |
| `PSPF: Run Domain Deep Dive…`                 | Quick Pick of installed Domain packs, then opens panel.  |
| `PSPF: Open Questionnaire History`            | Tree View of prior runs with Snapshot deep-links.        |

Activation events:

- `onCommand:pspf.workshop.questionnaire.*`
- `onView:pspfWorkshop.questionnaireHistory`

These additions follow the narrow-activation rules in
[pspf-onboarding-spec.md](pspf-onboarding-spec.md) § Activation events.

## Privacy and publication

- Question pack content (prompts, help text, templates) is `publication: public`.
- Operator answers default to `publication: internal`. Free-text `note` and
  `naRationale` are scanned by the personal-data-exclusion gate (N6/S7).
- URL fields are validated client-side; the runtime never auto-expands them.
- Explorer bundles do **not** include questionnaire answers in this slice.

## Onboarding integration

Add an optional step to the v0.8 first-run test path in
[pspf-onboarding-spec.md](pspf-onboarding-spec.md) § v0.8 first-run test path:

> Between current steps 3 and 4, the operator may run
> `PSPF: Run Quickstart Questionnaire` to populate the workspace from
> real-world answers instead of (or in addition to) the privacy-safe sample.
> The remainder of the path (Assessment Dashboard, Evidence Review Queue,
> Integrity Scan, Export, Explorer) is unchanged.

## Failure paths

| Failure                                                 | What the user sees                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pack fails build-time validation                        | Pack does not ship; CI red. Operator never sees a broken pack at runtime.                         |
| `requirementRefs` reference a Requirement that does not exist in the active PSPF baseline | Pack-check gate fails; ADR 0069 § Compatibility axes blocks the release.            |
| Writer lock held by another window during `startRun`    | Standard `PSPF_WRITER_LOCK_HELD` banner; questionnaire panel disabled with explanation.           |
| Apply detects redaction violation in a `note`           | Apply aborts with `PSPF_PUBLICATION_POLICY_VIOLATION`; offending field highlighted; nothing written. |
| Apply transaction error mid-flight                      | Transaction rolled back; pre-apply Snapshot remains; result screen shows abort reason.            |
| Operator closes VS Code mid-draft                       | Draft restored on next open; "Resume questionnaire" prompt in Workshop Welcome.                    |
| Pack version newer than installed Core supports         | Pack picker disables the pack with `PSPF_PACK_INCOMPATIBLE`; remediation: update Core.             |

## Acceptance signals

A questionnaire is "successfully exercised" when:

1. A first-run apply produces at least one Requirement assessment update,
   at least one Evidence, and at least one Action.
2. A subsequent update-mode run flips at least one answer and the system
   closes the superseded Action with the documented reason.
3. The redaction gate is green against a fixture answer set that includes
   benign `note` content.
4. The pack-check CI gate is green against the Starter pack.
5. The Workshop e2e Playwright spec for the questionnaire passes on
   macOS and Windows runners.

## Quality gates

- `check:questionnaire-pack` — validates all packs against PSPF reference
  data, AU-English lint, and publication-policy presence.
- Existing `check:redaction` — extended to scan `questionnaire_answers.note`
  and `na_rationale`.
- Existing `check:sample-workspace` — unaffected; the questionnaire is a
  separate first-run path.
- `e2e:questionnaire` — first-run + re-run scenarios.

## Specification summary

The questionnaire is a Workshop client of the existing Core write surface.
It asks the operator plain-English questions, maps each answer through a
deterministic, spec-fixed policy to PSPF entity writes, and persists the
answer set so the flow can be re-run as a posture refresh. Question packs
are versioned reference data with the same provenance treatment as PSPF and
ISM source data. The first slice ships one Starter pack and Domain
deep-dive packs in v0.8, alongside `PSPF: Load Sample Workspace`, without
disturbing the v0.1 thin-slice acceptance criteria.
