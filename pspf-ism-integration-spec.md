# PSPF ISM Integration Specification

## Status

Active. Phases 1-3 are **implemented** for the current seeded source-library slice (see [pspf-development-readiness-review.md](pspf-development-readiness-review.md)): read-only ISM source library (`SRC-*`), first-class Requirement to ISM control mapping (`MAP-*`) with confidence and review metadata, drift visibility, and the posture-brief ISM coverage section. Phases 1-3 are governed by [adr/0017-ism-integration-roadmap.md](adr/0017-ism-integration-roadmap.md), and fixed by [adr/0018-ism-source-library.md](adr/0018-ism-source-library.md), [adr/0019-requirement-control-mapping.md](adr/0019-requirement-control-mapping.md), and [adr/0020-ism-mapping-quality-and-drift.md](adr/0020-ism-mapping-quality-and-drift.md).

Phase 4 ("ISM control as a workable assurance entity", [adr/0071-v1-35-ism-control-as-workable-entity.md](adr/0071-v1-35-ism-control-as-workable-entity.md)) extends ISM controls to carry their own directly linked evidence, actions, and risk, mirroring the PSPF Requirement operator spine. Phase 4a (v1.35) lands direct control-to-work linking and Phase 4b (v1.35) adds an `internal` `implementationStatus` posture with ISM-by-status navigation, both with no schema-version bump; bidirectional posture rollups follow in Phase 4c.

## Purpose

PSPF is the Australian Government's **Protective Security Policy Framework** (assurance outcomes, administered by Home Affairs). The **Information Security Manual** is ASD/ACSC's implementation control catalogue. Operators routinely need to answer "which ISM controls implement this PSPF requirement?" and the inverse. This spec defines how PSPF will represent ISM controls and their relationship to PSPF requirements **without breaking the v0.1 thin slice**.

The two frameworks are deliberately modelled as distinct entities. ISM is not a second class of PSPF Requirement; it is an external authority catalogue that PSPF Requirements reference through explicit mapping records.

## Authoritative source

- Human-readable ISM: <https://www.cyber.gov.au/ism>
- Machine-readable ISM OSCAL catalogue: <https://github.com/AustralianCyberSecurityCentre/ism-oscal>
- Current upstream release at the time of writing: `v2026.03.24` (the March 2026 ISM).
- Licence: CC BY 4.0. Any product surface that displays vendored ISM text shows attribution to ASD/ACSC.

Each OSCAL release ships a master `ISM_catalog.{json,xml,yaml}` plus resolved profile catalogues for Essential Eight ML1/ML2/ML3 and the classification baselines (Non-classified, OFFICIAL: Sensitive, PROTECTED, SECRET, TOP SECRET).

## Phasing summary

| Phase | Target version | Scope |
|---|---|---|
| 0 | v0.1 | No model change. ISM references are free text in `Evidence.reference`, `Action.notes`, `Risk.notes`. |
| 1 | v0.2 | Read-only ISM source library: vendored OSCAL snapshot → `source-control` (`SRC-*`) entities, browsable in Workshop and Explorer. See ADR 0018. |
| 2 | v0.2 | First-class **Requirement ↔ ISM control mapping** entity (`MAP-*`) with `rationale`, `coverageQualifier`, `applicabilityProfile`. Posture brief gains an ISM coverage section. See ADR 0019. |
| 3 | v0.3 | Mapping `confidence`, `lastReviewedAt`, `reviewBy`; automated version-drift detection across OSCAL releases. The profile picker remains deferred. See ADR 0020. |
| 4a | v1.35 | **ISM control as a workable entity**: direct `source-control` to evidence/action/risk linking (`supported-by`, `addressed-by`, `exposed-by`), no schema-version bump. See ADR 0071. |
| 4b | v1.35 | `SourceControl.implementationStatus` posture (`internal`, stripped at publication) plus implementation column, filter, and metric on the ISM control browser for navigation by posture. No schema-version bump; a dedicated `workshop-source-controls` saved-view scope remains deferred. See ADR 0071. |
| 4c | v1.37+ | Bidirectional posture rollups and unified PSPF Requirement / ISM control obligation navigation. See ADR 0071. |

## Phase 1 — Read-only ISM Source Library

### Vendored snapshot

- OSCAL files live under `packages/ism-source-library/data/<oscalRelease>/` and are imported at build time.
- No runtime network fetch. Snapshot replacement is an explicit operator command, never automatic.
- Snapshot provenance is mandatory: every `SRC-*` record carries `oscalRelease` (e.g. `v2026.03.24`), `catalog` (filename), `profile` (filename or `null` for the master catalogue), and `sourceUrl`.

### Entity sketch — `SourceControl` (prefix `SRC`)

| Field | Type | Publication policy | Notes |
|---|---|---|---|
| `id` | string | n/a | `SRC-<UUIDv7>`, time-stripped on publication per ADR 0002 |
| `entityType` | string | n/a | `source-control` |
| `controlId` | string | `public` | Natural ISM identifier (e.g. `ISM-0123`) |
| `title` | string | `public` | ISM control title |
| `statement` | string | `public` | ISM control text from OSCAL |
| `profileTags` | string[] | `public` | E.g. `e8-ml2`, `official-sensitive` |
| `externalRefs` | object[] | `public` | `{ scheme, value }` — at minimum the OSCAL UUID and the ISM control identifier |
| `provenance` | object | `public` | `{ oscalRelease, catalog, profile, sourceUrl }` |
| `localApplicabilityNote` | string | `sensitive` | Optional operator note; not editable in v0.1 |
| `createdAt` / `updatedAt` | string | `internal` | Snapshot-time, not authoring-time |

The bundle schema gains a `source-controls` collection. `bundleVersion` rolls forward; `schemaVersion` rolls forward when the runtime entity schema changes.

### Workshop and Explorer surfaces

- Workshop Item Detail for a Requirement displays an "ISM references" panel listing linked `SRC-*` records (read-only in Phase 1).
- Explorer publication mode renders the same panel and a stand-alone ISM source browser scoped to the bundle's `source-controls` collection.
- No "Edit" affordance on `SRC-*` records. Attribution line: *"ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release `<oscalRelease>`."*

## Phase 2 — Explicit Requirement ↔ ISM control mapping

### Entity sketch — `RequirementControlMapping`

ADR 0019 fixes the mapping as a first-class entity with prefix `MAP`. The closed 22-verb link taxonomy remains unchanged in v0.2. Shape:

| Field | Type | Publication policy | Notes |
|---|---|---|---|
| `id` | string | n/a | `MAP-<UUIDv7>` |
| `requirementId` | string | `internal` | `REQ-*` endpoint |
| `sourceControlId` | string | `internal` | `SRC-*` endpoint |
| `coverageQualifier` | enum | `internal` | `primary`, `partial`, `compensating` |
| `applicabilityProfile` | string | `internal` | E.g. `e8-ml2`, `official-sensitive`, or `all` |
| `rationale` | string | `sensitive` | Operator interpretation; default-deny applies |
| `provenance` | object | `internal` | `{ author, createdAt, oscalRelease }` |

### Link taxonomy implications

The closed 22-verb vocabulary in ADR 0003 cannot carry mapping attributes (`coverageQualifier`, `applicabilityProfile`, `rationale`) inside a `Link` row. ADR 0019 therefore keeps mapping attributes on `requirement-control-mapping` and does not add `mapped-to` in v0.2. Products may derive read-only navigation edges from mappings, but the mapping entity is the source of truth.

### Posture brief

The posture brief (E27) gains an **ISM coverage** section. Every claim ("57% of Essential Eight ML2 ISM controls are mapped to PSPF Requirements with `primary` coverage") must trace to backing mapping records. Free-form ISM claims are forbidden.

## Phase 3 — Mapping quality and version drift

- Mapping gains required `confidence ∈ {low, medium, high}`, optional `lastReviewedAt`, and optional `reviewBy` (free text, not a `Person` link to preserve personal-data exclusion).
- Source controls gain `statementChangeStatus ∈ { unchanged, changed, new, removed }`.
- An automated harness compares the active vendored OSCAL release against the previous one and flags every mapping whose `sourceControlId` has a changed, new, or removed statement.
- The Posture profile picker is deferred beyond v0.3.

## Cross-cutting constraints

1. **No network egress at runtime** in any phase (E1, ADR 0011).
2. **Default-deny publication** (ADR 0005). Every new field declares a `publication` policy; CI rejects missing policy.
3. **UUIDv7 with time-stripping on the publication boundary** (ADR 0002). Natural ISM identifiers travel in `externalRefs`, never as the canonical key.
4. **AU English in product copy** (ADR 0016). Vendored ISM text is preserved verbatim (the ISM is already Australian English).
5. **OFFICIAL: Sensitive labelling-only** (ADR 0011). Mapping rationale and operator interpretation are at minimum `sensitive`.
6. **CC BY 4.0 attribution** for vendored ISM text.

## Acceptance gates

See [pspf-acceptance-and-quality-gates.md](pspf-acceptance-and-quality-gates.md) § v0.2 candidate gates (ISM integration). Headline gates: OSCAL ingest reproducibility, ISM provenance presence, no runtime egress, mapping redaction, mapping round-trip survival, and version-drift detection.

## Out of scope

- ISM authoring or editing inside the product.
- Live fetch of ISM data from cyber.gov.au or GitHub at runtime.
- Modelling ISM controls as PSPF Requirements.
- Mapping to non-ISM control catalogues (NIST 800-53, ISO 27001, etc.) in v0.2. The `SRC` entity is general enough to accommodate them later, but no other catalogue is committed.
