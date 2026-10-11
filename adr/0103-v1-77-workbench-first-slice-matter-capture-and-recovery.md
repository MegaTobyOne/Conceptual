# 0103 — v1.77 workbench first slice: matter capture, dossier and recovery

- Status: accepted 2026-10-10 (owner reports the [P2 comparison](../docs/p2-matter-dossier-evaluation.md#owner-comparison-protocol) done; results not recorded in the repository)
- Date: 2026-10-10
- Depends on: ADR 0101, ADR 0102 (including the 2026-10-08 amendment), ADR 0005, ADR 0002, ADR 0008

## Context

ADR 0102 selected a browser workbench and a matter-centred first workflow, and left four things open before implementation: field-level contracts, release sequencing, storage and recovery design, and parser/finder thresholds. This ADR settles them for the first slice only. FL-009 (risk-focused committee discussion with no reliable risk-to-decision trail) is the driving scenario.

Owner decisions of 2026-10-10: the repository stays version-aligned at 1.77.0; the five frozen extensions are not republished; hosting stays on the current static host with browser-local storage in the user's profile (confirmed acceptable for the owner's trial); the owner comparison is performed while this ADR is drafted.

## Decision

### 1. Release model

1. The slice is **v1.77.0**. Root and all workspace packages, including the new workbench package, move to 1.77.0 so the existing alignment check holds. `PSPF_SLICE_VERSION` becomes 1.77.0.
2. **The five frozen extensions are not republished.** Their package versions change only to keep alignment. The Marketplace workflow must skip them; the web workflow deploys the workbench. This amends ADR 0102 D8(i) (see its dated amendment); the freeze now means "no features, no publication" rather than "version 1.76.0".
3. **No compatibility axis changes.** The workbench store is browser-local and is not an Explorer bundle. `schemaVersion`, `bundleVersion` and `apiVersion` keep their current values. The IndexedDB schema number and the backup envelope's `storeVersion` are store-internal migration counters, not compatibility axes.
4. The slice is released only when the 1.77 gate block passes (build, typecheck, tests, workbench e2e, personal-data and deployment-safety checks, release-candidate check).

### 2. Hosting and storage

1. The workbench is a static build served from the existing host under its own path (`/workbench/`) beside `/explorer/`, with the same-origin headers and deployment-safety checks. It makes no network calls beyond loading its own files. Schemas stay same-origin.
2. It uses its own IndexedDB database (`pspf-workbench.v1`). Origin-bound storage is not shared with `pspf-explorer.v3` and the workbench never reads Explorer's stores.
3. Browser-local storage is neither a backup nor an approval. Backup/restore (section 5) is the recovery path; the owner has confirmed profile-local storage is acceptable for the trial.

### 3. Field-level contracts (workbench-local)

New records are workbench-local, not canonical entities, and do not enter the master bundle in this slice. IDs follow ADR 0002 (`<PREFIX>-<UUIDv7>`, time bits stripped on any export). Every field declares `publication`; the default is `sensitive`. Prefixes are registered in `@pspf/contracts` with the implementation.

| Record     | Prefix | Fields (publication)                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matter     | `MTR`  | `id` (public), `title` (sensitive), `scope` (sensitive), `intendedOutcome` (sensitive), `followUpState` (`open`, `waiting`, `closed`; sensitive), `nextStep` (sensitive), `checkpointAt` (sensitive), `createdAt`/`updatedAt` (sensitive), `refs[]` (see below)                                                                                                     |
| Reference  | -      | `kind` (`register-requirement`, `register-risk`, `register-action`, `external`), `targetId` (sensitive), `label` (sensitive), `bundleVersion` and `bundleDate` of the source bundle (sensitive), `lastCheckedAt` (sensitive). External references are pointers only; no remote content is copied.                                                                   |
| Trail item | `TRL`  | `matterId`, `type` (`ask`, `proposed-action`, `owner`, `advice`, `open-question`, `decision`, `status`, `outcome`, `delay-reason`, `note`), `state` (`known`, `unknown`, `no-response-recorded`), `value` (sensitive free text), `source` (excerpt, label, optional deep link; sensitive), `provenance` (`typed`, `parsed`, `ai-draft`), `recordedAt`, `supersedes` |
| Profile    | -      | Built-in, versioned, read-only: `ciso`, `ops`, `committee` (synthetic DIDC example). Holds questions, emphasis and readiness checks only. No permission, access or authority fields.                                                                                                                                                                                |
| Edition    | `EDN`  | `matterId`, `profile`, `audience`, `occasion`, `issuedAt`, `text` (the reviewed text as issued), `sourceRevisions[]`, `correctsEditionId`, `redactionSummary`. Immutable once issued.                                                                                                                                                                               |
| Draft      | `DRF`  | `kind` (`capture`, `brief`, `matter`), `text`, `context` (route, selection, scroll). Separate store; never a record until explicit Save.                                                                                                                                                                                                                            |

Rules:

1. A trail item states known or unknown explicitly. Silence is never converted to a value. Advice is never labelled approval or decision; `decision` requires a source.
2. Involvement, disposition and outcome are separate trail types, not one status. Dispositions are `decided`, `more-information-requested`, `deferred` and `no-decision-recorded`.
3. People outside the team are recorded as roles or organisational units. Names are optional, stay inside the team boundary and are never published or placed in editions' published text.
4. The dossier is derived from matter, trail items and references; it is never stored. Current position per type is the latest non-superseded item.
5. Two change baselines are kept per matter: `lastReviewedAt` (operator marks reviewed) and the latest edition's `issuedAt`. Changes since each are computed, so dependent narrative is flagged without rewriting an edition.

### 4. Register reference, history and erasure

1. **Import** reads a master bundle the Explorer validation already accepts, rejecting anything that fails schema or checksum validation. The import is held as a read-only snapshot with its `bundleVersion`, date and checksum. Re-import is explicit and creates a new snapshot; matters keep the snapshot they were last checked against and show "changed since checked" when a newer snapshot differs for the referenced ID. A reference whose target disappears is flagged, never silently deleted or rewritten.
2. **History** is append-only for trail items (supersede, never overwrite) and editions (correct by a new edition). Matters keep an update log of prior values.
3. **Erasure** is an explicit operator action per matter. It removes the matter, its trail items, drafts and editions from the store and records a tombstone (ID and date only) so references surface as erased. Backups made earlier are not rewritten and the restore screen states that they may contain erased data. Immutable history is not permission to retain prohibited personal data.

### 5. Recovery

1. Drafts autosave to the draft store on a short debounce and on page hide. The app restores route, selection, scroll and unfinished text on load.
2. Record Save writes in a single IndexedDB transaction; a failed or interrupted transaction leaves prior records intact and keeps the draft with a visible error.
3. Backup exports one JSON file containing all stores, `storeVersion`, an app version and a SHA-256 checksum. Restore validates the checksum and version, shows a summary (counts, newest update), and replaces the store only after confirmation, keeping the previous contents until the new write commits.
4. A reminder appears when the last backup is older than seven days or never taken, because browser storage can be cleared by policy.

### 6. Capture format and matching thresholds

1. The Capture input accepts a small explicit format: one item per block starting with a type label (`Ask:`, `Action:`, `Owner:`, `Advice:`, `Question:`, `Decision:`, `Status:`, `Outcome:`, `Delay:`, `Note:`), an optional `Source:` line and optional `Link:` line. A copyable prompt template that makes Microsoft 365 Copilot emit this shape is shown in the app. Any other text is kept verbatim as a `note` draft.
2. Parsing is deterministic and never infers an owner, decision or outcome. Each draft carries its source excerpt. The operator accepts, retypes, merges or discards; nothing is written without a click.
3. Matching to matters and register records tries exact IDs (for example `R-...`, requirement IDs) first, then exact normalised title, then token overlap. **Initial threshold:** suggest only when Jaccard token overlap on titles is at least 0.6 and at least two non-stopword tokens match; show at most three suggestions with the matched text. These are starting values, to be re-tuned against FL-009 synthetic examples and recorded here before the slice is accepted.

### 7. Publication

Markdown is the only output. Issue is an explicit step: preview, redaction summary, operator edits, then write to the chosen folder through the File System Access API (or a download where the API is unavailable). Redaction is default-deny per ADR 0005: only fields declared `public` or deliberately included by the operator with a visible warning are emitted; restricted personal fields and names of people are never emitted. Saving a record is not publishing, and selecting a profile never widens disclosure.

### 8. Slice scope

In: Capture (paste and parse), Matter list and dossier with three profiles, trail follow-up and next step, read-only bundle import, issued editions, Markdown publish, recovery and backup, workbench shell with keyboard-navigable worklist. Out: AI, Graph, Word/CSV, collaboration, register authoring, Team and Work lenses beyond the matter list, Assurance and Shop, and any VS Code companion.

### 9. Acceptance

FL-009 synthetic acceptance test: capture a risk topic discussed at a committee, link it to a matter and register references, record an open question awaiting a named role, issue a CISO brief, then record a "more information requested" disposition and a new next step. The test passes when the issued edition is unchanged, both change baselines are reported, unknowns remain visible, the next step survives reload and a backup/restore round trip, and no output contains non-public fields.

## Consequences

- One release train continues, but extension versions advance without publication; the Marketplace workflow and gate-integrity checks need an explicit skip list.
- Matter, trail, edition and draft are workbench-local, so no schema axis, bundle schema or Explorer change is needed now. Promotion to canonical entities is a later decision if team sharing requires it.
- Threshold values and the capture format are provisional until tuned against synthetic examples and the owner's trial.

## Alternatives considered

- **Independent workbench version line.** Cleaner against the freeze, but the owner chose to remain aligned at 1.77.0.
- **Add Matter and Trail to the master bundle now.** Rejected: forces schema work and publication policy for entities that may change after the first trial.
- **Reuse `CommitmentEntity` or `GovernanceDecisionEntity` for trail items.** Rejected for this slice: commitments describe agreed work and governance decisions target commitments, so neither can represent an unanswered question or an unknown state. Reuse remains available for linking to existing records.

## Implementation notes and open items (2026-10-10)

Recorded at acceptance so the next slice ADR inherits them explicitly. None changes the decisions above.

1. **§3 prefix registration not done.** `MTR`, `TRL`, `EDN`, `DRF` and the snapshot prefix `SNP` are defined in `packages/workbench/src/domain/types.ts` only; registration in `@pspf/contracts` is carried as grand-plan decision W-D9.
2. **§6.3 thresholds untuned.** The starting values (Jaccard 0.6, two shared tokens, three suggestions) ship unchanged; the re-tuning against FL-009 synthetic examples was not performed before acceptance. Tuned values and their corpus are to be recorded here as a dated addendum (W-D10).
3. **Owner comparison unrecorded.** The P2 comparison was reported performed; results are to be entered in `docs/p2-matter-dossier-evaluation.md`.
4. **§3 provenance.** The parser records every item as `parsed`; no control sets `ai-draft`. Carried as W-D1.
5. **§5.1 page-hide save.** Drafts save on input; no `pagehide`/`visibilitychange` handler is present. Verify or add in W1.
6. **§7 name redaction.** Publish removes email addresses and operator-listed names only; structured role/person fields are proposed under W-D6.
7. **Not in scope here but observed:** no accessibility gate covers `/workbench/`; the publish folder is re-chosen on every issue; two tabs share the database without coordination (W-D7); store migration policy is undefined (W-D8).

The W0 owner trial protocol, candidate W1–W4 slices and risks W-R1 to W-R15 are in `pspf-grand-plan.md` §"Next build phases after the first workbench slice (2026-10-10)".
