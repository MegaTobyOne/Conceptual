# PSPF UX Consistency Refactor Plan

## Decision

Plan for an ecosystem-wide consistency refactor, but deliver it as staged vertical slices rather than a single broad rewrite. The goal is that similar actions feel the same across Core, Workshop, Explorer, Shop, and Pub while preserving the current business behaviour and publication boundaries.

## Acceptance Criteria

1. Every first-class contract entity type has an explicit list, detail, create, edit, delete, and relationship-management coverage decision.
2. Pub local record types have the same explicit coverage decision because Pub is now a first-class extension surface, even though its sensitive records remain local-only.
3. Read-only/generated/reference records are not forced into editable flows, but they must have visible list/detail and relationship visibility decisions.
4. User-owned editable records must not have missing list, detail, or create coverage without an explicit gap and refactor path.
5. Relationship management gaps are tracked centrally before implementing a shared relationship manager.
6. The coverage matrix is machine-checked in CI-facing scripts so new entity types cannot be added without a UX decision.

## Implementation Slices

### Slice 1 - Coverage Contract

- Add `pspf-entity-ux-coverage.json` as the source of truth for entity UX coverage.
- Add `scripts/check-ux-coverage.mjs` to validate that every `V0_1_ENTITY_TYPES` entry is represented.
- Add a root `check:ux-coverage` command and include the gate in `check:gates`.

### Slice 2 - Shared Relationship Manager

- Completed foundation: canonical operator link rules now live in `@pspf/contracts` and are covered by contract tests.
- Completed proof point: Shop link command wiring now resolves through the canonical rule lookup, with a Shop regression test.
- Completed UI primitive: `@pspf/webview-shell` exposes a shared relationship-manager renderer, and Shop uses it for assurance coverage quick actions.
- Define allowed operator-editable link types and endpoint rules.
- Build shared relationship list/add/remove/archive UI primitives.
- Prove the pattern in Shop or Pub before touching the dense Workshop Requirement workbench.

### Slice 3 - Detail-First Shop

- Add detail views for Supplier, Contract, and Spend Item.
- Keep the existing editor fields, but route list/tree selection to detail first.
- Move Shop link commands into visible detail relationship sections.

### Slice 4 - Pub CRUD Completion

- Split the large Team editor into ownership, roles, assignments, people, and notes sections.
- Add detail/edit panels for Person, Role, Assignment, and Relationship Note.
- Keep all Pub sensitive records local-only.

### Slice 5 - Explorer/Workshop Pattern Alignment

- Extract Explorer saved-view/filter logic into reusable static-safe helpers.
- Simplify Workshop Strategy and Action editors after relationship-manager behaviour is proven.
- Preserve the Requirement Workbench as the reference implementation until replacements are demonstrably better.

## Current Large Panels To Simplify

- `packages/pub/src/extension.ts` - `renderTeamEditorHtml` currently combines team details, control ownership, roles, assignments, people/resumes, and notes.
- `packages/workshop/src/extension.ts` - Strategy editor combines frame, choices, outcomes, measures, links, and ISM mapping.
- `packages/workshop/src/extension.ts` - Requirement editor is a high-value workbench but should separate editable fields from linked context over time.
- `packages/workshop/src/extension.ts` - Action editor combines edit fields, commentary, impact, and commercial context.
- `packages/shop/src/extension.ts` - Shop editor handles Supplier, Contract, and Spend Item in one direct-to-edit panel.
- `packages/explorer/scripts/build-static.mjs` - Local authoring and saved-view/filter code combine several reusable behaviours in one static script.

## Verification

- `npx pnpm@10.10.0 run check:ux-coverage`
- `npx pnpm@10.10.0 run check:gates`
- `npx pnpm@10.10.0 run check:release-candidate`
- `npx pnpm@10.10.0 run package:check`
- `npx pnpm@10.10.0 run typecheck`
- `npx pnpm@10.10.0 run lint`

## Manual Review Still Needed

- Confirm which link types are operator-editable versus system-owned before implementing the relationship manager.
- Confirm whether Pub notes are editable CRM notes or immutable history entries.
- Confirm delete/archive semantics for Pub local records and Workshop assurance records.
- Confirm whether Strategy remains a singleton record or supports multiple active strategies later.