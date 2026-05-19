import * as vscode from "vscode";
import { renderPostureBriefMarkdown } from "@pspf/brief-renderer";
import {
  buildConnectedViewModel,
  renderConnectedViewBodyHtml,
  CONNECTED_VIEW_STYLES,
  CONNECTED_VIEW_BROWSER_SCRIPT
} from "@pspf/connected-view";
import {
  CHANGE_RECORD_PERSISTENCE,
  CHANGE_RECORD_SOURCES,
  CHANGE_RECORD_STATUSES,
  CHANGE_RECORD_TYPES,
  type ChangeRecordEntity,
  type ChangeRecordPersistence,
  type ChangeRecordSource,
  type ChangeRecordStatus,
  type ChangeRecordType,
  type ContractEntity,
  DEFAULT_TAG_COLOUR,
  PSPF_SLICE_VERSION,
  PSPF_DOMAINS,
  TAG_COLOURS,
  TAG_LIMITS,
  VERSION_AXES,
  type ActionEntity,
  type ActionStatus,
  type AssessmentStatus,
  type DirectionEntity,
  type DirectionResponseState,
  buildSampleWorkspaceEntities,
  enrichActionsWithImpact,
  type EvidenceEntity,
  type EvidenceFreshness,
  type LinkEntity,
  type MappingConfidence,
  type RequirementEntity,
  type RequirementControlMappingEntity,
  type RiskEntity,
  type RiskStatus,
  SAVED_VIEW_LIMITS,
  type SavedViewEntity,
  type SavedViewScope,
  type SourceControlEntity,
  type SpendItemEntity,
  type SupplierEntity,
  type TagColour,
  type TagEntity,
  type V01Entity,
  isValidSingleGrapheme,
  isValidSavedViewName,
  isValidTagLabel,
  normaliseSavedViewName,
  normaliseTagLabel,
  withEnvelope
} from "@pspf/contracts";
import { formatShortAuDateTime, normaliseShortAuDateTime, shortWorkshopPanelTitle } from "./workshop-ui.js";

const recentRequirementKey = "pspf.workshop.recentRequirementId";
let workshopContext: vscode.ExtensionContext | undefined;
let homeViewProvider: WorkshopHomeViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  workshopContext = context;
  homeViewProvider = new WorkshopHomeViewProvider();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusItem.text = `$(shield) PSPF v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = `PSPF Workshop ${PSPF_SLICE_VERSION}\nSchema ${VERSION_AXES.schemaVersion} · Bundle ${VERSION_AXES.bundleVersion} · API ${VERSION_AXES.apiVersion}`;
  statusItem.command = "pspf.workshop.openHome";
  statusItem.show();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pspfWorkshop.homeView", homeViewProvider),
    statusItem,
    vscode.commands.registerCommand("pspf.workshop.openHome", openHome),
    vscode.commands.registerCommand("pspf.workshop.createRequirement", createRequirement),
    vscode.commands.registerCommand("pspf.workshop.openWelcome", openWelcome),
    vscode.commands.registerCommand("pspf.workshop.loadSampleWorkspace", loadSampleWorkspace),
    vscode.commands.registerCommand("pspf.workshop.importBundle", importBundle),
    vscode.commands.registerCommand("pspf.workshop.attachEvidence", attachEvidence),
    vscode.commands.registerCommand("pspf.workshop.createAction", createAction),
    vscode.commands.registerCommand("pspf.workshop.createRisk", createRisk),
    vscode.commands.registerCommand("pspf.workshop.linkExistingEvidence", linkExistingEvidence),
    vscode.commands.registerCommand("pspf.workshop.linkExistingAction", linkExistingAction),
    vscode.commands.registerCommand("pspf.workshop.linkExistingRisk", linkExistingRisk),
    vscode.commands.registerCommand("pspf.workshop.linkExistingDirection", linkExistingDirection),
    vscode.commands.registerCommand("pspf.workshop.openAssessmentDashboard", openAssessmentDashboard),
    vscode.commands.registerCommand("pspf.workshop.openConnectedView", openConnectedView),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceReviewQueue", openEvidenceReviewQueue),
    vscode.commands.registerCommand("pspf.workshop.openItemDetail", openItemDetail),
    vscode.commands.registerCommand("pspf.workshop.browseIsmSourceControls", browseIsmSourceControls),
    vscode.commands.registerCommand("pspf.workshop.createRequirementControlMapping", createRequirementControlMapping),
    vscode.commands.registerCommand("pspf.workshop.registerDirection", registerDirection),
    vscode.commands.registerCommand("pspf.workshop.updateDirectionResponse", updateDirectionResponse),
    vscode.commands.registerCommand("pspf.workshop.openDirectionDetail", openDirectionDetail),
    vscode.commands.registerCommand("pspf.workshop.openChangeRecords", openChangeRecords),
    vscode.commands.registerCommand("pspf.workshop.recordSignificantChange", recordSignificantChange),
    vscode.commands.registerCommand("pspf.workshop.manageTags", manageTags),
    vscode.commands.registerCommand("pspf.workshop.manageSavedViews", manageSavedViews),
    vscode.commands.registerCommand("pspf.workshop.applyTag", applyTag),
    vscode.commands.registerCommand("pspf.workshop.removeTag", removeTag),
    vscode.commands.registerCommand("pspf.workshop.filterRequirementsByTag", filterRequirementsByTag),
    vscode.commands.registerCommand("pspf.workshop.copyPostureBrief", copyPostureBrief)
  );
}

export function deactivate(): void {
  // No runtime resources to dispose yet.
}

async function openHome(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.extension.pspfWorkshop");
  await homeViewProvider?.refresh();
}

async function importBundle(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.importExplorerLocalBundle");
  await homeViewProvider?.refresh();
}

class WorkshopHomeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = homeShellHtml("Loading", `<section><p class="muted">Loading PSPF Workshop Home...</p></section>`);
    webviewView.webview.onDidReceiveMessage((message: { readonly command?: string }) => {
      void this.handleMessage(message.command).catch(async (error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`PSPF Workshop action failed: ${detail}`);
        await this.refresh();
      });
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      const model = await buildHomeModel();
      this.view.webview.html = renderHomeView(model);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.view.webview.html = homeShellHtml("Action Needed", `
        <section>
          <h2>Workspace not ready</h2>
          <p class="muted">${escapeHtml(message)}</p>
          ${homeButton("pspf.core.initialiseWorkspace", "Initialise workspace")}
        </section>
      `);
    }
  }

  private async handleMessage(command: string | undefined): Promise<void> {
    if (!command) {
      return;
    }

    if (command === "pspf.workshop.home.refresh") {
      await this.refresh();
      return;
    }

    if (command === "pspf.workshop.home.continue") {
      await continueNextTask();
      await this.refresh();
      return;
    }

    const allowedCommands = new Set([
      "pspf.core.initialiseWorkspace",
      "pspf.core.validateWorkspace",
      "pspf.core.verifyIntegrity",
      "pspf.core.runIntegrityScan",
      "pspf.core.createSnapshot",
      "pspf.core.exportBundle",
      "pspf.workshop.loadSampleWorkspace",
      "pspf.workshop.createRequirement",
      "pspf.workshop.attachEvidence",
      "pspf.workshop.createAction",
      "pspf.workshop.createRisk",
      "pspf.workshop.openAssessmentDashboard",
      "pspf.workshop.openConnectedView",
      "pspf.workshop.openEvidenceReviewQueue",
      "pspf.workshop.openItemDetail",
      "pspf.workshop.registerDirection",
      "pspf.workshop.updateDirectionResponse",
      "pspf.workshop.openDirectionDetail",
      "pspf.workshop.openChangeRecords",
      "pspf.workshop.recordSignificantChange",
      "pspf.workshop.manageTags",
      "pspf.workshop.manageSavedViews",
      "pspf.workshop.applyTag",
      "pspf.workshop.filterRequirementsByTag",
      "pspf.workshop.copyPostureBrief"
    ]);

    if (!allowedCommands.has(command)) {
      return;
    }

    await vscode.commands.executeCommand(command);
    await this.refresh();
  }
}

interface WorkshopHomeModel {
  readonly counts: {
    readonly requirements: number;
    readonly evidence: number;
    readonly actions: number;
    readonly risks: number;
    readonly directions: number;
  };
  readonly missingEvidence: number;
  readonly evidenceReview: number;
  readonly urgentActions: number;
  readonly directionsNeedingResponse: number;
  readonly changeRecords: number;
  readonly recentRequirementTitle: string;
}

async function buildHomeModel(): Promise<WorkshopHomeModel> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
  const changeRecords = allEntities.filter((entity): entity is ChangeRecordEntity => entity.entityType === "change-record");
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.fromId));
  const linkedEvidenceIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.toId));
  const recentRequirementId = getRecentRequirementId();
  const recentRequirement = recentRequirementId ? requirements.find((requirement) => requirement.id === recentRequirementId) : undefined;

  return {
    counts: {
      requirements: requirements.length,
      evidence: evidence.length,
      actions: actions.length,
      risks: risks.length,
      directions: directions.length
    },
    missingEvidence: requirements.filter((requirement) => !evidenceRequirementIds.has(requirement.id)).length,
    evidenceReview: evidence.filter((item) => item.freshness !== "current" || !linkedEvidenceIds.has(item.id)).length,
    urgentActions: actions.filter((action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue").length,
    directionsNeedingResponse: directions.filter((direction) => direction.responseState === "not-set").length,
    changeRecords: changeRecords.length,
    recentRequirementTitle: recentRequirement?.title ?? "None selected yet"
  };
}

async function continueNextTask(): Promise<void> {
  const model = await buildHomeModel();
  if (model.missingEvidence > 0 || model.evidenceReview > 0 || model.urgentActions > 0) {
    await openEvidenceReviewQueue();
    return;
  }
  await openAssessmentDashboard();
}

function renderHomeView(model: WorkshopHomeModel): string {
  return homeShellHtml("Workshop Home", `
    <section class="hero-section">
      <p class="eyebrow">System of record</p>
      <h2>Workspace</h2>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", model.counts.requirements)}
        ${metricCard("Evidence", model.counts.evidence)}
        ${metricCard("Actions", model.counts.actions)}
        ${metricCard("Risks", model.counts.risks)}
        ${metricCard("Directions", model.counts.directions)}
        ${metricCard("Change records", model.changeRecords)}
      </div>
    </section>
    <section>
      <h2>Needs Attention</h2>
      <div class="grid">
        ${metricCard("Missing evidence", model.missingEvidence)}
        ${metricCard("Evidence review", model.evidenceReview)}
        ${metricCard("Urgent actions", model.urgentActions)}
        ${metricCard("Directions not set", model.directionsNeedingResponse)}
      </div>
      <p class="muted">Recent requirement: ${escapeHtml(model.recentRequirementTitle)}</p>
      <div class="action-list">
        ${homeButton("pspf.workshop.home.continue", "Continue next task", "Open the highest-priority review surface")}
        ${homeButton("pspf.workshop.openEvidenceReviewQueue", "Review evidence", "Check missing, stale, and unlinked evidence")}
        ${homeButton("pspf.workshop.openAssessmentDashboard", "Open dashboard", "View posture, Directions, and Action Impact")}
        ${homeButton("pspf.workshop.openConnectedView", "Connected View", "Trace Directions, Requirements, Risks, and Actions")}
        ${homeButton("pspf.workshop.openChangeRecords", "Change records", "Review why important records changed")}
        ${homeButton("pspf.workshop.manageSavedViews", "Saved views", "Save and reopen Workshop Requirement filters")}
      </div>
    </section>
    <section>
      <h2>Create</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.createRequirement", "Requirement")}
        ${homeButton("pspf.workshop.attachEvidence", "Evidence")}
        ${homeButton("pspf.workshop.createAction", "Action")}
        ${homeButton("pspf.workshop.createRisk", "Risk")}
        ${homeButton("pspf.workshop.registerDirection", "Direction")}
        ${homeButton("pspf.workshop.recordSignificantChange", "Change record")}
        ${homeButton("pspf.workshop.manageTags", "Tag")}
        ${homeButton("pspf.workshop.manageSavedViews", "Saved view")}
      </div>
    </section>
    <section>
      <h2>Check And Share</h2>
      <div class="action-list compact">
        ${homeButton("pspf.core.validateWorkspace", "Validate")}
        ${homeButton("pspf.core.runIntegrityScan", "Integrity scan")}
        ${homeButton("pspf.core.createSnapshot", "Snapshot")}
        ${homeButton("pspf.core.exportBundle", "Export")}
        ${homeButton("pspf.workshop.copyPostureBrief", "Copy brief")}
      </div>
    </section>
    <section>
      <h2>Panel</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.home.refresh", "Refresh")}
        ${homeButton("pspf.workshop.loadSampleWorkspace", "Load sample")}
      </div>
    </section>
  `);
}

function homeShellHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --workshop-blue: #2563eb;
      --workshop-blue-soft: rgba(37, 99, 235, 0.18);
      --workshop-amber: #d97706;
      --workshop-radius: 6px;
      --workshop-radius-sm: 4px;
      --workshop-gap: 10px;
      --workshop-pad: 12px;
    }
    body { margin: 0; color: var(--vscode-foreground); background: radial-gradient(circle at top left, var(--workshop-blue-soft), transparent 18rem), var(--vscode-sideBar-background); font-feature-settings: "ss01", "cv01"; }
    header { display: grid; gap: 2px; padding: var(--workshop-pad); border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); background: linear-gradient(135deg, rgba(37, 99, 235, 0.24), transparent 78%); }
    header strong { font-size: 15px; letter-spacing: 0.01em; }
    header span { color: var(--vscode-descriptionForeground); font-size: 11.5px; }
    .sensitivity { background: rgba(217, 119, 6, 0.18); border-bottom: 1px solid var(--workshop-amber); color: var(--vscode-foreground); padding: 6px var(--workshop-pad); font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; }
    main { padding: var(--workshop-pad); }
    section { border: 1px solid var(--vscode-sideBarSectionHeader-border); border-radius: var(--workshop-radius); padding: var(--workshop-gap); margin-bottom: var(--workshop-gap); background: var(--vscode-editor-background); }
    section + section { margin-top: 0; }
    .hero-section { border-color: rgba(37, 99, 235, 0.45); background: linear-gradient(180deg, rgba(37, 99, 235, 0.13), var(--vscode-editor-background)); }
    .eyebrow { margin: 0 0 6px; color: var(--workshop-blue); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { font-size: 12.5px; line-height: 1.25; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; }
    .metric { border: 1px solid var(--vscode-input-border); border-radius: var(--workshop-radius); padding: 8px 9px; background: var(--vscode-input-background); }
    .metric span { color: var(--vscode-descriptionForeground); display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric strong { display: block; font-size: 22px; line-height: 1.1; margin-top: 3px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .action-list { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .action-list.compact { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
    button { width: 100%; min-width: 0; border: 1px solid var(--vscode-button-border, transparent); border-radius: var(--workshop-radius-sm); padding: 7px 9px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; cursor: pointer; text-align: left; transition: background-color 80ms ease; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .button-title { display: block; overflow-wrap: anywhere; font-weight: 500; }
    .button-description { display: block; margin-top: 2px; color: var(--vscode-button-secondaryForeground, var(--vscode-descriptionForeground)); font-size: 11px; line-height: 1.35; font-weight: 400; }
    .version-strip { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .version-pill { border: 1px solid var(--vscode-input-border); border-radius: 999px; padding: 2px 8px; color: var(--vscode-descriptionForeground); background: var(--vscode-input-background); font-size: 11px; white-space: nowrap; line-height: 1.4; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <header><strong>PSPF Workshop</strong><span>System of record · v${PSPF_SLICE_VERSION}</span></header>
  <div class="sensitivity">OFFICIAL: Sensitive · Local workspace writes stay in Workshop</div>
  <main>${body}</main>
  <script>
    const vscode = acquireVsCodeApi();
    globalThis.__pspfWorkshopVscode = vscode;
    document.querySelectorAll("button[data-command]").forEach((button) => {
      button.addEventListener("click", () => vscode.postMessage({ command: button.dataset.command }));
    });
  </script>
</body>
</html>`;
}

function homeButton(command: string, text: string, description?: string): string {
  const descriptionHtml = description ? `<span class="button-description">${escapeHtml(description)}</span>` : "";
  return `<button type="button" data-command="${escapeHtml(command)}"><span class="button-title">${escapeHtml(text)}</span>${descriptionHtml}</button>`;
}

async function openWelcome(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity) => entity.entityType === "requirement").length;
  const evidence = allEntities.filter((entity) => entity.entityType === "evidence").length;
  const actions = allEntities.filter((entity) => entity.entityType === "action").length;
  const directions = allEntities.filter((entity) => entity.entityType === "direction").length;
  const rows = [
    { step: "Load sample", command: "PSPF: Load Sample Workspace", outcome: "Adds a privacy-safe assurance scenario" },
    { step: "Review posture", command: "PSPF: Open Assessment Dashboard", outcome: "Shows Directions and Action Impact" },
    { step: "Triage evidence", command: "PSPF: Open Evidence Review Queue", outcome: "Shows missing evidence and urgent actions" },
    { step: "Inspect records", command: "PSPF: Open Item Detail", outcome: "Shows linked evidence, actions, risks, ISM, and Directions" },
    { step: "Publish", command: "PSPF: Export Master Bundle", outcome: "Creates the Explorer bundle" },
    { step: "Check", command: "PSPF: Run Integrity Scan", outcome: "Writes .pspf/logs/integrity-scan.json" }
  ];

  const panel = vscode.window.createWebviewPanel("pspfWorkshopWelcome", "PSPF Workshop Welcome", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml("PSPF Workshop Welcome", `
    <section>
      <h1>Workshop Welcome</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", requirements)}
        ${metricCard("Evidence", evidence)}
        ${metricCard("Actions", actions)}
        ${metricCard("Directions", directions)}
      </div>
    </section>
    ${recordTable("First-Run Path", rows, ["step", "command", "outcome"])}
  `);
}

async function loadSampleWorkspace(): Promise<void> {
  await ensureCoreReady();
  const sourceControls = await listSourceControls();
  const entities = buildSampleWorkspaceEntities({ sourceControls });
  await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
  await refreshWorkshopSurfaces();
  const action = await vscode.window.showInformationMessage(`PSPF sample workspace loaded: ${entities.length} record(s).`, "Open Welcome", "Open Dashboard");
  if (action === "Open Welcome") {
    await openWelcome();
  }
  if (action === "Open Dashboard") {
    await openAssessmentDashboard();
  }
}

async function createRequirement(): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Requirement",
    prompt: "Requirement title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a requirement title." : undefined
  });
  if (!title) {
    return;
  }

  const domain = await vscode.window.showQuickPick(
    PSPF_DOMAINS.map((item) => ({ label: item.title, description: item.code, domainId: item.id })),
    { title: "Select PSPF Domain", ignoreFocusOut: true }
  );
  if (!domain) {
    return;
  }

  const assessmentStatus = await vscode.window.showQuickPick(
    assessmentStatusItems,
    { title: "Select Assessment Status", ignoreFocusOut: true }
  );
  if (!assessmentStatus) {
    return;
  }

  const summary = await vscode.window.showInputBox({
    title: "Create Requirement",
    prompt: "Internal summary, not published by default",
    ignoreFocusOut: true
  });

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: title.trim(),
      domainId: domain.domainId,
      assessmentStatus: assessmentStatus.value,
      summary: summary?.trim() || undefined
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", requirement);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(`Requirement created: ${requirement.title}`, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function attachEvidence(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Add Evidence",
    prompt: "Evidence title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an evidence title." : undefined
  });
  if (!title) {
    return;
  }

  const evidenceType = await vscode.window.showQuickPick(
    evidenceTypeItems,
    { title: "Select Evidence Type", ignoreFocusOut: true }
  );
  if (!evidenceType) {
    return;
  }

  const reference = await vscode.window.showInputBox({
    title: "Add Evidence",
    prompt: "File path, URL, or short reference",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an evidence reference." : undefined
  });
  if (!reference) {
    return;
  }

  const freshness = await vscode.window.showQuickPick(
    freshnessItems,
    { title: "Select Evidence Freshness", ignoreFocusOut: true }
  );
  if (!freshness) {
    return;
  }

  const requirements = requirementId ? await requirementSelectionForScopedCommand(requirementId, "evidence") : await pickRequirementsForLinkedItem("evidence");
  if (requirements.length === 0) {
    return;
  }

  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: title.trim(),
      evidenceType: evidenceType.value,
      reference: reference.trim(),
      freshness: freshness.value
    },
    "workshop"
  );
  const links = requirements.map((requirement) => withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} supported by ${evidence.title}`,
      linkType: "supported-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: evidence.id,
      toType: "evidence"
    },
    "workshop"
  ));

  await upsertEntityWithRequirementLinks(evidence, links, requirements);
}

async function createAction(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Action title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an action title." : undefined
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(
    actionStatusItems,
    { title: "Select Action Status", ignoreFocusOut: true }
  );
  if (!status) {
    return;
  }

  const dueDate = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Due date, for example today or 30 Jun 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (dueDate === undefined) {
    return;
  }

  const requirements = requirementId ? await requirementSelectionForScopedCommand(requirementId, "action") : await pickRequirementsForLinkedItem("action");
  if (requirements.length === 0) {
    return;
  }

  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: title.trim(),
      status: status.value,
      dueDate: normaliseShortAuDateTime(dueDate)
    },
    "workshop"
  );
  const links = requirements.map((requirement) => withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} addressed by ${action.title}`,
      linkType: "addressed-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: action.id,
      toType: "action"
    },
    "workshop"
  ));

  await upsertEntityWithRequirementLinks(action, links, requirements);
}

async function createRisk(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Risk",
    prompt: "Risk title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a risk title." : undefined
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(
    riskStatusItems,
    { title: "Select Risk Status", ignoreFocusOut: true }
  );
  if (!status) {
    return;
  }

  const likelihood = await pickScore("Select Likelihood");
  if (!likelihood) {
    return;
  }

  const impact = await pickScore("Select Impact");
  if (!impact) {
    return;
  }

  const requirements = requirementId ? await requirementSelectionForScopedCommand(requirementId, "risk") : await pickRequirementsForLinkedItem("risk");
  if (requirements.length === 0) {
    return;
  }

  const risk = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: title.trim(),
      status: status.value,
      likelihood,
      impact
    },
    "workshop"
  );
  const links = requirements.map((requirement) => withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} exposed by ${risk.title}`,
      linkType: "exposed-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: risk.id,
      toType: "risk"
    },
    "workshop"
  ));

  await upsertEntityWithRequirementLinks(risk, links, requirements);
}

async function linkExistingEvidence(requirementId?: string): Promise<void> {
  await linkExistingItemToRequirement(requirementId, "evidence");
}

async function linkExistingAction(requirementId?: string): Promise<void> {
  await linkExistingItemToRequirement(requirementId, "action");
}

async function linkExistingRisk(requirementId?: string): Promise<void> {
  await linkExistingItemToRequirement(requirementId, "risk");
}

async function linkExistingDirection(requirementId?: string): Promise<void> {
  await linkExistingItemToRequirement(requirementId, "direction");
}

async function upsertLinkedEntity(entity: V01Entity, link: LinkEntity, requirement: RequirementEntity): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.upsertEntities", [entity, link]);
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  const allEntities = entities ?? [];
  const entityExists = allEntities.some((candidate) => candidate.id === entity.id);
  const linkExists = allEntities.some((candidate) => candidate.id === link.id && candidate.entityType === "link");
  if (!entityExists || !linkExists) {
    throw new Error(`Could not confirm ${label(entity.entityType)} was linked. Run PSPF: Validate Workspace and try again.`);
  }
  await rememberRequirement(requirement);
  const entityTitle = entity.title ?? entity.id;
  const message = `${label(entity.entityType)} linked to ${requirement.title}: ${entityTitle} (${label(link.linkType)})`;
  const action = await vscode.window.showInformationMessage(message, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function upsertEntityWithRequirementLinks(entity: EvidenceEntity | ActionEntity | RiskEntity, links: LinkEntity[], requirements: RequirementEntity[]): Promise<void> {
  const firstRequirement = requirements[0];
  if (!firstRequirement) {
    return;
  }

  await vscode.commands.executeCommand("pspf.core.upsertEntities", [entity, ...links]);
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  const allEntities = entities ?? [];
  const entityExists = allEntities.some((candidate) => candidate.id === entity.id && candidate.entityType === entity.entityType);
  const missingLinkCount = links.filter((link) => !allEntities.some((candidate) => candidate.id === link.id && candidate.entityType === "link")).length;
  if (!entityExists || missingLinkCount > 0) {
    throw new Error(`Could not confirm ${label(entity.entityType)} links were created. Run PSPF: Validate Workspace and try again.`);
  }

  await refreshWorkshopSurfaces();
  await rememberRequirement(firstRequirement);
}

async function openAssessmentDashboard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.fromId));
  const validationHints = buildValidationHints(requirements, actions, risks, links);
  const recentRequirementId = getRecentRequirementId();
  const recentRequirement = recentRequirementId ? requirements.find((requirement) => requirement.id === recentRequirementId) : undefined;
  const openActionCount = actions.filter((action) => !["done", "cancelled"].includes(action.status)).length;
  const openRiskCount = risks.filter((risk) => risk.status !== "closed").length;
  const directionResponseCounts: Record<DirectionResponseState, number> = {
    "not-set": directions.filter((direction) => direction.responseState === "not-set").length,
    "yes": directions.filter((direction) => direction.responseState === "yes").length,
    "no": directions.filter((direction) => direction.responseState === "no").length,
    "risk-managed": directions.filter((direction) => direction.responseState === "risk-managed").length
  };
  const directionRows = directions.map((direction) => ({
    openEntityType: "direction",
    openEntityId: direction.id,
    reference: direction.reference,
    title: direction.title,
    responseState: label(direction.responseState),
    sourceAuthority: direction.sourceAuthority ?? "Not recorded",
    issuedAt: direction.issuedAt ? formatDisplayDate(new Date(direction.issuedAt)) : "Not recorded"
  }));
  const actionImpactRows = actions
    .filter((action): action is ActionEntity & { impact: NonNullable<ActionEntity["impact"]> } => Boolean(action.impact))
    .map((action) => {
      const impact = action.impact;
      const postureUplift = impact.postureUplift ?? 0;
      const evidenceUplift = impact.evidenceUplift ?? 0;
      const riskReduction = impact.riskReduction ?? 0;
      const directionUplift = impact.directionUplift ?? 0;
      const total = postureUplift + evidenceUplift + riskReduction + directionUplift;
      return {
        openEntityType: "action",
        openEntityId: action.id,
        title: action.title,
        status: label(action.status),
        urgency: label(impact.urgency ?? "normal"),
        total,
        postureUplift,
        evidenceUplift,
        riskReduction,
        directionUplift,
        explanation: summariseImpactExplanation(impact.explanation ?? []),
        explanationFull: (impact.explanation ?? []).join("; ")
      };
    })
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);
  const domainRows = PSPF_DOMAINS.map((domain) => {
    const domainRequirements = requirements.filter((requirement) => requirement.domainId === domain.id);
    return {
      domain: domain.title,
      requirements: domainRequirements.length,
      evidenceGaps: domainRequirements.filter((requirement) => !evidenceRequirementIds.has(requirement.id)).length,
      inProgress: domainRequirements.filter((requirement) => requirement.assessmentStatus === "in-progress").length,
      met: domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length,
      notMet: domainRequirements.filter((requirement) => requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met").length
    };
  });
  const nextRequirements = requirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id) || requirement.assessmentStatus !== "met")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((requirement) => ({
      title: requirement.title,
      domain: domainName(requirement.domainId),
      status: label(requirement.assessmentStatus),
      evidence: evidenceRequirementIds.has(requirement.id) ? "Linked" : "Missing"
    }));
  const recentActivity = allEntities
    .filter((entity) => entity.entityType !== "domain" && entity.entityType !== "posture")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((entity) => ({
      type: label(entity.entityType),
      title: entity.title ?? entity.id,
      created: formatDisplayDate(new Date(entity.createdAt))
    }));

  const panel = vscode.window.createWebviewPanel("pspfAssessmentDashboard", "PSPF Assessment Dashboard", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml("PSPF Assessment Dashboard", `
    <section>
      <h1>Assessment Dashboard</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Workspace", "Ready")}
        ${metricCard("Requirements", requirements.length)}
        ${metricCard("Evidence", evidence.length)}
        ${metricCard("Open actions", openActionCount)}
        ${metricCard("Open risks", openRiskCount)}
        ${metricCard("Directions", directions.length)}
      </div>
      <p class="muted">Direction responses: ${directionChips(directionResponseCounts)}</p>
      <p class="muted">Recent requirement: ${escapeHtml(recentRequirement?.title ?? "None selected yet")}</p>
    </section>
    ${recordTable("Validation Hints", validationHints, ["priority", "requirement", "hint"])}
    ${recordTable("Domain Summary", domainRows, ["domain", "requirements", "evidenceGaps", "inProgress", "met", "notMet"])}
    ${recordTable("Action Impact — Top 5", actionImpactRows, ["title", "status", "urgency", "total", "postureUplift", "evidenceUplift", "riskReduction", "directionUplift", "explanation"])}
    ${recordTable("Directions", directionRows, ["reference", "title", "responseState", "sourceAuthority", "issuedAt"])}
    ${recordTable("Next Requirements To Review", nextRequirements, ["title", "domain", "status", "evidence"])}
    ${recordTable("Latest Activity", recentActivity, ["type", "title", "created"])}
  `);
}

async function openConnectedView(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfConnectedView",
    "PSPF Connected View",
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.options = { enableScripts: true };

  async function render(): Promise<void> {
    const allEntities = await listAllEntities();
    const enrichedEntities = enrichActionsWithImpact(allEntities);
    const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
    const actions = enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
    const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
    const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
    const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");

    const model = buildConnectedViewModel({
      requirements,
      risks,
      actions,
      directions,
      links,
      domains: PSPF_DOMAINS
    });

    const body = renderConnectedViewBodyHtml(model, {
      mode: "workshop",
      defaultLayout: "domains",
      title: "Connected View",
      subtitle: "Directions · Requirements · Risks · Actions"
    });

    panel.webview.html = shellHtml("PSPF Connected View", `
      <style>${CONNECTED_VIEW_STYLES}</style>
      <section style="padding:0;border:0;background:transparent;">
        ${body}
      </section>
      <script>${CONNECTED_VIEW_BROWSER_SCRIPT}</script>
    `);
  }

  wireWorkshopPanelMessages(panel, render);
  await render();
}

async function openEvidenceReviewQueue(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const supportedByLinks = links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence");
  const evidenceRequirementIds = new Set(supportedByLinks.map((link) => link.fromId));
  const linkedEvidenceIds = new Set(supportedByLinks.map((link) => link.toId));
  const missingEvidence = requirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id))
    .map((requirement) => ({ openEntityType: "requirement", openEntityId: requirement.id, title: requirement.title, domain: domainName(requirement.domainId), status: label(requirement.assessmentStatus) }));
  const ageingEvidence = evidence
    .filter((item) => item.freshness !== "current")
    .map((item) => ({ openEntityType: "evidence", openEntityId: item.id, title: item.title, freshness: label(item.freshness), reference: item.reference }));
  const unlinkedEvidence = evidence
    .filter((item) => !linkedEvidenceIds.has(item.id))
    .map((item) => ({ openEntityType: "evidence", openEntityId: item.id, title: item.title, freshness: label(item.freshness), reference: item.reference }));
  const urgentActions = enrichedEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action")
    .filter((action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue")
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      urgency: action.impact ? label(action.impact.urgency) : "",
      status: label(action.status),
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
    }));

  const panel = vscode.window.createWebviewPanel("pspfEvidenceReviewQueue", "PSPF Evidence Review Queue", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml("PSPF Evidence Review Queue", `
    <section>
      <h1>Evidence Review Queue</h1>
      <p class="muted">OFFICIAL: Sensitive · Review missing, ageing, stale, expired, unknown, and unlinked evidence.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Missing evidence", missingEvidence.length)}
        ${metricCard("Needs freshness review", ageingEvidence.length)}
        ${metricCard("Unlinked evidence", unlinkedEvidence.length)}
        ${metricCard("Urgent actions", urgentActions.length)}
      </div>
    </section>
    ${recordTable("Urgent Actions (Blocked or Overdue)", urgentActions, ["title", "urgency", "status", "dueDate"])}
    ${recordTable("Requirements Missing Evidence", missingEvidence, ["title", "domain", "status"])}
    ${recordTable("Evidence Needing Freshness Review", ageingEvidence, ["title", "freshness", "reference"])}
    ${recordTable("Unlinked Evidence", unlinkedEvidence, ["title", "freshness", "reference"])}
  `);
}

async function openItemDetail(): Promise<void> {
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }
  await openItemDetailForRequirement(requirement);
}

async function browseIsmSourceControls(): Promise<void> {
  await ensureCoreReady();
  const sourceControls = await listSourceControls();
  const rows = sourceControls.map((sourceControl) => ({
    controlId: sourceControl.controlId,
    title: sourceControl.title,
    profiles: sourceControl.profileTags.join(", "),
    release: sourceControl.provenance.oscalRelease,
    drift: statementChangeLabel(sourceControl.statementChangeStatus)
  }));

  const panel = vscode.window.createWebviewPanel("pspfIsmSourceControls", "PSPF ISM Source Controls", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml("PSPF ISM Source Controls", `
    <section>
      <h1>ISM Source Controls</h1>
      <p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release ${escapeHtml(sourceControls[0]?.provenance.oscalRelease ?? "not loaded")}.</p>
      ${versionStrip()}
    </section>
    ${recordTable("Source Controls", rows, ["controlId", "title", "profiles", "release", "drift"])}
  `);
}

async function createRequirementControlMapping(initialRequirement?: RequirementEntity): Promise<void> {
  await ensureCoreReady();
  const requirement = initialRequirement ?? await pickRequirement();
  if (!requirement) {
    return;
  }

  const sourceControl = await pickSourceControl();
  if (!sourceControl) {
    return;
  }

  const coverage = await vscode.window.showQuickPick(
    coverageQualifierItems,
    { title: "Select ISM Coverage", ignoreFocusOut: true }
  );
  if (!coverage) {
    return;
  }

  const profile = await vscode.window.showQuickPick(
    profileItems(sourceControl),
    { title: "Select ISM Applicability Profile", ignoreFocusOut: true }
  );
  if (!profile) {
    return;
  }

  const confidence = await vscode.window.showQuickPick(
    confidenceItems,
    { title: "Select Mapping Confidence", ignoreFocusOut: true }
  );
  if (!confidence) {
    return;
  }

  const reviewBy = await vscode.window.showInputBox({
    title: "Map Requirement to ISM Control",
    prompt: "Optional reviewer role or team label",
    ignoreFocusOut: true
  });
  if (reviewBy === undefined) {
    return;
  }

  const reviewedAt = new Date().toISOString();

  const rationale = await vscode.window.showInputBox({
    title: "Map Requirement to ISM Control",
    prompt: "Sensitive mapping rationale, not published by default",
    ignoreFocusOut: true
  });
  if (rationale === undefined) {
    return;
  }

  const mapping = withEnvelope(
    "requirement-control-mapping",
    {
      entityType: "requirement-control-mapping",
      title: `${requirement.title} mapped to ${sourceControl.controlId}`,
      requirementId: requirement.id,
      sourceControlId: sourceControl.id,
      coverageQualifier: coverage.value,
      applicabilityProfile: profile.value,
      confidence: confidence.value,
      lastReviewedAt: reviewedAt,
      reviewBy: reviewBy.trim() || undefined,
      rationale: rationale.trim() || undefined,
      provenance: {
        author: "workshop",
        createdAt: new Date().toISOString(),
        oscalRelease: sourceControl.provenance.oscalRelease
      }
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", mapping);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(`Mapped ${requirement.title} to ${sourceControl.controlId}.`, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function registerDirection(): Promise<void> {
  await ensureCoreReady();
  const reference = await vscode.window.showInputBox({
    title: "Register Direction",
    prompt: "Authoritative reference (for example HA-DIR-2026-01)",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a Direction reference." : undefined
  });
  if (!reference) {
    return;
  }
  const title = await vscode.window.showInputBox({
    title: "Register Direction",
    prompt: "Short Direction title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a Direction title." : undefined
  });
  if (!title) {
    return;
  }
  const sourceAuthority = await vscode.window.showInputBox({
    title: "Register Direction",
    prompt: "Issuing authority (for example Home Affairs). Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (sourceAuthority === undefined) {
    return;
  }
  const issuedAt = await vscode.window.showInputBox({
    title: "Register Direction",
    prompt: "Issue date, for example 01 Mar 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (issuedAt === undefined) {
    return;
  }
  const responseState = await vscode.window.showQuickPick(
    directionResponseStateItems,
    { title: "Select initial Direction response", ignoreFocusOut: true }
  );
  if (!responseState) {
    return;
  }
  const linkedRequirement = await pickOptionalRequirement("Optionally link this Direction to a requirement");
  const direction = withEnvelope(
    "direction",
    {
      entityType: "direction",
      title: title.trim(),
      reference: reference.trim(),
      sourceAuthority: sourceAuthority.trim() || undefined,
      issuedAt: issuedAt.trim() || undefined,
      responseState: responseState.value
    },
    "workshop"
  );
  const entities: V01Entity[] = [direction];
  if (linkedRequirement) {
    entities.push(withEnvelope(
      "link",
      {
        entityType: "link",
        title: `${direction.title} targets ${linkedRequirement.title}`,
        linkType: "targets",
        fromId: direction.id,
        fromType: "direction",
        toId: linkedRequirement.id,
        toType: "requirement"
      },
      "workshop"
    ));
  }
  await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
  await refreshWorkshopSurfaces();
}

async function updateDirectionResponse(): Promise<void> {
  await ensureCoreReady();
  const directions = await listDirections();
  if (directions.length === 0) {
    await vscode.window.showWarningMessage("No Directions registered. Run PSPF: Register Direction first.");
    return;
  }
  const picked = await vscode.window.showQuickPick(
    directions.map((direction) => ({
      label: `${direction.reference}: ${direction.title}`,
      description: label(direction.responseState),
      detail: direction.sourceAuthority ?? "",
      direction
    })),
    { title: "Select Direction", ignoreFocusOut: true }
  );
  if (!picked) {
    return;
  }
  const nextState = await vscode.window.showQuickPick(
    directionResponseStateItems,
    { title: `Update response for ${picked.direction.reference}`, ignoreFocusOut: true }
  );
  if (!nextState) {
    return;
  }
  const updated: DirectionEntity = {
    ...picked.direction,
    responseState: nextState.value,
    updatedAt: new Date().toISOString()
  };
  await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
  await refreshWorkshopSurfaces();
}

async function openDirectionDetail(): Promise<void> {
  await ensureCoreReady();
  const directions = await listDirections();
  if (directions.length === 0) {
    await vscode.window.showWarningMessage("No Directions registered. Run PSPF: Register Direction first.");
    return;
  }
  const picked = await vscode.window.showQuickPick(
    directions.map((direction) => ({
      label: `${direction.reference}: ${direction.title}`,
      description: label(direction.responseState),
      detail: direction.sourceAuthority ?? "",
      direction
    })),
    { title: "Open Direction Detail", ignoreFocusOut: true }
  );
  if (!picked) {
    return;
  }
  await openItemDetailForDirection(picked.direction);
}

async function openChangeRecords(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const changeRecords = allEntities
    .filter((entity): entity is ChangeRecordEntity => entity.entityType === "change-record")
    .sort((left, right) => right.raisedAt.localeCompare(left.raisedAt));
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.linkType === "changes" && entity.recordStatus !== "deleted");
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const linkTargetsByChangeId = new Map<string, string[]>();
  for (const link of links) {
    const target = entitiesById.get(link.toId);
    linkTargetsByChangeId.set(link.fromId, [...(linkTargetsByChangeId.get(link.fromId) ?? []), target?.title ?? link.toId]);
  }
  const rows = changeRecords.map((changeRecord) => ({
    openEntityType: "change-record",
    openEntityId: changeRecord.id,
    title: changeRecord.title,
    status: label(changeRecord.status),
    type: label(changeRecord.changeType),
    persistence: label(changeRecord.persistence),
    source: label(changeRecord.source),
    raised: formatDisplayDate(new Date(changeRecord.raisedAt)),
    affected: (linkTargetsByChangeId.get(changeRecord.id) ?? []).join(", ") || "Not linked",
    summary: changeRecord.summary
  }));
  const panel = vscode.window.createWebviewPanel("pspfChangeRecords", "PSPF Change Records", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml("PSPF Change Records", `
    <section>
      <h1>Change Records</h1>
      <p class="muted">OFFICIAL: Sensitive · Filter in the table by status, persistence, change type, date, or affected record using the editor search.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Total", changeRecords.length)}
        ${metricCard("Active", changeRecords.filter((changeRecord) => changeRecord.status === "active").length)}
        ${metricCard("Persistent", changeRecords.filter((changeRecord) => changeRecord.persistence === "persistent").length)}
        ${metricCard("Linked", rows.filter((row) => row.affected !== "Not linked").length)}
      </div>
      <div class="form-actions"><button type="button" data-command="recordChange">Record significant change</button></div>
    </section>
    ${recordTable("Change Records", rows, ["title", "status", "type", "persistence", "source", "raised", "affected", "summary"])}
  `);
}

async function recordSignificantChange(entityType?: string, entityId?: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const target = await resolveChangeTarget(allEntities, entityType, entityId);
  if (!target) {
    return;
  }
  const title = await vscode.window.showInputBox({
    title: "Record Significant Change",
    prompt: "Short title for the change record",
    value: `Change affecting ${target.title ?? label(target.entityType)}`,
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a change title." : undefined
  });
  if (!title) {
    return;
  }
  const summary = await vscode.window.showInputBox({
    title: "Record Significant Change",
    prompt: "Public summary of what changed",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a public summary." : undefined
  });
  if (!summary) {
    return;
  }
  const changeType = await vscode.window.showQuickPick(changeRecordTypeItems, { title: "Change type", ignoreFocusOut: true });
  if (!changeType) {
    return;
  }
  const status = await vscode.window.showQuickPick(changeRecordStatusItems, { title: "Initial status", ignoreFocusOut: true });
  if (!status) {
    return;
  }
  const persistence = await vscode.window.showQuickPick(changeRecordPersistenceItems, { title: "Persistence", ignoreFocusOut: true });
  if (!persistence) {
    return;
  }
  const source = await vscode.window.showQuickPick(changeRecordSourceItems, { title: "Source", ignoreFocusOut: true });
  if (!source) {
    return;
  }
  const reason = await vscode.window.showInputBox({ title: "Record Significant Change", prompt: "Sensitive reason. Press Enter to skip.", ignoreFocusOut: true });
  if (reason === undefined) {
    return;
  }
  const impactSummary = await vscode.window.showInputBox({ title: "Record Significant Change", prompt: "Sensitive impact summary. Press Enter to skip.", ignoreFocusOut: true });
  if (impactSummary === undefined) {
    return;
  }

  const changeRecord = withEnvelope(
    "change-record",
    {
      entityType: "change-record",
      title: title.trim(),
      summary: summary.trim(),
      reason: trimOptional(reason),
      impactSummary: trimOptional(impactSummary),
      changeType: changeType.value,
      status: status.value,
      persistence: persistence.value,
      source: source.value,
      raisedAt: new Date().toISOString()
    },
    "workshop"
  );
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${changeRecord.title} changes ${target.title ?? label(target.entityType)}`,
      linkType: "changes",
      fromId: changeRecord.id,
      fromType: "change-record",
      toId: target.id,
      toType: target.entityType
    },
    "workshop"
  );
  await vscode.commands.executeCommand("pspf.core.upsertEntities", [changeRecord, link]);
  await refreshWorkshopSurfaces();
}

async function resolveChangeTarget(allEntities: readonly V01Entity[], entityType?: string, entityId?: string): Promise<ChangeTargetEntity | undefined> {
  const providedTarget = allEntities.find((entity): entity is ChangeTargetEntity => entity.entityType === entityType && entity.id === entityId && isChangeTargetEntity(entity));
  if (providedTarget) {
    return providedTarget;
  }
  const candidates = allEntities
    .filter(isChangeTargetEntity)
    .sort((left, right) => label(left.entityType).localeCompare(label(right.entityType)) || (left.title ?? left.id).localeCompare(right.title ?? right.id));
  if (candidates.length === 0) {
    await vscode.window.showWarningMessage("Create a Requirement, Action, Risk, Direction, Tag, or Saved View before recording a change.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((entity) => ({
      label: entity.title ?? entity.id,
      description: label(entity.entityType),
      detail: entity.id,
      entity
    })),
    { title: "Affected Record", placeHolder: "Choose the record this change explains", ignoreFocusOut: true }
  );
  return picked?.entity;
}

type ChangeTargetEntity = RequirementEntity | ActionEntity | RiskEntity | DirectionEntity | TagEntity | SavedViewEntity;

function isChangeTargetEntity(entity: V01Entity): entity is ChangeTargetEntity {
  return ["requirement", "action", "risk", "direction", "tag", "saved-view"].includes(entity.entityType) && entity.recordStatus !== "deleted";
}

async function openItemDetailForDirection(direction: DirectionEntity): Promise<void> {
  const allEntities = await listAllEntities();
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const outboundLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.fromId === direction.id);
  const relationships = outboundLinks.map((link) => ({
    openEntityType: link.toType,
    openEntityId: link.toId,
    title: link.title,
    relationship: label(link.linkType),
    targetType: label(link.toType),
    target: entitiesById.get(link.toId)?.title ?? label(link.toType)
  }));

  const panel = vscode.window.createWebviewPanel("pspfItemDetail", shortWorkshopPanelTitle(direction), vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(direction.title, `
    <section>
      <h1>${escapeHtml(direction.title)}</h1>
      <p>Reference: ${escapeHtml(direction.reference)}</p>
      <p>Response state: ${escapeHtml(label(direction.responseState))}</p>
      <p>Source authority: ${escapeHtml(direction.sourceAuthority ?? "Not recorded")}</p>
      <p>Issued: ${escapeHtml(direction.issuedAt ? formatDisplayDate(new Date(direction.issuedAt)) : "Not recorded")}</p>
      ${versionStrip()}
      ${directionNavigationStrip(direction, allEntities)}
      <div class="form-actions"><button type="button" data-command="openEntity" data-entity-type="direction" data-entity-id="${escapeHtml(direction.id)}">Edit</button><button type="button" data-command="recordChange" data-entity-type="direction" data-entity-id="${escapeHtml(direction.id)}">Record significant change</button></div>
    </section>
    ${recordTable("Outbound Relationships", relationships, ["title", "relationship", "targetType", "target"])}
  `);
}

async function openItemDetailForRequirement(requirement: RequirementEntity): Promise<void> {
  await rememberRequirement(requirement);

  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const outboundLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.fromId === requirement.id);
  const inboundLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.toId === requirement.id);
  const linkedIds = new Set(outboundLinks.map((link) => link.toId));
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id));
  const evidenceRows = evidence.map((item) => ({
    openEntityType: "evidence",
    openEntityId: item.id,
    title: item.title,
    evidenceType: label(item.evidenceType),
    freshness: label(item.freshness),
    reference: item.reference
  }));
  const enrichedActionsById = new Map(enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action").map((action) => [action.id, action]));
  const actions = Array.from(linkedIds)
    .map((id) => enrichedActionsById.get(id))
    .filter((action): action is ActionEntity => Boolean(action));
  const actionRows = actions.map((action) => ({
    openEntityType: "action",
    openEntityId: action.id,
    title: action.title,
    status: label(action.status),
    urgency: action.impact ? label(action.impact.urgency) : "normal",
    dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
  }));
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id));
  const riskRows = risks.map((risk) => ({
    openEntityType: "risk",
    openEntityId: risk.id,
    title: risk.title,
    status: label(risk.status),
    likelihood: risk.likelihood,
    impact: risk.impact
  }));
  const tagsById = new Map(allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted").map((tag) => [tag.id, tag]));
  const tagRows = outboundLinks
    .filter((link) => link.recordStatus !== "deleted" && link.linkType === "tagged-with" && link.toType === "tag")
    .map((link) => tagsById.get(link.toId))
    .filter((tag): tag is TagEntity => Boolean(tag))
    .sort(compareTags)
    .map((tag) => ({
      title: tagChipLabel(tag),
      colour: label(tag.colour),
      status: label(tag.recordStatus),
      action: `<button type="button" data-command="removeTag" data-requirement-id="${escapeHtml(requirement.id)}" data-tag-id="${escapeHtml(tag.id)}">Remove</button>`
    }));
  const directionsById = new Map(allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction").map((entity) => [entity.id, entity]));
  const directionRows = inboundLinks
    .filter((link) => link.fromType === "direction")
    .map((link) => directionsById.get(link.fromId))
    .filter((direction): direction is DirectionEntity => Boolean(direction))
    .map((direction) => ({
      openEntityType: "direction",
      openEntityId: direction.id,
      reference: direction.reference,
      title: direction.title,
      responseState: label(direction.responseState),
      sourceAuthority: direction.sourceAuthority ?? "Not recorded"
    }));
  const sourceControlsById = new Map(allEntities.filter((entity): entity is SourceControlEntity => entity.entityType === "source-control").map((entity) => [entity.id, entity]));
  const mappings = allEntities
    .filter((entity): entity is RequirementControlMappingEntity => entity.entityType === "requirement-control-mapping" && entity.requirementId === requirement.id)
    .map((mapping) => {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      return {
        openEntityType: "requirement-control-mapping",
        openEntityId: mapping.id,
        controlId: sourceControl?.controlId ?? mapping.sourceControlId,
        title: sourceControl?.title ?? "Unknown source control",
        coverage: label(mapping.coverageQualifier),
        profile: mapping.applicabilityProfile,
        confidence: label(mapping.confidence ?? "medium"),
        reviewed: mapping.lastReviewedAt ? formatDisplayDate(new Date(mapping.lastReviewedAt)) : "Not recorded",
        reviewer: mapping.reviewBy ?? "Not recorded",
        drift: statementChangeLabel(sourceControl?.statementChangeStatus ?? "unchanged"),
        release: mapping.provenance.oscalRelease
      };
    });
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const relationships = outboundLinks.map((link) => ({
    openEntityType: link.toType,
    openEntityId: link.toId,
    title: link.title,
    relationship: label(link.linkType),
    targetType: label(link.toType),
    target: entitiesById.get(link.toId)?.title ?? label(link.toType)
  }));

  const panel = vscode.window.createWebviewPanel("pspfItemDetail", shortWorkshopPanelTitle(requirement), vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(requirement.title, `
    <section>
      <h1>${escapeHtml(requirement.title)}</h1>
      <p>Assessment status: ${escapeHtml(label(requirement.assessmentStatus))}</p>
      <p>Domain: ${escapeHtml(domainName(requirement.domainId))}</p>
      ${versionStrip()}
      ${requirementNavigationStrip(requirement, allEntities)}
      <div class="form-actions"><button type="button" data-command="openEntity" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Edit</button><button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(requirement.id)}">Apply tag</button><button type="button" data-command="recordChange" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Record significant change</button></div>
    </section>
    ${recordTable("Tags", tagRows, ["title", "colour", "status", "action"])}
    ${recordTable("Directions Targeting This Requirement", directionRows, ["reference", "title", "responseState", "sourceAuthority"])}
    ${recordTable("Evidence", evidenceRows, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Risks", riskRows, ["title", "status", "likelihood", "impact"])}
    ${commercialContextSection(requirement, allEntities)}
    ${recordTable("ISM Mappings", mappings, ["controlId", "title", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"])}
    ${recordTable("Relationships", relationships, ["title", "relationship", "targetType", "target"])}
  `);
}

type SaveEntityMessage = {
  readonly command?: "saveEntity" | "saveAndCloseEntity" | "saveAndNextEntity";
  readonly entityType?: string;
  readonly entityId?: string;
  readonly fields?: Record<string, string>;
};

type EditableWorkshopEntity = RequirementEntity | EvidenceEntity | ActionEntity | RiskEntity | DirectionEntity | ChangeRecordEntity | RequirementControlMappingEntity;

async function openItemDetailForEntity(entityType: string, entityId: string): Promise<void> {
  const allEntities = await listAllEntities();
  const entity = allEntities.find((item): item is EditableWorkshopEntity => item.entityType === entityType && item.id === entityId && isEditableWorkshopEntity(item));
  if (!entity) {
    await vscode.window.showWarningMessage("This record is read-only or no longer exists in this workspace.");
    return;
  }
  await openEntityEditor(entity, allEntities);
}

function isEditableWorkshopEntity(entity: V01Entity): entity is EditableWorkshopEntity {
  return ["requirement", "evidence", "action", "risk", "direction", "change-record", "requirement-control-mapping"].includes(entity.entityType);
}

async function openEntityEditor(entity: EditableWorkshopEntity, allEntities: readonly V01Entity[]): Promise<void> {
  let currentEntity = entity;
  let currentEntities = allEntities;
  const panel = vscode.window.createWebviewPanel("pspfEntityDetail", shortWorkshopPanelTitle(currentEntity), vscode.ViewColumn.One, { enableScripts: true });
  const refreshEditor = async () => {
    currentEntities = await listAllEntities();
    const refreshedEntity = currentEntities.find((item): item is EditableWorkshopEntity => item.entityType === currentEntity.entityType && item.id === currentEntity.id && isEditableWorkshopEntity(item));
    if (refreshedEntity) {
      currentEntity = refreshedEntity;
    }
    panel.title = shortWorkshopPanelTitle(currentEntity);
    panel.webview.html = shellHtml(currentEntity.title ?? currentEntity.id, renderEntityEditor(currentEntity, currentEntities));
  };
  wireWorkshopPanelMessages(panel, refreshEditor);
  panel.webview.onDidReceiveMessage(async (message: SaveEntityMessage) => {
    if (!["saveEntity", "saveAndCloseEntity", "saveAndNextEntity"].includes(message.command ?? "") || message.entityType !== currentEntity.entityType || message.entityId !== currentEntity.id) {
      return;
    }
    const updated = await buildUpdatedEntity(currentEntity, message.fields ?? {});
    if (!updated) {
      return;
    }
    await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
    await refreshWorkshopSurfaces();
    currentEntity = updated;
    if (message.command === "saveAndNextEntity") {
      panel.dispose();
      if (updated.entityType === "requirement") {
        await openAdjacentRequirement(updated.id, "next");
      }
      if (updated.entityType === "direction") {
        await openAdjacentDirection(updated.id, "next");
      }
      return;
    }
    if (message.command === "saveAndCloseEntity") {
      panel.dispose();
      return;
    }
    await refreshEditor();
  });
  panel.webview.html = shellHtml(entity.title ?? entity.id, renderEntityEditor(entity, currentEntities));
}

function shellHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --workshop-blue: #2563eb;
      --workshop-blue-soft: rgba(37, 99, 235, 0.14);
      --workshop-blue-strong: rgba(37, 99, 235, 0.28);
      --amber: #d97706;
      --amber-soft: rgba(217, 119, 6, 0.18);
      --radius: 8px;
      --radius-sm: 4px;
      --radius-pill: 999px;
      --gap: 14px;
      --gap-lg: 18px;
      --pad: 16px;
      --pad-lg: 22px;
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --surface: var(--vscode-editor-background);
      --surface-strong: var(--vscode-input-background, var(--vscode-editor-background));
      --border: var(--vscode-panel-border, var(--vscode-input-border));
    }
    body { margin: 0; color: var(--text); background: radial-gradient(circle at top left, var(--workshop-blue-soft), transparent 28rem), var(--vscode-editor-background); font-feature-settings: "ss01", "cv01"; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: var(--pad) var(--pad-lg); border-bottom: 1px solid var(--border); background: linear-gradient(135deg, var(--workshop-blue-strong) 0%, transparent 72%); }
    header strong { display: block; font-size: 20px; letter-spacing: 0.005em; }
    header span { color: var(--muted); font-size: 12.5px; }
    main { max-width: 1180px; margin: 0 auto; padding: var(--pad-lg); }
    section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); margin-bottom: var(--gap); }
    section > h2:first-child { margin-top: 0; }
    h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.005em; }
    h2 { font-size: 16px; margin-top: 0; margin-bottom: 10px; letter-spacing: 0.01em; }
    h3 { font-size: 14px; margin: 12px 0 6px; }
    p { line-height: 1.5; }
    .eyebrow { margin: 0 0 6px; color: var(--workshop-blue); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: var(--surface-strong); }
    .metric span { color: var(--muted); display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric strong { display: block; font-size: 28px; line-height: 1.1; margin-top: 6px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .table-wrap { width: 100%; overflow-x: auto; margin-top: 10px; border-radius: var(--radius-sm); }
    table { width: 100%; min-width: min(760px, 100%); border-collapse: collapse; table-layout: auto; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
    td { overflow-wrap: anywhere; }
    th { color: var(--muted); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; background: color-mix(in srgb, var(--surface-strong) 75%, transparent); position: sticky; top: 0; }
    tbody tr:hover { background: color-mix(in srgb, var(--workshop-blue) 6%, transparent); }
    tbody tr:last-child td { border-bottom: none; }
    th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"], th[data-field="target"], td[data-field="target"] { min-width: 18rem; max-width: 34rem; }
    th[data-field="explanation"], td[data-field="explanation"] { max-width: 22rem; }
    .cell-compact { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    th[data-field="controlId"], td[data-field="controlId"], th[data-field="coverage"], td[data-field="coverage"], th[data-field="profile"], td[data-field="profile"], th[data-field="confidence"], td[data-field="confidence"], th[data-field="reviewed"], td[data-field="reviewed"], th[data-field="drift"], td[data-field="drift"], th[data-field="release"], td[data-field="release"], th[data-field="status"], td[data-field="status"], th[data-field="freshness"], td[data-field="freshness"] { white-space: nowrap; width: 1%; font-variant-numeric: tabular-nums; }
    th[data-field="open"], td[data-field="open"] { white-space: nowrap; width: 1%; }
    button, input, select, textarea { font: inherit; }
    button { border: 1px solid var(--vscode-button-border, transparent); border-radius: var(--radius-sm); background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 6px 11px; cursor: pointer; transition: background-color 80ms ease; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .form-grid { display: grid; gap: 12px; max-width: 640px; }
    label { display: grid; gap: 5px; color: var(--text); font-size: 13px; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid var(--vscode-input-border, var(--border)); border-radius: var(--radius-sm); background: var(--vscode-input-background); color: var(--vscode-input-foreground, var(--text)); padding: 7px 9px; }
    input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: -1px; border-color: transparent; }
    textarea { resize: vertical; min-height: 96px; line-height: 1.45; }
    input[readonly] { color: var(--muted); background: color-mix(in srgb, var(--surface-strong) 65%, transparent); }
    .form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .banner { background: var(--amber-soft); border-bottom: 1px solid var(--amber); color: var(--text); padding: 8px var(--pad-lg); font-weight: 600; font-size: 12.5px; letter-spacing: 0.02em; }
    .muted { color: var(--muted); }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .version-pill { border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 3px 10px; color: var(--muted); background: var(--surface-strong); font-size: 11.5px; white-space: nowrap; line-height: 1.4; font-variant-numeric: tabular-nums; }
    a { color: var(--vscode-textLink-foreground); }
    a:hover { color: var(--vscode-textLink-activeForeground); }
    @media (max-width: 720px) {
      main { padding: var(--pad); }
      header { padding: var(--pad); }
      .banner { padding: 8px var(--pad); }
      table { min-width: 680px; }
      th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"] { min-width: 16rem; }
    }
  </style>
</head>
<body>
  <header><strong>PSPF Workshop</strong><span>System of record · v${PSPF_SLICE_VERSION}</span></header>
  <div class="banner">OFFICIAL: Sensitive · Workshop is the decision surface</div>
  <main>
    ${body}
  </main>
  <script>
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
    document.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('button[data-command]') : null;
      if (!button || !vscode) {
        return;
      }
      const command = button.getAttribute('data-command');
      if (command === 'openEntity') {
        vscode.postMessage({ command, entityType: button.getAttribute('data-entity-type'), entityId: button.getAttribute('data-entity-id') });
      }
      if (command === 'openAdjacentRequirement') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id'), direction: button.getAttribute('data-direction') });
      }
      if (command === 'openAdjacentDirection') {
        vscode.postMessage({ command, directionId: button.getAttribute('data-direction-id'), direction: button.getAttribute('data-direction') });
      }
      if (command === 'recordChange') {
        vscode.postMessage({ command, entityType: button.getAttribute('data-entity-type'), entityId: button.getAttribute('data-entity-id') });
      }
      if (command === 'createTag' || command === 'editTag' || command === 'archiveTag' || command === 'applyTag' || command === 'removeTag') {
        vscode.postMessage({ command, tagId: button.getAttribute('data-tag-id'), requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'attachEvidenceToRequirement' || command === 'createActionForRequirement' || command === 'createRiskForRequirement' || command === 'mapRequirementToIsm') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'linkExistingEvidenceToRequirement' || command === 'linkExistingActionToRequirement' || command === 'linkExistingRiskToRequirement' || command === 'linkExistingDirectionToRequirement') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'createSavedView' || command === 'applySavedView' || command === 'editSavedView' || command === 'archiveSavedView') {
        vscode.postMessage({ command, savedViewId: button.getAttribute('data-saved-view-id'), savedViewScope: button.getAttribute('data-saved-view-scope') });
      }
      if (command === 'saveEntity' || command === 'saveAndCloseEntity' || command === 'saveAndNextEntity') {
        const form = button.closest('form');
        if (!form) {
          return;
        }
        const data = new FormData(form);
        const fields = {};
        for (const [key, value] of data.entries()) {
          fields[key] = String(value);
        }
        vscode.postMessage({
          command,
          entityType: String(data.get('entityType') || ''),
          entityId: String(data.get('entityId') || ''),
          fields
        });
      }
    });
  </script>
</body>
</html>`;
}

function wireWorkshopPanelMessages(panel: vscode.WebviewPanel, refreshPanel?: () => Promise<void>): void {
  panel.webview.onDidReceiveMessage(async (message: { readonly command?: string; readonly entityType?: string; readonly entityId?: string; readonly requirementId?: string; readonly directionId?: string; readonly tagId?: string; readonly savedViewId?: string; readonly direction?: string }) => {
    if (message.command === "refresh") {
      await refreshPanel?.();
      return;
    }
    if (message.command === "openEntity" && message.entityType && message.entityId) {
      await openItemDetailForEntity(message.entityType, message.entityId);
    }
    if (message.command === "openAdjacentRequirement" && message.requirementId && isRequirementNavigationDirection(message.direction)) {
      await openAdjacentRequirement(message.requirementId, message.direction);
    }
    if (message.command === "openAdjacentDirection" && message.directionId && isRequirementNavigationDirection(message.direction)) {
      await openAdjacentDirection(message.directionId, message.direction);
    }
    if (message.command === "recordChange") {
      await recordSignificantChange(message.entityType, message.entityId);
      await refreshPanel?.();
    }
    if (message.command === "applyTag" && message.requirementId) {
      await applyTag(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "removeTag" && message.requirementId && message.tagId) {
      await removeTag(message.requirementId, message.tagId);
      await refreshPanel?.();
    }
    if (message.command === "attachEvidenceToRequirement" && message.requirementId) {
      await attachEvidence(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "linkExistingEvidenceToRequirement" && message.requirementId) {
      await linkExistingEvidence(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "createActionForRequirement" && message.requirementId) {
      await createAction(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "linkExistingActionToRequirement" && message.requirementId) {
      await linkExistingAction(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "createRiskForRequirement" && message.requirementId) {
      await createRisk(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "linkExistingRiskToRequirement" && message.requirementId) {
      await linkExistingRisk(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "linkExistingDirectionToRequirement" && message.requirementId) {
      await linkExistingDirection(message.requirementId);
      await refreshPanel?.();
    }
    if (message.command === "mapRequirementToIsm" && message.requirementId) {
      const requirement = (await listRequirements()).find((item) => item.id === message.requirementId);
      if (requirement) {
        await createRequirementControlMapping(requirement);
        await refreshPanel?.();
      }
    }
    if (message.command === "applySavedView" && message.savedViewId) {
      const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
      if (savedView) {
        await openWorkshopRequirementsView(savedView);
      }
    }
  });
}

async function buildUpdatedEntity(entity: EditableWorkshopEntity, fields: Record<string, string>): Promise<EditableWorkshopEntity | undefined> {
  const updatedAt = new Date().toISOString();
  switch (entity.entityType) {
    case "requirement": {
      const status = fields.assessmentStatus;
      if (!isAssessmentStatus(status)) {
        await vscode.window.showWarningMessage("Select a valid assessment status before saving.");
        return undefined;
      }
      const isBaseline = entity.sourceProduct === "core";
      const title = isBaseline ? entity.title : fields.title?.trim();
      const domainId = isBaseline ? entity.domainId : fields.domainId;
      if (!title) {
        await vscode.window.showWarningMessage("Enter a Requirement title before saving.");
        return undefined;
      }
      if (!domainId || !PSPF_DOMAINS.some((domain) => domain.id === domainId)) {
        await vscode.window.showWarningMessage("Select a valid Requirement domain before saving.");
        return undefined;
      }
      return { ...entity, title, domainId, assessmentStatus: status, summary: trimOptional(fields.summary), updatedAt };
    }
    case "evidence": {
      const title = fields.title?.trim();
      const evidenceType = fields.evidenceType;
      const freshness = fields.freshness;
      if (!title) {
        await vscode.window.showWarningMessage("Enter an Evidence title before saving.");
        return undefined;
      }
      if (!isEvidenceType(evidenceType)) {
        await vscode.window.showWarningMessage("Select a valid Evidence type before saving.");
        return undefined;
      }
      if (!isEvidenceFreshness(freshness)) {
        await vscode.window.showWarningMessage("Select a valid Evidence freshness before saving.");
        return undefined;
      }
      const reference = fields.reference?.trim();
      if (!reference) {
        await vscode.window.showWarningMessage("Enter an Evidence reference before saving.");
        return undefined;
      }
      return { ...entity, title, evidenceType, reference, freshness, updatedAt };
    }
    case "action": {
      const title = fields.title?.trim();
      const status = fields.status;
      if (!title) {
        await vscode.window.showWarningMessage("Enter an Action title before saving.");
        return undefined;
      }
      if (!isActionStatus(status)) {
        await vscode.window.showWarningMessage("Select a valid Action status before saving.");
        return undefined;
      }
      return { ...entity, title, status, dueDate: normaliseShortAuDateTime(fields.dueDate), updatedAt };
    }
    case "risk": {
      const title = fields.title?.trim();
      const status = fields.status;
      const likelihood = Number(fields.likelihood);
      const impact = Number(fields.impact);
      if (!title) {
        await vscode.window.showWarningMessage("Enter a Risk title before saving.");
        return undefined;
      }
      if (!isRiskStatus(status)) {
        await vscode.window.showWarningMessage("Select a valid Risk status before saving.");
        return undefined;
      }
      if (!isScore(likelihood) || !isScore(impact)) {
        await vscode.window.showWarningMessage("Risk likelihood and impact must be whole numbers from 1 to 5.");
        return undefined;
      }
      return { ...entity, title, status, likelihood, impact, updatedAt };
    }
    case "direction": {
      const responseState = fields.responseState;
      if (!isDirectionResponseState(responseState)) {
        await vscode.window.showWarningMessage("Select a valid Direction response before saving.");
        return undefined;
      }
      if (entity.sourceProduct === "core") {
        return { ...entity, responseState, updatedAt };
      }
      const title = fields.title?.trim();
      const reference = fields.reference?.trim();
      if (!title || !reference) {
        await vscode.window.showWarningMessage("Enter a Direction reference and title before saving.");
        return undefined;
      }
      return { ...entity, title, reference, sourceAuthority: trimOptional(fields.sourceAuthority), issuedAt: trimOptional(fields.issuedAt), responseState, updatedAt };
    }
    case "change-record": {
      const title = fields.title?.trim();
      const summary = fields.summary?.trim();
      const changeType = fields.changeType;
      const status = fields.status;
      const persistence = fields.persistence;
      const source = fields.source;
      if (!title || !summary) {
        await vscode.window.showWarningMessage("Enter a Change Record title and public summary before saving.");
        return undefined;
      }
      if (!isChangeRecordType(changeType) || !isChangeRecordStatus(status) || !isChangeRecordPersistence(persistence) || !isChangeRecordSource(source)) {
        await vscode.window.showWarningMessage("Select valid Change Record classification values before saving.");
        return undefined;
      }
      return {
        ...entity,
        title,
        summary,
        reason: trimOptional(fields.reason),
        impactSummary: trimOptional(fields.impactSummary),
        changeType,
        status,
        persistence,
        source,
        effectiveAt: trimOptional(fields.effectiveAt),
        reviewDueAt: trimOptional(fields.reviewDueAt),
        decisionOwnerRef: trimOptional(fields.decisionOwnerRef),
        updatedAt
      };
    }
    case "requirement-control-mapping": {
      const coverageQualifier = fields.coverageQualifier;
      const confidence = fields.confidence;
      if (!isCoverageQualifier(coverageQualifier)) {
        await vscode.window.showWarningMessage("Select a valid mapping coverage before saving.");
        return undefined;
      }
      if (!isMappingConfidence(confidence)) {
        await vscode.window.showWarningMessage("Select a valid mapping confidence before saving.");
        return undefined;
      }
      const applicabilityProfile = fields.applicabilityProfile?.trim();
      if (!applicabilityProfile) {
        await vscode.window.showWarningMessage("Enter a mapping applicability profile before saving.");
        return undefined;
      }
      return {
        ...entity,
        coverageQualifier,
        applicabilityProfile,
        confidence,
        lastReviewedAt: trimOptional(fields.lastReviewedAt),
        reviewBy: trimOptional(fields.reviewBy),
        rationale: trimOptional(fields.rationale),
        updatedAt
      };
    }
  }
}

function renderEntityEditor(entity: EditableWorkshopEntity, allEntities: readonly V01Entity[]): string {
  switch (entity.entityType) {
    case "requirement":
      return renderRequirementEditor(entity, allEntities);
    case "evidence":
      return renderEvidenceEditor(entity);
    case "action":
      return renderActionEditor(entity, allEntities);
    case "risk":
      return renderRiskEditor(entity, allEntities);
    case "direction":
      return renderDirectionEditor(entity, allEntities);
    case "change-record":
      return renderChangeRecordEditor(entity);
    case "requirement-control-mapping":
      return renderMappingEditor(entity, allEntities);
  }
}

function renderRequirementEditor(requirement: RequirementEntity, allEntities: readonly V01Entity[]): string {
  const isBaseline = requirement.sourceProduct === "core";
  const domainOptions = PSPF_DOMAINS.map((domain) => ({ label: domain.title, value: domain.id }));
  const outboundLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.fromId === requirement.id);
  const inboundLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.toId === requirement.id);
  const linkedIds = new Set(outboundLinks.map((link) => link.toId));
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const evidenceRows = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id))
    .map((item) => ({
      openEntityType: "evidence",
      openEntityId: item.id,
      title: item.title,
      evidenceType: label(item.evidenceType),
      freshness: label(item.freshness),
      reference: item.reference
    }));
  const actionRows = enrichedEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action" && linkedIds.has(entity.id))
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      status: label(action.status),
      urgency: action.impact ? label(action.impact.urgency) : "normal",
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
    }));
  const riskRows = allEntities
    .filter((entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id))
    .map((risk) => ({
      openEntityType: "risk",
      openEntityId: risk.id,
      title: risk.title,
      status: label(risk.status),
      likelihood: risk.likelihood,
      impact: risk.impact
    }));
  const tagsById = new Map(allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted").map((tag) => [tag.id, tag]));
  const tagRows = outboundLinks
    .filter((link) => link.linkType === "tagged-with" && link.toType === "tag")
    .map((link) => tagsById.get(link.toId))
    .filter((tag): tag is TagEntity => Boolean(tag))
    .sort(compareTags)
    .map((tag) => ({
      title: tagChipLabel(tag),
      colour: label(tag.colour),
      status: label(tag.recordStatus),
      action: `<button type="button" data-command="removeTag" data-requirement-id="${escapeHtml(requirement.id)}" data-tag-id="${escapeHtml(tag.id)}">Remove</button>`
    }));
  const directionsById = new Map(allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction").map((entity) => [entity.id, entity]));
  const directionRows = inboundLinks
    .filter((link) => link.fromType === "direction")
    .map((link) => directionsById.get(link.fromId))
    .filter((direction): direction is DirectionEntity => Boolean(direction))
    .map((direction) => ({
      openEntityType: "direction",
      openEntityId: direction.id,
      reference: direction.reference,
      title: direction.title,
      responseState: label(direction.responseState),
      sourceAuthority: direction.sourceAuthority ?? "Not recorded"
    }));
  const sourceControlsById = new Map(allEntities.filter((entity): entity is SourceControlEntity => entity.entityType === "source-control").map((entity) => [entity.id, entity]));
  const mappingRows = allEntities
    .filter((entity): entity is RequirementControlMappingEntity => entity.entityType === "requirement-control-mapping" && entity.recordStatus !== "deleted" && entity.requirementId === requirement.id)
    .map((mapping) => {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      return {
        openEntityType: "requirement-control-mapping",
        openEntityId: mapping.id,
        controlId: sourceControl?.controlId ?? mapping.sourceControlId,
        title: sourceControl?.title ?? "Unknown source control",
        coverage: label(mapping.coverageQualifier),
        profile: mapping.applicabilityProfile,
        confidence: label(mapping.confidence ?? "medium"),
        reviewed: mapping.lastReviewedAt ? formatDisplayDate(new Date(mapping.lastReviewedAt)) : "Not recorded"
      };
    });
  return `${editorShell(requirement, "Edit Requirement", `
    ${isBaseline ? readonlyField("Title", requirement.title) : inputField("title", "Title", requirement.title, true)}
    ${isBaseline ? readonlyField("Domain", domainName(requirement.domainId)) : selectField("domainId", "Domain", domainOptions, requirement.domainId)}
    ${selectField("assessmentStatus", "Assessment status", assessmentStatusItems, requirement.assessmentStatus)}
    ${textareaField("summary", "Summary", requirement.summary ?? "")}
  `, isBaseline ? "Official PSPF baseline title and domain are locked." : undefined, requirementNavigationStrip(requirement, allEntities))}
    <section>
      <h2>Requirement Workbench</h2>
      <p class="muted">Add or open the linked records that drive this Requirement's assessment.</p>
      <div class="form-actions">
        <button type="button" data-command="attachEvidenceToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Add new evidence</button>
        <button type="button" data-command="linkExistingEvidenceToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing evidence</button>
        <button type="button" data-command="createActionForRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Create action</button>
        <button type="button" data-command="linkExistingActionToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing action</button>
        <button type="button" data-command="createRiskForRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Create risk</button>
        <button type="button" data-command="linkExistingRiskToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing risk</button>
        <button type="button" data-command="linkExistingDirectionToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing Direction</button>
        <button type="button" data-command="mapRequirementToIsm" data-requirement-id="${escapeHtml(requirement.id)}">Map ISM control</button>
        <button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(requirement.id)}">Apply tag</button>
        <button type="button" data-command="recordChange" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Record significant change</button>
      </div>
    </section>
    ${recordTable("Tags", tagRows, ["title", "colour", "status", "action"])}
    ${recordTable("Directions Targeting This Requirement", directionRows, ["reference", "title", "responseState", "sourceAuthority"])}
    ${recordTable("Evidence", evidenceRows, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Risks", riskRows, ["title", "status", "likelihood", "impact"])}
    ${commercialContextSection(requirement, allEntities)}
    ${recordTable("ISM Mappings", mappingRows, ["controlId", "title", "coverage", "profile", "confidence", "reviewed"])}
  `;
}

function renderEvidenceEditor(evidence: EvidenceEntity): string {
  return editorShell(evidence, "Edit Evidence", `
    ${inputField("title", "Title", evidence.title, true)}
    ${selectField("evidenceType", "Evidence type", evidenceTypeItems, evidence.evidenceType)}
    ${inputField("reference", "Reference", evidence.reference, true)}
    ${selectField("freshness", "Freshness", freshnessItems, evidence.freshness)}
  `);
}

function renderActionEditor(action: ActionEntity, allEntities: readonly V01Entity[]): string {
  const impact = action.impact;
  const readOnlyImpact = impact ? `
    <section>
      <h2>Action Impact</h2>
      <div class="grid">
        ${metricCard("Urgency", label(impact.urgency))}
        ${metricCard("Posture uplift", impact.postureUplift)}
        ${metricCard("Evidence uplift", impact.evidenceUplift)}
        ${metricCard("Risk reduction", impact.riskReduction)}
        ${metricCard("Direction uplift", impact.directionUplift ?? 0)}
      </div>
      <p class="muted">${escapeHtml((impact.explanation ?? []).join("; ") || "No linked impact signals")}</p>
    </section>
  ` : "";
  return `${editorShell(action, "Edit Action", `
    ${inputField("title", "Title", action.title, true)}
    ${selectField("status", "Status", actionStatusItems, action.status)}
    ${inputField("dueDate", "Due date", formatShortAuDateTime(action.dueDate) ?? "", false, "today or 30 Jun 2026")}
  `)}${readOnlyImpact}${commercialContextSection(action, allEntities)}`;
}

function renderRiskEditor(risk: RiskEntity, allEntities: readonly V01Entity[]): string {
  const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value: String(value) }));
  return `${editorShell(risk, "Edit Risk", `
    ${inputField("title", "Title", risk.title, true)}
    ${selectField("status", "Status", riskStatusItems, risk.status)}
    ${selectField("likelihood", "Likelihood", scoreOptions, String(risk.likelihood))}
    ${selectField("impact", "Impact", scoreOptions, String(risk.impact))}
  `)}${commercialContextSection(risk, allEntities)}`;
}

function renderDirectionEditor(direction: DirectionEntity, allEntities: readonly V01Entity[]): string {
  const isBaseline = direction.sourceProduct === "core";
  const navigation = directionNavigationStrip(direction, allEntities);
  return editorShell(direction, "Edit Direction", `
    ${isBaseline ? readonlyField("Reference", direction.reference) : inputField("reference", "Reference", direction.reference, true)}
    ${isBaseline ? readonlyField("Title", direction.title) : inputField("title", "Title", direction.title, true)}
    ${isBaseline ? readonlyField("Source authority", direction.sourceAuthority ?? "Not recorded") : inputField("sourceAuthority", "Source authority", direction.sourceAuthority ?? "")}
    ${isBaseline ? readonlyField("Issued", direction.issuedAt ?? "Not recorded") : inputField("issuedAt", "Issued", direction.issuedAt ?? "")}
    ${selectField("responseState", "Response", directionResponseStateItems, direction.responseState)}
  `, isBaseline ? "Official published Direction fields are locked." : undefined, navigation);
}

function renderChangeRecordEditor(changeRecord: ChangeRecordEntity): string {
  return editorShell(changeRecord, "Edit Change Record", `
    ${inputField("title", "Title", changeRecord.title, true)}
    ${textareaField("summary", "Public summary", changeRecord.summary)}
    ${selectField("changeType", "Change type", changeRecordTypeItems, changeRecord.changeType)}
    ${selectField("status", "Status", changeRecordStatusItems, changeRecord.status)}
    ${selectField("persistence", "Persistence", changeRecordPersistenceItems, changeRecord.persistence)}
    ${selectField("source", "Source", changeRecordSourceItems, changeRecord.source)}
    ${readonlyField("Raised", formatDisplayDate(new Date(changeRecord.raisedAt)))}
    ${inputField("effectiveAt", "Effective at", changeRecord.effectiveAt ?? "", false, "2026-06-30T00:00:00.000Z")}
    ${inputField("reviewDueAt", "Review due at", changeRecord.reviewDueAt ?? "", false, "2026-09-30T00:00:00.000Z")}
    ${textareaField("reason", "Reason (sensitive)", changeRecord.reason ?? "")}
    ${textareaField("impactSummary", "Impact summary (sensitive)", changeRecord.impactSummary ?? "")}
    ${inputField("decisionOwnerRef", "Decision owner reference (restricted)", changeRecord.decisionOwnerRef ?? "")}
  `, "Reason, impact summary, and decision owner reference are redacted from Explorer publication.");
}

function renderMappingEditor(mapping: RequirementControlMappingEntity, allEntities: readonly V01Entity[]): string {
  const requirement = allEntities.find((entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === mapping.requirementId);
  const sourceControl = allEntities.find((entity): entity is SourceControlEntity => entity.entityType === "source-control" && entity.id === mapping.sourceControlId);
  const profileOptions = sourceControl ? profileItems(sourceControl) : [{ label: label(mapping.applicabilityProfile), value: mapping.applicabilityProfile }];
  const profileValues = new Set(profileOptions.map((item) => item.value));
  const resolvedProfileOptions = profileValues.has(mapping.applicabilityProfile) ? profileOptions : [{ label: label(mapping.applicabilityProfile), value: mapping.applicabilityProfile }, ...profileOptions];
  return editorShell(mapping, "Edit ISM Mapping", `
    ${readonlyField("Requirement", requirement?.title ?? mapping.requirementId)}
    ${readonlyField("ISM control", sourceControl ? `${sourceControl.controlId}: ${sourceControl.title}` : mapping.sourceControlId)}
    ${selectField("coverageQualifier", "Coverage", coverageQualifierItems, mapping.coverageQualifier)}
    ${selectField("applicabilityProfile", "Applicability profile", resolvedProfileOptions, mapping.applicabilityProfile)}
    ${selectField("confidence", "Confidence", confidenceItems, mapping.confidence)}
    ${inputField("lastReviewedAt", "Last reviewed", mapping.lastReviewedAt ?? "")}
    ${inputField("reviewBy", "Review by", mapping.reviewBy ?? "")}
    ${textareaField("rationale", "Rationale", mapping.rationale ?? "")}
  `, "Requirement and ISM control endpoints are locked after creation.");
}

function editorShell(entity: EditableWorkshopEntity, heading: string, fieldsHtml: string, note?: string, beforeActions = ""): string {
  const contextualActions = entity.entityType === "requirement"
    ? `<button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(entity.id)}">Apply tag</button>`
    : ["action", "risk", "direction"].includes(entity.entityType)
      ? `<button type="button" data-command="recordChange" data-entity-type="${escapeHtml(entity.entityType)}" data-entity-id="${escapeHtml(entity.id)}">Record significant change</button>`
      : "";
  return `
    <section>
      <h1>${escapeHtml(entity.title ?? entity.id)}</h1>
      <p class="muted">${escapeHtml(label(entity.entityType))} · ${escapeHtml(entity.id)}</p>
      ${versionStrip()}
      ${beforeActions}
      ${contextualActions ? `<div class="form-actions">${contextualActions}</div>` : ""}
    </section>
    <section>
      <h2>${escapeHtml(heading)}</h2>
      ${note ? `<p class="muted">${escapeHtml(note)}</p>` : ""}
      <form class="form-grid">
        <input type="hidden" name="entityType" value="${escapeHtml(entity.entityType)}">
        <input type="hidden" name="entityId" value="${escapeHtml(entity.id)}">
        ${fieldsHtml}
        <div class="form-actions">
          <button type="button" data-command="saveEntity">Save</button>
          ${entity.entityType === "requirement" || entity.entityType === "direction" ? `<button type="button" data-command="saveAndNextEntity">Save and next</button>` : ""}
          <button type="button" data-command="saveAndCloseEntity">Save and close</button>
        </div>
      </form>
    </section>
  `;
}

function inputField(name: string, fieldLabel: string, value: string, required = false, placeholder = ""): string {
  return `<label>${escapeHtml(fieldLabel)}<input name="${escapeHtml(name)}" value="${escapeHtml(value)}"${required ? " required" : ""}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}></label>`;
}

function textareaField(name: string, fieldLabel: string, value: string): string {
  return `<label>${escapeHtml(fieldLabel)}<textarea name="${escapeHtml(name)}" rows="4">${escapeHtml(value)}</textarea></label>`;
}

function readonlyField(fieldLabel: string, value: string): string {
  return `<label>${escapeHtml(fieldLabel)}<input value="${escapeHtml(value)}" readonly></label>`;
}

function selectField(name: string, fieldLabel: string, options: readonly { readonly label: string; readonly value: string }[], selectedValue: string): string {
  const renderedOptions = options
    .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selectedValue ? " selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
  return `<label>${escapeHtml(fieldLabel)}<select name="${escapeHtml(name)}">${renderedOptions}</select></label>`;
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isAssessmentStatus(value: string | undefined): value is AssessmentStatus {
  return assessmentStatusItems.some((item) => item.value === value);
}

function isEvidenceType(value: string | undefined): value is EvidenceEntity["evidenceType"] {
  return evidenceTypeItems.some((item) => item.value === value);
}

function isEvidenceFreshness(value: string | undefined): value is EvidenceFreshness {
  return freshnessItems.some((item) => item.value === value);
}

function isActionStatus(value: string | undefined): value is ActionStatus {
  return actionStatusItems.some((item) => item.value === value);
}

function isRiskStatus(value: string | undefined): value is RiskStatus {
  return riskStatusItems.some((item) => item.value === value);
}

function isDirectionResponseState(value: string | undefined): value is DirectionResponseState {
  return directionResponseStateItems.some((item) => item.value === value);
}

function isChangeRecordType(value: string | undefined): value is ChangeRecordType {
  return CHANGE_RECORD_TYPES.includes(value as ChangeRecordType);
}

function isChangeRecordStatus(value: string | undefined): value is ChangeRecordStatus {
  return CHANGE_RECORD_STATUSES.includes(value as ChangeRecordStatus);
}

function isChangeRecordPersistence(value: string | undefined): value is ChangeRecordPersistence {
  return CHANGE_RECORD_PERSISTENCE.includes(value as ChangeRecordPersistence);
}

function isChangeRecordSource(value: string | undefined): value is ChangeRecordSource {
  return CHANGE_RECORD_SOURCES.includes(value as ChangeRecordSource);
}

function isCoverageQualifier(value: string | undefined): value is RequirementControlMappingEntity["coverageQualifier"] {
  return coverageQualifierItems.some((item) => item.value === value);
}

function isMappingConfidence(value: string | undefined): value is MappingConfidence {
  return confidenceItems.some((item) => item.value === value);
}

function isScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

async function manageTags(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfTagManager", "PSPF Tag Manager", vscode.ViewColumn.One, { enableScripts: true });
  const refresh = async () => {
    const allEntities = await listAllEntities();
    const tags = sortTags(allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted"));
    const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with");
    panel.webview.html = renderTagManager(tags, links);
  };
  panel.webview.onDidReceiveMessage(async (message: { readonly command?: string; readonly tagId?: string }) => {
    if (message.command === "createTag") {
      await createOrEditTag();
      await refreshWorkshopSurfaces();
      await refresh();
    }
    if (message.command === "editTag" && message.tagId) {
      const tag = (await listTags(true)).find((item) => item.id === message.tagId);
      if (tag) {
        await createOrEditTag(tag);
        await refreshWorkshopSurfaces();
        await refresh();
      }
    }
    if (message.command === "archiveTag" && message.tagId) {
      const tag = (await listTags(true)).find((item) => item.id === message.tagId);
      if (tag) {
        await vscode.commands.executeCommand("pspf.core.upsertEntity", { ...tag, recordStatus: "archived", updatedAt: new Date().toISOString() } satisfies TagEntity);
        await refreshWorkshopSurfaces();
        await refresh();
      }
    }
  });
  await refresh();
}

function renderTagManager(tags: readonly TagEntity[], links: readonly LinkEntity[]): string {
  const linkCounts = new Map<string, number>();
  for (const link of links) {
    if (link.toType === "tag") {
      linkCounts.set(link.toId, (linkCounts.get(link.toId) ?? 0) + 1);
    }
  }
  const rows = tags.map((tag) => ({
    title: tagChipLabel(tag),
    label: tag.label,
    colour: label(tag.colour),
    status: label(tag.recordStatus),
    requirements: linkCounts.get(tag.id) ?? 0,
    action: `<button type="button" data-command="editTag" data-tag-id="${escapeHtml(tag.id)}">Edit</button> ${tag.recordStatus === "archived" ? "" : `<button type="button" data-command="archiveTag" data-tag-id="${escapeHtml(tag.id)}">Archive</button>`}`
  }));
  return shellHtml("PSPF Tag Manager", `
    <section>
      <h1>Tag Manager</h1>
      <p class="muted">Workspace-shared classifications for Requirements. Archived tags stay on historical links but are hidden from pickers.</p>
      ${versionStrip()}
      <div class="form-actions"><button type="button" data-command="createTag">Create tag</button></div>
    </section>
    ${recordTable("Tags", rows, ["title", "label", "colour", "status", "requirements", "action"])}
  `);
}

async function applyTag(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirement = requirementId
    ? allEntities.find((entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === requirementId)
    : await pickRequirement();
  if (!requirement) {
    return;
  }

  let tags = await listTags(false);
  if (tags.length === 0) {
    const created = await createOrEditTag();
    if (!created) {
      return;
    }
    tags = [created];
  }

  const picked = await vscode.window.showQuickPick(
    [
      { label: "$(add) Create new tag...", description: "Create then apply", create: true as const },
      ...tags.map((tag) => ({ label: tagChipLabel(tag), description: label(tag.colour), detail: tag.label, tag }))
    ],
    { title: `Apply tag to ${requirement.title}`, ignoreFocusOut: true }
  );
  if (!picked) {
    return;
  }
  const tag = "create" in picked ? await createOrEditTag() : picked.tag;
  if (!tag) {
    return;
  }

  const links = (await listAllEntities()).filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted");
  const existing = links.find((link) => link.linkType === "tagged-with" && link.fromId === requirement.id && link.toId === tag.id);
  if (existing) {
    await vscode.window.showInformationMessage(`${tag.title} is already applied to ${requirement.title}.`);
    return;
  }
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} tagged with ${tag.title}`,
      linkType: "tagged-with",
      fromId: requirement.id,
      fromType: "requirement",
      toId: tag.id,
      toType: "tag"
    },
    "workshop"
  );
  await vscode.commands.executeCommand("pspf.core.upsertEntity", link);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
}

async function removeTag(requirementId?: string, tagId?: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirement = requirementId
    ? allEntities.find((entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === requirementId)
    : await pickRequirement();
  if (!requirement) {
    return;
  }
  const tagLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with" && entity.fromId === requirement.id);
  if (tagLinks.length === 0) {
    await vscode.window.showWarningMessage("No tags are applied to this Requirement.");
    return;
  }
  const tagsById = new Map(allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag").map((tag) => [tag.id, tag]));
  const link = tagId
    ? tagLinks.find((item) => item.toId === tagId)
    : (await vscode.window.showQuickPick(
      tagLinks.map((item) => ({ label: tagChipLabel(tagsById.get(item.toId)), description: tagsById.get(item.toId)?.label ?? item.toId, link: item })),
      { title: `Remove tag from ${requirement.title}`, ignoreFocusOut: true }
    ))?.link;
  if (!link) {
    return;
  }
  const tag = tagsById.get(link.toId);
  await vscode.commands.executeCommand("pspf.core.upsertEntity", { ...link, recordStatus: "deleted", updatedAt: new Date().toISOString() } satisfies LinkEntity);
  await refreshWorkshopSurfaces();
}

async function filterRequirementsByTag(): Promise<void> {
  await ensureCoreReady();
  const tags = await listTags(false);
  if (tags.length === 0) {
    await vscode.window.showWarningMessage("No active tags exist yet. Run PSPF: Manage Tags first.");
    return;
  }
  const pickedTags = await vscode.window.showQuickPick(
    tags.map((tag) => ({ label: tagChipLabel(tag), description: label(tag.colour), tag })),
    { title: "Filter Requirements by Tag", canPickMany: true, ignoreFocusOut: true }
  );
  if (!pickedTags || pickedTags.length === 0) {
    return;
  }
  const mode = await vscode.window.showQuickPick(
    [
      { label: "Any selected tag", value: "any" as const },
      { label: "All selected tags", value: "all" as const }
    ],
    { title: "Tag filter mode", ignoreFocusOut: true }
  );
  if (!mode) {
    return;
  }
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with");
  const selectedTagIds = new Set(pickedTags.map((item) => item.tag.id));
  const matchingRequirements = requirements.filter((requirement) => {
    const requirementTagIds = new Set(links.filter((link) => link.fromId === requirement.id).map((link) => link.toId));
    return mode.value === "all"
      ? [...selectedTagIds].every((id) => requirementTagIds.has(id))
      : [...selectedTagIds].some((id) => requirementTagIds.has(id));
  });
  if (matchingRequirements.length === 0) {
    await vscode.window.showInformationMessage("No Requirements match that tag filter.");
    return;
  }
  const pickedRequirement = await vscode.window.showQuickPick(
    matchingRequirements.map((requirement) => ({ label: requirement.title, description: `${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)}`, requirement })),
    { title: `${matchingRequirements.length} Requirement(s) match`, ignoreFocusOut: true }
  );
  if (pickedRequirement) {
    await openItemDetailForRequirement(pickedRequirement.requirement);
  }
}

async function manageSavedViews(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfSavedViewManager", "PSPF Saved Views", vscode.ViewColumn.One, { enableScripts: true });
  const refresh = async () => {
    panel.webview.html = renderSavedViewManager(await listSavedViews(true));
  };
  panel.webview.onDidReceiveMessage(async (message: { readonly command?: string; readonly savedViewId?: string; readonly savedViewScope?: SavedViewScope }) => {
    if (message.command === "createSavedView") {
      await createOrEditWorkshopSavedView(message.savedViewScope);
      await refreshWorkshopSurfaces();
      await refresh();
    }
    if (message.command === "editSavedView" && message.savedViewId) {
      const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
      if (savedView) {
        await createOrEditWorkshopSavedView(savedView);
        await refreshWorkshopSurfaces();
        await refresh();
      }
    }
    if (message.command === "archiveSavedView" && message.savedViewId) {
      const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
      if (savedView) {
        await vscode.commands.executeCommand("pspf.core.upsertEntity", { ...savedView, recordStatus: "archived", updatedAt: new Date().toISOString() } satisfies SavedViewEntity);
        await refreshWorkshopSurfaces();
        await refresh();
      }
    }
    if (message.command === "applySavedView" && message.savedViewId) {
      const savedView = (await listSavedViews(false)).find((item) => item.id === message.savedViewId);
      if (savedView) {
        await openWorkshopSavedView(savedView);
      }
    }
  });
  await refresh();
}

function renderSavedViewManager(savedViews: readonly SavedViewEntity[]): string {
  const rows = savedViews.filter((view) => view.scope.startsWith("workshop-")).map((view) => ({
    name: view.name,
    scope: label(view.scope),
    filters: savedViewFilterSummary(view),
    status: label(view.recordStatus),
    action: `<button type="button" data-command="applySavedView" data-saved-view-id="${escapeHtml(view.id)}">Apply</button> <button type="button" data-command="editSavedView" data-saved-view-id="${escapeHtml(view.id)}">Rename</button> ${view.recordStatus === "archived" ? "" : `<button type="button" data-command="archiveSavedView" data-saved-view-id="${escapeHtml(view.id)}">Archive</button>`}`
  }));
  return shellHtml("PSPF Saved Views", `
    <section>
      <h1>Saved Views</h1>
      <p class="muted">Workshop-owned views are convenience planning filters. They export in bundles but other tools may ignore them.</p>
      ${versionStrip()}
      <div class="form-actions">
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-requirements">Create Requirements view</button>
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-dashboard">Create Dashboard view</button>
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-evidence-review">Create Evidence Review view</button>
      </div>
    </section>
    ${recordTable("Workshop Saved Views", rows, ["name", "scope", "filters", "status", "action"])}
  `);
}

async function createOrEditWorkshopSavedView(scopeOrExisting?: SavedViewScope | SavedViewEntity, existing?: SavedViewEntity): Promise<SavedViewEntity | undefined> {
  const editing = typeof scopeOrExisting === "object" ? scopeOrExisting : existing;
  const scope = editing?.scope ?? (typeof scopeOrExisting === "string" ? scopeOrExisting : "workshop-requirements");
  const savedViews = await listSavedViews(true);
  const name = await vscode.window.showInputBox({
    title: editing ? "Rename Saved View" : "Create Saved View",
    prompt: "Saved view name",
    value: editing?.name ?? defaultSavedViewName(scope),
    ignoreFocusOut: true,
    validateInput: (value) => validateSavedViewNameInput(value, savedViews, editing?.id, scope)
  });
  if (!name) {
    return undefined;
  }
  const cleanName = name.normalize("NFC").trim().replace(/\s+/g, " ");
  if (editing) {
    const renamed = { ...editing, title: cleanName, name: cleanName, updatedAt: new Date().toISOString() } satisfies SavedViewEntity;
    await vscode.commands.executeCommand("pspf.core.upsertEntity", renamed);
    await refreshWorkshopSurfaces();
    await vscode.window.showInformationMessage(`Updated saved view: ${renamed.name}.`);
    return renamed;
  }

  const query = await vscode.window.showInputBox({
    title: "Create Saved View",
    prompt: "Optional Requirement search text. Press Enter to skip.",
    ignoreFocusOut: true,
    validateInput: (value) => value.length > SAVED_VIEW_LIMITS.queryMaxLength ? `Use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.` : undefined
  });
  if (query === undefined) {
    return undefined;
  }
  const statuses = await vscode.window.showQuickPick(
    assessmentStatusItems,
    { title: "Optional assessment statuses", canPickMany: true, ignoreFocusOut: true }
  );
  if (statuses === undefined) {
    return undefined;
  }
  const tags = await vscode.window.showQuickPick(
    (await listTags(false)).map((tag) => ({ label: tagChipLabel(tag), description: label(tag.colour), tag })),
    { title: "Optional tags", canPickMany: true, ignoreFocusOut: true }
  );
  if (tags === undefined) {
    return undefined;
  }
  const mode = tags.length > 1 ? await vscode.window.showQuickPick(
    [{ label: "Any selected tag", value: "any" as const }, { label: "All selected tags", value: "all" as const }],
    { title: "Tag filter mode", ignoreFocusOut: true }
  ) : undefined;
  if (tags.length > 1 && !mode) {
    return undefined;
  }
  const savedView = withEnvelope("saved-view", {
    entityType: "saved-view",
    title: cleanName,
    name: cleanName,
    scope,
    filters: {
      query: trimOptional(query),
      assessmentStatuses: statuses.map((item) => item.value),
      tagIds: tags.map((item) => item.tag.id),
      tagsMode: mode?.value ?? "any"
    },
    presentation: { sortKey: "title", sortDirection: "asc", visibleColumns: ["title", "domainId", "assessmentStatus", "tags"] }
  }, "workshop") satisfies SavedViewEntity;
  await vscode.commands.executeCommand("pspf.core.upsertEntity", savedView);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Created saved view: ${savedView.name}.`);
  return savedView;
}

function defaultSavedViewName(scope: SavedViewScope): string {
  if (scope === "workshop-dashboard") {
    return "Planning dashboard view";
  }
  if (scope === "workshop-evidence-review") {
    return "Evidence planning view";
  }
  return "Workshop Requirements view";
}

async function openWorkshopSavedView(savedView: SavedViewEntity): Promise<void> {
  if (savedView.scope === "workshop-dashboard") {
    await openWorkshopDashboardSavedView(savedView);
    return;
  }
  if (savedView.scope === "workshop-evidence-review") {
    await openWorkshopEvidenceReviewSavedView(savedView);
    return;
  }
  await openWorkshopRequirementsView(savedView);
}

async function openWorkshopDashboardSavedView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted");
  const matchingRequirements = requirements.filter((requirement) => savedViewMatchesRequirement(savedView, requirement, links));
  const matchingRequirementIds = new Set(matchingRequirements.map((requirement) => requirement.id));
  const linkedActionIds = new Set(links.filter((link) => link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "action").map((link) => link.toId));
  const linkedRiskIds = new Set(links.filter((link) => link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "risk").map((link) => link.toId));
  const changeLinks = links.filter((link) => link.linkType === "changes" && matchingRequirementIds.has(link.toId));
  const changeIds = new Set(changeLinks.map((link) => link.fromId));
  const actionRows = enrichedEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action" && linkedActionIds.has(entity.id) && !["done", "cancelled"].includes(entity.status))
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      status: label(action.status),
      urgency: action.impact ? label(action.impact.urgency) : "normal",
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
    }));
  const riskRows = allEntities
    .filter((entity): entity is RiskEntity => entity.entityType === "risk" && linkedRiskIds.has(entity.id) && entity.status !== "closed")
    .sort((left, right) => right.likelihood * right.impact - left.likelihood * left.impact)
    .map((risk) => ({ openEntityType: "risk", openEntityId: risk.id, title: risk.title, status: label(risk.status), likelihood: risk.likelihood, impact: risk.impact, severity: risk.likelihood * risk.impact }));
  const changeRows = allEntities
    .filter((entity): entity is ChangeRecordEntity => entity.entityType === "change-record" && changeIds.has(entity.id))
    .sort((left, right) => right.raisedAt.localeCompare(left.raisedAt))
    .map((changeRecord) => ({ openEntityType: "change-record", openEntityId: changeRecord.id, title: changeRecord.title, status: label(changeRecord.status), type: label(changeRecord.changeType), raised: formatDisplayDate(new Date(changeRecord.raisedAt)), summary: changeRecord.summary }));
  const requirementRows = matchingRequirements.map((requirement) => ({ openEntityType: "requirement", openEntityId: requirement.id, title: requirement.title, domain: domainName(requirement.domainId), status: label(requirement.assessmentStatus) }));
  const panel = vscode.window.createWebviewPanel("pspfWorkshopSavedView", shortWorkshopPanelTitle({ entityType: "saved-view", title: savedView.name } as V01Entity), vscode.ViewColumn.One, { enableScripts: true });
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(savedView.name, `
    <section>
      <h1>${escapeHtml(savedView.name)}</h1>
      <p class="muted">Planning dashboard · ${escapeHtml(savedViewFilterSummary(savedView))} · ${matchingRequirements.length} of ${requirements.length} Requirements</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", matchingRequirements.length)}
        ${metricCard("Open actions", actionRows.length)}
        ${metricCard("Open risks", riskRows.length)}
        ${metricCard("Change records", changeRows.length)}
      </div>
    </section>
    ${recordTable("Planning Requirements", requirementRows, ["title", "domain", "status"])}
    ${recordTable("Open Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Open Risks", riskRows, ["title", "status", "likelihood", "impact", "severity"])}
    ${recordTable("Recent Change Records", changeRows, ["title", "status", "type", "raised", "summary"])}
  `);
}

async function openWorkshopEvidenceReviewSavedView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted");
  const matchingRequirements = requirements.filter((requirement) => savedViewMatchesRequirement(savedView, requirement, links));
  const matchingRequirementIds = new Set(matchingRequirements.map((requirement) => requirement.id));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const linkedEvidenceIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "evidence").map((link) => link.toId));
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "evidence").map((link) => link.fromId));
  const missingEvidence = matchingRequirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id))
    .map((requirement) => ({ openEntityType: "requirement", openEntityId: requirement.id, title: requirement.title, domain: domainName(requirement.domainId), status: label(requirement.assessmentStatus) }));
  const evidenceRows = [...linkedEvidenceIds]
    .map((evidenceId) => evidenceById.get(evidenceId))
    .filter((item): item is EvidenceEntity => item !== undefined && item.freshness !== "current")
    .map((item) => ({ openEntityType: "evidence", openEntityId: item.id, title: item.title, freshness: label(item.freshness), reference: item.reference }));
  const panel = vscode.window.createWebviewPanel("pspfWorkshopSavedView", shortWorkshopPanelTitle({ entityType: "saved-view", title: savedView.name } as V01Entity), vscode.ViewColumn.One, { enableScripts: true });
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(savedView.name, `
    <section>
      <h1>${escapeHtml(savedView.name)}</h1>
      <p class="muted">Evidence review planning · ${escapeHtml(savedViewFilterSummary(savedView))} · ${matchingRequirements.length} of ${requirements.length} Requirements</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", matchingRequirements.length)}
        ${metricCard("Missing evidence", missingEvidence.length)}
        ${metricCard("Needs review", evidenceRows.length)}
        ${metricCard("Linked evidence", linkedEvidenceIds.size)}
      </div>
    </section>
    ${recordTable("Requirements Missing Evidence", missingEvidence, ["title", "domain", "status"])}
    ${recordTable("Linked Evidence Needing Review", evidenceRows, ["title", "freshness", "reference"])}
  `);
}

async function openWorkshopRequirementsView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with");
  const tagsById = new Map(allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag").map((tag) => [tag.id, tag]));
  const matchingRequirements = requirements.filter((requirement) => savedViewMatchesRequirement(savedView, requirement, links));
  const rows = matchingRequirements.map((requirement) => ({
    openEntityType: "requirement",
    openEntityId: requirement.id,
    title: requirement.title,
    domain: domainName(requirement.domainId),
    status: label(requirement.assessmentStatus),
    tags: links.filter((link) => link.fromId === requirement.id).map((link) => tagChipLabel(tagsById.get(link.toId))).join(", ") || "None"
  }));
  const panel = vscode.window.createWebviewPanel("pspfWorkshopSavedView", shortWorkshopPanelTitle({ entityType: "saved-view", title: savedView.name } as V01Entity), vscode.ViewColumn.One, { enableScripts: true });
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(savedView.name, `
    <section>
      <h1>${escapeHtml(savedView.name)}</h1>
      <p class="muted">${escapeHtml(savedViewFilterSummary(savedView))} · ${matchingRequirements.length} of ${requirements.length} Requirements</p>
      ${versionStrip()}
    </section>
    ${recordTable("Matching Requirements", rows, ["title", "domain", "status", "tags"])}
  `);
}

function savedViewMatchesRequirement(savedView: SavedViewEntity, requirement: RequirementEntity, links: readonly LinkEntity[]): boolean {
  const filters = savedView.filters;
  const query = filters.query?.trim().toLocaleLowerCase("en-AU");
  if (query && !`${requirement.title} ${requirement.summary ?? ""}`.toLocaleLowerCase("en-AU").includes(query)) {
    return false;
  }
  if ((filters.assessmentStatuses ?? []).length > 0 && !filters.assessmentStatuses?.includes(requirement.assessmentStatus)) {
    return false;
  }
  const tagIds = filters.tagIds ?? [];
  if (tagIds.length > 0) {
    const requirementTagIds = new Set(links.filter((link) => link.fromId === requirement.id).map((link) => link.toId));
    return filters.tagsMode === "all" ? tagIds.every((id) => requirementTagIds.has(id)) : tagIds.some((id) => requirementTagIds.has(id));
  }
  return true;
}

function savedViewFilterSummary(savedView: SavedViewEntity): string {
  const filters = savedView.filters;
  const parts = [];
  if (filters.query) {
    parts.push(`Search: "${filters.query}"`);
  }
  if ((filters.assessmentStatuses ?? []).length > 0) {
    parts.push(`Status: ${filters.assessmentStatuses?.map(label).join(", ")}`);
  }
  if ((filters.tagIds ?? []).length > 0) {
    parts.push(`${filters.tagIds?.length} tag(s) ${label(filters.tagsMode ?? "any")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No filters";
}

function validateSavedViewNameInput(value: string, savedViews: readonly SavedViewEntity[], currentId: string | undefined, scope: SavedViewEntity["scope"]): string | undefined {
  if (!isValidSavedViewName(value)) {
    return `Use 1-${SAVED_VIEW_LIMITS.nameMaxLength} characters.`;
  }
  const normalised = normaliseSavedViewName(value);
  const duplicate = savedViews.find((view) => view.id !== currentId && view.scope === scope && view.recordStatus !== "deleted" && normaliseSavedViewName(view.name) === normalised);
  return duplicate ? `This saved-view name already exists in ${label(scope)}.` : undefined;
}

async function createOrEditTag(existing?: TagEntity): Promise<TagEntity | undefined> {
  const tags = await listTags(true);
  if (!existing && tags.length >= TAG_LIMITS.perWorkspaceHard) {
    await vscode.window.showErrorMessage(`Tag limit reached: maximum ${TAG_LIMITS.perWorkspaceHard} tags per workspace.`);
    return undefined;
  }
  if (!existing && tags.length >= TAG_LIMITS.perWorkspaceSoftWarning) {
    await vscode.window.showWarningMessage(`This workspace has ${tags.length} tags. Consider archiving tags that are no longer active.`);
  }
  const labelInput = await vscode.window.showInputBox({
    title: existing ? "Edit Tag" : "Create Tag",
    prompt: "Tag label",
    value: existing?.label ?? "",
    ignoreFocusOut: true,
    validateInput: (value) => validateTagLabelInput(value, tags, existing?.id)
  });
  if (!labelInput) {
    return undefined;
  }
  const tagLabel = normaliseTagLabel(labelInput);
  const title = await vscode.window.showInputBox({
    title: existing ? "Edit Tag" : "Create Tag",
    prompt: "Display title",
    value: existing?.title ?? labelInput.trim(),
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 || value.trim().length > TAG_LIMITS.titleMaxLength ? `Use 1-${TAG_LIMITS.titleMaxLength} characters.` : undefined
  });
  if (!title) {
    return undefined;
  }
  const colour = await vscode.window.showQuickPick(
    TAG_COLOURS.map((value) => ({ label: label(value), value, picked: value === (existing?.colour ?? DEFAULT_TAG_COLOUR) })),
    { title: "Select Tag Colour", ignoreFocusOut: true }
  );
  if (!colour) {
    return undefined;
  }
  const emoji = await vscode.window.showInputBox({
    title: existing ? "Edit Tag" : "Create Tag",
    prompt: "Optional emoji, one character. Press Enter to skip.",
    value: existing?.emoji ?? "",
    ignoreFocusOut: true,
    validateInput: (value) => isValidSingleGrapheme(value.trim()) ? undefined : "Use a single emoji or leave this blank."
  });
  if (emoji === undefined) {
    return undefined;
  }
  const description = await vscode.window.showInputBox({
    title: existing ? "Edit Tag" : "Create Tag",
    prompt: "Optional sensitive description, not published by default.",
    value: existing?.description ?? "",
    ignoreFocusOut: true,
    validateInput: (value) => value.length > TAG_LIMITS.descriptionMaxLength ? `Use at most ${TAG_LIMITS.descriptionMaxLength} characters.` : undefined
  });
  if (description === undefined) {
    return undefined;
  }
  const tag: TagEntity = existing
    ? { ...existing, label: tagLabel, title: title.trim(), colour: colour.value as TagColour, emoji: trimOptional(emoji), description: trimOptional(description), updatedAt: new Date().toISOString() }
    : withEnvelope("tag", { entityType: "tag", label: tagLabel, title: title.trim(), colour: colour.value as TagColour, emoji: trimOptional(emoji), description: trimOptional(description) }, "workshop");
  await vscode.commands.executeCommand("pspf.core.upsertEntity", tag);
  await vscode.window.showInformationMessage(`${existing ? "Updated" : "Created"} tag: ${tag.title}.`);
  return tag;
}

function validateTagLabelInput(value: string, tags: readonly TagEntity[], currentId?: string): string | undefined {
  if (!isValidTagLabel(value)) {
    return `Use 1-${TAG_LIMITS.labelMaxLength} letters, digits, spaces, hyphens, or apostrophes.`;
  }
  const normalised = normaliseTagLabel(value);
  const duplicate = tags.find((tag) => tag.id !== currentId && normaliseTagLabel(tag.label) === normalised);
  return duplicate ? `This label already exists on ${duplicate.title}.` : undefined;
}

async function listTags(includeArchived: boolean): Promise<TagEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "tag");
  return sortTags((entities ?? []).filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted" && (includeArchived || entity.recordStatus !== "archived")));
}

async function listSavedViews(includeArchived: boolean): Promise<SavedViewEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "saved-view");
  return (entities ?? [])
    .filter((entity): entity is SavedViewEntity => entity.entityType === "saved-view" && entity.recordStatus !== "deleted" && (includeArchived || entity.recordStatus !== "archived"))
    .sort((left, right) => left.scope.localeCompare(right.scope, "en-AU") || left.name.localeCompare(right.name, "en-AU", { sensitivity: "base" }));
}

function sortTags(tags: readonly TagEntity[]): TagEntity[] {
  return [...tags].sort(compareTags);
}

function compareTags(left: TagEntity, right: TagEntity): number {
  return left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }) || left.id.localeCompare(right.id);
}

function tagChipLabel(tag: TagEntity | undefined): string {
  if (!tag) {
    return "Unknown tag";
  }
  return `${tag.emoji ? `${tag.emoji} ` : ""}${tag.title}`;
}

async function copyPostureBrief(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
  const brief = renderPostureBriefMarkdown({
    generatedAt: new Date(),
    requirements,
    evidence,
    actions,
    risks,
    links,
    directions,
    domains: PSPF_DOMAINS,
    sourceLabel: "PSPF Workshop"
  });

  await vscode.env.clipboard.writeText(brief);
  await vscode.window.showInformationMessage("PSPF posture brief copied to clipboard.");
}

async function listAllEntities(): Promise<V01Entity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  return entities ?? [];
}

type RequirementNavigationDirection = "previous" | "next";
type LinkableItemType = "evidence" | "action" | "risk" | "direction";
type LinkableExistingEntity = EvidenceEntity | ActionEntity | RiskEntity | DirectionEntity;

function isRequirementNavigationDirection(value: string | undefined): value is RequirementNavigationDirection {
  return value === "previous" || value === "next";
}

async function openAdjacentRequirement(requirementId: string, direction: RequirementNavigationDirection): Promise<void> {
  await ensureCoreReady();
  const requirements = (await listRequirements())
    .filter((requirement) => requirement.recordStatus !== "deleted")
    .sort(compareRequirementsForPicker);
  const currentIndex = requirements.findIndex((requirement) => requirement.id === requirementId);
  if (currentIndex < 0) {
    await vscode.window.showWarningMessage("This Requirement no longer exists. Choose another Requirement.");
    return;
  }
  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  const adjacentRequirement = requirements[nextIndex];
  if (!adjacentRequirement) {
    await vscode.window.showInformationMessage(direction === "next" ? "Already at the last Requirement." : "Already at the first Requirement.");
    return;
  }
  await openItemDetailForRequirement(adjacentRequirement);
}

async function openAdjacentDirection(directionId: string, navigationDirection: RequirementNavigationDirection): Promise<void> {
  await ensureCoreReady();
  const directions = (await listDirections())
    .filter((direction) => direction.recordStatus !== "deleted")
    .sort(compareDirectionsForPicker);
  const currentIndex = directions.findIndex((direction) => direction.id === directionId);
  if (currentIndex < 0) {
    await vscode.window.showWarningMessage("This Direction no longer exists. Choose another Direction.");
    return;
  }
  const nextIndex = navigationDirection === "next" ? currentIndex + 1 : currentIndex - 1;
  const adjacentDirection = directions[nextIndex];
  if (!adjacentDirection) {
    await vscode.window.showInformationMessage(navigationDirection === "next" ? "Already at the last Direction." : "Already at the first Direction.");
    return;
  }
  await openItemDetailForDirection(adjacentDirection);
}

async function linkExistingItemToRequirement(requirementId: string | undefined, itemType: LinkableItemType): Promise<void> {
  await ensureCoreReady();
  const requirement = requirementId ? (await listRequirements()).find((item) => item.id === requirementId) : await pickRequirement();
  if (!requirement) {
    await vscode.window.showWarningMessage(`Choose a Requirement before linking existing ${label(itemType)}.`);
    return;
  }
  const allEntities = await listAllEntities();
  const activeLinks = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted");
  const linkType = linkTypeForExistingItem(itemType);
  const alreadyLinkedIds = new Set(activeLinks
    .filter((link) => isExistingItemLinkForRequirement(link, requirement.id, itemType, linkType))
    .map((link) => itemType === "direction" ? link.fromId : link.toId));
  const candidates = allEntities
    .filter((entity): entity is LinkableExistingEntity => entity.entityType === itemType && entity.recordStatus !== "deleted" && !alreadyLinkedIds.has(entity.id))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(`No unlinked ${label(itemType).toLowerCase()} records are available for this Requirement.`);
    return;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((entity) => ({
      label: entity.title,
      description: existingItemDescription(entity, activeLinks),
      detail: entity.id,
      entity
    })),
    { title: `Link Existing ${label(itemType)}`, placeHolder: `Select one or more ${label(itemType).toLowerCase()} records to link`, canPickMany: true, ignoreFocusOut: true }
  );
  if (!picked || picked.length === 0) {
    return;
  }
  const links = picked.map(({ entity }) => withEnvelope(
    "link",
    {
      entityType: "link",
      title: itemType === "direction" ? `${entity.title} targets ${requirement.title}` : `${requirement.title} ${linkPhraseForExistingItem(itemType)} ${entity.title}`,
      linkType,
      fromId: itemType === "direction" ? entity.id : requirement.id,
      fromType: itemType === "direction" ? "direction" : "requirement",
      toId: itemType === "direction" ? requirement.id : entity.id,
      toType: itemType === "direction" ? "requirement" : itemType
    },
    "workshop"
  ));
  await vscode.commands.executeCommand("pspf.core.upsertEntities", links);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
}

function linkTypeForExistingItem(itemType: LinkableItemType): LinkEntity["linkType"] {
  if (itemType === "direction") {
    return "targets";
  }
  if (itemType === "evidence") {
    return "supported-by";
  }
  if (itemType === "action") {
    return "addressed-by";
  }
  return "exposed-by";
}

function linkPhraseForExistingItem(itemType: LinkableItemType): string {
  if (itemType === "direction") {
    return "targeted by";
  }
  if (itemType === "evidence") {
    return "supported by";
  }
  if (itemType === "action") {
    return "addressed by";
  }
  return "exposed by";
}

function existingItemDescription(entity: LinkableExistingEntity, activeLinks: readonly LinkEntity[]): string {
  const linkedRequirementCount = activeLinks.filter((link) => entity.entityType === "direction" ? link.fromId === entity.id && link.toType === "requirement" : link.toId === entity.id && link.fromType === "requirement").length;
  const linkedText = `${linkedRequirementCount} linked Requirement${linkedRequirementCount === 1 ? "" : "s"}`;
  if (entity.entityType === "direction") {
    return `${entity.reference} · ${label(entity.responseState)} · ${linkedText}`;
  }
  if (entity.entityType === "evidence") {
    return `${label(entity.evidenceType)} · ${label(entity.freshness)} · ${linkedText}`;
  }
  if (entity.entityType === "action") {
    return `${label(entity.status)} · ${formatShortAuDateTime(entity.dueDate) ?? "No due date"} · ${linkedText}`;
  }
  return `${label(entity.status)} · likelihood ${entity.likelihood} · impact ${entity.impact} · ${linkedText}`;
}

function isExistingItemLinkForRequirement(link: LinkEntity, requirementId: string, itemType: LinkableItemType, linkType: LinkEntity["linkType"]): boolean {
  if (itemType === "direction") {
    return link.toId === requirementId && link.toType === "requirement" && link.fromType === "direction" && link.linkType === linkType;
  }
  return link.fromId === requirementId && link.fromType === "requirement" && link.toType === itemType && link.linkType === linkType;
}

async function ensureCoreReady(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.ensureWorkspaceReady");
}

async function refreshWorkshopSurfaces(): Promise<void> {
  await homeViewProvider?.refresh();
}

async function pickRequirement(): Promise<RequirementEntity | undefined> {
  await ensureCoreReady();
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "requirement");
  const requirements = (entities ?? []).filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  if (requirements.length === 0) {
    await vscode.window.showWarningMessage("Create a Requirement before adding evidence, actions, or risks.");
    return undefined;
  }

  const recentRequirementId = getRecentRequirementId();
  const picked = await vscode.window.showQuickPick(
    [...requirements]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((requirement) => {
        const domain = PSPF_DOMAINS.find((item) => item.id === requirement.domainId);
        const isRecent = requirement.id === recentRequirementId;
        return {
          label: requirement.title,
          description: `${isRecent ? "Recent · " : ""}${domain?.title ?? requirement.domainId} · ${label(requirement.assessmentStatus)}`,
          detail: `Created ${formatDisplayDate(new Date(requirement.createdAt))} · ${requirement.id}`,
          picked: isRecent,
          requirement
        };
      }),
    { title: "Select Requirement", placeHolder: "Choose the requirement to link this record to", ignoreFocusOut: true }
  );
  if (picked?.requirement) {
    await rememberRequirement(picked.requirement);
  }
  return picked?.requirement;
}

async function pickRequirementsForLinkedItem(itemType: "evidence" | "action" | "risk"): Promise<RequirementEntity[]> {
  const requirements = await listRequirements();
  if (requirements.length === 0) {
    await vscode.window.showWarningMessage(`Create a Requirement before adding ${label(itemType)}.`);
    return [];
  }

  const browseMode = await vscode.window.showQuickPick(
    [
      { label: "All Requirements", description: "Search and select across every Requirement", value: "all" },
      { label: "Browse by domain", description: "Choose one or more PSPF domains first", value: "domain" },
      { label: "Browse by assessment status", description: "Choose one or more status values first", value: "status" },
      { label: "Requirements missing evidence", description: "Only Requirements without linked evidence", value: "missing-evidence" }
    ],
    { title: "Choose Requirement Set", placeHolder: `Narrow the list before linking ${label(itemType).toLowerCase()}`, ignoreFocusOut: true }
  );
  if (!browseMode) {
    return [];
  }

  let candidates = requirements;
  if (browseMode.value === "domain") {
    const pickedDomains = await vscode.window.showQuickPick(
      PSPF_DOMAINS.map((domain) => ({ label: domain.title, description: domain.id, domainId: domain.id })),
      { title: "Select Domains", placeHolder: "Choose one or more domains", canPickMany: true, ignoreFocusOut: true }
    );
    if (!pickedDomains || pickedDomains.length === 0) {
      return [];
    }
    const domainIds = new Set(pickedDomains.map((domain) => domain.domainId));
    candidates = requirements.filter((requirement) => domainIds.has(requirement.domainId));
  }
  if (browseMode.value === "status") {
    const statuses = [...new Set(requirements.map((requirement) => requirement.assessmentStatus))].sort((left, right) => label(left).localeCompare(label(right)));
    const pickedStatuses = await vscode.window.showQuickPick(
      statuses.map((status) => ({ label: label(status), description: status, status })),
      { title: "Select Assessment Statuses", placeHolder: "Choose one or more statuses", canPickMany: true, ignoreFocusOut: true }
    );
    if (!pickedStatuses || pickedStatuses.length === 0) {
      return [];
    }
    const selectedStatuses = new Set(pickedStatuses.map((status) => status.status));
    candidates = requirements.filter((requirement) => selectedStatuses.has(requirement.assessmentStatus));
  }
  if (browseMode.value === "missing-evidence") {
    const entities = await listAllEntities();
    const supportedRequirementIds = new Set(entities
      .filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.linkType === "supported-by" && entity.fromType === "requirement" && entity.toType === "evidence")
      .map((link) => link.fromId));
    candidates = requirements.filter((requirement) => !supportedRequirementIds.has(requirement.id));
  }

  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(`No Requirements match that ${label(itemType).toLowerCase()} filter.`);
    return [];
  }

  const recentRequirementId = getRecentRequirementId();
  const pickedRequirements = await vscode.window.showQuickPick(
    candidates
      .sort(compareRequirementsForPicker)
      .map((requirement) => {
        const domain = PSPF_DOMAINS.find((item) => item.id === requirement.domainId);
        const isRecent = requirement.id === recentRequirementId;
        return {
          label: requirement.title,
          description: `${isRecent ? "Recent · " : ""}${domain?.title ?? requirement.domainId} · ${label(requirement.assessmentStatus)}`,
          detail: requirement.id,
          picked: isRecent,
          requirement
        };
      }),
    { title: `Link ${label(itemType)} to Requirements`, placeHolder: `Select every Requirement this ${label(itemType).toLowerCase()} applies to`, canPickMany: true, ignoreFocusOut: true }
  );
  return pickedRequirements?.map((item) => item.requirement) ?? [];
}

async function requirementSelectionForScopedCommand(requirementId: string, itemType: "evidence" | "action" | "risk"): Promise<RequirementEntity[]> {
  const requirement = (await listRequirements()).find((item) => item.id === requirementId);
  if (!requirement) {
    await vscode.window.showWarningMessage(`This Requirement no longer exists. Choose another Requirement before adding ${label(itemType)}.`);
    return [];
  }
  await rememberRequirement(requirement);
  return [requirement];
}

async function listRequirements(): Promise<RequirementEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "requirement");
  return (entities ?? []).filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
}

function compareRequirementsForPicker(left: RequirementEntity, right: RequirementEntity): number {
  const leftDomain = PSPF_DOMAINS.findIndex((domain) => domain.id === left.domainId);
  const rightDomain = PSPF_DOMAINS.findIndex((domain) => domain.id === right.domainId);
  if (leftDomain !== rightDomain) {
    return leftDomain - rightDomain;
  }
  return left.title.localeCompare(right.title);
}

function compareDirectionsForPicker(left: DirectionEntity, right: DirectionEntity): number {
  return left.reference.localeCompare(right.reference, "en-AU", { sensitivity: "base", numeric: true })
    || left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" })
    || left.id.localeCompare(right.id);
}

async function pickOptionalRequirement(prompt: string): Promise<RequirementEntity | undefined> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "requirement");
  const requirements = (entities ?? []).filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  if (requirements.length === 0) {
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    [
      { label: "$(circle-slash) No requirement link", description: "Register without linking", requirement: undefined as RequirementEntity | undefined },
      ...[...requirements]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((requirement) => ({
          label: requirement.title,
          description: `${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)}`,
          requirement
        }))
    ],
    { title: prompt, placeHolder: "Optionally link to a requirement", ignoreFocusOut: true }
  );
  return picked?.requirement;
}

async function listDirections(): Promise<DirectionEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "direction");
  return (entities ?? []).filter((entity): entity is DirectionEntity => entity.entityType === "direction");
}

async function listSourceControls(): Promise<SourceControlEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "source-control");
  return (entities ?? []).filter((entity): entity is SourceControlEntity => entity.entityType === "source-control");
}

async function pickSourceControl(): Promise<SourceControlEntity | undefined> {
  const sourceControls = await listSourceControls();
  if (sourceControls.length === 0) {
    await vscode.window.showWarningMessage("No ISM source controls are loaded. Run PSPF: Initialise PSPF Workspace and try again.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    sourceControls.map((sourceControl) => ({
      label: `${sourceControl.controlId}: ${sourceControl.title}`,
      description: sourceControl.profileTags.join(", "),
      detail: `OSCAL release ${sourceControl.provenance.oscalRelease} · ${sourceControl.statement}`,
      sourceControl
    })),
    { title: "Select ISM Source Control", placeHolder: "Choose the ISM control this requirement maps to", ignoreFocusOut: true }
  );
  return picked?.sourceControl;
}

function buildValidationHints(
  requirements: readonly RequirementEntity[],
  actions: readonly ActionEntity[],
  risks: readonly RiskEntity[],
  links: readonly LinkEntity[]
): readonly { readonly openEntityType: "requirement"; readonly openEntityId: string; readonly priority: string; readonly requirement: string; readonly hint: string }[] {
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.fromId));
  const openActionIds = new Set(actions.filter((action) => !["done", "cancelled"].includes(action.status)).map((action) => action.id));
  const openRiskIds = new Set(risks.filter((risk) => risk.status !== "closed").map((risk) => risk.id));
  const actionRequirementIds = new Set(links.filter((link) => link.linkType === "addressed-by" && openActionIds.has(link.toId)).map((link) => link.fromId));
  const riskRequirementIds = new Set(links.filter((link) => link.linkType === "exposed-by" && openRiskIds.has(link.toId)).map((link) => link.fromId));
  const rows: { openEntityType: "requirement"; openEntityId: string; priority: string; requirement: string; hint: string }[] = [];

  for (const requirement of requirements) {
    if (!evidenceRequirementIds.has(requirement.id)) {
      rows.push({ openEntityType: "requirement", openEntityId: requirement.id, priority: "High", requirement: requirement.title, hint: "No evidence linked yet." });
    }
    if (["in-progress", "partially-met", "not-met", "under-review"].includes(requirement.assessmentStatus) && !actionRequirementIds.has(requirement.id)) {
      rows.push({ openEntityType: "requirement", openEntityId: requirement.id, priority: "Medium", requirement: requirement.title, hint: "No open action linked to this non-final assessment." });
    }
    if (riskRequirementIds.has(requirement.id) && !actionRequirementIds.has(requirement.id)) {
      rows.push({ openEntityType: "requirement", openEntityId: requirement.id, priority: "Medium", requirement: requirement.title, hint: "Open risk has no linked open action." });
    }
  }

  return rows.slice(0, 10);
}

function getRecentRequirementId(): string | undefined {
  return workshopContext?.workspaceState.get<string>(recentRequirementKey);
}

async function rememberRequirement(requirement: RequirementEntity): Promise<void> {
  await workshopContext?.workspaceState.update(recentRequirementKey, requirement.id);
}

async function pickScore(title: string): Promise<number | undefined> {
  const picked = await vscode.window.showQuickPick(
    [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value })),
    { title, ignoreFocusOut: true }
  );
  return picked?.value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function commercialContextSection(target: RequirementEntity | ActionEntity | RiskEntity, allEntities: readonly V01Entity[]): string {
  const entityById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const rows = allEntities
    .filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted")
    .filter((link) => isCommercialContextLink(link, target))
    .map((link) => commercialContextRow(entityById.get(link.fromId), link))
    .filter((row): row is { relationship: string; type: string; title: string; status: string; context: string } => row !== undefined);
  return recordTable("Commercial Context", rows, ["relationship", "type", "title", "status", "context"]);
}

function isCommercialContextLink(link: LinkEntity, target: RequirementEntity | ActionEntity | RiskEntity): boolean {
  if (target.entityType === "requirement") {
    return link.toId === target.id && link.linkType === "supports" && (link.fromType === "supplier" || link.fromType === "contract" || link.fromType === "spend-item");
  }
  if (target.entityType === "action") {
    return link.toId === target.id && link.linkType === "supports" && link.fromType === "spend-item";
  }
  return link.toId === target.id && link.linkType === "associated-with" && link.fromType === "supplier";
}

function commercialContextRow(entity: V01Entity | undefined, link: LinkEntity): { relationship: string; type: string; title: string; status: string; context: string } | undefined {
  if (!entity || entity.recordStatus === "deleted") {
    return undefined;
  }
  if (entity.entityType === "supplier") {
    return commercialRow(link.linkType, "Supplier", entity.name, entity.status, `Criticality: ${label(entity.criticality)}`);
  }
  if (entity.entityType === "contract") {
    return commercialRow(link.linkType, "Contract", entity.title, entity.status, entity.endsAt ? `Ends: ${entity.endsAt}` : "No end date recorded");
  }
  if (entity.entityType === "spend-item") {
    return commercialRow(link.linkType, "Spend item", entity.title, entity.status, `${entity.financialYear}; confidence ${label(entity.confidence ?? "not-recorded")}`);
  }
  return undefined;
}

function commercialRow(relationship: string, type: string, title: string, status: string, context: string): { relationship: string; type: string; title: string; status: string; context: string } {
  return { relationship: label(relationship), type, title, status: label(status), context };
}

function recordTable(title: string, records: readonly object[], fields: readonly string[]): string {
  if (records.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="muted">No records linked yet.</p></section>`;
  }
  const hasOpenEntity = records.some((record) => typeof readRecordField(record, "openEntityId") === "string" && typeof readRecordField(record, "openEntityType") === "string");
  const actionHeader = hasOpenEntity ? `<th data-field="open">Open</th>` : "";
  const header = `${actionHeader}${fields.map((field) => `<th data-field="${escapeHtml(field)}">${escapeHtml(label(field))}</th>`).join("")}`;
  const rows = records.map((record) => `<tr>${hasOpenEntity ? tableOpenCell(record) : ""}${fields.map((field) => tableCell(record, field)).join("")}</tr>`).join("");
  return `<section><h2>${escapeHtml(title)}</h2><div class="table-wrap" tabindex="0" aria-label="Scrollable ${escapeHtml(title)} table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function requirementNavigationStrip(requirement: RequirementEntity, allEntities: readonly V01Entity[]): string {
  const requirements = allEntities
    .filter((entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted")
    .sort(compareRequirementsForPicker);
  const index = requirements.findIndex((candidate) => candidate.id === requirement.id);
  const position = index >= 0 ? `${index + 1} of ${requirements.length}` : "Not in current list";
  return `<div class="form-actions" aria-label="Requirement navigation">
    <button type="button" data-command="openAdjacentRequirement" data-requirement-id="${escapeHtml(requirement.id)}" data-direction="previous">Previous requirement</button>
    <button type="button" data-command="openAdjacentRequirement" data-requirement-id="${escapeHtml(requirement.id)}" data-direction="next">Next requirement</button>
    <span class="version-pill">${escapeHtml(position)}</span>
  </div>`;
}

function directionNavigationStrip(direction: DirectionEntity, allEntities: readonly V01Entity[]): string {
  const directions = allEntities
    .filter((entity): entity is DirectionEntity => entity.entityType === "direction" && entity.recordStatus !== "deleted")
    .sort(compareDirectionsForPicker);
  const index = directions.findIndex((candidate) => candidate.id === direction.id);
  const position = index >= 0 ? `${index + 1} of ${directions.length}` : "Not in current list";
  return `<div class="form-actions" aria-label="Direction navigation">
    <button type="button" data-command="openAdjacentDirection" data-direction-id="${escapeHtml(direction.id)}" data-direction="previous">Previous Direction</button>
    <button type="button" data-command="openAdjacentDirection" data-direction-id="${escapeHtml(direction.id)}" data-direction="next">Next Direction</button>
    <span class="version-pill">${escapeHtml(position)}</span>
  </div>`;
}

function tableOpenCell(record: object): string {
  const entityId = readRecordField(record, "openEntityId");
  const entityType = readRecordField(record, "openEntityType");
  if (typeof entityId !== "string" || typeof entityType !== "string") {
    return `<td data-field="open"></td>`;
  }
  return `<td data-field="open"><button type="button" data-command="openEntity" data-entity-type="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entityId)}">Open</button></td>`;
}

function tableCell(record: object, field: string): string {
  const value = String(readRecordField(record, field) ?? "");
  if (field === "action") {
    return `<td data-field="${escapeHtml(field)}">${value}</td>`;
  }
  if (field === "explanation") {
    const fullValue = String(readRecordField(record, "explanationFull") ?? value);
    return `<td data-field="${escapeHtml(field)}" title="${escapeHtml(fullValue)}"><span class="cell-compact">${escapeHtml(value)}</span></td>`;
  }
  return `<td data-field="${escapeHtml(field)}">${escapeHtml(value)}</td>`;
}

function summariseImpactExplanation(explanation: readonly string[]): string {
  if (explanation.length <= 1) {
    return explanation[0] ?? "No linked impact signals";
  }
  return `${explanation[0]} (+${explanation.length - 1} more)`;
}

function versionStrip(): string {
  return `<div class="version-strip" aria-label="PSPF version context"><span class="version-pill">PSPF v${PSPF_SLICE_VERSION}</span><span class="version-pill">Schema ${VERSION_AXES.schemaVersion}</span><span class="version-pill">API ${VERSION_AXES.apiVersion}</span></div>`;
}

function metricCard(label: string, value: number | string): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function directionChips(counts: Record<DirectionResponseState, number>): string {
  const order: DirectionResponseState[] = ["not-set", "yes", "no", "risk-managed"];
  return order
    .map((state) => `<span class="version-pill">${escapeHtml(label(state))}: ${counts[state] ?? 0}</span>`)
    .join(" ");
}

function domainName(domainId: string): string {
  return PSPF_DOMAINS.find((domain) => domain.id === domainId)?.title ?? domainId;
}

function readRecordField(record: object, field: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, field) ? (record as { readonly [key: string]: unknown })[field] : undefined;
}

function label(value: string): string {
  return value.replaceAll("-", " ").replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

const assessmentStatusItems: readonly { readonly label: string; readonly value: AssessmentStatus }[] = [
  { label: "Not started", value: "not-started" },
  { label: "In progress", value: "in-progress" },
  { label: "Met", value: "met" },
  { label: "Partially met", value: "partially-met" },
  { label: "Not met", value: "not-met" },
  { label: "Not applicable", value: "not-applicable" },
  { label: "Under review", value: "under-review" }
];

const directionResponseStateItems: readonly { readonly label: string; readonly value: DirectionResponseState }[] = [
  { label: "Not set", value: "not-set" },
  { label: "Yes — complying", value: "yes" },
  { label: "No — not complying", value: "no" },
  { label: "Risk managed", value: "risk-managed" }
];

const changeRecordTypeItems: readonly { readonly label: string; readonly value: ChangeRecordType }[] = CHANGE_RECORD_TYPES.map((value) => ({ label: label(value), value }));

const changeRecordStatusItems: readonly { readonly label: string; readonly value: ChangeRecordStatus }[] = CHANGE_RECORD_STATUSES.map((value) => ({ label: label(value), value }));

const changeRecordPersistenceItems: readonly { readonly label: string; readonly value: ChangeRecordPersistence }[] = CHANGE_RECORD_PERSISTENCE.map((value) => ({ label: label(value), value }));

const changeRecordSourceItems: readonly { readonly label: string; readonly value: ChangeRecordSource }[] = CHANGE_RECORD_SOURCES.map((value) => ({ label: label(value), value }));

const evidenceTypeItems = [
  { label: "Document", value: "document" },
  { label: "URL", value: "url" },
  { label: "Note", value: "note" }
] as const;

const freshnessItems: readonly { readonly label: string; readonly value: EvidenceFreshness }[] = [
  { label: "Current", value: "current" },
  { label: "Ageing", value: "ageing" },
  { label: "Stale", value: "stale" },
  { label: "Expired", value: "expired" },
  { label: "Unknown", value: "unknown" }
];

const actionStatusItems: readonly { readonly label: string; readonly value: ActionStatus }[] = [
  { label: "Todo", value: "todo" },
  { label: "In progress", value: "in-progress" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" }
];

const riskStatusItems: readonly { readonly label: string; readonly value: RiskStatus }[] = [
  { label: "Open", value: "open" },
  { label: "Monitored", value: "monitored" },
  { label: "Closed", value: "closed" }
];

const coverageQualifierItems = [
  { label: "Primary", value: "primary" },
  { label: "Partial", value: "partial" },
  { label: "Compensating", value: "compensating" }
] as const;

const confidenceItems: readonly { readonly label: string; readonly value: MappingConfidence; readonly description?: string; readonly picked?: boolean }[] = [
  { label: "High", value: "high", description: "Direct, stable mapping" },
  { label: "Medium", value: "medium", description: "Good working assumption", picked: true },
  { label: "Low", value: "low", description: "Needs review or weak fit" }
];

function statementChangeLabel(status: SourceControlEntity["statementChangeStatus"] | undefined): string {
  switch (status) {
    case "changed":
      return "Review current";
    case "new":
      return "New control";
    case "removed":
      return "Removed upstream";
    case "unchanged":
    default:
      return "Current";
  }
}

function profileItems(sourceControl: SourceControlEntity): readonly { readonly label: string; readonly value: string }[] {
  return ["all", ...sourceControl.profileTags].map((profile) => ({ label: label(profile), value: profile }));
}