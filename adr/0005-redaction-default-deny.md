# 0005 — Default-deny redaction and publication policy

- Status: accepted
- Date: 2026-05-09

## Context

Earlier drafts described redaction as a deny-list of behaviours ("don't put secrets in logs, don't dump full payloads to status bar"). That approach fails as the schema grows: every new field is published by default unless a maintainer remembers to add it to a deny list. For an assurance product, the failure mode of "we didn't think to redact this" is exactly the failure mode users cannot accept.

## Decision

Every entity field carries an explicit publication policy declared in the schema:

- `public` — eligible for publication and for Explorer bundles.
- `internal` — visible inside the workspace and within the operator's organisation; not eligible for publication.
- `sensitive` — handled with care in UI (no status bar exposure, no notification leaks); not eligible for publication unless an export profile explicitly opts in and the export is gated on Workspace Trust.
- `restricted` — never leaves the workspace boundary; never appears in any bundle or Explorer artefact.

**The default for any new field is `sensitive`.** A field that has no declared policy is a CI failure.

The publication-eligibility rule is then trivial: the exporter walks each entity, drops every field whose policy is not `public` (or whose policy is `sensitive` and not opted in by the active export profile), and refuses to emit `restricted` fields under any profile.

Personal fields (Person `name`, `email`; Assignment `personId`) are `restricted` and never appear in any bundle, regardless of profile.

## Consequences

- A schema-time CI test enforces that every field declares a policy.
- Export profiles are small, declarative, and inspectable. The `explorer-default` profile lists exactly which `sensitive` fields it opts in.
- New fields default to safe. Adding a new field never accidentally widens publication.
- Old field-pruning logic in the exporter is replaced by a single policy lookup.
- The redaction document becomes a policy document, not a behaviour list.

## Alternatives considered

- **Keep the deny-list approach.** Rejected; fails open on every new field.
- **Per-entity-type policy only, not per-field.** Rejected; some entity types have a mix of safe and unsafe fields (e.g. Evidence summary vs. Evidence location URL).
