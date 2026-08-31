# 0096 — v1.70 Essentials programme and surface reduction

- Status: accepted
- Date: 2026-09-01

## Context

Stakeholder feedback (compliance officers, analysts, CISOs; synthesised in `docs/feedback/stakeholder-feedback-design-spec.md`) confirms the product delivers value but demands too much specialist knowledge. Users struggle to discover an applicable requirement without knowing its identifier, to read status in non-specialist language, and to find a role-appropriate view without working through unrelated features. The surface has also grown faster than the core journey: Explorer exposes 26 routes and Workshop roughly 25 webview panels and 70 commands, while neither surface offers keyword search over requirement content.

The v1.50 redesign (ADR 0086) reduced visible complexity through hierarchy and introduced three presentation lenses (`ciso`, `auditor`, `solo`). Feedback shows users mostly want the same focused journey; a role switcher is itself superfluous complexity, and hierarchy alone has not resolved the discoverability problem.

## Decision

1. **Programme.** The v1.70 Essentials programme delivers slices E0–E8 (v1.62.0–v1.70.0) as sequenced in `pspf-grand-plan.md`: governance baseline, plain-language layer, shared requirement finder in Explorer then Workshop, guided decision-and-action flow, save-and-impact feedback, Explorer then Workshop surface subtraction, and release hardening.
2. **One default view.** The three presentation lenses from ADR 0086 D6 are retired. All users receive one role-neutral, plain-language default journey. Any stored lens preference migrates to the default view exactly once and deterministically, following the ADR 0086 Colorful→Dark migration precedent, leaving no dead setting. Analyst and CISO oversight needs will be met by dedicated review screens in v1.71+ under a later ADR, not by presentation modes.
3. **Plain-language layer.** Every essentials-path requirement and status surface renders a three-part explainer — _What this means / Why it matters / What to do next_ — from curated AU-English strings in `@pspf/reference-data` through one shared renderer. Explainer content is reference data: it carries source attribution and declares `publication` explicitly. The S1–S7 judgement primitives supply the facts; this layer supplies the words.
4. **Retired views.** The following are removed at the view level: Explorer **Assurance City** (`/map-3d-concepts`), **Map**, and **GRC** routes; Workshop **Continuous Compliance Metro**, **Unified Security Model**, and **Human-Centred Risk** panels. Retirement removes navigation entries, routes, panels, and their registration commands only. No entity, record, link, Core API surface, export capability, or datum is removed, and no schema or bundle collection changes.
5. **Demoted views.** All remaining specialist routes and panels move behind a single **Advanced** disclosure per surface and stay fully functional. The Explorer essentials navigation contains at most seven items. `check-essentials-surface.mjs` records the E0 baseline and thereafter fails if a retired view reappears, a demoted view surfaces outside Advanced, or essentials route/command counts exceed the budget recorded in the gate.
6. **Shared requirement finder.** Keyword search over requirement identifiers, titles, and controlled text plus PSPF Domain/section browsing is implemented once as a deterministic `@pspf/contracts` primitive and consumed identically by an Explorer finder route and Workshop finder-backed pickers. Result summaries state current assessment, evidence confidence, open actions, and material risk. A parity gate proves identical, deterministically ordered results across both hosts for shared fixtures.
7. **Save and impact feedback.** The post-save confirmation (what changed, saved successfully, affected evidence/actions/risks, resulting posture or priority signal with explanation) composes existing posture and impact builders only. No prediction or unqualified projection is introduced.
8. **Compatibility.** `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.15.0` for the entire programme. The standard-mitigation library and the analyst/CISO review screens (P1) are deferred to v1.71+ under their own ADR, with an expected `1.16.0` axis bump for mitigation provenance.

## Consequences

- Non-specialist users get one guided journey — find, understand, decide, see the effect — without touching an Advanced control, and the essentials path is protected by an enforced surface budget rather than convention.
- Operators who used the retired novelty views lose them; their underlying records remain intact and reachable through the essentials journey or demoted specialist views. Assurance City was exploratory concept work and its removal does not affect the Assurance extension or its data.
- Lens-conditional code paths and their invariance tests are deleted, reducing presentation-layer branching; ADR 0086 remains authoritative for theming, product identity, and shared anatomy.
- The subtraction gate makes future surface growth a deliberate, ADR-visible decision instead of drift.
- Nine slice releases with per-slice gates cost more release overhead than one large release; this is accepted to keep each step independently shippable and reversible.

## Alternatives considered

- **Keep lenses and rename them to the feedback-spec roles**: rejected because feedback shows users mostly want the same journey; three modes multiply copy, testing, and cognitive load without changing any record or calculation.
- **Demote everything and retire nothing**: rejected because a large Advanced section full of novelty views still signals complexity, still costs maintenance, and dilutes the subtraction gate to a relabelling exercise.
- **Ship P0 and P1 together in one major release**: rejected because the mitigation library needs curated ISM-aligned content, an attribution/licence pass, and a probable axis bump; coupling it to the essentials journey risks the smaller, higher-value slice.
- **Full-text search per surface instead of a shared primitive**: rejected because divergent ranking or filtering between Explorer and Workshop would recreate the disconnection the feedback identifies.
- **Delete retired-view data and commands as well**: rejected because retirement is a presentation decision; removing records or command APIs would break the local-first contract and existing workspaces.
