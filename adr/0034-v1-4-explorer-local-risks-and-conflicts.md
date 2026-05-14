# ADR 0034 — v1.4 Explorer local Risks and conflict display

- Status: accepted
- Date: 2026-05-15

## Context

v1.1 introduced browser-local Requirement status overlays. v1.2 added local evidence references. v1.3 added local Actions and proved the round trip from Explorer local-authoring export through Core import back into Workshop review.

Operator validation showed that the remaining useful local-authoring increment is lightweight Risk capture and clearer feedback when local status overlays sit on top of a refreshed bundle baseline.

## Decision

Ship v1.4 as Explorer local-authoring phase 4.

1. Package versions and `PSPF_SLICE_VERSION` bump to `1.4.0`.
2. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
3. Explorer adds an `IndexedDB`-backed local Risk store scoped to the loaded bundle/workspace key.
4. A user can add a local Risk to a Requirement with title, status, likelihood, and impact.
5. Explorer materialises each local Risk as an existing `risk` record plus an `exposed-by` `link` from the Requirement to the Risk, both with `sourceProduct = "explorer"`.
6. Explorer shows a local status conflict indicator when a saved local status overlay was authored against a different baseline status than the currently loaded bundle.
7. Explorer uses a stable workspace/snapshot storage key where available, so local authoring can survive refreshed bundle exports from the same workspace and expose conflicts.
8. The existing round-trip gate remains mandatory: Explorer local-authoring export imports through Core and is visible through Workshop/Core entity APIs.
9. No new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, saved views, compliance-history export control, editable posture, Shop, or Pub is introduced in v1.4.

## Consequences

- Explorer can now capture local status, evidence, Actions, and Risks without becoming the system of record.
- Local Risk data remains compatible with existing Core and Workshop import paths because it uses existing `risk` and `link` records.
- Conflict display is intentionally informational. v1.4 does not classify or resolve conflicts; plan/review/apply remains a later import workflow.
- Tags, saved views, and compliance-history export controls remain candidates for later polish once the core local-authoring loop is stable.

## Alternatives considered

- **Ship tags and saved views with Risks.** Deferred to avoid expanding navigation and schema expectations while validating the authoring loop.
- **Add plan/review/apply now.** Deferred because conflict classification, review UI, transaction summaries, and undo semantics are a larger import contract.
- **Add posture editing.** Rejected for v1.4; posture remains derived/read-only unless scope is deliberately reopened.