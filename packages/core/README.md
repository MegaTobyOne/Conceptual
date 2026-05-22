# PSPF Core

Local-first tooling for Australian Government PSPF assurance work. Core, Workshop, Shop, Pub, and Explorer share one schema and one local store so that authoring, commercial planning, people context, and publication stay aligned.

## What this extension does

PSPF Core is the local **system of record**. It runs entirely inside VS Code, holds the workspace in a local SQLite database at `.pspf/core/pspf-core.db`, and enforces a single-writer lock so only one editing session touches the data at a time.

- Owns the canonical entity and link model (Requirements, Evidence, Actions, Risks, Directions, ISM mappings, Suppliers, Contracts, Spend Items).
- Runs schema-policy validation, snapshots, backup, restore, and integrity checks.
- Exports the curated manifest-led JSON bundle that Explorer consumes. The export command prompts for the destination file.
- Applies redaction at publication time: restricted and sensitive fields are excluded from exports and snapshots.

## How it fits

Core is the foundation for the rest of the PSPF ecosystem.

- **Workshop** is the authoring surface and depends on Core.
- **Shop** is the commercial planning surface and depends on Core.
- **Pub** is the local-only people, role, assignment, and relationship context surface and depends on Core.
- **Explorer** is a static web viewer that opens the JSON bundle Core produces.

Install Core first, then add Workshop, Shop, and Pub as needed.

## Key commands

- `PSPF: Initialise PSPF Workspace`
- `PSPF: Validate Workspace`
- `PSPF: Create Snapshot`
- `PSPF: Export Master Bundle` — prompts for a save location for the JSON bundle.
- `PSPF: Import Master Bundle`

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
