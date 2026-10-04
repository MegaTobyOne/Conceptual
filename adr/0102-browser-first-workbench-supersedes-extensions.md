# 0102 — Browser-first workbench supersedes the VS Code extensions

- Status: proposed
- Date: 2026-10-05
- Would supersede on acceptance: ADR 0001 (product set), ADR 0007 (extension packaging and trust registry), ADR 0013 §Repos as it applies to extension packages, ADR 0015 (Item Detail WebviewPanel), ADR 0078 (Assurance extension boundary), ADR 0084 §"dual surface" (Explorer becomes the only surface), ADR 0096/0097 surface budgets
- Depends on: ADR 0101

## Context

ADR 0101 reframes the product around three jobs: capture from conversation (J1), answer ad hoc requests fast (J2) and run the team (J3). The 2026-10-05 review assessed four candidate hosts against those jobs plus three deployment criteria — runs on a managed work machine, shareable with a team, and register reachable by tenant AI (Microsoft 365 Copilot) with no integration code:

| Candidate                                                 | J1  | J2  | J3  | Work machine                           | Team sharing             | Copilot can ground on it          |
| --------------------------------------------------------- | --- | --- | --- | -------------------------------------- | ------------------------ | --------------------------------- |
| (a) One modular VS Code extension                         | –   | ◐   | –   | Needs VS Code and extension approval   | Bundle export only       | No; data stays in `.pspf/`        |
| (b) Browser SPA, evolved from Explorer local authoring    | ●   | ●   | ◐   | A URL or a local build opened in a tab | Publish to synced folder | Yes, via SharePoint-synced folder |
| (c) Work edition on the Atlas codebase                    | ●   | ●   | ◐   | As (b)                                 | As (b)                   | As (b)                            |
| (d) Microsoft 365-hosted team view (Teams tab/SharePoint) | ●   | ●   | ●   | Needs tenant app approval              | Native                   | Yes                               |

Candidate (a) tidies the wrong host: capture happens one tab away from Teams and Outlook, not inside an editor. Candidate (d) scores highest but depends on the owner's organisation approving a tenant app before anything can be tried. Candidate (c) would import the sprawl problem into a consumer product that promises no accounts and no sync, and Atlas is at version 0.0.0. Candidate (b) can be trialled on a work machine today, publishes into the folder Copilot already indexes, and is the same static build that a Teams tab or Outlook task pane later points at, so it is also the path to (d).

The existing Explorer already has browser-local authoring, an IndexedDB store, master-bundle import and export, the shared requirement finder and the brief renderer. The missing pieces are the capture surface, the answer surface, the team surface and a publish-to-folder action.

## Decision

1. **The product becomes one browser single-page application.** It is the only product surface. It runs with no backend; persistence is browser-local (IndexedDB), and exchange is by file.
2. **Navigation is by job, not by entity.** Five places: **Inbox** (paste or drop a recap, email or note; deterministic parser produces typed drafts — Action, Request, Decision, Risk, Note — each carrying its source excerpt and conversation deep link; drafts are accepted, merged into an existing record suggested by the finder, retyped or discarded; nothing is written without a click), **Ask** (search across requirements, risks, actions, suppliers and people; answer cards with status, owner, last change, open work and evidence freshness; copy as brief paragraph; compose several cards into a templated brief; save the question and answer as a Request so repeat asks are a lookup), **Work** (one worklist with lenses — mine, team, overdue, blocked, by requirement, by risk, recently changed — beside a single record layout with explicit Save; Requirements become a lens and link target rather than a destination), **Team** (open, overdue, blocked and stale work per person; meeting preparation card per attendee set; load and staleness computed, not entered), **Publish** (posture brief, weekly delta from the last two snapshots, action register, team digest, request-ledger extract; preview, redaction summary and a one-time-chosen target folder). Settings, backup, restore, integrity and help sit behind one menu.
3. **Layout is one three-pane workbench**: a one-line context header whose search box is Ask, a dense keyboard-navigable worklist, the record, and a collapsible inspector for related items, provenance and history. Route, selection, scroll position and unfinished drafts survive tab close, restart and crash; the app reopens where the operator was. Drafts autosave; records save explicitly.
4. **Publish-to-folder is the integration.** Using the File System Access API the app writes Markdown, Word and CSV artefacts into a folder the operator chose once — in practice the OneDrive-synced copy of a SharePoint library. Saving is publishing; Microsoft 365 Copilot grounds on the result with no Graph calls, app registration or tenant approval (ADR 0101 Rung 0). The same build is later packaged as a Teams tab or Outlook add-in task pane by manifest only.
5. **Capture inverts where AI sits.** Microsoft 365 Copilot does the extraction where it already runs (meeting recap action items and decisions, Outlook thread summary, or a copyable prompt template supplied by the Inbox that yields a known table shape). The app's parser is deterministic. An `AiDraft` provenance shape — source excerpt, generated-by, accepted-by, accepted-at — is defined so that a regex, a declarative agent or an in-tenant model produce indistinguishable drafts.
6. **Pub flips from local-only to team-visible.** People, ownership, load and blockers are shown inside the app. The existing `publication` declarations and redaction rules apply at every copy and publish step; names are withheld or replaced by roles according to the artefact's target. `Person.name`, `Person.email` and `Assignment.personId` remain excluded from anything leaving the team boundary.
7. **The model carries forward; the host does not.** `@pspf/contracts` (entities, IDs, link taxonomy, finder, publication policy), `@pspf/reference-data`, `@pspf/ism-source-library` and `@pspf/brief-renderer` are retained unchanged in meaning. The master bundle remains the exchange format and the one-way migration path for the owner's existing register. Writer lock, trusted-caller policy, Core command API, command palette contributions and the `.pspf/` workspace layout have no caller in the new surface and are not carried.
8. **Retirement of the five extensions proceeds in four steps and nothing is deleted before step four**: (i) freeze `pspf-core`, `pspf-workshop`, `pspf-assurance`, `pspf-shop` and `pspf-pub` at 1.76.0 with CI reduced to build-still-passes; (ii) build the SPA until it covers the original operator spine (author, snapshot, export, brief) plus Inbox and Ask; (iii) import the owner's real register and use only the SPA for a fortnight; (iv) mark the Marketplace listings deprecated with a pointer to the SPA, move the extension packages under `packages/legacy/`, and remove them in a later release. Assurance and Shop capability return only as Work lenses if the friction log shows the owner performs those jobs.
9. **Technology choice is open between the current Explorer stack (Vite, Lit, IndexedDB) and the Atlas stack (React, Mantine, Dexie).** The deciding question is which reaches a working Inbox sooner; Atlas's engine-module pattern (freshness, posture, brief, timeline) is the reference either way. Atlas itself remains a separate product and repository; code is not shared until the work-side model has stabilised through the first slice.
10. **First slice is Inbox and Ask**, proven with real pastes against the owner's current register export before UI is built: parser stability against Copilot recap shapes, and whether finder match suggestions produce more useful merges than noise.

This ADR is proposed. Until accepted, the five extensions and the dual-mode Explorer remain the shipped product and all current gates apply. On acceptance it allocates no version, schema or date; those follow in the slice ADR.

## Consequences

- One surface, one store, one deployment artefact; the duplicate command titles, duplicated pentest workbench and version-locked five-package release train disappear.
- Capture becomes confirm-rather-than-type and carries provenance for free, which applies the product's evidence philosophy to actions and decisions.
- The Marketplace distribution channel is lost; the SPA needs a hosting location the owner's organisation accepts, or a local build opened from disk for the trial.
- IndexedDB in a managed browser can be cleared by policy or profile reset. Publish-to-folder on change plus a scheduled backup export are the mitigation, as in Atlas.
- A diffable Git workspace is lost; the synced folder and backup export are the practical equivalent.
- Tenant AI beyond Rung 0 requires per-user Copilot licensing, the agency's position on Copilot for the data's classification, admin publishing of any agent and an organisation-sanctioned development tenant. None of these blocks Rung 0.
- The surface budgets of ADR 0096/0097 and the journey-cost ratchet of ADR 0100 measure a surface that will no longer exist; they retire with the extensions rather than being re-based.

## Alternatives considered

- **One modular VS Code extension (candidate a).** Rejected: it keeps the register out of reach of Teams, Outlook and Copilot, and still requires the owner to leave the conversation to capture.
- **Build on the Atlas codebase now (candidate c).** Rejected for the first slice: Atlas is pre-1.0 with a no-accounts, no-sync promise that conflicts with J3, and merging would blur two products the owner has chosen to keep distinct. Adopt its patterns; revisit a shared engine later.
- **Microsoft 365-hosted team view first (candidate d).** Deferred rather than rejected: it is the destination the SPA is designed to be wrapped into, but it cannot be trialled without tenant approval.
- **Keep Explorer dual-mode and add the extensions' features to it incrementally.** Rejected: it preserves entity-first navigation and a budget-constrained surface; the job-first reorganisation is the point.
- **Add a backend for team sharing.** Rejected for now: a synced folder gives sharing and Copilot grounding with no service to host, secure or accredit.
