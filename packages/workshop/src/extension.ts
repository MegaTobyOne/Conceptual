import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import {
  buildCisoMagazineModel,
  buildCisoMasterPlanModel,
  renderCisoMagazineHtml,
  renderCisoMagazineMarkdown,
  renderCisoMasterPlanMarkdown,
  renderPostureBriefMarkdown
} from "@pspf/brief-renderer";
import {
  buildConnectedViewModel,
  renderConnectedViewBodyHtml,
  CONNECTED_VIEW_STYLES,
  CONNECTED_VIEW_BROWSER_SCRIPT
} from "@pspf/connected-view";
import { pill as shellPill } from "@pspf/webview-shell";
import { escapeHtml, homeButton, homeShellHtml, shellHtml } from "./webview/shell.js";
import {
  buildPlanOfActionBoardModel,
  type PlanOfActionBoardModel,
  type PlanOfActionPhaseModel,
  type PlanOfActionTaskModel
} from "./plan-of-action-board.js";
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
  buildHomeSampleWorkspaceEntities,
  enrichActionsWithImpact,
  type EvidenceEntity,
  type EvidenceFreshness,
  type LinkEntity,
  type MappingConfidence,
  type RequirementEntity,
  type RequirementControlMappingEntity,
  type RiskEntity,
  type RiskIntegrationMetadata,
  type RiskStatus,
  SAVED_VIEW_LIMITS,
  type SavedViewEntity,
  type SavedViewScope,
  type SourceControlEntity,
  type SpendItemEntity,
  type StrategyEntity,
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
import { relationshipManagerHtml, type RelationshipManagerAction } from "@pspf/webview-shell";
import {
  buildRelationshipConsequence,
  existingItemOperatorRule,
  linkPhraseForExistingItem,
  linkTypeForExistingItem,
  requirementRelationshipItemTypes,
  type LinkableItemType
} from "./relationship-rules.js";
import { formatShortAuDateTime, normaliseShortAuDateTime, shortWorkshopPanelTitle } from "./workshop-ui.js";

const recentRequirementKey = "pspf.workshop.recentRequirementId";
const riskSourceProfileKey = "pspf.workshop.riskSourceProfile.v1";
const riskSourcePreviewKey = "pspf.workshop.riskSourcePreview.v1";
const riskSourceRunsKey = "pspf.workshop.riskSourceRuns.v1";
const riskSourceSecretKey = "pspf.workshop.6clicksRiskSource.credential";
const riskSourceConfigFile = "integrations.json";
const STRATEGY_REFERENCE_ROLES = ["drives", "addresses", "blocked-by", "evidenced-by", "monitors"] as const;
let workshopContext: vscode.ExtensionContext | undefined;
let homeViewProvider: WorkshopHomeViewProvider | undefined;
let requirementWorkbenchController:
  | {
      open: (
        requirement: RequirementEntity,
        allEntities: readonly V01Entity[],
        options?: RequirementBrowserOptions
      ) => Promise<void>;
    }
  | undefined;

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
    vscode.commands.registerCommand("pspf.workshop.loadHomeSampleWorkspace", loadHomeSampleWorkspace),
    vscode.commands.registerCommand("pspf.workshop.importBundle", importBundle),
    vscode.commands.registerCommand("pspf.workshop.exportBackupJson", exportBackupJson),
    vscode.commands.registerCommand("pspf.workshop.importBackupJson", importBackupJson),
    vscode.commands.registerCommand("pspf.workshop.attachEvidence", attachEvidence),
    vscode.commands.registerCommand("pspf.workshop.createAction", createAction),
    vscode.commands.registerCommand("pspf.workshop.createRisk", createRisk),
    vscode.commands.registerCommand("pspf.workshop.openRiskSourcePanel", openRiskSourcePanel),
    vscode.commands.registerCommand("pspf.workshop.configureRiskSource", configureRiskSource),
    vscode.commands.registerCommand("pspf.workshop.testRiskSource", testRiskSource),
    vscode.commands.registerCommand("pspf.workshop.previewRiskSourceImport", previewRiskSourceImport),
    vscode.commands.registerCommand("pspf.workshop.applyRiskSourceImport", applyRiskSourceImport),
    vscode.commands.registerCommand("pspf.workshop.viewRiskSourceRuns", viewRiskSourceRuns),
    vscode.commands.registerCommand("pspf.workshop.openRequirementsList", openRequirementsList),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceList", openEvidenceList),
    vscode.commands.registerCommand("pspf.workshop.openActionsList", openActionsList),
    vscode.commands.registerCommand("pspf.workshop.openRisksList", openRisksList),
    vscode.commands.registerCommand("pspf.workshop.linkExistingEvidence", linkExistingEvidence),
    vscode.commands.registerCommand("pspf.workshop.linkExistingAction", linkExistingAction),
    vscode.commands.registerCommand("pspf.workshop.linkExistingRisk", linkExistingRisk),
    vscode.commands.registerCommand("pspf.workshop.linkExistingDirection", linkExistingDirection),
    vscode.commands.registerCommand("pspf.workshop.openAssessmentDashboard", openAssessmentDashboard),
    vscode.commands.registerCommand("pspf.workshop.openMasterDashboard", openMasterDashboard),
    vscode.commands.registerCommand("pspf.workshop.openEssentialEightDashboard", openEssentialEightDashboard),
    vscode.commands.registerCommand("pspf.workshop.openPlanOfActionBoard", openPlanOfActionBoard),
    vscode.commands.registerCommand("pspf.workshop.openConnectedView", openConnectedView),
    vscode.commands.registerCommand("pspf.workshop.openStrategyMap", openStrategyMap),
    vscode.commands.registerCommand("pspf.workshop.editStrategySummary", editStrategySummary),
    vscode.commands.registerCommand("pspf.workshop.createRoadmapInitiativePlan", createRoadmapInitiativePlan),
    vscode.commands.registerCommand("pspf.workshop.addPlannerTask", addPlannerTask),
    vscode.commands.registerCommand("pspf.workshop.addPlannerMilestone", addPlannerMilestone),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceReviewQueue", openEvidenceReviewQueue),
    vscode.commands.registerCommand("pspf.workshop.openItemDetail", openItemDetail),
    vscode.commands.registerCommand("pspf.workshop.browseIsmSourceControls", browseIsmSourceControls),
    vscode.commands.registerCommand("pspf.workshop.openIsmControlDetail", openIsmControlDetail),
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
    vscode.commands.registerCommand("pspf.workshop.copyPostureBrief", copyPostureBrief),
    vscode.commands.registerCommand("pspf.workshop.openCisoNewsletterReview", openCisoNewsletterReview),
    vscode.commands.registerCommand("pspf.workshop.openCisoMagazine", openCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.copyCisoMagazine", copyCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.exportCisoMagazine", exportCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.openCisoMasterPlan", openCisoMasterPlan),
    vscode.commands.registerCommand("pspf.workshop.copyCisoMasterPlan", copyCisoMasterPlan)
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

async function exportBackupJson(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.exportBundle");
  await homeViewProvider?.refresh();
}

async function importBackupJson(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.importBundle");
  await homeViewProvider?.refresh();
}

class WorkshopHomeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = homeShellHtml(
      "Loading",
      `<section><p class="muted">Loading PSPF Workshop Home...</p></section>`
    );
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
      this.view.webview.html = homeShellHtml(
        "Action Needed",
        `
            <section>
              <h2>Workspace not ready</h2>
              <p class="muted">${escapeHtml(message)}</p>
              ${homeButton("pspf.core.initialiseWorkspace", "Initialise workspace")}
            </section>
          `
      );
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
      "pspf.workshop.exportBackupJson",
      "pspf.workshop.importBackupJson",
      "pspf.workshop.loadSampleWorkspace",
      "pspf.workshop.loadHomeSampleWorkspace",
      "pspf.workshop.createRequirement",
      "pspf.workshop.attachEvidence",
      "pspf.workshop.createAction",
      "pspf.workshop.createRisk",
      "pspf.workshop.openRiskSourcePanel",
      "pspf.workshop.configureRiskSource",
      "pspf.workshop.testRiskSource",
      "pspf.workshop.previewRiskSourceImport",
      "pspf.workshop.applyRiskSourceImport",
      "pspf.workshop.viewRiskSourceRuns",
      "pspf.workshop.openRequirementsList",
      "pspf.workshop.openEvidenceList",
      "pspf.workshop.openActionsList",
      "pspf.workshop.openRisksList",
      "pspf.workshop.openAssessmentDashboard",
      "pspf.workshop.openMasterDashboard",
      "pspf.workshop.openEssentialEightDashboard",
      "pspf.workshop.openPlanOfActionBoard",
      "pspf.workshop.openConnectedView",
      "pspf.workshop.openStrategyMap",
      "pspf.workshop.editStrategySummary",
      "pspf.workshop.createRoadmapInitiativePlan",
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
      "pspf.workshop.copyPostureBrief",
      "pspf.workshop.openCisoNewsletterReview",
      "pspf.workshop.openCisoMagazine",
      "pspf.workshop.copyCisoMagazine",
      "pspf.workshop.exportCisoMagazine",
      "pspf.workshop.openCisoMasterPlan",
      "pspf.workshop.copyCisoMasterPlan"
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
  const evidence = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence")
    .sort(compareEvidenceRecords);
  const actions = enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
  const changeRecords = allEntities.filter(
    (entity): entity is ChangeRecordEntity => entity.entityType === "change-record"
  );
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const linkedEvidenceIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.toId)
  );
  const recentRequirementId = getRecentRequirementId();
  const recentRequirement = recentRequirementId
    ? requirements.find((requirement) => requirement.id === recentRequirementId)
    : undefined;

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
    urgentActions: actions.filter(
      (action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue"
    ).length,
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
  return homeShellHtml(
    "Workshop Home",
    `
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
        ${homeButton("pspf.workshop.openRequirementsList", "Requirements", "Browse and open Requirements")}
        ${homeButton("pspf.workshop.openEvidenceList", "Evidence", "Browse evidence records")}
        ${homeButton("pspf.workshop.openActionsList", "Actions", "Browse Action records")}
        ${homeButton("pspf.workshop.openRisksList", "Risks", "Browse Risk records")}
        ${homeButton("pspf.workshop.openEvidenceReviewQueue", "Review evidence", "Check missing, stale, and unlinked evidence")}
        ${homeButton("pspf.workshop.openAssessmentDashboard", "Open dashboard", "View posture, Directions, and Action Impact")}
        ${homeButton("pspf.workshop.openMasterDashboard", "Master Dashboard", "Open the CISO decision board")}
        ${homeButton("pspf.workshop.openEssentialEightDashboard", "Essential Eight", "Track E8 posture, mappings, and uplift plan")}
        ${homeButton("pspf.workshop.openPlanOfActionBoard", "Plan of Action", "Manage the action worklist")}
        ${homeButton("pspf.workshop.openConnectedView", "Connected View", "Trace Directions, Requirements, Risks, and Actions")}
        ${homeButton("pspf.workshop.openStrategyMap", "Strategy Map", "Connect strategic choices to Requirements, Risks, Actions, and Directions")}
        ${homeButton("pspf.workshop.openChangeRecords", "Change records", "Review why important records changed")}
        ${homeButton("pspf.workshop.manageSavedViews", "Saved views", "Save and reopen Workshop Requirement filters")}
      </div>
    </section>
    <section>
      <h2>Integrations</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.openRiskSourcePanel", "Risk Source", "Review 6clicks source status, previews, and runs")}
        ${homeButton("pspf.workshop.configureRiskSource", "Configure source", "Choose fixture or live 6clicks mode")}
        ${homeButton("pspf.workshop.testRiskSource", "Test source", "Validate the current Risk Source connection")}
        ${homeButton("pspf.workshop.previewRiskSourceImport", "Preview risks", "Fetch and review source risks before applying")}
        ${homeButton("pspf.workshop.applyRiskSourceImport", "Apply selected", "Apply selected new or changed source risks")}
        ${homeButton("pspf.workshop.viewRiskSourceRuns", "View source runs", "Open recent Risk Source run history")}
      </div>
    </section>
    <section>
      <h2>Create</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.createRequirement", "Requirement")}
        ${homeButton("pspf.workshop.attachEvidence", "Add evidence")}
        ${homeButton("pspf.workshop.createAction", "Create action")}
        ${homeButton("pspf.workshop.createRoadmapInitiativePlan", "Roadmap initiative", "Add staged idea work to the Master Plan")}
        ${homeButton("pspf.workshop.createRisk", "Create risk")}
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
        ${homeButton("pspf.workshop.exportBackupJson", "Export backup JSON")}
        ${homeButton("pspf.workshop.importBackupJson", "Import backup JSON")}
        ${homeButton("pspf.workshop.copyPostureBrief", "Copy brief")}
        ${homeButton("pspf.workshop.openCisoMagazine", "Digital CISO Magazine", "Open the share-ready newsletter issue")}
        ${homeButton("pspf.workshop.openCisoNewsletterReview", "Review newsletter", "Check generated content before export")}
        ${homeButton("pspf.workshop.openCisoMasterPlan", "CISO Master Plan", "Open the roadmap across strategy, action, risk and spend")}
        ${homeButton("pspf.workshop.copyCisoMasterPlan", "Copy CISO Master Plan", "Copy the adaptable master plan summary")}
      </div>
    </section>
    <section>
      <h2>Panel</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.home.refresh", "Refresh")}
        ${homeButton("pspf.workshop.loadSampleWorkspace", "Load enterprise sample", "Load the full-featured AU government enterprise sample workspace")}
        ${homeButton("pspf.workshop.loadHomeSampleWorkspace", "Load home sample", "Load the home and small business sample workspace")}
      </div>
    </section>
  `
  );
}

async function openWelcome(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity) => entity.entityType === "requirement").length;
  const evidence = allEntities.filter((entity) => entity.entityType === "evidence").length;
  const actions = allEntities.filter((entity) => entity.entityType === "action").length;
  const directions = allEntities.filter((entity) => entity.entityType === "direction").length;
  const rows = [
    {
      step: "Load enterprise sample",
      command: "PSPF: Load Enterprise Sample Workspace",
      outcome: "Adds a privacy-safe AU government enterprise scenario"
    },
    {
      step: "Load home sample",
      command: "PSPF: Load Home Sample Workspace",
      outcome: "Adds a home and small business scenario"
    },
    {
      step: "Review posture",
      command: "PSPF: Open Assessment Dashboard",
      outcome: "Shows Directions and Action Impact"
    },
    {
      step: "Triage evidence",
      command: "PSPF: Open Evidence Review Queue",
      outcome: "Shows missing evidence and urgent actions"
    },
    {
      step: "Inspect records",
      command: "PSPF: Open Item Detail",
      outcome: "Shows linked evidence, actions, risks, ISM, and Directions"
    },
    { step: "Publish", command: "PSPF: Export Master Bundle", outcome: "Creates the Explorer bundle" },
    { step: "Check", command: "PSPF: Run Integrity Scan", outcome: "Writes .pspf/logs/integrity-scan.json" }
  ];

  const panel = vscode.window.createWebviewPanel(
    "pspfWorkshopWelcome",
    "PSPF Workshop Welcome",
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.html = shellHtml(
    "PSPF Workshop Welcome",
    `
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
  `
  );
}

async function loadSampleWorkspace(): Promise<void> {
  await loadSampleWorkspaceVariant("enterprise");
}

async function loadHomeSampleWorkspace(): Promise<void> {
  await loadSampleWorkspaceVariant("home");
}

async function loadSampleWorkspaceVariant(variant: "enterprise" | "home"): Promise<void> {
  await ensureCoreReady();
  const sourceControls = await listSourceControls();
  const entities =
    variant === "home"
      ? buildHomeSampleWorkspaceEntities({ sourceControls })
      : buildSampleWorkspaceEntities({ sourceControls });
  await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
  await refreshWorkshopSurfaces();
  const label = variant === "home" ? "home and small business" : "enterprise";
  const action = await vscode.window.showInformationMessage(
    `PSPF ${label} sample workspace loaded: ${entities.length} record(s).`,
    "Open Welcome",
    "Open Dashboard"
  );
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
    validateInput: (value) => (value.trim().length === 0 ? "Enter a requirement title." : undefined)
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

  const assessmentStatus = await vscode.window.showQuickPick(assessmentStatusItems, {
    title: "Select Assessment Status",
    ignoreFocusOut: true
  });
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
  const action = await vscode.window.showInformationMessage(
    `Requirement created: ${requirement.title}`,
    "Open Item Detail"
  );
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
    validateInput: (value) => (value.trim().length === 0 ? "Enter an evidence title." : undefined)
  });
  if (!title) {
    return;
  }

  const evidenceType = await vscode.window.showQuickPick(evidenceTypeItems, {
    title: "Select Evidence Type",
    ignoreFocusOut: true
  });
  if (!evidenceType) {
    return;
  }

  const reference = await vscode.window.showInputBox({
    title: "Add Evidence",
    prompt: "File path, URL, or short reference",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter an evidence reference." : undefined)
  });
  if (!reference) {
    return;
  }

  const freshness = await vscode.window.showQuickPick(freshnessItems, {
    title: "Select Evidence Freshness",
    ignoreFocusOut: true
  });
  if (!freshness) {
    return;
  }

  const requirements = requirementId
    ? await requirementSelectionForScopedCommand(requirementId, "evidence")
    : await pickRequirementsForLinkedItem("evidence");
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
  const links = requirements.map((requirement) =>
    withEnvelope(
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
    )
  );

  await upsertEntityWithRequirementLinks(evidence, links, requirements);
}

async function createAction(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Action title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter an action title." : undefined)
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(actionStatusItems, {
    title: "Select Action Status",
    ignoreFocusOut: true
  });
  if (!status) {
    return;
  }

  const startDate = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Start date, for example today or 1 Jul 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (startDate === undefined) {
    return;
  }

  const endDate = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "End date, for example 30 Sep 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (endDate === undefined) {
    return;
  }

  const dueDate = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Due date or decision point, for example 30 Jun 2026. Press Enter to use the end date or skip.",
    ignoreFocusOut: true
  });
  if (dueDate === undefined) {
    return;
  }

  const commentary = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Initial commentary update for newsletter and posture extracts. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (commentary === undefined) {
    return;
  }

  const requirements = requirementId
    ? await requirementSelectionForScopedCommand(requirementId, "action")
    : await pickRequirementsForLinkedItem("action");
  if (requirements.length === 0) {
    return;
  }

  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: title.trim(),
      status: status.value,
      startDate: normaliseShortAuDateTime(startDate),
      endDate: normaliseShortAuDateTime(endDate),
      dueDate: normaliseShortAuDateTime(dueDate) ?? normaliseShortAuDateTime(endDate),
      commentary: actionCommentaryEntries([], commentary, new Date().toISOString())
    },
    "workshop"
  );
  const links = requirements.map((requirement) =>
    withEnvelope(
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
    )
  );

  await upsertEntityWithRequirementLinks(action, links, requirements);
}

async function createRoadmapInitiativePlan(options: { readonly openAfter?: boolean } = {}): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Roadmap Initiative Plan",
    prompt: "Idea or initiative title, for example AI Implementation",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter an initiative title." : undefined)
  });
  if (!title) {
    return;
  }

  const targetDate = await vscode.window.showInputBox({
    title: "Create Roadmap Initiative Plan",
    prompt: "Target date or decision point, for example 30 Sep 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (targetDate === undefined) {
    return;
  }

  const caseSummary = await vscode.window.showInputBox({
    title: "Create Roadmap Initiative Plan",
    prompt: "Evidence or case for action. Press Enter to create the planner frame without a note.",
    ignoreFocusOut: true
  });
  if (caseSummary === undefined) {
    return;
  }

  const initiativeTitle = title.trim();
  const decisionPoint = normaliseShortAuDateTime(targetDate);
  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: `Planner frame: ${initiativeTitle}`,
      evidenceType: "note",
      reference: plannerFrameReference(initiativeTitle, decisionPoint, caseSummary.trim()),
      freshness: "current"
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", evidence);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Created planner initiative frame: ${initiativeTitle}.`);
  if (options.openAfter !== false) {
    await openCisoMasterPlan();
  }
}

async function addPlannerTask(options: { readonly openAfter?: boolean } = {}): Promise<void> {
  await ensureCoreReady();
  const frame = await pickPlannerFrameEvidence("Add Planner Task", options);
  if (!frame) {
    return;
  }
  const initiativeTitle = parsePlannerFrameTitle(frame.title);
  if (!initiativeTitle) {
    return;
  }
  const title = await vscode.window.showInputBox({
    title: "Add Planner Task",
    prompt: "Task or step title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a task title." : undefined)
  });
  if (!title) {
    return;
  }
  const phase = await vscode.window.showInputBox({
    title: "Add Planner Task",
    prompt: "Phase, stage, or workstream label. Press Enter to use the task title.",
    ignoreFocusOut: true
  });
  if (phase === undefined) {
    return;
  }
  const dueDateInput = await vscode.window.showInputBox({
    title: "Add Planner Task",
    prompt: "Approximate due date or decision point. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (dueDateInput === undefined) {
    return;
  }
  await createPlannerAction({
    initiativeTitle,
    frame,
    title: title.trim(),
    phase: phase.trim(),
    dueDate: normaliseShortAuDateTime(dueDateInput),
    milestone: false,
    openAfter: options.openAfter
  });
}

async function addPlannerMilestone(options: { readonly openAfter?: boolean } = {}): Promise<void> {
  await ensureCoreReady();
  const frame = await pickPlannerFrameEvidence("Add Planner Milestone", options);
  if (!frame) {
    return;
  }
  const initiativeTitle = parsePlannerFrameTitle(frame.title);
  if (!initiativeTitle) {
    return;
  }
  const title = await vscode.window.showInputBox({
    title: "Add Planner Milestone",
    prompt: "Milestone or decision point title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a milestone title." : undefined)
  });
  if (!title) {
    return;
  }
  const dueDateInput = await vscode.window.showInputBox({
    title: "Add Planner Milestone",
    prompt: "Target date. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (dueDateInput === undefined) {
    return;
  }
  await createPlannerAction({
    initiativeTitle,
    frame,
    title: title.trim(),
    phase: "Milestone",
    dueDate: normaliseShortAuDateTime(dueDateInput),
    milestone: true,
    openAfter: options.openAfter
  });
}

async function pickPlannerFrameEvidence(
  title: string,
  options: { readonly openAfter?: boolean } = {}
): Promise<EvidenceEntity | undefined> {
  const frames = (await listAllEntities())
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.recordStatus !== "deleted")
    .filter((evidence) => Boolean(parsePlannerFrameTitle(evidence.title)))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  if (frames.length === 0) {
    await vscode.window.showInformationMessage("Create a planner initiative frame before adding tasks or milestones.");
    await createRoadmapInitiativePlan({ openAfter: options.openAfter });
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    frames.map((frame) => ({
      label: parsePlannerFrameTitle(frame.title) ?? frame.title,
      description: label(frame.freshness),
      detail: frame.reference,
      frame
    })),
    { title, placeHolder: "Choose the initiative frame", ignoreFocusOut: true }
  );
  return picked?.frame;
}

async function createPlannerAction(options: {
  readonly initiativeTitle: string;
  readonly frame: EvidenceEntity;
  readonly title: string;
  readonly phase: string;
  readonly dueDate?: string;
  readonly milestone: boolean;
  readonly openAfter?: boolean;
}): Promise<void> {
  const actionTitle = options.phase ? `${options.initiativeTitle} - ${options.phase}: ${options.title}` : options.title;
  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: actionTitle,
      status: "todo",
      dueDate: options.dueDate,
      commentary: actionCommentaryEntries(
        [],
        options.milestone
          ? `Planner milestone for ${options.initiativeTitle}.`
          : `Planner task for ${options.initiativeTitle}.`,
        new Date().toISOString()
      )
    },
    "workshop"
  );
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${action.title} supported by ${options.frame.title}`,
      linkType: "supported-by",
      fromId: action.id,
      fromType: "action",
      toId: options.frame.id,
      toType: "evidence"
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntities", [action, link]);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(
    options.milestone ? `Added planner milestone: ${options.title}.` : `Added planner task: ${options.title}.`
  );
  if (options.openAfter !== false) {
    await openCisoMasterPlan();
  }
}

function parsePlannerFrameTitle(title: string): string | undefined {
  const prefixes = ["Planner frame:", "Case for action:"] as const;
  const prefix = prefixes.find((candidate) => title.toLowerCase().startsWith(candidate.toLowerCase()));
  const initiativeTitle = prefix ? title.slice(prefix.length).trim() : "";
  return initiativeTitle.length > 0 ? initiativeTitle : undefined;
}

function plannerFrameReference(
  initiativeTitle: string,
  decisionPoint: string | undefined,
  caseSummary: string
): string {
  return [
    `Initiative objective: ${initiativeTitle}`,
    decisionPoint
      ? `Target date or decision point: ${formatDisplayDate(new Date(decisionPoint))}`
      : "Target date or decision point: Not set",
    caseSummary ? `Case for action: ${caseSummary}` : "Case for action: Add evidence or notes as the plan develops.",
    "Next step: add the first task, phase, or milestone from the CISO Master Plan."
  ].join("\n");
}

async function createRisk(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Risk",
    prompt: "Risk title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a risk title." : undefined)
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(riskStatusItems, {
    title: "Select Risk Status",
    ignoreFocusOut: true
  });
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

  const requirements = requirementId
    ? await requirementSelectionForScopedCommand(requirementId, "risk")
    : await pickRequirementsForLinkedItem("risk");
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
  const links = requirements.map((requirement) =>
    withEnvelope(
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
    )
  );

  await upsertEntityWithRequirementLinks(risk, links, requirements);
}

type RiskSourceAuthMode = "api-key-header" | "bearer-token";
type RiskSourceMetadataAuthMode = RiskSourceAuthMode | "none";
type RiskSourceMode = "fixture" | "live";

type RiskSourceProfile = {
  readonly source: "6clicks";
  readonly sourceLabel: string;
  readonly sourceMode: RiskSourceMode;
  readonly fixtureName?: "6clicks-risk-v1";
  readonly baseUrl?: string;
  readonly endpointPath: string;
  readonly authMode?: RiskSourceAuthMode;
  readonly apiKeyHeaderName?: string;
  readonly secretRef?: string;
  readonly mappingVersion: "6clicks-risk-v1";
  readonly applyPolicy: "safe-update";
  readonly timeoutMs: number;
  readonly updatedAt: string;
};

type IncomingRiskRecord = {
  readonly sourceId: string;
  readonly remoteId: string;
  readonly remoteUpdatedAt?: string;
  readonly rawHash: string;
  readonly payload: {
    readonly title: string;
    readonly status: RiskStatus;
    readonly likelihood: number;
    readonly impact: number;
  };
};

type IncomingRiskRecordError = {
  readonly error: true;
  readonly sourceId: string;
  readonly remoteId?: string;
  readonly sourceTitle?: string;
  readonly reason: string;
  readonly rawHash: string;
};

type IncomingRiskResult = IncomingRiskRecord | IncomingRiskRecordError;

type RiskSourcePreviewDecision = {
  readonly classification: "new" | "changed" | "unchanged" | "ambiguous" | "error";
  readonly reason: string;
  readonly incoming?: IncomingRiskRecord;
  readonly localRiskId?: string;
  readonly differences: readonly RiskSourceDifference[];
};

type RiskSourceDifference = {
  readonly field: "title" | "status" | "likelihood" | "impact";
  readonly localValue: string;
  readonly sourceValue: string;
};

type RiskSourcePreview = {
  readonly profile: RiskSourceProfile;
  readonly generatedAt: string;
  readonly decisions: readonly RiskSourcePreviewDecision[];
};

type RiskSourceRun = {
  readonly id: string;
  readonly sourceLabel: string;
  readonly sourceMode: RiskSourceMode;
  readonly status: "previewed" | "applied" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly fetched: number;
  readonly new: number;
  readonly changed: number;
  readonly unchanged: number;
  readonly ambiguous: number;
  readonly errors: number;
  readonly appliedCreates: number;
  readonly appliedUpdates: number;
  readonly logPath?: string;
  readonly diagnostics?: readonly string[];
};

const sixClicksFixtureRecords = [
  {
    id: "6c-risk-001",
    updated_at: "2026-05-20T04:00:00.000Z",
    title: "Legacy identity controls need review",
    status: "open",
    likelihood: 4,
    impact: 4
  },
  {
    id: "6c-risk-002",
    updated_at: "2026-05-21T06:30:00.000Z",
    title: "Supplier assurance evidence is incomplete",
    status: "monitored",
    likelihood: 3,
    impact: 4
  },
  {
    risk_id: "6c-risk-003",
    modified_at: "2026-05-22T01:10:00.000Z",
    name: "Privileged access recertification is overdue",
    status: "accepted",
    likelihood_score: "3",
    impact_score: "5"
  },
  {
    uuid: "6c-risk-004",
    updatedAt: "2026-05-22T03:15:00.000Z",
    summary: "Cloud backup recovery evidence needs retesting",
    status: "resolved",
    inherent_likelihood: 2,
    inherent_impact: 4
  },
  {
    updated_at: "2026-05-22T05:45:00.000Z",
    title: "Fixture row missing a stable source identifier",
    status: "open",
    likelihood: 3,
    impact: 3
  }
] as const;

async function openRiskSourcePanel(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfRiskSourcePanel", "PSPF Risk Source", vscode.ViewColumn.One, {
    enableScripts: true
  });
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = await renderRiskSourcePanel();
  });
  panel.webview.html = await renderRiskSourcePanel();
}

async function configureRiskSource(): Promise<void> {
  const context = requireWorkshopContext();
  const current = readRiskSourceProfile();
  const sourceMode = await vscode.window.showQuickPick(
    [
      { label: "Fixture", description: "Use built-in non-tenant validation data", value: "fixture" as const },
      { label: "Live 6clicks", description: "Fetch from an HTTPS 6clicks endpoint", value: "live" as const }
    ],
    { title: "Select 6clicks source mode", ignoreFocusOut: true }
  );
  if (!sourceMode) {
    return;
  }
  const baseUrl = await vscode.window.showInputBox({
    title: "Configure 6clicks Risk Source",
    prompt:
      sourceMode.value === "live"
        ? "6clicks HTTPS base URL. Live mode requires https://."
        : "Fixture mode does not use a tenant URL.",
    value: current?.baseUrl ?? "",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (sourceMode.value === "fixture" && value.trim().length > 0) {
        return "Fixture mode must not set a live base URL.";
      }
      if (sourceMode.value === "live") {
        return validateRiskSourceBaseUrl(value.trim());
      }
      return undefined;
    }
  });
  if (baseUrl === undefined) {
    return;
  }
  const endpointPath = await vscode.window.showInputBox({
    title: "Configure 6clicks Risk Source",
    prompt: "Risk endpoint path",
    value: current?.endpointPath ?? "/api/v1/risks",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter an endpoint path." : undefined)
  });
  if (!endpointPath) {
    return;
  }
  const authMode =
    sourceMode.value === "live"
      ? await vscode.window.showQuickPick(
          [
            { label: "API key header", value: "api-key-header" as const },
            { label: "Bearer token", value: "bearer-token" as const }
          ],
          { title: "Select 6clicks auth mode", ignoreFocusOut: true }
        )
      : undefined;
  if (sourceMode.value === "live" && !authMode) {
    return;
  }
  const apiKeyHeaderName =
    authMode?.value === "api-key-header"
      ? await vscode.window.showInputBox({
          title: "Configure 6clicks Risk Source",
          prompt: "API key header name",
          value: current?.apiKeyHeaderName ?? "x-api-key",
          ignoreFocusOut: true,
          validateInput: (value) => (value.trim().length === 0 ? "Enter an API key header name." : undefined)
        })
      : undefined;
  if (authMode?.value === "api-key-header" && !apiKeyHeaderName) {
    return;
  }
  if (sourceMode.value === "live" && authMode) {
    const secret = await vscode.window.showInputBox({
      title: "Configure 6clicks Risk Source",
      prompt: authMode.value === "api-key-header" ? "API key" : "Bearer token",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim().length === 0 ? "Enter the credential value." : undefined)
    });
    if (!secret) {
      return;
    }
    await context.secrets.store(riskSourceSecretKey, secret.trim());
  }
  const profile: RiskSourceProfile = {
    source: "6clicks",
    sourceLabel: "6clicks",
    sourceMode: sourceMode.value,
    fixtureName: sourceMode.value === "fixture" ? "6clicks-risk-v1" : undefined,
    baseUrl: trimOptional(baseUrl),
    endpointPath: endpointPath.trim(),
    authMode: authMode?.value,
    apiKeyHeaderName: apiKeyHeaderName?.trim(),
    secretRef: sourceMode.value === "live" ? riskSourceSecretKey : undefined,
    mappingVersion: "6clicks-risk-v1",
    applyPolicy: "safe-update",
    timeoutMs: 15_000,
    updatedAt: new Date().toISOString()
  };
  const diagnostics = validateRiskSourceProfile(profile);
  if (diagnostics.length > 0) {
    await vscode.window.showWarningMessage(`6clicks risk source profile is incomplete: ${diagnostics.join("; ")}`);
    return;
  }
  await context.workspaceState.update(riskSourceProfileKey, profile);
  await writeRiskSourceConfig(profile);
  await vscode.window.showInformationMessage("6clicks risk source profile saved.");
  await openRiskSourcePanel();
}

async function testRiskSource(): Promise<void> {
  const profile = ensureRiskSourceProfile();
  try {
    const records = await fetchSixClicksRiskRecords(profile);
    const errors = records.filter(isIncomingRiskError).length;
    await vscode.window.showInformationMessage(
      `6clicks risk source returned ${records.length - errors} valid risk records and ${errors} rejected records.`
    );
  } catch (error) {
    await vscode.window.showWarningMessage(`6clicks risk source test failed: ${errorMessage(error)}`);
  }
}

async function previewRiskSourceImport(): Promise<void> {
  await ensureCoreReady();
  const profile = ensureRiskSourceProfile();
  const startedAt = new Date().toISOString();
  try {
    const incoming = await fetchSixClicksRiskRecords(profile);
    const allEntities = await listAllEntities();
    const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
    const decisions = buildRiskSourcePreviewDecisions(profile, incoming, risks);
    const preview: RiskSourcePreview = { profile, generatedAt: new Date().toISOString(), decisions };
    await requireWorkshopContext().workspaceState.update(riskSourcePreviewKey, preview);
    await appendRiskSourceRun({
      id: `RUN-${randomUUID()}`,
      sourceLabel: profile.sourceLabel,
      sourceMode: profile.sourceMode,
      status: "previewed",
      startedAt,
      completedAt: new Date().toISOString(),
      fetched: incoming.length,
      ...riskSourceDecisionCounts(decisions),
      appliedCreates: 0,
      appliedUpdates: 0
    });
    await vscode.window.showInformationMessage(`6clicks preview ready: ${riskSourcePreviewSummary(decisions)}.`);
    await openRiskSourcePanel();
  } catch (error) {
    await appendRiskSourceRun({
      id: `RUN-${randomUUID()}`,
      sourceLabel: profile.sourceLabel,
      sourceMode: profile.sourceMode,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      fetched: 0,
      new: 0,
      changed: 0,
      unchanged: 0,
      ambiguous: 0,
      errors: 1,
      appliedCreates: 0,
      appliedUpdates: 0,
      diagnostics: [classifyRiskSourceError(error)]
    });
    await vscode.window.showWarningMessage(`6clicks preview failed: ${errorMessage(error)}`);
  }
}

async function applyRiskSourceImport(): Promise<void> {
  await ensureCoreReady();
  const preview = readRiskSourcePreview();
  if (!preview) {
    await vscode.window.showWarningMessage("Run a 6clicks risk preview before applying.");
    return;
  }
  const applicableDecisions = preview.decisions.filter(
    (decision) => decision.incoming && ["new", "changed"].includes(decision.classification)
  );
  if (applicableDecisions.length === 0) {
    await vscode.window.showInformationMessage("No new or changed 6clicks risks are ready to apply.");
    return;
  }
  const selected = await vscode.window.showQuickPick(
    applicableDecisions.map((decision) => ({
      label: decision.incoming?.payload.title ?? "Untitled risk",
      description: label(decision.classification),
      detail: decision.reason,
      picked: true,
      decision
    })),
    {
      title: "Select 6clicks risks to apply",
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (!selected) {
    return;
  }
  const applicable = selected.map((item) => item.decision);
  if (applicable.length === 0) {
    await vscode.window.showInformationMessage("No 6clicks risks selected for apply.");
    return;
  }
  const changed = applicable.filter((decision) => decision.classification === "changed");
  const overwriteChoice =
    changed.length > 0
      ? await vscode.window.showWarningMessage(
          `${changed.length} matched risks have source field differences. Local PSPF-owned fields are preserved unless you explicitly apply source values for this run.`,
          { modal: true },
          "Preserve local fields",
          "Apply source values"
        )
      : "Preserve local fields";
  if (!overwriteChoice) {
    return;
  }
  const applySourceValues = overwriteChoice === "Apply source values";
  const allEntities = await listAllEntities();
  const riskById = new Map(
    allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk").map((risk) => [risk.id, risk])
  );
  const appliedAt = new Date().toISOString();
  const entities = applicable.flatMap((decision): RiskEntity[] => {
    if (!decision.incoming) {
      return [];
    }
    const integration = riskIntegrationMetadata(preview.profile, decision.incoming, appliedAt);
    if (decision.classification === "new") {
      return [
        withEnvelope(
          "risk",
          {
            entityType: "risk",
            title: decision.incoming.payload.title,
            status: decision.incoming.payload.status,
            likelihood: decision.incoming.payload.likelihood,
            impact: decision.incoming.payload.impact,
            integration
          },
          "workshop"
        )
      ];
    }
    const existing = decision.localRiskId ? riskById.get(decision.localRiskId) : undefined;
    if (!existing) {
      return [];
    }
    return [
      {
        ...existing,
        ...(applySourceValues
          ? {
              title: decision.incoming.payload.title,
              status: decision.incoming.payload.status,
              likelihood: decision.incoming.payload.likelihood,
              impact: decision.incoming.payload.impact
            }
          : {}),
        integration,
        updatedAt: appliedAt
      }
    ];
  });
  if (entities.length === 0) {
    await vscode.window.showWarningMessage("No 6clicks risks could be applied from the current preview.");
    return;
  }
  await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
  const appliedCreates = applicable.filter((decision) => decision.classification === "new").length;
  const appliedUpdates = applicable.filter((decision) => decision.classification === "changed").length;
  await appendRiskSourceRun({
    id: `RUN-${randomUUID()}`,
    sourceLabel: preview.profile.sourceLabel,
    sourceMode: preview.profile.sourceMode,
    status: "applied",
    startedAt: appliedAt,
    completedAt: new Date().toISOString(),
    fetched: preview.decisions.filter((decision) => decision.incoming).length,
    ...riskSourceDecisionCounts(preview.decisions),
    appliedCreates,
    appliedUpdates,
    diagnostics: applySourceValues
      ? ["User consented to apply source values for changed risks in this run."]
      : undefined
  });
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(
    `Applied 6clicks risk import: ${appliedCreates} created, ${appliedUpdates} updated.`
  );
  await openRiskSourcePanel();
}

async function viewRiskSourceRuns(): Promise<void> {
  await openRiskSourcePanel();
}

function requireWorkshopContext(): vscode.ExtensionContext {
  if (!workshopContext) {
    throw new Error("PSPF Workshop context is not ready.");
  }
  return workshopContext;
}

function readRiskSourceProfile(): RiskSourceProfile | undefined {
  const profile = workshopContext?.workspaceState.get<RiskSourceProfile>(riskSourceProfileKey);
  return profile ? normaliseRiskSourceProfile(profile) : undefined;
}

function ensureRiskSourceProfile(): RiskSourceProfile {
  const profile = readRiskSourceProfile();
  if (!profile) {
    throw new Error("Configure the 6clicks risk source before running this action.");
  }
  const diagnostics = validateRiskSourceProfile(profile);
  if (diagnostics.length > 0) {
    throw new Error(`Fix the 6clicks risk source profile before running this action: ${diagnostics.join("; ")}`);
  }
  return profile;
}

function readRiskSourcePreview(): RiskSourcePreview | undefined {
  return workshopContext?.workspaceState.get<RiskSourcePreview>(riskSourcePreviewKey);
}

function readRiskSourceRuns(): readonly RiskSourceRun[] {
  return workshopContext?.workspaceState.get<readonly RiskSourceRun[]>(riskSourceRunsKey) ?? [];
}

async function writeRiskSourceConfig(profile: RiskSourceProfile): Promise<void> {
  const configDirectoryUri = riskSourceConfigDirectoryUri();
  const configUri = riskSourceConfigUri();
  if (!configDirectoryUri || !configUri) {
    return;
  }
  await vscode.workspace.fs.createDirectory(configDirectoryUri);
  const body = {
    version: 1,
    integrations: [
      {
        type: "6clicks-risk",
        source: profile.source,
        sourceLabel: profile.sourceLabel,
        sourceMode: profile.sourceMode,
        fixtureName: profile.fixtureName,
        baseUrl: profile.baseUrl,
        endpointPath: profile.endpointPath,
        authMode: profile.authMode,
        apiKeyHeaderName: profile.apiKeyHeaderName,
        secretRef: profile.secretRef,
        mappingVersion: profile.mappingVersion,
        applyPolicy: profile.applyPolicy,
        timeoutMs: profile.timeoutMs,
        updatedAt: profile.updatedAt
      }
    ]
  };
  await vscode.workspace.fs.writeFile(configUri, new TextEncoder().encode(`${JSON.stringify(body, null, 2)}\n`));
}

function riskSourceConfigUri(): vscode.Uri | undefined {
  const directoryUri = riskSourceConfigDirectoryUri();
  return directoryUri ? vscode.Uri.joinPath(directoryUri, riskSourceConfigFile) : undefined;
}

function riskSourceConfigDirectoryUri(): vscode.Uri | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  return workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, ".pspf", "config") : undefined;
}

function riskSourceConfigDisplayPath(): string {
  const uri = riskSourceConfigUri();
  return uri ? uri.fsPath : `.pspf/config/${riskSourceConfigFile}`;
}

function riskSourceLogDirectoryUri(): vscode.Uri | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  return workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, ".pspf", "logs", "risk-source-runs") : undefined;
}

function riskSourceRunLogUri(runId: string): vscode.Uri | undefined {
  const directoryUri = riskSourceLogDirectoryUri();
  return directoryUri ? vscode.Uri.joinPath(directoryUri, `${runId}.json`) : undefined;
}

function riskSourceRunLogDisplayPath(runId: string): string {
  const uri = riskSourceRunLogUri(runId);
  return uri ? uri.fsPath : `.pspf/logs/risk-source-runs/${runId}.json`;
}

async function appendRiskSourceRun(run: RiskSourceRun): Promise<void> {
  const context = requireWorkshopContext();
  const runWithLog = {
    ...run,
    logPath: riskSourceRunLogDisplayPath(run.id),
    diagnostics: redactDiagnostics(run.diagnostics)
  };
  await context.workspaceState.update(riskSourceRunsKey, [runWithLog, ...readRiskSourceRuns()].slice(0, 25));
  await writeRiskSourceRunLog(runWithLog);
}

async function writeRiskSourceRunLog(run: RiskSourceRun): Promise<void> {
  const directoryUri = riskSourceLogDirectoryUri();
  const logUri = riskSourceRunLogUri(run.id);
  if (!directoryUri || !logUri) {
    return;
  }
  await vscode.workspace.fs.createDirectory(directoryUri);
  const body = {
    ...run,
    diagnostics: redactDiagnostics(run.diagnostics)
  };
  await vscode.workspace.fs.writeFile(logUri, new TextEncoder().encode(`${JSON.stringify(body, null, 2)}\n`));
}

function normaliseRiskSourceProfile(profile: RiskSourceProfile): RiskSourceProfile {
  const sourceMode = profile.sourceMode ?? (profile.baseUrl ? "live" : "fixture");
  return {
    ...profile,
    sourceMode,
    fixtureName: sourceMode === "fixture" ? (profile.fixtureName ?? "6clicks-risk-v1") : undefined,
    timeoutMs: profile.timeoutMs ?? 15_000
  };
}

function validateRiskSourceProfile(profile: RiskSourceProfile): readonly string[] {
  const diagnostics: string[] = [];
  if (profile.source !== "6clicks") {
    diagnostics.push("source must be 6clicks");
  }
  if (profile.sourceMode === "fixture") {
    if (profile.baseUrl) {
      diagnostics.push("fixture mode must not set a live base URL");
    }
    if (profile.secretRef) {
      diagnostics.push("fixture mode must not require a credential");
    }
    return diagnostics;
  }
  if (profile.sourceMode !== "live") {
    diagnostics.push("source mode must be fixture or live");
    return diagnostics;
  }
  const baseUrlError = validateRiskSourceBaseUrl(profile.baseUrl ?? "");
  if (baseUrlError) {
    diagnostics.push(baseUrlError);
  }
  if (!profile.endpointPath.trim()) {
    diagnostics.push("endpoint path is required");
  }
  if (!profile.authMode) {
    diagnostics.push("auth mode is required for live mode");
  }
  if (profile.authMode === "api-key-header" && !profile.apiKeyHeaderName?.trim()) {
    diagnostics.push("API key header name is required for API key auth");
  }
  if (!profile.secretRef) {
    diagnostics.push("SecretStorage credential reference is required for live mode");
  }
  if (!Number.isInteger(profile.timeoutMs) || profile.timeoutMs < 1_000 || profile.timeoutMs > 60_000) {
    diagnostics.push("timeout must be between 1000 and 60000 ms");
  }
  return diagnostics;
}

function validateRiskSourceBaseUrl(value: string): string | undefined {
  if (value.trim().length === 0) {
    return "Live mode requires a base URL.";
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? undefined : "Live mode requires an https:// base URL.";
  } catch {
    return "Enter a valid https:// base URL.";
  }
}

function riskSourceLiveUrl(profile: RiskSourceProfile): URL {
  const baseUrl = profile.baseUrl;
  if (!baseUrl) {
    throw new Error("Live mode requires a base URL.");
  }
  const url = new URL(profile.endpointPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (url.protocol !== "https:") {
    throw new Error("Live mode requires an https:// endpoint.");
  }
  return url;
}

function redactDiagnostics(diagnostics: readonly string[] | undefined): readonly string[] | undefined {
  return diagnostics?.map((diagnostic) =>
    diagnostic
      .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
      .replace(/(api[-_ ]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
      .replace(/(token\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
      .replace(/(authorization\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
  );
}

function classifyRiskSourceError(error: unknown): string {
  const message = errorMessage(error);
  if (/AbortError|timeout/i.test(message)) {
    return `timeout: ${message}`;
  }
  if (/auth|401|403/i.test(message)) {
    return `auth: ${message}`;
  }
  if (/429|rate/i.test(message)) {
    return `rate-limit: ${message}`;
  }
  if (/schema|array|object|missing/i.test(message)) {
    return `schema: ${message}`;
  }
  if (/fetch|network|ENOTFOUND|ECONN/i.test(message)) {
    return `network: ${message}`;
  }
  return `unexpected: ${message}`;
}

function riskSourceHttpErrorCategory(status: number): string {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 429) {
    return "rate-limit";
  }
  if (status >= 500) {
    return "network";
  }
  return "unexpected";
}

function isIncomingRiskError(record: IncomingRiskResult): record is IncomingRiskRecordError {
  return "error" in record && record.error === true;
}

function riskSourceMetadataAuthMode(profile: RiskSourceProfile): RiskSourceMetadataAuthMode {
  return profile.sourceMode === "fixture" ? "none" : (profile.authMode ?? "none");
}

async function fetchSixClicksRiskRecords(profile: RiskSourceProfile): Promise<readonly IncomingRiskResult[]> {
  if (profile.sourceMode === "fixture") {
    return normaliseSixClicksRiskRecords(profile, sixClicksFixtureRecords);
  }
  if (!profile.secretRef) {
    throw new Error("Live source credential reference is missing. Reconfigure the risk source.");
  }
  const secret = await requireWorkshopContext().secrets.get(profile.secretRef);
  if (!secret) {
    throw new Error("Credential is missing from SecretStorage. Reconfigure the risk source.");
  }
  const url = riskSourceLiveUrl(profile);
  const headers: Record<string, string> = { accept: "application/json" };
  if (profile.authMode === "bearer-token") {
    headers.authorization = `Bearer ${secret}`;
  } else {
    headers[profile.apiKeyHeaderName ?? "x-api-key"] = secret;
  }
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), profile.timeoutMs);
  const response = await fetch(url, { method: "GET", headers, signal: abort.signal }).finally(() => {
    clearTimeout(timeout);
  });
  if (!response.ok) {
    throw new Error(
      `${riskSourceHttpErrorCategory(response.status)}: HTTP ${response.status} ${response.statusText}`.trim()
    );
  }
  const body = (await response.json()) as unknown;
  const records = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.risks)
        ? body.risks
        : undefined;
  if (!records) {
    throw new Error("6clicks response did not contain a risk array.");
  }
  return normaliseSixClicksRiskRecords(profile, records);
}

function normaliseSixClicksRiskRecords(
  profile: RiskSourceProfile,
  records: readonly unknown[]
): readonly IncomingRiskResult[] {
  return records.map((record) => {
    try {
      return normaliseSixClicksRiskRecord(profile, record);
    } catch (error) {
      const sourceRecord = isRecord(record) ? record : {};
      return {
        error: true,
        sourceId: profile.source,
        remoteId:
          stringField(sourceRecord, "id") ?? stringField(sourceRecord, "risk_id") ?? stringField(sourceRecord, "uuid"),
        sourceTitle:
          stringField(sourceRecord, "title") ??
          stringField(sourceRecord, "name") ??
          stringField(sourceRecord, "summary"),
        reason: errorMessage(error),
        rawHash: hashStableJson(record)
      } satisfies IncomingRiskRecordError;
    }
  });
}

function normaliseSixClicksRiskRecord(profile: RiskSourceProfile, record: unknown): IncomingRiskRecord {
  if (!isRecord(record)) {
    throw new Error("6clicks risk record is not an object.");
  }
  const remoteId = stringField(record, "id") ?? stringField(record, "risk_id") ?? stringField(record, "uuid");
  const title = stringField(record, "title") ?? stringField(record, "name") ?? stringField(record, "summary");
  if (!remoteId || !title) {
    throw new Error("6clicks risk record is missing id or title.");
  }
  const status = normaliseRiskStatus(stringField(record, "status"));
  const likelihood = normaliseRiskScore(record.likelihood ?? record.likelihood_score ?? record.inherent_likelihood);
  const impact = normaliseRiskScore(record.impact ?? record.impact_score ?? record.inherent_impact);
  return {
    sourceId: profile.source,
    remoteId,
    remoteUpdatedAt:
      stringField(record, "updated_at") ?? stringField(record, "updatedAt") ?? stringField(record, "modified_at"),
    rawHash: hashStableJson(record),
    payload: { title: title.trim(), status, likelihood, impact }
  };
}

function buildRiskSourcePreviewDecisions(
  profile: RiskSourceProfile,
  incoming: readonly IncomingRiskResult[],
  risks: readonly RiskEntity[]
): readonly RiskSourcePreviewDecision[] {
  return incoming.map((record) => {
    if (isIncomingRiskError(record)) {
      return {
        classification: "error",
        reason: record.reason,
        differences: []
      };
    }
    const externalMatches = risks.filter(
      (risk) => risk.integration?.source === profile.source && risk.integration.remoteId === record.remoteId
    );
    const secondaryMatches = risks.filter(
      (risk) => normaliseMatchText(risk.title) === normaliseMatchText(record.payload.title)
    );
    const matches = externalMatches.length > 0 ? externalMatches : secondaryMatches;
    if (matches.length > 1) {
      return {
        classification: "ambiguous",
        reason: "Multiple local risks match this 6clicks record.",
        incoming: record,
        differences: []
      };
    }
    const match = matches.at(0);
    if (!match) {
      return { classification: "new", reason: "No local match found.", incoming: record, differences: [] };
    }
    const differences = riskSourceDifferences(match, record);
    return {
      classification: differences.length > 0 ? "changed" : "unchanged",
      reason:
        differences.length > 0 ? "Mapped source fields differ from the local risk." : "Mapped source fields match.",
      incoming: record,
      localRiskId: match.id,
      differences
    };
  });
}

function riskSourceDifferences(risk: RiskEntity, incoming: IncomingRiskRecord): readonly RiskSourceDifference[] {
  const candidates: readonly RiskSourceDifference[] = [
    { field: "title", localValue: risk.title, sourceValue: incoming.payload.title },
    { field: "status", localValue: risk.status, sourceValue: incoming.payload.status },
    { field: "likelihood", localValue: String(risk.likelihood), sourceValue: String(incoming.payload.likelihood) },
    { field: "impact", localValue: String(risk.impact), sourceValue: String(incoming.payload.impact) }
  ];
  return candidates.filter((item) => item.localValue !== item.sourceValue);
}

function riskIntegrationMetadata(
  profile: RiskSourceProfile,
  incoming: IncomingRiskRecord,
  lastSyncedAt: string
): RiskIntegrationMetadata {
  return {
    source: profile.source,
    sourceLabel: profile.sourceLabel,
    remoteId: incoming.remoteId,
    remoteUpdatedAt: incoming.remoteUpdatedAt,
    lastSyncedAt,
    authMode: riskSourceMetadataAuthMode(profile),
    rawHash: incoming.rawHash
  };
}

function riskSourceDecisionCounts(decisions: readonly RiskSourcePreviewDecision[]): {
  readonly new: number;
  readonly changed: number;
  readonly unchanged: number;
  readonly ambiguous: number;
  readonly errors: number;
} {
  return {
    new: decisions.filter((decision) => decision.classification === "new").length,
    changed: decisions.filter((decision) => decision.classification === "changed").length,
    unchanged: decisions.filter((decision) => decision.classification === "unchanged").length,
    ambiguous: decisions.filter((decision) => decision.classification === "ambiguous").length,
    errors: decisions.filter((decision) => decision.classification === "error").length
  };
}

function riskSourcePreviewSummary(decisions: readonly RiskSourcePreviewDecision[]): string {
  const counts = riskSourceDecisionCounts(decisions);
  return `${counts.new} new, ${counts.changed} changed, ${counts.unchanged} unchanged, ${counts.ambiguous} ambiguous, ${counts.errors} errors`;
}

async function renderRiskSourcePanel(): Promise<string> {
  const profile = readRiskSourceProfile();
  const preview = readRiskSourcePreview();
  const runs = readRiskSourceRuns();
  const profileRows = profile
    ? [
        {
          source: profile.sourceLabel,
          mode: label(profile.sourceMode),
          auth: profile.authMode ?? "None",
          endpoint: profile.baseUrl ? `${profile.baseUrl}${profile.endpointPath}` : "Fixture records",
          policy: profile.applyPolicy,
          updated: formatShortAuDateTime(profile.updatedAt) ?? profile.updatedAt
        }
      ]
    : [];
  const previewRows = preview
    ? preview.decisions.map((decision) => ({
        state: label(decision.classification),
        title: decision.incoming?.payload.title ?? "Not available",
        local: decision.localRiskId ?? "New record",
        differences: decision.differences.map((difference) => difference.field).join(", ") || "None",
        reason: decision.reason
      }))
    : [];
  const runRows = runs.map((run) => ({
    status: label(run.status),
    mode: label(run.sourceMode),
    completed: formatShortAuDateTime(run.completedAt) ?? run.completedAt,
    fetched: run.fetched,
    new: run.new,
    changed: run.changed,
    applied: `${run.appliedCreates}/${run.appliedUpdates}`,
    log: run.logPath ?? "Not written",
    diagnostics: run.diagnostics?.join("; ") ?? "None"
  }));
  return shellHtml(
    "PSPF Risk Source",
    `
    <section>
      <p class="eyebrow">Risk workflow</p>
      <h1>6clicks Risk Source</h1>
      <p class="muted">Fetch published 6clicks risk data, preview local PSPF changes, then apply only after explicit confirmation. External systems remain read-only.</p>
      <p class="muted">Non-secret settings are mirrored to ${escapeHtml(riskSourceConfigDisplayPath())}. Credentials remain in VS Code SecretStorage.</p>
      ${versionStrip()}
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.configureRiskSource">Configure source</button>
        <button type="button" data-command="pspf.workshop.testRiskSource">Test connection</button>
        <button type="button" data-command="pspf.workshop.previewRiskSourceImport">Run preview</button>
        <button type="button" data-command="pspf.workshop.applyRiskSourceImport">Apply selected</button>
        <button type="button" data-command="refresh">Refresh</button>
      </div>
    </section>
    ${profile ? recordTable("Source Profile", profileRows, ["source", "mode", "auth", "endpoint", "policy", "updated"]) : `<section><h2>Source Profile</h2><p class="muted">No 6clicks risk source profile configured yet.</p></section>`}
    ${
      preview
        ? `<section><h2>Preview Summary</h2><div class="grid">${Object.entries(
            riskSourceDecisionCounts(preview.decisions)
          )
            .map(([key, value]) => metricCard(label(key), value))
            .join(
              ""
            )}</div><p class="muted">Generated ${escapeHtml(formatShortAuDateTime(preview.generatedAt) ?? preview.generatedAt)}. Changed records preserve local fields unless the apply step receives explicit consent.</p></section>`
        : ""
    }
    ${recordTable("Preview Decisions", previewRows, ["state", "title", "local", "differences", "reason"])}
    ${recordTable("Run History", runRows, ["status", "mode", "completed", "fetched", "new", "changed", "applied", "log", "diagnostics"])}
  `
  );
}

function normaliseRiskStatus(value: string | undefined): RiskStatus {
  const normalised = value?.trim().toLocaleLowerCase("en-AU");
  if (normalised === "closed" || normalised === "resolved") {
    return "closed";
  }
  if (normalised === "monitored" || normalised === "accepted" || normalised === "treated") {
    return "monitored";
  }
  return "open";
}

function normaliseRiskScore(value: unknown): number {
  const score = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return isScore(score) ? score : 3;
}

function normaliseMatchText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

function hashStableJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function upsertEntityWithRequirementLinks(
  entity: EvidenceEntity | ActionEntity | RiskEntity,
  links: LinkEntity[],
  requirements: RequirementEntity[]
): Promise<void> {
  const firstRequirement = requirements[0];
  if (!firstRequirement) {
    return;
  }

  await vscode.commands.executeCommand("pspf.core.upsertEntities", [entity, ...links]);
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  const allEntities = entities ?? [];
  const entityExists = allEntities.some(
    (candidate) => candidate.id === entity.id && candidate.entityType === entity.entityType
  );
  const missingLinkCount = links.filter(
    (link) => !allEntities.some((candidate) => candidate.id === link.id && candidate.entityType === "link")
  ).length;
  if (!entityExists || missingLinkCount > 0) {
    throw new Error(
      `Could not confirm ${label(entity.entityType)} links were created. Run PSPF: Validate Workspace and try again.`
    );
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
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const validationHints = buildValidationHints(requirements, actions, risks, links);
  const recentRequirementId = getRecentRequirementId();
  const recentRequirement = recentRequirementId
    ? requirements.find((requirement) => requirement.id === recentRequirementId)
    : undefined;
  const openActionCount = actions.filter((action) => !["done", "cancelled"].includes(action.status)).length;
  const openRiskCount = risks.filter((risk) => risk.status !== "closed").length;
  const directionResponseCounts: Record<DirectionResponseState, number> = {
    "not-set": directions.filter((direction) => direction.responseState === "not-set").length,
    yes: directions.filter((direction) => direction.responseState === "yes").length,
    no: directions.filter((direction) => direction.responseState === "no").length,
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
    .filter((action): action is ActionEntity & { impact: NonNullable<ActionEntity["impact"]> } =>
      Boolean(action.impact)
    )
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
    const applicableRequirements = domainRequirements.filter((requirement) => !isNotApplicableRequirement(requirement));
    return {
      domain: domain.title,
      requirements: applicableRequirements.length,
      notApplicable: domainRequirements.length - applicableRequirements.length,
      evidenceGaps: applicableRequirements.filter((requirement) => !evidenceRequirementIds.has(requirement.id)).length,
      inProgress: applicableRequirements.filter((requirement) => requirement.assessmentStatus === "in-progress").length,
      met: applicableRequirements.filter((requirement) => requirement.assessmentStatus === "met").length,
      notMet: applicableRequirements.filter(
        (requirement) => requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met"
      ).length
    };
  });
  const nextRequirements = requirements
    .filter(
      (requirement) =>
        !isNotApplicableRequirement(requirement) &&
        (!evidenceRequirementIds.has(requirement.id) || requirement.assessmentStatus !== "met")
    )
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

  const panel = vscode.window.createWebviewPanel(
    "pspfAssessmentDashboard",
    "PSPF Assessment Dashboard",
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    "PSPF Assessment Dashboard",
    `
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
    ${recordTable("Domain Summary", domainRows, ["domain", "requirements", "notApplicable", "evidenceGaps", "inProgress", "met", "notMet"])}
    ${recordTable("Action Impact — Top 5", actionImpactRows, ["title", "status", "urgency", "total", "postureUplift", "evidenceUplift", "riskReduction", "directionUplift", "explanation"])}
    ${recordTable("Directions", directionRows, ["reference", "title", "responseState", "sourceAuthority", "issuedAt"])}
    ${recordTable("Next Requirements To Review", nextRequirements, ["title", "domain", "status", "evidence"])}
    ${recordTable("Latest Activity", recentActivity, ["type", "title", "created"])}
  `
  );
}

async function openMasterDashboard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = enrichedEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const directions = allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction");
  const changeRecords = allEntities.filter(
    (entity): entity is ChangeRecordEntity => entity.entityType === "change-record"
  );
  const strategies = allEntities.filter(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const linkedEvidenceIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.toId)
  );
  const openActions = actions.filter((action) => !["done", "cancelled"].includes(action.status));
  const overdueActions = openActions.filter((action) => action.impact?.urgency === "overdue").length;
  const blockedActions = openActions.filter((action) => action.impact?.urgency === "blocked").length;
  const openRisks = risks.filter((risk) => risk.status !== "closed");
  const highRisks = openRisks.filter((risk) => risk.likelihood * risk.impact >= 16).length;
  const completion = buildRequirementCompletionMetrics(requirements, evidenceRequirementIds);
  const metRequirements = completion.metApplicable;
  const evidenceCoverage = completion.evidenceCoverageApplicable;
  const metPercentage = completion.metPercentageApplicable;
  const staleEvidence = evidence.filter(
    (item) => item.freshness !== "current" || !linkedEvidenceIds.has(item.id)
  ).length;
  const strategy = strategies[0];
  const strategyChoices = strategy?.choices.length ?? 0;
  const strategyMeasures =
    strategy?.choices.reduce(
      (total, choice) =>
        total + choice.outcomes.reduce((outcomeTotal, outcome) => outcomeTotal + outcome.measures.length, 0),
      0
    ) ?? 0;
  const directionResponses: Record<DirectionResponseState, number> = {
    "not-set": directions.filter((direction) => direction.responseState === "not-set").length,
    yes: directions.filter((direction) => direction.responseState === "yes").length,
    no: directions.filter((direction) => direction.responseState === "no").length,
    "risk-managed": directions.filter((direction) => direction.responseState === "risk-managed").length
  };
  const decisionLoopRows = [
    masterLoopRow(
      "Strategy, Risk and Architecture",
      "GOV / RISK",
      strategyChoices,
      `${strategyMeasures} measures`,
      "Why this control here, why now?"
    ),
    masterLoopRow(
      "Governance, Metrics and Reporting",
      "GOV",
      directions.length,
      `${directionResponses["not-set"]} Directions not set`,
      "What needs AA, Audit Committee or CSO attention?"
    ),
    masterLoopRow(
      "Systems, Authorisation and Operations",
      "TECH / INFO",
      requirements.length,
      `${evidenceCoverage}% evidence coverage`,
      "Which systems and controls can we stand behind?"
    ),
    masterLoopRow(
      "Incident Management and Resilience",
      "GOV / TECH / RISK",
      changeRecords.length,
      `${changeRecords.length} change records`,
      "What did we learn and what changed?"
    ),
    masterLoopRow(
      "People, Capability and Culture",
      "GOV / PER / RISK",
      openActions.length,
      `${blockedActions} blocked actions`,
      "Where does capability constrain uplift?"
    )
  ];
  const streamRows = [
    {
      stream: "Assure evidence",
      focus: "Close missing, stale, changed and unlinked evidence",
      count: staleEvidence,
      leadSurface: "Workshop Evidence Review",
      action: `<button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Review</button>`
    },
    {
      stream: "Reduce risk",
      focus: "Treat high exposure and unresolved residual risk",
      count: highRisks,
      leadSurface: "Risks and Connected View",
      action: `<button type="button" data-command="pspf.workshop.openConnectedView">Trace</button>`
    },
    {
      stream: "Lift posture",
      focus: "Progress overdue, blocked and high-impact Actions",
      count: overdueActions + blockedActions,
      leadSurface: "Action Impact",
      action: `<button type="button" data-command="pspf.workshop.openAssessmentDashboard">Prioritise</button>`
    },
    {
      stream: "Set direction",
      focus: "Connect strategy choices, measures and PSPF hooks",
      count: strategyChoices,
      leadSurface: "Strategy Map",
      action: `<button type="button" data-command="pspf.workshop.openStrategyMap">Map</button>`
    },
    {
      stream: "Prepare reporting",
      focus: "Create snapshot, export bundle and copy posture brief",
      count: requirements.length,
      leadSurface: "Core and Explorer",
      action: `<button type="button" data-command="pspf.workshop.copyPostureBrief">Copy brief</button>`
    }
  ];
  const strategyRows = strategy
    ? strategy.choices.map((choice) => ({
        choice: choice.statement,
        capability: choice.capabilityArea,
        trend: label(choice.trend),
        confidence: label(choice.confidence),
        outcomes: choice.outcomes.length,
        measures: choice.outcomes.reduce((total, outcome) => total + outcome.measures.length, 0),
        target: choice.targetPosture
      }))
    : [];
  const actionRows = openActions
    .filter((action): action is ActionEntity & { impact: NonNullable<ActionEntity["impact"]> } =>
      Boolean(action.impact)
    )
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      status: label(action.status),
      urgency: label(action.impact.urgency),
      total:
        (action.impact.postureUplift ?? 0) +
        (action.impact.evidenceUplift ?? 0) +
        (action.impact.riskReduction ?? 0) +
        (action.impact.directionUplift ?? 0),
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const panel = vscode.window.createWebviewPanel(
    "pspfMasterDashboard",
    "PSPF Master Dashboard",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    "PSPF Master Dashboard",
    `
    <section>
      <p class="eyebrow">Rogue CISO PSPF</p>
      <h1>Master Dashboard</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Digital management board for strategy, evidence, risk, action and reporting loops.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Met, excl N/A", `${metPercentage}%`)}
        ${metricCard("Evidence, excl N/A", `${evidenceCoverage}%`)}
        ${metricCard("N/A excluded", completion.notApplicable)}
        ${metricCard("Met, incl N/A", `${completion.metPercentageAll}%`)}
        ${metricCard("Evidence, incl N/A", `${completion.evidenceCoverageAll}%`)}
        ${metricCard("Open actions", openActions.length)}
        ${metricCard("High risks", highRisks)}
        ${metricCard("Strategy choices", strategyChoices)}
        ${metricCard("Report signals", changeRecords.length + directions.length)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openEssentialEightDashboard">Essential Eight</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan of Action</button>
        <button type="button" data-command="pspf.workshop.openConnectedView">Connected View</button>
        <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
        <button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Evidence Review</button>
        <button type="button" data-command="pspf.core.createSnapshot">Snapshot</button>
        <button type="button" data-command="pspf.core.exportBundle">Export Bundle</button>
        <button type="button" data-command="pspf.workshop.openCisoMagazine">Digital CISO Magazine</button>
        <button type="button" data-command="pspf.workshop.openCisoMasterPlan">CISO Master Plan</button>
        <button type="button" data-command="pspf.workshop.copyCisoMasterPlan">Copy CISO Master Plan</button>
      </div>
    </section>
    <section>
      <h2>Explorer Preview</h2>
      <p class="muted">This is the shareable posture slice that should survive outside your VS Code workspace: current PSPF status, evidence coverage, risk exposure, action pressure and reporting readiness.</p>
      <div class="grid">
        ${metricCard("Met", metRequirements)}
        ${metricCard("Not yet met", Math.max(completion.applicable - metRequirements, 0))}
        ${metricCard("Evidence to review", staleEvidence)}
        ${metricCard("Directions not set", directionResponses["not-set"])}
      </div>
      <p class="muted">Compliance and evidence coverage ignore ${completion.notApplicable} not applicable requirement${completion.notApplicable === 1 ? "" : "s"}. Including N/A: ${completion.metPercentageAll}% met, ${completion.evidenceCoverageAll}% evidence coverage.</p>
    </section>
    ${recordTable("CISO Decision Loops", decisionLoopRows, ["loop", "maturity", "records", "signal", "question"])}
    ${recordTable("Strategy And Performance", strategyRows, ["choice", "capability", "trend", "confidence", "outcomes", "measures", "target"])}
    ${recordTable("Plan Of Action Streams", streamRows, ["stream", "focus", "count", "leadSurface", "action"])}
    <section>
      <h2>Plan Of Action Board</h2>
      <p class="muted">Open the workstream timeline for linked Actions, live status, evidence/risk context and reporting pressure.</p>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Open Plan of Action</button>
      </div>
    </section>
    ${recordTable("Action Pressure", actionRows, ["title", "status", "urgency", "total", "dueDate"])}
  `
  );
}

async function openEssentialEightDashboard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const model = buildEssentialEightDashboardModel(allEntities);
  const panel = vscode.window.createWebviewPanel(
    "pspfEssentialEightDashboard",
    "PSPF Essential Eight Dashboard",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderEssentialEightDashboard(buildEssentialEightDashboardModel(await listAllEntities()));
  });
  panel.webview.html = renderEssentialEightDashboard(model);
}

function renderEssentialEightDashboard(model: EssentialEightDashboardModel): string {
  return shellHtml(
    "PSPF Essential Eight Dashboard",
    `
    <section>
      <p class="eyebrow">TECH 14 · Essential Eight</p>
      <h1>Essential Eight Dashboard</h1>
      <p class="muted">OFFICIAL: Sensitive · Dedicated tracking for ASD Essential Eight posture, PSPF Requirement coverage, ISM mappings, evidence, risks, and the uplift plan.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("E8 requirements", model.metrics.requirements)}
        ${metricCard("Met, excl N/A", `${model.metrics.metPercentage}%`)}
        ${metricCard("Evidence, excl N/A", `${model.metrics.evidenceCoverage}%`)}
        ${metricCard("N/A excluded", model.metrics.notApplicable)}
        ${metricCard("E8 ISM mappings", model.metrics.ismMappings)}
        ${metricCard("Open actions", model.metrics.openActions)}
        ${metricCard("Blocked/overdue", model.metrics.blockedOrOverdue)}
        ${metricCard("Open risks", model.metrics.openRisks)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.createAction">Create action</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan of Action</button>
        <button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Evidence Review</button>
        <button type="button" data-command="pspf.workshop.browseIsmSourceControls">ISM controls</button>
        <button type="button" data-command="pspf.workshop.openMasterDashboard">Master Dashboard</button>
      </div>
    </section>
    <section>
      <h2>Tracking Summary</h2>
      <p class="muted">${escapeHtml(model.summary)}</p>
      <div class="grid">
        ${metricCard("Strategies met", `${model.metrics.strategiesMet} of ${ESSENTIAL_EIGHT_STRATEGIES.length}`)}
        ${metricCard("Needs evidence", model.metrics.needsEvidence)}
        ${metricCard("Needs uplift", model.metrics.needsUplift)}
        ${metricCard("Mapped controls", model.metrics.mappedControls)}
      </div>
    </section>
    ${recordTable("E8 Strategy Tracker", model.strategyRows, ["strategy", "target", "status", "requirements", "met", "evidence", "ismMappings", "openActions", "openRisks", "nextStep"])}
    ${recordTable("E8 Uplift Plan", model.planRows, ["title", "strategy", "status", "urgency", "startDate", "endDate", "dueDate", "impact", "linkedRequirements"])}
    ${recordTable("E8 Requirements To Review", model.requirementRows, ["title", "status", "evidence", "actions", "risks", "ismMappings"])}
  `
  );
}

async function openPlanOfActionBoard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const model = buildPlanOfActionBoardModel(enrichActionsWithImpact(allEntities));
  const panel = vscode.window.createWebviewPanel(
    "pspfPlanOfActionBoard",
    "PSPF Plan of Action",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    const refreshedEntities = await listAllEntities();
    panel.webview.html = renderPlanOfActionBoard(
      buildPlanOfActionBoardModel(enrichActionsWithImpact(refreshedEntities))
    );
  });
  panel.webview.html = renderPlanOfActionBoard(model);
}

function renderPlanOfActionBoard(model: PlanOfActionBoardModel): string {
  const taskRows = model.phases.flatMap((phase) =>
    phase.tasks.map((task) => ({
      openEntityType: "action",
      openEntityId: task.actionId,
      title: task.title,
      stream: phase.title,
      status: label(task.status),
      urgency: label(task.urgency),
      startDate: formatShortAuDateTime(task.startDate) ?? task.startDate,
      endDate: formatShortAuDateTime(task.endDate) ?? task.endDate,
      dueDate: formatShortAuDateTime(task.dueDate) ?? "Not set",
      linkedRequirements: task.linkedRequirements,
      linkedRisks: task.linkedRisks,
      impact: task.impactTotal
    }))
  );

  return shellHtml(
    "PSPF Plan of Action",
    `
    <section>
      <p class="eyebrow">Master Dashboard Upgrade</p>
      <h1>Plan of Action</h1>
      <p class="muted">OFFICIAL: Sensitive · Operational action worklist derived from live Workshop Actions, linked evidence, risks, requirements and Directions.</p>
      <p>Use this board to manage execution: actions, status, urgency, dates, linked requirements, linked risks, and blockers. Use the CISO Master Plan when you need the broader roadmap across strategy, phases, dependencies and spend.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Open actions", model.metrics.actions)}
        ${metricCard("Blocked", model.metrics.blocked)}
        ${metricCard("Overdue", model.metrics.overdue)}
        ${metricCard("Due soon", model.metrics.dueSoon)}
        ${metricCard("Linked requirements", model.metrics.linkedRequirements)}
        ${metricCard("Linked risks", model.metrics.linkedRisks)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.createAction">Create action</button>
        <button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Evidence Review</button>
        <button type="button" data-command="pspf.workshop.openConnectedView">Connected View</button>
        <button type="button" data-command="pspf.workshop.openMasterDashboard">Master Dashboard</button>
        <button type="button" data-command="pspf.workshop.openCisoMasterPlan">CISO Master Plan</button>
      </div>
    </section>
    <section>
      <h2>Timeline Preview</h2>
      <p class="muted">${escapeHtml(model.timelineStart)} to ${escapeHtml(model.timelineEnd)} · ${model.totalDays} days · adaptive width ${Math.round(model.dayWidth * 10) / 10}px/day</p>
      <div class="poa-timeline-legend" aria-label="Timeline legend">
        <span class="poa-today-legend-line" aria-hidden="true"></span>
        <span>Today: ${escapeHtml(model.today)}</span>
      </div>
      ${renderPlanOfActionStatusFilters()}
      ${renderPlanOfActionTimeline(model)}
    </section>
    ${recordTable("Action Worklist", taskRows, ["title", "stream", "status", "urgency", "startDate", "endDate", "dueDate", "linkedRequirements", "linkedRisks", "impact"])}
    ${planOfActionFilterScript()}
  `
  );
}

function renderPlanOfActionStatusFilters(): string {
  return `<div class="form-actions poa-status-filters" data-poa-status-filters>
    ${actionStatusItems.map((item) => `<button type="button" class="poa-status-filter" data-poa-status-filter="${escapeHtml(item.value)}" aria-pressed="true">${escapeHtml(item.label)}</button>`).join("")}
    <button type="button" class="poa-status-filter" data-poa-status-filter="all">All</button>
  </div>`;
}

function renderPlanOfActionTimeline(model: PlanOfActionBoardModel): string {
  if (model.metrics.actions === 0) {
    return `<p class="muted">No open Actions are available yet. Create Actions or load the sample workspace to populate the Plan of Action.</p>`;
  }
  return `<div class="poa-board" style="--poa-width: ${model.timelineWidth}px;">
    ${model.phases.map((phase) => renderPlanOfActionPhase(phase, model.timelineWidth, model.todayX, model.today)).join("")}
  </div>`;
}

function renderPlanOfActionPhase(
  phase: PlanOfActionPhaseModel,
  timelineWidth: number,
  todayX: number,
  today: string
): string {
  const tasks = phase.tasks.length
    ? phase.tasks.map((task) => renderPlanOfActionTask(task, timelineWidth, todayX, today)).join("")
    : `<p class="muted">No open Actions currently sit in this workstream.</p>`;
  return `<div class="poa-phase">
    <div class="poa-phase__header">
      <strong>${escapeHtml(phase.title)}</strong>
      <span>${escapeHtml(phase.summary)}</span>
    </div>
    <div class="poa-phase__tasks">${tasks}</div>
  </div>`;
}

function renderPlanOfActionTask(
  task: PlanOfActionTaskModel,
  timelineWidth: number,
  todayX: number,
  today: string
): string {
  const barClass = `poa-bar poa-bar--${task.urgency}`;
  const barLabel = task.timelineLabel ? `<span>${escapeHtml(task.timelineLabel)}</span>` : "";
  return `<div class="poa-task" data-poa-task data-poa-status="${escapeHtml(task.status)}">
    <button type="button" class="poa-task__label" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(task.actionId)}">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(label(task.status))} · ${escapeHtml(task.startDate)} to ${escapeHtml(task.endDate)}</span>
    </button>
    <div class="poa-track" style="width: ${timelineWidth}px;">
      ${renderPlanOfActionTodayMarker(todayX, today)}
      <div class="${escapeHtml(barClass)}" style="left: ${task.x}px; width: ${task.width}px;" title="${escapeHtml(`${task.title}: ${task.startDate} to ${task.endDate}`)}">${barLabel}</div>
    </div>
  </div>`;
}

function renderPlanOfActionTodayMarker(todayX: number, today: string): string {
  return `<div class="poa-today-marker" style="left: ${todayX}px;" aria-hidden="true" title="Today: ${escapeHtml(today)}"></div>`;
}

function planOfActionFilterScript(): string {
  return `<script>
(() => {
  const root = document.querySelector('[data-poa-status-filters]');
  if (!root) return;
  const buttons = Array.from(root.querySelectorAll('[data-poa-status-filter]'));
  const taskSelector = '[data-poa-task]';
  function selectedStatuses() {
    return new Set(buttons.filter((button) => button.dataset.poaStatusFilter !== 'all' && button.getAttribute('aria-pressed') !== 'false').map((button) => button.dataset.poaStatusFilter));
  }
  function applyFilters() {
    const selected = selectedStatuses();
    document.querySelectorAll(taskSelector).forEach((task) => {
      task.hidden = !selected.has(task.dataset.poaStatus);
    });
  }
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.poaStatusFilter;
      if (value === 'all') {
        buttons.forEach((item) => {
          if (item.dataset.poaStatusFilter !== 'all') item.setAttribute('aria-pressed', 'true');
        });
      } else {
        button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'false' ? 'true' : 'false');
      }
      applyFilters();
    });
  });
  applyFilters();
})();
</script>`;
}

function masterLoopRow(
  loop: string,
  maturity: string,
  records: number,
  signal: string,
  question: string
): { loop: string; maturity: string; records: number; signal: string; question: string } {
  return { loop, maturity, records, signal, question };
}

const ESSENTIAL_EIGHT_STRATEGIES = [
  {
    requirementNumber: 99,
    strategy: "Patch applications",
    aliases: ["patch applications"]
  },
  {
    requirementNumber: 100,
    strategy: "Patch operating systems",
    aliases: ["patch operating systems"]
  },
  {
    requirementNumber: 101,
    strategy: "Multi-factor authentication",
    aliases: ["multi-factor authentication", "multifactor authentication", "mfa"]
  },
  {
    requirementNumber: 102,
    strategy: "Restrict administrative privileges",
    aliases: ["restrict administrative privileges"]
  },
  {
    requirementNumber: 103,
    strategy: "Application control",
    aliases: ["application control"]
  },
  {
    requirementNumber: 104,
    strategy: "Restrict Microsoft Office macros",
    aliases: ["restrict microsoft office macros", "configure microsoft office macros", "office macros"]
  },
  {
    requirementNumber: 105,
    strategy: "User application hardening",
    aliases: ["user application hardening"]
  },
  {
    requirementNumber: 106,
    strategy: "Regular back-ups",
    aliases: ["regular back-ups", "regular backups"]
  }
] as const;

type EssentialEightStrategy = (typeof ESSENTIAL_EIGHT_STRATEGIES)[number];

type EssentialEightDashboardModel = {
  readonly metrics: {
    readonly requirements: number;
    readonly metPercentage: number;
    readonly evidenceCoverage: number;
    readonly notApplicable: number;
    readonly ismMappings: number;
    readonly mappedControls: number;
    readonly openActions: number;
    readonly blockedOrOverdue: number;
    readonly openRisks: number;
    readonly strategiesMet: number;
    readonly needsEvidence: number;
    readonly needsUplift: number;
  };
  readonly summary: string;
  readonly strategyRows: readonly object[];
  readonly planRows: readonly object[];
  readonly requirementRows: readonly object[];
};

function buildEssentialEightDashboardModel(allEntities: readonly V01Entity[]): EssentialEightDashboardModel {
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  const actions = enrichedEntities.filter(
    (entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted"
  );
  const risks = allEntities.filter(
    (entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted"
  );
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const sourceControlsById = new Map(
    allEntities
      .filter(
        (entity): entity is SourceControlEntity =>
          entity.entityType === "source-control" && entity.recordStatus !== "deleted"
      )
      .map((sourceControl) => [sourceControl.id, sourceControl])
  );
  const mappings = allEntities.filter(
    (entity): entity is RequirementControlMappingEntity =>
      entity.entityType === "requirement-control-mapping" && entity.recordStatus !== "deleted"
  );
  const e8Mappings = mappings.filter((mapping) =>
    isEssentialEightMapping(mapping, sourceControlsById.get(mapping.sourceControlId))
  );
  const directE8RequirementIds = new Set(
    requirements
      .filter((requirement) => Boolean(essentialEightStrategyForRequirement(requirement)))
      .map((requirement) => requirement.id)
  );
  const e8RequirementIds = new Set([...directE8RequirementIds, ...e8Mappings.map((mapping) => mapping.requirementId)]);
  const e8Requirements = requirements.filter((requirement) => e8RequirementIds.has(requirement.id));
  const e8RequirementIdSet = new Set(e8Requirements.map((requirement) => requirement.id));
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
      .filter((requirementId) => e8RequirementIdSet.has(requirementId))
  );
  const completion = buildRequirementCompletionMetrics(e8Requirements, evidenceRequirementIds);
  const linkedActionIds = new Set(
    links
      .filter(
        (link) =>
          link.linkType === "addressed-by" && link.fromType === "requirement" && e8RequirementIdSet.has(link.fromId)
      )
      .map((link) => link.toId)
  );
  const linkedRiskIds = new Set(
    links
      .filter(
        (link) =>
          link.linkType === "exposed-by" && link.fromType === "requirement" && e8RequirementIdSet.has(link.fromId)
      )
      .map((link) => link.toId)
  );
  const e8Actions = actions.filter((action) => linkedActionIds.has(action.id));
  const openActions = e8Actions.filter((action) => !["done", "cancelled"].includes(action.status));
  const openRisks = risks.filter((risk) => linkedRiskIds.has(risk.id) && risk.status !== "closed");
  const strategyRows = ESSENTIAL_EIGHT_STRATEGIES.map((strategy) =>
    essentialEightStrategyRow(strategy, e8Requirements, e8Mappings, sourceControlsById, links, actions, risks)
  );
  const strategiesMet = strategyRows.filter((row) => readRecordField(row, "status") === "Met").length;
  const needsEvidence = strategyRows.filter((row) => Number(readRecordField(row, "evidence") ?? 0) === 0).length;
  const needsUplift = strategyRows.filter((row) =>
    ["Needs uplift", "Not started"].includes(String(readRecordField(row, "status") ?? ""))
  ).length;
  const planRows = e8Actions
    .map((action) => {
      const requirementIds = links
        .filter(
          (link) => link.linkType === "addressed-by" && link.toId === action.id && e8RequirementIdSet.has(link.fromId)
        )
        .map((link) => link.fromId);
      const linkedRequirements = requirementIds
        .map((requirementId) => requirements.find((requirement) => requirement.id === requirementId))
        .filter((requirement): requirement is RequirementEntity => Boolean(requirement));
      const strategyNames = uniqueStrings(
        linkedRequirements.map(
          (requirement) => essentialEightStrategyForRequirement(requirement)?.strategy ?? "E8 mapped control"
        )
      );
      const impact = action.impact
        ? (action.impact.postureUplift ?? 0) +
          (action.impact.evidenceUplift ?? 0) +
          (action.impact.riskReduction ?? 0) +
          (action.impact.directionUplift ?? 0)
        : 0;
      return {
        openEntityType: "action",
        openEntityId: action.id,
        title: action.title,
        strategy: strategyNames.join(", ") || "E8 mapped control",
        status: label(action.status),
        urgency: action.impact ? label(action.impact.urgency) : "Normal",
        startDate: formatShortAuDateTime(action.startDate) ?? "Not set",
        endDate: formatShortAuDateTime(action.endDate) ?? "Not set",
        dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set",
        impact,
        linkedRequirements: linkedRequirements.length
      };
    })
    .sort((left, right) => Number(right.impact) - Number(left.impact));
  const requirementRows = e8Requirements
    .map((requirement) => {
      const requirementMappings = e8Mappings.filter((mapping) => mapping.requirementId === requirement.id);
      return {
        openEntityType: "requirement",
        openEntityId: requirement.id,
        title: requirement.title,
        status: label(requirement.assessmentStatus),
        evidence: evidenceRequirementIds.has(requirement.id) ? "Linked" : "Missing",
        actions: countRequirementLinks(links, requirement.id, "action", "addressed-by"),
        risks: countRequirementLinks(links, requirement.id, "risk", "exposed-by"),
        ismMappings: requirementMappings.length
      };
    })
    .sort((left, right) => String(left.title).localeCompare(String(right.title), "en-AU", { sensitivity: "base" }));
  const blockedOrOverdue = openActions.filter((action) =>
    ["blocked", "overdue"].includes(action.impact?.urgency ?? "")
  ).length;
  return {
    metrics: {
      requirements: e8Requirements.length,
      metPercentage: completion.metPercentageApplicable,
      evidenceCoverage: completion.evidenceCoverageApplicable,
      notApplicable: completion.notApplicable,
      ismMappings: e8Mappings.length,
      mappedControls: uniqueStrings(e8Mappings.map((mapping) => mapping.sourceControlId)).length,
      openActions: openActions.length,
      blockedOrOverdue,
      openRisks: openRisks.length,
      strategiesMet,
      needsEvidence,
      needsUplift
    },
    summary: `${strategiesMet} of ${ESSENTIAL_EIGHT_STRATEGIES.length} Essential Eight strategies are currently met, with ${openActions.length} open linked Actions and ${e8Mappings.length} E8-scoped ISM mappings.`,
    strategyRows,
    planRows,
    requirementRows
  };
}

function essentialEightStrategyRow(
  strategy: EssentialEightStrategy,
  e8Requirements: readonly RequirementEntity[],
  e8Mappings: readonly RequirementControlMappingEntity[],
  sourceControlsById: ReadonlyMap<string, SourceControlEntity>,
  links: readonly LinkEntity[],
  actions: readonly ActionEntity[],
  risks: readonly RiskEntity[]
): object {
  const strategyRequirements = e8Requirements.filter(
    (requirement) => essentialEightStrategyForRequirement(requirement)?.requirementNumber === strategy.requirementNumber
  );
  const requirementIds = new Set(strategyRequirements.map((requirement) => requirement.id));
  const mappings = e8Mappings.filter((mapping) => requirementIds.has(mapping.requirementId));
  const evidenceCount = strategyRequirements.filter((requirement) =>
    links.some(
      (link) =>
        link.linkType === "supported-by" &&
        link.fromType === "requirement" &&
        link.toType === "evidence" &&
        link.fromId === requirement.id
    )
  ).length;
  const openActionCount = actions.filter(
    (action) =>
      !["done", "cancelled"].includes(action.status) &&
      links.some(
        (link) =>
          link.linkType === "addressed-by" &&
          link.toType === "action" &&
          link.toId === action.id &&
          requirementIds.has(link.fromId)
      )
  ).length;
  const openRiskCount = risks.filter(
    (risk) =>
      risk.status !== "closed" &&
      links.some(
        (link) =>
          link.linkType === "exposed-by" &&
          link.toType === "risk" &&
          link.toId === risk.id &&
          requirementIds.has(link.fromId)
      )
  ).length;
  const metCount = strategyRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
  const applicableRequirements = strategyRequirements.filter((requirement) => !isNotApplicableRequirement(requirement));
  const status = essentialEightStrategyStatus(strategyRequirements);
  return {
    strategy: strategy.strategy,
    target: "ML2",
    status,
    requirements: strategyRequirements.length,
    met: `${metCount} of ${applicableRequirements.length}`,
    evidence: evidenceCount,
    ismMappings: uniqueStrings(
      mappings.map((mapping) => sourceControlsById.get(mapping.sourceControlId)?.controlId ?? mapping.sourceControlId)
    ).length,
    openActions: openActionCount,
    openRisks: openRiskCount,
    nextStep: essentialEightNextStep(status, evidenceCount, openActionCount, openRiskCount)
  };
}

function essentialEightStrategyStatus(requirements: readonly RequirementEntity[]): string {
  if (requirements.length === 0) {
    return "Not linked";
  }
  const applicableRequirements = requirements.filter((requirement) => !isNotApplicableRequirement(requirement));
  if (applicableRequirements.length === 0) {
    return "Not applicable";
  }
  if (applicableRequirements.every((requirement) => requirement.assessmentStatus === "met")) {
    return "Met";
  }
  if (applicableRequirements.some((requirement) => requirement.assessmentStatus === "not-met")) {
    return "Needs uplift";
  }
  return applicableRequirements.some((requirement) => requirement.assessmentStatus === "in-progress")
    ? "In progress"
    : "Not started";
}

function essentialEightNextStep(status: string, evidenceCount: number, openActions: number, openRisks: number): string {
  if (status === "Not linked") {
    return "Load or map the PSPF E8 Requirement";
  }
  if (evidenceCount === 0) {
    return "Attach evidence";
  }
  if (openActions > 0) {
    return "Work linked Actions";
  }
  if (openRisks > 0) {
    return "Review residual risk";
  }
  return status === "Met" ? "Maintain and recheck" : "Set assessment state";
}

function essentialEightStrategyForRequirement(requirement: RequirementEntity): EssentialEightStrategy | undefined {
  const text = `${requirement.id} ${requirement.title} ${requirement.summary ?? ""}`.toLocaleLowerCase("en-AU");
  return ESSENTIAL_EIGHT_STRATEGIES.find(
    (strategy) =>
      new RegExp(`\\b0?${strategy.requirementNumber}\\b`).test(text) ||
      strategy.aliases.some((alias) => text.includes(alias))
  );
}

function isEssentialEightMapping(
  mapping: RequirementControlMappingEntity,
  sourceControl: SourceControlEntity | undefined
): boolean {
  return (
    mapping.applicabilityProfile.toLocaleLowerCase("en-AU").startsWith("e8-") ||
    sourceControl?.profileTags.some((tag) => tag.toLocaleLowerCase("en-AU").startsWith("e8-")) === true
  );
}

function countRequirementLinks(
  links: readonly LinkEntity[],
  requirementId: string,
  toType: LinkEntity["toType"],
  linkType: LinkEntity["linkType"]
): number {
  return links.filter(
    (link) =>
      link.fromId === requirementId &&
      link.fromType === "requirement" &&
      link.toType === toType &&
      link.linkType === linkType
  ).length;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function buildRequirementCompletionMetrics(
  requirements: readonly RequirementEntity[],
  evidenceRequirementIds: ReadonlySet<string>
): {
  readonly total: number;
  readonly applicable: number;
  readonly notApplicable: number;
  readonly metApplicable: number;
  readonly metAll: number;
  readonly metPercentageApplicable: number;
  readonly metPercentageAll: number;
  readonly evidenceCoverageApplicable: number;
  readonly evidenceCoverageAll: number;
} {
  const applicableRequirements = requirements.filter((requirement) => !isNotApplicableRequirement(requirement));
  const metApplicable = applicableRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
  const metAll = requirements.filter((requirement) => requirement.assessmentStatus === "met").length;
  const evidenceCoveredApplicable = applicableRequirements.filter((requirement) =>
    evidenceRequirementIds.has(requirement.id)
  ).length;
  return {
    total: requirements.length,
    applicable: applicableRequirements.length,
    notApplicable: requirements.length - applicableRequirements.length,
    metApplicable,
    metAll,
    metPercentageApplicable: percent(metApplicable, applicableRequirements.length),
    metPercentageAll: percent(metAll, requirements.length),
    evidenceCoverageApplicable: percent(evidenceCoveredApplicable, applicableRequirements.length),
    evidenceCoverageAll: percent(evidenceRequirementIds.size, requirements.length)
  };
}

function isNotApplicableRequirement(requirement: RequirementEntity): boolean {
  return requirement.assessmentStatus === "not-applicable";
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

async function openStrategyMap(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const strategies = allEntities.filter(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  const requirements = new Map(
    allEntities
      .filter((entity): entity is RequirementEntity => entity.entityType === "requirement")
      .map((entity) => [entity.id, entity])
  );
  const risks = new Map(
    allEntities
      .filter((entity): entity is RiskEntity => entity.entityType === "risk")
      .map((entity) => [entity.id, entity])
  );
  const actions = new Map(
    enrichActionsWithImpact(allEntities)
      .filter((entity): entity is ActionEntity => entity.entityType === "action")
      .map((entity) => [entity.id, entity])
  );
  const directions = new Map(
    allEntities
      .filter((entity): entity is DirectionEntity => entity.entityType === "direction")
      .map((entity) => [entity.id, entity])
  );
  const strategy = strategies[0];
  const panel = vscode.window.createWebviewPanel("pspfStrategyMap", "PSPF Cyber Strategy Map", vscode.ViewColumn.One, {
    enableScripts: false
  });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);

  if (!strategy) {
    panel.webview.html = shellHtml(
      "PSPF Cyber Strategy Map",
      `
      <section>
        <h1>Cyber Strategy Map</h1>
        <p class="muted">No Strategy record is available in this workspace yet. Create a draft strategy or load the sample workspace to test the v1.24 strategy view.</p>
        ${versionStrip()}
        <div class="form-actions">
          <button type="button" data-command="createStrategyDraft">Create draft strategy</button>
          <button type="button" data-command="pspf.workshop.loadSampleWorkspace">Load enterprise sample workspace</button>
          <button type="button" data-command="pspf.workshop.loadHomeSampleWorkspace">Load home sample workspace</button>
        </div>
      </section>
    `
    );
    return;
  }

  const choiceRows = strategy.choices.map((choice) => ({
    choice: choice.statement,
    capability: choice.capabilityArea,
    trend: label(choice.trend),
    confidence: label(choice.confidence),
    outcomes: choice.outcomes.length,
    linkedRecords: choice.references.length,
    target: choice.targetPosture
  }));
  const measureRows = strategy.choices.flatMap((choice) =>
    choice.outcomes.flatMap((outcome) =>
      outcome.measures.map((measure) => ({
        choice: choice.statement,
        outcome: outcome.statement,
        measure: measure.title,
        class: label(measure.measureClass),
        current: measure.current ?? "Not recorded",
        target: measure.target ?? "Not recorded",
        trend: label(measure.trend),
        confidence: label(measure.confidence)
      }))
    )
  );

  panel.webview.html = shellHtml(
    "PSPF Cyber Strategy Map",
    `
    <section>
      <p class="eyebrow">Leadership Strategy Map</p>
      <h1>${escapeHtml(strategy.title)}</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Scope", strategy.scope)}
        ${metricCard("Time horizon", strategy.timeHorizon)}
        ${metricCard("Choices", strategy.choices.length)}
        ${metricCard("Frameworks", strategy.frameworks.join(", "))}
      </div>
      <h2>Strategy Statement</h2>
      <p>${escapeHtml(strategy.strategyStatement)}</p>
      <h2>Risk Posture</h2>
      <p>${escapeHtml(strategy.riskPostureStatement)}</p>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.editStrategySummary">Open strategy editor</button>
        <button type="button" data-command="pspf.workshop.copyPostureBrief">Copy brief</button>
      </div>
    </section>
    <section>
      <h2>Strategic Choices</h2>
      <div class="grid">
        ${strategy.choices.map((choice) => strategyChoiceCard(choice, { requirements, risks, actions, directions })).join("")}
      </div>
    </section>
    ${recordTable("Choice Summary", choiceRows, ["choice", "capability", "trend", "confidence", "outcomes", "linkedRecords", "target"])}
    ${recordTable("Posture Measures", measureRows, ["choice", "outcome", "measure", "class", "current", "target", "trend", "confidence"])}
  `
  );
}

async function createDraftStrategy(): Promise<StrategyEntity | undefined> {
  await ensureCoreReady();
  const existing = (await listAllEntities()).find(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  if (existing) {
    await vscode.window.showInformationMessage("A Strategy record already exists. Opening the Strategy Map.");
    return existing;
  }

  const strategy = withEnvelope(
    "strategy",
    {
      entityType: "strategy",
      title: "Cybersecurity Strategy",
      scope: "Whole organisation",
      timeHorizon: "12 months",
      owner: "CISO",
      strategyStatement: "Set the strategic direction for PSPF uplift and assurance.",
      riskPostureStatement:
        "Risk posture will be refined as evidence, Actions, Requirements, and Directions are linked.",
      frameworks: ["PSPF", "ISM", "Essential Eight"],
      reviewCadence: "quarterly",
      executiveSummary: "Draft strategy ready for leadership refinement.",
      assumptions: "Draft internal assumptions are sensitive and excluded from publication by default.",
      choices: [
        {
          id: "choice-assurance-focus",
          statement: "Set the first strategic choice",
          summary: "Draft choice ready to link to Requirements, Risks, Actions, and Directions.",
          capabilityArea: "Governance and assurance",
          targetPosture: "Target posture to be defined.",
          executiveOwner: "CISO",
          trend: "unknown",
          confidence: "low",
          rationale: "Draft rationale to be refined by the operator.",
          constraints: "Constraints not yet recorded.",
          references: [],
          outcomes: [
            {
              id: "outcome-initial-posture",
              statement: "Define the first target outcome",
              summary: "Draft outcome ready for posture measures and linked work.",
              references: [],
              measures: [
                {
                  id: "measure-initial-posture",
                  title: "Initial posture measure",
                  measureClass: "capability",
                  baseline: "Not recorded",
                  current: "Not recorded",
                  target: "To be defined",
                  unit: "state",
                  trend: "unknown",
                  confidence: "low",
                  reviewCadence: "quarterly"
                }
              ]
            }
          ]
        }
      ]
    },
    "workshop"
  ) satisfies StrategyEntity;

  await vscode.commands.executeCommand("pspf.core.upsertEntity", strategy);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage("Created draft Cybersecurity Strategy.");
  return strategy;
}

async function editStrategySummary(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const existing = allEntities.find(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  const strategy = existing ?? (await createDraftStrategy());
  if (!strategy) {
    return;
  }
  await openStrategyEditorPanel(strategy);
}

async function openStrategyEditorPanel(strategy: StrategyEntity): Promise<void> {
  let currentStrategy = strategy;
  let currentArea = "frame";
  const panel = vscode.window.createWebviewPanel("pspfStrategyEditor", "PSPF Strategy Editor", vscode.ViewColumn.One, {
    enableScripts: true
  });

  const refresh = (): void => {
    panel.webview.html = renderStrategyEditorPanel(currentStrategy, currentArea);
  };

  const runPendingCommand = async (message: SaveEntityMessage): Promise<void> => {
    const command = message.pendingCommand;
    if (!command) {
      return;
    }
    if (isStrategyManagementCommand(command)) {
      await applyStrategyManagementCommand(command, {
        ...message,
        strategyArea: message.pendingStrategyArea,
        choiceIndex: message.pendingChoiceIndex,
        outcomeIndex: message.pendingOutcomeIndex
      });
      return;
    }
    if (command === "closeEditor") {
      panel.dispose();
      return;
    }
    if (command === "openStrategyArea" && message.pendingStrategyArea) {
      currentArea = normaliseStrategyEditorArea(message.pendingStrategyArea, currentStrategy);
      refresh();
      return;
    }
    if (command === "pspf.workshop.openStrategyMap") {
      panel.dispose();
      await openStrategyMap();
      return;
    }
    if (command.startsWith("pspf.")) {
      await vscode.commands.executeCommand(command);
      refresh();
    }
  };

  const applyStrategyManagementCommand = async (command: string, message: SaveEntityMessage): Promise<void> => {
    const result = await handleStrategyManagementCommand(currentStrategy, command, message, currentArea);
    if (!result) {
      return;
    }
    if (result.strategy) {
      currentStrategy = result.strategy;
      await vscode.commands.executeCommand("pspf.core.upsertEntity", currentStrategy);
    }
    if (result.area) {
      currentArea = normaliseStrategyEditorArea(result.area, currentStrategy);
    }
    await refreshWorkshopSurfaces();
    if (result.message) {
      await vscode.window.showInformationMessage(result.message);
    }
    refresh();
  };

  panel.webview.onDidReceiveMessage(async (message: SaveEntityMessage) => {
    if (message.command === "confirmDirtyNavigation") {
      const choice = await vscode.window.showWarningMessage(
        "You have unsaved strategy changes. Save before continuing?",
        { modal: true },
        "Save",
        "Discard",
        "Cancel"
      );
      if (choice === "Cancel" || !choice) {
        return;
      }
      if (choice === "Save") {
        const updated = await buildUpdatedStrategy(currentStrategy, message.fields ?? {});
        if (!updated) {
          return;
        }
        currentStrategy = updated;
        await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
        await refreshWorkshopSurfaces();
      }
      await runPendingCommand(message);
      return;
    }
    if (message.command === "saveEntity" || message.command === "saveAndCloseEntity") {
      const updated = await buildUpdatedStrategy(currentStrategy, message.fields ?? {});
      if (!updated) {
        return;
      }
      currentStrategy = updated;
      await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
      await refreshWorkshopSurfaces();
      if (message.command === "saveAndCloseEntity") {
        panel.dispose();
        await openStrategyMap();
        return;
      }
      await vscode.window.showInformationMessage("Strategy updated.");
      refresh();
      return;
    }
    if (message.command === "refresh") {
      const latest = (await listAllEntities()).find(
        (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.id === currentStrategy.id
      );
      if (latest) {
        currentStrategy = latest;
      }
      refresh();
      return;
    }
    if (message.command === "openStrategyArea" && message.strategyArea) {
      currentArea = normaliseStrategyEditorArea(message.strategyArea, currentStrategy);
      refresh();
      return;
    }
    if (message.command && isStrategyManagementCommand(message.command)) {
      await applyStrategyManagementCommand(message.command, message);
      return;
    }
    if (message.command === "closeEditor") {
      panel.dispose();
      return;
    }
    if (message.command === "pspf.workshop.openStrategyMap") {
      panel.dispose();
      await openStrategyMap();
      return;
    }
    if (message.command?.startsWith("pspf.")) {
      await vscode.commands.executeCommand(message.command);
      refresh();
    }
  });

  refresh();
}

function renderStrategyEditorPanel(strategy: StrategyEntity, currentArea: string): string {
  return shellHtml(
    "PSPF Strategy Editor",
    `
    <div class="strategy-editor">
      <section>
        <p class="eyebrow">Full Size Editor</p>
        <h1>${escapeHtml(strategy.title)}</h1>
        <p class="muted">OFFICIAL: Sensitive · Edit the strategy narrative, posture logic, assumptions, choices, outcomes and measures together.</p>
        ${versionStrip()}
        <div class="form-actions">
          <button type="button" data-command="refresh">Refresh</button>
          <button type="button" data-command="addStrategyChoice" data-strategy-area="${escapeHtml(currentArea)}">Add choice</button>
          <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
          <button type="button" data-command="pspf.workshop.copyPostureBrief">Copy brief</button>
        </div>
      </section>
      <div class="strategy-editor__layout">
        ${renderStrategyAreaNav(strategy, currentArea)}
        <div>
      <form class="form-grid strategy-editor__form">
        <input type="hidden" name="entityType" value="strategy">
        <input type="hidden" name="entityId" value="${escapeHtml(strategy.id)}">
        <input type="hidden" name="strategyArea" value="${escapeHtml(currentArea)}">
        ${renderStrategyAreaReadiness(strategy, currentArea)}
        ${renderStrategyEditorArea(strategy, currentArea)}
        <section>
          <h2>Save</h2>
          <p class="muted">Saving updates only this visible Strategy area, then writes the refreshed Strategy record used by the Strategy Map and copied posture brief.</p>
          <div class="form-actions">
            <button type="button" data-command="saveEntity">Save this area</button>
            <button type="button" data-command="saveAndCloseEntity">Save and view map</button>
            <button type="button" data-command="closeEditor">Cancel</button>
          </div>
        </section>
      </form>
        </div>
      </div>
    </div>
  `
  );
}

function renderStrategyAreaNav(strategy: StrategyEntity, currentArea: string): string {
  const items = [
    strategyAreaNavItem("frame", "Strategy frame", "Executive summary, authority, scope, posture", currentArea)
  ];
  for (const [choiceIndex, choice] of strategy.choices.entries()) {
    items.push(
      strategyAreaNavItem(
        strategyChoiceArea(choiceIndex),
        `Choice ${choiceIndex + 1}`,
        `${choice.capabilityArea} - ${choice.outcomes.length} outcomes`,
        currentArea
      )
    );
    for (const [outcomeIndex, outcome] of choice.outcomes.entries()) {
      items.push(
        strategyAreaNavItem(
          strategyOutcomeArea(choiceIndex, outcomeIndex),
          `Outcome ${choiceIndex + 1}.${outcomeIndex + 1}`,
          `${outcome.measures.length} measures - ${outcome.statement}`,
          currentArea,
          true
        )
      );
    }
  }
  return `<nav class="strategy-editor__nav" aria-label="Strategy editor areas"><h2>Edit areas</h2>${items.join("")}</nav>`;
}

function strategyAreaNavItem(area: string, title: string, detail: string, currentArea: string, nested = false): string {
  return `<button type="button" class="strategy-editor__nav-item${nested ? " strategy-editor__nav-item--nested" : ""}" data-command="openStrategyArea" data-strategy-area="${escapeHtml(area)}"${area === currentArea ? ' aria-current="page"' : ""}><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></button>`;
}

function renderStrategyAreaReadiness(strategy: StrategyEntity, currentArea: string): string {
  const summary = strategyAreaReadiness(strategy, currentArea);
  const missingItems = summary.missing.length > 0 ? summary.missing : ["No obvious gaps for this area."];
  return `<section class="strategy-editor__readiness">
    <p class="eyebrow">Area readiness</p>
    <h2>${escapeHtml(summary.title)}</h2>
    <p class="muted">${escapeHtml(summary.description)}</p>
    <div class="strategy-editor__cue-grid">
      ${metricCard("Requirements", summary.referenceCounts.requirement)}
      ${metricCard("Risks", summary.referenceCounts.risk)}
      ${metricCard("Actions", summary.referenceCounts.action)}
      ${metricCard("Directions", summary.referenceCounts.direction)}
      ${metricCard("Outcomes", summary.outcomeCount)}
      ${metricCard("Measures", summary.measureCount)}
    </div>
    <div class="strategy-editor__cue-grid strategy-editor__cue-grid--text">
      <div class="strategy-editor__cue"><h3>Next useful checks</h3><ul>${missingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="strategy-editor__cue"><h3>Publication posture</h3><p>${escapeHtml(summary.publicationCue)}</p></div>
    </div>
  </section>`;
}

type StrategyAreaReadiness = {
  readonly title: string;
  readonly description: string;
  readonly referenceCounts: Readonly<Record<"requirement" | "risk" | "action" | "direction", number>>;
  readonly outcomeCount: number;
  readonly measureCount: number;
  readonly missing: readonly string[];
  readonly publicationCue: string;
};

function strategyAreaReadiness(strategy: StrategyEntity, currentArea: string): StrategyAreaReadiness {
  if (currentArea === "frame") {
    const allReferences = strategy.choices.flatMap((choice) => [
      ...choice.references,
      ...choice.outcomes.flatMap((outcome) => outcome.references)
    ]);
    const outcomeCount = strategy.choices.reduce((total, choice) => total + choice.outcomes.length, 0);
    const measureCount = strategy.choices.reduce(
      (total, choice) =>
        total + choice.outcomes.reduce((innerTotal, outcome) => innerTotal + outcome.measures.length, 0),
      0
    );
    return {
      title: "Strategy frame",
      description: "Executive context, authority, scope, posture, and assumptions for the whole Strategy record.",
      referenceCounts: strategyReferenceCounts(allReferences),
      outcomeCount,
      measureCount,
      missing: compactStrings([
        strategy.strategyStatement.trim() ? "" : "Add a Strategy statement before briefing leadership.",
        strategy.riskPostureStatement.trim()
          ? ""
          : "Add the risk posture statement that explains the direction of travel.",
        strategy.choices.length > 0 ? "" : "Add at least one strategic choice.",
        outcomeCount > 0 ? "" : "Add outcomes under the strategic choices.",
        measureCount > 0 ? "" : "Add at least one measure so the roadmap has a target signal."
      ]),
      publicationCue:
        "Strategy statement, executive summary, scope, and posture can support executive views. Assumptions and internal working notes stay sensitive by default."
    };
  }

  const outcomeMatch = currentArea.match(/^choice\.(\d+)\.outcome\.(\d+)$/);
  if (outcomeMatch) {
    const choiceIndex = Number(outcomeMatch[1]);
    const outcomeIndex = Number(outcomeMatch[2]);
    const outcome = strategy.choices[choiceIndex]?.outcomes[outcomeIndex];
    if (outcome) {
      return {
        title: `Outcome ${choiceIndex + 1}.${outcomeIndex + 1}`,
        description: "Outcome workspace for intended change, measures, and linked work.",
        referenceCounts: strategyReferenceCounts(outcome.references),
        outcomeCount: 1,
        measureCount: outcome.measures.length,
        missing: compactStrings([
          outcome.statement.trim() ? "" : "Add the outcome statement.",
          outcome.summary.trim() ? "" : "Add an outcome summary for executive readers.",
          outcome.references.length > 0
            ? ""
            : "Link at least one Requirement so this outcome traces to assurance work.",
          outcome.measures.length > 0 ? "" : "Add at least one measure with current and target values.",
          outcome.measures.some((measure) => (measure.target ?? "").trim())
            ? ""
            : "Add a target value to at least one measure."
        ]),
        publicationCue:
          "Outcome statement, summary, and high-level measures can support the executive roadmap. Linked record detail remains governed by each source record."
      };
    }
  }

  const choiceMatch = currentArea.match(/^choice\.(\d+)$/);
  if (choiceMatch) {
    const choiceIndex = Number(choiceMatch[1]);
    const choice = strategy.choices[choiceIndex];
    if (choice) {
      const measureCount = choice.outcomes.reduce((total, outcome) => total + outcome.measures.length, 0);
      return {
        title: `Strategic choice ${choiceIndex + 1}`,
        description: "Choice context for intent, owner, target posture, rationale, constraints, and outcomes.",
        referenceCounts: strategyReferenceCounts(choice.references),
        outcomeCount: choice.outcomes.length,
        measureCount,
        missing: compactStrings([
          choice.statement.trim() ? "" : "Add the choice statement.",
          choice.summary.trim() ? "" : "Add a choice summary that can feed the Master Plan.",
          choice.targetPosture.trim() ? "" : "Add the target posture for this choice.",
          choice.references.length > 0 ? "" : "Link at least one Requirement to ground the choice.",
          choice.outcomes.length > 0 ? "" : "Add outcomes under this choice.",
          measureCount > 0 ? "" : "Add measures under the outcomes."
        ]),
        publicationCue:
          "Choice statement, summary, capability area, and target posture can inform executive planning. Rationale and constraints remain internal working context."
      };
    }
  }

  return strategyAreaReadiness(strategy, "frame");
}

function strategyReferenceCounts(
  references: readonly StrategyEntity["choices"][number]["references"][number][]
): Readonly<Record<"requirement" | "risk" | "action" | "direction", number>> {
  return {
    requirement: references.filter((reference) => reference.entityType === "requirement").length,
    risk: references.filter((reference) => reference.entityType === "risk").length,
    action: references.filter((reference) => reference.entityType === "action").length,
    direction: references.filter((reference) => reference.entityType === "direction").length
  };
}

function compactStrings(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.trim().length > 0);
}

function renderStrategyEditorArea(strategy: StrategyEntity, currentArea: string): string {
  if (currentArea === "frame") {
    return renderStrategyFrameEditor(strategy);
  }
  const outcomeMatch = currentArea.match(/^choice\.(\d+)\.outcome\.(\d+)$/);
  if (outcomeMatch) {
    const choiceIndex = Number(outcomeMatch[1]);
    const outcomeIndex = Number(outcomeMatch[2]);
    const outcome = strategy.choices[choiceIndex]?.outcomes[outcomeIndex];
    return outcome
      ? renderStrategyOutcomeEditor(outcome, choiceIndex, outcomeIndex)
      : renderStrategyFrameEditor(strategy);
  }
  const choiceMatch = currentArea.match(/^choice\.(\d+)$/);
  if (choiceMatch) {
    const choiceIndex = Number(choiceMatch[1]);
    const choice = strategy.choices[choiceIndex];
    return choice ? renderStrategyChoiceEditor(choice, choiceIndex) : renderStrategyFrameEditor(strategy);
  }
  return renderStrategyFrameEditor(strategy);
}

function renderStrategyFrameEditor(strategy: StrategyEntity): string {
  return `<section>
    <p class="eyebrow">Stable authority</p>
    <h2>Strategy Frame</h2>
    <p class="muted">Use this area for top-line authority and executive context. It should change less often than outcomes, constraints, or measures.</p>
    <div class="strategy-editor__two-col">
      ${inputField("title", "Title", strategy.title, true)}
      ${inputField("scope", "Scope", strategy.scope, true)}
      ${inputField("timeHorizon", "Time horizon", strategy.timeHorizon, true)}
      ${inputField("owner", "Owner", strategy.owner ?? "")}
      ${inputField("effectiveAt", "Effective from", strategy.effectiveAt ?? "")}
      ${inputField("frameworks", "Frameworks", strategy.frameworks.join(", "))}
    </div>
    ${strategyTextArea("strategyStatement", "Strategy statement", strategy.strategyStatement, 8)}
    ${strategyTextArea("riskPostureStatement", "Risk posture statement", strategy.riskPostureStatement, 8)}
    ${strategyTextArea("executiveSummary", "Executive summary", strategy.executiveSummary ?? "", 8)}
    ${strategyTextArea("assumptions", "Assumptions", strategy.assumptions ?? "", 8)}
  </section>`;
}

function renderStrategyChoiceEditor(choice: StrategyEntity["choices"][number], choiceIndex: number): string {
  return `<section>
    <p class="eyebrow">Choice context</p>
    <h2>Strategic Choice ${choiceIndex + 1}</h2>
    <p class="muted">Use this area for the intent, owner, target posture, rationale, and constraints behind this choice. Outcomes are edited separately.</p>
    <div class="form-actions">
      <button type="button" data-command="addStrategyOutcome" data-strategy-area="${escapeHtml(strategyChoiceArea(choiceIndex))}" data-choice-index="${choiceIndex}">Add outcome</button>
      <button type="button" data-command="linkStrategyRequirement" data-strategy-area="${escapeHtml(strategyChoiceArea(choiceIndex))}" data-choice-index="${choiceIndex}">Link Requirement</button>
      <button type="button" data-command="mapStrategyRequirementToIsm" data-strategy-area="${escapeHtml(strategyChoiceArea(choiceIndex))}" data-choice-index="${choiceIndex}">Map linked Requirement to ISM control</button>
    </div>
    ${strategyReferenceSummary(choice.references)}
    <div class="strategy-editor__two-col">
      ${strategyTextArea(`choice.${choiceIndex}.statement`, "Choice statement", choice.statement, 5)}
      ${strategyTextArea(`choice.${choiceIndex}.summary`, "Choice summary", choice.summary, 5)}
      ${inputField(`choice.${choiceIndex}.capabilityArea`, "Capability area", choice.capabilityArea, true)}
      ${inputField(`choice.${choiceIndex}.targetPosture`, "Target posture", choice.targetPosture, true)}
      ${inputField(`choice.${choiceIndex}.executiveOwner`, "Executive owner", choice.executiveOwner ?? "")}
      ${inputField(`choice.${choiceIndex}.rationale`, "Rationale", choice.rationale ?? "")}
    </div>
    ${strategyTextArea(`choice.${choiceIndex}.constraints`, "Constraints and dependencies", choice.constraints ?? "", 5)}
    <div class="strategy-editor__nested">
      <h3>Outcomes under this choice</h3>
      <p class="muted">Open an outcome from the edit-area list to change its statement, summary, measures, baseline, current state, or target.</p>
      <div class="grid">${choice.outcomes.map((outcome, outcomeIndex) => metricCard(`Outcome ${choiceIndex + 1}.${outcomeIndex + 1}`, outcome.statement)).join("")}</div>
    </div>
  </section>`;
}

function renderStrategyOutcomeEditor(
  outcome: StrategyEntity["choices"][number]["outcomes"][number],
  choiceIndex: number,
  outcomeIndex: number
): string {
  return `<section>
    <p class="eyebrow">Outcome workspace</p>
    <h2>Outcome ${choiceIndex + 1}.${outcomeIndex + 1}</h2>
    <p class="muted">Use this area for active planning work. Saving here keeps other choices and the executive frame unchanged.</p>
    <div class="form-actions">
      <button type="button" data-command="addStrategyMeasure" data-strategy-area="${escapeHtml(strategyOutcomeArea(choiceIndex, outcomeIndex))}" data-choice-index="${choiceIndex}" data-outcome-index="${outcomeIndex}">Add measure</button>
      <button type="button" data-command="linkStrategyRequirement" data-strategy-area="${escapeHtml(strategyOutcomeArea(choiceIndex, outcomeIndex))}" data-choice-index="${choiceIndex}" data-outcome-index="${outcomeIndex}">Link Requirement</button>
      <button type="button" data-command="mapStrategyRequirementToIsm" data-strategy-area="${escapeHtml(strategyOutcomeArea(choiceIndex, outcomeIndex))}" data-choice-index="${choiceIndex}" data-outcome-index="${outcomeIndex}">Map linked Requirement to ISM control</button>
    </div>
    ${strategyReferenceSummary(outcome.references)}
    <div class="strategy-editor__two-col">
      ${strategyTextArea(`choice.${choiceIndex}.outcome.${outcomeIndex}.statement`, "Outcome statement", outcome.statement, 5)}
      ${strategyTextArea(`choice.${choiceIndex}.outcome.${outcomeIndex}.summary`, "Outcome summary", outcome.summary, 5)}
    </div>
    ${outcome.measures
      .map(
        (measure, measureIndex) => `
        <div class="strategy-editor__measure">
          <h3>Measure ${choiceIndex + 1}.${outcomeIndex + 1}.${measureIndex + 1}</h3>
          <div class="strategy-editor__two-col">
            ${inputField(`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.title`, "Measure title", measure.title, true)}
            ${inputField(`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.unit`, "Unit", measure.unit ?? "")}
            ${strategyTextArea(`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.baseline`, "Baseline", measure.baseline ?? "", 3)}
            ${strategyTextArea(`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.current`, "Current", measure.current ?? "", 3)}
            ${strategyTextArea(`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.target`, "Target", measure.target ?? "", 3)}
          </div>
        </div>`
      )
      .join("")}
  </section>`;
}

function strategyChoiceArea(choiceIndex: number): string {
  return `choice.${choiceIndex}`;
}

function strategyOutcomeArea(choiceIndex: number, outcomeIndex: number): string {
  return `choice.${choiceIndex}.outcome.${outcomeIndex}`;
}

function normaliseStrategyEditorArea(area: string, strategy: StrategyEntity): string {
  if (area === "frame") {
    return area;
  }
  const outcomeMatch = area.match(/^choice\.(\d+)\.outcome\.(\d+)$/);
  if (outcomeMatch && strategy.choices[Number(outcomeMatch[1])]?.outcomes[Number(outcomeMatch[2])]) {
    return area;
  }
  const choiceMatch = area.match(/^choice\.(\d+)$/);
  if (choiceMatch && strategy.choices[Number(choiceMatch[1])]) {
    return area;
  }
  return "frame";
}

function strategyReferenceSummary(
  references: readonly StrategyEntity["choices"][number]["references"][number][]
): string {
  if (references.length === 0) {
    return `<p class="muted">No linked Requirements yet.</p>`;
  }
  const rows = references
    .map(
      (reference) =>
        `<li>${shellPill(label(reference.role))} ${escapeHtml(label(reference.entityType))}: ${escapeHtml(reference.entityId)}</li>`
    )
    .join("");
  return `<div class="strategy-editor__nested"><h3>Linked records</h3><ul>${rows}</ul></div>`;
}

type StrategyManagementResult = {
  readonly strategy?: StrategyEntity;
  readonly area?: string;
  readonly message?: string;
};

function isStrategyManagementCommand(command: string): boolean {
  return [
    "addStrategyChoice",
    "addStrategyOutcome",
    "addStrategyMeasure",
    "linkStrategyRequirement",
    "mapStrategyRequirementToIsm"
  ].includes(command);
}

async function handleStrategyManagementCommand(
  strategy: StrategyEntity,
  command: string,
  message: SaveEntityMessage,
  currentArea: string
): Promise<StrategyManagementResult | undefined> {
  switch (command) {
    case "addStrategyChoice":
      return addStrategyChoice(strategy);
    case "addStrategyOutcome":
      return addStrategyOutcome(strategy, strategyChoiceIndexFromMessage(message, currentArea));
    case "addStrategyMeasure":
      return addStrategyMeasure(strategy, strategyOutcomeLocationFromMessage(message, currentArea));
    case "linkStrategyRequirement":
      return linkStrategyRequirement(strategy, strategyReferenceLocationFromMessage(message, currentArea));
    case "mapStrategyRequirementToIsm":
      return mapStrategyRequirementToIsm(strategy, strategyReferenceLocationFromMessage(message, currentArea));
  }
  return undefined;
}

function addStrategyChoice(strategy: StrategyEntity): StrategyManagementResult {
  const choiceIndex = strategy.choices.length;
  const nextChoice: StrategyEntity["choices"][number] = {
    id: `choice-${randomUUID()}`,
    statement: "New strategic choice",
    summary: "Describe why this choice matters and how it shapes assurance work.",
    capabilityArea: "Capability area",
    targetPosture: "Target posture to be defined.",
    trend: "unknown",
    confidence: "low",
    outcomes: [],
    references: []
  };
  return {
    strategy: { ...strategy, choices: [...strategy.choices, nextChoice], updatedAt: new Date().toISOString() },
    area: strategyChoiceArea(choiceIndex),
    message: "Added Strategy choice."
  };
}

function addStrategyOutcome(
  strategy: StrategyEntity,
  choiceIndex: number | undefined
): StrategyManagementResult | undefined {
  if (choiceIndex === undefined || !strategy.choices[choiceIndex]) {
    vscode.window.showWarningMessage("Open a Strategy choice before adding an outcome.");
    return undefined;
  }
  const outcomeIndex = strategy.choices[choiceIndex].outcomes.length;
  const nextOutcome: StrategyEntity["choices"][number]["outcomes"][number] = {
    id: `outcome-${randomUUID()}`,
    statement: "New outcome",
    summary: "Describe the intended outcome and the context it establishes.",
    measures: [],
    references: []
  };
  return {
    strategy: {
      ...strategy,
      choices: strategy.choices.map((choice, index) =>
        index === choiceIndex ? { ...choice, outcomes: [...choice.outcomes, nextOutcome] } : choice
      ),
      updatedAt: new Date().toISOString()
    },
    area: strategyOutcomeArea(choiceIndex, outcomeIndex),
    message: "Added Strategy outcome."
  };
}

function addStrategyMeasure(
  strategy: StrategyEntity,
  location: { readonly choiceIndex: number; readonly outcomeIndex: number } | undefined
): StrategyManagementResult | undefined {
  if (!location || !strategy.choices[location.choiceIndex]?.outcomes[location.outcomeIndex]) {
    vscode.window.showWarningMessage("Open a Strategy outcome before adding a measure.");
    return undefined;
  }
  const nextMeasure: StrategyEntity["choices"][number]["outcomes"][number]["measures"][number] = {
    id: `measure-${randomUUID()}`,
    title: "New measure",
    measureClass: "capability",
    baseline: "Not recorded",
    current: "Not recorded",
    target: "Target to be defined",
    unit: "state",
    trend: "unknown",
    confidence: "low",
    reviewCadence: "quarterly"
  };
  return {
    strategy: {
      ...strategy,
      choices: strategy.choices.map((choice, choiceIndex) =>
        choiceIndex === location.choiceIndex
          ? {
              ...choice,
              outcomes: choice.outcomes.map((outcome, outcomeIndex) =>
                outcomeIndex === location.outcomeIndex
                  ? { ...outcome, measures: [...outcome.measures, nextMeasure] }
                  : outcome
              )
            }
          : choice
      ),
      updatedAt: new Date().toISOString()
    },
    area: strategyOutcomeArea(location.choiceIndex, location.outcomeIndex),
    message: "Added Strategy measure."
  };
}

async function linkStrategyRequirement(
  strategy: StrategyEntity,
  location: StrategyReferenceLocation | undefined
): Promise<StrategyManagementResult | undefined> {
  if (!location) {
    vscode.window.showWarningMessage("Open a Strategy choice or outcome before linking a Requirement.");
    return undefined;
  }
  const requirements = (await listAllEntities()).filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  if (requirements.length === 0) {
    vscode.window.showWarningMessage("No active Requirements are available to link.");
    return undefined;
  }
  const selected = await vscode.window.showQuickPick(
    requirements.map((requirement) => ({
      label: requirement.title,
      description: domainName(requirement.domainId),
      requirement
    })),
    { title: "Link Requirement to Strategy", placeHolder: "Requirement", ignoreFocusOut: true }
  );
  if (!selected) {
    return undefined;
  }
  const role = await vscode.window.showQuickPick(
    STRATEGY_REFERENCE_ROLES.map((value) => ({ label: label(value), value })),
    { title: "Requirement role in this Strategy area", placeHolder: "Reference role", ignoreFocusOut: true }
  );
  if (!role) {
    return undefined;
  }
  const reference: StrategyEntity["choices"][number]["references"][number] = {
    entityType: "requirement",
    entityId: selected.requirement.id,
    role: role.value
  };
  const updated = upsertStrategyReference(strategy, location, reference);
  if (!updated) {
    vscode.window.showInformationMessage("That Requirement is already linked to this Strategy area.");
    return undefined;
  }
  return {
    strategy: updated,
    area: strategyAreaForReferenceLocation(location),
    message: `Linked Requirement to Strategy ${location.kind}.`
  };
}

async function mapStrategyRequirementToIsm(
  strategy: StrategyEntity,
  location: StrategyReferenceLocation | undefined
): Promise<StrategyManagementResult | undefined> {
  if (!location) {
    vscode.window.showWarningMessage(
      "Open a Strategy choice or outcome before mapping a linked Requirement to an ISM control."
    );
    return undefined;
  }
  const requirementIds = strategyRequirementReferenceIds(strategy, location);
  if (requirementIds.length === 0) {
    vscode.window.showWarningMessage("Link at least one Requirement to this Strategy area before mapping controls.");
    return undefined;
  }
  const requirements = (await listAllEntities()).filter(
    (entity): entity is RequirementEntity =>
      entity.entityType === "requirement" && entity.recordStatus !== "deleted" && requirementIds.includes(entity.id)
  );
  const selected = await vscode.window.showQuickPick(
    requirements.map((requirement) => ({
      label: requirement.title,
      description: domainName(requirement.domainId),
      requirement
    })),
    {
      title: "Map linked Requirement to ISM control",
      placeHolder: "Requirement carrying the control mapping",
      ignoreFocusOut: true
    }
  );
  if (!selected) {
    return undefined;
  }
  await createRequirementControlMapping(selected.requirement);
  return {
    area: strategyAreaForReferenceLocation(location),
    message: "Opened ISM control mapping for linked Requirement."
  };
}

type StrategyReferenceLocation =
  | { readonly kind: "choice"; readonly choiceIndex: number }
  | { readonly kind: "outcome"; readonly choiceIndex: number; readonly outcomeIndex: number };

function strategyChoiceIndexFromMessage(message: SaveEntityMessage, currentArea: string): number | undefined {
  const explicit = parseNonNegativeInteger(message.choiceIndex);
  if (explicit !== undefined) {
    return explicit;
  }
  const area = message.strategyArea ?? currentArea;
  const choiceMatch = area.match(/^choice\.(\d+)(?:\.outcome\.\d+)?$/);
  return choiceMatch ? Number(choiceMatch[1]) : undefined;
}

function strategyOutcomeLocationFromMessage(
  message: SaveEntityMessage,
  currentArea: string
): { readonly choiceIndex: number; readonly outcomeIndex: number } | undefined {
  const explicitChoice = parseNonNegativeInteger(message.choiceIndex);
  const explicitOutcome = parseNonNegativeInteger(message.outcomeIndex);
  if (explicitChoice !== undefined && explicitOutcome !== undefined) {
    return { choiceIndex: explicitChoice, outcomeIndex: explicitOutcome };
  }
  const area = message.strategyArea ?? currentArea;
  const outcomeMatch = area.match(/^choice\.(\d+)\.outcome\.(\d+)$/);
  return outcomeMatch ? { choiceIndex: Number(outcomeMatch[1]), outcomeIndex: Number(outcomeMatch[2]) } : undefined;
}

function strategyReferenceLocationFromMessage(
  message: SaveEntityMessage,
  currentArea: string
): StrategyReferenceLocation | undefined {
  const outcomeLocation = strategyOutcomeLocationFromMessage(message, currentArea);
  if (outcomeLocation) {
    return { kind: "outcome", ...outcomeLocation };
  }
  const choiceIndex = strategyChoiceIndexFromMessage(message, currentArea);
  return choiceIndex === undefined ? undefined : { kind: "choice", choiceIndex };
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function upsertStrategyReference(
  strategy: StrategyEntity,
  location: StrategyReferenceLocation,
  reference: StrategyEntity["choices"][number]["references"][number]
): StrategyEntity | undefined {
  let inserted = false;
  const choices = strategy.choices.map((choice, choiceIndex) => {
    if (choiceIndex !== location.choiceIndex) {
      return choice;
    }
    if (location.kind === "choice") {
      const references = appendStrategyReference(choice.references, reference);
      inserted = references !== choice.references;
      return { ...choice, references };
    }
    return {
      ...choice,
      outcomes: choice.outcomes.map((outcome, outcomeIndex) => {
        if (outcomeIndex !== location.outcomeIndex) {
          return outcome;
        }
        const references = appendStrategyReference(outcome.references, reference);
        inserted = references !== outcome.references;
        return { ...outcome, references };
      })
    };
  });
  return inserted ? { ...strategy, choices, updatedAt: new Date().toISOString() } : undefined;
}

function appendStrategyReference(
  references: readonly StrategyEntity["choices"][number]["references"][number][],
  reference: StrategyEntity["choices"][number]["references"][number]
): readonly StrategyEntity["choices"][number]["references"][number][] {
  return references.some(
    (candidate) => candidate.entityType === reference.entityType && candidate.entityId === reference.entityId
  )
    ? references
    : [...references, reference];
}

function strategyRequirementReferenceIds(
  strategy: StrategyEntity,
  location: StrategyReferenceLocation
): readonly string[] {
  const choice = strategy.choices[location.choiceIndex];
  const references =
    location.kind === "choice" ? choice?.references : choice?.outcomes[location.outcomeIndex]?.references;
  return [
    ...new Set(
      (references ?? [])
        .filter((reference) => reference.entityType === "requirement")
        .map((reference) => reference.entityId)
    )
  ];
}

function strategyAreaForReferenceLocation(location: StrategyReferenceLocation): string {
  return location.kind === "choice"
    ? strategyChoiceArea(location.choiceIndex)
    : strategyOutcomeArea(location.choiceIndex, location.outcomeIndex);
}

async function buildUpdatedStrategy(
  strategy: StrategyEntity,
  fields: Record<string, string>
): Promise<StrategyEntity | undefined> {
  const title = requiredFallback(fields.title, strategy.title);
  const scope = requiredFallback(fields.scope, strategy.scope);
  const timeHorizon = requiredFallback(fields.timeHorizon, strategy.timeHorizon);
  const strategyStatement = requiredFallback(fields.strategyStatement, strategy.strategyStatement);
  const riskPostureStatement = requiredFallback(fields.riskPostureStatement, strategy.riskPostureStatement);
  if (!title || !scope || !timeHorizon || !strategyStatement || !riskPostureStatement) {
    await vscode.window.showWarningMessage(
      "Enter the Strategy title, scope, time horizon, strategy statement and risk posture before saving."
    );
    return undefined;
  }
  return {
    ...strategy,
    title,
    scope,
    timeHorizon,
    effectiveAt: optionalStrategyField(fields, "effectiveAt", strategy.effectiveAt),
    owner: optionalStrategyField(fields, "owner", strategy.owner),
    strategyStatement,
    riskPostureStatement,
    frameworks: Object.hasOwn(fields, "frameworks") ? splitCommaList(fields.frameworks) : strategy.frameworks,
    executiveSummary: optionalStrategyField(fields, "executiveSummary", strategy.executiveSummary),
    assumptions: optionalStrategyField(fields, "assumptions", strategy.assumptions),
    choices: strategy.choices.map((choice, choiceIndex) => ({
      ...choice,
      statement: requiredFallback(fields[`choice.${choiceIndex}.statement`], choice.statement),
      summary: fields[`choice.${choiceIndex}.summary`]?.trim() ?? choice.summary,
      capabilityArea: requiredFallback(fields[`choice.${choiceIndex}.capabilityArea`], choice.capabilityArea),
      targetPosture: requiredFallback(fields[`choice.${choiceIndex}.targetPosture`], choice.targetPosture),
      executiveOwner: optionalStrategyField(fields, `choice.${choiceIndex}.executiveOwner`, choice.executiveOwner),
      rationale: optionalStrategyField(fields, `choice.${choiceIndex}.rationale`, choice.rationale),
      constraints: optionalStrategyField(fields, `choice.${choiceIndex}.constraints`, choice.constraints),
      outcomes: choice.outcomes.map((outcome, outcomeIndex) => ({
        ...outcome,
        statement: requiredFallback(
          fields[`choice.${choiceIndex}.outcome.${outcomeIndex}.statement`],
          outcome.statement
        ),
        summary: fields[`choice.${choiceIndex}.outcome.${outcomeIndex}.summary`]?.trim() ?? outcome.summary,
        measures: outcome.measures.map((measure, measureIndex) => ({
          ...measure,
          title: requiredFallback(
            fields[`choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.title`],
            measure.title
          ),
          unit: optionalStrategyField(
            fields,
            `choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.unit`,
            measure.unit
          ),
          baseline: optionalStrategyField(
            fields,
            `choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.baseline`,
            measure.baseline
          ),
          current: optionalStrategyField(
            fields,
            `choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.current`,
            measure.current
          ),
          target: optionalStrategyField(
            fields,
            `choice.${choiceIndex}.outcome.${outcomeIndex}.measure.${measureIndex}.target`,
            measure.target
          )
        }))
      }))
    })),
    updatedAt: new Date().toISOString()
  };
}

function optionalStrategyField(
  fields: Record<string, string>,
  key: string,
  currentValue: string | undefined
): string | undefined {
  return Object.hasOwn(fields, key) ? trimOptional(fields[key]) : currentValue;
}

function strategyChoiceCard(
  choice: StrategyEntity["choices"][number],
  lookup: {
    readonly requirements: ReadonlyMap<string, RequirementEntity>;
    readonly risks: ReadonlyMap<string, RiskEntity>;
    readonly actions: ReadonlyMap<string, ActionEntity>;
    readonly directions: ReadonlyMap<string, DirectionEntity>;
  }
): string {
  const outcomes = choice.outcomes
    .map(
      (outcome) => `
    <h3>${escapeHtml(outcome.statement)}</h3>
    <p class="muted">${escapeHtml(outcome.summary)}</p>
    <p class="muted">Measures: ${escapeHtml(String(outcome.measures.length))} · Linked records: ${escapeHtml(String(outcome.references.length))}</p>
  `
    )
    .join("");
  return `<article class="metric">
    <span>${escapeHtml(choice.capabilityArea)}</span>
    <strong style="font-size:18px;line-height:1.25;">${escapeHtml(choice.statement)}</strong>
    <p>${escapeHtml(choice.summary)}</p>
    <p class="muted">Trend: ${escapeHtml(label(choice.trend))} · Confidence: ${escapeHtml(label(choice.confidence))}</p>
    <p>${escapeHtml(choice.targetPosture)}</p>
    <h3>Linked Records</h3>
    ${strategyReferenceList(choice.references, lookup)}
    ${outcomes}
  </article>`;
}

function strategyReferenceList(
  references: readonly StrategyEntity["choices"][number]["references"][number][],
  lookup: {
    readonly requirements: ReadonlyMap<string, RequirementEntity>;
    readonly risks: ReadonlyMap<string, RiskEntity>;
    readonly actions: ReadonlyMap<string, ActionEntity>;
    readonly directions: ReadonlyMap<string, DirectionEntity>;
  }
): string {
  if (references.length === 0) {
    return `<p class="muted">No linked records.</p>`;
  }
  const rows = references
    .map((reference) => {
      const entity =
        reference.entityType === "requirement"
          ? lookup.requirements.get(reference.entityId)
          : reference.entityType === "risk"
            ? lookup.risks.get(reference.entityId)
            : reference.entityType === "action"
              ? lookup.actions.get(reference.entityId)
              : lookup.directions.get(reference.entityId);
      return `<li>${shellPill(label(reference.role))} ${escapeHtml(label(reference.entityType))}: ${escapeHtml(entity?.title ?? reference.entityId)}</li>`;
    })
    .join("");
  return `<ul>${rows}</ul>`;
}

interface ConnectedViewOpenOptions {
  readonly initialSelectionIds?: readonly string[];
  readonly revealMessage?: string;
}

async function openConnectedView(options: ConnectedViewOpenOptions = {}): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfConnectedView", "PSPF Connected View", vscode.ViewColumn.One, {
    enableScripts: false
  });
  panel.webview.options = { enableScripts: true };

  async function render(): Promise<void> {
    const allEntities = await listAllEntities();
    const enrichedEntities = enrichActionsWithImpact(allEntities);
    const requirements = allEntities.filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement"
    );
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
      subtitle: "Directions · Requirements · Risks · Actions",
      initialSelectionIds: options.initialSelectionIds,
      revealMessage: options.revealMessage
    });

    panel.webview.html = shellHtml(
      "PSPF Connected View",
      `
      <style>${CONNECTED_VIEW_STYLES}</style>
      <section style="padding:0;border:0;background:transparent;">
        ${body}
      </section>
      <script>${CONNECTED_VIEW_BROWSER_SCRIPT}</script>
    `
    );
  }

  wireWorkshopPanelMessages(panel, render);
  await render();
}

async function openEvidenceReviewQueue(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfEvidenceReviewQueue",
    "PSPF Evidence Review Queue",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  panel.webview.options = { enableScripts: true };

  const render = async (): Promise<void> => {
    const model = await buildEvidenceReviewQueueModel();
    panel.webview.html = shellHtml("PSPF Evidence Review Queue", renderEvidenceReviewQueue(model));
  };

  wireWorkshopPanelMessages(panel, render);
  await render();
}

async function buildEvidenceReviewQueueModel(): Promise<EvidenceReviewQueueModel> {
  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const supportedByLinks = links.filter(
    (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
  );
  const evidenceRequirementIds = new Set(supportedByLinks.map((link) => link.fromId));
  const linkedEvidenceIds = new Set(supportedByLinks.map((link) => link.toId));
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const requirementIdsByEvidenceId = new Map<string, string[]>();
  for (const link of supportedByLinks) {
    requirementIdsByEvidenceId.set(link.toId, [...(requirementIdsByEvidenceId.get(link.toId) ?? []), link.fromId]);
  }
  const missingEvidence: EvidenceReviewCard[] = requirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id))
    .map((requirement) => ({
      openEntityType: "requirement",
      openEntityId: requirement.id,
      requirementId: requirement.id,
      title: requirement.title,
      domain: domainName(requirement.domainId),
      status: label(requirement.assessmentStatus),
      reason: "No linked evidence",
      priority: evidenceReviewRequirementPriority(requirement)
    }));
  const ageingEvidence: EvidenceReviewCard[] = evidence
    .filter((item) => item.freshness !== "current")
    .map((item) => ({
      openEntityType: "evidence",
      openEntityId: item.id,
      title: item.title,
      freshness: label(item.freshness),
      reference: item.reference,
      requirementContext: evidenceRequirementContext(item, requirementIdsByEvidenceId, requirementsById),
      reason: evidenceFreshnessReason(item.freshness),
      priority: evidenceFreshnessPriority(item.freshness)
    }));
  const unlinkedEvidence: EvidenceReviewCard[] = evidence
    .filter((item) => !linkedEvidenceIds.has(item.id))
    .map((item) => ({
      openEntityType: "evidence",
      openEntityId: item.id,
      title: item.title,
      freshness: label(item.freshness),
      reference: item.reference,
      requirementContext: "Not linked to a Requirement",
      reason: "Useful evidence is not supporting a decision yet",
      priority: item.freshness === "current" ? "Medium" : "High"
    }));
  const urgentActions: EvidenceReviewCard[] = enrichedEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action")
    .filter((action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue")
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      urgency: action.impact ? label(action.impact.urgency) : "",
      status: label(action.status),
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set",
      reason:
        action.impact?.urgency === "blocked"
          ? "Blocked work needs evidence context"
          : "Overdue work needs a fresh assurance signal",
      priority: action.impact?.urgency === "blocked" ? "Critical" : "High"
    }));

  return { missingEvidence, ageingEvidence, unlinkedEvidence, urgentActions };
}

function renderEvidenceReviewQueue(model: EvidenceReviewQueueModel): string {
  const totalWork =
    model.missingEvidence.length +
    model.ageingEvidence.length +
    model.unlinkedEvidence.length +
    model.urgentActions.length;
  const currentSignals = model.unlinkedEvidence.filter((item) => item.freshness === "Current").length;
  return `
    ${evidenceReviewQueueStyles()}
    <section>
      <p class="eyebrow">Evidence review</p>
      <h1>Evidence Review Queue</h1>
      <p class="muted">OFFICIAL: Sensitive · Review missing, ageing, stale, expired, unknown, and unlinked evidence. Capture the missing signal, open the source, or copy a short review summary for the next assurance conversation.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Queue items", totalWork)}
        ${metricCard("Missing evidence", model.missingEvidence.length)}
        ${metricCard("Freshness review", model.ageingEvidence.length)}
        ${metricCard("Ready signals", currentSignals)}
      </div>
      <div class="form-actions evidence-review-actions">
        <button type="button" data-evidence-filter="all" aria-pressed="true">All</button>
        <button type="button" data-evidence-filter="missing">Missing</button>
        <button type="button" data-evidence-filter="freshness">Freshness</button>
        <button type="button" data-evidence-filter="unlinked">Unlinked</button>
        <button type="button" data-evidence-filter="actions">Actions</button>
        <button type="button" data-command="pspf.workshop.attachEvidence">Add evidence</button>
        <button type="button" data-command="copyEvidenceReviewSummary">Copy summary</button>
        <button type="button" data-command="refresh">Refresh</button>
      </div>
      <p class="muted" data-evidence-review-count></p>
    </section>
    <section class="evidence-review-board" aria-label="Evidence review work queue">
      ${evidenceReviewCardGroup("Missing evidence", "Capture a source against these Requirements.", "missing", model.missingEvidence)}
      ${evidenceReviewCardGroup("Freshness review", "Open the reference, confirm currency, then update the evidence record.", "freshness", model.ageingEvidence)}
      ${evidenceReviewCardGroup("Unlinked evidence", "Connect useful records to Requirements so they count in assurance decisions.", "unlinked", model.unlinkedEvidence)}
      ${evidenceReviewCardGroup("Action pressure", "Blocked or overdue Actions often need stronger evidence context.", "actions", model.urgentActions)}
    </section>
    ${evidenceReviewQueueScript()}
  `;
}

type EvidenceReviewPriority = "Critical" | "High" | "Medium";
type EvidenceReviewCardKind = "missing" | "freshness" | "unlinked" | "actions";

interface EvidenceReviewCard {
  readonly openEntityType: "requirement" | "evidence" | "action";
  readonly openEntityId: string;
  readonly title: string;
  readonly reason: string;
  readonly priority: EvidenceReviewPriority;
  readonly requirementId?: string;
  readonly domain?: string;
  readonly status?: string;
  readonly freshness?: string;
  readonly reference?: string;
  readonly requirementContext?: string;
  readonly urgency?: string;
  readonly dueDate?: string;
}

interface EvidenceReviewQueueModel {
  readonly missingEvidence: readonly EvidenceReviewCard[];
  readonly ageingEvidence: readonly EvidenceReviewCard[];
  readonly unlinkedEvidence: readonly EvidenceReviewCard[];
  readonly urgentActions: readonly EvidenceReviewCard[];
}

function evidenceReviewCardGroup(
  title: string,
  description: string,
  kind: EvidenceReviewCardKind,
  rows: readonly EvidenceReviewCard[]
): string {
  const cards =
    rows.length > 0
      ? rows.map((row) => evidenceReviewCard(kind, row)).join("")
      : `<p class="muted">Nothing waiting here.</p>`;
  return `<div class="evidence-review-lane" data-evidence-lane="${kind}">
    <div class="evidence-review-lane__header">
      <div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(description)}</p></div>
      ${shellPill(String(rows.length))}
    </div>
    <div class="evidence-review-cards">${cards}</div>
  </div>`;
}

function evidenceReviewCard(kind: EvidenceReviewCardKind, row: EvidenceReviewCard): string {
  const search = [row.title, row.reason, row.priority, row.status, row.freshness, row.domain, row.requirementContext]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-AU");
  return `<article class="evidence-review-card" data-evidence-card data-kind="${kind}" data-priority="${escapeHtml(row.priority)}" data-search="${escapeHtml(search)}">
    <div class="evidence-review-card__top">
      <span class="evidence-review-priority evidence-review-priority--${escapeHtml(row.priority.toLocaleLowerCase("en-AU"))}">${escapeHtml(row.priority)}</span>
      <span class="muted">${escapeHtml(row.freshness ?? row.status ?? row.urgency ?? row.domain ?? "Review")}</span>
    </div>
    <h3>${escapeHtml(row.title)}</h3>
    <p>${escapeHtml(row.reason)}</p>
    <p class="muted">${escapeHtml(row.requirementContext ?? row.domain ?? row.dueDate ?? row.reference ?? "No extra context")}</p>
    <div class="form-actions">
      ${evidenceReviewOpenButton(row)}
      ${kind === "missing" && row.requirementId ? `<button type="button" data-command="attachEvidenceToRequirement" data-requirement-id="${escapeHtml(row.requirementId)}">Add evidence</button><button type="button" data-command="linkExistingEvidenceToRequirement" data-requirement-id="${escapeHtml(row.requirementId)}">Link existing</button>` : ""}
      ${row.reference ? evidenceReferenceButton(row.reference) : ""}
    </div>
  </article>`;
}

function evidenceReviewOpenButton(row: EvidenceReviewCard): string {
  return `<button type="button" data-command="openEntity" data-entity-type="${escapeHtml(row.openEntityType)}" data-entity-id="${escapeHtml(row.openEntityId)}">Open</button>`;
}

function evidenceReviewQueueStyles(): string {
  return `<style>
    .evidence-review-actions { align-items: center; margin-top: 14px; }
    .evidence-review-actions [aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 12%, var(--surface-strong)); }
    .evidence-review-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; background: transparent; border: 0; padding: 0; }
    .evidence-review-lane { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: color-mix(in srgb, var(--surface) 92%, var(--workshop-blue)); }
    .evidence-review-lane[hidden] { display: none; }
    .evidence-review-lane__header { display: flex; justify-content: space-between; gap: 10px; align-items: start; margin-bottom: 10px; }
    .evidence-review-lane__header p { margin: 2px 0 0; }
    .evidence-review-cards { display: grid; gap: 10px; }
    .evidence-review-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: var(--surface-strong); }
    .evidence-review-card[hidden] { display: none; }
    .evidence-review-card h3 { margin: 8px 0 6px; font-size: 14px; }
    .evidence-review-card p { margin: 0 0 8px; }
    .evidence-review-card__top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .evidence-review-priority { border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 700; }
    .evidence-review-priority--critical { border-color: var(--vscode-errorForeground); color: var(--vscode-errorForeground); }
    .evidence-review-priority--high { border-color: var(--amber); color: var(--amber); }
    @media (max-width: 720px) { .evidence-review-board { grid-template-columns: 1fr; } }
  </style>`;
}

function evidenceReviewQueueScript(): string {
  return `<script>
    (() => {
      const buttons = Array.from(document.querySelectorAll('[data-evidence-filter]'));
      const cards = Array.from(document.querySelectorAll('[data-evidence-card]'));
      const lanes = Array.from(document.querySelectorAll('[data-evidence-lane]'));
      const count = document.querySelector('[data-evidence-review-count]');
      function applyFilter(kind) {
        let visible = 0;
        for (const card of cards) {
          const matches = kind === 'all' || card.getAttribute('data-kind') === kind;
          card.hidden = !matches;
          if (matches) visible += 1;
        }
        for (const lane of lanes) {
          const laneKind = lane.getAttribute('data-evidence-lane');
          lane.hidden = kind !== 'all' && laneKind !== kind;
        }
        for (const button of buttons) button.setAttribute('aria-pressed', String(button.getAttribute('data-evidence-filter') === kind));
        if (count) count.textContent = visible + ' visible review item' + (visible === 1 ? '' : 's');
      }
      buttons.forEach((button) => button.addEventListener('click', () => applyFilter(button.getAttribute('data-evidence-filter') || 'all')));
      applyFilter('all');
    })();
  </script>`;
}

async function copyEvidenceReviewQueueSummary(): Promise<void> {
  const model = await buildEvidenceReviewQueueModel();
  const summary = evidenceReviewQueueMarkdown(model);
  await vscode.env.clipboard.writeText(summary);
  await vscode.window.showInformationMessage("Evidence review summary copied to clipboard.");
}

function evidenceReviewQueueMarkdown(model: EvidenceReviewQueueModel): string {
  const lines = [
    "# Evidence Review Queue",
    "",
    `- Missing evidence: ${model.missingEvidence.length}`,
    `- Needs freshness review: ${model.ageingEvidence.length}`,
    `- Unlinked evidence: ${model.unlinkedEvidence.length}`,
    `- Urgent actions: ${model.urgentActions.length}`,
    ""
  ];
  const topItems = [
    ...model.missingEvidence,
    ...model.ageingEvidence,
    ...model.unlinkedEvidence,
    ...model.urgentActions
  ]
    .slice(0, 8)
    .map((item) => `- ${item.priority}: ${item.title} (${item.reason})`);
  return [...lines, "## Next review items", ...(topItems.length > 0 ? topItems : ["- No review items waiting."])].join(
    "\n"
  );
}

function evidenceRequirementContext(
  evidence: EvidenceEntity,
  requirementIdsByEvidenceId: ReadonlyMap<string, readonly string[]>,
  requirementsById: ReadonlyMap<string, RequirementEntity>
): string {
  const requirements = (requirementIdsByEvidenceId.get(evidence.id) ?? [])
    .map((id) => requirementsById.get(id)?.title)
    .filter((title): title is string => Boolean(title));
  return requirements.length > 0 ? requirements.slice(0, 3).join("; ") : "No linked Requirement";
}

function evidenceReviewRequirementPriority(requirement: RequirementEntity): EvidenceReviewPriority {
  return requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met"
    ? "High"
    : "Medium";
}

function evidenceFreshnessPriority(freshness: EvidenceFreshness): EvidenceReviewPriority {
  return freshness === "expired" || freshness === "stale" ? "High" : "Medium";
}

function evidenceFreshnessReason(freshness: EvidenceFreshness): string {
  switch (freshness) {
    case "expired":
      return "Expired evidence should be replaced before it is relied on.";
    case "stale":
      return "Stale evidence needs a current confirmation.";
    case "unknown":
      return "Freshness is unknown, so the assurance signal is weak.";
    case "current":
      return "Evidence is current.";
  }
  return "Freshness needs review.";
}

async function copyRequirementBrief(requirementId: string): Promise<void> {
  const allEntities = enrichActionsWithImpact(await listAllEntities());
  const requirement = allEntities.find(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === requirementId
  );
  if (!requirement) {
    await vscode.window.showWarningMessage("This Requirement could not be found.");
    return;
  }
  const outboundLinks = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.fromId === requirement.id
  );
  const linkedIds = new Set(outboundLinks.map((link) => link.toId));
  const evidence = allEntities.filter(
    (entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id)
  );
  const actions = allEntities.filter(
    (entity): entity is ActionEntity => entity.entityType === "action" && linkedIds.has(entity.id)
  );
  const risks = allEntities.filter(
    (entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id)
  );
  const mappings = allEntities.filter(
    (entity): entity is RequirementControlMappingEntity =>
      entity.entityType === "requirement-control-mapping" &&
      entity.recordStatus !== "deleted" &&
      entity.requirementId === requirement.id
  );
  const currentEvidence = evidence.filter((item) => item.freshness === "current").length;
  const urgentActions = actions.filter(
    (action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue"
  ).length;
  const openRisks = risks.filter((risk) => risk.status !== "closed").length;
  const brief = [
    "# Requirement Brief",
    "",
    `- Requirement: ${requirement.title}`,
    `- Domain: ${domainName(requirement.domainId)}`,
    `- Assessment: ${label(requirement.assessmentStatus)}`,
    `- Evidence: ${evidence.length} linked, ${currentEvidence} current`,
    `- Actions: ${actions.length} linked, ${urgentActions} urgent`,
    `- Risks: ${risks.length} linked, ${openRisks} open`,
    `- ISM mappings: ${mappings.length}`,
    "",
    "OFFICIAL: Sensitive · Review before sharing outside the local assurance team."
  ].join("\n");
  await vscode.env.clipboard.writeText(brief);
  await vscode.window.showInformationMessage("Requirement brief copied to clipboard.");
}

async function copyEvidenceBrief(evidenceId: string): Promise<void> {
  const allEntities = await listAllEntities();
  const evidence = allEntities.find(
    (entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.id === evidenceId
  );
  if (!evidence) {
    await vscode.window.showWarningMessage("This Evidence record could not be found.");
    return;
  }
  const requirements = linkedRequirementsForEvidence(evidence, allEntities);
  const brief = [
    "# Evidence Brief",
    "",
    `- Evidence: ${evidence.title}`,
    `- Type: ${label(evidence.evidenceType)}`,
    `- Freshness: ${label(evidence.freshness)}`,
    `- Linked Requirements: ${requirements.length}`,
    `- Reference recorded: ${evidence.reference.trim().length > 0 ? "Yes" : "No"}`,
    "",
    ...requirements
      .slice(0, 8)
      .map(
        (requirement) =>
          `- Supports: ${requirement.title} (${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)})`
      ),
    "",
    "OFFICIAL: Sensitive · Review before sharing outside the local assurance team."
  ].join("\n");
  await vscode.env.clipboard.writeText(brief);
  await vscode.window.showInformationMessage("Evidence brief copied to clipboard.");
}

async function linkEvidenceToRequirements(evidenceId: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const evidence = allEntities.find(
    (entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.id === evidenceId
  );
  if (!evidence) {
    await vscode.window.showWarningMessage("This Evidence record could not be found.");
    return;
  }
  const linkedRequirementIds = new Set(
    linkedRequirementsForEvidence(evidence, allEntities).map((requirement) => requirement.id)
  );
  const candidates = allEntities
    .filter(
      (entity): entity is RequirementEntity =>
        entity.entityType === "requirement" && entity.recordStatus !== "deleted" && !linkedRequirementIds.has(entity.id)
    )
    .sort(compareRequirementsForPicker);
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(
      "This Evidence record is already linked to every available Requirement."
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((requirement) => ({
      label: requirement.title,
      description: `${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)}`,
      requirement
    })),
    {
      title: "Link Evidence To Requirements",
      placeHolder: "Select one or more Requirements this Evidence supports",
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (!picked || picked.length === 0) {
    return;
  }
  const links = picked.map(({ requirement }) =>
    withEnvelope(
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
    )
  );
  await vscode.commands.executeCommand("pspf.core.upsertEntities", links);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(
    `Linked Evidence to ${picked.length} Requirement${picked.length === 1 ? "" : "s"}.`
  );
}

function linkedRequirementsForEvidence(
  evidence: EvidenceEntity,
  allEntities: readonly V01Entity[]
): RequirementEntity[] {
  const requirementIds = new Set(
    allEntities
      .filter(
        (entity): entity is LinkEntity =>
          entity.entityType === "link" &&
          entity.recordStatus !== "deleted" &&
          entity.linkType === "supported-by" &&
          entity.fromType === "requirement" &&
          entity.toType === "evidence" &&
          entity.toId === evidence.id
      )
      .map((link) => link.fromId)
  );
  return allEntities
    .filter(
      (entity): entity is RequirementEntity =>
        entity.entityType === "requirement" && entity.recordStatus !== "deleted" && requirementIds.has(entity.id)
    )
    .sort(compareRequirementsForPicker);
}

async function openRequirementsList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .sort(compareRequirementsForPicker);
  const recentRequirementId = getRecentRequirementId();
  const initialRequirement =
    requirements.find((requirement) => requirement.id === recentRequirementId) ?? requirements.at(0);
  if (!initialRequirement) {
    await vscode.window.showInformationMessage("No Requirements found. Create or import Requirements first.");
    return;
  }
  await openEntityEditor(initialRequirement, allEntities);
}

async function openEvidenceList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const evidence = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.recordStatus !== "deleted")
    .sort(compareEvidenceRecords);
  const initialEvidence = evidence.at(0);
  if (!initialEvidence) {
    await vscode.window.showInformationMessage(
      "No Evidence records found. Add evidence or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(initialEvidence, allEntities);
}

async function openActionsList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = enrichActionsWithImpact(await listAllEntities());
  const actions = allEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted")
    .sort(compareWorkbenchRecords);
  const initialAction = actions.at(0);
  if (!initialAction) {
    await vscode.window.showInformationMessage(
      "No Action records found. Create an Action or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(initialAction, allEntities);
}

async function openRisksList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const risks = allEntities
    .filter((entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted")
    .sort(compareWorkbenchRecords);
  const initialRisk = risks.at(0);
  if (!initialRisk) {
    await vscode.window.showInformationMessage(
      "No Risk records found. Create a Risk or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(initialRisk, allEntities);
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
  const sourceControls = [...(await listSourceControls())].sort(compareSourceControlsForBrowser);

  const panel = vscode.window.createWebviewPanel(
    "pspfIsmSourceControls",
    "PSPF ISM Source Controls",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, browseIsmSourceControls);
  panel.webview.html = shellHtml(
    "PSPF ISM Source Controls",
    `
    <section>
      <h1>ISM Source Controls</h1>
      <p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release ${escapeHtml(sourceControls[0]?.provenance.oscalRelease ?? "not loaded")}.</p>
      ${versionStrip()}
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.createRequirementControlMapping">Map Requirement</button>
        <button type="button" data-command="pspf.workshop.openEssentialEightDashboard">Essential Eight</button>
      </div>
    </section>
    ${renderIsmSourceControlsBrowser(sourceControls)}
  `
  );
}

function compareSourceControlsForBrowser(left: SourceControlEntity, right: SourceControlEntity): number {
  return (
    left.controlId.localeCompare(right.controlId, "en-AU", { numeric: true }) ||
    left.title.localeCompare(right.title, "en-AU") ||
    left.id.localeCompare(right.id, "en-AU")
  );
}

function renderIsmSourceControlsBrowser(sourceControls: readonly SourceControlEntity[]): string {
  const profiles = uniqueStrings(sourceControls.flatMap((sourceControl) => sourceControl.profileTags)).sort(
    (left, right) => left.localeCompare(right, "en-AU", { numeric: true })
  );
  const driftLabels = uniqueStrings(
    sourceControls.map((sourceControl) => statementChangeLabel(sourceControl.statementChangeStatus))
  ).sort((left, right) => left.localeCompare(right, "en-AU"));
  const releaseCount = uniqueStrings(
    sourceControls.map((sourceControl) => sourceControl.provenance.oscalRelease)
  ).length;
  const changedCount = sourceControls.filter(
    (sourceControl) => sourceControl.statementChangeStatus !== "unchanged"
  ).length;
  const rows = sourceControls.map(renderIsmSourceControlBrowserRow).join("");

  return `<section class="ism-browser" id="ism-source-controls">
    <div class="grid">
      ${metricCard("Source controls", sourceControls.length)}
      ${metricCard("Profiles", profiles.length)}
      ${metricCard("OSCAL releases", releaseCount)}
      ${metricCard("Drift markers", changedCount)}
    </div>
    <div class="ism-browser__toolbar" role="search" aria-label="Filter ISM source controls">
      <label>
        <span>Search controls</span>
        <input id="ism-control-search" type="search" placeholder="Control ID, title, statement, profile, release" autocomplete="off">
      </label>
      <label>
        <span>Profile</span>
        <select id="ism-profile-filter">
          <option value="">All profiles</option>
          ${profiles.map((profile) => `<option value="${escapeHtml(profile)}">${escapeHtml(profile)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Drift</span>
        <select id="ism-drift-filter">
          <option value="">All drift states</option>
          ${driftLabels.map((drift) => `<option value="${escapeHtml(drift)}">${escapeHtml(drift)}</option>`).join("")}
        </select>
      </label>
      <button type="button" id="ism-clear-filters">Clear filters</button>
    </div>
    <p class="muted" id="ism-result-count">Showing ${sourceControls.length} of ${sourceControls.length} controls.</p>
    <div class="table-wrap ism-browser__table" tabindex="0" aria-label="Searchable ISM source controls table">
      <table id="ism-controls-table">
        <thead>
          <tr>
            <th data-field="action">Open</th>
            <th data-field="controlId"><button type="button" data-sort="controlId">Control ID</button></th>
            <th data-field="title"><button type="button" data-sort="title">Title</button></th>
            <th data-field="profiles"><button type="button" data-sort="profiles">Profiles</button></th>
            <th data-field="release"><button type="button" data-sort="release">Release</button></th>
            <th data-field="drift"><button type="button" data-sort="drift">Drift</button></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${ismSourceControlsBrowserScript(sourceControls.length)}
  </section>`;
}

function renderIsmSourceControlBrowserRow(sourceControl: SourceControlEntity): string {
  const profiles = sourceControl.profileTags.join(", ");
  const drift = statementChangeLabel(sourceControl.statementChangeStatus);
  const release = sourceControl.provenance.oscalRelease;
  const searchText = [sourceControl.controlId, sourceControl.title, sourceControl.statement, profiles, release, drift]
    .join(" ")
    .toLocaleLowerCase("en-AU");
  return `<tr data-search="${escapeHtml(searchText)}" data-profile="${escapeHtml(profiles)}" data-drift="${escapeHtml(drift)}" data-control-id="${escapeHtml(sourceControl.controlId)}" data-title="${escapeHtml(sourceControl.title)}" data-profiles="${escapeHtml(profiles)}" data-release="${escapeHtml(release)}">
    <td data-field="action"><button type="button" data-command="openIsmControlDetail" data-source-control-id="${escapeHtml(sourceControl.id)}">Open</button></td>
    <td data-field="controlId"><strong>${escapeHtml(sourceControl.controlId)}</strong></td>
    <td data-field="title">${escapeHtml(sourceControl.title)}<br><span class="muted">${escapeHtml(sourceControl.statement)}</span></td>
    <td data-field="profiles">${escapeHtml(profiles || "Not tagged")}</td>
    <td data-field="release">${escapeHtml(release)}</td>
    <td data-field="drift">${escapeHtml(drift)}</td>
  </tr>`;
}

function ismSourceControlsBrowserScript(totalCount: number): string {
  return `<style>
    .ism-browser__toolbar { display: grid; grid-template-columns: minmax(18rem, 2fr) minmax(12rem, 1fr) minmax(10rem, 1fr) auto; gap: 0.75rem; align-items: end; margin: 1rem 0; }
    .ism-browser__toolbar label { display: grid; gap: 0.3rem; }
    .ism-browser__toolbar span { color: var(--vscode-descriptionForeground); font-size: 0.82rem; }
    .ism-browser__toolbar input, .ism-browser__toolbar select { width: 100%; box-sizing: border-box; }
    .ism-browser__table table { min-width: 980px; }
    .ism-browser__table th button { width: 100%; color: inherit; background: transparent; border: 0; padding: 0; font: inherit; text-align: left; cursor: pointer; }
    .ism-browser__table th button::after { content: " ↕"; color: var(--vscode-descriptionForeground); }
    .ism-browser__table th button[aria-sort="ascending"]::after { content: " ↑"; }
    .ism-browser__table th button[aria-sort="descending"]::after { content: " ↓"; }
    .ism-browser__table td[data-field="title"] { min-width: 24rem; }
    @media (max-width: 760px) { .ism-browser__toolbar { grid-template-columns: 1fr; } }
  </style>
  <script>
    (() => {
      const searchInput = document.getElementById('ism-control-search');
      const profileFilter = document.getElementById('ism-profile-filter');
      const driftFilter = document.getElementById('ism-drift-filter');
      const clearButton = document.getElementById('ism-clear-filters');
      const count = document.getElementById('ism-result-count');
      const table = document.getElementById('ism-controls-table');
      const body = table?.querySelector('tbody');
      const rows = body ? Array.from(body.querySelectorAll('tr')) : [];
      let currentSort = { key: 'controlId', direction: 'ascending' };

      function rowText(row, name) {
        const attrName = 'data-' + name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        return row.getAttribute(attrName) || '';
      }
      function applyFilters() {
        const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLocaleLowerCase('en-AU') : '';
        const profile = profileFilter instanceof HTMLSelectElement ? profileFilter.value : '';
        const drift = driftFilter instanceof HTMLSelectElement ? driftFilter.value : '';
        let visible = 0;
        for (const row of rows) {
          const matchesQuery = !query || rowText(row, 'search').includes(query);
          const matchesProfile = !profile || rowText(row, 'profile').split(', ').includes(profile);
          const matchesDrift = !drift || rowText(row, 'drift') === drift;
          const isVisible = matchesQuery && matchesProfile && matchesDrift;
          row.hidden = !isVisible;
          if (isVisible) visible += 1;
        }
        if (count) {
          count.textContent = 'Showing ' + visible + ' of ${totalCount} controls.';
        }
      }
      function sortRows(key) {
        if (!body) return;
        const direction = currentSort.key === key && currentSort.direction === 'ascending' ? 'descending' : 'ascending';
        currentSort = { key, direction };
        const multiplier = direction === 'ascending' ? 1 : -1;
        for (const button of table?.querySelectorAll('button[data-sort]') || []) {
          button.removeAttribute('aria-sort');
        }
        const button = table?.querySelector('button[data-sort="' + key + '"]');
        button?.setAttribute('aria-sort', direction);
        rows
          .slice()
          .sort((left, right) => multiplier * rowText(left, key).localeCompare(rowText(right, key), 'en-AU', { numeric: true }))
          .forEach((row) => body.appendChild(row));
      }
      searchInput?.addEventListener('input', applyFilters);
      profileFilter?.addEventListener('change', applyFilters);
      driftFilter?.addEventListener('change', applyFilters);
      clearButton?.addEventListener('click', () => {
        if (searchInput instanceof HTMLInputElement) searchInput.value = '';
        if (profileFilter instanceof HTMLSelectElement) profileFilter.value = '';
        if (driftFilter instanceof HTMLSelectElement) driftFilter.value = '';
        applyFilters();
        searchInput?.focus();
      });
      table?.querySelectorAll('button[data-sort]').forEach((button) => {
        button.addEventListener('click', () => sortRows(button.getAttribute('data-sort') || 'controlId'));
      });
      sortRows('controlId');
      applyFilters();
    })();
  </script>`;
}

async function openIsmControlDetail(sourceControlId?: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = enrichActionsWithImpact(await listAllEntities());
  const sourceControl = sourceControlId
    ? allEntities.find(
        (entity): entity is SourceControlEntity =>
          entity.entityType === "source-control" && entity.id === sourceControlId
      )
    : await pickSourceControl();
  if (!sourceControl) {
    return;
  }

  const mappings = allEntities.filter(
    (entity): entity is RequirementControlMappingEntity =>
      entity.entityType === "requirement-control-mapping" &&
      entity.recordStatus !== "deleted" &&
      entity.sourceControlId === sourceControl.id
  );
  const mappedRequirementIds = new Set(mappings.map((mapping) => mapping.requirementId));
  const requirementsById = new Map(
    allEntities
      .filter((entity): entity is RequirementEntity => entity.entityType === "requirement")
      .map((requirement) => [requirement.id, requirement])
  );
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const linkedWorkIds = new Set(
    links
      .filter((link) => mappedRequirementIds.has(link.fromId) && ["evidence", "action", "risk"].includes(link.toType))
      .map((link) => link.toId)
  );

  const requirementRows = mappings.map((mapping) => {
    const requirement = requirementsById.get(mapping.requirementId);
    return {
      openEntityType: "requirement-control-mapping",
      openEntityId: mapping.id,
      requirement: requirement?.title ?? mapping.requirementId,
      domain: requirement ? domainName(requirement.domainId) : "Unknown",
      status: requirement ? label(requirement.assessmentStatus) : "Unknown",
      coverage: label(mapping.coverageQualifier),
      profile: mapping.applicabilityProfile,
      confidence: label(mapping.confidence),
      reviewed: mapping.lastReviewedAt ? formatShortAuDateTime(mapping.lastReviewedAt) : "Not recorded"
    };
  });
  const workRows = allEntities
    .filter(
      (entity): entity is EvidenceEntity | ActionEntity | RiskEntity =>
        (entity.entityType === "evidence" || entity.entityType === "action" || entity.entityType === "risk") &&
        linkedWorkIds.has(entity.id)
    )
    .map((entity) => ({
      openEntityType: entity.entityType,
      openEntityId: entity.id,
      type: label(entity.entityType),
      title: entity.title,
      state: ismLinkedWorkState(entity),
      linkedRequirement: linkedRequirementTitlesForWork(entity.id, links, requirementsById, mappedRequirementIds)
    }));

  const panel = vscode.window.createWebviewPanel(
    "pspfIsmControlDetail",
    shortWorkshopPanelTitle(sourceControl),
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => openIsmControlDetail(sourceControl.id));
  panel.webview.html = shellHtml(
    sourceControl.title,
    `
    <section>
      <h1>${escapeHtml(sourceControl.controlId)}: ${escapeHtml(sourceControl.title)}</h1>
      <p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release ${escapeHtml(sourceControl.provenance.oscalRelease)}.</p>
      <p>${escapeHtml(sourceControl.statement)}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Mapped Requirements", mappings.length)}
        ${metricCard("Linked work records", workRows.length)}
        ${metricCard("Profiles", sourceControl.profileTags.length)}
        ${metricCard("Drift", statementChangeLabel(sourceControl.statementChangeStatus))}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.createRequirementControlMapping">Map Requirement</button>
        <button type="button" data-command="attachEvidenceForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Attach Evidence</button>
        <button type="button" data-command="createActionForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Create Action</button>
        <button type="button" data-command="createRiskForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Create Risk</button>
        <button type="button" data-command="pspf.workshop.browseIsmSourceControls">All ISM controls</button>
      </div>
    </section>
    ${recordTable("Requirements Mapped To This Control", requirementRows, ["requirement", "domain", "status", "coverage", "profile", "confidence", "reviewed"])}
    ${recordTable("Work Linked Through Mapped Requirements", workRows, ["type", "title", "state", "linkedRequirement"])}
  `
  );
}

function ismLinkedWorkState(entity: EvidenceEntity | ActionEntity | RiskEntity): string {
  switch (entity.entityType) {
    case "evidence":
      return label(entity.freshness);
    case "action":
      return label(entity.status);
    case "risk":
      return label(entity.status);
  }
}

function linkedRequirementTitlesForWork(
  entityId: string,
  links: readonly LinkEntity[],
  requirementsById: ReadonlyMap<string, RequirementEntity>,
  mappedRequirementIds: ReadonlySet<string>
): string {
  const titles = links
    .filter((link) => link.toId === entityId && mappedRequirementIds.has(link.fromId))
    .map((link) => requirementsById.get(link.fromId)?.title)
    .filter((title): title is string => Boolean(title));
  return uniqueStrings(titles).join(", ") || "Not recorded";
}

async function pickMappedRequirementForSourceControl(
  sourceControlId: string,
  title: string
): Promise<RequirementEntity | undefined> {
  const allEntities = await listAllEntities();
  const requirementIds = new Set(
    allEntities
      .filter(
        (entity): entity is RequirementControlMappingEntity =>
          entity.entityType === "requirement-control-mapping" &&
          entity.recordStatus !== "deleted" &&
          entity.sourceControlId === sourceControlId
      )
      .map((mapping) => mapping.requirementId)
  );
  const requirements = allEntities.filter(
    (entity): entity is RequirementEntity =>
      entity.entityType === "requirement" && entity.recordStatus !== "deleted" && requirementIds.has(entity.id)
  );
  if (requirements.length === 0) {
    await vscode.window.showWarningMessage("Map this ISM control to at least one Requirement before linking work.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    requirements.sort(compareRequirementsForPicker).map((requirement) => ({
      label: requirement.title,
      description: domainName(requirement.domainId),
      requirement
    })),
    { title, placeHolder: "Requirement carrying this control", ignoreFocusOut: true }
  );
  return picked?.requirement;
}

async function createRequirementControlMapping(initialRequirement?: RequirementEntity): Promise<void> {
  await ensureCoreReady();
  const requirement = initialRequirement ?? (await pickRequirement());
  if (!requirement) {
    return;
  }

  const sourceControl = await pickSourceControl();
  if (!sourceControl) {
    return;
  }

  const coverage = await vscode.window.showQuickPick(coverageQualifierItems, {
    title: "Select ISM Coverage",
    ignoreFocusOut: true
  });
  if (!coverage) {
    return;
  }

  const profile = await vscode.window.showQuickPick(profileItems(sourceControl), {
    title: "Select ISM Applicability Profile",
    ignoreFocusOut: true
  });
  if (!profile) {
    return;
  }

  const confidence = await vscode.window.showQuickPick(confidenceItems, {
    title: "Select Mapping Confidence",
    ignoreFocusOut: true
  });
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
  const action = await vscode.window.showInformationMessage(
    `Mapped ${requirement.title} to ${sourceControl.controlId}.`,
    "Open Item Detail"
  );
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
    validateInput: (value) => (value.trim().length === 0 ? "Enter a Direction reference." : undefined)
  });
  if (!reference) {
    return;
  }
  const title = await vscode.window.showInputBox({
    title: "Register Direction",
    prompt: "Short Direction title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a Direction title." : undefined)
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
  const responseState = await vscode.window.showQuickPick(directionResponseStateItems, {
    title: "Select initial Direction response",
    ignoreFocusOut: true
  });
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
    entities.push(
      withEnvelope(
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
      )
    );
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
  const nextState = await vscode.window.showQuickPick(directionResponseStateItems, {
    title: `Update response for ${picked.direction.reference}`,
    ignoreFocusOut: true
  });
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
  const links = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.linkType === "changes" && entity.recordStatus !== "deleted"
  );
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const linkTargetsByChangeId = new Map<string, string[]>();
  for (const link of links) {
    const target = entitiesById.get(link.toId);
    linkTargetsByChangeId.set(link.fromId, [
      ...(linkTargetsByChangeId.get(link.fromId) ?? []),
      target?.title ?? link.toId
    ]);
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
  const panel = vscode.window.createWebviewPanel("pspfChangeRecords", "PSPF Change Records", vscode.ViewColumn.One, {
    enableScripts: false
  });
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    "PSPF Change Records",
    `
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
  `
  );
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
    validateInput: (value) => (value.trim().length === 0 ? "Enter a change title." : undefined)
  });
  if (!title) {
    return;
  }
  const summary = await vscode.window.showInputBox({
    title: "Record Significant Change",
    prompt: "Public summary of what changed",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a public summary." : undefined)
  });
  if (!summary) {
    return;
  }
  const changeType = await vscode.window.showQuickPick(changeRecordTypeItems, {
    title: "Change type",
    ignoreFocusOut: true
  });
  if (!changeType) {
    return;
  }
  const status = await vscode.window.showQuickPick(changeRecordStatusItems, {
    title: "Initial status",
    ignoreFocusOut: true
  });
  if (!status) {
    return;
  }
  const persistence = await vscode.window.showQuickPick(changeRecordPersistenceItems, {
    title: "Persistence",
    ignoreFocusOut: true
  });
  if (!persistence) {
    return;
  }
  const source = await vscode.window.showQuickPick(changeRecordSourceItems, { title: "Source", ignoreFocusOut: true });
  if (!source) {
    return;
  }
  const reason = await vscode.window.showInputBox({
    title: "Record Significant Change",
    prompt: "Sensitive reason. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (reason === undefined) {
    return;
  }
  const impactSummary = await vscode.window.showInputBox({
    title: "Record Significant Change",
    prompt: "Sensitive impact summary. Press Enter to skip.",
    ignoreFocusOut: true
  });
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

async function resolveChangeTarget(
  allEntities: readonly V01Entity[],
  entityType?: string,
  entityId?: string
): Promise<ChangeTargetEntity | undefined> {
  const providedTarget = allEntities.find(
    (entity): entity is ChangeTargetEntity =>
      entity.entityType === entityType && entity.id === entityId && isChangeTargetEntity(entity)
  );
  if (providedTarget) {
    return providedTarget;
  }
  const candidates = allEntities
    .filter(isChangeTargetEntity)
    .sort(
      (left, right) =>
        label(left.entityType).localeCompare(label(right.entityType)) ||
        (left.title ?? left.id).localeCompare(right.title ?? right.id)
    );
  if (candidates.length === 0) {
    await vscode.window.showWarningMessage(
      "Create a Requirement, Action, Risk, Direction, Tag, or Saved View before recording a change."
    );
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
  return (
    ["requirement", "action", "risk", "direction", "tag", "saved-view"].includes(entity.entityType) &&
    entity.recordStatus !== "deleted"
  );
}

async function openItemDetailForDirection(direction: DirectionEntity): Promise<void> {
  const allEntities = await listAllEntities();
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const outboundLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.fromId === direction.id
  );
  const relationships = outboundLinks.map((link) => ({
    openEntityType: link.toType,
    openEntityId: link.toId,
    title: link.title,
    relationship: label(link.linkType),
    targetType: label(link.toType),
    target: entitiesById.get(link.toId)?.title ?? label(link.toType)
  }));

  const panel = vscode.window.createWebviewPanel(
    "pspfItemDetail",
    shortWorkshopPanelTitle(direction),
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    direction.title,
    `
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
  `
  );
}

async function openItemDetailForRequirement(requirement: RequirementEntity): Promise<void> {
  await rememberRequirement(requirement);

  const allEntities = await listAllEntities();
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const outboundLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.fromId === requirement.id
  );
  const inboundLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.toId === requirement.id
  );
  const linkedIds = new Set(outboundLinks.map((link) => link.toId));
  const evidence = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id))
    .sort(compareEvidenceRecords);
  const evidenceRows = evidence.map((item) => ({
    openEntityType: "evidence",
    openEntityId: item.id,
    title: item.title,
    evidenceType: label(item.evidenceType),
    freshness: label(item.freshness),
    reference: item.reference
  }));
  const enrichedActionsById = new Map(
    enrichedEntities
      .filter((entity): entity is ActionEntity => entity.entityType === "action")
      .map((action) => [action.id, action])
  );
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
  const risks = allEntities.filter(
    (entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id)
  );
  const riskRows = risks.map((risk) => ({
    openEntityType: "risk",
    openEntityId: risk.id,
    title: risk.title,
    status: label(risk.status),
    likelihood: risk.likelihood,
    impact: risk.impact
  }));
  const tagsById = new Map(
    allEntities
      .filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted")
      .map((tag) => [tag.id, tag])
  );
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
  const directionsById = new Map(
    allEntities
      .filter((entity): entity is DirectionEntity => entity.entityType === "direction")
      .map((entity) => [entity.id, entity])
  );
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
  const sourceControlsById = new Map(
    allEntities
      .filter((entity): entity is SourceControlEntity => entity.entityType === "source-control")
      .map((entity) => [entity.id, entity])
  );
  const mappings = allEntities
    .filter(
      (entity): entity is RequirementControlMappingEntity =>
        entity.entityType === "requirement-control-mapping" && entity.requirementId === requirement.id
    )
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

  const panel = vscode.window.createWebviewPanel(
    "pspfItemDetail",
    shortWorkshopPanelTitle(requirement),
    vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.options = { enableScripts: true };
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    requirement.title,
    `
    <section>
      <h1>${escapeHtml(requirement.title)}</h1>
      <p>Assessment status: ${escapeHtml(label(requirement.assessmentStatus))}</p>
      <p>Domain: ${escapeHtml(domainName(requirement.domainId))}</p>
      ${versionStrip()}
      ${requirementNavigationStrip(requirement, allEntities)}
      <div class="form-actions"><button type="button" data-command="openEntity" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Edit</button><button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(requirement.id)}">Apply tag</button><button type="button" data-command="recordChange" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Record significant change</button></div>
    </section>
    ${renderRequirementRelationshipManager(requirement, allEntities)}
    ${recordTable("Tags", tagRows, ["title", "colour", "status", "action"])}
    ${recordTable("Directions Targeting This Requirement", directionRows, ["reference", "title", "responseState", "sourceAuthority"])}
    ${recordTable("Evidence", evidenceRows, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Risks", riskRows, ["title", "status", "likelihood", "impact"])}
    ${commercialContextSection(requirement, allEntities)}
    ${recordTable("ISM Mappings", mappings, ["controlId", "title", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"])}
    ${recordTable("Relationships", relationships, ["title", "relationship", "targetType", "target"])}
  `
  );
}

type SaveEntityMessage = {
  readonly command?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly strategyArea?: string;
  readonly choiceIndex?: string;
  readonly outcomeIndex?: string;
  readonly requirementId?: string;
  readonly filterText?: string;
  readonly fields?: Record<string, string>;
  readonly isDirty?: boolean;
  readonly pendingCommand?: string;
  readonly pendingEntityType?: string;
  readonly pendingEntityId?: string;
  readonly pendingRequirementId?: string;
  readonly pendingDirectionId?: string;
  readonly pendingTagId?: string;
  readonly pendingSavedViewId?: string;
  readonly pendingSavedViewScope?: string;
  readonly pendingDirection?: string;
  readonly pendingFilterText?: string;
  readonly pendingEvidenceReference?: string;
  readonly pendingStrategyArea?: string;
  readonly pendingChoiceIndex?: string;
  readonly pendingOutcomeIndex?: string;
  readonly evidenceReference?: string;
};

type RequirementBrowserOptions = {
  readonly filterText?: string;
  readonly savedView?: SavedViewEntity;
};

type EditableWorkshopEntity =
  | RequirementEntity
  | EvidenceEntity
  | ActionEntity
  | RiskEntity
  | DirectionEntity
  | ChangeRecordEntity
  | RequirementControlMappingEntity;

async function openItemDetailForEntity(entityType: string, entityId: string): Promise<void> {
  const allEntities = await listAllEntities();
  const entity = allEntities.find(
    (item): item is EditableWorkshopEntity =>
      item.entityType === entityType && item.id === entityId && isEditableWorkshopEntity(item)
  );
  if (!entity) {
    await vscode.window.showWarningMessage("This record is read-only or no longer exists in this workspace.");
    return;
  }
  await openEntityEditor(entity, allEntities);
}

function isEditableWorkshopEntity(entity: V01Entity): entity is EditableWorkshopEntity {
  return [
    "requirement",
    "evidence",
    "action",
    "risk",
    "direction",
    "change-record",
    "requirement-control-mapping"
  ].includes(entity.entityType);
}

async function openEntityEditor(
  entity: EditableWorkshopEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions = {}
): Promise<void> {
  if (entity.entityType === "requirement" && requirementWorkbenchController) {
    await requirementWorkbenchController.open(entity, allEntities, options);
    return;
  }

  let currentEntity = entity;
  let currentEntities = allEntities;
  let requirementFilterText = options.filterText ?? options.savedView?.filters.query ?? "";
  let requirementSavedView = options.savedView;
  let hasUnsavedEditorChanges = false;
  let unsavedEditorFields: Record<string, string> | undefined;
  const panel = vscode.window.createWebviewPanel(
    "pspfEntityDetail",
    shortWorkshopPanelTitle(currentEntity),
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  const refreshEditor = async () => {
    currentEntities = await listAllEntities();
    const refreshedEntity = currentEntities.find(
      (item): item is EditableWorkshopEntity =>
        item.entityType === currentEntity.entityType && item.id === currentEntity.id && isEditableWorkshopEntity(item)
    );
    if (refreshedEntity) {
      currentEntity = refreshedEntity;
    }
    panel.title = shortWorkshopPanelTitle(currentEntity);
    panel.webview.html = shellHtml(
      currentEntity.title ?? currentEntity.id,
      renderEntityEditor(currentEntity, currentEntities, {
        filterText: requirementFilterText,
        savedView: requirementSavedView
      })
    );
    hasUnsavedEditorChanges = false;
    unsavedEditorFields = undefined;
  };
  const saveCurrentEntity = async (fields: Record<string, string>): Promise<boolean> => {
    const updated = await buildUpdatedEntity(currentEntity, fields);
    if (!updated) {
      return false;
    }
    await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
    await refreshWorkshopSurfaces();
    currentEntity = updated;
    hasUnsavedEditorChanges = false;
    unsavedEditorFields = undefined;
    return true;
  };
  const confirmDirtyEditorChanges = async (): Promise<boolean> => {
    if (!hasUnsavedEditorChanges || !unsavedEditorFields) {
      return true;
    }
    const choice = await vscode.window.showWarningMessage(
      "You have unsaved changes in this editor. Save before continuing?",
      { modal: true },
      "Save",
      "Discard",
      "Cancel"
    );
    if (choice === "Cancel" || !choice) {
      return false;
    }
    if (choice === "Save") {
      return saveCurrentEntity(unsavedEditorFields);
    }
    hasUnsavedEditorChanges = false;
    unsavedEditorFields = undefined;
    return true;
  };
  if (entity.entityType === "requirement") {
    requirementWorkbenchController = {
      open: async (requirement, entities, options) => {
        const canContinue = await confirmDirtyEditorChanges();
        if (!canContinue) {
          panel.reveal(vscode.ViewColumn.One, true);
          return;
        }
        await rememberRequirement(requirement);
        currentEntity = requirement;
        currentEntities = entities;
        requirementSavedView = options?.savedView;
        requirementFilterText = options?.filterText ?? options?.savedView?.filters.query ?? "";
        await refreshEditor();
        panel.reveal(vscode.ViewColumn.One, true);
      }
    };
    panel.onDidDispose(() => {
      if (requirementWorkbenchController?.open) {
        requirementWorkbenchController = undefined;
      }
    });
  }
  wireWorkshopPanelMessages(panel, refreshEditor);
  const runPendingEditorCommand = async (message: SaveEntityMessage): Promise<void> => {
    const command = message.pendingCommand;
    if (!command) {
      return;
    }
    if (command === "openRequirementInEditor" && message.pendingRequirementId) {
      requirementFilterText = message.pendingFilterText ?? "";
      const target = (await listAllEntities()).find(
        (item): item is RequirementEntity =>
          item.entityType === "requirement" &&
          item.id === message.pendingRequirementId &&
          item.recordStatus !== "deleted"
      );
      if (target) {
        currentEntity = target;
        await rememberRequirement(target);
        await refreshEditor();
      }
      return;
    }
    if (
      command === "openAdjacentRequirement" &&
      message.pendingRequirementId &&
      isRequirementNavigationDirection(message.pendingDirection)
    ) {
      await openAdjacentRequirement(message.pendingRequirementId, message.pendingDirection);
      return;
    }
    if (command === "openEntity" && message.pendingEntityType && message.pendingEntityId) {
      await openItemDetailForEntity(message.pendingEntityType, message.pendingEntityId);
      return;
    }
    if (command === "openRecordInEditor" && message.pendingEntityType && message.pendingEntityId) {
      const target = (await listAllEntities()).find(
        (item): item is EditableWorkshopEntity =>
          item.entityType === message.pendingEntityType &&
          item.id === message.pendingEntityId &&
          isEditableWorkshopEntity(item)
      );
      if (target) {
        currentEntity = target;
        requirementFilterText = message.pendingFilterText ?? "";
        await refreshEditor();
      }
      return;
    }
    if (command === "openEvidenceReference") {
      const reference =
        currentEntity.entityType === "evidence" ? message.fields?.reference : message.pendingEvidenceReference;
      await openEvidenceReference(reference);
      return;
    }
    if (command === "copyRequirementBrief" && message.pendingRequirementId) {
      await copyRequirementBrief(message.pendingRequirementId);
      return;
    }
    if (command === "copyEvidenceBrief" && message.pendingEntityId) {
      await copyEvidenceBrief(message.pendingEntityId);
      return;
    }
    if (command === "linkEvidenceToRequirements" && message.pendingEntityId) {
      await linkEvidenceToRequirements(message.pendingEntityId);
      await refreshEditor();
      return;
    }
    if (command === "closeEditor") {
      panel.dispose();
      return;
    }
    if (command === "recordChange") {
      await recordSignificantChange(message.pendingEntityType, message.pendingEntityId);
      await refreshEditor();
      return;
    }
    if (command === "applyTag" && message.pendingRequirementId) {
      await applyTag(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "removeTag" && message.pendingRequirementId && message.pendingTagId) {
      await removeTag(message.pendingRequirementId, message.pendingTagId);
      await refreshEditor();
      return;
    }
    if (command === "attachEvidenceToRequirement" && message.pendingRequirementId) {
      await attachEvidence(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "linkExistingEvidenceToRequirement" && message.pendingRequirementId) {
      await linkExistingEvidence(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "createActionForRequirement" && message.pendingRequirementId) {
      await createAction(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "linkExistingActionToRequirement" && message.pendingRequirementId) {
      await linkExistingAction(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "createRiskForRequirement" && message.pendingRequirementId) {
      await createRisk(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "linkExistingRiskToRequirement" && message.pendingRequirementId) {
      await linkExistingRisk(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "linkExistingDirectionToRequirement" && message.pendingRequirementId) {
      await linkExistingDirection(message.pendingRequirementId);
      await refreshEditor();
      return;
    }
    if (command === "mapRequirementToIsm" && message.pendingRequirementId) {
      const requirement = (await listRequirements()).find((item) => item.id === message.pendingRequirementId);
      if (requirement) {
        await createRequirementControlMapping(requirement);
        await refreshEditor();
      }
      return;
    }
    if (command === "refresh") {
      await refreshEditor();
      return;
    }
    if (command.startsWith("pspf.")) {
      await vscode.commands.executeCommand(command);
      await refreshEditor();
    }
  };
  panel.webview.onDidReceiveMessage(async (message: SaveEntityMessage) => {
    if (message.command === "editorDirtyState") {
      if (message.entityType === currentEntity.entityType && message.entityId === currentEntity.id) {
        hasUnsavedEditorChanges = Boolean(message.isDirty);
        unsavedEditorFields = message.fields;
      }
      return;
    }
    if (message.command === "confirmDirtyNavigation") {
      if (message.entityType !== currentEntity.entityType || message.entityId !== currentEntity.id || !message.fields) {
        return;
      }
      const choice = await vscode.window.showWarningMessage(
        "You have unsaved changes in this editor. Save before continuing?",
        { modal: true },
        "Save",
        "Discard",
        "Cancel"
      );
      if (choice === "Cancel" || !choice) {
        return;
      }
      if (choice === "Save") {
        const saved = await saveCurrentEntity(message.fields);
        if (!saved) {
          return;
        }
      } else {
        hasUnsavedEditorChanges = false;
        unsavedEditorFields = undefined;
        if (message.pendingCommand === "openEvidenceReference" && currentEntity.entityType === "evidence") {
          await openEvidenceReference(currentEntity.reference);
          return;
        }
      }
      await runPendingEditorCommand(message);
      return;
    }
    if (message.command === "openRequirementInEditor" && message.requirementId) {
      requirementFilterText = message.filterText ?? "";
      const target = (await listAllEntities()).find(
        (item): item is RequirementEntity =>
          item.entityType === "requirement" && item.id === message.requirementId && item.recordStatus !== "deleted"
      );
      if (target) {
        currentEntity = target;
        await rememberRequirement(target);
        await refreshEditor();
      }
      return;
    }
    if (message.command === "openRecordInEditor" && message.entityType && message.entityId) {
      requirementFilterText = message.filterText ?? "";
      const target = (await listAllEntities()).find(
        (item): item is EditableWorkshopEntity =>
          item.entityType === message.entityType && item.id === message.entityId && isEditableWorkshopEntity(item)
      );
      if (target) {
        currentEntity = target;
        await refreshEditor();
      }
      return;
    }
    if (message.command === "openEvidenceReference") {
      await openEvidenceReference(message.evidenceReference);
      return;
    }
    if (message.command === "closeEditor") {
      panel.dispose();
      return;
    }
    if (
      !["saveEntity", "saveAndCloseEntity", "saveAndNextEntity"].includes(message.command ?? "") ||
      message.entityType !== currentEntity.entityType ||
      message.entityId !== currentEntity.id
    ) {
      return;
    }
    const updated = await buildUpdatedEntity(currentEntity, message.fields ?? {});
    if (!updated) {
      return;
    }
    await saveCurrentEntity(message.fields ?? {});
    currentEntity = updated;
    if (message.command === "saveAndNextEntity") {
      if (updated.entityType === "requirement") {
        currentEntities = await listAllEntities();
        const adjacent = adjacentRequirementFromEntities(updated.id, "next", currentEntities, requirementSavedView);
        if (adjacent.status === "missing") {
          await vscode.window.showWarningMessage("This Requirement no longer exists. Choose another Requirement.");
          return;
        }
        if (adjacent.status === "edge") {
          await vscode.window.showInformationMessage("Already at the last Requirement.");
          await refreshEditor();
          return;
        }
        if (adjacent.status !== "found") {
          return;
        }
        currentEntity = adjacent.requirement;
        await rememberRequirement(adjacent.requirement);
        await refreshEditor();
        return;
      }
      panel.dispose();
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
  panel.webview.html = shellHtml(entity.title ?? entity.id, renderEntityEditor(entity, currentEntities, options));
}

function wireWorkshopPanelMessages(panel: vscode.WebviewPanel, refreshPanel?: () => Promise<void>): void {
  panel.webview.onDidReceiveMessage(
    async (message: {
      readonly command?: string;
      readonly entityType?: string;
      readonly entityId?: string;
      readonly requirementId?: string;
      readonly sourceControlId?: string;
      readonly directionId?: string;
      readonly tagId?: string;
      readonly savedViewId?: string;
      readonly direction?: string;
      readonly evidenceReference?: string;
    }) => {
      if (message.command === "refresh") {
        await refreshPanel?.();
        return;
      }
      if (message.command === "openEntity" && message.entityType && message.entityId) {
        await openItemDetailForEntity(message.entityType, message.entityId);
      }
      if (message.command === "openEvidenceReference") {
        await openEvidenceReference(message.evidenceReference);
        return;
      }
      if (message.command === "copyEvidenceReviewSummary") {
        await copyEvidenceReviewQueueSummary();
        return;
      }
      if (message.command === "copyRequirementBrief" && message.requirementId) {
        await copyRequirementBrief(message.requirementId);
        return;
      }
      if (message.command === "copyEvidenceBrief" && message.entityId) {
        await copyEvidenceBrief(message.entityId);
        return;
      }
      if (message.command === "linkEvidenceToRequirements" && message.entityId) {
        await linkEvidenceToRequirements(message.entityId);
        await refreshPanel?.();
        return;
      }
      if (
        message.command === "openAdjacentRequirement" &&
        message.requirementId &&
        isRequirementNavigationDirection(message.direction)
      ) {
        await openAdjacentRequirement(message.requirementId, message.direction);
      }
      if (
        message.command === "openAdjacentDirection" &&
        message.directionId &&
        isRequirementNavigationDirection(message.direction)
      ) {
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
      if (message.command === "openIsmControlDetail" && message.sourceControlId) {
        await openIsmControlDetail(message.sourceControlId);
      }
      if (message.command === "attachEvidenceForIsmControl" && message.sourceControlId) {
        const requirement = await pickMappedRequirementForSourceControl(
          message.sourceControlId,
          "Attach Evidence via ISM control"
        );
        if (requirement) {
          await attachEvidence(requirement.id);
          await refreshPanel?.();
        }
      }
      if (message.command === "createActionForIsmControl" && message.sourceControlId) {
        const requirement = await pickMappedRequirementForSourceControl(
          message.sourceControlId,
          "Create Action via ISM control"
        );
        if (requirement) {
          await createAction(requirement.id);
          await refreshPanel?.();
        }
      }
      if (message.command === "createRiskForIsmControl" && message.sourceControlId) {
        const requirement = await pickMappedRequirementForSourceControl(
          message.sourceControlId,
          "Create Risk via ISM control"
        );
        if (requirement) {
          await createRisk(requirement.id);
          await refreshPanel?.();
        }
      }
      if (message.command === "applySavedView" && message.savedViewId) {
        const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
        if (savedView) {
          await openWorkshopRequirementsView(savedView);
        }
      }
      if (message.command === "createStrategyDraft") {
        const strategy = await createDraftStrategy();
        if (strategy) {
          panel.dispose();
          await openStrategyMap();
        }
      }
      if (message.command === "pspf.workshop.loadSampleWorkspace") {
        await loadSampleWorkspace();
        panel.dispose();
        await openStrategyMap();
      }
      if (message.command === "pspf.workshop.loadHomeSampleWorkspace") {
        await loadHomeSampleWorkspace();
        panel.dispose();
        await openStrategyMap();
      }
      if (message.command === "pspf.workshop.createRoadmapInitiativePlan") {
        await createRoadmapInitiativePlan({ openAfter: false });
        await refreshPanel?.();
        return;
      }
      if (message.command === "pspf.workshop.addPlannerTask") {
        await addPlannerTask({ openAfter: false });
        await refreshPanel?.();
        return;
      }
      if (message.command === "pspf.workshop.addPlannerMilestone") {
        await addPlannerMilestone({ openAfter: false });
        await refreshPanel?.();
        return;
      }
      const allowedPanelCommands = new Set([
        "pspf.core.validateWorkspace",
        "pspf.core.createSnapshot",
        "pspf.core.exportBundle",
        "pspf.shop.openForecast",
        "pspf.workshop.createAction",
        "pspf.workshop.attachEvidence",
        "pspf.workshop.openAssessmentDashboard",
        "pspf.workshop.openConnectedView",
        "pspf.workshop.openMasterDashboard",
        "pspf.workshop.openEssentialEightDashboard",
        "pspf.workshop.openPlanOfActionBoard",
        "pspf.workshop.openStrategyMap",
        "pspf.workshop.editStrategySummary",
        "pspf.workshop.createRoadmapInitiativePlan",
        "pspf.workshop.openRiskSourcePanel",
        "pspf.workshop.configureRiskSource",
        "pspf.workshop.testRiskSource",
        "pspf.workshop.previewRiskSourceImport",
        "pspf.workshop.applyRiskSourceImport",
        "pspf.workshop.viewRiskSourceRuns",
        "pspf.workshop.openEvidenceReviewQueue",
        "pspf.workshop.browseIsmSourceControls",
        "pspf.workshop.createRequirementControlMapping",
        "pspf.workshop.copyPostureBrief",
        "pspf.workshop.openCisoNewsletterReview",
        "pspf.workshop.openCisoMagazine",
        "pspf.workshop.copyCisoMagazine",
        "pspf.workshop.exportCisoMagazine",
        "pspf.workshop.openCisoMasterPlan",
        "pspf.workshop.copyCisoMasterPlan"
      ]);
      if (message.command && allowedPanelCommands.has(message.command)) {
        try {
          await vscode.commands.executeCommand(message.command);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          await vscode.window.showWarningMessage(`PSPF command is not available: ${detail}`);
        }
        await refreshPanel?.();
      }
    }
  );
}

async function buildUpdatedEntity(
  entity: EditableWorkshopEntity,
  fields: Record<string, string>
): Promise<EditableWorkshopEntity | undefined> {
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
      return {
        ...entity,
        title,
        status,
        startDate: normaliseShortAuDateTime(fields.startDate),
        endDate: normaliseShortAuDateTime(fields.endDate),
        dueDate: normaliseShortAuDateTime(fields.dueDate),
        commentary: actionCommentaryEntries(entity.commentary, fields.newCommentary, updatedAt),
        updatedAt
      };
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
      return {
        ...entity,
        title,
        reference,
        sourceAuthority: trimOptional(fields.sourceAuthority),
        issuedAt: trimOptional(fields.issuedAt),
        responseState,
        updatedAt
      };
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
      if (
        !isChangeRecordType(changeType) ||
        !isChangeRecordStatus(status) ||
        !isChangeRecordPersistence(persistence) ||
        !isChangeRecordSource(source)
      ) {
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

function renderEntityEditor(
  entity: EditableWorkshopEntity,
  allEntities: readonly V01Entity[],
  requirementOptions: RequirementBrowserOptions = {}
): string {
  switch (entity.entityType) {
    case "requirement":
      return renderRequirementEditor(entity, allEntities, requirementOptions);
    case "evidence":
      return renderEvidenceEditor(entity, allEntities, requirementOptions);
    case "action":
      return renderActionEditor(entity, allEntities, requirementOptions);
    case "risk":
      return renderRiskEditor(entity, allEntities, requirementOptions);
    case "direction":
      return renderDirectionEditor(entity, allEntities);
    case "change-record":
      return renderChangeRecordEditor(entity);
    case "requirement-control-mapping":
      return renderMappingEditor(entity, allEntities);
  }
}

function renderRequirementEditor(
  requirement: RequirementEntity,
  allEntities: readonly V01Entity[],
  browserOptions: RequirementBrowserOptions = {}
): string {
  const isBaseline = requirement.sourceProduct === "core";
  const domainOptions = PSPF_DOMAINS.map((domain) => ({ label: domain.title, value: domain.id }));
  const outboundLinks = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.fromId === requirement.id
  );
  const inboundLinks = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.toId === requirement.id
  );
  const linkedIds = new Set(outboundLinks.map((link) => link.toId));
  const enrichedEntities = enrichActionsWithImpact(allEntities);
  const evidenceItems = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id))
    .sort(compareEvidenceRecords);
  const evidenceRows = evidenceItems.map((item) => ({
    openEntityType: "evidence",
    openEntityId: item.id,
    title: item.title,
    evidenceType: label(item.evidenceType),
    freshness: label(item.freshness),
    reference: item.reference
  }));
  const actionItems = enrichedEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action" && linkedIds.has(entity.id))
    .sort(compareWorkbenchRecords);
  const actionRows = actionItems.map((action) => ({
    openEntityType: "action",
    openEntityId: action.id,
    title: action.title,
    status: label(action.status),
    urgency: action.impact ? label(action.impact.urgency) : "normal",
    dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
  }));
  const riskItems = allEntities
    .filter((entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id))
    .sort(compareWorkbenchRecords);
  const riskRows = riskItems.map((risk) => ({
    openEntityType: "risk",
    openEntityId: risk.id,
    title: risk.title,
    status: label(risk.status),
    likelihood: risk.likelihood,
    impact: risk.impact
  }));
  const tagsById = new Map(
    allEntities
      .filter((entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted")
      .map((tag) => [tag.id, tag])
  );
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
  const directionsById = new Map(
    allEntities
      .filter((entity): entity is DirectionEntity => entity.entityType === "direction")
      .map((entity) => [entity.id, entity])
  );
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
  const sourceControlsById = new Map(
    allEntities
      .filter((entity): entity is SourceControlEntity => entity.entityType === "source-control")
      .map((entity) => [entity.id, entity])
  );
  const mappingRows = allEntities
    .filter(
      (entity): entity is RequirementControlMappingEntity =>
        entity.entityType === "requirement-control-mapping" &&
        entity.recordStatus !== "deleted" &&
        entity.requirementId === requirement.id
    )
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
  const editorContent = `${editorShell(
    requirement,
    "Edit Requirement",
    `
    ${isBaseline ? readonlyField("Title", requirement.title) : inputField("title", "Title", requirement.title, true)}
    ${isBaseline ? readonlyField("Domain", domainName(requirement.domainId)) : selectField("domainId", "Domain", domainOptions, requirement.domainId)}
    ${selectField("assessmentStatus", "Assessment status", assessmentStatusItems, requirement.assessmentStatus)}
    ${textareaField("summary", "Summary", requirement.summary ?? "")}
  `,
    isBaseline ? "Official PSPF baseline title and domain are locked." : undefined,
    requirementNavigationStrip(requirement, allEntities)
  )}
    ${requirementWorkbenchStyles()}
    <section>
      <h2>Requirement Workbench</h2>
      <p class="muted">Add or open the linked records that drive this Requirement's assessment.</p>
      ${requirementSignalCards(requirement, evidenceItems, actionItems, riskItems, mappingRows.length)}
      <div class="form-actions">
        <button type="button" data-command="attachEvidenceToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Add new evidence</button>
        <button type="button" data-command="linkExistingEvidenceToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing evidence</button>
        <button type="button" data-command="createActionForRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Create action</button>
        <button type="button" data-command="linkExistingActionToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing action</button>
        <button type="button" data-command="createRiskForRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Create risk</button>
        <button type="button" data-command="linkExistingRiskToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link existing risk</button>
        <button type="button" data-command="mapRequirementToIsm" data-requirement-id="${escapeHtml(requirement.id)}">Map ISM control</button>
        <button type="button" data-command="linkExistingDirectionToRequirement" data-requirement-id="${escapeHtml(requirement.id)}">Link Direction</button>
        <button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(requirement.id)}">Apply tag</button>
        <button type="button" data-command="recordChange" data-entity-type="requirement" data-entity-id="${escapeHtml(requirement.id)}">Record significant change</button>
        <button type="button" data-command="copyRequirementBrief" data-requirement-id="${escapeHtml(requirement.id)}">Copy brief</button>
      </div>
    </section>
    ${renderRequirementRelationshipManager(requirement, allEntities)}
    ${recordTable("Tags", tagRows, ["title", "colour", "status", "action"])}
    ${recordTable("Directions Targeting This Requirement", directionRows, ["reference", "title", "responseState", "sourceAuthority"])}
    ${recordTable("Evidence", evidenceRows, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actionRows, ["title", "status", "urgency", "dueDate"])}
    ${recordTable("Risks", riskRows, ["title", "status", "likelihood", "impact"])}
    ${commercialContextSection(requirement, allEntities)}
    ${recordTable("ISM Mappings", mappingRows, ["controlId", "title", "coverage", "profile", "confidence", "reviewed"])}
  `;
  return `<div class="requirement-browser">
    ${requirementBrowserNav(requirement, allEntities, browserOptions)}
    <div class="requirement-browser__content">${editorContent}</div>
    ${requirementBrowserScript()}
  </div>`;
}

function requirementSignalCards(
  requirement: RequirementEntity,
  evidence: readonly EvidenceEntity[],
  actions: readonly ActionEntity[],
  risks: readonly RiskEntity[],
  ismMappings: number
): string {
  const staleEvidence = evidence.filter((item) => item.freshness !== "current").length;
  const urgentActions = actions.filter(
    (action) => action.impact?.urgency === "blocked" || action.impact?.urgency === "overdue"
  ).length;
  const openRisks = risks.filter((risk) => risk.status !== "closed").length;
  const evidenceTone = evidence.length === 0 ? "Needs capture" : staleEvidence > 0 ? "Needs freshness" : "Supported";
  return `<div class="requirement-signals" aria-label="Requirement signals">
    ${requirementSignalCard("Assessment", label(requirement.assessmentStatus), domainName(requirement.domainId))}
    ${requirementSignalCard("Evidence", `${evidence.length}`, evidenceTone)}
    ${requirementSignalCard("Actions", `${actions.length}`, urgentActions > 0 ? `${urgentActions} urgent` : "No urgent action")}
    ${requirementSignalCard("Risks", `${risks.length}`, openRisks > 0 ? `${openRisks} open` : "No open risks")}
    ${requirementSignalCard("ISM", `${ismMappings}`, ismMappings > 0 ? "Mapped" : "Map a control")}
  </div>`;
}

function requirementSignalCard(labelText: string, value: string, detail: string): string {
  return `<div class="requirement-signal"><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function requirementWorkbenchStyles(): string {
  return `<style>
    .requirement-signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 12px 0; }
    .requirement-signal { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 10px; background: var(--surface-strong); }
    .requirement-signal span { display: block; color: var(--muted); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .requirement-signal strong { display: block; margin-top: 5px; font-size: 18px; line-height: 1.1; }
    .requirement-signal small { display: block; margin-top: 4px; color: var(--muted); line-height: 1.3; }
    .requirement-browser__filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .requirement-browser__filters button[aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 12%, var(--surface-strong)); }
    .requirement-browser__count { margin: 0; }
  </style>`;
}

function requirementBrowserNav(
  requirement: RequirementEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions = {}
): string {
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .filter((candidate) => {
      if (!options.savedView) {
        return true;
      }
      const links = allEntities.filter(
        (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
      );
      return savedViewMatchesRequirement(options.savedView, candidate, links);
    })
    .sort(compareRequirementsForPicker);
  const currentIndex = requirements.findIndex((candidate) => candidate.id === requirement.id);
  const position = currentIndex >= 0 ? `${currentIndex + 1} of ${requirements.length}` : `${requirements.length} total`;
  const filterText = options.filterText?.trim() ?? "";
  const statusCounts = requirementStatusCounts(requirements);
  const items = requirements
    .map((candidate) => requirementBrowserNavItem(candidate, candidate.id === requirement.id, filterText))
    .join("");
  return `<section class="requirement-browser__nav" aria-label="Requirement browser">
    <h2>Requirements</h2>
    <input class="requirement-browser__filter" type="search" aria-label="Filter requirements" placeholder="Filter by title, domain, or status" value="${escapeHtml(filterText)}">
    <div class="requirement-browser__filters" aria-label="Requirement status filters">
      <button type="button" data-requirement-status-filter="all" aria-pressed="true">All ${requirements.length}</button>
      ${assessmentStatusItems.map((item) => `<button type="button" data-requirement-status-filter="${escapeHtml(item.value)}">${escapeHtml(item.label)} ${statusCounts.get(item.value) ?? 0}</button>`).join("")}
    </div>
    <div class="requirement-browser__list" role="list" aria-label="Scrollable Requirements list">
      ${items || '<p class="muted">No Requirements found.</p>'}
    </div>
    <p class="muted requirement-browser__count" data-requirement-browser-count>${escapeHtml(position)}</p>
  </section>`;
}

function requirementBrowserNavItem(requirement: RequirementEntity, isCurrent: boolean, filterText = ""): string {
  const title = requirement.title;
  const domain = domainName(requirement.domainId);
  const status = label(requirement.assessmentStatus);
  const searchText = `${title} ${domain} ${status} ${requirement.id}`;
  const normalisedFilter = filterText.toLocaleLowerCase("en-AU");
  const hidden = normalisedFilter && !searchText.toLocaleLowerCase("en-AU").includes(normalisedFilter);
  return `<button type="button" class="requirement-browser__item" role="listitem" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${requirementNumberLabel(requirement)}. ${title}. ${domain}. ${status}`)}" data-command="openRequirementInEditor" data-requirement-id="${escapeHtml(requirement.id)}" data-status="${escapeHtml(requirement.assessmentStatus)}" data-search="${escapeHtml(searchText)}"${isCurrent ? ' aria-current="page"' : ""}${hidden ? " hidden" : ""}>
    <span class="requirement-browser__number">${escapeHtml(requirementNumberLabel(requirement))}</span>
    <span class="requirement-browser__meta">${escapeHtml(domain)} · ${escapeHtml(status)}</span>
  </button>`;
}

function requirementStatusCounts(requirements: readonly RequirementEntity[]): Map<AssessmentStatus, number> {
  const counts = new Map<AssessmentStatus, number>();
  for (const requirement of requirements) {
    counts.set(requirement.assessmentStatus, (counts.get(requirement.assessmentStatus) ?? 0) + 1);
  }
  return counts;
}

function requirementBrowserScript(): string {
  return `<script>
    (() => {
      const input = document.querySelector('.requirement-browser__filter');
      const buttons = Array.from(document.querySelectorAll('[data-requirement-status-filter]'));
      const items = Array.from(document.querySelectorAll('.requirement-browser__item'));
      const count = document.querySelector('[data-requirement-browser-count]');
      function applyRequirementFilters() {
        const query = input instanceof HTMLInputElement ? input.value.trim().toLocaleLowerCase('en-AU') : '';
        const selected = buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.getAttribute('data-requirement-status-filter') || 'all';
        let visible = 0;
        for (const item of items) {
          const search = (item.getAttribute('data-search') || item.textContent || '').toLocaleLowerCase('en-AU');
          const status = item.getAttribute('data-status') || '';
          const matches = (!query || search.includes(query)) && (selected === 'all' || status === selected);
          item.hidden = !matches;
          if (matches) visible += 1;
        }
        if (count) count.textContent = visible + ' visible of ' + items.length + ' Requirements';
      }
      input?.addEventListener('input', applyRequirementFilters);
      buttons.forEach((button) => button.addEventListener('click', () => {
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        applyRequirementFilters();
      }));
      applyRequirementFilters();
    })();
  </script>`;
}

function requirementNumberLabel(requirement: RequirementEntity): string {
  const match = requirement.title.trim().match(/^(?:requirement\s*)?([0-9]+[A-Za-z]?(?:\.[0-9]+[A-Za-z]?)*)\b/i);
  return match ? `Requirement ${match[1]}` : requirement.id;
}

type RecordWorkbenchEntity = EvidenceEntity | ActionEntity | RiskEntity;

function recordWorkbenchShell(
  entity: RecordWorkbenchEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions,
  editorContent: string
): string {
  return `<div class="requirement-browser">
    ${recordWorkbenchNav(entity, allEntities, options)}
    <div class="requirement-browser__content">${editorContent}</div>
  </div>`;
}

function recordWorkbenchNav(
  entity: RecordWorkbenchEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions = {}
): string {
  const records = workbenchRecordsForType(entity.entityType, allEntities).sort(compareWorkbenchRecords);
  const currentIndex = records.findIndex((candidate) => candidate.id === entity.id);
  const position = currentIndex >= 0 ? `${currentIndex + 1} of ${records.length}` : `${records.length} total`;
  const filterText = options.filterText?.trim() ?? "";
  const heading = `${label(entity.entityType)}s`;
  const items = records
    .map((candidate) => recordWorkbenchNavItem(candidate, candidate.id === entity.id, filterText))
    .join("");
  return `<section class="requirement-browser__nav" aria-label="${escapeHtml(heading)} browser">
    <h2>${escapeHtml(heading)}</h2>
    <input class="requirement-browser__filter" type="search" aria-label="Filter ${escapeHtml(heading)}" placeholder="Filter by title, status, or reference" value="${escapeHtml(filterText)}" data-filter-target=".requirement-browser__item">
    <div class="requirement-browser__list" role="list" aria-label="Scrollable ${escapeHtml(heading)} list">
      ${items || `<p class="muted">No ${escapeHtml(heading)} found.</p>`}
    </div>
    <p class="muted">${escapeHtml(position)}</p>
  </section>`;
}

function workbenchRecordsForType(
  entityType: RecordWorkbenchEntity["entityType"],
  allEntities: readonly V01Entity[]
): RecordWorkbenchEntity[] {
  return allEntities.filter(
    (candidate): candidate is RecordWorkbenchEntity =>
      candidate.entityType === entityType && candidate.recordStatus !== "deleted" && isRecordWorkbenchEntity(candidate)
  );
}

function isRecordWorkbenchEntity(entity: V01Entity): entity is RecordWorkbenchEntity {
  return entity.entityType === "evidence" || entity.entityType === "action" || entity.entityType === "risk";
}

function recordWorkbenchNavItem(entity: RecordWorkbenchEntity, isCurrent: boolean, filterText = ""): string {
  const title = entity.title;
  const meta = recordWorkbenchMeta(entity);
  const searchText = `${title} ${meta} ${entity.id}`;
  const normalisedFilter = filterText.toLocaleLowerCase("en-AU");
  const hidden = normalisedFilter && !searchText.toLocaleLowerCase("en-AU").includes(normalisedFilter);
  return `<button type="button" class="requirement-browser__item" role="listitem" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${title}. ${meta}`)}" data-command="openRecordInEditor" data-entity-type="${escapeHtml(entity.entityType)}" data-entity-id="${escapeHtml(entity.id)}" data-search="${escapeHtml(searchText)}"${isCurrent ? ' aria-current="page"' : ""}${hidden ? " hidden" : ""}>
    <span class="requirement-browser__number">${escapeHtml(title)}</span>
    <span class="requirement-browser__meta">${escapeHtml(meta)}</span>
  </button>`;
}

function recordWorkbenchMeta(entity: RecordWorkbenchEntity): string {
  switch (entity.entityType) {
    case "evidence":
      return `${label(entity.evidenceType)} · ${label(entity.freshness)}`;
    case "action":
      return `${label(entity.status)} · ${formatShortAuDateTime(entity.dueDate) ?? "No due date"}`;
    case "risk":
      return `${label(entity.status)} · score ${entity.likelihood * entity.impact}`;
  }
}

function compareWorkbenchRecords(left: RecordWorkbenchEntity, right: RecordWorkbenchEntity): number {
  if (left.entityType === "evidence" && right.entityType === "evidence") {
    return compareEvidenceRecords(left, right);
  }
  if (left.entityType === "action" && right.entityType === "action") {
    return (
      (formatShortAuDateTime(left.dueDate) ?? "").localeCompare(formatShortAuDateTime(right.dueDate) ?? "") ||
      left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" })
    );
  }
  if (left.entityType === "risk" && right.entityType === "risk") {
    return (
      right.likelihood * right.impact - left.likelihood * left.impact ||
      left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" })
    );
  }
  return left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" });
}

function compareEvidenceRecords(left: EvidenceEntity, right: EvidenceEntity): number {
  return (
    left.title.localeCompare(right.title, "en-AU", { numeric: true, sensitivity: "base" }) ||
    label(left.evidenceType).localeCompare(label(right.evidenceType), "en-AU", { sensitivity: "base" }) ||
    label(left.freshness).localeCompare(label(right.freshness), "en-AU", { sensitivity: "base" }) ||
    left.reference.localeCompare(right.reference, "en-AU", { numeric: true, sensitivity: "base" }) ||
    left.id.localeCompare(right.id, "en-AU", { numeric: true, sensitivity: "base" })
  );
}

function renderEvidenceEditor(
  evidence: EvidenceEntity,
  allEntities: readonly V01Entity[],
  browserOptions: RequirementBrowserOptions = {}
): string {
  const linkedRequirements = linkedRequirementsForEvidence(evidence, allEntities);
  const requirementRows = linkedRequirements.map((requirement) => ({
    openEntityType: "requirement",
    openEntityId: requirement.id,
    title: requirement.title,
    domain: domainName(requirement.domainId),
    status: label(requirement.assessmentStatus)
  }));
  const editorContent = `${editorShell(
    evidence,
    "Edit Evidence",
    `
    ${inputField("title", "Title", evidence.title, true)}
    ${selectField("evidenceType", "Evidence type", evidenceTypeItems, evidence.evidenceType)}
    ${inputField("reference", "Reference", evidence.reference, true)}
    <div class="form-actions">${evidenceReferenceButton(evidence.reference)}</div>
    ${selectField("freshness", "Freshness", freshnessItems, evidence.freshness)}
  `
  )}
    ${evidenceWorkbenchStyles()}
    <section>
      <h2>Evidence Workbench</h2>
      <p class="muted">Use this record as an assurance signal: keep the source fresh, link it to the Requirements it supports, and copy a short brief for review conversations.</p>
      ${evidenceSignalCards(evidence, linkedRequirements)}
      <div class="form-actions">
        ${evidenceReferenceButton(evidence.reference)}
        <button type="button" data-command="linkEvidenceToRequirements" data-entity-id="${escapeHtml(evidence.id)}">Link Requirement</button>
        <button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Review queue</button>
        <button type="button" data-command="pspf.workshop.openConnectedView">Trace links</button>
        <button type="button" data-command="copyEvidenceBrief" data-entity-id="${escapeHtml(evidence.id)}">Copy brief</button>
      </div>
    </section>
    ${recordTable("Requirements Supported By This Evidence", requirementRows, ["title", "domain", "status"])}
  `;
  return recordWorkbenchShell(evidence, allEntities, browserOptions, editorContent);
}

function evidenceSignalCards(evidence: EvidenceEntity, linkedRequirements: readonly RequirementEntity[]): string {
  const needsAttention =
    evidence.freshness === "expired" || evidence.freshness === "stale" || evidence.freshness === "unknown";
  const notMetCount = linkedRequirements.filter(
    (requirement) => requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met"
  ).length;
  return `<div class="evidence-signals" aria-label="Evidence signals">
    ${evidenceSignalCard("Freshness", label(evidence.freshness), needsAttention ? "Review source" : "Ready to rely on")}
    ${evidenceSignalCard("Type", label(evidence.evidenceType), evidence.reference.trim().length > 0 ? "Reference recorded" : "Reference missing")}
    ${evidenceSignalCard("Requirements", String(linkedRequirements.length), linkedRequirements.length > 0 ? "Linked into assurance" : "Link to Requirements")}
    ${evidenceSignalCard("Assessment pressure", String(notMetCount), notMetCount > 0 ? "Supports open gaps" : "No open gap links")}
  </div>`;
}

function evidenceSignalCard(labelText: string, value: string, detail: string): string {
  return `<div class="evidence-signal"><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function evidenceWorkbenchStyles(): string {
  return `<style>
    .evidence-signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 10px; margin: 12px 0; }
    .evidence-signal { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 10px; background: var(--surface-strong); }
    .evidence-signal span { display: block; color: var(--muted); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .evidence-signal strong { display: block; margin-top: 5px; font-size: 18px; line-height: 1.1; }
    .evidence-signal small { display: block; margin-top: 4px; color: var(--muted); line-height: 1.3; }
  </style>`;
}

function renderActionEditor(
  action: ActionEntity,
  allEntities: readonly V01Entity[],
  browserOptions: RequirementBrowserOptions = {}
): string {
  const impact = action.impact;
  const readOnlyImpact = impact
    ? `
    <section>
      <h2>Action Impact</h2>
      <p class="muted">Calculated from linked Requirements, Evidence, Risks, Directions, status, and due date.</p>
      <div class="grid">
        ${metricCard("Urgency", label(impact.urgency))}
        ${metricCard("Posture uplift", impact.postureUplift)}
        ${metricCard("Evidence uplift", impact.evidenceUplift)}
        ${metricCard("Risk reduction", impact.riskReduction)}
        ${metricCard("Direction uplift", impact.directionUplift ?? 0)}
      </div>
      <p class="muted"><strong>Why this score:</strong> ${escapeHtml((impact.explanation ?? []).join("; ") || "No linked impact signals")}</p>
      <p class="muted">To change impact, edit this Action's status or due date, then manage the linked records that drive the score.</p>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openConnectedView">Trace links</button>
        <button type="button" data-command="pspf.workshop.openEvidenceReviewQueue">Review evidence</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan actions</button>
      </div>
    </section>
  `
    : "";
  const editorContent = `${editorShell(
    action,
    "Edit Action",
    `
    ${inputField("title", "Title", action.title, true)}
    ${selectField("status", "Status", actionStatusItems, action.status)}
    ${inputField("startDate", "Start date", formatShortAuDateTime(action.startDate) ?? "", false, "today or 1 Jul 2026")}
    ${inputField("endDate", "End date", formatShortAuDateTime(action.endDate) ?? "", false, "30 Sep 2026")}
    ${inputField("dueDate", "Due date", formatShortAuDateTime(action.dueDate) ?? "", false, "today or 30 Jun 2026")}
    ${textareaField("newCommentary", "New commentary update", "")}
  `
  )}${actionCommentaryHistorySection(action)}${readOnlyImpact}${commercialContextSection(action, allEntities)}`;
  return recordWorkbenchShell(action, allEntities, browserOptions, editorContent);
}

function renderRiskEditor(
  risk: RiskEntity,
  allEntities: readonly V01Entity[],
  browserOptions: RequirementBrowserOptions = {}
): string {
  const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value: String(value) }));
  const editorContent = `${editorShell(
    risk,
    "Edit Risk",
    `
    ${inputField("title", "Title", risk.title, true)}
    ${selectField("status", "Status", riskStatusItems, risk.status)}
    ${selectField("likelihood", "Likelihood", scoreOptions, String(risk.likelihood))}
    ${selectField("impact", "Impact", scoreOptions, String(risk.impact))}
  `
  )}${riskSourceMetadataSection(risk)}${commercialContextSection(risk, allEntities)}`;
  return recordWorkbenchShell(risk, allEntities, browserOptions, editorContent);
}

function riskSourceMetadataSection(risk: RiskEntity): string {
  const integration = risk.integration;
  const rows = integration
    ? [
        {
          source: integration.sourceLabel,
          lastUpdated: formatShortAuDateTime(integration.remoteUpdatedAt ?? integration.lastSyncedAt) ?? "Not recorded",
          remoteId: integration.remoteId
        }
      ]
    : [];
  return `
    <section>
      <h2>Risk Source</h2>
      <p class="muted">6clicks integration metadata is retained locally. Explorer and generated outputs show only the source and last source update.</p>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openRiskSourcePanel">Open Risk Source panel</button>
      </div>
      ${integration ? recordTable("Source Metadata", rows, ["source", "lastUpdated", "remoteId"]) : `<p class="muted">This Risk is not linked to an external source.</p>`}
    </section>
  `;
}

function renderDirectionEditor(direction: DirectionEntity, allEntities: readonly V01Entity[]): string {
  const isBaseline = direction.sourceProduct === "core";
  const navigation = directionNavigationStrip(direction, allEntities);
  return editorShell(
    direction,
    "Edit Direction",
    `
    ${isBaseline ? readonlyField("Reference", direction.reference) : inputField("reference", "Reference", direction.reference, true)}
    ${isBaseline ? readonlyField("Title", direction.title) : inputField("title", "Title", direction.title, true)}
    ${isBaseline ? readonlyField("Source authority", direction.sourceAuthority ?? "Not recorded") : inputField("sourceAuthority", "Source authority", direction.sourceAuthority ?? "")}
    ${isBaseline ? readonlyField("Issued", direction.issuedAt ?? "Not recorded") : inputField("issuedAt", "Issued", direction.issuedAt ?? "")}
    ${selectField("responseState", "Response", directionResponseStateItems, direction.responseState)}
  `,
    isBaseline ? "Official published Direction fields are locked." : undefined,
    navigation
  );
}

function renderChangeRecordEditor(changeRecord: ChangeRecordEntity): string {
  return editorShell(
    changeRecord,
    "Edit Change Record",
    `
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
  `,
    "Reason, impact summary, and decision owner reference are redacted from Explorer publication."
  );
}

function renderMappingEditor(mapping: RequirementControlMappingEntity, allEntities: readonly V01Entity[]): string {
  const requirement = allEntities.find(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === mapping.requirementId
  );
  const sourceControl = allEntities.find(
    (entity): entity is SourceControlEntity =>
      entity.entityType === "source-control" && entity.id === mapping.sourceControlId
  );
  const profileOptions = sourceControl
    ? profileItems(sourceControl)
    : [{ label: label(mapping.applicabilityProfile), value: mapping.applicabilityProfile }];
  const profileValues = new Set(profileOptions.map((item) => item.value));
  const resolvedProfileOptions = profileValues.has(mapping.applicabilityProfile)
    ? profileOptions
    : [{ label: label(mapping.applicabilityProfile), value: mapping.applicabilityProfile }, ...profileOptions];
  return editorShell(
    mapping,
    "Edit ISM Mapping",
    `
    ${readonlyField("Requirement", requirement?.title ?? mapping.requirementId)}
    ${readonlyField("ISM control", sourceControl ? `${sourceControl.controlId}: ${sourceControl.title}` : mapping.sourceControlId)}
    ${selectField("coverageQualifier", "Coverage", coverageQualifierItems, mapping.coverageQualifier)}
    ${selectField("applicabilityProfile", "Applicability profile", resolvedProfileOptions, mapping.applicabilityProfile)}
    ${selectField("confidence", "Confidence", confidenceItems, mapping.confidence)}
    ${inputField("lastReviewedAt", "Last reviewed", mapping.lastReviewedAt ?? "")}
    ${inputField("reviewBy", "Review by", mapping.reviewBy ?? "")}
    ${textareaField("rationale", "Rationale", mapping.rationale ?? "")}
  `,
    "Requirement and ISM control endpoints are locked after creation."
  );
}

function editorShell(
  entity: EditableWorkshopEntity,
  heading: string,
  fieldsHtml: string,
  note?: string,
  beforeActions = ""
): string {
  const contextualActions =
    entity.entityType === "requirement"
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
          <button type="button" data-command="closeEditor">Cancel</button>
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

function actionCommentaryHistorySection(action: ActionEntity): string {
  const entries = [...(action.commentary ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  if (entries.length === 0) {
    return `<section><h2>Commentary history</h2><p class="muted">No commentary updates recorded yet.</p></section>`;
  }
  const rows = entries.map((entry) => ({
    createdAt: formatShortAuDateTime(entry.createdAt) ?? entry.createdAt,
    update: entry.text
  }));
  return recordTable("Commentary History", rows, ["createdAt", "update"]);
}

function actionCommentaryEntries(
  existing: readonly NonNullable<ActionEntity["commentary"]>[number][] | undefined,
  newCommentary: string | undefined,
  createdAt: string
): ActionEntity["commentary"] | undefined {
  const trimmed = newCommentary?.trim();
  const entries = [...(existing ?? [])];
  if (trimmed) {
    entries.push({ createdAt, text: trimmed });
  }
  return entries.length > 0 ? entries : undefined;
}

function strategyTextArea(name: string, fieldLabel: string, value: string, rows: number): string {
  return `<label class="strategy-editor__field">${escapeHtml(fieldLabel)}<textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value)}</textarea></label>`;
}

function readonlyField(fieldLabel: string, value: string): string {
  return `<label>${escapeHtml(fieldLabel)}<input value="${escapeHtml(value)}" readonly></label>`;
}

function selectField(
  name: string,
  fieldLabel: string,
  options: readonly { readonly label: string; readonly value: string }[],
  selectedValue: string
): string {
  const renderedOptions = options
    .map(
      (item) =>
        `<option value="${escapeHtml(item.value)}"${item.value === selectedValue ? " selected" : ""}>${escapeHtml(item.label)}</option>`
    )
    .join("");
  return `<label>${escapeHtml(fieldLabel)}<select name="${escapeHtml(name)}">${renderedOptions}</select></label>`;
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function splitCommaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requiredFallback(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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
  const panel = vscode.window.createWebviewPanel("pspfTagManager", "PSPF Tag Manager", vscode.ViewColumn.One, {
    enableScripts: true
  });
  const refresh = async () => {
    const allEntities = await listAllEntities();
    const tags = sortTags(
      allEntities.filter(
        (entity): entity is TagEntity => entity.entityType === "tag" && entity.recordStatus !== "deleted"
      )
    );
    const links = allEntities.filter(
      (entity): entity is LinkEntity =>
        entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with"
    );
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
        await vscode.commands.executeCommand("pspf.core.upsertEntity", {
          ...tag,
          recordStatus: "archived",
          updatedAt: new Date().toISOString()
        } satisfies TagEntity);
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
  return shellHtml(
    "PSPF Tag Manager",
    `
    <section>
      <h1>Tag Manager</h1>
      <p class="muted">Workspace-shared classifications for Requirements. Archived tags stay on historical links but are hidden from pickers.</p>
      ${versionStrip()}
      <div class="form-actions"><button type="button" data-command="createTag">Create tag</button></div>
    </section>
    ${recordTable("Tags", rows, ["title", "label", "colour", "status", "requirements", "action"])}
  `
  );
}

async function applyTag(requirementId?: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirement = requirementId
    ? allEntities.find(
        (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === requirementId
      )
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

  const links = (await listAllEntities()).filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const existing = links.find(
    (link) => link.linkType === "tagged-with" && link.fromId === requirement.id && link.toId === tag.id
  );
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
    ? allEntities.find(
        (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.id === requirementId
      )
    : await pickRequirement();
  if (!requirement) {
    return;
  }
  const tagLinks = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" &&
      entity.recordStatus !== "deleted" &&
      entity.linkType === "tagged-with" &&
      entity.fromId === requirement.id
  );
  if (tagLinks.length === 0) {
    await vscode.window.showWarningMessage("No tags are applied to this Requirement.");
    return;
  }
  const tagsById = new Map(
    allEntities.filter((entity): entity is TagEntity => entity.entityType === "tag").map((tag) => [tag.id, tag])
  );
  const link = tagId
    ? tagLinks.find((item) => item.toId === tagId)
    : (
        await vscode.window.showQuickPick(
          tagLinks.map((item) => ({
            label: tagChipLabel(tagsById.get(item.toId)),
            description: tagsById.get(item.toId)?.label ?? item.toId,
            link: item
          })),
          { title: `Remove tag from ${requirement.title}`, ignoreFocusOut: true }
        )
      )?.link;
  if (!link) {
    return;
  }
  await vscode.commands.executeCommand("pspf.core.upsertEntity", {
    ...link,
    recordStatus: "deleted",
    updatedAt: new Date().toISOString()
  } satisfies LinkEntity);
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
  const links = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with"
  );
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
    matchingRequirements.map((requirement) => ({
      label: requirement.title,
      description: `${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)}`,
      requirement
    })),
    { title: `${matchingRequirements.length} Requirement(s) match`, ignoreFocusOut: true }
  );
  if (pickedRequirement) {
    await openItemDetailForRequirement(pickedRequirement.requirement);
  }
}

async function manageSavedViews(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfSavedViewManager", "PSPF Saved Views", vscode.ViewColumn.One, {
    enableScripts: true
  });
  const refresh = async () => {
    panel.webview.html = renderSavedViewManager(await listSavedViews(true));
    panel.reveal(vscode.ViewColumn.One, true);
  };
  panel.webview.onDidReceiveMessage(
    async (message: {
      readonly command?: string;
      readonly savedViewId?: string;
      readonly savedViewScope?: SavedViewScope;
    }) => {
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
      if (message.command === "editSavedViewFilters" && message.savedViewId) {
        const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
        if (savedView) {
          await editWorkshopSavedView(savedView);
          await refreshWorkshopSurfaces();
          await refresh();
        }
      }
      if (message.command === "archiveSavedView" && message.savedViewId) {
        const savedView = (await listSavedViews(true)).find((item) => item.id === message.savedViewId);
        if (savedView) {
          await vscode.commands.executeCommand("pspf.core.upsertEntity", {
            ...savedView,
            recordStatus: "archived",
            updatedAt: new Date().toISOString()
          } satisfies SavedViewEntity);
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
    }
  );
  await refresh();
}

function renderSavedViewManager(savedViews: readonly SavedViewEntity[]): string {
  const workshopViews = savedViews.filter((view) => view.scope.startsWith("workshop-"));
  const activeViews = workshopViews.filter((view) => view.recordStatus !== "archived");
  const archivedViews = workshopViews.filter((view) => view.recordStatus === "archived");
  const rows = savedViews
    .filter((view) => view.scope.startsWith("workshop-"))
    .map((view) => ({
      name: view.name,
      scope: label(view.scope),
      filters: savedViewFilterSummary(view),
      status: label(view.recordStatus),
      action:
        view.recordStatus === "archived"
          ? `<span class="muted">Archived</span> <button type="button" data-command="editSavedViewFilters" data-saved-view-id="${escapeHtml(view.id)}">Edit view</button>`
          : `<button type="button" data-command="applySavedView" data-saved-view-id="${escapeHtml(view.id)}">Open view</button> <button type="button" data-command="editSavedViewFilters" data-saved-view-id="${escapeHtml(view.id)}">Edit view</button> <button type="button" data-command="editSavedView" data-saved-view-id="${escapeHtml(view.id)}">Rename</button> <button type="button" data-command="archiveSavedView" data-saved-view-id="${escapeHtml(view.id)}">Archive</button>`
    }));
  return shellHtml(
    "PSPF Saved Views",
    `
    <section>
      <h1>Saved Views</h1>
      <p class="muted">Open a saved view to start working from its filters. Workshop-owned views export in bundles, but other tools may ignore unsupported scopes.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Active views", activeViews.length)}
        ${metricCard("Archived views", archivedViews.length)}
        ${metricCard("Workshop scopes", new Set(workshopViews.map((view) => view.scope)).size)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-requirements">Create Requirements view</button>
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-dashboard">Create Dashboard view</button>
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-evidence-review">Create Evidence Review view</button>
      </div>
    </section>
    ${recordTable("Workshop Saved Views", rows, ["name", "scope", "filters", "status", "action"])}
  `
  );
}

async function createOrEditWorkshopSavedView(
  scopeOrExisting?: SavedViewScope | SavedViewEntity,
  existing?: SavedViewEntity
): Promise<SavedViewEntity | undefined> {
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
    const renamed = {
      ...editing,
      title: cleanName,
      name: cleanName,
      updatedAt: new Date().toISOString()
    } satisfies SavedViewEntity;
    await vscode.commands.executeCommand("pspf.core.upsertEntity", renamed);
    await refreshWorkshopSurfaces();
    await vscode.window.showInformationMessage(`Updated saved view: ${renamed.name}.`);
    return renamed;
  }

  const query = await vscode.window.showInputBox({
    title: "Create Saved View",
    prompt: "Optional Requirement search text. Press Enter to skip.",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.length > SAVED_VIEW_LIMITS.queryMaxLength
        ? `Use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.`
        : undefined
  });
  if (query === undefined) {
    return undefined;
  }
  const statuses = await vscode.window.showQuickPick(assessmentStatusItems, {
    title: "Optional assessment statuses",
    canPickMany: true,
    ignoreFocusOut: true
  });
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
  const mode =
    tags.length > 1
      ? await vscode.window.showQuickPick(
          [
            { label: "Any selected tag", value: "any" as const },
            { label: "All selected tags", value: "all" as const }
          ],
          { title: "Tag filter mode", ignoreFocusOut: true }
        )
      : undefined;
  if (tags.length > 1 && !mode) {
    return undefined;
  }
  const savedView = withEnvelope(
    "saved-view",
    {
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
      presentation: {
        sortKey: "title",
        sortDirection: "asc",
        visibleColumns: ["title", "domainId", "assessmentStatus", "tags"]
      }
    },
    "workshop"
  ) satisfies SavedViewEntity;
  await vscode.commands.executeCommand("pspf.core.upsertEntity", savedView);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Created saved view: ${savedView.name}.`);
  return savedView;
}

async function editWorkshopSavedView(savedView: SavedViewEntity): Promise<SavedViewEntity | undefined> {
  const savedViews = await listSavedViews(true);
  const name = await vscode.window.showInputBox({
    title: "Edit Saved View",
    prompt: "Saved view name",
    value: savedView.name,
    ignoreFocusOut: true,
    validateInput: (value) => validateSavedViewNameInput(value, savedViews, savedView.id, savedView.scope)
  });
  if (!name) {
    return undefined;
  }

  const query = await vscode.window.showInputBox({
    title: "Edit Saved View",
    prompt: "Requirement search text. Clear this box to remove the search filter.",
    value: savedView.filters.query ?? "",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.length > SAVED_VIEW_LIMITS.queryMaxLength
        ? `Use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.`
        : undefined
  });
  if (query === undefined) {
    return undefined;
  }

  const statuses = await vscode.window.showQuickPick(
    assessmentStatusItems.map((item) => ({
      ...item,
      picked: savedView.filters.assessmentStatuses?.includes(item.value)
    })),
    {
      title: "Assessment statuses to include. Leave empty for all statuses.",
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (statuses === undefined) {
    return undefined;
  }

  const tags = await vscode.window.showQuickPick(
    (await listTags(false)).map((tag) => ({
      label: tagChipLabel(tag),
      description: label(tag.colour),
      picked: savedView.filters.tagIds?.includes(tag.id),
      tag
    })),
    { title: "Tags to include. Leave empty for all tags.", canPickMany: true, ignoreFocusOut: true }
  );
  if (tags === undefined) {
    return undefined;
  }

  const mode =
    tags.length > 1
      ? await vscode.window.showQuickPick(
          [
            {
              label: "Any selected tag",
              value: "any" as const,
              picked: (savedView.filters.tagsMode ?? "any") === "any"
            },
            { label: "All selected tags", value: "all" as const, picked: savedView.filters.tagsMode === "all" }
          ],
          { title: "Tag filter mode", ignoreFocusOut: true }
        )
      : undefined;
  if (tags.length > 1 && !mode) {
    return undefined;
  }

  const cleanName = name.normalize("NFC").trim().replace(/\s+/g, " ");
  const updated = {
    ...savedView,
    title: cleanName,
    name: cleanName,
    filters: {
      ...savedView.filters,
      query: trimOptional(query),
      assessmentStatuses: statuses.map((item) => item.value),
      tagIds: tags.map((item) => item.tag.id),
      tagsMode: mode?.value ?? "any"
    },
    updatedAt: new Date().toISOString()
  } satisfies SavedViewEntity;
  await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Updated saved view: ${updated.name}.`);
  return updated;
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
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const matchingRequirements = requirements.filter((requirement) =>
    savedViewMatchesRequirement(savedView, requirement, links)
  );
  const matchingRequirementIds = new Set(matchingRequirements.map((requirement) => requirement.id));
  const linkedActionIds = new Set(
    links
      .filter(
        (link) => link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "action"
      )
      .map((link) => link.toId)
  );
  const linkedRiskIds = new Set(
    links
      .filter(
        (link) => link.fromType === "requirement" && matchingRequirementIds.has(link.fromId) && link.toType === "risk"
      )
      .map((link) => link.toId)
  );
  const changeLinks = links.filter((link) => link.linkType === "changes" && matchingRequirementIds.has(link.toId));
  const changeIds = new Set(changeLinks.map((link) => link.fromId));
  const actionRows = enrichedEntities
    .filter(
      (entity): entity is ActionEntity =>
        entity.entityType === "action" &&
        linkedActionIds.has(entity.id) &&
        !["done", "cancelled"].includes(entity.status)
    )
    .map((action) => ({
      openEntityType: "action",
      openEntityId: action.id,
      title: action.title,
      status: label(action.status),
      urgency: action.impact ? label(action.impact.urgency) : "normal",
      dueDate: formatShortAuDateTime(action.dueDate) ?? "Not set"
    }));
  const riskRows = allEntities
    .filter(
      (entity): entity is RiskEntity =>
        entity.entityType === "risk" && linkedRiskIds.has(entity.id) && entity.status !== "closed"
    )
    .sort((left, right) => right.likelihood * right.impact - left.likelihood * left.impact)
    .map((risk) => ({
      openEntityType: "risk",
      openEntityId: risk.id,
      title: risk.title,
      status: label(risk.status),
      likelihood: risk.likelihood,
      impact: risk.impact,
      severity: risk.likelihood * risk.impact
    }));
  const changeRows = allEntities
    .filter((entity): entity is ChangeRecordEntity => entity.entityType === "change-record" && changeIds.has(entity.id))
    .sort((left, right) => right.raisedAt.localeCompare(left.raisedAt))
    .map((changeRecord) => ({
      openEntityType: "change-record",
      openEntityId: changeRecord.id,
      title: changeRecord.title,
      status: label(changeRecord.status),
      type: label(changeRecord.changeType),
      raised: formatDisplayDate(new Date(changeRecord.raisedAt)),
      summary: changeRecord.summary
    }));
  const requirementRows = matchingRequirements.map((requirement) => ({
    openEntityType: "requirement",
    openEntityId: requirement.id,
    title: requirement.title,
    domain: domainName(requirement.domainId),
    status: label(requirement.assessmentStatus)
  }));
  const panel = vscode.window.createWebviewPanel(
    "pspfWorkshopSavedView",
    shortWorkshopPanelTitle({ entityType: "saved-view", title: savedView.name } as V01Entity),
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    savedView.name,
    `
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
  `
  );
}

async function openWorkshopEvidenceReviewSavedView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence")
    .sort(compareEvidenceRecords);
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const matchingRequirements = requirements.filter((requirement) =>
    savedViewMatchesRequirement(savedView, requirement, links)
  );
  const matchingRequirementIds = new Set(matchingRequirements.map((requirement) => requirement.id));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const linkedEvidenceIds = new Set(
    links
      .filter(
        (link) =>
          link.linkType === "supported-by" &&
          link.fromType === "requirement" &&
          matchingRequirementIds.has(link.fromId) &&
          link.toType === "evidence"
      )
      .map((link) => link.toId)
  );
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) =>
          link.linkType === "supported-by" &&
          link.fromType === "requirement" &&
          matchingRequirementIds.has(link.fromId) &&
          link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const missingEvidence = matchingRequirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id))
    .map((requirement) => ({
      openEntityType: "requirement",
      openEntityId: requirement.id,
      title: requirement.title,
      domain: domainName(requirement.domainId),
      status: label(requirement.assessmentStatus)
    }));
  const evidenceRows = [...linkedEvidenceIds]
    .map((evidenceId) => evidenceById.get(evidenceId))
    .filter((item): item is EvidenceEntity => item !== undefined && item.freshness !== "current")
    .sort(compareEvidenceRecords)
    .map((item) => ({
      openEntityType: "evidence",
      openEntityId: item.id,
      title: item.title,
      freshness: label(item.freshness),
      reference: item.reference
    }));
  const panel = vscode.window.createWebviewPanel(
    "pspfWorkshopSavedView",
    shortWorkshopPanelTitle({ entityType: "saved-view", title: savedView.name } as V01Entity),
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel);
  panel.webview.html = shellHtml(
    savedView.name,
    `
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
  `
  );
}

async function openWorkshopRequirementsView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const links = allEntities.filter(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" && entity.recordStatus !== "deleted" && entity.linkType === "tagged-with"
  );
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .sort(compareRequirementsForPicker);
  const matchingRequirements = requirements.filter((requirement) =>
    savedViewMatchesRequirement(savedView, requirement, links)
  );
  const recentRequirementId = getRecentRequirementId();
  const initialRequirement =
    matchingRequirements.find((requirement) => requirement.id === recentRequirementId) ?? matchingRequirements.at(0);
  if (!initialRequirement) {
    await vscode.window.showInformationMessage(
      `${savedView.name} has no matching Requirements. Update the saved filters or create matching Requirements first.`
    );
    return;
  }
  await openEntityEditor(initialRequirement, allEntities, {
    savedView,
    filterText: savedView.filters.query ?? ""
  });
}

function savedViewMatchesRequirement(
  savedView: SavedViewEntity,
  requirement: RequirementEntity,
  links: readonly LinkEntity[]
): boolean {
  const filters = savedView.filters;
  const query = filters.query?.trim().toLocaleLowerCase("en-AU");
  if (query && !`${requirement.title} ${requirement.summary ?? ""}`.toLocaleLowerCase("en-AU").includes(query)) {
    return false;
  }
  if ((filters.domainIds ?? []).length > 0 && !filters.domainIds?.includes(requirement.domainId)) {
    return false;
  }
  if (
    (filters.assessmentStatuses ?? []).length > 0 &&
    !filters.assessmentStatuses?.includes(requirement.assessmentStatus)
  ) {
    return false;
  }
  const tagIds = filters.tagIds ?? [];
  if (tagIds.length > 0) {
    const requirementTagIds = new Set(links.filter((link) => link.fromId === requirement.id).map((link) => link.toId));
    return filters.tagsMode === "all"
      ? tagIds.every((id) => requirementTagIds.has(id))
      : tagIds.some((id) => requirementTagIds.has(id));
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

function validateSavedViewNameInput(
  value: string,
  savedViews: readonly SavedViewEntity[],
  currentId: string | undefined,
  scope: SavedViewEntity["scope"]
): string | undefined {
  if (!isValidSavedViewName(value)) {
    return `Use 1-${SAVED_VIEW_LIMITS.nameMaxLength} characters.`;
  }
  const normalised = normaliseSavedViewName(value);
  const duplicate = savedViews.find(
    (view) =>
      view.id !== currentId &&
      view.scope === scope &&
      view.recordStatus !== "deleted" &&
      normaliseSavedViewName(view.name) === normalised
  );
  return duplicate ? `This saved-view name already exists in ${label(scope)}.` : undefined;
}

async function createOrEditTag(existing?: TagEntity): Promise<TagEntity | undefined> {
  const tags = await listTags(true);
  if (!existing && tags.length >= TAG_LIMITS.perWorkspaceHard) {
    await vscode.window.showErrorMessage(
      `Tag limit reached: maximum ${TAG_LIMITS.perWorkspaceHard} tags per workspace.`
    );
    return undefined;
  }
  if (!existing && tags.length >= TAG_LIMITS.perWorkspaceSoftWarning) {
    await vscode.window.showWarningMessage(
      `This workspace has ${tags.length} tags. Consider archiving tags that are no longer active.`
    );
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
    validateInput: (value) =>
      value.trim().length === 0 || value.trim().length > TAG_LIMITS.titleMaxLength
        ? `Use 1-${TAG_LIMITS.titleMaxLength} characters.`
        : undefined
  });
  if (!title) {
    return undefined;
  }
  const colour = await vscode.window.showQuickPick(
    TAG_COLOURS.map((value) => ({
      label: label(value),
      value,
      picked: value === (existing?.colour ?? DEFAULT_TAG_COLOUR)
    })),
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
    validateInput: (value) =>
      isValidSingleGrapheme(value.trim()) ? undefined : "Use a single emoji or leave this blank."
  });
  if (emoji === undefined) {
    return undefined;
  }
  const description = await vscode.window.showInputBox({
    title: existing ? "Edit Tag" : "Create Tag",
    prompt: "Optional sensitive description, not published by default.",
    value: existing?.description ?? "",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.length > TAG_LIMITS.descriptionMaxLength
        ? `Use at most ${TAG_LIMITS.descriptionMaxLength} characters.`
        : undefined
  });
  if (description === undefined) {
    return undefined;
  }
  const tag: TagEntity = existing
    ? {
        ...existing,
        label: tagLabel,
        title: title.trim(),
        colour: colour.value as TagColour,
        emoji: trimOptional(emoji),
        description: trimOptional(description),
        updatedAt: new Date().toISOString()
      }
    : withEnvelope(
        "tag",
        {
          entityType: "tag",
          label: tagLabel,
          title: title.trim(),
          colour: colour.value as TagColour,
          emoji: trimOptional(emoji),
          description: trimOptional(description)
        },
        "workshop"
      );
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
  return sortTags(
    (entities ?? []).filter(
      (entity): entity is TagEntity =>
        entity.entityType === "tag" &&
        entity.recordStatus !== "deleted" &&
        (includeArchived || entity.recordStatus !== "archived")
    )
  );
}

async function listSavedViews(includeArchived: boolean): Promise<SavedViewEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "saved-view");
  return (entities ?? [])
    .filter(
      (entity): entity is SavedViewEntity =>
        entity.entityType === "saved-view" &&
        entity.recordStatus !== "deleted" &&
        (includeArchived || entity.recordStatus !== "archived")
    )
    .sort(
      (left, right) =>
        left.scope.localeCompare(right.scope, "en-AU") ||
        left.name.localeCompare(right.name, "en-AU", { sensitivity: "base" })
    );
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
  const input = buildShareArtefactInput(allEntities);
  const brief = renderPostureBriefMarkdown({
    generatedAt: new Date(),
    requirements: input.requirements,
    evidence: input.evidence,
    actions: input.actions,
    risks: input.risks,
    links: input.links,
    directions: input.directions,
    strategies: input.strategies,
    domains: PSPF_DOMAINS,
    sourceLabel: "PSPF Workshop"
  });

  await vscode.env.clipboard.writeText(brief);
  await vscode.window.showInformationMessage("PSPF posture brief copied to clipboard.");
}

async function openCisoMagazine(): Promise<void> {
  await ensureCoreReady();
  const input = buildShareArtefactInput(await listAllEntities());
  const html = renderCisoMagazineHtml(input);
  const markdown = renderCisoMagazineMarkdown(input);
  const panel = vscode.window.createWebviewPanel("pspfCisoMagazine", "Digital CISO Magazine", vscode.ViewColumn.One, {
    enableScripts: false
  });
  panel.webview.html = html;
  await vscode.env.clipboard.writeText(markdown);
  await vscode.window.showInformationMessage("Digital CISO Magazine opened and email copy copied to clipboard.");
}

async function openCisoNewsletterReview(): Promise<void> {
  await ensureCoreReady();
  const input = buildShareArtefactInput(await listAllEntities());
  const model = buildCisoMagazineModel(input);
  const actionRows = model.actionStrip.map((item) => ({
    openEntityType: "action",
    openEntityId: item.actionId,
    title: item.title,
    status: item.status,
    dueDate: item.dueDate ?? "Not set",
    linkedRequirement: item.linkedRequirement ?? "No linked Requirement",
    latestUpdate: item.latestUpdate ?? "No commentary update"
  }));
  const storyRows = model.featureStories.map((story) => ({ title: story.title, body: story.body }));
  const attentionRows = model.attentionItems.map((item) => ({
    title: item.title,
    domain: item.pspfDomainTitle,
    reason: item.reason
  }));
  const panel = vscode.window.createWebviewPanel(
    "pspfCisoNewsletterReview",
    "Newsletter Content Review",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, openCisoNewsletterReview);
  panel.webview.html = shellHtml(
    "Newsletter Content Review",
    `
    <section>
      <p class="eyebrow">OFFICIAL: Sensitive</p>
      <h1>Newsletter Content Review</h1>
      <p class="muted">${escapeHtml(model.issueNumber)} · ${escapeHtml(model.periodLabel)} · ${escapeHtml(model.pspfDomainTitle)} · generated ${escapeHtml(model.generatedAt)}</p>
      <p>Review the generated newsletter inputs before copying or exporting. Action commentary appears as the latest timestamped update, so open any Action that needs a cleaner update before export.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Stories", model.featureStories.length)}
        ${metricCard("Attention items", model.attentionItems.length)}
        ${metricCard("Open actions", model.actionStrip.length)}
        ${metricCard("Commercial watch", model.commercialWatch.length)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openCisoMagazine">Open magazine</button>
        <button type="button" data-command="pspf.workshop.copyCisoMagazine">Copy Markdown</button>
        <button type="button" data-command="pspf.workshop.exportCisoMagazine">Export file</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan of Action</button>
      </div>
    </section>
    ${recordTable("Feature Stories", storyRows, ["title", "body"])}
    ${recordTable("Attention Required", attentionRows, ["title", "domain", "reason"])}
    ${recordTable("Action Strip", actionRows, ["title", "status", "dueDate", "linkedRequirement", "latestUpdate"])}
  `
  );
}

async function copyCisoMagazine(): Promise<void> {
  await ensureCoreReady();
  const markdown = renderCisoMagazineMarkdown(buildShareArtefactInput(await listAllEntities()));
  await vscode.env.clipboard.writeText(markdown);
  await vscode.window.showInformationMessage("Digital CISO Magazine Markdown copied to clipboard.");
}

async function exportCisoMagazine(): Promise<void> {
  await ensureCoreReady();
  const format = await vscode.window.showQuickPick(
    [
      { label: "Markdown", value: "md" as const },
      { label: "HTML", value: "html" as const }
    ],
    { title: "Export Digital CISO Magazine", ignoreFocusOut: true }
  );
  if (!format) {
    return;
  }
  const input = buildShareArtefactInput(await listAllEntities());
  const content = format.value === "html" ? renderCisoMagazineHtml(input) : renderCisoMagazineMarkdown(input);
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`digital-ciso-magazine-${PSPF_SLICE_VERSION}.${format.value}`),
    filters: format.value === "html" ? { HTML: ["html"] } : { Markdown: ["md"] },
    saveLabel: "Export"
  });
  if (!target) {
    return;
  }
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
  await vscode.window.showInformationMessage(`Digital CISO Magazine exported to ${target.fsPath}.`);
}

async function openCisoMasterPlan(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfCisoMasterPlan", "CISO Master Plan", vscode.ViewColumn.One, {
    enableScripts: true
  });
  const refresh = async (): Promise<void> => {
    panel.webview.html = renderCisoMasterPlanPanel(buildShareArtefactInput(await listAllEntities()));
  };
  wireWorkshopPanelMessages(panel, refresh);
  await refresh();
}

function renderCisoMasterPlanPanel(input: ReturnType<typeof buildShareArtefactInput>): string {
  const model = buildCisoMasterPlanModel(input);
  const ownershipRows = roleOwnershipRows(input.requirementControlMappings ?? []);
  const streamRows = model.streams.map((stream) => ({
    stream: stream.title,
    phase: stream.phase,
    status: stream.status,
    basis: stream.basis
  }));
  const phaseRows = model.phases.map((phase) => ({
    phase: phase.title,
    focus: phase.focus,
    count: phase.count
  }));
  const dependencyRows = model.dependencies.map((dependency) => ({
    dependency: dependency.title,
    source: dependency.source,
    status: dependency.status
  }));
  const initiativeRows = model.initiativePlans.flatMap((initiative) =>
    initiative.stages.map((stage) => ({
      openEntityType: "action",
      openEntityId: stage.actionId,
      initiative: initiative.title,
      plannerItem: stage.stage,
      actionRecord: stage.actionTitle,
      status: stage.status,
      dueDate: stage.dueDate ?? "Not set",
      evidence: initiative.evidenceCount
    }))
  );
  const initiativeEvidenceRows = model.initiativePlans.flatMap((initiative) =>
    initiative.evidence.map((evidence) => ({
      openEntityType: "evidence",
      openEntityId: evidence.evidenceId,
      initiative: initiative.title,
      evidence: evidence.title,
      freshness: evidence.freshness
    }))
  );
  const readinessRows = cisoMasterPlanReadinessRows(model);
  return shellHtml(
    "CISO Master Plan",
    `
    <section>
      <p class="eyebrow">Active planning</p>
      <h1>CISO Master Plan</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Strategic roadmap and planning narrative derived from Strategy, Plan of Action, risk movement, evidence work, and Shop dependencies.</p>
      <p>Use this view to understand how the work fits together over time. Plan of Action remains the action worklist; this Master Plan groups the work into streams, phases, dependencies, investment focus, and executive planning.</p>
      <p>Open each initiative task or milestone to edit its title, status, due date, and timing. Open the evidence rows to update the case for action as reality changes.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Streams", model.streams.length)}
        ${metricCard("Initiatives", model.initiativePlans.length)}
        ${metricCard("Phases", model.phases.length)}
        ${metricCard("Dependencies", model.dependencies.length)}
        ${metricCard("Ownership roles", model.roleOwnership.length)}
        ${metricCard("Horizon", model.horizon)}
      </div>
      <p>${escapeHtml(model.direction)}</p>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
        <button type="button" data-command="pspf.workshop.editStrategySummary">Strategy Editor</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan of Action</button>
        <button type="button" data-command="pspf.workshop.createRoadmapInitiativePlan">Add initiative plan</button>
        <button type="button" data-command="pspf.workshop.addPlannerTask">Add planner task</button>
        <button type="button" data-command="pspf.workshop.addPlannerMilestone">Add milestone</button>
        <button type="button" data-command="pspf.workshop.openMasterDashboard">Master Dashboard</button>
        <button type="button" data-command="pspf.workshop.openCisoMagazine">Digital CISO Magazine</button>
        <button type="button" data-command="pspf.workshop.copyCisoMasterPlan">Copy plan</button>
      </div>
    </section>
    ${recordTable("Planning Readiness", readinessRows, ["area", "status", "nextStep"])}
    ${recordTable("Role Ownership Summary", ownershipRows, ["role", "requirements", "controls"])}
    ${recordTable("Plan Streams", streamRows, ["stream", "phase", "status", "basis"])}
    ${recordTable("Roadmap Planner Items", initiativeRows, ["initiative", "plannerItem", "actionRecord", "status", "dueDate", "evidence"])}
    ${recordTable("Roadmap Initiative Evidence", initiativeEvidenceRows, ["initiative", "evidence", "freshness"])}
    ${recordTable("Plan Phases", phaseRows, ["phase", "focus", "count"])}
    ${recordTable("Inputs And Dependencies", dependencyRows, ["dependency", "source", "status"])}
  `
  );
}

function roleOwnershipRows(
  mappings: readonly RequirementControlMappingEntity[]
): readonly { readonly role: string; readonly requirements: number; readonly controls: number }[] {
  const summary = new Map<string, { readonly requirementIds: Set<string>; readonly controlIds: Set<string> }>();
  for (const mapping of mappings.filter((item) => item.recordStatus !== "deleted")) {
    const role = mapping.reviewBy?.trim() || "Not recorded";
    const current = summary.get(role) ?? { requirementIds: new Set<string>(), controlIds: new Set<string>() };
    current.requirementIds.add(mapping.requirementId);
    current.controlIds.add(mapping.sourceControlId);
    summary.set(role, current);
  }
  return [...summary.entries()]
    .map(([role, counts]) => ({ role, requirements: counts.requirementIds.size, controls: counts.controlIds.size }))
    .sort((left, right) => left.role.localeCompare(right.role, "en-AU", { sensitivity: "base" }));
}

function cisoMasterPlanReadinessRows(model: ReturnType<typeof buildCisoMasterPlanModel>): readonly {
  readonly area: string;
  readonly status: string;
  readonly nextStep: string;
}[] {
  const initiativeWithoutEvidence = model.initiativePlans.filter((initiative) => initiative.evidenceCount === 0).length;
  return [
    {
      area: "Strategy direction",
      status: model.streams.length > 0 ? "Ready" : "Needs strategy stream",
      nextStep:
        model.streams.length > 0
          ? "Review Strategy Map for choice and outcome coverage."
          : "Open Strategy Editor and add at least one strategic choice."
    },
    {
      area: "Planner items",
      status:
        model.initiativePlans.length > 0 ? `${model.initiativePlans.length} initiative plan(s)` : "No initiative plans",
      nextStep:
        model.initiativePlans.length > 0
          ? "Open planner Actions to keep status, timing and wording current."
          : "Add an initiative plan when roadmap work needs a step-built planning frame."
    },
    {
      area: "Case for action",
      status:
        initiativeWithoutEvidence === 0
          ? "Evidence linked"
          : `${initiativeWithoutEvidence} initiative(s) need evidence`,
      nextStep:
        initiativeWithoutEvidence === 0
          ? "Open Evidence rows to keep the case for action current."
          : "Link Evidence to the initiative Actions so the case for action remains editable."
    },
    {
      area: "Dependencies",
      status:
        model.dependencies.length > 0 ? `${model.dependencies.length} dependency row(s)` : "No dependencies recorded",
      nextStep:
        model.dependencies.length > 0
          ? "Review supplier, risk and external dependency status before sharing the plan."
          : "Link Shop milestones, open Risks or other dependency records when they affect the path."
    }
  ];
}

async function copyCisoMasterPlan(): Promise<void> {
  await ensureCoreReady();
  const plan = renderCisoMasterPlanMarkdown(buildShareArtefactInput(await listAllEntities()));
  await vscode.env.clipboard.writeText(plan);
  await vscode.window.showInformationMessage("CISO Master Plan copied to clipboard.");
}

function buildShareArtefactInput(allEntities: readonly V01Entity[]) {
  return {
    generatedAt: new Date(),
    issueTitle: "Digital CISO Magazine",
    issueNumber: `Issue ${PSPF_SLICE_VERSION}`,
    periodLabel: formatDisplayDate(new Date()),
    audience: "internal" as const,
    domainScope: "all" as const,
    requirements: allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement"),
    evidence: allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence"),
    actions: allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action"),
    risks: allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk"),
    links: allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link"),
    domains: PSPF_DOMAINS,
    directions: allEntities.filter((entity): entity is DirectionEntity => entity.entityType === "direction"),
    strategies: allEntities.filter((entity): entity is StrategyEntity => entity.entityType === "strategy"),
    changeRecords: allEntities.filter((entity): entity is ChangeRecordEntity => entity.entityType === "change-record"),
    spendItems: allEntities.filter((entity): entity is SpendItemEntity => entity.entityType === "spend-item"),
    requirementControlMappings: allEntities.filter(
      (entity): entity is RequirementControlMappingEntity => entity.entityType === "requirement-control-mapping"
    ),
    sourceControls: allEntities.filter(
      (entity): entity is SourceControlEntity => entity.entityType === "source-control"
    ),
    sourceLabel: "PSPF Workshop",
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion
  };
}

async function listAllEntities(): Promise<V01Entity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  return entities ?? [];
}

type RequirementNavigationDirection = "previous" | "next";
type LinkableExistingEntity = EvidenceEntity | ActionEntity | RiskEntity | DirectionEntity;

function isRequirementNavigationDirection(value: string | undefined): value is RequirementNavigationDirection {
  return value === "previous" || value === "next";
}

async function openAdjacentRequirement(
  requirementId: string,
  direction: RequirementNavigationDirection
): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const adjacent = adjacentRequirementFromEntities(requirementId, direction, allEntities);
  if (adjacent.status === "missing") {
    await vscode.window.showWarningMessage("This Requirement no longer exists. Choose another Requirement.");
    return;
  }
  if (adjacent.status === "edge") {
    await vscode.window.showInformationMessage(
      direction === "next" ? "Already at the last Requirement." : "Already at the first Requirement."
    );
    return;
  }
  if (adjacent.status !== "found") {
    return;
  }
  await openEntityEditor(adjacent.requirement, allEntities);
}

function adjacentRequirementFromEntities(
  requirementId: string,
  direction: RequirementNavigationDirection,
  allEntities: readonly V01Entity[],
  savedView?: SavedViewEntity
): { readonly status: "found"; readonly requirement: RequirementEntity } | { readonly status: "missing" | "edge" } {
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .filter((requirement) => !savedView || savedViewMatchesRequirement(savedView, requirement, links))
    .sort(compareRequirementsForPicker);
  const currentIndex = requirements.findIndex((requirement) => requirement.id === requirementId);
  if (currentIndex < 0) {
    return { status: "missing" };
  }
  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  const requirement = requirements[nextIndex];
  return requirement ? { status: "found", requirement } : { status: "edge" };
}

async function openAdjacentDirection(
  directionId: string,
  navigationDirection: RequirementNavigationDirection
): Promise<void> {
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
    await vscode.window.showInformationMessage(
      navigationDirection === "next" ? "Already at the last Direction." : "Already at the first Direction."
    );
    return;
  }
  await openItemDetailForDirection(adjacentDirection);
}

async function linkExistingItemToRequirement(
  requirementId: string | undefined,
  itemType: LinkableItemType
): Promise<void> {
  await ensureCoreReady();
  const requirement = requirementId
    ? (await listRequirements()).find((item) => item.id === requirementId)
    : await pickRequirement();
  if (!requirement) {
    await vscode.window.showWarningMessage(`Choose a Requirement before linking existing ${label(itemType)}.`);
    return;
  }
  const allEntities = await listAllEntities();
  const activeLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const linkType = linkTypeForExistingItem(itemType);
  const alreadyLinkedIds = new Set(
    activeLinks
      .filter((link) => isExistingItemLinkForRequirement(link, requirement.id, itemType, linkType))
      .map((link) => (itemType === "direction" ? link.fromId : link.toId))
  );
  const candidates = allEntities
    .filter(
      (entity): entity is LinkableExistingEntity =>
        entity.entityType === itemType && entity.recordStatus !== "deleted" && !alreadyLinkedIds.has(entity.id)
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(
      `No unlinked ${label(itemType).toLowerCase()} records are available for this Requirement.`
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((entity) => ({
      label: entity.title,
      description: existingItemDescription(entity, activeLinks),
      detail: entity.id,
      entity
    })),
    {
      title: `Link Existing ${label(itemType)}`,
      placeHolder: `Select one or more ${label(itemType).toLowerCase()} records to link`,
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (!picked || picked.length === 0) {
    return;
  }
  const links = picked.map(({ entity }) =>
    withEnvelope(
      "link",
      {
        entityType: "link",
        title:
          itemType === "direction"
            ? `${entity.title} targets ${requirement.title}`
            : `${requirement.title} ${linkPhraseForExistingItem(itemType)} ${entity.title}`,
        linkType,
        fromId: itemType === "direction" ? entity.id : requirement.id,
        fromType: itemType === "direction" ? "direction" : "requirement",
        toId: itemType === "direction" ? requirement.id : entity.id,
        toType: itemType === "direction" ? "requirement" : itemType
      },
      "workshop"
    )
  );
  await vscode.commands.executeCommand("pspf.core.upsertEntities", links);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
  const consequence = buildRelationshipConsequence({
    requirement,
    itemType,
    linkedItems: picked.map(({ entity }) => entity),
    allEntities,
    newLinks: links
  });
  const action = await vscode.window.showInformationMessage(
    `${consequence.title}: ${consequence.summary}`,
    "Reveal in Connected View",
    "Open Requirement"
  );
  if (action === "Reveal in Connected View") {
    await openConnectedView({
      initialSelectionIds: consequence.connectedViewFocusIds,
      revealMessage: consequence.title
    });
  }
  if (action === "Open Requirement") {
    await openItemDetailForEntity("requirement", requirement.id);
  }
}

function renderRequirementRelationshipManager(
  requirement: RequirementEntity,
  allEntities: readonly V01Entity[]
): string {
  const activeLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const actions: RelationshipManagerAction[] = requirementRelationshipItemTypes.map((itemType) => {
    const rule = existingItemOperatorRule(itemType);
    const availableCount = unlinkedExistingItemCount(requirement.id, itemType, allEntities, activeLinks);
    return {
      label: `Link existing ${label(itemType)}`,
      fromLabel: label(rule.fromType),
      phrase: rule.phrase,
      toLabel: label(rule.toType),
      helpText: relationshipActionHelpText(itemType),
      command: availableCount > 0 ? linkExistingCommandForItem(itemType) : undefined,
      dataAttributes: { "data-requirement-id": requirement.id },
      disabledReason: `No unlinked ${label(itemType).toLowerCase()} records available`
    };
  });

  return relationshipManagerHtml({
    title: "Relationship actions",
    description:
      "Link existing Workshop records using the shared relationship manager pattern and canonical operator rules.",
    actions,
    emptyText: "No Requirement relationship actions are available."
  });
}

function relationshipActionHelpText(itemType: LinkableItemType): string {
  switch (itemType) {
    case "evidence":
      return "Closes evidence gaps and strengthens the posture brief trail.";
    case "action":
      return "Adds remediation context and may change Action Impact priority.";
    case "risk":
      return "Adds risk context to the Requirement story and Connected View chain.";
    case "direction":
      return "Shows why this Requirement matters for current direction response.";
  }
}

function unlinkedExistingItemCount(
  requirementId: string,
  itemType: LinkableItemType,
  allEntities: readonly V01Entity[],
  activeLinks: readonly LinkEntity[]
): number {
  const linkType = linkTypeForExistingItem(itemType);
  const linkedIds = new Set(
    activeLinks
      .filter((link) => isExistingItemLinkForRequirement(link, requirementId, itemType, linkType))
      .map((link) => (itemType === "direction" ? link.fromId : link.toId))
  );
  return allEntities.filter(
    (entity): entity is LinkableExistingEntity =>
      entity.entityType === itemType && entity.recordStatus !== "deleted" && !linkedIds.has(entity.id)
  ).length;
}

function linkExistingCommandForItem(itemType: LinkableItemType): string {
  switch (itemType) {
    case "evidence":
      return "linkExistingEvidenceToRequirement";
    case "action":
      return "linkExistingActionToRequirement";
    case "risk":
      return "linkExistingRiskToRequirement";
    case "direction":
      return "linkExistingDirectionToRequirement";
  }
}

function existingItemDescription(entity: LinkableExistingEntity, activeLinks: readonly LinkEntity[]): string {
  const linkedRequirementCount = activeLinks.filter((link) =>
    entity.entityType === "direction"
      ? link.fromId === entity.id && link.toType === "requirement"
      : link.toId === entity.id && link.fromType === "requirement"
  ).length;
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

function isExistingItemLinkForRequirement(
  link: LinkEntity,
  requirementId: string,
  itemType: LinkableItemType,
  linkType: LinkEntity["linkType"]
): boolean {
  if (itemType === "direction") {
    return (
      link.toId === requirementId &&
      link.toType === "requirement" &&
      link.fromType === "direction" &&
      link.linkType === linkType
    );
  }
  return (
    link.fromId === requirementId &&
    link.fromType === "requirement" &&
    link.toType === itemType &&
    link.linkType === linkType
  );
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
  const requirements = (entities ?? []).filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement"
  );
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
      {
        label: "Requirements missing evidence",
        description: "Only Requirements without linked evidence",
        value: "missing-evidence"
      }
    ],
    {
      title: "Choose Requirement Set",
      placeHolder: `Narrow the list before linking ${label(itemType).toLowerCase()}`,
      ignoreFocusOut: true
    }
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
    const statuses = [...new Set(requirements.map((requirement) => requirement.assessmentStatus))].sort((left, right) =>
      label(left).localeCompare(label(right))
    );
    const pickedStatuses = await vscode.window.showQuickPick(
      statuses.map((status) => ({ label: label(status), description: status, status })),
      {
        title: "Select Assessment Statuses",
        placeHolder: "Choose one or more statuses",
        canPickMany: true,
        ignoreFocusOut: true
      }
    );
    if (!pickedStatuses || pickedStatuses.length === 0) {
      return [];
    }
    const selectedStatuses = new Set(pickedStatuses.map((status) => status.status));
    candidates = requirements.filter((requirement) => selectedStatuses.has(requirement.assessmentStatus));
  }
  if (browseMode.value === "missing-evidence") {
    const entities = await listAllEntities();
    const supportedRequirementIds = new Set(
      entities
        .filter(
          (entity): entity is LinkEntity =>
            entity.entityType === "link" &&
            entity.linkType === "supported-by" &&
            entity.fromType === "requirement" &&
            entity.toType === "evidence"
        )
        .map((link) => link.fromId)
    );
    candidates = requirements.filter((requirement) => !supportedRequirementIds.has(requirement.id));
  }

  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(`No Requirements match that ${label(itemType).toLowerCase()} filter.`);
    return [];
  }

  const recentRequirementId = getRecentRequirementId();
  const pickedRequirements = await vscode.window.showQuickPick(
    candidates.sort(compareRequirementsForPicker).map((requirement) => {
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
    {
      title: `Link ${label(itemType)} to Requirements`,
      placeHolder: `Select every Requirement this ${label(itemType).toLowerCase()} applies to`,
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  return pickedRequirements?.map((item) => item.requirement) ?? [];
}

async function requirementSelectionForScopedCommand(
  requirementId: string,
  itemType: "evidence" | "action" | "risk"
): Promise<RequirementEntity[]> {
  const requirement = (await listRequirements()).find((item) => item.id === requirementId);
  if (!requirement) {
    await vscode.window.showWarningMessage(
      `This Requirement no longer exists. Choose another Requirement before adding ${label(itemType)}.`
    );
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
  return (
    left.reference.localeCompare(right.reference, "en-AU", { sensitivity: "base", numeric: true }) ||
    left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }) ||
    left.id.localeCompare(right.id)
  );
}

async function pickOptionalRequirement(prompt: string): Promise<RequirementEntity | undefined> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "requirement");
  const requirements = (entities ?? []).filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement"
  );
  if (requirements.length === 0) {
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: "$(circle-slash) No requirement link",
        description: "Register without linking",
        requirement: undefined as RequirementEntity | undefined
      },
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
    await vscode.window.showWarningMessage(
      "No ISM source controls are loaded. Run PSPF: Initialise PSPF Workspace and try again."
    );
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    sourceControls.map((sourceControl) => ({
      label: `${sourceControl.controlId}: ${sourceControl.title}`,
      description: sourceControl.profileTags.join(", "),
      detail: `OSCAL release ${sourceControl.provenance.oscalRelease} · ${sourceControl.statement}`,
      sourceControl
    })),
    {
      title: "Select ISM Source Control",
      placeHolder: "Choose the ISM control this requirement maps to",
      ignoreFocusOut: true
    }
  );
  return picked?.sourceControl;
}

function buildValidationHints(
  requirements: readonly RequirementEntity[],
  actions: readonly ActionEntity[],
  risks: readonly RiskEntity[],
  links: readonly LinkEntity[]
): readonly {
  readonly openEntityType: "requirement";
  readonly openEntityId: string;
  readonly priority: string;
  readonly requirement: string;
  readonly hint: string;
}[] {
  const evidenceRequirementIds = new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const openActionIds = new Set(
    actions.filter((action) => !["done", "cancelled"].includes(action.status)).map((action) => action.id)
  );
  const openRiskIds = new Set(risks.filter((risk) => risk.status !== "closed").map((risk) => risk.id));
  const actionRequirementIds = new Set(
    links.filter((link) => link.linkType === "addressed-by" && openActionIds.has(link.toId)).map((link) => link.fromId)
  );
  const riskRequirementIds = new Set(
    links.filter((link) => link.linkType === "exposed-by" && openRiskIds.has(link.toId)).map((link) => link.fromId)
  );
  const rows: {
    openEntityType: "requirement";
    openEntityId: string;
    priority: string;
    requirement: string;
    hint: string;
  }[] = [];

  for (const requirement of requirements) {
    if (!evidenceRequirementIds.has(requirement.id)) {
      rows.push({
        openEntityType: "requirement",
        openEntityId: requirement.id,
        priority: "High",
        requirement: requirement.title,
        hint: "No evidence linked yet."
      });
    }
    if (
      ["in-progress", "partially-met", "not-met", "under-review"].includes(requirement.assessmentStatus) &&
      !actionRequirementIds.has(requirement.id)
    ) {
      rows.push({
        openEntityType: "requirement",
        openEntityId: requirement.id,
        priority: "Medium",
        requirement: requirement.title,
        hint: "No open action linked to this non-final assessment."
      });
    }
    if (riskRequirementIds.has(requirement.id) && !actionRequirementIds.has(requirement.id)) {
      rows.push({
        openEntityType: "requirement",
        openEntityId: requirement.id,
        priority: "Medium",
        requirement: requirement.title,
        hint: "Open risk has no linked open action."
      });
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

function commercialContextSection(
  target: RequirementEntity | ActionEntity | RiskEntity,
  allEntities: readonly V01Entity[]
): string {
  const entityById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const rows = allEntities
    .filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted")
    .filter((link) => isCommercialContextLink(link, target))
    .map((link) => commercialContextRow(entityById.get(link.fromId), link))
    .filter(
      (row): row is { relationship: string; type: string; title: string; status: string; context: string } =>
        row !== undefined
    );
  return recordTable("Commercial Context", rows, ["relationship", "type", "title", "status", "context"]);
}

function isCommercialContextLink(link: LinkEntity, target: RequirementEntity | ActionEntity | RiskEntity): boolean {
  if (target.entityType === "requirement") {
    return (
      link.toId === target.id &&
      link.linkType === "supports" &&
      (link.fromType === "supplier" || link.fromType === "contract" || link.fromType === "spend-item")
    );
  }
  if (target.entityType === "action") {
    return link.toId === target.id && link.linkType === "supports" && link.fromType === "spend-item";
  }
  return link.toId === target.id && link.linkType === "associated-with" && link.fromType === "supplier";
}

function commercialContextRow(
  entity: V01Entity | undefined,
  link: LinkEntity
): { relationship: string; type: string; title: string; status: string; context: string } | undefined {
  if (!entity || entity.recordStatus === "deleted") {
    return undefined;
  }
  if (entity.entityType === "supplier") {
    return commercialRow(
      link.linkType,
      "Supplier",
      entity.name,
      entity.status,
      `Criticality: ${label(entity.criticality)}`
    );
  }
  if (entity.entityType === "contract") {
    return commercialRow(
      link.linkType,
      "Contract",
      entity.title,
      entity.status,
      entity.endsAt ? `Ends: ${entity.endsAt}` : "No end date recorded"
    );
  }
  if (entity.entityType === "spend-item") {
    return commercialRow(
      link.linkType,
      "Spend item",
      entity.title,
      entity.status,
      `${entity.financialYear}; confidence ${label(entity.confidence ?? "not-recorded")}`
    );
  }
  return undefined;
}

function commercialRow(
  relationship: string,
  type: string,
  title: string,
  status: string,
  context: string
): { relationship: string; type: string; title: string; status: string; context: string } {
  return { relationship: label(relationship), type, title, status: label(status), context };
}

function recordTable(title: string, records: readonly object[], fields: readonly string[]): string {
  if (records.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="muted">No records linked yet.</p></section>`;
  }
  const hasOpenEntity = records.some(
    (record) =>
      typeof readRecordField(record, "openEntityId") === "string" &&
      typeof readRecordField(record, "openEntityType") === "string"
  );
  const actionHeader = hasOpenEntity ? `<th data-field="open">Open</th>` : "";
  const header = `${actionHeader}${fields.map((field) => `<th data-field="${escapeHtml(field)}">${escapeHtml(label(field))}</th>`).join("")}`;
  const rows = records
    .map(
      (record) =>
        `<tr>${hasOpenEntity ? tableOpenCell(record) : ""}${fields.map((field) => tableCell(record, field)).join("")}</tr>`
    )
    .join("");
  return `<section><h2>${escapeHtml(title)}</h2><div class="table-wrap" tabindex="0" aria-label="Scrollable ${escapeHtml(title)} table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function requirementNavigationStrip(requirement: RequirementEntity, allEntities: readonly V01Entity[]): string {
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .sort(compareRequirementsForPicker);
  const index = requirements.findIndex((candidate) => candidate.id === requirement.id);
  const position = index >= 0 ? `${index + 1} of ${requirements.length}` : "Not in current list";
  return `<div class="form-actions" aria-label="Requirement navigation">
    <button type="button" data-command="openAdjacentRequirement" data-requirement-id="${escapeHtml(requirement.id)}" data-direction="previous">Previous requirement</button>
    <button type="button" data-command="openAdjacentRequirement" data-requirement-id="${escapeHtml(requirement.id)}" data-direction="next">Next requirement</button>
    ${shellPill(position)}
  </div>`;
}

function directionNavigationStrip(direction: DirectionEntity, allEntities: readonly V01Entity[]): string {
  const directions = allEntities
    .filter(
      (entity): entity is DirectionEntity => entity.entityType === "direction" && entity.recordStatus !== "deleted"
    )
    .sort(compareDirectionsForPicker);
  const index = directions.findIndex((candidate) => candidate.id === direction.id);
  const position = index >= 0 ? `${index + 1} of ${directions.length}` : "Not in current list";
  return `<div class="form-actions" aria-label="Direction navigation">
    <button type="button" data-command="openAdjacentDirection" data-direction-id="${escapeHtml(direction.id)}" data-direction="previous">Previous Direction</button>
    <button type="button" data-command="openAdjacentDirection" data-direction-id="${escapeHtml(direction.id)}" data-direction="next">Next Direction</button>
    ${shellPill(position)}
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
  if (field === "reference" && readRecordField(record, "openEntityType") === "evidence") {
    return `<td data-field="${escapeHtml(field)}">${evidenceReferenceCell(value)}</td>`;
  }
  if (field === "explanation") {
    const fullValue = String(readRecordField(record, "explanationFull") ?? value);
    return `<td data-field="${escapeHtml(field)}" title="${escapeHtml(fullValue)}"><span class="cell-compact">${escapeHtml(value)}</span></td>`;
  }
  return `<td data-field="${escapeHtml(field)}">${escapeHtml(value)}</td>`;
}

function evidenceReferenceCell(reference: string): string {
  const trimmed = reference.trim();
  if (!trimmed || trimmed === "Not recorded") {
    return escapeHtml(reference);
  }
  return `<span class="cell-compact">${escapeHtml(trimmed)}</span> ${evidenceReferenceButton(trimmed)}`;
}

function evidenceReferenceButton(reference: string): string {
  return `<button type="button" data-command="openEvidenceReference" data-evidence-reference="${escapeHtml(reference)}">Open evidence</button>`;
}

async function openEvidenceReference(reference: string | undefined): Promise<void> {
  const trimmed = reference?.trim();
  if (!trimmed) {
    await vscode.window.showWarningMessage("No Evidence reference is recorded to open.");
    return;
  }
  const uri = evidenceReferenceUri(trimmed);
  if (!uri) {
    await vscode.window.showWarningMessage("This Evidence reference is not a URL or file path that Workshop can open.");
    return;
  }
  const opened = await vscode.env.openExternal(uri);
  if (!opened) {
    await vscode.window.showWarningMessage("Could not open the Evidence reference.");
  }
}

function evidenceReferenceUri(reference: string): vscode.Uri | undefined {
  if (/^https?:\/\//i.test(reference) || /^file:\/\//i.test(reference)) {
    return vscode.Uri.parse(reference, true);
  }
  if (reference.startsWith("/") || reference.startsWith("~")) {
    return vscode.Uri.file(reference.startsWith("~/") ? reference.replace(/^~/, process.env.HOME ?? "") : reference);
  }
  if (/^[A-Za-z]:[\\/]/.test(reference)) {
    return vscode.Uri.file(reference);
  }
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder && /[\\/]/.test(reference)) {
    return vscode.Uri.joinPath(workspaceFolder.uri, ...reference.split(/[\\/]+/).filter(Boolean));
  }
  return undefined;
}

function summariseImpactExplanation(explanation: readonly string[]): string {
  if (explanation.length <= 1) {
    return explanation[0] ?? "No linked impact signals";
  }
  return `${explanation[0]} (+${explanation.length - 1} more)`;
}

function versionStrip(): string {
  return `<div class="version-strip" aria-label="PSPF version context">${shellPill(`PSPF v${PSPF_SLICE_VERSION}`)}${shellPill(`Schema ${VERSION_AXES.schemaVersion}`)}${shellPill(`API ${VERSION_AXES.apiVersion}`)}</div>`;
}

function metricCard(label: string, value: number | string): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function directionChips(counts: Record<DirectionResponseState, number>): string {
  const order: DirectionResponseState[] = ["not-set", "yes", "no", "risk-managed"];
  return order.map((state) => shellPill(`${label(state)}: ${counts[state] ?? 0}`)).join(" ");
}

function domainName(domainId: string): string {
  return PSPF_DOMAINS.find((domain) => domain.id === domainId)?.title ?? domainId;
}

function readRecordField(record: object, field: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, field)
    ? (record as { readonly [key: string]: unknown })[field]
    : undefined;
}

function label(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

const changeRecordTypeItems: readonly { readonly label: string; readonly value: ChangeRecordType }[] =
  CHANGE_RECORD_TYPES.map((value) => ({ label: label(value), value }));

const changeRecordStatusItems: readonly { readonly label: string; readonly value: ChangeRecordStatus }[] =
  CHANGE_RECORD_STATUSES.map((value) => ({ label: label(value), value }));

const changeRecordPersistenceItems: readonly { readonly label: string; readonly value: ChangeRecordPersistence }[] =
  CHANGE_RECORD_PERSISTENCE.map((value) => ({ label: label(value), value }));

const changeRecordSourceItems: readonly { readonly label: string; readonly value: ChangeRecordSource }[] =
  CHANGE_RECORD_SOURCES.map((value) => ({ label: label(value), value }));

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

const confidenceItems: readonly {
  readonly label: string;
  readonly value: MappingConfidence;
  readonly description?: string;
  readonly picked?: boolean;
}[] = [
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

function profileItems(
  sourceControl: SourceControlEntity
): readonly { readonly label: string; readonly value: string }[] {
  return ["all", ...sourceControl.profileTags].map((profile) => ({ label: label(profile), value: profile }));
}
