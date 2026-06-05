# PSPF Pub

Local-first tooling for Australian Government PSPF assurance work. Core, Workshop, Shop, Pub, and Explorer share one schema and one local store so that authoring, commercial planning, people context, and publication stay aligned.

> **Accent:** Pub red · Local-only people context

## What this extension does

PSPF Pub is the local **people, role, team, assignment, and stakeholder relationship surface** for PSPF workspaces. It provides the human context behind the controls, risks, and decisions that Workshop and Shop author.

- Authors People, Teams, Roles, Assignments, and Relationship Notes alongside Core's canonical model.
- Organisation Chart, Teams, People, Roles, Assignments, and Relationship Log views in a dedicated Activity Bar entry.
- Organisation Chart card view with team name, responsibility, roles, and assignments on the front, plus accountable Requirements, controls, and team dates on the back.
- Local-only detail and edit panels for each Pub record type with previous/next navigation.
- People & Culture compliance view for acceptable use, orientation, probation, separation, and annual performance-cycle context.
- Team-wide news and dated items for events such as enterprise bargaining, census windows, planning days, and local reminders. Items can optionally be marked for the Workshop Plan of Action.
- Pub data stays on the workspace and is **never exported** to Explorer bundles. Sensitive person details, relationship notes, development context, performance-management context, roster planning, rotations, anniversaries, and team-event history remain local-only by default.

## How it fits

Pub requires **PSPF Core**.

- Install **PSPF Core** first.
- Open a PSPF workspace and run `PSPF: Open Pub`.
- Workshop and Shop reference People and Teams as context; Pub remains the authoring and review surface for the people layer.
- Explorer never receives Pub data.
- Workshop can read only the local Pub team-date items that are explicitly marked for the Plan of Action, so operators can see possible date conflicts beside action and reminder dates.

## Current boundaries

Implemented in v1.41: local team news/date storage, Organisation Chart team-card fronts/backs, Team detail date tables, optional Workshop Plan of Action date visibility, and a simple local People & Culture lifecycle/performance compliance view.

Not implemented in v1.41: publication of Pub data to Explorer, automatic calendar sync, conflict resolution, notifications, broader Pub delete/archive workflows, roster planning, advanced performance-management workflows, or development-record publication.

## Key commands

- `PSPF: Open Pub`
- `PSPF: Load Pub Sample`
- `PSPF: New Pub Person` / `PSPF: Open Pub Person Detail` / `PSPF: Edit Pub Person`
- `PSPF: Open Pub People and Culture`
- `PSPF: New Pub Role` / `PSPF: Open Pub Role Detail` / `PSPF: Edit Pub Role`
- `PSPF: New Pub Assignment` / `PSPF: Open Pub Assignment Detail` / `PSPF: Edit Pub Assignment`
- `PSPF: Record Pub Relationship Note` / `PSPF: Open Pub Relationship Note Detail` / `PSPF: Edit Pub Relationship Note`

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
