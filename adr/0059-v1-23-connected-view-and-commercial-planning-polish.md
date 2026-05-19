# 0059 - v1.23 Connected View Controls and Commercial Planning Polish

- Status: accepted
- Date: 2026-05-19

## Context

v1.22 repairs the Explorer Connected View shell, makes Workshop Saved Views and browse/list navigation more usable, adds bounded `today` due-date entry, and makes backup JSON import/export discoverable through the existing validated bundle path.

Several useful enhancements remain deliberately outside the v1.22 closure: graph controls for webpage users, selected-chain discoverability, Shop spend-linking cues, and the office/cost-centre question for spend reporting. These need their own design decision because some are pure UI improvements while cost-centre reporting requires a small schema, publication-policy, and import/export change when stored on spend items.

## Decision

Use v1.23 for Connected View controls and commercial-planning polish.

The v1.23 slice adds:

- Explorer-first Connected View zoom controls: zoom in, zoom out, and reset, implemented without changing relationship semantics;
- lane visibility controls for dense Connected View boards, starting with Directions, Risks, Actions, and Requirement/domain lanes;
- selected-chain navigation that scrolls the first selected or highlighted card into view and makes the connected chain easier to find;
- a decision on whether zoom/lane/selection controls remain Explorer-only shell behaviour or graduate into the shared `@pspf/connected-view` package for Workshop reuse;
- Shop cues for spend items without an existing `contract funds spend-item` link;
- a quick path from unlinked spend cues to the existing commercial-link flow;
- an optional `SpendItemEntity.costCentre` text field for simple financial-year/cost-centre table exports, with a `pspf.shop.defaultCostCentre` setting used only to prefill new spend items;
- sensitive publication policy for the optional cost-centre field, keeping it out of Explorer publication bundles while preserving it in local Core/Shop records and Shop CSV/XLS exports; and
- no editable graph, drag-to-link, new link verbs, office entity, cost-centre hierarchy, or new commercial workflow state.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.23.0"`.
- Package versions: `1.23.0`.
- Because the optional spend-item cost-centre field is accepted, `VERSION_AXES` bumps to `schemaVersion = bundleVersion = apiVersion = "1.9.0"`.
- `schemas/explorer-bundle/1.9.0/` is published for the new compatibility axes; `costCentre` remains excluded from Explorer publication schemas because it is sensitive.

## Consequences

Positive:

- Explorer webpage users get practical controls for large relationship boards without waiting for a separate graph product.
- Shop can steer operators toward contract-linked spend using the existing relationship model.
- Cost-centre reporting is handled as a conscious, minimal spend-item text field rather than a hidden UI-only export value or a larger organisational model.

Trade-offs:

- Zoom can make edge drawing and keyboard navigation more complex; lane hiding and scroll-to-selection should land first if implementation risk rises.
- Cost-centre text introduces publication-policy and schema maintenance cost, but avoids an office entity, lookup table, hierarchy, or finance-system integration.
- v1.23 remains read-only for Connected View. Editable graph operations stay out of scope.