# 0090 — v1.56 blocker fan-in ranking (J3)

- Status: accepted
- Date: 2026-08-24

## Context

J3 in `docs/ux-improvement-ideas.md` is "what's blocking us, and who moves next" — scored 0.5/2 at the v1.55.0 baseline: Workshop's Strategy choice cards already surface a per-choice "Top blockers" list, but there is no ecosystem-wide view of which single action, if resolved, would move the most not-met requirements at once. A flat gap list forces the operator to compute leverage manually.

## Decision

1. Add shared fan-in ranking and classification to `@pspf/contracts`: `rankBlockersByFanIn()` ranks candidate blockers by how many not-met requirements they gate; `classifyBlocker()`/`blockerClassLabel()` distinguish `us`, `funding`, and `assessor` blocker classes from data the ecosystem can already evidence (a `supplier` class is deferred to the J6/S7 slice, which introduces clearer supplier-linked data); `isExpiringWithinDays()` previews evidence that will fall outside its freshness window within a 90-day horizon.
2. Workshop Home gains a "Blockers" section: open actions ranked by gated-requirement count with a classification label, plus a staleness-preview sentence ("N met requirements will lose evidence backing within 90 days unless refreshed").
3. Explorer's Analytics view gains a "Top blockers" panel with the same ranking and a staleness-preview sentence, computed from the local action/compliance stores.
4. This slice introduces no entity, link, bundle, API, or Explorer schema change; ranking and classification are derived entirely from existing requirement/action/link data. `VERSION_AXES` remain `1.14.0`.

## Consequences

- An operator can identify the single highest-leverage blocker in under two minutes on both Workshop and Explorer, rather than reading a flat list of not-met requirements.
- Workshop's action model has no `type` field (unlike Explorer's), so Workshop's blocker classification can only distinguish `funding` (via a commercial link) from `us`; Explorer's classification additionally distinguishes `assessor` via `Action.type === "review"`. This asymmetry is a data-model limitation, documented here rather than papered over.
- The `supplier` blocker class is explicitly deferred; S7 (J6, supplier verdict) is expected to supply the clearer supplier-linked data this classification needs.

## Alternatives considered

- **Wait for S7 to add a full blocker taxonomy including `supplier`**: rejected; shipping `us`/`funding`/`assessor` now is still a real improvement over an unranked gap list, and the classifier is designed to extend without a breaking change when supplier data arrives.
- **Infer a review/assessor blocker for Workshop from action title text**: rejected as an unreliable heuristic; better to state the limitation than fake a signal from free text.
- **Build a full critical-path graph algorithm**: rejected as disproportionate to the acceptance bar ("top blocker identifiable in ≤2 minutes"); fan-in ranking over existing links meets that bar without new analysis infrastructure.
