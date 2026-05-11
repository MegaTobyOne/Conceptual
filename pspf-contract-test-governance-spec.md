# PSPF Contract Test Governance Specification

## Purpose

This specification defines ownership, tooling expectations, and CI policy for schema and API contract tests across PSPF workspace packages in the single `pspf` monorepo.

## Goals

1. Prevent schema/API drift between Core and companion products.
2. Fail fast on breaking changes before release.
3. Keep compatibility matrix evidence machine-verifiable.

## Contract surfaces

Contract tests must cover:

- Core API request/response types,
- capability and authorisation behaviour,
- canonical entity and link schema validity,
- Explorer bundle schema compatibility,
- migration compatibility for supported upgrade paths.

## Ownership model

1. `packages/contracts/` owns canonical contract definitions and fixture baselines.
2. `packages/core/` owns producer compatibility suites for the Core API and system-of-record shape.
3. `packages/workshop/`, `packages/shop/`, `packages/pub/`, and `packages/explorer/` own consumer compatibility suites for the package surfaces they consume.
4. Contract-breaking proposals require explicit approval from both producer and consumer owners, even when the same maintainer approves both sides in a solo-maintained repo.

## Test artefact model

Required artefacts:

- versioned API contract package,
- versioned schema package,
- golden JSON fixtures,
- compatibility matrix report.

## CI policy

### Pull requests

Any PR touching API, schema, importer, exporter, or migration code must:

1. run producer contract tests,
2. run impacted consumer compatibility tests,
3. publish compatibility report artefact,
4. fail on unresolved breaking changes.

### Release tags

Release workflow must block publication if contract compatibility report is missing or failed.

## Breaking change policy

A change is breaking when any of the following are true:

1. Existing required field removed or semantics changed incompatibly.
2. Existing API request/response contract changed incompatibly.
3. Existing enum value removed without compatibility strategy.
4. Consumer fixture import fails for supported versions.

Breaking changes require:

1. major version bump,
2. migration strategy,
3. explicit release note and compatibility matrix update.

## Execution cadence

1. Full in-repo contract suite runs on protected branch merges.
2. Nightly contract run validates the latest compatible package versions and standard fixtures.
3. Weekly report summarises compatibility status and drift risk.

## Governance checks

Every contract-impacting PR should include:

- impacted contract surface list,
- expected compatibility outcome,
- fixture updates,
- migration notes where required.
