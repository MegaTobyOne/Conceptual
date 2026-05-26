# ADR 0069 — Questionnaire-driven workspace population

## Status

Accepted. Ships in v1.33 as the v1.33 questionnaire-driven population
slice; subsequent slices may extend storage (DB-backed) and UI surface
(WebviewPanel) without changing the answer policy.

## Context

The PSPF v0.1 spine assumes an operator authors Requirements, Evidence,
Actions, and Risks through Workshop's Quick Pick flows (see workflows W1–W4 in
[pspf-core-workshop-screen-workflow-spec.md](../pspf-core-workshop-screen-workflow-spec.md)).
v0.8 added `PSPF: Load Sample Workspace` (ADR 0026) to populate a privacy-safe
fixture so an assurance user can inspect the surfaces without hand-crafting
records.

Neither path lets the operator populate the workspace from their **own
real-world situation**. An Australian Government assurance practitioner who
sits down for the first time wants to be asked plain-English questions —
"does your entity have a current Chief Security Officer-endorsed security
plan?" — and get back a workspace that reflects their actual posture, with
Evidence linked, review cycles set as Actions, and "find out" Actions for
everything they do not know. They should also be able to re-run the same
questionnaire later as a posture refresh, with the system telling them which
answers are stale.

This pattern exists in adjacent products (control-self-assessment tools, GRC
intake forms) but PSPF currently has no equivalent. The risk of doing nothing
is that operators either accept the sample fixture as if it were theirs, or
spend the first day authoring records by hand and abandon the tool before
they reach the export step.

## Decision

1. Add a **questionnaire-driven population method** to Workshop, surfaced as
   `PSPF: Run Quickstart Questionnaire` (and `PSPF: Run Domain Deep Dive…`,
   `PSPF: Open Questionnaire History`). The full design is in
   [pspf-questionnaire-spec.md](../pspf-questionnaire-spec.md).
2. The questionnaire is **phased**: a curated ~15-question Starter pack
   covering the highest-leverage Requirements per PSPF Domain (`GOV`, `RISK`,
   `INFO`, `TECH`, `PER`, `PHYS`), with optional Domain deep-dive packs the
   operator can run later. Per-Requirement and per-Section coverage are
   deferred to v1.x.
3. **Question packs are reference data.** They ship through the same
   `packages/reference-data` pipeline as PSPF and ISM source data, with
   `packVersion` semver, source-hash provenance, AU-English lint, and CI
   validation against the active PSPF baseline. Operators cannot edit the
   packs in-product in this slice.
4. **Answer policy is deterministic** and lives in a single source of truth
   (`packages/workshop/src/questionnaire/policy.ts`). The mapping from each
   answer kind (`yes` with link / `yes` without link / `partial` / `no` /
   `unknown` / `na` with rationale / skip) to the records that get created
   or updated is specified once in
   [pspf-questionnaire-spec.md](../pspf-questionnaire-spec.md) § Answer
   policy and is not customisable in this slice.
5. **All writes go through existing Core APIs.** The questionnaire never
   bypasses the writer lock, redaction gate, or integrity invariants. Apply
   is one atomic transaction wrapped by a pre-apply Snapshot of type
   `questionnaire-run`.
6. **Re-runnable as an update.** Answers persist as JSON run records under
   `.pspf/questionnaire/runs/<runId>.json` in v1.33; database-backed storage
   is deferred to a later slice without changing the deterministic answer
   policy. Update mode offers three explicit modes — update only stale or
   changed questions, update all questions, and **"Answer all questions
   again"** (first-run-style) — and the picker exposes the
   `Answer all questions again` option on every re-run. Flipped answers
   auto-close superseded "find out" Actions with reason
   `superseded-by-questionnaire-run/<runId>`. Each apply is preceded by a
   Core `snapshot` of type `questionnaire-run` for audit and rollback.
7. **Pack scope.** v1.33 ships a curated Starter pack and per-Domain
   `Domain deep dive` packs (GOV / RISK / INFO / TECH / PER / PHYS), with
   identical answer semantics; any pack may be re-run independently.
7. **v0.8 placement.** This feature ships as a sibling of `PSPF: Load Sample
   Workspace` in the v0.8 first-run test path. It does not change the v0.1
   thin-slice acceptance criteria (ADR 0014).

## Consequences

### Positive

- A new operator can populate a workspace from real-world answers in a
  single sitting, producing a custom enhanced starting bundle.
- The same flow doubles as a periodic posture refresh, with stale-review
  surfacing built in.
- Provenance is explicit: every change is linked to a `questionnaire-run`
  Snapshot and a versioned, hashed question pack.
- Existing Core invariants (writer lock, redaction, integrity) apply
  unchanged because the questionnaire is a Workshop client, not a new
  write path.

### Negative / accepted trade-offs

- The Starter pack is editorial: it requires curatorial maintenance as PSPF
  releases evolve, and a CI gate is needed to keep it in sync with the
  active PSPF baseline.
- The question count is intentionally small; operators who want full
  coverage must run Domain deep dives separately.
- Re-run semantics add a new dimension to the data model
  (`questionnaire_runs`) that future migrations must respect.

## Alternatives considered

- **Skip a questionnaire; keep the sample fixture as the only fast path.**
  Rejected: the sample is privacy-safe demo data, not the operator's. It
  cannot double as a "first daily bundle".
- **Ship a single 218-question, per-Requirement questionnaire.**
  Rejected as the first cut: too long for one sitting, and the editorial
  cost of writing 218 high-quality plain-English questions before any user
  feedback is unjustified. Per-Requirement coverage may be added later as
  an additional pack family.
- **Let operators author packs in-product.** Rejected for this slice:
  community-extensible packs need provenance, attribution, and review
  workflows that are out of scope. Revisit after first assurance-user
  feedback.
- **Make answer→records mapping configurable.** Rejected: a deterministic,
  spec-fixed policy is what makes the questionnaire auditable. A
  configurable policy is effectively a new authoring surface.

## Compatibility axes

- `schemaVersion` is **unchanged** in v1.33; runs persist as JSON files
  under `.pspf/questionnaire/runs/` so no new SQLite tables, no new
  contract entity types, and no new schema directory are introduced this
  slice. Database-backed storage is a follow-on slice.
- `bundleVersion` is unchanged; questionnaire run files are local-only.
- `apiVersion` is unchanged; the questionnaire reuses existing Core APIs
  (`pspf.core.upsertEntities`, `pspf.core.listEntities`).

## Quality gates (delta)

- `check:questionnaire-pack` validates Starter and Domain packs against the
  active PSPF reference data, runs AU-English lint, and asserts every
  question declares a publication policy.
- The personal-data-exclusion gate (N6/S7) is extended to scan
  questionnaire answer note files under `.pspf/questionnaire/runs/`.
- Workshop unit tests cover every branch of the deterministic answer policy.
- Playwright e2e covers first-run apply and a re-run that flips an answer
  and auto-closes the superseded Action.

## Related

- [pspf-questionnaire-spec.md](../pspf-questionnaire-spec.md)
- [adr/0014-v0-1-thin-slice.md](0014-v0-1-thin-slice.md)
- [adr/0026-v0-8-first-run-and-packaging-readiness.md](0026-v0-8-first-run-and-packaging-readiness.md)
- [pspf-onboarding-spec.md](../pspf-onboarding-spec.md)
- [pspf-core-workshop-screen-workflow-spec.md](../pspf-core-workshop-screen-workflow-spec.md)
- [pspf-security-redaction-controls.md](../pspf-security-redaction-controls.md)
- [pspf-reference-data-baseline-spec.md](../pspf-reference-data-baseline-spec.md)
