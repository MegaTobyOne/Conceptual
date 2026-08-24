# 0092 — v1.58 trajectory: velocity, projection, and sustain line (J4)

- Status: accepted
- Date: 2026-08-24

## Context

J4 in `docs/ux-improvement-ideas.md` is "when will we be compliant, and can we hold it" — the most demanded and most dangerous question the ecosystem is asked, because an unqualified date is either a lie or a refusal to engage. At the v1.57.0 baseline this scored 1/2: Workshop's posture sparkline and Explorer's honestly-labelled compliance-event history both exist, but neither computes a velocity, states a projection, or represents decay.

## Decision

1. Add shared trajectory primitives to `@pspf/contracts`, operating only on caller-supplied `{date, value}` series so no history is inferred or reconstructed beyond what was actually recorded: `computeClosureVelocity()` derives points-per-day from the first and last point of a trend; `projectTrajectory()` returns either "target already reached", an honest "no positive velocity" statement (naming the blocker count from J3 when relevant), or a range (`rangeLowDate`/`rangeHighDate`) with a stated assumption sentence — **never** a bare, unqualified date; `buildSustainNote()` restates the J3 staleness-preview count as "N met requirements need refreshed evidence within 90 days to sustain the current position."
2. Workshop Home computes velocity from its existing local posture-history array (`recordPostureHistory`) and renders a "Trajectory" section with the projection assumption sentence and the sustain note, visibly coupled to the Blockers section added in S3 (the assumption sentence names the top-blocker count).
3. Explorer's Analytics view computes velocity from its existing "Snapshot posture trend" table (metric-bearing Core checkpoints only — the same honestly-scoped series already disclaimed as "no historical values are inferred") and renders the same Trajectory section immediately after it.
4. This slice introduces no entity, link, bundle, API, or Explorer schema change; velocity and projection are derived entirely from existing history. `VERSION_AXES` remain `1.15.0`.

## Consequences

- No surface in the ecosystem can render an unqualified compliance date; `projectTrajectory` structurally cannot produce one — callers only ever get a reached/no-velocity/ranged-with-assumption result.
- The projection is explicitly coupled to blockers (J3): resolving blockers is stated as the lever that moves the range earlier, rather than trajectory and blockers reading as unrelated numbers.
- The sustain note reuses the S3 staleness-preview count rather than introducing new decay-tracking storage, keeping the "no schema change" property of this slice.
- Both trend inputs (Workshop's local history, Explorer's Core-checkpoint snapshots) are short-window, sparse series in a fresh workspace; the velocity and projection will read as "no positive closure velocity" until enough history accumulates, which is the honest behaviour rather than a defect.

## Alternatives considered

- **Reconstruct a full historical posture curve from individual compliance-state-change events**: rejected; Explorer's event log already carries an explicit "does not reconstruct an historical posture snapshot" disclaimer, and inventing a reconstructed curve would contradict it. Metric-bearing Core checkpoints are the honest substitute.
- **Show a single estimated date instead of a range**: rejected outright by the review's own acceptance bar ("no unqualified date anywhere in the product"); a range with a stated assumption is the minimum defensible format.
- **Build a persisted velocity/decay model in schema**: rejected for this slice; S4 was the batched schema bump, and velocity/projection are computable from data already on hand, so no further schema change is warranted here.
