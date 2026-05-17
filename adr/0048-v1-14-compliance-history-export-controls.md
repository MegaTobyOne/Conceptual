# 0048 - v1.14 Compliance history export controls

- Status: accepted
- Date: 2026-05-17

## Context

Explorer local-authoring mode already treats compliance events as append-only local history. That preserves traceability, but it also means a local-authoring export can carry detailed status-change history when an operator only intends to send the current effective assessment state back to Workshop.

`explorer-screen-workflow-spec.md` already defines the v1 retention rule: compliance history is never pruned automatically, and the first control is an export-time `Include compliance history` toggle, default on. v1.14 is the smallest useful slice that turns that rule into an operator-visible control without changing the master bundle schema.

## Decision

v1.14 implements compliance-history export controls in Explorer local-authoring mode.

The Explorer `Local Changes` export surface adds a plainly labelled `Include compliance history` toggle:

- default: on;
- when on, `Export local JSON` includes the existing `compliance-events` collection when events are present;
- when off, `Export local JSON` omits `compliance-events` from both the exported collections object and the manifest collection list;
- the export remains a standard master bundle with `generator.product = "pspf-explorer"` and `generator.mode = "local-authoring"`; and
- the toggle is export-scoped UI state, not stored in the bundle, not persisted as a saved view, and not a local prune operation.

Workshop/Core import must tolerate local-authoring bundles that omit `compliance-events`, while still preserving current-state `requirements` and `compliance-entries` semantics. Import review should clearly show when a bundle contains no compliance history because the exporter intentionally excluded it.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.14.0"`.
- `VERSION_AXES` remains at `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- No new entity type, collection, link verb, field, or schema directory is introduced.
- Existing schema consumers must continue to tolerate absent optional collections according to the master-bundle rules.

## Consequences

Positive:

- Operators can send current local assessment changes without automatically sharing the full local compliance event trail.
- The control matches the already documented v1 retention model and avoids introducing retention/prune complexity.
- The change keeps Explorer local-authoring exports compatible with Workshop import review and existing redaction checks.

Trade-offs:

- A receiver may lose useful status-change context if the exporter turns history off.
- The choice is made per export rather than as a persistent workspace preference, so operators must deliberately check it each time.
- This does not solve long-term retention, pruning, or audit-pack policy.

## Deferred

v1.14 does not add local compliance-history pruning, age-based history filters, automatic retention windows, signed audit attestations, before/after diff views, change-record tagging, editable posture, Shop, Pub, chart image export, plan baselines, Open VSX publishing, or a separate release channel.
