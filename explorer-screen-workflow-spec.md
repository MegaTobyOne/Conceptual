# Explorer Screen and Workflow Specification

## Purpose

This specification defines the screen model, information architecture, navigation, and user workflows for **PSPF Explorer**, the static web app that operates in two modes simultaneously (see ADR 0004):

1. **Publication mode** — consumes a curated, redacted JSON bundle as a read-only baseline, providing exploration, drill-down, and reporting across PSPF data.
2. **Local authoring mode** — lets a user mark requirements with statuses, capture short notes, record evidence references, and capture lightweight actions and risks. All local edits live in the user's browser via `IndexedDB` and can be exported as a JSON bundle that conforms to the bundle schema.

Explorer remains intentionally distinct from Core and Workshop. It is not the system of record, not a multi-user workflow engine, and not a synchronisation hub. Local edits are per-origin, per-browser, and ephemeral unless exported.

### Experimental notice

Explorer's local-authoring mode is **experimental in v1**. Every page surfaces a clear, persistent banner:

> Explorer is experimental. Do not rely on it as a system of record. Export your work to a JSON file regularly.

The design follows an inverted-pyramid dashboard structure: high-level signal first, then drill-down into domains, requirements, evidence, actions, and linked detail.

## Product role

Explorer is the **portable lens and lightweight authoring surface** of the PSPF ecosystem.

It must:
- open quickly from a static host such as GitHub Pages,
- load a curated JSON bundle, not a live Core API,
- support scanning, filtering, and drill-down from summary to detail,
- support local edits in `IndexedDB` with clear visual separation from the read-only baseline,
- support JSON import (seed Explorer with richer data) and JSON export (round-trip back to Core/Workshop),
- remain usable with keyboard navigation, zoom, and accessible alternatives to charts,
- and feel trustworthy and presentation-ready for internal sharing.

It must not:
- mutate the loaded bundle baseline,
- require authentication in v1,
- depend on any backend service or third-party tracker,
- collect or display Person `name` or `email` fields (these are excluded from bundles by the publication policy),
- or hide critical information behind visually complex interactions.

## Modes and visual separation

Explorer always shows the user which mode is active for any given piece of data:

- **Bundle baseline** — rendered with a neutral surface and no edit affordances. The data badge reads `from bundle`.
- **Local edits** — rendered with a distinct accent border or background tint. The data badge reads `local`. Local-edit values overlay the baseline value when both exist; the baseline remains visible behind a small `was: …` annotation.
- **Conflict** — when an imported bundle changes a baseline value the user has overridden locally, the cell shows both, with the user's local value preferred and the new baseline value annotated `bundle update available`.

A persistent toolbar exposes:

- **Import JSON** — load a master bundle (per ADR 0009) for any flow: publication baseline, full restore, additive share merge, GRC capture, or risk/action work import. The flow is determined by the bundle's `intent` and `generator.mode`, not by separate file types.
- **Export JSON** — emit a master bundle. The user picks the **scope** (full local-authoring snapshot, or a chosen subset of collections to share), not the format.
- **Reset local data** — destructive; requires confirmation; offers `Export first` shortcut.
- **Storage status** — shows `IndexedDB` usage; warns when usage exceeds 60% of the browser's quota estimate.

There is **one master bundle format** for every Explorer data exchange. The standalone prototype's four format tags (`pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport`) are retired in the rewrite; their behaviour survives as configuration of the master bundle. See ADR 0009 and `pspf-explorer-json-bundle-schema-spec.md`.

## Local storage model

- All local edits are stored in `IndexedDB` under a single origin-scoped database.
- Schema: one object store per entity collection, plus a `local-edits` overlay store keyed by entity ID with field-level diffs.
- No `localStorage` is used for data (it is too small).
- The browser's `StorageManager.estimate()` is consulted on app start and after each save; usage above 60% triggers a non-blocking warning, usage above 85% blocks new edits and prompts export.
- Clearing site data wipes local edits irrecoverably; the experimental banner makes this explicit.

## Privacy and data residency

Explorer never sends data to a network endpoint. The CSP (`pspf-invariants.md` § S4) forbids inline script and third-party origins. Local edits remain in the user's browser. JSON exports go to disk via the browser's download mechanism.

Explorer does not collect Person `name`, Person `email`, or Assignment `personId`. Any imported bundle that contains those fields is rejected with a clear error; this is an enforced property of the round-trip flow.

## Design principles

### 1. Summary first

The landing experience should answer:
- What is the overall posture?
- Where are the main gaps?
- What needs attention first?
- How ready is this workspace for reporting?

A user should get those answers in one screenful wherever possible, with deeper context available through progressive drill-down.

### 2. Drill-down, not labyrinth

Explorer should move from broad to narrow:
1. Global posture
2. Domain / category
3. Requirement or issue list
4. Item detail
5. Linked evidence, actions, risks, and related objects

The user should never have to guess where to go next. Every detail page must show both the current object and its most relevant linked objects.

### 3. Static but alive

Even though Explorer is static, it should feel responsive and interactive:
- filters update immediately
- URL state reflects current view
- tables and charts stay in sync
- drill-down preserves context
- empty and no-match states explain what happened

### 4. Accessible by default

Explorer must support:
- full keyboard navigation across filters, tabs, tables, and chart alternatives,
- zoom to at least 200% without layout breakage, with preference toward 400% tolerance where practical,
- chart alternatives through summary text and underlying data tables,
- clear focus order and visible focus states,
- minimal horizontal scrolling, especially on primary pages.

Accessibility is enforced by automated `axe-core` checks in CI on every Explorer build (see `pspf-acceptance-and-quality-gates.md`).

### 5. Few concepts, repeated well

Explorer should avoid bespoke patterns per page. It should reuse a small set of screen primitives:
- page header
- filter bar
- KPI strip
- summary card
- chart block
- tabular list
- detail panel / detail page
- linked-items block
- download/export block

## Information architecture

Explorer should use a small, stable top-level navigation set.

### Primary navigation

1. Overview
2. Requirements
3. Evidence
4. Actions
5. Risks
6. Directions
7. Posture
8. Essential Eight
9. Relationships (Board)
10. Reporting
11. Data / About

Tags are a filter affordance on Requirements (and on the Relationships Board) per [adr/0041-v1-7-tags-and-filters-foundation.md](adr/0041-v1-7-tags-and-filters-foundation.md); tag management is reached from Workshop. Saved views are the durable filter surface per [adr/0042-v1-8-saved-views.md](adr/0042-v1-8-saved-views.md), later expanded to Workshop planning scopes and `workshop-source-controls` ISM posture views.

### Secondary navigation behaviour

Secondary navigation is contextual within pages, not global.

Examples:
- Overview tabs: Posture, Coverage, Attention, Trend
- Requirement detail tabs: Summary, Evidence, Actions, Risks, History
- Reporting tabs: Readiness, Gaps, Domain Packs, Exports

### Global header

The top header should include:
- Explorer name / suite branding
- workspace title
- bundle version / export timestamp
- primary navigation
- global search
- theme toggle
- data freshness indicator

## Screen catalogue

### 1. Overview screen

**Purpose:** Give the top-level posture view.

**Primary content:**
- workspace title and reporting period
- KPI strip with 5–7 primary indicators to avoid overload.
- compliance status donut showing requirement count by compliance state and distance from 100% met
- domain posture chart or heatmap
- “needs attention” list
- reporting readiness summary
- latest snapshot / bundle metadata

**Recommended KPIs:**
- total requirements
- effectively implemented / compliant count
- partial / at-risk count
- evidence coverage percentage
- overdue actions
- high-priority risks
- reporting readiness percentage

**Visual structure:**
- top: KPI strip
- middle left: posture by domain
- middle right: issues needing attention
- bottom: quick links into requirements, evidence, actions, reporting

**Interactions:**
- compliance donut segments filter Requirements by status; centre label shows met percentage and remaining count to 100% met
- clicking a domain heat cell filters Requirements screen
- clicking a KPI opens a pre-filtered list page
- “View reporting gaps” moves to Reporting screen with readiness filter applied

### 2. Requirements screen

**Purpose:** Browse and filter PSPF requirements.

**Primary content:**
- filter bar
- requirements table/list
- optional summary chips above table

**Default columns:**
- requirement ID
- short title
- domain
- status
- confidence / assurance level
- evidence count
- action count
- risk count
- last updated

**Filters:**
- domain
- status
- assurance/confidence
- evidence coverage
- linked action state
- linked risk severity
- tag (multi-select; `any` / `all` toggle; URL `tags=...&tagsMode=any|all`; see ADR 0041 and `pspf-invariants.md` § T4)
- text search
- saved view (v1.8; named Requirements filter snapshot; see ADR 0042)

**Interactions:**
- row click opens Requirement Detail
- sort by status, title, last updated, evidence count
- bulk export of visible filtered data (CSV / JSON)

### 3. Requirement detail screen

**Purpose:** Explain one requirement and its connected operational story.

**Layout:**
- title block with requirement ID, name, domain, status, confidence, updated time
- short narrative summary
- tab set

**Tabs:**
- Summary
- Evidence
- Actions
- Risks
- Links / Related
- History (if exported in bundle)

**Required content:**
- concise statement of current posture
- rationale / notes if included in bundle
- all linked evidence with freshness cues
- all linked actions with state and due date
- all linked risks with severity and treatment state
- adjacent navigation: previous/next requirement in current filtered set

### 4. Evidence screen

**Purpose:** Review evidence assets, gaps, and freshness.

**Primary content:**
- evidence coverage summary
- stale / missing evidence indicators
- incomplete / changed / unverified evidence indicators
- searchable evidence list

**Default columns:**
- evidence ID
- title
- type
- source
- freshness state
- linked requirements count
- linked actions count
- last reviewed

**Filters:**
- domain
- affected requirement
- freshness (current / ageing / stale / expired / unknown)
- review state (old / incomplete / changed / unverified / missing / unlinked)
- evidence type
- source system
- linked requirement domain
- orphaned / linked state

**Drill-down:**
Evidence detail should show the evidence item plus linked requirements, actions, risks, and Directions.

**Review mode:**
Evidence review should support domain-level work first, with optional narrowing to one or more requirements. Sorting by downstream impact must consider linked requirement count, affected domain posture, reporting blockers, stale/changed state, and linked action/risk dependency.

### 5. Actions screen

**Purpose:** Show remediation and follow-through.

**Primary content:**
- action summary strip
- grouped checklist by domain, status, owner, or linked requirement
- simple timeline showing due dates, overdue items, and milestones
- overdue / due soon section
- action list

**Default columns:**
- action ID
- title
- status
- priority
- owner
- due date
- linked requirement count
- linked risk count

**Filters:**
- status
- priority
- due window
- owner
- linked domain
- overdue only

**Interactions:**
- clicking an overdue count opens filtered overdue list
- clicking a checklist group or timeline band filters the action list
- action detail shows source gap, linked requirement(s), evidence need, and linked risks

### 6. Risks screen

**Purpose:** Surface risk concentrations and traceability.

**Primary content:**
- risk summary strip
- severity distribution
- impact/likelihood matrix with risk count by cell
- open / untreated risks list
- links to affected requirements and actions

**Default columns:**
- risk ID
- title
- severity
- status
- treatment state
- linked requirements
- linked actions
- updated time

**Filters:**
- severity
- status
- treatment state
- domain
- unresolved only

**Note:**
Avoid over-complex heatmaps unless the data density genuinely supports them. A clear table plus compact severity summary is often more usable than an elaborate matrix.

The impact/likelihood matrix is acceptable because it is a familiar risk view. Explorer should keep it simple: count bubbles or small cell totals, keyboard-reachable cells, and a table alternative. Detailed treatment planning and multi-factor risk analysis belong in the dedicated risk module.

### 7. Reporting screen

**Purpose:** Support annual reporting preparation and executive review.

**Primary content:**
- reporting readiness KPI
- requirements blocked from reporting
- missing evidence summary
- unresolved issues affecting confidence
- domain-by-domain reporting status
- export/download area

**Tabs:**
- Readiness
- Domain status
- Gaps
- Reporting pack
- Bundle info

**Key outputs:**
- list of requirements not report-ready
- grouped reasons: missing evidence, unresolved action, low confidence, unresolved risk, missing rationale
- domain summary cards suitable for executive discussion
- downloadable filtered data

### 8. Search results screen

**Purpose:** Provide cross-object discovery from the global search box.

**Content:**
- search term summary
- grouped result tabs: Requirements, Evidence, Actions, Risks
- ranking based on direct title/code matches first, then secondary fields

**Behaviour:**
- preserve query in URL
- allow filter refinement after search
- clearly distinguish “no results” from “data still loading”

### 9. Data / About screen

**Purpose:** Build trust in the bundle and app.

**Content:**
- bundle manifest details
- export timestamp
- schema version
- source workspace metadata allowed by export profile
- counts by entity type
- redaction profile statement
- integrity / hash information if exposed
- help text explaining Explorer is read-only

This screen matters because users need to know what they are looking at, how fresh it is, and what may have been intentionally omitted from the bundle.

### 10. Directions screen

**Purpose:** Track Home Affairs Directions and the organisation's response.

A Direction is registered with a reference, title, issued date, optional description, and the affected requirement IDs. Users record a response state and attach evidence or notes.

**Response state set:** `not-set` (default) → `yes` | `no` | `risk-managed`. The set intentionally excludes `not-applicable` (a Direction always applies once registered). This differs from the requirement compliance set; the difference is deliberate.

**Assessment model:**
Directions are managed like requirement overlays. Direction detail must show source text, implementation guidance or local interpretation, affected requirements/domains, response state, rationale, linked evidence, linked actions, linked risks, and history. A Direction can contribute to evidence review queues, action-impact rankings, posture summaries, and reporting blockers.

**Summary surfaces:** total Directions, count needing response, addressed %, breakdown by response state, missing evidence count, open action count, filter by response state/domain/affected requirement.

### 11. Posture screen

**Purpose:** Set and review the global threat level and defensive posture.

- Global **threat level** ∈ `{ low, elevated, high, critical }`.
- Global **posture** ∈ `{ standard, shields-up, active-defence }`.
- Optional **per-domain overrides** for either; an `(inherit)` option clears the override and reads through to the global setting at display time.
- Each setting carries a `lastUpdatedAt` timestamp.

The Posture record is a singleton in local storage. Per-domain overrides persist only the fields the user changes.

### 12. Essential Eight screen

**Purpose:** Report on the Essential Eight subset specifically.

- Reports the eight individual controls plus a documented catchall slot, each with its current implementation state and target maturity level (1–4).
- Reports an aggregate "implemented %" using the same exclusion rule as overall compliance (Not-applicable is excluded from numerator and denominator).
- Drill-through to the underlying requirement(s) and evidence.

The exact requirement-ID assignment of the eight controls is data-driven from the published catalogue. The screen behaviour does not hard-code which IDs are which control.

### 13. Relationships (Board) screen

**Purpose:** Triage "what should I work on next?" by laying out requirements, risks, actions, and Directions in a small set of curated columns.

The primary (and only v1) relationship surface is a **column board**, not a network graph. The board is keyboard-native, motion-free, screen-reader friendly, and answers the operational question more directly than a force-directed view. The prototype's network-graph surface is **deferred** to a later phase; see ADR 0010.

**Lanes (v1 default set):**

1. **Gaps without work** — requirements where compliance is `no` or `risk-managed` and there is no linked action and no linked risk.
2. **Gaps with action in flight** — requirements with compliance `no` or `risk-managed` linked to at least one action whose status is `open`, `in-progress`, or `blocked`.
3. **Blocked or overdue** — actions where status is `blocked`, or the overdue rule (E4) is true.
4. **Open risks by band** — risks with status `open`, grouped by band (Extreme → High → Medium → Low) within the lane.
5. **Directions awaiting response** — Directions where response state is `not-set`.
6. **Recently changed** — any entity whose `updatedAt` falls in the last 14 days, newest first.

The lane set is data-driven so it can evolve without a rebuild; v1 ships exactly these six.

**Card content (kind-specific):**

- Requirement card: ID, short title, domain, compliance state badge, link counts (risks, actions, Directions).
- Action card: ID, title, status badge, due date with overdue marker, linked requirement count.
- Risk card: ID, title, band badge, status badge, linked requirement / action counts.
- Direction card: reference, title, response-state badge, affected-requirement count.

**Filters (shared with the rest of Explorer):** compliance state, risk band, risk status, action status, action-overdue-only, direction-response state, domain, tag, free-text search. Filter changes update lane membership in place; URL reflects the active filter set.

**Interaction:**

- Selecting a card opens a side **inspector panel** showing the entity and its connected chain (linked entities of every kind, one click to navigate to any of them).
- Keyboard: ←/→ moves between lanes, ↑/↓ moves within a lane, Enter opens the inspector, Esc closes it.
- Empty lane: shows a non-empty empty state explaining the lane's rule.

**Summary panel above the lanes:** requirements count, gaps with/without work, blocked-or-overdue action count, Directions needing response. Same numbers used elsewhere in Explorer; consistent by construction.

**Action Impact lane support:**
The Board must be able to sort or filter cards by Action Impact for the current scope: overall, domain, Essential Eight, Direction, or requirement. Each ranked action exposes an explanation list rather than only a number, including affected requirements, stale/missing evidence, readiness blockers, linked risks, and Direction response gaps.

**Accessibility:** the board is keyboard-operable end to end and does not rely on motion. Reduced-motion preference is automatically honoured because there is no animation to suppress.

### 14. Integrity scan screen

**Purpose:** Surface inconsistencies in user-authored data.

- Detects orphan refs (dangling requirement/risk/action/direction IDs from any record), orphan-link relationship endpoints, self-loop relationships, and duplicate titles within risks / actions / direction references (case- and whitespace-insensitive).
- Output: scanned-at timestamp, total records scanned, total issues, typed issue rows (`kind`, `entity`, `id`, `message`).
- The scan MUST run off the main thread (browser worker) so the UI remains responsive on full datasets.
- The integrity report is held only in view state and is never persisted.

The scan **reports**; it never auto-repairs. Repair is always a user action.

### 15. Command palette

**Purpose:** Keyboard-first navigation across every screen.

- Opens with **Cmd/Ctrl+K** from any screen.
- Lists every navigation route plus a small set of synthetic actions (e.g. "Export bundle", "Run integrity scan").
- Filters by substring on label or path; ↑/↓ to move, Enter to invoke, Esc to close.
- The palette is the keyboard equivalent of every primary navigation entry; it is not the only path.

### 16. Per-requirement work-tracking notes

**Purpose:** Lightweight per-requirement journaling without ceremony.

- A user can append free-text notes to any requirement, optionally with an effort string (e.g. `"2h"`, `"half day"`).
- Entries are append-only and timestamped. They are not links and do not create relationships.
- Surfaces as a "Work log" panel inside Requirement Detail.

### 17. Plan-then-apply work import workflow

**Purpose:** Bring risks and actions in from another tool without surprises.

When the user imports a master bundle whose `intent` is `plan-apply`, Explorer MUST:

1. Validate the bundle against the master schema; reject unknown top-level or per-entry fields outright.
2. Materialise a **plan**, classifying each row as either an addition (no `id`, or `id` not found) or an update (matched by `id`). The plan is reviewable inline (per-row checkboxes, bulk select, edit before apply).
3. Honour optional **status normalisation** (`strict` rejects unknown statuses, `map-common` applies a built-in alias map plus optional user overrides, `force` overrides every status to a fixed value).
4. Honour optional **link mode** (`as-provided` keeps incoming links after dedupe and orphan-filtering, `rebuild-bidirectional` rebuilds risk⇄action references symmetrically).
5. Honour optional **update mode** (`replace-all` clears stored values omitted from the incoming row; `patch` preserves existing values for omitted fields).
6. Apply only the rows the user confirms. Validation alone makes no writes.

## Shared screen primitives

### Filter bar

A reusable filter bar should appear on Requirements, Evidence, Actions, Risks, and Reporting.

Rules:
- primary filters visible by default
- advanced filters behind an “More filters” disclosure
- active filters shown as removable chips
- clear-all action always available
- filter changes reflected in URL query parameters

### KPI strip

Rules:
- maximum 5–7 KPIs per screen.
- each KPI includes label, value, and short explainer
- clickable only if meaningful
- avoid decorative metrics that do not drive drill-down

### Table/list view

Rules:
- desktop: table with sortable headers
- mobile / narrow view: stacked cards
- pagination or virtualisation for larger collections; do not force huge page scrolls.
- every table has a downloadable visible-data option if practical
- every charted dataset has a tabular equivalent nearby or via tab switch.

### Detail page block set

Every detail page should use the same block order:
1. identity block
2. summary block
3. key linked objects
4. deeper tabs or sections
5. metadata / provenance block

## Navigation model

Explorer should use URL-based routing suitable for static hosting.

### URL patterns

Examples:
- `/overview`
- `/requirements`
- `/requirements/REQ-000123`
- `/evidence/EVD-000455`
- `/actions?status=overdue&domain=personnel`
- `/reporting?readiness=blocked`
- `/search?q=privileged+access`

### Context preservation

When a user drills from a filtered list into detail and then back, Explorer should preserve:
- filters
- sort order
- current page
- search term where possible

This reduces cognitive loss and makes large lists manageable.

## Workflow catalogue

### Workflow 1: First open

**Goal:** Establish confidence and orient the user.

Flow:
1. Explorer loads manifest.
2. Overview screen opens.
3. User sees workspace title, export date, and key posture KPIs.
4. A small “About this data” affordance links to Data / About.

Success criterion:
- the user understands what workspace and time period the data represents within a few seconds.

### Workflow 2: Find the biggest gaps

**Goal:** Identify major concerns quickly.

Flow:
1. Open Overview.
2. Inspect “Needs attention” list and domain posture summary.
3. Click a gap count or domain status.
4. Land on Requirements or Reporting with filters pre-applied.
5. Review list and open item detail.

Success criterion:
- the user can move from high-level concern to specific requirement in 2–3 interactions.

### Workflow 3: Verify a requirement’s support story

**Goal:** Judge whether a status claim is believable.

Flow:
1. Search or browse to Requirement Detail.
2. Read summary and current status.
3. Open Evidence tab.
4. Review linked evidence freshness and count.
5. Check Actions and Risks tabs for unresolved issues.

Success criterion:
- the user can answer “why is this marked this way?” without leaving the page.

### Workflow 4: Review evidence currency and completeness

**Goal:** Identify evidence that weakens assurance because it is old, incomplete, changed, unverified, missing, or unlinked.

Flow:
1. Open Evidence screen.
2. Select a domain or requirement filter.
3. Apply review filters such as `stale`, `incomplete`, `changed`, `unverified`, `missing`, or `unlinked`.
4. Sort by downstream impact, linked requirements count, affected domain, or last reviewed.
5. Open evidence detail.
6. Follow links to affected requirements, actions, risks, or Directions.

Success criterion:
- old, incomplete, changed, or missing evidence with highest downstream impact is easy to spot at domain and requirement level.

### Workflow 5: Add and assess Direction

**Goal:** Register a new authoritative Direction and manage the response like a requirement overlay.

Flow:
1. Open Directions.
2. Create Direction with reference, title, issued date, authoritative source, and description.
3. Link affected requirements/domains using pickers.
4. Review affected requirements, evidence, actions, and risks.
5. Record response state, rationale, evidence, actions, and risks.
6. Review the effect on posture, Direction summary, and action-impact ranking.

Success criterion:
- a Direction can be assessed, evidenced, linked, and included in posture/action planning without becoming a separate workflow silo.

### Workflow 6: Prepare for reporting discussion

**Goal:** Understand reporting readiness and blockers.

Flow:
1. Open Reporting.
2. Review readiness KPI and blocked counts.
3. Filter to blocked domains or requirements.
4. Open detail pages for highest-impact blockers.
5. Download filtered lists for discussion or offline review.

Success criterion:
- the user can explain why reporting readiness is high or low and what is blocking progress.

### Workflow 7: Produce posture brief and action plan

**Goal:** Create the common output: a simple graphic and text description of PSPF posture plus a data/evidence-backed action plan.

Flow:
1. Open Overview, Reporting, or Posture brief.
2. Review overall, domain, and Essential Eight posture.
3. Check evidence confidence and Direction response signals.
4. Review top actions ranked by Action Impact.
5. Export or copy the posture brief and action plan.

Success criterion:
- the user can present the current posture and next actions with visible supporting facts, not unsupported narrative.

### Workflow 8: Share work required for requirement delivery

**Goal:** Send or paste a concise answer to “what work is required to deliver this requirement, group, or domain?”

Flow:
1. Open a requirement, filtered requirement list, domain view, Essential Eight view, Direction, Reporting, or Relationships Board scope.
2. Invoke copy/share brief.
3. Review the generated brief and its redaction/freshness notice.
4. Copy as plain text, Markdown, or HTML clipboard where supported.
5. Paste into email or Teams.

Success criterion:
- the pasted content remains readable, includes traceable IDs/links and evidence/action basis, and excludes restricted or unapproved sensitive fields.

### Workflow 9: Follow a risk chain

**Goal:** Move from a risk to its operational context.

Flow:
1. Open Risks screen.
2. Filter to unresolved high-severity risks.
3. Open risk detail.
4. Review linked requirements and actions.
5. Navigate to associated requirement or action detail.

Success criterion:
- risk is traceable to the PSPF artefacts it affects.

### Workflow 10: Search-first discovery

**Goal:** Find a topic without knowing the object type.

Flow:
1. Enter term in global search.
2. Review grouped results.
3. Narrow to Requirements or Evidence.
4. Open a detail page.

Success criterion:
- one search box is sufficient for most cross-object discovery.

## Page-level behaviour rules

### Loading states

- show skeletons matching the final layout
- show bundle-loading progress only if loading is visibly slow
- never render empty KPI cards before data is bound

### Empty states

Examples:
- no data loaded
- bundle missing required collections
- no results for current filters
- chart hidden because data insufficient

Each empty state should explain:
- what the user is seeing
- why it may have happened
- what to do next

### Error states

Explorer should distinguish:
- bundle parse error
- schema mismatch
- missing file / collection
- unsupported bundle version

Error screens should include:
- short plain-language summary
- technical details panel (collapsible)
- link to Data / About or bundle troubleshooting notes

## Chart and data-visualisation rules

Explorer should use charts sparingly and always with text/table support.

Rules:
- each chart must answer one clear question
- each chart must have a nearby summary sentence
- provide an underlying data table or downloadable data.
- avoid relying on colour alone to express status
- maintain consistent legends and labels
- avoid dense multi-series charts unless comparison value is strong
- prefer bars, stacked bars, dot plots, and compact heatmaps over decorative chart types

Recommended chart set:
- compliance status donut, with count by compliance state and a centre label for met percentage / remaining not-met count
- domain status bar / stacked bar
- readiness by domain bar chart
- evidence freshness distribution
- action due-state distribution
- action timeline / Gantt-lite view for due dates and milestones
- grouped action checklist by domain/status/owner/requirement
- risk severity distribution
- impact/likelihood matrix for risk count by cell

### Chart copy and image export

Simple Explorer graphics must be shareable without requiring a full report export. Each primary chart should provide:

- **Copy image** — writes a PNG image to the clipboard where the browser supports it.
- **Save image** — downloads a PNG with a descriptive file name.
- **Copy summary** — copies the chart title, generated-at time, active filters, key numbers, and source/freshness caveat as text.
- **View data** — exposes the underlying table used to draw the chart.

The copied/saved image must include the chart title, scope, generated-at timestamp, active filter label, classification/banner marking where required, and a short caveat if the source bundle is stale or filtered. The image export must not include restricted or unapproved sensitive fields.

### Simple vs specialist graphics

Explorer owns consumer-friendly, shareable graphics. These should answer one question quickly, support copy/save, and remain understandable when pasted into email or Teams.

Dedicated modules own specialist, detailed, and highly interactive views:

| Area | Explorer graphic | Specialist module view |
|---|---|---|
| Requirements/posture | compliance donut, domain stacked bar, readiness bar | Workshop assessment detail, validation findings, report-prep drill-down |
| Actions | grouped checklist, Gantt-lite timeline, due-state distribution | Workshop action planning board, dependency/detail editing, owner workload views |
| Risks | impact/likelihood count matrix, severity distribution | Risk module treatment planning, residual-risk history, detailed risk register analysis |
| Evidence | freshness distribution, evidence confidence counts | Workshop evidence review queue, source-change analysis, verification workflow |
| Directions | response-state summary, affected-domain bar | Direction detail/assessment workflow and linked action/evidence management |
| Shop | supplier/contract coverage counts, forecast spend, expected savings, net benefit, payback summary | Shop supplier, contract, spend, savings-opportunity, and obligation analysis |
| Pub | role/team coverage counts without personal identifiers | Pub workforce assignment, role, team, and responsibility management |

Explorer may show Shop-derived forecast graphics when the bundle includes the required data and publication policy allows it. These graphics should stay consumer-friendly: forecast spend by financial year, expected savings by financial year, net benefit, and top invest-now-save-later opportunities. Detailed commercial assumptions, contract negotiation notes, and supplier analysis remain in Shop.

### Posture brief output

The most-used reporting output is expected to be a simple posture graphic plus a short text description and a data-backed action plan. Explorer must therefore provide a posture brief view/export that includes:

- overall PSPF posture as a compact chart with a nearby text summary,
- posture by domain,
- Essential Eight posture,
- ISM control posture aggregates based on published source controls, mappings, and direct control-work links, without per-control implementation status detail,
- evidence confidence signals, including stale, incomplete, changed, and missing evidence counts,
- Direction response state,
- top actions ranked by explainable Action Impact,
- and supporting facts so the user can trace each claim back to requirements, evidence, risks, actions, Directions, ISM source controls, mappings, and links.

The brief is not a free-form report writer in v1. It is a constrained, repeatable output composed from the same summary calculations used by Overview, Reporting, Essential Eight, Evidence, and the Relationships Board.

Explorer may show public ISM review-state cues such as unmapped, drift review, mapped with direct work, or mapped with no direct work where those cues derive only from published mappings, source-control drift state, and direct public evidence/action/risk link counts. It must not expose internal implementation status or infer per-control security posture.

### Shareable work brief output

Explorer must also support a paste-friendly work brief for a requirement, selected requirements, a domain, Essential Eight scope, or a Direction. The target use is email or Teams, not a formal report pack.

The work brief includes:

- selected scope and generated-at timestamp,
- current assessment/posture and evidence confidence,
- work required to improve or complete the scope,
- highest-impact actions with explanation facts,
- stale, incomplete, changed, missing, or unverified evidence that affects the scope,
- blockers, linked risks, and Direction response gaps,
- traceability IDs and same-origin Explorer links where available,
- and a short caveat showing bundle/source freshness.

The copy affordance must offer plain text and Markdown. It may also write an HTML clipboard representation so tables and links paste cleanly into Teams/email clients. Export/copy must honour the same publication policy and personal-data exclusions as bundles: no `Person.name`, `Person.email`, `Assignment.personId`, restricted fields, or unapproved sensitive fields.

## Responsive behaviour

Explorer should work on desktop first but remain usable on smaller screens.

Rules:
- top navigation collapses cleanly
- KPI strip becomes stacked cards
- tables become card lists or horizontally scroll only in secondary cases
- filter drawer may collapse on mobile
- detail pages become vertically stacked sections

Primary reporting tasks should remain achievable without horizontal scrolling on common laptop widths.

## Accessibility requirements

Explorer must satisfy these baseline requirements:
- keyboard reachable navigation, filters, tabs, tables, and downloads.
- visible focus state on every interactive element.
- support zoom and reflow without functional loss.
- chart alternatives through data tables and prose.
- plain-language labels and instructions.
- adequate contrast in light and dark themes
- screen-reader sensible heading structure

## MVP screen set

The first Explorer release should include only the screens needed to prove the model.

### MVP screens

1. Overview
2. Requirements list
3. Requirement detail (with work-log panel and audit history)
4. Evidence list
5. Actions list
6. Risks list
7. Directions list
8. Posture
9. Essential Eight
10. Relationships (Board)
11. Integrity scan
12. Reporting
13. Data / About
14. Search results
15. Command palette (global, not a route)

### MVP exclusions

Do not include initially:
- annotations/comments
- user accounts
- side-by-side compare mode
- printable report builder
- advanced chart customisation
- custom dashboards
- multiple workspaces / profiles per browser
- undo/redo
- print/PDF report generation

## Behavioural rules validated by the standalone prototype

These rules are carried forward from the standalone PSPF Explorer prototype (see `extracted-spec-pspf-explorer.md`) because they have proven valuable in real use and have observable, testable behaviour. The corresponding machine-checkable invariants are recorded in `pspf-invariants.md` § Explorer behavioural invariants (E-series).

### Compliance state machine

- States: `not-set` (default), `yes`, `no`, `risk-managed`, `not-applicable`. Any transition is allowed.
- The default state for an unscored requirement is `not-set`. **Visiting a requirement MUST NOT create a record**; the entry is materialised lazily on the user's first edit.
- Every state change produces a `from → to` audit event with a timestamp; same-state writes do **not** generate an event. The history is queryable per requirement and surfaced as the History tab on Requirement Detail.

### Compliance event retention

The compliance event trail is **append-only and never pruned in the local store**. There is no automatic retention window and (in v1) no in-app prune affordance.

The trail can be shaped at **export time only**. The export flow exposes a single, plainly-labelled toggle:

- **Include compliance history** *(default: on)* — emits the `compliance-events` collection in full.
- When **off**, the bundle omits the `compliance-events` collection entirely. The bundle remains valid; consumers tolerate the absence of the collection per the master-bundle rules.

This is intentionally minimal for the first build. A future revision may add a "history older than N days" option or a local prune affordance; for v1 the user's only choice is "include the full local history in this export, or none of it."

### Compliance percentage formula

`compliantPercent = yes / (total − notApplicable)`, integer-rounded. The denominator excludes `not-applicable`. The numerator excludes `not-applicable`. The formula is surfaced in copy beside any compliance percentage so users are not misled. When the denominator is zero the UI displays "n/a", never `NaN`.

### Risk band thresholds

`score = likelihood × impact` with `likelihood, impact ∈ {1..5}`. Bands: `score < 5` Low; `5..9` Medium; `10..15` High; `score >= 16` Extreme.

### Action overdue rule

An action is overdue iff `dueAt` is set, `dueAt < now`, **and** status ∉ `{ done, cancelled }`. Overdue actions are visually distinguished and counted in analytics.

### Direction response set

Direction responses are exactly `{ not-set, yes, no, risk-managed }`. `not-applicable` is intentionally excluded — once a Direction is registered it always applies. Documented as deliberate divergence from the requirement compliance set.

### Posture inheritance

Per-domain overrides default to `(inherit)`. Inheritance reads through to the global setting at display time. Setting a per-domain value persists only the changed fields; clearing returns to inheritance.

### Cross-entity link validation

Explorer treats cross-entity links (a risk's `requirementIds`, an action's `riskIds`, a Direction's affected requirements, a first-class `relationships` record, etc.) as follows:

- **In the UI:** every link field is an autocomplete picker, not a free-text ID field. The picker proposes only existing entities (showing ID, title, kind, and a kind-specific subtitle) and refuses unknown free text. Pasting an unknown ID surfaces an inline error and does not save. This applies wherever an entity reference is captured — link fields, the linker on Requirement Detail, the relationship-record editor, the saved-view filter builder, and the Board inspector.
- **For first-class relationship records:** writes that reference an unknown endpoint are rejected outright. A relationship record with no resolvable endpoint has no semantic value.
- **On import:** dangling references are tolerated by default but are configurable per import. The master bundle exposes a top-level `linkValidation` option:
  - `strict` — any link whose target is not present (in the bundle or in local state, depending on `intent`) rejects the bundle.
  - `lenient` *(default)* — accept the bundle, keep the dangling references, and report each one in the import summary so the user can decide whether to chase them up. The Integrity scan will continue to surface them later.
  - `drop` — accept the bundle and silently drop dangling references; the import summary still reports the count and IDs dropped.

### Pickers and autocomplete by default

Anywhere the user must enter a value drawn from a known set, Explorer uses a picker (dropdown, combobox, or autocomplete) rather than free text. Concretely:

- entity references (the rule above);
- enum values (compliance state, risk status, action status, action type, Direction response, threat level, posture mode, evidence kind);
- domain selection;
- tag application (multi-select with create-new affordance only on the Tags management surface, not inline);
- saved-view filter builder (state set, tag set, domain).

The picker is keyboard-navigable (↑/↓/Enter/Esc, type-to-filter), shows a non-empty empty state when no candidates match, and labels selections clearly for screen readers. Free-text input is reserved for genuinely free fields (titles, descriptions, notes, evidence URLs, free-text search).

### Uniqueness on titles and labels

Comparison for every uniqueness check below is **case- and whitespace-insensitive** (the same rule the Integrity scan uses), and applies globally across the user's local data.

**Hard-reject at write time** (these fields are identifiers in spirit; a duplicate makes the picker meaningless):

- `Direction.reference` — e.g. `MD-016`. Duplicates are rejected with a message that links to the existing record.
- `Tag.label`.
- `SavedView.name`.

**Soft-warn at write time, allow on explicit confirmation** (these fields are descriptions; legitimate collisions exist):

- `Risk.title`.
- `Action.title`.

The form surfaces an inline warning ("a risk titled 'X' already exists" with a link to the existing record) and an explicit "Allow duplicate" affordance. Saving without the affordance ticked saves under the existing-as-warning state; the Integrity scan continues to surface the duplicate later.

**Imports** apply the same rules at write time: hard-reject collisions on `Direction.reference`, `Tag.label`, and `SavedView.name` go into the import summary as rejected rows; soft-warn collisions on `Risk.title` and `Action.title` are accepted but flagged in the summary.

### Persistence and atomicity

- Every mutation persists durably **before** the in-memory snapshot is updated and before any UI says "saved".
- Backup-restore and additive merge happen inside a single transaction across all affected stores; a partial restore is not observable.
- A schema-version mismatch on import is rejected before any write occurs.
- Closing the tab mid-edit leaves the prior committed value intact.

### Master-bundle import discipline

- All four prototype flows (full restore, additive merge, GRC capture, work import) are configurations of the single master bundle (ADR 0009). The flow is determined by the bundle's `intent` and `generator.mode`.
- Imports MUST reject unknown top-level or per-entry fields.
- Evidence URLs from a GRC-capture-flavoured bundle **append** to the existing evidence list, never replace.
- `intent: plan-apply` bundles MUST go through the plan/review/apply choreography described in screen 17; validation alone makes no writes.

### Conflict policy on additive merge

The v1 conflict policy on `intent: additive-merge` is **smart-default plan-and-review**:

1. Explorer validates the bundle and computes a per-record classification: `add` (no local row with that `id`), `collision` (a local row with that `id` already exists), or `skip` (validation rejected the row).
2. **If every incoming row is `add`** (pure addition, no collisions): Explorer applies the additions in a single transaction without prompting and shows a post-import summary ("N items added"). No review pane is opened.
3. **If any row is a `collision`**: Explorer opens the plan-and-review pane. `add` rows are pre-checked for apply; `collision` rows require the user to choose `keep existing` (default) or `overwrite with incoming` per record. Nothing is written until the user confirms.
4. The post-import summary is always surfaced (toast plus an entry in the Work-log) and lists the counts and the per-record decisions where applicable.

Silent "existing wins, no summary" is **not** a v1 mode. The legacy prototype behaviour is retired.

The `intent: plan-apply` flow is unchanged: it always goes through the full plan/review/apply choreography on screen 17, regardless of whether collisions are present.

### Undo this import (per-import undo)

Every `additive-merge` and `plan-apply` write is wrapped in a single IndexedDB transaction tagged with an `importId`. The post-import summary toast is sticky and exposes two actions: **Dismiss** and **Undo this import**.

- Undo is available **until any subsequent write occurs, or the user navigates away from the resulting screen, or the tab is refreshed** — whichever comes first. After that, the affordance is gone.
- Undo MUST delete rows added in the transaction. For `plan-apply` overwrites, Explorer captures a pre-apply snapshot of the affected rows at commit time and restores those values on undo.
- Undo MUST also remove any compliance events that were created as a side-effect of the import. This is the **only** path that may delete a compliance event in v1; the append-only invariant is otherwise preserved.
- The undo action itself is recorded in the Work-log as a single entry; it does not create a further reversible transaction.
- Manual authoring edits (single-record create/update on the entity screens) are **not** reversible in v1. Hard-deletes already require a confirmation prompt per the E-series invariants.

#### Full-replace undo (v0.1 minimum)

Per [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md), `intent: plan-apply` is deferred to v0.2. v0.1 ships **only** `full-replace` and `additive-merge`. Because `full-replace` discards the entire local store, the per-import undo above is not sufficient on its own. v0.1 adds a single, narrow rollback affordance:

- Before applying a `full-replace` import, Explorer takes a **pre-replace snapshot** of the entire IndexedDB store (one transactional dump tagged with the same `importId`).
- The post-import summary toast for a `full-replace` exposes **Roll back this restore** alongside Dismiss.
- The rollback is available under the same scope rule as additive-merge undo: until the next write, navigation away, or refresh, whichever comes first.
- The pre-replace snapshot is then discarded.
- If the rollback is invoked, the prior store is restored in a single transaction; the action is recorded in the Work-log; no compliance events are forged or deleted (the rollback restores the prior event set verbatim).

This is intentionally narrow: it closes the "I just clicked import and got a surprise" gap for both intents that exist in v0.1 without committing to a general undo journal.

### Classification banner

OFFICIAL: Sensitive plus the active TLP marking MUST be visible on every screen of Explorer's local-authoring mode. The banner is a behavioural commitment, not decoration; per-route Playwright assertions enforce it.

### Sensitive-data protection posture (v1)

The OFFICIAL: Sensitive marking is a **labelling commitment in v1, not a technical control**. The Data / About screen states the protection posture honestly and the export flow repeats the relevant warnings:

- Local data is stored in the browser's IndexedDB **without encryption**. Anyone with access to the browser profile can read it.
- There is **no idle lock** and **no passphrase** in v1.
- Exported JSON backups are written to disk **unencrypted**. The user is responsible for handling them at the OFFICIAL: Sensitive level (e.g. storage location, transport, and retention).
- "Reset local data" and clearing browser site data both wipe the local store irrecoverably; the experimental banner makes this explicit.

This stance is provisional and will be revisited once the core authoring loops are stable. Likely future direction is passphrase-encrypted local storage and/or encrypted backups; see ADR 0011 § Reopening criteria. Until then, no spec, copy, or test may claim Explorer encrypts data at rest.

### List-preference and selection persistence

In-flight list view state is persisted in **`sessionStorage`** only. It survives refresh within the same tab and is discarded when the tab closes. It is per-origin and never travels in the master bundle.

- **Persisted in `sessionStorage`:** active filters, sort order, column visibility, pagination position, search query, and the Board's lane visibility and lane order. Keys are namespaced as `pspf:explorer:list:<entity>` and `pspf:explorer:board`.
- **Not persisted:** selection / row highlight, scroll position. Both reset on navigation and on refresh.
- **Saved views remain the durable mechanism.** A user who wants a working filter to outlive the tab MUST save it as a `SavedView` (entity-scoped, lives in IndexedDB, round-trips through the bundle).
- **Reset paths:** "Reset local data" on the Data screen MUST also clear all `pspf:explorer:*` keys from `sessionStorage` and `localStorage` (Explorer holds no `localStorage` keys in v1, but the reset path is implemented unconditionally so future additions cannot leak past a reset).
- **Sensitive-data posture:** `sessionStorage` is unencrypted plain text in the browser profile while the tab is open; the v1 labelling-only posture in ADR 0011 already covers this. No spec or copy may claim list preferences are encrypted.

### Network egress

After the initial bundle resolves, Explorer makes **zero** outbound network requests at runtime. CSP enforces this (see `pspf-invariants.md` § S4); a CI test asserts request count is zero after first paint.

### Search behaviour

- Synchronous in-memory search across requirement IDs, titles, body text, user notes, evidence, Directions, risks, and actions.
- Minimum query length: 2 characters.
- Result counts capped per kind; results carry `kind`, `title`, `subtitle`, route href, and a snippet around the match.

### Performance budgets

Explorer-specific interactive budgets (FCP, TTI, view-switch p95, search p95, Board initial render, sustained interaction at 10k records) are owned by `pspf-performance-profile-and-benchmarks.md` § Explorer interactive thresholds. The numbers are inherited from the standalone prototype as non-regression budgets; CI gates are added once a baseline run exists.

### Accessibility floor

Explorer is built to a WCAG 2.2 AA-**aligned** accessibility floor (an audited claim is deferred until a third-party audit is commissioned). The enforceable rules are owned by `pspf-invariants.md` § E24 and cover: keyboard-only reachability of every primary route, a keyboard equivalent for moving cards between Board lanes, visible focus indicators on every interactive element, full respect for `prefers-reduced-motion: reduce`, and a zero-`serious`/zero-`critical` `axe-core` budget per route.

## Success criteria

Explorer succeeds when a user can:
- understand the overall PSPF posture within one minute
- move from summary to supporting detail in a few interactions.
- judge whether a requirement’s reported status is well-supported
- identify stale evidence, overdue actions, and unresolved risks quickly
- understand reporting readiness and blockers
- trust the data source and bundle freshness

## Product boundary reminder

Explorer is strongest when it stays disciplined:
- **read, filter, compare, explain, export**
- not **edit, orchestrate, or administer**

Core and Workshop remain the systems where authoritative changes happen. Explorer should remain the elegant, portable, static reporting and exploration surface built from the bundle.
