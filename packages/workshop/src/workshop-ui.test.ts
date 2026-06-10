import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatShortAuDateTime, normaliseShortAuDateTime, shortWorkshopPanelTitle } from "./workshop-ui.js";

test("requirement editor tabs use the requirement number instead of the full title", () => {
  const title = shortWorkshopPanelTitle({
    entityType: "requirement",
    id: "REQ-00000000-0000-4000-8000-000000000801",
    title: "17 Validate governance reporting workflow"
  });

  assert.equal(title, "Requirement 17");
});

test("other edit tabs use compact type and id labels", () => {
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "action",
      id: "ACT-00000000-0000-4000-8000-000000000801",
      title: "Confirm next governance review date"
    }),
    "Action ACT-0801"
  );
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "evidence",
      id: "EVD-00000000-0000-4000-8000-000000000802",
      title: "A very long evidence title"
    }),
    "Evidence EVD-0802"
  );
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "direction",
      id: "DIR-00000000-0000-4000-8000-000000000803",
      title: "Long direction title",
      reference: "HA-DIR-2026-01"
    }),
    "Direction HA-DIR-2026-01"
  );
});

test("due dates render as short AU dates without raw ISO noise", () => {
  assert.equal(formatShortAuDateTime("2026-06-30T00:00:00.000Z"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("30/06/2026"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("30 Jun 2026"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("today", new Date(2026, 4, 19, 15, 45)), "19 May 2026");
});

test("requirement browser exposes domain tabs, Directions lens, and clearable filter count", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /class="requirement-page__tabs"/);
  assert.match(source, /data-requirement-tab="directions"/);
  assert.match(source, /data-requirement-content="directions"/);
  assert.match(source, /data-clear-requirement-filters/);
  assert.match(source, /directionTargetRequirementIds/);
});

test("requirement browser list shows a compact natural-language title preview", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");

  assert.match(source, /function requirementBrowserTitlePreview/);
  assert.match(source, /class="requirement-browser__title-preview"/);
  assert.match(source, /replace\(\/\^\\s\*PSPF/);
  assert.match(shellSource, /\.requirement-browser__title-preview/);
  assert.match(shellSource, /-webkit-line-clamp: 2/);
});

test("Workshop Strategy trends render labelled pills without arrows", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function trendIndicator\(value: string\)/);
  assert.match(source, /trend: trendIndicator\(choice\.trend\)/);
  assert.match(source, /trendIndicator\(measure\.trend\)/);
  assert.match(source, /class="trend-indicator"/);
  const trendMatch = source.match(/function trendIndicator\(value: string\): string \{[\s\S]*?\n}/);
  assert.ok(trendMatch, "trend indicator helper should be present");
  assert.doesNotMatch(trendMatch[0], /&uarr;|&rarr;|&darr;|&ndash;/);
});

test("Essential Eight dashboard renders visual posture charts", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function renderEssentialEightComplianceDonut/);
  assert.match(source, /function renderEssentialEightEvidenceChart/);
  assert.match(source, /function renderEssentialEightStrategyChart/);
  assert.match(source, /class="e8-donut"/);
  assert.match(source, /Compliance Status/);
  assert.match(source, /Evidence Coverage/);
  assert.match(source, /Strategy Readiness/);
  assert.match(source, /recordTable\("E8 Strategy Tracker",[\s\S]*"e8-strategy-tracker"\)/);
  assert.match(source, /\.e8-strategy-tracker th\[data-field="strategy"\]/);
  const e8StylesMatch = source.match(
    /function essentialEightVisualStyles\(\): string \{[\s\S]*?function renderEssentialEightComplianceDonut/
  );
  assert.ok(e8StylesMatch, "Essential Eight scoped styles should be present");
  assert.match(e8StylesMatch[0], /\.e8-strategy-tracker table \{ min-width: 92rem; table-layout: fixed; \}/);
  assert.match(e8StylesMatch[0], /data-field="strategy"[\s\S]*width: 22rem/);
  assert.match(e8StylesMatch[0], /data-field="status"[\s\S]*width: 8rem/);
  assert.match(e8StylesMatch[0], /data-field="nextStep"[\s\S]*width: 17rem/);
  assert.match(e8StylesMatch[0], /\.e8-strategy-tracker th\[data-field="target"\][\s\S]*white-space: nowrap/);
  assert.doesNotMatch(e8StylesMatch[0], /width:\s*1%/);
  assert.match(source, /readonly statusCounts/);
  assert.match(source, /readonly strategyStatusCounts/);
});

test("Penetration Testing Workbench exposes planning and execution pipeline", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const modelSource = await readFile(new URL("../src/pentest-workbench.ts", import.meta.url), "utf8");

  assert.match(modelSource, /interface PentestEngagementModel/);
  assert.match(modelSource, /criticalHighFindings/);
  assert.match(modelSource, /otherFindings/);
  assert.match(modelSource, /plannedWindow/);
  assert.match(source, /function renderPentestPipeline/);
  assert.match(source, /Pentest Pipeline/);
  assert.match(source, /function renderMasterDashboardPentestSummary/);
  assert.match(source, /Penetration Testing/);
  assert.match(source, /pspf\.workshop\.openPentestWorkbench/);
  assert.match(source, /function renderPentestEngagementProfile/);
  assert.match(source, /Penetration test planning and execution profile/);
  assert.match(source, /Critical\/high/);
  assert.match(source, /Other findings/);
  assert.match(source, /Open remediation/);
  assert.match(source, /Finding split/);
  assert.match(source, /Report due/);
  assert.match(source, /Retest/);
});

test("Plan of Action exposes master schedule and slice controls", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const planModelSource = await readFile(new URL("../src/plan-of-action-board.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");

  assert.match(source, /function renderPlanOfActionMasterSchedule/);
  assert.match(source, /data-poa-view="master"/);
  assert.match(source, /data-poa-view="integrated"/);
  assert.match(source, /data-poa-view="workstreams"/);
  assert.match(source, /data-poa-workstream-filter/);
  assert.match(source, /data-poa-status-filter/);
  assert.match(source, /data-poa-workstream=/);
  assert.match(source, /<section data-poa-view-section="master">/);
  assert.match(source, /<section data-poa-view-section="integrated" hidden>/);
  assert.match(source, /function renderPlanOfActionMasterTask/);
  assert.match(source, /function renderPlanOfActionIntegratedSchedule/);
  assert.match(source, /class="poa-master-range"/);
  assert.match(source, /class="poa-master-today-marker"/);
  const masterScheduleSource = source.match(
    /function renderPlanOfActionMasterSchedule[\s\S]*?function renderPlanOfActionIntegratedSchedule/
  )?.[0];
  assert.ok(masterScheduleSource, "master schedule renderer should be present");
  assert.match(masterScheduleSource, /class="poa-master-today-marker"/);
  assert.match(masterScheduleSource, /poa-master-grid poa-master-grid--rows/);
  assert.match(masterScheduleSource, /--poa-today-x: \$\{model\.todayX\}px/);
  assert.match(masterScheduleSource, /renderPlanOfActionTask\([\s\S]*false\)/);
  assert.doesNotMatch(masterScheduleSource, /renderPlanOfActionTodayMarker/);
  assert.match(shellSource, /--poa-row-label-width: 220px; --poa-row-gap: 10px/);
  assert.match(
    shellSource,
    /\.poa-master-grid--rows \.poa-master-ruler \{ width: var\(--poa-width\); margin-left: calc\(var\(--poa-row-label-width\) \+ var\(--poa-row-gap\)\); \}/
  );
  assert.match(
    shellSource,
    /\.poa-master-grid--rows \.poa-master-today-marker \{ left: calc\(var\(--poa-row-label-width\) \+ var\(--poa-row-gap\) \+ var\(--poa-today-x\)\); \}/
  );
  const teamDateOverlaySource = source.match(
    /function renderPlanOfActionTeamDateOverlay[\s\S]*?function renderPlanOfActionTeamDateBar/
  )?.[0];
  assert.ok(teamDateOverlaySource);
  assert.doesNotMatch(teamDateOverlaySource, /renderPlanOfActionTodayMarker/);
  assert.match(source, /function packPlanOfActionScheduleLanes/);
  assert.match(source, /class="poa-integrated-lanes"/);
  assert.match(source, /data-poa-integrated-lane/);
  assert.match(source, /poa-bar--integrated/);
  assert.match(source, /every Action keeps its own row/);
  assert.match(source, /lane\.hidden = !Array\.from\(lane\.querySelectorAll\(taskSelector\)\)/);
  assert.match(source, /function renderPlanOfActionMasterRuler/);
  assert.match(source, /function planOfActionDateRulerLabels/);
  assert.match(source, /class="poa-master-ruler"/);
  assert.match(source, /Plan of Action stream/);
  assert.match(source, /planWorkstreamId/);
  assert.match(source, /Infer from impact/);
  assert.match(source, /Manual/);
  assert.match(source, /Inferred/);
  assert.match(source, /data-field="streamSource"/);
  assert.match(source, /function renderPlanOfActionWorklist/);
  assert.match(source, /data-poa-worklist-search/);
  assert.match(source, /data-poa-worklist-sort/);
  assert.match(source, /data-poa-worklist-row/);
  assert.match(source, /async function loadPubTeamPlanDates/);
  assert.match(source, /function renderPlanOfActionTeamDateOverlay/);
  assert.match(source, /class="poa-team-date-bar"/);
  assert.match(source, /Pub Team Date Conflicts/);
  assert.match(planModelSource, /timelineDateHints/);
});

test("Workshop Home is simplified and exposes one status graphic", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const homeMatch = source.match(
    /function renderHomeView\(model: WorkshopHomeModel\): string \{[\s\S]*?async function openWelcome/
  );
  assert.ok(homeMatch, "home renderer should be present");
  const homeSource = homeMatch[0];

  assert.match(homeSource, /renderWorkshopStatusDonut\(model\)/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openMasterDashboard", "Dashboard"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.createRequirement", "Create requirement"/);
  assert.match(homeSource, /<h2>Edit<\/h2>/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openRequirementsList", "Edit requirements"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openEvidenceList", "Edit evidence"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openActionsList", "Edit actions"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openRisksList", "Edit risks"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.openDirectionsList", "Edit directions"/);
  assert.match(homeSource, /homeButton\("pspf\.core\.exportBundle", "Export bundle"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.copyPostureBrief", "Copy brief"/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.home\.refresh", "Refresh"/);
  assert.match(homeSource, /<h2>Integrations<\/h2>/);
  assert.match(homeSource, /homeButton\("pspf\.workshop\.previewRiskSourceImport", "Run integrations"/);
  assert.doesNotMatch(homeSource, /homeButton\("pspf\.workshop\.openRiskSourcePanel", "Risk Source"/);
  assert.doesNotMatch(homeSource, /homeButton\("pspf\.workshop\.configureRiskSource", "Configure source"/);
  assert.doesNotMatch(homeSource, /Continue next task/);
  assert.doesNotMatch(homeSource, /Review evidence/);
  assert.doesNotMatch(homeSource, /Digital CISO Magazine/);
});

test("Home sample opens the Master Dashboard without the welcome prompt", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const sampleMatch = source.match(
    /async function loadSampleWorkspaceVariant\(variant: "enterprise" \| "home"\): Promise<void> \{[\s\S]*?async function createRequirement/
  );
  assert.ok(sampleMatch, "sample workspace loader should be present");
  const sampleSource = sampleMatch[0];

  assert.match(sampleSource, /if \(variant === "home"\) \{\s*await openMasterDashboard\(\);\s*return;\s*\}/);
  assert.match(sampleSource, /vscode\.window\.showInformationMessage/);
});

test("Workshop risk-source setup is contributed through VS Code settings", async () => {
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(manifest, /"configuration": \{/);
  assert.match(manifest, /"pspf\.workshop\.riskSource\.sourceMode"/);
  assert.match(manifest, /"pspf\.workshop\.riskSource\.timeoutMs"/);
  assert.match(manifest, /"command": "pspf\.workshop\.openRiskSourceSettings"/);
  assert.match(manifest, /"command": "pspf\.workshop\.setRiskSourceCredential"/);
  assert.match(source, /const riskSourceSettingsSection = "pspf\.workshop\.riskSource"/);
  assert.match(source, /function readRiskSourceSettingsProfile/);
  assert.match(source, /async function openIntegrationSettingsPanel/);
  assert.match(source, /async function renderIntegrationSettingsPanel/);
  assert.match(source, /<button type="button" data-command="pspf\.workshop\.testRiskSource">Test connection<\/button>/);
  assert.match(source, /recordTable\("Available Commands"/);
  assert.match(source, /async function openDirectionsList/);
  assert.match(source, /workbench\.action\.openSettings/);
});

test("Workshop edit buttons open list pickers before edit panels", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /async function pickEntityForEdit/);
  assert.match(source, /pickEntityForEdit\([\s\S]*"Edit Requirement"/);
  assert.match(source, /pickEntityForEdit\([\s\S]*"Edit Evidence"/);
  assert.match(source, /pickEntityForEdit\([\s\S]*"Edit Action"/);
  assert.match(source, /pickEntityForEdit\([\s\S]*"Edit Risk"/);
  assert.match(source, /pickEntityForEdit\([\s\S]*"Edit Direction"/);
  assert.doesNotMatch(source, /const initialDirection = directions\.at\(0\)/);
});

test("Master Dashboard groups tools into portal sections", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");

  assert.match(source, /function portalGroup/);
  assert.match(source, /class="portal-grid"/);
  assert.match(source, /portalGroup\("Essentials"/);
  assert.match(source, /portalCommand\([\s\S]*"pspf\.workshop\.openEssentialEightDashboard",[\s\S]*"Essential Eight"/);
  assert.match(source, /portalCommand\([\s\S]*"pspf\.workshop\.openRequirementsList",[\s\S]*"Requirements"/);
  assert.match(source, /portalCommand\([\s\S]*"pspf\.workshop\.browseIsmSourceControls",[\s\S]*"Controls pane"/);
  assert.match(source, /portalGroup\("Planning"/);
  assert.match(source, /portalGroup\("Traceability"/);
  assert.match(source, /portalGroup\("Reporting"/);
  const reportingGroupMatch = source.match(/portalGroup\("Reporting",[\s\S]*?\]\)\}/);
  assert.ok(reportingGroupMatch, "Reporting portal group should be present");
  assert.match(
    reportingGroupMatch[0],
    /portalCommand\([\s\S]*"pspf\.workshop\.openCisoMagazine",[\s\S]*"CISO Newsletter"/
  );
  assert.doesNotMatch(reportingGroupMatch[0], /copyCisoMasterPlan|Copy CISO Master Plan/);
  assert.match(shellSource, /\.portal-group \{ display: grid; grid-template-rows:/);
  assert.match(shellSource, /\.portal-actions \{ display: grid; grid-template-rows: repeat\(3,/);
  assert.match(source, /function renderDecisionLoopCards/);
  assert.match(source, /class="decision-loop-grid"/);
  assert.match(source, /"pspf\.workshop\.openHumanCentredRiskView"/);
  assert.match(source, /function renderStrategyPerformanceCards/);
  assert.match(source, /class="strategy-performance-grid"/);
});

test("Strategy Map uses clearer framing, aligned choices, and grouped measures", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /class="strategy-map-frame"/);
  assert.match(source, /class="strategy-map-statement"/);
  assert.match(source, /class="strategy-risk-posture"/);
  assert.match(source, /class="strategy-choice-grid"/);
  assert.match(source, /class="strategy-choice-card__top"/);
  assert.match(source, /function renderMeasuresGroupedByChoice/);
  assert.match(source, /Posture Measures By Choice/);
  assert.match(source, /class="measure-choice-group"/);
});

test("Human-Centred Risk View renders an impact likelihood matrix", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function renderHumanCentredRiskMatrix/);
  assert.match(source, /Impact v Likelihood Matrix/);
  assert.match(source, /class="cc-risk-matrix"/);
  assert.match(source, /data-band="green"/);
  assert.match(source, /data-band="amber"/);
  assert.match(source, /data-band="red"/);
});

test("ISM controls expose principle groups and safe display names", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /class="ism-category-overview"/);
  assert.match(source, /data-ism-category-shortcut/);
  assert.match(source, /function ismSourceControlName/);
  assert.match(source, /Unnamed ISM control/);
});

test("Workshop tree title menus link summaries to browse panels", async () => {
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(
    manifest,
    /"command": "pspf\.workshop\.openPspfGridView"[\s\S]*"view == pspfWorkshop\.requirementsView"/
  );
  assert.match(
    manifest,
    /"command": "pspf\.workshop\.openEvidenceReviewQueue"[\s\S]*"view == pspfWorkshop\.evidenceView"/
  );
  assert.match(
    manifest,
    /"command": "pspf\.workshop\.openPlanOfActionBoard"[\s\S]*"view == pspfWorkshop\.actionsView"/
  );
  assert.match(
    manifest,
    /"command": "pspf\.workshop\.openHumanCentredRiskView"[\s\S]*"view == pspfWorkshop\.risksView"/
  );
});

test("Requirement 92 is excluded from Essential Eight dashboard matching", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /requirement\.id === "REQ-PSPF-2025-092"/);
});

test("Action editor exposes Apply tag for linked Requirements", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function linkedRequirementsForAction/);
  assert.match(source, /class="form-actions action-linked-requirement-tags"/);
  assert.match(source, /data-command="applyTag" data-requirement-id="\$\{escapeHtml\(requirement\.id\)\}"/);
  assert.match(source, /Apply tag to \$\{escapeHtml\(requirementNumberLabel\(requirement\)\)\}/);
});

test("Evidence linking captures sensitive link context", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /async function collectEvidenceLinkContext/);
  assert.match(source, /evidenceSection/);
  assert.match(source, /evidenceNote/);
  assert.match(source, /Why this Evidence supports the selected Requirement\(s\) \(optional, sensitive\)/);
});

test("Evidence review can copy a scoped evidence package", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /data-command="copyEvidencePackage"/);
  assert.match(source, /async function copyEvidencePackage/);
  assert.match(source, /function evidencePackageMarkdown/);
  assert.match(source, /Choose the Requirement group to include/);
  assert.match(source, /## Requirement Summary/);
});

test("Workshop exposes separate CSO and CISO magazine editions", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /pspf\.workshop\.openCsoMagazine/);
  assert.match(source, /pspf\.workshop\.openCisoMagazine/);
  assert.match(source, /Digital CSO Magazine/);
  assert.match(source, /Digital CISO Magazine/);
  assert.match(source, /buildShareArtefactInput\(await listAllEntities\(\), edition\)/);
  assert.match(source, /edition === "ciso" \? "Digital CISO Magazine" : "Digital CSO Magazine"/);
});

test("CISO Master Plan does not include a magazine shortcut", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const masterPlanMatch = source.match(/function renderCisoMasterPlanPanel\([\s\S]*?function roleOwnershipRows/);

  assert.ok(masterPlanMatch, "CISO Master Plan renderer should be present");
  assert.doesNotMatch(masterPlanMatch[0], /pspf\.workshop\.openCsoMagazine/);
  assert.doesNotMatch(masterPlanMatch[0], /Digital CSO Magazine/);
});

test("Requirement cards are larger and render ISM controls", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /minmax\(312px, 1fr\)/);
  assert.match(source, /min-height: 264px/);
  assert.match(source, /shellPill\(`ISM \$\{card\.ismControlCount\}`\)/);
  assert.match(source, /requirementCardLinkList\("ISM controls", card\.ismControls\)/);
});

test("major feature view buttons can pass through the panel command bridge", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const panelCommandMatch = source.match(/const allowedPanelCommands = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(panelCommandMatch, "panel command allow-list should be present");
  const panelCommandBlock = panelCommandMatch[1];
  assert.ok(panelCommandBlock, "panel command allow-list should have a command block");

  const renderedCommands = [...source.matchAll(/data-command="(pspf\.[^"]+)"/g)].map((match) => match[1]);
  const allowedPanelCommands = new Set([...panelCommandBlock.matchAll(/"(pspf\.[^"]+)"/g)].map((match) => match[1]));
  const missingCommands = [...new Set(renderedCommands.filter((command) => !allowedPanelCommands.has(command)))].sort();

  assert.deepEqual(missingCommands, []);
});

test("Workshop Home exposes core authoring and single bundle exchange actions", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const homeCommandMatch = source.match(/const allowedCommands = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(homeCommandMatch, "home command allow-list should be present");
  const homeCommandBlock = homeCommandMatch[1];
  assert.ok(homeCommandBlock, "home command allow-list should have a command block");

  assert.match(source, /homeButton\("pspf\.workshop\.createRisk", "Create risk"\)/);
  assert.match(source, /homeButton\("pspf\.workshop\.registerDirection", "Create direction"\)/);
  assert.match(source, /homeButton\("pspf\.workshop\.importBundle", "Import bundle"\)/);
  assert.match(homeCommandBlock, /"pspf\.workshop\.importBundle"/);
  assert.match(manifest, /PSPF: Create Direction/);
  assert.doesNotMatch(manifest, /Import Explorer Local JSON/);
  assert.doesNotMatch(manifest, /Backup JSON/);
});

test("Master Dashboard cards align controls and use wider panel space", async () => {
  const extensionSource = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");

  assert.match(extensionSource, /<section class="master-dashboard">/);
  assert.match(shellSource, /main \{ max-width: min\(1440px, calc\(100vw - 24px\)\)/);
  assert.match(shellSource, /main:has\(\.master-dashboard\) \{ max-width: min\(1680px, calc\(100vw - 24px\)\)/);
  assert.match(shellSource, /\.decision-loop-card \{ display: grid; grid-template-rows:/);
  assert.match(shellSource, /\.decision-loop-card button \{ align-self: end; \}/);
  assert.match(shellSource, /\.strategy-performance-card \{ display: grid; grid-template-rows:/);
  assert.match(shellSource, /\.strategy-performance-card__meta \{ min-height: 28px;/);
});

test("Workshop exposes ISM Review Workbench queues", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /pspf\.workshop\.openIsmReviewWorkbench/);
  assert.match(source, /allowedCommands = new Set\([\s\S]*"pspf\.workshop\.openIsmReviewWorkbench"/);
  assert.match(source, /function buildIsmReviewWorkbenchRows/);
  assert.match(source, /risk-without-action/);
  assert.match(source, /needs-direct-work/);
  assert.match(source, /data-ism-review-filter/);
  assert.match(source, /id="ism-review-category-filter"/);
});

test("ISM source controls browser exposes category filter", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /ISM_SOURCE_CONTROL_CATEGORIES/);
  assert.match(source, /portalCommand\("pspf\.workshop\.browseIsmSourceControls", "Controls pane"/);
  assert.match(source, /allowedCommands = new Set\([\s\S]*"pspf\.workshop\.browseIsmSourceControls"/);
  assert.match(source, /id="ism-category-filter"/);
  assert.match(source, /data-category/);
  assert.match(source, /function ismSourceControlCategory/);
});

test("ISM control detail buttons post source-control payloads", async () => {
  const extensionSource = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");
  const commands = [
    "openIsmControlDetail",
    "setIsmControlImplementationStatus",
    "mapRequirementToCurrentIsmControl",
    "linkEvidenceToIsmControl",
    "linkActionToIsmControl",
    "linkRiskToIsmControl",
    "attachEvidenceForIsmControl",
    "createActionForIsmControl",
    "createRiskForIsmControl"
  ];

  for (const command of commands) {
    assert.match(
      extensionSource,
      new RegExp(`data-command="${command}" data-source-control-id=`),
      `${command} should render with source-control context`
    );
    assert.match(
      shellSource,
      new RegExp(
        `command === '${command}'[\\s\\S]*sourceControlId: button\\.getAttribute\\('data-source-control-id'\\)`
      ),
      `${command} should post source-control context to the extension host`
    );
  }
});
