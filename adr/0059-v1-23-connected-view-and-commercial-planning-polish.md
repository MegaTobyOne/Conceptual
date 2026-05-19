# 0059 - v1.23 Connected View Controls and Commercial Planning Polish

- Status: accepted
- Date: 2026-05-19

## Context

v1.22 repairs the Explorer Connected View shell, makes Workshop Saved Views and browse/list navigation more usable, adds bounded `today` due-date entry, and makes backup JSON import/export discoverable through the existing validated bundle path.

Several useful enhancements remain deliberately outside the v1.22 closure: graph controls for webpage users, selected-chain discoverability, Shop spend-linking cues, and the office/cost-centre question for spend reporting. These need their own design decision because some are pure UI improvements while office/cost-centre may require schema, publication-policy, and import/export changes.

## Decision

Use v1.23 for Connected View controls and commercial-planning polish.

The v1.23 slice adds:

- Explorer-first Connected View zoom controls: zoom in, zoom out, and reset, implemented without changing relationship semantics;
- lane visibility controls for dense Connected View boards, starting with Directions, Risks, Actions, and Requirement/domain lanes;
- selected-chain navigation that scrolls the first selected or highlighted card into view and makes the connected chain easier to find;
- a decision on whether zoom/lane/selection controls remain Explorer-only shell behaviour or graduate into the shared `@pspf/connected-view` package for Workshop reuse;
- Shop cues for spend items without an existing `contract funds spend-item` link;
- a quick path from unlinked spend cues to the existing commercial-link flow;
- an explicit office/cost-centre decision: either defer as reporting metadata, or introduce optional spend fields with publication policy, schema coverage, and bundle import/export support; and
- no editable graph, drag-to-link, new link verbs, or compatibility-axis change unless office/cost-centre fields are accepted.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.23.0"`.
- Package versions: `1.23.0`.
- If v1.23 only adds Connected View controls and spend-linking cues, `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- If office/cost-centre fields are accepted, schema, bundle, and API axes must bump together and a new schema directory must be published.

## Consequences

Positive:

- Explorer webpage users get practical controls for large relationship boards without waiting for a separate graph product.
- Shop can steer operators toward contract-linked spend using the existing relationship model.
- Office/cost-centre reporting is handled as a conscious data-model decision rather than hidden UI-only metadata.

Trade-offs:

- Zoom can make edge drawing and keyboard navigation more complex; lane hiding and scroll-to-selection should land first if implementation risk rises.
- Office/cost-centre fields introduce publication-policy and schema maintenance cost; deferral remains acceptable if contract linkage answers the immediate workflow.
- v1.23 remains read-only for Connected View. Editable graph operations stay out of scope.