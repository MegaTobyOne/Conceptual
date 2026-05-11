# 0018 - ISM source library

- Status: accepted
- Date: 2026-05-11

## Context

ADR 0017 establishes that ISM is a distinct external control catalogue, not a second class of PSPF Requirement. v0.1 deliberately keeps ISM as free text only, but v0.2 needs a navigable source catalogue before operators can create defensible PSPF Requirement to ISM control mappings.

ASD/ACSC publishes the Information Security Manual as OSCAL under CC BY 4.0. The product also has a zero-runtime-egress invariant, default-deny publication policy, UUIDv7 identity rules, and Explorer publication-mode compatibility requirements. Any ISM source library must therefore be vendored, reproducible, attributed, and safe to render offline.

The current model already reserves the `SRC` prefix for source references. ADR 0017 narrows the v0.2 use of that prefix to ISM source controls. This ADR fixes the Phase 1 shape so implementation can begin without reopening the v0.1 thin slice.

## Decision

Introduce a read-only **ISM source library** for v0.2.

### Source snapshot

- Vendored OSCAL files live under `packages/ism-source-library/data/<oscalRelease>/`.
- The initial upstream release is `v2026.03.24` unless a newer ASD/ACSC release is deliberately selected before implementation starts.
- Snapshot replacement is an explicit operator or maintainer action. No product surface fetches ISM data from GitHub, cyber.gov.au, or any other network endpoint at run time.
- The package exposes build-time generation only: OSCAL snapshot in, deterministic `source-control` records out.

### Entity shape

- Each ISM control is represented as a `source-control` entity with canonical ID `SRC-<UUIDv7>`.
- The old generic label `source-reference` remains a historical supporting concept, but v0.2 implementation uses `source-control` for ISM catalogue records and the `source-controls` bundle collection.
- Natural ISM identifiers, OSCAL UUIDs, profile membership, and catalogue provenance travel as fields on the source-control record, never as the canonical key.
- The required provenance fields are `oscalRelease`, `catalog`, `profile`, and `sourceUrl`.
- Source records are read-only in Workshop and Explorer. Operators may not edit ASD/ACSC text.

### Publication policy

- `controlId`, `title`, `statement`, `profileTags`, `externalRefs`, and provenance fields are `public` because the ASD catalogue is public under CC BY 4.0.
- Any local operator interpretation, including `localApplicabilityNote`, is at least `sensitive` and is not editable in Phase 1.
- Every new field must declare a publication policy before code or schema changes land.

### Product surfaces

- Workshop may browse the ISM source library and show read-only ISM references on Requirement detail.
- Explorer publication mode may render the same read-only source browser and Requirement detail panel when a bundle includes `source-controls`.
- Every surface that displays vendored ISM text shows attribution: `ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release <oscalRelease>.`
- The attribution text is static text, not a live runtime fetch.

### Versioning and gates

- Adding `source-controls` rolls `bundleVersion` forward.
- `schemaVersion` rolls forward only when the runtime entity schema changes.
- v0.2 must include gates for OSCAL ingest reproducibility, required provenance, no runtime egress, and schema/publication-policy coverage.

## Consequences

### Positive

- Operators can inspect the relevant ISM catalogue offline before creating mappings.
- Mappings in ADR 0019 have stable source endpoints and provenance.
- The product preserves the zero-egress posture while still carrying an authoritative Australian source catalogue.
- Attribution obligations are explicit before ISM text appears in a UI or bundle.

### Negative / accepted trade-offs

- Vendoring ASD/ACSC content increases repository and package size.
- Snapshot updates become a deliberate maintenance workflow rather than an automatic background refresh.
- Source-control IDs are product-generated and do not encode the natural ISM identifier, so users need UI affordances to search by ISM control ID.

## Alternatives considered

- **Fetch ISM at runtime.** Rejected: it violates the zero-runtime-egress invariant and would make Explorer publication mode depend on external services.
- **Use the natural ISM control identifier as the canonical ID.** Rejected: PSPF canonical IDs are prefix plus UUIDv7, and natural identifiers belong in `externalRefs`.
- **Keep only free-text ISM references.** Rejected: free text cannot support reproducible coverage calculations or round-trip mapping validation.
- **Model ISM controls as Requirements.** Rejected for the reasons in ADR 0017: it conflates PSPF assurance outcomes with ISM implementation controls.