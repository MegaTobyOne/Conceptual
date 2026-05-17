# 0044 — v1.10 Workshop change-record foundation

- Status: accepted
- Date: 2026-05-17

## Context

User validation of v1.9 and review of the external 12-month cyber plan concept (`pspf-plan-spec.md`) confirmed the most valuable missing capability is structured, lightweight tracking of *significant* plan and posture changes — not field-level history. Operators need to record why a priority, direction, requirement, action, or risk moved, what it affected, and whether the impact is temporary or persistent, in a form that survives Workshop → Explorer publication and round-trips through plan-apply.

`pspf-plan-spec.md` also led to a deliberate ecosystem split: most planning capability lands inside existing Workshop and Explorer surfaces first, with a possible future "PSPF Plan" product (own ADR, own package) sharing the same master JSON bundle. v1.10 proves the change-rationale model inside Workshop and Explorer before any new product surface is opened.

Multi-user collaboration, authentication, RBAC, real-time sync, and full PMO scheduling remain explicitly out of scope.

## Decision

v1.10 introduces a new canonical entity `change-record` owned by Workshop and rendered read-only in Explorer.

### Entity shape

`change-record` (ID prefix `CHG`, UUIDv7, timestamp stripped on publication per ADR 0002) fields:

- `id`, `kind = "change-record"`, `title` — public.
- `changeType` — closed enum: `priority`, `direction`, `scope`, `timeline`, `dependency`, `risk-response`, `posture`, `other` — public.
- `raisedAt`, `effectiveAt`, `reviewDueAt` — public ISO dates.
- `status` — closed enum: `proposed`, `active`, `resolved`, `absorbed`, `withdrawn` — public.
- `persistence` — closed enum: `temporary`, `persistent` — public.
- `source` — closed enum: `executive-direction`, `risk-event`, `compliance-event`, `operational`, `external-trigger`, `other` — public.
- `summary` — short headline string — public.
- `reason` — free text — **`sensitive` by default** (publication policy per ADR 0005).
- `impactSummary` — free text — **`sensitive` by default**.
- `decisionOwnerRef` — optional `Person` reference; never published (consistent with existing Person redaction rules).

No editable posture, no scoring, no workflow approvals. Status transitions are author-controlled in Workshop.

### Links

Adds one new link verb to the closed taxonomy (ADR 0003):

- `changes` — directional, from `change-record` to one of `requirement | action | risk | direction | tag | saved-view`.

`change-record` participates in existing `related-to` and `addressed-by` only where the taxonomy already allows generic entity targets. No other verbs are extended in this release.

### Workshop behaviour

- New Change Records list view with filters (status, persistence, changeType, date range, affected entity).
- Item Detail panel for `change-record` with rationale, impact, and affected-entity links.
- New "Record significant change" command available from Requirement, Action, Risk, and Direction detail panels; pre-fills the `changes` link target.
- Workshop saved-view scopes are not expanded in v1.10. The reserved `workshop-dashboard` and `workshop-evidence-review` scopes remain reserved.

### Explorer behaviour

- Explorer reads `change-record` and `changes` links and renders them read-only.
- A small "Why this changed" rail appears on Requirement, Action, Risk, and Direction detail when at least one `changes` link references the item.
- Stakeholder-facing copy honours the default-deny redaction rule: `reason` and `impactSummary` are suppressed unless the bundle was generated with sensitive fields included by the operator.
- Explorer local-authoring does **not** propose change records in v1.10. Local proposal of change records is deferred to v1.11 alongside the Explorer change story.

### Snapshots, bundles, plan-apply

- Snapshots include `change-record` entities and `changes` links.
- The master JSON bundle adds `collections/change-records.json` and extends `links.json` with the new verb.
- Plan-apply (ADR 0035) treats `change-record` as importable like other Workshop-owned entities, subject to the existing import-review gates (ADR 0037).
- Erasure semantics (ADR 0006) apply: deleting a referenced entity tombstones its `changes` edges; the `change-record` itself survives so historical rationale is not lost.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.10.0"`.
- `VERSION_AXES` bumps to `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- Publish `schemas/explorer-bundle/1.7.0/` containing:
  - `collections/change-records.schema.json` (new).
  - Updated `collections/links.schema.json` with the `changes` verb.
  - Updated `manifest.schema.json` listing the new collection.
- Earlier schema directories remain immutable (ADR 0012).
- Additive-only compatibility: consumers on 1.6.0 must continue to load 1.7.0 bundles by ignoring `change-records` and unknown link verbs.

## Plan of work

1. **Contracts and schema** — add `ChangeRecord` types, `changes` link, Ajv schemas, fixture and round-trip tests; bump `VERSION_AXES` and `PSPF_SLICE_VERSION`.
2. **Core** — write/validate/refresh path for change records and `changes` links; snapshot, export, and plan-apply integration; redaction enforcement for `reason` and `impactSummary`.
3. **Workshop** — Change Records list, Item Detail, "Record significant change" command, link picker for affected entities, status transitions.
4. **Explorer** — read-only collection, "Why this changed" rail on affected-entity detail, ignore unknown scopes safely on older bundles.
5. **Quality gates** — extend acceptance gates: redaction tests for `reason`/`impactSummary`, AU-English lint coverage of new copy, additive-compatibility test loading a 1.7.0 bundle into a simulated 1.6.0 consumer, release-readiness covers new schema directory.
6. **Docs** — update `pspf-entity-link-spec.md`, `pspf-explorer-json-bundle-schema-spec.md`, `pspf-security-redaction-controls.md`, `pspf-invariants.md`, `pspf-glossary.md`, and `pspf-spec-consistency-index.md` (new locked rule for change records).

## Deferred

v1.10 does not add: Explorer-authored change records, before/after diff views, cumulative impact analytics, change-record tagging (Tags v1.7 currently targets Requirements), plan baselines or `plan-baseline` snapshot subtype, compliance-history export controls, tag hierarchies, private/team saved views, default-start views, editable posture, Shop, Pub, chart image export, or a separate PSPF Plan package.

## Consequences

Workshop becomes the system of record for change rationale and impact in the same way it is for assessment data. Explorer surfaces the *why* of a moving posture without taking authoring responsibility. The master JSON bundle continues to carry every product surface through a single additive schema bump, leaving room for v1.11 to close the Explorer story and v1.12 to test planning-lens workflows before any PSPF Plan ADR is opened.
