# 0095 — v1.61 import, writer-lock, and rendering hardening

- Status: accepted
- Date: 2026-08-25

## Context

The v1.60 review found three release-blocking reliability and security defects. Workshop interpolated some persisted values into script-enabled webviews without a single null-safe escaping path. Core full-replace import could delete and replace records without one atomic transaction, accepted incomplete or weakly validated replacement bundles, and did not provide a durable recovery point. Core's PID-file writer lock also relied on check-then-delete takeover behaviour that could race across VS Code processes.

Release-gate validation then exposed two related contract gaps: Explorer local-authoring exports omitted empty canonical collections and sample bundles could contain requirement-control mappings whose source-control endpoint was absent. Cold backup/restore also needed an explicit rule that runtime lock ownership never travels with a backup.

## Decision

1. Workshop converts persisted display values null-safely and escapes them before HTML interpolation. Security-sensitive rendering helpers remain pure and directly executable in tests.
2. Core full-replace accepts only a complete current-version master bundle. It rejects unknown envelope or collection names, missing canonical collections, duplicate IDs, invalid JSON Schema formats, checksum/count mismatches, and unresolved requirement-control mapping endpoints.
3. A full replacement deletes records, inserts the validated replacement set, and records import success in one SQLite transaction. Core writes a durable pre-import rollback checkpoint before that transaction and supports explicit undo. Any SQL failure rolls back the deletion and all partial inserts.
4. Core writer ownership uses an atomic directory lock at `.pspf/core/locks/writer-v2.lock`, backed by `proper-lockfile` stale/heartbeat handling. A process-local ownership registry and random ownership token prevent diagnostic metadata from becoming lock authority. A live-PID guard prevents stale-heartbeat takeover of a running owner. Initialisation and every mutating entry point fail closed when ownership is unavailable or compromised.
5. Writer-lock metadata is diagnostic and runtime-only. Core releases ownership explicitly on deactivation; backup and restore must exclude lock directories and ownership metadata.
6. Explorer local-authoring export emits every canonical collection in canonical order, including empty collections, exactly one current posture record, and only mappings whose endpoints are present. This makes its output acceptable to Core's exact full-replace contract.
7. `check:release-hardening` permanently exercises Workshop hostile/missing-value rendering, strict/atomic/recoverable full-replace, complete Explorer export and mapping endpoints, multi-process writer contention and stale-owner recovery, cold backup/restore, and Explorer-to-Workshop import.
8. The product and package version advances to `1.61.0`. No entity, link, API, bundle shape, or publication policy changes; `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.15.0` and no new schema directory is created.

The `1.61.1` hotfix extends decision 1 across the shared webview shell and all consuming extension surfaces, rejects newly malformed Requirement titles at the Core write boundary, retains integrity reporting for historical malformed Requirement rows, and adds those behaviours to `check:release-hardening`. The compatibility axes remain `1.15.0`.

## Consequences

- Persisted hostile text no longer executes in the covered Workshop rendering path, and legacy missing fields no longer cause `.replace` or `.replaceAll` command failures.
- Full-replace is exact and recoverable rather than an implicit merge with local records. Older or partial bundles must use an appropriate merge path or be upgraded before replacement.
- Only one live Core process may mutate a workspace. A competing window remains readable but receives a deterministic writer-lock failure for mutations and initialisation.
- Backups are cold data copies, not transfers of process ownership. A restored workspace acquires a fresh lock before its first mutation.
- The hardening gate costs additional release time because it includes process-level and cross-product checks; this is accepted for a release-critical persistence and security boundary.

## Alternatives considered

- **Patch only the reported Workshop call sites**: rejected because persisted values have inconsistent legacy shapes; a null-safe escaping boundary and behavioural tests provide a durable rule.
- **Validate full-replace with TypeScript guards only**: rejected because the published JSON Schema, formats, manifest hashes/counts, and referential endpoints are part of the import trust boundary.
- **Delete a stale PID file and retry ownership**: rejected because check-then-delete cannot prove ownership and races with another process.
- **Copy lock state in workspace backups**: rejected because ownership describes a live process, not durable workspace data.
- **Bump the compatibility axes**: rejected because the change tightens implementation and validation of the existing `1.15.0` contract without changing its schema or API shape.
