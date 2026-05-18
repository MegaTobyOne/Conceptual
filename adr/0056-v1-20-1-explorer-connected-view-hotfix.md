# 0056 - v1.20.1 Explorer Connected View Hotfix

- Status: accepted
- Date: 2026-05-19

## Context

v1.20 shipped the shared Connected View in Workshop and Explorer. Early user feedback reported that Connected View was not working reliably in Explorer, with a related concern that some Explorer widget counts might not refresh after local authoring changes.

The local runtime probe showed Explorer can render a linked Direction -> Requirement -> Risk -> Action chain and can refresh Overview counts after a local Action is added. The gap was release confidence: the Explorer publication smoke did not assert Connected View cards, chain selection, edge rendering, or local count refresh.

## Decision

Ship v1.20.1 as a patch release that keeps the v1.20 feature scope and compatibility axes unchanged while adding focused Explorer regression coverage.

The patch adds an Explorer publication regression fixture that:

- renders a linked Direction, Requirement, Risk, and Action chain in Explorer Connected View;
- verifies cards and SVG edges are present;
- verifies selecting a Requirement highlights the connected chain;
- adds a local Explorer Action and verifies the Overview Action count increments; and
- verifies the local Action appears in Connected View with a new edge.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.20.1"`.
- Package versions: `1.20.1`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new schema directory, entity type, field, link verb, bundle file, or compatibility axis.

## Consequences

Positive:

- Explorer Connected View and local count refresh now have direct automated release coverage.
- Future feedback about a specific bundle can be compared against a known passing linked-chain fixture.

Trade-offs:

- This is a confidence and regression hardening patch, not a Connected View feature expansion.
- Editable graph behaviour, edge filters, impact-weighted layout, and export remain deferred.