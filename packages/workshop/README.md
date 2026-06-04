# PSPF Workshop

Local-first tooling for Australian Government PSPF assurance work. Core, Workshop, Shop, Pub, and Explorer share one schema and one local store so that authoring, commercial planning, people context, and publication stay aligned.

> **Accent:** Workshop blue · Authoring surface

## What this extension does

PSPF Workshop is the day-to-day **authoring surface** inside VS Code. It opens screen-based views for each entity type, talks to Core through a typed contract, and provides rapid editing and review flows for the assessment loop.

- Screens for Requirements, Evidence, Actions, Risks, Directions, and ISM mappings.
- Item-detail webview panels with previous/next navigation and save-and-next for rapid assessment passes.
- Link-existing flows for Evidence, Actions, Risks, and Directions so new records can be attached without re-creating them.
- Tags, saved views, Change Records, and the Evidence Review Queue for ongoing maintenance.
- Master Dashboard portal groups, decision-loop action cards, grouped Strategy Map measures, ISM principle browsing, and browse-panel shortcuts from tree views.
- Plan of Action can optionally show local Pub team-wide dates when a Pub team item is marked for planning, helping operators spot conflicts with action and reminder dates.
- Copyable posture brief for handing to reviewers.

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

Implemented in v1.41: the Plan of Action reads local Pub team date items marked for planning and renders them as optional schedule context. It does not write Pub data, publish Pub records, resolve date conflicts automatically, or create calendar/notification records.

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
