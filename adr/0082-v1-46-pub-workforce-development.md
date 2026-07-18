# 0082 — v1.46 Pub workforce development

Status: **accepted**

**Date**: 2026-07-18
**Deciders**: Product owner, engineering

## Context

ADR 0081 established Pub's migration-safe local workforce foundation, rapid structure entry,
organisation chart, and restricted-data-safe organisation exports. Operators also need one
coherent local surface to manage mandatory learning, certifications, observable skills,
development, succession, and Cyber rotations. These records include person identity, evidence,
objectives, assessments, and review rationale that must not enter Explorer, Core publication,
external logs, or general workforce exports.

## Decision

Ship v1.46 as Pub workforce development phase 2:

1. Keep all workforce development records in `.pspf/pub/pub.json`. Advance the Pub store to
   `1.3.0`; migration from `1.2.0` adds empty collections and preserves legacy performance-cycle
   certification text without interpreting or converting it.
2. Add explicit local records for learning requirements and person learning status,
   certifications, five-anchor skills, role skill requirements, person assessments, development
   plans and activities, succession plans and review history, rotation opportunities, placements,
   and transfer milestones.
3. Validate identifiers, references, level ranges, five-anchor skills, dates, opportunity capacity,
   and placement capacity before every atomic write. Unsupported future versions still fail closed.
4. Derive overdue learning and certification windows from an injected clock. Treat missing skill
   assessments as `not-assessed`, not as zero capability. Derive gaps against active assignments
   and role requirements without mutating source records.
5. Provide one Workforce Planning panel with actionable Learning and Certifications, Skills and
   Development, Succession, and Cyber Rotations sections. Guided native input flows stage values
   and perform one validated save only after the required fields are complete.
6. Keep rotation opportunities separate from placements and role assignments. A placement has
   explicit capacity, dates, objectives, and pre-brief, Cyber artefact, home-team session, 30-day,
   and 90-day transfer milestones.
7. Keep succession candidates and rationale local-only. Approved-plan summaries may count
   readiness bands by role, but no person identity, person or assignment identifier, evidence,
   rationale, objective, note, or other free text may enter the safe workforce summary.
8. Make plain text the primary safe summary format. It is generated only from aggregate DTOs and
   is covered by adversarial restricted-token tests.
9. Add behavioural tests for migration, validation, date boundaries, unassessed and below-target
   skill states, rotation capacity, and safe-summary redaction. `e2e:v1.46` inherits v1.45 and runs
   the complete Pub suite.

Product and package versions advance to `1.46.0`. `VERSION_AXES` remain `1.14.0` because this
slice changes only the local Pub store and introduces no published bundle, Core API, or Explorer
schema contract.

## Consequences

- Operators can manage workforce obligations and development from one scan-friendly local panel.
- Skill levels are defensible because every skill defines five observable behavioural anchors.
- Development activity and rotation transfer can be reviewed as active work rather than static
  profile text.
- Safe summaries intentionally omit individual names and supporting narrative; they support
  aggregate planning discussion, not person-level decisions.
- Pub continues to assume one trusted local workspace operator. HRIS/LMS integration, automatic
  certification conversion, automatic skill catalogue insertion, multi-user approvals, and AI
  recommendations are out of scope.

## Alternatives considered

- Reuse Assignment for both role allocation and rotation opportunities. Rejected because an open
  opportunity has capacity and learning outcomes but no assigned person.
- Convert legacy certification free text into structured credentials. Rejected because free text
  is ambiguous and automatic interpretation could create false records.
- Seed a default skills catalogue into every migrated workspace. Rejected because it silently
  changes operator data and weakens local ownership of behavioural anchors.
- Export person-level succession or development detail. Rejected because identity, rationale,
  evidence, objectives, and notes are restricted by default.
