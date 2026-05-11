# 0014 — v0.1 thin-slice scope

- Status: accepted
- Date: 2026-05-10

## Context

The PSPF spec set as drafted commits v1 to **five products** (Core, Workshop, Shop, Pub, Explorer), full Explorer dual-mode, ranked Action Impact, posture brief, shareable charts and briefs, Shop spend forecasting and savings opportunities, Pub assignment management, full WCAG 2.2 AA-aligned accessibility, per-version schema publication, contract tests across products, and 30 enforced Explorer behavioural invariants.

That is a credible v1 surface. It is not a credible v0.1 surface — the first cut a single maintainer can put in front of an Australian Government assurance team to get useful feedback. Pretending v1 is the floor will slow the project to the point that the feedback never arrives.

## Decision

Define **v0.1** explicitly as a thin slice that proves the spine and the Australian framing, and defer everything else to v0.2+ behind a single, visible "deferred to v0.2+" list. v1 remains the eventual target as currently specified.

### v0.1 in scope

**Products**

- **PSPF Core** — workspace bootstrap, SQLite system of record, snapshot create, integrity check, master-bundle export, master-bundle import (full-replace + additive-merge only), trusted-caller registry, writer lock, three version axes.
- **PSPF Workshop** — Requirement, Evidence, Action, Risk authoring; daily assessment loop; evidence review queue; posture brief (read-only render); shareable brief copy.
- **PSPF Explorer (publication mode only)** — load a published bundle, browse Requirements/Evidence/Actions/Risks, posture brief view, compliance donut, Relationships Board read-only.

**Cross-cutting**

- Three canonical version axes; per-version JSON Schema publication (E23); default-deny publication policy and personal-data exclusion (S3, S7, N6); `axe-core` floor on Explorer; AU-English UI strings; OFFICIAL: Sensitive banner.
- Australian context amplified per ADR 0016: PSPF 2025 Domains as primary navigation, AU spelling, AU date/time formatting, ASD Essential Eight on the Posture screen.
- Single shared `brief-renderer` and `chart-renderer` packages so Workshop and Explorer cannot diverge on the most-shared outputs.

### v0.1 explicitly deferred

The following stay specified but are flagged "deferred to v0.2+" until v0.1 ships and is reviewed:

- **PSPF Shop** (suppliers, contracts, spend forecast, savings opportunities, payback).
- **PSPF Pub** (people, roles, teams, assignments).
- **Explorer local-authoring mode** (IndexedDB writes, GRC capture intake, work-import plan-apply, share-package merge). Publication mode only in v0.1.
- **Action Impact ranking** (E25). v0.1 lists actions by due date and an explicit "open / blocked / overdue" filter; ranking arrives in v0.2.
- **Direction (Home Affairs Direction) overlay** as a first-class entity. v0.1 records Directions as Tags + a free-text response note; the Direction entity arrives in v0.2.
- **Posture screen** as an editable threat-level/posture surface. v0.1 renders posture as a read-only summary derived from compliance state; posture editing arrives in v0.2.
- **Plan-apply intent** on bundles. v0.1 supports `full-replace` and `additive-merge` only; `plan-apply` and the plan-and-review pane arrive in v0.2.
- **Per-import undo** (E21). v0.1 ships full-replace undo only (a single pre-replace snapshot rollback) — see [explorer-screen-workflow-spec.md](../explorer-screen-workflow-spec.md).
- **Integrity scan as a worker-backed Explorer screen** (E15). v0.1 runs validation in Workshop on the main thread for the standard fixture; the worker-backed Explorer scan arrives in v0.2.
- **Spend forecast / savings opportunities / chart export** (E29, E30). Donut and basic bar chart are in v0.1; copy-as-image, save-as-image, and Shop forecasts arrive in v0.2.
- **Notification rule entity and surface**. Removed from v0.1 entirely; revisited in v0.2 once the surface that consumes it exists.
- **Third-party accessibility audit**. v0.1 commits to the `axe-core`-aligned floor only; an audited claim is deferred.
- **Cross-window / multi-window concurrency**. v0.1 enforces a single-writer lock and degrades the second window to read-only with a banner; multi-window editing is not in scope.
- **ISM OSCAL ingestion and PSPF ↔ ISM control mapping** ([adr/0017-ism-integration-roadmap.md](0017-ism-integration-roadmap.md)). v0.1 records ISM references only as free text in `Evidence.reference`, `Action.notes`, or `Risk.notes`; the read-only ISM source library arrives in v0.1.x/v0.2 and the first-class Requirement ↔ ISM mapping entity arrives in v0.2.

### Acceptance gate for v0.1 → v0.2 promotion

v0.1 is "done" when:

1. A new operator can install Core+Workshop, run `Initialise PSPF Workspace`, create at least one Requirement, attach evidence, take a snapshot, export a master bundle, open it in Explorer (publication mode), and copy a shareable posture brief — without reading the docs.
2. Every `serious`/`critical` `axe-core` finding on the Explorer publication-mode primary routes is zero on the standard fixture.
3. The personal-data-exclusion CI gate (N6/S7) is green against the personal-data fixture.
4. Per-version schema publication (E23) is green for the active `schemaVersion`.
5. AU-English lint (see [pspf-glossary.md](../pspf-glossary.md)) is green across all user-facing copy.

## Consequences

### Positive

- Real feedback arrives quickly, while the spec ambition stays visible.
- The team avoids the trap of debugging Shop forecasting before the spine is reliable.
- Reviewers can read v0.1 acceptance criteria as a small, contained list and judge progress against it weekly.

### Negative / accepted trade-offs

- Public-facing copy must clearly mark v0.1 as a thin slice; any user expecting Shop or Pub will be disappointed if not warned.
- ADR 0014 will be referenced from many specs to flag deferred items; this is intentional — the deferral is a first-class spec fact, not a footnote.

## Alternatives considered

- **Build everything in spec order and release v1 as one big bang.** Rejected: the feedback loop is too long for a solo-maintained project, and the AU-context amplification (ADR 0016) needs operator validation early.
- **Drop Pub and Shop entirely.** Rejected: their workflows are already specified at the entity-link and design level; deferring them is enough.
- **Drop Explorer entirely from v0.1.** Rejected: Explorer is the only surface that can be shared with non-VS-Code users (Australian Government reviewers, executives, auditors); the publication-mode subset is small and high leverage.
