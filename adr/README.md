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
| 0002 | Canonical ID format | accepted |
| 0003 | Link taxonomy | accepted |
| 0004 | Explorer dual-mode | accepted |
| 0005 | Default-deny redaction and publication policy | accepted |
| 0006 | Snapshot immutability with redaction events for erasure | accepted |
| 0007 | Extension packaging and trust registry | accepted (source-layout aspect superseded by ADR 0013) |
| 0008 | Canonical version axes | accepted |
| 0009 | Explorer single master bundle | accepted |
| 0010 | Explorer Relationships surface: Board primary, graph deferred | accepted |
| 0011 | OFFICIAL: Sensitive — labelling-only protection in v1 | accepted |
| 0012 | Explorer JSON Schema publication: per-version, same-origin, immutable once published | accepted |
| 0013 | Monorepo source layout (supersedes ADR 0007 § Repos) | accepted |
| 0014 | v0.1 thin-slice scope | accepted |
| 0015 | Item Detail surface is a WebviewPanel | accepted |
| 0016 | Australian context is a strength, not a footnote | accepted |
| 0017 | ISM integration roadmap | accepted |
| 0018 | ISM source library | accepted |
| 0019 | Requirement to ISM control mapping | accepted |
| 0020 | ISM mapping quality and version drift | accepted |
| 0021 | v0.4 readiness and UI resilience | accepted |
| 0022 | v1.0 scope for initial assurance user testing | accepted |
| 0023 | v0.5 Directions overlay and Action Impact ranking | accepted |
| 0024 | v0.6 Workshop parity for Directions and Action Impact | Accepted |
| 0025 | v0.7 engine hardening | Accepted |
| 0026 | v0.8 first-run and packaging readiness | Accepted |
| 0027 | v0.9 release-candidate freeze | Accepted |
| 0028 | v1.0 initial assurance user testing release | Accepted |
| 0029 | v1.0 reference data baseline | accepted and implemented |
| 0030 | v1.0.1 validation closure and Explorer local-authoring phase 1 | accepted |
| 0031 | v1.1 Explorer local-authoring phase 1 | accepted |
| 0032 | v1.2 Explorer local evidence references | accepted |
| 0033 | v1.3 Explorer local actions | accepted |
| 0034 | v1.4 Explorer local Risks and conflict display | accepted |
| 0035 | v1.5 plan-apply import and undo | accepted |
| 0036 | v1.5.1 Explorer and Workshop product boundary and Explorer identity | accepted |
| 0037 | v1.6 Workshop import review and identity | accepted |
| 0038 | v1.0 first deployment baseline | accepted |
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
| 0049 | Core storage engine uses bundled sql.js | Accepted |
| 0050 | v1.15 Shop commercial planning foundation | accepted |
| 0051 | v1.16 Shop canonical commercial entities | accepted |
| 0052 | v1.17 Shop Core-backed authoring | accepted |
| 0053 | v1.18 Shop assurance linkage and identity | accepted |
| 0054 | v1.19 Shop commercial coverage dashboard | accepted |
| 0055 | v1.20 Connected View | accepted |
| 0056 | v1.20.1 Explorer Connected View Hotfix | accepted |
| 0057 | v1.21 Shop Forecast and Management Visibility | accepted |
| 0058 | v1.22 Operator Input Assistance and Review Polish | accepted |
| 0059 | v1.23 Connected View Controls and Commercial Planning Polish | accepted |
| 0060 | v1.24 Workshop Cyber Strategy Map | accepted |
| 0061 | v1.25 Workshop operational dashboards | accepted |
| 0062 | v1.26 Shop assurance spend scenario planning | proposed |
| 0063 | v1.27 Digital CISO Magazine | proposed |
| 0064 | v1.28 Pub Marketplace Foundation | proposed |
| 0065 | v1.29 UX Consistency and Relationship Manager Foundation | proposed |
| 0066 | v1.29.2 Generated Slide and Document Export Direction | proposed |
| 0067 | v1.30 6clicks risk source integration | proposed |
| 0068 | v1.31 6clicks risk source hardening | proposed |
| 0069 | v1.32 CISO Master Plan and Strategy Editor polish | proposed |
| 0070 | v1.34 Requirements navigation polish | proposed |
| 0071 | v1.35 ISM control as a workable assurance entity | accepted |
| 0072 | v1.36 ISM Review Workbench | accepted |
| 0073 | v1.37 Workshop Continuous Compliance Outputs | accepted |
| 0074 | ADR 0074: v1.39 Evidence Lifecycle And Reporting Polish | Accepted |
| 0075 | Questionnaire-driven workspace population | Accepted. Ships in v1.33 as the v1.33 questionnaire-driven population |
| 0076 | v1.42 remediation foundation | accepted |
| 0077 | AI capability boundary | accepted |

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
