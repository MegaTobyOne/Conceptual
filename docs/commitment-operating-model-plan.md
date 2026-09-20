# Commitment-led Operating Model Plan

Status: **Phase 2 commitment contract slice implemented; remaining Phase 2 persistence/recovery scope continues**

## Authority and Outcome

This plan implements [ADR 0099](../adr/0099-commitment-led-operating-model-phase-0-baseline.md), the accepted Phase 0 decision record for the Commitment-led operating model programme described in `pspf-grand-plan.md` §"Commitment-led operating model — Operations and Oversight & Assurance". Its source specification is `.hermes/plans/2026-09-19_091633-commitment-led-operating-model-techspec.md` (status aspirational; not a replacement for ADR 0099 or this plan).

Outcome: the operator works in one of two explicit contexts — **Operations** (what changed, what is blocked, what delivery response is needed) and **Oversight & Assurance** (where we stand against obligations and agreed commitments) — over one connected local model, with no master task register, no cloned source plans and no new publication surface in P1.

## Confirmed Scope

- Workshop-only in P1. Explorer is unchanged; any projection is P2, separately gated behind a field-level publication ADR.
- Reuse `StrategyEntity`/`StrategicChoice`, `ActionEntity`, `RiskControlEntity`, Evidence and existing typed Links. No duplicate `StrategyChoice` entity.
- Manual source-plan reference registration only in P1; no file adapter, live connector or write-back until P2.
- All new commitment/source-binding/assessment/decision content is `sensitive` in P1.
- Person-free accountability: team/role key references only, operator-recorded authority basis, never an authenticated signature or Pub identity.
- No dependency on Workshop Risk overhaul Phase 4B, which remains separately and explicitly deferred.

See ADR 0099 for the full decision table (D1–D10) and the four operator-approved blocking decisions (B1–B4).

## Phases

Versions are assigned at release sequencing, not here. One active vertical slice at a time.

| Phase | Scope                                                                                                                                                                                 | Exit gate                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Confirm current truth, accept decisions, map contracts, define the P1 slice and deferred register                                                                                     | **Complete 2026-09-20**: ADR 0099 accepted; this plan written; index and topic specs reconciled                                           |
| 1     | Explicit working-context presentation plus two verified semantic-debt fixes: `buildStrategyDeliverySummary` classifies by `planningState`; history write-boundary immutability proven | Distinct labelled contexts, legacy-lens retirement preserved, no business-record or schema mutation, `check:working-context` green        |
| 2     | Minimal local commitment/baseline/decision contract and protected persistence with explicit migration and verified lossless restore                                                   | One real commitment moves draft → agreed → revised without invented history; cold restore proven; `check:commitment-model` green          |
| 3     | Manual source-plan registration and source-bound Actions contributing to a commitment (required / supporting / alternative)                                                           | Two registered plans contribute to one commitment without cloning; identity tuple, stale/unknown source state and withdrawal rules tested |
| 4     | Evidence-backed assessment revisions and shared deterministic roll-up builders in `@pspf/contracts`                                                                                   | Reported versus assessed positions coexist; critical blocked contribution cannot be concealed by completed non-critical work              |
| 5     | Integrated Operations and Oversight & Assurance landings in Workshop and the local **OFFICIAL: Sensitive** review pack                                                                | Flagship fixture journey passes end to end; accessibility at 320/768/1440 px and 200%; existing requirement journey untouched             |
| 6     | P1 integration, recovery, operator walkthrough and release readiness                                                                                                                  | All P1 acceptance criteria demonstrated; P2 items recorded as deferred, not passing; `release:readiness` green                            |
| 7     | **P2, separately gated:** safe Explorer projection                                                                                                                                    | Field-level publication ADR accepted; all touched egress and round-trip paths tested for no sensitive pass-through                        |

## Phase 0 Record

### Baseline evidence

Verified against `develop` at product `1.75.0`, axes `1.17.0`, 2026-09-19/20 (see ADR 0099 Context for the full evidence list): `StrategicChoice` already carries outcomes/rationale/references; `ActionEntity` already carries `ownerTeam`/`planningState`/`dueDateHistory`; `buildStrategyDeliverySummary` currently classifies delivery from Action `status`, not `planningState` (a defect corrected in Phase 1); `presentation-lens.ts` always normalises to `ciso` post ADR 0096; the risk-crosswalk preview/confirm/apply/undo pattern is the reusable reconciliation precedent for the P2 source adapter.

### Decisions

ADR 0099 D1–D10 accepted as recommended; blocking decisions B1–B4 accepted as recommended by the operator on 2026-09-20 (see ADR 0099 Operator approvals).

### Files changed in Phase 0

- `adr/0099-commitment-led-operating-model-phase-0-baseline.md` (new)
- `docs/commitment-operating-model-plan.md` (new, this file)
- `pspf-spec-consistency-index.md` (new topic row)
- `scripts/check-adr-coverage.mjs` (new coverage entry, type `manual`, pending Phase 1 gates)
- `pspf-grand-plan.md` (status line updated to Phase 0 complete / Phase 1 authorised)

No product code, schema, migration or UI changed in Phase 0.

## Phase 1 Closure

Scope delivered: added the `"operations"` / `"oversight-assurance"` working-context type and a workspace-scoped `workspaceState` key distinct from the retired lens key; wired an explicit selector into the existing Workshop Home view with no new command or panel host; corrected `buildStrategyDeliverySummary` so uncommitted Actions are not classified as delivered from status alone; and retained the Core history write-boundary proof for ordinary writes and older-schema additive imports.

Evidence: **Phase 1 complete 2026-09-20.** `packages/webview-shell/src/working-context.ts` provides the strict two-context contract and safe default; Workshop persists only `pspf.workshop.workingContext`, clears the retired lens key as before, and exposes one Home selector; the delivery test covers completed Actions with no committed planning state; and Core tests prove existing history survives ordinary writes and older-schema additive imports without returned-object mutation.

Validation: `pnpm run check:working-context`, `pnpm run check:gate-integrity`, and `pnpm run check:adr-coverage` are green; `@pspf/webview-shell` tests pass (30); Workshop UI contract tests pass (39); and the focused delivery regression passes.

Exit gate: **green**. `check:working-context` proves explicit switching, the separate preference key, legacy-lens normalisation retained, no capability or record change on switch, and the unchanged 72-command / 30-panel Essentials surface.

## Phase 2 Contract Review Closure

The contract-review slice is complete on 2026-09-20. ADR 0099 now fixes the
smallest Phase 2 implementation boundary: `commitment` plus
`governance-decision`, with immutable nested baseline revisions. It also fixes
the `CMT`/`GDE` prefixes, the single `governance-decision --changes-->
commitment` triple, the all-`sensitive` field policy, the agreement guard and
the additive-merge/full-replace/cold-restore invariants.

The commitment contract slice is implemented: `@pspf/contracts` and Core now
register both records, baseline revisions are append-only at the write
boundary, governance decisions are immutable, the active bundle schemas and
default-deny policies are present, and the cold full-replace test preserves the
original baseline and decision. `check:commitment-model` covers the registry,
policies, link rule, schemas and write-boundary proof.

`source-plan` and `assessment-revision` remain deferred to their owning phases;
no Explorer projection or publication field is authorised. This is not a
release-sequencing decision: before release readiness, assign the next
compatibility-axis version and publish a new immutable schema slice. The
current `1.17.0` baseline remains the active development axis until then.
