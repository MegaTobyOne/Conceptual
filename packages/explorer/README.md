# PSPF Explorer

Local-first tooling for Australian Government PSPF assurance work. Core, Workshop, Shop, and Explorer share one schema and one local store so that authoring, commercial planning, and publication stay aligned.

## What Explorer is

PSPF Explorer is a portable, static web interface that reads a curated JSON bundle exported by **PSPF Core** and renders it for review. Reviewers open it in a browser to see posture without touching the source workspace.

- Posture donut, compact status table, and collapsible sections.
- Action Impact, ISM coverage, saved views, tag filters, "Why This Changed", and Plan Lens.
- Readable relationship tables.
- Short AU dates, compact unresolved IDs, and OFFICIAL: Sensitive / TLP:AMBER+STRICT handling cues.
- Copyable posture brief for handing to reviewers.

## How it fits

Explorer consumes the master bundle produced by **PSPF Core**'s export command. It never opens the local SQLite store directly and it never writes back to Core.

- Author and validate in **PSPF Workshop** (depends on Core).
- Export the master bundle from **PSPF Core** to a location of your choice.
- Open Explorer in a browser and load the bundle file.

## Open Explorer

- Hosted publication view: <https://tobyharvey.online/explorer/>
- Local build: open `packages/explorer/dist/index.html` after running the repository build.

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
