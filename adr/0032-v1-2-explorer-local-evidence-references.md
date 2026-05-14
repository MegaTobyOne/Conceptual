# ADR 0032 — v1.2 Explorer local evidence references

- Status: accepted
- Date: 2026-05-14

## Context

v1.1 proved Explorer local-authoring phase 1: a user can persist Requirement status overlays in browser-local `IndexedDB`, export the effective state as the standard master bundle, and reset local data back to the loaded bundle baseline.

The next useful local-authoring increment is lightweight evidence capture. Operators often need to record a document path, URL, or short evidence reference while reviewing a published bundle. The existing `evidence` and `link` entity contracts already support this without adding new collections or schema axes.

## Decision

Ship v1.2 as Explorer local-authoring phase 2.

1. Package versions and `PSPF_SLICE_VERSION` bump to `1.2.0`.
2. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.3.0`.
3. Explorer adds an `IndexedDB`-backed local evidence reference store, scoped to the loaded bundle/workspace key.
4. A user can add a local evidence reference to a Requirement. Explorer materialises it as an `evidence` record with `sourceProduct = "explorer"` and a `supported-by` `link` from the Requirement to that Evidence.
5. Local evidence references overlay the loaded bundle for rendering and export, using the existing master bundle format with `generator.mode = "local-authoring"`.
6. Reset local data clears both Requirement status overlays and local evidence references for the loaded bundle key.
7. No new entity type, collection, schema directory, compatibility-axis bump, `plan-apply`, editable posture, Shop, or Pub is introduced in v1.2.

## Consequences

- Explorer can now round-trip the two most common lightweight local review edits: Requirement status and evidence reference.
- Core import can consume the exported v1.2 bundle through the existing entity import path because the data uses existing `evidence` and `link` records.
- Evidence capture remains deliberately lightweight. It is not a document store, file attachment system, GRC synchronisation mechanism, or full Workshop replacement.

## Alternatives considered

- **Add a new `compliance-entries` or `work-log-entries` collection first.** Rejected for v1.2 because the existing entity model can validate the evidence-reference workflow without a schema expansion.
- **Capture local free-text notes on Requirements.** Rejected for this slice because the existing Requirement `summary` policy is sensitive and the round-trip semantics need a clearer redaction decision.
- **Add local Action/Risk creation at the same time.** Rejected to keep the phase small enough to validate manually.