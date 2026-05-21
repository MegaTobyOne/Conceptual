# 0062 - v1.26 Shop assurance spend scenario planning

- Status: proposed
- Date: 2026-05-21

## Context

Shop now has Core-backed Suppliers, Contracts, Spend Items, commercial assurance links, forecast tables, cost-centre export, and coverage prompts. The next operator question is less about whether a spend item exists and more about what it buys in assurance terms: which Requirements, Actions, tags, and target uplift depend on funding, and what the forecast looks like if proposed work is included or excluded.

The existing model already has the primitives needed for a first scenario-planning release: `spend-item supports requirement`, `spend-item supports action`, `requirement addressed-by action`, `requirement tagged-with tag`, Spend Item statuses (`proposed`, `approved`, `committed`, `spent`, `cancelled`), forecast dates, expected savings, confidence, assumptions, and cost centre. v1.26 should use those primitives before adding finance-system reconciliation, approvals, or a broader commercial workflow state model.

## Decision

Adopt v1.26 as the Shop assurance spend attribution and mini scenario-planning release.

The slice includes:

1. Spend attribution by Requirement, Action, tag, domain, supplier, contract, cost centre, financial year, and spend status.
2. A deterministic attribution model that traces direct `spend-item supports requirement` links and indirect `spend-item supports action` -> `requirement addressed-by action` links, then inherits Requirement tags through existing `tagged-with` links.
3. A no-double-counting rule: headline totals show unique Spend Item totals for the active filter, while per-Requirement, per-Action, and per-tag rows disclose when the same Spend Item contributes to multiple assurance outcomes.
4. Scenario toggles for at least `Approved and committed baseline`, `Include proposed work`, and `Approved only`, using existing Spend Item status values rather than adding approval records.
5. Forecast interrogation controls for period, financial year, cost centre, supplier, contract, Requirement status, Action status, tag, confidence, and savings type.
6. A `Cost to reach and sustain target` panel that combines forecast cost, expected savings, confidence, linked Actions, linked Requirements, and Strategy or Essential Eight target measures where they exist. Where no explicit target measure exists, Shop must label the view as linked assurance spend rather than claiming maturity precision.
7. Data-entry improvements for Spend Items: clearer prompts, linked Requirement/Action selection during entry, reusable defaults for financial year and cost centre, validation for missing amount/date/status/confidence assumptions, and quick fixes for unlinked or weakly linked spend.
8. Export improvements for filtered forecast tables, scenario comparison, spend-by-Requirement, spend-by-tag, spend-by-Action, and assumptions/confidence registers as CSV and Excel-compatible `.xls`.
9. A plain-language scenario summary suitable for management review: committed spend, proposed uplift spend, expected savings, net forecast, key unfunded Actions, low-confidence assumptions, and commercial records missing assurance links.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.26.0"`.
- Package version target: `1.26.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.10.0"` unless implementation accepts new schema-bearing fields beyond existing Spend Item, Link, Tag, Requirement, Action, Strategy, Supplier, and Contract data.
- No new entity type, link verb, approval workflow, finance-system connector, or realised-actuals model is introduced in this slice.

## Consequences

Positive:

- Operators can describe spend in assurance language: by Requirement, Action, tag, target uplift, and forecast period.
- Shop can support a lightweight management conversation about committed versus proposed work without becoming a finance or procurement system of record.
- Better data entry should increase the number of spend records that are linked, forecastable, and exportable.
- Existing tags become commercially useful without expanding tag scope beyond Requirements.

Trade-offs:

- Attribution is explainable, not accounting-grade allocation. Multi-linked spend needs explicit disclosure so totals are not misread.
- Scenario planning is status-based in v1.26. It does not model formal approvals, funding rounds, portfolio decisions, or workflow history.
- Desired maturity is only as strong as the linked Strategy, Essential Eight, Requirement, and Action data. Shop must surface missing targets as gaps, not invent them.

## Alternatives considered

- Add a formal scenario entity. Rejected for v1.26 because saved filters, status toggles, and exports are enough to validate the workflow.
- Add finance reconciliation and actual spend import. Deferred because v1 Shop remains a planning surface and should not imply ledger authority.
- Allow tags on Spend Items or Actions. Deferred because v1.7 deliberately limits tags to Requirements; v1.26 can still report spend by tag through linked Requirements.
- Add approval records. Deferred until the product has a clearer Pub or governance workflow boundary.