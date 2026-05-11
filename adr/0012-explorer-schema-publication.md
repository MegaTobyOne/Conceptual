# 0012 — Explorer JSON Schema publication: per-version, same-origin, immutable once published

- Status: accepted
- Date: 2026-05-09
- Supersedes: —
- Superseded by: —

## Context

ADR 0009 consolidated the four prototype JSON formats into a single master bundle. That bundle is described by a JSON Schema. With one schema now in scope, the question is **what we publish, where, and under what versioning rule**.

The prototype published nothing externally; the schema lived inside the app. That worked for a single-vendor flow but blocks any future producer (Workshop export, Core publication, third-party tooling) from validating bundles against an authoritative document. It also means the schema and the runtime validator could drift without anyone noticing.

The forces in play:

- The `schemaVersion` axis (ADR 0008) implies the schema can change over time. Old bundles MUST remain validatable forever.
- Explorer is offline-first with strict CSP `default-src 'self'`. Producers and consumers MUST be able to validate without remote network access.
- The runtime validator and the schema offered to producers MUST agree, or import-time errors and producer-time errors will diverge.
- Schema-version stability is a contract: once a `schemaVersion` is published, breaking changes within that version would silently break consumers and existing fixtures.

## Decision

The bundle JSON Schema is published **per-`schemaVersion`**, **same-origin**, and is **immutable once published**.

1. **In-repo source of truth.** Every published `schemaVersion` has a copy at `schemas/explorer-bundle/<schemaVersion>/` in the repo (e.g. `schemas/explorer-bundle/1.0.0/manifest.schema.json`, plus per-collection schemas alongside). Superseded versions are kept; nothing is deleted.
2. **Served path.** Explorer serves the same tree at `/schemas/explorer-bundle/<schemaVersion>/...`. CSP forbids cross-origin fetches, so the only way to fetch a published schema is from the deployed Explorer URL or from the bundle itself.
3. **`$schema` field on bundles.** Producers SHOULD emit two forms so consumers can validate online or offline:
   - an absolute URL pointing to the served version (e.g. `https://explorer.example.org/schemas/explorer-bundle/1.0.0/manifest.schema.json`), and
   - a sibling copy of the schema tree inside the bundle directory at `./schemas/`, with `$schema` set to `./schemas/manifest.schema.json` for offline validation.
4. **Stability rule.** Once a `schemaVersion` is published, breaking changes to its schema document are forbidden. Non-breaking additions per the additive compatibility rule of `pspf-explorer-json-bundle-schema-spec.md` are permitted within the same version. Breaking changes require a new `schemaVersion` directory; both versions are served during a deprecation window.
5. **No remote `$ref`s.** All `$ref`s in a published schema MUST be local (`#/...`) or relative to the same `schemas/explorer-bundle/<schemaVersion>/` directory.
6. **Validator parity.** The validator the Explorer runtime uses for imports MUST be loaded from the same per-version schema tree it serves to producers. CI hash-compares the runtime validator and the served schema for the active `schemaVersion`.

## Consequences

Positive:

- Old bundles remain validatable for as long as their `schemaVersion` directory is served. No "schema changed under us" failure mode.
- Producers external to Explorer can validate ahead of import without bundling the schema themselves, while still being able to validate offline by reading the bundle's sibling copy.
- The CSP-strict, no-remote-`$ref` rule means a bundle plus its sibling schema is genuinely portable to an air-gapped environment.
- Drift between the runtime validator and what producers see is detected by CI rather than at user-visible import time.

Negative or limiting:

- Breaking schema changes require a new version directory and a maintained deprecation window. This is appropriate friction; it's not free.
- Hosting many versions grows the served tree over time. At PSPF's expected cadence this is negligible.
- Producers that want to validate online must be on a network path to the Explorer URL. The offline (`./schemas/...`) form is provided exactly for this case.

## Reopening criteria

Reopen this ADR if:

- A multi-tenant or multi-product publishing model emerges and Explorer is no longer the natural host for the schema (consider an external schema registry).
- The deprecation-window cost becomes load-bearing (multiple concurrent `schemaVersion` lines in active use).
- A producer needs cross-origin schema fetches for a use case that doesn't fit the offline-bundle model.

## Cross-references

- `pspf-explorer-json-bundle-schema-spec.md` § Schema publication and `$schema` resolution.
- `pspf-invariants.md` § E23 — Per-version schema publication.
- ADR 0008 — Canonical version axes (`schemaVersion`, `bundleVersion`, `apiVersion`).
- ADR 0009 — Explorer single master bundle.
