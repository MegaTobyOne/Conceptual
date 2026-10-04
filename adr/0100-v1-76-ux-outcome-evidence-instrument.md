# 0100 — v1.76 UX outcome evidence instrument

- Status: accepted
- Date: 2026-09-21

## Context

The repository has structural, accessibility, redaction, and determinism gates, but it cannot show whether a shipped workflow helps an operator reach a defensible answer with less effort. The external think-aloud sessions recorded in `docs/ux-improvement-ideas.md` were not run. C0 therefore needs a deterministic, offline substitute that can establish a baseline for later slices without collecting operator identity or network telemetry.

## Decision

1. Record four stable flagship jobs (FJ1–FJ4) over existing Explorer and Workshop capability. Each job defines a start state and the answer-visible end state in `docs/ux-evidence/flagship-jobs.md`.
2. Measure interaction cost from driver events, not wall-clock time. The cost record contains route changes, distinct surfaces opened, discrete input events, and the first step at which the stated answer is visible.
3. Record a scripted cognitive-walkthrough verdict (`pass`, `partial`, or `fail`) and a reason code for each job. This is simulated-operator evidence, weaker than observed-user evidence, and must never be described as validation.
4. Record undefined specialist terms per job as the readability measure. The existing banned-jargon rule remains a failure gate; the count provides a trendable baseline.
5. Enforce a non-regression ratchet with `check:journey-cost`: every job must be present, every cost dimension must be no greater than its baseline, and the evidence pack product version must be at least the root package version. The pack must not contain person or free-text fields.

This slice changes no entity, link, schema, bundle, API, or product surface. The only compatibility version changed is the release slice version, from `1.75.0` to `1.76.0`; `schemaVersion`, `bundleVersion`, and `apiVersion` are unchanged.

## Consequences

- Later UX slices have a recorded, reproducible baseline and cannot silently regress the measured journeys.
- The instrument is cheap to run offline and privacy-preserving, but it cannot replace observed-user research or establish that a real operator benefits.
- A baseline can encode the current workflow's cost; review must therefore consider walkthrough verdicts and readability alongside the numeric ratchet.
- The evidence pack stays in repository documentation and is not exported, published, or sent to external services.

## Alternatives considered

- **Telemetry or hosted analytics:** rejected because PSPF is local-first and the evidence must not collect operator identity or require network access.
- **Wall-clock journey timing:** rejected because machine load makes it flaky and incomparable in CI.
- **A single aggregate score:** rejected because counts and denominators are more inspectable, and a score would conceal which part of a journey changed.
- **Claiming simulated walkthroughs are validation:** rejected; observed-user sessions remain the stronger evidence and take precedence when available.
