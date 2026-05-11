# 0008 — Canonical version axes

- Status: accepted
- Date: 2026-05-09

## Context

Earlier drafts exposed five overlapping version fields: `apiVersion`, `apiMajor`, `schemaVersion`, `bundleVersion`, `exportVersion`. The compatibility doc never defined which of these governed which gate, and consumers were free to pick any combination. The result: a "machine-checked compatibility matrix" that could never close.

## Decision

There are **three canonical version axes**, all semver strings, all owned by Core:

1. `schemaVersion` — governs the SQLite schema, the entity envelope, and the per-entity field shapes. Migrations are keyed off this axis.
2. `bundleVersion` — governs JSON bundle structure, manifest layout, collection wrapper shapes, and Explorer compatibility.
3. `apiVersion` — governs the in-process Core extension API: command names, request/response shapes, event names, capability scopes.

All compatibility decisions MUST use only these three axes.

`apiMajor` is removed; consumers parse `apiVersion` and inspect its major component.

`exportVersion` is removed from the contract. Tools may still report their own release version in metadata for human debugging, but consumers MUST NOT make compatibility decisions based on it.

Per-event version fields (`eventVersion`) are retained for event payload evolution within an `apiVersion` major; they cannot grant or deny compatibility on their own.

## Compatibility rule

A consumer at versions `(schema=A, bundle=B, api=C)` MUST refuse to operate against a producer at versions `(schema=A', bundle=B', api=C')` when `A'.major > A.major`, `B'.major > B.major`, or `C'.major > C.major`. Minor and patch differences MUST be tolerated additively.

## Consequences

- The Core API exports `{ schemaVersion, bundleVersion, apiVersion }` and nothing else for compatibility.
- The compatibility matrix has three columns, not five.
- Existing references to `apiMajor` and `exportVersion` in specs and code are removed in the next revision.

## Alternatives considered

- **Collapse to one version.** Rejected; the three axes evolve at genuinely different rates.
- **Keep all five.** Rejected; consumer confusion is the failure mode we already saw.
