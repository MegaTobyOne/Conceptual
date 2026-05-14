import * as vscode from "vscode";
import { renderPostureBriefMarkdown } from "@pspf/brief-renderer";
import {
  PSPF_SLICE_VERSION,
  PSPF_DOMAINS,
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
  type SourceControlEntity,
  type V01Entity,
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
    vscode.commands.registerCommand("pspf.workshop.openAssessmentDashboard", openAssessmentDashboard),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceReviewQueue", openEvidenceReviewQueue),
    vscode.commands.registerCommand("pspf.workshop.openItemDetail", openItemDetail),
    vscode.commands.registerCommand("pspf.workshop.browseIsmSourceControls", browseIsmSourceControls),
    vscode.commands.registerCommand("pspf.workshop.createRequirementControlMapping", createRequirementControlMapping),
    vscode.commands.registerCommand("pspf.workshop.registerDirection", registerDirection),
    vscode.commands.registerCommand("pspf.workshop.updateDirectionResponse", updateDirectionResponse),
    vscode.commands.registerCommand("pspf.workshop.openDirectionDetail", openDirectionDetail),
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
      void this.handleMessage(message.command);
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
      "pspf.workshop.openEvidenceReviewQueue",
      "pspf.workshop.openItemDetail",
      "pspf.workshop.registerDirection",
      "pspf.workshop.updateDirectionResponse",
      "pspf.workshop.openDirectionDetail",
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
    <section>
      <h2>Workspace</h2>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", model.counts.requirements)}
        ${metricCard("Evidence", model.counts.evidence)}
        ${metricCard("Actions", model.counts.actions)}
        ${metricCard("Risks", model.counts.risks)}
        ${metricCard("Directions", model.counts.directions)}
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
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
    main { padding: 12px; }
    section { border: 1px solid var(--vscode-sideBarSectionHeader-border); border-radius: 6px; padding: 10px; margin-bottom: 10px; background: var(--vscode-editor-background); }
    h2 { font-size: 13px; line-height: 1.3; margin: 0 0 8px; text-transform: uppercase; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; }
    .metric { border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 8px; background: var(--vscode-input-background); }
    .metric span { color: var(--vscode-descriptionForeground); display: block; font-size: 11px; }
    .metric strong { display: block; font-size: 20px; line-height: 1.2; margin-top: 2px; }
    .action-list { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .action-list.compact { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
    button { width: 100%; min-width: 0; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; padding: 7px 8px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; cursor: pointer; text-align: left; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .button-title { display: block; overflow-wrap: anywhere; }
    .button-description { display: block; margin-top: 2px; color: var(--vscode-button-secondaryForeground, var(--vscode-descriptionForeground)); font-size: 11px; line-height: 1.3; }
    .version-strip { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .version-pill { border: 1px solid var(--vscode-input-border); border-radius: 999px; padding: 2px 6px; color: var(--vscode-descriptionForeground); background: var(--vscode-input-background); font-size: 11px; white-space: nowrap; line-height: 1.4; }
  </style>
</head>
<body>
  <main>${body}</main>
  <script>
    const vscode = acquireVsCodeApi();
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
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(`Requirement created: ${requirement.title}`, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function attachEvidence(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "Attach Evidence",
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
    title: "Attach Evidence",
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
  const link = withEnvelope(
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
  );

  await upsertLinkedEntity(evidence, link, requirement);
}

async function createAction(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

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
    prompt: "Due date, for example 30 Jun 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (dueDate === undefined) {
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
  const link = withEnvelope(
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
  );

  await upsertLinkedEntity(action, link, requirement);
}

async function createRisk(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

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
  const link = withEnvelope(
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
  );

  await upsertLinkedEntity(risk, link, requirement);
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

async function createRequirementControlMapping(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
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
  await vscode.window.showInformationMessage(`Direction registered: ${direction.reference} ${direction.title}`);
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
  await vscode.window.showInformationMessage(`Direction ${updated.reference} response set to ${label(updated.responseState)}.`);
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
      <div class="form-actions"><button type="button" data-command="openEntity" data-entity-type="direction" data-entity-id="${escapeHtml(direction.id)}">Edit</button></div>
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
      <div class="form-actions"><button type="button" data-command="openEntity" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Edit</button></div>
    </section>
    ${recordTable("Directions Targeting This Requirement", directionRows, ["reference", "title", "responseState", "sourceAuthority"])}
    ${recordTable("Evidence", evidenceRows, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Risks", riskRows, ["title", "status", "likelihood", "impact"])}
    ${recordTable("ISM Mappings", mappings, ["controlId", "title", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"])}
    ${recordTable("Relationships", relationships, ["title", "relationship", "targetType", "target"])}
  `);
}

type SaveEntityMessage = {
  readonly command?: "saveEntity" | "saveAndCloseEntity";
  readonly entityType?: string;
  readonly entityId?: string;
  readonly fields?: Record<string, string>;
};

type EditableWorkshopEntity = RequirementEntity | EvidenceEntity | ActionEntity | RiskEntity | DirectionEntity | RequirementControlMappingEntity;

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
  return ["requirement", "evidence", "action", "risk", "direction", "requirement-control-mapping"].includes(entity.entityType);
}

async function openEntityEditor(entity: EditableWorkshopEntity, allEntities: readonly V01Entity[]): Promise<void> {
  let currentEntity = entity;
  const panel = vscode.window.createWebviewPanel("pspfEntityDetail", shortWorkshopPanelTitle(currentEntity), vscode.ViewColumn.One, { enableScripts: true });
  panel.webview.onDidReceiveMessage(async (message: SaveEntityMessage) => {
    if (!["saveEntity", "saveAndCloseEntity"].includes(message.command ?? "") || message.entityType !== currentEntity.entityType || message.entityId !== currentEntity.id) {
      return;
    }
    const updated = await buildUpdatedEntity(currentEntity, message.fields ?? {});
    if (!updated) {
      return;
    }
    await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
    currentEntity = updated;
    panel.title = shortWorkshopPanelTitle(updated);
    if (message.command === "saveAndCloseEntity") {
      panel.dispose();
      void vscode.window.showInformationMessage(`${label(updated.entityType)} updated: ${updated.title ?? updated.id}`);
      return;
    }
    void vscode.window.showInformationMessage(`${label(updated.entityType)} updated: ${updated.title ?? updated.id}`);
    panel.webview.html = shellHtml(updated.title ?? updated.id, renderEntityEditor(updated, allEntities));
  });
  panel.webview.html = shellHtml(entity.title ?? entity.id, renderEntityEditor(entity, allEntities));
}

function shellHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #f4f4f5; background: #111113; }
    header { background: #18181b; color: #fafafa; border-bottom: 1px solid #3f3f46; padding: 12px 20px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    main { max-width: 920px; margin: 0 auto; padding: 20px; }
    section { background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 14px; margin-bottom: 14px; }
    h1 { margin-bottom: 6px; }
    h2 { font-size: 18px; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .metric { border: 1px solid #3f3f46; border-radius: 6px; padding: 10px; background: #202024; }
    .metric span { color: #a1a1aa; display: block; font-size: 13px; }
    .metric strong { display: block; font-size: 26px; margin-top: 4px; }
    .table-wrap { width: 100%; overflow-x: auto; margin-top: 8px; }
    table { width: 100%; min-width: min(760px, 100%); border-collapse: collapse; table-layout: auto; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #3f3f46; vertical-align: top; }
    td { overflow-wrap: anywhere; }
    th { color: #d4d4d8; }
    th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"], th[data-field="target"], td[data-field="target"] { min-width: 18rem; max-width: 34rem; }
    th[data-field="explanation"], td[data-field="explanation"] { max-width: 18rem; }
    .cell-compact { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    th[data-field="controlId"], td[data-field="controlId"], th[data-field="coverage"], td[data-field="coverage"], th[data-field="profile"], td[data-field="profile"], th[data-field="confidence"], td[data-field="confidence"], th[data-field="reviewed"], td[data-field="reviewed"], th[data-field="drift"], td[data-field="drift"], th[data-field="release"], td[data-field="release"], th[data-field="status"], td[data-field="status"], th[data-field="freshness"], td[data-field="freshness"] { white-space: nowrap; width: 1%; }
    th[data-field="open"], td[data-field="open"] { white-space: nowrap; width: 1%; }
    button, input, select, textarea { font: inherit; }
    button { border: 1px solid #52525b; border-radius: 4px; background: #27272a; color: #fafafa; padding: 5px 9px; cursor: pointer; }
    button:hover { background: #3f3f46; }
    .form-grid { display: grid; gap: 12px; max-width: 620px; }
    label { display: grid; gap: 5px; color: #d4d4d8; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #52525b; border-radius: 4px; background: #09090b; color: #fafafa; padding: 8px; }
    textarea { resize: vertical; min-height: 88px; }
    input[readonly] { color: #d4d4d8; background: #18181b; }
    .form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .banner { background: #3f2f11; border-bottom: 1px solid #d97706; color: #fde68a; padding: 8px 20px; font-weight: 600; }
    .muted { color: #a1a1aa; }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .version-pill { border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; color: #d4d4d8; background: #202024; font-size: 12px; white-space: nowrap; line-height: 1.4; }
    @media (max-width: 720px) { main { padding: 16px; } table { min-width: 680px; } th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"] { min-width: 16rem; } }
  </style>
</head>
<body>
  <header><strong>PSPF Workshop</strong><span>v${PSPF_SLICE_VERSION}</span></header>
  <div class="banner">OFFICIAL: Sensitive</div>
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
      if (command === 'saveEntity' || command === 'saveAndCloseEntity') {
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

function wireWorkshopPanelMessages(panel: vscode.WebviewPanel): void {
  panel.webview.onDidReceiveMessage(async (message: { readonly command?: string; readonly entityType?: string; readonly entityId?: string }) => {
    if (message.command === "openEntity" && message.entityType && message.entityId) {
      await openItemDetailForEntity(message.entityType, message.entityId);
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
      return renderRequirementEditor(entity);
    case "evidence":
      return renderEvidenceEditor(entity);
    case "action":
      return renderActionEditor(entity);
    case "risk":
      return renderRiskEditor(entity);
    case "direction":
      return renderDirectionEditor(entity);
    case "requirement-control-mapping":
      return renderMappingEditor(entity, allEntities);
  }
}

function renderRequirementEditor(requirement: RequirementEntity): string {
  const isBaseline = requirement.sourceProduct === "core";
  const domainOptions = PSPF_DOMAINS.map((domain) => ({ label: domain.title, value: domain.id }));
  return editorShell(requirement, "Edit Requirement", `
    ${isBaseline ? readonlyField("Title", requirement.title) : inputField("title", "Title", requirement.title, true)}
    ${isBaseline ? readonlyField("Domain", domainName(requirement.domainId)) : selectField("domainId", "Domain", domainOptions, requirement.domainId)}
    ${selectField("assessmentStatus", "Assessment status", assessmentStatusItems, requirement.assessmentStatus)}
    ${textareaField("summary", "Summary", requirement.summary ?? "")}
  `, isBaseline ? "Official PSPF baseline title and domain are locked." : undefined);
}

function renderEvidenceEditor(evidence: EvidenceEntity): string {
  return editorShell(evidence, "Edit Evidence", `
    ${inputField("title", "Title", evidence.title, true)}
    ${selectField("evidenceType", "Evidence type", evidenceTypeItems, evidence.evidenceType)}
    ${inputField("reference", "Reference", evidence.reference, true)}
    ${selectField("freshness", "Freshness", freshnessItems, evidence.freshness)}
  `);
}

function renderActionEditor(action: ActionEntity): string {
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
    ${inputField("dueDate", "Due date", formatShortAuDateTime(action.dueDate) ?? "", false, "30 Jun 2026")}
  `)}${readOnlyImpact}`;
}

function renderRiskEditor(risk: RiskEntity): string {
  const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value: String(value) }));
  return editorShell(risk, "Edit Risk", `
    ${inputField("title", "Title", risk.title, true)}
    ${selectField("status", "Status", riskStatusItems, risk.status)}
    ${selectField("likelihood", "Likelihood", scoreOptions, String(risk.likelihood))}
    ${selectField("impact", "Impact", scoreOptions, String(risk.impact))}
  `);
}

function renderDirectionEditor(direction: DirectionEntity): string {
  const isBaseline = direction.sourceProduct === "core";
  return editorShell(direction, "Edit Direction", `
    ${isBaseline ? readonlyField("Reference", direction.reference) : inputField("reference", "Reference", direction.reference, true)}
    ${isBaseline ? readonlyField("Title", direction.title) : inputField("title", "Title", direction.title, true)}
    ${isBaseline ? readonlyField("Source authority", direction.sourceAuthority ?? "Not recorded") : inputField("sourceAuthority", "Source authority", direction.sourceAuthority ?? "")}
    ${isBaseline ? readonlyField("Issued", direction.issuedAt ?? "Not recorded") : inputField("issuedAt", "Issued", direction.issuedAt ?? "")}
    ${selectField("responseState", "Response", directionResponseStateItems, direction.responseState)}
  `, isBaseline ? "Official published Direction fields are locked." : undefined);
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

function editorShell(entity: EditableWorkshopEntity, heading: string, fieldsHtml: string, note?: string): string {
  return `
    <section>
      <h1>${escapeHtml(entity.title ?? entity.id)}</h1>
      <p class="muted">${escapeHtml(label(entity.entityType))} · ${escapeHtml(entity.id)}</p>
      ${versionStrip()}
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

function isCoverageQualifier(value: string | undefined): value is RequirementControlMappingEntity["coverageQualifier"] {
  return coverageQualifierItems.some((item) => item.value === value);
}

function isMappingConfidence(value: string | undefined): value is MappingConfidence {
  return confidenceItems.some((item) => item.value === value);
}

function isScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
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

async function ensureCoreReady(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.ensureWorkspaceReady");
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