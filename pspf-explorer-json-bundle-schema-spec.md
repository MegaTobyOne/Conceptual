# PSPF Explorer JSON Bundle and Schema Specification

## Overview

This specification defines the **single master JSON bundle format** used for every Explorer data exchange. Per ADR 0009, there is one bundle, one schema, one validator, one set of version axes — used for all of:

1. **Publication flow** — Core or Workshop produces a curated, redacted bundle that an Explorer site loads on first open. This is the read-baseline.
2. **Round-trip flow** — a user working in Explorer's local-authoring mode (see ADR 0004 and `explorer-screen-workflow-spec.md`) exports their browser-local edits as a bundle, which can then be imported back into a Core/Workshop workspace, or into another Explorer instance.
3. **Full local backup and restore** — a user exports their entire local-authoring state and re-imports it later (`intent: full-replace`).
4. **Additive share / merge** — a user exports a chosen subset of collections and another user merges it into their state (`intent: additive-merge`).
5. **GRC capture ingest** — narrow ingest of requirement-keyed compliance updates from external GRC tooling (`generator.mode: grc-capture`, `intent: additive-merge`; evidence URLs append, never replace).
6. **Risk/action work import** — plan-then-apply ingest of risks and actions with optional status alias mapping, link normalisation, and update-mode selection (`generator.mode: work-import`, `intent: plan-apply`).

The standalone PSPF Explorer prototype shipped four separate format tags (`pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport`); these are retired in the rewrite. Their behaviours survive as **configuration of the single master bundle**, not as separate formats. See ADR 0009.

Explorer never connects to a live Core API. All exchange is via JSON files.

This design fits static hosting well: GitHub Pages can serve site assets and JSON files directly, and browser-side code can fetch those local JSON resources as part of the published site experience.

The schema strategy uses **JSON Schema Draft 07** for v1 because it provides materially stronger tooling (`ajv`, IDE support, code generation) than newer drafts and the model does not require Draft 2020-12 features. The dialect may be upgraded in a later major version of `bundleVersion`.

The bundle format must be:

- static-host friendly,
- semantically versioned along the canonical `schemaVersion` and `bundleVersion` axes (see ADR 0008),
- backward-tolerant for additive change,
- bounded in size and shape against hostile or accidental abuse,
- inspectable by humans,
- and efficient enough for browser-side rendering.

## Design goals

The Explorer bundle must:

1. be loadable from GitHub Pages with no server runtime,
2. support offline-style static inspection in the browser,
3. preserve provenance and export context,
4. expose only the data needed by Explorer,
5. remain stable under additive evolution,
6. and separate manifest, schema, and domain payloads clearly.

## Format strategy

### Bundle packaging model

The v1 Explorer format should be a **directory-style logical bundle** rather than a single huge JSON blob. The published Explorer site can therefore load a small manifest first, then fetch domain-specific JSON files on demand.

This is the right fit for static hosting because browser code can fetch local JSON resources, and GitHub Pages is well suited to serving static assets and data files together.

### Why not a monolithic JSON file

A single file is easy to export, but it becomes harder to cache, harder to inspect, and more expensive to update when only part of the data changes. A manifest-plus-domain-file strategy gives better browser performance and better maintainability.

### Published directory shape

Suggested published structure:

```text
/explorer/
  index.html
  assets/*
  data/
    manifest.json
    collections/
      requirements.json
      evidence.json
      actions.json
      risks.json
      suppliers.json
      snapshots.json
      report-packs.json
      links.json
    indexes/
      by-type.json
      by-domain.json
      status-summary.json
      freshness-summary.json
    schemas/
      manifest.schema.json
      collection.schema.json
      bundle.schema.json
```

## Versioning model

Bundles carry the three canonical version axes from ADR 0008:

| Field | Meaning |
|---|---|
| `schemaVersion` | semver string for entity/schema layer |
| `bundleVersion` | semver string for the bundle structure |
| `apiVersion` | semver string for the Core API the producer used |

A producer may also include `producerVersion` (the producing tool's release version) for human debugging only. Consumers MUST NOT make compatibility decisions on it.

### Semver rules

- **major**: breaking changes to bundle structure or required semantics.
- **minor**: additive compatible fields or collections.
- **patch**: clarifications, fixes, non-structural corrections.

### Additive compatibility rule

Explorer must ignore unknown fields and tolerate unknown optional collections where possible. This is the key rule that lets the exported data evolve without breaking older Explorer builds.

### Schema publication and `$schema` resolution

The bundle JSON Schema is published per-`schemaVersion` so old bundles remain validatable forever.

- **In-repo source of truth.** Every published `schemaVersion` has a copy under `schemas/explorer-bundle/<schemaVersion>/` in the repo (e.g. `schemas/explorer-bundle/1.0.0/manifest.schema.json`, plus per-collection schemas alongside). Superseded versions are kept; nothing is deleted.
- **Served path.** Explorer serves the same tree at `/schemas/explorer-bundle/<schemaVersion>/...`, same-origin only. CSP forbids cross-origin schema fetches, so producers MUST NOT use remote `$ref`s.
- **`$schema` field on bundles.** Producers SHOULD emit **both** forms so consumers can validate online or offline:
  - an absolute URL that resolves to a published version (e.g. `https://explorer.example.org/schemas/explorer-bundle/1.0.0/manifest.schema.json`), and
  - a sibling copy of the schema tree inside the bundle directory at `./schemas/`, with `$schema` set to the relative `./schemas/manifest.schema.json` for offline use.
- **Stability rule.** Once a `schemaVersion` is published, breaking changes to its schema document are forbidden. Non-breaking additions per the additive compatibility rule above are permitted in the same version. Breaking changes require a new `schemaVersion` directory and a deprecation window during which both versions are served.
- **No remote `$ref`s.** All `$ref`s in a published schema MUST be either local (`#/...`) or relative to the same `schemas/explorer-bundle/<schemaVersion>/` directory. CI asserts this.
- **Validator parity.** The validator the Explorer runtime uses for imports MUST be loaded from the same per-version schema tree it serves to producers; CI asserts the runtime validator and the served schema have identical hashes for the active `schemaVersion`.

## Core bundle model

### Top-level manifest-first approach

The first file loaded by Explorer is `manifest.json`. It describes the bundle, available collections, summary indexes, checksum metadata, and compatibility declarations.

### Manifest example

```json
{
  "$schema": "./schemas/manifest.schema.json",
  "bundleType": "pspf-explorer-bundle",
  "bundleVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "apiVersion": "1.0.0",
  "generatedAt": "2026-05-09T01:15:00Z",
  "generator": {
    "product": "pspf-core",
    "mode": "publication",
    "productVersion": "1.0.0",
    "workspaceId": "WS-018f4c2a-0e3a-7c5e-9a4b-3f6d2c1e8a90",
    "snapshotId": "SNP-018f4c2a-0e3a-7c5e-9a4b-3f6d2c1e8a90"
  },
  "compatibility": {
    "explorerMin": "1.0.0",
    "explorerTested": "1.0.0"
  },
  "security": {
    "classification": "OFFICIAL",
    "containsSensitiveData": true,
    "redactionProfile": "explorer-default"
  },
  "collections": [
    {
      "name": "requirements",
      "path": "./collections/requirements.json",
      "count": 412,
      "hash": { "alg": "SHA-256", "value": "..." }
    },
    {
      "name": "links",
      "path": "./collections/links.json",
      "count": 1880,
      "hash": { "alg": "SHA-256", "value": "..." }
    }
  ],
  "indexes": [
    {
      "name": "status-summary",
      "path": "./indexes/status-summary.json",
      "hash": { "alg": "SHA-256", "value": "..." }
    }
  ]
}
```

## Bundle object model

### Required files

| File | Purpose |
|---|---|
| `manifest.json` | bundle metadata and compatibility entry point |
| `collections/links.json` | first-class link graph |
| `collections/requirements.json` | requirement entities |
| at least one summary index | fast initial Explorer render |

### Optional files

| File | Purpose |
|---|---|
| `collections/evidence.json` | evidence entities |
| `collections/actions.json` | action/remediation entities |
| `collections/risks.json` | risk entities |
| `collections/suppliers.json` | supplier entities |
| `collections/report-packs.json` | report pack entities |
| `collections/snapshots.json` | immutable snapshot entities |
| `indexes/*.json` | denormalised read models |
| `schemas/*.json` | published validation schemas |

Workforce data is **never** included in bundles. There is no `personnel.json` collection. See `pspf-threat-model.md` T11 and the Personal data exclusion rule above.

## Entity serialisation rules

### Entity envelope

All serialized entities must conform to the canonical shared envelope from the entity model. Explorer should not receive arbitrary product-local shapes.

Every entity record must include at minimum:

- `id`
- `entityType`
- `schemaVersion`
- `title` or equivalent human label field
- `status`
- `lifecycle`
- `provenance`
- `timestamps`

### Example entity record

```json
{
  "id": "REQ-01J0ABCDEF1234567890",
  "entityType": "requirement",
  "schemaVersion": "1.0.0",
  "title": "Governance arrangements are established",
  "status": "in-progress",
  "lifecycle": {
    "state": "active"
  },
  "classification": "OFFICIAL",
  "domain": "security-governance",
  "provenance": {
    "source": "pspf-core",
    "sourceVersion": "1.0.0"
  },
  "timestamps": {
    "createdAt": "2026-04-01T02:10:00Z",
    "updatedAt": "2026-05-08T05:00:00Z"
  }
}
```

## Link serialisation rules

Links are first-class and must be exported in a dedicated collection, not embedded only inside entity records. This preserves consistent traversal and keeps Explorer’s graph model explicit.

### Required link fields

- `id`
- `entityType` set to `link`
- `linkType`
- `fromId`
- `toId`
- `status`
- `provenance`
- `timestamps`

### Example link record

```json
{
  "id": "LNK-01J0XYZ9876543210AAA",
  "entityType": "link",
  "schemaVersion": "1.0.0",
  "linkType": "supported-by",
  "fromId": "REQ-01J0ABCDEF1234567890",
  "toId": "EVD-01J0ABCDE99999999999",
  "status": "active",
  "provenance": {
    "source": "pspf-core",
    "sourceVersion": "1.0.0"
  },
  "timestamps": {
    "createdAt": "2026-05-01T00:00:00Z",
    "updatedAt": "2026-05-08T05:00:00Z"
  }
}
```

## Explorer-specific projection rules

Explorer is read-oriented, so the bundle may include **projection-friendly fields** that are redundant from Core’s point of view but useful for a static UI.

### Allowed projection fields

Examples:

- `displayTitle`
- `statusLabel`
- `domainLabel`
- `ownerLabel`
- `reportingPeriodLabel`
- `evidenceFreshnessBucket`
- `riskLevelLabel`

These fields are allowed if they obey two rules:

1. they do not change the canonical meaning of the source entity, and
2. they remain clearly denormalised/read-model fields.

### Recommended pattern

Put Explorer-only derived fields in an optional `explorer` object on the entity record.

```json
{
  "id": "REQ-...",
  "entityType": "requirement",
  "title": "...",
  "explorer": {
    "displayTitle": "Requirement 3.1 – Governance arrangements are established",
    "statusLabel": "In progress",
    "readinessBucket": "Needs evidence"
  }
}
```

## Summary indexes

### Why indexes exist

Explorer should not calculate every aggregate from raw collections on initial load. Static summary indexes allow a fast home screen and lower browser cost.

### Index principles

Indexes are **derived**, **replaceable**, and **non-authoritative**. If an index is absent or invalid, raw collections remain authoritative.

### Recommended v1 indexes

| Index | Purpose |
|---|---|
| `status-summary.json` | requirement counts by status, domain, reporting scope |
| `freshness-summary.json` | evidence freshness buckets |
| `evidence-review-summary.json` | old, incomplete, changed, unverified, missing, or unlinked evidence by domain/requirement |
| `risk-summary.json` | risk counts by level and domain |
| `link-summary.json` | counts of key relationship types |
| `reporting-readiness.json` | reporting readiness overview |
| `action-impact-summary.json` | explainable ranking inputs for high-impact actions by scope |
| `direction-response-summary.json` | Direction response state, evidence state, and open action counts |
| `posture-brief.json` | constrained posture graphic/text/action-plan output data |
| `shop-spend-forecast.json` | planned spend, expected savings, net benefit, payback, and confidence by period/scope |
| `shop-savings-opportunities.json` | invest-now-save-later opportunities with linked requirements/actions/risks and assumptions |
| `by-domain.json` | quick domain navigation metadata |

Action Impact and posture brief indexes are derived convenience files. They must include enough explanatory facts for Explorer to render "why this action" and "why this posture" without treating the index as an opaque authority. If they are absent, Explorer may recompute them from collections and links.

### Example summary structure

```json
{
  "indexType": "status-summary",
  "generatedAt": "2026-05-09T01:15:00Z",
  "schemaVersion": "1.0.0",
  "totals": {
    "requirements": 412,
    "effective": 210,
    "inProgress": 122,
    "notStarted": 80
  },
  "byDomain": [
    {
      "domain": "security-governance",
      "effective": 20,
      "inProgress": 5,
      "notStarted": 2
    }
  ]
}
```

## Redaction and publication profile

### Default-deny field policy

Field selection is governed by the per-field `publication` policy declared in the schema (see ADR 0005 and `pspf-entity-link-spec.md` § Publication policy). Fields not eligible for the active export profile are **dropped at export time**, not redacted in place. The exporter never emits `restricted` fields under any profile.

### Personal data exclusion

The following fields MUST NOT appear in any bundle, regardless of profile or flow:

- `person.name`
- `person.email`
- any `person` field other than `id`, `roleId` (count only), `teamId` (count only), `status`
- `assignment.personId`

Workforce assertions in bundles reference `role.id` or `team.id` only. The exporter MUST fail closed on any disallowed personal field. See `pspf-threat-model.md` T11.

### Classification handling

Every bundle must declare classification metadata. If the data is above the intended publication posture, the publishing pipeline fails closed.

## Import limits

Every bundle import (in Core, Workshop, or Explorer) MUST enforce these minimum limits and reject any bundle that exceeds them with a structured `PSPF_IMPORT_LIMIT_EXCEEDED` diagnostic:

| Limit | Minimum |
|---|---|
| Total bundle size | 50 MB |
| Items per collection | 200,000 |
| Total entities across all collections | 1,000,000 |
| String field length | 64 KB |
| Object/array nesting depth | 16 |
| Number of collections | 64 |
| Number of links | 2,000,000 |

Products MAY apply tighter limits. Browser-based Explorer SHOULD apply tighter limits to protect tab memory; recommended browser limits are bundle size 25 MB and items per collection 100,000.

## Checksum model

### Honest naming

The bundle carries **checksums**, not integrity guarantees. A checksum detects accidental corruption, partial publication, or mismatched files; it does not detect a coordinated replacement of both the bundle and its manifest. See `pspf-threat-model.md` T09.

The field name in v1 is `checksum`. The earlier `integrity` field name is deprecated. A future ADR may introduce a signed-attestation model; until then, no spec should describe the bundle as integrity-protected.

### Required checksum fields

Every manifest entry for a collection or index includes:

- hash algorithm,
- hash value,
- byte length.

### Recommended algorithm

Use `SHA-256` for v1.

### Manifest-level checksum block

```json
{
  "checksum": {
    "manifestHash": {
      "alg": "SHA-256",
      "value": "..."
    },
    "publishedAt": "2026-05-09T01:20:00Z"
  }
}
```

### Consumer behaviour

Consumers (Explorer, Core import, Workshop import) should:

- validate file hashes when metadata is available,
- warn on mismatch,
- refuse mixed-version loads,
- and show a clear banner if the bundle is incomplete or partially corrupted.

## Round-trip flow (Explorer-authored bundles)

Explorer's local-authoring mode (ADR 0004) lets users mark requirements with statuses, capture short notes, and record evidence references in browser-local storage. The user can export this state as a bundle.

### Producer marker

A bundle produced by Explorer in local-authoring mode MUST set:

```json
{
  "generator": {
    "product": "pspf-explorer",
    "mode": "local-authoring"
  }
}
```

The `mode` is informational. The valid set in v1 is `{ publication, local-authoring, grc-capture, work-import }`. Consumers MUST NOT use `mode` as a compatibility gate; compatibility is governed by the three canonical version axes only.

## Bundle intent and flow semantics

Per ADR 0009, every bundle declares an `intent` at the top level that tells the consumer how to apply it. The valid set in v1 is:

| `intent` | Consumer behaviour |
|---|---|
| `full-replace` | Validate the entire bundle against the master schema. On accept, **clear every affected store and load the bundle's contents in a single transaction**. A schema-version mismatch or any validation failure rejects the bundle before any write. |
| `additive-merge` | Validate. For each item, match by `id` against the existing store, classifying it as `add` (absent locally), `collision` (present locally), or `skip` (validation failed). If **every** classified row is `add`, apply the additions in one transaction and show a post-import summary; no review prompt. If **any** row is a `collision`, open the plan-and-review pane: `add` rows are pre-checked, `collision` rows require an explicit `keep existing` (default) or `overwrite with incoming` choice per record. Nothing is written until the user confirms. The legacy "existing wins, silent skip" prototype behaviour is retired. |
| `plan-apply` | Validate. Materialise a plan classifying each row as **add**, **update**, or **skip** (with reasons). Surface the plan to the user. Apply only the rows the user confirms. Validation alone makes no writes. |

Explorer-authored bundles default to `intent: additive-merge` for share scenarios, `intent: full-replace` for full-backup restore, and `intent: plan-apply` for risk/action work import. The publication flow uses `intent: full-replace` against the read-baseline store.

### Per-collection options

Some flows require finer control. The master schema permits the following optional, per-collection option blocks. Unknown option keys MUST be rejected.

#### Status normalisation (risks, actions)

```json
{
  "options": {
    "statusNormalisation": {
      "mode": "map-common",
      "aliases": { "in_progress": "in-progress", "wip": "in-progress" }
    }
  }
}
```

`mode` is one of:

- `strict` — reject any row whose status is outside the canonical enum.
- `map-common` — apply a built-in alias map plus optional user-supplied `aliases`. Rows still failing are rejected.
- `force` — set every row's status to a fixed `value` (also required in this mode).

#### Link mode (links)

```json
{
  "options": {
    "linkMode": "rebuild-bidirectional"
  }
}
```

- `as-provided` — keep incoming links after dedupe and orphan-filtering.
- `rebuild-bidirectional` — discard incoming risk⇄action references and rebuild them symmetrically from the entity-side `requirementIds` / `riskIds` / `actionIds` lists.

#### Update mode (any collection under `intent: additive-merge` or `plan-apply`)

```json
{
  "options": {
    "updateMode": "patch"
  }
}
```

- `replace-all` — for matched rows, omitted optional fields clear stored values.
- `patch` — for matched rows, omitted optional fields preserve existing values. This is the default.

#### Evidence append (compliance entries from GRC capture)

When `generator.mode == "grc-capture"`, the consumer MUST treat any evidence URL on an incoming compliance entry as an **append** to the existing evidence list, never as a replace. This rule is enforced regardless of `updateMode`.

#### Link validation (top-level)

```json
{
  "linkValidation": "lenient"
}
```

Top-level option declared on the bundle envelope (not on a single collection) because dangling references can sit on any entity and on first-class `relationships` records. Valid values:

- `strict` — any link whose target is not resolvable (present in the bundle or in local state, depending on `intent`) rejects the bundle. Use for trusted, complete imports.
- `lenient` *(default)* — accept the bundle, keep the dangling references, and report each one in the import summary. The receiving Explorer's Integrity scan will surface them later.
- `drop` — accept the bundle and silently drop dangling references; the import summary still reports the count and IDs dropped.

Regardless of `linkValidation`, an incoming **first-class relationship record** with an unresolvable endpoint MUST be rejected. A relationship record with no resolvable endpoint has no semantic value. This rule is non-configurable.

UI-driven link entry inside Explorer is a separate concern: every link field is an autocomplete picker that proposes only existing entities and refuses unknown free text. See `explorer-screen-workflow-spec.md` § Cross-entity link validation.

### Reduced collections

Bundles typically contain only the collections the producing flow has touched. Missing collections are tolerated by every consumer; absent collections mean "no changes from this producer for that collection." Required collections per flow are documented under "MVP bundle scope" below.

### Conflict and merge

Core import treats Explorer-authored bundles as a **proposed delta**, not as authoritative state. The Core importer:

- creates entities that don't already exist,
- records updates as new versions in the journal with `provenance.originType = "explorer-authored"`,
- never deletes existing entities based on absence in the bundle,
- and emits a structured import report listing accepted, rejected, and conflicting items.

### Personal-data rule still applies

Explorer-authored bundles are subject to the same personal-data exclusion rule as publication bundles. Explorer's UI does not collect Person `name`/`email` fields, so this is an enforced property of the producer rather than a runtime filter.

## JSON Schema strategy

### Dialect

Use JSON Schema Draft 07 in v1; declare the dialect explicitly with `$schema`. The dialect may be upgraded in a later major `bundleVersion`.

### Schema organisation

Recommended schema files:

```text
schemas/
  manifest.schema.json
  hash.schema.json
  entity-envelope.schema.json
  link.schema.json
  collection.schema.json
  requirement.schema.json
  evidence.schema.json
  action.schema.json
  risk.schema.json
  supplier.schema.json
  role.schema.json
  team.schema.json
  assignment.schema.json
  snapshot.schema.json
  report-pack.schema.json
```

### Schema version declaration

Each schema should include:

- `$schema`
- `$id`
- `title`
- `description`
- version information in `$id` and/or a custom metadata object

Using `$id` plus explicit instance version markers is a practical schema-versioning pattern for long-lived JSON contracts.

### Example schema header

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/pspf/explorer/schema/manifest/1.0.0",
  "title": "PSPF Explorer Manifest v1.0.0",
  "type": "object"
}
```

## Collection schema pattern

### Wrapper versus raw array

Each collection file should use a wrapper object instead of being a raw array. That allows file-level metadata, counts, paging later if needed, and a structure that pairs cleanly with checksum metadata.

### Example collection file

```json
{
  "$schema": "../schemas/collection.schema.json",
  "collectionType": "requirements",
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-05-09T01:15:00Z",
  "count": 412,
  "items": [
    {
      "id": "REQ-01J0ABCDEF1234567890",
      "entityType": "requirement",
      "schemaVersion": "1.0.0",
      "title": "Governance arrangements are established"
    }
  ]
}
```

### Collection schema rules

A collection wrapper should require:

- `collectionType`
- `schemaVersion`
- `generatedAt`
- `count`
- `items`

The `count` field must equal the actual item length.

## Bundle compatibility rules

### Hard compatibility gates

Explorer must reject a bundle when:

- `bundleVersion.major` is unsupported,
- `schemaVersion.major` is unsupported,
- required collections are missing,
- manifest-declared hashes fail and strict checksum mode is enabled,
- classification exceeds allowed publication policy.

### Soft compatibility warnings

Explorer may continue with warnings when:

- optional collections are missing,
- unknown optional fields are present,
- an index is absent but raw collections exist,
- a newer tested minor version is encountered.

## Publication and hosting rules

### GitHub Pages considerations

Because Explorer is hosted on GitHub Pages, the bundle should be stored as static files alongside the built site and loaded via browser fetch calls to relative paths.

### Recommended publish model

- Build Explorer static assets.
- Generate bundle under `data/`.
- Validate against schemas.
- Generate hashes.
- Fail if classification/redaction policy blocks publication.
- Publish site and bundle together to Pages.

### No dynamic secrets

The Explorer publish should not rely on runtime secrets in the browser. Any publication gate must happen in the CI pipeline, not in the static client.

## Validation pipeline

### Export-time validation

At export time, the producer must:

1. validate all canonical entities before projection,
2. validate all links,
3. generate derived indexes,
4. validate generated JSON against the published schemas,
5. compute checksum hashes,
6. and write manifest metadata.

### CI validation

The Explorer pipeline should additionally:

- validate every committed sample bundle,
- ensure bundle version/schema version combinations are allowed,
- and run smoke tests that open the site against the generated data bundle.

## MVP bundle scope

### Required v1 entity collections

For the first Explorer release, the minimum useful bundle should contain:

- `requirements`
- `links`
- `evidence`
- `actions`
- `risks`
- `snapshots`
- `report-packs`

### Local-authoring collections (round-trip flow)

When Explorer is the producer, the bundle MAY additionally include collections that capture user-owned local state:

- `tags` — user-defined labels with optional priority (1–4) applied to requirements.
- `saved-views` — named filter snapshots over the requirement catalogue.
- `directions` — Home Affairs Directions register, response state, evidence and notes.
- `compliance-entries` — per-requirement compliance state, evidence, target maturity, reviewer, notes.
- `compliance-events` — append-only audit trail of compliance state changes.
- `work-log-entries` — per-requirement free-text journal entries with optional effort string.
- `posture` — singleton record carrying global threat level, posture mode, and per-domain overrides.
- `relationships` — first-class relationship records between requirements, risks, actions, and Directions (in addition to canonical `links`).

These collections follow the same invariants as the canonical collections: lower-case kebab-case names (see `pspf-invariants.md` § N2), entity envelope, declared `publication` policy on every field, no personal data. Their canonical entity-type strings and ID prefixes are added to `pspf-invariants.md` § N1 / § N3 in the same change.

### Required collections per flow

| Flow | Required collections |
|---|---|
| Publication (`intent: full-replace`) | `requirements`, `links`, plus at least one summary index |
| Local-authoring full backup (`intent: full-replace`) | All non-empty local-authoring collections. The user MAY exclude the `compliance-events` collection at export time; the resulting bundle remains valid. |
| Additive share (`intent: additive-merge`) | At least one of the local-authoring collections |
| GRC capture (`generator.mode: grc-capture`) | `compliance-entries`, optionally `evidence` |
| Work import (`intent: plan-apply`) | `risks` and/or `actions`, optionally `links` |

### Optional later collections

Add later only when needed:

- `suppliers`
- `contracts`
- `incidents`
- `assurance-activities`

Workforce data (`Person`, `Assignment`) is **never** added to bundles.

## Example minimal manifest contract

```json
{
  "$schema": "./schemas/manifest.schema.json",
  "bundleType": "pspf-explorer-bundle",
  "bundleVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "apiVersion": "1.0.0",
  "generatedAt": "2026-05-09T01:15:00Z",
  "compatibility": {
    "explorerMin": "1.0.0",
    "explorerTested": "1.0.0"
  },
  "security": {
    "classification": "OFFICIAL",
    "containsSensitiveData": true,
    "redactionProfile": "explorer-default"
  },
  "collections": [
    { "name": "requirements", "path": "./collections/requirements.json", "count": 412 },
    { "name": "links", "path": "./collections/links.json", "count": 1880 },
    { "name": "evidence", "path": "./collections/evidence.json", "count": 301 },
    { "name": "actions", "path": "./collections/actions.json", "count": 77 },
    { "name": "risks", "path": "./collections/risks.json", "count": 25 }
  ]
}
```

## Out of scope for v1

The Explorer bundle spec does not include:

- incremental delta sync,
- browser-side mutation and write-back,
- authenticated multi-tenant APIs,
- live Core connectivity,
- binary attachments embedded in JSON,
- or arbitrary plugin-defined entity types.

## Conformance requirements

A conforming exporter must:

- generate a valid manifest,
- include explicit version metadata for the three canonical axes,
- emit required collections,
- preserve canonical IDs (with publication-time stripping per ADR 0002),
- publish first-class links,
- validate emitted JSON against the published Draft 07 schemas,
- and compute declared checksum metadata.

A conforming Explorer consumer must:

- load via manifest first,
- reject unsupported major versions on any of `schemaVersion`, `bundleVersion`, `apiVersion`,
- ignore unknown additive fields,
- tolerate absent optional collections where possible,
- and surface checksum or compatibility warnings clearly.

## Specification summary

The PSPF Explorer bundle is a manifest-led, directory-style static JSON package validated with JSON Schema, versioned with the three canonical semver axes, protected by simple SHA-256 checksums, and optimised for GitHub Pages delivery and client-side fetch. That gives Explorer a clean boundary from Core while keeping the data model inspectable, portable, and stable under additive change.

The key architectural rule is that Explorer consumes a **projection bundle**, not the live platform. Core and Workshop remain the authoritative system of record, while Explorer receives a curated, redacted, static read model designed for publication, portability, and trustworthy reporting views. Explorer also produces bundles back from local-authoring mode (ADR 0004), and those bundles travel through the same import discipline.
