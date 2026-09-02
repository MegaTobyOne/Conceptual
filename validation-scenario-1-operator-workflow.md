# Validation Scenario 1: v1.52.0 Studio System and Unified Explorer Workflow

Status: **reference**

## Purpose

Validate that a PSPF/security operator can complete the current initial assurance workflow without developer assistance: open Workshop, load the sample assurance scenario, review the Master Dashboard, Plan of Action, Essential Eight dashboard, Cyber Strategy Map, trace Directions, Requirements, Risks, and Actions in Connected View, record a significant change, create and apply tags, create Workshop saved views including planning scopes, export a Core master bundle, load it into the unified PSPF Explorer web app through the Core exchange, review requirements, risks, actions, directions, and the relationship map, author browser-local compliance states, evidence references, risks, actions, work log entries, tags, and saved views, copy the Explorer posture brief, export the Explorer's Core bundle and confirm the Core/Workshop import round trip, review Shop commercial coverage, review Pub local CRUD coverage for people and relationship context, generate the Digital CISO Magazine share artefact, and distinguish Marketplace dry-run release validation from actual publication.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

Manual focus:

- Workshop launch, Activity Bar access, status bar version context, and sample workspace loading.
- Studio System compact identity across Core, Assurance, Workshop, Shop, Pub, and Explorer; canonical product/domain wayfinding; VS Code theme inheritance; Explorer Dark, Light, and System preferences; and CISO, Auditor, and Solo IT presentation lenses.
- Workshop dashboard orientation: Assessment Dashboard action queue, Domain Stats navigation, Directions, Action Impact, evidence queue, and version context.
- Workshop Master Dashboard and Plan of Action: decision context, N/A-aware metrics, Action dates, status filtering, and Today timeline marker.
- Workshop Essential Eight dashboard: strategy tracking, evidence/action/risk context, and uplift plan.
- Workshop Cyber Strategy Map: strategic choices, outcomes, posture measures, trends, confidence, and linked Requirements, Risks, Actions, and Directions.
- Workshop Strategy priority (risk → priority → choice): a strategic choice with linked risks shows a derived priority band (Critical, High, Medium, Low, or none) from linked risk severity adjusted by trend and confidence, a plain-language rationale, the top blocking risks, and repair cues for unresolved risk links.
- Workshop Strategy Editor: full-size editing of the canonical Strategy record while preserving explicit save/discard/cancel behaviour.
- Workshop Connected View: compact card labels, hover/focus details, transitive chain highlighting, related Requirement emphasis, zoom controls, lane visibility controls, not-applicable Requirement visibility, selected-chain scroll, toolbar clear, and toolbar refresh.
- Workshop Change Records list, significant-change authoring, and Change Record edit surface.
- Workshop Tag Manager, Requirement Detail tag rail, and Requirement tag filtering.
- Explorer (unified web app): app shell and home domains, Core exchange bundle load with import plan and checksum verification, review of imported requirements/risks/actions/directions, relationship map with board mode and deep links, Assurance City Day/Night and focus workflows, browser-local authoring (compliance, evidence references, risks, actions, work log, tags, saved views), posture and copied posture brief, share packages, backup/restore, and the Core bundle export round trip.
- Workshop Saved Views manager and Workshop-owned Requirement, Dashboard, and Evidence Review views.
- Core import of an Explorer-exported master bundle, and Workshop import review, plan-review-apply, and undo for Core exchange formats.
- Marketplace release dry-run visibility, including run name, job summary, skipped publication wording, and absence of receipt tags.
- Shop commercial coverage dashboard: Forecast visible at the top of Shop, linked/unlinked suppliers, contracts, and spend items; spend items missing `contract funds spend-item` links; monthly and FY forecast; cost-centre spend item report; planned savings schedule; annual planned efficiency dividends; CSV/XLS exports; near-term contract review; funded open Actions; supplier Risk links; and quick actions to existing link commands.
- Pub local CRUD coverage: Activity Bar entry, Home view, local-only people context wording, Organisation Chart, People, Roles, Assignments, Relationship Log, detail/edit panels for Person, Role, Assignment, and Relationship Note, and absence of Explorer publication claims.
- Workshop Risk Source panel: explicit fixture/live source mode, credential-free fixture validation, SecretStorage-backed live credential prompt, fixture variant preview, selected apply, redacted local run logs, explicit apply consent, and source metadata on imported risks.
- Workshop ISM controls: direct evidence/action/risk links, implementation-status navigation, control-side Requirement mapping, and `workshop-source-controls` saved views.
- Digital CISO Magazine and CISO Master Plan: all-domain and `INFO` PSPF Domain issue generation, Markdown/email-copy readability, self-contained print-ready HTML, source metadata, dedicated Workshop buttons, active CISO Master Plan panel, and redaction of personal fields, sensitive assumptions, and non-public working notes.

Automated coverage handles detailed counts, redaction/default-deny, schema validation, accessibility, writer lock, backup/restore, personal-data exclusion, and import/export round trips. Do not repeat those manually unless a visible behaviour looks wrong.

Still out of scope for v1.52.0:

- The legacy static Explorer's Plan Lens, "Why This Changed", executive Strategy view, Explorer Connected View, Explorer Obligations/ISM Source Controls tables, tag filtering with URL state, and compliance-history export controls were retired at the ADR 0084 cutover; equivalent review lives in Workshop and in the unified Explorer's analytics, coverage, and relationship map views.
- Pub data in Explorer bundles, Pub delete/archive flows, HRIS/LMS integration, automatic legacy-certification conversion, automatic skill-catalogue insertion, AI workforce recommendations, multi-user succession approval, person-identifying workforce exports, roster planning, chart image export, numeric performance benchmarking, private/team saved views, default-start views, per-user/private tags, tag hierarchies, Explorer-authored Change Records, change-record diff views, change-record tagging, local history pruning, automatic retention windows, plan baselines, milestone/resource/budget entities, standalone strategy-choice entities, multiple Strategy records, Explorer strategy editing, editable Explorer ISM authoring, a separate PSPF Plan product, procurement import, finance reconciliation, approvals, editable Connected View, drag-to-link, impact-weighted Connected View layout, office/cost-centre hierarchy, persisted Report Packs, native PDF generation, email sending, subscriber management, RSS/feed publication, copyrighted comic artwork or trade dress, image/PDF export of the board, and third-party accessibility audit.

## Test Data

- Use `PSPF: Load Sample Workspace` for the primary run.
- Use one existing sample Requirement for Explorer browser-local authoring; avoid creating extra Workshop records unless specifically testing authoring.
- For Explorer browser-local authoring, use short obvious values such as `Explorer validation evidence`, `Explorer validation action`, and `Explorer validation risk`.

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
2. Open the PSPF Workshop Activity Bar item and confirm `Workshop Home` appears with `PSPF v1.70.0`, `Schema 1.15.0`, and `API 1.15.0`.
3. Confirm the VS Code status bar shows `PSPF v1.70.0` and its tooltip includes `Schema 1.15.0`, `Bundle 1.15.0`, and `API 1.15.0`.
4. From `Workshop Home`, click `Load sample`.
5. Click `Open dashboard` and do a quick visual check: workspace ready state, Direction chips, N/A-aware completion/evidence metrics, `Action Impact — Top 5`, latest activity, portal groups, actionable decision-loop cards, and no obvious cramped columns or wrapping regressions. Open `Plan of Action` and confirm the graphical plan shows Action date spans, status filters, a visible Today marker, and any Pub team dates marked for planning. Open `Essential Eight` and confirm the strategy tracker and uplift plan are populated from linked Requirements, Evidence, Risks, and Actions. Then open `Strategy Map` and confirm the Cyber Strategy Map shows three strategic choices, outcome summaries, grouped posture measures, labelled trend pills without arrow glyphs, confidence labels, and linked Requirements, Risks, Actions, and Directions.
6. Click `Review evidence` and confirm the queue opens with missing/freshness/unlinked evidence groups and `Urgent Actions (Blocked or Overdue)`.
7. From the Workshop left panel or `Workshop Home`, open `Connected View`. Confirm the board uses domain-grouped Requirements, a single Actions lane, neutral curved edges, compact cards showing only reference and title, zoom controls, lane visibility controls, `N/A requirements`, `Clear selection`, and `Refresh`.
8. Toggle `N/A requirements` off and confirm not-applicable Requirement cards are hidden and connector paths redraw without leaving orphaned visual links. Toggle it back on. Hover or keyboard-focus a Requirement card and confirm the popover appears next to that card with its status/domain detail and direct linked Directions, Risks, or Actions. Select the Requirement and confirm the selected chain scrolls into view, the transitive chain highlights, connector lines stay visually under the selected card, unrelated cards dim, related Requirements receive a distinct emphasis, Cmd/Ctrl/Shift-click adds another card, clicking the only selected card clears it, double-click opens item detail, and `Refresh` re-renders the panel.
9. Open one Requirement item detail, click `Record significant change`, create a Change Record with a short public summary and optional sensitive reason/impact notes, then run `PSPF: Open Change Records` and confirm the row shows status, type, persistence, source, raised date, affected Requirement, and summary.
10. Open the Change Record row, edit the public summary or status, save, reopen `PSPF: Open Change Records`, and confirm the update is visible.
11. Open one Requirement item detail, click `Apply tag`, create a `Security uplift` tag if needed, and confirm the tag appears in the `Tags` rail. Run `PSPF: Manage Tags` and confirm the Tag Manager shows the tag, colour, status, and Requirement count.
12. Run `PSPF: Add Evidence`, create `Approved Authentication policy`, choose `Browse by domain`, select Governance, Security Risk, and Technology, then select at least two Governance, one Security Risk, and two Technology Requirements. Confirm the completion message summarises the affected domains and one Evidence record is linked to multiple Requirements.
13. Run `PSPF: Create Action`, create one cross-cutting action, choose `Browse by assessment status`, select at least one non-final status, then select two or more Requirements. Confirm one Action record is linked to multiple Requirements.
14. Run `PSPF: Create Risk`, create one cross-cutting risk, choose `All Requirements` or `Browse by domain`, then select two or more Requirements. Confirm one Risk record is linked to multiple Requirements. From one Requirement detail, use `Relationship actions` to link an existing Evidence, Action, Risk, or Direction. Confirm the action preview explains why the link helps, the completion receipt summarises the effect, and `Reveal in Connected View` opens the board with the new chain selected, highlighted, and summarised.
15. Open Shop and confirm `Forecast` is the first visible Shop view and Shop Home puts `Forecast & savings` before create/edit maintenance sections. Set `pspf.shop.defaultCostCentre` if a default is needed, create or load a supplier, contract, and spend item with expected savings, then confirm a new spend item can carry a cost centre. Use the Shop context menu to link supplier-to-Requirement, supplier-to-Risk, contract-to-Requirement, contract-to-spend item, spend-to-Action, and spend-to-Requirement. Confirm each picker only offers active records of the expected type and duplicate links are not created. Open `PSPF: Open Shop Forecast` and confirm the dashboard shows `Forecast spend by month`, `Forecast spend by financial year`, `Spend item report`, `Spend items needing contract funding links`, `Planned savings schedule`, `Planned efficiency dividends`, `Assurance coverage`, `Near-term contract review`, `Funded Actions`, and `Supplier Risk links` without contact details, commercial notes, assumptions, service summaries, or monetary amounts in the coverage sections. Use `Export CSV` and `Export XLS`, save both files, and confirm each opens as a simple table report containing the monthly forecast, FY forecast, spend item report with financial year and cost centre, planned savings schedule, and annual planned efficiency dividends.
16. Reopen the linked Requirement, Action, and Risk in Workshop and confirm each shows a `Commercial Context` table with relationship, type, title, status, and context only. Confirm contact details, notes, assumptions, service summaries, and monetary amounts are not displayed there.
17. From Workshop Home or Master Dashboard, open `Assessment Dashboard`. Confirm `Domain Stats` shows both status counts and a `Needs action` Requirement table; filter by a domain and open a listed Requirement directly from the table. Run `PSPF: Filter Requirements by Tag`, select `Security uplift`, choose `Any selected tag`, and confirm the matching Requirement opens cleanly. In the Requirements page, switch between `All`, at least two PSPF domain tabs, and `Directions`; confirm the tabs sit above the two-panel workbench, the left list follows the active filter, and the `Directions` tab shows the Directions panel on the right. Combine a tab, status filter, and search term; confirm the filtered-count chip and `Clear filters` button appear, and then clear back to the full `All` list. Then run `PSPF: Manage Saved Views`, create a Workshop Requirements view using `Security uplift` or a short search term, and confirm the Saved Views panel refreshes immediately with the new row. Apply it and confirm the filtered Requirements list opens with the expected rows.
18. In `PSPF: Manage Saved Views`, create a Dashboard view and an Evidence Review view using the same filter. Apply the Dashboard view and confirm it opens a planning slice with filtered Requirements, open Actions, open Risks, and recent Change Records. Apply the Evidence Review view and confirm it opens missing-evidence and evidence-needing-review lists for the filtered Requirements.
    18a. Open `PSPF: Browse ISM Source Controls`, choose a control, set its implementation status, link one Evidence/Action/Risk directly to the control, and map one Requirement from the control detail. Return to `PSPF: Manage Saved Views`, create an `ISM Controls` view with an implementation-status filter, apply it, and confirm the matching control opens from the saved-view table.
    18b. Run `PSPF: Open ISM Review Workbench` from the command palette or Workshop Home. Confirm the queue metrics and quick filters show unmapped, not-assessed, drift-review, needs-direct-work, and risk-without-action controls, and that opening a row returns to the ISM Control Detail.
19. From `Workshop Home`, click `Validate`, `Integrity scan` (`PSPF: Run Integrity Scan`), `Dataset diagnostics` (`PSPF: Run Dataset Diagnostics`), `Snapshot`, `Copy brief`, and `Export` in that order. Confirm each completes, dataset diagnostics reports the cyber reference dataset as valid, and the copied brief is readable when pasted into a scratch note.
20. Serve the built Explorer (`npx pnpm@10.10.0 --filter pspf-explorer run preview` after `pnpm build`, or open the deployed `/explorer/` URL) and confirm the unified PSPF Explorer app shell loads in Dark on first use with all six PSPF domains, the v1.52.0 marker, compact 13 px body copy, and AU-English copy throughout. Confirm the command trigger opens the same palette as Cmd/Ctrl+K. Switch to Light and System and confirm persistence. At 1440, 1100, 980, 768, 480, 390, and 320 px, confirm full, condensed, and mobile navigation states; controls, breadcrumbs, status chips, and tables remain within their local surfaces without page-level overflow or overlap.
21. Open `Core exchange` from the navigation, choose the latest Core-exported `bundle.json` (or the published enterprise sample bundle), and confirm the import plan shows record counts per collection, the `OFFICIAL: Sensitive` classification chip, and pass-through collections kept for round-trip. Apply the plan and confirm the source status shows the bundle identity and load time.
22. Confirm imported records render across the review surfaces: Requirements (with compliance states), Risks in the risk register with severity bands, Actions, and Directions. Use the top-bar search to open a specific Requirement.
23. Open `Map` and confirm the relationship map renders Direction → Requirement → Risk → Action chains from the imported bundle, the inspector reveals a selected node's value chain, board mode lists items in columns by kind, and a `?focus=` deep link opens with the node focused.
    23a. Open `Assurance City`. Confirm Day and Night are visually distinct and the chosen mode survives refresh; buildings use conventional forms with steady critical glows; grass reaches the fog horizon without a visible edge; the city grid remains local; and all local roads, arterials, and freeways sit on the ground with no trees, bridges, tunnels, piers, or portals. Focus an extreme Risk from the selector and confirm the inspector names its critical reason, congestion, road classes, and through-route state. At a 390 px viewport, confirm controls, inspector, entity key, and road legend remain within the scene and do not overlap. Trigger or simulate WebGL context loss in browser developer tools and confirm the current 2D Map link appears without data loss.
24. On a Requirement view, set a compliance state, save a note, and add an evidence reference. Switch between CISO, Auditor, and Solo IT and confirm wording/order changes while the Requirement text, status controls, relationships, work log, links, and commands remain available and unchanged. Reload and confirm the selected lens plus the state, note, and evidence persist as browser-local data. Check the coverage and analytics views reflect the change.
25. Create a local Risk and a local Action, log work on a Requirement, create a tag, and build a saved view from a filter. Reload and confirm all persist browser-locally.
26. Open `Posture`, set the global posture and one per-domain override, then click `Copy posture brief` and confirm the copied Markdown starts with `OFFICIAL: Sensitive`, includes the `PSPF Posture Brief` heading and record counts, and reads cleanly when pasted into a scratch note.
27. Back in `Core exchange`, click `Download Core bundle` and confirm the export downloads as a manifest-led master bundle. Import it into a scratch Core workspace with full-replace and confirm validation passes and the Explorer-authored Risk and compliance changes are visible in Workshop.
28. Use `Share` to export a share package and merge it back, and use backup/restore to download a JSON backup and restore it; confirm restore replaces browser-local stores and malformed JSON is rejected with a clear message.
29. Load a tampered bundle (edit any collection record after export) and confirm the Core exchange blocks it with a checksum-mismatch message asking for a re-export from PSPF Core.
30. Run `PSPF: Open Risk Source Panel`, configure the 6clicks risk source in explicit `Fixture` mode, confirm no credential prompt appears, run `Test Connection`, and confirm the panel reports valid fixture records plus rejected fixture rows without exposing a credential or tenant URL.
31. Run `Run Preview` from the Risk Source panel and confirm the preview classifies fixture risks into new/changed/unchanged/ambiguous/error counts with field-level differences where applicable. Confirm rejected fixture rows remain visible as `error` decisions rather than failing the whole preview.
32. Run `Apply Selected`, confirm the multi-select list contains only new/changed rows, choose a subset, and continue. For changed records, confirm the dialog preserves local PSPF-owned fields unless `Apply source values` is explicitly selected. Confirm created or updated risks show Risk Source metadata in the Risk editor and a redacted run log exists under `.pspf/logs/risk-source-runs/`.
33. Reconfigure the 6clicks risk source in explicit `Live 6clicks` mode using an invalid non-HTTPS URL and confirm validation blocks the profile. Cancel before entering real credentials unless this is an approved tenant validation run.
34. Open Pub from the Activity Bar or run `PSPF: Open Pub`. Confirm `PSPF Pub v1.52.0`, local-only wording, canonical Pub accent, and `Workforce planning` are visible. Load Pub sample data and open Workforce Planning. Keyboard through Overview, Obligations, Capability, Continuity, and Mobility & career; confirm arrow keys move tabs and visible focus remains clear. In Overview, confirm the Attention queue routes to the relevant local workflow. In Obligations, confirm missing records remain visible in the eligible population. In Capability, confirm each row shows People, Meeting target, Below target, and Not assessed without a score. In Continuity, confirm active roles without plans remain visible and readiness uses counts. In Mobility & career, confirm pathway wording says it is not a recommendation, fit assessment, or promotion decision. Apply Team and AI fluency filters, reopen the panel, and confirm they were not persisted. Copy and export the safe summary; confirm `OFFICIAL: Sensitive`, product version, and the aggregation caveat are present, person-derived counts from 1 to 4 appear as `<5`, and no names, IDs, evidence, rationale, notes, objectives, filtered detail, or reconstructable small count appears. Confirm no CSV or person export command exists. Then run the v1.45/v1.46 organisation, rapid-entry, learning, skill, succession, and rotation regression checks. Confirm `.pspf/pub/pub.json` remains at `pubStoreVersion` `1.3.0`.
35. In GitHub Actions, open or run a Marketplace release dry run from `main` with `target=all` and `dry_run=true`. Confirm the run name includes `target=all / dry_run=true`, the dispatch summary says publication is skipped, Core, Workshop, Shop, and Pub publish jobs show dry-run summaries, and `Publish to VS Code Marketplace`, `Verify Marketplace version`, `Tag and GitHub release`, and `Verify receipt tag` are skipped.
36. Confirm the dry run created no `core/1.52.0`, `workshop/1.52.0`, `shop/1.52.0`, `pub/1.52.0`, or `assurance/1.52.0` remote receipt tags. Do not approve or run a non-dry-run Marketplace publish as part of this manual validation unless this is the actual release publication window.
37. From Workshop Home, click `Digital CISO Magazine` and confirm the issue opens from a button and copies email-ready Markdown. Click `CISO Master Plan` and confirm a separate active planning panel opens with direction, streams, phases, inputs/dependencies, and buttons back to Plan of Action, Master Dashboard, Digital CISO Magazine, and copy plan. Then run `npx pnpm@10.10.0 run check:ciso-magazine` from the repository root and open `.tmp/ciso-magazine/digital-ciso-magazine.html`. Confirm the issue has a cover hook, editor's note, current posture snapshot, feature story, attention-required section, action strip, commercial watch, CISO Master Plan article, reader actions, next issue, source metadata, and `OFFICIAL: Sensitive` label. Open `.tmp/ciso-magazine/ciso-master-plan.md` and `.tmp/ciso-magazine/digital-ciso-magazine-info.md` and confirm they are readable as planning/email-copy extracts.
38. Finish by running `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.

## Expected Manual Signals

- Workshop feels like the system-of-record decision surface: load, validate, inspect, snapshot, export, import review, apply, and undo are discoverable from Workshop/Home commands.
- Connected View feels compact and purposeful: cards do not become verbose, hover/focus details appear where the user is looking, selected chains are clear, related Requirements are visible without new links, and refresh is easy to find.
- Requirements navigation feels quick and natural: Assessment Dashboard action rows open the right Requirement, domain tabs, the Directions lens, search, status, and tag filters compose predictably, and filtered-count cues make reduced result sets obvious.
- Trend indicators are fast to scan and accessible: arrows, labels, and red/amber/green/neutral treatment all communicate the same state.
- Relationship creation feels consequential: action previews explain why a link matters, completion receipts summarise the payoff, and Connected View can reveal the selected chain immediately after linking.
- Tags feel like a normal workspace feature: creation, application, removal, archive visibility, and filtering are discoverable from Workshop and visible in Requirement Detail.
- Evidence, Actions, and Risks can each be created once and linked to multiple Requirements across domains without duplicating the record.
- Explorer feels like the friendly, engaging web review surface: the home domains orient quickly, the version marker and AU-English copy are visible, the Core exchange explains what a bundle load will do before it happens, and browser-local trust markers are clear.
- The relationship map makes Direction → Requirement → Risk → Action chains legible in both graph and board modes, and deep links open focused.
- Assurance City makes the same chain legible as a grounded city: road hierarchy, congestion, critical conditions, and missing through-routes remain understandable in both geometry and text.
- Saved views feel durable and scoped: Workshop Requirement views and Explorer saved views can be named, applied after clearing, and survive refresh where browser-local, without exposing personal data.
- Planning views feel like lightweight lenses over assurance work: Workshop Dashboard/Evidence Review views and the Explorer analytics and coverage views reuse existing records without pretending to be a full project-management tool.
- Marketplace dry runs are visibly package-only: a green dry run cannot be mistaken for a published Core, Workshop, or Shop extension.
- The Core exchange protects the operator: checksum mismatches block a tampered bundle with a plain-language remediation message, and the import plan shows what will change before anything is written.
- Browser-local authoring does not feel stuck: compliance states, evidence references, risks, actions, work log entries, tags, and saved views persist across refresh and are visibly local.
- The Explorer-to-Core round trip is understandable: `Download Core bundle` produces a master bundle that Core imports with validation passing and Explorer-authored records visible in Workshop.
- Copied posture briefs from Workshop and Explorer are readable enough for email or Teams.

## Automated Baseline

The following automated gates now cover the detailed checks that used to be manual: schema/hash validation, exact sample counts, redaction/default-deny, personal-data exclusion, Explorer publication rendering and posture-brief copy, Explorer local-authoring persistence (compliance, risks, actions, work log, tags, saved views, share, backup/restore), the Explorer-to-Core bundle export round trip, writer lock, and accessibility.

For a quick spine check, run:

```sh
npx pnpm@10.10.0 run e2e:v1.50
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

- A readiness report at `.tmp/release-readiness/v1.61.3-readiness-report.md`.
- A v1.50 extension visual report at `.tmp/accessibility/v1.50-extension-visual-report.json`.
- An Explorer local-authoring smoke report at `.tmp/explorer-local-authoring/explorer-local-authoring-report.json`.
- An Explorer-to-Workshop import smoke report at `.tmp/explorer-to-workshop-import/explorer-to-workshop-import-report.json`.
- PASS for all automated readiness gates.
- PASS for the Explorer publication smoke, posture brief redaction, cyber reference data, and Digital CISO Magazine gates.
- Manual operator validation should focus on the unified Explorer web surface (Core exchange round trip, relationship map, browser-local authoring, posture brief), the v1.43 Strategy priority inference, Assurance Activity Bar and Assessment Workbench, Workshop UX/IA refinement, Pub Organisation Chart card backs, local team news/date authoring, optional Plan of Action team-date context, cyber reference dataset diagnostics, clean-start reset recovery, reciprocal ISM mapping open/edit actions, ISM Review Workbench queues, ISM control saved views, implementation-status navigation, direct control work links, the 6clicks Risk Source panel, Pub local detail/edit coverage, Marketplace dry-run support, and earlier regression surfaces.

## Pass Criteria

- The manual operator flow completes without intervention.
- Workshop clearly presents the decision surface and Explorer clearly presents the portable review surface.
- Explorer browser-local authoring survives refresh and the Core bundle export round trip succeeds.
- Tags survive snapshot/export/import, `Tag.description` stays out of copied briefs and published indexes, Explorer saved views survive refresh, and tag/saved-view filters are understandable without reading docs.
- Workshop import review, plan-review-apply, and undo are clear enough to use without reading implementation docs.
- `validate:debug-workspace` and `release:readiness` pass when run for the same build.

## Feedback Capture

Record:

- Any prompt wording that caused hesitation.
- Any command order that felt surprising.
- Any Explorer identity, Core exchange, or import-plan label that felt unclear.
- Any tag label, picker, chip, saved-view, or filter behaviour that felt unclear.
- Any planning lens row, label, or scope that felt too heavy or too thin for a 12-month cyber plan discussion.
- Any Shop coverage dashboard row, cost-centre export, quick action, or empty state that did not help triage commercial assurance coverage.
- Any Connected View zoom, lane visibility, hover, selection, selected-chain scroll, related-Requirement highlight, refresh, or compact-card behaviour that felt unclear.
- Any Marketplace release wording that still made a dry run look like a real publication.
- Any concern about the Core exchange round trip, checksum messaging, or backup/restore behaviour.
- Any mismatch between Workshop, Explorer, and the operator's expectation.
- The next action needed before another validation session.
