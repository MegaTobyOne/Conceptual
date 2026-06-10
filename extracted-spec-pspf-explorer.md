# PSPF Explorer — Extracted Specification

Status: **reference**

## 0. Source and scope

- **Source**: PSPF Explorer workspace at HEAD; package version `3.2.0-alpha.3`; examined on the date in this conversation. No git history was inspected — limitation noted.
- **Surfaces covered**: all routed views (Home, Domain, Requirement, Risks, Actions, Tags, Saved views, Posture, Analytics, Coverage, Essential Eight, Directions, Relationships, Map, Share, GRC capture intake, Risk/Action work import, Backup, Restore, Integrity, Help), the global command palette, the global header (classification + TLP banner), the data layer (persistence, validators, importers, share/merge), and pure domain logic (filtering, search, summaries, analytics, integrity, relationship-map graph build).
- **Surfaces deliberately excluded**: low-level rendering choreography, in-line styling decisions, the lazy-loaded graph engine's internal layout maths, the contents of the static PSPF 2025 catalogue itself (treated as authoritative input data, not behaviour). The `archive/` directory and any `* 2.ts` duplicate files were not analysed.
- **Confidence**: **Medium–High**. Domain layer, persisted shapes, and import/export contracts are unambiguous from typed code and tests. Some interaction details (latency budgets, accessibility specifics) are taken from the in-repo brief and may not all be enforced today — flagged as Review where applicable.

## 1. Product intent (as inferred)

PSPF Explorer is a single-user, single-device, offline-first compliance workbench for Australian Government security and governance practitioners working through the PSPF 2025 release (218 requirements across six domains, plus the Essential Eight subset and ad-hoc Home Affairs Directions). It is an **interpretation and tracking tool**, not a system of record: it never replaces protectivesecurity.gov.au and it never sends data anywhere.

The 3–7 user goals it most clearly supports:

1. Browse and read the full PSPF 2025 requirement catalogue offline.
2. Record and review per-requirement compliance status, evidence, target maturity and reviewer notes.
3. Maintain a risk register and an action tracker that can be linked to requirements and to each other.
4. Track ad-hoc Home Affairs Directions and their organisational response.
5. See programme posture: overall compliance %, per-domain coverage, Essential Eight coverage, Directions response coverage, threat level and defensive posture.
6. Visualise relationships between gaps, risks, actions and Directions to triage where to invest effort next.
7. Move work across boundaries safely — backup/restore, share package merge, GRC pipeline ingest, work-record import.

**Stated-vs-observed contradictions / tensions**:

- README and threat model describe an **OFFICIAL: Sensitive** posture and instruct users to handle backups accordingly, but the app itself only displays a marking banner — there is no encryption, no password, no idle lock, and any browser profile sharer can read the data. **Review**: is "OFFICIAL: Sensitive by default" a behavioural claim the rewrite must honour with technical controls, or a labelling-only convention?
- README mentions a Board mode column view of the relationship map; only a Cytoscape-based network and an inspector panel are present in the current code. **Gap**: confirm whether Board mode is an intended surface for the rewrite.

## 2. Primary user workflows

### 2.1 Browse a requirement and set its compliance status — **Preserve**

- **Trigger**: user navigates from Home → Domain → Requirement, or jumps via search/command palette.
- **Preconditions**: app loaded; static catalogue available; local store opened.
- **Intent**:
  1. Show the requirement's identifier, domain, full text, references, reporting type, and (if applicable) Essential Eight control association.
  2. Show the user's current compliance state (one of: Fully implemented, Not yet implemented, Risk-managed, Not applicable, Not set), evidence list, target maturity, reviewer, reviewed-at, and notes.
  3. Allow the user to change state, set/clear target maturity (1–4), set reviewer and reviewed-at, edit notes, and add/remove evidence items (URL or note).
  4. Allow the user to log incremental "work tracking" notes against the requirement (free-text plus optional effort string).
  5. Allow the user to link this requirement to a risk, action, or Direction by ID.
  6. Allow the user to navigate to the previous/next requirement in catalogue order.
- **Success**: changes are durably persisted before any UI confirmation; state-change events are recorded as an audit trail entry.
- **Failure / empty / partial**:
  - Unknown requirement id → show a friendly "unknown requirement" placeholder, never a crash.
  - No compliance entry yet → state defaults to **Not set**; no entry is created until the user acts.
  - Empty notes string clears the notes field rather than storing whitespace.
- **Note (Review)**: the linker accepts free-typed IDs without verifying the target exists at write time; integrity scan catches it later. Confirm whether write-time validation is desirable.

### 2.2 Manage the risk register — **Preserve**

- **Trigger**: nav → Risks.
- **Intent**: create, edit, delete risks (title, description, likelihood 1–5, impact 1–5, status: open/monitored/closed); link risks to one or more requirements and/or actions; sort, search, filter by status, paginate, and bulk-update statuses.
- **Success**: risk score (likelihood × impact, 1–25) and band (Low <5, Medium 5–9, High 10–15, Extreme ≥16) are recomputed and shown.
- **Persistence**: risk-list preferences (search query, sort mode, status filter, page, page size) and selected-row IDs are remembered. **Review**: the brief calls for sensitive handling; persisting list selection across sessions is harmless but persisting it via a same-origin cache rather than the durable store is a deliberate choice — confirm.
- **Failure**: deleting a risk leaves any inbound action/relationship link unresolved; the integrity scan will surface this as an orphan-ref issue.

### 2.3 Manage the action tracker — **Preserve**

- **Trigger**: nav → Actions.
- **Intent**: create, edit, delete actions (title, description, type ∈ {remediation, uplift, review, investigation}, status ∈ {todo, in-progress, blocked, done, cancelled}, optional due date, links to requirements and risks); search, sort, filter by status, paginate, bulk-update statuses.
- **Success**: overdue actions (past due, not done/cancelled) are visually distinguished and counted in analytics.

### 2.4 Track Home Affairs Directions and their response — **Preserve**

- **Trigger**: nav → Directions, or `/directions/:state` deep link.
- **Intent**: register a Direction (reference, title, issued date, description, list of affected requirement IDs); record a response state (Yes / No / Risk-managed / Not set); attach evidence (URL or note); add response notes.
- **Success**: register summary surfaces total, count needing response, addressed %, and breakdown by response state. Filtering by response state is supported.

### 2.5 Set posture and threat level — **Preserve**

- **Trigger**: nav → Posture.
- **Intent**: choose a global threat level (low/elevated/high/critical) and global posture (standard/shields-up/active-defence). Optionally override either, per domain, with an "(inherit)" option to clear.
- **Success**: each setting carries a last-updated timestamp; per-domain overrides only persist the fields the user changes.

### 2.6 Tag and save filtered views of the requirement catalogue — **Preserve**

- **Trigger**: nav → Tags / Saved views.
- **Intent**:
  - Tags: define a label, hex colour and optional priority (1–4); apply tags to requirements; filter the catalogue by tag.
  - Saved views: build a filter (by domain, compliance state set, tag set, free-text query); save it under a name; reapply later.
- **Success**: saved-view filters are deterministic and produce the same result given the same compliance snapshot.

### 2.7 Programme overview, coverage and analytics — **Preserve**

- **Trigger**: nav → Home / Coverage / Analytics / Essential Eight.
- **Intent**:
  - Show overall and per-domain compliance breakdown by state.
  - **Compliant percentage excludes Not-applicable items from both numerator and denominator.** This rule is universal and surfaced in copy.
  - Essential Eight: report TECH-099..TECH-106 individually with TECH-107 as a catchall, plus an aggregate implemented %.
  - Directions: report total, addressed %, count needing response.
  - Threat-band counts of risks (excluding closed risks) and overdue-action counts.
- **Success**: numbers reconcile with the underlying records at all times.

### 2.8 Relationship map — **Preserve**

- **Trigger**: nav → Map; optional `?focus=node-id` deep link; optional Coverage / Relationships entry points.
- **Intent**: build a graph whose nodes are requirements, risks, actions and Directions, and whose edges are both stored relationship records and the implicit links carried on the entities themselves (a risk's `requirementIds`, an action's `riskIds`, etc.). Provide:
  - node search;
  - filtering by compliance state, risk band, risk status, action status, action overdue-only, direction response state;
  - layout choice (force-directed, hierarchy, concentric, grid, lanes);
  - hover tooltips with kind-specific facts;
  - selection that highlights the connected chain;
  - a summary panel reporting requirements count, gaps with/without work, blocked-or-overdue actions, and Directions needing response.
- **Failure / empty**: filters that exclude all nodes show a non-empty empty state, not a blank canvas.
- **Review**: README references a "Board" column view alternative — not present in code. Decide.

### 2.9 Backup and restore — **Preserve**

- **Trigger**: nav → Backup / Restore.
- **Intent**:
  - Backup: dump every persisted store into a self-describing JSON envelope tagged with a backup-format version and a schema version equal to the current DB version.
  - Restore: validate the envelope (format tag, schema version exact match); on accept, **clear every store and load the envelope's contents in a single transaction**, then refresh in-memory state.
- **Failure**: invalid JSON, wrong format tag, or schema-version mismatch is rejected before any write occurs; user is shown the validation message.

### 2.10 Share package export and merge — **Preserve**

- **Trigger**: nav → Share.
- **Intent**:
  - Export a user-selected subset of shareable stores (risks, actions, tags, saved views, directions, relationships) as a JSON envelope tagged with a share-format version.
  - Merge an inbound package: each item is matched by primary `id`; if it already exists locally, **the local record wins and the inbound is skipped** (no field-level merge, no conflict UI).
  - Display a merge report counting added vs skipped per store.
- **Review**: silent "existing wins" is safer than overwriting but sacrifices update-by-id. The brief calls for "explicit conflict review before commit" — confirm whether the rewrite must add a diff/review step.

### 2.11 GRC capture intake — **Preserve**

- **Trigger**: nav → GRC capture; user uploads a JSON file from an external GRC tool.
- **Intent**: validate against a locked v1 schema (unknown top-level and per-entry fields rejected); for each entry, look up the requirement ID against the static catalogue; if known, upsert the compliance entry (existing evidence preserved; an evidence URL on the entry is appended); if unknown, reject the entry and report it.
- **Success outcome**: a summary of applied count, rejected list with reasons, source label and capture timestamp.

### 2.12 Risk/Action work import — **Preserve**

- **Trigger**: nav → Import work; user uploads a JSON file.
- **Intent**:
  1. Validate against a locked v1 schema.
  2. **Plan, not apply**: produce a list classifying each risk and action as either an addition (no `id` provided, or `id` not found) or an update (matched by `id`). The plan is reviewable inline (per-row checkboxes, bulk select adds/updates, edit before apply).
  3. Optional **status normalisation**: strict (reject unknown statuses), map-common (apply built-in alias map plus optional user overrides), or force (override every status to a fixed value).
  4. Optional **link mode**: `as-provided` keeps incoming links after dedupe and orphan-filtering; `rebuild-bidirectional` rebuilds risk⇄action references symmetrically.
  5. Optional **update mode**: `replace-all` (omitted optional fields clear stored values) or `patch` (omitted optional fields preserve existing).
  6. Apply only the rows the user confirms.

### 2.13 Integrity scan — **Preserve**

- **Trigger**: nav → Integrity → Run scan. Brief states the scan must run in a Web Worker; the view text says so. **Review**: confirm worker offload is mandatory.
- **Intent**: detect orphan refs (dangling requirement/risk/action/direction IDs from any record), orphan-link relationship endpoints, self-loop relationships, and duplicate titles within risks / actions / direction references (case- and whitespace-insensitive comparison).
- **Output**: a report with a scanned-at timestamp, total records scanned, total issues, and a list of typed issue rows (kind, entity, id, message).

### 2.14 Global keyboard navigation — **Preserve**

- **Trigger**: Cmd/Ctrl+K anywhere.
- **Intent**: open a command palette listing every navigation route plus a small set of synthetic actions; filter by substring on label or path; ↑/↓ to move, Enter to invoke, Esc to close.

### 2.15 Global text search — **Preserve**

- **Intent**: a synchronous in-memory search across requirement IDs, titles and text plus user notes/evidence, plus directions, risks and actions; minimum 2 characters; capped result counts; returns a typed list with kind, title, subtitle, hash-route href and a snippet around the match.

## 3. UX outcomes and interaction behaviour

- **Information classification banner is always visible** ("OFFICIAL: Sensitive" + "TLP:AMBER+STRICT") so the user is never in doubt about the handling context. **Preserve.**
- **Status changes are explicit, not inferred.** Default is "Not set"; the app does not silently mark things as compliant. **Preserve.**
- **Destructive operations always offer explicit confirmation in a separate step** (file picker → review plan → apply for imports; explicit Restore button after file selection). **Preserve.**
- **List preferences and selections survive navigation** for risk and action lists (per-session for selections, per-device for filters/sort). **Preserve.**
- **Keyboard operability**: Cmd/Ctrl+K opens the palette; arrow keys/Enter/Esc within the palette; per the brief, the graph view must remain operable from keyboard with a list-equivalent fallback. **Review** — verify the Cytoscape graph is keyboard-operable in practice; the brief commits to it but I have not confirmed.
- **Reduced motion and colour scheme**: the brief requires honouring `prefers-reduced-motion` and `prefers-color-scheme`. The CSS uses tokens and a colour-scheme meta, but I did not verify graph animations honour reduced motion. **Review.**
- **Visible status feedback**: import/restore/share views show an inline error region (`role="alert"`) on rejection and a status region (`role="status"`) on success. **Preserve.**
- **Progress indication for long operations** (integrity scan): button changes to "Scanning…" and is disabled. **Preserve.**
- **Latency expectations** (from brief, not yet verified): view switch p95 < 100 ms; search < 50 ms over 218 requirements + user records; graph render of 500 nodes < 250 ms; sustained dataset of 10 000 user records with no perceptible lag. **Review** — these are aspirational targets; the rewrite must decide whether to inherit them and how to measure.

## 4. Rendering and state rules

- **Single source of truth in memory**: a central app store holds a snapshot of every persisted store as a reactive value; views subscribe and re-render on change.
- **Write-through invariant**: every mutation persists durably before the in-memory snapshot is updated. A view that re-reads after a successful mutation always sees the new value. **Preserve.**
- **Atomic multi-store writes**: backup restore and share merge happen inside a single transaction over all affected stores; a partial restore is not observable. **Preserve.**
- **Compliance state machine** (per requirement): allowed states `not-set`, `yes`, `no`, `risk-managed`, `not-applicable`. Any transition is allowed. The default state for an unscored requirement is `not-set`, materialised lazily. **Preserve.**
- **Compliance audit events**: every state change produces a `from → to` event with a timestamp; same-state writes do not generate events. The history is queryable per requirement. **Preserve.**
- **Direction response state machine**: `not-set` (default) → `yes` | `no` | `risk-managed`, freely. `not-applicable` is intentionally not a Direction response. **Preserve.**
- **Action overdue rule**: an action is overdue iff `dueAt` is set, `dueAt < now`, and status ∉ {done, cancelled}. **Preserve.**
- **Risk band thresholds**: ≥16 extreme, 10–15 high, 5–9 medium, <5 low. **Preserve.**
- **Compliance % rule**: `yes / (total − not-applicable)`, integer-rounded. Surfaced in copy. **Preserve.**
- **Caching/staleness**: views consume the in-memory snapshot only; there is no separate cache layer. The integrity report is held only in view state and is never persisted. **Preserve.**
- **Concurrency**: app is single-tab; the persistence layer warns if another tab holds an older version open and offers to reload. **Preserve.**
- **Conflict resolution on share-merge**: existing wins by id (no merge of fields). **Review** (see §2.10).

## 5. Business rules and invariants

- **Identity**:
  - Requirement IDs are pattern `<DOMAIN_PREFIX>-<3-digit>` (e.g., `GOV-001`, `TECH-107`) and are owned by the static catalogue, not the user. They are immutable.
  - User-created risks, actions, directions, tags, saved views, work-tracking entries, and relationships have opaque IDs minted at creation and never change.
  - Compliance entries are keyed by RequirementId; one entry per requirement.
  - Posture is a singleton record.
- **Uniqueness**: tag labels and saved-view names are not strictly enforced unique; duplicate titles within risks/actions/directions are detected after the fact by the integrity scan, not blocked at write time. **Review** — should the rewrite enforce uniqueness on write?
- **Validation**:
  - Risk: likelihood ∈ {1..5}, impact ∈ {1..5}, status ∈ {open, monitored, closed}, title required.
  - Action: type ∈ {remediation, uplift, review, investigation}, status ∈ {todo, in-progress, blocked, done, cancelled}, dueAt optional ISO timestamp, title required.
  - Direction: reference, title and issuedAt required; `requirementIds` may be empty.
  - Tag: label required, colour validated as a hex string at write time.
  - Compliance entry: state required; evidence list may be empty.
  - Imported envelopes: unknown top-level or per-entry fields cause hard rejection; ISO 8601 timestamps are parsed; states must be in the allowed set (or aliased / forced under explicit user opt-in).
  - Backup envelope: format tag and schema version must match exactly; otherwise no write occurs.
- **Authorisation**: not applicable — single-user, single-device. All actions are self-authorised.
- **Quantitative limits and defaults**:
  - 218 requirements across 6 domains in the 2025 release (data-driven, not a hard limit).
  - 8 Essential Eight controls plus 1 catchall (TECH-107).
  - Maturity levels 1–4.
  - Tag priority 1–4.
  - Risk score range 1–25.
  - List page size default 20; user-adjustable.
  - Search minimum query length 2; result caps applied per kind.
  - Targeted client performance budgets per the brief (FCP < 1.0 s, TTI < 1.5 s, etc.) — see §3.

## 6. Data and contracts (shape, not schema)

### 6.1 Logical entities

- **Domain** — a fixed group with a stable key, display name, description, and one or more requirement-id prefixes.
- **Requirement** — fixed, catalogue-owned. Carries id, domain, title, full text, optional cross-references, reporting type, and an optional Essential Eight control key.
- **Essential Eight control** — fixed, catalogue-owned. Carries a key, display name, description and the maturity levels that apply to it.
- **Compliance entry** — one per requirement; state, evidence list, optional target maturity, optional reviewer/reviewed-at, optional notes, created-at, updated-at.
- **Compliance event** — append-only audit row capturing a state transition with `fromState`, `toState`, optional notes snapshot, timestamps.
- **Evidence reference** — kind ∈ {url, note}, value, added-at. URLs are user-supplied and untrusted.
- **Risk** — id, title, optional description, likelihood, impact, status, links to requirements and actions, timestamps.
- **Action** — id, title, optional description, type, status, optional due date, links to requirements and risks, timestamps.
- **Direction** — id, reference, title, issued-at, optional description, list of requirement IDs, response state, evidence list, optional response notes, timestamps.
- **Tag** — id, label, colour, optional priority, timestamps.
- **Saved view** — id, name, filter snapshot (domain, state set, tag-id set, query string), timestamps.
- **Work-tracking entry** — id, requirement id, free-text note, optional effort string, timestamps.
- **Relationship** — id, kind ∈ {requirement-risk, requirement-action, risk-action, requirement-direction}, an unordered pair of endpoint IDs (normalised on write so `[a,b]` ≡ `[b,a]`), timestamps.
- **Posture record** — global threat level + posture, optional per-domain overrides, last-updated timestamps.

### 6.2 External contracts

The product produces and consumes the following inter-system contracts. Each is versioned by an explicit string tag and a numeric schema version. Each rejects unknown fields.

- **Backup envelope** — full database dump. Tag `pspfBackup: 'v1'`, plus an exact-match `schemaVersion`. Used for export and full restore.
- **Share package** — partial dump of shareable stores only (risks, actions, tags, saved views, directions, relationships). Tag `pspfShare: 'pspf-share-v1'`. Used for selective export and additive merge.
- **GRC capture payload** — narrow ingest format. Tag `pspfGrcCapture: 'v1'`. One requirement per entry; locked field set; URL evidence appended, never replaced.
- **Work import payload** (risks/actions). Tag `pspfWorkImport: 'v1'`. Supports plan/review/apply, status alias mapping, link normalisation.

The brief commits to publishing a JSON Schema for the export envelope. **Review** — confirm whether the rewrite will publish JSON Schemas for all four contracts.

### 6.3 Persistence guarantees the user appears to rely on

- All edits are durable across tab close/crash before any UI says "saved".
- A backup file taken now and restored on the same release of the app reproduces the exact dataset.
- A schema-version mismatch never produces a partial restore.
- Closing the tab mid-edit leaves the prior committed value intact.

## 7. Security, privacy, and trust

### 7.1 Trust boundaries and threat model (observed)

- **Trust boundary 1**: between the static origin and the user's device. The app loads from a static origin; once loaded, no network traffic occurs at runtime.
- **Trust boundary 2**: between the running app and any imported file. JSON files (backup, share, GRC, work import) are *fully untrusted* and must be validated against a locked schema before any write; unknown fields cause rejection.
- **Trust boundary 3**: between the app and the browser-supplied evidence URL. URLs are user-supplied content; rendered as text with an explicit-open affordance and `rel="noopener noreferrer"` when followed.

Threats considered in repo:

- XSS via malicious imported JSON — mitigated by hand-written validators and the templating engine's auto-escaping.
- Phishing via evidence URLs — mitigated by text-with-explicit-open rendering.
- Local-data exposure on a shared device — out of scope; user responsibility; "Clear all data" affordance available.
- Supply-chain compromise — minimal pinned runtime dependency surface; SBOM published per release.
- Tab-crash partial-write data loss — mitigated by per-mutation transactions.

### 7.2 Secrets, credentials, PII

- No credentials are stored or transmitted.
- All user-entered data is treated as **OFFICIAL: Sensitive** by default and labelled as such in the UI. **Review** — labelling-only versus enforced-by-controls (see §1).

### 7.3 Authorisation

- Single-user, single-device, single-trust-tier. Every operation is self-authorised.

### 7.4 Logging and telemetry

- **Must not**: emit telemetry, analytics, error reporting, or any network call to a third party.
- **May**: log to the local browser console for diagnostic purposes (e.g. database open/blocked/terminated events).
- **Must not log**: any user-entered content (notes, evidence, risk titles, etc.).

### 7.5 Content security

- Strict CSP: `default-src 'self'`; no `unsafe-eval`; `unsafe-inline` permitted only for `style-src` today, with a documented intent to remove it. **Review** — set the rewrite's CSP target up front.
- No third-party CDNs, fonts, analytics, or telemetry endpoints.

## 8. Regression constraints (must survive a rewrite)

Any of the following changes would be considered a regression. Each item includes a one-line "how to test" hint.

1. **Offline after first load.** Loading once with network, then disabling the network, must allow full read/write of every screen — **how to test**: Playwright run with `route.abort()` after first load.
2. **No network egress at runtime.** No request goes anywhere after the initial bundle resolves — **how to test**: assert `request` event count is zero after the initial load.
3. **Compliance %' formula excludes Not applicable.** Setting any number of requirements to Not applicable must not depress the compliance percentage — **how to test**: unit test with N requirements, all Not applicable, asserts 0 % over a 0 denominator and never NaN; smoke test with mixed states.
4. **Audit trail of state changes.** Every change of compliance state produces an event row visible in history; same-state writes do not — **how to test**: unit test on the store's setCompliance.
5. **Lossless backup-and-restore round-trip.** Export a backup, clear, restore: every record matches byte-for-byte (modulo recomputed `updatedAt` if any) — **how to test**: integration test seeding all stores, export, clear, import, deep-equal.
6. **Backup version mismatch refuses any write.** A backup whose schema version differs is rejected before any store is mutated — **how to test**: unit test that a mismatched envelope leaves stores untouched.
7. **Share merge never overwrites an existing record.** Merging a package whose id collides with a local record is a skip — **how to test**: unit test seeding a record, then merging a different record with the same id, then asserting the original wins and the report counts a skip.
8. **Imported JSON with unknown fields is rejected.** Adding a top-level or per-entry field to any of the four ingest formats causes validation failure — **how to test**: unit test per format adding `extra: 1`.
9. **GRC capture appends evidence rather than replacing it.** A second GRC payload referencing the same requirement adds the new URL to the evidence list — **how to test**: unit test of `applyGrcCapture` with two payloads.
10. **Risk/Action import is plan-then-apply.** Validation alone makes no writes; only confirming the plan applies them — **how to test**: unit test calling `validate` and `plan`, then asserting stores are still empty.
11. **Integrity scan is non-blocking.** Running the scan with the maximum dataset does not freeze the main thread — **how to test**: Playwright timing assertion or worker-channel test.
12. **Cmd/Ctrl+K command palette opens from anywhere.** — **how to test**: Playwright key event from each route, asserts dialog appears.
13. **Direction response state set is exactly {Yes, No, Risk-managed, Not set}.** Not applicable is intentionally absent — **how to test**: type-level test plus runtime acceptance test.
14. **Banner shows OFFICIAL: Sensitive and TLP marking on every screen.** — **how to test**: per-route Playwright assertion.
15. **No external resource is loaded at runtime.** Strict CSP `default-src 'self'` is enforced — **how to test**: Playwright `route` filter on non-self hosts asserts zero hits.
16. **Compliance entries default to Not set, not auto-created.** Visiting a requirement does not create a record — **how to test**: count compliance store rows before and after a read-only browse.

## 9. Explicit non-goals and exclusions

- **No multi-user, multi-device, sync or realtime collaboration.** Share packages are the only co-ordination mechanism.
- **No authentication or authorisation.** Anyone with access to the browser profile has full access.
- **No server-side storage, queues, schedulers, or webhooks.**
- **No third-party API integrations** beyond accepting/emitting the four documented JSON shapes.
- **No mobile-first layout** in Phase 1; current code is desktop-oriented.
- **Not a substitute for protectivesecurity.gov.au.** The static catalogue is read-only; the app does not pretend to be authoritative.
- **No automatic v2 → v3 data migration.** Users start fresh.
- **No undo/redo today.** Deferred to a later phase per the brief.
- **No diff-based merge.** Share merge is "existing wins" only (see Open Questions).
- **No print/PDF report generation today.** Deferred per the brief.
- **No multiple workspaces / profiles per browser.** Deferred per the brief.

Common assumptions a reader **should not** carry over:

- That the app encrypts data at rest. It does not.
- That state changes are logged anywhere off-device. They are not.
- That the integrity scan blocks dangerous data — it only reports.
- That all requirement linkages are validated at write time — they are not; integrity is reactive.

## 10. Open questions and decisions for the rewrite

1. **OFFICIAL: Sensitive — label or control?** Options: (a) keep label-only, with prominent guidance; (b) add a passphrase/lock; (c) encrypt the local store with a user-supplied key. **Recommended default**: (a), but make the decision explicit in user-facing docs.
2. **Share-merge conflict policy.** Options: (a) keep "existing wins, silent skip" (current); (b) raise a per-record review step before commit (matches brief language about "explicit conflict review"); (c) field-level merge with last-write-wins. **Recommended default**: (b).
3. **Board-mode relationship view.** README documents it; code does not implement it. Options: (a) cut from scope; (b) implement as an alternative layout to the network graph. **Recommended default**: (a) unless evidence shows users rely on it.
4. **Write-time validation of cross-entity links.** Options: (a) keep linker permissive and rely on integrity scan (current); (b) reject writes that reference unknown ids. **Recommended default**: (b) for newly-typed links from the UI; keep importer behaviour configurable.
5. **Uniqueness on titles/labels.** Options: (a) reactive (integrity scan); (b) prevent at write time for risks, actions, directions, tags, saved views. **Recommended default**: (b) with a clear duplicate-warn affordance.
6. **JSON Schemas for all four contracts.** Options: (a) publish for the backup envelope only (per brief); (b) publish for backup, share, GRC capture and work import. **Recommended default**: (b).
7. **Worker offload threshold.** The brief mandates worker for integrity diagnostics. Options: (a) always worker; (b) main thread under a record-count threshold; (c) extend worker offload to graph layout. **Recommended default**: (a) for integrity; defer (c) until measured.
8. **Performance budgets.** Inherit the brief's targets verbatim, or re-baseline on the rewrite stack? **Recommended default**: inherit and re-measure on the new stack before locking.
9. **List preference and selection persistence**, and where to store it. Today some preferences live in same-origin web storage outside the durable store. Options: (a) keep separation (small, ephemeral, fast); (b) move into the durable store with an explicit "view state" record; (c) drop persistence entirely. **Recommended default**: (a), but document it explicitly.
10. **Reduced-motion compliance for the graph view.** Confirm whether layouts honour `prefers-reduced-motion` (no animation, static layout result).
11. **Keyboard equivalence for the graph view.** Confirm whether the graph is keyboard-operable, or whether a list-equivalent fallback is provided per the brief's accessibility commitment.
12. **Posture record semantics.** Per-domain "(inherit)" today clears the override. Confirm: does inheritance read through to the global setting at display time, or only at decision time?
13. **Compliance-event retention.** Today events are append-only and never pruned. Decide whether the rewrite needs a retention policy or export-and-prune affordance.
14. **Direction response set.** Confirm intent to omit "Not applicable" from Direction responses (today's behaviour) — should this be preserved or aligned with compliance states?
15. **Workspace duplication.** Multiple `* 2.ts` files exist alongside their canonical counterparts (an iCloud sync artefact). The rewrite should adopt a workspace location that does not produce these duplicates.

## 11. Evidence index

The references below are cited only as evidence; the spec body remains implementation-independent.

- Product framing, audience, posture and budgets: [purpose.md](purpose.md), [README.md](README.md), [SECURITY.md](SECURITY.md).
- Persisted entity shapes, branded IDs, allowed value sets, export envelope shape: [src/data/types.ts](src/data/types.ts).
- Database identity, store list, atomic-write helper, migration policy: [src/data/db.ts](src/data/db.ts).
- Backup envelope contract, validation, restore-as-replace transaction: [src/data/backup.ts](src/data/backup.ts).
- Share package contract and "existing wins" merge policy: [src/data/share.ts](src/data/share.ts).
- GRC capture locked-schema contract and evidence-append behaviour: [src/data/grc-capture.ts](src/data/grc-capture.ts).
- Work import locked-schema contract, plan/apply split, status alias maps, link modes, update modes: [src/data/risk-action-import.ts](src/data/risk-action-import.ts).
- Compliance store and audit-event store: [src/data/compliance-store.ts](src/data/compliance-store.ts).
- Reactive in-memory store, write-through invariant, audit-event creation on state change: [src/state/app-store.ts](src/state/app-store.ts).
- Filter rules for the requirement catalogue and saved views: [src/domain/filtering.ts](src/domain/filtering.ts).
- Global text search behaviour and result caps: [src/domain/global-search.ts](src/domain/global-search.ts).
- Domain summaries and compliance % formula: [src/domain/summary.ts](src/domain/summary.ts).
- Risk-band thresholds, Essential Eight coverage, Directions summary, overdue rule: [src/domain/analytics.ts](src/domain/analytics.ts).
- Integrity scan rules (orphans, duplicates, self-loops, dangling endpoints): [src/domain/integrity.ts](src/domain/integrity.ts).
- Relationship-map graph build, filter set, summary, edge-kind labels: [src/domain/relationship-map.ts](src/domain/relationship-map.ts).
- Static catalogue assembly and Essential Eight control set: [src/pspf/index.ts](src/pspf/index.ts).
- Routes, navigation groups, deep-link patterns: [src/app/routes.ts](src/app/routes.ts).
- Classification banner and TLP marking present on every screen: [src/app/pspf-app.ts](src/app/pspf-app.ts).
- Compliance editor (states, evidence, target maturity, reviewer, notes, history): [src/components/compliance-editor.ts](src/components/compliance-editor.ts).
- Work-log component (per-requirement notes, optional effort): [src/components/work-log.ts](src/components/work-log.ts).
- Command palette behaviour (Cmd/Ctrl+K, filter, ↑↓ Enter Esc): [src/components/command-palette.ts](src/components/command-palette.ts).
- Risks list view: search/sort/filter/paginate/bulk and persisted preferences: [src/views/risks-view.ts](src/views/risks-view.ts).
- Actions list view including overdue rule application: [src/views/actions-view.ts](src/views/actions-view.ts).
- Coverage matrix, including the "% excludes Not applicable" copy: [src/views/coverage-view.ts](src/views/coverage-view.ts).
- Directions view, response-state set, summary surfacing: [src/views/directions-view.ts](src/views/directions-view.ts).
- Posture view: global + per-domain with "(inherit)" override: [src/views/posture-view.ts](src/views/posture-view.ts).
- Saved views view: filter composition and persistence: [src/views/saved-views-view.ts](src/views/saved-views-view.ts).
- Restore: validation-then-replace flow: [src/views/restore-view.ts](src/views/restore-view.ts).
- Share view: selective export, file-merge, merge report: [src/views/share-view.ts](src/views/share-view.ts).
- GRC view: sample payload disclosure, ingest summary: [src/views/grc-view.ts](src/views/grc-view.ts).
- Work-import view: plan-review-apply choreography: [src/views/risk-action-import-view.ts](src/views/risk-action-import-view.ts).
- Integrity view: worker-backed scan, issue table: [src/views/integrity-view.ts](src/views/integrity-view.ts).
- CSP, referrer policy, language tag: [index.html](index.html).
- Threat model summary and security posture: [SECURITY.md](SECURITY.md).
