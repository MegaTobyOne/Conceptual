# 0020 - ISM mapping quality and version drift

- Status: accepted
- Date: 2026-05-11

## Context

ADR 0018 introduced a read-only ISM source-control catalogue and ADR 0019 introduced first-class PSPF Requirement to ISM control mappings. v0.2 proves that a Requirement can be mapped to an ISM source control, exported, imported, and rendered in Explorer without leaking sensitive rationale.

The next operator question is whether a mapping is still trustworthy. A mapping may be low confidence, may not have been reviewed recently, or may point at an ISM control whose text changed in a newer vendored OSCAL release. ADR 0017 sketches this as Phase 3: mapping `confidence`, `lastReviewedAt`, `reviewBy`, and automated version-drift detection.

This is a schema and API change, so it needs an ADR before implementation.

## Decision

Implement ISM mapping quality and drift detection for v0.3.

### Mapping quality fields

`requirement-control-mapping` gains:

- `confidence`: required enum `low`, `medium`, `high`; default for legacy mappings is `medium`.
- `lastReviewedAt`: optional ISO-8601 timestamp.
- `reviewBy`: optional free text, never a `Person` link.

`reviewBy` deliberately remains free text to preserve personal-data exclusion. It may hold a role, team, or generic reviewer label such as `Cyber assurance lead`; it must not require or imply `Person.name` or `Person.email`.

### Source-control statement drift

`source-control` gains `statementChangeStatus` with enum `unchanged`, `changed`, `new`, `removed`.

The source-library build compares source controls by natural `controlId` between the current vendored source set and the previous vendored source set. A mapped source control is drift-affected when its current `statementChangeStatus` is `changed`, `new`, or `removed`. v0.3 seeds this comparison in package data; a full OSCAL parser can replace the seed later without changing the bundle contract.

### Gates and surfaces

- Add a `check:ism-drift` gate that flags mappings whose mapped source-control statement changed across vendored source sets.
- Workshop mapping authoring captures `confidence`, stamps `lastReviewedAt`, and optionally captures `reviewBy`.
- Workshop Item Detail and Explorer ISM Coverage display confidence, review metadata, and drift status.
- Explorer remains publication mode only; no profile picker ships in v0.3.

### Versioning and publication

- Roll `schemaVersion`, `bundleVersion`, and `apiVersion` to `1.2.0`.
- Roll package/product version to `0.3.0`.
- Publish `confidence`, `lastReviewedAt`, `reviewBy`, mapping endpoints, coverage qualifier, applicability profile, provenance, and source-control statement drift as `internal` or `public` according to the existing publication model.
- `rationale` remains `sensitive` and is still excluded from default published bundles.

## Consequences

### Positive

- Operators can see whether ISM mappings are reviewed and confidence-rated.
- A changed ISM control becomes visible in Explorer instead of silently undermining a coverage claim.
- The drift gate gives maintainers a deterministic test target before full OSCAL ingestion lands.

### Negative / accepted trade-offs

- v0.3 introduces another schema directory and additive migration defaults for old mappings.
- Seeded drift data is a harness, not the final full OSCAL ingestion implementation.
- `reviewBy` is intentionally less structured than a Person or Assignment link, trading precision for privacy safety.

## Alternatives considered

- **Defer drift until full OSCAL ingestion.** Rejected: the bundle and UI semantics can be validated now with seeded source sets.
- **Use a `Person` or `Assignment` reviewer link.** Rejected: it risks personal-data leakage and is unnecessary for v0.3.
- **Make the profile picker part of v0.3.** Rejected: mapping quality and drift are higher leverage, and the picker can arrive after users validate the coverage table.
- **Store drift only in CI reports.** Rejected: operators need to see drift at the mapping row where they make assurance decisions.