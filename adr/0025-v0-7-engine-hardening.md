# ADR 0025 — v0.7 engine hardening

## Status

Accepted.

## Context

v0.6 lifted Directions and Action Impact into the Workshop authoring loop while keeping the published schema, bundle, and API axes unchanged. Before moving into first-run polish and release-candidate work, the Core engine needs stronger operational diagnostics and clearer API boundaries.

The existing writer-lock gate blocked writes when another live process held the lock, but the single-writer policy was implicit. Integrity checks were limited to SQLite `PRAGMA integrity_check` and did not detect malformed entity payloads or broken PSPF entity links.

## Decision

1. Core exposes explicit API layers from `packages/core/src/service.ts`:
   - `CoreReadApi` for workspace paths, validation, and entity reads.
   - `CoreWriteApi` for initialisation, snapshotting, writer-lock state, and entity writes.
   - `CoreExchangeApi` for export/import.
   - `CoreIntegrityApi` for SQLite integrity and the richer integrity scan.
   `createCoreService()` remains the compatibility facade and composes these layers.
2. Core adds `runIntegrityScan()` and the command `PSPF: Run Integrity Scan`. The scan writes `.pspf/logs/integrity-scan.json` and checks:
   - SQLite integrity.
   - entity payload JSON parseability.
   - payload id/entityType consistency with database columns.
   - `link.fromId` / `link.toId` target existence.
   - `link.fromType` / `link.toType` consistency with referenced entities.
   - writer-lock state.
3. `scripts/check-integrity-scan.mjs` becomes a gate. It proves a clean workspace passes and a broken-link fixture fails with an orphaned-link finding.
4. Writer-lock state now declares `policy: "single-writer"`. `scripts/check-writer-lock.mjs` covers both live second-window write blocking and stale-lock recovery.

## Consequences

- The v0.7 engine can detect common corruption and authoring graph failures before export or release review.
- Workshop and Explorer behaviour is unchanged; this is an engine-hardening slice.
- Schema, bundle, and API compatibility axes remain at `1.3.0`. `PSPF_SLICE_VERSION` and package versions bump to `0.7.0`.
- Future checks can consume `.pspf/logs/integrity-scan.json` instead of scraping command output.

## Quality gates (delta)

- `check:gates` now includes `node scripts/check-integrity-scan.mjs`.
- `e2e:v0.7` runs the existing e2e flow, personal-data exclusion, and the integrity-scan gate.
- `check-writer-lock` now verifies the explicit single-writer policy and stale-lock recovery.
