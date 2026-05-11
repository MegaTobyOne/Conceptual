# 0006 — Snapshot immutability with redaction events for erasure

- Status: accepted
- Date: 2026-05-09

## Context

Snapshots are immutable by design — that is the property that makes them useful for reporting defensibility. But Australian Privacy Principle 11.2 requires destruction or de-identification of personal information when it is no longer needed (or on a justified subject request). The two requirements collide whenever a snapshot has captured personal data.

Decision 0001 already excludes Person fields from published Explorer bundles. This ADR addresses the residual case: personal data captured into a local snapshot that the operator now needs to remove.

## Decision

- Personal data is **never** captured into a snapshot in identifying form. The snapshot exporter applies the same default-deny rules as the publication exporter (ADR 0005), so `Person.name`, `Person.email`, and `Assignment.personId` never enter snapshot artefacts.
- For records that nonetheless need erasure (operator decides a record should be removed), Core supports a **redaction event** mechanism:
  - A new command `pspf.core.recordRedactionEvent` writes a tombstone record into the journal that supersedes the targeted entity's identifying fields with a fixed redacted marker.
  - All subsequent queries, including queries that traverse to historical snapshots, return the tombstoned values.
  - The redaction event is itself auditable: who did it, when, why (free text rationale), what was redacted (field-level, not value-level).
  - Snapshots' raw stored bytes are unchanged on disk; reading a snapshot applies the redaction overlay at query time.
- A `pspf.core.purgeEntity` command exists for genuinely destructive erasure. It is `platform-admin`-scoped, requires Workspace Trust, requires explicit operator confirmation, and writes an audit row recording the destruction (without the destroyed values). After purge, the entity ID resolves to a tombstone forever.

## Consequences

- Snapshots remain immutable artefacts; the redaction overlay model preserves their evidentiary value while honouring privacy obligations.
- Reports generated from a snapshot after a redaction event will differ from earlier reports against the same snapshot. The report itself records the redaction-event timestamp so the divergence is traceable.
- `purgeEntity` is the nuclear option and should be rare. It is documented as the last resort.
- Tombstones occupy a small amount of permanent space; this is accepted.
- A migration runbook step is added: on schema upgrades, redaction overlays carry forward.

## Alternatives considered

- **Mutable snapshots.** Rejected; destroys the assurance property.
- **No redaction support, document workaround.** Rejected; not compatible with APP 11.2 in plausible cases.
- **Encrypt personal data with a key that can be destroyed.** Rejected for v1 complexity; revisit if classification ladder grows.
