# 0060 - v1.24 Workshop Cyber Strategy Map

- Status: accepted
- Date: 2026-05-19

## Context

The PSPF-Aligned Cybersecurity Strategy Management spec describes a lightweight way to represent cybersecurity strategy as enduring choices, target outcomes, posture measures, risks, and evidence rather than as another task list. That model fits the existing Workshop role: Workshop is the system-of-record authoring surface, while Explorer publishes read-only views for broader review.

The current product already has Requirements, Risks, Actions, Directions, Essential Eight posture signals, Connected View, change records, saved views, and Shop planning context. What is missing is a leadership surface that explains why selected work matters and whether strategic choices are moving the organisation toward a target posture.

## Decision

Use v1.24 as the planning target for a Workshop Cyber Strategy Map.

The v1.24 slice will introduce:

- one canonical workspace strategy object rather than multiple domain strategies;
- 3 to 6 nested strategic choices under that strategy;
- 1 to 3 outcomes per strategic choice;
- posture measures on outcomes with baseline, target, current value, trend, confidence, and review cadence;
- capability outcomes as the strategic frame, with Essential Eight maturity treated as one posture evidence set;
- validated inline references from strategic choices and outcomes to existing Requirements, Risks, Actions, and Directions;
- a Workshop Leadership Strategy Map showing choices as lanes or cards, with outcomes, posture gap, trend, confidence, and linked blockers/work;
- a focused Working View for editing one strategy choice, its outcomes, measures, rationale, and links;
- an Explorer executive strategy view that publishes only sanitised strategy statement, choices, outcome summaries, posture movement, confidence, and decision blockers; and
- no project-management task hierarchy, PMO scheduling, approvals, reminders, calendars, or separate strategy product.

## Model boundary

The first slice keeps `Strategy` as the only new canonical entity. Strategic choices and outcomes are nested inside the strategy record so the screen stays simple and the operator can manage one enterprise strategy without modelling a strategy catalogue.

Because choices and outcomes are nested, direct traceability to existing PSPF records is stored as validated inline references rather than as `LinkEntity` rows in the first slice. A later release may promote `strategy-choice` or `strategy-outcome` to standalone entities if operators need cross-strategy reporting, reusable choices, or graph-level relationship navigation.

The strategy map must explain and steer delivery. It must not duplicate Action management, replace the Connected View, or become a Shop/Plan workflow.

## Version and schema impact

Planning accepts that implementation is schema-bearing when the canonical `Strategy` entity is added.

- Product version target: `PSPF_SLICE_VERSION = "1.24.0"`.
- Package version target: `1.24.0`.
- Compatibility axes target: bump `schemaVersion`, `bundleVersion`, and `apiVersion` together from `1.9.0` to the next schema version when `Strategy` is implemented.
- The publication schema must include only fields approved for the sanitised Explorer executive view. Rationale, assumptions, constraints, detailed measures, and non-public commentary default to `sensitive` unless explicitly accepted as public.

## Consequences

Positive:

- Workshop gains a leadership view that shows how strategic choices connect to Requirements, Risks, Actions, and Directions.
- Strategy can stay distinct from operational planning while still being traceable to execution and evidence.
- Explorer can publish an executive-ready strategy summary without exposing sensitive rationale or working detail.
- Essential Eight posture gains clearer strategic context without becoming the whole strategy model.

Trade-offs:

- A new canonical entity and publication schema introduce schema-policy and migration cost.
- Inline nested links are simpler for v1.24 but less reusable than standalone strategy-choice entities.
- Sanitising executive publication requires careful field policy decisions before implementation.

## Out of scope

- Multiple concurrent strategy records or domain strategy catalogues.
- Standalone `strategy-choice` or `strategy-outcome` entities.
- New graph editing, drag-to-link, or strategy nodes in Connected View.
- PMO scheduling, initiative dependency management, approvals, reminders, calendars, or recurring reviews.
- Finance reconciliation or Shop workflow changes.
- Explorer editing of strategy content.