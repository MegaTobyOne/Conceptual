# PSPF Shop

Local-first supplier, contract and spend planning connected to cyber risk, assurance requirements and treatment Actions. Commercial records are Core-backed; forecasts support decisions rather than establish realised savings or measured risk reduction.

> **Role:** Commercial planning and dependency context

## What this extension does

PSPF Shop is the **commercial planning surface** for suppliers, contracts, spend items, and derived spend forecast review. It links commercial obligations to the controls and risks they affect, so assurance and procurement stay in step.

- Authors Suppliers, Contracts, and Spend Items in Core's canonical model.
- Links commercial records to Requirements, Actions, and Risks through existing Core links.
- Shop Forecast view with a commercial coverage dashboard: monthly and financial-year forecast spend, planned savings schedule, annual planned efficiency dividends, linked and unlinked assurance coverage, near-term contract review, funded open Actions, supplier Risk context, supplier performance/FOCI prompts, and CPR-aligned contract artefact links.
- Exports simple reporting tables as CSV or Excel-compatible `.xls` from the full forecast panel.
- Shop is a commercial planning surface, not the contract system of record. The forecast panel points to what needs to be found or managed in the authoritative procurement records.
- Compatibility import for legacy local `.pspf/shop/shop.json` records.

Shop reads and writes commercial records through Core. The local JSON file is a compatibility import source, not the active system of record.

## Design Direction (Not Implemented)

The [clean-start workbench brief](../../pspf-design-spec.md#clean-start-workbench-design-brief) evaluates bringing commercial functions into one coherent, potentially single-extension experience. Supplier, contract and funding context should be available alongside the active risk or Action without losing the user's place. Current Shop packaging and storage are unchanged; there is no new Explorer publication permission.

There are no active users, so legacy migration and retention are not required for the proposed fresh baseline. The existing compatibility import remains current functionality, not a requirement to reproduce it in the new design.

## How it fits

Shop requires **PSPF Core**.

- Install **PSPF Core** first.
- Workshop surfaces Shop's commercial context next to Requirements, Actions, and Risks.
- Explorer publication of Shop commercial data remains deferred pending a dedicated publication-policy decision.

## Key commands

- `PSPF: Open Shop`
- `PSPF: Load Shop Sample`
- `PSPF: New Supplier` / `New Contract` / `New Spend Item`
- `PSPF: Open Shop Forecast`
- `PSPF: Export Shop Forecast CSV` / `PSPF: Export Shop Forecast XLS`
- `PSPF: Link Supplier to Requirement` / `Risk`
- `PSPF: Link Contract to Requirement` / `Spend Item`

## Source and docs

- Repository: <https://github.com/MegaTobyOne/Conceptual>
- Ecosystem overview: <https://tobyharvey.online>
- Explorer (publication view): <https://tobyharvey.online/explorer/>

This is an independent project. Not affiliated with the Department of Home Affairs, the Attorney-General's Department, or any other Australian Government entity. Do not enter information classified above OFFICIAL: Sensitive.
