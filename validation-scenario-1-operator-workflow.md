# Validation Scenario 1: v1.30.0 6clicks Risk Source Workflow

## Purpose

Validate that a PSPF/security operator can complete the current initial assurance workflow without developer assistance: open Workshop, load the sample assurance scenario, review the Master Dashboard, Plan of Action, Essential Eight dashboard, Cyber Strategy Map, trace Directions, Requirements, Risks, and Actions in Connected View, record a significant change, create and apply tags, create Workshop saved views including planning scopes, export to Explorer, review Explorer "Why This Changed", Plan Lens, Strategy, and Connected View, filter Requirements and Relationships by tag/status/search, save and apply Explorer saved views, review Explorer Local Changes, confirm compliance-history export controls, confirm Explorer-to-Workshop import/undo behaviour, review Shop commercial coverage, review Pub local CRUD coverage for people and relationship context, generate the Digital CISO Magazine share artefact, and distinguish Marketplace dry-run release validation from actual publication.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

Manual focus:

- Workshop launch, Activity Bar access, status bar version context, and sample workspace loading.
- Workshop dashboard orientation: Directions, Action Impact, evidence queue, and version context.
- Workshop Master Dashboard and Plan of Action: decision context, N/A-aware metrics, Action dates, status filtering, and Today timeline marker.
- Workshop Essential Eight dashboard: strategy tracking, evidence/action/risk context, and uplift plan.
- Workshop Cyber Strategy Map: strategic choices, outcomes, posture measures, trends, confidence, and linked Requirements, Risks, Actions, and Directions.
- Workshop Strategy Editor: full-size editing of the canonical Strategy record while preserving explicit save/discard/cancel behaviour.
- Workshop and Explorer Connected View: compact card labels, hover/focus details, transitive chain highlighting, related Requirement emphasis, zoom controls, lane visibility controls, not-applicable Requirement visibility, selected-chain scroll, toolbar clear, and toolbar refresh.
- Workshop Change Records list, significant-change authoring, and Change Record edit surface.
- Workshop Tag Manager, Requirement Detail tag rail, and Requirement tag filtering.
- Explorer visual identity, publication load, "Why This Changed", full-width Explorer Search, Local Changes, refresh restore, compliance-history export controls, and local JSON export.
- Explorer Requirements and Relationships Board tag filtering with `any` / `all` mode and URL/session state.
- Explorer Requirements and Relationships saved views, including save, apply, rename/archive visibility, refresh persistence, and local-authoring export/import.
- Workshop Saved Views manager and Workshop-owned Requirement, Dashboard, and Evidence Review views.
- Explorer Plan Lens over open Actions, open Risks, active/proposed Change Records, and Directions needing attention.
- Explorer schema-change guidance when a remembered browser bundle is no longer compatible with the current build.
- Workshop import review, Core/Workshop plan-review-apply import, and undo for Explorer local JSON.
- Marketplace release dry-run visibility, including run name, job summary, skipped publication wording, and absence of receipt tags.
- Shop commercial coverage dashboard: linked/unlinked suppliers, contracts, and spend items; spend items missing `contract funds spend-item` links; monthly and FY forecast; cost-centre spend item report; planned savings schedule; annual planned efficiency dividends; CSV/XLS exports; near-term contract review; funded open Actions; supplier Risk links; and quick actions to existing link commands.
- Pub local CRUD coverage: Activity Bar entry, Home view, local-only people context wording, Organisation Chart, People, Roles, Assignments, Relationship Log, detail/edit panels for Person, Role, Assignment, and Relationship Note, and absence of Explorer publication claims.
- Workshop Risk Source panel: 6clicks profile configuration, SecretStorage-backed credential prompt, fixture-backed preview, explicit apply consent, and source metadata on imported risks.
- Digital CISO Magazine and CISO Master Plan: all-domain and `INFO` PSPF Domain issue generation, Markdown/email-copy readability, self-contained print-ready HTML, source metadata, dedicated Workshop buttons, active CISO Master Plan panel, and redaction of personal fields, sensitive assumptions, and non-public working notes.

Automated coverage handles detailed counts, redaction/default-deny, schema validation, accessibility, writer lock, backup/restore, personal-data exclusion, and import/export round trips. Do not repeat those manually unless a visible behaviour looks wrong.

Still out of scope for v1.30.0:

- Pub data in Explorer bundles, Pub delete/archive flows, broader row-level Pub list actions, development-record persistence, performance-management workflows, roster planning, rotation planning, editable posture, chart image export, numeric performance benchmarking, private/team saved views, default-start views, per-user/private tags, tag hierarchies, Explorer-authored Change Records, change-record diff views, change-record tagging, local history pruning, automatic retention windows, plan baselines, milestone/resource/budget entities, standalone strategy-choice entities, multiple Strategy records, Explorer strategy editing, a separate PSPF Plan product, procurement import, finance reconciliation, approvals, editable Connected View, drag-to-link, impact-weighted Connected View layout, office/cost-centre hierarchy, persisted Report Packs, native PDF generation, email sending, subscriber management, RSS/feed publication, copyrighted comic artwork or trade dress, image/PDF export of the board, and third-party accessibility audit.

## Test Data

- Use `PSPF: Load Sample Workspace` for the primary run.
- Use one existing sample Requirement for Explorer Local Changes; avoid creating extra Workshop records unless specifically testing authoring.
- For Explorer Local Changes, use short obvious values such as `Explorer validation evidence`, `Explorer validation action`, and `Explorer validation risk`.

## Manual Operator Steps

Optional clean run: close the Extension Host and run `npx pnpm@10.10.0 run debug:reset` from the repository root before relaunching.

Before validating VentraIP web deployment, start the self-hosted runner from the dedicated macOS runner account:

```sh
su - pspf-runner
cd github-runner
./run.sh
```

Confirm GitHub shows runner `pspf-runner` online with labels `self-hosted`, `macOS`, and `mechastopheles` before triggering `web-release`.

Before rerunning `web-release`, confirm the test hostname exists and resolves:

```sh
dig +short test.tobyharvey.online A
curl -I https://test.tobyharvey.online/
```

If `dig` returns no address or `curl` reports `Could not resolve host`, create or repair the `test.tobyharvey.online` subdomain/DNS record in VentraIP before rerunning the workflow. If DNS resolves but LiteSpeed returns `404`, check that the VentraIP/cPanel subdomain document root still matches the `test-web` `VENTRAIP_DOCROOT`; subdomain recreation can reset that mapping outside Git. The expected test document root is `/home/tobyharv/public_html/test` and the expected test app directory is `/home/tobyharv/apps/pspf-web-test`.

1. Launch `Run PSPF Core + Workshop`.
2. Open the PSPF Workshop Activity Bar item and confirm `Workshop Home` appears with `PSPF v1.30.0`, `Schema 1.11.0`, and `API 1.11.0`.
3. Confirm the VS Code status bar shows `PSPF v1.30.0` and its tooltip includes `Schema 1.11.0`, `Bundle 1.11.0`, and `API 1.11.0`.
4. From `Workshop Home`, click `Load sample`.
5. Click `Open dashboard` and do a quick visual check: workspace ready state, Direction chips, N/A-aware completion/evidence metrics, `Action Impact — Top 5`, latest activity, and no obvious cramped columns or wrapping regressions. Open `Plan of Action` and confirm the graphical plan shows Action date spans, status filters, and a visible Today marker. Open `Essential Eight` and confirm the strategy tracker and uplift plan are populated from linked Requirements, Evidence, Risks, and Actions. Then open `Strategy Map` and confirm the Cyber Strategy Map shows three strategic choices, outcome summaries, posture measures, trend/confidence labels, and linked Requirements, Risks, Actions, and Directions.
6. Click `Review evidence` and confirm the queue opens with missing/freshness/unlinked evidence groups and `Urgent Actions (Blocked or Overdue)`.
7. From the Workshop left panel or `Workshop Home`, open `Connected View`. Confirm the board uses domain-grouped Requirements, a single Actions lane, neutral curved edges, compact cards showing only reference and title, zoom controls, lane visibility controls, `N/A requirements`, `Clear selection`, and `Refresh`.
8. Toggle `N/A requirements` off and confirm not-applicable Requirement cards are hidden and connector paths redraw without leaving orphaned visual links. Toggle it back on. Hover or keyboard-focus a Requirement card and confirm the popover appears next to that card with its status/domain detail and direct linked Directions, Risks, or Actions. Select the Requirement and confirm the selected chain scrolls into view, the transitive chain highlights, unrelated cards dim, related Requirements receive a distinct emphasis, Cmd/Ctrl/Shift-click adds another card, clicking the only selected card clears it, double-click opens item detail, and `Refresh` re-renders the panel.
9. Open one Requirement item detail, click `Record significant change`, create a Change Record with a short public summary and optional sensitive reason/impact notes, then run `PSPF: Open Change Records` and confirm the row shows status, type, persistence, source, raised date, affected Requirement, and summary.
10. Open the Change Record row, edit the public summary or status, save, reopen `PSPF: Open Change Records`, and confirm the update is visible.
11. Open one Requirement item detail, click `Apply tag`, create a `Security uplift` tag if needed, and confirm the tag appears in the `Tags` rail. Run `PSPF: Manage Tags` and confirm the Tag Manager shows the tag, colour, status, and Requirement count.
12. Run `PSPF: Add Evidence`, create `Approved Authentication policy`, choose `Browse by domain`, select Governance, Security Risk, and Technology, then select at least two Governance, one Security Risk, and two Technology Requirements. Confirm the completion message summarises the affected domains and one Evidence record is linked to multiple Requirements.
13. Run `PSPF: Create Action`, create one cross-cutting action, choose `Browse by assessment status`, select at least one non-final status, then select two or more Requirements. Confirm one Action record is linked to multiple Requirements.
14. Run `PSPF: Create Risk`, create one cross-cutting risk, choose `All Requirements` or `Browse by domain`, then select two or more Requirements. Confirm one Risk record is linked to multiple Requirements.
15. Open Shop, set `pspf.shop.defaultCostCentre` if a default is needed, create or load a supplier, contract, and spend item with expected savings, then confirm a new spend item can carry a cost centre. Use the Shop context menu to link supplier-to-Requirement, supplier-to-Risk, contract-to-Requirement, contract-to-spend item, spend-to-Action, and spend-to-Requirement. Confirm each picker only offers active records of the expected type and duplicate links are not created. Open `PSPF: Open Shop Forecast` and confirm the dashboard shows `Forecast spend by month`, `Forecast spend by financial year`, `Spend item report`, `Spend items needing contract funding links`, `Planned savings schedule`, `Planned efficiency dividends`, `Assurance coverage`, `Near-term contract review`, `Funded Actions`, and `Supplier Risk links` without contact details, commercial notes, assumptions, service summaries, or monetary amounts in the coverage sections. Use `Export CSV` and `Export XLS`, save both files, and confirm each opens as a simple table report containing the monthly forecast, FY forecast, spend item report with financial year and cost centre, planned savings schedule, and annual planned efficiency dividends.
16. Reopen the linked Requirement, Action, and Risk in Workshop and confirm each shows a `Commercial Context` table with relationship, type, title, status, and context only. Confirm contact details, notes, assumptions, service summaries, and monetary amounts are not displayed there.
17. Run `PSPF: Filter Requirements by Tag`, select `Security uplift`, choose `Any selected tag`, and confirm the matching Requirement opens cleanly. Then run `PSPF: Manage Saved Views`, create a Workshop Requirements view using `Security uplift` or a short search term, and confirm the Saved Views panel refreshes immediately with the new row. Apply it and confirm the filtered Requirements list opens with the expected rows.
18. In `PSPF: Manage Saved Views`, create a Dashboard view and an Evidence Review view using the same filter. Apply the Dashboard view and confirm it opens a planning slice with filtered Requirements, open Actions, open Risks, and recent Change Records. Apply the Evidence Review view and confirm it opens missing-evidence and evidence-needing-review lists for the filtered Requirements.
19. From `Workshop Home`, click `Validate`, `Integrity scan` (`PSPF: Run Integrity Scan`), `Snapshot`, `Copy brief`, and `Export` in that order. Confirm each completes and the copied brief is readable when pasted into a scratch note.
20. Open `packages/explorer/dist/index.html`, select the latest debug `bundle.json` from `Open a PSPF bundle` if a remembered bundle does not restore, and confirm the portable assurance masthead, `OFFICIAL: Sensitive · TLP:AMBER+STRICT` banner, and `Bundle baseline` / `Local changes` / `Export to Workshop` mode strip are visible after the bundle loads.
21. Open `Why This Changed` and confirm the Change Record appears with affected Requirement context, public summary, and no sensitive reason, impact summary, or decision-owner reference.
22. Open `Plan Lens` and confirm it shows open Actions, open Risks, active/proposed Change Records, and Directions needing attention without introducing editable plan-baseline, milestone, resource, or budget fields. Open `Strategy` and confirm the executive strategy view shows choices, outcomes, measures, and linked records without rationale, assumptions, constraints, or non-public commentary.
23. Open Explorer `Connected View` and confirm the compact layout shows Directions, Requirements, Risks, and one Actions lane. Use zoom in, zoom out, reset, and lane visibility controls. Hover a card to check the positioned details popover, select a Requirement to check selected-chain scroll, chain highlighting, and related-Requirement highlighting, use `Clear selection`, and click `Refresh` to reload the static page.
24. On the Requirements section, select the `Security uplift` tag filter and confirm the URL includes `tags=` and `tagsMode=any`. Switch to `All selected tags`, reload the page, and confirm the tag filter is restored from the URL/session state. Check the Relationships Board uses the same tag filter.
25. In Requirements, combine `Explorer Search`, a Requirement status filter, and the `Security uplift` tag filter. Save the current Requirements view as `Security uplift focus`, clear the filters, apply the saved view, and confirm the search/status/tag controls and visible rows return without reopening Explorer. Rename the view, archive it, and confirm each change redraws the controls immediately.
26. In Relationships, keep the `Security uplift` tag filter active, save the current Relationship view as `Security relationships`, clear tags, apply the saved view, and confirm the Relationships Board reopens with the tag filter restored.
27. If the deployed Explorer has just moved schema version, refresh it before selecting a bundle and confirm it shows `Reload your PSPF JSON` rather than an empty review surface. Select the latest bundle and confirm normal rendering resumes.
28. Use the full-width `Explorer Search` under the posture brief to find one Requirement, confirm the same search narrows the `Local Changes` list, select that Requirement, and confirm `Linked Context` shows existing linked Evidence, Actions, Risks, and tagged context plus Open buttons to the full sections. Change its status, add one evidence reference, one Action, and one Risk, then refresh the browser. Confirm the latest bundle restores automatically and the local changes and saved views are still visible as `local` / saved local state.
29. In `Local Changes`, confirm `Include compliance history` is on by default. Click `Export local JSON` and confirm the exported bundle includes `collections.saved-views`; if the bundle contains local compliance events, confirm it also includes `collections.compliance-events` and a `manifest.collections` entry for `compliance-events`. Turn `Include compliance history` off, export again, and confirm `compliance-events` is omitted from both `collections` and `manifest.collections` while the current Requirement status/evidence/Action/Risk edits remain present. Import that history-excluded Explorer local JSON from Workshop with `Plan, review, apply`. Confirm `PSPF Workshop Import Review` opens as a read-only surface with created, updated, unchanged, write, per-type, and update-example detail before `Apply Import`; apply it, then use `Undo Import` and confirm the undo notification is clear.
30. Run `PSPF: Open Risk Source Panel`, configure the 6clicks risk source with a blank base URL to use the built-in fixture, choose either API key header or bearer token auth, enter a test credential, run `Test Connection`, and confirm the panel reports fixture records without exposing the credential.
31. Run `Run Preview` from the Risk Source panel and confirm the preview classifies fixture risks into new/changed/unchanged/ambiguous/error counts with field-level differences where applicable.
32. Run `Apply Selected`; for changed records, confirm the dialog preserves local PSPF-owned fields unless `Apply source values` is explicitly selected. Confirm created or updated risks show Risk Source metadata in the Risk editor.
33. Open Pub from the Activity Bar or run `PSPF: Open Pub`. Confirm `PSPF Pub v1.30.0`, local-only people context, organisation chart, relationship context, assignments and rotations, and local-only Pub publication wording are visible. Load the Pub sample if needed, then open People, Roles, Assignments, and Relationship Log. For each local record type, open its detail panel and edit panel, confirm the expected fields are visible, save without implying that Pub data is exported, and confirm Relationship Note detail/edit covers person, recorded date, summary, and next contact.
34. In GitHub Actions, open or run a Marketplace release dry run from `main` with `target=all` and `dry_run=true`. Confirm the run name includes `target=all / dry_run=true`, the dispatch summary says publication is skipped, Core, Workshop, Shop, and Pub publish jobs show dry-run summaries, and `Publish to VS Code Marketplace`, `Verify Marketplace version`, `Tag and GitHub release`, and `Verify receipt tag` are skipped.
35. Confirm the dry run created no `core/1.30.0`, `workshop/1.30.0`, `shop/1.30.0`, or `pub/1.30.0` remote receipt tags. Do not approve or run a non-dry-run Marketplace publish as part of this manual validation unless this is the actual release publication window.
36. From Workshop Home, click `Digital CISO Magazine` and confirm the issue opens from a button and copies email-ready Markdown. Click `CISO Master Plan` and confirm a separate active planning panel opens with direction, streams, phases, inputs/dependencies, and buttons back to Plan of Action, Master Dashboard, Digital CISO Magazine, and copy plan. Then run `npx pnpm@10.10.0 run check:ciso-magazine` from the repository root and open `.tmp/ciso-magazine/digital-ciso-magazine.html`. Confirm the issue has a cover hook, editor's note, current posture snapshot, feature story, attention-required section, action strip, commercial watch, CISO Master Plan article, reader actions, next issue, source metadata, and `OFFICIAL: Sensitive` label. Open `.tmp/ciso-magazine/ciso-master-plan.md` and `.tmp/ciso-magazine/digital-ciso-magazine-info.md` and confirm they are readable as planning/email-copy extracts.
37. Finish by running `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.

## Expected Manual Signals

- Workshop feels like the system-of-record decision surface: load, validate, inspect, snapshot, export, import review, apply, and undo are discoverable from Workshop/Home commands.
- Connected View feels compact and purposeful: cards do not become verbose, hover/focus details appear where the user is looking, selected chains are clear, related Requirements are visible without new links, and refresh is easy to find.
- Tags feel like a normal workspace feature: creation, application, removal, archive visibility, and filtering are discoverable from Workshop and visible in Requirement Detail.
- Evidence, Actions, and Risks can each be created once and linked to multiple Requirements across domains without duplicating the record.
- Explorer feels like the portable review surface: warmer masthead, sensitivity banner, source/version chips, full-width Explorer Search, Local Changes, and browser-local trust markers are immediately visible.
- Explorer tag filters narrow Requirements and Relationships predictably, compose with Search, and persist only through URL/session state.
- Saved views feel durable and scoped: Workshop Requirement views, Explorer Requirements views, and Explorer Relationship views can be named, applied after clearing, survive refresh where browser-local, export as `saved-view`, and import into Core without exposing personal data.
- Planning views feel like lightweight lenses over assurance work: Workshop Dashboard/Evidence Review views and Explorer Plan Lens reuse existing records without pretending to be a full project-management tool.
- Marketplace dry runs are visibly package-only: a green dry run cannot be mistaken for a published Core, Workshop, or Shop extension.
- Explorer explains schema-change refreshes: stale remembered JSON asks the user to reload their PSPF JSON instead of leaving the review surface empty.
- Bundle validation and bundle file loading are available as lower-priority diagnostics, not prominent day-to-day review sections.
- Local Changes does not feel stuck: Explorer Search narrows the list, selecting an item updates the workspace, linked context is visible with Open buttons to full sections, refresh restores the latest bundle, and local values remain labelled `local`.
- The Explorer-to-Workshop import path is understandable: `Plan, review, apply` opens `PSPF Workshop Import Review`, shows what will change before writing, `Apply Import` is explicit, summary details are available, and `Undo Import` is easy to find.
- Copied posture briefs from Workshop and Explorer are readable enough for email or Teams.

## Automated Baseline

The following automated gates now cover the detailed checks that used to be manual: schema/hash validation, exact sample counts, redaction/default-deny, personal-data exclusion, Explorer section navigation, Explorer Search, table readability, Local Changes persistence, refresh restore, local evidence/Action/Risk materialisation, Explorer-to-Workshop import, import-review source guards, undo planning coverage, writer lock, backup/restore, and accessibility.

For a quick spine check, run:

```sh
npx pnpm@10.10.0 run e2e:v1.26
npx pnpm@10.10.0 run e2e:v1.27
npx pnpm@10.10.0 run e2e:v1.28
npx pnpm@10.10.0 run e2e:v1.29
npx pnpm@10.10.0 run e2e:v1.30
```

Expected outputs:

- A generated workspace at `.tmp/e2e-v0.1-workspace`.
- A generated bundle path under `.tmp/e2e-v0.1-workspace/.pspf/exchange/exports/`.
- A report at `.tmp/e2e-v0.1-workspace/.pspf/reports/e2e-v0.1-report.md`.
- A full-replace import round-trip into `.tmp/e2e-v0.1-import-workspace`.
- Passing personal-data exclusion and schema validation checks.
- Passing Explorer accessibility scan with zero serious or critical axe-core findings.
- Passing Explorer publication smoke check with visible version context, no validation failures, and a copyable posture brief payload.

For release confidence, run:

```sh
npx pnpm@10.10.0 run release:readiness
```

Expected output:

- A readiness report at `.tmp/release-readiness/v1.30.0-readiness-report.md`.
- An Explorer Local Changes smoke report at `.tmp/explorer-local-authoring/explorer-local-authoring-report.json`.
- An Explorer-to-Workshop import smoke report at `.tmp/explorer-to-workshop-import/explorer-to-workshop-import-report.json`.
- PASS for all automated readiness gates.
- PASS for the Explorer publication smoke, posture brief redaction, and Digital CISO Magazine gates.
- Manual operator validation should focus on the v1.30.0 6clicks Risk Source panel, fixture preview/apply flow, SecretStorage-backed credential handling, explicit source-overwrite consent, and publication-safe source metadata, plus the v1.29 UX coverage and relationship-rule foundation, Pub local detail/edit coverage, export-format direction for native slide/document artefacts, Marketplace dry-run support, and earlier regression surfaces.

## Pass Criteria

- The 34-step manual operator flow completes without intervention.
- Workshop clearly presents the decision surface and Explorer clearly presents the portable review surface.
- Explorer Local Changes survives refresh and exports successfully.
- Tags survive snapshot/export/import, `Tag.description` stays out of copied briefs and published indexes, saved views survive Explorer refresh/export/import, and tag/saved-view filters are understandable without reading docs.
- Workshop import review, plan-review-apply, and undo are clear enough to use without reading implementation docs.
- `validate:debug-workspace` and `release:readiness` pass when run for the same build.

## Feedback Capture

Record:

- Any prompt wording that caused hesitation.
- Any command order that felt surprising.
- Any Explorer identity, Local Changes, or import-review label that felt unclear.
- Any tag label, picker, chip, saved-view, or filter behaviour that felt unclear.
- Any planning lens row, label, or scope that felt too heavy or too thin for a 12-month cyber plan discussion.
- Any Shop coverage dashboard row, cost-centre export, quick action, or empty state that did not help triage commercial assurance coverage.
- Any Connected View zoom, lane visibility, hover, selection, selected-chain scroll, related-Requirement highlight, refresh, or compact-card behaviour that felt unclear.
- Any Marketplace release wording that still made a dry run look like a real publication.
- Any concern about whether compliance-history export should be included by default, excluded by default, or made more prominent.
- Any mismatch between Workshop, Explorer, and the operator's expectation.
- The next action needed before another validation session.
