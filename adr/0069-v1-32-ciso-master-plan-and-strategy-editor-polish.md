# 0069 - v1.32 CISO Master Plan and Strategy Editor polish

- Status: proposed
- Date: 2026-05-26

## Context

v1.27 introduced the generated CISO Master Plan as an active planning panel derived from existing Strategy, Plan of Action, Risks, Evidence, and Shop dependencies. v1.24 and v1.25 established the canonical Strategy record, Cyber Strategy Map, and full-size Strategy Editor. Those slices proved that strategic intent, delivery work, and executive communication can share existing data without a separate PSPF Plan product.

The next release should make that planning experience easier to use rather than widen the model. Operators need a clearer bridge between the executive CISO Master Plan and the editable Strategy areas that drive it. The current Strategy Editor already separates the stable strategy frame from choices, outcomes, and measures, but it can do more to show publication sensitivity, linked-work coverage, missing planning context, and the next useful action.

## Decision

Implement v1.32 as **CISO Master Plan and Strategy Editor polish** inside Workshop.

The slice provides:

1. A refreshed CISO Master Plan panel that makes the derived roadmap easier to scan across direction, streams, phases, planner tasks, milestones, evidence inputs, risks, actions, and Shop dependencies.
2. Clearer navigation from the CISO Master Plan to the Strategy Map, Plan of Action, Master Dashboard, Digital CISO Magazine, and relevant editable records.
3. User-facing Strategy Editor improvements that keep the staged-area model but make it easier to understand and update:
   - a concise readiness summary for the current Strategy area;
   - clearer area navigation labels for frame, choices, outcomes, and measures;
   - visible cues for publication-safe versus sensitive strategy content;
   - linked-work coverage counts for Requirements, Risks, Actions, Directions, and ISM mapping prompts where applicable; and
   - preserved Save this area, Save and view map, dirty-navigation, and Cancel behaviour.
4. Roadmap initiative planning that starts from an initiative frame and lets operators add tasks and milestones step by step, using existing Action and Evidence records rather than a four-activity template.
5. Validation that copied/generated Master Plan content remains publication-safe and excludes restricted personal fields, sensitive assumptions, and non-public working notes.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.32.0"`.
- Package version target: `1.32.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.11.0"` unless implementation adds a new published bundle field, collection, link verb, or schema-bearing entity.

## Non-goals

The following remain out of scope for v1.32:

- A separate PSPF Plan product.
- Canonical plan, milestone, resource, budget, or roadmap entities.
- Multiple active Strategy records.
- Standalone `strategy-choice` or `strategy-outcome` entities.
- Explorer strategy editing.
- Editable Connected View or drag-to-link strategy planning.
- PMO scheduling, approvals, reminders, calendars, resource management, or finance reconciliation.
- Pub people/assignment publication in planning outputs.
- Persisted Report Packs, native PDF generation, email sending, subscriber management, or RSS/feed publication.

## Consequences

Positive:

- Operators get a more coherent path from executive planning view to the exact Strategy, Action, and Evidence records they can edit.
- The Strategy Editor becomes more forgiving for dense records without changing the canonical Strategy model.
- CISO Master Plan work remains traceable to existing system-of-record entities rather than becoming a disconnected planning document.
- Publication and redaction boundaries stay aligned with existing generated brief and Explorer bundle controls.

Trade-offs:

- The Master Plan remains derived and generated on demand, so it is not an auditable plan baseline or persisted issue history.
- Initiative planning remains constrained by the existing Action and Evidence shapes; richer milestone/resource/budget planning needs a later model decision.
- Step-built Planner tasks are more flexible than the original four-stage template, but they rely on clear Action/Evidence conventions until a later ADR decides whether first-class planning entities are warranted.
- Editor polish improves comprehension but does not remove the underlying complexity of nested Strategy choices, outcomes, and measures.

## Alternatives considered

- Add a canonical roadmap or initiative entity. Deferred because the current need is usability over existing Action, Evidence, Strategy, Risk, and Shop data, not a new planning data model.
- Reopen standalone strategy-choice entities. Deferred because the v1.24 singleton Strategy model still fits the current planning workflow.
- Build planning primarily in Explorer. Rejected because Workshop remains the system-of-record authoring surface; Explorer strategy editing remains out of scope.
- Treat the VentraIP Web release failure as the v1.32 slice. Rejected as product scope: the observed failure is release-ops SSH/deploy access, not a code or user-facing planning gap.
