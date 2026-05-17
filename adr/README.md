# PSPF Architecture Decision Records

This directory holds ADRs for the PSPF ecosystem. ADRs are short, dated, numbered, and immutable once accepted. New decisions that supersede an existing ADR add a new ADR and update the older one's status.

## Status values

- `proposed` — under discussion.
- `accepted` — current decision.
- `superseded by NNNN` — replaced by a later ADR.
- `deprecated` — no longer relevant but retained for history.

## Index

| ID | Title | Status |
|---|---|---|
| 0001 | Product set and naming | accepted |
| 0002 | Canonical ID format (UUIDv7, time-stripped on publish) | accepted |
| 0003 | Link taxonomy (simple linkType vocabulary) | accepted |
| 0004 | Explorer dual-mode (publication + local authoring) | accepted |
| 0005 | Default-deny redaction and publication policy | accepted |
| 0006 | Snapshot immutability with redaction events for erasure | accepted |
| 0007 | Extension packaging and trust registry | accepted |
| 0008 | Canonical version axes | accepted |
| 0009 | Explorer single master bundle | accepted |
| 0010 | Explorer Relationships surface: Board primary, graph deferred | accepted |
| 0011 | OFFICIAL: Sensitive — labelling-only protection in v1 | accepted |
| 0012 | Explorer JSON Schema publication: per-version, same-origin, immutable | accepted |
| 0013 | Monorepo source layout (supersedes 0007 § Repos) | accepted |
| 0014 | v0.1 thin-slice scope | accepted |
| 0015 | Item Detail surface is a WebviewPanel | accepted |
| 0016 | Australian context amplified | accepted |
| 0017 | ISM integration roadmap | accepted |
| 0018 | ISM source library | accepted |
| 0019 | Requirement to ISM control mapping | accepted |
| 0020 | ISM mapping quality and version drift | accepted |
| 0021 | v0.4 readiness and UI resilience | accepted |
| 0022 | v1.0 scope for initial assurance user testing | accepted |
| 0023 | v0.5 Directions overlay and Action Impact ranking | accepted |
| 0024 | v0.6 Workshop parity for Directions and Action Impact | accepted |
| 0025 | v0.7 engine hardening | accepted |
| 0026 | v0.8 first-run and packaging readiness | accepted |
| 0027 | v0.9 release-candidate freeze | accepted |
| 0028 | v1.0 initial assurance user testing release | accepted |
| 0029 | v1.0 reference data baseline | accepted and implemented |
| 0030 | v1.0.1 validation closure and Explorer local-authoring phase 1 | accepted |
| 0031 | v1.1 Explorer local-authoring phase 1 | accepted |
| 0032 | v1.2 Explorer local evidence references | accepted |
| 0033 | v1.3 Explorer local actions | accepted |
| 0034 | v1.4 Explorer local Risks and conflict display | accepted |
| 0035 | v1.5 plan-apply import and undo | accepted |
| 0036 | v1.5.1 Explorer and Workshop product boundary and Explorer identity | accepted |
| 0037 | v1.6 Workshop import review and identity | accepted |
| 0038 | v1.0 first deployment baseline (VentraIP, tobyharvey.online, Marketplace publisher `tobyharvey`) | accepted |
| 0039 | Branching and release promotion | accepted |
| 0040 | Dispatch-driven release workflows (web and marketplace) | accepted |
| 0041 | v1.7 Tags and filters foundation | accepted |
| 0042 | v1.8 Saved views | accepted |
| 0043 | v1.9 saved-view expansion | accepted |
| 0044 | v1.10 Workshop change-record foundation | accepted |
| 0045 | v1.11 Explorer change story | proposed |
| 0046 | v1.12 Planning lens | accepted |
| 0047 | v1.13 Release assurance and Marketplace verification | accepted |
| 0048 | v1.14 Compliance history export controls | accepted |

## Template

```markdown
# NNNN — Title

- Status: proposed | accepted | superseded by NNNN | deprecated
- Date: YYYY-MM-DD
- Supersedes: (optional)
- Superseded by: (optional)

## Context

What is the situation, what are the forces in play?

## Decision

What we are doing.

## Consequences

What follows from this decision: positive, negative, and accepted trade-offs.

## Alternatives considered

What we rejected, and why.
```
