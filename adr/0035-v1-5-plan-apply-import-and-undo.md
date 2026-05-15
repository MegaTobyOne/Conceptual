# ADR 0035 — v1.5 plan-apply import and undo

- Status: accepted
- Date: 2026-05-15

## Context

v1.4 completed Explorer local Risks, conflict display, improved local-authoring navigation, and Explorer local JSON import feedback. The manual operator validation was clean.

The remaining import trust gap is that operators need to see a plan before applying Explorer local-authoring work, understand conflicts, and undo a recent additive or plan-applied import if the result is not what they expected.

## Decision

Ship v1.5 as the import confidence slice.

1. Package versions and `PSPF_SLICE_VERSION` bump to `1.5.0`.
2. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
3. Core supports `plan-apply` as an import mode using existing master bundle records and existing entity/link types.
4. Core exposes a read-only import planner. Planning validates and classifies records, but makes no writes.
5. Workshop/Core import UI exposes `Plan, review, apply`; the operator must explicitly choose `Apply Import` before records are written.
6. Import summaries include created, updated, unchanged, written, per-type counts, examples, and conflict/update examples.
7. Additive and plan-applied imports write a pre-import undo snapshot.
8. Core exposes `PSPF: Undo Last Import`, and import completion toasts expose `Undo Import`.
9. v1.5 does not introduce new entity types, collections, schema directories, compatibility-axis changes, editable posture, tags, saved views, compliance-history export controls, Shop, or Pub.

## Consequences

- Explorer local-authoring exports can be reviewed before apply without relying on a blind additive merge.
- Operators get a clearer explanation of what changed and a short-lived recovery path for the last additive or plan-applied import.
- Undo is implemented as a local pre-import snapshot restore for this slice. Richer per-record transaction journals can replace it later if compliance-event history becomes broader.

## Alternatives considered

- **Build a full graphical review pane first.** Deferred; VS Code modal review plus output-channel details gives the operator the core safety behaviour now.
- **Require plan-apply for every import.** Rejected; full-replace restore and additive merge remain useful explicit modes.
- **Bump schema axes for import metadata.** Rejected; v1.5 changes import behaviour only and uses existing records.