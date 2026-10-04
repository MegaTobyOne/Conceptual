# PSPF Core

Local-first storage, validation and exchange for cyber risk, assurance and work planning with PSPF and ISM context. Core is the workspace system of record; Pub has its own local people store and Explorer has separate browser-local data.

> **Role:** Local system of record

## What this extension does

PSPF Core is the local **system of record**. It runs entirely inside VS Code, holds the workspace in a local SQLite database at `.pspf/core/pspf-core.db`, and enforces a single-writer lock so only one editing session touches the data at a time.

- Owns the canonical entity and link model (Requirements, Evidence, Actions, Risks, Directions, ISM mappings, Suppliers, Contracts, Spend Items).
- Runs schema-policy validation, snapshots, backup, restore, and integrity checks.
- Exports the curated manifest-led JSON bundle that Explorer consumes. The export command prompts for the destination file.
- Applies redaction at publication time: restricted and sensitive fields are excluded from exports and snapshots.

## How it fits

Core is the foundation for the rest of the PSPF ecosystem.

- **Workshop** is the authoring surface and depends on Core.
- **Assurance** provides assessment, finding and verification/retest workbenches and depends on Core.
- **Shop** is the commercial planning surface and depends on Core.
- **Pub** is the local-only people, role, assignment, and relationship context surface and depends on Core.
- **Explorer** supports publication review and browser-local authoring with explicit master-bundle exchange; it is not a live Core client.

Install Core first, then add Workshop, Assurance, Shop and Pub as needed. A publication bundle is not a lossless backup: sensitive fields are excluded.

## Design Direction (Not Implemented)

The [clean-start workbench brief](../../pspf-design-spec.md#clean-start-workbench-design-brief) evaluates one modular extension while retaining useful Core write, validation and recovery mechanisms. Current packaging and storage remain unchanged. There are no active users, so legacy migration and retention are not required for the proposed fresh baseline; safe handling of future work remains essential.

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
