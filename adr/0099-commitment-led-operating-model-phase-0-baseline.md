# 0099 — Commitment-led operating model: Phase 0 decision baseline and Phase 2 contract amendment

- Status: accepted
- Date: 2026-09-20 (proposed and accepted the same day; the four blocking decisions were closed by the operator, all as recommended)
- Related: [.hermes/plans/2026-09-19_091633-commitment-led-operating-model-techspec.md](../.hermes/plans/2026-09-19_091633-commitment-led-operating-model-techspec.md) (source specification, status aspirational), [docs/commitment-operating-model-plan.md](../docs/commitment-operating-model-plan.md) (programme plan, Phase 0 record and Phase 1 handoff), ADR 0003 (link taxonomy), ADR 0005 (default-deny publication), ADR 0006 (snapshot/erasure), ADR 0008 (version axes), ADR 0080 (strategy risk priority, `buildStrategyDeliverySummary`), ADR 0096 (Essentials surface budget and lens retirement — partially superseded, see D1), ADR 0097 (person-free team ownership, D5; narrative/reporting builders), ADR 0098 (Risk overhaul contract baseline — precedence, see D9).

This ADR is the Phase 0 output of the Commitment-led operating model programme. It closes the techspec's ten open decisions (`O-01`–`O-10`) as either **accepted** (recommended default, no further design needed) or **blocking** (needs the product owner's explicit choice before Phase 1 begins), and fixes the contract-mapping, field-publication and link-taxonomy decisions Phase 1 will implement. **No product code, schema, migration or UI change is authorised by this ADR.** Accepting it authorises only `docs/commitment-operating-model-plan.md` Phase 1 to begin against the tables below.

## Context

### Precedence (carried forward from `pspf-grand-plan.md`)

Workshop Risk overhaul Phase 4B (live walkthrough, accessibility/performance pass, redaction/recovery evidence) is explicitly deferred so this programme can take scheduling precedence. That deferral is unchanged by this ADR. This programme does not touch Risk overhaul contracts, panels or the shared shell in a way that would satisfy Phase 4B by proximity.

### What exists today (verified 2026-09-19/20 at product `1.75.0`, axes `1.17.0`)

- `StrategyEntity` with nested `StrategicChoice` (`packages/contracts/src/index.ts`) already carries outcomes, measures, rationale, constraints and typed references. `buildStrategyPrioritySummary`/`buildStrategyDeliverySummary` (`packages/workshop/src/continuous-compliance.ts`) derive an unpersisted attention signal (ADR 0080).
- `ActionEntity` already carries `ownerTeam`, `planningState`, dates and `dueDateHistory` (`appendDueDateHistory`/`summariseSlippage`, `packages/contracts/src/index.ts:4196–4250`); Core prepares action writes in `packages/core/src/service.ts`.
- `buildStrategyDeliverySummary` currently classifies an outcome as delivery-progressing from `todo`/non-`todo` Action status, **not** from `planningState`. This is a defect relative to the "delivery ≠ agreement" distinction this programme requires and is corrected in Phase 1 (see Decisions, D2).
- `packages/webview-shell/src/presentation-lens.ts` always normalises to `ciso`; ADR 0096 retired the CISO/Auditor/Solo persona taxonomy. There is no existing generalised "working context" concept.
- `packages/contracts/src/risk-crosswalk.ts` and Core `commitRiskCrosswalk` establish a staged preview → confirm → atomic-apply → undo pattern for external reconciliation (ADR 0098 D-series); this programme reuses that pattern, not Risk's entity semantics.
- Explorer's `src/data/core-bundle.ts` and `src/data/share.ts` are known, disclosed boundary debt (not a proven exploit): they do not uniformly prove the single-master-bundle/default-deny policy is enforced end to end. This programme does not touch Explorer in P1 (see D6) and does not rely on those paths being sound.
- `PUBLICATION_FIELD_POLICIES`/`sanitiseEntityForPublication` (contracts) and `pspf-security-redaction-controls.md` remain the only publication mechanism; there is no existing per-field allowlisted projection that safely nests sensitive decision content inside an already-public `StrategyEntity.choices` array.

### Constraints carried forward

- Local-first; no network, telemetry, connector or scheduled automation is introduced.
- Three compatibility axes only (`schemaVersion` = `bundleVersion` = `apiVersion`); no fourth axis for methodology/source revisions.
- Default-deny publication; every new field, nested or not, declares `publication`. New commitment/decision/assessment content is `sensitive` in P1 (see D6); nothing here authorises Explorer projection.
- Person-free ownership (ADR 0097 D5): team/role labels only, never `Person.name`, `Person.email` or `Assignment.personId`; no Pub ingestion.
- Essentials surface budget (`scripts/lib/essentials-surface-baseline.json`) changes only by a recorded, approved before/after count.
- ADR 0096's retired persona routes and taxonomy stay retired; this ADR supersedes only its prohibition on any explicit working-context switch (D1).

## Decisions

Each row states the Phase 0 recommendation (from the techspec's `O-01`–`O-10` and its supporting `D-*` decisions) and its approval state. Rows marked **Accepted** close a genuinely low-risk recommendation. Rows marked **Blocking** need the product owner's explicit choice — the techspec is explicit that these are seams for Toby's decision, not for the implementing agent to invent.

### D1 — Working-context reintroduction and surface budget (`O-01`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                      | State    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1.1 | ADR 0099 supersedes **only** ADR 0096's blanket prohibition on any presentation mode. ADR 0096's plain-language journey, accessibility rules and Essentials surface-budget controls remain in force unchanged.                                                                                                                                                                                                                | Proposed |
| 1.2 | Two explicit working contexts only: `"operations"` and `"oversight-assurance"`. No revival of the retired `ciso`/`auditor`/`solo` taxonomy or any route it used. `presentation-lens.ts`'s permanent `ciso` normalisation is left as dead code for existing consumers and is not repurposed as the new context store.                                                                                                          | Proposed |
| 1.3 | Context is a new, separate `workspaceState` key (proposed name `pspf.workshop.workingContext`), never the retired lens key. Switching is explicit only — a menu/command, never inferred from role, activity or legacy values — and defaults to `"operations"` on first use with no prior key.                                                                                                                                 | Proposed |
| 1.4 | Context selection changes **no** business record, capability or write permission. It is presentation/query-scope only: which builders' output leads the landing panel and which panel labels/order are shown.                                                                                                                                                                                                                 | Proposed |
| 1.5 | Surface budget: this programme is expected to add **zero** new commands and **one** new panel state (a context indicator/switcher within an existing panel, not a new `createWebviewPanel` host) in Phase 1. Any measured deviation from that estimate is recorded as a before/after count in `docs/commitment-operating-model-plan.md` and requires explicit approval before merge, per the existing Essentials budget rule. | Proposed |

### D2 — Semantic-debt fixes required before any commitment/assessment work relies on them (`REQ-06`, techspec §4.2 items 1–2)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                  | State    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2.1 | `buildStrategyDeliverySummary` is corrected in Phase 1 to classify delivery progress from `ActionEntity.planningState`, not from `todo`/non-`todo` status. A fixture proves an Action that is `status: "in-progress"` but `planningState` unset/`proposed` is **not** counted as committed delivery.                                                                                                      | Proposed |
| 2.2 | `appendDueDateHistory`'s no-op-when-unchanged behaviour is not, by itself, evidence that every write/import path prevents replacing or removing prior history. Phase 1 (or the phase that first depends on immutable history for a new record type) adds a Core write-boundary test that an existing/altered history entry cannot be dropped or rewritten by an ordinary write or an older-schema import. | Proposed |
| 2.3 | Neither fix changes `ActionEntity`'s schema or publication policy. Both are pure-function/write-path corrections gated by their own package tests, landed before Phase 2's commitment-model work depends on either property.                                                                                                                                                                              | Proposed |

### D3 — Persistence approach: thin aggregates, no duplicate entities (`O-02`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                               | State    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 3.1 | Reuse `StrategyEntity`/nested `StrategicChoice`, `ActionEntity`, `RiskControlEntity`, Evidence and existing typed Links as canonical. No standalone `StrategyChoice` entity is created merely to match techspec prose.                                                                                                                                                                                 | Proposed |
| 3.2 | Four new Core-owned collections only, added in Phase 2 onward (not by this ADR): `source-plan` (descriptor/binding), `commitment` (aggregate + immutable baseline revisions), `assessment-revision`, `governance-decision`. Exact entity names, ID prefixes and collection names are fixed in the Phase 2 ADR addendum or a Phase 2 amendment to this ADR — not invented ad hoc during implementation. | Proposed |
| 3.3 | `governance-decision` and `assessment-revision` may be implemented as a rigorously extended existing event/change-record contract only if it satisfies the same invariants (immutable, targeted, supersession not deletion). If it cannot, dedicated typed records are used. This choice is made and recorded when Phase 2 begins, with the specific contract diff shown before it lands.              | Proposed |
| 3.4 | No generic workflow engine, full event-sourced rewrite, or master task register. `ActionEntity`/`planningState` remain the only delivery-item model; a "milestone" is an ordinary Action with optional typed source-binding metadata, never inferred from title text.                                                                                                                                  | Proposed |

### D4 — Person-free authority and accountability (`O-03`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                      | State    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 4.1 | All new accountability/authority fields are local role/team key references (ADR 0097 D5 pattern), never a person reference. Authority basis (`authorityRoleRef`, `authorityBasis`, `assurance: "operator-recorded"`) is an operator-recorded assertion, explicitly labelled as such in UI copy — never presented as an authenticated signature, RBAC decision or independent-assurance claim. | Proposed |
| 4.2 | No Pub ingestion, no `Person.name`/`Person.email`/`Assignment.personId` anywhere in this programme's contracts, fixtures or UI. Unassigned/Unknown remain valid, displayed states.                                                                                                                                                                                                            | Proposed |

### D5 — First real source-plan integration for P1 (`O-04`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                          | State    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 5.1 | P1 ships **manual reference registration only**: the operator registers a source plan's identity (source-system key, plan key, kind, scope, accountable team/role assertion) and enters its milestones by hand as ordinary source-bound Actions.                                                                                                                                                                                                                  | Proposed |
| 5.2 | No file adapter, live connector, scheduled import or write-back ships in P1. The techspec's previewed one-way file-reconciliation adapter (its §9, `AC-18`–`AC-22`) is explicitly deferred to P2, alongside the source-binding identity tuple (`sourcePlanId`, `sourceRecordKey`, `sourceRevision?`, `sourceUpdatedAt?`, `observedAt`, `contentChecksum`) and the separation of source claims from local authority, which are retained as the P2 design baseline. | Proposed |
| 5.3 | Reuse of the `risk-crosswalk` preview → confirm → atomic-apply → undo pattern is deferred to whichever phase implements the file adapter (P2); it is not built speculatively in P1.                                                                                                                                                                                                                                                                               | Proposed |

### D6 — Publication scope (`O-06`, techspec `D-12`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                | State    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 6.1 | All new commitment, source-binding, assessment, decision and rationale content is `sensitive` and stays local for the entire P1 release. No field in this programme is `public` in P1.                                                                                                                                                                                                  | Proposed |
| 6.2 | P2 Explorer projection requires its own field-level publication ADR and passing egress/round-trip tests before any new field may become `public`; it is not implied or pre-approved by this ADR.                                                                                                                                                                                        | Proposed |
| 6.3 | New sensitive fields are never nested inside the existing public `StrategyEntity.choices` array without an explicit, tested recursive-policy proof. Until such a test exists, any new decision record referencing a choice is a separate local-only record that links to the existing (unchanged, still-public) choice by ID — it does not add a new property inside the choice object. | Proposed |

### D7 — Standing-expectation cadence and freshness (`O-05`)

| #   | Decision                                                                                                                                                                                                           | State    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 7.1 | Cadence/review-by fields are per-expectation or per-source-policy settings with an explicit `"unknown"` state. No universal invented SLA or default review window is fabricated when the operator has not set one. | Proposed |
| 7.2 | An assessment/expectation with unknown cadence renders as "review cadence not set", never as silently current or silently overdue.                                                                                 | Proposed |

### D8 — Original-agreement evidence for legacy/existing work (`O-08`)

| #   | Decision                                                                                                                                                                                                                                                 | State    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 8.1 | Existing Actions/outcomes with no recorded baseline are `"unagreed"`/first-observed by default when this programme's model is first applied to them. No historical baseline, approval date or agreement is backfilled as fact.                           | Proposed |
| 8.2 | An operator may explicitly adopt an existing Action/outcome into a commitment, which creates a **new** baseline revision dated at adoption time with real evidence (the adoption decision itself). This is the only way legacy work acquires a baseline. | Proposed |

### D9 — Framework/reference-data currency and Risk-overhaul precedence (`O-09`, `O-07`)

| #   | Decision                                                                                                                                                                                                                                                                                                                                      | State    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 9.1 | This programme does not refresh or assume currency of vendored PSPF/ISM datasets. Any reference to framework edition/currency in new UI copy states the existing vendored edition; a catalogue refresh remains a separately approved change with its own impact review, per the reference-data curator's existing process.                    | Proposed |
| 9.2 | This programme's Phase 1 work does not depend on Risk overhaul Phase 4B; it does not touch `RiskEntity`, `risk-control`, `risk-event` or the Risk workbench panels. If a later phase needs a Risk-model dependency, that phase names the specific Phase 4B evidence it requires before proceeding, rather than assuming Phase 4B is complete. | Proposed |

### D10 — First-use context and preference scope (`O-10`)

| #    | Decision                                                                                                                                                                                                                 | State    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 10.1 | First use in a workspace with no stored context key defaults to `"operations"` and does not prompt a first-run choice dialog (consistent with the existing onboarding journey, which is not reopened by this programme). | Proposed |
| 10.2 | The context preference is workspace-scoped `workspaceState`, per supported host surface (Workshop initially). No cross-device, cross-workspace or cross-person synchronisation of the preference is introduced.          | Proposed |

## Blocking decisions requiring explicit sign-off

The following are not accepted by recommendation alone; they materially change scope, risk exposure or the release train and need the product owner's explicit choice.

| #                | Decision                                                                                                                                                                                                                                                                                                             | Recommendation if accepted as-is                                                                                                                                                                                                                      | State    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| B1 (`O-01`/D1.5) | Whether the Phase 1 working-context switch may add the one new panel-state affordance described in D1.5, given the Essentials budget is otherwise unchanged.                                                                                                                                                         | **Accept**: proceed with the one recorded panel-state addition; no command count increase.                                                                                                                                                            | Blocking |
| B2 (`O-02`/D3.2) | Whether `commitment`/`assessment-revision`/`governance-decision` land as genuinely new Core collections (schema-axis bump in Phase 2) rather than reusing Change Records more aggressively to avoid a bump.                                                                                                          | **Accept**: new collections in Phase 2, one bump, following the ADR 0091/0097/0098 batching precedent — reusing Change Records for immutable targeted history was evaluated in the techspec and found to risk an overloaded `status`/authority model. | Blocking |
| B3 (`O-06`/D6.1) | Whether _any_ field in this programme may be `public` in P1 (e.g., an opaque commitment-state enum, mirroring how Risk's `assessmentState` is public while its rationale is not).                                                                                                                                    | **Recommend against**: keep 100% of P1 fields `sensitive`; revisit a narrow public-enum exception only alongside the P2 publication ADR, not before.                                                                                                  | Blocking |
| B4 (`O-04`/D5.1) | Whether P1 also needs a second manually-registered source-plan **kind** beyond a generic default (e.g., distinguishing `assessment-poam` from `uplift-plan` from `operational-plan` at the UI level in P1, versus treating `kind` as a stored-but-unsurfaced field until P2 needs to distinguish behaviour by kind). | **Recommend**: store `kind` as a required field from `{ "assessment-poam", "uplift-plan", "operational-plan", "local-plan" }` from P1, but do not build kind-specific behaviour until a phase needs it.                                               | Blocking |

## Contract mapping (Phase 1 scope only)

Phase 1 implements **only** D1 (working-context presentation) and D2 (the two semantic-debt fixes). No new entity, collection, field or link ships in Phase 1. The table below is the Phase 1 file/contract map; Phase 2's entity/field/link tables are deferred to the Phase 2 amendment named in D3.2.

| Change                                      | File(s)                                                                                   | Notes                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Working-context type and read/write helpers | `packages/webview-shell/src/` (new module, e.g. `working-context.ts`)                     | Mirrors `presentation-lens.ts`'s shape but is a distinct key and type; does not touch or repurpose the retired lens module.  |
| Context switch command/affordance           | `packages/workshop/src/extension.ts`, relevant panel host                                 | No new `createWebviewPanel`; reuses an existing panel's chrome per D1.5.                                                     |
| `buildStrategyDeliverySummary` correction   | `packages/contracts/src/continuous-compliance.ts` or its current home, plus its test file | Classify by `planningState`, add a fixture with `status !== planningState` divergence.                                       |
| History write-boundary test                 | `packages/core/src/service.test.ts` (or nearest existing history test)                    | Proves an existing history entry cannot be replaced/dropped by an ordinary write or older-schema import; no contract change. |

## Compatibility and recovery strategy

1. Phase 1 changes presentation state and two pure-function/write-path corrections only. No schema, no compatibility-axis change, no migration.
2. Any Phase 2 schema bump (per D3.2, if accepted) follows the existing one-bump-per-programme precedent (ADR 0091/0097/0098): new collections, fields and link types land together, with additive-merge preservation and full-fidelity cold-restore proof before release, exactly as ADR 0098 D6/D7 required for Risk.
3. Nothing in this ADR changes what "backup" means; the existing distinction between lossless local backup and sanitised publication export is unchanged.

## Consequences

Positive:

- Reopens exactly one prohibition from ADR 0096 (no presentation modes) while leaving its simplification, plain-language and budget rules intact — the narrowest possible supersession.
- Fixes two known semantic defects (`buildStrategyDeliverySummary`, history immutability assumption) before anything new is built on top of them, rather than inheriting silent false-assurance risk into Phase 2.
- Keeps 100% of new data local/sensitive in P1, so there is no publication, redaction or schema-coverage risk from this slice.
- Zero new commands, at most one new panel-state affordance, and no dependency on the deferred Risk overhaul Phase 4B.

Negative / accepted costs:

- Defers the file-based source adapter and any public field to P2, so the "consolidated posture" value is only partially realised until P2 is separately gated and approved.
- Four blocking decisions (B1–B4) must be closed by the product owner before Phase 1 begins; this ADR cannot be marked `accepted` until they are.

## Operator approvals

Closed 2026-09-20, each as recommended:

- B1 — **accepted**: Phase 1's working-context switch may add one recorded panel-state affordance; no new command.
- B2 — **accepted**: `commitment`/`assessment-revision`/`governance-decision` land as new Core collections in a single Phase 2 schema bump, following the ADR 0091/0097/0098 precedent.
- B3 — **accepted**: 100% of P1 fields are `sensitive`; no public field is introduced before the P2 publication ADR.
- B4 — **accepted**: source-plan `kind` is a required enum from P1; no kind-specific behaviour is built until a later phase needs it.

All rows are accepted. Phase 1 may begin against the tables above.

## Phase 2 contract amendment — accepted 2026-09-20

This amendment closes the contract-review portion of Phase 2. It authorises the
smallest implementation slice: a local `commitment` aggregate with immutable
baseline revisions and a dedicated `governance-decision` record. It does not
authorise Explorer projection, source-plan reconciliation, assessment
revisions, or UI work.

### Canonical records and identity

| Entity type           | Collection             | ID prefix | Phase 2 role                                                                                                    |
| --------------------- | ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `commitment`          | `commitments`          | `CMT`     | Accountable outcome or standing expectation with its current baseline pointer and immutable baseline revisions. |
| `governance-decision` | `governance-decisions` | `GDE`     | Person-free, operator-recorded approval, revision, supersession, cancellation or rejection decision.            |

`commitment-baseline` is not a separate entity. A baseline revision is an
immutable nested value of `CommitmentEntity`, identified by a revision token
and referenced by `currentBaselineRevision`. `source-plan` and
`assessment-revision` remain deferred to Phases 3 and 4 respectively. No
standalone Strategy Choice entity is introduced.

### Field contract

Every field below, including fields nested in `baselineRevisions` and
`target`, has publication policy `sensitive`. Envelope fields retain their
existing policy table and validation rules. No Phase 2 field is `public`.

| Record                | Required fields                                                                                                                                                      | Optional fields and rules                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commitment`          | `title`, `intendedOutcome`, `scope`, `accountableOwnerRef`, `commitmentState`, `baselineRevisions`, `currentBaselineRevision`                                        | `driverRefs`; each choice driver contains `strategyId`, `choiceId` and a pinned `revision`. `commitmentState` is `draft`, `proposed`, `agreed`, `superseded` or `cancelled`.                                                    |
| Baseline revision     | `revision`, `outcome`, `scope`, `accountableOwnerRef`, `target`, `acceptanceCriteria`, `approvalDecisionId`, `effectiveAt`, `recordedAt`                             | `supersedesRevision`; `target` is either a dated target with explicit timezone or a recurring target with cadence, next review time and timezone. Unknown cadence remains absent or explicitly unknown; it is never fabricated. |
| `governance-decision` | `title`, `kind`, `targetType`, `targetId`, `targetRevision`, `decision`, `rationale`, `authorityRoleRef`, `authorityBasis`, `assurance`, `effectiveAt`, `recordedAt` | `supersedesDecisionId`, review/expiry conditions and supporting record reference. `assurance` is the literal `operator-recorded`; it is not a signature or authenticated identity.                                              |

`accountableOwnerRef` and `authorityRoleRef` are person-free team/role keys.
The agreement transition to `agreed` requires outcome, scope, accountable
owner, target or cadence, acceptance criteria and an approval decision. An
Action becoming `planningState=committed`, a source status, a score, or a
reported completion cannot establish agreement.

### Allowed link extension

Phase 2 reuses the existing `changes` verb and adds exactly one permitted
triple:

| From                  | Link type | To           | Meaning                                                                                          |
| --------------------- | --------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `governance-decision` | `changes` | `commitment` | Records an approval, revision, supersession, cancellation or rejection affecting the commitment. |

No baseline-ownership link is needed: the commitment owns its immutable
baseline revisions and references the approving decision by `approvalDecisionId`.
Contribution links to Actions, controls and choices, and source bindings, are
deferred until their owning phases define cardinality and withdrawal rules.
Self-links, arbitrary link verbs and links from a governance decision to a
Person or Assignment are rejected.

### Persistence, migration and recovery contract

1. Core remains the sole write boundary. Ordinary writes may advance the
   commitment state or append a new baseline revision, but may not mutate,
   reorder or remove an existing baseline revision or governance decision.
2. An agreed-to-revised transition appends a new baseline and decision, points
   `currentBaselineRevision` at the new revision, and preserves the original
   baseline byte-for-byte. A correction or withdrawal is a new decision, not
   an update or deletion of the issued record.
3. Additive merge preserves all Phase 2 records and revisions by canonical ID;
   collisions are rejected unless the existing Core conflict policy explicitly
   classifies the record as unchanged. Full-replace restores the complete
   commitment and decision collections atomically, with rollback to the
   pre-replace snapshot on failure.
4. Cold restore must prove that a draft commitment can be restored, moved to
   agreed, revised, exported, and restored again without invented history,
   lost revisions or changed decision identity.
5. The implementation uses only `schemaVersion`, `bundleVersion` and
   `apiVersion`. The new collections and fields land in one compatibility-axis
   bump; the previously published schema remains immutable.

### Phase 2 review result and next implementation gate

The contract review and bounded implementation slice are complete and accepted
on 2026-09-20. `@pspf/contracts` and Core register the two entity types and
collections, focused immutable-history/restore tests pass, and
`check:commitment-model` is green. The slice remains local-only, keeps all new
fields `sensitive`, and adds no Workshop surface. Release sequencing must still
assign the next compatibility-axis version and publish a new immutable schema
slice before release readiness; this implementation does not silently change
that decision.
