# PSPF Workshop

Local-first authoring and review for cyber risks, requirements, evidence, treatment work and reporting, with Australian PSPF and ISM context. Workshop uses Core's workspace record; Pub and Explorer retain their separate local data boundaries.

> **Role:** Evidence-backed authoring and review

## What this extension does

PSPF Workshop is the day-to-day **authoring surface** inside VS Code. It opens screen-based views for each entity type, talks to Core through a typed contract, and provides rapid editing and review flows for the assessment loop.

- Screens for Requirements, Evidence, Actions, Risks, Directions, and ISM mappings.
- Item-detail webview panels with previous/next navigation and save-and-next for rapid assessment passes.
- Link-existing flows for Evidence, Actions, Risks, and Directions so new records can be attached without re-creating them.
- Tags, saved views, Change Records, and the Evidence Review Queue for ongoing maintenance.
- Master Dashboard portal groups, decision-loop action cards, grouped Strategy Map measures, ISM principle browsing, and browse-panel shortcuts from tree views.
- Strategy priority inference (risk → priority → choice): strategic choices that link risks show a derived priority band (Critical, High, Medium, Low, or none) from linked risk severity, adjusted by the choice's trend and confidence, with the top blocking risks and repair cues for unresolved links.
- Plan of Action can optionally show local Pub team-wide dates when a Pub team item is marked for planning, helping operators spot conflicts with action and reminder dates.
- Copyable posture brief for handing to reviewers.

## Design Direction (Not Implemented)

The [clean-start workbench brief](../../pspf-design-spec.md#clean-start-workbench-design-brief) proposes contextual capture, a persistent worklist, related-item inspection, recovered local drafts with explicit Save, meaningful progress and reporting reuse. Substantial visual/interface redesign and a single modular extension are under evaluation; current screens and packaging remain in place.

Completed Actions and priority scores do not prove reduced risk. The [risk-to-outcome review](../../pspf-plan-spec.md#2026-09-25-product-review) records the outstanding treatment-link, planning-intent and effectiveness-measurement gaps. There are no active users, so the proposed fresh baseline does not require legacy migration or retention.

## How it fits

Workshop requires **PSPF Core**. Core holds the local SQLite system of record and the single-writer lock; Workshop reads and writes through Core's typed API.

- Install **PSPF Core** first.
- Open a PSPF workspace and run `PSPF: Open Workshop Home`.
- Export the master bundle from Core to share with reviewers through **PSPF Explorer**.

## Key commands

- `PSPF: Open Workshop Home`
- `PSPF: Load Sample Workspace`
- `PSPF: Create Requirement` / `Add Evidence` / `Create Action` / `Create Risk`
- `PSPF: Link Existing Evidence` / `Action` / `Risk` / `Direction`
- `PSPF: Open Assessment Dashboard` and `PSPF: Open Evidence Review Queue`
- `PSPF: Open Master Dashboard` and `PSPF: Open Plan of Action Board`
- `PSPF: Copy Posture Brief`

## Current boundaries

Implemented in v1.43: the Strategy Map and Strategy Editor derive a priority band for each strategic choice from its linked risks (severity adjusted by trend and confidence). This is a read-only inference over existing data — it adds no schema, entity, or link verb.

Implemented in v1.41: the Plan of Action reads local Pub team date items marked for planning and renders them as optional schedule context. It does not write Pub data, publish Pub records, resolve date conflicts automatically, or create calendar/notification records.

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
