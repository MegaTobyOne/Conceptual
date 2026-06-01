# 0073 - v1.37 Workshop Continuous Compliance Outputs

- Status: accepted
- Date: 2026-05-30

## Context

Operators already author requirements, evidence, actions, risks, strategy, and a Plan of Action in Workshop. What they lacked was a set of communication-ready, one-page authoring surfaces that turn that data into the six "Continuous Compliance Outputs" used to brief leadership and staff: a PSPF assurance grid, a human-centred risk view, a cyber awareness change strategy, a PSPF-by-domain grid, a unified security operating model, and a capability metro map.

These outputs read across Strategy outcomes, capability areas, and `executiveOwner` — fields that sit beyond the strict v0.1 thin slice (ADR 0014). The work deliberately pulls those existing strategy fields forward into Workshop *authoring* views. It does not add entities, collections, link verbs, saved-view scopes, or export/Explorer presentation; operators share these views manually (screenshot or text).

Operators also need to manage the lifecycle of third-party penetration testing engagements — finding ingestion, remediation tracking against severity-based deadlines, verification/retest queuing, and closure — and to see commercial linkage back to the supplier and contract already recorded in Shop. That governance lifecycle mirrors the continuous compliance pattern: no new canonical entities are required. Findings map to Actions, severity is inferred from an Action-linked severity Tag or a severity label in the Action title, remediation proof maps to current Evidence linked to the Action, and accepted residual exposure maps to Risks. The engagement itself is represented as a Tag. Commercial context is surfaced through the existing `action related-to contract`, `supplier has contract`, `contract funds spend-item`, and `spend-item supports action` link verbs (ADR 0053), which already connect Shop records to Workshop work without a schema change.

## Decision

Add a v1.37 **Continuous Compliance Outputs** layer as no-schema read models over existing data, surfaced as Workshop authoring views.

A single module (`packages/workshop/src/continuous-compliance.ts`) holds the fixed ordering, controlled vocabulary, and pure model builders for all six outputs:

- **O4 PSPF Grid View** — assurance by fixed domain order with met-percentage bands (`established` ≥80, `progressing` ≥50, `emerging` ≥20, `early` ≥1, `not-started`).
- **O1 Human-Centred Risk View** — risks grouped under the business outcome that references them, with fixed severity bands (`high` ≥15, `medium` ≥8, `low` ≥1) and plain-language treatment labels.
- **O6 Continuous Compliance Metro** — capability areas as metro lines off a single `GRC and security management` hub, with outcomes as stations.
- **O5 Unified Security Operating Model** — teams derived from `StrategicChoice.executiveOwner`, capability areas keyword-matched to eight fixed security functions, with uncovered functions surfaced as gaps.
- **O3 Cyber Awareness Change Strategy** — four change themes, six term/plain-language translations, and message blocks that weave in the live met percentage.
- **O2 Plan of Action** — the existing board gains a "Support And Decisions Needed" callout listing blocked, overdue, and due-soon work separately from the timeline.

Five new commands (`openPspfGridView`, `openHumanCentredRiskView`, `openContinuousComplianceMetro`, `openUnifiedSecurityOperatingModel`, `openCyberAwarenessChangeStrategy`) are registered, allowlisted on Workshop Home, and exposed in the view title menu. O2 reuses the existing Plan of Action command.

A second module (`packages/workshop/src/pentest-workbench.ts`) adds a **Penetration Testing Workbench** as a no-schema read model over Actions, Evidence, Risks, Tags, and commercial links:

- **Assessment grouping** — findings are Actions tagged with a `PENTEST-<YYYY>-<ref>` Tag (operator-created using the existing Tag authoring surface). The workbench lists active assessments by Tag label and surfaces per-assessment metrics.
- **Finding queues** — Actions carrying a pentest assessment Tag are sorted into per-assessment queues by inferred severity and due-date state:
  - `overdue` — `dueDate` is past and status is not `done` or `cancelled`;
  - `sla-at-risk` — computed maximum SLA deadline (Critical 30 d, High 60 d, Medium 90 d, Low 180 d from `createdAt`) would expire before `dueDate`, or `dueDate` is not set;
  - `pending-verification` — status is `done` but no linked Evidence with `freshness: current` exists;
  - `closed` — status is `done` and at least one linked Evidence item has `freshness: current`.
- **Verification queue** — Evidence items linked to finding Actions with non-current freshness are surfaced as a retest and closure backlog.
- **Commercial context panel** — the workbench reads `action related-to contract` and `supplier has contract` links from the existing closed-taxonomy vocabulary (ADR 0003, ADR 0053) to show the pen-test supplier name, contract reference, and engagement title alongside each assessment without new link verbs or schema change.
- **Residual risk summary** — Risks tagged with the same assessment Tag, including those with `supplier associated-with risk` links to the pen-test supplier, are shown as accepted residual exposure per assessment.

One new command (`openPentestWorkbench`) is registered, allowlisted on Workshop Home, and exposed in the view title menu alongside the continuous compliance output commands.

## Non-goals

- No schema-axis bump, new entity, new collection, new link verb, or new saved-view scope. `VERSION_AXES` stay `1.12.0`.
- No export, snapshot, or Explorer presentation of these outputs; sharing is manual.
- No new editable strategy authoring beyond what already exists.
- No publication of restricted personal fields.
- No automated notification or escalation engine for the Pentest Workbench; SLA deadline pressure is surfaced as read-model flags only.
- No pen-test engagement scheduling, scoping, or statement-of-work authoring; the workbench begins at findings ingestion.
- No cost-tracking surface within Workshop; cost management remains in Shop via the existing `contract` and `spend-item` entities and their links.

## Consequences

Positive:

- Operators get six communication-ready surfaces without leaving Workshop or changing the publication contract.
- Centralised ordering and vocabulary keep terminology and banding consistent across all six outputs.
- Pure builders are unit-tested independently of the webview.

Trade-offs:

- Teams and capability coverage are heuristics over `executiveOwner` and keyword matching, not an authored org model; unmatched capabilities are surfaced rather than hidden.
- The work intentionally crosses the v0.1 thin slice (ADR 0014) by reading strategy outcome/capability/owner fields; this is recorded here as a deliberate, schema-neutral expansion.

## Privacy

`executiveOwner` is a free-text strategy field, not a restricted `Person.name`, `Person.email`, or `Assignment.personId`. These views are Workshop authoring surfaces, not export, snapshot, or Explorer artefacts. A release gate asserts the module never references restricted personal fields.

## Quality gates

- Workshop registers the five continuous compliance commands, exposes them from Home and the view title menu, and renders all six outputs.
- Workshop registers `openPentestWorkbench`, exposes it from Home and the view title menu, and renders assessment list, finding queues (overdue, SLA-at-risk, pending-verification, closed), verification backlog, commercial context panel, and residual risk summary.
- `scripts/check-continuous-compliance.mjs` asserts command registration for all six output commands and for `openPentestWorkbench`, the O2 callout, centralised taxonomy exports, SLA deadline computation (Critical/High/Medium/Low day limits), and the absence of restricted personal fields; it runs in `e2e:v1.37`.
- New unit tests cover the six pure builders in `continuous-compliance.ts`.
- New unit tests cover the pure builders in `pentest-workbench.ts`: SLA deadline computation per severity, finding queue grouping, and commercial-context projection from link records.
- `VERSION_AXES` remain `1.12.0`; all package versions and `PSPF_SLICE_VERSION` are `1.37.0`.
- `typecheck`, `lint`, Workshop build, release-candidate checks, and release readiness pass.

## Related

- [adr/0014-v0-1-thin-slice.md](0014-v0-1-thin-slice.md)
- [adr/0053-v1-18-shop-assurance-linkage-and-identity.md](0053-v1-18-shop-assurance-linkage-and-identity.md) — defines `action related-to contract`, `supplier has contract`, and `supplier associated-with risk` link verbs used by the Pentest Workbench commercial-context panel
- [adr/0060-v1-24-workshop-cyber-strategy-map.md](0060-v1-24-workshop-cyber-strategy-map.md)
- [adr/0061-v1-25-workshop-operational-dashboards.md](0061-v1-25-workshop-operational-dashboards.md)
- [adr/0072-v1-36-ism-review-workbench.md](0072-v1-36-ism-review-workbench.md)
- External process specification: *Penetration Testing Process Functional Specification* (not in this repository) — defines the end-to-end pen-test lifecycle, T-shirt sizing model, severity-based SLA deadlines (Critical 30 d, High 60 d, Medium 90 d, Low 180 d), and governance roles that the Pentest Workbench surfaces in read-model form
