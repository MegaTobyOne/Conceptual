# ADR 0031 — v1.1 Explorer local-authoring phase 1

- Status: accepted
- Date: 2026-05-14

## Context

ADR 0030 selected Explorer local-authoring phase 1 as the next feature tranche after the v1.0.1 validation patch. The original Explorer specification already defines browser-local authoring, but the full surface includes storage, editing, conflict handling, import planning, undo, and broader local records. Shipping all of that in one release would obscure the first question operators need answered: can Explorer safely hold a user's own local status work and return it to the workspace through the normal bundle path?

## Decision

Ship v1.1 as a narrow Explorer local-authoring phase 1 release.

1. Package versions and `PSPF_SLICE_VERSION` bump to `1.1.0`.
2. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
3. Explorer adds an `IndexedDB`-backed local store for per-user Requirement `assessmentStatus` overlays.
4. Local edits are scoped to the loaded bundle/workspace key, overlay the bundle baseline at render time, and visibly show baseline versus local status.
5. Explorer can export the effective bundle as the existing master JSON format with `generator.product = "pspf-explorer"` and `generator.mode = "local-authoring"`.
6. Explorer exposes storage status and a reset-local-data path for the phase-1 store.
7. No new schema directory, entity type, collection, or compatibility-axis bump is introduced for v1.1.
8. `plan-apply`, local evidence/action/risk creation, editable posture, chart image export, Shop, and Pub remain deferred.

## Consequences

- v1.1 proves user-owned persistence without making Explorer the system of record.
- Core can import v1.1 Explorer-authored bundles through the existing master-bundle import path because the exported records stay within the existing `1.3.0` entity contract.
- Explorer local authoring remains intentionally smaller than Workshop authoring. It is a status overlay and round-trip mechanism, not a parallel assessment workspace.
- The next Explorer authoring tranche can decide whether to add compliance-event history, lightweight notes, evidence references, and conflict review.

## Alternatives considered

- **Add new `compliance-entries` records immediately.** Rejected for v1.1 because it would require schema and contract expansion before the local persistence pattern is validated.
- **Implement `plan-apply` with the first local authoring release.** Rejected because phase 1 can round-trip through existing full-replace/additive import paths.
- **Keep local status only in memory.** Rejected because the user specifically needs a persistent user-owned local store.