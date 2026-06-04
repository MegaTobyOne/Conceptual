# ADR 0074: v1.39 Evidence Lifecycle And Reporting Polish

## Status

Accepted.

## Context

v1.39 adds operator feedback from Workshop, Pub, and reporting validation. Evidence links need local context for why a source supports a Requirement, teams need local lifecycle controls for role coverage, and executive reporting needs both a broad CSO issue and a narrower CISO issue.

The new evidence link context can contain sensitive free text. It must never become public Explorer content by accident.

## Decision

- Bump `schemaVersion`, `bundleVersion`, and `apiVersion` to `1.14.0` and publish `schemas/explorer-bundle/1.14.0/`.
- Add optional lifecycle metadata to the shared entity envelope: `lifecycleStatus` and `decisionDate`.
- Add optional `evidenceSection` and `evidenceNote` fields to `LinkEntity`.
- Treat `evidenceSection` and `evidenceNote` as sensitive/default-deny publication fields.
- Keep Workshop evidence link context local/operator-facing unless a future ADR explicitly defines a public-cleared evidence-note workflow.
- Split the magazine surface into Digital CSO Magazine for broad executive assurance and Digital CISO Magazine for Information + Technology operational assurance.
- Keep Pub lifecycle local-only: archived Pub roles remain in `.pspf/pub/pub.json`, stop counting as active team coverage, and are not exported to Explorer bundles.

## Consequences

- Release gates must validate schema coverage and publication policy for `1.14.0`.
- Evidence link notes are useful in Workshop but are stripped from public publication by default.
- Pub can support clean local removal/archive workflows without introducing public person/team data.
- CSO and CISO report outputs can evolve independently while sharing the same redaction-safe renderer foundation.
