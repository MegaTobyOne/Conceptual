# ADR 0026 — v0.8 first-run and packaging readiness

## Status

Accepted.

## Context

v0.7 hardened Core internals with explicit API layers, richer integrity scanning, broken-link fixture coverage, and a single-writer concurrency policy. The next release needs to make user validation easier on a fresh machine: a tester should be able to open VS Code, load a representative PSPF workspace, inspect the v1.0 surfaces, export a bundle, and run gates without hand-crafting records.

ADR 0007 keeps Core and Workshop as separately packaged VS Code extensions. v0.8 rehearses that package shape without publishing VSIX artefacts.

## Decision

1. `@pspf/contracts` exports `buildSampleWorkspaceEntities()`, a privacy-safe sample fixture with Requirements, Evidence, Actions, Risks, Directions, links, and an optional Requirement to ISM Control mapping when source controls are available.
2. Workshop adds two first-run commands:
   - `PSPF: Open Workshop Welcome`, a static `enableScripts: false` Welcome panel showing current workspace counts and the first-run command path.
   - `PSPF: Load Sample Workspace`, which initialises Core, builds the shared sample fixture, and writes it through `pspf.core.upsertEntities`.
3. `scripts/check-sample-workspace.mjs` validates the sample fixture by loading it into a clean workspace, running workspace validation and integrity scan, exporting a bundle, and checking redaction/publication safety.
4. `scripts/check-package-shape.mjs` rehearses ADR 0007 package expectations for Core and Workshop: manifest metadata, command contributions, built `dist/extension.js`, and Workshop's Core dependency.
5. `check:gates` and `e2e:v0.8` include the sample-workspace and package-shape checks.

## Consequences

- A tester can start from a blank folder and use the command palette to load a realistic PSPF assurance scenario.
- The sample fixture is shared between Workshop and CI, reducing drift between manual and automated validation.
- Packaging readiness is checked without publishing or requiring Marketplace credentials.
- Schema, bundle, and API compatibility axes remain at `1.3.0`. `PSPF_SLICE_VERSION` and package versions bump to `0.8.0`.

## Quality gates (delta)

- `check:sample-workspace` proves the first-run sample loads, validates, scans, exports, and remains publication-safe.
- `package:check` proves Core and Workshop package shapes remain aligned with ADR 0007.
- `e2e:v0.8` runs the existing e2e flow plus personal-data, integrity-scan, sample-workspace, and package-shape checks.
