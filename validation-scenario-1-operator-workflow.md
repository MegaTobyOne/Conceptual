# Validation Scenario 1: v1.7.0 Tags and Filters Testing Workflow

## Purpose

Validate that a PSPF/security operator can complete the current initial assurance workflow without developer assistance: open Workshop, load the sample assurance scenario, create and apply tags, export to Explorer, filter by tag, review Explorer Local Changes, and confirm Explorer-to-Workshop import/undo behaviour.

## Persona

PSPF/security operator preparing an internal assurance view for early governance review.

## Scope

Manual focus:

- Workshop launch, Activity Bar access, status bar version context, and sample workspace loading.
- Workshop dashboard orientation: Directions, Action Impact, evidence queue, and version context.
- Workshop Tag Manager, Requirement Detail tag rail, and Requirement tag filtering.
- Explorer visual identity, publication load, full-width Explorer Search, Local Changes, refresh restore, and local JSON export.
- Explorer Requirements and Relationships Board tag filtering with `any` / `all` mode and URL/session state.
- Workshop import review, Core/Workshop plan-review-apply import, and undo for Explorer local JSON.

Automated coverage handles detailed counts, redaction/default-deny, schema validation, accessibility, writer lock, backup/restore, personal-data exclusion, and import/export round trips. Do not repeat those manually unless a visible behaviour looks wrong.

Still out of scope for v1.7.0:

- Shop, Pub, editable posture, chart image export, numeric performance benchmarking, saved views, per-user/private tags, tag hierarchies, tagging Actions/Risks/Directions/Evidence, compliance-history export controls, and third-party accessibility audit.

## Test Data

- Use `PSPF: Load Sample Workspace` for the primary run.
- Use one existing sample Requirement for Explorer Local Changes; avoid creating extra Workshop records unless specifically testing authoring.
- For Explorer Local Changes, use short obvious values such as `Explorer validation evidence`, `Explorer validation action`, and `Explorer validation risk`.

## Manual Operator Steps

Optional clean run: close the Extension Host and run `npx pnpm@10.10.0 run debug:reset` from the repository root before relaunching.

1. Launch `Run PSPF Core + Workshop`.
2. Open the PSPF Workshop Activity Bar item and confirm `Workshop Home` appears with `PSPF v1.7.0`, `Schema 1.4.0`, and `API 1.4.0`.
3. Confirm the VS Code status bar shows `PSPF v1.7.0` and its tooltip includes `Schema 1.4.0`, `Bundle 1.4.0`, and `API 1.4.0`.
4. From `Workshop Home`, click `Load sample`.
5. Click `Open dashboard` and do a quick visual check: workspace ready state, Direction chips, `Action Impact — Top 5`, latest activity, and no obvious cramped columns or wrapping regressions.
6. Click `Review evidence` and confirm the queue opens with missing/freshness/unlinked evidence groups and `Urgent Actions (Blocked or Overdue)`.
7. Open one Requirement item detail, click `Apply tag`, create a `Security uplift` tag if needed, and confirm the tag appears in the `Tags` rail. Run `PSPF: Manage Tags` and confirm the Tag Manager shows the tag, colour, status, and Requirement count.
8. Run `PSPF: Filter Requirements by Tag`, select `Security uplift`, choose `Any selected tag`, and confirm the matching Requirement opens cleanly.
9. From `Workshop Home`, click `Validate`, `Integrity scan` (`PSPF: Run Integrity Scan`), `Snapshot`, `Copy brief`, and `Export` in that order. Confirm each completes and the copied brief is readable when pasted into a scratch note.
10. Open `packages/explorer/dist/index.html`, select the latest debug `bundle.json` from `Bundle Tools` if a remembered bundle does not restore, and confirm the portable assurance masthead, `OFFICIAL: Sensitive · TLP:AMBER+STRICT` banner, and `Bundle baseline` / `Local changes` / `Export to Workshop` mode strip are visible.
11. On the Requirements section, select the `Security uplift` tag filter and confirm the URL includes `tags=` and `tagsMode=any`. Switch to `All selected tags`, reload the page, and confirm the tag filter is restored from the URL/session state. Check the Relationships Board uses the same tag filter.
12. Use the full-width `Explorer Search` under the posture brief to find one Requirement, confirm the same search narrows the `Local Changes` list, select that Requirement, and confirm `Linked Context` shows existing linked Evidence, Actions, Risks, and tagged context plus Open buttons to the full sections. Change its status, add one evidence reference, one Action, and one Risk, then refresh the browser. Confirm the latest bundle restores automatically and the local changes are still visible as `local`.
13. Click `Export local JSON`, then import that Explorer local JSON from Workshop with `Plan, review, apply`. Confirm `PSPF Workshop Import Review` opens as a read-only surface with created, updated, unchanged, write, per-type, and update-example detail before `Apply Import`; apply it, then use `Undo Import` and confirm the undo notification is clear.
14. Finish by running `npx pnpm@10.10.0 run validate:debug-workspace` from the repository root.

## Expected Manual Signals

- Workshop feels like the system-of-record decision surface: load, validate, inspect, snapshot, export, import review, apply, and undo are discoverable from Workshop/Home commands.
- Tags feel like a normal workspace feature: creation, application, removal, archive visibility, and filtering are discoverable from Workshop and visible in Requirement Detail.
- Explorer feels like the portable review surface: warmer masthead, sensitivity banner, source/version chips, full-width Explorer Search, Local Changes, and browser-local trust markers are immediately visible.
- Explorer tag filters narrow Requirements and Relationships predictably, compose with Search, and persist only through URL/session state.
- Bundle validation and bundle file loading are available as lower-priority diagnostics, not prominent day-to-day review sections.
- Local Changes does not feel stuck: Explorer Search narrows the list, selecting an item updates the workspace, linked context is visible with Open buttons to full sections, refresh restores the latest bundle, and local values remain labelled `local`.
- The Explorer-to-Workshop import path is understandable: `Plan, review, apply` opens `PSPF Workshop Import Review`, shows what will change before writing, `Apply Import` is explicit, summary details are available, and `Undo Import` is easy to find.
- Copied posture briefs from Workshop and Explorer are readable enough for email or Teams.

## Automated Baseline

The following automated gates now cover the detailed checks that used to be manual: schema/hash validation, exact sample counts, redaction/default-deny, personal-data exclusion, Explorer section navigation, Explorer Search, table readability, Local Changes persistence, refresh restore, local evidence/Action/Risk materialisation, Explorer-to-Workshop import, import-review source guards, undo planning coverage, writer lock, backup/restore, and accessibility.

For a quick spine check, run:

```sh
npx pnpm@10.10.0 run e2e:v1.7
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

- A readiness report at `.tmp/release-readiness/v1.7.0-readiness-report.md`.
- An Explorer Local Changes smoke report at `.tmp/explorer-local-authoring/explorer-local-authoring-report.json`.
- An Explorer-to-Workshop import smoke report at `.tmp/explorer-to-workshop-import/explorer-to-workshop-import-report.json`.
- PASS for all automated readiness gates.
- PASS for the Explorer publication smoke and posture brief redaction gates.
- Manual operator validation should focus on the v1.7.0 tag creation/application/filtering flow, Explorer tag filter URL/session behaviour, Workshop/Explorer visual identity separation, Workshop import review, plan-apply review, and undo clarity.

## Pass Criteria

- The 14-step manual operator flow completes without intervention.
- Workshop clearly presents the decision surface and Explorer clearly presents the portable review surface.
- Explorer Local Changes survives refresh and exports successfully.
- Tags survive snapshot/export/import, `Tag.description` stays out of copied briefs and published indexes, and tag filters are understandable without reading docs.
- Workshop import review, plan-review-apply, and undo are clear enough to use without reading implementation docs.
- `validate:debug-workspace` and `release:readiness` pass when run for the same build.

## Feedback Capture

Record:

- Any prompt wording that caused hesitation.
- Any command order that felt surprising.
- Any Explorer identity, Local Changes, or import-review label that felt unclear.
- Any tag label, picker, chip, or filter behaviour that felt unclear.
- Any mismatch between Workshop, Explorer, and the operator's expectation.
- The next action needed before another validation session.