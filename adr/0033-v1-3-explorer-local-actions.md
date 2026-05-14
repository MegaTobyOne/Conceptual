# ADR 0033 — v1.3 Explorer local actions

- Status: accepted
- Date: 2026-05-14

## Context

v1.1 proved browser-local Requirement status overlays. v1.2 added lightweight local evidence references, materialised as existing `evidence` records plus `supported-by` links. The next useful Explorer local-authoring increment is lightweight action capture: during review, a user needs to record follow-up work against a Requirement without switching back to Workshop immediately.

The existing `action` entity and `links` collection already support this path. A local Explorer Action can be exported as an existing `action` record with `sourceProduct = "explorer"`, linked from the Requirement by an `addressed-by` link.

## Decision

Ship v1.3 as Explorer local-authoring phase 3.

1. Package versions and `PSPF_SLICE_VERSION` bump to `1.3.0`.
2. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
3. Explorer adds an `IndexedDB`-backed local action store, scoped to the loaded bundle/workspace key.
4. A user can add a local Action to a Requirement with title, status, and optional due date.
5. Explorer materialises each local Action as an existing `action` record plus an `addressed-by` `link` from the Requirement to the Action, both with `sourceProduct = "explorer"`.
6. Local Actions overlay the loaded bundle for rendering and export through the existing master bundle format with `generator.mode = "local-authoring"`.
7. Reset local data clears Requirement status overlays, local evidence references, and local Actions for the loaded bundle key.
8. No new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, local Risk creation, editable posture, Shop, or Pub is introduced in v1.3.

## Consequences

- Explorer can now round-trip local status, evidence, and follow-up work items without becoming the system of record.
- Core import can consume v1.3 Explorer-authored bundles through the existing entity import path because the data uses existing `action` and `link` records.
- Local Action capture remains deliberately lightweight. Rich Action Impact editing, risk-action linking, duplicate-title review, and `plan-apply` remain later decisions.

## Alternatives considered

- **Add local Risks at the same time.** Rejected to keep v1.3 small enough to validate manually.
- **Add custom Explorer-only work-log records.** Rejected because the existing `action` entity already represents follow-up work and exports cleanly.
- **Implement `plan-apply` before local Actions.** Rejected because v1.3 still exports normal master bundles that Core can import through existing full-replace/additive paths.