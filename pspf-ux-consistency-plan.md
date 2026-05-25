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
- Completed UI primitive: `@pspf/webview-shell` exposes a shared relationship-manager renderer for command URIs and Workshop command buttons.
- Completed rollout proof points: Shop uses the shared renderer for assurance coverage quick actions, and Workshop Requirement detail/editor surfaces use it for existing Evidence, Action, Risk, and Direction links.
- Define allowed operator-editable link types and endpoint rules.
- Build shared relationship list/add/remove/archive UI primitives.
- Continue rollout beyond the Requirement proof point only after focused regression coverage exists for the target surface.

### Slice 3 - Detail-First Shop

- Completed proof point: Supplier, Contract, and Spend Item tree selection opens a read-only detail panel before editing.
- Completed field coverage: detail panels show the captured business fields and record metadata for the selected Shop record.
- Completed relationship affordance: detail panels expose canonical Shop link commands through the shared relationship-manager renderer.
- Continue with richer linked-record summaries after the first detail-first route stays covered by regression tests.

### Slice 4 - Pub CRUD Completion

- Completed proof point: Person records now have local-only detail and edit panels covering display name, stakeholder type, organisation, role, resume context, next signals, and notes.
- Completed proof point: Role records now have local-only detail and edit panels covering title, owning team, reporting role, functional outcome, contribution, PD link, and PD text.
- Completed proof point: Assignment records now have local-only detail and edit panels covering person, role, status, allocation, review date, and action badge.
- Completed proof point: Relationship Note records now have local-only detail and edit panels covering person, recorded date, summary, and next contact.
- Split the large Team editor into ownership, roles, assignments, people, and notes sections.
- Pub local record detail/edit coverage is complete for Person, Role, Assignment, and Relationship Note.
- Keep all Pub sensitive records local-only.

### Slice 5 - Explorer/Workshop Pattern Alignment

- Extract Explorer saved-view/filter logic into reusable static-safe helpers.
- Use v1.32 to simplify the Workshop Strategy Editor around staged Strategy areas: frame, choices, outcomes, and measures.
- Add Strategy Editor readiness, linked-work, and publication-sensitivity cues without changing the canonical singleton Strategy model.
- Keep Action editor simplification as a follow-on after Strategy polish proves the pattern.
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