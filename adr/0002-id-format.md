# 0002 — Canonical ID format

- Status: accepted
- Date: 2026-05-09

## Context

Earlier drafts specified ULID-like sortable identifiers. ULIDs encode the creation timestamp in the high bits of the value. For most entity types this is a feature (sortability, debuggability). For `Person`, `Assignment`, and any other identity-related record, exposing the creation timestamp in a published artefact is a low-grade privacy leak: when someone joined, when responsibilities shifted, when records were created during sensitive periods.

UUIDv7 has the same time-sortable property as ULID but is a standard format with broad library support, and the timestamp can be stripped without breaking uniqueness because the random portion alone is collision-resistant in practice for the data volumes targeted in v1.

## Decision

- Canonical IDs use the format `<PREFIX>-<TOKEN>`.
- `<TOKEN>` is generated as a UUIDv7 internally so that databases retain time-sorted insert behaviour.
- For any artefact eligible to leave the workspace boundary (JSON bundle, Explorer publication, support log shared with a third party), the **48-bit Unix-ms timestamp prefix** of the UUIDv7 is **zeroed** before serialisation. The version (7) and variant (RFC 4122) bits are preserved.
- The `PER` (Person) and `ASM` (Assignment) entity types **always** serialise with the time bits stripped, even in internal artefacts, so that an internal log accidentally shared cannot leak personal timestamps.
- Display IDs (`R-123`-style aliases) are presentation only and never appear in API payloads, JSON bundles, or links.

## Consequences

- Time-stripped IDs are no longer time-sortable. Sorting in Explorer and reports must use entity timestamps (`createdAt`, `updatedAt`), not the ID.
- The on-disk SQLite store keeps full UUIDv7 IDs to retain insert locality and index-friendly ordering.
- The exporter must transform `PER` and `ASM` IDs and any other configured class on the publication boundary; the transform is one-way (zeroes are not recoverable), which is the intended privacy property.
- Any test or fixture that sorts by ID needs to switch to timestamp-based sorting.

## Alternatives considered

- **Keep ULID.** Rejected; same time-leak property and weaker library support than UUIDv7.
- **Use plain UUIDv4.** Rejected; loses insert-locality benefits in SQLite indexes.
- **Strip time on every entity type at export.** Considered; the marginal benefit beyond `PER`/`ASM` is small and the cost is debuggability of bundles. Adopted only for the personal-data classes by default; other classes can opt in via export profile.
