# 0083 — v1.47 Pub workforce decision cockpit

Status: **accepted**

**Date**: 2026-07-18
**Deciders**: Product owner, engineering

## Context

ADR 0081 established Pub's migration-safe organisation foundation and ADR 0082 added local
workforce-development records. Those records now need to support timely decisions without adding
opaque people scoring, another persistence migration, or a person-level publication path. Existing
Phase 2 summary counts also omit eligible people when a mandatory-learning record has not yet been
created and can disclose small cohorts when exact counts are shared.

## Decision

Ship v1.47 as a local workforce decision cockpit:

1. Keep Pub store `1.3.0` and derive all Phase 3 views without adding persisted fields, migrations,
   Core collections, Explorer schemas, bundle collections, network paths, or model calls.
2. Replace the stacked workforce tables with one cockpit containing Overview, Obligations,
   Capability, Continuity, and Mobility & career views. Team and AI-fluency filters remain
   ephemeral webview state.
3. Expand every active mandatory-learning requirement over its `all`, team, or role population.
   Eligible people without a record appear as `record-missing`. Certification reporting describes
   currency only because no role-to-credential requirement exists.
4. Count capability as distinct people in active or rotating assignments to active roles. Each
   team-skill cell exposes its denominator and meeting-target, below-target, and not-assessed
   counts. Missing assessment is not zero capability.
5. Include every active role in continuity. Coverage state and succession-plan lifecycle remain
   separate; candidate readiness is presented as the three established count bands, never a score,
   percentage, or rank.
6. Derive a deterministic Attention queue for missing or overdue obligations, credential windows,
   overdue assessments and development activities, vacancy/backup signals, missing or stale
   succession plans, and overdue rotation milestones. Each signal routes to its local management
   workflow and disappears when its source condition is resolved.
7. Limit the pathway view to existing current assignments, target roles, skill gaps, development
   activities, and rotation history. It is an explainable view, not a recommendation, fit,
   eligibility, promotion, or prediction decision.
8. Keep person, team, role, skill, and filtered detail local to Pub. Plain text remains the primary
   share action and confirmed HTML the secondary action. Both are generated from one explicit
   organisation-wide aggregate projection. Person-derived values from 1 to 4 render as `<5`, with
   no exported total or complementary cell that reconstructs a suppressed value.
9. Treat AI readiness as explicit AI-fluency skill requirements, assessments, gaps, and development
   work. No AI/model provider or generated people recommendation is introduced.

Product and package versions advance to `1.47.0`. Compatibility axes remain `1.14.0` because the
published ecosystem contract does not change.

## Consequences

- Managers can move from a posture signal to the relevant local workflow without scanning several
  unrelated tables.
- Obligation and capability counts have explicit populations and cannot silently omit missing
  records or inflate people through duplicate assignments.
- Local person drill-ins remain useful for management while shared outputs deliberately lose
  small-cohort precision.
- Phase 3 cannot claim certification compliance, multi-step career recommendations, or workforce
  demand forecasts because the evidence and models for those claims do not exist.
- CSV/person export, HRIS/LMS/calendar integration, notifications, saved cockpit state, RBAC,
  multi-user approval, compensation/headcount planning, and automated recommendations remain
  deferred.

## Alternatives considered

- Add persisted dashboard snapshots and filters. Rejected because every view is reproducible from
  the current local store and saved state would add migration and stale-data risk.
- Use average skill or bench-strength scores. Rejected because they hide denominators and can
  misrepresent materially different capability or readiness distributions.
- Export team/role heatmaps with exact small counts. Rejected because labels plus small counts can
  disclose restricted person facts without including a literal name.
- Add AI role or candidate recommendations. Rejected because Phase 3 has no appropriate consent,
  fairness, review, provenance, or publication model for automated people decisions.
