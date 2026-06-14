import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import {
  buildCisoMagazineModel,
  type CisoMagazineInput,
  type CisoMagazineEdition,
  type CisoMagazineTrendPoint,
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
  normalisePlanWorkstreamId,
  PLAN_OF_ACTION_PHASES,
  type PlanOfActionBoardModel,
  type PlanOfActionPhaseModel,
  type PlanOfActionTaskModel
} from "./plan-of-action-board.js";
import {
  buildPspfGridModel,
  type PspfGridModel,
  buildHumanCentredRiskModel,
  type HumanCentredRiskModel,
  buildContinuousComplianceMetroModel,
  type ContinuousComplianceMetroModel,
  buildUnifiedSecurityOperatingModel,
  type UnifiedSecurityOperatingModel,
  buildCyberAwarenessChangeStrategyModel,
  type CyberAwarenessChangeStrategyModel,
  CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS,
  CONTINUOUS_COMPLIANCE_RISK_SEVERITIES
} from "./continuous-compliance.js";
import {
  buildPentestWorkbenchModel,
  PENTEST_FINDING_SEVERITIES,
  type PentestAssessmentModel,
  type PentestFindingModel,
  type PentestFindingQueueId,
  type PentestWorkbenchModel
} from "./pentest-workbench.js";
import {
  buildRequirementCardViewModel,
  type RequirementCardDomainGroup,
  type RequirementCardLinkRef,
  type RequirementCardModel,
  type RequirementCardViewModel
} from "./requirement-card-view.js";
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
  type SourceControlImplementationStatus,
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
  operatorLinkRuleForEndpoints,
  isAiEnabled,
  sanitiseEntityForPublication,
  PspfError,
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
import { openQuestionnaireHistory, runDomainDeepDive, runQuickstartQuestionnaire } from "./questionnaire/flow.js";
import { ISM_SOURCE_CONTROL_CATEGORIES } from "@pspf/reference-data";

// v1.33 questionnaire surface: re-run modes include the literal
// "Answer all questions again" so operators can refresh their full answer set
// on demand. The label is surfaced through questionnaire/flow.ts.
const QUESTIONNAIRE_RERUN_MODE_LABEL = "Answer all questions again";
void QUESTIONNAIRE_RERUN_MODE_LABEL;

const recentRequirementKey = "pspf.workshop.recentRequirementId";
const momentumSnapshotKey = "pspf.workshop.momentumSnapshot.v1";
const postureHistoryKey = "pspf.workshop.postureHistory.v1";
const newsletterEditorNoteKey = "pspf.workshop.newsletterEditorNote.v1";
const newsletterPostureHistoryKey = "pspf.workshop.newsletterPostureHistory.v1";
const lastSharedKey = "pspf.workshop.lastShared.v1";
const riskSourceProfileKey = "pspf.workshop.riskSourceProfile.v1";
const riskSourcePreviewKey = "pspf.workshop.riskSourcePreview.v1";
const riskSourceRunsKey = "pspf.workshop.riskSourceRuns.v1";
const riskSourceSecretKey = "pspf.workshop.6clicksRiskSource.credential";
const riskSourceConfigFile = "integrations.json";
const riskSourceSettingsSection = "pspf.workshop.riskSource";
const aiSettingsSection = "pspf.ai";
const aiContextEnabledKey = "pspf:aiEnabled";
const aiPoliciesFileName = "policies.json";
const STRATEGY_REFERENCE_ROLES = ["drives", "addresses", "blocked-by", "evidenced-by", "monitors"] as const;
const ismSourceControlCategoryByControlId = new Map<string, string>(
  ISM_SOURCE_CONTROL_CATEGORIES.map((item) => [item.controlId, item.category] as const)
);
const ismSourceControlCategoryOrder = uniqueStrings(ISM_SOURCE_CONTROL_CATEGORIES.map((item) => item.category));
let workshopContext: vscode.ExtensionContext | undefined;
let homeViewProvider: WorkshopHomeViewProvider | undefined;
type ConfigInspection<T> = {
  readonly globalValue?: T;
  readonly workspaceValue?: T;
  readonly workspaceFolderValue?: T;
};
interface WorkshopMomentumSnapshot {
  readonly capturedAt: string;
  readonly requirements: number;
  readonly evidence: number;
  readonly actions: number;
  readonly openActions: number;
  readonly risks: number;
  readonly directions: number;
  readonly metPercentage: number;
}
let momentumBaseline: WorkshopMomentumSnapshot | undefined;
interface PostureHistoryPoint {
  readonly day: string;
  readonly metPercentage: number;
}
interface NewsletterEditorNoteState {
  readonly cso?: string;
  readonly ciso?: string;
}
type NewsletterPostureHistoryState = Readonly<Record<string, readonly CisoMagazineTrendPoint[]>>;
interface WorkshopShareState {
  readonly sharedAt: string;
  readonly requirements: number;
  readonly evidence: number;
  readonly actions: number;
  readonly metPercentage: number;
  readonly artefact: string;
}
type WorkshopActionWithPlanOverride = ActionEntity & { readonly planWorkstreamId?: unknown };
let requirementWorkbenchController:
  | {
      open: (
        requirement: RequirementEntity,
        allEntities: readonly V01Entity[],
        options?: RequirementBrowserOptions
      ) => Promise<void>;
    }
  | undefined;

class WorkshopTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, iconId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

class WorkshopEntityTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, iconId: string, entity: V01Entity, contextValue: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconId);
    this.command = { command: "pspf.workshop.openTreeEntity", title: "Open detail", arguments: [entity] };
    this.contextValue = contextValue;
  }
}

abstract class WorkshopTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changedEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.changedEmitter.event;

  refresh(): void {
    this.changedEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  abstract getChildren(): Promise<vscode.TreeItem[]>;
}

class RequirementsTreeProvider extends WorkshopTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const requirements = await listRequirements();
    if (requirements.length === 0) {
      return [new WorkshopTreeItem("No requirements yet", "Use New Requirement or Load Sample Workspace", "info")];
    }
    return [...requirements]
      .sort(compareRequirementsForPicker)
      .map(
        (requirement) =>
          new WorkshopEntityTreeItem(
            requirement.title,
            `${domainName(requirement.domainId)} · ${label(requirement.assessmentStatus)}`,
            "checklist",
            requirement,
            "pspfWorkshopRequirement"
          )
      );
  }
}

class EvidenceTreeProvider extends WorkshopTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const evidence = (await listAllEntities()).filter(
      (entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.recordStatus !== "deleted"
    );
    if (evidence.length === 0) {
      return [new WorkshopTreeItem("No evidence yet", "Use Attach Evidence to start backing a requirement", "info")];
    }
    return [...evidence]
      .sort((left, right) => left.title.localeCompare(right.title, "en-AU"))
      .map(
        (item) =>
          new WorkshopEntityTreeItem(item.title, label(item.freshness), "verified", item, "pspfWorkshopEvidence")
      );
  }
}

class ActionsTreeProvider extends WorkshopTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const actions = (await listAllEntities()).filter(
      (entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted"
    );
    if (actions.length === 0) {
      return [new WorkshopTreeItem("No actions yet", "Use New Action to plan remediation work", "info")];
    }
    return [...actions]
      .sort((left, right) => left.title.localeCompare(right.title, "en-AU"))
      .map((action) => {
        const due = formatShortAuDateTime(action.dueDate);
        const detail = due ? `${label(action.status)} · due ${due}` : label(action.status);
        return new WorkshopEntityTreeItem(action.title, detail, "tasklist", action, "pspfWorkshopAction");
      });
  }
}

class RisksTreeProvider extends WorkshopTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const risks = (await listAllEntities()).filter(
      (entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted"
    );
    if (risks.length === 0) {
      return [new WorkshopTreeItem("No risks yet", "Use New Risk to capture a risk", "info")];
    }
    return [...risks]
      .sort((left, right) => right.likelihood * right.impact - left.likelihood * left.impact)
      .map(
        (risk) =>
          new WorkshopEntityTreeItem(
            risk.title,
            `${workshopRiskSeverityLabel(risk)} · ${risk.likelihood}×${risk.impact}`,
            "warning",
            risk,
            "pspfWorkshopRisk"
          )
      );
  }
}

class DirectionsTreeProvider extends WorkshopTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const directions = await listDirections();
    if (directions.length === 0) {
      return [new WorkshopTreeItem("No directions yet", "Use Register Direction to track a direction", "info")];
    }
    return [...directions]
      .sort(compareDirectionsForPicker)
      .map(
        (direction) =>
          new WorkshopEntityTreeItem(
            `${direction.reference} ${direction.title}`.trim(),
            label(direction.responseState),
            "law",
            direction,
            "pspfWorkshopDirection"
          )
      );
  }
}

function workshopRiskSeverityLabel(risk: RiskEntity): string {
  const score = risk.likelihood * risk.impact;
  if (score >= 16) {
    return "Extreme";
  }
  if (score >= 10) {
    return "High";
  }
  if (score >= 4) {
    return "Medium";
  }
  return "Low";
}

const workshopTreeProviders: WorkshopTreeProvider[] = [];

async function openTreeEntity(entity: V01Entity | undefined): Promise<void> {
  if (!entity) {
    return;
  }
  await openItemDetailForEntity(entity.entityType, entity.id);
}

export function activate(context: vscode.ExtensionContext): void {
  workshopContext = context;
  momentumBaseline = context.workspaceState.get<WorkshopMomentumSnapshot>(momentumSnapshotKey);
  homeViewProvider = new WorkshopHomeViewProvider();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusItem.text = `$(shield) PSPF v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = `PSPF Workshop ${PSPF_SLICE_VERSION}\nSchema ${VERSION_AXES.schemaVersion} · Bundle ${VERSION_AXES.bundleVersion} · API ${VERSION_AXES.apiVersion}`;
  statusItem.command = "pspf.workshop.openHome";
  statusItem.show();

  const requirementsTree = new RequirementsTreeProvider();
  const evidenceTree = new EvidenceTreeProvider();
  const actionsTree = new ActionsTreeProvider();
  const risksTree = new RisksTreeProvider();
  const directionsTree = new DirectionsTreeProvider();
  workshopTreeProviders.length = 0;
  workshopTreeProviders.push(requirementsTree, evidenceTree, actionsTree, risksTree, directionsTree);
  void refreshAiEnablementContext();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pspfWorkshop.homeView", homeViewProvider),
    statusItem,
    vscode.window.registerTreeDataProvider("pspfWorkshop.requirementsView", requirementsTree),
    vscode.window.registerTreeDataProvider("pspfWorkshop.evidenceView", evidenceTree),
    vscode.window.registerTreeDataProvider("pspfWorkshop.actionsView", actionsTree),
    vscode.window.registerTreeDataProvider("pspfWorkshop.risksView", risksTree),
    vscode.window.registerTreeDataProvider("pspfWorkshop.directionsView", directionsTree),
    vscode.commands.registerCommand("pspf.workshop.openTreeEntity", openTreeEntity),
    vscode.commands.registerCommand("pspf.workshop.openHome", openHome),
    vscode.commands.registerCommand("pspf.workshop.createRequirement", createRequirement),
    vscode.commands.registerCommand("pspf.workshop.aiDraftRequirementFromInterview", aiDraftRequirementFromInterview),
    vscode.commands.registerCommand("pspf.workshop.aiSuggestIsmMappings", aiSuggestIsmMappings),
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
    vscode.commands.registerCommand("pspf.workshop.openRiskSourceSettings", openRiskSourceSettings),
    vscode.commands.registerCommand("pspf.workshop.setRiskSourceCredential", setRiskSourceCredential),
    vscode.commands.registerCommand("pspf.workshop.testRiskSource", testRiskSource),
    vscode.commands.registerCommand("pspf.workshop.previewRiskSourceImport", previewRiskSourceImport),
    vscode.commands.registerCommand("pspf.workshop.applyRiskSourceImport", applyRiskSourceImport),
    vscode.commands.registerCommand("pspf.workshop.viewRiskSourceRuns", viewRiskSourceRuns),
    vscode.commands.registerCommand("pspf.workshop.openRequirementsList", openRequirementsList),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceList", openEvidenceList),
    vscode.commands.registerCommand("pspf.workshop.openActionsList", openActionsList),
    vscode.commands.registerCommand("pspf.workshop.openRisksList", openRisksList),
    vscode.commands.registerCommand("pspf.workshop.openDirectionsList", openDirectionsList),
    vscode.commands.registerCommand("pspf.workshop.linkExistingEvidence", linkExistingEvidence),
    vscode.commands.registerCommand("pspf.workshop.linkExistingAction", linkExistingAction),
    vscode.commands.registerCommand("pspf.workshop.linkExistingRisk", linkExistingRisk),
    vscode.commands.registerCommand("pspf.workshop.linkExistingDirection", linkExistingDirection),
    vscode.commands.registerCommand("pspf.workshop.openAssessmentDashboard", openAssessmentDashboard),
    vscode.commands.registerCommand("pspf.workshop.openMasterDashboard", openMasterDashboard),
    vscode.commands.registerCommand("pspf.workshop.openPspfGridView", openPspfGridView),
    vscode.commands.registerCommand("pspf.workshop.openHumanCentredRiskView", openHumanCentredRiskView),
    vscode.commands.registerCommand("pspf.workshop.openContinuousComplianceMetro", openContinuousComplianceMetro),
    vscode.commands.registerCommand(
      "pspf.workshop.openUnifiedSecurityOperatingModel",
      openUnifiedSecurityOperatingModel
    ),
    vscode.commands.registerCommand("pspf.workshop.openCyberAwarenessChangeStrategy", openCyberAwarenessChangeStrategy),
    vscode.commands.registerCommand("pspf.workshop.openPentestWorkbench", openPentestWorkbench),
    vscode.commands.registerCommand("pspf.workshop.openRequirementCardView", openRequirementCardView),
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
    vscode.commands.registerCommand("pspf.workshop.openIsmReviewWorkbench", openIsmReviewWorkbench),
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
    vscode.commands.registerCommand("pspf.workshop.openCsoMagazine", openCsoMagazine),
    vscode.commands.registerCommand("pspf.workshop.copyCsoMagazine", copyCsoMagazine),
    vscode.commands.registerCommand("pspf.workshop.exportCsoMagazine", exportCsoMagazine),
    vscode.commands.registerCommand("pspf.workshop.openCisoMagazine", openCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.copyCisoMagazine", copyCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.exportCisoMagazine", exportCisoMagazine),
    vscode.commands.registerCommand("pspf.workshop.openCisoMasterPlan", openCisoMasterPlan),
    vscode.commands.registerCommand("pspf.workshop.copyCisoMasterPlan", copyCisoMasterPlan),
    vscode.commands.registerCommand("pspf.workshop.runQuickstartQuestionnaire", runQuickstartQuestionnaire),
    vscode.commands.registerCommand("pspf.workshop.runDomainDeepDive", runDomainDeepDive),
    vscode.commands.registerCommand("pspf.workshop.openQuestionnaireHistory", openQuestionnaireHistory),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(aiSettingsSection)) {
        void refreshAiEnablementContext();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refreshAiEnablementContext();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isAiPolicyDocument(document.uri)) {
        void refreshAiEnablementContext();
      }
    })
  );
}

export function deactivate(): void {
  // No runtime resources to dispose yet.
}

interface WorkshopAiSettings {
  readonly enabled: boolean;
  readonly provider: "vscode-lm";
  readonly modelId: string;
}

interface WorkspaceAiPolicy {
  readonly ai?: {
    readonly disabled?: boolean;
  };
}

interface WorkshopAiContext {
  readonly settings: WorkshopAiSettings;
}

function readWorkshopAiSettings(): WorkshopAiSettings {
  const config = vscode.workspace.getConfiguration(aiSettingsSection);
  const provider = config.get<string>("provider", "vscode-lm");
  return {
    enabled: config.get<boolean>("enabled", false),
    provider: provider === "vscode-lm" ? "vscode-lm" : "vscode-lm",
    modelId: config.get<string>("modelId", "")
  };
}

async function refreshAiEnablementContext(): Promise<void> {
  const settings = readWorkshopAiSettings();
  const policyDisabled = await readWorkspaceAiPolicyDisabled();
  const providerAvailable = settings.provider === "vscode-lm" ? isVscodeLanguageModelAvailable() : false;
  const enabled = isAiEnabled({
    settingEnabled: settings.enabled,
    policyDisabled,
    capabilityInstalled: true,
    providerAvailable
  });
  await vscode.commands.executeCommand("setContext", aiContextEnabledKey, enabled);
}

function isVscodeLanguageModelAvailable(): boolean {
  return (vscode as unknown as { readonly lm?: unknown }).lm !== undefined;
}

function isAiPolicyDocument(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file") {
    return false;
  }
  const normalisedPath = uri.path.toLowerCase();
  return normalisedPath.endsWith(`/.pspf/config/${aiPoliciesFileName}`);
}

async function readWorkspaceAiPolicyDisabled(): Promise<boolean | undefined> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return true;
  }
  const policyUri = vscode.Uri.joinPath(workspaceFolder.uri, ".pspf", "config", aiPoliciesFileName);
  try {
    const bytes = await vscode.workspace.fs.readFile(policyUri);
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as WorkspaceAiPolicy;
    return raw.ai?.disabled !== false;
  } catch {
    return true;
  }
}

async function ensureAiCommandReady(): Promise<WorkshopAiContext | undefined> {
  const settings = readWorkshopAiSettings();
  const policyDisabled = await readWorkspaceAiPolicyDisabled();
  const providerAvailable = settings.provider === "vscode-lm" ? isVscodeLanguageModelAvailable() : false;
  const enabled = isAiEnabled({
    settingEnabled: settings.enabled,
    policyDisabled,
    capabilityInstalled: true,
    providerAvailable
  });
  if (!enabled) {
    await vscode.window.showWarningMessage(
      "AI assistance is disabled by settings, policy, or provider availability. Enable pspf.ai and review workspace policy."
    );
    return undefined;
  }
  return { settings };
}

async function requestAiText(prompt: string, context: WorkshopAiContext): Promise<string | undefined> {
  try {
    const lm = (
      vscode as unknown as {
        readonly lm?: {
          selectChatModels: () => Promise<readonly unknown[]>;
        };
        readonly LanguageModelChatMessage?: {
          User: (content: string) => unknown;
        };
      }
    ).lm;
    const messageFactory = (
      vscode as unknown as {
        readonly LanguageModelChatMessage?: {
          User: (content: string) => unknown;
        };
      }
    ).LanguageModelChatMessage;
    if (!lm || !messageFactory?.User) {
      throw new PspfError({
        code: "PSPF_AI_MODEL_UNAVAILABLE",
        severity: "warning",
        category: "ai",
        message: "VS Code Language Model API is unavailable in this environment.",
        retryable: true,
        recommendedAction: "Confirm Copilot model access and try again."
      });
    }

    const models = await lm.selectChatModels();
    if (!models || models.length === 0) {
      throw new PspfError({
        code: "PSPF_AI_MODEL_UNAVAILABLE",
        severity: "warning",
        category: "ai",
        message: "No chat models are available from VS Code Language Model API.",
        retryable: true,
        recommendedAction: "Sign in with a model entitlement and retry."
      });
    }

    const preferredModelId = context.settings.modelId.trim().toLowerCase();
    const model =
      models.find((candidate) => {
        if (!preferredModelId) {
          return false;
        }
        const id = String((candidate as { readonly id?: unknown }).id ?? "").toLowerCase();
        return id === preferredModelId;
      }) ?? models[0];

    const request = (
      model as {
        sendRequest: (messages: readonly unknown[]) => Promise<{ readonly text?: AsyncIterable<unknown> | string }>;
      }
    ).sendRequest;
    if (typeof request !== "function") {
      throw new PspfError({
        code: "PSPF_AI_MODEL_UNAVAILABLE",
        severity: "warning",
        category: "ai",
        message: "Selected model does not support chat requests.",
        retryable: true,
        recommendedAction: "Select a different model and retry."
      });
    }

    const response = await request([messageFactory.User(prompt)]);
    const text = await collectAiResponseText(response?.text);
    if (!text.trim()) {
      throw new PspfError({
        code: "PSPF_AI_MODEL_UNAVAILABLE",
        severity: "warning",
        category: "ai",
        message: "Model response was empty.",
        retryable: true,
        recommendedAction: "Retry with more context."
      });
    }
    return text;
  } catch (error) {
    await showAiError(error);
    return undefined;
  }
}

async function collectAiResponseText(textStream: AsyncIterable<unknown> | string | undefined): Promise<string> {
  if (typeof textStream === "string") {
    return textStream;
  }
  if (!textStream) {
    return "";
  }
  const chunks: string[] = [];
  for await (const chunk of textStream) {
    const value = (chunk as { readonly value?: unknown }).value;
    if (typeof value === "string") {
      chunks.push(value);
      continue;
    }
    if (typeof chunk === "string") {
      chunks.push(chunk);
      continue;
    }
    chunks.push(String(value ?? chunk ?? ""));
  }
  return chunks.join("");
}

function parseAiJson<T>(raw: string): T | undefined {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = typeof fenceMatch?.[1] === "string" ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(payload) as T;
  } catch {
    return undefined;
  }
}

function normaliseAssessmentStatus(value: string | undefined): AssessmentStatus {
  switch ((value ?? "").trim()) {
    case "met":
    case "in-progress":
    case "not-met":
    case "not-applicable":
      return value as AssessmentStatus;
    default:
      return "in-progress";
  }
}

function normaliseMappingConfidence(value: string | undefined): MappingConfidence {
  switch ((value ?? "").trim()) {
    case "high":
    case "medium":
    case "low":
      return value as MappingConfidence;
    default:
      return "medium";
  }
}

function rankSourceControlsForRequirement(
  requirement: RequirementEntity,
  controls: readonly SourceControlEntity[],
  limit: number
): readonly SourceControlEntity[] {
  const tokens = tokenizeRequirementHint(`${requirement.title} ${requirement.summary ?? ""}`);
  const scored = controls.map((control) => {
    const haystack = `${control.controlId} ${control.title} ${control.statement}`.toLowerCase();
    const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);
    return { control, score };
  });
  return scored
    .sort((left, right) => right.score - left.score || left.control.controlId.localeCompare(right.control.controlId))
    .slice(0, Math.max(limit, 10))
    .map((item) => item.control);
}

function tokenizeRequirementHint(input: string): readonly string[] {
  const stopWords = new Set(["the", "and", "for", "with", "that", "from", "this", "into", "under", "over"]);
  return [
    ...new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 4 && !stopWords.has(part))
    )
  ];
}

async function showAiError(error: unknown): Promise<void> {
  if (error instanceof PspfError) {
    await vscode.window.showErrorMessage(`${error.code}: ${error.message} ${error.recommendedAction}`);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  await vscode.window.showErrorMessage(`AI command failed: ${message}`);
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
    for (const provider of workshopTreeProviders) {
      provider.refresh();
    }
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
      "pspf.core.resetWorkspace",
      "pspf.core.validateWorkspace",
      "pspf.core.verifyIntegrity",
      "pspf.core.runIntegrityScan",
      "pspf.core.runDatasetDiagnostics",
      "pspf.core.createSnapshot",
      "pspf.core.exportBundle",
      "pspf.workshop.importBundle",
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
      "pspf.workshop.openRiskSourceSettings",
      "pspf.workshop.setRiskSourceCredential",
      "pspf.workshop.testRiskSource",
      "pspf.workshop.previewRiskSourceImport",
      "pspf.workshop.applyRiskSourceImport",
      "pspf.workshop.viewRiskSourceRuns",
      "pspf.workshop.openRequirementsList",
      "pspf.workshop.openEvidenceList",
      "pspf.workshop.openActionsList",
      "pspf.workshop.openRisksList",
      "pspf.workshop.openDirectionsList",
      "pspf.workshop.openAssessmentDashboard",
      "pspf.workshop.openMasterDashboard",
      "pspf.workshop.openPspfGridView",
      "pspf.workshop.openHumanCentredRiskView",
      "pspf.workshop.openContinuousComplianceMetro",
      "pspf.workshop.openUnifiedSecurityOperatingModel",
      "pspf.workshop.openCyberAwarenessChangeStrategy",
      "pspf.workshop.openPentestWorkbench",
      "pspf.workshop.openRequirementCardView",
      "pspf.workshop.openEssentialEightDashboard",
      "pspf.workshop.openPlanOfActionBoard",
      "pspf.workshop.openConnectedView",
      "pspf.workshop.openStrategyMap",
      "pspf.workshop.editStrategySummary",
      "pspf.workshop.createRoadmapInitiativePlan",
      "pspf.workshop.openEvidenceReviewQueue",
      "pspf.workshop.openItemDetail",
      "pspf.workshop.openIsmReviewWorkbench",
      "pspf.workshop.browseIsmSourceControls",
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
      "pspf.workshop.openCsoMagazine",
      "pspf.workshop.copyCsoMagazine",
      "pspf.workshop.exportCsoMagazine",
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
  readonly metPercentage: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly momentum: string | undefined;
  readonly trend: readonly PostureHistoryPoint[];
  readonly shareNudge: string | undefined;
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

  const applicableRequirements = requirements.filter((requirement) => !isNotApplicableRequirement(requirement));
  const metRequirements = applicableRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
  const metPercentage =
    applicableRequirements.length === 0 ? 0 : Math.round((metRequirements / applicableRequirements.length) * 100);
  const openActions = actions.filter((action) => action.status !== "done" && action.status !== "cancelled").length;

  const currentSnapshot: WorkshopMomentumSnapshot = {
    capturedAt: new Date().toISOString(),
    requirements: requirements.length,
    evidence: evidence.length,
    actions: actions.length,
    openActions,
    risks: risks.length,
    directions: directions.length,
    metPercentage
  };
  const momentum = describeMomentum(momentumBaseline, currentSnapshot);
  void workshopContext?.workspaceState.update(momentumSnapshotKey, currentSnapshot);
  const trend = recordPostureHistory(metPercentage);
  const shareNudge = describeShareNudge(
    workshopContext?.workspaceState.get<WorkshopShareState>(lastSharedKey),
    currentSnapshot
  );

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
    recentRequirementTitle: recentRequirement?.title ?? "None selected yet",
    metPercentage,
    statusCounts: requirements.reduce<Record<string, number>>((counts, requirement) => {
      counts[requirement.assessmentStatus] = (counts[requirement.assessmentStatus] ?? 0) + 1;
      return counts;
    }, {}),
    momentum,
    trend,
    shareNudge
  };
}

function renderWorkshopStatusDonut(model: WorkshopHomeModel): string {
  const met = model.statusCounts.met ?? 0;
  const inProgress = model.statusCounts["in-progress"] ?? 0;
  const notMet = model.statusCounts["not-met"] ?? 0;
  const notApplicable = model.statusCounts["not-applicable"] ?? 0;
  const total = Math.max(1, met + inProgress + notMet + notApplicable);
  const metEnd = Math.round((met / total) * 100);
  const inProgressEnd = metEnd + Math.round((inProgress / total) * 100);
  const notMetEnd = inProgressEnd + Math.round((notMet / total) * 100);
  return `<div class="workshop-status-donut" aria-label="Workshop status distribution">
    <div class="workshop-status-donut__chart" role="img" aria-label="${met} met, ${inProgress} in progress, ${notMet} not met, ${notApplicable} not applicable" style="--met-end: ${metEnd}%; --progress-end: ${inProgressEnd}%; --not-met-end: ${notMetEnd}%;">
      <strong>${model.metPercentage}%</strong>
      <span>met</span>
    </div>
    <div class="workshop-status-donut__legend">
      <span><i data-status="met"></i>${met} met</span>
      <span><i data-status="in-progress"></i>${inProgress} in progress</span>
      <span><i data-status="not-met"></i>${notMet} not met</span>
      <span><i data-status="not-applicable"></i>${notApplicable} N/A</span>
    </div>
  </div>`;
}

function recordPostureHistory(metPercentage: number): readonly PostureHistoryPoint[] {
  const day = new Date().toISOString().slice(0, 10);
  const existing = workshopContext?.workspaceState.get<readonly PostureHistoryPoint[]>(postureHistoryKey) ?? [];
  const withoutToday = existing.filter((point) => point.day !== day);
  const updated = [...withoutToday, { day, metPercentage }].slice(-30);
  void workshopContext?.workspaceState.update(postureHistoryKey, updated);
  return updated;
}

function renderPostureSparkline(trend: readonly PostureHistoryPoint[]): string {
  if (trend.length < 2) {
    return "";
  }
  const width = 160;
  const height = 32;
  const padding = 2;
  const values = trend.map((point) => point.metPercentage);
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = (width - padding * 2) / (trend.length - 1);
  const points = trend
    .map((point, index) => {
      const x = padding + index * stepX;
      const y = padding + (height - padding * 2) * (1 - (point.metPercentage - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastValue = values[values.length - 1] ?? 0;
  const firstValue = values[0] ?? 0;
  const direction = lastValue > firstValue ? "rising" : lastValue < firstValue ? "easing" : "steady";
  return `<div class="sparkline" title="Posture trend over the last ${trend.length} working days">
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Posture trend ${direction}, now ${lastValue}% met">
      <polyline fill="none" stroke="var(--workshop-blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    </svg>
    <span class="sparkline-caption">${firstValue}% → ${lastValue}% met · ${direction}</span>
  </div>`;
}

function describeMomentum(
  baseline: WorkshopMomentumSnapshot | undefined,
  current: WorkshopMomentumSnapshot
): string | undefined {
  if (!baseline) {
    return undefined;
  }
  const parts: string[] = [];
  const evidenceDelta = current.evidence - baseline.evidence;
  if (evidenceDelta > 0) {
    parts.push(`${evidenceDelta} new evidence record${evidenceDelta === 1 ? "" : "s"}`);
  }
  const requirementDelta = current.requirements - baseline.requirements;
  if (requirementDelta > 0) {
    parts.push(`${requirementDelta} new requirement${requirementDelta === 1 ? "" : "s"}`);
  }
  const closedActions = baseline.openActions - current.openActions;
  if (closedActions > 0) {
    parts.push(`${closedActions} action${closedActions === 1 ? "" : "s"} closed`);
  }
  const postureDelta = current.metPercentage - baseline.metPercentage;
  if (postureDelta !== 0) {
    parts.push(`posture ${baseline.metPercentage}% → ${current.metPercentage}%`);
  }
  if (parts.length === 0) {
    return undefined;
  }
  return `Since you were last here: ${parts.join(" · ")}.`;
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
    <style>
      .workshop-status-donut { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; }
      .workshop-status-donut__chart { width: 116px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; align-content: center; background: conic-gradient(#047857 0 var(--met-end), #1d4ed8 var(--met-end) var(--progress-end), #b42318 var(--progress-end) var(--not-met-end), #64748b var(--not-met-end) 100%); box-shadow: inset 0 0 0 18px var(--vscode-sideBar-background), 0 0 0 1px var(--pspf-border); }
      .workshop-status-donut__chart strong { font-size: 24px; line-height: 1; }
      .workshop-status-donut__chart span { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
      .workshop-status-donut__legend { display: grid; gap: 5px; color: var(--vscode-descriptionForeground); font-size: 12px; }
      .workshop-status-donut__legend span { display: inline-flex; gap: 6px; align-items: center; }
      .workshop-status-donut__legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
      .workshop-status-donut__legend i[data-status="met"] { background: #047857; }
      .workshop-status-donut__legend i[data-status="in-progress"] { background: #1d4ed8; }
      .workshop-status-donut__legend i[data-status="not-met"] { background: #b42318; }
      .workshop-status-donut__legend i[data-status="not-applicable"] { background: #64748b; }
    </style>
    <section class="hero-section">
      <p class="eyebrow">System of record</p>
      <h2>PSPF Workshop</h2>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · ${model.metPercentage}% met</p>
      ${model.momentum ? `<p class="momentum">${escapeHtml(model.momentum)}</p>` : ""}
      ${renderPostureSparkline(model.trend)}
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
      <h2>Status Distribution</h2>
      ${renderWorkshopStatusDonut(model)}
    </section>
    <section>
      <h2>Where to focus next</h2>
      ${
        model.missingEvidence + model.evidenceReview + model.urgentActions + model.directionsNeedingResponse === 0
          ? `<p class="muted">All clear right now — nothing waiting on you. A good moment to review posture or capture new evidence.</p>`
          : `<div class="grid">
        ${metricCard("Missing evidence", model.missingEvidence)}
        ${metricCard("Evidence to refresh", model.evidenceReview)}
        ${metricCard("Urgent actions", model.urgentActions)}
        ${metricCard("Directions not set", model.directionsNeedingResponse)}
      </div>`
      }
      <p class="muted">Recent requirement: ${escapeHtml(model.recentRequirementTitle)}</p>
      <div class="action-list">
        ${homeButton("pspf.workshop.openMasterDashboard", "Dashboard", "Open essentials, controls, requirements and planning tools")}
        ${homeButton("pspf.workshop.openAssessmentDashboard", "Assessment", "Open domain posture and Requirements needing action")}
      </div>
    </section>
    <section>
      <h2>Create</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.createRequirement", "Create requirement")}
        ${homeButton("pspf.workshop.attachEvidence", "Add evidence")}
        ${homeButton("pspf.workshop.createAction", "Create action")}
        ${homeButton("pspf.workshop.createRisk", "Create risk")}
        ${homeButton("pspf.workshop.registerDirection", "Create direction")}
      </div>
    </section>
    <section>
      <h2>Edit</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.openRequirementsList", "Edit requirements")}
        ${homeButton("pspf.workshop.openEvidenceList", "Edit evidence")}
        ${homeButton("pspf.workshop.openActionsList", "Edit actions")}
        ${homeButton("pspf.workshop.openRisksList", "Edit risks")}
        ${homeButton("pspf.workshop.openDirectionsList", "Edit directions")}
      </div>
    </section>
    <section>
      <h2>Check And Share</h2>
      ${model.shareNudge ? `<p class="momentum">${escapeHtml(model.shareNudge)}</p>` : ""}
      <div class="action-list compact">
        ${homeButton("pspf.core.exportBundle", "Export bundle")}
        ${homeButton("pspf.workshop.importBundle", "Import bundle")}
        ${homeButton("pspf.workshop.copyPostureBrief", "Copy brief")}
      </div>
    </section>
    <section>
      <h2>Panel</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.home.refresh", "Refresh")}
      </div>
    </section>
    <section>
      <h2>Integrations</h2>
      <div class="action-list compact">
        ${homeButton("pspf.workshop.previewRiskSourceImport", "Run integrations", "Fetch configured risk-source changes and prepare updates")}
      </div>
    </section>
    <section>
      <h2>Maintenance</h2>
      <div class="action-list compact">
        ${homeButton("pspf.core.validateWorkspace", "Validate workspace")}
        ${homeButton("pspf.core.runDatasetDiagnostics", "Dataset diagnostics")}
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
  if (variant === "home") {
    await openMasterDashboard();
    return;
  }
  const action = await vscode.window.showInformationMessage(
    `PSPF enterprise sample workspace loaded: ${entities.length} record(s).`,
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

async function aiDraftRequirementFromInterview(): Promise<void> {
  await ensureCoreReady();
  const aiContext = await ensureAiCommandReady();
  if (!aiContext) {
    return;
  }

  const domain = await vscode.window.showQuickPick(
    PSPF_DOMAINS.map((item) => ({ label: item.title, description: item.code, domainId: item.id })),
    { title: "AI Requirement Draft", placeHolder: "Choose PSPF domain", ignoreFocusOut: true }
  );
  if (!domain) {
    return;
  }

  const objective = await vscode.window.showInputBox({
    title: "AI Requirement Draft",
    prompt: "Public-safe outcome only. Do not include names, secrets, sensitive systems, or incident details.",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter the intended outcome." : undefined)
  });
  if (!objective) {
    return;
  }

  const currentState = await vscode.window.showInputBox({
    title: "AI Requirement Draft",
    prompt: "Public-safe current state or control maturity. Keep sensitive detail out of the AI prompt.",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter the current state." : undefined)
  });
  if (!currentState) {
    return;
  }

  const gap = await vscode.window.showInputBox({
    title: "AI Requirement Draft",
    prompt: "Public-safe primary gap or risk to close. Use roles/categories instead of people or systems.",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter the primary gap." : undefined)
  });
  if (!gap) {
    return;
  }

  const evidenceCue = await vscode.window.showInputBox({
    title: "AI Requirement Draft",
    prompt: "Optional public-safe evidence cue (document/process/source). Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (evidenceCue === undefined) {
    return;
  }

  const interviewPayload = {
    domain: domain.label,
    objective: objective.trim(),
    currentState: currentState.trim(),
    gap: gap.trim(),
    evidenceCue: evidenceCue.trim()
  };

  const prompt = [
    "Draft a PSPF requirement proposal from this interview payload.",
    "Return strict JSON only with keys: title, summary, assessmentStatus, reasoning.",
    "assessmentStatus must be one of: met, in-progress, not-met, not-applicable.",
    "Use concise Australian-English writing and no markdown.",
    JSON.stringify(interviewPayload)
  ].join("\n\n");

  const aiText = await requestAiText(prompt, aiContext);
  if (!aiText) {
    return;
  }

  const parsed = parseAiJson<{ title?: string; summary?: string; assessmentStatus?: string; reasoning?: string }>(
    aiText
  );
  if (!parsed) {
    await vscode.window.showWarningMessage("AI returned an unreadable draft. Please try again.");
    return;
  }

  const suggestedTitle = (parsed.title ?? "").trim() || objective.trim();
  const suggestedSummary = (parsed.summary ?? "").trim() || `${currentState.trim()} Gap: ${gap.trim()}`;
  const suggestedStatus = normaliseAssessmentStatus(parsed.assessmentStatus);

  const title = await vscode.window.showInputBox({
    title: "Review AI Requirement Draft",
    prompt: "Requirement title",
    value: suggestedTitle,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter a requirement title." : undefined)
  });
  if (!title) {
    return;
  }

  const assessmentStatus = await vscode.window.showQuickPick(
    assessmentStatusItems.map((item) => ({ ...item, picked: item.value === suggestedStatus })),
    { title: "Review AI Requirement Draft", placeHolder: "Assessment status", ignoreFocusOut: true }
  );
  if (!assessmentStatus) {
    return;
  }

  const summary = await vscode.window.showInputBox({
    title: "Review AI Requirement Draft",
    prompt: "Internal summary, not published by default",
    value: suggestedSummary,
    ignoreFocusOut: true
  });
  if (summary === undefined) {
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    "Create this AI-drafted requirement now?",
    { modal: true },
    "Create",
    "Cancel"
  );
  if (confirm !== "Create") {
    return;
  }

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: title.trim(),
      domainId: domain.domainId,
      assessmentStatus: assessmentStatus.value,
      summary: summary.trim() || undefined
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", requirement);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(
    `AI draft accepted and created: ${requirement.title}`,
    "Open Item Detail"
  );
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function aiSuggestIsmMappings(): Promise<void> {
  await ensureCoreReady();
  const aiContext = await ensureAiCommandReady();
  if (!aiContext) {
    return;
  }

  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const sourceControls = await listSourceControls();
  if (sourceControls.length === 0) {
    await vscode.window.showWarningMessage("No ISM source controls are loaded.");
    return;
  }

  const requirementPublic = sanitiseEntityForPublication(requirement) as RequirementEntity;
  const candidates = rankSourceControlsForRequirement(requirement, sourceControls, 80);
  const candidateLines = candidates
    .map((sourceControl) => `${sourceControl.controlId} | ${sourceControl.title}`)
    .join("\n");

  const prompt = [
    "Suggest ISM controls for this PSPF requirement.",
    "Return strict JSON only with key suggestions containing up to 5 items.",
    "Each suggestion item keys: controlId, confidence (high|medium|low), rationale.",
    "Only choose controlId values from the provided candidate list.",
    "Requirement:",
    JSON.stringify(requirementPublic),
    "Candidate controls:",
    candidateLines
  ].join("\n\n");

  const aiText = await requestAiText(prompt, aiContext);
  if (!aiText) {
    return;
  }

  const parsed = parseAiJson<{ suggestions?: Array<{ controlId?: string; confidence?: string; rationale?: string }> }>(
    aiText
  );
  if (!parsed?.suggestions?.length) {
    await vscode.window.showWarningMessage("AI did not return mapping suggestions.");
    return;
  }

  const candidateByControlId = new Map(candidates.map((control) => [control.controlId, control] as const));
  const validSuggestions = parsed.suggestions
    .map((suggestion) => {
      const controlId = (suggestion.controlId ?? "").trim();
      const sourceControl = candidateByControlId.get(controlId);
      if (!sourceControl) {
        return undefined;
      }
      return {
        sourceControl,
        confidence: normaliseMappingConfidence(suggestion.confidence),
        rationale: (suggestion.rationale ?? "").trim()
      };
    })
    .filter((item): item is { sourceControl: SourceControlEntity; confidence: MappingConfidence; rationale: string } =>
      Boolean(item)
    );

  if (validSuggestions.length === 0) {
    await vscode.window.showWarningMessage("AI returned suggestions outside the candidate set.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    validSuggestions.map((suggestion) => ({
      label: `${suggestion.sourceControl.controlId}: ${suggestion.sourceControl.title}`,
      description: `${label(suggestion.confidence)} confidence`,
      detail: suggestion.rationale || "No rationale provided.",
      picked: suggestion.confidence !== "low",
      suggestion
    })),
    {
      title: `AI suggestions for ${requirement.title}`,
      placeHolder: "Select mappings to create as drafts",
      canPickMany: true,
      ignoreFocusOut: true
    }
  );

  if (!picked || picked.length === 0) {
    return;
  }

  const existingMappings = (await listAllEntities()).filter(
    (entity): entity is RequirementControlMappingEntity =>
      entity.entityType === "requirement-control-mapping" &&
      entity.recordStatus !== "deleted" &&
      entity.requirementId === requirement.id
  );
  const existingControlIds = new Set(existingMappings.map((mapping) => mapping.sourceControlId));
  const toCreate = picked.filter((item) => !existingControlIds.has(item.suggestion.sourceControl.id));
  const duplicates = picked.length - toCreate.length;

  if (toCreate.length === 0) {
    await vscode.window.showInformationMessage("All selected suggestions already have mappings for this requirement.");
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Create ${toCreate.length} AI-suggested mapping draft(s)?${duplicates > 0 ? ` ${duplicates} duplicate(s) will be skipped.` : ""}`,
    { modal: true },
    "Create mappings",
    "Cancel"
  );
  if (confirm !== "Create mappings") {
    return;
  }

  const now = new Date().toISOString();
  const mappings = toCreate.map((item) => {
    const sourceControl = item.suggestion.sourceControl;
    const profile = profileItems(sourceControl)[0]?.value ?? "all";
    return withEnvelope(
      "requirement-control-mapping",
      {
        entityType: "requirement-control-mapping",
        title: `${requirement.title} mapped to ${sourceControl.controlId}`,
        requirementId: requirement.id,
        sourceControlId: sourceControl.id,
        coverageQualifier: "partial",
        applicabilityProfile: profile,
        confidence: item.suggestion.confidence,
        lastReviewedAt: now,
        reviewBy: "AI-assisted draft",
        rationale: item.suggestion.rationale || "AI-assisted draft suggestion pending operator review.",
        provenance: {
          author: "workshop",
          createdAt: now,
          oscalRelease: sourceControl.provenance.oscalRelease
        }
      },
      "workshop"
    );
  });

  await vscode.commands.executeCommand("pspf.core.upsertEntities", mappings);
  await refreshWorkshopSurfaces();
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(
    `Created ${mappings.length} AI-assisted mapping draft(s).`,
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
  const linkContext = await collectEvidenceLinkContext();
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
        toType: "evidence",
        ...linkContext
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
  await openIntegrationSettingsPanel();
}

async function openIntegrationSettingsPanel(): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "pspfIntegrationSettings",
    "PSPF Integration Settings",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = await renderIntegrationSettingsPanel();
  });
  panel.webview.html = await renderIntegrationSettingsPanel();
}

async function openRiskSourceSettings(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:tobyharvey.pspf-workshop riskSource");
}

async function setRiskSourceCredential(): Promise<void> {
  const context = requireWorkshopContext();
  const authMode = readRiskSourceSettingsAuthMode() ?? readRiskSourceProfile()?.authMode;
  const secret = await vscode.window.showInputBox({
    title: "Set 6clicks Risk Source Credential",
    prompt: authMode === "bearer-token" ? "Bearer token" : "API key",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Enter the credential value." : undefined)
  });
  if (!secret) {
    return;
  }
  await context.secrets.store(riskSourceSecretKey, secret.trim());
  await vscode.window.showInformationMessage("6clicks risk source credential saved in VS Code SecretStorage.");
}

async function testRiskSource(): Promise<void> {
  const profile = ensureRiskSourceProfile();
  try {
    await writeRiskSourceConfig(profile);
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
    await writeRiskSourceConfig(profile);
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
  const settingsProfile = readRiskSourceSettingsProfile();
  if (settingsProfile) {
    return settingsProfile;
  }
  const profile = workshopContext?.workspaceState.get<RiskSourceProfile>(riskSourceProfileKey);
  return profile ? normaliseRiskSourceProfile(profile) : undefined;
}

function readRiskSourceSettingsProfile(): RiskSourceProfile | undefined {
  const config = vscode.workspace.getConfiguration(riskSourceSettingsSection);
  const keys = ["sourceMode", "baseUrl", "endpointPath", "authMode", "apiKeyHeaderName", "timeoutMs"] as const;
  const hasSettingsOverride = keys.some((key) => hasConfiguredSetting(config.inspect(key)));
  if (!hasSettingsOverride) {
    return undefined;
  }
  const sourceMode = config.get<RiskSourceMode>("sourceMode") ?? "fixture";
  const authMode = readRiskSourceSettingsAuthMode();
  return normaliseRiskSourceProfile({
    source: "6clicks",
    sourceLabel: "6clicks",
    sourceMode,
    fixtureName: sourceMode === "fixture" ? "6clicks-risk-v1" : undefined,
    baseUrl: trimOptional(config.get<string>("baseUrl") ?? ""),
    endpointPath: (config.get<string>("endpointPath") ?? "/api/v1/risks").trim(),
    authMode: sourceMode === "live" ? authMode : undefined,
    apiKeyHeaderName:
      authMode === "api-key-header" ? (config.get<string>("apiKeyHeaderName") ?? "x-api-key").trim() : undefined,
    secretRef: sourceMode === "live" ? riskSourceSecretKey : undefined,
    mappingVersion: "6clicks-risk-v1",
    applyPolicy: "safe-update",
    timeoutMs: config.get<number>("timeoutMs") ?? 15_000,
    updatedAt: "VS Code settings"
  });
}

function readRiskSourceSettingsAuthMode(): RiskSourceAuthMode | undefined {
  const value = vscode.workspace
    .getConfiguration(riskSourceSettingsSection)
    .get<RiskSourceMetadataAuthMode>("authMode");
  return value === "api-key-header" || value === "bearer-token" ? value : undefined;
}

function hasConfiguredSetting<T>(inspection: ConfigInspection<T> | undefined): boolean {
  return Boolean(
    inspection &&
    (inspection.globalValue !== undefined ||
      inspection.workspaceValue !== undefined ||
      inspection.workspaceFolderValue !== undefined)
  );
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

async function renderIntegrationSettingsPanel(): Promise<string> {
  const profile = readRiskSourceProfile();
  const diagnostics = profile ? validateRiskSourceProfile(profile) : ["No 6clicks risk source profile configured."];
  const readiness = diagnostics.length === 0 ? "Ready" : "Needs attention";
  const settingsRows = [
    {
      setting: "Source mode",
      value: profile ? label(profile.sourceMode) : "Not configured"
    },
    {
      setting: "Endpoint",
      value: profile?.baseUrl ? `${profile.baseUrl}${profile.endpointPath}` : "Fixture records"
    },
    {
      setting: "Authentication",
      value: profile?.authMode ?? (profile?.sourceMode === "fixture" ? "Not required" : "Not configured")
    },
    {
      setting: "API key header",
      value: profile?.apiKeyHeaderName ?? "Not required"
    },
    {
      setting: "Timeout",
      value: `${profile?.timeoutMs ?? 15_000} ms`
    },
    {
      setting: "Credential",
      value: profile?.sourceMode === "live" ? "Stored in VS Code SecretStorage" : "Not required for fixture mode"
    },
    {
      setting: "Mirrored config",
      value: riskSourceConfigDisplayPath()
    }
  ];
  const commandRows = [
    { command: "Open VS Code settings", purpose: "Edit non-secret source mode, endpoint, auth and timeout values" },
    { command: "Set credential", purpose: "Store the live API key or bearer token in VS Code SecretStorage" },
    { command: "Test connection", purpose: "Confirm the configured source can be read before using it" },
    { command: "Run preview", purpose: "Fetch configured risks and stage local changes for review" },
    { command: "Apply selected", purpose: "Apply reviewed preview changes after explicit confirmation" },
    { command: "Open Risk Source panel", purpose: "Review source profile, preview decisions and run history" }
  ];
  return shellHtml(
    "PSPF Integration Settings",
    `
    <section>
      <p class="eyebrow">Workshop settings</p>
      <h1>Integration Setup</h1>
      <p class="muted">Configure, test and use the 6clicks risk-source integration from one place. Non-secret settings stay in VS Code settings; live credentials stay in VS Code SecretStorage.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Readiness", readiness)}
        ${metricCard("Source mode", profile ? label(profile.sourceMode) : "Not configured")}
        ${metricCard("Diagnostics", diagnostics.length)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openRiskSourceSettings">Open VS Code settings</button>
        <button type="button" data-command="pspf.workshop.setRiskSourceCredential">Set credential</button>
        <button type="button" data-command="pspf.workshop.testRiskSource">Test connection</button>
        <button type="button" data-command="pspf.workshop.previewRiskSourceImport">Run preview</button>
        <button type="button" data-command="pspf.workshop.applyRiskSourceImport">Apply selected</button>
        <button type="button" data-command="pspf.workshop.openRiskSourcePanel">Open Risk Source panel</button>
        <button type="button" data-command="refresh">Refresh</button>
      </div>
    </section>
    ${recordTable("Current Settings", settingsRows, ["setting", "value"])}
    ${recordTable("Available Commands", commandRows, ["command", "purpose"])}
    ${recordTable(
      "Readiness Checks",
      diagnostics.map((diagnostic) => ({ check: diagnostic })),
      ["check"]
    )}
  `
  );
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
        <button type="button" data-command="pspf.workshop.configureRiskSource">Open integration settings</button>
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
    const statusCounts = dashboardRequirementStatusCounts(domainRequirements);
    return {
      domainId: domain.id,
      domain: domain.title,
      requirements: domainRequirements.length,
      applicable: applicableRequirements.length,
      met: statusCounts.met,
      partiallyMet: statusCounts["partially-met"],
      inProgress: statusCounts["in-progress"],
      notMet: statusCounts["not-met"],
      notStarted: statusCounts["not-started"],
      underReview: statusCounts["under-review"],
      notApplicable: statusCounts["not-applicable"],
      evidenceGaps: applicableRequirements.filter((requirement) => !evidenceRequirementIds.has(requirement.id)).length,
      metPercent:
        applicableRequirements.length === 0 ? 0 : Math.round((statusCounts.met / applicableRequirements.length) * 100)
    };
  });
  const attentionRequirements = requirements
    .filter((requirement) => requirementNeedsAttention(requirement, evidenceRequirementIds))
    .sort(compareAttentionRequirements(evidenceRequirementIds))
    .slice(0, 16)
    .map((requirement) => ({
      openEntityType: "requirement" as const,
      openEntityId: requirement.id,
      title: requirement.title,
      domainId: requirement.domainId,
      domain: domainName(requirement.domainId),
      status: label(requirement.assessmentStatus),
      evidence: evidenceRequirementIds.has(requirement.id) ? "Linked" : "Missing",
      nextStep: requirementAttentionNextStep(requirement, evidenceRequirementIds)
    }));
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
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openRequirementsList">Open Requirements list</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Open Plan of Action</button>
        <button type="button" data-command="pspf.workshop.createRequirement">Create requirement</button>
      </div>
    </section>
    ${domainStatsWidget(domainRows, attentionRequirements)}
    ${recordTable("Validation Hints", validationHints, ["priority", "requirement", "hint"])}
    ${recordTable("Domain Summary", domainRows, ["domain", "requirements", "applicable", "met", "partiallyMet", "inProgress", "notMet", "notStarted", "underReview", "notApplicable", "evidenceGaps", "metPercent"])}
    ${recordTable("Action Impact — Top 5", actionImpactRows, ["title", "status", "urgency", "total", "postureUplift", "evidenceUplift", "riskReduction", "directionUplift", "explanation"])}
    ${recordTable("Directions", directionRows, ["reference", "title", "responseState", "sourceAuthority", "issuedAt"])}
    ${recordTable("Next Requirements To Review", nextRequirements, ["title", "domain", "status", "evidence"])}
    ${recordTable("Latest Activity", recentActivity, ["type", "title", "created"])}
  `
  );
}

type DashboardDomainStatusRow = {
  readonly domainId: string;
  readonly domain: string;
  readonly requirements: number;
  readonly applicable: number;
  readonly met: number;
  readonly partiallyMet: number;
  readonly inProgress: number;
  readonly notMet: number;
  readonly notStarted: number;
  readonly underReview: number;
  readonly notApplicable: number;
  readonly evidenceGaps: number;
  readonly metPercent: number;
};

type DashboardAttentionRequirementRow = {
  readonly openEntityType: "requirement";
  readonly openEntityId: string;
  readonly title: string;
  readonly domainId: string;
  readonly domain: string;
  readonly status: string;
  readonly evidence: string;
  readonly nextStep: string;
};

function dashboardRequirementStatusCounts(
  requirements: readonly RequirementEntity[]
): Record<AssessmentStatus, number> {
  return {
    met: requirements.filter((requirement) => requirement.assessmentStatus === "met").length,
    "partially-met": requirements.filter((requirement) => requirement.assessmentStatus === "partially-met").length,
    "in-progress": requirements.filter((requirement) => requirement.assessmentStatus === "in-progress").length,
    "not-met": requirements.filter((requirement) => requirement.assessmentStatus === "not-met").length,
    "not-started": requirements.filter((requirement) => requirement.assessmentStatus === "not-started").length,
    "under-review": requirements.filter((requirement) => requirement.assessmentStatus === "under-review").length,
    "not-applicable": requirements.filter((requirement) => requirement.assessmentStatus === "not-applicable").length
  };
}

function requirementNeedsAttention(
  requirement: RequirementEntity,
  evidenceRequirementIds: ReadonlySet<string>
): boolean {
  return (
    !isNotApplicableRequirement(requirement) &&
    (requirement.assessmentStatus !== "met" || !evidenceRequirementIds.has(requirement.id))
  );
}

function requirementAttentionNextStep(
  requirement: RequirementEntity,
  evidenceRequirementIds: ReadonlySet<string>
): string {
  if (!evidenceRequirementIds.has(requirement.id)) {
    return "Attach or link evidence";
  }
  if (requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met") {
    return "Create or update an action";
  }
  if (requirement.assessmentStatus === "in-progress" || requirement.assessmentStatus === "under-review") {
    return "Confirm progress and close gaps";
  }
  return "Start assessment work";
}

function compareAttentionRequirements(evidenceRequirementIds: ReadonlySet<string>) {
  const statusRank: Record<AssessmentStatus, number> = {
    "not-met": 0,
    "partially-met": 1,
    "not-started": 2,
    "in-progress": 3,
    "under-review": 4,
    met: 5,
    "not-applicable": 6
  };
  return (left: RequirementEntity, right: RequirementEntity): number => {
    const leftHasEvidence = evidenceRequirementIds.has(left.id) ? 1 : 0;
    const rightHasEvidence = evidenceRequirementIds.has(right.id) ? 1 : 0;
    return (
      leftHasEvidence - rightHasEvidence ||
      statusRank[left.assessmentStatus] - statusRank[right.assessmentStatus] ||
      left.title.localeCompare(right.title, "en-AU", { numeric: true, sensitivity: "base" })
    );
  };
}

function domainStatsWidget(
  rows: readonly DashboardDomainStatusRow[],
  attentionRows: readonly DashboardAttentionRequirementRow[]
): string {
  const totals = aggregateDomainStats(rows);
  const filters = rows
    .map(
      (row) =>
        `<button type="button" data-domain-stat-filter="${escapeHtml(row.domainId)}" aria-pressed="false">${escapeHtml(row.domain)} <span>${row.requirements}</span></button>`
    )
    .join("");
  const rowHtml = rows.map(domainStatsTableRow).join("");
  const attentionHtml = attentionRows.map(domainStatsAttentionTableRow).join("");
  return `<section class="domain-stats" data-domain-stats-widget>
    <style>
      .domain-stats { display: grid; gap: 12px; }
      .domain-stats__filters { display: flex; flex-wrap: wrap; gap: 8px; }
      .domain-stats__filters button { display: inline-flex; align-items: center; gap: 6px; width: auto; min-width: 0; }
      .domain-stats__filters button[aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 14%, var(--surface-strong)); }
      .domain-stats__filters span { color: var(--muted); font-size: 12px; }
      .domain-stats__summary { display: grid; grid-template-columns: minmax(220px, .7fr) minmax(260px, 1.3fr); gap: 12px; align-items: stretch; }
      .domain-stats__score { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: var(--surface-strong); }
      .domain-stats__score span { display: block; color: var(--muted); font-size: var(--pspf-type-label); text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
      .domain-stats__score strong { display: block; margin-top: 6px; font-size: 34px; line-height: 1; color: var(--workshop-blue); }
      .domain-stats__bar { display: grid; gap: 7px; align-content: center; border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: var(--surface-strong); }
      .domain-stats__bar-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) 42px; gap: 8px; align-items: center; }
      .domain-stats__track { height: 12px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--border) 55%, transparent); }
      .domain-stats__fill { display: block; width: var(--value); height: 100%; border-radius: inherit; background: var(--fill); }
      .domain-stats__table table { min-width: min(760px, 100%); }
      .domain-stats__table th, .domain-stats__table td { white-space: nowrap; }
      .domain-stats__table th:first-child, .domain-stats__table td:first-child { white-space: normal; min-width: 10rem; }
      .domain-stats__attention table { min-width: min(900px, 100%); }
      .domain-stats__attention td[data-field="title"] { min-width: 18rem; white-space: normal; }
      @media (max-width: 760px) { .domain-stats__summary { grid-template-columns: 1fr; } }
    </style>
    <h2>Domain Stats</h2>
    <p class="muted">Filter by one or more PSPF Domains to see compliance status counts and the Requirements that need action.</p>
    <div class="domain-stats__filters" role="group" aria-label="Filter Domain Stats by Domain">
      <button type="button" data-domain-stat-filter="all" aria-pressed="true">All Domains <span>${rows.length}</span></button>
      ${filters}
    </div>
    <div class="domain-stats__summary" aria-live="polite">
      <article class="domain-stats__score"><span>Selected scope</span><strong data-domain-stat-value="metPercent">${totals.metPercent}%</strong><p class="muted" data-domain-stat-value="scopeLabel">All Domains · ${totals.requirements} requirement(s)</p></article>
      <article class="domain-stats__bar">
        ${domainStatsBarRow("Met", "met", totals.met, totals.requirements, "var(--pspf-ok)")}
        ${domainStatsBarRow("Partial", "partiallyMet", totals.partiallyMet, totals.requirements, "var(--pspf-warn)")}
        ${domainStatsBarRow("Not met", "notMet", totals.notMet, totals.requirements, "var(--pspf-danger)")}
        ${domainStatsBarRow("Not started", "notStarted", totals.notStarted, totals.requirements, "var(--muted)")}
      </article>
    </div>
    <div class="domain-stats__score"><span>Needs action</span><strong data-domain-stat-value="attentionCount">${attentionRows.length}</strong><p class="muted">Met and not applicable Requirements are for monitoring; the table below is the work queue.</p></div>
    <div class="table-wrap domain-stats__table" tabindex="0" aria-label="Domain status counts table">
      <table>
        <thead><tr><th>Domain</th><th>Total</th><th>Applicable</th><th>Met</th><th>Partial</th><th>In progress</th><th>Not met</th><th>Not started</th><th>Under review</th><th>N/A</th><th>Evidence gaps</th><th>Met %</th></tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
    <div class="table-wrap domain-stats__attention" tabindex="0" aria-label="Requirements needing action table">
      <table>
        <thead><tr><th>Open</th><th data-field="title">Requirement</th><th>Domain</th><th>Status</th><th>Evidence</th><th>Next step</th></tr></thead>
        <tbody>${attentionHtml || '<tr><td colspan="6">No Requirements need action in the selected scope.</td></tr>'}</tbody>
      </table>
    </div>
    ${domainStatsScript()}
  </section>`;
}

function domainStatsBarRow(labelText: string, key: string, value: number, total: number, fill: string): string {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return `<div class="domain-stats__bar-row"><span>${escapeHtml(labelText)}</span><div class="domain-stats__track"><span class="domain-stats__fill" data-domain-stat-bar="${escapeHtml(key)}" style="--value: ${percent}%; --fill: ${fill};"></span></div><strong data-domain-stat-value="${escapeHtml(key)}">${value}</strong></div>`;
}

function domainStatsTableRow(row: DashboardDomainStatusRow): string {
  const stats = JSON.stringify(row).replaceAll("&", "&amp;").replaceAll("'", "&#39;");
  return `<tr data-domain-stat-row data-domain="${escapeHtml(row.domainId)}" data-stats='${stats}'>
    <td>${escapeHtml(row.domain)}</td><td>${row.requirements}</td><td>${row.applicable}</td><td>${row.met}</td><td>${row.partiallyMet}</td><td>${row.inProgress}</td><td>${row.notMet}</td><td>${row.notStarted}</td><td>${row.underReview}</td><td>${row.notApplicable}</td><td>${row.evidenceGaps}</td><td>${row.metPercent}%</td>
  </tr>`;
}

function domainStatsAttentionTableRow(row: DashboardAttentionRequirementRow): string {
  return `<tr data-domain-stat-attention-row data-domain="${escapeHtml(row.domainId)}">
    <td><button type="button" data-command="openEntity" data-entity-type="requirement" data-entity-id="${escapeHtml(row.openEntityId)}">Open</button></td><td data-field="title">${escapeHtml(row.title)}</td><td>${escapeHtml(row.domain)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.evidence)}</td><td>${escapeHtml(row.nextStep)}</td>
  </tr>`;
}

function aggregateDomainStats(rows: readonly DashboardDomainStatusRow[]): DashboardDomainStatusRow {
  const totals = rows.reduce(
    (current, row) => ({
      domainId: "all",
      domain: "All Domains",
      requirements: current.requirements + row.requirements,
      applicable: current.applicable + row.applicable,
      met: current.met + row.met,
      partiallyMet: current.partiallyMet + row.partiallyMet,
      inProgress: current.inProgress + row.inProgress,
      notMet: current.notMet + row.notMet,
      notStarted: current.notStarted + row.notStarted,
      underReview: current.underReview + row.underReview,
      notApplicable: current.notApplicable + row.notApplicable,
      evidenceGaps: current.evidenceGaps + row.evidenceGaps,
      metPercent: 0
    }),
    {
      domainId: "all",
      domain: "All Domains",
      requirements: 0,
      applicable: 0,
      met: 0,
      partiallyMet: 0,
      inProgress: 0,
      notMet: 0,
      notStarted: 0,
      underReview: 0,
      notApplicable: 0,
      evidenceGaps: 0,
      metPercent: 0
    }
  );
  return { ...totals, metPercent: totals.applicable === 0 ? 0 : Math.round((totals.met / totals.applicable) * 100) };
}

function domainStatsScript(): string {
  return `<script>
    (() => {
      const widget = document.querySelector('[data-domain-stats-widget]');
      if (!widget) return;
      const buttons = Array.from(widget.querySelectorAll('[data-domain-stat-filter]'));
      const rows = Array.from(widget.querySelectorAll('[data-domain-stat-row]'));
      const attentionRows = Array.from(widget.querySelectorAll('[data-domain-stat-attention-row]'));
      const selected = new Set();
      const readStats = (row) => JSON.parse(row.getAttribute('data-stats') || '{}');
      const sum = (items, key) => items.reduce((total, item) => total + Number(item[key] || 0), 0);
      const setText = (key, value) => {
        const element = widget.querySelector('[data-domain-stat-value="' + key + '"]');
        if (element) element.textContent = String(value);
      };
      const setBar = (key, value, total) => {
        const element = widget.querySelector('[data-domain-stat-bar="' + key + '"]');
        if (element) element.style.setProperty('--value', (total > 0 ? Math.round((value / total) * 100) : 0) + '%');
      };
      const refresh = () => {
        const allSelected = selected.size === 0;
        const visibleRows = rows.filter((row) => allSelected || selected.has(row.getAttribute('data-domain')));
        const stats = visibleRows.map(readStats);
        rows.forEach((row) => { row.hidden = !(allSelected || selected.has(row.getAttribute('data-domain'))); });
        let visibleAttention = 0;
        attentionRows.forEach((row) => {
          const visible = allSelected || selected.has(row.getAttribute('data-domain'));
          row.hidden = !visible;
          if (visible) visibleAttention += 1;
        });
        buttons.forEach((button) => {
          const id = button.getAttribute('data-domain-stat-filter');
          button.setAttribute('aria-pressed', id === 'all' ? String(allSelected) : String(selected.has(id)));
        });
        const requirements = sum(stats, 'requirements');
        const applicable = sum(stats, 'applicable');
        const met = sum(stats, 'met');
        const partiallyMet = sum(stats, 'partiallyMet');
        const notMet = sum(stats, 'notMet');
        const notStarted = sum(stats, 'notStarted');
        const metPercent = applicable > 0 ? Math.round((met / applicable) * 100) : 0;
        setText('metPercent', metPercent + '%');
        setText('scopeLabel', (allSelected ? 'All Domains' : stats.map((item) => item.domain).join(', ')) + ' · ' + requirements + ' requirement(s)');
        setText('met', met);
        setText('partiallyMet', partiallyMet);
        setText('notMet', notMet);
        setText('notStarted', notStarted);
        setText('attentionCount', visibleAttention);
        setBar('met', met, requirements);
        setBar('partiallyMet', partiallyMet, requirements);
        setBar('notMet', notMet, requirements);
        setBar('notStarted', notStarted, requirements);
      };
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-domain-stat-filter');
          if (id === 'all') {
            selected.clear();
          } else if (selected.has(id)) {
            selected.delete(id);
          } else {
            selected.add(id);
          }
          refresh();
        });
      });
      refresh();
    })();
  </script>`;
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
  const pentestWorkbench = buildPentestWorkbenchModel(allEntities);
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
      "Why this control here, why now?",
      "pspf.workshop.openHumanCentredRiskView",
      "Open risk panel"
    ),
    masterLoopRow(
      "Governance, Metrics and Reporting",
      "GOV",
      directions.length,
      `${directionResponses["not-set"]} Directions not set`,
      "What needs AA, Audit Committee or CSO attention?",
      "pspf.workshop.openAssessmentDashboard",
      "Open dashboard"
    ),
    masterLoopRow(
      "Systems, Authorisation and Operations",
      "TECH / INFO",
      requirements.length,
      `${evidenceCoverage}% evidence coverage`,
      "Which systems and controls can we stand behind?",
      "pspf.workshop.browseIsmSourceControls",
      "Open controls"
    ),
    masterLoopRow(
      "Incident Management and Resilience",
      "GOV / TECH / RISK",
      changeRecords.length,
      `${changeRecords.length} change records`,
      "What did we learn and what changed?",
      "pspf.workshop.openChangeRecords",
      "Open changes"
    ),
    masterLoopRow(
      "People, Capability and Culture",
      "GOV / PER / RISK",
      openActions.length,
      `${blockedActions} blocked actions`,
      "Where does capability constrain uplift?",
      "pspf.workshop.openPlanOfActionBoard",
      "Open actions"
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
        trend: trendIndicator(choice.trend),
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
    <section class="master-dashboard">
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
        <button type="button" data-command="pspf.workshop.openAssessmentDashboard">Assessment dashboard</button>
        <button type="button" data-command="pspf.workshop.openRequirementsList">Requirements needing work</button>
        <button type="button" data-command="pspf.workshop.createRequirement">Create requirement</button>
        <button type="button" data-command="pspf.core.exportBundle">Export Bundle</button>
        <button type="button" data-command="pspf.workshop.copyPostureBrief">Copy brief</button>
      </div>
    </section>
    <section>
      <h2>Portal</h2>
      <div class="portal-grid">
        ${portalGroup("Essentials", "Start with the high-frequency PSPF surfaces.", [
          portalCommand(
            "pspf.workshop.openEssentialEightDashboard",
            "Essential Eight",
            "E8 posture, mappings and uplift"
          ),
          portalCommand("pspf.workshop.openRequirementsList", "Requirements", "Main requirement editing workbench"),
          portalCommand("pspf.workshop.browseIsmSourceControls", "Controls pane", "ISM controls by category and state")
        ])}
        ${portalGroup("Planning", "Move from posture into executable work.", [
          portalCommand(
            "pspf.workshop.openPlanOfActionBoard",
            "Plan of Action",
            "Integrated schedule and action worklist"
          ),
          portalCommand(
            "pspf.workshop.openCisoMasterPlan",
            "CISO Master Plan",
            "Strategy, risk, spend and action roadmap"
          ),
          portalCommand("pspf.workshop.openStrategyMap", "Strategy Map", "Strategic choices and measures")
        ])}
        ${portalGroup("Traceability", "Follow the connections behind posture.", [
          portalCommand(
            "pspf.workshop.openConnectedView",
            "Connected View",
            "Directions, Requirements, risks and actions"
          ),
          portalCommand(
            "pspf.workshop.openRequirementCardView",
            "Requirement Cards",
            "Readable requirement cards and ISM links"
          ),
          portalCommand("pspf.workshop.openEvidenceReviewQueue", "Evidence Review", "Evidence gaps and refresh work")
        ])}
        ${portalGroup("Reporting", "Prepare material for assurance and executive review.", [
          portalCommand("pspf.core.createSnapshot", "Snapshot", "Freeze a local point-in-time record"),
          portalCommand("pspf.workshop.openCsoMagazine", "Digital CSO Magazine", "Broad executive assurance issue"),
          portalCommand("pspf.workshop.openCisoMagazine", "CISO Newsletter", "Focused CISO assurance issue")
        ])}
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
    ${renderMasterDashboardPentestSummary(pentestWorkbench)}
    ${renderDecisionLoopCards(decisionLoopRows)}
    ${renderStrategyPerformanceCards(strategyRows)}
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

function renderMasterDashboardPentestSummary(model: PentestWorkbenchModel): string {
  const rows = model.assessments.slice(0, 6).map((assessment) => ({
    target: assessment.engagement.target,
    status: label(assessment.engagement.status),
    progress: `${assessment.closurePercentage}% closed`,
    planned: assessment.engagement.plannedWindow,
    reportDue: formatPentestDashboardDate(assessment.engagement.reportDue),
    retest: formatPentestDashboardDate(assessment.engagement.retestWindow),
    criticalHigh: assessment.engagement.criticalHighFindings,
    openActions: assessment.engagement.openFindingActions,
    action: `<button type="button" data-command="pspf.workshop.openPentestWorkbench">Open workbench</button>`
  }));
  if (rows.length === 0) {
    return `<section>
      <h2>Penetration Testing</h2>
      <p class="muted">No penetration testing assessments are tagged yet.</p>
      <div class="form-actions"><button type="button" data-command="pspf.workshop.openPentestWorkbench">Open workbench</button></div>
    </section>`;
  }
  return recordTable("Penetration Testing", rows, [
    "target",
    "status",
    "progress",
    "planned",
    "reportDue",
    "retest",
    "criticalHigh",
    "openActions",
    "action"
  ]);
}

function formatPentestDashboardDate(value: string): string {
  if (value === "Not recorded" || value === "Not scheduled") {
    return value;
  }
  return formatShortAuDateTime(value) ?? value;
}

function portalCommand(command: string, title: string, description: string): string {
  return `<button type="button" class="portal-card" data-command="${escapeHtml(command)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></button>`;
}

function portalGroup(title: string, description: string, commands: readonly string[]): string {
  return `<div class="portal-group"><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(description)}</p><div class="portal-actions">${commands.join("")}</div></div>`;
}

function renderDecisionLoopCards(rows: readonly ReturnType<typeof masterLoopRow>[]): string {
  return `<section>
    <h2>CISO Decision Loops</h2>
    <div class="decision-loop-grid">
      ${rows
        .map(
          (row) => `<article class="decision-loop-card">
            <div class="decision-loop-card__top"><span>${escapeHtml(row.maturity)}</span><strong>${row.records}</strong></div>
            <h3>${escapeHtml(row.loop)}</h3>
            <p class="muted">${escapeHtml(row.signal)}</p>
            <p>${escapeHtml(row.question)}</p>
            <button type="button" data-command="${escapeHtml(row.command)}">${escapeHtml(row.actionLabel)}</button>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderStrategyPerformanceCards(rows: readonly object[]): string {
  if (rows.length === 0) {
    return `<section><h2>Strategy And Performance</h2><p class="muted">No strategic choices are recorded yet.</p></section>`;
  }
  return `<section>
    <h2>Strategy And Performance</h2>
    <div class="strategy-performance-grid">
      ${rows
        .map((row) => {
          const choice = String(readRecordField(row, "choice") ?? "Choice");
          return `<article class="strategy-performance-card">
            <h3>${escapeHtml(choice)}</h3>
            <p class="muted">${escapeHtml(String(readRecordField(row, "capability") ?? "No capability recorded"))}</p>
            <div class="strategy-performance-card__meta">
              ${String(readRecordField(row, "trend") ?? "")}
              ${shellPill(`${String(readRecordField(row, "measures") ?? "0")} measures`)}
              ${shellPill(`${String(readRecordField(row, "outcomes") ?? "0")} outcomes`)}
            </div>
            <p>${escapeHtml(String(readRecordField(row, "target") ?? "No target posture recorded"))}</p>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
}

async function openPspfGridView(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel("pspfGridView", "PSPF Grid View", vscode.ViewColumn.One, {
    enableScripts: true
  });
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderPspfGridView(buildPspfGridModel(await listAllEntities()));
  });
  panel.webview.html = renderPspfGridView(buildPspfGridModel(await listAllEntities()));
}

async function openRequirementCardView(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfRequirementCardView",
    "Requirement Card View",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderRequirementCardView(
      buildRequirementCardViewModel(await listAllEntities(), PSPF_DOMAINS)
    );
  });
  panel.webview.html = renderRequirementCardView(buildRequirementCardViewModel(await listAllEntities(), PSPF_DOMAINS));
}

async function openPentestWorkbench(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfPentestWorkbench",
    "Penetration Testing Workbench",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderPentestWorkbench(buildPentestWorkbenchModel(await listAllEntities()));
  });
  panel.webview.html = renderPentestWorkbench(buildPentestWorkbenchModel(await listAllEntities()));
}

function renderRequirementCardView(model: RequirementCardViewModel): string {
  const sections =
    model.groups.length > 0
      ? model.groups.map(requirementCardDomainSection).join("")
      : `<section><p class="muted">No Requirements found yet. Add Requirements in the Workshop to populate the card view.</p></section>`;
  const domainFilters = model.groups
    .map(
      (group) =>
        `<button type="button" data-card-domain-filter="${escapeHtml(group.domainId)}">${escapeHtml(group.domainName)} (${group.cards.length})</button>`
    )
    .join("");
  return shellHtml(
    "Requirement Card View",
    `
    ${requirementCardViewStyles()}
    <section>
      <p class="eyebrow">Workshop · Requirement cards</p>
      <h1>Requirement Card View</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Flip a card to read its summary and open linked Evidence, Actions, Risks, and ISM controls. Cards are grouped by Domain and filterable by Domain, RAG status, and text.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Requirements", model.totals.requirements)}
        ${metricCard("Green", model.totals.green)}
        ${metricCard("Amber", model.totals.amber)}
        ${metricCard("Red", model.totals.red)}
        ${metricCard("N/A", model.totals.grey)}
        ${metricCard("Evidence gaps", model.totals.evidenceGaps)}
        ${metricCard("Unlinked", model.totals.unlinked)}
      </div>
      <div class="card-view-filters">
        <div class="card-view-filter-row" role="group" aria-label="Filter by Domain">
          <span class="card-view-filter-label">Domain</span>
          <button type="button" data-card-domain-filter="all" aria-pressed="true">All</button>
          ${domainFilters}
        </div>
        <div class="card-view-filter-row" role="group" aria-label="Filter by RAG status">
          <span class="card-view-filter-label">Status</span>
          <button type="button" data-card-rag-filter="all" aria-pressed="true">All</button>
          <button type="button" data-card-rag-filter="green">Green</button>
          <button type="button" data-card-rag-filter="amber">Amber</button>
          <button type="button" data-card-rag-filter="red">Red</button>
          <button type="button" data-card-rag-filter="grey">N/A</button>
        </div>
        <div class="card-view-filter-row">
          <label class="card-view-filter-label" for="card-view-search">Search</label>
          <input type="search" id="card-view-search" data-card-search-input placeholder="Filter by title or summary" />
          <button type="button" data-command="refresh">Refresh</button>
        </div>
        <p class="muted" data-card-view-count></p>
      </div>
    </section>
    <div class="card-view-board">
      ${sections}
    </div>
    ${requirementCardViewScript()}
  `
  );
}

function requirementCardDomainSection(group: RequirementCardDomainGroup): string {
  const cards = group.cards.map(requirementCard).join("");
  return `<section class="card-view-domain" data-card-domain-section data-domain="${escapeHtml(group.domainId)}">
    <div class="card-view-domain__header">
      <h2>${escapeHtml(group.domainName)}</h2>
      <div class="card-view-domain__counts">
        ${shellPill(`Green ${group.ragCounts.green}`)}
        ${shellPill(`Amber ${group.ragCounts.amber}`)}
        ${shellPill(`Red ${group.ragCounts.red}`)}
        ${shellPill(`N/A ${group.ragCounts.grey}`)}
      </div>
    </div>
    <div class="card-view-cards">${cards}</div>
  </section>`;
}

function requirementCard(card: RequirementCardModel): string {
  const search = [card.title, card.summary, card.statusLabel, card.domainName].join(" ").toLocaleLowerCase("en-AU");
  return `<article class="card-view-card" data-card data-domain="${escapeHtml(card.domainId)}" data-rag="${card.rag}" data-search="${escapeHtml(search)}">
    <div class="card-view-card__inner">
      <div class="card-view-card__face card-view-card__front" data-card-face="front">
        <div class="card-view-card__top">
          <span class="card-view-rag card-view-rag--${card.rag}">${escapeHtml(card.statusLabel)}</span>
          <span class="muted">${escapeHtml(card.domainName)}</span>
        </div>
        <h3>${escapeHtml(card.title)}</h3>
        <p class="card-view-card__summary">${escapeHtml(card.summary)}</p>
        <div class="card-view-card__chips">
          ${shellPill(`Evidence ${card.evidenceCount}`)}
          ${shellPill(`Actions ${card.actionCount}`)}
          ${shellPill(`Risks ${card.riskCount}`)}
          ${shellPill(`ISM ${card.ismControlCount}`)}
          ${card.evidenceGapCount > 0 ? shellPill(`Gaps ${card.evidenceGapCount}`) : ""}
        </div>
        <p class="card-view-card__hint">Click to flip for detail →</p>
      </div>
      <div class="card-view-card__face card-view-card__back" data-card-face="back">
        <div class="card-view-card__top">
          <span class="card-view-rag card-view-rag--${card.rag}">${escapeHtml(card.statusLabel)}</span>
          <button type="button" class="card-view-flip-back" data-card-flip-back>← Back</button>
        </div>
        <h3>${escapeHtml(card.title)}</h3>
        ${requirementCardLinkList("Evidence", card.evidence)}
        ${requirementCardLinkList("Actions", card.actions)}
        ${requirementCardLinkList("Risks", card.risks)}
        ${requirementCardLinkList("ISM controls", card.ismControls)}
        <div class="form-actions card-view-card__investigate">
          <button type="button" data-command="openEntity" data-entity-type="requirement" data-entity-id="${escapeHtml(card.id)}">Open requirement</button>
          <button type="button" data-command="pspf.workshop.openConnectedView">Trace in Connected View</button>
        </div>
      </div>
    </div>
  </article>`;
}

function requirementCardLinkList(heading: string, refs: readonly RequirementCardLinkRef[]): string {
  if (refs.length === 0) {
    return `<div class="card-view-links"><h4>${escapeHtml(heading)}</h4><p class="muted">None linked yet.</p></div>`;
  }
  const items = refs
    .map(
      (ref) =>
        `<li><button type="button" data-command="openEntity" data-entity-type="${escapeHtml(ref.entityType)}" data-entity-id="${escapeHtml(ref.id)}">${escapeHtml(ref.title)}</button><span class="muted">${escapeHtml(ref.detail)}</span></li>`
    )
    .join("");
  return `<div class="card-view-links"><h4>${escapeHtml(heading)} (${refs.length})</h4><ul>${items}</ul></div>`;
}

function requirementCardViewStyles(): string {
  return `<style>
    .card-view-filters { margin-top: 14px; display: grid; gap: 8px; }
    .card-view-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .card-view-filter-label { font-size: 12px; font-weight: 700; min-width: 56px; color: var(--muted); }
    .card-view-filter-row [aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 14%, var(--surface-strong)); }
    .card-view-filter-row input[type="search"] { flex: 1 1 220px; min-width: 180px; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-strong); color: inherit; }
    .card-view-board { display: grid; gap: 16px; background: transparent; border: 0; padding: 0; }
    .card-view-domain { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: color-mix(in srgb, var(--surface) 92%, var(--workshop-blue)); }
    .card-view-domain[hidden] { display: none; }
    .card-view-domain__header { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .card-view-domain__header h2 { margin: 0; }
    .card-view-domain__counts { display: flex; gap: 6px; flex-wrap: wrap; }
    .card-view-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(312px, 1fr)); gap: 12px; }
    .card-view-card { perspective: 1200px; min-height: 264px; }
    .card-view-card[hidden] { display: none; }
    .card-view-card__inner { position: relative; width: 100%; height: 100%; min-height: 264px; transition: transform 0.5s; transform-style: preserve-3d; }
    .card-view-card.is-flipped .card-view-card__inner { transform: rotateY(180deg); }
    .card-view-card__face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--surface-strong); overflow: auto; }
    .card-view-card__front { cursor: pointer; }
    .card-view-card__back { transform: rotateY(180deg); }
    .card-view-card__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .card-view-card h3 { margin: 4px 0; font-size: 14px; }
    .card-view-card__summary { margin: 0; font-size: 13px; }
    .card-view-card__chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
    .card-view-card__hint { margin: 6px 0 0; font-size: 11px; color: var(--muted); }
    .card-view-rag { border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700; border: 1px solid var(--border); }
    .card-view-rag--green { border-color: var(--pspf-ok); color: var(--pspf-ok); background: var(--pspf-ok-soft); }
    .card-view-rag--amber { border-color: var(--pspf-warn); color: var(--pspf-warn); background: var(--pspf-warn-soft); }
    .card-view-rag--red { border-color: var(--vscode-errorForeground); color: var(--vscode-errorForeground); }
    .card-view-rag--grey { border-color: var(--border); color: var(--muted); }
    .card-view-links { margin-top: 6px; }
    .card-view-links h4 { margin: 6px 0 4px; font-size: 12px; }
    .card-view-links ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .card-view-links li { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
    .card-view-links li span { font-size: 11px; white-space: nowrap; }
    .card-view-card__investigate { margin-top: 8px; }
    @media (max-width: 720px) { .card-view-cards { grid-template-columns: 1fr; } }
  </style>`;
}

function requirementCardViewScript(): string {
  return `<script>
    (() => {
      const board = document.querySelector('.card-view-board');
      if (!board) return;
      const cards = Array.from(document.querySelectorAll('[data-card]'));
      const sections = Array.from(document.querySelectorAll('[data-card-domain-section]'));
      const domainButtons = Array.from(document.querySelectorAll('[data-card-domain-filter]'));
      const ragButtons = Array.from(document.querySelectorAll('[data-card-rag-filter]'));
      const search = document.querySelector('[data-card-search-input]');
      const count = document.querySelector('[data-card-view-count]');
      const state = { domain: 'all', rag: 'all', text: '' };

      function apply() {
        let visible = 0;
        for (const card of cards) {
          const matchesDomain = state.domain === 'all' || card.getAttribute('data-domain') === state.domain;
          const matchesRag = state.rag === 'all' || card.getAttribute('data-rag') === state.rag;
          const matchesText = state.text === '' || (card.getAttribute('data-search') || '').includes(state.text);
          const match = matchesDomain && matchesRag && matchesText;
          card.hidden = !match;
          if (match) visible += 1;
        }
        for (const section of sections) {
          const hasVisible = Array.from(section.querySelectorAll('[data-card]')).some((card) => !card.hidden);
          section.hidden = !hasVisible;
        }
        if (count) count.textContent = visible + ' visible requirement' + (visible === 1 ? '' : 's');
      }

      function setPressed(buttons, attr, value) {
        for (const button of buttons) button.setAttribute('aria-pressed', String(button.getAttribute(attr) === value));
      }

      domainButtons.forEach((button) => button.addEventListener('click', () => {
        state.domain = button.getAttribute('data-card-domain-filter') || 'all';
        setPressed(domainButtons, 'data-card-domain-filter', state.domain);
        apply();
      }));
      ragButtons.forEach((button) => button.addEventListener('click', () => {
        state.rag = button.getAttribute('data-card-rag-filter') || 'all';
        setPressed(ragButtons, 'data-card-rag-filter', state.rag);
        apply();
      }));
      if (search) search.addEventListener('input', () => {
        state.text = (search.value || '').trim().toLowerCase();
        apply();
      });

      board.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('[data-card-flip-back]')) {
          const card = target.closest('[data-card]');
          if (card) card.classList.remove('is-flipped');
          return;
        }
        if (target.closest('button, a, input, select, textarea, ul')) return;
        const front = target.closest('[data-card-face="front"]');
        if (!front) return;
        const card = front.closest('[data-card]');
        if (card) card.classList.add('is-flipped');
      });

      apply();
    })();
  </script>`;
}

function renderPentestWorkbench(model: PentestWorkbenchModel): string {
  const assessments =
    model.assessments.length > 0
      ? model.assessments.map(renderPentestAssessment).join("")
      : `<section><p class="muted">No penetration testing assessments found. Create a Tag such as PENTEST-2026-Web and apply it to finding Actions to populate this workbench.</p></section>`;
  const severityLegend = PENTEST_FINDING_SEVERITIES.map(
    (severity) =>
      `<span class="pentest-severity-pill" data-severity="${escapeHtml(severity.id)}">${escapeHtml(severity.label)} · ${severity.slaDays} d</span>`
  ).join("");
  return shellHtml(
    "Penetration Testing Workbench",
    `
    ${pentestWorkbenchStyles()}
    <section>
      <p class="eyebrow">Workshop · Third-party assurance</p>
      <h1>Penetration Testing Workbench</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Findings, retests, residual risks and Shop contract context derived from existing Actions, Evidence, Risks, Tags and links.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Assessments", model.totals.assessments)}
        ${metricCard("Findings", model.totals.findings)}
        ${metricCard("Critical/high", model.totals.criticalHighFindings)}
        ${metricCard("Other findings", model.totals.otherFindings)}
        ${metricCard("Open remediation", model.totals.openFindingActions)}
        ${metricCard("Overdue", model.totals.overdue)}
        ${metricCard("SLA at risk", model.totals.slaAtRisk)}
        ${metricCard("Pending verification", model.totals.pendingVerification)}
        ${metricCard("Closed", model.totals.closed)}
        ${metricCard("Retest backlog", model.totals.verificationBacklog)}
        ${metricCard("Residual risks", model.totals.residualRisks)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.createAction">Create finding action</button>
        <button type="button" data-command="pspf.workshop.attachEvidence">Add evidence</button>
        <button type="button" data-command="pspf.workshop.manageTags">Manage Tags</button>
      </div>
      <p class="muted">SLA bands: ${severityLegend}. Severity is inferred from a linked severity Tag or the Action title; unknown severity defaults to Medium so the finding remains visible.</p>
    </section>
    ${renderPentestPipeline(model)}
    ${assessments}
  `
  );
}

function renderPentestPipeline(model: PentestWorkbenchModel): string {
  const rows = model.assessments.map((assessment) => ({
    target: assessment.engagement.target,
    status: label(assessment.engagement.status),
    tester: assessment.engagement.tester,
    method: assessment.engagement.method,
    window: assessment.engagement.plannedWindow,
    reportDue: assessment.engagement.reportDue,
    retest: assessment.engagement.retestWindow,
    criticalHigh: assessment.engagement.criticalHighFindings,
    other: assessment.engagement.otherFindings,
    openActions: assessment.engagement.openFindingActions
  }));
  return recordTable("Pentest Pipeline", rows, [
    "target",
    "status",
    "tester",
    "method",
    "window",
    "reportDue",
    "retest",
    "criticalHigh",
    "other",
    "openActions"
  ]);
}

function renderPentestAssessment(assessment: PentestAssessmentModel): string {
  const commercialRows = assessment.commercialContext.map((item) => ({
    openEntityType: "contract",
    openEntityId: item.contractId,
    supplier: item.supplierName ?? "Supplier not linked",
    contract: item.contractTitle,
    contractRef: item.contractRef ?? "Not recorded"
  }));
  const riskRows = assessment.residualRisks.map((risk) => ({
    openEntityType: "risk",
    openEntityId: risk.id,
    title: risk.title,
    status: label(risk.status),
    score: risk.score,
    supplierLinked: risk.supplierLinked ? "Yes" : "No"
  }));
  const verificationRows = assessment.verificationBacklog.map((item) => ({
    openEntityType: "evidence",
    openEntityId: item.evidenceId,
    evidence: item.evidenceTitle,
    finding: item.findingTitle,
    severity: item.severityLabel,
    freshness: label(item.freshness),
    dueDate: item.dueDate ?? "Not set"
  }));

  return `
    <section class="pentest-assessment" aria-labelledby="pentest-${escapeHtml(assessment.tagId)}">
      <header class="pentest-assessment__header">
        <div>
          <p class="eyebrow">${escapeHtml(assessment.tagLabel)}</p>
          <h2 id="pentest-${escapeHtml(assessment.tagId)}">${escapeHtml(assessment.title)}</h2>
          <p class="muted">Started ${escapeHtml(assessment.startedAt ? formatDisplayDate(new Date(assessment.startedAt)) : "not yet")} · ${assessment.findingCount} finding${assessment.findingCount === 1 ? "" : "s"} · ${assessment.closurePercentage}% closed</p>
        </div>
        <div class="pentest-severity-counts" aria-label="Finding count by severity">
          ${PENTEST_FINDING_SEVERITIES.map(
            (severity) =>
              `<span class="pentest-severity-pill" data-severity="${escapeHtml(severity.id)}">${escapeHtml(severity.label)} ${assessment.severityCounts[severity.id]}</span>`
          ).join("")}
        </div>
      </header>
      ${renderPentestEngagementProfile(assessment)}
      <div class="pentest-queue-grid">
        ${renderPentestFindingQueue("Overdue", "overdue", assessment.queues.overdue)}
        ${renderPentestFindingQueue("SLA at risk", "sla-at-risk", assessment.queues["sla-at-risk"])}
        ${renderPentestFindingQueue("Pending verification", "pending-verification", assessment.queues["pending-verification"])}
        ${renderPentestFindingQueue("Closed", "closed", assessment.queues.closed)}
      </div>
    </section>
    ${recordTable(`Retest backlog · ${assessment.tagLabel}`, verificationRows, ["evidence", "finding", "severity", "freshness", "dueDate"])}
    ${recordTable(`Commercial context · ${assessment.tagLabel}`, commercialRows, ["supplier", "contract", "contractRef"])}
    ${recordTable(`Residual risk · ${assessment.tagLabel}`, riskRows, ["title", "status", "score", "supplierLinked"])}
  `;
}

function renderPentestEngagementProfile(assessment: PentestAssessmentModel): string {
  const engagement = assessment.engagement;
  return `<div class="pentest-engagement-grid" aria-label="Penetration test planning and execution profile">
    ${renderPentestEngagementCard("Target", escapeHtml(engagement.target), escapeHtml(engagement.targetType))}
    ${renderPentestEngagementCard("Tester", escapeHtml(engagement.tester))}
    ${renderPentestEngagementCard("Method", escapeHtml(engagement.method))}
    ${renderPentestEngagementCard("Timing", escapeHtml(engagement.plannedWindow), `Report due ${escapeHtml(engagement.reportDue)} · Retest ${escapeHtml(engagement.retestWindow)}`)}
    ${renderPentestEngagementCard("Finding split", escapeHtml(engagement.executionSummary))}
  </div>`;
}

function renderPentestEngagementCard(title: string, body: string, detail = ""): string {
  return `<article class="pentest-engagement-card"><h3>${escapeHtml(title)}</h3><p>${body}</p>${detail ? `<p class="muted">${detail}</p>` : ""}</article>`;
}

function renderPentestFindingQueue(
  title: string,
  queueId: PentestFindingQueueId,
  findings: readonly PentestFindingModel[]
): string {
  const rows =
    findings.length > 0
      ? findings.map((finding) => renderPentestFindingCard(finding)).join("")
      : `<p class="muted">No findings in this queue.</p>`;
  return `
    <article class="pentest-queue" data-queue="${escapeHtml(queueId)}">
      <header class="pentest-queue__header">
        <h3>${escapeHtml(title)}</h3>
        ${shellPill(String(findings.length))}
      </header>
      <div class="pentest-finding-list">${rows}</div>
    </article>
  `;
}

function renderPentestFindingCard(finding: PentestFindingModel): string {
  const evidenceText =
    finding.verifiedEvidenceIds.length > 0
      ? `${finding.verifiedEvidenceIds.length} verified evidence`
      : finding.linkedEvidenceIds.length > 0
        ? `${finding.linkedEvidenceIds.length} evidence needing verification`
        : "No evidence linked";
  const requirementText =
    finding.linkedRequirementIds.length > 0
      ? `${finding.linkedRequirementIds.length} linked requirement${finding.linkedRequirementIds.length === 1 ? "" : "s"}`
      : "No requirement link";
  return `
    <article class="pentest-finding-card" data-severity="${escapeHtml(finding.severityId)}">
      <header>
        <span class="pentest-severity-pill" data-severity="${escapeHtml(finding.severityId)}">${escapeHtml(finding.severityLabel)}</span>
        <button type="button" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(finding.id)}">${escapeHtml(finding.title)}</button>
      </header>
      <p class="muted">${escapeHtml(label(finding.status))} · due ${escapeHtml(finding.dueDate ?? "not set")} · SLA ${escapeHtml(finding.slaDeadline.slice(0, 10))}</p>
      <p class="muted">${escapeHtml(evidenceText)} · ${escapeHtml(requirementText)} · ${escapeHtml(finding.severitySource)}</p>
    </article>
  `;
}

function pentestWorkbenchStyles(): string {
  return `<style>
    .pentest-assessment { display: grid; gap: 12px; }
    .pentest-assessment__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .pentest-assessment__header h2 { margin: 0; }
    .pentest-engagement-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
    .pentest-engagement-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 9px; background: var(--surface); display: grid; gap: 3px; align-content: start; }
    .pentest-engagement-card h3, .pentest-engagement-card p { margin: 0; }
    .pentest-engagement-card h3 { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .pentest-severity-counts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
    .pentest-severity-pill { display: inline-block; border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 700; white-space: nowrap; background: var(--surface); }
    .pentest-severity-pill[data-severity="critical"] { color: var(--pspf-warn); background: var(--pspf-warn-soft); border-color: color-mix(in srgb, var(--pspf-warn) 65%, var(--border)); }
    .pentest-severity-pill[data-severity="high"] { color: var(--pspf-warn); border-color: color-mix(in srgb, var(--pspf-warn) 50%, var(--border)); }
    .pentest-severity-pill[data-severity="medium"] { color: var(--workshop-blue); background: var(--workshop-blue-soft); border-color: color-mix(in srgb, var(--workshop-blue) 55%, var(--border)); }
    .pentest-severity-pill[data-severity="low"] { color: var(--pspf-ok); background: var(--pspf-ok-soft); border-color: color-mix(in srgb, var(--pspf-ok) 55%, var(--border)); }
    .pentest-queue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .pentest-queue { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 10px; align-content: start; }
    .pentest-queue[data-queue="overdue"], .pentest-queue[data-queue="sla-at-risk"] { box-shadow: inset 3px 0 0 var(--pspf-warn); }
    .pentest-queue[data-queue="pending-verification"] { box-shadow: inset 3px 0 0 var(--workshop-blue); }
    .pentest-queue[data-queue="closed"] { box-shadow: inset 3px 0 0 var(--pspf-ok); }
    .pentest-queue__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pentest-queue__header h3 { margin: 0; font-size: 15px; }
    .pentest-finding-list { display: grid; gap: 8px; }
    .pentest-finding-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; background: var(--surface); display: grid; gap: 4px; }
    .pentest-finding-card header { display: flex; align-items: flex-start; gap: 8px; }
    .pentest-finding-card button { text-align: left; }
    .pentest-finding-card p { margin: 0; }
  </style>`;
}

function renderPspfGridView(model: PspfGridModel): string {
  const cells = model.cells
    .map(
      (cell) => `
      <article class="cc-grid-cell" data-assurance="${escapeHtml(cell.assuranceBandId)}">
        <header class="cc-grid-cell__header">
          <strong>${escapeHtml(cell.groupingLabel)}</strong>
          <span class="cc-assurance-pill" data-assurance="${escapeHtml(cell.assuranceBandId)}">${escapeHtml(cell.assuranceLabel)}</span>
        </header>
        <p class="cc-grid-cell__hint">${escapeHtml(cell.groupingHint)}</p>
        <div class="cc-grid-cell__bar" role="img" aria-label="${cell.metPercentage}% met">
          <span style="width:${cell.metPercentage}%"></span>
        </div>
        <dl class="cc-grid-cell__stats">
          <div><dt>Met</dt><dd>${cell.metPercentage}%</dd></div>
          <div><dt>Evidence</dt><dd>${cell.evidenceCoverage}%</dd></div>
          <div><dt>Requirements</dt><dd>${cell.applicable}</dd></div>
          <div><dt>Recent updates</dt><dd>${cell.recentlyUpdated}</dd></div>
        </dl>
      </article>`
    )
    .join("");
  const legend = CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS.map(
    (band) => `<span class="cc-assurance-pill" data-assurance="${escapeHtml(band.id)}">${escapeHtml(band.label)}</span>`
  ).join("");
  const milestones = model.milestones.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return shellHtml(
    "PSPF Grid View",
    `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 4</p>
      <h1>PSPF Grid View</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Grouped PSPF obligations, current assurance, and recent progress for the in-scope cyber and information governance domains.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Met, excl N/A", `${model.overallMetPercentage}%`)}
        ${metricCard("Evidence, excl N/A", `${model.overallEvidenceCoverage}%`)}
        ${metricCard("Requirements in scope", model.applicable)}
        ${metricCard("Requirements met", model.met)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.openMasterDashboard">Master Dashboard</button>
        <button type="button" data-command="pspf.workshop.openEssentialEightDashboard">Essential Eight</button>
        <button type="button" data-command="pspf.workshop.copyPostureBrief">Copy posture brief</button>
      </div>
    </section>
    <section>
      <h2>Domain Grid</h2>
      <p class="muted">Each grouping shows current assurance using fixed labels. Bands: ${legend}</p>
      <div class="cc-grid">${cells}</div>
    </section>
    <section>
      <h2>Recent Progress</h2>
      <ul class="cc-milestones">${milestones}</ul>
    </section>
  `
  );
}

function continuousComplianceStyles(): string {
  return `<style>
    .cc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .cc-grid-cell { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 8px; align-content: start; }
    .cc-grid-cell__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cc-grid-cell__header strong { font-size: 14px; }
    .cc-grid-cell__hint { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.4; }
    .cc-grid-cell__bar { height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--border) 60%, transparent); overflow: hidden; }
    .cc-grid-cell__bar span { display: block; height: 100%; border-radius: 999px; background: var(--workshop-blue); }
    .cc-grid-cell__stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; margin: 0; }
    .cc-grid-cell__stats div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .cc-grid-cell__stats dt { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; margin: 0; }
    .cc-grid-cell__stats dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
    .cc-assurance-pill { display: inline-block; border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 700; white-space: nowrap; background: var(--surface); }
    .cc-assurance-pill[data-assurance="established"] { color: var(--pspf-ok); border-color: color-mix(in srgb, var(--pspf-ok) 55%, var(--border)); background: var(--pspf-ok-soft); }
    .cc-assurance-pill[data-assurance="progressing"] { color: var(--workshop-blue); border-color: color-mix(in srgb, var(--workshop-blue) 55%, var(--border)); background: var(--workshop-blue-soft); }
    .cc-assurance-pill[data-assurance="emerging"] { color: var(--pspf-warn); border-color: color-mix(in srgb, var(--pspf-warn) 55%, var(--border)); background: var(--pspf-warn-soft); }
    .cc-assurance-pill[data-assurance="early"] { color: var(--pspf-warn); border-color: color-mix(in srgb, var(--pspf-warn) 40%, var(--border)); }
    .cc-assurance-pill[data-assurance="not-started"] { color: var(--muted); }
    .cc-grid-cell[data-assurance="established"] { box-shadow: inset 3px 0 0 var(--pspf-ok); }
    .cc-grid-cell[data-assurance="progressing"] { box-shadow: inset 3px 0 0 var(--workshop-blue); }
    .cc-grid-cell[data-assurance="emerging"], .cc-grid-cell[data-assurance="early"] { box-shadow: inset 3px 0 0 var(--pspf-warn); }
    .cc-grid-cell[data-assurance="not-started"] { box-shadow: inset 3px 0 0 var(--border); }
    .cc-milestones { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
    .cc-milestones li { line-height: 1.45; }
    .cc-outcome-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .cc-outcome-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 10px; align-content: start; }
    .cc-outcome-card__header { display: grid; gap: 2px; }
    .cc-outcome-card__header .eyebrow { margin: 0; }
    .cc-outcome-card__header h3 { margin: 0; font-size: 15px; line-height: 1.35; }
    .cc-risk-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .cc-risk-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .cc-risk-item__body { display: grid; gap: 2px; }
    .cc-risk-item__body strong { font-size: 13.5px; line-height: 1.35; }
    .cc-risk-item__meta { color: var(--muted); font-size: 12px; }
    .cc-severity-pill { display: inline-block; border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 700; white-space: nowrap; background: var(--surface); }
    .cc-severity-pill[data-severity="high"] { color: var(--pspf-warn); border-color: color-mix(in srgb, var(--pspf-warn) 55%, var(--border)); background: var(--pspf-warn-soft); }
    .cc-severity-pill[data-severity="medium"] { color: var(--workshop-blue); border-color: color-mix(in srgb, var(--workshop-blue) 55%, var(--border)); background: var(--workshop-blue-soft); }
    .cc-severity-pill[data-severity="low"] { color: var(--pspf-ok); border-color: color-mix(in srgb, var(--pspf-ok) 55%, var(--border)); background: var(--pspf-ok-soft); }
    .cc-risk-matrix-wrap { overflow-x: auto; }
    .cc-risk-matrix { width: 100%; min-width: 560px; table-layout: fixed; border-collapse: separate; border-spacing: 4px; }
    .cc-risk-matrix th, .cc-risk-matrix td { position: static; border: 0; border-radius: var(--radius-sm); padding: 8px; text-align: center; vertical-align: middle; }
    .cc-risk-matrix th { background: transparent; color: var(--muted); font-size: 11.5px; }
    .cc-risk-matrix__axis { width: 5.5rem; }
    .cc-risk-matrix__cell { border: 1px solid var(--border); font-variant-numeric: tabular-nums; }
    .cc-risk-matrix__cell strong { display: block; color: var(--text); font-size: 18px; line-height: 1.1; }
    .cc-risk-matrix__cell span { display: block; margin-top: 3px; color: var(--muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    .cc-risk-matrix__cell[data-band="green"] { background: var(--pspf-ok-soft); border-color: color-mix(in srgb, var(--pspf-ok) 55%, var(--border)); }
    .cc-risk-matrix__cell[data-band="amber"] { background: var(--pspf-warn-soft); border-color: color-mix(in srgb, var(--pspf-warn) 55%, var(--border)); }
    .cc-risk-matrix__cell[data-band="red"] { background: var(--pspf-danger-soft); border-color: color-mix(in srgb, var(--pspf-danger) 55%, var(--border)); }
    .cc-metro-hub { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; padding: 8px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-strong); margin-bottom: 12px; }
    .cc-metro-hub__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--workshop-blue); box-shadow: 0 0 0 3px var(--workshop-blue-soft); }
    .cc-metro { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .cc-metro-line { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 10px; align-content: start; --metro-colour: var(--workshop-blue); }
    .cc-metro-line[data-line="0"] { --metro-colour: var(--workshop-blue); }
    .cc-metro-line[data-line="1"] { --metro-colour: var(--pspf-ok); }
    .cc-metro-line[data-line="2"] { --metro-colour: var(--pspf-warn); }
    .cc-metro-line[data-line="3"] { --metro-colour: #8a63d2; }
    .cc-metro-line[data-line="4"] { --metro-colour: #d2638a; }
    .cc-metro-line[data-line="5"] { --metro-colour: #2aa6a0; }
    .cc-metro-line__header { display: flex; align-items: flex-start; gap: 10px; }
    .cc-metro-line__marker { width: 10px; height: 10px; border-radius: 3px; background: var(--metro-colour); margin-top: 4px; flex: none; }
    .cc-metro-line__header strong { display: block; font-size: 14px; }
    .cc-metro-line__meta { color: var(--muted); font-size: 12px; }
    .cc-metro-stations { list-style: none; margin: 0; padding: 0 0 0 4px; display: grid; gap: 0; border-left: 3px solid var(--metro-colour); margin-left: 4px; }
    .cc-metro-station { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0 6px 10px; position: relative; }
    .cc-metro-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--surface); border: 3px solid var(--metro-colour); margin-left: -16px; margin-top: 2px; flex: none; }
    .cc-metro-station__body { display: grid; gap: 1px; }
    .cc-metro-station__body strong { font-size: 13px; line-height: 1.35; }
    .cc-metro-station__meta { color: var(--muted); font-size: 11.5px; }
    .cc-metro-empty { margin: 0; }
    .cc-team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .cc-team-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 10px; align-content: start; }
    .cc-team-card__header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .cc-team-card__header strong { font-size: 14px; }
    .cc-team-card__count { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .cc-team-functions { display: flex; flex-wrap: wrap; gap: 6px; }
    .cc-team-function { display: inline-block; border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 600; background: var(--surface); }
    .cc-team-services { list-style: disc; margin: 0; padding-left: 18px; display: grid; gap: 4px; }
    .cc-team-services li { font-size: 12.5px; line-height: 1.4; }
    .cc-coverage-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .cc-coverage-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .cc-coverage-row[data-covered="yes"] { box-shadow: inset 3px 0 0 var(--pspf-ok); }
    .cc-coverage-row[data-covered="no"] { box-shadow: inset 3px 0 0 var(--pspf-warn); }
    .cc-coverage-status { font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 2px 9px; border: 1px solid var(--border); white-space: nowrap; }
    .cc-coverage-row[data-covered="yes"] .cc-coverage-status { color: var(--pspf-ok); background: var(--pspf-ok-soft); border-color: color-mix(in srgb, var(--pspf-ok) 55%, var(--border)); }
    .cc-coverage-row[data-covered="no"] .cc-coverage-status { color: var(--pspf-warn); background: var(--pspf-warn-soft); border-color: color-mix(in srgb, var(--pspf-warn) 55%, var(--border)); }
    .cc-coverage-body { display: grid; gap: 1px; }
    .cc-coverage-body strong { font-size: 13px; }
    .cc-coverage-meta { color: var(--muted); font-size: 12px; }
    .cc-theme-grid, .cc-message-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .cc-theme-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 4px; align-content: start; }
    .cc-theme-card strong { font-size: 14px; }
    .cc-theme-card p { margin: 0; line-height: 1.45; }
    .cc-translation-list { margin: 0; display: grid; gap: 8px; }
    .cc-translation-row { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .cc-translation-row dt { margin: 0; font-weight: 700; font-size: 13px; }
    .cc-translation-row dd { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
    .cc-message-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); display: grid; gap: 8px; align-content: start; }
    .cc-message-card__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cc-message-card__header strong { font-size: 13.5px; }
    .cc-message-card__body { margin: 0; line-height: 1.5; font-size: 13px; }
    .cc-support-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .cc-support-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .cc-support-item[data-support="blocked"] { box-shadow: inset 3px 0 0 var(--pspf-warn); }
    .cc-support-item[data-support="overdue"] { box-shadow: inset 3px 0 0 var(--pspf-warn); }
    .cc-support-item[data-support="due-soon"] { box-shadow: inset 3px 0 0 var(--workshop-blue); }
    .cc-support-flag { font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 2px 9px; border: 1px solid var(--border); white-space: nowrap; background: var(--surface-strong); }
    .cc-support-item[data-support="blocked"] .cc-support-flag, .cc-support-item[data-support="overdue"] .cc-support-flag { color: var(--pspf-warn); background: var(--pspf-warn-soft); border-color: color-mix(in srgb, var(--pspf-warn) 55%, var(--border)); }
    .cc-support-item[data-support="due-soon"] .cc-support-flag { color: var(--workshop-blue); background: var(--workshop-blue-soft); border-color: color-mix(in srgb, var(--workshop-blue) 55%, var(--border)); }
    .cc-support-body { display: grid; gap: 1px; text-align: left; background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit; }
    .cc-support-body strong { font-size: 13px; }
    .cc-support-meta { color: var(--muted); font-size: 12px; }
  </style>`;
}

async function openHumanCentredRiskView(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfHumanCentredRiskView",
    "Human-Centred Risk View",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderHumanCentredRiskView(buildHumanCentredRiskModel(await listAllEntities()));
  });
  panel.webview.html = renderHumanCentredRiskView(buildHumanCentredRiskModel(await listAllEntities()));
}

function renderHumanCentredRiskItem(item: {
  readonly title: string;
  readonly severityId: string;
  readonly severityLabel: string;
  readonly statusLabel: string;
  readonly treatmentLabel: string;
  readonly linkedActions: number;
}): string {
  const actionsNote =
    item.linkedActions > 0
      ? `${item.linkedActions} linked action${item.linkedActions === 1 ? "" : "s"}`
      : "No linked actions yet";
  return `
    <li class="cc-risk-item">
      <span class="cc-severity-pill" data-severity="${escapeHtml(item.severityId)}">${escapeHtml(item.severityLabel)}</span>
      <div class="cc-risk-item__body">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="cc-risk-item__meta">${escapeHtml(item.statusLabel)} · ${escapeHtml(item.treatmentLabel)} · ${escapeHtml(actionsNote)}</span>
      </div>
    </li>`;
}

function renderHumanCentredRiskMatrix(model: HumanCentredRiskModel): string {
  const rows = [5, 4, 3, 2, 1]
    .map((impact) => {
      const cells = [1, 2, 3, 4, 5]
        .map((likelihood) => {
          const cell = model.riskMatrix.find(
            (candidate) => candidate.impact === impact && candidate.likelihood === likelihood
          );
          const riskCount = cell?.riskCount ?? 0;
          const band = cell?.band ?? "green";
          return `<td class="cc-risk-matrix__cell" data-band="${escapeHtml(band)}"><strong>${riskCount}</strong><span>${escapeHtml(
            band
          )}</span></td>`;
        })
        .join("");
      return `<tr><th scope="row">Impact ${impact}</th>${cells}</tr>`;
    })
    .join("");
  return `<section>
    <h2>Impact v Likelihood Matrix</h2>
    <p class="muted">Risk count by score. Green is low exposure, amber is medium exposure, and red is high exposure.</p>
    <div class="cc-risk-matrix-wrap">
      <table class="cc-risk-matrix" aria-label="Risk matrix showing impact by likelihood">
        <thead><tr><th class="cc-risk-matrix__axis" scope="col">Impact</th><th scope="col">Likelihood 1</th><th scope="col">Likelihood 2</th><th scope="col">Likelihood 3</th><th scope="col">Likelihood 4</th><th scope="col">Likelihood 5</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderHumanCentredRiskView(model: HumanCentredRiskModel): string {
  const groups = model.groups
    .map(
      (group) => `
      <article class="cc-outcome-card">
        <header class="cc-outcome-card__header">
          <p class="eyebrow">${escapeHtml(group.capabilityArea)}</p>
          <h3>${escapeHtml(group.outcomeStatement)}</h3>
        </header>
        <ul class="cc-risk-list">${group.risks.map(renderHumanCentredRiskItem).join("")}</ul>
      </article>`
    )
    .join("");
  const unassigned =
    model.unassigned.length > 0
      ? `
    <section>
      <h2>Risks Not Yet Tied To A Business Outcome</h2>
      <p class="muted">Connect each risk to a strategic outcome so leaders can see what is at stake in plain terms.</p>
      <ul class="cc-risk-list">${model.unassigned.map(renderHumanCentredRiskItem).join("")}</ul>
    </section>`
      : "";
  const legend = CONTINUOUS_COMPLIANCE_RISK_SEVERITIES.map(
    (band) => `<span class="cc-severity-pill" data-severity="${escapeHtml(band.id)}">${escapeHtml(band.label)}</span>`
  ).join("");
  const groupsBlock =
    model.groups.length > 0
      ? `<div class="cc-outcome-grid">${groups}</div>`
      : `<p class="muted">No business outcomes have linked risks yet. Open the Strategy Map to connect strategic outcomes to the risks that threaten them.</p>`;
  return shellHtml(
    "Human-Centred Risk View",
    `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 1</p>
      <h1>Human-Centred Risk View</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · What business outcome is at risk, the specific risk, and how it is being treated — described for people, not auditors.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Risks in view", model.counts.total)}
        ${metricCard("High severity", model.counts.high)}
        ${metricCard("Treatment underway", model.treated)}
        ${metricCard("No treatment yet", model.untreated)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
        <button type="button" data-command="pspf.workshop.openConnectedView">Connected View</button>
        <button type="button" data-command="pspf.workshop.createRisk">Create risk</button>
      </div>
    </section>
    ${renderHumanCentredRiskMatrix(model)}
    <section>
      <h2>Outcomes At Risk</h2>
      <p class="muted">Severity bands: ${legend}</p>
      ${groupsBlock}
    </section>
    ${unassigned}
  `
  );
}

async function openContinuousComplianceMetro(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfContinuousComplianceMetro",
    "Continuous Compliance Metro",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderContinuousComplianceMetro(buildContinuousComplianceMetroModel(await listAllEntities()));
  });
  panel.webview.html = renderContinuousComplianceMetro(buildContinuousComplianceMetroModel(await listAllEntities()));
}

function renderContinuousComplianceMetro(model: ContinuousComplianceMetroModel): string {
  const lines = model.lines
    .map((line, index) => {
      const stations = line.stations
        .map(
          (station) => `
          <li class="cc-metro-station">
            <span class="cc-metro-dot" aria-hidden="true"></span>
            <div class="cc-metro-station__body">
              <strong>${escapeHtml(station.label)}</strong>
              <span class="cc-metro-station__meta">${station.measures} measure${station.measures === 1 ? "" : "s"} · ${station.references} link${station.references === 1 ? "" : "s"}</span>
            </div>
          </li>`
        )
        .join("");
      const stationsBlock =
        line.stations.length > 0
          ? `<ul class="cc-metro-stations">${stations}</ul>`
          : `<p class="muted cc-metro-empty">No functional outputs mapped yet. Add outcomes to this strategic choice.</p>`;
      return `
      <article class="cc-metro-line" data-line="${index % 6}">
        <header class="cc-metro-line__header">
          <span class="cc-metro-line__marker" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(line.capabilityArea)}</strong>
            <span class="cc-metro-line__meta">${escapeHtml(trendIndicator(line.trend as StrategyEntity["choices"][number]["trend"]))} · ${escapeHtml(label(line.confidence))} confidence · target ${escapeHtml(line.targetPosture)}</span>
          </div>
        </header>
        ${stationsBlock}
      </article>`;
    })
    .join("");
  const linesBlock =
    model.lines.length > 0
      ? `<div class="cc-metro">${lines}</div>`
      : `<p class="muted">No capability lines yet. Open the Strategy Map to author strategic choices and their outcomes, then return to see the capability metro.</p>`;
  return shellHtml(
    "Continuous Compliance Metro",
    `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 6</p>
      <h1>Continuous Compliance Metro</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · The capability landscape that supports continuous compliance, mapped as connected lines and stations around a central hub.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Central hub", "GRC")}
        ${metricCard("Capability lines", model.totalCapabilities)}
        ${metricCard("Functional stations", model.totalStations)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
        <button type="button" data-command="pspf.workshop.openPspfGridView">PSPF Grid View</button>
      </div>
    </section>
    <section>
      <div class="cc-metro-hub"><span class="cc-metro-hub__dot" aria-hidden="true"></span>${escapeHtml(model.hub)}</div>
      ${linesBlock}
    </section>
  `
  );
}

async function openUnifiedSecurityOperatingModel(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfUnifiedSecurityOperatingModel",
    "Unified Security Operating Model",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderUnifiedSecurityOperatingModel(
      buildUnifiedSecurityOperatingModel(await listAllEntities())
    );
  });
  panel.webview.html = renderUnifiedSecurityOperatingModel(buildUnifiedSecurityOperatingModel(await listAllEntities()));
}

function renderUnifiedSecurityOperatingModel(model: UnifiedSecurityOperatingModel): string {
  const teams = model.teams
    .map((team) => {
      const services =
        team.services.length > 0
          ? `<ul class="cc-team-services">${team.services
              .map((service) => `<li>${escapeHtml(service.label)}</li>`)
              .join("")}</ul>`
          : `<p class="muted cc-metro-empty">No services mapped yet.</p>`;
      const functions =
        team.capabilityAreas.length > 0
          ? team.capabilityAreas
              .map((capability) => `<span class="cc-team-function">${escapeHtml(capability)}</span>`)
              .join("")
          : `<span class="muted">No capability areas recorded</span>`;
      return `
      <article class="cc-team-card">
        <header class="cc-team-card__header">
          <strong>${escapeHtml(team.name)}</strong>
          <span class="cc-team-card__count">${team.services.length} service${team.services.length === 1 ? "" : "s"}</span>
        </header>
        <div class="cc-team-functions">${functions}</div>
        ${services}
      </article>`;
    })
    .join("");
  const coverage = model.coverage
    .map(
      (item) => `
      <li class="cc-coverage-row" data-covered="${item.covered ? "yes" : "no"}">
        <span class="cc-coverage-status">${item.covered ? "Covered" : "Gap"}</span>
        <div class="cc-coverage-body">
          <strong>${escapeHtml(item.label)}</strong>
          <span class="cc-coverage-meta">${item.covered ? escapeHtml(item.teams.join(", ")) : "No team currently owns this function"}</span>
        </div>
      </li>`
    )
    .join("");
  const teamsBlock =
    model.teams.length > 0
      ? `<div class="cc-team-grid">${teams}</div>`
      : `<p class="muted">No teams or owners are mapped yet. Add an executive owner to each strategic choice on the Strategy Map to populate the operating model.</p>`;
  const unmapped =
    model.unmappedCapabilities.length > 0
      ? `<section>
      <h2>Capabilities Outside The Standard Functions</h2>
      <p class="muted">These capability areas did not match a standard security function. Review the wording or treat them as bespoke functions.</p>
      <div class="cc-team-functions">${model.unmappedCapabilities
        .map((capability) => `<span class="cc-team-function">${escapeHtml(capability)}</span>`)
        .join("")}</div>
    </section>`
      : "";
  return shellHtml(
    "Unified Security Operating Model",
    `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 5</p>
      <h1>Unified Security Operating Model</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Which teams deliver which security functions and outcomes, with coverage and gaps visible on one page.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Teams in scope", model.teams.length)}
        ${metricCard("Functions covered", `${model.coveredFunctions}/${model.coverage.length}`)}
        ${metricCard("Coverage gaps", model.gapFunctions)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.openStrategyMap">Strategy Map</button>
        <button type="button" data-command="pspf.workshop.openContinuousComplianceMetro">Capability Metro</button>
      </div>
    </section>
    <section>
      <h2>Teams And Their Functions</h2>
      ${teamsBlock}
    </section>
    <section>
      <h2>Function Coverage</h2>
      <p class="muted">Standard security functions in fixed order. Gaps show where no team currently owns a function.</p>
      <ul class="cc-coverage-list">${coverage}</ul>
    </section>
    ${unmapped}
  `
  );
}

async function openCyberAwarenessChangeStrategy(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfCyberAwarenessChangeStrategy",
    "Cyber Awareness Change Strategy",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    panel.webview.html = renderCyberAwarenessChangeStrategy(
      buildCyberAwarenessChangeStrategyModel(await listAllEntities())
    );
  });
  panel.webview.html = renderCyberAwarenessChangeStrategy(
    buildCyberAwarenessChangeStrategyModel(await listAllEntities())
  );
}

function renderCyberAwarenessChangeStrategy(model: CyberAwarenessChangeStrategyModel): string {
  const themeLabel = new Map(model.themes.map((theme) => [theme.id, theme.label] as const));
  const themes = model.themes
    .map(
      (theme) => `
      <article class="cc-theme-card">
        <strong>${escapeHtml(theme.label)}</strong>
        <p class="muted">${escapeHtml(theme.summary)}</p>
      </article>`
    )
    .join("");
  const translations = model.translations
    .map(
      (item) => `
      <div class="cc-translation-row">
        <dt>${escapeHtml(item.term)}</dt>
        <dd>${escapeHtml(item.plain)}</dd>
      </div>`
    )
    .join("");
  const messages = model.messageBlocks
    .map(
      (block) => `
      <article class="cc-message-card">
        <header class="cc-message-card__header">
          <strong>${escapeHtml(block.scenario)}</strong>
          <span class="cc-team-function">${escapeHtml(themeLabel.get(block.themeId) ?? block.themeId)}</span>
        </header>
        <p class="cc-message-card__body">${escapeHtml(block.message)}</p>
      </article>`
    )
    .join("");
  return shellHtml(
    "Cyber Awareness Change Strategy",
    `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 3</p>
      <h1>Cyber Awareness Change Strategy</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Reusable themes, plain-language translations, and adaptable message blocks so cyber change communication stays clear and consistent.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Core themes", model.themes.length)}
        ${metricCard("Term translations", model.translations.length)}
        ${metricCard("Message blocks", model.messageBlocks.length)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.openCsoMagazine">Digital CSO Magazine</button>
      </div>
    </section>
    <section>
      <h2>Core Themes</h2>
      <div class="cc-theme-grid">${themes}</div>
    </section>
    <section>
      <h2>Plain-Language Translations</h2>
      <p class="muted">Use these accessible explanations in place of specialist terms.</p>
      <dl class="cc-translation-list">${translations}</dl>
    </section>
    <section>
      <h2>Reusable Message Blocks</h2>
      <p class="muted">Adapt the wording to the forum, then reuse it so the same themes carry across every channel.</p>
      <div class="cc-message-grid">${messages}</div>
    </section>
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
    ${essentialEightVisualStyles()}
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
    <section class="e8-visuals" aria-labelledby="e8-visual-heading">
      <h2 id="e8-visual-heading">Visual Posture</h2>
      <div class="e8-chart-grid">
        ${renderEssentialEightComplianceDonut(model)}
        ${renderEssentialEightEvidenceChart(model)}
        ${renderEssentialEightStrategyChart(model)}
      </div>
    </section>
    ${recordTable("E8 Strategy Tracker", model.strategyRows, ["strategy", "target", "status", "requirements", "met", "evidence", "ismMappings", "openActions", "openRisks", "nextStep"], "e8-strategy-tracker")}
    ${recordTable("E8 Uplift Plan", model.planRows, ["title", "strategy", "status", "urgency", "startDate", "endDate", "dueDate", "impact", "linkedRequirements"])}
    ${recordTable("E8 Requirements To Review", model.requirementRows, ["title", "status", "evidence", "actions", "risks", "ismMappings"])}
  `
  );
}

function essentialEightVisualStyles(): string {
  return `<style>
    .e8-chart-grid { display: grid; grid-template-columns: minmax(220px, 0.9fr) minmax(260px, 1fr) minmax(260px, 1fr); gap: 14px; align-items: stretch; }
    .e8-chart-card { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); background: var(--surface-strong); min-width: 0; }
    .e8-chart-card h3 { margin-top: 0; }
    .e8-donut-wrap { display: grid; grid-template-columns: 148px 1fr; gap: 14px; align-items: center; }
    .e8-donut { width: 148px; aspect-ratio: 1; border-radius: 50%; background: conic-gradient(var(--pspf-ok) 0 var(--e8-met), var(--workshop-blue) var(--e8-met) var(--e8-progress), var(--amber) var(--e8-progress) var(--e8-partial), var(--pspf-danger) var(--e8-partial) var(--e8-not-met), var(--muted) var(--e8-not-met) 100%); position: relative; box-shadow: inset 0 0 0 1px var(--border); }
    .e8-donut::after { content: ""; position: absolute; inset: 26px; border-radius: 50%; background: var(--surface-strong); box-shadow: inset 0 0 0 1px var(--border); }
    .e8-donut-centre { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; z-index: 1; font-variant-numeric: tabular-nums; }
    .e8-donut-centre strong { display: block; font-size: 28px; line-height: 1; }
    .e8-donut-centre span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .e8-legend { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .e8-legend li { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; }
    .e8-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 7px; background: var(--swatch); }
    .e8-bars { display: grid; gap: 12px; }
    .e8-bar-row { display: grid; gap: 5px; }
    .e8-bar-row header { display: flex; justify-content: space-between; gap: 10px; padding: 0; border: 0; background: transparent; font-size: 12.5px; }
    .e8-bar-row header strong, .e8-bar-row header span { display: inline; font-size: inherit; line-height: inherit; color: inherit; letter-spacing: 0; }
    .e8-bar { height: 14px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); overflow: hidden; display: flex; }
    .e8-bar span { display: block; min-width: 0; background: var(--swatch); }
    .e8-bar-stack span + span { box-shadow: inset 1px 0 0 color-mix(in srgb, var(--surface) 55%, transparent); }
    .e8-chart-note { color: var(--muted); font-size: 12px; margin-bottom: 0; }
    .e8-strategy-tracker table { min-width: 92rem; table-layout: fixed; }
    .e8-strategy-tracker th[data-field="strategy"], .e8-strategy-tracker td[data-field="strategy"] { width: 22rem; min-width: 22rem; max-width: 34rem; }
    .e8-strategy-tracker th[data-field="target"], .e8-strategy-tracker td[data-field="target"] { width: 5.5rem; }
    .e8-strategy-tracker th[data-field="status"], .e8-strategy-tracker td[data-field="status"] { width: 8rem; }
    .e8-strategy-tracker th[data-field="requirements"], .e8-strategy-tracker td[data-field="requirements"] { width: 7rem; }
    .e8-strategy-tracker th[data-field="met"], .e8-strategy-tracker td[data-field="met"] { width: 6rem; }
    .e8-strategy-tracker th[data-field="evidence"], .e8-strategy-tracker td[data-field="evidence"] { width: 6.5rem; }
    .e8-strategy-tracker th[data-field="ismMappings"], .e8-strategy-tracker td[data-field="ismMappings"] { width: 7rem; }
    .e8-strategy-tracker th[data-field="openActions"], .e8-strategy-tracker td[data-field="openActions"] { width: 7rem; }
    .e8-strategy-tracker th[data-field="openRisks"], .e8-strategy-tracker td[data-field="openRisks"] { width: 6.5rem; }
    .e8-strategy-tracker th[data-field="nextStep"], .e8-strategy-tracker td[data-field="nextStep"] { width: 17rem; max-width: 22rem; }
    .e8-strategy-tracker th[data-field="target"], .e8-strategy-tracker td[data-field="target"], .e8-strategy-tracker th[data-field="status"], .e8-strategy-tracker td[data-field="status"], .e8-strategy-tracker th[data-field="requirements"], .e8-strategy-tracker td[data-field="requirements"], .e8-strategy-tracker th[data-field="met"], .e8-strategy-tracker td[data-field="met"], .e8-strategy-tracker th[data-field="evidence"], .e8-strategy-tracker td[data-field="evidence"], .e8-strategy-tracker th[data-field="ismMappings"], .e8-strategy-tracker td[data-field="ismMappings"], .e8-strategy-tracker th[data-field="openActions"], .e8-strategy-tracker td[data-field="openActions"], .e8-strategy-tracker th[data-field="openRisks"], .e8-strategy-tracker td[data-field="openRisks"] { white-space: nowrap; overflow-wrap: normal; font-variant-numeric: tabular-nums; }
    @media (max-width: 820px) { .e8-chart-grid, .e8-donut-wrap { grid-template-columns: 1fr; } .e8-donut { margin: 0 auto; } }
  </style>`;
}

function renderEssentialEightComplianceDonut(model: EssentialEightDashboardModel): string {
  const counts = model.statusCounts;
  const total = Math.max(counts.total, 1);
  const metEnd = percent(counts.met, total);
  const progressEnd = percent(counts.met + counts.inProgress + counts.underReview, total);
  const partialEnd = percent(counts.met + counts.inProgress + counts.underReview + counts.partiallyMet, total);
  const notMetEnd = percent(
    counts.met + counts.inProgress + counts.underReview + counts.partiallyMet + counts.notMet,
    total
  );
  const donutLabel = `${model.metrics.metPercentage}% of applicable Essential Eight requirements are met. ${counts.met} met, ${counts.inProgress + counts.underReview} in progress or under review, ${counts.partiallyMet} partially met, ${counts.notMet} not met, ${counts.notApplicable} not applicable.`;
  const legend = [
    { label: "Met", value: counts.met, swatch: "var(--pspf-ok)" },
    { label: "In progress / review", value: counts.inProgress + counts.underReview, swatch: "var(--workshop-blue)" },
    { label: "Partially met", value: counts.partiallyMet, swatch: "var(--amber)" },
    { label: "Not met", value: counts.notMet, swatch: "var(--pspf-danger)" },
    { label: "N/A", value: counts.notApplicable, swatch: "var(--muted)" }
  ];
  return `<article class="e8-chart-card">
    <h3>Compliance Status</h3>
    <div class="e8-donut-wrap">
      <div class="e8-donut" role="img" aria-label="${escapeHtml(donutLabel)}" style="--e8-met: ${metEnd}%; --e8-progress: ${progressEnd}%; --e8-partial: ${partialEnd}%; --e8-not-met: ${notMetEnd}%;">
        <div class="e8-donut-centre"><strong>${model.metrics.metPercentage}%</strong><span>met</span></div>
      </div>
      <ul class="e8-legend">
        ${legend.map((item) => `<li><span><i style="--swatch: ${item.swatch};"></i>${escapeHtml(item.label)}</span><strong>${item.value}</strong></li>`).join("")}
      </ul>
    </div>
  </article>`;
}

function renderEssentialEightEvidenceChart(model: EssentialEightDashboardModel): string {
  const covered = model.statusCounts.evidenceCovered;
  const missing = Math.max(model.statusCounts.applicable - covered, 0);
  return `<article class="e8-chart-card">
    <h3>Evidence Coverage</h3>
    <div class="e8-bars">
      ${e8BarRow("Evidence linked", covered, model.statusCounts.applicable, "var(--pspf-ok)")}
      ${e8BarRow("Needs evidence", missing, model.statusCounts.applicable, "var(--amber)")}
    </div>
    <p class="e8-chart-note">Applicable E8 requirements only; ${model.metrics.notApplicable} not-applicable requirement${model.metrics.notApplicable === 1 ? "" : "s"} excluded.</p>
  </article>`;
}

function renderEssentialEightStrategyChart(model: EssentialEightDashboardModel): string {
  const counts = model.strategyStatusCounts;
  const total = Math.max(ESSENTIAL_EIGHT_STRATEGIES.length, 1);
  const segments = [
    { label: "Met", value: counts.met, swatch: "var(--pspf-ok)" },
    { label: "In progress", value: counts.inProgress, swatch: "var(--workshop-blue)" },
    { label: "Needs uplift", value: counts.needsUplift, swatch: "var(--amber)" },
    { label: "Not started", value: counts.notStarted, swatch: "var(--pspf-danger)" }
  ];
  return `<article class="e8-chart-card">
    <h3>Strategy Readiness</h3>
    <div class="e8-bar e8-bar-stack" role="img" aria-label="${escapeHtml(`${counts.met} Essential Eight strategies met, ${counts.inProgress} in progress, ${counts.needsUplift} need uplift, ${counts.notStarted} not started.`)}">
      ${segments.map((segment) => `<span title="${escapeHtml(`${segment.label}: ${segment.value}`)}" style="--swatch: ${segment.swatch}; width: ${percent(segment.value, total)}%;"></span>`).join("")}
    </div>
    <ul class="e8-legend">
      ${segments.map((segment) => `<li><span><i style="--swatch: ${segment.swatch};"></i>${escapeHtml(segment.label)}</span><strong>${segment.value}</strong></li>`).join("")}
    </ul>
  </article>`;
}

function e8BarRow(labelText: string, value: number, total: number, swatch: string): string {
  return `<div class="e8-bar-row">
    <header><span>${escapeHtml(labelText)}</span><strong>${value} of ${total}</strong></header>
    <div class="e8-bar" role="img" aria-label="${escapeHtml(`${labelText}: ${value} of ${total}`)}"><span style="--swatch: ${swatch}; width: ${percent(value, total)}%;"></span></div>
  </div>`;
}

async function openPlanOfActionBoard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const teamDates = await loadPubTeamPlanDates();
  const model = buildPlanOfActionBoardModel(enrichActionsWithImpact(allEntities), {
    timelineDateHints: teamDates.map((item) => ({ startDate: item.startDate, endDate: item.endDate }))
  });
  const panel = vscode.window.createWebviewPanel(
    "pspfPlanOfActionBoard",
    "PSPF Plan of Action",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wireWorkshopPanelMessages(panel, async () => {
    const refreshedEntities = await listAllEntities();
    const refreshedTeamDates = await loadPubTeamPlanDates();
    panel.webview.html = renderPlanOfActionBoard(
      buildPlanOfActionBoardModel(enrichActionsWithImpact(refreshedEntities), {
        timelineDateHints: refreshedTeamDates.map((item) => ({ startDate: item.startDate, endDate: item.endDate }))
      }),
      refreshedTeamDates
    );
  });
  panel.webview.html = renderPlanOfActionBoard(model, teamDates);
}

interface PubTeamPlanDate {
  readonly teamTitle: string;
  readonly title: string;
  readonly itemType: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly notes: string;
}

async function loadPubTeamPlanDates(): Promise<readonly PubTeamPlanDate[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }
  const pubStoreUri = vscode.Uri.joinPath(workspaceFolder.uri, ".pspf", "pub", "pub.json");
  try {
    const content = await vscode.workspace.fs.readFile(pubStoreUri);
    const parsed = JSON.parse(new TextDecoder().decode(content)) as { readonly teams?: readonly unknown[] };
    return (parsed.teams ?? []).flatMap(pubTeamPlanDatesFromTeam);
  } catch {
    return [];
  }
}

function pubTeamPlanDatesFromTeam(teamValue: unknown): readonly PubTeamPlanDate[] {
  if (typeof teamValue !== "object" || teamValue === null) {
    return [];
  }
  const team = teamValue as { readonly title?: unknown; readonly teamItems?: readonly unknown[] };
  const teamTitle = typeof team.title === "string" ? team.title : "Untitled team";
  return (team.teamItems ?? []).flatMap((itemValue) => {
    if (typeof itemValue !== "object" || itemValue === null) {
      return [];
    }
    const item = itemValue as {
      readonly title?: unknown;
      readonly itemType?: unknown;
      readonly startDate?: unknown;
      readonly endDate?: unknown;
      readonly includeInPlan?: unknown;
      readonly notes?: unknown;
    };
    if (item.includeInPlan !== true || typeof item.startDate !== "string" || item.startDate.trim().length === 0) {
      return [];
    }
    return [
      {
        teamTitle,
        title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Team date",
        itemType: typeof item.itemType === "string" && item.itemType.trim() ? item.itemType.trim() : "date",
        startDate: item.startDate.trim(),
        endDate: typeof item.endDate === "string" ? item.endDate.trim() : "",
        notes: typeof item.notes === "string" ? item.notes.trim() : ""
      }
    ];
  });
}

function renderPlanOfActionBoard(model: PlanOfActionBoardModel, teamDates: readonly PubTeamPlanDate[] = []): string {
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
    ${renderPlanOfActionScheduleControls(model)}
    <section data-poa-view-section="master">
      <h2>Master Schedule</h2>
      <p class="muted">One line per Action, preserving the full master view while workstream and status filters create a sliced schedule.</p>
      <div class="poa-master-range">
        <strong>${escapeHtml(model.timelineStart)}</strong>
        <span>to</span>
        <strong>${escapeHtml(model.timelineEnd)}</strong>
        <span>${model.totalDays} days · Today ${escapeHtml(model.today)}</span>
      </div>
      ${renderPlanOfActionMasterSchedule(model)}
      ${renderPlanOfActionTeamDateOverlay(model, teamDates)}
    </section>
    <section data-poa-view-section="integrated" hidden>
      <h2>Integrated Schedule</h2>
      <p class="muted">Compact combined view that packs Actions into the fewest practical lanes while keeping overlapping date ranges separated.</p>
      ${renderPlanOfActionIntegratedSchedule(model)}
    </section>
    <section data-poa-view-section="workstreams">
      <h2>Workstream Timeline</h2>
      <p class="muted">${escapeHtml(model.timelineStart)} to ${escapeHtml(model.timelineEnd)} · ${model.totalDays} days · adaptive width ${Math.round(model.dayWidth * 10) / 10}px/day</p>
      <div class="poa-timeline-legend" aria-label="Timeline legend">
        <span class="poa-today-legend-line" aria-hidden="true"></span>
        <span>Today: ${escapeHtml(model.today)}</span>
      </div>
      ${renderPlanOfActionTimeline(model)}
    </section>
    ${renderPlanOfActionSupportCallout(model)}
    ${renderPlanOfActionTeamDateConflicts(model, teamDates)}
    ${renderPlanOfActionWorklist(model)}
    ${planOfActionFilterScript()}
  `
  );
}

function renderPlanOfActionTeamDateOverlay(
  model: PlanOfActionBoardModel,
  teamDates: readonly PubTeamPlanDate[]
): string {
  if (teamDates.length === 0) {
    return `<p class="muted">No Pub team dates are marked for the Plan of Action yet.</p>`;
  }
  const bars = teamDates
    .map((item) => renderPlanOfActionTeamDateBar(model, item))
    .filter((value) => value.length > 0)
    .join("");
  return `<div class="poa-board poa-team-dates" style="--poa-width: ${model.timelineWidth}px;">
    <div class="poa-phase poa-team-date-schedule">
      <div class="poa-phase__header">
        <strong>Pub Team Dates</strong>
        <span>${teamDates.length} optional team-wide date${teamDates.length === 1 ? "" : "s"} from Pub, shown beside action work to expose calendar pressure.</span>
      </div>
      <div class="poa-track poa-team-date-track" style="width: ${model.timelineWidth}px;">
        ${bars || `<span class="muted">Team dates are outside the current schedule range.</span>`}
      </div>
    </div>
  </div>`;
}

function renderPlanOfActionTeamDateBar(model: PlanOfActionBoardModel, item: PubTeamPlanDate): string {
  const start = parsePlanDate(item.startDate);
  const end = parsePlanDate(item.endDate) ?? start;
  const timelineStart = parsePlanDate(model.timelineStart);
  if (!start || !end || !timelineStart) {
    return "";
  }
  const x = Math.max(0, Math.round(diffPlanDays(timelineStart, start) * model.dayWidth));
  const durationDays = Math.max(1, diffPlanDays(start <= end ? start : end, start <= end ? end : start) + 1);
  const width = Math.max(18, Math.round(durationDays * model.dayWidth));
  const labelText = `${item.teamTitle}: ${item.title}`;
  return `<span class="poa-team-date-bar" style="left: ${x}px; width: ${width}px;" title="${escapeHtml(`${labelText} · ${item.startDate}${item.endDate ? ` to ${item.endDate}` : ""}`)}"><strong>${escapeHtml(fitTeamDateLabel(labelText, width))}</strong><small>${escapeHtml(label(item.itemType))}</small></span>`;
}

function renderPlanOfActionTeamDateConflicts(
  model: PlanOfActionBoardModel,
  teamDates: readonly PubTeamPlanDate[]
): string {
  if (teamDates.length === 0) {
    return "";
  }
  const tasks = model.phases.flatMap((phase) => phase.tasks.map((task) => ({ task, phase })));
  const rows = teamDates
    .flatMap((teamDate) => {
      const dateStart = parsePlanDate(teamDate.startDate);
      const dateEnd = parsePlanDate(teamDate.endDate) ?? dateStart;
      if (!dateStart || !dateEnd) {
        return [];
      }
      const nearby = tasks.filter(({ task }) => {
        const taskStart = parsePlanDate(task.startDate);
        const taskEnd = parsePlanDate(task.endDate);
        return taskStart && taskEnd ? dateRangesWithinDays(dateStart, dateEnd, taskStart, taskEnd, 3) : false;
      });
      return nearby.length > 0
        ? nearby.map(({ task, phase }) => ({
            teamDate,
            actionTitle: task.title,
            stream: phase.title,
            actionDate: task.dueDate ?? task.endDate
          }))
        : [{ teamDate, actionTitle: "No nearby action date", stream: "-", actionDate: "-" }];
    })
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.teamDate.teamTitle)}</td><td>${escapeHtml(row.teamDate.title)}</td><td>${escapeHtml(row.teamDate.startDate)}${row.teamDate.endDate ? ` to ${escapeHtml(row.teamDate.endDate)}` : ""}</td><td>${escapeHtml(row.actionTitle)}</td><td>${escapeHtml(row.stream)}</td><td>${escapeHtml(row.actionDate)}</td></tr>`
    )
    .join("");
  return `<section>
    <h2>Pub Team Date Conflicts</h2>
    <p class="muted">Optional team-wide dates from Pub are checked against action ranges within three days. This is local planning context only.</p>
    <div class="table-wrap" tabindex="0" aria-label="Pub team date conflict table"><table><thead><tr><th>Team</th><th>Team date</th><th>Date</th><th>Nearby action</th><th>Stream</th><th>Action date</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function fitTeamDateLabel(labelText: string, width: number): string {
  const maxCharacters = Math.max(6, Math.floor((width - 12) / 6));
  return labelText.length <= maxCharacters ? labelText : `${labelText.slice(0, Math.max(3, maxCharacters - 3))}...`;
}

function dateRangesWithinDays(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date, days: number): boolean {
  return diffPlanDays(leftEnd, rightStart) <= days && diffPlanDays(rightEnd, leftStart) <= days;
}

function parsePlanDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function diffPlanDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function renderPlanOfActionSupportCallout(model: PlanOfActionBoardModel): string {
  const supportTasks = model.phases
    .flatMap((phase) => phase.tasks.map((task) => ({ task, stream: phase.title })))
    .filter(({ task }) => task.urgency === "blocked" || task.urgency === "overdue" || task.urgency === "due-soon")
    .sort((left, right) => supportUrgencyRank(left.task.urgency) - supportUrgencyRank(right.task.urgency));
  const body =
    supportTasks.length > 0
      ? `<ul class="cc-support-list">${supportTasks
          .map(({ task, stream }) => {
            const due = formatShortAuDateTime(task.dueDate) ?? "no date set";
            return `
        <li class="cc-support-item" data-support="${escapeHtml(task.urgency)}">
          <span class="cc-support-flag">${escapeHtml(supportNeedLabel(task.urgency))}</span>
          <button type="button" class="cc-support-body" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(task.actionId)}">
            <strong>${escapeHtml(task.title)}</strong>
            <span class="cc-support-meta">${escapeHtml(stream)} · ${escapeHtml(label(task.status))} · due ${escapeHtml(due)}</span>
          </button>
        </li>`;
          })
          .join("")}</ul>`
      : `<p class="muted">No blocked, overdue, or imminent work right now. Nothing is waiting on a decision, input, or resource.</p>`;
  return `
    ${continuousComplianceStyles()}
    <section>
      <p class="eyebrow">Continuous Compliance · Output 2</p>
      <h2>Support And Decisions Needed</h2>
      <p class="muted">Dependencies, decisions, inputs, and resource needs called out separately from the timeline, so managers can see where to act.</p>
      ${body}
    </section>`;
}

function supportUrgencyRank(urgency: string): number {
  if (urgency === "blocked") {
    return 0;
  }
  if (urgency === "overdue") {
    return 1;
  }
  return 2;
}

function supportNeedLabel(urgency: string): string {
  if (urgency === "blocked") {
    return "Decision or input needed";
  }
  if (urgency === "overdue") {
    return "Overdue — needs attention";
  }
  return "Due soon";
}

function renderPlanOfActionScheduleControls(model: PlanOfActionBoardModel): string {
  return `<section class="poa-controls" data-poa-controls>
    <div>
      <h2>Schedule View</h2>
      <div class="form-actions poa-view-toggle" data-poa-view-toggle>
        <button type="button" class="poa-status-filter" data-poa-view="master" aria-pressed="true">Master schedule</button>
        <button type="button" class="poa-status-filter" data-poa-view="integrated" aria-pressed="false">Integrated schedule</button>
        <button type="button" class="poa-status-filter" data-poa-view="workstreams" aria-pressed="false">Workstreams</button>
        <button type="button" class="poa-status-filter" data-poa-view="both" aria-pressed="false">All</button>
      </div>
    </div>
    <div>
      <h3>Status</h3>
      <div class="form-actions poa-filter-group" data-poa-status-filters>
    ${actionStatusItems.map((item) => `<button type="button" class="poa-status-filter" data-poa-status-filter="${escapeHtml(item.value)}" aria-pressed="true">${escapeHtml(item.label)}</button>`).join("")}
    <button type="button" class="poa-status-filter" data-poa-status-filter="all">All</button>
      </div>
    </div>
    <div>
      <h3>Workstreams</h3>
      <div class="form-actions poa-filter-group" data-poa-workstream-filters>
        ${model.phases.map((phase) => `<button type="button" class="poa-status-filter" data-poa-workstream-filter="${escapeHtml(phase.id)}" aria-pressed="true">${escapeHtml(phase.title)}</button>`).join("")}
        <button type="button" class="poa-status-filter" data-poa-workstream-filter="all">All</button>
      </div>
    </div>
  </section>`;
}

function renderPlanOfActionMasterSchedule(model: PlanOfActionBoardModel): string {
  const tasks = model.phases
    .flatMap((phase) => phase.tasks.map((task) => ({ task, phase })))
    .sort(
      (left, right) =>
        left.task.startDate.localeCompare(right.task.startDate) || left.task.title.localeCompare(right.task.title)
    );
  if (tasks.length === 0) {
    return `<p class="muted">No Actions are available yet. Create Actions or load the sample workspace to populate the master schedule.</p>`;
  }
  return `<div class="poa-board" style="--poa-width: ${model.timelineWidth}px;">
    <div class="poa-phase poa-master-schedule poa-master-schedule--rows">
      <div class="poa-phase__header">
        <strong>Master Schedule</strong>
        <span>${tasks.length} Action line${tasks.length === 1 ? "" : "s"}; every Action keeps its own row for auditability and review.</span>
      </div>
      <div class="poa-master-grid poa-master-grid--rows" style="--poa-width: ${model.timelineWidth}px; --poa-today-x: ${model.todayX}px;">
        <div class="poa-master-today-marker" aria-hidden="true" title="Today: ${escapeHtml(model.today)}"></div>
        ${renderPlanOfActionMasterRuler(model)}
        <div class="poa-phase__tasks">
          ${tasks.map(({ task, phase }) => renderPlanOfActionTask(task, model.timelineWidth, model.todayX, model.today, phase.id, phase.title, false)).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function renderPlanOfActionIntegratedSchedule(model: PlanOfActionBoardModel): string {
  const tasks = model.phases
    .flatMap((phase) => phase.tasks.map((task) => ({ task, phase })))
    .sort(
      (left, right) =>
        left.task.startDate.localeCompare(right.task.startDate) || left.task.title.localeCompare(right.task.title)
    );
  if (tasks.length === 0) {
    return `<p class="muted">No Actions are available yet. Create Actions or load the sample workspace to populate the integrated schedule.</p>`;
  }
  const lanes = packPlanOfActionScheduleLanes(tasks);
  return `<div class="poa-board" style="--poa-width: ${model.timelineWidth}px;">
    <div class="poa-phase poa-master-schedule">
      <div class="poa-phase__header">
        <strong>Integrated Schedule</strong>
        <span>${lanes.length} compact lane${lanes.length === 1 ? "" : "s"}, sequenced so overlapping Actions do not collide.</span>
      </div>
      <div class="poa-master-grid" style="--poa-width: ${model.timelineWidth}px;">
        <div class="poa-master-today-marker" style="left: ${model.todayX}px;" aria-hidden="true" title="Today: ${escapeHtml(model.today)}"></div>
        ${renderPlanOfActionMasterRuler(model)}
        <div class="poa-integrated-lanes" style="width: ${model.timelineWidth}px;">
          ${lanes.map((lane, index) => renderPlanOfActionIntegratedLane(lane, index)).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function packPlanOfActionScheduleLanes(
  tasks: readonly { readonly task: PlanOfActionTaskModel; readonly phase: PlanOfActionPhaseModel }[]
): readonly (readonly { readonly task: PlanOfActionTaskModel; readonly phase: PlanOfActionPhaseModel }[])[] {
  const lanes: Array<Array<{ readonly task: PlanOfActionTaskModel; readonly phase: PlanOfActionPhaseModel }>> = [];
  for (const item of tasks) {
    const lane = lanes.find((candidate) => {
      const previous = candidate[candidate.length - 1];
      return previous ? previous.task.x + previous.task.width + 8 <= item.task.x : true;
    });
    if (lane) {
      lane.push(item);
    } else {
      lanes.push([item]);
    }
  }
  return lanes;
}

function renderPlanOfActionIntegratedLane(
  lane: readonly { readonly task: PlanOfActionTaskModel; readonly phase: PlanOfActionPhaseModel }[],
  index: number
): string {
  return `<div class="poa-integrated-lane" data-poa-integrated-lane aria-label="Integrated schedule lane ${index + 1}">
    ${lane.map(({ task, phase }) => renderPlanOfActionMasterTask(task, phase.id, phase.title)).join("")}
  </div>`;
}

function renderPlanOfActionMasterRuler(model: PlanOfActionBoardModel): string {
  const labels = planOfActionDateRulerLabels(model).map(
    (labelItem) => `<span class="poa-ruler-label" style="left: ${labelItem.x}px;">${escapeHtml(labelItem.label)}</span>`
  );
  return `<div class="poa-master-ruler" aria-label="Master schedule date ruler">
    <div class="poa-ruler-track" style="width: ${model.timelineWidth}px;">${labels.join("")}</div>
  </div>`;
}

function planOfActionDateRulerLabels(
  model: PlanOfActionBoardModel
): readonly { readonly label: string; readonly x: number }[] {
  const labelCount = Math.min(6, Math.max(2, Math.floor(model.timelineWidth / 160) + 1));
  return Array.from({ length: labelCount }, (_, index) => {
    const dayOffset = Math.round(((model.totalDays - 1) * index) / Math.max(1, labelCount - 1));
    const labelDate = addUtcDays(model.timelineStart, dayOffset);
    return {
      label: formatShortAuDateTime(labelDate) ?? labelDate,
      x: Math.round(dayOffset * model.dayWidth)
    };
  });
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderPlanOfActionTimeline(model: PlanOfActionBoardModel): string {
  if (!model.phases.some((phase) => phase.tasks.length > 0)) {
    return `<p class="muted">No Actions are available yet. Create Actions or load the sample workspace to populate the Plan of Action.</p>`;
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
    ? phase.tasks
        .map((task) => renderPlanOfActionTask(task, timelineWidth, todayX, today, phase.id, phase.title))
        .join("")
    : `<p class="muted">No open Actions currently sit in this workstream.</p>`;
  return `<div class="poa-phase" data-poa-phase data-poa-workstream="${escapeHtml(phase.id)}">
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
  today: string,
  workstreamId: string,
  workstreamTitle: string,
  showTodayMarker = true
): string {
  const barClass = `poa-bar poa-bar--${task.urgency}`;
  const barLabel = task.timelineLabel ? `<span>${escapeHtml(task.timelineLabel)}</span>` : "";
  const sourceLabel = task.phaseSource === "override" ? " · manual stream" : "";
  const todayMarker = showTodayMarker ? renderPlanOfActionTodayMarker(todayX, today) : "";
  return `<div class="poa-task" data-poa-task data-poa-status="${escapeHtml(task.status)}" data-poa-workstream="${escapeHtml(workstreamId)}">
    <button type="button" class="poa-task__label" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(task.actionId)}">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(`${workstreamTitle}${sourceLabel}`)} · ${escapeHtml(label(task.status))} · ${escapeHtml(task.startDate)} to ${escapeHtml(task.endDate)}</span>
    </button>
    <div class="poa-track" style="width: ${timelineWidth}px;">
      ${todayMarker}
      <div class="${escapeHtml(barClass)}" style="left: ${task.x}px; width: ${task.width}px;" title="${escapeHtml(`${task.title}: ${task.startDate} to ${task.endDate}`)}">${barLabel}</div>
    </div>
  </div>`;
}

function renderPlanOfActionMasterTask(
  task: PlanOfActionTaskModel,
  workstreamId: string,
  workstreamTitle: string
): string {
  const barClass = `poa-bar poa-bar--${task.urgency}`;
  return `<button type="button" class="${escapeHtml(barClass)} poa-bar--integrated" data-poa-task data-poa-status="${escapeHtml(task.status)}" data-poa-workstream="${escapeHtml(workstreamId)}" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(task.actionId)}" style="left: ${task.x}px; width: ${task.width}px;" title="${escapeHtml(`${task.title}: ${task.startDate} to ${task.endDate}`)}"><span>${escapeHtml(task.timelineLabel || task.title)}</span><small>${escapeHtml(workstreamTitle)} · ${escapeHtml(label(task.status))}</small></button>`;
}

function renderPlanOfActionWorklist(model: PlanOfActionBoardModel): string {
  const rows = model.phases
    .flatMap((phase) => phase.tasks.map((task) => ({ task, phase })))
    .sort(
      (left, right) =>
        urgencySortValue(left.task.urgency) - urgencySortValue(right.task.urgency) ||
        planOfActionTaskDueSortValue(left.task).localeCompare(planOfActionTaskDueSortValue(right.task)) ||
        right.task.impactTotal - left.task.impactTotal
    );
  const body = rows.length
    ? rows
        .map(({ task, phase }) => {
          const searchText = `${task.title} ${phase.title} ${label(task.status)} ${label(task.urgency)}`.toLowerCase();
          return `<tr data-poa-worklist-row data-poa-status="${escapeHtml(task.status)}" data-poa-urgency="${escapeHtml(task.urgency)}" data-poa-workstream="${escapeHtml(phase.id)}" data-poa-search="${escapeHtml(searchText)}" data-poa-due="${escapeHtml(planOfActionTaskDueSortValue(task))}" data-poa-impact="${task.impactTotal}">
            <td data-field="open"><button type="button" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(task.actionId)}">Open</button></td>
            <td data-field="title"><span class="cell-compact">${escapeHtml(task.title)}</span></td>
            <td data-field="stream">${escapeHtml(phase.title)}</td>
            <td data-field="streamSource">${escapeHtml(task.phaseSource === "override" ? "Manual" : "Inferred")}</td>
            <td data-field="status">${escapeHtml(label(task.status))}</td>
            <td data-field="urgency">${escapeHtml(label(task.urgency))}</td>
            <td data-field="startDate">${escapeHtml(formatShortAuDateTime(task.startDate) ?? task.startDate)}</td>
            <td data-field="endDate">${escapeHtml(formatShortAuDateTime(task.endDate) ?? task.endDate)}</td>
            <td data-field="dueDate">${escapeHtml(formatShortAuDateTime(task.dueDate) ?? "Not set")}</td>
            <td data-field="linkedRequirements">${task.linkedRequirements}</td>
            <td data-field="linkedRisks">${task.linkedRisks}</td>
            <td data-field="impact">${task.impactTotal}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="12">No Actions are available yet.</td></tr>`;
  return `<section class="poa-worklist" data-poa-worklist>
    <h2>Action Worklist</h2>
    <div class="poa-worklist-filters" aria-label="Action worklist filters">
      <label>Search <input type="search" data-poa-worklist-search placeholder="Title, stream, status or urgency"></label>
      <label>Status <select data-poa-worklist-status><option value="all">All statuses</option>${actionStatusItems.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}</select></label>
      <label>Urgency <select data-poa-worklist-urgency><option value="all">All urgency</option><option value="blocked">Blocked</option><option value="overdue">Overdue</option><option value="due-soon">Due soon</option><option value="normal">Normal</option></select></label>
      <label>Sort <select data-poa-worklist-sort><option value="urgency">Urgency</option><option value="due">Due date</option><option value="impact">Impact</option><option value="title">Title</option></select></label>
    </div>
    <div class="table-wrap" tabindex="0" aria-label="Scrollable Action Worklist table"><table data-poa-worklist-table><thead><tr><th data-field="open">Open</th><th data-field="title">Title</th><th data-field="stream">Stream</th><th data-field="streamSource">Source</th><th data-field="status">Status</th><th data-field="urgency">Urgency</th><th data-field="startDate">Start date</th><th data-field="endDate">End date</th><th data-field="dueDate">Due date</th><th data-field="linkedRequirements">Linked requirements</th><th data-field="linkedRisks">Linked risks</th><th data-field="impact">Impact</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function planOfActionTaskDueSortValue(task: PlanOfActionTaskModel): string {
  return task.dueDate ?? task.endDate ?? "9999-12-31";
}

function urgencySortValue(urgency: string): number {
  if (urgency === "blocked") {
    return 0;
  }
  if (urgency === "overdue") {
    return 1;
  }
  if (urgency === "due-soon") {
    return 2;
  }
  return 3;
}

function renderPlanOfActionTodayMarker(todayX: number, today: string): string {
  return `<div class="poa-today-marker" style="left: ${todayX}px;" aria-hidden="true" title="Today: ${escapeHtml(today)}"></div>`;
}

function planOfActionFilterScript(): string {
  return `<script>
(() => {
  const root = document.querySelector('[data-poa-controls]');
  if (!root) return;
  const statusButtons = Array.from(root.querySelectorAll('[data-poa-status-filter]'));
  const workstreamButtons = Array.from(root.querySelectorAll('[data-poa-workstream-filter]'));
  const viewButtons = Array.from(root.querySelectorAll('[data-poa-view]'));
  const taskSelector = '[data-poa-task]';
  function selectedValues(buttons, key) {
    return new Set(buttons.filter((button) => button.dataset[key] !== 'all' && button.getAttribute('aria-pressed') !== 'false').map((button) => button.dataset[key]));
  }
  function selectedView() {
    return viewButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.poaView || 'master';
  }
  function applyFilters() {
    const statuses = selectedValues(statusButtons, 'poaStatusFilter');
    const workstreams = selectedValues(workstreamButtons, 'poaWorkstreamFilter');
    document.querySelectorAll(taskSelector).forEach((task) => {
      task.hidden = !statuses.has(task.dataset.poaStatus) || !workstreams.has(task.dataset.poaWorkstream);
    });
    document.querySelectorAll('[data-poa-phase]').forEach((phase) => {
      phase.hidden = !workstreams.has(phase.dataset.poaWorkstream) || !Array.from(phase.querySelectorAll(taskSelector)).some((task) => !task.hidden);
    });
    document.querySelectorAll('[data-poa-integrated-lane]').forEach((lane) => {
      lane.hidden = !Array.from(lane.querySelectorAll(taskSelector)).some((task) => !task.hidden);
    });
    const view = selectedView();
    document.querySelectorAll('[data-poa-view-section]').forEach((section) => {
      const name = section.dataset.poaViewSection;
      section.hidden = view !== 'both' && name !== view;
    });
  }
  function wireMultiSelect(buttons, key) {
    buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset[key];
      if (value === 'all') {
        buttons.forEach((item) => {
          if (item.dataset[key] !== 'all') item.setAttribute('aria-pressed', 'true');
        });
      } else {
        button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'false' ? 'true' : 'false');
      }
      applyFilters();
    });
  });
  }
  wireMultiSelect(statusButtons, 'poaStatusFilter');
  wireMultiSelect(workstreamButtons, 'poaWorkstreamFilter');
  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      viewButtons.forEach((item) => item.setAttribute('aria-pressed', item === button ? 'true' : 'false'));
      applyFilters();
    });
  });
  const worklist = document.querySelector('[data-poa-worklist]');
  if (worklist) {
    const search = worklist.querySelector('[data-poa-worklist-search]');
    const status = worklist.querySelector('[data-poa-worklist-status]');
    const urgency = worklist.querySelector('[data-poa-worklist-urgency]');
    const sort = worklist.querySelector('[data-poa-worklist-sort]');
    const tbody = worklist.querySelector('tbody');
    function urgencyRank(value) {
      return value === 'blocked' ? 0 : value === 'overdue' ? 1 : value === 'due-soon' ? 2 : 3;
    }
    function applyWorklistFilters() {
      const query = (search?.value || '').trim().toLowerCase();
      const statusValue = status?.value || 'all';
      const urgencyValue = urgency?.value || 'all';
      const rows = Array.from(worklist.querySelectorAll('[data-poa-worklist-row]'));
      rows.forEach((row) => {
        row.hidden = (query && !row.dataset.poaSearch.includes(query)) || (statusValue !== 'all' && row.dataset.poaStatus !== statusValue) || (urgencyValue !== 'all' && row.dataset.poaUrgency !== urgencyValue);
      });
      const sorted = rows.sort((left, right) => {
        if (sort?.value === 'due') return left.dataset.poaDue.localeCompare(right.dataset.poaDue);
        if (sort?.value === 'impact') return Number(right.dataset.poaImpact || 0) - Number(left.dataset.poaImpact || 0);
        if (sort?.value === 'title') return left.dataset.poaSearch.localeCompare(right.dataset.poaSearch);
        return urgencyRank(left.dataset.poaUrgency) - urgencyRank(right.dataset.poaUrgency) || left.dataset.poaDue.localeCompare(right.dataset.poaDue);
      });
      sorted.forEach((row) => tbody?.appendChild(row));
    }
    [search, status, urgency, sort].forEach((control) => control?.addEventListener('input', applyWorklistFilters));
    applyWorklistFilters();
  }
  applyFilters();
})();
</script>`;
}

function masterLoopRow(
  loop: string,
  maturity: string,
  records: number,
  signal: string,
  question: string,
  command: string,
  actionLabel: string
): {
  loop: string;
  maturity: string;
  records: number;
  signal: string;
  question: string;
  command: string;
  actionLabel: string;
} {
  return { loop, maturity, records, signal, question, command, actionLabel };
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
  readonly statusCounts: {
    readonly total: number;
    readonly applicable: number;
    readonly met: number;
    readonly inProgress: number;
    readonly partiallyMet: number;
    readonly notMet: number;
    readonly underReview: number;
    readonly notApplicable: number;
    readonly evidenceCovered: number;
  };
  readonly strategyStatusCounts: {
    readonly met: number;
    readonly inProgress: number;
    readonly needsUplift: number;
    readonly notStarted: number;
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
  const strategyStatusCounts = {
    met: strategiesMet,
    inProgress: strategyRows.filter((row) => readRecordField(row, "status") === "In progress").length,
    needsUplift: strategyRows.filter((row) => readRecordField(row, "status") === "Needs uplift").length,
    notStarted: strategyRows.filter((row) => readRecordField(row, "status") === "Not started").length
  };
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
    statusCounts: {
      total: e8Requirements.length,
      applicable: completion.applicable,
      met: completion.metAll,
      inProgress: e8Requirements.filter((requirement) => requirement.assessmentStatus === "in-progress").length,
      partiallyMet: e8Requirements.filter((requirement) => requirement.assessmentStatus === "partially-met").length,
      notMet: e8Requirements.filter((requirement) => requirement.assessmentStatus === "not-met").length,
      underReview: e8Requirements.filter((requirement) => requirement.assessmentStatus === "under-review").length,
      notApplicable: completion.notApplicable,
      evidenceCovered: evidenceRequirementIds.size
    },
    strategyStatusCounts,
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
  if (requirement.id === "REQ-PSPF-2025-092") {
    return undefined;
  }
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
    trend: trendIndicator(choice.trend),
    confidence: label(choice.confidence),
    outcomes: choice.outcomes.length,
    linkedRecords: choice.references.length,
    target: choice.targetPosture
  }));

  panel.webview.html = shellHtml(
    "PSPF Cyber Strategy Map",
    `
    <section class="strategy-map-frame">
      <p class="eyebrow">Leadership Strategy Map</p>
      <h1>${escapeHtml(strategy.title)}</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <p class="strategy-map-statement">${escapeHtml(strategy.strategyStatement)}</p>
      <div class="strategy-map-meta">
        ${shellPill(`Scope: ${strategy.scope}`)}
        ${shellPill(`Time horizon: ${strategy.timeHorizon}`)}
        ${shellPill(`${strategy.choices.length} choices`)}
        ${shellPill(strategy.frameworks.join(", "))}
      </div>
      <aside class="strategy-risk-posture"><strong>Risk posture</strong><p>${escapeHtml(strategy.riskPostureStatement)}</p></aside>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.editStrategySummary">Open strategy editor</button>
        <button type="button" data-command="pspf.workshop.copyPostureBrief">Copy brief</button>
      </div>
    </section>
    <section>
      <h2>Strategic Choices</h2>
      <div class="strategy-choice-grid">
        ${strategy.choices.map((choice) => strategyChoiceCard(choice, { requirements, risks, actions, directions })).join("")}
      </div>
    </section>
    ${recordTable("Choice Summary", choiceRows, ["choice", "capability", "trend", "confidence", "outcomes", "linkedRecords", "target"])}
    ${renderMeasuresGroupedByChoice(strategy)}
  `
  );
}

function renderMeasuresGroupedByChoice(strategy: StrategyEntity): string {
  return `<section>
    <h2>Posture Measures By Choice</h2>
    <div class="measure-choice-stack">
      ${strategy.choices
        .map((choice, index) => {
          const measures = choice.outcomes.flatMap((outcome) =>
            outcome.measures.map((measure) => ({ measure, outcome: outcome.statement }))
          );
          const rows = measures.length
            ? measures
                .map(
                  ({ measure, outcome }) => `<tr>
                    <td>${escapeHtml(outcome)}</td>
                    <td><strong>${escapeHtml(measure.title)}</strong></td>
                    <td>${escapeHtml(label(measure.measureClass))}</td>
                    <td>${escapeHtml(measure.current ?? "Not recorded")}</td>
                    <td>${escapeHtml(measure.target ?? "Not recorded")}</td>
                    <td>${trendIndicator(measure.trend)}</td>
                    <td>${escapeHtml(label(measure.confidence))}</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="7">No measures recorded for this choice.</td></tr>`;
          return `<article class="measure-choice-group">
            <h3>Choice ${index + 1}: ${escapeHtml(choice.statement)}</h3>
            <p class="muted">${escapeHtml(choice.capabilityArea)} · ${measures.length} measure${measures.length === 1 ? "" : "s"}</p>
            <div class="table-wrap"><table><thead><tr><th>Outcome</th><th>Measure</th><th>Class</th><th>Current</th><th>Target</th><th>Trend</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
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
  return `<article class="strategy-choice-card">
    <div class="strategy-choice-card__top">
      <span>${escapeHtml(choice.capabilityArea)}</span>
      ${trendIndicator(choice.trend)}
    </div>
    <strong>${escapeHtml(choice.statement)}</strong>
    <p>${escapeHtml(choice.summary)}</p>
    <p class="muted">Confidence: ${escapeHtml(label(choice.confidence))}</p>
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
        <button type="button" data-command="copyEvidencePackage">Copy package</button>
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

async function copyEvidencePackage(): Promise<void> {
  const allEntities = await listAllEntities();
  const scope = await vscode.window.showQuickPick(
    [
      { label: "All domains", domainId: undefined },
      ...PSPF_DOMAINS.map((domain) => ({ label: domain.title, domainId: domain.id }))
    ],
    {
      title: "Copy Evidence Package",
      placeHolder: "Choose the Requirement group to include",
      ignoreFocusOut: true
    }
  );
  if (!scope) {
    return;
  }
  const packageMarkdown = evidencePackageMarkdown(allEntities, scope.domainId);
  await vscode.env.clipboard.writeText(packageMarkdown);
  await vscode.window.showInformationMessage("Evidence package copied to clipboard.");
}

function evidencePackageMarkdown(allEntities: readonly V01Entity[], domainId?: string): string {
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity =>
        entity.entityType === "requirement" &&
        entity.recordStatus !== "deleted" &&
        (!domainId || entity.domainId === domainId)
    )
    .sort(compareRequirementsForPicker);
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const evidenceById = new Map(
    allEntities
      .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence")
      .map((entity) => [entity.id, entity])
  );
  const directionsById = new Map(
    allEntities
      .filter((entity): entity is DirectionEntity => entity.entityType === "direction")
      .map((entity) => [entity.id, entity])
  );
  const scopeLabel = domainId ? domainName(domainId) : "All domains";
  const lines = [
    "# Evidence Package",
    "",
    `- Scope: ${scopeLabel}`,
    `- Requirements: ${requirements.length}`,
    `- Generated: ${formatDisplayDate(new Date())}`,
    "",
    "## Requirement Summary"
  ];
  for (const requirement of requirements) {
    const evidence = links
      .filter(
        (link) =>
          link.linkType === "supported-by" &&
          link.fromType === "requirement" &&
          link.toType === "evidence" &&
          link.fromId === requirement.id
      )
      .map((link) => evidenceById.get(link.toId))
      .filter((item): item is EvidenceEntity => Boolean(item));
    const directions = links
      .filter(
        (link) =>
          link.linkType === "targets" &&
          link.fromType === "direction" &&
          link.toType === "requirement" &&
          link.toId === requirement.id
      )
      .map((link) => directionsById.get(link.fromId))
      .filter((item): item is DirectionEntity => Boolean(item));
    lines.push(
      "",
      `### ${requirement.title}`,
      `- Domain: ${domainName(requirement.domainId)}`,
      `- Status: ${label(requirement.assessmentStatus)}`,
      `- Evidence: ${evidence.length}`,
      `- Directions: ${directions.length}`
    );
    for (const item of evidence.slice(0, 6)) {
      lines.push(`  - Evidence: ${item.title} · ${label(item.freshness)} · ${item.reference}`);
    }
    for (const direction of directions.slice(0, 4)) {
      lines.push(`  - Direction: ${direction.title} · ${label(direction.responseState)}`);
    }
  }
  lines.push("", "OFFICIAL: Sensitive · Review before sharing outside the local assurance team.");
  return lines.join("\n");
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
  const linkContext = await collectEvidenceLinkContext();
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
        toType: "evidence",
        ...linkContext
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

async function collectEvidenceLinkContext(): Promise<Pick<LinkEntity, "evidenceNote" | "evidenceSection">> {
  const evidenceSection = trimOptional(
    await vscode.window.showInputBox({
      title: "Evidence Link Context",
      prompt: "Evidence section, paragraph, or page range (optional)",
      ignoreFocusOut: true
    })
  );
  const evidenceNote = trimOptional(
    await vscode.window.showInputBox({
      title: "Evidence Link Context",
      prompt: "Why this Evidence supports the selected Requirement(s) (optional, sensitive)",
      ignoreFocusOut: true
    })
  );
  return {
    ...(evidenceSection ? { evidenceSection } : {}),
    ...(evidenceNote ? { evidenceNote } : {})
  };
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
  const picked = await pickEntityForEdit(
    requirements,
    "Edit Requirement",
    (requirement) => requirement.title,
    (requirement) => label(requirement.assessmentStatus),
    (requirement) => (requirement.id === recentRequirementId ? "Recent requirement" : requirement.id)
  );
  if (!picked) {
    if (requirements.length > 0) {
      return;
    }
    await vscode.window.showInformationMessage("No Requirements found. Create or import Requirements first.");
    return;
  }
  await openEntityEditor(picked, allEntities);
}

async function openEvidenceList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const evidence = allEntities
    .filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.recordStatus !== "deleted")
    .sort(compareEvidenceRecords);
  const picked = await pickEntityForEdit(
    evidence,
    "Edit Evidence",
    (item) => item.title,
    (item) => label(item.freshness),
    (item) => `${label(item.evidenceType)} · ${item.id}`
  );
  if (!picked) {
    if (evidence.length > 0) {
      return;
    }
    await vscode.window.showInformationMessage(
      "No Evidence records found. Add evidence or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(picked, allEntities);
}

async function openActionsList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = enrichActionsWithImpact(await listAllEntities());
  const actions = allEntities
    .filter((entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted")
    .sort(compareWorkbenchRecords);
  const picked = await pickEntityForEdit(
    actions,
    "Edit Action",
    (action) => action.title,
    (action) => label(action.status),
    (action) => (action.dueDate ? `Due ${action.dueDate}` : action.id)
  );
  if (!picked) {
    if (actions.length > 0) {
      return;
    }
    await vscode.window.showInformationMessage(
      "No Action records found. Create an Action or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(picked, allEntities);
}

async function openRisksList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const risks = allEntities
    .filter((entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted")
    .sort(compareWorkbenchRecords);
  const picked = await pickEntityForEdit(
    risks,
    "Edit Risk",
    (risk) => risk.title,
    (risk) => label(risk.status),
    (risk) => `Likelihood ${risk.likelihood} · impact ${risk.impact}`
  );
  if (!picked) {
    if (risks.length > 0) {
      return;
    }
    await vscode.window.showInformationMessage(
      "No Risk records found. Create a Risk or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(picked, allEntities);
}

async function openDirectionsList(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const directions = allEntities
    .filter(
      (entity): entity is DirectionEntity => entity.entityType === "direction" && entity.recordStatus !== "deleted"
    )
    .sort(compareDirectionsForPicker);
  const picked = await pickEntityForEdit(
    directions,
    "Edit Direction",
    (direction) => `${direction.reference}: ${direction.title}`,
    (direction) => label(direction.responseState),
    (direction) => direction.sourceAuthority ?? direction.id
  );
  if (!picked) {
    if (directions.length > 0) {
      return;
    }
    await vscode.window.showInformationMessage(
      "No Direction records found. Create a Direction or load the sample workspace first."
    );
    return;
  }
  await openEntityEditor(picked, allEntities);
}

async function pickEntityForEdit<Entity extends V01Entity>(
  entities: readonly Entity[],
  title: string,
  labelForEntity: (entity: Entity) => string,
  descriptionForEntity: (entity: Entity) => string,
  detailForEntity: (entity: Entity) => string
): Promise<Entity | undefined> {
  if (entities.length === 0) {
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    entities.map((entity) => ({
      label: labelForEntity(entity),
      description: descriptionForEntity(entity),
      detail: detailForEntity(entity),
      entity
    })),
    { title, placeHolder: "Choose a record to edit", ignoreFocusOut: true }
  );
  return picked?.entity;
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
        <button type="button" data-command="pspf.workshop.openIsmReviewWorkbench">Review Workbench</button>
        <button type="button" data-command="pspf.workshop.createRequirementControlMapping">Map Requirement</button>
        <button type="button" data-command="pspf.workshop.openEssentialEightDashboard">Essential Eight</button>
      </div>
    </section>
    ${renderIsmSourceControlsBrowser(sourceControls)}
  `
  );
}

type IsmReviewState =
  | "unmapped"
  | "not-assessed"
  | "drift-review"
  | "needs-direct-work"
  | "risk-without-action"
  | "reviewed";

interface IsmReviewWorkbenchRow {
  readonly sourceControl: SourceControlEntity;
  readonly reviewStates: readonly IsmReviewState[];
  readonly mappingCount: number;
  readonly evidenceCount: number;
  readonly actionCount: number;
  readonly riskCount: number;
}

async function openIsmReviewWorkbench(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const sourceControls = allEntities
    .filter(
      (entity): entity is SourceControlEntity =>
        entity.entityType === "source-control" && entity.recordStatus !== "deleted"
    )
    .sort(compareSourceControlsForBrowser);
  const rows = buildIsmReviewWorkbenchRows(sourceControls, allEntities);
  const panel = vscode.window.createWebviewPanel("pspfIsmReviewWorkbench", "PSPF ISM Review", vscode.ViewColumn.One, {
    enableScripts: true
  });
  wireWorkshopPanelMessages(panel, openIsmReviewWorkbench);
  panel.webview.html = shellHtml(
    "PSPF ISM Review",
    `
    <section>
      <h1>ISM Review Workbench</h1>
      <p class="muted">Prioritise source controls that need mapping, direct work, implementation assessment, or drift review.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Controls", sourceControls.length)}
        ${metricCard("Unmapped", countIsmReviewRows(rows, "unmapped"))}
        ${metricCard("Not assessed", countIsmReviewRows(rows, "not-assessed"))}
        ${metricCard("Needs direct work", countIsmReviewRows(rows, "needs-direct-work"))}
        ${metricCard("Drift review", countIsmReviewRows(rows, "drift-review"))}
        ${metricCard("Risk without action", countIsmReviewRows(rows, "risk-without-action"))}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.browseIsmSourceControls">All ISM controls</button>
        <button type="button" data-command="pspf.workshop.createRequirementControlMapping">Map Requirement</button>
      </div>
    </section>
    ${renderIsmReviewWorkbenchTable(rows)}
  `
  );
}

function buildIsmReviewWorkbenchRows(
  sourceControls: readonly SourceControlEntity[],
  allEntities: readonly V01Entity[]
): readonly IsmReviewWorkbenchRow[] {
  const mappings = allEntities.filter(
    (entity): entity is RequirementControlMappingEntity =>
      entity.entityType === "requirement-control-mapping" && entity.recordStatus !== "deleted"
  );
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const mappingCounts = new Map<string, number>();
  const directEvidenceCounts = new Map<string, number>();
  const directActionCounts = new Map<string, number>();
  const directRiskCounts = new Map<string, number>();
  for (const mapping of mappings) {
    mappingCounts.set(mapping.sourceControlId, (mappingCounts.get(mapping.sourceControlId) ?? 0) + 1);
  }
  for (const link of links) {
    if (link.fromType !== "source-control") {
      continue;
    }
    if (link.linkType === "supported-by" && link.toType === "evidence") {
      directEvidenceCounts.set(link.fromId, (directEvidenceCounts.get(link.fromId) ?? 0) + 1);
    }
    if (link.linkType === "addressed-by" && link.toType === "action") {
      directActionCounts.set(link.fromId, (directActionCounts.get(link.fromId) ?? 0) + 1);
    }
    if (link.linkType === "exposed-by" && link.toType === "risk") {
      directRiskCounts.set(link.fromId, (directRiskCounts.get(link.fromId) ?? 0) + 1);
    }
  }
  return sourceControls
    .map((sourceControl) => {
      const mappingCount = mappingCounts.get(sourceControl.id) ?? 0;
      const evidenceCount = directEvidenceCounts.get(sourceControl.id) ?? 0;
      const actionCount = directActionCounts.get(sourceControl.id) ?? 0;
      const riskCount = directRiskCounts.get(sourceControl.id) ?? 0;
      const directWorkCount = evidenceCount + actionCount + riskCount;
      const reviewStates: IsmReviewState[] = [];
      if (mappingCount === 0) {
        reviewStates.push("unmapped");
      }
      if (sourceControl.implementationStatus === undefined) {
        reviewStates.push("not-assessed");
      }
      if (sourceControl.statementChangeStatus !== "unchanged") {
        reviewStates.push("drift-review");
      }
      if (mappingCount > 0 && directWorkCount === 0) {
        reviewStates.push("needs-direct-work");
      }
      if (riskCount > 0 && actionCount === 0) {
        reviewStates.push("risk-without-action");
      }
      const effectiveReviewStates: readonly IsmReviewState[] = reviewStates.length > 0 ? reviewStates : ["reviewed"];
      return {
        sourceControl,
        reviewStates: effectiveReviewStates,
        mappingCount,
        evidenceCount,
        actionCount,
        riskCount
      };
    })
    .sort(
      (left, right) =>
        ismReviewSortWeight(left.reviewStates) - ismReviewSortWeight(right.reviewStates) ||
        compareSourceControlsForBrowser(left.sourceControl, right.sourceControl)
    );
}

function renderIsmReviewWorkbenchTable(rows: readonly IsmReviewWorkbenchRow[]): string {
  const categories = ismSourceControlCategoriesForBrowser(rows.map((row) => row.sourceControl));
  const body = rows.map(renderIsmReviewWorkbenchRow).join("");
  return `<section class="ism-review-workbench">
    <div class="ism-review-workbench__toolbar" role="search" aria-label="Filter ISM review controls">
      <label>
        <span>Category</span>
        <select id="ism-review-category-filter">
          <option value="">All categories</option>
          ${categories.map((category) => `<option value="${escapeHtml(category.label)}">${escapeHtml(category.label)} (${category.count})</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="ism-review-workbench__filters" aria-label="ISM review queues">
      ${ismReviewFilterButton("all", "All", rows.length)}
      ${ismReviewFilterButton("unmapped", "Unmapped", countIsmReviewRows(rows, "unmapped"))}
      ${ismReviewFilterButton("not-assessed", "Not assessed", countIsmReviewRows(rows, "not-assessed"))}
      ${ismReviewFilterButton("needs-direct-work", "Needs direct work", countIsmReviewRows(rows, "needs-direct-work"))}
      ${ismReviewFilterButton("drift-review", "Drift review", countIsmReviewRows(rows, "drift-review"))}
      ${ismReviewFilterButton("risk-without-action", "Risk without action", countIsmReviewRows(rows, "risk-without-action"))}
    </div>
    <p class="muted" id="ism-review-count">Showing ${rows.length} of ${rows.length} controls.</p>
    <div class="table-wrap" tabindex="0" aria-label="ISM review workbench table">
      <table id="ism-review-table">
        <thead>
          <tr>
            <th data-field="action">Open</th>
            <th>Control</th>
            <th>Review state</th>
            <th>Implementation</th>
            <th>Mappings</th>
            <th>Evidence</th>
            <th>Actions</th>
            <th>Risks</th>
            <th>Drift</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${ismReviewWorkbenchScript(rows.length)}
  </section>`;
}

function renderIsmReviewWorkbenchRow(row: IsmReviewWorkbenchRow): string {
  const reviewStateLabels = row.reviewStates.map(ismReviewStateLabel).join(", ");
  const category = ismSourceControlCategory(row.sourceControl);
  return `<tr data-review-state="${escapeHtml(row.reviewStates.join(" "))}" data-category="${escapeHtml(category)}">
    <td data-field="action"><button type="button" data-command="openIsmControlDetail" data-source-control-id="${escapeHtml(row.sourceControl.id)}">Open</button></td>
    <td><strong>${escapeHtml(row.sourceControl.controlId)}</strong><br>${escapeHtml(row.sourceControl.title)}</td>
    <td>${escapeHtml(reviewStateLabels)}</td>
    <td>${escapeHtml(implementationStatusLabel(row.sourceControl.implementationStatus))}</td>
    <td>${row.mappingCount}</td>
    <td>${row.evidenceCount}</td>
    <td>${row.actionCount}</td>
    <td>${row.riskCount}</td>
    <td>${escapeHtml(statementChangeLabel(row.sourceControl.statementChangeStatus))}</td>
  </tr>`;
}

function ismReviewFilterButton(value: IsmReviewState | "all", labelText: string, count: number): string {
  return `<button type="button" data-ism-review-filter="${escapeHtml(value)}">${escapeHtml(labelText)} (${count})</button>`;
}

function countIsmReviewRows(rows: readonly IsmReviewWorkbenchRow[], state: IsmReviewState): number {
  return rows.filter((row) => row.reviewStates.includes(state)).length;
}

function ismReviewSortWeight(states: readonly IsmReviewState[]): number {
  const weights: Record<IsmReviewState, number> = {
    "risk-without-action": 0,
    "drift-review": 1,
    "needs-direct-work": 2,
    unmapped: 3,
    "not-assessed": 4,
    reviewed: 5
  };
  return Math.min(...states.map((state) => weights[state]));
}

function ismReviewStateLabel(state: IsmReviewState): string {
  switch (state) {
    case "unmapped":
      return "Unmapped";
    case "not-assessed":
      return "Implementation not assessed";
    case "drift-review":
      return "Drift review";
    case "needs-direct-work":
      return "Needs direct work";
    case "risk-without-action":
      return "Risk without action";
    case "reviewed":
      return "Reviewed";
  }
}

function ismReviewWorkbenchScript(totalCount: number): string {
  return `<style>
    .ism-review-workbench__toolbar { display: grid; grid-template-columns: minmax(16rem, 24rem); gap: 0.75rem; align-items: end; margin: 1rem 0; }
    .ism-review-workbench__toolbar label { display: grid; gap: 0.3rem; }
    .ism-review-workbench__toolbar span { color: var(--vscode-descriptionForeground); font-size: 0.82rem; }
    .ism-review-workbench__toolbar select { width: 100%; box-sizing: border-box; }
    .ism-review-workbench__filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
    .ism-review-workbench__filters button[aria-pressed="true"] { border-color: var(--vscode-focusBorder); }
    .ism-review-workbench th[data-field="action"], .ism-review-workbench td[data-field="action"] { width: 4.75rem; min-width: 4.75rem; white-space: nowrap; }
    .ism-review-workbench td[data-field="action"] button { min-width: 3.75rem; padding-inline: 0.5rem; font-size: 0.82rem; white-space: nowrap; }
  </style>
  <script>
    (() => {
      const rows = Array.from(document.querySelectorAll('#ism-review-table tbody tr'));
      const categoryFilter = document.getElementById('ism-review-category-filter');
      const buttons = Array.from(document.querySelectorAll('[data-ism-review-filter]'));
      const count = document.querySelector('#ism-review-count');
      let active = 'all';
      function applyFilter(next) {
        active = next;
        const selectedCategory = categoryFilter instanceof HTMLSelectElement ? categoryFilter.value : '';
        let visible = 0;
        for (const row of rows) {
          const states = row.dataset.reviewState || '';
          const category = row.dataset.category || '';
          const show = (active === 'all' || states.split(' ').includes(active)) && (!selectedCategory || category === selectedCategory);
          row.hidden = !show;
          if (show) visible += 1;
        }
        for (const button of buttons) {
          button.setAttribute('aria-pressed', button.dataset.ismReviewFilter === active ? 'true' : 'false');
        }
        if (count) {
          count.textContent = 'Showing ' + visible + ' of ${totalCount} controls.';
        }
      }
      for (const button of buttons) {
        button.addEventListener('click', () => applyFilter(button.dataset.ismReviewFilter || 'all'));
      }
      categoryFilter?.addEventListener('change', () => applyFilter(active));
      applyFilter('all');
    })();
  </script>`;
}

function compareSourceControlsForBrowser(left: SourceControlEntity, right: SourceControlEntity): number {
  return (
    left.controlId.localeCompare(right.controlId, "en-AU", { numeric: true }) ||
    left.title.localeCompare(right.title, "en-AU") ||
    left.id.localeCompare(right.id, "en-AU")
  );
}

function ismSourceControlCategory(sourceControl: SourceControlEntity): string {
  return ismSourceControlCategoryByControlId.get(sourceControl.controlId) ?? "Uncategorised";
}

function ismSourceControlCategoriesForBrowser(
  sourceControls: readonly SourceControlEntity[]
): readonly { readonly label: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const sourceControl of sourceControls) {
    const category = ismSourceControlCategory(sourceControl);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      const leftIndex = ismSourceControlCategoryOrder.indexOf(left.label);
      const rightIndex = ismSourceControlCategoryOrder.indexOf(right.label);
      if (leftIndex >= 0 && rightIndex >= 0) {
        return leftIndex - rightIndex;
      }
      if (leftIndex >= 0) {
        return -1;
      }
      if (rightIndex >= 0) {
        return 1;
      }
      return left.label.localeCompare(right.label, "en-AU");
    });
}

function renderIsmSourceControlsBrowser(sourceControls: readonly SourceControlEntity[]): string {
  const categories = ismSourceControlCategoriesForBrowser(sourceControls);
  const profiles = uniqueStrings(sourceControls.flatMap((sourceControl) => sourceControl.profileTags)).sort(
    (left, right) => left.localeCompare(right, "en-AU", { numeric: true })
  );
  const driftLabels = uniqueStrings(
    sourceControls.map((sourceControl) => statementChangeLabel(sourceControl.statementChangeStatus))
  ).sort((left, right) => left.localeCompare(right, "en-AU"));
  const implementationLabels = implementationStatusItems
    .map((item) => item.label)
    .concat("Not assessed")
    .filter((value) =>
      sourceControls.some((sourceControl) => implementationStatusLabel(sourceControl.implementationStatus) === value)
    );
  const releaseCount = uniqueStrings(
    sourceControls.map((sourceControl) => sourceControl.provenance.oscalRelease)
  ).length;
  const changedCount = sourceControls.filter(
    (sourceControl) => sourceControl.statementChangeStatus !== "unchanged"
  ).length;
  const assessedCount = sourceControls.filter(
    (sourceControl) => sourceControl.implementationStatus !== undefined
  ).length;
  const rows = sourceControls.map(renderIsmSourceControlBrowserRow).join("");

  return `<section class="ism-browser" id="ism-source-controls">
    <div class="grid">
      ${metricCard("Source controls", sourceControls.length)}
      ${metricCard("Implementation assessed", assessedCount)}
      ${metricCard("Profiles", profiles.length)}
      ${metricCard("OSCAL releases", releaseCount)}
      ${metricCard("Drift markers", changedCount)}
    </div>
    <section class="ism-category-overview" aria-label="ISM principle groups">
      <h2>Principle Groups</h2>
      <p class="muted">Use the ISM category groups to move between related controls before opening the detailed control record.</p>
      <div class="ism-category-grid">
        ${categories
          .map(
            (category) =>
              `<button type="button" class="ism-category-card" data-ism-category-shortcut="${escapeHtml(category.label)}"><strong>${escapeHtml(category.label)}</strong><span>${category.count} control${category.count === 1 ? "" : "s"}</span></button>`
          )
          .join("")}
      </div>
    </section>
    <div class="ism-browser__toolbar" role="search" aria-label="Filter ISM source controls">
      <label>
        <span>Search controls</span>
        <input id="ism-control-search" type="search" placeholder="Control ID, title, statement, profile, release" autocomplete="off">
      </label>
      <label>
        <span>Category</span>
        <select id="ism-category-filter">
          <option value="">All categories</option>
          ${categories.map((category) => `<option value="${escapeHtml(category.label)}">${escapeHtml(category.label)} (${category.count})</option>`).join("")}
        </select>
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
      <label>
        <span>Implementation</span>
        <select id="ism-implementation-filter">
          <option value="">All implementation states</option>
          ${implementationLabels.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
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
            <th data-field="implementation"><button type="button" data-sort="implementation">Implementation</button></th>
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
  const category = ismSourceControlCategory(sourceControl);
  const name = ismSourceControlName(sourceControl);
  const profiles = sourceControl.profileTags.join(", ");
  const drift = statementChangeLabel(sourceControl.statementChangeStatus);
  const implementation = implementationStatusLabel(sourceControl.implementationStatus);
  const release = sourceControl.provenance.oscalRelease;
  const searchText = [
    sourceControl.controlId,
    name,
    sourceControl.statement,
    profiles,
    release,
    drift,
    implementation,
    category
  ]
    .join(" ")
    .toLocaleLowerCase("en-AU");
  return `<tr data-search="${escapeHtml(searchText)}" data-category="${escapeHtml(category)}" data-profile="${escapeHtml(profiles)}" data-drift="${escapeHtml(drift)}" data-implementation="${escapeHtml(implementation)}" data-control-id="${escapeHtml(sourceControl.controlId)}" data-title="${escapeHtml(name)}" data-profiles="${escapeHtml(profiles)}" data-release="${escapeHtml(release)}">
    <td data-field="action"><button type="button" data-command="openIsmControlDetail" data-source-control-id="${escapeHtml(sourceControl.id)}">Open</button></td>
    <td data-field="controlId"><strong>${escapeHtml(sourceControl.controlId)}</strong></td>
    <td data-field="title"><strong>${escapeHtml(name)}</strong><br><span class="muted">${escapeHtml(sourceControl.statement)}</span></td>
    <td data-field="implementation">${escapeHtml(implementation)}</td>
    <td data-field="profiles">${escapeHtml(profiles || "Not tagged")}</td>
    <td data-field="release">${escapeHtml(release)}</td>
    <td data-field="drift">${escapeHtml(drift)}</td>
  </tr>`;
}

function ismSourceControlName(sourceControl: SourceControlEntity): string {
  const title = sourceControl.title.trim();
  if (title) {
    return title;
  }
  const statementLead = sourceControl.statement.trim().split(/[.;:]/)[0]?.trim();
  return statementLead
    ? `${sourceControl.controlId}: ${statementLead}`
    : `${sourceControl.controlId}: Unnamed ISM control`;
}

function ismSourceControlsBrowserScript(totalCount: number): string {
  return `<style>
    .ism-category-overview { margin-top: 1rem; }
    .ism-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .ism-category-card { display: grid; gap: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; color: var(--text); background: var(--surface-strong); text-align: left; }
    .ism-category-card:hover { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 8%, var(--surface-strong)); }
    .ism-category-card span { color: var(--muted); font-size: 0.8rem; }
    .ism-browser__toolbar { display: grid; grid-template-columns: minmax(18rem, 2fr) minmax(14rem, 1.4fr) minmax(12rem, 1fr) minmax(10rem, 1fr) minmax(10rem, 1fr) auto; gap: 0.75rem; align-items: end; margin: 1rem 0; }
    .ism-browser__toolbar label { display: grid; gap: 0.3rem; }
    .ism-browser__toolbar span { color: var(--vscode-descriptionForeground); font-size: 0.82rem; }
    .ism-browser__toolbar input, .ism-browser__toolbar select { width: 100%; box-sizing: border-box; }
    .ism-browser__table table { min-width: 1120px; }
    .ism-browser__table th[data-field="action"], .ism-browser__table td[data-field="action"] { width: 4.75rem; min-width: 4.75rem; white-space: nowrap; }
    .ism-browser__table td[data-field="action"] button { min-width: 3.75rem; padding-inline: 0.5rem; font-size: 0.82rem; white-space: nowrap; }
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
      const categoryFilter = document.getElementById('ism-category-filter');
      const categoryShortcuts = Array.from(document.querySelectorAll('[data-ism-category-shortcut]'));
      const profileFilter = document.getElementById('ism-profile-filter');
      const driftFilter = document.getElementById('ism-drift-filter');
      const implementationFilter = document.getElementById('ism-implementation-filter');
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
        const category = categoryFilter instanceof HTMLSelectElement ? categoryFilter.value : '';
        const profile = profileFilter instanceof HTMLSelectElement ? profileFilter.value : '';
        const drift = driftFilter instanceof HTMLSelectElement ? driftFilter.value : '';
        const implementation = implementationFilter instanceof HTMLSelectElement ? implementationFilter.value : '';
        let visible = 0;
        for (const row of rows) {
          const matchesQuery = !query || rowText(row, 'search').includes(query);
          const matchesCategory = !category || rowText(row, 'category') === category;
          const matchesProfile = !profile || rowText(row, 'profile').split(', ').includes(profile);
          const matchesDrift = !drift || rowText(row, 'drift') === drift;
          const matchesImplementation = !implementation || rowText(row, 'implementation') === implementation;
          const isVisible = matchesQuery && matchesCategory && matchesProfile && matchesDrift && matchesImplementation;
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
      categoryFilter?.addEventListener('change', applyFilters);
      profileFilter?.addEventListener('change', applyFilters);
      driftFilter?.addEventListener('change', applyFilters);
      implementationFilter?.addEventListener('change', applyFilters);
      clearButton?.addEventListener('click', () => {
        if (searchInput instanceof HTMLInputElement) searchInput.value = '';
        if (categoryFilter instanceof HTMLSelectElement) categoryFilter.value = '';
        if (profileFilter instanceof HTMLSelectElement) profileFilter.value = '';
        if (driftFilter instanceof HTMLSelectElement) driftFilter.value = '';
        if (implementationFilter instanceof HTMLSelectElement) implementationFilter.value = '';
        applyFilters();
        searchInput?.focus();
      });
      categoryShortcuts.forEach((button) => {
        button.addEventListener('click', () => {
          if (categoryFilter instanceof HTMLSelectElement) categoryFilter.value = button.getAttribute('data-ism-category-shortcut') || '';
          applyFilters();
          document.getElementById('ism-controls-table')?.scrollIntoView({ block: 'start' });
        });
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
  const directWorkLinks = links.filter(
    (link) =>
      link.recordStatus !== "deleted" &&
      link.fromType === "source-control" &&
      link.fromId === sourceControl.id &&
      ["evidence", "action", "risk"].includes(link.toType)
  );
  const directWorkIds = new Set(directWorkLinks.map((link) => link.toId));

  const requirementRows = mappings.map((mapping) => {
    const requirement = requirementsById.get(mapping.requirementId);
    return {
      openEntityType: requirement ? "requirement" : "requirement-control-mapping",
      openEntityId: requirement?.id ?? mapping.id,
      action: `<button type="button" data-command="openEntity" data-entity-type="requirement-control-mapping" data-entity-id="${escapeHtml(mapping.id)}">Edit mapping</button>`,
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

  const directWorkRows = allEntities
    .filter(
      (entity): entity is EvidenceEntity | ActionEntity | RiskEntity =>
        (entity.entityType === "evidence" || entity.entityType === "action" || entity.entityType === "risk") &&
        directWorkIds.has(entity.id)
    )
    .map((entity) => ({
      openEntityType: entity.entityType,
      openEntityId: entity.id,
      type: label(entity.entityType),
      title: entity.title,
      state: ismLinkedWorkState(entity)
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
        ${metricCard("Implementation", implementationStatusLabel(sourceControl.implementationStatus))}
        ${metricCard("Mapped Requirements", mappings.length)}
        ${metricCard("Linked work records", workRows.length)}
        ${metricCard("Direct work links", directWorkRows.length)}
        ${metricCard("Profiles", sourceControl.profileTags.length)}
        ${metricCard("Drift", statementChangeLabel(sourceControl.statementChangeStatus))}
      </div>
      <div class="form-actions">
        <button type="button" data-command="setIsmControlImplementationStatus" data-source-control-id="${escapeHtml(sourceControl.id)}">Set Implementation Status</button>
        <button type="button" data-command="mapRequirementToCurrentIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Map Requirement</button>
        <button type="button" data-command="linkEvidenceToIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Link Evidence</button>
        <button type="button" data-command="linkActionToIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Link Action</button>
        <button type="button" data-command="linkRiskToIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Link Risk</button>
        <button type="button" data-command="attachEvidenceForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Attach Evidence</button>
        <button type="button" data-command="createActionForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Create Action</button>
        <button type="button" data-command="createRiskForIsmControl" data-source-control-id="${escapeHtml(sourceControl.id)}">Create Risk</button>
        <button type="button" data-command="pspf.workshop.browseIsmSourceControls">All ISM controls</button>
      </div>
    </section>
    ${recordTable("Work Linked Directly To This Control", directWorkRows, ["type", "title", "state"])}
    ${recordTable("Requirements This Control Implements", requirementRows, ["requirement", "domain", "status", "coverage", "profile", "confidence", "reviewed", "action"])}
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

async function linkExistingWorkToSourceControl(
  sourceControlId: string,
  itemType: "evidence" | "action" | "risk"
): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const sourceControl = allEntities.find(
    (entity): entity is SourceControlEntity =>
      entity.entityType === "source-control" && entity.id === sourceControlId && entity.recordStatus !== "deleted"
  );
  if (!sourceControl) {
    await vscode.window.showWarningMessage("Open an ISM control before linking work directly to it.");
    return;
  }
  const rule = operatorLinkRuleForEndpoints("source-control", itemType, "workshop");
  if (!rule) {
    return;
  }
  const activeLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const alreadyLinkedIds = new Set(
    activeLinks
      .filter(
        (link) =>
          link.fromType === "source-control" &&
          link.fromId === sourceControl.id &&
          link.linkType === rule.linkType &&
          link.toType === itemType
      )
      .map((link) => link.toId)
  );
  const candidates = allEntities
    .filter(
      (entity): entity is EvidenceEntity | ActionEntity | RiskEntity =>
        entity.entityType === itemType && entity.recordStatus !== "deleted" && !alreadyLinkedIds.has(entity.id)
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage(
      `No unlinked ${label(itemType).toLowerCase()} records are available to link to this ISM control.`
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((entity) => ({ label: entity.title, detail: entity.id, entity })),
    {
      title: `Link Existing ${label(itemType)} to ${sourceControl.controlId}`,
      placeHolder: `Select one or more ${label(itemType).toLowerCase()} records to link directly to this control`,
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
        title: `${sourceControl.controlId} ${rule.phrase} ${entity.title}`,
        linkType: rule.linkType,
        fromId: sourceControl.id,
        fromType: "source-control",
        toId: entity.id,
        toType: itemType
      },
      "workshop"
    )
  );
  await vscode.commands.executeCommand("pspf.core.upsertEntities", links);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(
    `Linked ${picked.length} ${label(itemType).toLowerCase()} record${picked.length === 1 ? "" : "s"} directly to ${sourceControl.controlId}.`
  );
}

async function setSourceControlImplementationStatus(sourceControlId: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const sourceControl = allEntities.find(
    (entity): entity is SourceControlEntity =>
      entity.entityType === "source-control" && entity.id === sourceControlId && entity.recordStatus !== "deleted"
  );
  if (!sourceControl) {
    await vscode.window.showWarningMessage("Open an ISM control before recording its implementation status.");
    return;
  }
  const picked = await vscode.window.showQuickPick(
    implementationStatusItems.map((item) => ({
      label: item.label,
      description: item.value === sourceControl.implementationStatus ? "Current" : undefined,
      value: item.value
    })),
    {
      title: `Implementation status for ${sourceControl.controlId}`,
      placeHolder: "Operator interpretation, kept internal and not published by default",
      ignoreFocusOut: true
    }
  );
  if (!picked) {
    return;
  }
  if (picked.value === sourceControl.implementationStatus) {
    return;
  }
  const updated: SourceControlEntity = {
    ...sourceControl,
    implementationStatus: picked.value,
    updatedAt: new Date().toISOString()
  };
  await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(
    `${sourceControl.controlId} implementation status set to ${implementationStatusLabel(picked.value)}.`
  );
}

async function mapRequirementToSourceControl(sourceControlId: string): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const sourceControl = allEntities.find(
    (entity): entity is SourceControlEntity =>
      entity.entityType === "source-control" && entity.id === sourceControlId && entity.recordStatus !== "deleted"
  );
  if (!sourceControl) {
    await vscode.window.showWarningMessage("Open an ISM control before mapping a Requirement to it.");
    return;
  }
  const mappedRequirementIds = new Set(
    allEntities
      .filter(
        (entity): entity is RequirementControlMappingEntity =>
          entity.entityType === "requirement-control-mapping" &&
          entity.recordStatus !== "deleted" &&
          entity.sourceControlId === sourceControl.id
      )
      .map((mapping) => mapping.requirementId)
  );
  const requirements = allEntities
    .filter(
      (entity): entity is RequirementEntity =>
        entity.entityType === "requirement" && entity.recordStatus !== "deleted" && !mappedRequirementIds.has(entity.id)
    )
    .sort(compareRequirementsForPicker);
  if (requirements.length === 0) {
    await vscode.window.showInformationMessage(
      `${sourceControl.controlId} is already mapped to every active Requirement.`
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(
    requirements.map((requirement) => ({
      label: requirement.title,
      description: domainName(requirement.domainId),
      detail: implementationStatusLabel(sourceControl.implementationStatus),
      requirement
    })),
    {
      title: `Map Requirement to ${sourceControl.controlId}`,
      placeHolder: "Select the PSPF Requirement this ISM control helps implement",
      ignoreFocusOut: true
    }
  );
  if (!picked) {
    return;
  }
  await createRequirementControlMapping(picked.requirement, sourceControl);
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

async function createRequirementControlMapping(
  initialRequirement?: RequirementEntity,
  initialSourceControl?: SourceControlEntity
): Promise<void> {
  await ensureCoreReady();
  const requirement = initialRequirement ?? (await pickRequirement());
  if (!requirement) {
    return;
  }

  const sourceControl = initialSourceControl ?? (await pickSourceControl());
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
        action: sourceControl
          ? `<button type="button" data-command="openIsmControlDetail" data-source-control-id="${escapeHtml(sourceControl.id)}">Open control</button>`
          : "",
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
    ${recordTable("ISM Mappings", mappings, ["controlId", "title", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release", "action"])}
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
  readonly domainId?: string;
  readonly assessmentStatus?: AssessmentStatus;
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
  if (entityType === "source-control") {
    await openIsmControlDetail(entityId);
    return;
  }
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
    const previousEntity = currentEntity;
    const updated = await buildUpdatedEntity(currentEntity, fields);
    if (!updated) {
      return false;
    }
    await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
    await refreshWorkshopSurfaces();
    currentEntity = updated;
    hasUnsavedEditorChanges = false;
    unsavedEditorFields = undefined;
    celebrateClosure(previousEntity, updated);
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
      readonly newsletterEdition?: string;
      readonly fields?: Readonly<Record<string, unknown>>;
    }) => {
      if (message.command === "refresh") {
        await refreshPanel?.();
        return;
      }
      if (message.command === "saveNewsletterEditorNote" && isCisoMagazineEdition(message.newsletterEdition)) {
        await saveNewsletterEditorNote(message.newsletterEdition, String(message.fields?.editorNote ?? ""));
        await refreshPanel?.();
        void vscode.window.showInformationMessage(
          `${message.newsletterEdition === "ciso" ? "CISO" : "CSO"} newsletter Editor's Note saved.`
        );
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
      if (message.command === "copyEvidencePackage") {
        await copyEvidencePackage();
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
      if (message.command === "setIsmControlImplementationStatus" && message.sourceControlId) {
        await setSourceControlImplementationStatus(message.sourceControlId);
        await refreshPanel?.();
      }
      if (message.command === "mapRequirementToCurrentIsmControl" && message.sourceControlId) {
        await mapRequirementToSourceControl(message.sourceControlId);
        await refreshPanel?.();
      }
      if (message.command === "linkEvidenceToIsmControl" && message.sourceControlId) {
        await linkExistingWorkToSourceControl(message.sourceControlId, "evidence");
        await refreshPanel?.();
      }
      if (message.command === "linkActionToIsmControl" && message.sourceControlId) {
        await linkExistingWorkToSourceControl(message.sourceControlId, "action");
        await refreshPanel?.();
      }
      if (message.command === "linkRiskToIsmControl" && message.sourceControlId) {
        await linkExistingWorkToSourceControl(message.sourceControlId, "risk");
        await refreshPanel?.();
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
        "pspf.workshop.importBundle",
        "pspf.shop.openForecast",
        "pspf.workshop.createRequirement",
        "pspf.workshop.createAction",
        "pspf.workshop.createRisk",
        "pspf.workshop.attachEvidence",
        "pspf.workshop.loadSampleWorkspace",
        "pspf.workshop.loadHomeSampleWorkspace",
        "pspf.workshop.openAssessmentDashboard",
        "pspf.workshop.openConnectedView",
        "pspf.workshop.openMasterDashboard",
        "pspf.workshop.openEssentialEightDashboard",
        "pspf.workshop.openRequirementsList",
        "pspf.workshop.openPspfGridView",
        "pspf.workshop.openHumanCentredRiskView",
        "pspf.workshop.openContinuousComplianceMetro",
        "pspf.workshop.openPentestWorkbench",
        "pspf.workshop.openRequirementCardView",
        "pspf.workshop.openPlanOfActionBoard",
        "pspf.workshop.openStrategyMap",
        "pspf.workshop.editStrategySummary",
        "pspf.workshop.createRoadmapInitiativePlan",
        "pspf.workshop.addPlannerTask",
        "pspf.workshop.addPlannerMilestone",
        "pspf.workshop.openRiskSourcePanel",
        "pspf.workshop.configureRiskSource",
        "pspf.workshop.openRiskSourceSettings",
        "pspf.workshop.setRiskSourceCredential",
        "pspf.workshop.openDirectionsList",
        "pspf.workshop.testRiskSource",
        "pspf.workshop.previewRiskSourceImport",
        "pspf.workshop.applyRiskSourceImport",
        "pspf.workshop.viewRiskSourceRuns",
        "pspf.workshop.openEvidenceReviewQueue",
        "pspf.workshop.openIsmReviewWorkbench",
        "pspf.workshop.browseIsmSourceControls",
        "pspf.workshop.createRequirementControlMapping",
        "pspf.workshop.manageTags",
        "pspf.workshop.copyPostureBrief",
        "pspf.workshop.openCisoNewsletterReview",
        "pspf.workshop.openCsoMagazine",
        "pspf.workshop.copyCsoMagazine",
        "pspf.workshop.exportCsoMagazine",
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

function celebrateClosure(previous: EditableWorkshopEntity, next: EditableWorkshopEntity): void {
  if (
    previous.entityType === "requirement" &&
    next.entityType === "requirement" &&
    previous.assessmentStatus !== "met" &&
    next.assessmentStatus === "met"
  ) {
    void vscode.window.showInformationMessage(`Requirement met — ${next.title}. Nice progress.`);
    return;
  }
  if (
    previous.entityType === "action" &&
    next.entityType === "action" &&
    previous.status !== "done" &&
    next.status === "done"
  ) {
    void vscode.window.showInformationMessage(`Action closed — ${next.title}. One less thing on the plan.`);
  }
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
      const planWorkstreamId = normalisePlanWorkstreamId(fields.planWorkstreamId);
      if (!title) {
        await vscode.window.showWarningMessage("Enter an Action title before saving.");
        return undefined;
      }
      if (!isActionStatus(status)) {
        await vscode.window.showWarningMessage("Select a valid Action status before saving.");
        return undefined;
      }
      const current = entity as WorkshopActionWithPlanOverride;
      const next = {
        ...current,
        title,
        status,
        startDate: normaliseShortAuDateTime(fields.startDate),
        endDate: normaliseShortAuDateTime(fields.endDate),
        dueDate: normaliseShortAuDateTime(fields.dueDate),
        commentary: actionCommentaryEntries(entity.commentary, fields.newCommentary, updatedAt),
        updatedAt
      };
      if (planWorkstreamId) {
        return { ...next, planWorkstreamId } as ActionEntity;
      }
      const { planWorkstreamId: _removedPlanWorkstreamId, ...withoutPlanWorkstreamId } = next;
      return withoutPlanWorkstreamId as ActionEntity;
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
  const pageTabs = requirementPageTabs(requirement, allEntities, browserOptions);
  const directionsPanel = requirementDirectionsPanel(allEntities);
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
  return `${requirementWorkbenchStyles()}
  <div class="requirement-page">
    ${pageTabs}
    <div class="requirement-browser">
      ${requirementBrowserNav(requirement, allEntities, browserOptions)}
      <div class="requirement-browser__content">
        <div data-requirement-content="requirement">${editorContent}</div>
        <div data-requirement-content="directions" hidden>${directionsPanel}</div>
      </div>
    </div>
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
    .requirement-page { display: grid; gap: 12px; }
    .requirement-page__tabs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
    .requirement-page__tabs button[aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 16%, var(--surface-strong)); }
    .requirement-signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 12px 0; }
    .requirement-signal { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 10px; background: var(--surface-strong); }
    .requirement-signal span { display: block; color: var(--muted); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .requirement-signal strong { display: block; margin-top: 5px; font-size: 18px; line-height: 1.1; }
    .requirement-signal small { display: block; margin-top: 4px; color: var(--muted); line-height: 1.3; }
    .requirement-browser__filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .requirement-browser__filters button[aria-pressed="true"] { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 12%, var(--surface-strong)); }
    .requirement-browser__count { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; }
    .requirement-browser__count-chip { border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px; background: var(--surface-strong); color: var(--muted); font-size: 12px; }
  </style>`;
}

function requirementPageTabs(
  requirement: RequirementEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions = {}
): string {
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const requirements = requirementsForBrowser(allEntities, links, options);
  const tabs = PSPF_DOMAINS.map((domain) => ({
    id: domain.id,
    label: domain.title,
    count: requirements.filter((candidate) => candidate.domainId === domain.id).length
  })).filter((domain) => domain.count > 0);
  const directionsCount = allEntities.filter(
    (entity): entity is DirectionEntity => entity.entityType === "direction" && entity.recordStatus !== "deleted"
  ).length;
  const selectedDomainId = options.domainId ?? options.savedView?.filters.domainIds?.[0] ?? "all";
  return `<nav class="requirement-page__tabs" aria-label="Requirement domain tabs">
    <button type="button" data-requirement-tab="all" aria-pressed="${selectedDomainId === "all" ? "true" : "false"}">All ${requirements.length}</button>
    ${tabs.map((domain) => `<button type="button" data-requirement-tab="${escapeHtml(domain.id)}" aria-pressed="${domain.id === selectedDomainId ? "true" : "false"}">${escapeHtml(domain.label)} ${domain.count}</button>`).join("")}
    <button type="button" data-requirement-tab="directions" aria-pressed="false">Directions ${directionsCount}</button>
  </nav>`;
}

function requirementDirectionsPanel(allEntities: readonly V01Entity[]): string {
  const requirementsById = new Map(
    allEntities
      .filter(
        (entity): entity is RequirementEntity =>
          entity.entityType === "requirement" && entity.recordStatus !== "deleted"
      )
      .map((requirement) => [requirement.id, requirement])
  );
  const requirementIdsByDirection = new Map<string, string[]>();
  for (const link of allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  )) {
    if (link.fromType === "direction" && link.toType === "requirement" && link.linkType === "targets") {
      requirementIdsByDirection.set(link.fromId, [...(requirementIdsByDirection.get(link.fromId) ?? []), link.toId]);
    }
  }
  const rows = allEntities
    .filter(
      (entity): entity is DirectionEntity => entity.entityType === "direction" && entity.recordStatus !== "deleted"
    )
    .sort(compareDirectionsForPicker)
    .map((direction) => {
      const targetedRequirements = (requirementIdsByDirection.get(direction.id) ?? [])
        .map((requirementId) => requirementsById.get(requirementId)?.title ?? requirementId)
        .join("; ");
      return {
        openEntityType: "direction",
        openEntityId: direction.id,
        reference: direction.reference,
        title: direction.title,
        responseState: label(direction.responseState),
        sourceAuthority: direction.sourceAuthority ?? "Not recorded",
        requirements: targetedRequirements || "None linked"
      };
    });
  return `<section>
    <h2>Directions</h2>
    <p class="muted">Use Directions as a navigation lens over PSPF Requirements. Open a Direction to review or update its response state.</p>
    ${recordTable("Directions", rows, ["reference", "title", "responseState", "sourceAuthority", "requirements"])}
  </section>`;
}

function requirementsForBrowser(
  allEntities: readonly V01Entity[],
  links: readonly LinkEntity[],
  options: RequirementBrowserOptions = {}
): RequirementEntity[] {
  return allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
    )
    .filter((candidate) => !options.savedView || savedViewMatchesRequirement(options.savedView, candidate, links))
    .sort(compareRequirementsForPicker);
}

function requirementBrowserNav(
  requirement: RequirementEntity,
  allEntities: readonly V01Entity[],
  options: RequirementBrowserOptions = {}
): string {
  const links = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const directionTargetRequirementIds = new Set(
    links
      .filter((link) => link.fromType === "direction" && link.toType === "requirement" && link.linkType === "targets")
      .map((link) => link.toId)
  );
  const requirements = requirementsForBrowser(allEntities, links, options);
  const currentIndex = requirements.findIndex((candidate) => candidate.id === requirement.id);
  const position = currentIndex >= 0 ? `${currentIndex + 1} of ${requirements.length}` : `${requirements.length} total`;
  const filterText = options.filterText?.trim() ?? "";
  const selectedStatus = options.assessmentStatus ?? options.savedView?.filters.assessmentStatuses?.[0] ?? "all";
  const statusCounts = requirementStatusCounts(requirements);
  const items = requirements
    .map((candidate) =>
      requirementBrowserNavItem(
        candidate,
        candidate.id === requirement.id,
        directionTargetRequirementIds.has(candidate.id),
        filterText
      )
    )
    .join("");
  return `<section class="requirement-browser__nav" aria-label="Requirement browser">
    <h2>Requirements</h2>
    <input class="requirement-browser__filter" type="search" aria-label="Filter requirements" placeholder="Filter by title, domain, or status" value="${escapeHtml(filterText)}">
    <div class="requirement-browser__filters" aria-label="Requirement status filters">
      <button type="button" data-requirement-status-filter="all" aria-pressed="${selectedStatus === "all" ? "true" : "false"}">All ${requirements.length}</button>
      ${assessmentStatusItems.map((item) => `<button type="button" data-requirement-status-filter="${escapeHtml(item.value)}" aria-pressed="${item.value === selectedStatus ? "true" : "false"}">${escapeHtml(item.label)} ${statusCounts.get(item.value) ?? 0}</button>`).join("")}
    </div>
    <div class="requirement-browser__list" role="list" aria-label="Scrollable Requirements list">
      ${items || '<p class="muted">No Requirements found.</p>'}
    </div>
    <p class="muted requirement-browser__count"><span class="requirement-browser__count-chip" data-requirement-browser-count>${escapeHtml(position)}</span><button type="button" class="secondary" data-clear-requirement-filters hidden>Clear filters</button></p>
  </section>`;
}

function requirementBrowserNavItem(
  requirement: RequirementEntity,
  isCurrent: boolean,
  isDirectionTargeted: boolean,
  filterText = ""
): string {
  const title = requirement.title;
  const titlePreview = requirementBrowserTitlePreview(title);
  const domain = domainName(requirement.domainId);
  const status = label(requirement.assessmentStatus);
  const searchText = `${title} ${domain} ${status} ${requirement.id}`;
  const normalisedFilter = filterText.toLocaleLowerCase("en-AU");
  const hidden = normalisedFilter && !searchText.toLocaleLowerCase("en-AU").includes(normalisedFilter);
  return `<button type="button" class="requirement-browser__item" role="listitem" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${requirementNumberLabel(requirement)}. ${title}. ${domain}. ${status}`)}" data-command="openRequirementInEditor" data-requirement-id="${escapeHtml(requirement.id)}" data-status="${escapeHtml(requirement.assessmentStatus)}" data-domain="${escapeHtml(requirement.domainId)}" data-direction-targeted="${isDirectionTargeted ? "true" : "false"}" data-search="${escapeHtml(searchText)}"${isCurrent ? ' aria-current="page"' : ""}${hidden ? " hidden" : ""}>
    <span class="requirement-browser__number">${escapeHtml(requirementNumberLabel(requirement))}</span>
    <span class="requirement-browser__title-preview">${escapeHtml(titlePreview)}</span>
    <span class="requirement-browser__meta">${escapeHtml(domain)} · ${escapeHtml(status)}</span>
  </button>`;
}

function requirementBrowserTitlePreview(title: string): string {
  const naturalTitle = title.replace(/^\s*PSPF\s+\d+[A-Za-z]?\s*-\s*/i, "").trim();
  return naturalTitle || title;
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
      const statusButtons = Array.from(document.querySelectorAll('[data-requirement-status-filter]'));
      const tabButtons = Array.from(document.querySelectorAll('[data-requirement-tab]'));
      const items = Array.from(document.querySelectorAll('.requirement-browser__item'));
      const count = document.querySelector('[data-requirement-browser-count]');
      const clearButton = document.querySelector('[data-clear-requirement-filters]');
      const requirementPanel = document.querySelector('[data-requirement-content="requirement"]');
      const directionsPanel = document.querySelector('[data-requirement-content="directions"]');
      function applyRequirementFilters() {
        const query = input instanceof HTMLInputElement ? input.value.trim().toLocaleLowerCase('en-AU') : '';
        const selectedStatus = statusButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.getAttribute('data-requirement-status-filter') || 'all';
        const selectedTab = tabButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.getAttribute('data-requirement-tab') || 'all';
        let visible = 0;
        for (const item of items) {
          const search = (item.getAttribute('data-search') || item.textContent || '').toLocaleLowerCase('en-AU');
          const status = item.getAttribute('data-status') || '';
          const domain = item.getAttribute('data-domain') || '';
          const directionTargeted = item.getAttribute('data-direction-targeted') === 'true';
          const matchesSearch = !query || search.includes(query);
          const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
          const matchesTab = selectedTab === 'all' || domain === selectedTab || (selectedTab === 'directions' && directionTargeted);
          const matches = matchesSearch && matchesStatus && matchesTab;
          item.hidden = !matches;
          if (matches) visible += 1;
        }
        const filtered = Boolean(query) || selectedStatus !== 'all' || selectedTab !== 'all';
        if (count) count.textContent = (filtered ? 'Showing ' : '') + visible + ' of ' + items.length + ' Requirements';
        if (clearButton instanceof HTMLButtonElement) clearButton.hidden = !filtered;
        if (requirementPanel instanceof HTMLElement) requirementPanel.hidden = selectedTab === 'directions';
        if (directionsPanel instanceof HTMLElement) directionsPanel.hidden = selectedTab !== 'directions';
      }
      input?.addEventListener('input', applyRequirementFilters);
      statusButtons.forEach((button) => button.addEventListener('click', () => {
        statusButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        applyRequirementFilters();
      }));
      tabButtons.forEach((button) => button.addEventListener('click', () => {
        tabButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        applyRequirementFilters();
      }));
      clearButton?.addEventListener('click', () => {
        if (input instanceof HTMLInputElement) input.value = '';
        statusButtons.forEach((item) => item.setAttribute('aria-pressed', String(item.getAttribute('data-requirement-status-filter') === 'all')));
        tabButtons.forEach((item) => item.setAttribute('aria-pressed', String(item.getAttribute('data-requirement-tab') === 'all')));
        applyRequirementFilters();
      });
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
  const linkedRequirements = linkedRequirementsForAction(action, allEntities);
  const requirementTagActions = linkedRequirements.length
    ? `<div class="form-actions action-linked-requirement-tags" aria-label="Tag linked Requirements">
        ${linkedRequirements
          .map(
            (requirement) =>
              `<button type="button" data-command="applyTag" data-requirement-id="${escapeHtml(requirement.id)}">Apply tag to ${escapeHtml(requirementNumberLabel(requirement))}</button>`
          )
          .join("")}
      </div>`
    : "";
  const impact = action.impact;
  const actionPlanWorkstreamId =
    normalisePlanWorkstreamId((action as WorkshopActionWithPlanOverride).planWorkstreamId) ?? "";
  const planWorkstreamOptions = [
    { label: "Infer from impact", value: "" },
    ...PLAN_OF_ACTION_PHASES.map((phase) => ({ label: phase.title, value: phase.id }))
  ];
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
    ${selectField("planWorkstreamId", "Plan of Action stream", planWorkstreamOptions, actionPlanWorkstreamId)}
    ${textareaField("newCommentary", "New commentary update", "")}
  `,
    undefined,
    requirementTagActions
  )}${actionCommentaryHistorySection(action)}${readOnlyImpact}${commercialContextSection(action, allEntities)}`;
  return recordWorkbenchShell(action, allEntities, browserOptions, editorContent);
}

function linkedRequirementsForAction(
  action: ActionEntity,
  allEntities: readonly V01Entity[]
): readonly RequirementEntity[] {
  const requirementIds = new Set(
    allEntities
      .filter((entity): entity is LinkEntity => entity.entityType === "link")
      .filter(
        (link) =>
          link.linkType === "addressed-by" &&
          link.fromType === "requirement" &&
          link.toType === "action" &&
          link.toId === action.id
      )
      .map((link) => link.fromId)
  );
  return allEntities
    .filter(
      (entity): entity is RequirementEntity => entity.entityType === "requirement" && requirementIds.has(entity.id)
    )
    .sort(compareRequirementsForPicker);
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
        <button type="button" data-command="createSavedView" data-saved-view-scope="workshop-source-controls">Create ISM Controls view</button>
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

  if (scope === "workshop-source-controls") {
    return createSourceControlSavedView(scope, cleanName);
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
  if (savedView.scope === "workshop-source-controls") {
    return editSourceControlSavedView(savedView);
  }

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

async function createSourceControlSavedView(
  scope: SavedViewScope,
  cleanName: string
): Promise<SavedViewEntity | undefined> {
  const query = await vscode.window.showInputBox({
    title: "Create ISM Controls View",
    prompt: "Optional control search text. Press Enter to skip.",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.length > SAVED_VIEW_LIMITS.queryMaxLength
        ? `Use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.`
        : undefined
  });
  if (query === undefined) {
    return undefined;
  }
  const implementationStatuses = await vscode.window.showQuickPick(implementationStatusItems, {
    title: "Optional implementation statuses",
    canPickMany: true,
    ignoreFocusOut: true
  });
  if (implementationStatuses === undefined) {
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
        implementationStatuses: implementationStatuses.map((item) => item.value)
      },
      presentation: {
        sortKey: "title",
        sortDirection: "asc",
        visibleColumns: ["title"]
      }
    },
    "workshop"
  ) satisfies SavedViewEntity;
  await vscode.commands.executeCommand("pspf.core.upsertEntity", savedView);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Created saved view: ${savedView.name}.`);
  return savedView;
}

async function editSourceControlSavedView(savedView: SavedViewEntity): Promise<SavedViewEntity | undefined> {
  const savedViews = await listSavedViews(true);
  const name = await vscode.window.showInputBox({
    title: "Edit ISM Controls View",
    prompt: "Saved view name",
    value: savedView.name,
    ignoreFocusOut: true,
    validateInput: (value) => validateSavedViewNameInput(value, savedViews, savedView.id, savedView.scope)
  });
  if (!name) {
    return undefined;
  }
  const query = await vscode.window.showInputBox({
    title: "Edit ISM Controls View",
    prompt: "Control search text. Clear this box to remove the search filter.",
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
  const implementationStatuses = await vscode.window.showQuickPick(
    implementationStatusItems.map((item) => ({
      ...item,
      picked: savedView.filters.implementationStatuses?.includes(item.value)
    })),
    {
      title: "Implementation statuses to include. Leave empty for all statuses.",
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (implementationStatuses === undefined) {
    return undefined;
  }
  const cleanName = name.normalize("NFC").trim().replace(/\s+/g, " ");
  const updated = {
    ...savedView,
    title: cleanName,
    name: cleanName,
    filters: {
      query: trimOptional(query),
      implementationStatuses: implementationStatuses.map((item) => item.value)
    },
    updatedAt: new Date().toISOString()
  } satisfies SavedViewEntity;
  await vscode.commands.executeCommand("pspf.core.upsertEntity", updated);
  await refreshWorkshopSurfaces();
  await vscode.window.showInformationMessage(`Updated saved view: ${updated.name}.`);
  return updated;
}

function defaultSavedViewName(scope: SavedViewScope): string {
  if (scope === "workshop-source-controls") {
    return "ISM control posture view";
  }
  if (scope === "workshop-dashboard") {
    return "Planning dashboard view";
  }
  if (scope === "workshop-evidence-review") {
    return "Evidence planning view";
  }
  return "Workshop Requirements view";
}

async function openWorkshopSavedView(savedView: SavedViewEntity): Promise<void> {
  if (savedView.scope === "workshop-source-controls") {
    await openWorkshopSourceControlsSavedView(savedView);
    return;
  }
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

async function openWorkshopSourceControlsSavedView(savedView: SavedViewEntity): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const sourceControls = allEntities
    .filter(
      (entity): entity is SourceControlEntity =>
        entity.entityType === "source-control" &&
        entity.recordStatus !== "deleted" &&
        savedViewMatchesSourceControl(savedView, entity)
    )
    .sort(compareSourceControlsForBrowser);
  const rows = sourceControls.map((sourceControl) => ({
    openEntityType: "source-control",
    openEntityId: sourceControl.id,
    controlId: sourceControl.controlId,
    title: sourceControl.title,
    implementation: implementationStatusLabel(sourceControl.implementationStatus),
    profiles: sourceControl.profileTags.join(", ") || "Not tagged",
    drift: statementChangeLabel(sourceControl.statementChangeStatus)
  }));
  const assessedCount = sourceControls.filter(
    (sourceControl) => sourceControl.implementationStatus !== undefined
  ).length;
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
      <p class="muted">ISM control posture · ${escapeHtml(savedViewFilterSummary(savedView))} · ${sourceControls.length} matching control(s)</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Controls", sourceControls.length)}
        ${metricCard("Assessed", assessedCount)}
        ${metricCard("Not assessed", sourceControls.length - assessedCount)}
      </div>
    </section>
    ${recordTable("ISM Controls", rows, ["controlId", "title", "implementation", "profiles", "drift"])}
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

function savedViewMatchesSourceControl(savedView: SavedViewEntity, sourceControl: SourceControlEntity): boolean {
  const filters = savedView.filters;
  const query = filters.query?.trim().toLocaleLowerCase("en-AU");
  if (
    query &&
    !`${sourceControl.controlId} ${sourceControl.title} ${sourceControl.statement} ${sourceControl.profileTags.join(" ")}`
      .toLocaleLowerCase("en-AU")
      .includes(query)
  ) {
    return false;
  }
  if ((filters.implementationStatuses ?? []).length > 0) {
    return sourceControl.implementationStatus !== undefined &&
      filters.implementationStatuses?.includes(sourceControl.implementationStatus)
      ? true
      : false;
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
  if ((filters.implementationStatuses ?? []).length > 0) {
    parts.push(`Implementation: ${filters.implementationStatuses?.map(implementationStatusLabel).join(", ")}`);
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
    sourceLabel: "PSPF Workshop",
    requirementControlMappings: input.requirementControlMappings,
    sourceControls: input.sourceControls
  });

  await vscode.env.clipboard.writeText(brief);
  await recordShareState(allEntities, "Posture brief");
  await vscode.window.showInformationMessage("PSPF posture brief copied to clipboard.");
}

async function recordShareState(allEntities: readonly V01Entity[], artefact: string): Promise<void> {
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const applicableRequirements = requirements.filter((requirement) => !isNotApplicableRequirement(requirement));
  const metRequirements = applicableRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
  const metPercentage =
    applicableRequirements.length === 0 ? 0 : Math.round((metRequirements / applicableRequirements.length) * 100);
  const state: WorkshopShareState = {
    sharedAt: new Date().toISOString(),
    requirements: requirements.length,
    evidence: allEntities.filter((entity) => entity.entityType === "evidence").length,
    actions: allEntities.filter((entity) => entity.entityType === "action").length,
    metPercentage,
    artefact
  };
  await workshopContext?.workspaceState.update(lastSharedKey, state);
}

function describeShareNudge(
  state: WorkshopShareState | undefined,
  current: WorkshopMomentumSnapshot
): string | undefined {
  if (!state) {
    return undefined;
  }
  const sharedDate = new Date(state.sharedAt);
  const days = Math.max(0, Math.floor((Date.now() - sharedDate.getTime()) / 86_400_000));
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  const changes: string[] = [];
  const evidenceDelta = current.evidence - state.evidence;
  if (evidenceDelta !== 0) {
    changes.push(`${Math.abs(evidenceDelta)} evidence ${evidenceDelta > 0 ? "added" : "removed"}`);
  }
  const requirementDelta = current.requirements - state.requirements;
  if (requirementDelta !== 0) {
    changes.push(
      `${Math.abs(requirementDelta)} requirement${Math.abs(requirementDelta) === 1 ? "" : "s"} ${requirementDelta > 0 ? "added" : "removed"}`
    );
  }
  const postureDelta = current.metPercentage - state.metPercentage;
  if (postureDelta !== 0) {
    changes.push(`posture ${state.metPercentage}% → ${current.metPercentage}%`);
  }
  if (changes.length === 0) {
    return `${state.artefact} shared ${when} · nothing has changed since.`;
  }
  return `${state.artefact} shared ${when} · ${changes.join(" · ")} since. A fresh copy may be worth sharing.`;
}

async function openCsoMagazine(): Promise<void> {
  await openMagazineEdition("cso");
}

async function openCisoMagazine(): Promise<void> {
  await openMagazineEdition("ciso");
}

async function openMagazineEdition(edition: CisoMagazineEdition): Promise<void> {
  await ensureCoreReady();
  const input = withRecordedNewsletterTrend(buildShareArtefactInput(await listAllEntities(), edition));
  const html = renderCisoMagazineHtml(input);
  const markdown = renderCisoMagazineMarkdown(input);
  const title = edition === "ciso" ? "Digital CISO Magazine" : "Digital CSO Magazine";
  const panel = vscode.window.createWebviewPanel("pspfCisoMagazine", title, vscode.ViewColumn.One, {
    enableScripts: false
  });
  panel.webview.html = html;
  await vscode.env.clipboard.writeText(markdown);
  await vscode.window.showInformationMessage(`${title} opened and email copy copied to clipboard.`);
}

async function openCisoNewsletterReview(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const input = buildShareArtefactInput(allEntities, "cso");
  const cisoInput = buildShareArtefactInput(allEntities, "ciso");
  const model = buildCisoMagazineModel(input);
  const cisoModel = buildCisoMagazineModel(cisoInput);
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
      <div class="strategy-editor__two-col">
        ${newsletterEditorNoteForm("cso", model.editorNote)}
        ${newsletterEditorNoteForm("ciso", cisoModel.editorNote)}
      </div>
      <div class="grid">
        ${metricCard("Stories", model.featureStories.length)}
        ${metricCard("Attention items", model.attentionItems.length)}
        ${metricCard("Open actions", model.actionStrip.length)}
        ${metricCard("Commercial watch", model.commercialWatch.length)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.workshop.openCsoMagazine">Open CSO magazine</button>
        <button type="button" data-command="pspf.workshop.copyCsoMagazine">Copy CSO Markdown</button>
        <button type="button" data-command="pspf.workshop.exportCsoMagazine">Export CSO file</button>
        <button type="button" data-command="pspf.workshop.openCisoMagazine">Open CISO edition</button>
        <button type="button" data-command="pspf.workshop.openPlanOfActionBoard">Plan of Action</button>
      </div>
    </section>
    ${recordTable("Feature Stories", storyRows, ["title", "body"])}
    ${recordTable("Attention Required", attentionRows, ["title", "domain", "reason"])}
    ${recordTable("Action Strip", actionRows, ["title", "status", "dueDate", "linkedRequirement", "latestUpdate"])}
  `
  );
}

async function copyCsoMagazine(): Promise<void> {
  await copyMagazineEdition("cso");
}

async function copyCisoMagazine(): Promise<void> {
  await copyMagazineEdition("ciso");
}

async function copyMagazineEdition(edition: CisoMagazineEdition): Promise<void> {
  await ensureCoreReady();
  const markdown = renderCisoMagazineMarkdown(
    withRecordedNewsletterTrend(buildShareArtefactInput(await listAllEntities(), edition))
  );
  await vscode.env.clipboard.writeText(markdown);
  await vscode.window.showInformationMessage(
    `${edition === "ciso" ? "Digital CISO Magazine" : "Digital CSO Magazine"} Markdown copied to clipboard.`
  );
}

async function exportCsoMagazine(): Promise<void> {
  await exportMagazineEdition("cso");
}

async function exportCisoMagazine(): Promise<void> {
  await exportMagazineEdition("ciso");
}

async function exportMagazineEdition(edition: CisoMagazineEdition): Promise<void> {
  await ensureCoreReady();
  const title = edition === "ciso" ? "Digital CISO Magazine" : "Digital CSO Magazine";
  const format = await vscode.window.showQuickPick(
    [
      { label: "Markdown", value: "md" as const },
      { label: "HTML", value: "html" as const }
    ],
    { title: `Export ${title}`, ignoreFocusOut: true }
  );
  if (!format) {
    return;
  }
  const input = withRecordedNewsletterTrend(buildShareArtefactInput(await listAllEntities(), edition));
  const content = format.value === "html" ? renderCisoMagazineHtml(input) : renderCisoMagazineMarkdown(input);
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`digital-${edition}-magazine-${PSPF_SLICE_VERSION}.${format.value}`),
    filters: format.value === "html" ? { HTML: ["html"] } : { Markdown: ["md"] },
    saveLabel: "Export"
  });
  if (!target) {
    return;
  }
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
  await vscode.window.showInformationMessage(`${title} exported to ${target.fsPath}.`);
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

function buildShareArtefactInput(
  allEntities: readonly V01Entity[],
  edition: CisoMagazineEdition = "cso"
): CisoMagazineInput {
  const editorNotes = workshopContext?.workspaceState.get<NewsletterEditorNoteState>(newsletterEditorNoteKey) ?? {};
  const postureHistory =
    workshopContext?.workspaceState.get<NewsletterPostureHistoryState>(newsletterPostureHistoryKey) ?? {};
  const domainScope = "all" as const;
  return {
    generatedAt: new Date(),
    issueTitle: edition === "ciso" ? "Digital CISO Magazine" : "Digital CSO Magazine",
    issueNumber: `Issue ${PSPF_SLICE_VERSION}`,
    periodLabel: formatDisplayDate(new Date()),
    audience: "internal" as const,
    domainScope,
    edition,
    editorNoteOverride: editorNotes[edition],
    postureTrend: postureHistory[newsletterScopeKey(edition, domainScope)] ?? [],
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

function withRecordedNewsletterTrend(input: CisoMagazineInput): CisoMagazineInput {
  const model = buildCisoMagazineModel(input);
  if (model.overallCompliancePercent === undefined) {
    return input;
  }
  return {
    ...input,
    postureTrend: recordNewsletterPostureHistory(
      input.edition ?? "cso",
      input.domainScope ?? "all",
      model.overallCompliancePercent
    )
  };
}

function recordNewsletterPostureHistory(
  edition: CisoMagazineEdition,
  domainScope: NonNullable<CisoMagazineInput["domainScope"]>,
  metPercentage: number
): readonly CisoMagazineTrendPoint[] {
  const day = new Date().toISOString().slice(0, 10);
  const state = workshopContext?.workspaceState.get<NewsletterPostureHistoryState>(newsletterPostureHistoryKey) ?? {};
  const key = newsletterScopeKey(edition, domainScope);
  const withoutToday = (state[key] ?? []).filter((point) => point.day !== day);
  const updated = [...withoutToday, { day, metPercentage }].slice(-30);
  void workshopContext?.workspaceState.update(newsletterPostureHistoryKey, { ...state, [key]: updated });
  return updated;
}

function newsletterScopeKey(
  edition: CisoMagazineEdition,
  domainScope: NonNullable<CisoMagazineInput["domainScope"]>
): string {
  return `${edition}:${domainScope}`;
}

async function saveNewsletterEditorNote(edition: CisoMagazineEdition, editorNote: string): Promise<void> {
  const state = workshopContext?.workspaceState.get<NewsletterEditorNoteState>(newsletterEditorNoteKey) ?? {};
  await workshopContext?.workspaceState.update(newsletterEditorNoteKey, { ...state, [edition]: editorNote.trim() });
}

function newsletterEditorNoteForm(edition: CisoMagazineEdition, editorNote: string): string {
  const label = edition === "ciso" ? "CISO Editor's Note" : "CSO Editor's Note";
  return `<form class="form-grid">
    <input type="hidden" name="newsletterEdition" value="${escapeHtml(edition)}">
    <label>${escapeHtml(label)}<textarea name="editorNote" rows="8">${escapeHtml(editorNote)}</textarea></label>
    <div class="form-actions"><button type="button" data-command="saveNewsletterEditorNote" data-newsletter-edition="${escapeHtml(edition)}">Save ${escapeHtml(edition.toUpperCase())} Editor's Note</button></div>
  </form>`;
}

function isCisoMagazineEdition(value: string | undefined): value is CisoMagazineEdition {
  return value === "cso" || value === "ciso";
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
  for (const provider of workshopTreeProviders) {
    provider.refresh();
  }
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

function recordTable(title: string, records: readonly object[], fields: readonly string[], className?: string): string {
  const sectionClass = className ? ` class="${escapeHtml(className)}"` : "";
  if (records.length === 0) {
    return `<section${sectionClass}><h2>${escapeHtml(title)}</h2><p class="muted">No records linked yet.</p></section>`;
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
  return `<section${sectionClass}><h2>${escapeHtml(title)}</h2><div class="table-wrap" tabindex="0" aria-label="Scrollable ${escapeHtml(title)} table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
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
  if (field === "action" || field === "trend") {
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

function trendIndicator(value: string): string {
  const trend = value === "improving" || value === "steady" || value === "deteriorating" ? value : "unknown";
  return `<span class="trend-indicator" data-trend="${escapeHtml(trend)}"><span>${escapeHtml(label(trend))}</span></span>`;
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

const implementationStatusItems: readonly {
  readonly label: string;
  readonly value: SourceControlImplementationStatus;
}[] = [
  { label: "Not implemented", value: "not-implemented" },
  { label: "Partial", value: "partial" },
  { label: "Implemented", value: "implemented" },
  { label: "Not applicable", value: "not-applicable" },
  { label: "Under review", value: "under-review" }
];

function implementationStatusLabel(status: SourceControlImplementationStatus | undefined): string {
  if (!status) {
    return "Not assessed";
  }
  return implementationStatusItems.find((item) => item.value === status)?.label ?? label(status);
}

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
