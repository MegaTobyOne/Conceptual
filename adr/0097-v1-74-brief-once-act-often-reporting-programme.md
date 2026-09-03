# 0097 — v1.71–v1.74 "Brief once, act often" reporting and accountability programme

- Status: accepted
- Date: 2026-09-02

## Context

The v1.70 Essentials programme (ADR 0096) is complete: one plain-language journey, a shared requirement finder, a guided decision-and-action flow, save-and-impact feedback, and an enforced surface budget. ADR 0096 D2 and the grand plan's "Explicitly deferred" list promised that analyst and CISO oversight needs would be met in v1.71+ by dedicated review screens under a later ADR. This is that ADR.

The stakeholder driving it is a CISO who is the named owner of some PSPF Domains and a stakeholder in the rest. Reporting season demands, per Domain, a set of responses, the evidence behind them, a trend, a narrative, and an action plan. Executives read the narrative, not the detail. Accountability requires knowing which team owns each gap and each action, and whether it is actually closing.

The current model cannot answer those questions:

- `ActionEntity`, `RequirementEntity`, and `RiskEntity` carry no owner field. The only ownership signal is `RequirementControlMapping.reviewBy`, a free-text string on a mapping rather than on the record that needs an owner.
- `ActionEntity` has a `dueDate` but no history. When a date moves, the previous date is overwritten, so slippage is invisible and closure velocity (`computeClosureVelocity`, S5) cannot distinguish "closed on time" from "closed after three extensions".
- The posture brief opens with counts. Snapshot side files hold counts only, so period-over-period comparison (`describeChangeRollup`, S6) can say "two more requirements compliant" but cannot name them.
- Operator narrative — the Digital CISO Magazine editor notes — lives in VS Code `workspaceState`. It is not versioned, not snapshot-anchored, and not reusable by the posture brief or master plan, so the same paragraph is retyped for each artefact.
- Pub (`packages/pub`) holds `Team` records, but it is an isolated store with no person-free query API. Reaching into it for team names would couple Workshop to a person-bearing extension.

The S1–S7 judgement primitives already compute the facts (basis, consequence, blockers, trajectory, change); the E1 explainer pack already supplies plain-language words. What is missing is a place that composes them into a reporting pack, an ownership axis to hang accountability on, and a way to write a narrative once and reuse it.

## Decision

1. **One new Workshop panel.** A **Reporting Workbench** panel and command `pspf.workshop.openReportingWorkbench`, classified as an Essentials command, with tabs **Executive Brief**, **Domain packs**, **Team report card** (from v1.73.0), and **Readiness**. It offers a **Me ↔ All** scope toggle driven by the new setting `pspf.workshop.myDomains` (a list of PSPF Domain codes), a snapshot anchor picker for period-over-period comparison, and copy-out as Markdown and plain text. The essentials-surface baseline in `check-essentials-surface.mjs` is re-based once for this reason — Workshop 71→72 commands and 29→30 webview panels — and no other surface growth is permitted by this programme.
2. **Deterministic narrative only.** Every generated sentence is composed from existing `@pspf/contracts` primitives — `assessmentBasis`, `buildConsequenceStatement`, `rankBlockersByFanIn`, `projectTrajectory`, `describeChangeRollup` — and `@pspf/reference-data` explainers. Every verdict prints the rule that produced it. No AI-generated prose is introduced; AI remains optional, default-off, draft-and-confirm for ISM mapping only, exactly as ADR 0077 permits.
3. **Snapshot side files gain a per-record status map.** Alongside the existing counts, each snapshot records the status of every requirement, risk, and action by id, so a period-over-period comparison can name which records changed. Snapshots taken before v1.71.0 degrade to a counts-only comparison, and the output is labelled as such. This is a side-file change only; the master bundle, `bundleVersion`, and Explorer schema are untouched.
4. **Single schema bump in v1.72.0** to compatibility axes `1.16.0`, following the S4/v1.57 precedent of batching schema change into one slice. It adds `action.ownerTeam`, `action.dueDateHistory` (an array of `{ dueDate, changedAt }`), and `requirement.ownerTeam`, all declared `sensitive`; a new `narrative` entity and collection with fields `slot`, `body` (`sensitive`), `audience`, `basedOnSnapshotId`, optional `targetRef`, and optional `supersedesId`; and an explicit publication policy for `strategy.owner`, which is currently undeclared and therefore already a failure under `pspf-invariants.md`. Core appends an entry to `dueDateHistory` whenever `dueDate` changes; callers do not write the history directly.
5. **Owner is a team label, never a person.** `ownerTeam` is a free-text team label authored in Workshop through a picker of previously used values, so spelling converges without a controlled list. Pub is frozen for this programme (maintenance and version alignment only) and is out of scope as a team source. If a first-class team source is ever wanted, it will be a person-free Core `team` entity with a sibling `ownerTeamRef` field — never a dependency on Pub. No field introduced here may hold `Person.name`, `Person.email`, or `Assignment.personId`.
6. **Team report card (v1.73.0).** For each distinct `ownerTeam` the card states gaps owned; actions open, due this period, overdue, slipped, and closed in period; closure velocity; and a deterministic verdict of **On track**, **At risk**, or **Stalled** with fixed, documented rules printed on the card itself. An **Unassigned** row is always shown so unowned gaps cannot disappear from view.
7. **Write once, use many times (v1.73–v1.74).** Generated sections are editable in the workbench. Edits persist as `narrative` records; each edit supersedes the previous record through `supersedesId`, giving a restore chain rather than an overwrite. The posture brief, Digital CISO Magazine, and CISO Master Plan consume narrative records for matching slots and attribute them as "Operator note". **Close reporting period** is a single operation: take a snapshot and stamp the current narratives with its id as `basedOnSnapshotId`.
8. **Recommendations (v1.74.0).** For gaps with no linked action, the workbench drafts action stubs from the explainer's _What to do next_ text, ranked by impact (`rankBlockersByFanIn`) and defaulted to the requirement's `ownerTeam`. Nothing is persisted until the operator accepts stubs through a multi-select. Capture sweeps are added inside existing panels only — bulk freshness and link operations in the Evidence Review Queue, and batch mapping in the ISM Review Workbench using the deterministic ranker — with no new commands.
9. **Publication.** All new fields and every narrative body are `sensitive`. Report cards and Domain packs are Workshop copy-outs, not Explorer publications, and carry the **OFFICIAL: Sensitive** marking. The `narratives` collection and the `ownerTeam`/`dueDateHistory` fields exist in the master bundle schema so Core round-trips them, but the sanitiser strips every `sensitive` field (`ownerTeam`, `dueDateHistory`, `narrative.title`, `narrative.body`) before any bundle leaves the device. Only structural narrative metadata (slot, audience, snapshot and target references, supersession chain) is public, so a published bundle can show that a narrative exists for a slot without disclosing a word of it. Additive-merge imports preserve locally held sensitive ownership fields when the incoming record omits them.

### Slices and gates

| #   | Version | Focus                                                                                                               | Axes     | Gate                                     |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| R1  | 1.71.0  | Reporting Workbench panel; generated Executive Brief and Domain packs; Me/All scope; snapshot per-record status map | `1.15.0` | `check:reporting-workbench`, `e2e:v1.71` |
| R2  | 1.72.0  | Schema `1.16.0`: `ownerTeam`, `dueDateHistory`, `narrative` entity, `strategy.owner` policy; bulk owner assignment  | `1.16.0` | `check:ownership-schema`, `e2e:v1.72`    |
| R3  | 1.73.0  | Team report card; editable narrative with `supersedesId` restore chain                                              | `1.16.0` | `check:team-report-card`, `e2e:v1.73`    |
| R4  | 1.74.0  | Suggested actions; capture sweeps; narrative reuse in brief, magazine, and master plan; close reporting period      | `1.16.0` | `check:narrative-reuse`, `e2e:v1.74`     |

Each `e2e:v1.7x` journey chains from its predecessor so the S0 continuity gate keeps proving the whole release line from `e2e:v1.61` onward.

Versioning:

- Product version targets: `PSPF_SLICE_VERSION` moves `1.71.0` → `1.72.0` → `1.73.0` → `1.74.0`, one per slice.
- Package versions stay aligned with the product version at every slice.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.15.0"` for R1, because R1 adds no persisted entity, collection, or field; it moves to `"1.16.0"` in R2 and stays there for R3 and R4.

## Consequences

Positive:

- A Domain owner can produce responses, evidence, trend, narrative, and action plan for their Domains from one panel, and an executive receives narrative first with the detail reachable rather than leading.
- Accountability becomes visible: every gap and action has a team or sits in the Unassigned row, and slippage is recorded rather than overwritten.
- Narrative is written once and reused across the brief, magazine, and master plan, replacing `workspaceState` editor notes with versioned, snapshot-anchored, restorable records.
- The reporting pack is fully deterministic and explains its own verdicts, so it inherits the S1–S7 trust properties and needs no model, network, or new dependency.
- One axis bump batched into R2 keeps the schema change reviewable and follows an established precedent.

Trade-offs:

- The essentials-surface baseline moves by one command and one panel; this is a deliberate, ADR-recorded exception to the ADR 0096 budget, not a relaxation of the gate.
- Free-text `ownerTeam` will drift in spelling until the picker converges usage; a controlled team entity is deliberately deferred to avoid a premature Pub or Core dependency.
- Pre-1.71 snapshots only support counts-only comparison; operators wanting named change must take a fresh snapshot after upgrading.
- The `narrative` supersede chain grows storage with every edit; it is bounded by operator editing frequency and remains small relative to evidence records.
- Four slice releases with per-slice gates cost more release overhead than one release; this is accepted so each step is independently shippable and reversible.

## Alternatives considered

- **Native Office export (`.docx`/`.pptx`) as the reporting output**: deferred to Tranche 3 per ADR 0066. Markdown and plain-text copy-out serve reporting season now without dependency, packaging, or binary-validation risk.
- **AI narrative polish over the generated sections**: rejected for now. It would reintroduce unqualified prose into an executive channel, conflict with the deterministic-verdict rule in D2, and exceed the ADR 0077 draft-and-confirm boundary that limits AI to ISM mapping.
- **Tags as an ownership stopgap**: rejected because tags are public in export bundles, so team labels would leak into Explorer publications without a field-level policy.
- **Pub as the team source**: rejected because Pub is an isolated store with no person-free query API, coupling would import person-data risk into Workshop reporting, and it would make Pub an install dependency for a Workshop feature.
- **A separate CISO accountability screen**: folded into the Team report card tab of the Reporting Workbench; a second panel would breach the surface budget for no additional information.
- **Explorer publication of ownership and narrative**: deferred pending a dedicated field-level publication-policy ADR, consistent with the S7 precedent for Shop supplier data.
