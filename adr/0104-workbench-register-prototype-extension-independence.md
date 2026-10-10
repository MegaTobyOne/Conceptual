# 0104 — Workbench register prototype: extension independence

- Status: accepted 2026-10-10 (owner marked the parity map and agreed the migration source and Shop/Pub archiving the same day; §2, §5 and §6 reflect the marked set)
- Date: 2026-10-10
- Depends on: ADR 0101, ADR 0102 (D7, D8), ADR 0103, ADR 0005, ADR 0002, ADR 0008, ADR 0009
- Version: v1.78.0, allocated to slice W1; the package bump lands with the slice

## Context

ADR 0103 delivered a matter-centred workbench that reads the PSPF register as a read-only snapshot while authoring continues in the frozen extensions. On 2026-10-10 the owner exercised the backup, restore and recovery mechanics and found them sound, cannot run the fortnight trial yet, and asked that the next work remove the need for the extensions so that a later trial validates one tool rather than two.

Three facts shape this decision:

1. **The model is already browser-pure.** `@pspf/contracts`, `@pspf/reference-data`, `@pspf/ism-source-library`, `@pspf/brief-renderer` and `@pspf/connected-view` have no Node-only dependencies. Explorer already authors compliance, risks, actions, tags, saved views and relationships in IndexedDB and round-trips a master bundle with Core.
2. **Core's write rules are entangled with its storage.** `packages/core/src/service.ts` (about 3,500 lines) mixes sql.js, `node:fs`, the writer lock, import planning, snapshot building and publication export. The pure rules it applies (`validateNarrativeRules`, `appendDueDateHistory`, `operatorLinkRuleFor`, `sanitiseEntityForPublication`) already live in `@pspf/contracts`.
3. **The master bundle is lossy by design.** `getBundleCollections` passes every entity through `sanitiseEntityForPublication`, so only `public` fields leave Core. The backup runbook's "portable master JSON backup" (Method A) therefore does not preserve `sensitive` fields such as `ownerTeam`, `dueDateHistory`, `acceptanceDefinition`, narrative bodies or commercial notes. The only complete copy of the owner's register is the SQLite file at `.pspf/core/pspf-core.db` (runbook Methods B–D).

## Decision

### 1. The workbench becomes the register's system of record

1. The workbench gains a **register store** holding canonical `@pspf/contracts` entities and links, beside its existing matter, trail, edition and draft stores. After a one-time migration (section 4) the browser store is authoritative for the owner's register; the extensions are no longer needed for authoring. This is ADR 0102 D8(ii) in substance.
2. Matter references continue to use the `register-*` reference kinds; after cutover they resolve against the live register store rather than an imported snapshot. The `snapshots` store is retained for imported bundles from other sources and for the historical "checked against" record.
3. Compatibility axes do not change: the register store holds the same entity shapes as schema `1.17.0`, and the exported master bundle is the same manifest-led format. Store and backup version counters remain store-internal (ADR 0103 §1.3).

### 2. Parity set

The prototype ports what the owner uses, not the Workshop command surface. The owner marked the parity map in `pspf-grand-plan.md` §"Extension parity map" on 2026-10-10; the sets below are that marking. Because migration (section 4) is lossless, every canonical entity type reaches the register store and backup regardless of whether it has a screen; archiving removes the screen, not the data.

Ported in W1 (marked used):

- Requirement record edit and compliance assessment per requirement (state, assessment basis, acceptance definition, evidence links, notes, reviewer, target maturity).
- Evidence create, edit, attach and freshness review.
- Action create and edit with `ownerTeam`, `planningState`, `blockerClass` and Core-equivalent `dueDateHistory` append on due-date change.
- Risk create and edit with assessment state, primary category, treatments and controls as links, and manual escalation history. Matrix, bow-tie and coverage views are archived.
- Typed links across the four, enforced by `operatorLinkRuleFor`.
- Directions register and responses.
- Narrative records with edit, supersede and restore, attached to the matter brief path; the Reporting Workbench host is not ported and "use generated" is disabled until briefs return.
- ISM control mapping records and review using `@pspf/ism-source-library`; the batch mapping sweep is archived.
- Save-time validation (entity envelope, link pairs, narrative rules, due-date history) as rules; the standalone integrity scan and dataset diagnostics are not ported as commands.
- Lossless workbench backup and restore extended to the register stores (section 5).

Deferred (not used today; still required by ADR 0102 for publication, history and sharing; return in W4+ on friction-log evidence): snapshot with per-record status map and Close reporting period; posture brief and reporting pack; master bundle export and import with Explorer round-trip; team share bundle.

Archived (screen removed, data retained by migration and backup): Strategy, strategic choices, CISO Master Plan and Digital CISO Magazine; change records, tags, saved views and work log; crosswalk import from risk sources; suggested actions and capture sweeps; Risk matrix, bow-tie and coverage views; ISM batch mapping sweep.

Not carried (ADR 0102 D7–D8): writer lock, trusted-caller policy, Core command API, `.pspf/` layout, Git settings, Assurance pentest workbench and Assurance City, Shop suppliers/contracts/spend and the Shop JSON store, Pub people/roles/assignments and the Pub JSON store. Shop and Pub JSON stores are exported to the organisation-approved backup location before cutover; people reappear only as roles under ADR 0103 §3 rule 3 until ADR 0102 D6 team sharing is designed.

### 3. Store and rules

1. **Store shape.** One `entities` object store keyed by `id` with indexes on `entityType`, `updatedAt` and `domainId`; one `links` store keyed by `id` with indexes on `fromId` and `toId`; one append-only `changeLog` store (entity id, field set, previous revision hash, recorded at). The IndexedDB database moves to version 2 under the forward-only migration policy (grand-plan W-D8); the backup envelope moves to `storeVersion` 2 and restore upgrades 1 and refuses anything newer.
2. **Write rules live in `@pspf/contracts` as pure functions** and are shared by the workbench, the migration script and the existing Core (which is not modified): entity envelope validation, link pair rules, narrative rules, due-date history append and, when export returns, the publication preflight and master bundle manifest/checksum construction. Rules that today exist only inside `service.ts` are extracted with their tests, not rewritten from memory.
3. **Save semantics.** Explicit Save per record in one IndexedDB transaction; drafts continue to autosave separately. A failed transaction leaves prior records and the draft intact. Every Save appends a `changeLog` entry; there is no silent overwrite.
4. **Single active writer.** The tab holding the Web Lock `pspf-workbench-writer` may save; other tabs show a read-only state (grand-plan W-D7).

### 4. Lossless migration from Core

1. Migration reads the SQLite database, never the publication bundle. A repository script (`scripts/migrate-core-register.mjs`, Node, run by the owner on the machine holding `.pspf/`) reads `.pspf/core/pspf-core.db` through sql.js, validates every row against the contracts envelope, and writes a **workbench register import file**: an envelope with `type: pspf-workbench-register`, `storeVersion`, source database path hash, record counts per entity type, and a SHA-256 checksum over the canonical JSON. No field is dropped; publication policy is not applied at this boundary because the file does not leave the owner's device.
2. The workbench imports the file after checksum and version validation, shows counts per type and the newest `updatedAt`, and writes in one transaction. Import is idempotent by `id` and `updatedAt`, so a re-run after late extension edits updates only changed records and reports them.
3. **Fidelity proof.** A test fixture database is migrated and the result compared field by field with the rows read directly from the fixture; the slice is not accepted until that comparison is exact for every entity type in the parity set, including `sensitive` fields.
4. **Cutover rule.** The owner records a cutover date in the decision register. After it, the extensions are not used for authoring; if they are, the migration is re-run before further browser work. The extensions remain installed and readable until ADR 0102 D8(iv).

### 5. Export, backup and Explorer

1. **Master bundle export is deferred** (owner marked it unused). When it returns in W4+ it produces the manifest-led, checksummed, publication-sanitised bundle that Core's `importBundle` and Explorer's Core exchange accept today, with a round-trip test. Until then the register has no publication path other than matter editions; this is accepted knowingly (grand-plan W-R25).
2. **Workbench backup** (ADR 0103 §5.3) now includes the register stores and is the lossless recovery artefact; the master bundle is not and never was. The restore screen says so. Backups carry `OFFICIAL: Sensitive` in the file name and header.
3. **Explorer becomes publication review only** (grand-plan W-D5 option b). During the prototype Explorer shows a banner naming the workbench as the authoring surface (W-D17); its browser-local authoring routes are retired at ADR 0102 D8(iv), not before, and no data is deleted. It receives new content again only when export returns.

### 6. Acceptance

1. **Extension-independence test (synthetic).** From a migrated fixture register containing all 29 entity types: assess a requirement with new evidence, create a linked action with a due date and change it once, register a risk treated by that action and record an escalation, register a direction and its response, map a requirement to an ISM control, edit and supersede a narrative, then back up and restore the workbench into a second browser profile. All without opening VS Code for authoring. Counts for every entity type, `dueDateHistory` length, links, escalation history and narrative chains match after restore, and every record read back from the fixture database before migration is field-identical to the record in the store after it.
2. **Owner independence cycle (real).** The owner migrates the real register and completes one authoring cycle and a fortnight of capture and asks in the workbench only. This replaces ADR 0103's W0 trial and is ADR 0102 D8(iii); its protocol is in the grand plan. Any deferred or archived row the owner finds missing is named at exit.
3. **Gates.** `check:workbench` extended to the register store, a `check:register-migration` fidelity gate over the fixture, the existing `check:personal-data` gate over workbench editions and backups, a workbench accessibility gate at 320/768/1440 px and 200%, and `e2e:v1.78` inheriting v1.77.

## Consequences

- The owner's register leaves the SQLite file and VS Code for good; Git history of `.pspf/` is replaced by the `changeLog` store and dated backups.
- `packages/core` is untouched but its rules are duplicated in intent until the extensions are removed; extracting them into contracts keeps one implementation.
- Explorer's local authoring becomes dead weight at the same origin until step (iv), and Explorer receives no new content until export returns; W-R12 and W-R25 persist through the prototype and are accepted knowingly.
- The parity set follows the owner's marking: nine rows ported, five deferred, nine archived. The reporting outputs of v1.71–v1.74 and the Core snapshot/export spine are among the deferred rows; they return only on evidence.
- Migration tooling runs in Node on the owner's machine; it is repository tooling, not an extension feature, and does not breach the freeze.

## Alternatives considered

- **Grow Explorer into the workbench.** Rejected again (ADR 0102): entity-first navigation and the dual-mode shell are the things being retired.
- **Run Core's `service.ts` in the browser on sql.js WASM.** Rejected: it carries the writer lock, `node:fs` and workspace layout along; the pure rules are the only part worth keeping.
- **Migrate through the master bundle.** Rejected: it is publication-sanitised and would silently drop every `sensitive` field.
- **Add a lossless export command to Core.** Rejected: it is a new extension feature under the freeze; a repository script achieves the same with no Marketplace or activation change.
- **Full Workshop command parity before cutover.** Rejected: 47 of the 72 commands are specialist; parity was decided by the owner's marked map.
- **Port snapshot, brief and export in W1 because they are the "operator spine".** Rejected: the owner marked them unused; porting them first would again build for a user who does not exist (ADR 0101). They are deferred, not dropped, because ADR 0102 still requires publication and sharing.
