# 0057 - v1.21 Shop Forecast and Management Visibility

- Status: accepted
- Date: 2026-05-19

## Context

By v1.20 Shop can author suppliers, contracts, and spend items in Core-backed canonical records, link commercial records to assurance records, and show commercial coverage. User feedback asks for a clearer forward spend view and lightweight management prompts: forecast spend by month and financial year, scheduled savings, planned efficiency dividends by financial year, no Actuals, supplier performance/management checks including contract management and FOCI, and contract artefact links aligned to the Commonwealth Procurement Rules (CPRs).

Shop remains a commercial planning and visibility surface. It is not the contract system of record and should not claim to store authoritative procurement documents.

## Decision

Extend the Shop Forecast panel without changing schemas or compatibility axes.

The v1.21 slice adds:

- monthly forecast spend derived from `SpendItem.forecastStartAt`, `forecastEndAt`, `forecastCost`, `amount`, and `financialYear`;
- a full-panel monthly forecast bar/table plus the existing financial-year forecast;
- a planned savings schedule derived from `SpendItem.expectedSavings`, `savingsType`, `confidence`, and forecast dates;
- annual planned efficiency dividends that consolidate expected savings by financial year for simple reporting;
- replacement/consolidation context from existing Contract-to-Spend Item links, without making Shop the contract system of record;
- CSV and Excel-compatible `.xls` table exports from the forecast panel;
- explicit "no Actuals" language and filtering of `spent` and `cancelled` spend items from forecast totals;
- supplier performance and management prompts for every supplier, including contract management state and a FOCI check prompt;
- contract artefact visibility for every contract, with CPR/Finance guidance links for value for money, procurement risk, contract management, contract negotiations, accountability/transparency, and supplier conduct; and
- updated Shop coverage dashboard gate coverage for the forecast and management sections.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.21.0"`.
- Package versions: `1.21.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new schema directory, entity type, field, link verb, bundle file, or compatibility axis.

## Consequences

Positive:

- Operators can see upcoming commercial demand by month and financial year without confusing forecast with Actuals.
- Operators can schedule likely savings and review annual planned efficiency dividends in a simple table.
- Every supplier has at least one lightweight management/performance prompt.
- Every contract is accompanied by CPR-aligned artefact prompts and source links, while authoritative artefacts remain in the procurement system of record.

Trade-offs:

- The CPR artefact view shows guidance links and gap prompts; it does not store document URLs or evidence files in v1.21.
- Forecast allocation is simple and deterministic: a spend item is spread evenly across explicit forecast months, or across the financial year if dates are missing.
- Contract replacement context is inferred from existing Contract-to-Spend Item links and contract status; v1.21 does not add a dedicated `replacesContractId` field.
- The `.xls` export is an Excel-compatible HTML table, not a binary workbook format.