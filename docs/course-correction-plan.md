# PSPF Course Correction Plan (v1.76.0–v1.82.0)

Status: **active — C0 implemented; C1–C6 planned**

Authority: sequencing is owned by [`pspf-grand-plan.md`](../pspf-grand-plan.md) §"Course correction programme". This document holds the detailed slices, testing approach, and execution guidance. It does not override `pspf-spec-consistency-index.md`; every slice that changes architecture, schema, or invariants opens with its own ADR.

## Risk-to-Outcome Review Update (2026-09-25)

The operator's primary job is to connect known risks/issues to Actions, measurable effects and strategic business outcomes. [Findings POA-01 to POA-06](../pspf-plan-spec.md#2026-09-25-product-review) distinguish the existing connected records from the missing end-to-end outcome loop. The [grand-plan update](../pspf-grand-plan.md#risk-to-outcome-roadmap-2026-09-25) is the sequencing authority.

C1/C2 still close verification debt first. C1 now includes the reproduced treatment-link mismatch; C3 makes capture and plan intent clearer; C4 supplies treatment and verification guidance; C5 tells an honest business-consequence story using existing data. None of these refinements delivers a structured observation/benefit model by assertion. O1-O3 are the next bounded capability priority after C6; the standalone Plan product and automatic restart of Commitment Phases 3-7 are not the next step.

FJ1-FJ4 remain stable baseline jobs. The proposed RO-J1 capture, RO-J2 verify and RO-J3 business-brief journeys in the Plan specification add correctness and friction criteria for the new work; they are not yet implemented instruments or passing gates.

## Why this programme exists

The 2026-09-20 plan review compared `pspf-grand-plan.md` against the shipped state at v1.75.0 and found the ecosystem structurally sound but **unable to demonstrate that recent work improved the operator's experience**. The findings below are the programme's remit. Each is stated as an observation with its evidence, not as blame.

| ID  | Finding                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| V1  | **Verification debt is structural, not incidental.** Two programmes sit part-complete and neither has had a live operator walkthrough. The repeating pattern is to ship contract plus gate and defer the phase that asks whether a person benefits.                                                             | Risk overhaul Phase 4B deferred 2026-09-19; Commitment-led model at Phase 2 of 7                                                    |
| V2  | **No outcome instrument exists.** Every gate proves structure, determinism, redaction, and accessibility rule compliance. None measures whether an operator reaches a defensible answer with less effort. The review question is therefore unanswerable from the repository.                                    | `scripts/check-*.mjs` inventory; no journey-cost or comprehension measure                                                           |
| V3  | **The surface freeze preserved the surface rather than reducing it.** E6/E7 retired three Explorer routes and three Workshop panels (~7%); R1 re-based the budget upward again. 47 of 72 Workshop commands are specialist and remain in the palette.                                                            | `scripts/lib/essentials-surface-baseline.json`; `docs/workshop-essentials-commands.md`                                              |
| V4  | **The active programme has weak feedback traceability.** The commitment/baseline/source-binding/assessment-revision model improves the ontology. No line of it traces to a recorded stakeholder request.                                                                                                        | `docs/feedback/CISOFeedback.md`, `docs/feedback/analystsfeedback.md`, `docs/feedback/Officefeedback.md`                             |
| V5  | **A retired affordance is returning without retesting the evidence that retired it.** ADR 0096 D1 retired the three presentation lenses because "a role switcher is itself a superfluous control". ADR 0099 D5 supersedes that prohibition one programme later with a different rationale but the same control. | `adr/0096-v1-70-essentials-programme-and-surface-reduction.md` D1; `adr/0099-commitment-led-operating-model-phase-0-baseline.md` D5 |
| V6  | **The highest-traceability unshipped requests are still deferred.** The standard mitigation library was recorded as "yes, we build this". The analyst change-review screen and the CISO accountability view were the stated replacement for the retired lenses. All three remain deferred five releases later.  | `pspf-grand-plan.md` §"Operational plan: compliance uplift workflow" decision 2; §"v1.70 Essentials programme" Explicitly deferred  |
| V7  | **Work in progress exceeds the plan's own rule.** "One active vertical slice at a time" holds inside a programme, but two programmes are open concurrently and each is blocking the other. Roughly 52 items sit on the deferred register, about two-thirds of them user-facing.                                 | Grand plan Explicitly-deferred sections across programmes                                                                           |

## What is working and must not be disturbed

This programme is a correction, not a repudiation. The following are deliberate strengths and are load-bearing constraints on every slice below:

1. Deterministic narrative only; every verdict prints the rule that produced it; no AI prose in reporting outputs.
2. Explicit counts and denominators; no averages, scores, rankings, or colour-only meaning.
3. Default-deny publication; person-free accountability (`ownerTeam`, always-present Unassigned row).
4. Honest degradation over silent inference — pre-1.71 snapshots report counts-only and say so; `projectTrajectory` is structurally incapable of returning an unqualified date.
5. Subtraction treated as a shippable deliverable with its own gate.
6. Feedback to design spec to ADR to gate is a real, traceable chain for E1–E8 and R1–R4. This programme extends that chain; it does not replace it.

## Operating rules for the programme

1. **One programme open at a time.** Until C2 closes, no new programme opens and no deferred-register item is promoted.
2. **Nothing new starts while verification debt is open.** C1 and C2 are debt closure. C3 onward are new value.
3. **The instrument comes first.** C0 ships before any slice that claims a UX improvement, so every later claim has a recorded before-and-after number.
4. **No slice may increase a recorded flagship-journey cost.** The C0 baseline is a ratchet enforced by `check:journey-cost`.
5. **Surface budget is a declining target from C3, not a ceiling.** Growth requires an ADR that names what is retired in exchange.
6. **Retirement stays view-level.** No record, entity, field, command API, export, or datum is removed, per the ADR 0096 precedent.
7. **Evidence substitutes are labelled as substitutes.** Simulated-operator evidence is recorded as weaker than observed-user evidence and never described as validation.

---

## Slice C0 — v1.76.0 — The evidence instrument

**Problem addressed:** V2. **Changes:** documentation, fixtures, one new gate. **No product code, schema, UI, or command change.**

The external think-aloud sessions committed at S2 (`docs/ux-improvement-ideas.md`) were never run. Rather than block indefinitely on participant availability, this slice builds a deterministic, offline, CI-runnable substitute that measures effort and comprehension rather than opinion. It is explicitly weaker than observed users and is labelled as such wherever it is reported.

### Deliverables

1. **ADR: UX outcome measurement without observed users.** Records the four instruments below, their known weaknesses, the ratchet rule, and the standing commitment to replace simulated evidence with observed evidence when participants become available.

2. **Flagship job definitions** in `docs/ux-evidence/flagship-jobs.md`. Four named, stable jobs over already-shipped capability, each written as an operator sentence with a defined start state and a defined "answered" end state:

   | ID  | Job                                                                             | Hosts              |
   | --- | ------------------------------------------------------------------------------- | ------------------ |
   | FJ1 | Establish why a requirement is currently compliant, and on what basis           | Explorer, Workshop |
   | FJ2 | Take an unmet requirement to an owned, dated action with recorded rationale     | Workshop           |
   | FJ3 | Produce this reporting season's Domain pack for a Domain I own                  | Workshop           |
   | FJ4 | Establish what changed since the last reporting period, and which of it matters | Explorer, Workshop |

3. **Interaction-cost measurement.** Extend the existing Playwright journeys to emit a per-job cost record: route or panel changes, distinct surfaces opened, discrete input events, and the step index at which a stated answer first becomes visible. Counted deterministically from the driver, not timed — wall-clock is machine-dependent and would make the gate flaky.

4. **Comprehension measurement.** A scripted cognitive walkthrough (the four Wharton questions — will the operator know what to do, notice the control, recognise it as the right one, and understand the feedback) executed per step of each flagship job and recorded with a pass, partial, or fail verdict plus the reason. Executed by a reviewer, not inferred from code.

5. **Readability scoring.** Promote `check:banned-jargon` from a banned-term list to a recorded score: undefined specialist terms per essentials screen, measured against `pspf-glossary.md`. The ban stays; the score is what the programme moves.

6. **Gate `check:journey-cost`.** Fails if any FJ1–FJ4 cost record exceeds its recorded baseline, if a flagship job loses its cost record, or if the evidence pack's recorded product version falls behind `package.json`. The last condition prevents the pack going stale silently, which is how the S2 commitment was lost.

### Done when

The four jobs have recorded baseline cost records, walkthrough verdicts, and readability scores at v1.76.0; `check:journey-cost` is registered in `check:gates:run` and `release-gates.json`; `e2e:v1.76` chains from `e2e:v1.75`; and `docs/ux-improvement-ideas.md` states plainly that the S2 think-aloud commitment was not met and what now substitutes for it.

### Testing

Unit tests for the cost-record reducer with empty, typical, and 500-item fixtures. A deliberate regression fixture proves the gate fails when a job's cost rises. A stale-pack fixture proves the version-freshness condition fires.

### Execution

`PSPF Gate Writer` for `check-journey-cost.mjs` and the Playwright cost emitter. `PSPF Reviewer` executes the cognitive walkthrough and records verdicts — the walkthrough must not be authored by whoever wrote the screen. `PSPF Slice Mechanic` for the version bump, chain, coverage registration, and index rows. Opus for the ADR and the instrument design, since a badly designed instrument produces confident nonsense for several releases; Sonnet for the gate and emitter implementation once the record shape is fixed.

---

## Slice C1 — v1.77.0 — Close Risk overhaul Phase 4B

**Problem addressed:** V1, V7. **Changes:** verification, evidence, documentation, and only the fixes the walkthrough exposes.

This is the older debt and is one phase from complete. It closes first. Scope is exactly the four outstanding items recorded in `docs/risk-overhaul-plan.md` §"Phase 4B Handoff"; the programme does not extend Risk scope.

### Deliverables

1. Live VS Code operator walkthrough of the Risk workbench, treatments and controls, crosswalk import, and presentation outputs — recorded step by step in the Risk plan with actual results, including what did not work.
2. Accessibility and performance pass at 320, 768, and 1440 px and at 200% zoom over every touched Risk surface, with the screenshot evidence pack.
3. Final redaction, compatibility, and lossless-recovery evidence for the `1.17.0` schema slice, including the hostile sensitive and person-name fixture.
4. Every disclosed limitation in each phase's "Known follow-ups" either closed, or explicitly re-deferred with a stated reason. Silent dropping is a gate failure.
5. Correction of any Risk specification the walkthrough proves stale.
6. **New:** the Risk surfaces are measured against the C0 instrument. A specialist workbench is not exempt from the cost ratchet.
7. **POA-01 repair evidence:** an Action created from Risk through `treated-by` must retain its treatment context in Action Impact, Plan classification and relevant strategy/reporting views. The 2026-09-25 source probe returned zero risk weighting and "No linked ... risks" for that canonical link. Add focused canonical/supported-legacy, shared-Action and duplicate-link regressions; preserve unknown/custom assessment semantics. This repairs existing behaviour and does not add a treatment-effect schema.

### Done when

Every item above is recorded in `docs/risk-overhaul-plan.md` with actual results; `check:risk-verification` proves the evidence pack exists, covers every touched surface, and carries the current product version; the Risk plan's status line reads verification-complete or names precisely what is re-deferred and why; `release:readiness` is green on a fresh run at this commit — the 2026-09-08 run is not evidence for this slice.

### Testing

Existing Risk gates re-run fresh. Accessibility gate extended to the Risk routes. Cold-restore and full-replace recovery exercised against a `1.17.0` workspace. The 500-record Risk fixture meets the repository performance profile.

### Execution

`PSPF Reviewer` for the redaction, compatibility, and scope-drift pass. `PSPF Gate Writer` for `check-risk-verification.mjs`. `PSPF Release Deploy` for the fresh readiness run. Opus for the integration review and for judging whether each disclosed limitation is genuinely closed; Sonnet for bounded fixes the walkthrough exposes. The walkthrough itself is an operator activity and is not delegated to an agent.

---

## Slice C2 — v1.78.0 — Commitment programme decision point

**Problem addressed:** V1, V4, V7. **Changes:** complete Phase 2 persistence and recovery; then a recorded decision on Phases 3–7.

Phase 2 is half-implemented: the contract and draft authoring exist, protected lifecycle transitions and verified lossless restore do not. Half-implemented persistence is a data-integrity risk and cannot simply be parked, so this slice finishes Phase 2 and then stops.

### Deliverables

1. **Complete Phase 2** to its recorded exit gate: one real commitment moves draft to agreed to revised without invented history; immutable baseline, assessment, and decision history proven at Core's write boundary; explicit migration; cold restore proven; `check:commitment-model` green.
2. **Park Phases 3–7 with a recorded resumption gate.** The programme does not resume until C5 ships and C6 records the working-context decision. Parking is written into `docs/commitment-operating-model-plan.md` and the grand plan as a decision with a reason, not as a status drift.
3. **Traceability record.** For each of Phases 3–7, state which stakeholder need it serves, or record explicitly that it serves an internal model-correctness need. V4 is not resolved by asserting value; it is resolved by writing down the chain or admitting there isn't one yet.
4. **Freeze the working-context selector as-is.** No further UI investment in it until C6, which decides its fate on evidence.

### Done when

`check:commitment-model` is green including cold restore; the Phase 2 record states actual results; Phases 3–7 carry a written park decision with a named resumption gate; no commitment content reaches any export, bundle, Explorer surface, or copy-out.

### Testing

Adversarial history fixtures: out-of-order transitions, a transition attempted against a superseded baseline, a restore from a snapshot taken mid-transition. Cold restore proves fresh writer ownership before any write. Redaction fixture proves no commitment, assessment, decision, or rationale field reaches an egress path.

### Execution

`PSPF Contracts Author` for the aggregate contracts and roll-up builders. `PSPF Reviewer` for the publication boundary and history-immutability diff — this is the highest-risk review in the programme. `PSPF Gate Writer` to complete `check-commitment-model.mjs`. Opus for the persistence, migration, and history boundary and for the park decision record; Sonnet only for bounded editor wiring.

---

## Slice C3 — v1.79.0 — Reduction as a target

**Problem addressed:** V3. **Changes:** view-level retirement and demotion; gate mode change. **No record, field, API, or export removal.**

`check:essentials-surface` currently forbids growth. From this slice it enforces a declining schedule with named targets, driven by the C0 cost and walkthrough data rather than by preference.

### Targets

| Surface                 | v1.75.0 | v1.79.0 target | Later target |
| ----------------------- | ------- | -------------- | ------------ |
| Workshop commands       | 72      | 62             | 55           |
| Workshop webview panels | 30      | 26             | 24           |
| Explorer routes         | 24      | 20             | 18           |
| Explorer essentials nav | 7       | 7              | 7            |

### Deliverables

1. **ADR: declining surface budget.** Records the schedule, the exchange rule (new surface requires naming what it retires), and the method for selecting retirement candidates: specialist commands unreachable from any flagship job, panels whose function is fully available inside a workbench tab, and palette entries duplicating a workbench action.
2. **Consolidation before deletion.** Prefer folding a specialist panel into an existing workbench tab over removing the capability. The 47 specialist Workshop commands are assessed in this order: fold into an existing workbench, demote out of the palette behind a workbench entry point, retire the view.
3. **`check:essentials-surface` declining mode.** Fails on growth, and fails when a scheduled target for the current version is missed.
4. **Cost re-measurement.** FJ1–FJ4 re-measured; the slice must show a reduction in at least one job's cost or a walkthrough verdict improvement, otherwise the retirement selection was wrong.
5. **Honest Plan and contextual capture (POA-04/05).** Use existing `planningState`, ownership and dates to distinguish agreed delivery from candidate/deferred/excluded/unscheduled work. Keep all work reachable with counts and repair paths; do not turn missing dates into an apparent commitment. Consolidate routine creation/update in the existing Item Detail/Plan surfaces, retaining context and input on failure. No new measure or issue contract belongs in C3.

### Done when

The v1.79.0 targets are met; every retired view has a recorded destination for its capability; no gate detects record, field, API, or export loss; `check:journey-cost` shows no regression and at least one improvement.

### Testing

A fixture workspace exercising every retired view's replacement path. Round-trip export and import proves no datum loss. Palette dedupe check re-run across all five extensions. Accessibility pass over every changed workbench tab.

### Execution

`Explore` to inventory the 47 specialist commands against flagship-job reachability. `PSPF Reviewer` for scope drift — this slice has the highest risk of accidental capability loss. `PSPF Gate Writer` for the declining-budget mode. Opus for the retirement selection and the ADR; Sonnet for the mechanical fold-into-tab work once each destination is decided.

---

## Slice C4 — v1.80.0 — Standard mitigation library

**Problem addressed:** V6. **Changes:** reference data, one schema bump, existing surfaces only.

This is the missing middle of the product's own stated operating cycle — assess, justify, **mitigate**, prioritise, plan — and the highest-traceability unshipped request in the repository.

### Deliverables

1. **ADR: mitigation library and provenance.** Content sourcing, attribution and licence position, tailoring semantics, and the rule that tailoring never detaches a mitigation from its control rationale.
2. **Curated mitigation patterns in `@pspf/reference-data`**, ISM-aligned, AU English, each carrying source attribution and an explicit `publication` declaration, following the `REQUIREMENT_EXPLAINERS` precedent.
3. **Schema bump to axes `1.18.0`** for mitigation provenance on the action record: which pattern an action derived from, whether it was tailored, and the recorded rationale for tailoring. All new fields `sensitive`.
4. **Wiring into existing surfaces only** — the requirement detail Act section and the Readiness tab's existing draft-and-confirm accept flow. Zero new commands or panels; this slice lands inside the C3-reduced budget.
5. **Deterministic selection.** Pattern suggestions derive from the requirement's control family and current assessment state by a printed rule. No AI, no ranking by opaque score.
6. **Risk-to-outcome guidance.** Each pattern states its treatment mechanism, applicability, expected observable effect and suggested verification method. Offer reuse from the existing Risk treatment surface as well as the Requirement flow. No-match cases allow explicit manual tailoring; no template silently creates a risk, confirms an issue or claims an achieved benefit. Guidance is not a recorded observation; O2 owns that contract.

### Done when

`check:mitigation-library` proves coverage, attribution, publication declaration, printed selection rules, and that tailoring preserves the rationale link; the attribution and licence gate is green; `check:essentials-surface` shows no growth; `e2e:v1.80` passes; FJ2's cost falls or its walkthrough verdict improves.

### Testing

Adversarial fixtures: a requirement with no matching family, a tailored mitigation whose rationale was cleared, a pattern whose source attribution is missing. Redaction fixture proves no mitigation body or tailoring rationale reaches a publication path unless its declaration permits it. Parity test proves identical suggestions for identical fixtures.

### Execution

`PSPF Reference Data Curator` for the content, source hashes, and attribution — this is the bulk of the slice and the part most likely to be done badly at speed. `PSPF Contracts Author` for the provenance fields and the selection primitive. `PSPF Slice Mechanic` for the axis bump mechanics. `PSPF Reviewer` for AU-English and publication. Opus for the ADR, the schema decision, and the tailoring semantics; Sonnet for content drafting under curator review and for the wiring.

---

## Slice C5 — v1.81.0 — The two promised review screens

**Problem addressed:** V6, and the debt created by V5. **Changes:** two tabs inside the existing Reporting Workbench.

ADR 0096 retired the three presentation lenses on the explicit promise that analyst and CISO needs would be met by two focused review screens. That promise is now five releases old and is the outstanding half of the lens-retirement bargain.

### Deliverables

1. **Analyst period-over-period change review** — the direct answer to "current analytics do not clearly show the difference between the previous and current year". Built on the existing snapshot anchor and per-record status map: what changed, in which direction, which records, and which of it is material. Linked commentary reuses `narrative` records.
2. **CISO accountability view** — trend, gaps, owners, and whether closure is actually happening, composed from the existing team report card, `ownerTeam`, `dueDateHistory`, and closure-velocity primitives. Every verdict prints its rule.
3. **Both as tabs in the existing Reporting Workbench.** No new command, no new panel, no budget exchange.
4. **Cost re-measurement against FJ3 and FJ4.** These screens exist to reduce the effort of exactly those jobs; if the numbers do not move, the design is wrong and is reworked before the slice closes.
5. **Business consequence without invented evidence (POA-03/06).** Use existing strategy outcomes/references to show delivery, reported measure trends, risk assessment context, evidence limitations and the next decision. Clearly label Action Impact as a planning signal and trend-only progress as reported, not verified. Missing outcome links, baselines or observations remain visible; do not infer historical risk movement from snapshot status counts. This is an honest interim view, not O2/O3 completion.

### Done when

`check:review-screens` proves both tabs compose existing primitives only, print their rules, and carry no person data; copy-outs are marked **OFFICIAL: Sensitive** and stay Workshop-local; accessibility passes at 320, 768, and 1440 px and at 200%; FJ3 and FJ4 costs fall against the C0 baseline; `e2e:v1.81` passes.

### Testing

Fixtures with no prior snapshot, a pre-1.71 counts-only snapshot, and a period with no change — each must produce an honest stated result rather than an empty panel. Unassigned-owner row present in every accountability fixture. Redaction fixtures on both copy-outs.

### Execution

`PSPF Contracts Author` for any shared roll-up primitive the two tabs need. `PSPF Reviewer` for publication and AU English. Opus for composing the judgement set into a stated answer, which is the part that has historically been under-done; Sonnet for the tab rendering once the model is fixed.

---

## Slice C6 — v1.82.0 — Working-context decision and programme close

**Problem addressed:** V5, V7. **Changes:** one recorded decision, and whatever it implies.

### Deliverables

1. **Re-test the Operations ↔ Oversight & Assurance switch** against the C0 instrument and the C5 screens. The question is narrow and answerable: with both review screens shipped, does the switch reduce cost or improve a walkthrough verdict on any flagship job?
2. **ADR amendment recording the outcome.** Either the switch earns its place with recorded evidence or it is retired under the ADR 0096 precedent with deterministic one-time preference migration and no dead setting left behind. Retaining it does not automatically resume Commitment Phases 3-7: each resumed phase needs a separate unmet-need/value decision after C6. Both switch outcomes are acceptable; an unrecorded outcome is not.
3. **Programme close-out.** Re-measure all flagship jobs; publish the before-and-after table from v1.75.0 to v1.82.0; update the deferred register with what this programme closed and what it did not.
4. **Next-programme gate.** No new programme opens until this close-out records that verification debt is zero and the C3 schedule is on track.
5. **Risk-to-outcome handoff.** Record which POA findings C1-C5 actually closed, keep the rest open, and prepare O1's ADR/admission/issue-origin decisions followed by O2 measurement and O3 business briefing. Do not claim that surface reduction, a trend flag or a working-context switch delivered the full outcome loop. Versions are assigned later; no second active programme is opened by this review.

### Done when

The decision is recorded in an ADR amendment with evidence; the deferred register is reconciled; the before-and-after table exists in `docs/ux-evidence/`; `release:readiness` is green.

### Execution

Opus throughout — this slice is judgement and record-keeping, not implementation. `PSPF Reviewer` for an independent read of whether the evidence actually supports the recorded conclusion.

---

## Testing approach across the programme

Five layers, each with a distinct job. A slice is not done until all five are satisfied.

1. **Unit** — `node --test` per package against `dist/`. Every new `@pspf/contracts` primitive gets empty, typical, 500-item, and adversarial fixtures, an injected clock, non-mutation proof, and stable ordering. Source edits require a build before the package test reflects them.
2. **Gate** — exactly one new `check-*.mjs` per slice, registered in `check:gates:run` and `release-gates.json`, and covered by the meta-gate that proves a gate file is non-empty and enforces something. Each gate must have a deliberate failing fixture proving it can fail.
3. **Journey** — the chained `e2e:v1.76` … `e2e:v1.82` Playwright suites, each inheriting the complete previous chain, plus the C0 cost emitter on every flagship job.
4. **Outcome** — `check:journey-cost` ratchet, cognitive-walkthrough verdicts, and readability scores. This is the layer that did not exist before C0 and is the reason this programme exists.
5. **Boundary** — `check:personal-data`, `check:schema-policy`, `check:schema-coverage`, redaction fixtures with hostile person-name content, accessibility at 320/768/1440 px and 200%, cold-restore recovery, and `release:readiness` run fresh at the slice commit rather than cited from history.

## Model and agent approach

These are model-family and delegation recommendations, not pricing or benchmark claims.

**By work type**

| Work                                                                      | Model                                      | Agent                                |
| ------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| ADRs, decision records, schema and publication boundaries, park decisions | Opus                                       | none — operator-authored with review |
| Instrument design, retirement selection, judgement composition            | Opus                                       | none                                 |
| Shared primitives and entity fields                                       | Opus for the contract, Sonnet for the body | `PSPF Contracts Author`              |
| `check-*.mjs` gates and Playwright emitters                               | Sonnet                                     | `PSPF Gate Writer`                   |
| Curated mitigation content, attribution, source hashes                    | Sonnet under review                        | `PSPF Reference Data Curator`        |
| Version bumps, e2e chain, coverage registration, index rows               | Sonnet                                     | `PSPF Slice Mechanic`                |
| Scope-drift, redaction, AU-English, publication review                    | Opus                                       | `PSPF Reviewer`                      |
| Codebase reconnaissance before a slice                                    | Sonnet                                     | `Explore`                            |
| Release readiness, packaging, deploy triage                               | Sonnet                                     | `PSPF Release Deploy`                |

**Rules**

1. Start each slice from its bounded first task, never the whole programme in one session.
2. The reviewer is never the author. `PSPF Reviewer` runs against a diff it did not produce, and the cognitive walkthrough is not executed by whoever built the screen.
3. Reconnaissance goes to `Explore` rather than long chains of searches in the main session, to keep the implementation context clean.
4. Anything touching persistence, history immutability, migration, or an egress path is Opus-reviewed before it closes, regardless of how small the diff is.
5. The live operator walkthroughs in C1 and C2 are human activities. An agent may prepare the script and record the results; it may not be the operator.

## Explicitly deferred by this programme

- Tranches 3–6 (Office outputs, Graph connectivity, AI assistance, assurance signing). Tranche 2 hardening remains partial — atomic stale-lock takeover, `deactivate()` lock release, Force Unlock UI, honest DB snapshots, full-replace undo, and broad command-level diagnostics conversion — so the plan's own prerequisite is unmet.
- Future Mission Control canvas. Unapproved, and would invert the subtraction discipline C3 establishes.
- Commitment Phases 3-7 and any Explorer projection of commitment, assessment, or decision content. Parked in C2; C6 reviews them, but resumption additionally requires a specific unmet-need/value decision. O1-O3 are the next capability priority; accepting the selector does not restart the whole programme.
- Pub workforce Phase 3 extensions and Pub as a team or identity source. Pub stays frozen.
- Explorer publication of Shop supplier and commercial data. Still requires its own field-level publication ADR.
- Full rollout of the S0–S7 judgement primitives to every screen. C3's reduction and C5's screens cover the highest-traffic remainder; the rest stays in `docs/ux-improvement-ideas.md`.
- Observed-user research. It remains the goal, and C0's instrument is explicitly a substitute. If participants become available at any point, sessions take precedence over the simulated instrument and the instrument is recalibrated against them.
