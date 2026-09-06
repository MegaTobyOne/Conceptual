# Workshop Risk Overhaul Plan

Status: **aspirational**
Last updated: 2026-09-07
Planning baseline: product `1.74.0`; compatibility axes `1.16.0`.
Next task: **Operator closure of ADR 0098 blocking decisions (D1.6/D6.5, D2.7, D3.5), then Phase 1A - shared model**. See [Phase 0 Record](#phase-0-record) and [Phase 1A Handoff](#phase-1a-handoff).

## Authority and Outcome

This is the durable programme plan and session handoff, replacing the conversation's session-memory copy. The scope below is confirmed by the user; architecture below is a recommendation now resolved into [ADR 0098](../adr/0098-workshop-risk-overhaul-contract-baseline.md) (status `proposed`), not an accepted schema or implemented behaviour. No implementation phase has started. Do not infer an accepted ADR, allocated release, passing product tests or permission to publish from this document.

Follow the authority chain in [../pspf-spec-consistency-index.md](../pspf-spec-consistency-index.md) and sequencing in [../pspf-grand-plan.md](../pspf-grand-plan.md). Phase 0 must resolve architecture into an ADR before contract changes. Existing requirements remain in force until explicitly superseded.

Replace the minimal Risk form with a coherent Workshop editing and presentation workbench. Operators should be able to explain a risk, assess it using their organisation's methodology, connect it to enterprise risk, reuse treatments and controls, record escalation decisions, and present the result without maintaining duplicate records.

## Confirmed Scope

- Workshop only initially. No Explorer editor or visual overhaul; block incompatible publication with an explicit preflight rather than inventing legacy ratings.
- Editable category hierarchy **and** actual parent-risk relationships. These are separate concepts.
- Organisation-defined matrices, rating bands and risk appetite, not merely renamed fixed 5x5 labels.
- A register plus all five visuals: hierarchy tree, risk matrix, bow-tie, treatment coverage map and executive risk cards.
- Shared treatments and organisational controls, recorded escalation decisions, manual external-register references and previewed CSV/TSV crosswalk import.
- Preserve external systems of record. The Microsoft 365 examples are workflow guidance, not a technology requirement. No private register contents were supplied or fetched.

The suggested Enterprise / Digital / Cyber / Programme / Operational hierarchy is an optional editable template. Include Technology, Service Delivery, Infrastructure and Data under Digital; cyber themes such as vulnerability management, identity, external access, incident response and Essential Eight; and operational themes such as business process, workforce, supplier, compliance and information governance. Project names, committee names and ER8/ER10 are examples, never seeded factual risks or compulsory taxonomy.

## Current Implementation Anchors

Find symbols again when implementation begins; these observations describe the planning baseline, not permanent line numbers.

| Owning file                                                                                            | Relevant behaviour                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [../packages/workshop/src/extension.ts](../packages/workshop/src/extension.ts)                         | `renderRiskEditor` edits title, status, likelihood and impact, then shows source/commercial context. Reuse `editorShell`, `recordWorkbenchShell`, `renderActionEditor`, `ownerTeamField`, `recordTable` and the Item Detail host. `openRisksList` currently uses an entity picker. |
| [../packages/contracts/src/index.ts](../packages/contracts/src/index.ts)                               | `RiskEntity` has a minimal fixed-score shape and 6clicks-specific `RiskIntegrationMetadata`. Actions already have owner team, due date and status. `OPERATOR_LINK_RULES`, entity registries and `PUBLICATION_FIELD_POLICIES` own shared contracts.                                 |
| [../packages/core/src/service.ts](../packages/core/src/service.ts)                                     | `prepareEntitiesForWrite` is the normal write-rule boundary; `upsertEntities` supports atomic batches. Import paths need equivalent validation. Export and team-share both use publication-sanitised collections.                                                                  |
| [../packages/workshop/src/continuous-compliance.ts](../packages/workshop/src/continuous-compliance.ts) | Some Workshop severity thresholds differ from the invariant four-band legacy scale. Strategy priority is a separate derived judgement, not an assessment band.                                                                                                                     |
| [../packages/workshop/src/workshop-ui.ts](../packages/workshop/src/workshop-ui.ts)                     | Reuse pure UI adapters and escaped rendering patterns, with nearby runtime tests.                                                                                                                                                                                                  |
| [../packages/webview-shell/src/index.ts](../packages/webview-shell/src/index.ts)                       | Reuse theme, shell and relationship primitives rather than creating a second design system.                                                                                                                                                                                        |
| [../packages/connected-view/src/index.ts](../packages/connected-view/src/index.ts)                     | Reuse appropriate graph read-model and selection patterns without resurrecting retired global views.                                                                                                                                                                               |

Canonical `risk -> treated-by -> action` semantics exist, but Risk authoring picker coverage must be checked and completed. Change Record direction is `change-record -> changes -> risk`, not the reverse. Vendored ISM source controls are not writable organisational control definitions.

The Workshop `exportBackupJson` command delegates to Core publication export. It must **not** be treated as proof of lossless recovery for new sensitive fields. The sanitiser rejects unknown fields and has a specific public projection for risk source metadata; do not generalise that exception to new provenance fields.

## Proposed Data Design

The entity names, link representation, matrix bounds and state machines in this section are candidates for Phase 0, not decisions already made by the user.

### Risk and Hierarchy

- Extend Risk with an operator reference separate from its canonical ID, structured causes/event/consequences, optional description, primary category, owner team, review date, assessments, response and source provenance.
- Allow minimal capture with title and an explicit unassessed state. Missing scores never mean zero or Low. Preserve open/monitored/closed lifecycle; acceptance and escalation are separate decisions.
- Prefer one primary parent and separately typed secondary enterprise associations. Candidate representation: `child risk -> rolls-up-to -> parent risk`, with explicit allowed triples, cardinality and cycle validation. Do not also maintain an independently editable `parentRiskId` or enterprise ancestor field.
- Categories are stable-ID configuration nodes, not Risk entities and not replacements for the six PSPF Domains. One primary category gives deterministic appetite inheritance. Allow rename, reorder and archive; prevent deletion of referenced nodes and preview category moves that affect appetite.
- Actual risk depth is not dictated by categories. Programme, cyber or operational risks may contribute to appropriate enterprise risks without a compulsory intermediate record.

### Assessment and Appetite

- Propose a Core-owned risk-framework configuration record containing taxonomy, source-register definitions, methodology/appetite revisions and explicit presentation presets. Configuration is workspace data, not user settings.
- Start with bounded declarative matrices: candidate bounds are 2-10 ordered likelihood levels and 2-10 ordered impact levels. Every cell has a named ordered band; numeric cell scores are optional. No executable formulas or arbitrary scripts.
- Seed a legacy 5x5 methodology matching the invariant bands: below 5, 5-9, 10-15, and 16 or more. Preserve existing assessments with their basis identified as legacy until an operator confirms what they represent.
- Current means assessed residual risk with existing controls; inherent is optional before-controls risk; target is intended after-treatment risk, not realised improvement. Store assessment date, rationale and methodology revision.
- Pin assessments to immutable activated revisions. A methodology revision ID is provenance, not a fourth compatibility axis. New revisions do not silently re-rate historical records; provide preview and explicit reassessment.
- Propose appetite as allowed cells with rationale, effective date and review date. The nearest explicit primary-category rule overrides the workspace rule. No rule means Appetite not set. Acceptance exceptions are recorded decisions, not silent appetite changes. Resolve expired-rule behaviour in Phase 0.
- Use a discriminated legacy/custom assessment contract, not dummy mandatory legacy numbers. Shared evaluation should distinguish assessed, unassessed, legacy basis and not comparable, with an explanation and methodology reference.
- Never combine incomparable methodologies on a single numeric scale. Audit multiplication and threshold consumers across contracts, Core summaries/snapshots, Workshop, reports, Connected View and Shop. Adapt them or explicitly disclose unsupported inputs and excluded counts. Necessary Shop changes are correctness guards only; no Shop overhaul.

### Treatments, Controls and Bow-Tie

- Reuse canonical Actions as treatments through `treated-by`, with one owner, due date and status for each shared Action. Provide create/link/reuse and affected-risk preview. Do not introduce a parallel treatment register with duplicated Action state.
- A risk-level response such as reduce, avoid, share or accept is distinct from treatment progress.
- Propose an organisational control entity, provisionally `risk-control`, with definition, team owner, state, review date and evidence. It may reference ISM source controls but never modifies or duplicates the vendored catalogue.
- Represent risk-specific control applications explicitly: preventive/recovery/both role, applicability, effectiveness, rationale, evidence and cause/consequence anchors. Phase 0 must decide whether typed link metadata or a dedicated application record best fits current validation.
- Causes and consequences have stable IDs inside the Risk. Bow-tie applications must reject missing anchors. Action-to-control-gap relationships need explicit allowed triples.
- Count distinct treatment/control IDs; distinguish direct from descendant coverage and disclose shared attribution. Attaching a control or finishing an Action never reduces a rating automatically. Evidence presence alone never establishes control effectiveness.

### History and Escalation

- Propose Core-owned risk-event records for reassessment, reparenting, reconciliation and escalation. Append factual events atomically with the mutation; clients cannot rewrite them. No-op saves produce no false events.
- Existing Change Records can hold significant decision narratives with `changeType: risk-response` and the correct `changes` direction. They are not a competing factual audit stream.
- Candidate escalation states: proposed, accepted, declined and withdrawn. Capture source risk, destination risk and/or governance body/team label, reason, dates, disposition and treatment/decision references. Corrections append subsequent events.
- Escalation does not automatically change category, move, duplicate, close or re-rate a risk. Accepted escalation may offer a separately previewed and confirmed parent/category change.
- Parent ratings remain independently assessed. Summarise child bands, unassessed/over-appetite counts and overdue treatments, never sums or averages of ordinal ratings.
- Recovery/undo remains explicitly governed; event history is traceability, not a claim of cryptographic tamper resistance.

### External Registers

- Distinguish local risks from local representations of externally authoritative records. Source-owned assessment fields and local relationships/notes must remain separate.
- Identify records by source register plus external ID. Preserve original external rating/scale, source dates, reconciliation provenance and safe reference URLs. Do not convert external scores automatically or permit silent source-field replacement through ordinary editing.
- Preserve existing 6clicks metadata and workflows while bridging recognised records to generic references without duplicate identities. Do not change authentication or add network dependencies.
- CSV/TSV import uses a suitable maintained parser, a field template, column mapping, source selection and validation. Preview create/reuse/update/conflict/unmatched counts and require explicit confirmation.
- Match by stable source identity. Title similarity may suggest duplicates but never merges them. Stage unresolved crosswalk rows outside the live graph; reject cycles and dangling references in the proposed final graph.
- Revalidate against the current store after preview, commit atomically with a recovery checkpoint, and prove repeat imports are idempotent. Preserve local notes and relationships; absent source rows do not imply deletion.

## Workbench and Presentation

Reuse existing Risk commands and the Item Detail panel implementation. The list command should open the register state of this workbench, including when empty. No new top-level route, panel or command is planned; preserve the Essentials surface budget.

Use a stable record/context rail and unframed working area, with compact ID/status/owner/current/target/appetite summary, Save/Cancel and sections for Record, Assessment, Treatments and controls, Relationships and History. Preserve drafts across view switches; make failed, no-op and successful saves distinct. Writer/trust read-only state must disable mutations, and source-owned fields must be visibly distinguished.

| View      | Recording and presentation control                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Register  | Search; category/source/team/status/appetite/review filters; grouping/sort; resizable columns and density. Preserve usable title/reference widths. Preview bulk owner/category/review assignments; no inferred bulk ratings.                           |
| Hierarchy | Separate category/risk modes, expandable branches, ancestor breadcrumb, primary edges distinct from secondary associations, direct/descendant counts and keyboard reparent picker with preview.                                                        |
| Matrix    | Methodology/revision and inherent/current/target selection; appetite boundaries; counts and cell drill-down; comparable current-to-target markers. Keep unassessed/unmapped counts outside the grid. No silent drag-to-rate or mixed-methodology grid. |
| Bow-tie   | Causes, preventive controls, event, recovery controls and consequences; evidence/action drill-in and visible gaps. Selected-risk view within detail, not a standalone dashboard.                                                                       |
| Coverage  | Focused many-to-many risks/actions/controls diagram with filtering, selection and an equivalent semantic table. Reuse appropriate graph tooling; lazy-loaded 2D only.                                                                                  |
| Cards     | Configurable fields, section order, density and scope. Retain ID/title, methodology/basis, as-of time and classification in outputs. Show owner, next decision and treatment progress only when policy permits.                                        |

Keep transient view state local. Explicit named presets may persist as policy-declared configuration, without expanding Explorer SavedView scopes. Presets change presentation, never facts, calculations or publication rules. Configuration is an internal workbench view, not another product dashboard.

Provide plain text/Markdown copy, copy/save PNG for visuals and self-contained print HTML. Render from a common allowlisted output DTO with preview, scope/filter/source/methodology/as-of cues and classification. Explicitly opt in sensitive fields by name under an approved policy; never use wildcard permission or raw screenshots of sensitive editor DOM. Native Office and PDF generation are excluded.

Follow current VS Code theme tokens and shared compact controls, AU English, clear focus and non-colour labels. All diagrams need table/keyboard alternatives and narrow-layout equivalents. Avoid cramped chips, nested cards, role lenses, free-form diagram editors and retired 3D surfaces.

## Compatibility and Recovery

- Before any publication files/directories are written, Core preflight must reject representations the supported Explorer cannot truthfully consume. Cover both master export and team-share, unsupported ratings/entities/links and incompatible axes.
- Do not fabricate legacy scores, silently omit risks, drop relationships or report partial success. User-confirmed partial publication is a separate future decision, not part of this plan.
- Preserve supported legacy publication where compatible. An axis bump can make even legacy subsets incompatible with older Explorer versions; preflight must explain this, not assume backwards compatibility.
- Every new field, including nested configuration and output fields, needs explicit policy; default to sensitive. New titles/structure are not automatically public because an older entity envelope was public. Use team/governance labels, never person ownership fields. Exclude sensitive values from notifications, status bars, quick-pick/tree labels and logs as required by policy.
- Explain or block misleading JSON backup behaviour for the new model. Before migration, prove lossless local database plus required metadata backup/restore, excluding runtime locks. Do not introduce another exchange format or describe publication JSON as complete recovery.
- Prove allowed risk data and history survive snapshots and cold restore, with fresh writer ownership. Restricted information remains excluded from snapshot/export artefacts. Any portable sensitive backup profile needs its own explicit policy decision.
- Protect new fields/history from stale Explorer writes. Preserve server-owned fields on supported updates; reject incompatible custom/stale updates. Full-replace must disclose data loss, require appropriate confirmation and retain a recovery checkpoint. Crosswalk import is not an Explorer import bypass.

## Phases and Model Assignments

Use the strongest available version of the named model family. These are recommendations, not repository benchmarks or verified pricing; check current picker availability and request multipliers. Opus is recommended for cross-package/trust-boundary decisions, Sonnet for bounded implementation against settled contracts. Small/fast models such as Haiku or mini-class should not lead or solely review this programme; limit them to precisely specified mechanical follow-up with validation.

| Phase                                | Dependencies                     | Lead model                                                     | Deliverable and exit gate                                                                                                                                                              | Progress                                                                   |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0: Contract and interaction baseline | None                             | Claude Opus                                                    | ADR proposal and decision closure; field/link/policy tables; compatibility and recovery strategy; baseline evidence and workbench storyboard. No production contract changes.          | Done 2026-09-07 (ADR 0098 `proposed`; 3 blocking decisions await operator) |
| 1A: Shared model                     | Accepted Phase 0 decisions       | Claude Opus                                                    | Assessment/framework/hierarchy/control/event contracts; shared evaluator and validators; legacy adapters and focused tests. Batch schema changes in one planned compatibility release. | Blocked on ADR 0098 acceptance                                             |
| 1B: Persistence and exchange         | 1A                               | Claude Opus                                                    | Core atomic validation/history, import protection, explicit migration, publication preflight and verified recovery. All mutation entry points covered.                                 | Not started                                                                |
| 1C: Score consumers                  | 1A; must finish before 2         | Claude Opus                                                    | Replace or guard legacy arithmetic; no fake zero/bands/priority, NaN or hidden exclusions. Can develop alongside 1B only with non-overlapping ownership.                               | Not started                                                                |
| 2: Record and assess                 | 1B and 1C                        | Claude Sonnet                                                  | Structured editor/register/configuration plus hierarchy and matrix; behavioural, keyboard and visual checks. Escalate contract gaps to Opus.                                           | Not started                                                                |
| 3A: Treat, explain, escalate         | 2                                | Claude Sonnet; Opus review                                     | Shared Actions/controls/applications, bow-tie, coverage and escalation history; Opus reviews event integrity and aggregation.                                                          | Not started                                                                |
| 3B: Source crosswalk                 | 1B and 2                         | Sonnet UI/parser orchestration; Opus mutation semantics/review | Manual references and previewed CSV/TSV import; authority separation, conflict, idempotence and rollback tests.                                                                        | Not started                                                                |
| 4A: Present                          | 2; final integration needs 3A/3B | Claude Sonnet; Opus publication review                         | Cards, presets and safe text/image/HTML outputs; provenance and field-policy evidence.                                                                                                 | Not started                                                                |
| 4B: Integrate and verify             | 3A, 3B and 4A                    | Claude Opus                                                    | Full operator walkthrough, accessibility/performance, redaction, compatibility and recovery evidence; truthful documentation and gate updates.                                         | Not started                                                                |

No release number, ADR number or new axis is reserved here. Allocate the next appropriate values during governance work; preserve published schema directories and the three compatibility axes. Do not assume optional fields avoid schema review. Read the developer pipeline spec before release/gate-wiring changes, and obtain separate authorisation to publish.

## Phase 0 Handoff

Start a new Opus session for Phase 0 only. Initial task:

> Read docs/risk-overhaul-plan.md and the repository instructions. Execute Phase 0 only: verify the local baseline, resolve the proposed Risk architecture into an ADR proposal and explicit decision tables, document the current editor/scoring/publication/recovery behaviour, and prepare a bounded Phase 1A handoff. Preserve the confirmed Workshop-only scope and unchanged Explorer interface. Do not implement production entities, migrations, new visual surfaces, version bumps or release operations. Do not mark an ADR accepted merely because it has been drafted; identify decisions needing operator approval. Stop after Phase 0 verification and report the next exact task.

Before work, read [AGENT_ORIENTATION.md](AGENT_ORIENTATION.md), [../pspf-grand-plan.md](../pspf-grand-plan.md) and [../pspf-spec-consistency-index.md](../pspf-spec-consistency-index.md). For contract decisions, consult [../pspf-entity-link-spec.md](../pspf-entity-link-spec.md), [../pspf-core-api-contract-spec.md](../pspf-core-api-contract-spec.md), [../pspf-core-workshop-screen-workflow-spec.md](../pspf-core-workshop-screen-workflow-spec.md) and [../pspf-invariants.md](../pspf-invariants.md). For boundary decisions, consult [../pspf-security-redaction-controls.md](../pspf-security-redaction-controls.md), [../adr/0005-redaction-default-deny.md](../adr/0005-redaction-default-deny.md), [../pspf-explorer-json-bundle-schema-spec.md](../pspf-explorer-json-bundle-schema-spec.md), [../pspf-migration-safety-runbook.md](../pspf-migration-safety-runbook.md) and [../pspf-backup-and-restore-runbook.md](../pspf-backup-and-restore-runbook.md). Read [../pspf-acceptance-and-quality-gates.md](../pspf-acceptance-and-quality-gates.md) before claiming completion.

Phase 0 decisions requiring explicit closure:

1. Exact legacy/custom/unassessed Risk shape, what old scores mean, and how to represent the unsupported-comparison state in every derived consumer.
2. Framework/category/methodology/appetite persistence, matrix limits, revision/expiry semantics, primary category and reclassification rules.
3. Parent/secondary relationship direction, cardinality, cycle detection and control-application representation. Use a single source of truth for each relationship.
4. Event authority, escalation states, correction/undo/restore rules and validation on every import/write path.
5. Field-level and nested publication policy, explicitly permitted output profiles, and boundary checks without Explorer implementation changes.
6. Compatibility-axis evolution and which existing export/import workflows will be blocked, including legacy-only data under a newer schema.
7. Verified recovery path before migration; the distinction between publication JSON and a lossless backup; consent and rollback semantics.
8. Precise no-growth Workshop navigation, first usable slice, baseline fixtures and measurable performance/accessibility criteria.

Phase 0 is complete only when the baseline evidence and storyboard are recorded, decisions are accepted or explicitly marked as blockers, authoritative documents are coordinated, and Phase 1A has a narrow file/test scope. An unresolved blocking decision prevents Phase 1A; it does not prevent recording a useful partial Phase 0 handoff.

## Phase 0 Record

Executed 2026-09-07 with Claude (Opus-class) in a single session. Output: [ADR 0098](../adr/0098-workshop-risk-overhaul-contract-baseline.md) (`proposed`), this record, and the coordination edits listed under Files. No production contract, Core, Workshop or schema code was changed.

### Baseline evidence

Environment: HEAD `a99d3c2` on `develop`; Node `v22.23.1`; pnpm `10.10.0`. Pre-existing uncommitted worktree changes (`pspf-grand-plan.md`, `pspf-spec-consistency-index.md`, this file) were preserved.

| Check                                                              | Result                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm build`                                                       | pass (all packages)                                                  |
| `pnpm run check:risk-source-integration`                           | pass                                                                 |
| `pnpm run check:schema-policy`                                     | pass                                                                 |
| `pnpm run check:essentials-surface`                                | pass: routes 24/24, nav 18/18, Workshop commands 72/72, panels 30/30 |
| `pnpm run check:adr-coverage`                                      | pass before ADR 0098 (97 ADRs); re-run after registration, see below |
| `node --test packages/workshop/dist/continuous-compliance.test.js` | 11/11 pass                                                           |

Not run in Phase 0: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `release:readiness`. They are unaffected by documentation-only edits and belong to the Phase 1A slice.

### Current behaviour (verified by reading source at the baseline)

- **Editor.** `renderRiskEditor` (`packages/workshop/src/extension.ts`) renders title, status, likelihood and impact selects inside `editorShell`, then a read-only 6clicks source section and the commercial context section, all inside `recordWorkbenchShell`. Save coerces the two scores with `Number()` and rejects anything outside whole numbers 1-5. `openRisksList` is a quick pick over non-deleted Risks, then `openEntityEditor`. `createRisk` prompts title, status, likelihood, impact and a mandatory requirement selection, then writes the Risk plus `requirement -> exposed-by -> risk` links.
- **Validation.** Core `validateEntityWriteRules` has no Risk rule; `importBundle`/`buildImportPlan` do not call `prepareEntitiesForWrite`. The publication sanitiser throws for any field without a declared policy, which is the only fail-closed guard for new fields.
- **Scoring.** Seven consumers compute `likelihood × impact` independently with three different band tables and two different missing-value behaviours; the table in ADR 0098 § Context lists each. The Workshop tree label (`>=4` Medium) and the three-band `CONTINUOUS_COMPLIANCE_RISK_SEVERITIES` diverge from invariant E5.
- **Links.** `treated-by` exists in `LINK_TYPES` and is read by Connected View, but has no `OPERATOR_LINK_RULES` entry and no Workshop authoring path. Workshop can author only `exposed-by` into Risk; Shop authors `supplier -> associated-with -> risk`.
- **Publication.** All Risk fields public except `integration` (projected to `sourceLabel`/`remoteUpdatedAt`). `schemas/explorer-bundle/1.16.0/collections/risks.schema.json` requires integer `likelihood`/`impact` 1-5; an unassessed Risk is unpublishable under the current schema.
- **Recovery.** Workshop `exportBackupJson`/`importBackupJson` delegate to Core publication export/import; they are sanitised bundles, not lossless backups. Lossless backup is the SQLite database plus `.pspf/config/*.json`, excluding locks, per the runbook. Full-replace and additive imports write a `pre-<importId>.json` undo point.
- **Documentation gap.** `pspf-entity-link-spec.md` § Risk describes an unimplemented shape (string bands, `riskType`, `residualLevel`, `treatmentStatus`, `ownerPersonId`, `acceptedBy`) that contradicts the implementation and ADR 0097 D5. ADR 0098 supersedes that section; Phase 1A corrects the spec.

### Workbench storyboard (Phase 2 target, within existing surfaces)

1. **Open.** `pspf.workshop.openRisksList` opens the Item Detail panel in **Register** state (search, filters, grouped table, "New risk", "Set up risk framework" when no framework exists). Empty state explains the two ways to get a Risk: create one, or import from a source register.
2. **Record.** Selecting a row swaps the working area to the record: header rail with ID, reference, status, owner team, current/target band and appetite state; sections Record (title, description, primary category, causes, consequences, response, review by), Assessment, Treatments and controls, Relationships, History. Save/Cancel are sticky; a dirty draft survives switching between sections and views.
3. **Assess.** Assessment section shows basis (`Legacy 5×5`, custom methodology name and revision, or `Unassessed`). For legacy: the two existing selects. For custom: matrix picker per current/inherent/target with band and appetite read-back and rationale. Changing a methodology revision never re-rates; it offers "Reassess against r2" as an explicit action.
4. **Treat.** Treatments list linked Actions (owner team, due, status) with "Link existing action" (picker filtered to open Actions, showing other Risks each Action already treats) and "Create action" (existing `renderActionEditor`). Controls list `risk-control` applications with role and effectiveness; bow-tie is a tab inside this section.
5. **Relate.** Relationships shows primary parent (one row, "Change parent" opens a picker with cycle-safe candidates and a roll-up preview), secondary associations, exposed requirements/ISM controls, suppliers/contracts and change records.
6. **Escalate.** History lists Core-derived events newest first. "Record escalation" opens an inline form (destination Risk or governance label, reason, state) and appends an `escalation` event; on `accepted` it offers, separately, a previewed reparent/reclassify.
7. **Present.** Register toolbar "Views" switches Register / Hierarchy / Matrix / Coverage / Cards; each has a table alternative and copy/save actions that render from `RiskOutputModel` with classification and as-of cues.
8. **Publish.** Export/team-share from Workshop runs Core preflight first; a blocked result lists the offending Risk IDs and the reason, with no files written.

### Decisions

Accepted for drafting (proposed, no further design needed): D1.1-1.5, D2.1-2.6, D2.8, D3.1-3.4, D3.6-3.8, D4.1-4.6, D5.1-5.4, D6.1-6.4, D7.1-7.3, D8.1-8.4.

Blocking (operator must choose before Phase 1A):

- **D1.6 / D6.5** — block publication of custom-basis and unassessed Risks in this programme (recommended), or fund a schema change now that makes `likelihood`/`impact` optional.
- **D2.7** — expired appetite rule still applies and is flagged stale (recommended), or is treated as "Appetite not set".
- **D3.5** — typed `LinkEntity.application` metadata for control applications (recommended), or a dedicated `risk-control-application` entity.

Deferred to a later ADR: portable sensitive backup profile (D7.4); Explorer-aware publication of custom assessments.

### Files changed in Phase 0

- `adr/0098-workshop-risk-overhaul-contract-baseline.md` (new, `proposed`).
- `adr/README.md` (index row), `scripts/check-adr-coverage.mjs` (manual coverage entry naming existing gates; no gate logic changed).
- `docs/risk-overhaul-plan.md` (this record, progress table, handoff), `pspf-grand-plan.md` and `pspf-spec-consistency-index.md` (pointer to ADR 0098).

## Phase 1A Handoff

Start only after the operator has closed the three blocking decisions and changed ADR 0098 status to `accepted`. Initial task for a fresh Opus session:

> Read docs/risk-overhaul-plan.md § Phase 1A Handoff, adr/0098-workshop-risk-overhaul-contract-baseline.md and the repository instructions. Execute Phase 1A only: add the Risk overhaul contracts and the shared evaluator to `@pspf/contracts` with focused node tests, correct `pspf-entity-link-spec.md` § Risk, and declare publication policy for every new field. Do not change Core persistence, Workshop UI, published schemas, `VERSION_AXES` or `PSPF_SLICE_VERSION`. Stop after `pnpm --filter @pspf/contracts build && pnpm --filter @pspf/contracts test`, `pnpm run check:schema-policy` and `pnpm typecheck` pass, and report the Phase 1B handoff.

Bounded file scope:

| File                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/risk-model.ts` (new)                 | `RiskAssessment` union, `RiskFrameworkEntity`, `RiskControlEntity`, `RiskEventEntity`, `RiskControlApplication`, `evaluateRisk`, `resolveAppetite`, `validateFramework`, `detectRollUpCycle`, `LEGACY_5X5_METHODOLOGY` encoding E5. Pure, deterministic, no I/O.                                                                                                                                                              |
| `packages/contracts/src/risk-model.test.ts` (new)            | Band boundaries 4/5/9/10/15/16; unassessed and not-comparable never yield a band; 3×3, 5×5, 2×10 matrices; invalid/missing cells rejected; revision immutability; appetite inheritance, expiry (per D2.7 outcome) and "not set"; cycle and self-link detection.                                                                                                                                                               |
| `packages/contracts/src/index.ts`                            | Add optional Risk fields from the ADR table; add `"risk-framework"`, `"risk-control"`, `"risk-event"` entity types, ID prefixes `RFW`/`RCT`/`RSE`, collection names; add `"rolls-up-to"`, `"mitigated-by"` to `LINK_TYPES`; `LinkEntity.linkRole?` and `LinkEntity.application?`; `OPERATOR_LINK_RULES` rows from the ADR table; `PUBLICATION_FIELD_POLICIES` entries for every new field and entity; re-export `risk-model`. |
| `packages/contracts/src/index.test.ts` (or nearest existing) | Sanitiser strips every new sensitive field and keeps `assessmentState`/`primaryCategoryId`; every new entity type has a policy; `OPERATOR_LINK_RULES` contains `workshop-risk-treated-by-action`.                                                                                                                                                                                                                             |
| `pspf-entity-link-spec.md` § Risk                            | Replace the unimplemented shape with the ADR 0098 field and link tables; remove `ownerPersonId`/`acceptedBy`.                                                                                                                                                                                                                                                                                                                 |
| `pspf-invariants.md`                                         | Add the new entity type strings, collection names and ID prefixes to N1-N3; leave E5 unchanged.                                                                                                                                                                                                                                                                                                                               |

Explicit exclusions for 1A: no Core `service.ts` change (1B), no consumer rewrites (1C), no schema directory, no version or axis bump, no Workshop or Explorer change, no gate registration beyond `check:schema-policy` continuing to pass. Explorer's `riskBandOf` stays untouched. If `check:schema-coverage` or `check:explorer-publication` fail because a new entity type has no schema file, record it as the expected 1B input rather than adding a schema in 1A.

## Session Discipline and Progress

Prefer sequential fresh sessions per independently testable slice. Split Phase 1 into 1A/1B/1C; split later UI work further when needed. Stay in the same session to repair a slice's failing checks. Do not run simultaneous edits of shared contracts/Core by default, and do not delegate unless the active session permits it.

Every handoff updates this document's progress table and records:

- Phase/sub-slice and actual model used; accepted ADR and remaining decisions.
- Exact changed files and behaviour; unrelated worktree changes preserved.
- Commands/checks run, results and fixture/evidence locations, distinguishing unrun checks from passes.
- Known risks, blockers, next bounded task and explicit exclusions.

Reviewer sessions inspect actual diffs and executable evidence, not just the implementing model's summary. A model assignment never authorises scope changes, commits, releases or publication.

### Preparation Record

- 2026-09-07: durable plan recorded, with confirmed scope, proposed architecture, model allocations and Phase 0 handoff; roadmap and spec index linked to it.
- 2026-09-07: Phase 0 executed; ADR 0098 drafted as `proposed`; baseline evidence, storyboard and Phase 1A handoff recorded above. Three blocking decisions await the operator.
- Product implementation, ADR acceptance and release allocation: not started.
- Documentation checks are separate from the future product verification below. No product tests are claimed by this preparation record.

## Implementation and Verification Map

Keep pure risk types/evaluators in contracts and pure workbench/import/output models outside the large extension host. Candidate modules, to be confirmed in Phase 0, are `risk-model`, `risk-workbench`, `risk-crosswalk` and `risk-presentation`, each with focused tests. Prefer nearby helpers/tests to new abstractions. Update entity UX coverage and preserve the existing Essentials surface budget. Only add a risk gate where it proves runtime behaviour not already covered.

1. **Model:** legacy band boundaries; 3x3/5x5/non-square matrices; invalid/missing cells; unassessed versus zero; revision immutability; appetite inheritance/expiry/exception; mixed-methodology comparisons; category rename/archive; parent self-links/cycles/dangling edges; secondary associations and distinct counting.
2. **Mutation:** create/edit/bulk/import validation; stale draft conflict; no-op history; atomic risk/event writes; rejection of forged or rewritten events; treatment completion leaves ratings unchanged; repeat import, failed apply and rollback; stale Explorer writes cannot clear new fields.
3. **Recovery:** explicit migration only; unchanged legacy records until consent; migration idempotence/failure recovery; configuration/controls/history survive restart, permitted snapshots and database/metadata restore; locks excluded and fresh writer ownership acquired.
4. **Publication:** incompatible ratings/contracts block before partial output; no fake scores/dropped edges; supported legacy fixtures still work; reports disclose incomparable populations; hostile sensitive/person fixtures across text/image/HTML; unknown fields fail closed and source URL credentials never leak.
5. **Journey:** create -> classify -> assess current/target/appetite -> reuse an Action across two risks -> add control/evidence -> inspect all five visuals -> record escalation -> produce a card. Exercise real event handlers, dirty/cancel/save/no-op/error and read-only states, not only markup substring assertions.
6. **Visual quality:** empty/typical/500-risk fixtures, deep/shared hierarchies and long labels; 320/768/1440 px and 200% zoom; VS Code dark/light/high contrast; zero serious/critical axe findings; keyboard/table equivalents, reduced motion and no overlapping text/controls. Measure lazy loading and existing performance budgets.

Build before filtered contracts/Core/Workshop tests: those tests execute `dist`. Use `pnpm --filter <package> build` then the focused built test or package test; rebuild dependencies or use `pnpm build` for cross-package changes. Use `npx pnpm@10.10.0` if the pinned pnpm is unavailable. Explorer tests use their package runner and remain regression checks, not new feature delivery.

Relevant existing gates for implemented slices include `check:schema-policy`, `check:schema-coverage`, `check:brief-redaction`, `check:explorer-publication`, `check:explorer-to-workshop-import`, `check:risk-source-integration`, `check:ux-coverage`, `check:essentials-surface` and `check:adr-coverage`. Run the relevant focused checks after each edit; run lint, typecheck, package tests and the risk browser/runtime checks at slice completion according to its agreed gates. Release-chain wiring and `release:readiness` belong to a separately authorised release after reading [../pspf-developer-pipeline-spec.md](../pspf-developer-pipeline-spec.md).

## Exclusions

Explorer redesign/custom-matrix UI; new live MS365/Graph/6clicks/ALTUS integrations or external write-back; authentication/RBAC/person-directory integration; changes to Pub; automatic escalation/approvals/notifications; automatic risk acceptance or reduction; AI analysis; PMO scheduling; native Office/PDF generation; arbitrary formulas; free-form diagramming; retired 3D surfaces; a duplicate treatment database; private-source retrieval; automatic migration; commits or publishing.
