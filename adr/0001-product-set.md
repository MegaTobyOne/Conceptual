# 0001 — Product set and naming

- Status: accepted
- Date: 2026-05-09

## Context

Earlier drafts of the specification set used inconsistent product counts and a set of mood names (`Hearth`, `Trail`, `Lookout`, `Skylight`) that were placeholders for early feature ideas. The public ecosystem page advertises three tools, the design spec mentions five product surfaces and six containers, and the architecture spec uses four products plus a platform role. This ambiguity made every other consistency claim unreliable.

## Decision

The PSPF ecosystem has **five products**:

1. **Core** — local platform, system of record, admin surface.
2. **Workshop** — primary authoring surface for requirements, evidence, actions, risks.
3. **Shop** — supplier, contract, and spend workflows.
4. **Pub** — people, role, and assignment workflows.
5. **Explorer** — static web app that supports both **publication consumption** and **local authoring** in the user's browser.

The earlier names (`Hearth`, `Trail`, `Lookout`, `Skylight`) are retired. They MUST NOT appear in specs, code, or UI. Where Workshop or Explorer needs internal sub-views for actions, risks, or reporting, those are sub-views and use direct nouns (`Actions`, `Risks`, `Reporting`).

Core and Workshop are **separate VS Code extensions**, published independently to the Marketplace, with a documented compatibility relationship rather than a single bundled VSIX.

## Consequences

- The trusted-caller policy applies to Core ↔ Workshop calls just like Core ↔ Shop and Core ↔ Pub.
- The compatibility matrix has one more product axis: Workshop release independent of Core release.
- Documentation, README, marketing, and onboarding refer to five products. Where users want Core+Workshop together, the recommended path is "install both"; the user-facing onboarding makes that one click.
- The earlier "container names" idea is dropped; navigation uses direct nouns.

## Alternatives considered

- **Three products (Core, Workshop, Explorer) only.** Rejected because Shop and Pub are real planned product lines and their early existence in the model affects the entity model and trusted-caller policy.
- **Bundle Core+Workshop as one extension.** Rejected because (a) it forces lock-step releases for two products that evolve at different paces, and (b) it dissolves the trusted-caller boundary between them, blurring an already weak in-process boundary.
- **Keep the mood names as primary brand.** Rejected because users and reviewers consistently mistook them for separate products.
