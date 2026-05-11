# 0019 - Requirement to ISM control mapping

- Status: accepted
- Date: 2026-05-11

## Context

ADR 0017 defines Phase 2 of ISM integration as a first-class PSPF Requirement to ISM control mapping. ADR 0018 supplies the read-only ISM source-control endpoints needed for that mapping.

The existing link taxonomy is deliberately closed and simple. A plain `Link` record can say that one entity supports or is addressed by another, but it cannot safely carry the mapping-specific attributes operators need: coverage qualifier, applicability profile, rationale, and provenance. Those attributes are the basis for posture brief claims and must round-trip through snapshot, export, import, and Explorer publication without leaking sensitive interpretation.

## Decision

Introduce a first-class `requirement-control-mapping` entity for v0.2.

### Identity and ownership

- The canonical prefix is `MAP`.
- The entity type is `requirement-control-mapping`.
- The bundle collection is `requirement-control-mappings`.
- A mapping connects exactly one `requirement` endpoint to exactly one `source-control` endpoint.
- The source-control endpoint must be a `SRC-*` ISM control from the vendored source library defined in ADR 0018.

### Fields

The v0.2 mapping fields are:

- `id`: `MAP-*` canonical ID.
- `entityType`: `requirement-control-mapping`.
- `requirementId`: `REQ-*` endpoint.
- `sourceControlId`: `SRC-*` endpoint.
- `coverageQualifier`: one of `primary`, `partial`, `compensating`.
- `applicabilityProfile`: ISM profile key such as `e8-ml2`, `official-sensitive`, or `all`.
- `rationale`: operator-authored explanation of the mapping.
- `provenance`: at minimum `author`, `createdAt`, and `oscalRelease`.

### Relationship to links

- Do not add a `mapped-to` link type in v0.2.
- Do not model mappings as plain `LNK-*` rows.
- Products may derive read-only navigation edges from mappings, but the mapping entity is the source of truth.
- The closed 22-verb vocabulary remains unchanged for v0.2.

### Publication policy

- `requirementId`, `sourceControlId`, `coverageQualifier`, `applicabilityProfile`, and mapping provenance are `internal` by default.
- `rationale` is `sensitive` by default.
- No mapping field is `restricted` by default, but the exporter still fails closed if free text is not explicitly eligible for the selected publication profile.
- Public posture outputs may include aggregate ISM coverage counts only when the underlying mappings are eligible under the active profile and every claim traces back to mapping IDs or counts.

### Round trip and validation

- Snapshot, export, import, and Explorer publication preserve mapping endpoints, `coverageQualifier`, `applicabilityProfile`, and provenance.
- Import rejects mappings with missing endpoints, unresolved `REQ-*` requirements, unresolved `SRC-*` source controls, invalid coverage qualifiers, or invalid applicability profiles.
- Additive merge treats mapping identity as canonical by `MAP-*`; duplicate semantic mappings with different IDs are flagged for review before implementation applies them.

### Product surfaces

- Workshop authors and edits mappings from Requirement detail, using pickers for known-set inputs.
- Explorer publication mode shows mappings read-only and includes an ISM coverage section in the posture brief when bundle policy allows it.
- No product claims ISM coverage unless the claim is derived from mapping records.

## Consequences

### Positive

- Mapping semantics remain explicit, queryable, and independently testable.
- The link taxonomy stays stable for v0.2.
- Sensitive operator rationale is separated from public ASD/ACSC source text.
- Posture brief ISM coverage can be traced to durable mapping records rather than inferred from notes.

### Negative / accepted trade-offs

- v0.2 adds another entity and collection to contracts, schemas, fixtures, import/export, and UI surfaces.
- Users may expect a visible link row for every mapping; products need to explain the mapping panel clearly through UI structure, not extra prose.
- Duplicate semantic mapping detection needs careful implementation because canonical IDs alone do not catch all accidental duplicates.

## Alternatives considered

- **Add a `mapped-to` link type and store attributes beside it.** Rejected: it splits the relationship from its explanation and increases taxonomy churn.
- **Reuse `LNK` with custom fields.** Rejected: it weakens the closed link contract and risks ad hoc link payloads.
- **Keep mappings as free text on Requirements.** Rejected: free text cannot support defensible coverage calculations, redaction gates, or round-trip validation.
- **Model ISM controls as Requirements and use existing requirement links.** Rejected by ADR 0017 because ISM controls are implementation controls, not PSPF assurance outcomes.