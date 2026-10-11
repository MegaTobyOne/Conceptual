# PSPF Pub

Local-first organisation, workforce and stakeholder context for cyber risk and assurance work. Pub keeps its records in its own workspace-local store, separate from Core's database and Explorer's browser data.

> **Role:** Local-only organisation and workforce context

## What this extension does

PSPF Pub is the local **organisation and workforce development surface** for PSPF workspaces. It provides the human context behind the controls, risks, and decisions that Workshop and Shop author.

- Authors People, Teams, Roles, Assignments, and Relationship Notes alongside Core's canonical model.
- Organisation Chart, Teams, People, Roles, Assignments, and Relationship Log views in a dedicated Activity Bar entry.
- Organisation Chart card view with team name, responsibility, roles, and assignments on the front, plus accountable Requirements, controls, and team dates on the back.
- Local-only detail and edit panels for each Pub record type with previous/next navigation.
- People & Culture compliance view for acceptable use, orientation, probation, separation, and annual performance-cycle context.
- Workforce Planning view for mandatory learning, certification renewal windows, five-anchor skills, development activities, succession readiness, and Cyber rotations.
- Guided local workflows for learning status, skill assessment, development activities, succession review, rotation opportunities, placements, and transfer milestones.
- Safe aggregate plain-text copy and confirmed HTML export that exclude person identities, identifiers, evidence, rationale, objectives, and notes.
- Team-wide news and dated items for events such as enterprise bargaining, census windows, planning days, and local reminders. Items can optionally be marked for the Workshop Plan of Action.
- Pub data stays on the workspace and is **never exported** to Explorer bundles. Sensitive person details, relationship notes, development context, performance-management context, succession candidates, rotations, anniversaries, and team-event history remain local-only by default.

## How it fits

Pub requires **PSPF Core**.

- Install **PSPF Core** first.
- Open a PSPF workspace and run `PSPF: Open Pub`.
- Pub remains the local authoring and review surface for organisation records; it is not an automatic identity or accountability source for the wider suite.
- Explorer never receives Pub data.
- Workshop can read only the local Pub team-date items that are explicitly marked for the Plan of Action, so operators can see possible date conflicts beside action and reminder dates.

## Transition Status (11 October 2026)

Pub is a frozen extension: it receives no new features and will not be republished. People, roles, assignments and other Pub records are not part of the v1.78.0 workbench parity set. Before any owner cutover, the Pub JSON store must be exported to the approved backup location; Pub data does not become publishable by this transition. The extension remains installed and readable during W2. See [ADR 0102](../../adr/0102-browser-first-workbench-supersedes-extensions.md), [ADR 0104](../../adr/0104-workbench-register-prototype-extension-independence.md) and the [W2 execution plan](../../validation-scenario-1-operator-workflow.md#w2-execution-plan-owner-independence-cycle).

## Current boundaries

Implemented in v1.47: the migration-safe Pub store remains `1.3.0`; Workforce Planning now provides Overview and routed Attention, scoped Obligations, explicit-denominator Capability, all-role Continuity, and evidence-only Mobility & career views. Team and AI-fluency filters stay local to the panel, and aggregate exports suppress person-derived counts from 1 to 4 as `<5`.

Not implemented in v1.47: publication of Pub data to Explorer, person-identifying workforce exports, CSV workforce exports, HRIS/LMS integration, automatic legacy-certification conversion, automatic skill catalogue insertion, AI workforce recommendations, multi-user succession approval, automatic calendar sync, notifications, or broader Pub delete/archive workflows.

## Key commands

- `PSPF: Open Pub`
- `PSPF: Open Workforce Planning`
- `PSPF: Manage Learning and Certifications`
- `PSPF: Manage Skills and Development`
- `PSPF: Review Succession Plans`
- `PSPF: Manage Cyber Rotations`
- `PSPF: Copy Safe Workforce Summary` / `PSPF: Export Safe Workforce Summary HTML`
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
