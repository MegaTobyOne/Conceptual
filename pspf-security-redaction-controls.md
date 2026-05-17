# PSPF Security and Redaction Controls

## Purpose

This document defines the **default-deny per-field publication policy** that governs what data is allowed on which surface, plus the surface-level UI rules that follow from it.

The normative rule lives in ADR 0005 and `pspf-invariants.md` § S3, S7. This document is the operational reading of those rules and the CI test contract that enforces them.

## Per-field publication policy (the rule)

Every entity field declares an explicit `publication` policy in the schema. The policy values are:

| Policy | Where it may appear | Logs and diagnostics |
|---|---|---|
| `public` | UI, status bar (counts only), bundles, Explorer | structured logs only, never values |
| `internal` | UI, workspace within operator's organisation | structured logs only, never values |
| `sensitive` | UI detail panels only, never status bar or notifications, never bundles unless an export profile explicitly opts in | redacted in logs as `[REDACTED:sensitive]` |
| `restricted` | UI detail panels only, never any export, never any bundle, never any snapshot artefact | redacted in logs as `[REDACTED:restricted]` |

**Default for any new field is `sensitive`.** A field with no declared policy is a CI failure.

### Personal data

The following fields are `restricted` by definition:

- `person.name`
- `person.email`
- `assignment.personId`
- `change-record.decisionOwnerRef`

These never appear in any bundle, snapshot, Explorer artefact, or external log, regardless of profile or override.

For Change Records, `title`, `summary`, classification enums, and dates may be published. `reason` and `impactSummary` are `sensitive` and redacted from Explorer publication by default; `decisionOwnerRef` is `restricted` and never exported.

## Surface redaction rules (derived from the policy)

### Status bar

1. Allowed: high-level platform health and counts only (fields with policy `public`).
2. Not allowed: any value drawn from a field with policy `internal`, `sensitive`, or `restricted`.

### Notifications

1. Allowed: action outcome summaries and generic diagnostic messages.
2. Not allowed: any value drawn from a `sensitive` or `restricted` field. Stable diagnostic codes only.

### Quick pick labels

1. Use canonical ID plus a `public` or `internal` label field only.
2. Sensitive free-text fields appear only in explicit detail panels after user selection.

### Logs

1. Log stable diagnostic codes, timestamps, operation IDs, and result states.
2. Never log values from `sensitive` or `restricted` fields. Use structured placeholders.
3. Stack traces are redacted of any literal value from non-`public` fields before persistence.

### Export bundles

1. The exporter walks each entity and includes only fields whose effective policy is eligible for the active profile.
2. `restricted` fields are dropped under all profiles.
3. `sensitive` fields are dropped unless the active profile explicitly opts them in by name.
4. Bundle metadata records the active profile and the schema's policy version.

## Export profiles

Profiles are small, declarative, and inspectable. The default `explorer-default` profile opts in **no** `sensitive` fields. A profile opting in any `sensitive` field MUST list each opted-in field by name; wildcards are forbidden.

Example profile shape:

```yaml
name: explorer-default
opts-in-sensitive: []
```

```yaml
name: internal-share
opts-in-sensitive:
  - evidence.summary
  - action.title
```

## Secret storage controls

1. Store secrets only in VS Code `SecretStorage`.
2. Never persist secrets in the SQLite store, config files, logs, snapshot metadata, or bundle exports.
3. Rotate Marketplace and deployment credentials using `pspf-secrets-rotation-and-incident-runbook.md`.

## CI test contract

The following tests MUST exist and MUST pass for every Core release:

1. **Schema policy completeness** — every field in every entity schema has a declared `publication` policy. Failure mode: build break, no override.
2. **Personal-data exclusion** — export of every profile against a fixture containing populated `person` and `assignment` records produces a bundle with no `person.name`, no `person.email`, no `assignment.personId`.
3. **Restricted-field exclusion** — for every profile, no `restricted` field appears in the output.
4. **Sensitive-field opt-in** — for every profile, only fields named in `opts-in-sensitive` appear from the `sensitive` set; nothing else.
5. **Surface redaction** — status bar, notifications, and log fixtures never emit values from `sensitive` or `restricted` fields.
6. **Secret scan** — secret-pattern scan passes for changed files.
7. **Profile shape** — every export profile parses cleanly, contains no wildcards in `opts-in-sensitive`, and references only fields that exist in the current schema.
