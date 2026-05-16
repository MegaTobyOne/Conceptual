# PSPF Invariants

## Purpose

This document records the **machine-checkable invariants** that must hold across the PSPF specification set, code, schemas, fixtures, and published artefacts. It is the operational counterpart to [pspf-spec-consistency-index.md](pspf-spec-consistency-index.md): the index says which spec owns a topic; this document says which exact strings, formats, and shapes must match wherever that topic appears.

For **terminology** (what a word means in this product, what its UI label is, and which Australian-English spelling to use), see [pspf-glossary.md](pspf-glossary.md). The glossary is normative for terminology; this document is normative for shape and value.

A CI job (`invariants` check) should validate this document against every spec, fixture, and code artefact on every PR and every release tag. A failed invariant blocks merge and release.

## Naming invariants

### N1 — Entity type strings
Entity type identifiers are **lower-case singular** wherever they appear as data values: `requirement`, `evidence`, `action`, `risk`, `snapshot`, `report-pack`, `domain`, `supplier`, `contract`, `spend-item`, `person`, `role`, `team`, `assignment`, `notification-rule`, `link`, `tag`, `source-control`, `requirement-control-mapping`, `direction`, `compliance-entry`, `compliance-event`, `work-log-entry`, `saved-view`, `posture`, `relationship`.

### N2 — Collection names
Collection identifiers in JSON bundles are the **lower-case plural** of the entity type, kebab-cased: `requirements`, `evidence`, `actions`, `risks`, `snapshots`, `report-packs`, `domains`, `suppliers`, `contracts`, `spend-items`, `roles`, `teams`, `assignments`, `notification-rules`, `links`, `tags`, `source-controls`, `requirement-control-mappings`, `directions`, `compliance-entries`, `compliance-events`, `work-log-entries`, `saved-views`, `relationships`. The `posture` collection is a singleton wrapper with a single item.

> Note: `evidence` is uncountable and serves as both singular type and collection name.
> Note: `personnel` and `people` MUST NOT appear in published bundles. See N6 / R-PRIV.

### N3 — ID prefixes
ID prefixes are **upper-case three-letter** codes:

`REQ`, `EVD`, `ACT`, `RSK`, `SNP`, `RPT`, `DOM`, `SUP`, `CTR`, `SPD`, `PER`, `ROL`, `TEM`, `ASM`, `NTF`, `LNK`, `TAG`, `SRC` (Source control), `MAP` (Requirement-control mapping), `DIR` (Direction), `CMP` (Compliance entry), `CME` (Compliance event), `WLE` (Work-log entry), `SVW` (Saved view), `REL` (Relationship). The Posture singleton uses the literal id `POSTURE`.

### N4 — ID format
Canonical IDs are `<PREFIX>-<TOKEN>` where `<TOKEN>` is a UUIDv7 with the high time bits zeroed before serialisation in any artefact eligible for publication. See `pspf-entity-link-spec.md` for the byte-level rule. Display IDs (e.g. `R-123`) are presentation-only and never appear in API payloads, JSON bundles, or links.

### N5 — Command and setting namespaces
- Core: `pspf.core.*`
- Workshop: `pspf.workshop.*`
- Shop: `pspf.shop.*`
- Pub: `pspf.pub.*`
- Explorer: `pspf.explorer.*` (browser-internal only; not a VS Code namespace)
- Shared: `pspf.*`

### N6 — Disallowed personal fields in published artefacts
The following fields MUST NOT appear in any JSON bundle that is eligible for publication or that crosses the workspace boundary:

- `person.email`
- `person.name` (use `person.id` only)
- `assignment.personId` (use `assignment.roleId` or `assignment.teamId` only in published bundles)
- any free-text field whose `security.classification` is not explicitly `public`

The exporter must fail closed on any such field, regardless of redaction profile.

## Vocabulary invariants

### V1 — Link types
Link types are simple verb phrases shared across the model. The valid set, and which `(fromType, toType)` pairs each accepts, is defined exhaustively in `pspf-entity-link-spec.md`. The full list:

`in`, `has`, `supported-by`, `addressed-by`, `exposed-by`, `owned-by`, `reviewed-by`, `cited-by`, `supports`, `treated-by`, `associated-with`, `sourced-from`, `included-in`, `assigned-via`, `blocked-by`, `related-to`, `funds`, `member-of`, `holds`, `targets`, `generates`, `includes`, `tagged-with`.

The previous compound names (`requirement-supported-by-evidence` etc.) are retired and MUST NOT appear in code, fixtures, or specs.

### V2 — Lifecycle and status enums
Each entity's status enum is owned by `pspf-entity-link-spec.md`. The shared lifecycle envelope value `recordStatus` takes one of: `active`, `archived`, `inactive`, `deleted`.

### V3 — Severity / classification ladder
- Diagnostic severity: `info` < `warning` < `error` < `critical`.
- Data class: `public` < `internal` < `sensitive` < `restricted`.
- Default classification for any new field is `sensitive`. See `pspf-security-redaction-controls.md`.

## Path invariants

### P1 — Workspace layout
- Datastore: `.pspf/core/pspf-core.db`
- Migrations: `.pspf/core/migrations/`
- Journal: `.pspf/core/journal/`
- Locks: `.pspf/core/locks/`
- Config: `.pspf/config/{workspace,products,policies}.json`
- Imports: `.pspf/exchange/imports/`
- Exports: `.pspf/exchange/exports/`
- Snapshots: `.pspf/exchange/snapshots/`
- Logs: `.pspf/logs/` (redacted)
- Cache: `.pspf/cache/`

### P2 — Explorer bundle layout
- `data/manifest.json`
- `data/collections/<name>.json` for each collection in N2
- `data/indexes/*.json` (derived, optional)
- `data/schemas/*.json` (validation, optional in v1)

## Version invariants

### VR1 — Canonical version axes
- `schemaVersion` — semver string, owned by Core, governs SQLite schema and entity envelope.
- `bundleVersion` — semver string, owned by Core, governs JSON bundle structure and Explorer compatibility.
- `apiVersion` — semver string, owned by Core, governs the in-process extension API.

`exportVersion` and per-event versions are derived from the producing tool's release version and are informational only. Compatibility decisions MUST use only the three canonical axes.

### VR2 — Compatibility gate
A consumer (Workshop, Shop, Pub, Explorer) MUST refuse to operate when:
- the producer's `bundleVersion.major` exceeds the consumer's supported major, or
- the producer's `schemaVersion.major` exceeds the consumer's supported major, or
- the producer's `apiVersion.major` exceeds the consumer's supported major.

Minor and patch differences MUST be tolerated additively.

## Security invariants

### S1 — Workspace Trust gate
Sensitive operations (mutation, migration, export, snapshot creation, import) MUST be blocked unless the workspace is trusted.

### S2 — Trusted-caller registry source
The trusted-caller registry is **baked into the Core distribution**. Workspace `products.json` MAY only **subtract** (block or downgrade) entries; it MUST NOT grant or elevate. See `pspf-trusted-caller-policy.md`.

### S3 — Default-deny export policy
Every entity field has an explicit `publication` policy: one of `public`, `internal`, `sensitive`, `restricted`. The exporter excludes everything not marked `public` unless an export profile explicitly opts a field in. A CI test MUST fail when any field in the schema lacks an explicit policy declaration.

### S4 — Explorer CSP
The published Explorer site MUST include a `<meta http-equiv="Content-Security-Policy">` element that:
- bans inline `<script>`,
- bans `eval` and equivalents,
- bans remote script sources,
- restricts `connect-src`, `img-src`, and `style-src` to `'self'` (with a documented exception list if any),
- and is verified by a CI test against the built site.

### S5 — Bundle string rendering
All bundle-derived strings rendered in Explorer MUST use `textContent` or an equivalent safe binding, never `innerHTML`. A linter rule or test MUST enforce this.

### S6 — Bundle import limits
Bundle imports MUST enforce, at minimum:
- max bundle size: 50 MB,
- max items per collection: 200,000,
- max string field length: 64 KB,
- max nesting depth: 16.

These are minimums; products may apply tighter limits.

### S7 — Personal data exclusion
See N6. The exporter MUST fail closed on any disallowed personal field.

### S8 — Single-writer lock
Core MUST acquire an exclusive OS-level lock at `.pspf/core/locks/writer.lock` on activation. A second VS Code window opening the same workspace MUST detect the held lock by live PID, open in read-only mode, return `PSPF_WRITER_LOCK_HELD` from any mutating command, and surface a Health-view banner offering "Take over as writer". See [pspf-core-architecture-spec.md](pspf-core-architecture-spec.md) § Writer lock and [pspf-onboarding-spec.md](pspf-onboarding-spec.md) § Concurrent-window behaviour.

## Explorer behavioural invariants

These invariants codify behaviours validated by the standalone PSPF Explorer prototype (see `extracted-spec-pspf-explorer.md`) that the rewrite MUST preserve. Each is testable. The owning specification is `explorer-screen-workflow-spec.md` § Behavioural rules.

### E1 — Compliance percentage formula
Anywhere a "compliant %" is displayed, it is computed as `yes / (total − notApplicable)`, integer-rounded, where the denominator and numerator both **exclude** `not-applicable`. When the denominator is zero the UI MUST render a non-numeric placeholder (e.g. "n/a") and never `NaN`. CI: unit test seeded with mixed states including all-not-applicable.

### E2 — Compliance audit events
Every change of compliance state produces a `from → to` audit event with a timestamp. Same-state writes MUST NOT generate an event. The event store is append-only in normal operation; the only path that may delete an event is per-import undo (E21), which removes events created as a side-effect of the import being undone. CI: unit test on the compliance store covering both transitions and no-op writes.

### E3 — Default Not-set materialisation
The default compliance state for an unscored requirement is `not-set`. Browsing or rendering a requirement MUST NOT create a compliance entry; entries are materialised only on the user's first edit. CI: integration test counting compliance-store rows before and after a read-only browse of N requirements.

### E4 — Action overdue rule
An action is overdue iff `dueAt` is set, `dueAt < now`, **and** status ∉ `{ done, cancelled }`. CI: unit test covering each branch.

### E5 — Risk band thresholds
With `score = likelihood × impact`, bands are: `score < 5` Low; `5..9` Medium; `10..15` High; `score >= 16` Extreme. CI: parameterised unit test across the boundary values.

### E6 — Direction response set
Direction response state is exactly `{ not-set, yes, no, risk-managed }`. `not-applicable` MUST NOT be a Direction response. CI: type-level test plus runtime acceptance test asserting the enum cardinality.

### E7 — Single master bundle
Every Explorer data exchange uses the master bundle defined in `pspf-explorer-json-bundle-schema-spec.md`. The retired prototype format tags `pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport` MUST NOT appear as active fields, schema properties, fixture keys, code paths, or compatibility gates in the rewrite. Historical ADRs, extracted prototype notes, and explicit retirement explanations may mention the strings. CI: scan active schemas, fixtures, source, and runtime tests for zero active uses.

### E8 — Atomic full-replace import
A bundle imported with `intent: full-replace` MUST clear every affected store and load the new contents in a single transaction. A schema-version mismatch or any validation failure rejects the bundle before any write. CI: integration test seeding all stores, importing a mismatched bundle, and asserting state is unchanged.

### E9 — Lossless full-replace round-trip
Export a full local-authoring bundle, clear, re-import: every record matches the original (modulo `updatedAt` if the importer recomputes it). CI: integration test deep-equal across all collections.

### E10 — Plan-then-apply discipline
A bundle with `intent: plan-apply` MUST go through validate → plan → user confirmation → apply. Validation alone makes no writes. CI: unit test calling the validator and planner, then asserting stores are still empty.

### E11 — Evidence URL append on GRC capture
A bundle with `generator.mode: grc-capture` referencing an existing requirement MUST append any incoming evidence URL to the existing evidence list, never replace. CI: unit test importing two GRC-flavoured bundles in sequence.

### E12 — Reject unknown fields on import
Adding a top-level or per-entry field that is not in the master schema causes hard rejection. CI: unit test per supported flow adding `extra: 1`.

### E13 — Classification banner ubiquity
The OFFICIAL: Sensitive plus active TLP banner is visible on every screen of Explorer's local-authoring mode. CI: per-route Playwright assertion.

### E14 — Zero network egress at runtime
After the initial bundle resolves, Explorer makes zero outbound network requests. CI: Playwright run with request counter asserts zero non-self requests after first paint.

### E15 — Integrity scan is non-blocking
The integrity scan runs off the main thread. Running the scan on the maximum permitted dataset MUST NOT block the UI. CI: Playwright timing assertion or worker-channel test.

### E16 — Command palette ubiquity
Cmd/Ctrl+K opens the command palette from every primary route. CI: Playwright key-event test per route.

### E17 — Relationships surface is the Board
The v1 Relationships screen is the column board defined in `explorer-screen-workflow-spec.md` § 13. No network-graph view ships in v1. CI: repo-wide string scan asserts zero references to `cytoscape`, `force-directed`, or graph-layout libraries in the Explorer runtime bundle. See ADR 0010.

### E18 — Cross-entity link validation
Link fields in the Explorer UI are autocomplete pickers that propose only existing entities and reject unknown free text; first-class `relationships` records with an unresolvable endpoint are rejected at write time and on import regardless of `linkValidation`; bundle imports honour the top-level `linkValidation ∈ { strict, lenient, drop }` option (default `lenient`) for non-relationship dangling refs and report each dangling reference in the import summary. CI: unit tests covering UI rejection of unknown IDs, relationship-record write rejection, and the three import branches; no Explorer link field accepts free-text entity references.

### E19 — Pickers for known-set inputs
Wherever the user must enter a value drawn from a known set (entity references, enums, domain, tag application, saved-view filter components), the input is a picker (dropdown, combobox, or autocomplete), not free text. Free text is reserved for genuinely free fields (titles, descriptions, notes, URLs, search). CI: per-input-field test that asserts known-set inputs render as a picker role and reject unknown values.

### E20 — Uniqueness on identifiers and labels
Comparison is case- and whitespace-insensitive across the user's local data.

- **Hard-reject at write time and on import:** `Direction.reference`, `Tag.label`, `SavedView.name`. A duplicate is rejected with a message that links to the existing record; on import the row is listed under rejected rows in the summary.
- **Soft-warn at write time and on import, allow on explicit confirmation:** `Risk.title`, `Action.title`. The UI surfaces an inline warning with a link to the existing record and an "Allow duplicate" affordance; saved duplicates are flagged in the import summary.

CI: unit tests covering the hard-reject and soft-warn branches for each entity, including the case- and whitespace-insensitive comparison rule.

### E21 — Per-import undo
Every `additive-merge` and `plan-apply` write is wrapped in a single IndexedDB transaction tagged with an `importId`. The post-import summary exposes an "Undo this import" affordance that is available until any subsequent write occurs, the user navigates away from the resulting screen, or the tab is refreshed. Undo MUST delete rows added in the transaction and restore pre-apply snapshots for rows it overwrote. Undo is the **only** path that may delete a `compliance-event` row in v1; in all other cases the compliance event store remains append-only (E2). The undo action is itself recorded once in the Work-log and is not further reversible. Manual single-record edits on the entity screens are not reversible in v1. CI: integration test importing a mixed bundle, invoking undo, and asserting full state restoration including any side-effect compliance events.

### E22 — List preferences in sessionStorage only
In-flight list view state (filters, sort, column visibility, pagination, search query, and the Relationships Board's lane visibility/order) is persisted **only in `sessionStorage`**, namespaced under `pspf:explorer:`. It MUST NOT be written to IndexedDB, MUST NOT appear in any master-bundle export, and MUST NOT survive tab close. Selection and scroll position MUST NOT be persisted at all. "Reset local data" on the Data screen MUST clear every `pspf:explorer:*` key from both `sessionStorage` and `localStorage`. CI: unit test asserts no preference write touches IndexedDB or the bundle serialiser; integration test asserts the reset path empties the namespaced keys.

### E23 — Per-version schema publication
The bundle JSON Schema is published per-`schemaVersion` at `schemas/explorer-bundle/<schemaVersion>/` in the repo and at the same path under Explorer's same-origin URL. Once published, a `schemaVersion`'s schema document MUST NOT receive breaking changes; breaking changes require a new version directory. Published schemas MUST NOT contain remote `$ref`s; all `$ref`s are local or relative to the version directory. The runtime validator used by Explorer for imports MUST be loaded from the same per-version schema tree it serves to producers. CI: hash-compare the runtime validator against the served schema for the active `schemaVersion`; lint asserts no remote `$ref`s in any published schema; repo-wide check asserts every `schemaVersion` referenced by a fixture has a published schema directory.

### E24 — Accessibility floor
Explorer commits to a WCAG 2.2 AA-**aligned** accessibility floor (not an audited claim until a third-party audit lands):

- Every primary route MUST be reachable by keyboard alone, via the global navigation focus order and the command palette (E16).
- Every interactive element MUST have a keyboard activator and a visible focus indicator that meets contrast requirements.
- The Relationships Board MUST provide a keyboard equivalent for moving cards between lanes (e.g. focus a card, invoke a "move to lane…" action via menu or arrow-key shortcut). Drag-and-drop is an enhancement, not the only path.
- `prefers-reduced-motion: reduce` MUST disable: the Board's drag-and-drop animation, the summary-toast slide-in, and any route-transition animation. Functional outcomes are unchanged when motion is disabled.
- `axe-core` run per primary route MUST report zero `serious` or `critical` violations on the standard fixture.

CI: Playwright suite per primary route covering keyboard reachability, focus visibility, and reduced-motion behaviour; `axe-core` integration asserts the violation budget per route.

### E25 — Action Impact explanations

Every Action Impact ranking entry MUST include the source `actionId`, scope, affected requirement IDs, affected domain IDs, component scores, urgency, and at least one explanation string. The ranking MUST be deterministic for the same dataset and filter scope. Urgency may be displayed beside impact but MUST NOT by itself increase positive-impact score. CI: unit test with a mixed fixture verifies deterministic order, component-score calculation, and explanation presence for overall, domain, requirement, Essential Eight, and Direction scopes.

### E26 — Evidence review queue semantics

Evidence review queues MUST classify evidence as old, incomplete, changed, unverified, missing, or unlinked using the rules in `pspf-entity-link-spec.md`. Queues MUST support domain scope and one-or-more requirement scope. CI: fixture test seeds old, incomplete, changed, unverified, missing, and unlinked evidence and asserts the same classified counts appear in Workshop summaries, Explorer evidence review, and posture brief evidence-confidence signals.

### E27 — Posture brief traceability

The posture brief MUST include overall posture, domain posture, Essential Eight posture, evidence confidence signals, Direction response state, and top Action Impact entries. Every non-empty claim in the brief MUST be traceable to requirement, evidence, action, risk, Direction, or summary-index data. CI: snapshot test renders the brief from the standard fixture and asserts no posture/action-plan claim is emitted without backing IDs or counts.

### E28 — Shareable brief redaction and readability

Every shareable work brief copied or exported for email/Teams MUST be available as plain text and Markdown, and MAY include an HTML clipboard representation. The brief MUST include scope, generated-at timestamp, freshness/source caveat, current posture/assessment, work required, evidence basis, top Action Impact entries, blockers/risks, and traceability IDs or same-origin links where available. It MUST apply the same publication policy and personal-data exclusions as bundles. CI: fixture test generates a brief containing populated personal and sensitive fields and asserts the copied/exported payload contains no restricted or unapproved sensitive fields and remains readable after Markdown is stripped to plain text.

### E29 — Shareable chart export

Every primary Explorer chart MUST provide a text/table alternative and support copy or save as an image where the browser permits it. The generated image MUST include chart title, scope, generated-at timestamp, active filters, classification/banner marking where required, and source/freshness caveat. Exported chart images and copied chart summaries MUST apply the same publication policy and personal-data exclusions as bundles. CI: Playwright test renders the compliance donut, action timeline, grouped action checklist, and risk matrix on the standard fixture, verifies non-empty image export/copy metadata, verifies the table alternative, and asserts no restricted or unapproved sensitive values appear.

### E30 — Shop forecast explanations

Every Shop spend forecast and savings-opportunity ranking MUST include forecast period, planned spend, expected savings, net benefit where comparable, confidence, linked requirement/action/risk IDs where available, and at least one assumption or explanation string. Forecasts MUST distinguish committed spend from proposed spend and expected savings from realised savings. CI: fixture test seeds suppliers, contracts, spend items, actions, requirements, and risks, then asserts forecast totals, net benefit, payback, confidence, and explanations are deterministic and traceable.

## Tag invariants

These invariants codify the Tags and filters foundation introduced by [adr/0041-v1-7-tags-and-filters-foundation.md](adr/0041-v1-7-tags-and-filters-foundation.md). The owning specification is `pspf-entity-link-spec.md` § Tag.

### T1 — Tag entity shape
`Tag` entities MUST carry `label` (string, 1..40 chars), `title` (string, 1..60 chars), and `colour` (one of the closed set `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `grey`; default `grey` on creation). Optional fields: `description` (0..1000 chars, publication `sensitive`) and `emoji` (single grapheme cluster, publication `public`). `label` is NFC-normalised, trimmed, collapsed to single spaces, and limited to Unicode letters (`\p{L}`), Unicode digits (`\p{N}`), spaces, hyphen (`-`), and apostrophe (`'`). `label` uniqueness is hard-rejected per E20 (case- and whitespace-insensitive). CI: type-level test plus runtime acceptance test enumerating the colour set, default colour, length bounds, label character rules, grapheme validation, and duplicate-label rejection.

### T2 — Taggable entity types (v1.7)
In v1.7 the only permitted `(fromType, toType)` pair for the `tagged-with` link is `(requirement, tag)`. Tagging other entity types is a separate ADR. CI: unit test asserts the link validator rejects every other `(fromType, toType)` pair when `linkType = "tagged-with"`.

### T3 — Tag limits
Core MUST enforce, at write time and on import:
- max tags per workspace: 64 (hard); soft warning at 32;
- max tags applied per requirement: 16 (hard).
Exceeding a hard limit is a write rejection with an actionable error code. CI: unit test seeds 65 tags and asserts the 65th is rejected; seeds 17 `tagged-with` links on one requirement and asserts the 17th is rejected.

### T4 — Tag filter URL contract
Wherever tag filtering is offered (Workshop Requirements navigator, Explorer Requirements screen, Explorer Relationships Board), the active tag filter MUST be reflected in the URL or workspace state as `tags=TAG-...,TAG-...&tagsMode=any|all`. The default mode is `any`. The filter is multi-select, composes with all other filters using `AND`, and in Explorer is persisted in `sessionStorage` only (E22). CI: per-route Playwright assertion that the URL reflects the selected tag set and mode and that reloading restores the same filter; integration test asserts no tag-filter write touches IndexedDB or the bundle serialiser.

### T5 — Tag import, archive, and derived-index rules
Workshop v1.7 exposes archive, not hard-delete, for tags. Archiving a tag hides it from pickers but MUST NOT cascade-delete existing `tagged-with` links or rewrite snapshots. Imported tags whose normalised `label` collides with an existing tag but whose `id` differs are rejected/kept-local by default and surfaced in the import plan; the importer MUST NOT silently create a renamed duplicate. `indexes/by-tag.json`, when present in a bundle, MUST contain only public tag fields and sorted requirement-id lists; `Tag.description` MUST NOT appear. CI: import-plan test for colliding tag labels; bundle publication test asserts `description` is absent from `indexes/by-tag.json` and archived-tag snapshots still resolve.

## Consistency invariants

### C1 — Spec strings agree
For every term in N1, N2, N3, V1, V2, V3, every spec, every TypeScript type, every JSON Schema, and every fixture must use the same canonical spelling.

### C2 — Error code uniqueness
Every error code declared in `pspf-error-and-diagnostics-model.md` MUST be unique and stable. Removed codes remain reserved for one minor release before reuse.

### C3 — Capability scope set
The set of capability scopes is closed and owned by `pspf-trusted-caller-policy.md`. New scopes require an ADR.

## CI enforcement

The invariants check must include at minimum:

1. `entityType` string scan across all specs, schemas, fixtures, and source.
2. Collection name scan across all bundle fixtures.
3. ID prefix scan across all canonical IDs in fixtures and tests.
4. Link type scan: every `linkType` value in fixtures must be in V1's set.
5. Path scan: every reference to `.pspf/...` paths matches P1.
6. Version axis scan: every version field used at a compatibility gate is one of `schemaVersion`, `bundleVersion`, `apiVersion`.
7. Field policy scan: every entity field in the schema has a declared `publication` policy.
8. Personal-field scan: bundle fixtures contain none of the fields listed in N6.
9. CSP scan: the built Explorer index contains the required CSP meta and no inline `<script>`.
10. Compound link-type scan: zero matches for the retired `<entity>-<verb>-<entity>` pattern.
11. Retired bundle format-tag scan (E7): zero active uses of `pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport` in schemas, fixtures, source, or runtime tests. Historical ADRs, extracted prototype notes, and explicit retirement explanations are permitted.
12. Explorer behavioural test pack (E1–E24) green on every PR and release tag.
13. Duplicate-file hygiene scan: zero files in the Explorer source tree match the patterns `* 2.ts`, `* 2.tsx`, `* copy.ts`, `* copy.tsx`, or any equivalent OS-generated duplicate suffix. CI fails on match.
14. Schema-publication parity (E23): hash-compare the runtime validator against the served schema for the active `schemaVersion`; lint that no published schema contains a remote `$ref`; assert every `schemaVersion` referenced by a fixture has a published schema directory at `schemas/explorer-bundle/<schemaVersion>/`.
15. Accessibility floor (E24): per-route Playwright suite for keyboard reachability, focus visibility, and reduced-motion behaviour; `axe-core` per primary route asserts zero `serious` or `critical` violations on the standard fixture.

## Change control

Adding, removing, or renaming any item in this document requires:

- an ADR explaining the change,
- a fixture and schema update in the same PR,
- a migration note where the change affects existing data,
- and an update to `pspf-spec-consistency-index.md`.
