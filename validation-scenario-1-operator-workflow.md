# Validation Scenario 1: v1.12.0 Planning Lens Testing Workflow

## Purpose

Validate that a PSPF/security operator can complete the current initial assurance workflow without developer assistance: open Workshop, load the sample assurance scenario, record a significant change, create and apply tags, create Workshop saved views including planning scopes, export to Explorer, review Explorer "Why This Changed" and Plan Lens, filter Requirements and Relationships by tag/status/search, save and apply Explorer saved views, review Explorer Local Changes, and confirm Explorer-to-Workshop import/undo behaviour.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

Manual focus:

- Workshop launch, Activity Bar access, status bar version context, and sample workspace loading.
- Workshop dashboard orientation: Directions, Action Impact, evidence queue, and version context.
- Workshop Change Records list, significant-change authoring, and Change Record edit surface.
- Workshop Tag Manager, Requirement Detail tag rail, and Requirement tag filtering.
- Explorer visual identity, publication load, "Why This Changed", full-width Explorer Search, Local Changes, refresh restore, and local JSON export.
- Explorer Requirements and Relationships Board tag filtering with `any` / `all` mode and URL/session state.
- Explorer Requirements and Relationships saved views, including save, apply, rename/archive visibility, refresh persistence, and local-authoring export/import.
- Workshop Saved Views manager and Workshop-owned Requirement, Dashboard, and Evidence Review views.
- Explorer Plan Lens over open Actions, open Risks, active/proposed Change Records, and Directions needing attention.
- Explorer schema-change guidance when a remembered browser bundle is no longer compatible with the current build.
- Workshop import review, Core/Workshop plan-review-apply import, and undo for Explorer local JSON.

Automated coverage handles detailed counts, redaction/default-deny, schema validation, accessibility, writer lock, backup/restore, personal-data exclusion, and import/export round trips. Do not repeat those manually unless a visible behaviour looks wrong.

Still out of scope for v1.12.0:

- Shop, Pub, editable posture, chart image export, numeric performance benchmarking, private/team saved views, default-start views, per-user/private tags, tag hierarchies, Explorer-authored Change Records, change-record diff views, change-record tagging, plan baselines, milestone/resource/budget entities, compliance-history export controls, a separate PSPF Plan product, and third-party accessibility audit.

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

If `dig` returns no address or `curl` reports `Could not resolve host`, create or repair the `test.tobyharvey.online` subdomain/DNS record in VentraIP before rerunning the workflow. The expected test document root is `/home/tobyharv/public_html/test` and the expected test app directory is `/home/tobyharv/apps/pspf-web-test`.

1. Launch `Run PSPF Core + Workshop`.
2. Open the PSPF Workshop Activity Bar item and confirm `Workshop Home` appears with `PSPF v1.12.0`, `Schema 1.7.0`, and `API 1.7.0`.
3. Confirm the VS Code status bar shows `PSPF v1.12.0` and its tooltip includes `Schema 1.7.0`, `Bundle 1.7.0`, and `API 1.7.0`.
4. From `Workshop Home`, click `Load sample`.
5. Click `Open dashboard` and do a quick visual check: workspace ready state, Direction chips, `Action Impact — Top 5`, latest activity, and no obvious cramped columns or wrapping regressions.
6. Click `Review evidence` and confirm the queue opens with missing/freshness/unlinked evidence groups and `Urgent Actions (Blocked or Overdue)`.
7. Open one Requirement item detail, click `Record significant change`, create a Change Record with a short public summary and optional sensitive reason/impact notes, then run `PSPF: Open Change Records` and confirm the row shows status, type, persistence, source, raised date, affected Requirement, and summary.
8. Open the Change Record row, edit the public summary or status, save, reopen `PSPF: Open Change Records`, and confirm the update is visible.
9. Open one Requirement item detail, click `Apply tag`, create a `Security uplift` tag if needed, and confirm the tag appears in the `Tags` rail. Run `PSPF: Manage Tags` and confirm the Tag Manager shows the tag, colour, status, and Requirement count.
10. Run `PSPF: Add Evidence`, create `Approved Authentication policy`, choose `Browse by domain`, select Governance, Security Risk, and Technology, then select at least two Governance, one Security Risk, and two Technology Requirements. Confirm the completion message summarises the affected domains and one Evidence record is linked to multiple Requirements.
11. Run `PSPF: Create Action`, create one cross-cutting action, choose `Browse by assessment status`, select at least one non-final status, then select two or more Requirements. Confirm one Action record is linked to multiple Requirements.
12. Run `PSPF: Create Risk`, create one cross-cutting risk, choose `All Requirements` or `Browse by domain`, then select two or more Requirements. Confirm one Risk record is linked to multiple Requirements.
13. Run `PSPF: Filter Requirements by Tag`, select `Security uplift`, choose `Any selected tag`, and confirm the matching Requirement opens cleanly. Then run `PSPF: Manage Saved Views`, create a Workshop Requirements view using `Security uplift` or a short search term, and confirm the Saved Views panel refreshes immediately with the new row. Apply it and confirm the filtered Requirements list opens with the expected rows.
14. In `PSPF: Manage Saved Views`, create a Dashboard view and an Evidence Review view using the same filter. Apply the Dashboard view and confirm it opens a planning slice with filtered Requirements, open Actions, open Risks, and recent Change Records. Apply the Evidence Review view and confirm it opens missing-evidence and evidence-needing-review lists for the filtered Requirements.
15. From `Workshop Home`, click `Validate`, `Integrity scan` (`PSPF: Run Integrity Scan`), `Snapshot`, `Copy brief`, and `Export` in that order. Confirm each completes and the copied brief is readable when pasted into a scratch note.
16. Open `packages/explorer/dist/index.html`, select the latest debug `bundle.json` from `Bundle Tools` if a remembered bundle does not restore, and confirm the portable assurance masthead, `OFFICIAL: Sensitive · TLP:AMBER+STRICT` banner, and `Bundle baseline` / `Local changes` / `Export to Workshop` mode strip are visible.
17. Open `Why This Changed` and confirm the Change Record appears with affected Requirement context, public summary, and no sensitive reason, impact summary, or decision-owner reference.
18. Open `Plan Lens` and confirm it shows open Actions, open Risks, active/proposed Change Records, and Directions needing attention without introducing editable plan-baseline, milestone, resource, or budget fields.
19. On the Requirements section, select the `Security uplift` tag filter and confirm the URL includes `tags=` and `tagsMode=any`. Switch to `All selected tags`, reload the page, and confirm the tag filter is restored from the URL/session state. Check the Relationships Board uses the same tag filter.
20. In Requirements, combine `Explorer Search`, a Requirement status filter, and the `Security uplift` tag filter. Save the current Requirements view as `Security uplift focus`, clear the filters, apply the saved view, and confirm the search/status/tag controls and visible rows return without reopening Explorer. Rename the view, archive it, and confirm each change redraws the controls immediately.
21. In Relationships, keep the `Security uplift` tag filter active, save the current Relationship view as `Security relationships`, clear tags, apply the saved view, and confirm the Relationships Board reopens with the tag filter restored.
22. If the deployed Explorer has just moved schema version, refresh it before selecting a bundle and confirm it shows `Reload your PSPF JSON` rather than an empty review surface. Select the latest bundle and confirm normal rendering resumes.
23. Use the full-width `Explorer Search` under the posture brief to find one Requirement, confirm the same search narrows the `Local Changes` list, select that Requirement, and confirm `Linked Context` shows existing linked Evidence, Actions, Risks, and tagged context plus Open buttons to the full sections. Change its status, add one evidence reference, one Action, and one Risk, then refresh the browser. Confirm the latest bundle restores automatically and the local changes and saved views are still visible as `local` / saved local state.
24. Click `Export local JSON`, confirm the exported bundle includes `collections.saved-views`, then import that Explorer local JSON from Workshop with `Plan, review, apply`. Confirm `PSPF Workshop Import Review` opens as a read-only surface with created, updated, unchanged, write, per-type, and update-example detail before `Apply Import`; apply it, then use `Undo Import` and confirm the undo notification is clear.
25. Finish by running `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.

## Expected Manual Signals

- Workshop feels like the system-of-record decision surface: load, validate, inspect, snapshot, export, import review, apply, and undo are discoverable from Workshop/Home commands.
- Tags feel like a normal workspace feature: creation, application, removal, archive visibility, and filtering are discoverable from Workshop and visible in Requirement Detail.
- Evidence, Actions, and Risks can each be created once and linked to multiple Requirements across domains without duplicating the record.
- Explorer feels like the portable review surface: warmer masthead, sensitivity banner, source/version chips, full-width Explorer Search, Local Changes, and browser-local trust markers are immediately visible.
- Explorer tag filters narrow Requirements and Relationships predictably, compose with Search, and persist only through URL/session state.
- Saved views feel durable and scoped: Workshop Requirement views, Explorer Requirements views, and Explorer Relationship views can be named, applied after clearing, survive refresh where browser-local, export as `saved-view`, and import into Core without exposing personal data.
- Planning views feel like lightweight lenses over assurance work: Workshop Dashboard/Evidence Review views and Explorer Plan Lens reuse existing records without pretending to be a full project-management tool.
- Explorer explains schema-change refreshes: stale remembered JSON asks the user to reload their PSPF JSON instead of leaving the review surface empty.
- Bundle validation and bundle file loading are available as lower-priority diagnostics, not prominent day-to-day review sections.
- Local Changes does not feel stuck: Explorer Search narrows the list, selecting an item updates the workspace, linked context is visible with Open buttons to full sections, refresh restores the latest bundle, and local values remain labelled `local`.
- The Explorer-to-Workshop import path is understandable: `Plan, review, apply` opens `PSPF Workshop Import Review`, shows what will change before writing, `Apply Import` is explicit, summary details are available, and `Undo Import` is easy to find.
- Copied posture briefs from Workshop and Explorer are readable enough for email or Teams.

## Automated Baseline

The following automated gates now cover the detailed checks that used to be manual: schema/hash validation, exact sample counts, redaction/default-deny, personal-data exclusion, Explorer section navigation, Explorer Search, table readability, Local Changes persistence, refresh restore, local evidence/Action/Risk materialisation, Explorer-to-Workshop import, import-review source guards, undo planning coverage, writer lock, backup/restore, and accessibility.

For a quick spine check, run:

```sh
npx pnpm@10.10.0 run e2e:v1.12
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

- A readiness report at `.tmp/release-readiness/v1.12.0-readiness-report.md`.
- An Explorer Local Changes smoke report at `.tmp/explorer-local-authoring/explorer-local-authoring-report.json`.
- An Explorer-to-Workshop import smoke report at `.tmp/explorer-to-workshop-import/explorer-to-workshop-import-report.json`.
- PASS for all automated readiness gates.
- PASS for the Explorer publication smoke and posture brief redaction gates.
- Manual operator validation should focus on the v1.12.0 planning lens, Workshop Dashboard/Evidence Review saved views, Change Record flow, tag creation/application/filtering, Explorer tag filter URL/session behaviour, Workshop/Explorer visual identity separation, Workshop import review, plan-apply review, schema-change reload guidance, and undo clarity.

## Pass Criteria

- The 25-step manual operator flow completes without intervention.
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
- Any mismatch between Workshop, Explorer, and the operator's expectation.
- The next action needed before another validation session.