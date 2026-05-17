# 12-Month Cyber Plan Application Specification

## Purpose
This specification captures the discussion outcomes, decisions, and agreed direction for a simplified application that helps articulate, manage, and evolve a 12-month cyber plan.

The application is intended to help a cyber leader present a credible, structured, and durable plan for the next 12 months, while making change visible when priorities shift or when strategic rationale changes over time.

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
The application should be able to distinguish between users who can edit, review, or only view the plan.

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

| Entity | Purpose |
|---|---|
| Plan | The overall 12-month cyber plan |
| Goal | A strategic objective for the planning period |
| Initiative | A work item or project contributing to a goal |
| Milestone | A key point in time or deliverable |
| Metric | A measure used to assess progress or outcome |
| Resource | People, budget, capability, or tooling required |
| Risk | A blocker, issue, or uncertainty affecting delivery |
| Change Record | A significant plan change with rationale and impact |
| Dependency | A linkage that affects sequencing or execution |
| Note / Decision | Supporting context or rationale |

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
The planning capability is important enough to treat as a distinct product candidate in the PSPF ecosystem, provided it reuses the same local-first trust model and master JSON exchange pattern rather than introducing a separate backend, authentication model, or multi-user workflow engine.

The capability should be split into three groups.

### 1. Enhancements to Existing PSPF Products
These features strengthen current or already-planned PSPF surfaces without requiring a separate planning application.

| Feature | Best home | Rationale |
|---|---|---|
| Significant change visibility | Workshop and Explorer | Workshop should record accepted changes; Explorer should present the change story for review and briefing. |
| Change rationale and impact | Workshop Item Detail, Reporting, and Explorer detail views | Rationale and impact are assurance context, not project-management overhead. They should explain why PSPF posture, actions, risks, or Directions changed. |
| Persistent impact over time | Snapshots, Reporting, and Explorer trend/briefing views | The existing snapshot/export model can show what changed between points in time. |
| Stakeholder-ready summaries | Explorer and shared posture brief | Explorer is already the presentation-ready and portable review surface. |
| Filtering by planning theme or priority | Tags and Saved Views | Current tag and saved-view features can express annual priorities, executive commitments, campaigns, or reporting cohorts. |
| Initiative-style action grouping | Workshop Actions and Explorer Actions | Existing Actions can represent many plan initiatives when linked to Requirements, Risks, Directions, Evidence, and Tags. |
| Risk and constraint visibility | Existing Risk surfaces | Planning risk should reuse the canonical Risk entity unless a later ADR identifies a distinct planning-risk need. |

### 2. Candidate New Product: PSPF Plan
The remaining planning functions are coherent enough to consider as a new PSPF product surface. A working name is **PSPF Plan**.

PSPF Plan would be a focused 12-month cyber planning application that sits beside Workshop, Shop, Pub, and Explorer. It should not replace Workshop as the assurance system of record. Its role would be to help cyber leaders shape, explain, and maintain a credible forward plan that remains traceable to PSPF assurance data.

PSPF Plan should use the same master JSON bundle exchange approach as Explorer, with generator metadata distinguishing planning exports from publication, local-authoring, work-import, or GRC-capture flows. It should round-trip through Core/Workshop where records affect canonical PSPF data.

Candidate PSPF Plan-owned capabilities:

| Capability | Notes |
|---|---|
| 12-month plan overview | A leadership-readable plan shape showing goals, initiatives, milestones, risks, indicators, and notable changes. |
| Plan goals and objectives | Planning goals may not always be PSPF Requirements. They should link to Requirements, Actions, Risks, Directions, Tags, or Saved Views where relevant. |
| Initiative planning | Initiatives can start as planning records, then materialise as canonical Actions when accepted into Workshop. |
| Milestone timeline | A simple timeline for plan commitments, checkpoints, and decision dates. This should remain lighter than PMO scheduling. |
| Metrics and indicators | A focused planning indicator set, ideally derived from existing posture, evidence, action, and risk data where possible. |
| Resource assumptions | Lightweight capacity, budget, tooling, and capability assumptions. Detailed supplier, contract, spend, people, role, and assignment management should remain with Shop and Pub when those products are in scope. |
| Significant change log | The core differentiator: record what changed, why, what it affected, whether the impact is temporary or persistent, and when it should be reviewed. |
| Plan baseline and re-baseline | Support explicit planning baselines and intentional re-baselining when persistent changes become the accepted plan. |
| Planning bundle export/import | Export and import planning data through the master bundle contract, with plan-review-apply behaviour for any canonical PSPF records produced by the plan. |

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
A minimum viable version of the application should include:
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
