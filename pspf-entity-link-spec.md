# PSPF Canonical Entity and Link Specification

## Overview

This specification defines the canonical entity model and relationship model for the PSPF ecosystem. It is intended to support the Core runtime datastore, the Core API, JSON import/export bundles, Explorer compatibility, fixture generation, and long-term schema governance.

The design is based on a small set of stable principles:

- entity identities must be globally unique, immutable, and type-guiding,
- cross-product links must be explicit and queryable,
- runtime data must support both current-state queries and defensible history,
- JSON interchange should be schema-governed,
- and relational integrity should be preserved in the local SQLite store through explicit relationships and foreign key discipline where practical.

The JSON interchange layer should align to the dialect selected by the owning bundle specification. For Explorer v1, `pspf-explorer-json-bundle-schema-spec.md` owns the decision to use JSON Schema Draft 07 because it has stronger current tooling for the v1 implementation path.

## Model goals

The canonical model must support five use cases at the same time:

1. day-to-day operational editing in Workshop, Shop, and Pub,
2. reliable linking across suppliers, people, requirements, actions, and risks,
3. reporting snapshots and Explorer import/export,
4. schema evolution without breaking historical records,
5. and defensible assurance with provenance and change history.

## Design principles

### Canonical entities over screen models

The model should describe durable business objects, not transient UI shapes. Screen-specific projections should be derived from canonical entities, not encoded as separate first-class data shapes.

### Explicit links over informal embedding

Relationships that matter operationally or for reporting must be represented explicitly. Embedded IDs are allowed as optimisation or denormalised convenience, but the link itself must remain queryable and attributable.

### Immutable canonical IDs

Every entity must have a canonical immutable ID. The ID format uses a readable type prefix and a UUIDv7 token. UUIDv7 retains time-sortable properties for index locality while remaining a standard format with strong library support.

For any artefact eligible to leave the workspace boundary (JSON bundles, Explorer publication, support logs shared externally), the 48-bit Unix-millisecond timestamp prefix of the UUIDv7 MUST be zeroed before serialisation. The version (7) and variant (RFC 4122) bits are preserved. This prevents creation-time leakage in published artefacts. See ADR 0002.

IDs for `PER` (Person) and `ASM` (Assignment) entity types are time-stripped in **all** artefacts, including internal ones, so an internal log accidentally shared cannot leak personal timestamps.

### String enums for readability

Where enums are used in JSON interchange or API payloads, they should generally use readable strings rather than integer codes because string enums are more self-documenting and align well with JSON Schema validation patterns.

### Soft-delete by default

Business entities should generally use soft-delete or inactive states rather than destructive deletion, because linked records, history, and reporting defensibility are more important than aggressive record removal.

## Identity specification

### Canonical ID format

The canonical ID format is:

`<PREFIX>-<UUIDv7>`

Examples (internal storage form):

- `REQ-018f4c2a-0e3a-7c5e-9a4b-3f6d2c1e8a90`
- `EVD-018f4c2b-1c2d-7e4f-a1b2-8c9d0e1f2a3b`
- `ACT-018f4c2c-2a3b-7c4d-b5e6-f7a8b9c0d1e2`
- `RSK-018f4c2d-3b4c-7d5e-c6f7-a8b9c0d1e2f3`

Examples (time-stripped publication form, MUST be used for `PER`/`ASM` everywhere and for all entities at the publication boundary):

- `PER-00000000-0000-7c5e-9a4b-3f6d2c1e8a90`
- `ASM-00000000-0000-7d5e-c6f7-a8b9c0d1e2f3`

### ID rules

- Prefix is uppercase and fixed by entity type. See `pspf-invariants.md` § N3.
- Token is a UUIDv7 in lower-case hyphenated form.
- The 48-bit Unix-ms timestamp prefix is zeroed in any artefact eligible for publication or export. `PER` and `ASM` are zeroed always.
- Canonical IDs must never be reused, never encode mutable state, and survive export/import, snapshotting, and cross-product linking.
- ID transformation at the publication boundary is one-way and intentional; the random portion alone remains collision-resistant for v1 data volumes (concretely: <10⁹ items per ID prefix per workspace, well below UUIDv7's 74-bit random-part birthday bound). The importer detects and rejects any colliding `<PREFIX>-<UUIDv7>` on import; the exporter detects collisions in the time-stripped form and fails closed before writing a bundle.

### Display IDs

Optional short display IDs may exist for human-friendly tables and summaries, but they are not canonical keys and must never be used as the only identifier in exports or APIs.

### Prefix registry

| Prefix | Entity |
|---|---|
| `REQ` | Requirement |
| `EVD` | Evidence |
| `ACT` | Action |
| `RSK` | Risk |
| `SNP` | Snapshot |
| `RPT` | Report pack |
| `DOM` | Domain |
| `SUP` | Supplier |
| `CTR` | Contract |
| `SPD` | Spend item |
| `PER` | Person |
| `ROL` | Role |
| `TEM` | Team / unit |
| `ASM` | Assignment |
| `NTF` | Notification rule |
| `LNK` | Link record |
| `TAG` | Tag / classification label |
| `SRC` | Source control |
| `MAP` | Requirement-control mapping |

## Common entity envelope

Every canonical entity should share a common envelope, regardless of business type.

### Required common fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Canonical immutable ID |
| `entityType` | string | Canonical entity type enum |
| `schemaVersion` | string | Schema version active at write time |
| `createdAt` | string | ISO-8601 timestamp |
| `updatedAt` | string | ISO-8601 timestamp |
| `createdBy` | string | product/user/service origin identifier |
| `updatedBy` | string | product/user/service origin identifier |
| `sourceProduct` | string | originating product, e.g. `core`, `workshop`, `shop`, `pub`, `explorer` |
| `lifecycleState` | string | generic lifecycle state |
| `recordStatus` | string | active, archived, inactive, deleted-like state |
| `provenance` | object | source, import, or derivation metadata |
| `security` | object | sensitivity, handling, or export metadata |

### Optional common fields

| Field | Type | Description |
|---|---|---|
| `displayId` | string | optional short human-friendly ID |
| `title` | string | human-readable primary label |
| `summary` | string | short explanatory text |
| `tags` | array | classification tags |
| `deletedAt` | string/null | soft-delete timestamp |
| `deletedBy` | string/null | soft-delete actor |
| `supersedesId` | string/null | prior record replaced by this one |
| `externalRefs` | array | references to external identifiers |

### Provenance object

The `provenance` object should support:

- `originType` — manual, import, derived, migrated, generated,
- `originSource` — file, extension, user, bundle, script,
- `importBundleId` — optional,
- `snapshotId` — optional,
- `notes` — optional.

### Security object

The `security` object supports:

- `classification` — one of `public`, `internal`, `sensitive`, `restricted`. Default for new fields is `sensitive`. See ADR 0005.
- `containsSecrets` — boolean; if true, the entity is not exportable under any profile.
- `redactionEvents` — array of references to redaction events that have superseded fields on this entity. See ADR 0006.

The earlier `exportable` and `redactionLevel` fields are retired. Publication eligibility is computed from the per-field `publication` policy (see § Publication policy below) plus the active export profile, not from a per-entity boolean.

## Publication policy

Every entity field declares an explicit `publication` policy in the schema. The policy is one of:

- `public` — eligible for publication and Explorer bundles.
- `internal` — visible inside the workspace and operator's organisation; not eligible for publication.
- `sensitive` — careful UI handling; not eligible for publication unless an export profile explicitly opts the field in.
- `restricted` — never leaves the workspace boundary under any profile.

Default for any new field is `sensitive`. A field that has no declared policy MUST be a CI failure. The exporter walks each entity, drops every field whose effective policy is not eligible for the active profile, and refuses outright to emit `restricted` fields.

## Personal data exclusion

The following fields are `restricted` and MUST NOT appear in any JSON bundle, snapshot artefact, or Explorer payload, regardless of profile:

- `person.name`
- `person.email`
- `person.teamId` only when accompanied by an identifier; aggregate counts are allowed
- `assignment.personId`
- any free-text field whose `security.classification` is not explicitly `public`

Workforce assertions in published artefacts reference `role.id` or `team.id` only. See ADR 0001 and the threat model T11.

## Core reference entities

### Domain

Represents a major PSPF grouping, policy area, or internal capability grouping used for reporting and navigation.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `DOM-*` |
| `code` | string | stable short code |
| `name` | string | display name |
| `description` | string | optional |
| `sortOrder` | integer | reporting order |
| `statusModel` | string | compliance or internal scoring mode |

### Requirement

Represents a PSPF requirement or an internal requirement-like control record.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `REQ-*` |
| `domainId` | string | parent domain |
| `requirementCode` | string | stable PSPF or internal code |
| `name` | string | short title |
| `statement` | string | full requirement text or normalized statement |
| `guidance` | string | optional explanatory guidance |
| `sourceAuthority` | string | PSPF or internal source |
| `assessmentStatus` | string | current status |
| `reportingReadiness` | string | draft, review, ready, blocked |
| `rationale` | string | user-entered or generated rationale |
| `effectiveness` | string | effective, partial, ineffective, unknown |
| `evidenceStatus` | string | missing, partial, attached, stale, verified |
| `ownerTeamId` | string/null | primary responsible team |
| `reviewDueAt` | string/null | next review date |

#### Requirement enums

`assessmentStatus`:
- `not-started`
- `in-progress`
- `met`
- `partially-met`
- `not-met`
- `not-applicable`
- `under-review`

`reportingReadiness`:
- `draft`
- `needs-review`
- `ready`
- `blocked`

`effectiveness`:
- `effective`
- `partial`
- `ineffective`
- `unknown`

`evidenceStatus`:
- `missing`
- `partial`
- `attached`
- `stale`
- `verified`

### Evidence

Represents evidence used to support a requirement, action, risk treatment, or reporting claim.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `EVD-*` |
| `title` | string | short label |
| `evidenceType` | string | document, link, record, note, screenshot, attestation |
| `storageType` | string | file, url, inline, external-reference |
| `location` | object | where the evidence lives |
| `capturedAt` | string/null | when evidence was captured |
| `effectiveFrom` | string/null | optional effective date |
| `effectiveTo` | string/null | optional expiry date |
| `freshnessStatus` | string | current freshness view |
| `verificationStatus` | string | unverified, reviewed, verified |
| `lastReviewedAt` | string/null | when the evidence was last assessed for currency and completeness |
| `reviewDueAt` | string/null | next planned evidence review date |
| `sourceUpdatedAt` | string/null | last known update time of the source artefact, if detectable |
| `changeStatus` | string | unchanged, changed, unknown |
| `confidentiality` | string | handling indicator |
| `hash` | string/null | integrity hash where relevant |
| `summary` | string | short description |

#### Evidence enums

`evidenceType`:
- `document`
- `url`
- `record`
- `note`
- `screenshot`
- `attestation`
- `dataset`

`storageType`:
- `file`
- `url`
- `inline`
- `external-ref`

`freshnessStatus`:
- `current`
- `aging`
- `stale`
- `expired`
- `unknown`

`verificationStatus`:
- `unverified`
- `reviewed`
- `verified`

`changeStatus`:
- `unchanged`
- `changed`
- `unknown`

### Evidence review projection

Evidence review is a daily operational projection, not a separate canonical entity. Core and Explorer derive review queues from Evidence records, Requirement evidence state, and links.

The projection should answer:

- which domains or requirements depend on old, incomplete, unverified, changed, or missing evidence,
- which evidence items have the largest downstream impact,
- what changed since the last review or snapshot,
- and which action or requirement should be opened next.

An evidence item is considered **old** when `freshnessStatus` is `aging`, `stale`, or `expired`, or when `reviewDueAt` is in the past. It is considered **incomplete** when required metadata for its type is missing, when `verificationStatus` is `unverified`, or when it has no active link to a Requirement, Action, Risk, Direction, Snapshot, or Report pack where such a link is required by the workflow. It is considered **changed** when `changeStatus` is `changed`, when `sourceUpdatedAt` is later than `lastReviewedAt`, or when a stored `hash` no longer matches the current source artefact.

Evidence review queues MUST be groupable by domain and filterable by one or more requirements. They should rank items by downstream impact using linked requirement count, affected domain readiness, whether the evidence supports a blocked or not-ready requirement, and whether linked actions or risks depend on it.

### Action

Represents a remediation, implementation, validation, or reporting action.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ACT-*` |
| `title` | string | short action name |
| `description` | string | full action text |
| `actionType` | string | remediation, review, validation, reporting, procurement, workforce |
| `status` | string | current state |
| `priority` | string | low, medium, high, critical |
| `ownerPersonId` | string/null | responsible person |
| `ownerTeamId` | string/null | responsible team |
| `dueAt` | string/null | target completion |
| `startedAt` | string/null | optional |
| `completedAt` | string/null | optional |
| `blockingState` | string | blocked, unblocked, at-risk |
| `outcomeSummary` | string | optional close-out note |

#### Action enums

`actionType`:
- `remediation`
- `review`
- `validation`
- `reporting`
- `procurement`
- `workforce`

`status`:
- `draft`
- `open`
- `in-progress`
- `blocked`
- `done`
- `cancelled`

`priority`:
- `low`
- `medium`
- `high`
- `critical`

`blockingState`:
- `unblocked`
- `at-risk`
- `blocked`

### Action Impact projection

Action Impact is a computed, explainable projection used to rank work by likely positive effect on compliance posture. It is not a manually edited canonical score in v1. Products may persist cached read models for performance, but the authoritative value is derived from current entities and links.

The projection should expose, at minimum:

| Field | Type | Description |
|---|---|---|
| `actionId` | string | `ACT-*` source action |
| `scope` | string | requirement, domain, overall, essential-eight, direction |
| `affectedRequirementIds` | string[] | linked or inferred requirements affected by the action |
| `affectedDomainIds` | string[] | domains affected through those requirements |
| `postureUplift` | integer | transparent relative score for likely compliance/readiness improvement |
| `readinessUplift` | integer | transparent relative score for reporting-readiness improvement |
| `riskReduction` | integer | transparent relative score for linked risk treatment |
| `evidenceUplift` | integer | transparent relative score for missing/stale/incomplete evidence improvement |
| `urgency` | string | normal, due-soon, overdue, blocked |
| `explanation` | string[] | short facts explaining why the action is ranked here |

The v1 scoring model MUST be deterministic and explainable. It should prefer simple additive weights over opaque recommendation logic. Recommended signals include:

- linked requirements with `assessmentStatus` of `not-met`, `partially-met`, or `in-progress`,
- linked requirements with `reportingReadiness` of `blocked` or `needs-review`,
- missing, stale, incomplete, or changed evidence that the action would resolve,
- high or extreme linked risks that the action treats or unblocks,
- actions that affect multiple requirements in the same domain,
- actions that affect Essential Eight requirements,
- and Directions whose response state is `not-set`, `no`, or `risk-managed`.

Urgency is displayed beside impact but does not by itself increase positive impact. An overdue action may be urgent without being the highest compliance uplift.

### Risk

Represents a risk, exposure, or issue requiring monitoring or treatment.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `RSK-*` |
| `title` | string | short risk statement |
| `description` | string | fuller detail |
| `riskType` | string | security, delivery, supplier, workforce, reporting |
| `status` | string | open, accepted, treated, closed |
| `likelihood` | string | low to extreme model |
| `impact` | string | low to extreme model |
| `residualLevel` | string | low to extreme model |
| `treatmentStatus` | string | not-started, in-progress, monitoring, complete |
| `ownerPersonId` | string/null | risk owner |
| `ownerTeamId` | string/null | risk owner team |
| `acceptedBy` | string/null | approver reference |
| `reviewDueAt` | string/null | next review |

#### Risk enums

`riskType`:
- `security`
- `delivery`
- `supplier`
- `workforce`
- `reporting`
- `data`

`status`:
- `open`
- `accepted`
- `treated`
- `closed`

`likelihood`, `impact`, `residualLevel`:
- `low`
- `moderate`
- `high`
- `extreme`

`treatmentStatus`:
- `not-started`
- `in-progress`
- `monitoring`
- `complete`

### Snapshot

Represents an immutable reporting or assurance capture of the system at a point in time.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `SNP-*` |
| `title` | string | snapshot label |
| `snapshotType` | string | reporting, checkpoint, backup, export |
| `capturedAt` | string | immutable timestamp |
| `scope` | object | what was included |
| `schemaVersion` | string | bundle/schema version |
| `createdFrom` | string | trigger source |
| `integrityHash` | string/null | optional package hash |
| `notes` | string | optional |

#### Snapshot enums

`snapshotType`:
- `reporting`
- `checkpoint`
- `backup`
- `export`

### Report pack

Represents a curated reporting package or narrative output boundary.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `RPT-*` |
| `title` | string | report title |
| `reportType` | string | executive, annual, working, export |
| `status` | string | draft, ready, issued, archived |
| `snapshotId` | string/null | source snapshot |
| `summaryNarrative` | string | user-facing summary |
| `audience` | string | internal, executive, external |

## Commercial entities

### Supplier

Represents an external supplier, vendor, or service provider.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `SUP-*` |
| `name` | string | supplier name |
| `supplierType` | string | software, service, advisory, managed-service, other |
| `status` | string | active, inactive, proposed |
| `criticality` | string | low, medium, high, critical |
| `primaryContact` | string/null | contact text or linked person |
| `notes` | string | optional |

### Contract

Represents a contractual relationship or procurement instrument.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `CTR-*` |
| `supplierId` | string | linked supplier |
| `title` | string | contract title |
| `contractRef` | string | business reference |
| `status` | string | draft, active, expired, terminated |
| `startsAt` | string/null | start date |
| `endsAt` | string/null | end date |
| `value` | object/null | amount + currency |
| `serviceSummary` | string | what it covers |

### Spend item

Represents a spend commitment, uplift item, costed control activity, or investment option intended to reduce future cost, risk, effort, or exposure.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `SPD-*` |
| `title` | string | summary |
| `spendType` | string | capex, opex, uplift, licence, service |
| `status` | string | proposed, approved, committed, spent, cancelled |
| `amount` | object | amount + currency |
| `financialYear` | string | FY label |
| `forecastStartAt` | string/null | when forecast cost/saving begins |
| `forecastEndAt` | string/null | when forecast cost/saving ends |
| `forecastCost` | object/null | expected total cost over the forecast period |
| `expectedSavings` | object/null | expected savings over the forecast period |
| `savingsType` | string | avoided-cost, efficiency, consolidation, risk-reduction, contract-optimisation, other |
| `paybackPeriodMonths` | integer/null | expected months until savings exceed investment |
| `confidence` | string | low, medium, high |
| `assumptions` | string | key forecast assumptions |
| `notes` | string | optional |

#### Spend item enums

`savingsType`:
- `avoided-cost`
- `efficiency`
- `consolidation`
- `risk-reduction`
- `contract-optimisation`
- `other`

`confidence`:
- `low`
- `medium`
- `high`

### Spend forecast projection

Spend forecast is a Shop-owned planning projection that helps answer “where can I spend money now to save money later?” It is derived from Spend items, Contracts, Suppliers, Actions, Requirements, Risks, and links. It is not a financial system of record in v1.

The projection should expose, at minimum:

| Field | Type | Description |
|---|---|---|
| `scope` | string | supplier, contract, domain, requirement, action, financial-year, overall |
| `forecastPeriod` | object | start/end dates or financial-year range |
| `plannedSpend` | object | total planned/committed spend for the scope |
| `expectedSavings` | object | total expected savings for the scope |
| `netBenefit` | object | expectedSavings minus plannedSpend where comparable |
| `paybackPeriodMonths` | integer/null | expected payback period where calculable |
| `confidence` | string | low, medium, high, or mixed |
| `linkedRequirementIds` | string[] | requirements affected by the spend |
| `linkedActionIds` | string[] | actions funded or enabled by the spend |
| `linkedRiskIds` | string[] | risks reduced or avoided by the spend |
| `explanation` | string[] | short facts explaining forecast and savings assumptions |

The v1 forecast MUST be explainable and assumption-led. It should not imply accounting precision unless backed by source data. Recommended signals include contract renewal dates, supplier criticality, action impact, linked risk severity, evidence gaps, current manual effort, duplicate suppliers/contracts, contract optimisation opportunities, avoided incident/remediation cost, and requirements whose uplift depends on funding.

Shop should show both gross spend and expected savings so a user can distinguish “cost to comply” from “investment that reduces future cost or risk”.

## Workforce entities

### Person

Represents a person relevant to ownership, assignment, approval, or contact.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `PER-*` |
| `name` | string | display name |
| `email` | string/null | optional |
| `status` | string | active, inactive |
| `employmentType` | string | employee, contractor, supplier-contact, other |
| `teamId` | string/null | home team |

### Role

Represents a role or function rather than a person.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ROL-*` |
| `title` | string | role title |
| `roleType` | string | governance, operational, assurance, delivery |
| `description` | string | optional |
| `status` | string | active, inactive |

### Team / unit

Represents an organisational unit.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `TEM-*` |
| `name` | string | team name |
| `code` | string/null | optional short code |
| `status` | string | active, inactive |
| `parentTeamId` | string/null | hierarchy support |

### Assignment

Represents a person or role being assigned to a responsibility, action, or capability.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ASM-*` |
| `assignmentType` | string | ownership, contributor, approver, reviewer |
| `status` | string | active, ended, pending |
| `personId` | string/null | assigned person |
| `roleId` | string/null | assigned role |
| `teamId` | string/null | assigned team |
| `startsAt` | string/null | optional |
| `endsAt` | string/null | optional |
| `notes` | string | optional |

## Supporting entities

### Notification rule

Represents an automation or reminder rule.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `NTF-*` |
| `title` | string | rule name |
| `triggerType` | string | stale-evidence, overdue-action, snapshot-due, status-changed |
| `status` | string | active, paused, disabled |
| `channel` | string | in-app, export-flag, summary-only |
| `ruleConfig` | object | config payload |

### Tag

Represents a reusable classification label that an operator applies to entities to mark interest, focus, or grouping. Tags are workspace-shared data: they are owned by the workspace, included in snapshots and master-bundle exports, and round-trip through Explorer publication and local-authoring modes. See [adr/0041-v1-7-tags-and-filters-foundation.md](adr/0041-v1-7-tags-and-filters-foundation.md).

In v1.7 the only taggable entity type is `requirement`. Tags are applied through first-class `link` records with `linkType = "tagged-with"` and `(fromType, toType) = (requirement, tag)`. Tagging other entity types is a separate ADR.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `TAG-*` |
| `entityType` | string | `tag` |
| `label` | string | canonical unique key; 1..40 chars; NFC-normalised; allowed characters are Unicode letters, Unicode digits, spaces, hyphen, and apostrophe; case- and whitespace-insensitive uniqueness per E20 |
| `title` | string | display label shown in chips and pickers; 1..60 chars; defaults to `label` |
| `description` | string | optional free-text note; 0..1000 chars; publication `sensitive` (default-deny) |
| `colour` | string | required; one of `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `grey`; creation default is `grey` |
| `emoji` | string | optional single grapheme cluster rendered before the title; validated with `Intl.Segmenter` where available |
| `recordStatus` | string | active, archived, inactive, deleted; pickers MUST exclude `archived` |

#### Limits

- Tags per workspace: 64 hard cap, 32 soft warning. See `pspf-invariants.md` § T3.
- Tags applied per requirement: 16 hard cap.
- Workshop v1.7 exposes archive, not hard-delete. Archiving a tag preserves existing `tagged-with` links and historical snapshots.
- Tag pickers and chip lists sort by `title` case-insensitively, then `id`.

### Source control

Represents a reusable source or authority control record. In v0.2 this is the read-only ISM source-control catalogue loaded from the vendored ASD OSCAL snapshot. See [adr/0018-ism-source-library.md](adr/0018-ism-source-library.md) and [pspf-ism-integration-spec.md](pspf-ism-integration-spec.md).

ISM `SRC-*` records carry `externalRefs` to the natural ISM control identifier and the OSCAL UUID so they round-trip back to the ASD catalogue. They are source catalogue records, not PSPF Requirements.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `SRC-*` |
| `entityType` | string | `source-control` |
| `controlId` | string | natural ISM identifier |
| `title` | string | ISM control title |
| `statement` | string | ISM control text from OSCAL |
| `profileTags` | string[] | ISM profile membership |
| `statementChangeStatus` | string | unchanged, changed, new, removed |
| `externalRefs` | object[] | OSCAL UUID and natural ISM identifier |
| `provenance` | object | `oscalRelease`, `catalog`, `profile`, `sourceUrl` |
| `localApplicabilityNote` | string | optional operator interpretation; sensitive by default |

### Requirement-control mapping

Represents a first-class mapping from one PSPF Requirement to one ISM source control. See [adr/0019-requirement-control-mapping.md](adr/0019-requirement-control-mapping.md).

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `MAP-*` |
| `entityType` | string | `requirement-control-mapping` |
| `requirementId` | string | `REQ-*` endpoint |
| `sourceControlId` | string | `SRC-*` endpoint |
| `coverageQualifier` | string | primary, partial, compensating |
| `applicabilityProfile` | string | ISM profile key or all |
| `confidence` | string | low, medium, high |
| `lastReviewedAt` | string/null | optional mapping review timestamp |
| `reviewBy` | string/null | optional free-text reviewer label; not a Person link |
| `rationale` | string | operator-authored explanation; sensitive by default |
| `provenance` | object | author, createdAt, oscalRelease |

### Direction

Represents an authoritative Direction issued by Home Affairs or another authoritative PSPF source that must be understood, assessed, evidenced, and managed like a requirement overlay.

Directions differ from Requirements in two ways:

- they are event-like instructions issued after or alongside the standing PSPF catalogue,
- and once registered they always apply, so their response state does not include `not-applicable`.

#### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | `DIR-*` |
| `reference` | string | authoritative reference, unique case- and whitespace-insensitively |
| `title` | string | short title |
| `issuedAt` | string | issue date |
| `sourceAuthority` | string | issuing authority |
| `sourceControlId` | string/null | linked source control where available |
| `description` | string | direction text or normalised summary |
| `implementationGuidance` | string | optional local interpretation or guidance |
| `responseState` | string | not-set, yes, no, risk-managed |
| `assessmentRationale` | string | user-entered assessment notes |
| `evidenceStatus` | string | missing, partial, attached, stale, verified |
| `reviewDueAt` | string/null | next review date |

#### Direction enums

`responseState`:
- `not-set`
- `yes`
- `no`
- `risk-managed`

Directions should be linkable to affected requirements, domains, evidence, actions, and risks. Products should surface them in the same assessment and evidence-review flows as requirements, while keeping the response-state terminology distinct.

### Change Record

Represents a significant change captured by Workshop so later readers can understand why a Requirement, Action, Risk, Direction, Tag, or Saved View changed. Change Records are authored in Workshop, exported through Core, and rendered read-only in Explorer publication mode.

#### Change Record fields

| Field | Type | Description |
|---|---|---|
| `id` | string | `CHG-*` canonical ID |
| `title` | string | concise operator-facing title |
| `summary` | string | public explanation safe for Explorer publication |
| `reason` | string | sensitive reason, redacted by default |
| `impactSummary` | string | sensitive impact note, redacted by default |
| `changeType` | string | priority, direction, scope, timeline, dependency, risk-response, posture, other |
| `status` | string | proposed, active, resolved, absorbed, withdrawn |
| `persistence` | string | temporary or persistent |
| `source` | string | executive-direction, risk-event, compliance-event, operational, external-trigger, other |
| `raisedAt` | string | timestamp the change was raised |
| `effectiveAt` | string/null | optional timestamp the change takes effect |
| `reviewDueAt` | string/null | optional review timestamp |
| `decisionOwnerRef` | string | restricted decision-owner reference, never exported |

## Link specification

### Why links are first-class

Links are first-class because the ecosystem depends on cross-cutting relationships between requirements, evidence, actions, risks, suppliers, workforce records, and report artefacts. SQLite foreign keys and relational structure are useful for enforcing integrity in the runtime store, but the business meaning of the relationship must also be explicit in the model.

### Link entity

Each meaningful relationship should be represented by a `Link` record.

#### Link fields

| Field | Type | Description |
|---|---|---|
| `id` | string | `LNK-*` canonical ID |
| `linkType` | string | semantic relationship type |
| `fromId` | string | source entity ID |
| `fromType` | string | source entity type |
| `toId` | string | target entity ID |
| `toType` | string | target entity type |
| `status` | string | active, inactive, superseded |
| `strength` | string | required, strong, supporting, informational |
| `directionality` | string | directional or bidirectional |
| `createdAt` | string | timestamp |
| `createdBy` | string | product/user/service origin |
| `updatedAt` | string | timestamp |
| `updatedBy` | string | product/user/service origin |
| `rationale` | string/null | explanation of the link |
| `effectiveFrom` | string/null | optional |
| `effectiveTo` | string/null | optional |
| `snapshotId` | string/null | if link was established in a snapshot context |

### Link enums

`status`:
- `active`
- `inactive`
- `superseded`

`strength`:
- `required`
- `strong`
- `supporting`
- `informational`

`directionality`:
- `directional`
- `bidirectional`

## Approved link taxonomy

Links are described by a short, **shared verb-phrase `linkType`** drawn from a closed vocabulary, plus the existing `fromType` and `toType` envelope fields. Direction is carried by `fromType`/`toType`. Inverse traversal is a query feature, not a separate `linkType`. See ADR 0003 and `pspf-invariants.md` § V1.

### Closed `linkType` vocabulary

`in`, `has`, `supported-by`, `addressed-by`, `exposed-by`, `owned-by`, `reviewed-by`, `cited-by`, `supports`, `treated-by`, `associated-with`, `sourced-from`, `included-in`, `assigned-via`, `blocked-by`, `related-to`, `funds`, `member-of`, `holds`, `targets`, `generates`, `includes`, `tagged-with`, `changes`.

Any `linkType` value not in this set MUST be rejected by Core and by the bundle validator.

### Valid (fromType, linkType, toType) triples

This table is authoritative. CI validates that every link in every fixture matches one of these triples.

#### Requirement-centred

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| requirement | in | domain | requirement belongs to domain |
| requirement | supported-by | evidence | evidence supports requirement claim |
| requirement | addressed-by | action | action contributes to requirement uplift |
| requirement | exposed-by | risk | risk affects requirement outcome |
| requirement | owned-by | team | team owns requirement |
| requirement | reviewed-by | person | person is reviewer |
| requirement | cited-by | report-pack | report references requirement |

#### Direction-centred

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| direction | in | domain | direction affects domain |
| direction | targets | requirement | direction applies to requirement |
| direction | supported-by | evidence | evidence supports direction response |
| direction | addressed-by | action | action contributes to direction response |
| direction | exposed-by | risk | risk affects direction response |
| direction | sourced-from | source-control | direction derives from authoritative source |

#### Evidence-centred

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| evidence | supports | action | evidence supports action completion |
| evidence | supports | risk | evidence supports risk treatment |
| evidence | sourced-from | source-control | evidence derives from source |
| evidence | included-in | snapshot | evidence captured in snapshot |

#### Action-centred

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| action | owned-by | person | direct action owner |
| action | owned-by | team | team owner |
| action | assigned-via | assignment | assignment record governs responsibility |
| action | blocked-by | risk | risk blocks completion |
| action | related-to | contract | action relates to contract obligation |
| action | included-in | snapshot | action captured in snapshot |

#### Risk-centred

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| risk | owned-by | person | direct owner |
| risk | owned-by | team | team owner |
| risk | treated-by | action | action treats risk |
| risk | associated-with | supplier | supplier contributes to risk |
| risk | associated-with | contract | contract contributes to risk |
| risk | included-in | report-pack | risk reported in pack |

#### Commercial

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| supplier | has | contract | supplier linked to contract |
| supplier | supports | requirement | supplier relevant to requirement |
| supplier | associated-with | risk | supplier affects risk |
| contract | supports | requirement | contract obligation supports requirement |
| contract | funds | spend-item | spend tied to contract |
| spend-item | supports | action | spend enables action |
| spend-item | supports | requirement | spend contributes to control uplift |

#### Workforce

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| person | member-of | team | person belongs to team |
| person | holds | role | person currently holds role |
| assignment | targets | action | assignment applies to action |
| assignment | targets | requirement | assignment applies to requirement |
| assignment | targets | risk | assignment applies to risk |
| role | owned-by | team | role sits within team |

#### Reporting

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| snapshot | includes | requirement | requirement captured |
| snapshot | includes | risk | risk captured |
| snapshot | generates | report-pack | report derived from snapshot |
| report-pack | includes | evidence | evidence included in pack |
| report-pack | includes | action | action included in pack |

#### Tags

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| requirement | tagged-with | tag | operator-applied classification on a requirement |

In v1.7 this is the only permitted `(fromType, toType)` pair for `tagged-with`. See `pspf-invariants.md` § T2.

#### Change Records

| fromType | linkType | toType | Meaning |
|---|---|---|---|
| change-record | changes | requirement | change explains why a requirement changed |
| change-record | changes | action | change explains why an action changed |
| change-record | changes | risk | change explains why a risk changed |
| change-record | changes | direction | change explains why a Direction response or treatment changed |
| change-record | changes | tag | change explains why a tag is relevant |
| change-record | changes | saved-view | change explains why a saved view matters |

In v1.10 these are the only permitted `(fromType, toType)` pairs for `changes`. Tombstoned endpoints may remain linked so historical explanations survive erasure or archive workflows.

## Link rules

### Cardinality and integrity

Cardinality should be handled by business rules rather than by naming alone. Examples:

- a Requirement may have many Evidence links,
- an Action may have one primary owner person and one primary owner team,
- a Supplier may have many Contracts,
- a Snapshot may include many records of many types.

### Required links

The system should support required-link validation rules. Example:

- A Requirement marked `ready` may require at least one active Link with `fromType=requirement`, `linkType=supported-by`, and `toType=evidence`.
- A Direction marked `yes` or `risk-managed` may require at least one active Link with `fromType=direction`, `linkType=supported-by`, and `toType=evidence`.
- A Risk marked `open` may require at least one owner link.
- A Contract may require a parent Supplier link.

### Duplicate handling

Duplicate links should be prevented for identical active pairs where the semantic meaning is the same, unless versioning or explicit parallel rationale is required.

### Supersession

Links should support supersession rather than silent replacement where historical defensibility matters.

## JSON interchange model

### Schema style

Explorer bundle schemas use JSON Schema Draft 07 in v1, as defined by `pspf-explorer-json-bundle-schema-spec.md`. Other future interchange contracts may choose a later dialect through a versioned ADR and schema package update.

### Bundle envelope

A bundle should contain:

- bundle metadata,
- schema version,
- export metadata,
- entity collections,
- link collection,
- optional snapshot/report metadata,
- and checksum metadata.

### Suggested logical bundle shape

This is a simplified logical view only. The authoritative Explorer bundle is the manifest-led directory structure in `pspf-explorer-json-bundle-schema-spec.md`.

```json
{
  "$schema": "./schemas/manifest.schema.json",
  "bundleType": "pspf-explorer-bundle",
  "bundleVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "apiVersion": "1.0.0",
  "generatedAt": "2026-05-09T01:00:00Z",
  "generator": {
    "product": "pspf-core",
    "mode": "publication"
  },
  "collections": [],
  "indexes": [],
  "checksum": "..."
}
```

## SQLite runtime considerations

### Relational structure

The runtime SQLite store should maintain first-class entity tables and a first-class `links` table. Foreign key support should be enabled and actively enforced where used, because SQLite only enforces foreign key constraints when configured appropriately.

### Recommended table pattern

- one table per canonical entity type,
- shared metadata columns aligned to the common envelope,
- link table for semantic relationships,
- history/event tables for auditable changes,
- indexes on canonical IDs, key foreign keys, and common query paths.

### Soft-delete handling

Soft-deleted entities should remain linkable for historical analysis, but active query views should filter them by default.

## Validation rules

### Entity validation

Each entity should validate:

- required common envelope fields,
- type-specific required fields,
- enum membership,
- timestamp format,
- and cross-reference integrity.

### Link validation

Each link should validate:

- valid `fromType` / `toType` pairing,
- allowed `linkType` for that pair,
- no duplicate active semantic link unless explicitly allowed,
- and no self-link unless the type explicitly supports it.

### Status coherence

The system should support cross-field coherence checks, for example:

- `completedAt` should only exist when Action status is `done` or `cancelled`.
- `deletedAt` should only exist when `recordStatus` reflects inactive or deleted-like state.
- `effectiveTo` should not predate `effectiveFrom`.

## Initial minimal viable subset

For the first implementation, the minimum canonical subset should be:

- Domain
- Requirement
- Evidence
- Action
- Risk
- Snapshot
- Supplier
- Contract
- Direction
- Person
- Team
- Assignment
- Link

This is enough to support Core, Workshop, initial Shop/Pub integration, Explorer bundles, and Direction response management.

## Future expansion points

Likely future additions include:

- decision records,
- exceptions/waivers,
- control tests,
- issue findings,
- approval workflows,
- richer attestation models,
- and asset/system inventories.

These should be added through controlled schema versioning rather than overloading existing entities.

## Specification summary

The PSPF canonical model should consist of stable, explicitly typed entities with immutable prefixed IDs, shared metadata envelopes, readable string enums, and a first-class semantic link model. The runtime store should preserve referential integrity and current-state query performance, while the JSON interchange layer should use modern JSON Schema conventions and preserve the same entity and relationship semantics across Core, Workshop, Shop, Pub, and Explorer.

The initial model is deliberately broad enough to support PSPF requirement tracking, evidence-backed reporting, risk and action management, commercial linking, workforce responsibility, and reporting snapshots, while staying constrained enough to be governable and evolvable over time.
