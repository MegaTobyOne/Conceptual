# PSPF Shop

Local-first tooling for Australian Government PSPF assurance work. Core, Workshop, Shop, and Explorer share one schema and one local store so that authoring, commercial planning, and publication stay aligned.

## What this extension does

PSPF Shop is the **commercial planning surface** for suppliers, contracts, spend items, and derived spend forecast review. It links commercial obligations to the controls and risks they affect, so assurance and procurement stay in step.

- Authors Suppliers, Contracts, and Spend Items in Core's canonical model.
- Links commercial records to Requirements, Actions, and Risks through existing Core links.
- Shop Forecast view with a commercial coverage dashboard: linked and unlinked assurance coverage, near-term contract review, funded open Actions, and supplier Risk context.
- Compatibility import for legacy local `.pspf/shop/shop.json` records.

Shop reads and writes commercial records through Core. The local JSON file is a compatibility import source, not the active system of record.

## How it fits

Shop requires **PSPF Core**.

- Install **PSPF Core** first.
- Workshop surfaces Shop's commercial context next to Requirements, Actions, and Risks.
- Explorer renders the same commercial linkage in the published bundle.

## Key commands

- `PSPF: Open Shop`
- `PSPF: Load Shop Sample`
- `PSPF: New Supplier` / `New Contract` / `New Spend Item`
- `PSPF: Open Shop Forecast`
- `PSPF: Link Supplier to Requirement` / `Risk`
- `PSPF: Link Contract to Requirement` / `Spend Item`

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
