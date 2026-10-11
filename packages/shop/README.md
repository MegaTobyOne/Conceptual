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

## Transition Status (11 October 2026)

Shop is a frozen extension: it receives no new features and will not be republished. Supplier, contract and spend records are not part of the v1.78.0 workbench parity set. Before any owner cutover, the Shop JSON store must be exported to the approved backup location; no Shop records are silently discarded or made publishable. The extension remains installed and readable during W2. See [ADR 0104](../../adr/0104-workbench-register-prototype-extension-independence.md) and the [W2 execution plan](../../validation-scenario-1-operator-workflow.md#w2-execution-plan-owner-independence-cycle).

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
