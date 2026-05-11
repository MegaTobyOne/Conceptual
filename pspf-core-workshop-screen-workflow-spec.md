# PSPF Core and Workshop Screen and Workflow Specification

## Overview

This specification defines the screen model and principal user workflows for **PSPF Core** and **PSPF Workshop** inside Visual Studio Code. It assumes the extension surface model already defined elsewhere: Core is compact and administrative, while Workshop is the primary operational environment for authoring, evidence linkage, action tracking, and reporting preparation. VS Code UX guidance recommends using Tree Views for displaying data, keeping the number of views low, and limiting custom Webview Views to situations where they add real value.

The workflow model should also follow **progressive disclosure**: show the next useful action clearly, keep advanced options secondary, and avoid forcing the user to absorb all structure at once. Progressive disclosure is a well-established way to reduce complexity and error in tools with dense workflows.

## Design principles

### Native VS Code first

The product should feel like a strong VS Code citizen, not a mini web app awkwardly inserted into the editor. This means:

- Tree Views for navigation and queues,
- Quick Picks and small multi-step inputs for short flows,
- Webviews only for richer summary, preview, and compare surfaces,
- and minimal persistent chrome.

VS Code guidance explicitly recommends Tree Views for displaying data, limiting the number of views, and using Quick Picks for small multi-step inputs rather than long wizard flows.

### One primary question per screen

Each screen should answer one main question:

- What is the platform state?
- What requires attention?
- What is this item?
- What should happen next?

This keeps Core and Workshop understandable even as the data model grows.

### Keyboard-first accessibility

Every major action must be reachable without a mouse. VS Code accessibility guidance emphasises keyboard navigation, natural focus order, strong labelling, and not making functionality mouse-only.

## Product roles

### Core

Core is the platform and control plane. It is where the user checks whether the PSPF workspace is healthy, whether integrity is intact, whether migrations are required, and whether snapshots/exports succeeded.

Core should feel **quiet, trustworthy, and diagnostic**. It is not the main place for daily editing.

### Workshop

Workshop is the working surface. It is where the user creates and updates records, links evidence, tracks actions and risks, and prepares reporting outputs.

Workshop should feel **practical, task-oriented, and progressively revealing**. It is the place where the user spends most of their time.

## Information architecture

### Core IA

| Area | Purpose | Screen type |
|---|---|---|
| Health | platform status, trust, compatibility, integrity | Tree View + detail panel |
| Operations | snapshots, export/import, maintenance | Tree View |
| Diagnostics | validation findings and warnings | Tree View / Problems-style list |
| Run detail | rich detail for a snapshot/export/validation | WebviewPanel |

### Workshop IA

| Area | Purpose | Screen type |
|---|---|---|
| Requirements | primary requirement navigator | Tree View |
| Evidence | evidence inventory and freshness | Tree View |
| Actions | remediation work and due items | Tree View |
| Risks | linked risk posture | Tree View |
| Directions | authoritative Directions and response state | Tree View / filtered Requirements mode |
| Summary | current workspace posture and readiness | WebviewView |
| Item detail | rich editable/readable detail for selected record | editor/webview panel |
| Report prep | reporting pack preview and export prep | WebviewPanel |

## Core screens

> **v0.1 implementation note.** v0.1 does not yet ship a unified Core Health Tree View. The information described in this section is surfaced through the discrete commands `PSPF: Validate Workspace`, `PSPF: Verify Integrity`, and `PSPF: Show Writer Lock`. The Tree View arrives in v0.2 — see [pspf-development-readiness-review.md](pspf-development-readiness-review.md) § Remaining readiness risks. References to the Health view elsewhere in this spec carry the same v0.1 deviation.

### 1. Core Health view

**Purpose:** give an at-a-glance answer to “is this workspace safe and usable?”

**Type:** Tree View.

**Sections:**
- Workspace
- Trust
- Schema and compatibility
- Integrity
- Storage
- Last operations

**Example tree structure:**

```text
Workspace
  PSPF workspace detected
  Path: .pspf/
Trust
  Workspace trusted
Schema
  API v1 compatible
  Schema v1.0.0
Integrity
  Last verification: OK
  Last validation: Warning (2)
Storage
  core.db present
  Last backup: 2026-05-09 11:30
Operations
  Last snapshot: Success
  Last Explorer export: Success
```

**Toolbar actions:**
- Refresh
- Validate Workspace
- Verify Integrity
- Create Snapshot

**Interaction notes:**
- Expanding a node reveals concise facts, not paragraphs.
- Selecting an item can open a small detail panel or notification.
- Tree items should not act like disguised buttons; toolbar and context actions should carry the actions. VS Code guidance specifically warns against using tree items as single action items.

### 2. Core Operations view

**Purpose:** show recent operational artefacts and maintenance actions.

**Type:** Tree View.

**Groups:**
- Snapshots
- Exports
- Imports
- Migrations
- Repairs

Each item should show:
- timestamp,
- status,
- target version or bundle type,
- short result summary.

**Context actions:**
- Open details
- Copy ID
- Open file location
- Re-run where safe

### 3. Core Diagnostics screen

**Purpose:** make health findings actionable without turning Core into a wall of logs.

**Type:** either a Tree View subsection or an editor/webview panel opened from Health.

**Content model:**
- severity,
- code,
- object affected,
- message,
- recommended action.

This should feel closer to VS Code’s Problems panel than a custom dashboard.

### 4. Core Run Detail panel

**Purpose:** show the full detail for a snapshot, export, validation, or migration run.

**Type:** WebviewPanel.

**Sections:**
- Summary
- Inputs
- Result
- Findings
- Files produced
- Follow-up actions

Use a WebviewPanel here because a structured narrative result screen with expandable sections is difficult to express cleanly in a tree and worth the richer layout.

## Workshop screens

### 1. Workshop Requirements view

**Purpose:** primary operational navigator for PSPF requirements.

**Type:** Tree View.

**Default grouping:** by domain, then status.

**Alternative grouping modes:**
- by status,
- by reporting period,
- by owner,
- by readiness.

**Tree item structure:**

```text
Security Governance
  In progress
    REQ-001 Governance arrangements are established
    REQ-002 Security roles are assigned
  Needs evidence
    REQ-003 Security planning is documented
Personnel Security
  Effective
  In progress
```

**Item labels should include:**
- short readable title,
- optional status badge,
- optional stale/attention marker.

**Context actions:**
- Open requirement
- Validate
- Link evidence
- Create action
- Reveal linked risks
- Copy ID

VS Code recommends descriptive labels, shallow nesting where possible, and limited actions per item. Keep nesting to two or three levels and no more than about three high-value actions visible at once.

### 2. Workshop Evidence view

**Purpose:** show evidence items and freshness/coverage gaps, with particular focus on old, incomplete, changed, unverified, missing, or unlinked evidence.

**Type:** Tree View.

**Default grouping:** by freshness bucket.

**Suggested groups:**
- Fresh
- Review soon
- Stale
- Changed since review
- Incomplete
- Unlinked

**Domain review mode:**
Evidence review is most often performed at domain level. The view must support grouping or filtering by domain and then by affected requirement. A user should be able to select one domain, see all stale/incomplete/changed evidence that affects that domain, and jump directly to the requirement, evidence item, action, or risk that needs work.

**Context actions:**
- Open evidence
- Link to requirement
- Mark review date
- Reveal linked requirements
- Copy ID

This view is critical because evidence quality is a trust driver. The view should surface stale, incomplete, changed, or unlinked evidence quickly, not bury it. When evidence affects multiple requirements, the view should show the downstream requirement count and affected domains so the user can prioritise review.

### 3. Workshop Actions view

**Purpose:** operational remediation queue.

**Type:** Tree View.

**Default grouping:** by due state.

**Suggested groups:**
- Overdue
- Due soon
- In progress
- Blocked
- Done recently

**Context actions:**
- Open action
- Update status
- Reveal parent requirement
- Reveal linked risk
- Copy ID

### 4. Workshop Risks view

**Purpose:** make risk visible in relation to requirement and action posture without becoming a full GRC platform.

**Type:** Tree View.

**Default grouping:** by severity.

**Suggested groups:**
- High
- Medium
- Low
- Accepted/monitored

**Context actions:**
- Open risk
- Reveal linked requirements
- Reveal linked actions
- Copy ID

### 5. Workshop Summary view

**Purpose:** one compact rich view answering “how are we doing right now?”

**Type:** WebviewView in the sidebar.

**Sections:**
- Overall readiness block
- Requirement status rollup
- Evidence freshness rollup
- Evidence review queue summary
- Open actions block
- Highest-impact actions block
- Top risks block
- Direction response block
- Recent changes block

**Specialist graphics:**
Workshop may reuse simple Explorer-style graphics in Summary and report prep, but its main value is deeper operational interaction. Workshop should therefore provide power-user views for action planning and evidence work, including a grouped action checklist, an action timeline/Gantt view with due dates and milestones, and detailed validation/evidence queues. These views are allowed to be denser than Explorer as long as they remain keyboard-accessible and traceable back to requirement, evidence, action, risk, and Direction records.

**Posture brief:**
The Summary view must be able to produce a simple posture brief suitable for routine reporting: one graphic-ready posture summary, a short text description of overall posture, domain-level posture, Essential Eight posture, and an action plan backed by evidence and data. The brief should cite the data behind its claims using requirement counts, evidence freshness, action state, risk state, and Direction response state rather than unsupported narrative.

**Shareable brief:**
Workshop must let the user create a paste-friendly brief for one requirement, a selected requirement group, a domain, Essential Eight scope, or a Direction. The brief is designed for email or Teams and should be available as copied Markdown/plain text, with an optional HTML clipboard representation where the platform supports it. It must include the selected scope, current assessment/posture, work required, highest-impact actions, evidence basis, known blockers/risks, owners as role/team labels where export policy allows, and a generated-at timestamp. It must omit or redact fields that are not allowed by the active publication/export policy.

**Primary actions:**
- Open Requirement Queue
- Review Evidence
- Copy Shareable Brief
- Prepare Report Pack
- Export Explorer Bundle

This is one of the few places where a WebviewView is justified because it benefits from cards, small charts or progress blocks, and richer visual hierarchy than a tree can provide.

### 6. Item Detail screen

**Purpose:** show and edit a single requirement, evidence item, action, risk, or Direction.

**Type:** WebviewPanel (one panel per entity type, opened by `pspf.workshop.openItemDetail`). See [adr/0015-item-detail-webview-panel.md](adr/0015-item-detail-webview-panel.md) for the rationale and the v1 contract; a custom editor is explicitly not introduced.

**Shared screen structure:**
- Header: title, ID, status, quick actions
- Main content: fields and narrative details
- Relationship rail: linked evidence/actions/risks/Directions
- Validation rail: warnings, readiness, missing fields
- Activity section: recent changes or last update metadata

**Rule:** do not overload the detail screen. Use tabs or accordion sections only if necessary, and keep the default section focused on the primary editing task.

## Workflow model

### Workflow philosophy

Short flows should use **Quick Picks** or compact multi-step input. VS Code guidance recommends multi-step Quick Picks for a short series of related inputs, but not for long wizard-like flows.

Longer or denser tasks should open a richer detail panel instead of trying to force the whole task into a Quick Pick chain.

## Core workflows

### Workflow C1 — First workspace open

**Goal:** determine whether a PSPF workspace exists and whether Core is ready.

**Entry points:**
- workspace activation,
- Core Health view,
- command palette.

**Flow:**
1. Detect `.pspf/` markers.
2. If missing, show welcome state with `Initialise PSPF Workspace`.
3. If present, run lightweight bootstrap check.
4. Populate Health view.
5. If warnings exist, surface the most important one at top of Health.

**Success state:** Health shows trusted/usable state.

**Failure state:** user sees one clear next action, for example `Run Migration` or `Restore from Backup`.

### Workflow C2 — Validate workspace

**Goal:** run integrity and validation checks on demand.

**Entry points:**
- Health toolbar,
- command palette,
- post-restore follow-up.

**Flow:**
1. User invokes `Validate Workspace`.
2. Small progress notification appears.
3. Health and Diagnostics update.
4. If no issues, show concise success.
5. If issues exist, open Diagnostics summary with grouped findings.

### Workflow C3 — Create snapshot

**Goal:** create an immutable checkpoint before riskier actions.

**Input model:** Quick Pick multi-step flow.

**Suggested steps:**
1. Choose snapshot type (`checkpoint`, `reporting`, `backup`, `pre-migration`).
2. Enter title.
3. Optional note.
4. Confirm.

This fits a compact multi-step Quick Pick flow because it is a short set of structured inputs.

### Workflow C4 — Export Explorer bundle

**Goal:** create a static Explorer bundle suitable for GitHub Pages publication.

**Entry points:**
- Core Operations view,
- Workshop Summary action,
- command palette.

**Flow:**
1. Open export flow.
2. Choose export profile.
3. Choose snapshot or current state.
4. Run export.
5. Show Run Detail panel with output path, manifest version, hash summary, warnings.

## Workshop workflows

### Workflow W1 — Create requirement

**Goal:** quickly create a new requirement record without forcing a heavy form immediately.

**Entry points:**
- Requirements view toolbar,
- welcome state,
- command palette.

**Step 1: Quick creation flow**
Use a small multi-step Quick Pick/input flow:
1. Choose domain.
2. Enter short title.
3. Choose initial status.
4. Confirm create.

**Step 2: Open detail screen**
After creation, open the item detail screen for richer edits.

This uses progressive disclosure well: short creation first, deeper editing second.

### Workflow W2 — Link evidence to requirement

**Goal:** reduce friction from requirement posture to supporting evidence.

**Entry points:**
- requirement context menu,
- evidence context menu,
- requirement detail screen.

**Preferred flow:**
1. User selects `Link Evidence` from a requirement.
2. Quick Pick opens with existing evidence items, showing label, freshness, and short description.
3. User can either choose an existing item or `Create new evidence`.
4. After selection, link is created.
5. Requirement detail and Evidence view refresh.

VS Code Quick Pick guidance explicitly supports offering a “create new” option when picking from a list, which suits this flow well.

### Workflow W3 — Create action from gap

**Goal:** turn a missing evidence or weak requirement into a concrete remediation action.

**Entry points:**
- requirement context menu,
- validation warning action,
- summary view “needs attention” card.

**Flow:**
1. Start from requirement or warning.
2. Quick flow captures action title, owner, due bucket, priority.
3. Action opens in detail screen for notes and relationship review.
4. Requirement receives linked action badge.

### Workflow W4 — Review evidence currency and completeness

**Goal:** work through old, incomplete, changed, unverified, missing, or unlinked evidence efficiently.

**Entry points:**
- Summary view card,
- Evidence tree review groups,
- domain filter,
- Requirement detail evidence tab,
- command palette.

**Flow:**
1. Open Evidence view focused on a domain or selected requirement set.
2. Apply review filters such as `stale`, `incomplete`, `changed`, `unverified`, `missing`, or `unlinked`.
3. Sort by downstream impact, affected requirement count, or last reviewed date.
4. Open the evidence detail panel with review dates, source-change information, linked requirements, linked actions, linked risks, and notes.
5. Update evidence metadata, link evidence, record an assessment change, or create an action.
6. Move to the next evidence item using keyboard.

This workflow should be optimised for repeated queue processing, not rich one-off reading.

### Workflow W5 — Assess requirement and record evidence

**Goal:** find a PSPF requirement or group, review the requirement text, guidance, related links, and evidence, then record the current assessment and supporting evidence.

**Entry points:**
- Requirements tree by domain/status/readiness,
- Summary view posture or gap card,
- Evidence review queue,
- global search,
- command palette.

**Flow:**
1. Search, browse, or filter to a requirement or requirement group.
2. Open Requirement Detail and review statement, implementation guidance, source authority, current assessment, rationale, linked evidence, linked actions, linked risks, Directions, and history.
3. Update `assessmentStatus`, `effectiveness`, `evidenceStatus`, `reportingReadiness`, and rationale as needed.
4. Link existing evidence or create new evidence from the detail screen.
5. Run validation for the requirement.
6. Summary, Requirements, Evidence, Actions, and Risks views refresh from Core events.
7. The posture brief and action-impact ranking update to reflect the change.

**Success state:** the user can see what changed in the requirement, how that affects overall/domain/Essential Eight posture, and which actions now have the greatest likely positive impact.

### Workflow W6 — Create action from impact ranking

**Goal:** identify and act on the work most likely to improve compliance posture.

**Entry points:**
- Summary view highest-impact actions block,
- Requirement detail validation rail,
- Evidence review queue,
- Report prep blockers,
- Actions view.

**Flow:**
1. Open the action-impact ranking for overall posture, a domain, Essential Eight, a Direction, or a single requirement.
2. Review the explanation for each ranked action, including affected requirements, stale or missing evidence, readiness blockers, linked risks, and Direction response gaps.
3. Open an existing action or create a new one from the gap.
4. Link the action to the affected requirement, Direction, risk, evidence, or spend item.
5. Update status, priority, owner, due date, and expected outcome.

**Success state:** actions are ranked by explainable positive impact, not just urgency, and the user can trace each recommendation back to data and evidence.

### Workflow W7 — Share work required for requirement delivery

**Goal:** answer “what work is required to deliver this requirement or group?” in a form that can be emailed or pasted into Teams.

**Entry points:**
- Requirement detail,
- Requirements tree group,
- Summary view highest-impact actions block,
- Report prep panel,
- command palette.

**Flow:**
1. User selects a requirement, multiple requirements, a domain, Essential Eight scope, or a Direction.
2. User invokes `Copy Shareable Brief`.
3. Workshop previews a compact brief with current assessment, evidence state, required work, highest-impact actions, blockers, risks, and traceability links/IDs.
4. User chooses the copy format: plain text, Markdown, or HTML clipboard where supported.
5. Workshop applies the active redaction/export policy and copies the generated brief.

**Success state:** the pasted content is readable in email and Teams, keeps enough IDs and links for follow-up, and does not expose restricted or unapproved sensitive fields.

### Workflow W8 — Add and assess Direction

**Goal:** add a new authoritative Direction, understand its affected PSPF requirements, assess the organisation's response, and manage evidence/actions like a requirement.

**Entry points:**
- command palette,
- Directions view,
- Requirement detail linked-items rail.

**Flow:**
1. Create Direction with reference, title, issued date, source authority, source reference, and description.
2. Link affected requirements and domains using pickers.
3. Review linked requirements, guidance, existing evidence, risks, and actions.
4. Record response state: `not-set`, `yes`, `no`, or `risk-managed`.
5. Add rationale, link evidence, and create actions or risks as needed.
6. Direction response summary, posture brief, and action-impact ranking refresh.

**Success state:** a Direction can be governed with the same discipline as a requirement while preserving its distinct response-state model.

### Workflow W9 — Prepare report pack

**Goal:** convert operational state into a reporting-ready view.

**Entry points:**
- Summary view,
- command palette,
- selected reporting period.

**Flow:**
1. User chooses reporting period/profile.
2. System builds readiness summary.
3. Report Prep WebviewPanel opens with:
    - readiness overview,
    - posture brief for overall, domain, and Essential Eight,
    - missing evidence items,
    - open blockers,
    - highest-impact action plan,
    - top risks,
    - shareable brief preview/copy controls,
    - export options.
4. User either exports or navigates back to fix blockers.

This is intentionally not a full-screen editor first; it should feel like a structured review and launch point.

## Navigation model

### Primary navigation

The user should mostly navigate by:
- Tree View selection,
- Command Palette,
- context menus,
- and a few toolbar actions.

### Secondary navigation

Use inline links/buttons within summary or detail panels to:
- reveal an item in a tree,
- open a linked entity,
- jump from warning to fix location,
- jump from summary card to queue.

### Reveal pattern

Every detail screen should support:
- `Reveal in Requirements/Evidence/Actions/Risks View`
- `Copy ID`
- `Open Linked Items`

This keeps the graph navigable and reduces the feeling of being trapped inside a panel.

## Empty states

Welcome or empty states should be used sparingly and only when helpful. VS Code guidance recommends keeping Welcome views short and action-oriented, using links where possible and buttons only for primary actions.

### Core empty states

- No PSPF workspace detected.
- PSPF workspace present but Core not initialised.
- No snapshots or exports yet.

### Workshop empty states

- No requirements yet.
- No evidence linked yet.
- No actions created.
- No risks recorded.

Each empty state should answer:
- what this area is for,
- why it is empty,
- and what the primary first action is.

## Notifications and feedback

### Use notifications for

- completion of long operations,
- failed validations,
- export success/failure,
- backup/restore reminders if later introduced.

### Do not use notifications for

- every small create/update action,
- passive state changes already visible in a view,
- or repeated warnings that can live in Health/Summary.

The user should not be trained to ignore PSPF notifications.

## Accessibility requirements

Every screen and workflow must support keyboard-first use. VS Code accessibility guidance stresses tab and arrow navigation, natural focus movement, and ensuring actionable elements are reachable without a mouse.

### Specific requirements

- Tree items navigable by keyboard.
- Toolbar actions reachable by keyboard.
- Webview controls with labels and logical tab order.
- No critical action hidden behind hover-only UI.
- Focus returned sensibly after dialog/quick-pick completion.
- High contrast and theme-aware colours in webviews.

VS Code also notes that Webviews are separate focus regions and users may navigate to and from them with F6 and Shift+F6, so webview screens should be designed to behave predictably in that context.

## Screen density and complexity rules

### Core

- Low density.
- High trust.
- Minimal editing.
- Diagnostics over decoration.

### Workshop

- Moderate density.
- Queue-first design.
- Rich detail only when entering an item.
- Summary view limited to the most actionable aggregates.

### Avoid

- too many cards in the Summary view,
- deep nesting in trees,
- long multi-step wizards in Quick Pick,
- duplicating the same information in tree, detail, and summary all at once.

## MVP screen set

### Core MVP

- Health view
- Operations view
- Diagnostics panel
- Snapshot quick flow
- Export run detail panel

### Workshop MVP

- Requirements view
- Evidence view
- Actions view
- Summary webview
- Requirement detail panel
- Evidence linking quick flow
- Report prep panel

## Future but not now

Out of scope for the first build:
- side-by-side diff of snapshots,
- drag-and-drop graph editing,
- embedded Explorer inside VS Code,
- custom editor for every entity type,
- collaborative/multi-user workflow screens,
- advanced analytics dashboards.

## Specification summary

Core and Workshop should behave like a native VS Code operational suite: Tree Views for navigation and queues, Quick Picks for short structured flows, and a small number of focused Webviews for summary and report preparation. VS Code UX guidance strongly supports this approach by recommending Tree Views for data display, limiting custom Webviews, and using concise view structures with minimal clutter.

The workflow design should rely on progressive disclosure so users see a clear next step without being forced into large forms or dashboards too early. That makes Workshop practical for daily use and keeps Core quiet and trustworthy as the platform control plane.
