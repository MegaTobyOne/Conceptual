# PSPF Future Mission Control UX Specification

Status: **aspirational**
Last updated: 2026-07-01

## Purpose

Define one integrated UX concept that combines:

1. a living connected workspace canvas,
2. audience-based interpretation of the same source data,
3. a distinctive visual and motion language for product identity,
4. and a future-facing planning horizon that emphasises what happens next.

This specification is intentionally bold and experimental. It is designed to improve adoption, usability, and repeat engagement without changing existing data contracts, publication controls, or offline-first constraints.

## Relationship to current authority

This specification extends the UX direction in `pspf-design-spec.md` and aligns with `explorer-screen-workflow-spec.md`, `pspf-core-workshop-screen-workflow-spec.md`, and `pspf-grand-plan.md`.

Authority chain remains unchanged:

1. `pspf-invariants.md`
2. ADRs
3. topic specs
4. this concept spec (experimental UX guidance)

## Problem statement

Current workflows are robust and trustworthy, but users can still experience:

1. excessive context switching between views,
2. high cognitive load when linking strategy-to-action-to-risk,
3. weak future-state visibility beyond static current-state status,
4. and inconsistent value communication between operator and executive audiences.

## Product hypothesis

If PSPF uses one connected mission workspace with audience-aware interpretation and forward-horizon planning, then users will complete more meaningful work, feel stronger momentum, and return more frequently.

## Design principles

1. One truth, many lenses: the data model does not fork by audience.
2. Future before archive: the default emphasis is next decisions and trajectory risk.
3. Context first: editing happens in-place, not through repeated navigation hops.
4. Explainability by default: every calculated signal can be traced to inputs.
5. Calm confidence: visual identity is distinctive but never noisy.
6. Accessibility is a feature, not a compliance add-on.

## Integrated concept: Future Mission Control

Future Mission Control is a single adaptive screen model that combines map, interpretation, and planning.

### Core frame

1. Centre canvas: live relationship map for Direction, Requirement, Action, Risk, Evidence, and commercial context.
2. Left rail: missions, saved viewpoints, and scope filters.
3. Right inspector: selected item detail and audience-specific narrative.
4. Bottom horizon rail: `Now`, `Next`, `Later` planning lanes with confidence and dependency signals.
5. Top command bar: global find, intent actions, simulation, and compare modes.

### Audience view switch

The same selected item can be interpreted through role lenses:

1. Operator view: tasks, blockers, due dates, ownership, immediate actions.
2. Executive view: trajectory, confidence bands, top decisions required, strategic exposure.
3. Assurance view: evidence posture, traceability, control coverage, publication suitability.
4. Delivery view: sequencing, dependencies, resource pressure, collision risk.

View switch never mutates data; it changes framing, density, and language only.

### Time-forward horizon

Every key item is rendered against three planning horizons:

1. `Now`: active blockers and immediate commitments.
2. `Next`: near-term decision windows and dependent tasks.
3. `Later`: strategic milestones, scenarios, and confidence trend.

The default landing state opens `Next` first for proactive planning, then allows switching to `Now` and `Later`.

## Signature experience direction

### Visual language

1. Editorial mission-cockpit tone with warm neutrals and decisive semantic accents.
2. Expressive heading typography paired with high-legibility body typography.
3. Layered atmospheric backgrounds and restrained depth to avoid flat enterprise monotony.
4. Semantic colour roles that are consistent across all audiences and surfaces.

### Motion language

Motion exists to communicate state change, not decoration:

1. view switch transitions reframe cards and metrics by audience,
2. horizon transitions slide focus between `Now`/`Next`/`Later`,
3. ripple preview animates impact propagation through connected items,
4. reduced-motion mode removes non-essential motion while preserving clarity.

## Experimental interaction patterns

### 1. Ripple preview

Before applying a significant change (date shift, status change, dependency move), show predicted downstream effects on:

1. dependent actions,
2. linked risks,
3. evidence freshness confidence,
4. and horizon confidence.

The user can apply or cancel after preview.

### 2. Explain in this mode

Any selected item supports a single action that rewrites its summary to match current audience mode while preserving evidence traceability.

### 3. Future shock simulator

Quick simulation controls for:

1. action delay,
2. risk escalation,
3. dependency failure,
4. resource reduction.

Simulator output must show assumptions, confidence delta, and affected nodes.

### 4. Minimum viable path

Generate the smallest set of achievable next actions required to maintain target readiness and confidence.

## Accessibility and inclusion requirements

Future Mission Control must satisfy:

1. keyboard-only operation across all primary interactions,
2. full focus visibility and deterministic tab order,
3. non-colour status communication,
4. 200% zoom support with no loss of core functionality,
5. reduced-motion handling on all transition groups,
6. plain-language text option for executive and assurance summaries.

## Data and policy constraints

This UX concept does not change existing policy boundaries:

1. no relaxation of default-deny publication controls,
2. no exposure of restricted fields in any mode,
3. no network dependency added to local-first workflows,
4. no schema changes required for prototype stage.

## Implementation increments

### Increment A: testable concept prototype (no schema/API change)

1. static interactive mockup in `docs/mockups/`.
2. audience switch with changing copy and metrics.
3. horizon rail with `Now`, `Next`, `Later`.
4. simplified connected node board and ripple preview panel.
5. minimum viable path mock action list.

### Increment B: Explorer pilot

1. implement read-only Future Mission Control panel in Explorer.
2. bind to existing bundle entities and link graph.
3. add audience switch and horizon filtering only.

### Increment C: Workshop operational pilot

1. add operator-focused mode with actionable commands.
2. support in-context edits with existing command handlers.
3. add simulation previews for schedule/risk perturbations.

## Validation plan

### Usability tasks

1. identify top two future blockers in under three minutes,
2. produce an executive trajectory summary in under two minutes,
3. switch to assurance mode and identify missing evidence links,
4. run a delay simulation and explain the confidence impact.

### Success metrics

1. task completion rate,
2. median time to decision-ready summary,
3. cross-role interpretation accuracy,
4. repeat usage over seven days,
5. perceived clarity and confidence scores.

### Failure signals

1. users cannot explain confidence shifts,
2. audience switch creates contradictory interpretations,
3. horizon lane semantics are misunderstood,
4. visual density still feels overwhelming.

## Test-ready artefacts

The first artefact set for this spec is:

1. interactive mockup: `docs/mockups/future-mission-control-prototype.html`
2. prototype test checklist: `docs/mockups/future-mission-control-test-checklist.md`

## Out of scope for this spec

1. introducing new entity types,
2. changing compatibility axes,
3. introducing networked collaboration,
4. replacing existing Explorer or Workshop production workflows immediately.
