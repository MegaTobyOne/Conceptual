# Commitment-led operating model — product-suite technical specification and implementation plan

Status: **aspirational — proposed implementation specification; no product changes implemented by this document**

**Prepared:** 19 September 2026, AEST  
**Product owner:** Toby  
**Implementation audience:** GitHub Copilot and the repository maintainer  
**Repository:** `MegaTobyOne/Conceptual`  
**Inspected checkout:** `/Users/toby/Dev/Conceptual`, branch `develop`, commit `32b6f87367f97200be2f06471386870ed542720d`  
**Package baseline:** root `package.json` reports `1.75.0`; this is not a claim about the deployed website or installed extensions.  
**Goal:** evolve the existing suite into an explicit Operations and Oversight & Assurance experience, connecting strategic choices to commitments consolidated from locally owned plans, without duplicating delivery management.  
**Architecture:** retain the local-first Core and existing package boundaries. Add the smallest governed domain changes and shared deterministic projections needed for linked commitments, source-owned plan contributions and distinct delivery/assurance judgements.  
**Tech stack:** existing TypeScript/pnpm workspace, Core sql.js/SQLite, VS Code extension webviews, Lit/Vite Explorer and its existing browser-local storage; no new platform prescribed.

> **For GitHub Copilot:** read this document in full, then perform Phase 0 only. Do not implement the whole specification in one pass. Respect existing repository instructions and invariants. Return the contract mapping, proposed ADR decisions, exact affected files, tests and blocking questions before implementing schema or publication changes. No production data, source notes or credentials belong in prompts or fixtures.

## 1. Purpose, evidence and authority

### 1.1 The problem to solve

The product owner needs to stop mentally combining day-to-day execution, strategic decisions, organisational commitments, assurance, people and reporting. The answer is not another master task register. It is one connected information model with distinct working contexts:

- **Operations:** what changed, what was escalated or flagged, what is blocked, and what delivery response is needed?
- **Oversight & Assurance:** where do we stand against obligations, standing expectations and agreed commitments; what supports that position; and is the response still adequate?

A commitment is an agreed outcome or continuing expectation. A POAM is a delivery/remediation plan that may contribute to it. Several platform plans may support one commitment; one plan may support several commitments. L1 coordinates execution; L2 monitors and challenges the position. Governance/management approval remains a separate responsibility.

### 1.2 Evidence classes used in this document

| Marker | Meaning | Treatment |
|---|---|---|
| `U-*` | User discussion or previously reviewed Apple Notes | Product intent, not proof of implementation or a framework obligation. |
| Numeric citation, e.g. `[6]` | Retrieved external source | See Sources and framework limits below. |
| `R-*` | Read-only repository observation at the inspected commit | Implementation/documentation baseline, not runtime verification. |
| `D-*` | Decision register entry | Status explicitly distinguishes confirmed direction from proposed design. |
| `REQ-*` | Proposed product acceptance contract | Becomes the implementation contract only after the affected ADR decisions are accepted. |
| `AC-*` | Behavioural acceptance scenario | Testable completion criterion; not a claim tests already pass. |

The repository was clean when discovery began. Only this planning document is to be authored by this task. No product code, dataset, migration, build, test suite, deployment or release is executed as part of preparing it.

### 1.3 Authority and conflict handling

Read `.github/copilot-instructions.md`, `docs/AGENT_ORIENTATION.md` and `pspf-spec-consistency-index.md` first. The repository's authority order is invariants, ADRs, threat model, then topic specifications. This document does **not** silently supersede them.

The product owner's new explicit-mode requirement conflicts with the earlier retirement of presentation lenses in ADR 0096. Record a new ADR that explicitly supersedes only the conflicting provisions. Preserve its simplification intent, plain-language journey, accessibility rules and surface-budget controls. Do not restore retired novelty views or the old CISO/Auditor/Solo taxonomy.

Do not reuse a historical release number, choose the next ADR number from memory, or rewrite previously published schemas. Resolve the active roadmap and outstanding Risk-overhaul Phase 4B before scheduling this programme. A past documented green release is not a fresh test result.

## 2. Retained user intent and decision register

### 2.1 User and note provenance

- **U-01 — Fresh Conceptual Plan.** Apple Notes record `x-coredata://29B73461-DDD6-4318-8C7A-4FBFD6C433E5/ICNote/p294`, previously read during this discussion; modification reported as 8 September 2026. Source for consistent list/editor mechanics, security/risk/evidence, commercial and workforce context, reporting, history, isolation and integration ideas. It is not an approved single-release backlog.
- **U-02 — Today's operating-model correction.** L1 is day-to-day operational delivery that should run with development-team discipline; L2 supports governance/assurance. Separation is intended to reduce cognitive load, not replace operations.
- **U-03 — Explicit switch.** The user chose explicit switching and a distinct look and feel so the active mode is unmistakable.
- **U-04 — Landing priorities.** Assurance starts with overall posture for occasional users. Operations surfaces changes, escalations and flagged work. Assurance asks whether prior commitments are being fulfilled and exposes contention/blockers without becoming task management.
- **U-05 — Federated commitments.** The user uses the term POAM and expects individual platforms to have their own plans. The app must roll those plans into a single view of commitment.
- **U-06 — Strategy and validation.** The user requested strategy/strategic choices, validation against cyber.gov.au, PSPF and ISO 27001, comparison with the published solution, and this Copilot-ready specification.
- **U-07 — Historical work/product notes.** Previously reviewed titles include `CISO`, `New requirements spec`, `Solve problems and close tickets!`, `Rogue CISO OLD`, `DONE Rogue CISO PSPF`, `Explorer v2.0 DONE` and `Action Tracker`. Relevant themes: daily/executive interfaces, delegation without universal leader approval, separating problems from tasks, evidenced dashboards, decision rationale, persistent history and reusable audience-specific communication. Titles containing DONE are not implementation evidence. No unrelated personal-note contents are included here.

The notes were read under a read-only/no-separate-research-copy agreement. This specification retains derived requirements and provenance, not a reproduction of that archive. Notes are not modified by this task.

### 2.2 Decisions and their status

| ID | Decision | Status and rationale |
|---|---|---|
| D-01 | Separate Operations from Oversight & Assurance by purpose, attention and judgement, not duplicate records. | **Confirmed direction**: U-02, U-04. |
| D-02 | Require explicit switching, clear labels and distinct visual treatment. Never switch automatically because of inferred role or activity. | **Confirmed direction**: U-03. Final labels/token choices are proposed. |
| D-03 | Operations leads with changes/escalations/flags; Assurance leads with overall posture against commitments and standing expectations. | **Confirmed direction**: U-04. |
| D-04 | Consolidate multiple source POAMs rather than creating a separately maintained master plan. | **Confirmed direction**: U-05. |
| D-05 | Include strategy and strategic choices in the connected model. | **Confirmed scope**: U-06. Specific fields and approval workflows below are proposed. |
| D-06 | Retain existing packages, local-first operation and the requirement-centred assessment journey; add a commitment/outcome lens rather than rewrite the suite. | **Recommended design** supported by the website comparison and current repository. |
| D-07 | Reuse the existing Strategy structure; do not create standalone StrategyChoice entities merely to match prose. | **Recommended design**, subject to repository contract mapping. |
| D-08 | Separate fulfilment, effectiveness, adequacy, residual exposure and evidence currency. Completion never auto-establishes compliance/effectiveness. | **Recommended acceptance rule**, framework-aligned. |
| D-09 | Mode is neither an identity nor a permission boundary. No claim of independent assurance from changing modes. | **Required governance safeguard**; supported by IIA.[5] |
| D-10 | Record approved priority independently of computed attention and feasible delivery sequence. | **Recommended design**; changing a risk score prompts review rather than silently changing an approved choice. |
| D-11 | Start source integration with previewed, explicit, one-way local-file reconciliation. No live connectors or two-way sync in the initial scope. | **Recommended scope constraint**; source identity and authority still mandatory. |
| D-12 | New commitment, decision and assessment content is sensitive/local by default. Explorer publication requires a specific field-level policy decision. | **Existing repository constraint applied to new design**; not consent to publish organisational commitments. |
| D-13 | Preserve historical baselines, assessed conclusions, source versions and decision rationale. Do not backfill unknown approvals or dates as fact. | **Recommended acceptance rule** informed by U-04/U-07. |
| D-14 | POAMs do not replace standing controls, applicability decisions or the obligation register. A gap is visible even before a response is agreed. | **Framework-derived design correction**.[1][6][7] |
| D-15 | Keep Shop and Pub bounded; initially reference existing commercial context and person-free ownership only. No Pub workforce-data ingestion. | **Recommended sequencing** preserving current privacy boundaries. |

The status of a decision in this table is not an organisational approval of an actual cyber risk or strategic choice. Implementing a workflow and exercising authority through it are distinct.

## 3. External validation and limits

The design aligns with the management lifecycle below. Neither PSPF nor ISO prescribes our UI, a database entity called Commitment, or the proposed two-mode product design.

| Source and locator | Verified guidance relevant to this design | Resulting requirement |
|---|---|---|
| PSPF Release 2026 §3.1 | Security goals/strategic objectives connect to business objectives, risk environment, risk tolerance and capability; an overarching approved plan may have supporting plans.[6] | Trace strategic choices and commitments across supporting plans; preserve the authority of the overarching plan. |
| PSPF §3.3, requirement 0022 | Monitor effectiveness of the security plan and establish continuous improvement.[6] | Assess effectiveness separately from delivery completion; create review outcomes, not just charts. |
| PSPF §14.1, requirements 0098 and 0213 | Cyber security strategy/uplift planning and specified Audit Committee reporting.[6] | Maintain approved direction and reporting-ready evidence. Do not hard-code those reporting intervals for every customer/context. |
| ISM-0039 and ISM-1999 | Develop, implement and maintain a cyber strategy; align it to organisational direction and business strategy.[1][2] | Strategy is a managed lifecycle, not a set of disconnected goal labels. |
| ISM-1563 and ISM-1564 | An assessor's report identifies assessment findings; the system owner produces the post-assessment POAM.[1] | Distinguish assessor judgement from owner remediation; retain plan type and system scope. |
| ASD CISO reporting guidance | Reporting should support a consolidated view of organisational security risks.[2] | Roll up by outcome/service/business context, not only by platform or compliance section. |
| PSPF §§8.1–8.2 | Exceptional circumstances and alternative mitigations have bounded arrangements.[6] | Distinguish residual-risk acceptance, changes to tolerance and permitted exceptions; no unrestricted compliance override. |
| ISO/IEC 27001:2022, clauses 5–10, as explained by NQA | Leadership, risk-based planning, objectives, operation, performance evaluation, management review and improvement form a connected management system.[7] | Link direction, plans, implementation, evidence and recorded review decisions; maintain applicability/control rationale. |
| IIA Three Lines Model | First/second-line responsibilities may be blended or separated; second-line roles remain management responsibilities, not fully independent assurance.[5] | Separate reported/assessed/approved positions and declare self-review/unknown independence honestly. |

**ISO qualification:** ISO's catalogue confirms ISO/IEC 27001:2022 and Amendment 1:2024.[4] Detailed mappings here use NQA's implementation guide, not a licensed full-text clause audit.[7] Do not represent the app, this specification or a completed POAM as ISO certification or full PSPF compliance. Do not embed licensed ISO text without permission.

**Reference-data qualification:** our external validation used PSPF Release 2026 and September 2026 ISM guidance. That does not mean the repository's vendored catalogues match those editions. Phase 0 must inventory the actual dataset versions, mappings and hashes; a catalogue refresh is a separately approved change with impact review, not an incidental regeneration.

## 4. Baseline and implementation anchors

The website describes a requirement-centred, local-first suite with Strategy Choices, linked Actions, evidence, change history and a dedicated assessment surface.[8][10][11][12] Explorer's landing description already leads with posture and traceability.[9] The local checkout is materially more developed than that description. Do not implement the earlier website-gap table as if every unadvertised feature were absent.

### 4.1 Repository evidence register

All `R-*` observations refer to the inspected commit. Paths are repository-relative; line ranges are orientation aids, not stable patch targets. Static inspection establishes code structure and candidate gaps, not tested runtime failure or deployment state.

| Ref | Existing implementation/evidence | Required treatment |
|---|---|---|
| R-01 | `packages/contracts/src/index.ts:1159–1188`: exact type is `StrategicChoice`, nested in `StrategyEntity.choices`; outcomes, measures, rationale, constraints and typed references exist. | Extend/refer to these stable choices. Do not introduce a duplicate StrategyChoice table merely because the narrative used that wording. |
| R-02 | `packages/workshop/src/continuous-compliance.ts`: `buildStrategyPrioritySummary` and `buildStrategyDeliverySummary`; `continuous-compliance.test.ts` covers derived ranking/delivery. ADR 0080 defines derived, unpersisted priority. | Keep a computed attention signal; approved priority is a different decision. Test custom risk-framework context rather than assuming the builder handles it. |
| R-03 | `packages/contracts/src/index.ts:580–607`: `ActionEntity.ownerTeam`, `planningState`, dates and `dueDateHistory`; `appendDueDateHistory`/`summariseSlippage` at 4196–4250. Core prepares action writes in `packages/core/src/service.ts`. | Reuse ownership/planning fields. First-observed due date is not an approved baseline. Strengthen history ownership rather than add a competing date-history list. |
| R-04 | `packages/workshop/src/extension.ts`: `addPlannerMilestone` creates an ordinary Action; `packages/workshop/src/plan-of-action-board.ts` supplies the board. | Add typed milestone/contribution semantics only where needed. Do not infer a milestone from its title or commentary. |
| R-05 | `packages/contracts/src/index.ts`: `assessmentBasis`, `rankBlockersByFanIn`, change/narrative structures; `packages/contracts/src/risk-model.ts`: `RiskAssessment`, `RiskEventEntity`, `RiskControlEntity`. | Preserve evidence confidence and standing controls. They are not a general commitment-assessment ledger or full dependency graph. |
| R-06 | `packages/contracts/src/risk-crosswalk.ts`: `buildRiskCrosswalkPreview`/`buildRiskCrosswalkWriteSet`; Core `commitRiskCrosswalk`; service tests cover preview/apply/undo and risk reconciliation. | Reuse the staged reconciliation pattern, not the risk-specific entity semantics. `sourceProduct` names a suite product, not an external POAM owner. |
| R-07 | `packages/webview-shell/src/presentation-lens.ts:1–12` always normalises to `ciso`; corresponding tests assert retirement. ADR 0096 explicitly rejected old persona modes. | New task contexts need explicit governance and separate state; existing leftover lens consumers are not an active feature. |
| R-08 | `packages/webview-shell/src/{shell,home-panel}.ts`, Workshop `src/webview/shell.ts`, Explorer `src/app/{routes,pspf-app}.ts`. | Shared chrome/tokens exist, but routing is host-specific. Share a small context descriptor, not a new universal router. |
| R-09 | `packages/explorer/src/data/core-bundle.ts`: local import/export adapters; `src/state/app-store.ts`: local writes; `src/views/core-exchange-view.ts`: explicit file exchange. | Data baseline/local authoring and task context are independent. Do not assume a universal publication-mode write guard exists. |
| R-10 | `PUBLICATION_FIELD_POLICIES`/`sanitiseEntityForPublication` in contracts; `pspf-security-redaction-controls.md`; ADR 0097. Ownership/history/narrative fields are sensitive; `change-record.decisionOwnerRef` is restricted. | P1 local only. Do not reuse public mapping `reviewBy`, strategy-reference `role`, or restricted decision-owner fields as an authenticated/person-free authority registry. |
| R-11 | `packages/brief-renderer/src/index.ts`, `packages/contracts/src/{reporting-period,team-report-card}.ts`, Reporting Workbench and ADR 0097. | Reuse generated packs, snapshot anchoring, Unassigned rows and narrative supersession. Add actual commitment/assessment semantics, not another report editor. |
| R-12 | Root `package.json`, `pspf-grand-plan.md`, `pspf-spec-consistency-index.md`, ADRs 0096–0098. Root version is 1.75.0; some instructions/index text remains older or contradicts implementation status. | Reconcile relevant documentation in Phase 0. Record current axes and served/runtime schema independently; do not equate product version with schema version. |

### 4.2 Candidate gaps that must become tests before relying on the model

1. **Delivery is not agreement.** `buildStrategyDeliverySummary` currently calls `todo` candidate and any non-`todo` action committed, rather than using `planningState`. Its outcome-progressing state can follow an improving measure trend after actions finish. Test and correct these semantics before presenting them as agreed commitment/evidence-backed outcome (AC-10/AC-25).
2. **History needs write-boundary enforcement.** `appendDueDateHistory` returns the supplied next record unchanged when the date is unchanged. Prove that every write/import path prevents replacing/removing old history; the helper alone does not establish immutability (AC-23/AC-24).
3. **Fan-in is not a dependency graph.** The existing blocker builder consumes supplied gated-ID arrays; it does not establish transitive critical-path semantics. Some Master Plan “dependencies” are broad commercial/risk context rather than typed dependency edges. Do not label those facts as verified causal blockers (AC-14/AC-29).
4. **Source reconciliation and generic imports differ.** Risk-event generation on ordinary writes is not proof that every import produces equivalent history. Test all new commitment/source update paths, not just the interactive editor (AC-18/AC-26).
5. **Explorer exchange is not uniformly publication sanitisation.** `buildCoreBundleExport` copies source collections then reconstructs Actions/Risks from local projections. `src/data/share.ts:50–64` exports selected records into a `pspfShare` envelope. These paths do not, by their presence, prove the single-master-bundle/default-deny policy is uniformly enforced. Treat this as source-level boundary debt to reproduce and resolve before P2, not a proven exploit or permission to copy it (AC-33/AC-34/AC-39).
6. **Sanitised round-trip preservation is selective.** Core preserves specific omitted sensitive fields; Explorer rebuilds some collections. New fields need explicit preservation/authority tests. Omitted does not mean delete, but unknown fields must not bypass schema validation (AC-22/AC-39).
7. **Generic migration is not demonstrated.** The migration runbook is aspirational and the compatibility diagnostics refer to migration once available. Do not tell users an existing migration command will safely convert this new model without implementing and testing the exact path (AC-37/AC-38).

### 4.3 Existing constraints not to reopen accidentally

- ADR 0096 Essentials simplification, plain-language journey and explicit navigation budgets.
- ADR 0097 local/sensitive team ownership, narratives and reporting; Pub remains outside that canonical team source.
- ADR 0098 Risk model and reconciliation decisions. Its outstanding integration/manual verification is a scheduling dependency, not silently complete because this document exists.
- Immutable published schemas, trusted Core API, single-writer semantics, zero new runtime egress and no unapproved publication-policy expansion.
- Existing risk methodologies and control application semantics. Do not restore raw legacy risk arithmetic for new executive attention views.


## 5. Target operating model and scope

### 5.1 Connected model

```text
Business context + obligations + risk tolerance
                       |
             Approved security strategy/plan
                       |
     Strategic choices + mandatory/operational drivers
                       |
           Agreed outcomes and commitments
                 /                    \
   Recurring expectations       Source-plan contributions
   and operating controls       from POAMs/uplift plans
                 \                    /
                 Results and evidence
                       |
       Assessments, challenge and management review
                       |
        Retain / revise / supersede / escalate
```

Not every obligation needs a discretionary strategic choice. Existing controls can operate effectively without a new project. A strategy can need revision even when its delivery plan is on schedule.

### 5.2 Responsibility boundaries

| Responsibility | Operations | Oversight & Assurance | Authorised decision-maker |
|---|---|---|---|
| Delivery facts | Record/import progress and forecast; resolve blockers | Read and challenge | Receive escalations as appropriate |
| Commitment baseline | Propose scope/date/acceptance criteria | Assess adequacy and impacts | Approve or reject, under organisational delegation |
| Assurance conclusion | Supply results and evidence | Assess fulfilment/effectiveness/adequacy | Consider the assessment in decisions |
| Strategy change | Surface feasibility and propose alternatives | Challenge assumptions and outcomes | Approve/supersede the choice |
| Risk response/exception | Implement response | Assess exposure and permitted treatment | Exercise the relevant bounded authority |
| Operational editing from a review | Available only after explicit mode switch | Inspect without changing delivery facts | Mode never substitutes for approval |

One person may perform more than one responsibility. Until identity integration exists, role/authority references are operator-recorded assertions, not authenticated signatures or proof of delegation. Preserve the current trusted-workspace/caller/single-writer protections; do not imply RBAC has been added.

### 5.3 Initial scope and explicit deferrals

**Initial release candidate:** a single vertically complete, local-first case spanning a strategic choice, an organisational commitment, contributions from distinct source plans, an affected milestone, separate assessment, and both working modes. Include a standing-expectation/no-plan gap case, import safety, history, migration/recovery and protected outputs needed for that case.

**Follow-on, separately gated:** safe Explorer projection; broader source adapters; cross-suite commercial context; richer review packs; further standing-control cadence support. Each must preserve the same contracts rather than create parallel implementations.

**Not in this programme unless separately reopened:**

- A new project-management/PMO platform, automatic resource optimisation or live two-way sync.
- Graph/Outlook/Planner/ADO connectors, native Office document publishing or scheduled automation.
- New AI-generated decisions, narrative, assessments or automatic risk acceptance.
- Multi-user identity/RBAC/SSO, independent-assurance certification, electronic signatures or cryptographic redesign.
- Pub person/assignment exports, workforce analytics expansion or customer-wide pooled data.
- Automatic migration, destructive reset, automatic source-catalogue refresh or a wholesale UI rewrite.
- Restoration of retired 3D/novelty surfaces or the retired CISO/Auditor/Solo lens taxonomy.

### 5.4 Disposition of broader Fresh Conceptual Plan themes

| Theme | Disposition |
|---|---|
| Common list/editor, keyboard-efficient entry, tailored journeys | Include for touched surfaces; reuse current components. No universal editor rewrite. |
| Resilience, supplier risk, tolerance, assessment coverage and evidence | Link current risk/control/evidence capabilities; add only commitment-facing gaps. Do not redo the Risk overhaul. |
| Audience-specific reporting and preserved history | Include local review pack and historical references; reuse reporting/narrative builders. |
| Pub roles, capability, rotations and recognition | Preserve existing work; defer expansion and personal-data crossings. |
| Shop forecasting, supplier compliance and commercial milestones | Read existing context where safe; defer finance workflow expansion and OSINT ingestion. |
| Isolated home/work/customer data and JSON portability | Maintain workspace isolation and explicit exchange; no combined cross-customer view in this slice. |
| Encryption, clean reset/reload, sample imports | Preserve existing limitations honestly. Exercise safe recovery; do not claim labels/checksums provide encryption. |
| Graph, Outlook, Planner, ADO, Copilot/AI and event-driven automation | Defer under existing connected-capability governance. Copilot is the development handoff tool, not a new runtime dependency. |
| Assurance letters, live pages, PDFs and native Office output | Defer publication mechanisms; local, labelled, evidence-linked review outputs first. |

## 6. Functional requirements

These requirements are proposed acceptance contracts, not statements that all capabilities already exist. Phase 0 must map each to existing implementation before adding code. `P1` below is the first complete local slice; `P2` is a separately gated expansion. Security/compatibility prerequisites apply before the first affected write or output, not at the end of the programme.

| ID | Priority | Requirement | Completion evidence |
|---|---|---|---|
| REQ-01 | P1 | Offer explicit `operations` and `oversight-assurance` working contexts. Persist preference locally per workspace; do not publish it. No inference-driven switch. | AC-01, AC-02 |
| REQ-02 | P1 | Keep working context independent of publication/local-authoring state, theme, profile, capability and authority. A mode change makes no business-record changes and grants no write capability. | AC-02, AC-03 |
| REQ-03 | P1 | Operations starts with changes, flagged/escalated work, blockers and next delivery responses. Assurance starts with scoped posture against commitments and standing expectations. | AC-04, AC-05 |
| REQ-04 | P1 | Both contexts use the same canonical source facts and shared deterministic builders. Assurance may inspect operational detail; initiating an operational edit requires an explicit switch. | AC-06, AC-07 |
| REQ-05 | P1 | Reuse existing strategy/choice/outcome structures. Capture rationale, alternative approaches, chosen trade-off, approval basis, assumptions and review triggers without turning the strategy into a task list. | AC-08, AC-09 |
| REQ-06 | P1 | Keep suggested attention, approved priority and delivery sequence separate. Neither a changed score nor an import rewrites an approved choice. | AC-10 |
| REQ-07 | P1 | Represent a commitment with outcome/scope, accountable team or role, agreement baseline, target/cadence, success criteria and its underlying obligation/decision. Draft incomplete records remain explicitly unagreed. | AC-11, AC-12 |
| REQ-08 | P1 | Support many-to-many commitment-to-plan/milestone contributions without cloning source delivery records. Preserve mandatory critical contributions and alternative paths explicitly. | AC-13, AC-14 |
| REQ-09 | P1 | Include standing expectations and unaddressed obligation/risk gaps even when no new action exists. An empty POAM is not a positive assurance conclusion. | AC-15 |
| REQ-10 | P1 | Preserve source-plan identity, owner, scope, record identity, source revision, source update time and local observation time. Display stale, missing and conflicting information. | AC-16, AC-17 |
| REQ-11 | P1 | Preview and explicitly confirm every source-plan import/reconciliation, including pure adds. Validate limits, schema, scope, identity, links and authority before a single atomic apply. | AC-18 through AC-22 |
| REQ-12 | P1 | Preserve original agreement, later authorised baseline revisions, current source forecast and actual completion separately. Unknown historical baselines remain unknown. | AC-23, AC-24 |
| REQ-13 | P1 | Separate owner-reported delivery from assessed fulfilment, effectiveness and adequacy. Preserve contradictory conclusions and assessment history. | AC-25, AC-26 |
| REQ-14 | P1 | Every assessment identifies its target revision, evidence basis, scope, period, review currency, limitations and assessor-role assertion. Unverified actor independence is labelled unknown. | AC-27, AC-28 |
| REQ-15 | P1 | Derive material dependency/contestion signals from explicit links; separate observed blocking from predicted outcome impact. Never average completion into assurance. | AC-14, AC-29 |
| REQ-16 | P1 | Every aggregate exposes scope, applicable population, missing/unknown population, as-of time and derivation rule. An excluded or stale record cannot silently improve posture. | AC-30, AC-31 |
| REQ-17 | P1 | Record management-review outcomes and changes to strategic/commitment decisions. A rendered dashboard is not a completed review. | AC-32 |
| REQ-18 | P1/P2 | Keep new data local/sensitive in P1. P2 publication uses explicit field policies and an allowlisted projection with scope, currency, exclusions and revision identity. | AC-33, AC-34 |
| REQ-19 | P1 | Show accountable person-free team/role references locally; retain Unassigned/Unknown. Do not import Pub people or mistake a displayed owner label for authenticated authority. | AC-12, AC-28, AC-35 |
| REQ-20 | P1 | Strategy/commitment revisions, cancellations, exceptions and source retirements require explicit lifecycle events and rationale. No cascading silent closure or erasure. | AC-09, AC-24, AC-36 |
| REQ-21 | P1 | Preserve the three compatibility axes, immutable published schemas, single master exchange contract and trusted single-writer Core. New persistence needs explicit migration and verified full-fidelity recovery. | AC-37 through AC-40 |
| REQ-22 | P1 | Reuse list/detail, previous/next and save-and-next; provide semantic labels, keyboard flows, non-colour status meaning and unsaved-change protection across mode switches. | AC-01, AC-41, AC-42 |
| REQ-23 | P1 | All core workflows remain offline. No automatic URL fetch, telemetry, runtime AI call or new connector is introduced. Network references remain inert until explicit permitted user action. | AC-43 |
| REQ-24 | P1 | References identify framework edition/control identifier, mapping rationale and review state. A source change flags review without silently changing applicability or decisions. | AC-44 |
| REQ-25 | P1 | Keep local organisational information, external publication and restricted personal data on their existing boundaries; sanitise before aggregation/output, not merely at rendering time. | AC-33 through AC-35 |
| REQ-26 | P1 | A choice identifies what is deferred/stopped and relevant capacity assumptions. Cross-plan contention is visible, without implementing an automated resource scheduler. | AC-08, AC-29 |
| REQ-27 | P1 | Review outputs trace conclusions to immutable baseline/assessment/source references and disclose insufficient historical evidence. Reuse existing deterministic reporting and narrative facilities. | AC-31, AC-32 |
| REQ-28 | P1 | Workspace/profile changes cannot reuse another workspace's source identity maps, imports, drafts, mode context or cached assurance results. No cross-customer aggregate is created. | AC-45 |

**Acceptance distinction:** P1 is complete only when all P1 tests pass. P2 publication is explicitly not delivered by a local-only P1 release; its tests must be recorded as deferred, not counted as passing. The final programme is not complete until its separately accepted P2 scope is verified.

## 7. Proposed domain contracts and transitions

### 7.1 Modelling decision: thin aggregates, existing delivery records

**Recommended Phase 0 decision:** keep `StrategyEntity`, nested `StrategicChoice`, `StrategyOutcome`, `ActionEntity`, `RiskControlEntity`, Evidence and existing typed Links. Add only the missing local contracts:

1. **Source-plan descriptor/binding:** identifies the authoritative external plan and source record versions. Source-owned delivery items remain ordinary Actions with explicit source-binding and optional milestone metadata.
2. **Commitment aggregate:** an accountable outcome/standing expectation, immutable accepted baselines and links to contributing Actions/controls/choices. This is not an independently editable copy of each source task.
3. **Assessment revision:** an immutable, scoped assessment of a commitment or standing requirement/control, with evidence versions and separate conclusions.
4. **Governance decision revision:** the recorded decision to approve/revise/supersede a choice or commitment, accept a bounded response, or record a management review.

Phase 0 may implement the last two through a rigorously extended existing event/change-record contract if it satisfies the same invariants. Prefer dedicated typed records over overloading free-text comments or pretending a Narrative is an approval ledger. Do not build a generic workflow engine or full event-sourced rewrite.

Choose canonical entity names, prefixes, collections, version changes and typed link pairs only in the accepted ADR. The conceptual names below are **proposed contract names**, not existing repository types or reserved IDs. Every added field needs a declared publication policy and runtime validation, including nested objects.

### 7.2 Field-level minimums

| Concept | Required information | Important invariant |
|---|---|---|
| Source plan | Stable source-system/plan keys; kind (`assessment-poam`, `uplift-plan`, `operational-plan`, `local-plan`); scope; accountable source team/role assertion; source revision/update time where known; captured time; completeness (`full`/`delta`/`reference-only`) | Renaming labels does not change identity; unknown timestamps remain unknown. |
| Source binding on Action | Source record key, plan reference, raw source status, normalised status or unmapped state, revision/content checksum, source update time, local observed time | Suite `sourceProduct` remains suite provenance; do not replace it with external platform names. |
| Commitment | Stable ID; title; intended outcome; scope; driver references; accountable team/role; lifecycle; baseline revisions; contribution references | It is not agreed merely because an Action starts, a source says committed, or a score is high. |
| Commitment baseline | Immutable revision ID; outcome/scope; owner; target/cadence; measurable acceptance criteria; approved contribution set/conditions; approval decision; effective and recorded times | Original and later approved baselines remain distinct; current forecast is not a baseline. |
| Contribution | Target Action/control/expectation reference; source-plan reference where relevant; condition (`required`, `supporting`, `alternative`); alternative-group key if applicable; scope/rationale | Many-to-many; mandatory dependencies are explicit; a copied title is not a relationship. |
| Milestone metadata | Explicit work-item/milestone kind, delivery source binding, completion criteria/result reference | Legacy title wording is not silently converted into typed milestone status. |
| Choice governance | Strategy ID + nested choice ID + pinned revision; approved priority; alternatives; trade-off; deferred/stopped work; assumption/review trigger; decision reference | Choice IDs remain stable within their Strategy; changes do not manufacture a second Strategy hierarchy. |
| Assessment | Target/baseline revision; relevant source revisions; scope and period; evidence references/versions; conclusions; limitations; reviewer role assertion; self-review declaration; reviewed/recorded/review-by dates | A source owner cannot overwrite an assessment; a later assessment supersedes rather than edits the earlier conclusion. |
| Governance decision | Kind; target revision(s); decision; rationale; person-free authority role/basis; supporting record reference; effective/recorded times; supersedes reference; review/expiry conditions where relevant | Recorded authority is not authenticated identity. Import cannot create an approved local decision without explicit local acceptance. |
| Management review | Input snapshot/revisions; scope/period; review outcome; linked decisions; follow-ups/owners; next review trigger | A generated report or opened dashboard is not a recorded review. |

All these fields are local/sensitive by default. Avoid nesting new sensitive decision material inside already public `StrategyEntity.choices` without a tested recursive policy: a top-level allowlist is insufficient. A local decision record linked to an unchanged public choice is safer until explicit publication projections exist.

### 7.3 Illustrative logical contracts

These sketches express required separation, not a ready-to-paste replacement for canonical contracts. Map them to `EntityEnvelope`, existing identifiers/date validators and existing API conventions during Phase 0. Do not introduce separate compatibility axes for them.

```ts
type WorkingContext = "operations" | "oversight-assurance";
type RevisionRef = string; // existing/canonical immutable revision reference

type TargetRef =
  | { kind: "entity"; entityType: string; entityId: string; revision: RevisionRef }
  | { kind: "choice"; strategyId: string; choiceId: string; revision: RevisionRef };

interface SourceBinding {
  readonly sourcePlanId: string;
  readonly sourceRecordKey: string;
  readonly sourceRevision?: string;
  readonly rawStatus: string;
  readonly sourceUpdatedAt?: string;
  readonly observedAt: string;
  readonly contentChecksum: string;
}

interface ApprovalEvidence {
  readonly authorityRoleRef: string; // person-free local role reference
  readonly authorityBasis: string;   // documented delegation/decision basis
  readonly decisionEvidenceRef: string;
  readonly effectiveAt: string;
  readonly recordedAt: string;
  readonly assurance: "operator-recorded"; // not a digital signature
}

type CommitmentTarget =
  | { kind: "date"; dueDate: string; timeZone: string }
  | { kind: "recurring"; cadence: string; nextReviewAt: string; timeZone: string };

interface CommitmentBaseline {
  readonly revision: RevisionRef;
  readonly outcome: string;
  readonly scope: string;
  readonly accountableOwnerRef: string;
  readonly target: CommitmentTarget;
  readonly acceptanceCriteria: readonly string[];
  readonly contributionRevisionRefs: readonly RevisionRef[];
  readonly approvalDecisionRef: string;
  readonly effectiveAt: string;
  readonly recordedAt: string;
  readonly supersedesRevision?: RevisionRef;
}

type Fulfilment = "not-assessed" | "not-yet-due" | "met" | "partly-met" | "not-met";
type Effectiveness = "not-assessed" | "effective" | "partly-effective" | "ineffective";
type Adequacy = "not-assessed" | "adequate" | "gap-remains";

interface AssuranceAssessment {
  readonly id: string;
  readonly target: TargetRef;
  readonly scope: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly sourceRevisionRefs: readonly RevisionRef[];
  readonly evidenceRevisionRefs: readonly RevisionRef[];
  readonly fulfilment: Fulfilment;
  readonly effectiveness: Effectiveness;
  readonly adequacy: Adequacy;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly assessorRoleRef: string;
  readonly reviewerRelationship:
    | "unknown"
    | "self-review-declared"
    | "separate-reviewer-asserted";
  readonly assessedAt: string;
  readonly recordedAt: string;
  readonly reviewBy: string;
  readonly supersedesAssessmentId?: string;
}
```

Runtime validators must close the illustrative `entityType`/cadence/reference sets to the accepted canonical vocabulary. Optional fields are genuinely unknown/absent, not empty-string stand-ins. Date-only targets require explicit timezone semantics; timestamps use existing validated instant conventions. Do not guess a universal freshness window or review cadence.

### 7.4 Lifecycle transitions

| Object | Proposed transitions | Guard and consequence |
|---|---|---|
| Strategic choice governance | Draft → proposed → approval-recorded → superseded/withdrawn | Approval evidence, rationale and required outcome/trade-off fields. A revised choice gets a new pinned revision; linked commitments are flagged for impact review. |
| Commitment agreement | Draft → proposed → agreed → superseded/cancelled | Agreement requires an accountable owner, target/cadence, criteria and approval evidence. Cancellation needs a separate reason/authority record and leaves unmet obligations visible. |
| Delivery item | Existing Action status and `planningState` remain separate | `planningState=committed` means delivery planning intent, not proof an organisational commitment was authorised. Preserve unmapped source status as unknown, not `todo`. |
| Assessment | Draft → issued → superseded/withdrawn | Issuing pins evidence and target revisions. Correction/withdrawal is a new event; preserve the prior conclusion subject to lawful erasure overlays. |
| Source contribution | Active → source-withdrawal-proposed → withdrawn/retained | Missing source data does not cancel the commitment. A reviewed disposition determines what remains in the plan. |
| Review outcome | Prepared → review-recorded → follow-up/open or closed | Opening/generating the pack is not review. Follow-ups link existing Actions/decisions rather than duplicating them. |

Agreement lifecycle, delivery state and assessment conclusion must not share one overloaded `status`. Show original agreement, currently effective agreement, current forecast and actual result together where relevant.

### 7.5 Relationships and implementation invariants

- Extend the existing closed link taxonomy only where no valid relationship can express the meaning. The ADR must list each allowed `(fromType, linkType, toType)` pair, direction and cardinality; no arbitrary link strings in UI code.
- Use typed choice targets containing Strategy ID and nested choice ID. Do not depend on a choice ID being globally unique unless the existing validator proves it.
- Require unique contribution IDs and unique source bindings within a workspace. Allow one Action to contribute to several commitments without duplicating the Action.
- Reject self-dependencies and cycles for causal prerequisite edges. Non-causal reference links may form cycles but must not be traversed as causal edges.
- Preserve multi-source alternative paths explicitly; do not treat every related record as a mandatory prerequisite. In P1, alternatives are explicit named groups rather than arbitrary Boolean expressions.
- Implement immutable history at Core's write boundary and import boundary, not merely TypeScript `readonly`. Reject edits/deletions to issued decisions/assessments/baselines except an explicit correction/supersession or governed erasure path.
- Do not infer a new physical entity for every conceptual box. Conversely, do not overload task descriptions or tags to avoid a justified schema change.

### 7.6 Service and event boundaries

Keep Core authoritative for local commitments, decisions and assessments. Add small typed commands/queries behind the existing API convention rather than having webviews mutate SQLite or private JSON stores. Proposed operation semantics (names to be resolved against the real API):

| Operation | Preconditions | Atomic effect |
|---|---|---|
| Preview source reconciliation | Trusted caller for local file; validated input | Read-only plan with expected local generation and source checksum; no business writes. |
| Apply source reconciliation | Fresh preview; explicit confirmation; writer ownership | Source-owned changes, revision capture and successful import record committed together. |
| Propose/agreement decision | Expected target revision; complete decision fields | Append decision and set the current agreement reference; preserve previous revisions. |
| Record assessment | Current/pinned target and evidence versions; explicit issue action | Append issued assessment; update a current-assessment pointer without rewriting history. |
| Record management review | Pinned input pack and explicit review completion | Review record plus linked decisions/follow-ups; no automatic approval of proposals. |
| Query posture | Scope, as-of/knowledge anchor and caller-visible dataset | Deterministic projection only; no materialisation side effect. |

Use existing change notifications to invalidate the relevant projections after successful commits. Apply optimistic expected-revision checks even with a single writer: a webview or import preview can be stale. Errors must include a safe code, repair action and affected local IDs, not raw payloads or personal data.

## 8. Interaction, presentation and accessibility

### 8.1 Working-context contract

Proposed internal vocabulary: `operations | oversight-assurance`. Proposed visible labels: **Operations** and **Oversight & Assurance**. Treat these as task contexts, not persona or security roles.

- Place an explicitly labelled switch in the shared shell; support keyboard and screen-reader operation. Display the current context in the persistent heading, not only in a menu.
- Use a distinct structural accent/icon and heading treatment for each context. Reuse the design token system; never reuse warning/error/success colours to mean a mode. Light, dark and high-contrast themes remain independent.
- On the first eligible local session, ask the user to choose a context once using clear descriptions. Publication-only review can initially open Oversight & Assurance, visibly labelled; entering a read-only Operations view never enables editing. This first-use policy is a proposed Phase 0 UX decision.
- Persist only the non-sensitive preference under workspace-scoped local state. Do not infer it from job title, record status, last edited entity, URLs supplied by an import or old `ciso/auditor/solo` preferences.
- Protect unsaved edits: Save / Discard / Cancel before switching. A cancelled switch preserves the current form and focus. Successful switching preserves an explicit scope/selected-record reference where valid, not a second copy of the record.
- Do not repurpose legacy lens values into the new enum. Retain their existing deterministic cleanup and introduce an independent preference with an explicit migration story.
- Show publication baseline versus browser-local proposal status independently. Working context, data-source state, theme and authority are orthogonal; avoid a single overloaded `mode` variable.
- Commands that initiate operational editing while in Oversight & Assurance must request the explicit switch through the normal UI entry point. Core policy still decides whether the write is possible. A mode flag is not a security authorisation token.

### 8.2 Operations landing

Order the existing landing surface around:

1. Scope and a clearly named change anchor: previous visit or chosen reporting checkpoint.
2. Material changes, escalations and explicitly flagged items; first visit says there is no earlier visit baseline.
3. Blocked commitments and delivery milestones, grouped by responsible source plan/team, with the next known response.
4. Due/overdue delivery work and cross-plan contention.
5. Routes into the source plan, Action, requirement, risk or evidence record.

Every signal states why it appeared, source currency, and the action the user can take. Do not manufacture a task from each signal. Offer create/link only after user confirmation. Keep the existing requirement finder and assess → justify → act journey available without entering an Advanced section.

### 8.3 Oversight & Assurance landing

Lead with **Where we stand**. Show:

- Scope, reporting/as-of period, source-plan coverage and information currency.
- Expected position: approved commitments and standing expectations.
- Reported position: what delivery owners report.
- Assessed position: what evidence supports, with unknown/not-assessed states.
- Material gaps: insufficient planned response, missed commitments, inadequate evidence, explicit disagreement and outcome-affecting dependencies.
- Decisions/reviews arising from that posture, not a general operational task queue.

Suggested row anatomy:

`Commitment | Accountable team/role | Original agreement | Current forecast | Reported delivery | Assessment | Material gap | Reviewed/source as-of`

Expanding a row reveals contributions from individual plans, acceptance criteria, source revisions, evidence and prior assessments. Provide **Inspect delivery detail** in place and **Switch to Operations to manage delivery** explicitly. Assessment and decision actions can remain available in Oversight & Assurance only where the existing host supports trusted authoring.

### 8.4 Shared editor and suite boundaries

Reuse the current item-detail pattern: collapsible record list on the left, selected record detail on the right where space allows; stacked list/detail on narrow screens; create versus link-existing kept distinct. Use progressive disclosure for specialist fields, consistent save state, next/previous navigation and a clear current source.

A source-owned record shows **Managed in source plan** with a read-only delivery form and an inert source reference. Local assessment fields are a separate form. Updating a source forecast never looks like editing the agreed commitment.

Workshop hosts the first complete local experience, using existing Home/Master Dashboard, Plan of Action, Strategy and Reporting surfaces where feasible. Assurance retains its assessment/pentest workbench. Shop supplies existing person-free commercial dependency context. Pub does not become the canonical team/identity provider. Explorer receives a governed projection in a later slice; it must not silently acquire sensitive authoring or approval capabilities.

### 8.5 Accessibility and complexity budget

- Preserve the Essentials plain-language explanations and original compliance journey.
- Do not resurrect retired routes or expand the navigation/command/panel budget without an explicit ADR amendment and recorded before/after counts.
- Require keyboard-only completion, semantic headings/tables, labelled controls, visible focus, correct focus restoration and accessible status announcements.
- No information depends solely on colour, hover, 3D layout or animation. Respect reduced motion.
- Verify the touched journeys at 320 px, 768 px and 1440 px widths and at 200% zoom. Use existing performance/accessibility budgets; document any proposed change rather than inventing new acceptable latency.
- Provide an empty state, normal state, partial/stale state and large fixture. No-record and no-access states must not look like good posture.

## 9. Source-plan ingestion and reconciliation

### 9.1 Minimum supported ingestion

P1 supports an operator-selected, normalised local file via the existing manifest-led master-bundle/import infrastructure. A preparatory adapter may translate one declared source format into that contract; it is not a second canonical exchange format. The importer must not pretend arbitrary platform JSON is compatible. Required normalized fields and lifecycle below must be specified in the Phase 0 ADR/schema contract before implementation.

Do not enable a live URL connector, credentials form, scheduled import or bidirectional write-back. A manual source-reference registration is valid, but remains **not synchronised** and cannot provide unknown milestone status.

### 9.2 Identity and authority

A source binding's identity is the exact tuple:

`workspace scope + source-system key + source-plan key + source-record key`

Store source revision/version separately. Do not deduplicate by title, description, owner name or due date. Do not repair identifiers by trimming/changing case unless the source adapter explicitly defines and tests that transformation; retain the original identifier. Local canonical IDs follow existing ID rules, not external identifiers.

Source-owned fields: source title/scope where imported, delivery status, source owner assertion, forecast dates, reported actuals and the source's own agreement claims. Locally owned fields: organisational commitment baseline, contribution mapping, local assessment, review/approval evidence, annotations and accepted exceptions.

A source's assertion that an item is approved/complete is a source claim, not an authenticated local approval. Store it distinctly. If an imported source milestone already expresses the agreed outcome, link it and pin the accepted revision rather than manually retyping it into a second schedule.

### 9.3 Preview → confirm → apply

1. Read the selected file without fetching any referenced URL. Enforce existing file-size, nesting, record-count, text-length and schema limits before expensive processing.
2. Validate all version axes, field publication policies, IDs, source bindings, relationship endpoints and declared collection completeness. Reject unsupported mandatory semantics rather than silently dropping fields.
3. Build a deterministic read-only plan with create/update/no-op/conflict/rejected/retired counts and per-record reasons. Every count comes from the actual plan, not UI estimation.
4. Separate proposed source updates from local-owned fields. Show any stale-source revision, unknown revision ordering, conflicting binding, orphaned dependency or proposed withdrawal of a contribution.
5. Require explicit confirmation for this source-ingestion workflow even if it consists only of creates. Do not globally change unrelated legacy additive-import behaviour without its own decision.
6. On Apply, revalidate against the current local revision/generation and exact file contents/checksum used for preview. If either changed, invalidate the plan and require a new preview. A checksum supports change detection, not authenticity.
7. Apply all approved updates and the successful import journal atomically through Core's writer queue. Validation, ownership or persistence failure leaves business state unchanged.
8. Show the actual outcome and the existing bounded undo/recovery option. Do not advertise permanent undo if the host supports it only until the next write/navigation/refresh.

### 9.4 Required reconciliation rules

| Condition | Required behaviour |
|---|---|
| Same binding and same revision/payload | No business-record change, no duplicate milestone, no fabricated delivery event. A separate operational import attempt record may be retained. |
| Newer comparable revision | Preview source-owned field changes; preserve local baseline/assessments. |
| Older comparable revision | Reject as stale or explicitly retain as historical-only; do not roll current state back. |
| Same revision, different payload | Conflict requiring explicit investigation; no last-writer-wins. |
| Incomparable/absent source revisions | Use explicit captured content/version metadata and flag ordering unknown. Never infer newer from file modification time alone. |
| Record missing from a delta | No deletion or retirement inferred. |
| Record missing from a declared complete snapshot | Propose a source-withdrawn/tombstone event for review; retain commitment linkage/history. Never imply cancellation is approved. |
| User renames a source system/plan label | Identity unchanged; binding keys remain stable. |
| Two plans reuse the same external item ID | Keep distinct by the complete source tuple. |
| Two bindings claim one local record | Reject ambiguous ownership; explicit reconciliation required. |
| Incoming update touches a locally approved baseline or assessment | Reject that portion as an authority conflict; a source import cannot approve local decisions. |
| Source says done but supplies no result/evidence | Update reported state only; assessment remains unassessed/unsupported as appropriate. |
| Dependency cycles, dangling mandatory contributions or cross-workspace refs | Reject invalid canonical writes; expose a repairable preview error. Do not silently manufacture nodes. |

Keep raw source payloads out of published artefacts, logs and model prompts. If a recovery/audit requirement needs raw files, retain only in the approved local recovery boundary under its retention policy, not embedded wholesale in entity free text.

## 10. Assessment, roll-up and historical reporting rules

### 10.1 Shared projections, not persisted competing truth

Introduce pure, tested builders in `@pspf/contracts` for commitment delivery summaries, assessment currency, coverage gaps and posture roll-up. Reuse existing primitives where their semantics match; do not copy their formulas into Workshop, Assurance, Explorer and brief-renderer independently.

Each builder takes an injected clock, explicit scope, records/links, selected agreement revision and an optional reporting knowledge anchor. It returns source IDs/revisions, reason codes, contributing populations and unresolved-data warnings. Its output must be deterministic and must not mutate records.

Recommended evaluation order:

1. Validate scope and select the agreement/standing expectations effective for the requested view. Keep unowned/unanswered obligations in a separate visible gap population.
2. Resolve unique contribution targets and required/alternative groups; report missing/dangling/source-withdrawn records explicitly.
3. Build delivery facts from the latest accepted source revisions. Preserve unknown status and stale-source indicators independently from the last known reported status.
4. Identify unresolved required dependencies, missed target dates and source forecasts beyond the applicable baseline. Do not propagate merely related context as a blocking edge.
5. Select issued assessments for the exact target revision and requested period. If evidence, target or source basis changed, show the prior assessment as stale/review-needed, not silently current.
6. Return delivery and assessment dimensions side by side. No automatic assessment result is created by the projection.
7. Aggregate unique commitments within scope. Show the number/count basis of agreed, draft/unagreed, unowned, not-assessed, stale, disputed and materially affected records; distinguish overlapping signal counts from mutually exclusive lifecycle totals.

A required contribution blocked makes the affected delivery path at risk. An alternative group is available only if at least one explicitly accepted alternative satisfies its condition; otherwise the group is unsatisfied/unknown. Supporting contributions can inform context but cannot silently become prerequisites. Risk acceptance or an interim control can change assessed exposure only through an explicit, evidenced assessment/decision—not by removing the blocker from the underlying plan.

### 10.2 Prohibited shortcuts

- Do not average Action completion, control scores or source risk ratings into an assurance percentage.
- Do not infer approved commitment from Action `status !== todo`; use the actual agreement and separate `planningState` appropriately.
- Do not infer a strategic benefit from a positive trend string. Show reported measure movement as such and require assessment for effectiveness/adequacy.
- Do not promote `asserted`, `evidenced` or `evidenced-fresh` into a conclusion of adequacy or independence. Those existing categories describe evidence basis, not a guarantee.
- Do not combine incomparable custom risk methods by raw numeric multiplication. Show method-aware attention where supported and an explicit excluded/unknown basis otherwise.
- Do not silently exclude cancelled/source-missing/unassigned records to improve the headline. State scope and disposition.

### 10.3 Historical accountability

Maintain separate notions of:

- **Effective/as-of time:** when an agreement, source claim or assessment applies.
- **Recorded/observed time:** when the application learned or recorded it.
- **Review/publication time:** when someone reviewed or distributed a particular frozen view.

P1 must support immutable accepted revisions and frozen review packs using the existing snapshot facilities plus the necessary local protected revision capture. This is **not** a promise to build a universal bitemporal database. For a closed reporting period, preserve the as-reported input/revision set. Later corrections create a clearly labelled restatement; do not rewrite the old pack.

If older snapshots lack per-record/evidence history, display a counts-only or unavailable limitation. Never reconstruct missing historic assessments from current values. Evidence URLs alone do not freeze their contents: record the available source version/content checksum or explicitly state that content was not captured and historical verification is limited.

Keep first recorded due date, first approved baseline and current approved baseline distinct. A source date change appends forecast history; only an authorised recorded decision revises the agreement. Enforce retained history even on same-date saves, source imports, round-trips and restore paths.

### 10.4 Review output contract

Reuse existing Reporting Workbench/narrative/brief facilities. The local review pack contains:

- Scope and period; input snapshot/revision references and generation time.
- Approved strategic choices and relevant assumptions/trade-offs.
- Commitment posture with reported versus assessed positions.
- Significant fulfilment/effectiveness/adequacy gaps, contention and stale evidence.
- Decisions required or recorded, authority-basis references and follow-up Actions.
- Coverage limitations and excluded/unavailable data.

Local edited narrative remains visibly an operator note and cannot overwrite generated source facts. Generating/copying a pack does not mark it reviewed or publish it. An issued management-review record pins the pack and resulting decisions.

## 11. Security, privacy, authority and publication

### 11.1 Trust boundaries and threat cases

| Boundary/threat | Required control | Verification |
|---|---|---|
| Untrusted local source file → Core | Bounded parse/schema validation; inert URLs; source identity/authority rules; preview and atomic confirmed apply | AC-18–AC-22, AC-43 |
| Webview/browser state → Core write API | Existing trusted-caller/workspace/writer checks plus expected revision; context switch does not grant privileges | AC-03, AC-20, AC-40 |
| Source claim → local approved/assessed position | Separate records/field ownership; explicit local decision/assessment transition | AC-22, AC-25–AC-28 |
| Local organisational data → public/portable artefact | Explicit allowlisted DTO and field policy; no raw nested metadata or private free text | AC-33–AC-35 |
| Private facts → apparently safe aggregate | Build the public projection from permitted data; test that hidden-only changes do not leak through counts, ordering, scores or narrative | AC-34 |
| Another workspace/customer → active context | Workspace-scoped stores, ID maps, caches, temporary previews and preferences; no implicit merge | AC-45 |
| Historical write → audit claim | Core-enforced append/supersession rules; protected recovery; truthful tamper limitation | AC-23–AC-26, AC-38 |

### 11.2 P1 publication policy

All new commitment content, source bindings, source URLs/keys, owner labels, governance rationale, assessment details and historical revisions default to `sensitive` and stay in the local trusted workspace. New assessor/authority references must be person-free under an explicit local schema decision; never reuse restricted personal fields to bypass policy.

Do not infer that a string is anonymous because its field is called `team`, `role` or `owner`. Prefer controlled person-free labels/keys and reject known person/assignment identifiers. Free-text governance rationale remains sensitive and is never automatically exported to Explorer. Record unavoidable identity limitations rather than adding an identity system.

A local sensitive review pack is a distinct, explicit copy-out workflow with the repository's approved markings, preview and user confirmation. Public Explorer publication and email/clipboard share paths are separate sinks. A mode switch, reader role or purported public profile does not make data publishable.

Keep new local collections out of Explorer's pass-through/reconstructed exports until every relevant sink is tested. If merely including new collections could leak through an existing pass-through path, block that export combination at preflight; do not rely on UI hiding. Address the source-level debt in R-09/R-10 and §4.2 before P2.

### 11.3 P2 portable projection

Before implementing, approve a field-by-field publication ADR listing permitted identifiers/role labels, descriptions, signals, timestamps, baselines and assessment summaries. Define remapping for IDs and relationships using existing publication rules. Do not publish a link to a withheld entity or leak its identity through counts or source URLs.

The published view must identify scope, as-of date, last source capture, assessment currency, exclusions and whether it is a frozen snapshot or contains browser-local proposals. Read-only publication is enforced on the actual mutation paths, not by an `Oversight` label.

Separate immutable published baseline from browser-local suggestions. Local suggestions are not accepted organisational decisions and return through explicit Core review. Prevent Explorer from overwriting source-owned delivery facts or local accepted baseline/assessment history on reimport.

### 11.4 Bounded authority and exceptions

A recorded approval names a person-free role/authority basis and supporting record, but remains **operator-recorded** until a future identity/signature design is explicitly approved. Technical caller identity proves which application wrote a record, not who exercised organisational delegation.

Keep residual-risk acceptance, risk-tolerance changes and permitted compliance exceptions as distinct decision kinds. Require scope, authority basis, rationale, compensating measures where applicable and review/expiry conditions. The app cannot make a prohibited departure lawful by recording approval. PSPF exceptional/alternative-mitigation arrangements must be applied in their proper scope.[6]

### 11.5 Honest limits and records lifecycle

The existing local data/exports are not made encrypted or tamper-proof by classification banners, SQLite, TypeScript `readonly` or SHA-256 checksums. Do not introduce new cryptographic choices in this programme. Preserve the repository's separate governance for any future signing/encryption.

Use the existing records/erasure policy: normal corrections are append/supersede; legal erasure/redaction overlays remain an exceptional governed path. Do not add automatic retention/deletion or keep raw imported personal data indefinitely. Document what local recovery files contain and how the user protects them. Logs/diagnostics contain safe IDs/codes and counts, not credentials, raw source records or personal text.

## 12. Compatibility, migration and recovery

### 12.1 Compatibility matrix to resolve in Phase 0

Inspect actual `VERSION_AXES`, JSON schemas, runtime validators, source fixture versions and served build inputs. Product version 1.75.0 is not a compatibility axis. Repository documentation about the Risk schema/served Explorer baseline has drift; record observed values rather than assuming them from a prose status line.

| Change | Expected handling |
|---|---|
| Local UI working-context preference | No bundle/API/schema bump solely for the preference; do not export it. |
| Canonical commitment/source/assessment/decision fields | ADR-approved contract/persistence change and explicit compatibility-axis decisions. |
| Public projection/collection change | New approved schema version as required, updated fixture/manifest/runtime validator/served schema with parity tests. |
| Old bundle into new application | Explicit supported migration/adapter path with unknown/unagreed defaults; otherwise readable rejection. |
| New semantics into old application | Reject unsupported required semantics; do not silently drop commitments/approvals and call the import successful. |
| Sanitised local-authoring round-trip | Preserve omitted local-owned fields from the authoritative record; omission is not deletion. Explicit deletion needs validated authority. |
| Full-fidelity recovery | Separate from a sanitised publication bundle; preserve sensitive data and exact local revisions. |

Keep `schemaVersion`, `bundleVersion`, `apiVersion` as the only canonical compatibility axes. No new `poamVersion` or `modeVersion` parallel contract. A source's own revision is provenance, not an application compatibility axis. Published old schemas are immutable; reference resolution remains local/relative under existing rules.

### 12.2 Migration sequence

1. Show current contract version, proposed target, affected record counts and known limitations in a read-only preview.
2. Confirm trusted workspace, exclusive writer ownership and safe quiescent persistence boundary.
3. Produce a verified, **lossless local recovery reference** using the actual storage/recovery mechanism. A default-deny publication export is not a full backup. Exclude/recreate stale writer locks correctly on restore.
4. Require explicit operator command/confirmation for canonical migration. Do not assume the aspirational generic migration command is already implemented; supply a tested bounded command/route if required.
5. Apply deterministic conversion in a transaction or the repository's proven equivalent atomic persistence boundary, including schema/metadata updates. On failure leave the old state usable or restore it through the tested recovery path.
6. Validate records, policies, references and old-history preservation. Record migration source/target, warnings, completion and recovery reference.
7. Reopen in the supported state and prove a cold restore of the protected pre-migration data. An unverified recovery reference does not permit migration completion.

### 12.3 Backfill rules

- Existing Actions remain Actions. Preserve `ownerTeam`, `planningState`, status, dates, source references and history exactly.
- Existing nested strategy choices keep their IDs and content. No fabricated approval owner/date/rationale.
- Existing work can be linked to a **draft/unagreed** commitment after explicit user review. Do not bulk convert active Actions to approved commitments.
- Existing first-observed due dates retain that meaning. Where original agreement is unknown, retain unknown.
- Existing current assessments can remain legacy/current-state assertions. Do not manufacture past assessment revisions or claim independent review.
- Existing source provenance is reused only where identity semantics match; a risk's remote identifier is not an Action's source key.
- New history enforcement must preserve governed restore/erasure paths without permitting ordinary editor/import overwrites.

### 12.4 Rollback and feature exposure

Introduce the new local experience behind an explicit development/rollout capability until accepted. Disabling a view must not delete its records. Schema rollback is not achieved by hiding the mode switch: an old binary must either read the new store under a proven compatibility rule or refuse safely. Preserve a tested recovery copy before accepting an incompatible migration. Do not publish or promote releases as part of implementing the draft without separate release authorisation.

## 13. Phased implementation tasks and file map

### 13.1 Sequencing and capacity

This is a programme specification, **not permission to implement all requirements in one release or one Copilot session**. Keep one active vertical slice. Complete its tests, documentation and review before starting the next. No dates, capacity estimates or release numbers are asserted here; Phase 0 supplies the bounded sequence after examining the current roadmap.

The smallest meaningful product demonstration is the flagship case in §14.2. An isolated mode selector is an enabling slice, not completion of the user's request. Likewise, a new data model with no usable view is not completion.

| Phase | Scope | Exit gate | Depends on |
|---|---|---|---|
| 0 | Confirm current truth, approve decisions, map contracts and define the exact local slice | Accepted ADR(s), file/test map, compatibility/publication decisions, explicit deferred register | Current roadmap/Risk Phase 4B disposition |
| 1 | Context presentation and existing-semantic regression fixes | Distinct task context, legacy-lens retirement preserved, no business/schema mutation, relevant regression tests | Phase 0 mode decision |
| 2 | Minimal local commitment/baseline/decision contract and protected persistence | A real local commitment can be agreed/revised and restored without invented history | Phase 0 model/migration decisions |
| 3 | One source-plan adapter and explicit reconciliation | Distinct source plans contribute to the same commitment; idempotency/conflict/atomicity tests pass | Phase 2 and import-boundary prerequisites |
| 4 | Evidence-backed assessment and shared roll-up | Reported versus assessed state and material dependencies behave correctly | Phases 2–3 |
| 5 | Integrated Operations/Assurance journeys and local review output | Flagship workflow, accessibility, retained compliance journey and protected review pack pass | Phases 1–4 |
| 6 | P1 integration, recovery, operator walkthrough and release readiness | P1 requirements demonstrably satisfied; remaining P2 explicitly deferred | Phases 1–5 |
| 7 | Optional P2 safe Explorer projection | Accepted publication ADR; all touched egress/round-trip paths pass; no new sensitive leakage | P1 plus publication-boundary closure |

### 13.2 Phase 0 — exact Copilot handoff

Read the current branch state and the following authoritative documents before editing implementation:

- `docs/AGENT_ORIENTATION.md`, `.github/copilot-instructions.md`.
- `pspf-grand-plan.md`, `pspf-invariants.md`, `pspf-spec-consistency-index.md`.
- `adr/0096-v1-70-essentials-programme-and-surface-reduction.md`.
- `adr/0097-v1-74-brief-once-act-often-reporting-programme.md`.
- `adr/0098-workshop-risk-overhaul-contract-baseline.md`.
- `pspf-entity-link-spec.md`, `pspf-core-api-contract-spec.md`, `pspf-explorer-json-bundle-schema-spec.md`.
- `pspf-security-redaction-controls.md`, `pspf-threat-model.md`, `pspf-migration-safety-runbook.md` and `pspf-backup-and-restore-runbook.md`.
- `pspf-acceptance-and-quality-gates.md`; `pspf-developer-pipeline-spec.md` before any release work.

Deliver a decision table covering: entity reuse/new contracts; choice revision identity; per-field source/local authority; local person-free authority references; source input contract; baseline/history enforcement; migration/recovery; UI context/surface budget; compatibility axes; publication exclusions; current-framework dataset drift. Include exact allowed link pairs and tests.

Create the next available ADR(s) only during the separately authorised implementation/planning continuation, not by inventing an ADR number in this document. Update the governing topic specs and forward plan together when those decisions are accepted. Do not simply mark this entire document implemented.

### 13.3 Existing files to inspect/modify by concern

| Concern | Existing anchors | Nearby test anchors |
|---|---|---|
| Strategy choice/Action/entity contracts and publication fields | `packages/contracts/src/index.ts` | `packages/contracts/src/publication-policy.test.ts`, `packages/contracts/src/due-date-history.test.ts` |
| Risk/control/event reuse and source crosswalk precedent | `packages/contracts/src/risk-model.ts`, `packages/contracts/src/risk-crosswalk.ts` | `packages/contracts/src/risk-model.test.ts`, `packages/contracts/src/risk-crosswalk.test.ts` |
| Core persistence, reconciliation, history and recovery | `packages/core/src/service.ts`, `packages/core/src/extension.ts` | `packages/core/src/service.test.ts`, `packages/core/src/extension-ui.test.ts` |
| Derived strategy priority and delivery classification | `packages/workshop/src/continuous-compliance.ts` | `packages/workshop/src/continuous-compliance.test.ts` |
| Operations/strategy/plan/reporting authoring | `packages/workshop/src/extension.ts`, `packages/workshop/src/plan-of-action-board.ts`, `packages/workshop/src/webview/shell.ts` | `packages/workshop/src/workshop-ui.test.ts`, `packages/workshop/src/plan-of-action-board.test.ts` |
| Shared task-context chrome | `packages/webview-shell/src/shell.ts`, `packages/webview-shell/src/home-panel.ts`, `packages/webview-shell/src/tokens.ts`, `packages/webview-shell/src/presentation-lens.ts` | `packages/webview-shell/src/index.test.ts` |
| Assessment workbench linkage | `packages/assurance/src/extension.ts`, `packages/assurance/src/pentest-workbench.ts` | `packages/assurance/src/assurance-ui.test.ts`, `packages/assurance/src/pentest-workbench.test.ts` |
| Roll-up/review pack reuse | `packages/brief-renderer/src/index.ts`, `packages/contracts/src/reporting-period.ts`, `packages/contracts/src/team-report-card.ts` | `packages/contracts/src/assessment-basis.test.ts`, `packages/contracts/src/blocker-fan-in.test.ts`, `packages/contracts/src/reporting-period.test.ts`, `packages/contracts/src/team-report-card.test.ts` |
| Explorer context/navigation | `packages/explorer/src/app/pspf-app.ts`, `packages/explorer/src/app/routes.ts`, `packages/explorer/src/state/app-store.ts`, `packages/explorer/src/state/presentation-lens-context.ts` | `packages/explorer/src/state/app-store.test.ts`, `packages/explorer/tests/e2e/navigation.spec.ts` |
| Explorer posture and file boundary | `packages/explorer/src/views/home-view.ts`, `packages/explorer/src/views/posture-view.ts`, `packages/explorer/src/data/core-bundle.ts`, `packages/explorer/src/data/share.ts` | `packages/explorer/src/data/core-bundle.test.ts`, `packages/explorer/src/data/core-bundle.sample.test.ts`, `packages/explorer/src/data/share.test.ts` |
| Schema/publication/release gates | `scripts/check-schema-policy.mjs`, `scripts/check-schema-coverage.mjs`, `scripts/check-explorer-publication.mjs`, `scripts/check-essentials-surface.mjs`, `release-gates.json`, root `package.json` | Existing script/package gates and their inherited release chain |

**Proposed new files, only if the Phase 0 mapping justifies them:**

- `packages/contracts/src/commitment-model.ts` and `commitment-model.test.ts` — local commitment/baseline/assessment logical contracts and validation helpers.
- `packages/contracts/src/commitment-rollup.ts` and `commitment-rollup.test.ts` — shared deterministic projections with injected clock/scope.
- `packages/contracts/src/source-plan-reconciliation.ts` and `source-plan-reconciliation.test.ts` — pure source comparison/write-set planning, following the risk crosswalk pattern.
- `packages/webview-shell/src/working-context.ts` and `working-context.test.ts` — task-context descriptors only, not access control.
- `packages/workshop/src/commitment-workbench.ts` and `commitment-workbench.test.ts` — focused model/render helpers used from existing panels, not a new navigation silo by default.
- `packages/explorer/tests/e2e/working-context.spec.ts` — context and read-only/local-authoring boundary journeys when Explorer is in scope.

These paths are suggestions, not claims that files already exist. Prefer a small owning module over further expanding monolithic `index.ts`/`extension.ts`, while respecting existing exports and conventions.

### 13.4 Bounded implementation tasks

For every code-producing task below, use: **write one failing test → run and observe the intended failure → implement minimum change → run focused test → run relevant regression checks → update the owning spec → review the diff**. Commit only under the repository's authorised workflow; do not auto-push or publish.

**Task 1 — Context contract and navigation proof.** Add context descriptors and preference isolation; keep legacy lens normalisation tests. Render explicit labelled switching in the owning shell(s) with a fixture-backed landing composition. Prove no record mutation/capability change and unsaved-edit handling. Tests: AC-01–AC-07, AC-41. No canonical schema change.

**Task 2 — Correct existing decision semantics.** Reproduce candidate/committed classification from `planningState`, cancelled-action handling, and trend-versus-assessed-outcome cases in `continuous-compliance.test.ts`. Introduce separate attention/approved-priority presentation only after the decision contract exists. Do not modify the existing derived ranking into an editable score. Tests: AC-09, AC-10, AC-25.

**Task 3 — One local commitment through persistence.** Add the minimal accepted contract, agreement guards, immutable baseline/revision capture and local field policies. Prove draft → agreed → revised for a single commitment, including same-date history protection. Add the exact migration/restore path before using new persisted data. Tests: AC-11, AC-12, AC-23, AC-24, AC-37, AC-38.

**Task 4 — Source binding and first import.** Add one explicit normalised source-plan fixture, preview and confirmation. Generalise the crosswalk pattern only as far as needed. Prove complete identity, same-input idempotence and no implicit authority transfer. Tests: AC-16–AC-22.

**Task 5 — Multiple plans and dependency conditions.** Link source Actions to the existing commitment without cloning them. Add mandatory/supporting/alternative contribution semantics, unknown sources, stale status and withdrawal rules. Tests: AC-13–AC-17, AC-29, AC-30, AC-36.

**Task 6 — Assessment revision.** Issue a separate assessment against pinned commitment/evidence/source revisions; show owner-done/assessor-not-met simultaneously. Correct by supersession. Include self-review/unknown independence, evidence expiry and changed target revision. Tests: AC-25–AC-28.

**Task 7 — Standing expectation and missing response.** Reuse the existing requirement/direction/risk-control model to show a continuing expectation or gap without forcing a new Action. Reuse framework provenance and review-needed cues. Tests: AC-15, AC-44.

**Task 8 — Shared posture projection and both real landings.** Wire real local records through shared builders; show scope, populations and source currency. Preserve the old compliance journey and no-extra-record rule. Tests: AC-04–AC-07, AC-14, AC-30, AC-42.

**Task 9 — Review and historical pack.** Reuse narrative/reporting builders with snapshot/revision references. Distinguish generation from recorded review and as-reported from later restatement. Confirm sensitive local copy-out and unsafe output blocking. Tests: AC-31–AC-33.

**Task 10 — Integration/recovery and operator acceptance.** Run the entire flagship journey and P1 acceptance suite, writer contention, cold restore, workspace isolation, offline and accessibility checks. Address every failure or explicitly reduce the authorised release scope; do not call a plausible subset complete. Tests: AC-35, AC-37–AC-45 and all prior P1 tests.

**Task 11 — P2 only: safe Explorer projection.** First reproduce/resolve the relevant export/round-trip mismatches. Approve the exact portable DTO and schemas. Wire the read-only baseline and separately labelled local proposals; prove no sensitive pass-through and round-trip loss. Tests: AC-03, AC-33, AC-34, AC-39, AC-42. Do not piggyback live connectors or identity work.

### 13.5 Documentation changes required alongside implementation

Update the authoritative entity/link, API, screen/workflow, design/glossary, privacy, migration, acceptance and invariants documents touched by each slice. Keep the grand plan as the scheduling authority. Correct the misleading role/mode and approved-versus-derived-priority descriptions. Add this programme to `pspf-spec-consistency-index.md` only with its actual approved status.

Update the product website/Marketplace descriptions only after corresponding behaviour is verified and the release is authorised. Mark local-only versus published capability, snapshot versus live data, and known limitations plainly. Do not advertise federation merely because a local Action now has a source label.

## 14. Acceptance tests and verification commands

### 14.1 Test method

Use the repository's existing test runners and fixture factories. For each vertical increment: add one failing behavioural test, run it and record the expected failure, implement the minimum change, rerun it, then run the owning package/regression gates. Do not write an entire speculative test suite and a parallel implementation in separate passes. Tests must exercise real builders/validation/persistence where feasible, not just assert that a mock was called.

All sample records below are **synthetic fixtures**, not the user's work data and not real compliance findings. Use canonical ID factories rather than presenting convenient fixture names as valid persisted IDs. Inject clock/timezone/source revisions. Do not call external platforms or load production workspaces.

### 14.2 Flagship fixture

Create a synthetic strategy with a choice to prioritise demonstrated recovery for a critical service. Link one approved commitment to a recovery target and evidence criteria. Two separately owned source POAMs contribute required milestones; a shared dependency blocks one. A second standing expectation has no improvement project. Include an unassigned obligation, a source claiming completion without evidence, a contradictory assessment, an older source revision and an approval-recorded rebaseline.

The fixture must demonstrate that completing many non-critical items cannot conceal the critical blocked contribution. It must also demonstrate that an effective interim control can support a separately assessed position while permanent improvement work remains delayed. Do not infer either conclusion without its evidence.

### 14.3 Acceptance catalogue

| ID | Scenario | Required assertion |
|---|---|---|
| AC-01 | Explicit switch by keyboard and pointer | Current label/structural identity changes; focus remains usable; both themes and high contrast preserve meaning without colour. |
| AC-02 | Switch contexts repeatedly | Canonical business records, approved priorities, calculations, evidence and source bindings do not mutate; preference remains local to the workspace. |
| AC-03 | Read-only publication or non-writer Core window switches to Operations | No write capability appears; direct command/API attempts remain blocked by the underlying capability boundary. |
| AC-04 | Operations opens on an existing reporting anchor | Changes/escalations/flags and delivery blockers lead; first-visit state does not invent a prior comparison. |
| AC-05 | Assurance opens with mixed complete/stale/missing commitments | Overall scoped posture leads; unknown/stale/gaps are visible without reading a task board. |
| AC-06 | Same source record appears in both contexts | ID, revision and reported delivery values match; assessments are distinct overlays, not cloned records. |
| AC-07 | Reviewer inspects and then tries to edit a delivery item | Inspection is read-only in place; edit requests an explicit switch; cancellation leaves both data and context unchanged. |
| AC-08 | Record a strategic choice | Chosen approach, alternative/defer/stop decision, outcome, capacity assumption and review condition are retained; draft is not displayed as approved. |
| AC-09 | Supersede an approved choice | Earlier choice revision/decision remains retrievable; affected commitments require review; no automatic cancellation or altered prior-period view. |
| AC-10 | Linked risk attention changes | Derived attention can change; approved priority and delivery sequence do not change automatically. |
| AC-11 | Attempt to agree an incomplete commitment | Reject transition when outcome/scope, accountable owner, target/cadence, acceptance criteria or approval evidence is missing. Keep a repairable draft. |
| AC-12 | Legacy/unassigned or source owner unknown | Show Unassigned/Unknown; do not fabricate a team or user identity; allow remediation without claiming agreement. |
| AC-13 | One source milestone contributes to several commitments | One source-owned record persists; contribution links are distinct; unique record/plan counts are deduplicated. |
| AC-14 | Critical prerequisite blocked; other work completed | Roll-up names the critical dependency and uncertainty; no average or completion ratio produces green assurance. |
| AC-15 | Obligation or standing control exists without POAM | Show expectation and response/assurance gap or existing control assessment as applicable; empty task set is not evidence of success. |
| AC-16 | Same external item key exists in different source plans | Distinct canonical bindings; labels cannot collapse identities. |
| AC-17 | Source stale, missing timestamps or incomparable revisions | Explicit stale/unknown state and source provenance; no fabricated freshness or revision order. |
| AC-18 | Import duplicate file and same revision | No duplicate business records or repeated baseline/history changes; import summary reflects actual no-ops. |
| AC-19 | Older revision or same revision with altered content | Stale/conflicting update blocked; current local and approved data preserved. |
| AC-20 | Preview then change the local workspace or selected file | Apply rejects stale preview, re-plans and requires confirmation. |
| AC-21 | Oversized/deep/malformed/dangling/cross-workspace import or injected persistence failure | Validation fails before mutation, or transaction fully rolls back; no partial success journal. |
| AC-22 | Source import attempts to update a local decision or assessment | Authority conflict is explicit; no local approval or assessed result is overwritten. |
| AC-23 | Source moves a forecast date | Original agreement and any approved revision remain unchanged; forecast history is recorded with source revision/time. |
| AC-24 | Approve a new baseline, or migrate a record with unknown original promise | New baseline references authority/rationale; old baseline retained. Unknown legacy promise is labelled first-observed/unknown, never backdated. |
| AC-25 | Owner reports done; evidence fails success criteria | Reported completion and unmet/insufficient assessment coexist; no automatic assurance closure. |
| AC-26 | Assessor changes a conclusion | New assessment supersedes the previous one without erasure; prior-period results remain reproducible within captured evidence limits. |
| AC-27 | Evidence is withdrawn/expired or target changes after review | Assessment remains historical; current view marks it stale/review-needed rather than applying it silently to the new target. |
| AC-28 | Same person is declared to deliver and review; identity is otherwise unknown | Self-review is explicitly declared where known; unknown actor independence remains unknown. No mode or role label creates an independent-assurance badge. |
| AC-29 | Plans share a resource/dependency or interim control | Display the explicit dependency and affected outcomes; do not infer capacity overload or effective mitigation without data and assessment. |
| AC-30 | Aggregate excludes, loses or cannot assess records | Denominator/scope and excluded/unknown populations remain explicit; no silent improvement in posture. |
| AC-31 | Late correction after reporting period closes | Reproduce the frozen/as-reported view and distinguish later restatement; do not claim full bitemporal reconstruction from insufficient snapshots. |
| AC-32 | Generate a pack, then record a management review | Generation alone does not mark reviewed; review identifies input snapshot, decisions, owners, follow-up and next review trigger. |
| AC-33 | Sensitive free text, personal tokens or hidden-source facts enter outputs | All prohibited values and derived leaks are absent from public bundle/HTML/clipboard/logs. Local approved sensitive copy-out is separately labelled and confirmed. |
| AC-34 | P2 publication projection | Only approved fields/relations cross; metadata states scope/as-of/exclusions; changing restricted-only data cannot change the public projection unless an approved aggregate policy permits it. **P2 only; deferred in P1.** |
| AC-35 | Person/Assignment/Pub identifiers or unsafe owner labels are supplied | No restricted identifiers or person data reach Core-owned commitment fields/publication; input is rejected or repaired through the approved person-free flow. |
| AC-36 | Source complete snapshot omits an item; a delta omits the same item | Complete snapshot proposes a withdrawal for review; delta causes no deletion. Existing commitment/history survives both. |
| AC-37 | Open a workspace needing an incompatible new persistence contract | No auto-migration; explicit compatible/read-only state and operator recovery route. |
| AC-38 | Migration failure, rerun and cold restore | Recovery preserves sensitive local data, source bindings, decision/assessment revisions and ownership; idempotent rerun causes no duplicates. |
| AC-39 | Old/new reader and bundle combinations | Supported combinations round-trip; unsupported semantics fail visibly without silent drops. Historical published schemas are unchanged. |
| AC-40 | Concurrent writer contention and import | Existing single-writer rules hold; contenders cannot partially apply source updates. |
| AC-41 | Unsaved form plus mode/scope switch | Save/Discard/Cancel behave deterministically; Cancel preserves inputs; no silent save or loss. |
| AC-42 | Narrow/zoomed/large/empty-state journeys | Keyboard completion and table alternatives work; no serious/critical axe findings; measured performance remains within the repository's approved budgets. |
| AC-43 | Run flagship journey without network and with hostile source URLs | No new runtime egress, URL fetch or code execution; normal local workflow remains usable. |
| AC-44 | Referenced framework edition/control text changes | Mapping/decision shows review-needed and preserves original source/version; no auto-reassessment or fake compliance mapping. |
| AC-45 | Switch workspace/profile, reload and import same external IDs | No draft/cache/binding/assessment cross-contamination; record namespaces and local preferences remain correctly scoped. |

### 14.4 Verified command names to use during implementation

These commands are defined by the inspected repository. **They have not been run as part of this specification task.** Recheck `package.json` at implementation time; preserve the pinned package manager. Use a disposable test workspace. Do not run debug reset/full-replace operations against the user's live data.

```bash
# Run from the Conceptual repository root after approved implementation work.
pnpm run doctor
pnpm build
pnpm --filter @pspf/contracts test
pnpm --filter pspf-core test
pnpm --filter pspf-workshop test
pnpm --filter pspf-assurance test
pnpm --filter @pspf/brief-renderer test
pnpm --filter @pspf/webview-shell test
pnpm --filter pspf-explorer test
pnpm --filter pspf-explorer run test:e2e
pnpm typecheck
pnpm lint
pnpm run check:schema-policy
pnpm run check:schema-coverage
pnpm run check:personal-data
pnpm run check:assurance-redaction
pnpm run check:brief-redaction
pnpm run check:writer-lock
pnpm run check:backup-restore
pnpm run check:explorer-to-workshop-import
pnpm run check:essentials-surface
pnpm run check:accessibility
pnpm run check:adr-coverage
pnpm run check:spec-drift
pnpm run check:gate-integrity
pnpm run release:readiness
```

Select the smallest relevant package/test for each RED→GREEN loop before running broader checks. Inspect the owning package script to obtain the exact focused-test invocation; do not assume Vitest and Node's test runner accept the same arguments. Register any new gates in the real release chain and preserve its historical continuity; do not bypass a failing constraint by weakening its assertion.

For each task report: command, environment/fixture, actual exit/result, affected acceptance IDs, remaining failures and any manual evidence. A missing executable/browser/dependency is a blocker, not a passed gate. Structural grep checks alone do not satisfy behavioural acceptance.

### 14.5 Manual product-owner acceptance

Have Toby perform the flagship case from each context without prompting. Ask him to identify current context, original commitment, source-plan ownership, current blocker, reported versus assessed position and the permitted next action. Include an occasional-reader walkthrough. Record confusion and steps rather than claiming cognitive-load reduction from implementation alone. If the switch increases navigation burden or duplicates work, revise presentation before expanding scope.

## 15. Risks, unresolved decisions and release acceptance

### 15.1 Strongest argument against this design

The suite previously removed modes because they added complexity. Reintroducing a switch can recreate that problem and add governance records nobody maintains. A technically complete model can still fail the product goal if it demands another round of data entry for each source plan.

Mitigation: distinguish task responsibility, not persona; reuse existing facts; default to links/pinned source revisions; keep one active slice; preserve the simple requirement journey; require Toby's observed workflow acceptance before expanding. If a proposed field does not support a decision, a traceable commitment or a necessary trust boundary, remove or defer it.

### 15.2 Open decisions with recommended defaults

These are explicit seams for Phase 0, not invitations for Copilot to invent policy.

| ID | Decision needed | Recommended default | Owner / required before |
|---|---|---|---|
| O-01 | How to supersede ADR 0096 and fit the surface budget | Two task contexts, no revived personas/retired routes; reuse existing panels and navigation; approve any measured budget change explicitly. | Toby + maintainer / context implementation |
| O-02 | Physical persistence of commitments, assessments and decisions | Thin typed Core aggregates; reuse existing events only if immutable history/targeting requirements are met. No duplicate StrategyChoice entity. | Maintainer proposes, Toby approves / schema change |
| O-03 | Person-free accountability and authority model | Local role/team keys with controlled labels and operator-recorded authority basis; no identity assurance or Pub ingestion. | Toby / decision workflow |
| O-04 | First real POAM source format | One declared local-file adapter with stable identifiers and preview; manual reference registration if no stable source export is available. | Toby selects source, maintainer maps / live import rollout |
| O-05 | Standing expectation cadence/freshness | Per-expectation/source-policy settings with explicit unknown state; no universal invented SLA. | Toby / assurance conclusions |
| O-06 | P2 publication scope | Keep all new material local until a field-level DTO/policy ADR and egress tests pass. | Toby + security reviewer / any portable new content |
| O-07 | How this fits current Risk Phase 4B and release train | Resolve/explicitly defer outstanding verification before accepting new schema dependencies; presentation work must not imply model completion. | Maintainer + Toby / programme scheduling |
| O-08 | Original agreement evidence for legacy work | Unagreed/first-observed by default; explicit user adoption creates a new baseline with real evidence. | Delivery/decision owner / initial migration adoption |
| O-09 | Framework data currency | Inventory vendored editions and mappings; schedule a separate reviewed refresh if needed. | Framework-data maintainer / claiming current-edition coverage |
| O-10 | First-use context and cross-suite preference propagation | Explicit first local choice; workspace-local shared preference for supported host surfaces; no cross-device/person synchronisation. | Toby / final UX acceptance |

### 15.3 Principal implementation risks

- **False assurance:** derived delivery/trend/evidence freshness gets presented as independently assessed effectiveness. Mitigate through separate types, labels, issuance and tests.
- **Duplicated maintenance:** source facts copied into local plans drift. Mitigate through field authority, source bindings, read-only mirrors and linked revisions.
- **Source ambiguity:** missing stable keys or revision ordering creates accidental merges. Mitigate through blocking preview conflicts and explicit adapter contracts.
- **Silent baseline rewrite:** source imports change promises. Mitigate through immutable agreement revisions and import authority separation.
- **Sensitive publication:** nested data or pass-through collections bypass allowlists. Mitigate before first affected export, not after UI work.
- **Migration loss:** sanitised export mistaken for a complete backup. Mitigate through proven local full-fidelity recovery and cold-restore tests.
- **Scope expansion:** strategy, identity, reporting, workforce and integrations all become simultaneous projects. Mitigate through the explicit deferred register and one vertical slice.
- **Documentation drift:** old acceptance statements override current code truth or new code silently overrides accepted policy. Mitigate by reconciling ADRs, specs and tests together.

### 15.4 Definition of done

A phase is complete only when its named acceptance criteria are demonstrated with actual results, its owning specs/ADR status are accurate, privacy/migration limits are explicit and regression gates pass. A release candidate additionally needs the current full release chain, manual operator acceptance and authorised release sequencing.

For P1 specifically:

- The flagship case uses real application persistence/projections, not canned screenshots or hard-coded outputs.
- Both task contexts work; the source facts are shared and operational editing requires explicit switching.
- Source-plan reconciliation, separate assessments, standing gaps, baseline history and protected review outputs are exercised.
- No silent unknown-to-green conversion, false approval/independence claim or new publication exposure remains.
- Existing requirements/evidence/risk/control/reporting workflows are not regressed.
- Full-fidelity recovery, single-writer safety and workspace isolation are verified.
- P2 remains visibly deferred if it is not delivered. Do not claim suite-wide portable parity from a Workshop-only slice.

## 16. Traceability and Copilot handoff

### 16.1 Decision-to-delivery map

| User/design basis | Requirements | Primary tasks | Framework/repository anchors |
|---|---|---|---|
| U-02/U-03, D-01/D-02/D-09: explicit contexts, no false role authority | REQ-01–REQ-04, REQ-22 | 1, 8, 10 | IIA.[5] R-07–R-09; ADR 0096 must be reopened explicitly. |
| U-04/U-05, D-03/D-04: consolidated commitment posture | REQ-07–REQ-11, REQ-15/REQ-16 | 3–5, 8 | PSPF supporting plans and ASD reporting.[6][2] R-03–R-06. |
| U-06, D-05/D-07/D-10: strategy and approved choices | REQ-05/REQ-06, REQ-20/REQ-26 | 2, 3, 9 | ISM strategy and PSPF security planning.[1][6] R-01/R-02. |
| U-04/U-07, D-08/D-13: evidence, disagreement and history | REQ-12–REQ-14, REQ-17/REQ-27 | 3, 6, 9 | PSPF effectiveness and ISO management-system guidance.[6][7] R-03/R-05/R-11. |
| D-14: standing obligations beyond POAM | REQ-09/REQ-24 | 7 | ISM POAM scope and applicability/treatment guidance.[1][7] Existing RiskControl/Requirement/Direction models. |
| D-11/D-12/D-15: bounded integration and protected outputs | REQ-18/REQ-19, REQ-21/REQ-23/REQ-25/REQ-28 | 4, 9–11 | Repository policy, R-06/R-09/R-10/R-12; external frameworks do not prescribe our serializer. |

### 16.2 Copilot starter prompt

```text
Read the attached commitment-led operating-model technical specification and
this repository's .github/copilot-instructions.md and docs/AGENT_ORIENTATION.md.

Perform Phase 0 only. Do not implement product code, change runtime data,
run migrations, install connectors, commit, push, publish or deploy.

Re-check the current branch/version and the existing StrategyEntity /
StrategicChoice / Action / risk-control / reporting / source-crosswalk code.
Map every proposed requirement to existing code, required change and test.

Explicitly reconcile ADR 0096's retired persona lenses with the new task
contexts. Preserve the Essentials simplicity constraints. Keep task context,
data provenance, writer capability and organisational authority separate.

Return:
1. Verified current baseline and any discrepancies from this specification.
2. The smallest proposed ADR/model change and exact field/link policies.
3. Source-owned versus locally owned fields and reconciliation semantics.
4. A tested-design proposal for baseline/assessment history and recovery.
5. Exact existing/new file paths and the first bounded RED-GREEN task.
6. Decisions requiring Toby's approval; recommend a default for each.

Do not invent missing approvals, source IDs, historical baselines, test
results or full ISO conformance. Do not make a new StrategyChoice entity or
master task plan if existing records and thin aggregates satisfy the need.
Start with the flagship local case, not all deferred features.
```

### 16.3 Read and maintain this specification

- Treat confirmed user direction, proposed implementation design, observed code and external obligations as separate evidence classes.
- At implementation start, attach the accepted Phase 0 decision table and ADR references; retain this document's original baseline rather than silently rewriting what was observed.
- When a requirement is delivered, record its acceptance IDs and actual evidence in the project's delivery record. Do not mark unrelated requirements complete.
- Keep sources below with any GitHub copy of this document. Repository references are pinned by the inspected commit; external sources were accessed on 19 September 2026 and may subsequently change.
- Keep private notes and actual organisational records out of public issues, fixtures and Copilot prompts. The examples in this document are synthetic and the note references are provenance only.

## Sources

[1] https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/cyber-security-guidelines/guidelines-for-cyber-security-documentation — ASD ISM — Cyber security documentation, September 2026
    > "A cyber security strategy is developed, implemented and maintained."
    > "At the conclusion of a security control assessment for a system, a plan of action and milestones is produced by the system owner."
[2] https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/cyber-security-guidelines/guidelines-for-cyber-security-roles — ASD ISM — Cyber security roles, September 2026
    > "Reporting on cyber security matters should be structured by business functions, regions or legal entities and support a consolidated view of an organisation’s security risks."
[4] https://www.iso.org/standard/27001 — ISO — ISO/IEC 27001:2022 and Amendment 1:2024
    > "ISO/IEC 27001:2022/Amd 1:2024"
[5] https://www.theiia.org/globalassets/documents/resources/the-iias-three-lines-model-an-update-of-the-three-lines-of-defense-july-2020/three-lines-model-updated-english.pdf — IIA — Three Lines Model, September 2024 update
    > "First and second line roles may be blended or separated."
    > "second line roles are part of management’s responsibilities and are never fully independent from management, regardless of reporting lines and accountabilities."
[6] https://www.protectivesecurity.gov.au/system/files/2026-07/pspf-release-2026_6.pdf — PSPF Release 2026 — sections 3.1, 3.3, 5.1, 8 and 14.1
    > "Where a single security plan is not practicable due to the entity’s size or complexity of business, entities may develop an overarching security plan that is approved by the Accountable Authority, supported by more detailed plans (referred to as supporting security plans), approved by the CSO or CISO (for cyber security plans), or their delegate."
    > "Develop, establish and implement security monitoring arrangements to identify the effectiveness of the entity’s security plan and establish a continuous cycle of improvement."
[7] https://www.nqa.com/getmedia/ae12c945-4dbb-4b73-a4e3-996261a540af/NQA-ISO-27001-Implementation-Guide.pdf — NQA — ISO 27001:2022 Implementation Guide, sections 5–10
    > "The risk treatment plan you develop cannot simply remain as a statement of intent – it must be implemented."
    > "Management review is an essential element of an ISMS. It is the formal point at which Top Management reviews the effectiveness of the ISMS and ensures its alignment to the organisation's strategic direction."
[8] https://tobyharvey.online — PSPF Ecosystem — published product description
    > "Every record has a stable prefixed ID and a typed link to other records. Domain anchors the assessment; Requirement is the hub; Evidence, Action, Risk, and Direction carry the assurance work."
    > "Linked risk severity (likelihood × impact) is adjusted by the choice's trend and confidence. The peak adjusted risk sets the choice's priority band. Nothing is persisted — it is a derived read model over existing data."
[9] https://tobyharvey.online/explorer — PSPF Explorer — public landing view
    > "Start with material posture signals, then trace every decision back to requirements, risks, actions, and evidence."
[10] https://marketplace.visualstudio.com/items?itemName=tobyharvey.pspf-workshop — PSPF Workshop — Marketplace description
    > "Item-detail webview panels with previous/next navigation and save-and-next for rapid assessment passes."
[11] https://marketplace.visualstudio.com/items?itemName=tobyharvey.pspf-assurance — PSPF Assurance — Marketplace description
    > "PSPF assessment, penetration testing, assurance finding, verification, and publication-readiness surface."
[12] https://marketplace.visualstudio.com/items?itemName=tobyharvey.pspf-core — PSPF Core — Marketplace description
    > "PSPF Core is the local system of record. It runs entirely inside VS Code, holds the workspace in a local SQLite database at `.pspf/core/pspf-core.db`, and enforces a single-writer lock so only one editing session touches the data at a time."
