# Commitment-led Operating Model Plan

Status: **Phase 0 complete; Phase 1 authorised, not yet implemented**

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

## Phase 1 Handoff

Scope: add the `"operations"` / `"oversight-assurance"` working-context type and a workspace-scoped `workspaceState` key distinct from the retired lens key; wire an explicit switch affordance into an existing Workshop panel host (no new command, at most one new panel-state per ADR 0099 D1.5); correct `buildStrategyDeliverySummary` to classify by `planningState`; add a Core write-boundary test proving existing history (e.g. `dueDateHistory`) cannot be replaced or dropped by an ordinary write or an older-schema import.

Exit gate: `check:working-context` (new gate to be written) proves explicit switching, the separate preference key, legacy-lens normalisation retained, no capability or record change on switch, and the surface budget by recorded before/after counts. Existing `continuous-compliance` tests extended for the `planningState` fixture. Existing Core history tests extended for the immutability proof.

Do not begin Phase 2 (new collections) until Phase 1's gate is green and recorded here.
