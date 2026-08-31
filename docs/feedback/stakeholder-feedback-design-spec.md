# Stakeholder-Informed Requirement Uplift Design Specification

Status: **adopted — delivered through the v1.70 Essentials programme in `pspf-grand-plan.md` (ADR 0096)**
Last updated: 2026-09-01

## Purpose

This specification synthesises feedback from compliance officers, analysts and CISOs into a focused design direction for the next PSPF release. It complements the active compliance uplift workflow in `pspf-grand-plan.md`; it does not change architecture, data contracts, publication policy or product boundaries.

The release should make it easier to move from finding a requirement to making, justifying and reviewing a decision about it. It must work for focused operational updates and leadership oversight without requiring either user to navigate the full feature set.

## Problem statement

The necessary records and capabilities largely exist, but users struggle to:

- discover the applicable requirement without already knowing its identity;
- navigate from a requirement to its evidence, actions, risks and accountable owners;
- understand whether a change is favourable or adverse, why it occurred, and what happens next; and
- find a role-appropriate view without working through unrelated features.

The product currently reads more readily as a reporting surface than as a guided compliance uplift workflow.

## Product outcome

Every supported user should be able to answer and act on the following sequence:

1. Which requirement or control needs attention?
2. What is its current state and supporting evidence?
3. What changed, why, and what is the consequence?
4. What mitigation or action is appropriate, and who owns it?
5. What effect will the decision have on posture, risk and the forward work plan?

## Design principles

- **Discover before specifying.** Keyword search and structured browsing must work together; users must not need an exact identifier to begin.
- **One journey, multiple surfaces.** Explorer, Workshop and Core use consistent terminology, search behaviour and requirement context. Workshop remains the system of record and decision surface.
- **Action follows insight.** Every material status, risk or change signal should lead to a clear next action or a clear explanation that no action is needed.
- **Progressive disclosure.** Start with a focused workflow; keep advanced fields, diagnostics and controls available without placing them in the critical path.
- **Show impact after change.** Save confirmation must lead to an understandable update of the relevant requirement, posture, risk and linked work.
- **One default view for everyone.** There is no role or lens switcher. The default journey serves all users in plain AU English; analyst and CISO oversight needs are met by dedicated review screens (P1), which change presentation only — never data, permissions, calculations or publication.

## Shared workflow

### 1. Find and orient

Provide a common requirement finder across Explorer and Workshop with:

- keyword search across requirement identifiers, titles and relevant controlled text;
- PSPF Domain and section browsing for users who explore before they search;
- visible active filters and a clear route back to the complete requirement list; and
- result summaries that state current assessment, evidence confidence, open actions and material risk.

### 2. Assess and justify

Requirement detail should establish the decision basis before asking for action:

- current assessment state and acceptance definition;
- evidence, freshness and rationale;
- a concise consequence statement where risk remains uncovered; and
- relevant change history and commentary where available.

### 3. Mitigate and assign

For unmet or risk-managed requirements, present standard ISM-aligned mitigation guidance as a tailorable suggestion. The operator must explicitly accept, edit or decline the suggestion before an action is created or changed.

Actions should show owner, status, due date, blocker, impact and linked evidence or requirement context. The initial release may use existing ownership and relationship data; it must not infer an owner or create a new project-management workflow.

### 4. Confirm and understand impact

After a save, provide a compact confirmation that states:

- what changed;
- whether the change was saved successfully;
- affected actions, evidence and risks; and
- the resulting posture or priority signal, including an explanation where it changed.

### 5. Review and plan

Provide role-focused review screens over the same records (P1; the default journey itself is role-neutral):

- **Compliance officer:** the default journey — current requirement, evidence, mitigation and next action.
- **Analyst:** a dedicated screen for period-over-period requirement changes, direction, reasons, commentary and related actions.
- **CISO:** a dedicated screen for accountability over controls and gaps, material trends, owner commitments and milestone progress.

Connected View should begin at a summary level and disclose relationship detail on selection, avoiding a visually dense default graph.

## Release scope

### In scope

- Consistent requirement search, PSPF Domain/section browsing and result context.
- A clear requirement-to-evidence-to-action flow in Explorer and Workshop.
- Decision rationale, evidence and current consequence displayed in requirement detail.
- Standard mitigation suggestions and operator-confirmed draft actions.
- Explicit save confirmation and explainable impact feedback.
- A plain-AU-English explainer (what this means, why it matters, what to do next) on every essentials-path requirement and status surface.
- A single role-neutral default view, with analyst and CISO review screens as P1 follow-ons.
- Period-over-period change reporting using recorded history and existing change signals.
- A summary-first Connected View treatment.

### Out of scope

- Predictive analytics or unqualified projections.
- AI-generated action plans without operator review and acceptance.
- Full project-management automation, notifications, approvals or scheduling.
- Role-based access control, identity integration or multi-user collaboration.
- Changes to Core's local-first ownership, Explorer bundle contract, publication policy or version axes unless separately authorised by an ADR.

## Priorities and sequencing

| Priority | Capability                             | User value                                                  | Release dependency                                    |
| -------- | -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| P0       | Requirement finder and guided browsing | Lets users locate relevant work without an exact identifier | Existing requirement index and navigation             |
| P0       | Requirement decision and action flow   | Turns status into evidence-backed, accountable work         | Existing requirement, evidence, action and risk links |
| P0       | Save and impact feedback               | Builds confidence that an update had the intended effect    | Existing posture and impact builders                  |
| P1       | Standard mitigation suggestions        | Speeds consistent remediation while preserving judgement    | Curated ISM-aligned guidance                          |
| P1       | Analyst change review                  | Explains material period-over-period change                 | Recorded history and reader-anchored change signals   |
| P1       | CISO accountability view               | Connects exposure, ownership, actions and milestones        | Existing action and relationship data                 |
| P2       | Summary-first Connected View           | Adds contextual relationship understanding without noise    | Shared Connected View renderer                        |

P0 is the next release's minimum usable slice. P1 should follow only where the underlying recorded data can support an explainable result. P2 is a refinement, not a prerequisite for the core workflow.

## Acceptance criteria

The release is ready for role-based validation when:

1. A compliance officer can search by keyword or browse by PSPF Domain and section, open a requirement, add or link evidence and an action, save, and identify the resulting posture or risk effect without leaving the guided journey.
2. An analyst can compare a defined current and previous reporting period, identify material requirement changes, determine their direction, and see the recorded reason and associated action where available.
3. A CISO can identify a material gap, its accountable role or team, the responsible action owner, current milestone status and the relevant trend from one focused oversight view.
4. Advanced controls remain discoverable, but none are required to complete the P0 workflow.
5. All calculations and impact statements remain deterministic and explainable from local records.
6. All modified Explorer, Workshop and Core surfaces preserve offline-first operation, AU-English copy, accessibility and default-deny publication controls.

## Feedback traceability

| Feedback theme                                           | Design response                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Requirement discovery was difficult                      | Common keyword finder plus PSPF Domain and section browsing                        |
| Explorer browsing and Workshop editing felt disconnected | One conceptual journey with consistent search, context and hand-off                |
| Analytics were informational rather than actionable      | Change, rationale, consequence and action context in review views                  |
| Connected View was too noisy                             | Summary-first view with selected-detail disclosure                                 |
| Executive oversight required too much navigation         | CISO review screen centred on gaps, accountability, trends, actions and milestones |
| Advanced features obscured focused work                  | View retirement/demotion, progressive disclosure and one role-neutral default view |
