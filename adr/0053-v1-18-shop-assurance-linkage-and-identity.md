# 0053 - v1.18 Shop assurance linkage and identity

- Status: accepted
- Date: 2026-05-18

## Context

ADR 0052 made Shop authoring Core-backed. Supplier, contract, and spend-item records now live in the same canonical store and bundle pipeline as Requirements, Actions, Risks, and links. The next useful slice is to connect commercial records to the assurance story so operators can see which suppliers, contracts, and spend decisions affect requirements, actions, and risks.

This is also the right moment to give Shop its own identity. Workshop already reads as the cool system-of-record decision surface, and Explorer reads as the warmer portable assurance view. Shop should feel related to both, but more commercially focused: obligations, timing, savings, risk exposure, and investment choices should be visually prominent.

## Decision

v1.18 makes Shop-to-Workshop assurance linkage the next implementation slice and introduces a distinct Shop visual identity, described in gate language as a distinct visual identity for the commercial-planning surface.

### Linkage scope

Shop may create and display the existing closed-taxonomy commercial links:

- `supplier supports requirement`;
- `supplier associated-with risk`;
- `contract supports requirement`;
- `contract funds spend-item`;
- `spend-item supports action`; and
- `spend-item supports requirement`.

The slice adds Shop-side link pickers for the first validation path and Workshop-side linked commercial context in Requirement, Action, and Risk detail surfaces. Links remain first-class Core `link` records and therefore flow through snapshots, Explorer bundles, import/export, and the Explorer Relationships Board without a new collection.

### Visual identity scope

Shop gets a distinct commercial-planning identity within the PSPF family:

- visual tone: clear, practical, commercially focused, and less compliance-dense than Workshop;
- accent direction: procurement amber/teal over neutral VS Code surfaces, used sparingly and never as the only status cue;
- core motifs: obligation, renewal, funding, expected savings, payback, supplier concentration, and linked assurance impact;
- primary surface: a Shop Home/Forecast webview that summarises Core-backed commercial records, linked assurance coverage, forecast cost, expected savings, and records needing linkage;
- copy style: plain commercial questions such as “Which actions depend on funding?” and “Which suppliers affect high-risk work?”.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.18.0"`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new entity type, collection, link verb, field, or published JSON Schema directory is introduced.

## Consequences

Positive:

- Shop becomes useful to assurance operators because commercial records explain requirement, action, and risk context.
- Workshop users can see commercial dependencies without switching mental models or treating Shop as a disconnected ledger.
- Explorer can show the same relationships through existing bundle/link handling.
- The identity work makes Shop feel like a product surface rather than a thin list of records.

Trade-offs:

- The slice depends on careful picker constraints so invalid commercial links cannot be created.
- Workshop item detail surfaces gain more contextual data and need compact presentation to avoid clutter.
- Shop identity work must stay inside VS Code webview and theme constraints rather than trying to become a separate web app.

## Deferred

v1.18 does not add CSV/procurement import, finance reconciliation, realised-vs-expected savings tracking, approvals, Pub integration, editable Explorer commercial views, chart/PDF export, multi-user commercial plans, Marketplace publication of the Shop extension, or new compatibility axes.