# 12-Month Cyber Plan Application Specification

Status: **aspirational**

Existing Workshop planning features implement parts of this direction; the proposed risk-to-outcome improvements and a separate PSPF Plan product are not implemented.

Last reviewed: 2026-09-25 against repository v1.76.0. The [grand plan](pspf-grand-plan.md) owns development sequencing; accepted ADRs and canonical contracts take precedence over the planning proposals below.

## Purpose

This specification captures the discussion outcomes, decisions, and agreed direction for a simplified application that helps articulate, manage, and evolve a 12-month cyber plan.

The application is intended to help a cyber leader present a credible, structured, and durable plan for the next 12 months, while making change visible when priorities shift or when strategic rationale changes over time.

## Risk-to-Outcome Direction (2026-09-25)

The primary purpose is to help protect an enterprise from cyber and digital risks, not merely to record compliance or completed work. The Plan of Action should explain the chain **business outcome -> risk or known issue -> action -> evidence of effect -> reviewed risk position -> business consequence** in both directions.

Current support is a foundation, not a completed outcome-management loop:

- Actions, Risks, Requirements, evidence and typed links already support connected planning. The standard Workshop Action creation path requires a Requirement link; that is not an enforced risk-or-issue origin for every Action.
- The existing `ActionImpact.riskReduction` value is a prioritisation weighting derived from linked risk severity. It is not a measured reduction, a percentage, or proof that an Action worked.
- The existing [Action contract](packages/contracts/src/index.ts#L599) has delivery dates, status, ownership, commentary and derived impact, but no structured baseline/target/observation record for the effectiveness of a particular treatment.
- A separate PSPF Plan application, the suggested standalone entities below, and in-product access-control roles have not been delivered by this specification. Existing Workshop planning and reporting surfaces remain the first implementation home.

The following are proposed acceptance requirements, not current invariants or permission to change schemas without an ADR:

1. Every Action admitted to the agreed Plan of Action has a resolvable originating risk or known issue, a stated treatment or resolution mechanism, and a traceable business outcome. A requirement gap, assurance finding or recorded control failure can supply the issue context; an obligation link alone must not imply that an issue exists. Do not invent a risk to satisfy a form.
2. Capture remains lightweight. Incomplete notes or candidate work may be retained visibly for triage, but must not appear as justified, committed treatment or disappear from a reconciliation queue. Whether these use existing candidates or a separate capture mechanism is an ADR decision.
3. Each planned treatment states the expected change, how it will be checked, the baseline or an explicit unknown, target, evidence source, review date and accountable team. Shared measures can cover several Actions with explicit contribution and no double-counting.
4. Delivery completion, observed control performance, reassessed risk and business benefit remain separate claims. Completing an Action never automatically lowers a risk rating or establishes effectiveness. Investigation, assurance and sustainment work may reduce uncertainty or preserve a control rather than reduce exposure; label that purpose honestly.
5. Capture a change once in its working context and reuse its accepted facts in the risk view, Plan of Action, strategic summary and reporting pack. Significant changes retain their reason, before/after basis and next decision; routine updates do not demand a second narrative.
6. Measure everyday usefulness through end-to-end capture, update, effectiveness-review and business-brief journeys, including unresolved links, unknown measures and stale evidence. Fewer screens or clicks alone do not establish that an operator reaches a defensible answer.

These requirements refine the existing course-correction programme. Verification debt remains first; detailed contract, measurement and workflow slices need explicit scheduling and acceptance evidence before implementation. No new product, connector, AI dependency or publication permission is implied.

## 2026-09-25 Product Review

**Stakeholder basis:** the operator clarified that enterprise protection, justified Actions and measurable effects on risk and strategic business outcomes are the core product purpose. Compliance uplift is one supporting use case, not a substitute for that purpose.

**Assessment:** the solution connects much of the necessary information, but does not yet enforce or demonstrate the complete loop. It is currently stronger at explaining assessment state, work and priorities than at proving which treatment changed exposure and why the business benefits.

### Findings, in Priority Order

| ID     | Priority | Finding and everyday consequence                                                                                                                                                                                                                                                                                                                  | Evidence and planned disposition                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POA-01 | High     | **Canonical risk treatments disappear from Action Impact.** An Action created from a Risk can be visible as a treatment but receive no risk weighting or the wrong inferred Plan workstream.                                                                                                                                                      | [Risk creation](packages/workshop/src/extension.ts#L2962) writes `risk -> treated-by -> action`; [impact enrichment](packages/contracts/src/index.ts#L4179) reads only `risk -> addressed-by -> action`. [Plan classification](packages/workshop/src/plan-of-action-board.ts#L212) consumes that weighting. Record and repair in C1, with cross-surface regression coverage.                                                                                          |
| POA-02 | High     | **An Action's justification is not a protected contract.** Requirement-linked work, unlinked writes and strategy references can exist without a known risk/issue and a business-outcome path. A generic obligation is not automatically an identified issue.                                                                                      | [Standard creation](packages/workshop/src/extension.ts#L2117) requires a Requirement, while [Core write preparation](packages/core/src/service.ts#L1899) has no Action-origin admission rule. [Assurance findings](packages/assurance/src/pentest-workbench.ts#L205) are represented by tagged Actions, not an independent general-purpose Issue record. O1 must decide stable issue identity and plan admission without treating an Action as its own justification. |
| POA-03 | High     | **Impact and benefit are not measured treatment effects.** Severity-based weighting helps prioritise work but cannot prove exposure fell. A manually improving strategy trend can advance the delivery summary without a recorded baseline, observation or evidence.                                                                              | [ActionImpact](packages/contracts/src/index.ts#L579), [StrategyMeasure](packages/contracts/src/index.ts#L1219) and [delivery summary](packages/workshop/src/continuous-compliance.ts#L334). C5 must distinguish reported delivery from demonstrated effect; O2 supplies the missing evidence-backed measurement/review loop.                                                                                                                                          |
| POA-04 | Medium   | **The Plan can imply decisions that were never made.** The board includes live Actions regardless of `planningState` and synthesises missing dates. Candidate, deferred and excluded work can be mistaken for scheduled delivery.                                                                                                                 | [Board construction](packages/workshop/src/plan-of-action-board.ts#L89) and [date derivation](packages/workshop/src/plan-of-action-board.ts#L229). C3 must separate delivery from triage and unscheduled work, without deleting or silently hiding records.                                                                                                                                                                                                           |
| POA-05 | Medium   | **Capture and explanation demand too much context switching.** Standard Action creation asks for title, status, three dates and commentary before Requirement selection; risk-origin creation is shorter but does not capture ownership, expected effect or verification. Strategy measures and commentary still need separate stewardship.       | [Standard creation](packages/workshop/src/extension.ts#L2117), [risk-origin creation](packages/workshop/src/extension.ts#L2962) and [strategy contracts](packages/contracts/src/index.ts#L1219). C3 reduces navigation using current fields; C4 supplies treatment guidance; O1/O2 add progressive capture of the missing semantics.                                                                                                                                  |
| POA-06 | Medium   | **The roadmap does not yet test the primary enterprise job.** FJ1-FJ4 test requirement decisions and reporting effort, not the chain from an enterprise risk through observed treatment effect to a business decision. This specification also previously labelled a separate planning application and access-control aspirations as implemented. | [Course-correction job definitions](docs/course-correction-plan.md#slice-c0--v1760--the-evidence-instrument). Preserve those baselines, add explicit risk-to-outcome acceptance journeys, and make O1-O3 the next bounded capability priority after course correction. Documentation status is corrected in this review; product gaps remain open.                                                                                                                    |

### What Already Supports the Model

| Existing support                                                                                                                        | Value to the operator                                                                        | Limit to retain in the plan                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk records, causes/consequences, categories, appetite, current/inherent/target custom assessments and risk history                    | Describe what could harm the enterprise, what matters and the intended residual position     | Risk-overhaul Phase 4B still lacks its live verification evidence; a target rating is an expectation, not an achieved result                         |
| Reusable Actions through `treated-by`, organisational controls through `mitigated-by`, and per-risk control effectiveness/applicability | Avoid duplicate work and explain preventive/recovery treatment logic                         | Resolve POA-01; completing shared work is not proof that every linked risk is controlled                                                             |
| Strategy choices, nested outcomes and measures with baseline/current/target, units, trend and confidence                                | Already provide a home for business and security outcomes without another strategy register  | Values are optional text and references are maintained explicitly; no measured Action contribution is automatically established                      |
| Plan of Action, team ownership, due-date history, blockers and effort information                                                       | Coordinate delivery and explain slippage and dependencies                                    | Delivery dates and completion are not risk reduction; address POA-04 before relying on the timeline as an agreed plan                                |
| Evidence review, requirement acceptance definitions, assurance retest queues and risk crosswalk preview/confirm                         | Reuse evidence, surface staleness and reconcile external risk references without a connector | A current document or a completed retest task alone does not establish the scope or result of a treatment-effect observation                         |
| Snapshot anchors, deterministic briefs, team report cards and reusable operator narratives                                              | Explain changes once and reuse accepted context across reporting outputs                     | Snapshot status changes and closure velocity do not measure causation or business benefit; sensitive content stays behind existing publication rules |
| Shop links and planning forecasts                                                                                                       | Relate treatment choices to resource assumptions and dependencies                            | Planned spend, expected savings and realised savings must remain distinct; no claim of financial risk reduction follows from a priority score        |

### Evidence Recorded for This Review

Read-only executable probes on 2026-09-25 bundled the current TypeScript sources in memory with `write: false`; no source, build output, fixtures or product data were written. These are focused reproductions, not a full test run or live operator walkthrough:

- With one open legacy risk at likelihood 4 / impact 4 and one Action, `addressed-by` produced `riskReduction: 3`; changing only the link to `treated-by` produced `riskReduction: 0` and the explanation `No linked requirements, evidence, risks, or Directions`.
- With one `planningState: deferred` Action and no dates, the Plan builder at an injected date of 2026-09-25 counted one active Action and emitted start 2026-09-28 / end 2026-10-09.
- With one completed, committed Action and one measure carrying only `trend: improving` plus its required descriptive fields, the delivery summary returned `outcome-progressing` despite absent baseline/current/target values and observation evidence.

These cases belong in future regression tests for their owning slices. No finding is recorded as fixed by this documentation change, and no human usability or release-readiness claim is made.

## Proposed Everyday Operating Loop

The loop is **capture -> justify -> plan -> deliver -> verify effect -> review risk -> explain the business consequence**. It should be possible to start from a Risk, a confirmed issue, a Requirement gap, an assurance finding or an existing Action, then follow the same connected information in either direction.

### Capture and Triage

- From an existing risk/issue, inherit its identity and business-outcome context; ask for the action title and a short expected effect, not the same references again. Offer an existing Action for reuse before creating another.
- When the origin is not yet known, retain a clearly labelled triage note or candidate with a next-review responsibility. It is not admitted treatment. The future ADR must make this distinction explicit; existing `planningState: candidate` alone is not an implemented justification rule.
- Use one compact editor in the current Item Detail or Plan surface, with optional scheduling and advanced fields disclosed progressively. Preserve entered values after validation errors, cancellation and navigation; a failed multi-record save must not leave half an Action/link pair.
- Suggest team, relevant treatment pattern and existing measure from the selected context. Display the source and require confirmation; never infer personal identity or silently make a governance decision.

### Admit Work to the Plan

Before work is shown as agreed delivery, confirm its risk/issue origin, treatment purpose, business outcome, accountable team, next delivery or review date, expected effect and verification approach. A shared outcome or measure can be inherited through explicit references; do not make the operator write a bespoke strategic narrative for every task.

Use visible readiness reasons for missing origin, outcome, owner, measure or baseline. Retain legacy and incomplete records in triage with counts and repair links; never fabricate relationships, dates or historical observations to pass admission. `planningState: committed` continues to mean delivery-planning intent, not an authorised organisational commitment or an authenticated approval.

### Update Once

Daily updates should normally require only the changed status/date, new evidence or observation, and a brief reason when the change is material. Reuse the existing due-date history, Change Records and narrative mechanisms rather than asking for a separate report. Show which risks, outcomes and review decisions the accepted change affects; do not describe that propagation as achieved improvement.

The Plan needs an in-context worklist for my team's work, blocked/overdue work, triage and verification due. These are filters or sections in an existing surface, not new dashboards. Offer previewed bulk ownership, date and evidence updates with per-record validation results. A bulk completion operation must not bulk-approve effectiveness or change risk ratings.

### Verify and Review

Delivery complete starts an effectiveness review when due. Record the observation against its declared measure, compare only compatible observations, identify failed or inconclusive checks, and let the risk-owning team record a separate assessment with evidence and rationale. Evidence expiry, scope changes, missed review dates or adverse results reopen attention without silently rewriting historical decisions.

Weekly review should lead with unresolved risk/issue origins, blocked treatments, failed checks, stale evidence and above-appetite exposure. Monthly/quarterly leadership review should group by business outcome and ask what improved, what remains exposed and what decision is needed, not merely how many Actions closed.

## Proposed Measurement and Explanation Contract

This is a design brief for O1/O2, not a new canonical schema. Reuse existing Actions, `StrategyOutcome`/`StrategyMeasure`, Risk assessments, evidence and histories; decide any additive fields, observation records and link constraints in an ADR. Do not introduce a second task, risk, outcome or issue register just to join the views.

| Information           | Minimum meaning                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business outcome      | What enterprise service, mission or value is being protected; scope and accountable team/role. Use the existing nested strategy outcome with a stable scoped reference                                                                         |
| Risk or known issue   | A resolvable Risk or stable, typed issue origin with its recorded basis/as-of context. A Requirement gap or external finding needs enough history that later status changes do not erase the original justification                            |
| Treatment expectation | How this Action is expected to reduce likelihood/consequence, avoid/share exposure, resolve an issue, sustain a control or reduce uncertainty. A link alone does not state the mechanism                                                       |
| Measure definition    | Observable test/indicator, unit or defined ordinal rubric, population/denominator, scope, method, baseline and date (or explicit unknown), target and date, evidence source and review cadence                                                 |
| Observation           | Value/result, observation date, evidence reference, tested scope/denominator, method version, confidence and limitations. Preserve revisions; distinguish when the event occurred from when it was entered                                     |
| Contribution          | Which Actions contributed to a shared result and how. Several Actions may be jointly necessary; one observation must not become several separately summed benefits                                                                             |
| Risk review           | Current/residual assessment under its named methodology and revision, assessment date, supporting observations, reviewer team/role, rationale, appetite position and next review. A changed target or framework does not rewrite the old basis |
| Business explanation  | What was delivered, what was observed, what the risk owner concluded, what business exposure remains and the decision requested, with source IDs and as-of dates                                                                               |

Keep four statements visibly separate: **delivery progress**, **expected effect**, **observed control/issue result**, and **assessed risk/business consequence**. An ordinal risk-band movement is not a percentage reduction; unrelated risk scores cannot be added. Unknown, stale, incomparable, no improvement, deterioration and inconclusive are legitimate results, not zero or success. A forecast saving is not a realised benefit, and a before/after association is not proof of causation.

### Worked Example (Illustrative, Not Product Evidence)

Business outcome: keep four critical customer services recoverable within the agreed four-hour tolerance. Risk: extended service interruption after a cyber incident. Known issue: only one of four services met that tolerance in the baseline recovery exercise.

Two shared Actions improve recovery arrangements and execute a representative retest. Their common measure is services meeting the four-hour tolerance, with a fixed four-service population, dated baseline 1/4, target 4/4, named test method, linked evidence and a review date. Finishing both Actions records delivery, not a lower risk rating.

The observed result is 3/4; the remaining service fails. The risk owner reviews that evidence separately and keeps the risk above appetite pending further treatment. A reusable business brief can say:

> Recovery testing improved from 1 of 4 to 3 of 4 critical services meeting the agreed four-hour tolerance. The fourth service remains exposed, so the risk remains above appetite. Both delivery Actions are complete; the next decision is whether to fund the remaining recovery work or record time-bounded risk acceptance.

The real output must include the baseline/result dates, evidence and assessment references. It must not say "risk reduced by 50%", count the two Actions as two independent benefits, or imply that exercise results guarantee real-incident recovery.

## Proposed Acceptance and Adoption Measures

The [grand plan](pspf-grand-plan.md#risk-to-outcome-roadmap-2026-09-25) owns sequencing. The following are future acceptance criteria, not currently registered gates:

1. **Traceable plan:** every admitted Action resolves to at least one known risk/issue and an explicit or inherited business-outcome path. Report the denominator and the separate number awaiting triage; unresolved/deleted origins and Action-as-its-own-issue do not pass.
2. **Consistent semantics:** canonical treatments and supported legacy links resolve consistently across Risk, Plan, strategy and reporting. Cover one Action treating two risks, multiple Actions treating one risk, duplicates, deleted endpoints and unknown/custom assessments without silent conversion or double-counting.
3. **Honest schedule:** candidate/deferred/excluded/unscheduled work remains visible but separate from agreed dated delivery. Displayed estimates are explicitly marked; no inferred date is presented as an operator commitment.
4. **Defensible measurement:** a displayed verified effect has a dated baseline or explained baseline limitation, target, method/scope, observation, evidence and separate assessment basis. `done`, `trend: improving`, a high impact weight or a fresh document alone must fail that claim.
5. **Negative cases survive reporting:** failed tests, stale evidence, incomparable frameworks, absent observations and unmet critical dependencies cannot be concealed by completion counts, averages or optimistic narrative.
6. **One capture, many uses:** zero manual re-entry of accepted status, dates, measurements or risk decisions to produce the business brief. Generated claims retain source/as-of references; operator interpretation is attributed separately and cannot overwrite measured facts.
7. **Safe change:** apply admission and history rules at Core and import/reconciliation boundaries, not only in the UI. Preserve existing data through explicit migration, rejected writes, undo and cold restore. No automatic deletion or invented historical baselines.
8. **Publication unchanged by this plan:** new measurement, issue context and rationale default to `sensitive`; no person data. Use explicitly allowlisted Workshop-local **OFFICIAL: Sensitive** outputs only when approved by the relevant ADR. No automatic Explorer projection, Graph/AI egress, raw-note copy or implication that a publication bundle is a lossless backup.

Add the following journeys alongside, not in place of, C0's frozen FJ1-FJ4 definitions. Their IDs below are planning labels only; no instrument or gate is added in this documentation review:

| Journey                                               | Answered when                                                                                                                                    | Proposed friction target                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| RO-J1: capture justified work from a known risk/issue | An owned Action, expected effect and inherited outcome path are visible in context, or a clearly labelled triage reason explains what is missing | One working surface and one save for Action plus origin link; no repeated selection of known context |
| RO-J2: update delivery and verify the result          | Delivery and evidence-backed effect are distinguishable, with a risk review or an explicit pending/failed/inconclusive state                     | No re-keying of delivery or evidence facts; retain the current record, filters and unsaved input     |
| RO-J3: explain this period's business consequence     | A leader can identify what changed, the evidence, residual exposure and next decision for one outcome                                            | Generate from accepted records without rewriting the facts; disclose unknowns and source dates       |

Before implementing each journey, record its current gaps, interaction counts, repeated inputs and comprehension errors on typical and adverse fixtures; an unavailable step is a gap, not a successful baseline. Target a reduction in effort without losing correctness. Keep deterministic costs for CI and separately record human task time and whether the operator can explain the claim and limitation. Pilot on one real business outcome and its linked work for a reporting cycle before wider rollout; simulated evidence cannot close the live-walkthrough requirement.

## Earlier Planning Discussion

The remaining sections retain the original 12-month planning discussion. They are context, not additional scheduled scope. Where they suggest a standalone product, extra entities or broader workflow, the risk-to-outcome direction and the active grand-plan sequence above take precedence.

## Problem Statement

A cyber planning process often starts with a clear idea of intent, but the challenge is expressing that intent in a format that is structured, persuasive, easy to maintain, and simple enough for stakeholders to follow.

The application should therefore support:

- Clear layout and structure for a 12-month cyber plan.
- Simple presentation of goals, initiatives, timing, and progress.
- Lightweight change tracking for meaningful plan changes.
- Visibility of why a change happened and what it affected.
- Evidence over time when changes persist and create downstream impact.

## Product Goal

Provide a lightweight planning application that allows a cyber leader to:

- Lay out a 12-month plan clearly.
- Show confidence and intentionality in the plan design.
- Track only important plan changes rather than every minor edit.
- Explain the reason for changes in priority or direction.
- See the ongoing impact of those changes over time.
- Communicate progress and plan evolution to stakeholders.

## Design Principles

The agreed design principles are:

- Keep the application simpler than a full project portfolio tool.
- Focus on clarity, maintainability, and executive usefulness.
- Track significant changes, not complete document history.
- Make impacts and rationale visible, not just the fact that a field changed.
- Support both operational use and stakeholder presentation.
- Prefer straightforward navigation and low-friction data entry.

## Scope

### In Scope

- Structuring a 12-month cyber plan.
- Presenting the plan through a simple application layout.
- Recording key changes to priorities, direction, or intent.
- Capturing reasons for plan changes.
- Showing impact on milestones, goals, timelines, metrics, or dependencies.
- Supporting stakeholder review and reporting.

### Out of Scope

- Full enterprise project management functionality.
- Tracking every single field-level edit.
- Complex workflow orchestration unless needed later.
- Replacing specialist tools for security operations, GRC, or project delivery.

## Information Architecture

The simplified application layout should include the following main areas:

1. **Overview**  
   A concise dashboard or landing area showing the current shape of the plan, major goals, status indicators, upcoming milestones, and notable changes.

2. **Current State**  
   A view of baseline posture, major gaps, assumptions, and context relevant to the 12-month planning period.

3. **Goals and Objectives**  
   The intended outcomes for the year, expressed clearly and aligned to business or cyber priorities.

4. **Initiatives / Work Items**  
   The specific pieces of work that deliver the goals, including scope, owner, timing, dependencies, and status.

5. **Timeline / Milestones**  
   A simple roadmap view showing delivery timing, sequencing, and major checkpoints.

6. **Resources**  
   The people, capabilities, tooling, budget assumptions, or other enablers needed to execute the plan.

7. **Metrics / Indicators**  
   A focused set of indicators showing whether the plan is progressing and whether intended outcomes are improving.

8. **Risks / Constraints**  
   Key blockers, assumptions, or issues that could affect delivery or confidence in the plan.

9. **Change Log**  
   A dedicated area for significant plan changes, including why the change happened, what changed, and what the downstream impact is.

## Core User Experience

The preferred experience is intentionally simple:

- A user can move between major sections using tabs or a left-hand navigation.
- Each section presents concise, editable content.
- The plan can be understood at a glance without reading a long narrative.
- Significant changes are logged in a dedicated place rather than buried in general activity.
- A user can inspect a change and immediately understand its rationale and impact.
- The plan can support export or presentation to stakeholders in a polished form.

## Key Inputs Required

The discussion identified the following input categories as necessary for the application:

- Current cyber posture or baseline.
- Strategic goals and objectives for the next 12 months.
- Initiatives or projects mapped to goals.
- Timeline, milestones, and sequencing.
- Resource requirements including people, budget, and tooling.
- KPIs or other success measures.
- Risks, dependencies, and assumptions.
- Compliance or stakeholder obligations where relevant.
- Notes or context needed to explain decisions.

## Core Application Processes

The application will need the following internal processes.

### 1. Plan Data Management

A structured data layer is required to store plan elements such as goals, initiatives, milestones, metrics, risks, and dependencies.

### 2. Plan Update Workflow

The application should support updating plan content in a controlled but lightweight way. This does not need to be heavy process, but updates should be attributable and coherent.

### 3. Significant Change Logging

A dedicated process is required for recording meaningful changes, especially:

- Priority changes.
- Strategic direction changes.
- Timeline shifts.
- Scope changes.
- Changes caused by new constraints, risks, or executive direction.

### 4. Impact Assessment

Each significant change should allow the user to identify and record impact such as:

- Delayed milestones.
- Deferred initiatives.
- New dependencies.
- Resource pressure.
- Metric changes.
- Increased risk exposure.

### 5. Notification / Review Support

The application may support reminders, alerts, or lightweight review prompts when important changes occur or milestones move.

### 6. Reporting / Export

The application should support generating stakeholder-friendly outputs such as summaries, progress views, or report exports.

### 7. Access Control

Identity-based editor, reviewer and reader roles are deferred and outside the current local-first product scope. Working contexts are presentation preferences, not permissions; the existing Workspace Trust and single-writer boundaries remain authoritative.

## Change Tracking Model

A major design decision from the discussion is that the application should **not** track everything. Instead, it should record only significant changes that matter for leadership visibility and decision-making.

### What Should Be Tracked

Track changes when one or more of the following is true:

- A priority changes.
- A goal changes materially.
- An initiative is added, removed, deferred, or re-scoped.
- A milestone date changes in a meaningful way.
- A dependency or constraint changes the plan path.
- A leadership or business decision causes reprioritisation.
- A change has sustained impact over time.

### What Does Not Need Tracking

Avoid tracking routine edits such as:

- Minor wording changes.
- Cosmetic layout changes.
- Small corrections with no strategic effect.
- Administrative updates that do not affect execution.

### Change Record Structure

Each significant change entry should include:

- Change title.
- Date raised.
- Date effective.
- Change type.
- Description of what changed.
- Reason for change.
- Source or trigger for change.
- Affected goals or initiatives.
- Affected milestones.
- Impact assessment.
- Decision owner or approver.
- Current status of the change.
- Whether the impact is temporary or persistent.
- Review date.

## Functional Requirements

### Plan Management

- Create and maintain a 12-month cyber plan.
- Define goals, initiatives, milestones, resources, metrics, and risks.
- Link initiatives to goals and milestones.
- Maintain concise descriptive notes.

### Change Log

- Create a significant change record.
- Link a change to one or more plan elements.
- Record rationale and impact.
- View changes in chronological order.
- Filter changes by date, priority, initiative, owner, or impact type.
- Mark whether a change is ongoing, resolved, or absorbed into the baseline plan.

### Impact Visibility

- Show before/after view for important changes where useful.
- Highlight which milestones, goals, or metrics were affected.
- Surface persistent changes that remain active over time.
- Show cumulative impact where multiple changes affect the same initiative or objective.

### Reporting

- Produce stakeholder-readable summaries.
- Support snapshot views of current plan state.
- Support review of major changes over a selected period.
- Support export for presentation or document use.

## Suggested Data Entities

The following entities are implied by the discussion:

| Entity          | Purpose                                             |
| --------------- | --------------------------------------------------- |
| Plan            | The overall 12-month cyber plan                     |
| Goal            | A strategic objective for the planning period       |
| Initiative      | A work item or project contributing to a goal       |
| Milestone       | A key point in time or deliverable                  |
| Metric          | A measure used to assess progress or outcome        |
| Resource        | People, budget, capability, or tooling required     |
| Risk            | A blocker, issue, or uncertainty affecting delivery |
| Change Record   | A significant plan change with rationale and impact |
| Dependency      | A linkage that affects sequencing or execution      |
| Note / Decision | Supporting context or rationale                     |

## Non-Functional Expectations

The solution should aim for:

- Simplicity of use.
- Low administrative overhead.
- Clear executive readability.
- Strong traceability of significant changes.
- Ability to retain context over a 12-month period.
- Suitable security, reliability, and maintainability.

## Agreed Risks and Delivery Friction

During the discussion, several risks and impediments were identified. Initial technical, security, scope, stakeholder, and resource concerns were discussed first, then the conversation focused on what could still go wrong even if those areas were covered.

### Initial Risks Identified

- Scope creep.
- Resource constraints.
- Lack of stakeholder buy-in.
- Data quality issues.
- Poor change management.
- Security and privacy issues.

### Additional Risks Even If Technical Foundations Are Sound

The key remaining failure modes are human and organisational.

#### 1. Change Resistance

People may not adopt the process or may continue using informal channels, which reduces the application’s value as the trusted planning source.

#### 2. Leadership Priority Shifts

Executive direction may change mid-cycle, forcing reprioritisation and rework even when the original plan was sound.

#### 3. Communication Breakdown

Relevant stakeholders may not understand changes, dependencies, or implications, causing misalignment and inconsistent execution.

#### 4. Momentum Loss

A 12-month plan can lose energy over time. Teams may start strongly but drift as operational pressure grows.

#### 5. Inconsistent Measurement

Even with a good design, metrics can become unreliable if updates are irregular, selective, or inconsistently interpreted.

## Operational Responses Discussed

The discussion also identified practical responses to likely delivery problems:

- Define a lightweight change approval or steering mechanism for meaningful scope changes.
- Maintain a realistic resource plan and monitor capacity.
- Keep stakeholders engaged through regular visibility and progress communication.
- Review data quality periodically.
- Use the change log to explain both rationale and impact.
- Preserve discipline over time so the plan remains current and trusted.

## Product Positioning

The intended product is best understood as a focused planning and change-visibility application for cyber leadership. It is not meant to be a full PMO tool, but a credible planning instrument that helps show:

- what the team intends to do,
- why it intends to do it,
- what changed,
- why it changed, and
- what effect those changes had over time.

## PSPF Ecosystem Split

The original discussion treated planning as a distinct product candidate. The 2026-09-25 review instead prioritises proving the risk-to-outcome loop in existing Workshop surfaces. A separate product remains an unscheduled option requiring demonstrated unmet need and its own ADR, not the next development increment.

The capability should be split into three groups.

### 1. Enhancements to Existing PSPF Products

These features strengthen current or already-planned PSPF surfaces without requiring a separate planning application.

| Feature                                 | Best home                                                  | Rationale                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Significant change visibility           | Workshop and Explorer                                      | Workshop should record accepted changes; Explorer should present the change story for review and briefing.                                                |
| Change rationale and impact             | Workshop Item Detail, Reporting, and Explorer detail views | Rationale and impact are assurance context, not project-management overhead. They should explain why PSPF posture, actions, risks, or Directions changed. |
| Persistent impact over time             | Snapshots, Reporting, and Explorer trend/briefing views    | The existing snapshot/export model can show what changed between points in time.                                                                          |
| Stakeholder-ready summaries             | Explorer and shared posture brief                          | Explorer is already the presentation-ready and portable review surface.                                                                                   |
| Filtering by planning theme or priority | Tags and Saved Views                                       | Current tag and saved-view features can express annual priorities, executive commitments, campaigns, or reporting cohorts.                                |
| Initiative-style action grouping        | Workshop Actions and Explorer Actions                      | Existing Actions can represent many plan initiatives when linked to Requirements, Risks, Directions, Evidence, and Tags.                                  |
| Risk and constraint visibility          | Existing Risk surfaces                                     | Planning risk should reuse the canonical Risk entity unless a later ADR identifies a distinct planning-risk need.                                         |

### 2. Candidate New Product: PSPF Plan

The remaining planning functions are coherent enough to consider as a new PSPF product surface. A working name is **PSPF Plan**.

PSPF Plan would be a focused 12-month cyber planning application that sits beside Workshop, Shop, Pub, and Explorer. It should not replace Workshop as the assurance system of record. Its role would be to help cyber leaders shape, explain, and maintain a credible forward plan that remains traceable to PSPF assurance data.

PSPF Plan should use the same master JSON bundle exchange approach as Explorer, with generator metadata distinguishing planning exports from publication, local-authoring, work-import, or GRC-capture flows. It should round-trip through Core/Workshop where records affect canonical PSPF data.

Candidate PSPF Plan-owned capabilities:

| Capability                    | Notes                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12-month plan overview        | A leadership-readable plan shape showing goals, initiatives, milestones, risks, indicators, and notable changes.                                                                                                 |
| Plan goals and objectives     | Planning goals may not always be PSPF Requirements. They should link to Requirements, Actions, Risks, Directions, Tags, or Saved Views where relevant.                                                           |
| Initiative planning           | Initiatives can start as planning records, then materialise as canonical Actions when accepted into Workshop.                                                                                                    |
| Milestone timeline            | A simple timeline for plan commitments, checkpoints, and decision dates. This should remain lighter than PMO scheduling.                                                                                         |
| Metrics and indicators        | A focused planning indicator set, ideally derived from existing posture, evidence, action, and risk data where possible.                                                                                         |
| Resource assumptions          | Lightweight capacity, budget, tooling, and capability assumptions. Detailed supplier, contract, spend, people, role, and assignment management should remain with Shop and Pub when those products are in scope. |
| Significant change log        | The core differentiator: record what changed, why, what it affected, whether the impact is temporary or persistent, and when it should be reviewed.                                                              |
| Plan baseline and re-baseline | Support explicit planning baselines and intentional re-baselining when persistent changes become the accepted plan.                                                                                              |
| Planning bundle export/import | Export and import planning data through the master bundle contract, with plan-review-apply behaviour for any canonical PSPF records produced by the plan.                                                        |

### 3. Explicitly Out of Scope for This Planning Direction

The following items should not drive the design because they do not match the current PSPF operating model:

- Multi-user collaboration workflow.
- Authentication or identity-provider integration.
- Real-time synchronisation.
- Role-based access control inside the product.
- Full PMO scheduling, task assignment, resource levelling, or delivery management.
- Replacement of specialist GRC, project-management, security-operations, Shop, or Pub workflows.

## Integration Direction

The preferred design is to preserve a clean product boundary:

- **Workshop** remains the assurance system of record and decision surface.
- **Explorer** remains the portable review, local changes, and stakeholder briefing surface.
- **PSPF Plan** would become the planning and change-rationale surface if the ecosystem is expanded.
- **Core** remains the local platform, validation, writer-lock, import/export, and schema-governed exchange layer.

The first useful increment should avoid a new product shell and instead prove the change-rationale model in Workshop and Explorer. If that proves valuable, PSPF Plan can be introduced as a later product with its own ADR, package, bundle generator mode, and acceptance gates.

## Recommended MVP

The next useful increment is the risk-to-outcome workflow above within existing surfaces. The original standalone application concept below is retained for context only; it is not the active MVP or a scheduled delivery commitment:

- A simple overview/dashboard.
- Goal and initiative management.
- Milestone timeline view.
- Resource and risk sections.
- A dedicated significant change log.
- Ability to link changes to goals, initiatives, and milestones.
- Basic impact capture fields.
- Basic reporting/export capability.

## Open Design Questions

The following questions remain open for future elaboration:

- What level of workflow approval is appropriate before the tool becomes too heavy?
- How much of the plan should be narrative versus structured fields?
- Should impact be recorded qualitatively, quantitatively, or both?
- Should persistent changes automatically alter the current baseline after a period of time?
- What is the best visual model for showing cumulative change impact across the year?

## Final Outcome

The discussion converged on a simple but deliberate application design for a 12-month cyber plan. The plan should be structured, stakeholder-friendly, and focused on clarity. The most important differentiator is a lightweight but meaningful change-tracking approach that records priority or directional changes, explains why they happened, and makes the resulting impact visible over time.
