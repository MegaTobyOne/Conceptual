import type {
  ActionEntity,
  BundleCollections,
  DirectionEntity,
  DomainEntity,
  EvidenceEntity,
  LinkEntity,
  RequirementControlMappingEntity,
  RequirementEntity,
  RiskEntity,
  SourceControlEntity,
  SpendItemEntity,
  StrategyEntity
} from "@pspf/contracts";

export interface PostureBriefInput {
  readonly generatedAt: Date | string;
  readonly requirements: readonly RequirementEntity[];
  readonly evidence: readonly EvidenceEntity[];
  readonly actions: readonly ActionEntity[];
  readonly risks: readonly RiskEntity[];
  readonly links: readonly LinkEntity[];
  readonly domains: readonly Pick<DomainEntity, "id" | "title">[];
  readonly directions?: readonly DirectionEntity[];
  readonly strategies?: readonly StrategyEntity[];
  readonly requirementControlMappings?: readonly RequirementControlMappingEntity[];
  readonly sourceControls?: readonly SourceControlEntity[];
  readonly sourceLabel?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
}

export type CisoMagazinePspfDomainScope = "all" | "GOV" | "RISK" | "INFO" | "TECH" | "PER" | "PHYS";

export type CisoMagazineEdition = "cso" | "ciso";

export interface CisoMagazineInput extends PostureBriefInput {
  readonly issueTitle?: string;
  readonly issueNumber?: string;
  readonly periodLabel?: string;
  readonly editorNoteOverride?: string;
  readonly postureTrend?: readonly CisoMagazineTrendPoint[];
  readonly audience?: "internal" | "executive" | "external";
  readonly domainScope?: CisoMagazinePspfDomainScope;
  readonly edition?: CisoMagazineEdition;
  readonly changeRecords?: BundleCollections["change-records"];
  readonly spendItems?: readonly SpendItemEntity[];
}

export interface CisoMagazineModel {
  readonly classification: "OFFICIAL: Sensitive";
  readonly title: string;
  readonly issueNumber: string;
  readonly periodLabel: string;
  readonly generatedAt: string;
  readonly sourceLabel?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
  readonly audience: "internal" | "executive" | "external";
  readonly edition: CisoMagazineEdition;
  readonly pspfDomainScope: CisoMagazinePspfDomainScope;
  readonly pspfDomainTitle: string;
  readonly coverHook: string;
  readonly editorNote: string;
  readonly overallCompliancePercent: number | undefined;
  readonly complianceTrendSummary: string;
  readonly postureSnapshot: readonly CisoMagazineMetric[];
  readonly executiveFraming: readonly CisoMagazineStory[];
  readonly featureStories: readonly CisoMagazineStory[];
  readonly attentionItems: readonly CisoMagazineAttentionItem[];
  readonly actionStrip: readonly CisoMagazineActionItem[];
  readonly commercialWatch: readonly CisoMagazineCommercialItem[];
  readonly masterPlan?: CisoMasterPlanModel;
  readonly readerActions: readonly string[];
  readonly nextIssueTeaser: string;
}

export interface CisoMagazineTrendPoint {
  readonly day: string;
  readonly metPercentage: number;
}

export interface CisoMagazineMetric {
  readonly label: string;
  readonly value: string;
}

export interface CisoMagazineStory {
  readonly title: string;
  readonly body: string;
}

export interface CisoMagazineAttentionItem {
  readonly title: string;
  readonly reason: string;
  readonly description?: string;
  readonly pspfDomainTitle: string;
  readonly actionLayer: CisoMagazineActionLayer;
}

export interface CisoMagazineActionItem {
  readonly actionId: string;
  readonly title: string;
  readonly status: string;
  readonly dueDate?: string;
  readonly linkedRequirement?: string;
  readonly latestUpdate?: string;
  readonly actionLayer: CisoMagazineActionLayer;
}

export interface CisoMagazineActionLayer {
  readonly ownerRole: string;
  readonly timeframe: string;
  readonly why: string;
  readonly nextStep: string;
  readonly expectedOutcome: string;
}

export interface CisoMagazineCommercialItem {
  readonly title: string;
  readonly status: string;
  readonly amount: string;
}

export interface CisoMasterPlanModel {
  readonly title: string;
  readonly horizon: string;
  readonly direction: string;
  readonly streams: readonly CisoMasterPlanStream[];
  readonly initiativePlans: readonly CisoMasterPlanInitiative[];
  readonly phases: readonly CisoMasterPlanPhase[];
  readonly dependencies: readonly CisoMasterPlanDependency[];
  readonly roleOwnership: readonly RoleOwnershipSummary[];
  readonly newsletterArticle: CisoMagazineStory;
}

export interface RoleOwnershipSummary {
  readonly role: string;
  readonly requirements: number;
  readonly controls: number;
}

export interface CisoMasterPlanStream {
  readonly title: string;
  readonly phase: string;
  readonly status: string;
  readonly basis: string;
}

export interface CisoMasterPlanInitiative {
  readonly title: string;
  readonly stages: readonly CisoMasterPlanInitiativeStage[];
  readonly evidence: readonly CisoMasterPlanInitiativeEvidence[];
  readonly evidenceCount: number;
}

export interface CisoMasterPlanInitiativeStage {
  readonly actionId: string;
  readonly stage: string;
  readonly status: string;
  readonly dueDate?: string;
  readonly actionTitle: string;
}

export interface CisoMasterPlanInitiativeEvidence {
  readonly evidenceId: string;
  readonly title: string;
  readonly freshness: string;
}

export interface CisoMasterPlanPhase {
  readonly title: string;
  readonly focus: string;
  readonly count: number;
}

export interface CisoMasterPlanDependency {
  readonly title: string;
  readonly source: string;
  readonly status: string;
}

export function buildCisoMagazineModel(input: CisoMagazineInput): CisoMagazineModel {
  const edition = input.edition ?? "cso";
  const pspfDomainScope = input.domainScope ?? "all";
  const scopedDomains =
    edition === "ciso" ? selectCisoTechnicalDomains(input.domains) : selectPspfDomains(input.domains, pspfDomainScope);
  const scopedDomainIds = new Set(scopedDomains.map((domain) => domain.id));
  const scopedRequirements = input.requirements.filter(
    (requirement) => (pspfDomainScope === "all" && edition !== "ciso") || scopedDomainIds.has(requirement.domainId)
  );
  const scopedRequirementIds = new Set(scopedRequirements.map((requirement) => requirement.id));
  const requirementsById = new Map(input.requirements.map((requirement) => [requirement.id, requirement]));
  const domainTitlesById = new Map(input.domains.map((domain) => [domain.id, domain.title]));
  const requirementSummariesByTargetId = buildRequirementSummariesByTargetId(input.links, requirementsById);
  const targetIdsByRequirement = buildTargetIdsByRequirement(input.links);
  const scopedActionIds = new Set(
    scopedRequirements.flatMap((requirement) => targetIdsByRequirement.get(requirement.id)?.actions ?? [])
  );
  const scopedRiskIds = new Set(
    scopedRequirements.flatMap((requirement) => targetIdsByRequirement.get(requirement.id)?.risks ?? [])
  );
  const scopedEvidenceIds = new Set(
    scopedRequirements.flatMap((requirement) => targetIdsByRequirement.get(requirement.id)?.evidence ?? [])
  );
  const openActions = input.actions.filter(
    (action) =>
      !["done", "cancelled"].includes(action.status) &&
      (edition === "cso" && pspfDomainScope === "all" ? true : scopedActionIds.has(action.id))
  );
  const openRisks = input.risks.filter(
    (risk) =>
      risk.status !== "closed" && (edition === "cso" && pspfDomainScope === "all" ? true : scopedRiskIds.has(risk.id))
  );
  const evidenceNeedingReview = input.evidence.filter(
    (item) =>
      item.freshness !== "current" &&
      (edition === "cso" && pspfDomainScope === "all" ? true : scopedEvidenceIds.has(item.id))
  );
  const requirementsNeedingAttention = scopedRequirements.filter((requirement) =>
    ["not-started", "in-progress", "partially-met", "not-met", "under-review"].includes(requirement.assessmentStatus)
  );
  const overallCompliancePercent = compliancePercent(scopedRequirements);
  const activeStrategy = (input.strategies ?? []).find((strategy) => strategy.recordStatus !== "deleted");
  const linkedSpendItems = (input.spendItems ?? []).filter(
    (item) =>
      (edition === "cso" && pspfDomainScope === "all") ||
      isSpendItemLinkedToScopedWork(item, input.links, scopedRequirementIds, scopedActionIds)
  );
  const pspfDomainTitle =
    edition === "ciso"
      ? "Information + Technology"
      : pspfDomainScope === "all"
        ? "All PSPF Domains"
        : (scopedDomains[0]?.title ?? pspfDomainScope);
  const scopedRequirementControlMappings = (input.requirementControlMappings ?? []).filter((mapping) =>
    scopedRequirementIds.has(mapping.requirementId)
  );
  const masterPlan =
    edition === "ciso"
      ? buildCisoMasterPlanModel({
          generatedAt: input.generatedAt,
          requirements: scopedRequirements,
          evidence: input.evidence,
          actions: openActions,
          risks: openRisks,
          links: input.links,
          domains: scopedDomains,
          directions: input.directions,
          strategies: activeStrategy ? [activeStrategy] : [],
          spendItems: linkedSpendItems,
          requirementControlMappings: scopedRequirementControlMappings,
          sourceControls: input.sourceControls,
          sourceLabel: input.sourceLabel,
          bundleVersion: input.bundleVersion,
          schemaVersion: input.schemaVersion
        })
      : undefined;
  const complianceTrendSummary = describeComplianceTrend(input.postureTrend ?? [], overallCompliancePercent);
  const roleByRequirementId = buildRequirementOwnerRoles(scopedRequirementControlMappings);
  const actionsById = new Map(input.actions.map((action) => [action.id, action]));
  const actionLayersByRequirementId = buildRequirementActionLayers(
    requirementsNeedingAttention,
    targetIdsByRequirement,
    actionsById,
    roleByRequirementId,
    pspfDomainTitle
  );

  return {
    classification: "OFFICIAL: Sensitive",
    title: input.issueTitle ?? (edition === "ciso" ? "Digital CISO Magazine" : "Digital CSO Magazine"),
    issueNumber: input.issueNumber ?? "Issue 1",
    periodLabel: input.periodLabel ?? "Current assurance period",
    generatedAt: formatDisplayDate(input.generatedAt),
    sourceLabel: input.sourceLabel,
    bundleVersion: input.bundleVersion,
    schemaVersion: input.schemaVersion,
    audience: input.audience ?? "internal",
    edition,
    pspfDomainScope,
    pspfDomainTitle,
    coverHook: buildCoverHook(edition, requirementsNeedingAttention.length, openActions.length, pspfDomainTitle),
    editorNote: buildEditorNote(edition, pspfDomainTitle, activeStrategy, input.editorNoteOverride),
    overallCompliancePercent,
    complianceTrendSummary,
    postureSnapshot: [
      {
        label: "Overall compliance",
        value: overallCompliancePercent === undefined ? "n/a" : `${overallCompliancePercent}%`
      },
      { label: "PSPF Requirements in scope", value: String(scopedRequirements.length) },
      { label: "Requirements needing attention", value: String(requirementsNeedingAttention.length) },
      { label: "Open actions", value: String(openActions.length) },
      { label: "Open risks", value: String(openRisks.length) },
      { label: "Evidence items needing review", value: String(evidenceNeedingReview.length) }
    ],
    executiveFraming: buildExecutiveFraming(
      edition,
      pspfDomainTitle,
      overallCompliancePercent,
      requirementsNeedingAttention.length,
      openActions.length,
      openRisks.length,
      evidenceNeedingReview.length
    ),
    featureStories: buildFeatureStories(
      activeStrategy,
      requirementsNeedingAttention,
      input.changeRecords ?? [],
      masterPlan
    ),
    attentionItems: buildAttentionItems(
      requirementsNeedingAttention,
      input.domains,
      domainTitlesById,
      actionLayersByRequirementId
    ).slice(0, 12),
    actionStrip: buildActionStrip(openActions, requirementSummariesByTargetId).slice(0, 12),
    commercialWatch: buildCommercialWatch(linkedSpendItems).slice(0, 6),
    masterPlan,
    readerActions: buildReaderActions(
      edition,
      requirementsNeedingAttention.length,
      openActions.length,
      evidenceNeedingReview.length
    ),
    nextIssueTeaser: buildNextIssueTeaser(pspfDomainTitle, openRisks.length, linkedSpendItems.length)
  };
}

export function buildCisoMasterPlanModel(input: CisoMagazineInput): CisoMasterPlanModel {
  const strategy = (input.strategies ?? []).find((item) => item.recordStatus !== "deleted");
  const openActions = input.actions.filter((action) => !["done", "cancelled"].includes(action.status));
  const initiativePlans = buildInitiativePlans(openActions, input.evidence, input.links);
  const blockedActions = openActions.filter((action) => action.status === "blocked");
  const inProgressActions = openActions.filter((action) => action.status === "in-progress");
  const upcomingActions = openActions.filter((action) => action.status === "todo");
  const openRisks = input.risks.filter((risk) => risk.status !== "closed");
  const linkedSpendItems = (input.spendItems ?? []).filter((item) => !["cancelled", "spent"].includes(item.status));
  const horizon = strategy?.timeHorizon ?? "Current assurance horizon";
  const direction =
    strategy?.strategyStatement ??
    "Use the current strategy, Plan of Action, risk movement, and supplier milestones to steer the next assurance period.";
  const strategicStreams = strategy?.choices.map((choice) => ({
    title: choice.statement,
    phase: choice.targetPosture,
    status: `${label(choice.trend)} / ${label(choice.confidence)} confidence`,
    basis: choice.capabilityArea
  }));
  const initiativeStreams = initiativePlans.map((initiative) => ({
    title: initiative.title,
    phase: initiative.stages.map((stage) => stage.stage).join(" / "),
    status: `${initiative.stages.length} staged action(s) · ${initiative.evidenceCount} evidence item(s)`,
    basis: "Roadmap initiative"
  }));
  const fallbackStreams: readonly CisoMasterPlanStream[] = [
    {
      title: "Assure the evidence base",
      phase: "Stabilise",
      status: `${input.evidence.filter((item) => item.freshness !== "current").length} evidence item(s) need review`,
      basis: "Evidence Review"
    },
    {
      title: "Move priority actions",
      phase: "Mobilise",
      status: `${openActions.length} open action(s)`,
      basis: "Plan of Action"
    },
    {
      title: "Reduce material risk",
      phase: "Sustain",
      status: `${openRisks.length} open risk(s)`,
      basis: "Risk and Connected View"
    }
  ];
  const streams = [
    ...(strategicStreams && strategicStreams.length > 0 ? strategicStreams : fallbackStreams),
    ...initiativeStreams
  ].slice(0, 8);
  const phases: readonly CisoMasterPlanPhase[] = [
    {
      title: "Stabilise",
      focus: "Confirm evidence, assumptions, dependencies, and decision records.",
      count: blockedActions.length
    },
    {
      title: "Mobilise",
      focus: "Move active work through the Plan of Action and unblock delivery.",
      count: inProgressActions.length
    },
    {
      title: "Sustain",
      focus: "Turn planned uplift into routine reporting, assurance, and supplier cadence.",
      count: upcomingActions.length
    }
  ];
  const dependencies = [
    ...linkedSpendItems.map((item) => ({
      title: item.title,
      source: "Shop supplier or spend milestone",
      status: `${label(item.status)} · ${item.financialYear}`
    })),
    ...openRisks.slice(0, 3).map((risk) => ({
      title: risk.title,
      source: "Risk dependency",
      status: `${label(risk.status)} · score ${risk.likelihood * risk.impact}`
    }))
  ].slice(0, 8);
  const roleOwnership = buildRoleOwnershipSummary(input.requirementControlMappings ?? []);
  const articleBody = `${streams.length} CISO plan stream(s) are combined into the Master Plan for ${horizon}. The plan starts from strategy, uses the Plan of Action as the delivery spine, includes ${initiativePlans.length} idea or initiative plan(s), and calls out ${dependencies.length} dependency or supplier milestone(s) that could change the path.`;

  return {
    title: "CISO Master Plan",
    horizon,
    direction,
    streams,
    initiativePlans,
    phases,
    dependencies,
    roleOwnership,
    newsletterArticle: {
      title: "CISO Master Plan",
      body: articleBody
    }
  };
}

export function renderCisoMasterPlanMarkdown(input: CisoMagazineInput): string {
  const model = buildCisoMasterPlanModel(input);
  return [
    "OFFICIAL: Sensitive",
    "",
    `# ${model.title}`,
    "",
    `Horizon: ${model.horizon}`,
    "",
    "## Direction",
    "",
    model.direction,
    "",
    "## Streams",
    "",
    ...model.streams.map((stream) => `- ${stream.title} (${stream.status}) - ${stream.basis}; phase: ${stream.phase}`),
    "",
    "## Initiative Plans",
    "",
    ...(model.initiativePlans.length === 0
      ? ["- No staged idea or initiative plans recorded yet."]
      : model.initiativePlans.flatMap((initiative) => [
          `- ${initiative.title}: ${initiative.stages.length} stage(s), ${initiative.evidenceCount} evidence item(s)`,
          ...initiative.stages.map(
            (stage) => `  - ${stage.stage}: ${stage.status}${stage.dueDate ? `; due ${stage.dueDate}` : ""}`
          )
        ])),
    "",
    "## Phases",
    "",
    ...model.phases.map((phase) => `- ${phase.title}: ${phase.focus} (${phase.count} item(s))`),
    "",
    "## Inputs And Dependencies",
    "",
    ...(model.dependencies.length === 0
      ? ["- No linked supplier milestones, external plan inputs, or risk dependencies recorded in this scope."]
      : model.dependencies.map((dependency) => `- ${dependency.title} (${dependency.source}) - ${dependency.status}`)),
    "",
    "## Role Ownership Summary",
    "",
    ...roleOwnershipRows(model.roleOwnership),
    "",
    "Note: this generated plan is a shareable planning view over existing PSPF records. Adapt it as decisions and dependencies change."
  ].join("\n");
}

function buildRoleOwnershipSummary(
  mappings: readonly RequirementControlMappingEntity[]
): readonly RoleOwnershipSummary[] {
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

function roleOwnershipRows(summary: readonly RoleOwnershipSummary[]): readonly string[] {
  if (summary.length === 0) {
    return ["- No role ownership recorded for Requirement-to-ISM control mappings."];
  }
  return summary.map((item) => `- ${item.role}: ${item.requirements} requirement(s), ${item.controls} control(s)`);
}

const roadmapInitiativeStages = ["Design", "Build", "Verify", "Monitor"] as const;
const plannerFrameTitlePrefixes = ["Planner frame:", "Case for action:"] as const;

function buildInitiativePlans(
  actions: readonly ActionEntity[],
  evidence: readonly EvidenceEntity[],
  links: readonly LinkEntity[]
): readonly CisoMasterPlanInitiative[] {
  const evidenceIdsByActionId = buildEvidenceIdsByActionId(links);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const grouped = new Map<
    string,
    {
      readonly stages: CisoMasterPlanInitiativeStage[];
      readonly evidenceIds: Set<string>;
    }
  >();

  for (const item of evidence) {
    const initiativeTitle = parsePlannerFrameTitle(item.title);
    if (!initiativeTitle) {
      continue;
    }
    const group = grouped.get(initiativeTitle) ?? { stages: [], evidenceIds: new Set<string>() };
    group.evidenceIds.add(item.id);
    grouped.set(initiativeTitle, group);
  }

  for (const action of actions) {
    const frameEvidenceIds = evidenceIdsByActionId.get(action.id) ?? [];
    const frameEvidenceTitle = [...frameEvidenceIds]
      .map((evidenceId) => evidenceById.get(evidenceId)?.title)
      .find((title): title is string => Boolean(title && parsePlannerFrameTitle(title)));
    const parsed = frameEvidenceTitle
      ? parsePlannerLinkedAction(action.title, parsePlannerFrameTitle(frameEvidenceTitle) ?? "")
      : parseInitiativeStage(action.title);
    if (!parsed) {
      continue;
    }
    const group = grouped.get(parsed.initiativeTitle) ?? { stages: [], evidenceIds: new Set<string>() };
    group.stages.push({
      actionId: action.id,
      stage: parsed.stage,
      status: label(action.status),
      dueDate: action.dueDate ? formatDisplayDate(action.dueDate) : undefined,
      actionTitle: action.title
    });
    for (const evidenceId of evidenceIdsByActionId.get(action.id) ?? []) {
      group.evidenceIds.add(evidenceId);
    }
    grouped.set(parsed.initiativeTitle, group);
  }

  return [...grouped.entries()]
    .map(([title, group]) => ({
      title,
      stages: group.stages.sort(
        (left, right) =>
          initiativeStageOrder(left.stage) - initiativeStageOrder(right.stage) || left.stage.localeCompare(right.stage)
      ),
      evidence: [...group.evidenceIds]
        .map((evidenceId) => evidenceById.get(evidenceId))
        .filter((item): item is EvidenceEntity => Boolean(item))
        .map((item) => ({
          evidenceId: item.id,
          title: item.title,
          freshness: label(item.freshness)
        }))
        .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" })),
      evidenceCount: group.evidenceIds.size
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
}

function parsePlannerFrameTitle(title: string): string | undefined {
  const prefix = plannerFrameTitlePrefixes.find((candidate) => title.toLowerCase().startsWith(candidate.toLowerCase()));
  const initiativeTitle = prefix ? title.slice(prefix.length).trim() : "";
  return initiativeTitle.length > 0 ? initiativeTitle : undefined;
}

function parsePlannerLinkedAction(
  title: string,
  initiativeTitle: string
): { readonly initiativeTitle: string; readonly stage: string } | undefined {
  const withoutInitiativePrefix = title.toLowerCase().startsWith(`${initiativeTitle.toLowerCase()} - `)
    ? title.slice(initiativeTitle.length + 3).trim()
    : title.trim();
  const stage = withoutInitiativePrefix.split(":")[0]?.trim() || withoutInitiativePrefix;
  return {
    initiativeTitle,
    stage: stage.length > 0 ? stage : "Task"
  };
}

function parseInitiativeStage(title: string): { readonly initiativeTitle: string; readonly stage: string } | undefined {
  const match = title.match(/^(.+?)\s[-:]\s(Design|Build|Verify|Monitor)$/i);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    initiativeTitle: match[1].trim(),
    stage: canonicalInitiativeStage(match[2])
  };
}

function canonicalInitiativeStage(stage: string): string {
  return roadmapInitiativeStages.find((candidate) => candidate.toLowerCase() === stage.toLowerCase()) ?? stage;
}

function initiativeStageOrder(stage: string): number {
  const index = roadmapInitiativeStages.findIndex((candidate) => candidate === stage);
  return index >= 0 ? index : roadmapInitiativeStages.length;
}

function buildEvidenceIdsByActionId(links: readonly LinkEntity[]): ReadonlyMap<string, Set<string>> {
  const evidenceIdsByActionId = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.linkType !== "supported-by") {
      continue;
    }
    const actionId = link.fromType === "action" && link.toType === "evidence" ? link.fromId : undefined;
    const evidenceId = actionId ? link.toId : undefined;
    if (!actionId || !evidenceId) {
      continue;
    }
    const evidenceIds = evidenceIdsByActionId.get(actionId) ?? new Set<string>();
    evidenceIds.add(evidenceId);
    evidenceIdsByActionId.set(actionId, evidenceIds);
  }
  return evidenceIdsByActionId;
}

export function renderCisoMagazineMarkdown(input: CisoMagazineInput): string {
  const model = buildCisoMagazineModel(input);
  return [
    model.classification,
    "",
    `# ${model.title}`,
    "",
    `${model.issueNumber} | ${model.periodLabel} | ${model.pspfDomainTitle}`,
    "",
    `Generated: ${model.generatedAt}`,
    model.sourceLabel ? `Source: ${model.sourceLabel}` : undefined,
    model.bundleVersion ? `Bundle version: ${model.bundleVersion}` : undefined,
    model.schemaVersion ? `Schema version: ${model.schemaVersion}` : undefined,
    "",
    `> ${model.coverHook}`,
    "",
    "## Editor's Note",
    "",
    model.editorNote,
    "",
    "## Why This Matters",
    "",
    ...model.executiveFraming.map((item) => `- ${item.title}: ${item.body}`),
    "",
    "## Current Posture Snapshot",
    "",
    ...model.postureSnapshot.map((metric) => `- ${metric.label}: ${metric.value}`),
    `- Trend: ${model.complianceTrendSummary}`,
    "",
    "## Feature Stories",
    "",
    ...model.featureStories.flatMap((story) => [`### ${story.title}`, "", story.body, ""]),
    "## Attention Required",
    "",
    ...(model.attentionItems.length === 0
      ? ["- No immediate attention items in this PSPF Domain scope."]
      : model.attentionItems.flatMap((item) => [
          `- ${item.title} (${item.pspfDomainTitle}) - ${item.reason}`,
          item.description ? `  - Context: ${item.description}` : undefined,
          `  - Why: ${item.actionLayer.why}`,
          `  - Next step: ${item.actionLayer.nextStep}`,
          `  - Owner and timeframe: ${item.actionLayer.ownerRole}; ${item.actionLayer.timeframe}`,
          `  - Good looks like: ${item.actionLayer.expectedOutcome}`
        ])),
    "",
    "## Action Strip",
    "",
    ...(model.actionStrip.length === 0
      ? ["- No open actions in this PSPF Domain scope."]
      : model.actionStrip.map(
          (item) =>
            `- ${item.title} (${item.status}${item.dueDate ? `, due ${item.dueDate}` : ""}) - ${item.linkedRequirement ?? "No linked Requirement"}; next step: ${item.actionLayer.nextStep}; owner/timeframe: ${item.actionLayer.ownerRole}, ${item.actionLayer.timeframe}; good looks like: ${item.actionLayer.expectedOutcome}${item.latestUpdate ? `; latest update: ${item.latestUpdate}` : ""}`
        )),
    "",
    "## Commercial Watch",
    "",
    ...(model.commercialWatch.length === 0
      ? ["- No linked Shop spend items in this issue scope."]
      : model.commercialWatch.map((item) => `- ${item.title} (${item.status}) - ${item.amount}`)),
    "",
    ...(model.masterPlan
      ? [
          "## CISO Master Plan",
          "",
          model.masterPlan.newsletterArticle.body,
          "",
          ...model.masterPlan.streams.map((stream) => `- ${stream.title} (${stream.status}) - ${stream.basis}`),
          ""
        ]
      : []),
    "## Reader Actions",
    "",
    ...model.readerActions.map((action) => `- ${action}`),
    "",
    "## Next Issue",
    "",
    model.nextIssueTeaser,
    "",
    "Note: restricted personal fields, sensitive assumptions, and non-public working notes are excluded from this issue."
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export function renderCisoMagazineHtml(input: CisoMagazineInput): string {
  const model = buildCisoMagazineModel(input);
  const metadata = [
    `Generated ${model.generatedAt}`,
    model.sourceLabel ? `Source ${model.sourceLabel}` : undefined,
    model.bundleVersion ? `Bundle ${model.bundleVersion}` : undefined,
    model.schemaVersion ? `Schema ${model.schemaVersion}` : undefined
  ].filter((item): item is string => Boolean(item));
  const theme =
    model.edition === "ciso"
      ? `:root { color-scheme: dark; --ink: #f4f7fb; --paper: #07111c; --panel: #0f1e2d; --line: #4fd1c5; --accent: #f6ad55; --muted: #b8c4d4; }`
      : `:root { color-scheme: light; --ink: #201f1e; --paper: #fffaf0; --panel: #ffffff; --line: #2f6f73; --accent: #b54708; --muted: #62625f; }`;
  const coverBackground =
    model.edition === "ciso"
      ? "linear-gradient(135deg, #07111c 0%, #10253a 55%, #163f45 100%)"
      : "linear-gradient(135deg, #fffaf0 0%, #ffffff 60%, #d8f0ef 100%)";
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)}</title>
  <style>
    ${theme}
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--paper); font-family: Georgia, 'Times New Roman', serif; }
    .issue { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .classification { background: #f4c542; color: #1f1a00; font: 700 13px/1.4 Arial, sans-serif; padding: 8px 12px; text-transform: uppercase; }
    .cover { border: 4px solid var(--ink); background: ${coverBackground}; padding: 24px; min-height: 360px; display: grid; gap: 20px; align-content: space-between; }
    .kicker, .meta, .section-label, .footer { color: var(--muted); font: 700 12px/1.4 Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(40px, 7vw, 86px); line-height: .95; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 28px; line-height: 1.1; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 20px; line-height: 1.2; letter-spacing: 0; }
    p { font-size: 17px; line-height: 1.55; }
    .hook { max-width: 760px; font-size: 26px; line-height: 1.2; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-top: 18px; }
    .panel { border: 2px solid var(--ink); background: var(--panel); padding: 16px; box-shadow: 5px 5px 0 rgba(32,31,30,.15); }
    .metric { border-left: 6px solid var(--line); }
    .metric strong { display: block; font-size: 34px; line-height: 1; }
    .trend p { margin: 8px 0 0; color: var(--muted); font: 700 12px/1.4 Arial, sans-serif; text-transform: uppercase; }
    .attention { border-left: 6px solid var(--accent); }
    .action-strip li, .reader-actions li { margin: 0 0 10px; }
    .footer { border-top: 2px solid var(--ink); margin-top: 28px; padding-top: 16px; }
    @media print { body { background: #fff; } .issue { max-width: none; padding: 0; } .panel { box-shadow: none; break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="issue">
    <div class="classification">${escapeHtml(model.classification)}</div>
    <section class="cover" aria-labelledby="issue-title">
      <div>
        <div class="kicker">${escapeHtml(model.issueNumber)} | ${escapeHtml(model.periodLabel)} | ${escapeHtml(model.pspfDomainTitle)}</div>
        <h1 id="issue-title">${escapeHtml(model.title)}</h1>
      </div>
      <p class="hook">${escapeHtml(model.coverHook)}</p>
      <div class="meta">${metadata.map(escapeHtml).join(" | ")}</div>
    </section>
    <section class="grid" aria-label="Current posture snapshot">
      ${model.postureSnapshot
        .map(
          (metric) =>
            `<article class="panel metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></article>`
        )
        .join("\n      ")}
      <article class="panel metric trend"><span>Compliance trend</span><strong>${escapeHtml(model.overallCompliancePercent === undefined ? "n/a" : `${model.overallCompliancePercent}%`)}</strong><p>${escapeHtml(model.complianceTrendSummary)}</p></article>
    </section>
    <section class="grid" aria-label="Magazine stories">
      <article class="panel"><div class="section-label">Editor's note</div><p>${escapeHtml(model.editorNote)}</p></article>
      ${renderHtmlStoryPanel("Why this matters", model.executiveFraming)}
      ${model.featureStories
        .map(
          (story) =>
            `<article class="panel"><h2>${escapeHtml(story.title)}</h2><p>${escapeHtml(story.body)}</p></article>`
        )
        .join("\n      ")}
    </section>
    <section class="grid" aria-label="Attention required">
      ${renderHtmlListPanel(
        "Attention required",
        model.attentionItems,
        (item) =>
          `${item.title} (${item.pspfDomainTitle}) - ${item.reason}; why: ${item.actionLayer.why}; next step: ${item.actionLayer.nextStep}; owner/timeframe: ${item.actionLayer.ownerRole}, ${item.actionLayer.timeframe}; good looks like: ${item.actionLayer.expectedOutcome}`,
        "No immediate attention items in this PSPF Domain scope.",
        "attention"
      )}
      ${renderHtmlListPanel(
        "Action strip",
        model.actionStrip,
        (item) =>
          `${item.title} (${item.status}${item.dueDate ? `, due ${item.dueDate}` : ""}) - ${item.linkedRequirement ?? "No linked Requirement"}; next step: ${item.actionLayer.nextStep}; owner/timeframe: ${item.actionLayer.ownerRole}, ${item.actionLayer.timeframe}; good looks like: ${item.actionLayer.expectedOutcome}${item.latestUpdate ? `; latest update: ${item.latestUpdate}` : ""}`,
        "No open actions in this PSPF Domain scope.",
        "action-strip"
      )}
      ${renderHtmlListPanel(
        "Commercial watch",
        model.commercialWatch,
        (item) => `${item.title} (${item.status}) - ${item.amount}`,
        "No linked Shop spend items in this issue scope.",
        ""
      )}
    </section>
    ${
      model.masterPlan
        ? `<section class="grid" aria-label="CISO Master Plan">
      <article class="panel"><h2>${escapeHtml(model.masterPlan.newsletterArticle.title)}</h2><p>${escapeHtml(model.masterPlan.newsletterArticle.body)}</p></article>
      ${renderHtmlListPanel(
        "Plan streams",
        model.masterPlan.streams,
        (item) => `${item.title} (${item.status}) - ${item.basis}; phase: ${item.phase}`,
        "No plan streams generated.",
        ""
      )}
      ${renderHtmlListPanel(
        "Inputs and dependencies",
        model.masterPlan.dependencies,
        (item) => `${item.title} (${item.source}) - ${item.status}`,
        "No linked supplier milestones, external plan inputs, or risk dependencies recorded in this scope.",
        ""
      )}
    </section>`
        : ""
    }
    <section class="grid" aria-label="Reader actions and next issue">
      ${renderHtmlListPanel("Reader actions", model.readerActions, (item) => item, "No reader actions generated.", "reader-actions")}
      <article class="panel"><h2>Next issue</h2><p>${escapeHtml(model.nextIssueTeaser)}</p></article>
    </section>
    <footer class="footer">Restricted personal fields, sensitive assumptions, and non-public working notes are excluded from this issue.</footer>
  </main>
</body>
</html>`;
}

export function renderPostureBriefMarkdown(input: PostureBriefInput): string {
  const requirementsById = new Map(input.requirements.map((requirement) => [requirement.id, requirement]));
  const requirementSummariesByTargetId = buildRequirementSummariesByTargetId(input.links, requirementsById);
  const evidenceIdsByRequirement = buildIdsByRequirement(input.links, "supported-by", "evidence");
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const openActions = input.actions.filter((action) => !["done", "cancelled"].includes(action.status));
  const openRisks = input.risks.filter((risk) => risk.status !== "closed");
  const directions = input.directions ?? [];
  const strategy = (input.strategies ?? []).find((item) => item.recordStatus !== "deleted");
  const directionsNeedingResponse = directions.filter(
    (direction) => direction.responseState === "not-set" || direction.responseState === "no"
  ).length;
  const currentEvidenceRequirements = input.requirements.filter((requirement) =>
    (evidenceIdsByRequirement.get(requirement.id) ?? []).some(
      (evidenceId) => evidenceById.get(evidenceId)?.freshness === "current"
    )
  ).length;
  const evidenceNeedsReview = input.evidence.filter((item) => item.freshness !== "current").length;
  const roleOwnership = buildRoleOwnershipSummary(input.requirementControlMappings ?? []);
  const ismPostureRows = buildIsmControlPostureRows(input.sourceControls ?? [], input.links);
  const postureFramingRows = buildPostureBriefFramingRows(
    input.requirements.length,
    openActions.length,
    openRisks.length,
    evidenceNeedsReview,
    directionsNeedingResponse,
    roleOwnership.length
  );
  const metadata = [
    `Generated: ${formatDisplayDate(input.generatedAt)}`,
    input.sourceLabel ? `Source: ${input.sourceLabel}` : undefined,
    input.bundleVersion ? `Bundle version: ${input.bundleVersion}` : undefined,
    input.schemaVersion ? `Schema version: ${input.schemaVersion}` : undefined
  ].filter((line): line is string => Boolean(line));

  return [
    "OFFICIAL: Sensitive",
    "",
    "# PSPF Posture Brief",
    "",
    ...metadata,
    "",
    "## Summary",
    "",
    `- Requirements: ${input.requirements.length}`,
    `- Evidence items: ${input.evidence.length}`,
    `- Actions: ${input.actions.length}`,
    `- Risks: ${input.risks.length}`,
    `- Directions: ${directions.length}${directions.length > 0 ? ` (${directionsNeedingResponse} need a response)` : ""}`,
    strategy
      ? `- Strategy: ${strategy.title} (${strategy.scope}, ${strategy.timeHorizon})`
      : "- Strategy: None recorded",
    `- Role ownership: ${roleOwnership.length} role(s), ${roleOwnership.reduce((total, item) => total + item.requirements, 0)} requirement coverage count, ${roleOwnership.reduce((total, item) => total + item.controls, 0)} control coverage count`,
    "",
    "## Why This Matters",
    "",
    ...postureFramingRows,
    "",
    "## Strategy",
    "",
    ...strategyRows(strategy),
    "",
    "## Requirement Status",
    "",
    ...statusRows(input.requirements),
    "",
    "## Evidence Basis",
    "",
    `- Requirements with current evidence: ${currentEvidenceRequirements}`,
    `- Evidence needing freshness review: ${evidenceNeedsReview}`,
    "",
    "## Role Ownership Summary",
    "",
    ...roleOwnershipRows(roleOwnership),
    "",
    "## ISM Control Posture",
    "",
    ...ismPostureRows,
    "",
    "## Domain Summary",
    "",
    ...input.domains.map((domain) => {
      const domainRequirements = input.requirements.filter((requirement) => requirement.domainId === domain.id);
      const domainMet = domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
      return `- ${domain.title}: ${domainRequirements.length} requirement(s), ${domainMet} met`;
    }),
    "",
    "## Open Actions",
    "",
    ...(openActions.length === 0
      ? ["- None recorded."]
      : openActions.map(
          (action) =>
            `- ${action.title} (${label(action.status)}${action.dueDate ? `, due ${formatDueDate(action.dueDate)}` : ""}) - ${requirementSummariesByTargetId.get(action.id) ?? "No linked requirement"}${latestActionCommentary(action) ? `; latest update: ${latestActionCommentary(action)}` : ""}`
        )),
    "",
    "## Open Risks",
    "",
    ...(openRisks.length === 0
      ? ["- None recorded."]
      : openRisks.map(
          (risk) =>
            `- ${risk.title} (${label(risk.status)}, likelihood ${risk.likelihood}, impact ${risk.impact}) - ${requirementSummariesByTargetId.get(risk.id) ?? "No linked requirement"}`
        )),
    "",
    "## Directions",
    "",
    ...(directions.length === 0
      ? ["- None registered."]
      : directions.map(
          (direction) =>
            `- ${label(direction.responseState)} - ${directionBriefTitle(direction)}${direction.sourceAuthority ? ` (${direction.sourceAuthority})` : ""}`
        )),
    "",
    "Note: internal summaries and restricted personal fields are excluded from this brief."
  ].join("\n");
}

function directionBriefTitle(direction: DirectionEntity): string {
  const reference = direction.reference.trim();
  const title = direction.title.trim();
  return title.toLowerCase().startsWith(reference.toLowerCase()) ? title : `${reference}: ${title}`;
}

function buildIsmControlPostureRows(
  sourceControls: readonly SourceControlEntity[],
  links: readonly LinkEntity[]
): readonly string[] {
  const controls = sourceControls.filter((item) => item.recordStatus !== "deleted");
  if (controls.length === 0) {
    return ["- No ISM source controls included in this brief."];
  }
  const controlIds = new Set(controls.map((item) => item.id));
  const directWorkLinks = links.filter(
    (link) =>
      link.recordStatus !== "deleted" &&
      link.fromType === "source-control" &&
      controlIds.has(link.fromId) &&
      (link.toType === "evidence" || link.toType === "action" || link.toType === "risk")
  );
  const directlyWorkedControls = new Set(directWorkLinks.map((link) => link.fromId));
  const assessed = controls.filter((item) => item.implementationStatus !== undefined).length;
  return [
    `- ISM controls in scope: ${controls.length}`,
    `- Controls with internal implementation assessment: ${assessed}`,
    `- Controls with direct evidence, action, or risk links: ${directlyWorkedControls.size}`,
    `- Direct ISM control work links: ${directWorkLinks.length}`,
    "- Implementation status detail remains internal and is excluded from published Explorer bundles."
  ];
}

function buildPostureBriefFramingRows(
  requirementCount: number,
  openActionCount: number,
  openRiskCount: number,
  evidenceNeedsReview: number,
  directionsNeedingResponse: number,
  roleCount: number
): readonly string[] {
  return [
    `- Mission impact: this posture brief connects ${requirementCount} PSPF Requirement(s) to the work needed to protect information integrity, defensible decisions, service reliability, and public trust.`,
    `- Current state: ${openActionCount} open action(s), ${openRiskCount} open risk(s), and ${evidenceNeedsReview} evidence item(s) need visible follow-through.`,
    `- Action required: confirm one next step, one responsible role or team, and one timeframe for each material gap before the next reporting cycle.`,
    `- Who needs to act: ${roleCount > 0 ? `${roleCount} recorded role group(s)` : "ownership not confirmed"} should use this brief to update evidence, escalate blockers, and record risk decisions.`,
    `- Escalate immediately: ${directionsNeedingResponse} Direction(s) still need a response and should not wait for the next reporting cycle.`
  ];
}

export const POSTURE_BRIEF_BROWSER_SCRIPT = String.raw`globalThis.pspfBriefRenderer = (() => {
  function renderPostureBriefMarkdown(input) {
    const requirementsById = new Map((input.requirements || []).map((requirement) => [requirement.id, requirement]));
    const requirementSummariesByTargetId = buildRequirementSummariesByTargetId(input.links || [], requirementsById);
    const evidenceIdsByRequirement = buildIdsByRequirement(input.links || [], "supported-by", "evidence");
    const evidenceById = new Map((input.evidence || []).map((item) => [item.id, item]));
    const openActions = (input.actions || []).filter((action) => !["done", "cancelled"].includes(action.status));
    const openRisks = (input.risks || []).filter((risk) => risk.status !== "closed");
    const directions = input.directions || [];
    const strategy = (input.strategies || []).find((item) => item.recordStatus !== "deleted");
    const directionsNeedingResponse = directions.filter((direction) => direction.responseState === "not-set" || direction.responseState === "no").length;
    const currentEvidenceRequirements = (input.requirements || []).filter((requirement) => (evidenceIdsByRequirement.get(requirement.id) || []).some((evidenceId) => evidenceById.get(evidenceId)?.freshness === "current")).length;
    const evidenceNeedsReview = (input.evidence || []).filter((item) => item.freshness !== "current").length;
    const roleOwnership = buildRoleOwnershipSummary(input.requirementControlMappings || []);
    const ismPostureRows = buildIsmControlPostureRows(input.sourceControls || [], input.links || []);
    const postureFramingRows = buildPostureBriefFramingRows((input.requirements || []).length, openActions.length, openRisks.length, evidenceNeedsReview, directionsNeedingResponse, roleOwnership.length);
    const metadata = [
      "Generated: " + formatDisplayDate(input.generatedAt),
      input.sourceLabel ? "Source: " + input.sourceLabel : undefined,
      input.bundleVersion ? "Bundle version: " + input.bundleVersion : undefined,
      input.schemaVersion ? "Schema version: " + input.schemaVersion : undefined
    ].filter(Boolean);
    return [
      "OFFICIAL: Sensitive",
      "",
      "# PSPF Posture Brief",
      "",
      ...metadata,
      "",
      "## Summary",
      "",
      "- Requirements: " + (input.requirements || []).length,
      "- Evidence items: " + (input.evidence || []).length,
      "- Actions: " + (input.actions || []).length,
      "- Risks: " + (input.risks || []).length,
      "- Directions: " + directions.length + (directions.length > 0 ? " (" + directionsNeedingResponse + " need a response)" : ""),
      strategy ? "- Strategy: " + strategy.title + " (" + strategy.scope + ", " + strategy.timeHorizon + ")" : "- Strategy: None recorded",
      "- Role ownership: " + roleOwnership.length + " role(s), " + roleOwnership.reduce((total, item) => total + item.requirements, 0) + " requirement coverage count, " + roleOwnership.reduce((total, item) => total + item.controls, 0) + " control coverage count",
      "",
      "## Why This Matters",
      "",
      ...postureFramingRows,
      "",
      "## Strategy",
      "",
      ...strategyRows(strategy),
      "",
      "## Requirement Status",
      "",
      ...statusRows(input.requirements || []),
      "",
      "## Evidence Basis",
      "",
      "- Requirements with current evidence: " + currentEvidenceRequirements,
      "- Evidence needing freshness review: " + evidenceNeedsReview,
      "",
      "## Role Ownership Summary",
      "",
      ...roleOwnershipRows(roleOwnership),
      "",
      "## ISM Control Posture",
      "",
      ...ismPostureRows,
      "",
      "## Domain Summary",
      "",
      ...(input.domains || []).map((domain) => {
        const domainRequirements = (input.requirements || []).filter((requirement) => requirement.domainId === domain.id);
        const domainMet = domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
        return "- " + domain.title + ": " + domainRequirements.length + " requirement(s), " + domainMet + " met";
      }),
      "",
      "## Open Actions",
      "",
      ...(openActions.length === 0 ? ["- None recorded."] : openActions.map((action) => "- " + action.title + " (" + label(action.status) + (action.dueDate ? ", due " + formatDueDate(action.dueDate) : "") + ") - " + (requirementSummariesByTargetId.get(action.id) || "No linked requirement") + (latestActionCommentary(action) ? "; latest update: " + latestActionCommentary(action) : ""))),
      "",
      "## Open Risks",
      "",
      ...(openRisks.length === 0 ? ["- None recorded."] : openRisks.map((risk) => "- " + risk.title + " (" + label(risk.status) + ", likelihood " + risk.likelihood + ", impact " + risk.impact + ") - " + (requirementSummariesByTargetId.get(risk.id) || "No linked requirement"))),
      "",
      "## Directions",
      "",
      ...(directions.length === 0 ? ["- None registered."] : directions.map((direction) => "- " + label(direction.responseState) + " - " + directionBriefTitle(direction) + (direction.sourceAuthority ? " (" + direction.sourceAuthority + ")" : ""))),
      "",
      "Note: internal summaries and restricted personal fields are excluded from this brief."
    ].join("\n");
  }
  function directionBriefTitle(direction) {
    const reference = String(direction.reference || "").trim();
    const title = String(direction.title || "").trim();
    return title.toLowerCase().startsWith(reference.toLowerCase()) ? title : reference + ": " + title;
  }
  function statusRows(requirements) {
    const counts = countBy(requirements, (requirement) => requirement.assessmentStatus);
    const rows = Object.entries(counts).map(([status, count]) => "- " + label(status) + ": " + count);
    return rows.length > 0 ? rows : ["- None recorded."];
  }
  function buildRoleOwnershipSummary(mappings) {
    const summary = new Map();
    for (const mapping of (mappings || []).filter((item) => item.recordStatus !== "deleted")) {
      const role = (mapping.reviewBy || "").trim() || "Not recorded";
      const current = summary.get(role) || { requirementIds: new Set(), controlIds: new Set() };
      current.requirementIds.add(mapping.requirementId);
      current.controlIds.add(mapping.sourceControlId);
      summary.set(role, current);
    }
    return [...summary.entries()]
      .map(([role, counts]) => ({ role, requirements: counts.requirementIds.size, controls: counts.controlIds.size }))
      .sort((left, right) => left.role.localeCompare(right.role, "en-AU", { sensitivity: "base" }));
  }
  function roleOwnershipRows(summary) {
    if (summary.length === 0) {
      return ["- No role ownership recorded for Requirement-to-ISM control mappings."];
    }
    return summary.map((item) => "- " + item.role + ": " + item.requirements + " requirement(s), " + item.controls + " control(s)");
  }
  function buildIsmControlPostureRows(sourceControls, links) {
    const controls = (sourceControls || []).filter((item) => item.recordStatus !== "deleted");
    if (controls.length === 0) {
      return ["- No ISM source controls included in this brief."];
    }
    const controlIds = new Set(controls.map((item) => item.id));
    const directWorkLinks = (links || []).filter((link) => link.recordStatus !== "deleted" && link.fromType === "source-control" && controlIds.has(link.fromId) && (link.toType === "evidence" || link.toType === "action" || link.toType === "risk"));
    const directlyWorkedControls = new Set(directWorkLinks.map((link) => link.fromId));
    const assessed = controls.filter((item) => item.implementationStatus !== undefined).length;
    return [
      "- ISM controls in scope: " + controls.length,
      "- Controls with internal implementation assessment: " + assessed,
      "- Controls with direct evidence, action, or risk links: " + directlyWorkedControls.size,
      "- Direct ISM control work links: " + directWorkLinks.length,
      "- Implementation status detail remains internal and is excluded from published Explorer bundles."
    ];
  }
  function buildPostureBriefFramingRows(requirementCount, openActionCount, openRiskCount, evidenceNeedsReview, directionsNeedingResponse, roleCount) {
    return [
      "- Mission impact: this posture brief connects " + requirementCount + " PSPF Requirement(s) to the work needed to protect information integrity, defensible decisions, service reliability, and public trust.",
      "- Current state: " + openActionCount + " open action(s), " + openRiskCount + " open risk(s), and " + evidenceNeedsReview + " evidence item(s) need visible follow-through.",
      "- Action required: confirm one next step, one responsible role or team, and one timeframe for each material gap before the next reporting cycle.",
      "- Who needs to act: " + (roleCount > 0 ? roleCount + " recorded role group(s)" : "ownership not confirmed") + " should use this brief to update evidence, escalate blockers, and record risk decisions.",
      "- Escalate immediately: " + directionsNeedingResponse + " Direction(s) still need a response and should not wait for the next reporting cycle."
    ];
  }
  function strategyRows(strategy) {
    if (!strategy) {
      return ["- None recorded."];
    }
    const rows = [
      "- Statement: " + strategy.strategyStatement,
      "- Risk posture: " + strategy.riskPostureStatement,
      strategy.executiveSummary ? "- Executive summary: " + strategy.executiveSummary : undefined,
      strategy.owner ? "- Owner: " + strategy.owner : undefined,
      strategy.frameworks && strategy.frameworks.length > 0 ? "- Frameworks: " + strategy.frameworks.join(", ") : undefined
    ].filter(Boolean);
    const choices = (strategy.choices || []).slice(0, 3).map((choice) => "- Choice: " + choice.statement + " - " + choice.targetPosture);
    return [...rows, ...choices];
  }
  function buildRequirementSummariesByTargetId(links, requirementsById) {
    const refsByTargetId = new Map();
    for (const link of links) {
      if (link.fromType !== "requirement") {
        continue;
      }
      const requirement = requirementsById.get(link.fromId);
      if (!requirement) {
        continue;
      }
      refsByTargetId.set(link.toId, [...(refsByTargetId.get(link.toId) || []), requirementReference(requirement)]);
    }
    return new Map(Array.from(refsByTargetId.entries()).map(([targetId, refs]) => {
      const uniqueRefs = [...new Set(refs)].sort((left, right) => left.localeCompare(right, "en-AU", { numeric: true }));
      return [targetId, uniqueRefs.join(", ") + " (" + uniqueRefs.length + " linked)"];
    }));
  }
  function requirementReference(requirement) {
    const number = String(requirement.title || "").match(/^\s*(\d+[A-Za-z]?)\b/)?.[1];
    return number ? "Req " + number : "Req " + compactEntityId(requirement.id);
  }
  function compactEntityId(id) {
    const parts = String(id || "").split("-").filter(Boolean);
    return parts.at(-1) || id;
  }
  function buildIdsByRequirement(links, linkType, toType) {
    const idsByRequirement = new Map();
    for (const link of links) {
      if (link.fromType === "requirement" && link.linkType === linkType && link.toType === toType) {
        idsByRequirement.set(link.fromId, [...(idsByRequirement.get(link.fromId) || []), link.toId]);
      }
    }
    return idsByRequirement;
  }
  function countBy(items, getKey) {
    const counts = {};
    for (const item of items) {
      const key = getKey(item);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
  function label(value) {
    return String(value).replaceAll("-", " ").replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase()).replace(/^./, (letter) => letter.toUpperCase());
  }
  function latestActionCommentary(action) {
    const entries = [...(action.commentary || [])].filter((entry) => entry && entry.text).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
    const latest = entries[0];
    return latest ? formatDisplayDate(latest.createdAt) + " - " + latest.text : undefined;
  }
  function formatDisplayDate(value) {
    const date = safeDate(value);
    return date ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "unknown";
  }
  function formatDueDate(value) {
    const date = safeDate(value);
    return date ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "unknown";
  }
  function safeDate(value) {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }
  return { renderPostureBriefMarkdown };
})();`;

function statusRows(requirements: readonly RequirementEntity[]): readonly string[] {
  const rows = Object.entries(countBy(requirements, (requirement) => requirement.assessmentStatus)).map(
    ([status, count]) => `- ${label(status)}: ${count}`
  );
  return rows.length > 0 ? rows : ["- None recorded."];
}

function strategyRows(strategy: StrategyEntity | undefined): readonly string[] {
  if (!strategy) {
    return ["- None recorded."];
  }
  const rows = [
    `- Statement: ${strategy.strategyStatement}`,
    `- Risk posture: ${strategy.riskPostureStatement}`,
    strategy.executiveSummary ? `- Executive summary: ${strategy.executiveSummary}` : undefined,
    strategy.owner ? `- Owner: ${strategy.owner}` : undefined,
    strategy.frameworks.length > 0 ? `- Frameworks: ${strategy.frameworks.join(", ")}` : undefined
  ].filter((row): row is string => Boolean(row));
  const choices = strategy.choices
    .slice(0, 3)
    .map((choice) => `- Choice: ${choice.statement} - ${choice.targetPosture}`);
  return [...rows, ...choices];
}

function buildRequirementSummariesByTargetId(
  links: readonly LinkEntity[],
  requirementsById: ReadonlyMap<string, RequirementEntity>
): ReadonlyMap<string, string> {
  const refsByTargetId = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType !== "requirement") {
      continue;
    }
    const requirement = requirementsById.get(link.fromId);
    if (!requirement) {
      continue;
    }
    refsByTargetId.set(link.toId, [...(refsByTargetId.get(link.toId) ?? []), requirementReference(requirement)]);
  }
  return new Map(
    [...refsByTargetId.entries()].map(([targetId, refs]) => {
      const uniqueRefs = [...new Set(refs)].sort((left, right) =>
        left.localeCompare(right, "en-AU", { numeric: true })
      );
      return [targetId, `${uniqueRefs.join(", ")} (${uniqueRefs.length} linked)`];
    })
  );
}

function requirementReference(requirement: RequirementEntity): string {
  const number = requirement.title.match(/^\s*(\d+[A-Za-z]?)\b/)?.[1];
  return number ? `Req ${number}` : `Req ${compactEntityId(requirement.id)}`;
}

function compactEntityId(id: string): string {
  const parts = id.split("-").filter(Boolean);
  return parts.at(-1) ?? id;
}

function buildIdsByRequirement(
  links: readonly LinkEntity[],
  linkType: string,
  toType: string
): ReadonlyMap<string, readonly string[]> {
  const idsByRequirement = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType === "requirement" && link.linkType === linkType && link.toType === toType) {
      idsByRequirement.set(link.fromId, [...(idsByRequirement.get(link.fromId) ?? []), link.toId]);
    }
  }
  return idsByRequirement;
}

function buildTargetIdsByRequirement(
  links: readonly LinkEntity[]
): Map<string, { actions: string[]; risks: string[]; evidence: string[] }> {
  const idsByRequirement = new Map<string, { actions: string[]; risks: string[]; evidence: string[] }>();
  for (const link of links) {
    if (link.fromType !== "requirement") {
      continue;
    }
    const current = idsByRequirement.get(link.fromId) ?? { actions: [], risks: [], evidence: [] };
    if (link.linkType === "addressed-by" && link.toType === "action") {
      current.actions.push(link.toId);
    }
    if (link.linkType === "exposed-by" && link.toType === "risk") {
      current.risks.push(link.toId);
    }
    if (link.linkType === "supported-by" && link.toType === "evidence") {
      current.evidence.push(link.toId);
    }
    idsByRequirement.set(link.fromId, current);
  }
  return idsByRequirement;
}

function selectPspfDomains(
  domains: readonly Pick<DomainEntity, "id" | "title">[],
  scope: CisoMagazinePspfDomainScope
): readonly Pick<DomainEntity, "id" | "title">[] {
  if (scope === "all") {
    return domains;
  }
  return domains.filter((domain) => pspfDomainCode(domain) === scope);
}

function selectCisoTechnicalDomains(
  domains: readonly Pick<DomainEntity, "id" | "title">[]
): readonly Pick<DomainEntity, "id" | "title">[] {
  return domains.filter((domain) => ["INFO", "TECH"].includes(pspfDomainCode(domain)));
}

function pspfDomainCode(
  domain: Pick<DomainEntity, "title"> & { readonly code?: DomainEntity["code"] }
): CisoMagazinePspfDomainScope {
  const codes: Record<DomainEntity["code"], CisoMagazinePspfDomainScope> = {
    governance: "GOV",
    "security-risk": "RISK",
    information: "INFO",
    technology: "TECH",
    personnel: "PER",
    physical: "PHYS"
  };
  if (domain.code) {
    return codes[domain.code];
  }
  const title = domain.title.toLocaleLowerCase("en-AU");
  if (title.includes("information")) {
    return "INFO";
  }
  if (title.includes("technology")) {
    return "TECH";
  }
  if (title.includes("personnel")) {
    return "PER";
  }
  if (title.includes("physical")) {
    return "PHYS";
  }
  if (title.includes("risk")) {
    return "RISK";
  }
  return "GOV";
}

function isSpendItemLinkedToScopedWork(
  item: SpendItemEntity,
  links: readonly LinkEntity[],
  requirementIds: ReadonlySet<string>,
  actionIds: ReadonlySet<string>
): boolean {
  return links.some(
    (link) =>
      (link.fromId === item.id &&
        ((link.toType === "requirement" && requirementIds.has(link.toId)) ||
          (link.toType === "action" && actionIds.has(link.toId)))) ||
      (link.toId === item.id &&
        ((link.fromType === "requirement" && requirementIds.has(link.fromId)) ||
          (link.fromType === "action" && actionIds.has(link.fromId))))
  );
}

function buildCoverHook(
  edition: CisoMagazineEdition,
  requirementCount: number,
  actionCount: number,
  pspfDomainTitle: string
): string {
  if (requirementCount === 0 && actionCount === 0) {
    return edition === "cso"
      ? `${pspfDomainTitle} is steady this issue, with no immediate assurance items requiring whole-of-entity attention.`
      : `${pspfDomainTitle} is steady this issue, with no immediate attention items in the selected scope.`;
  }
  if (edition === "cso") {
    return `${pspfDomainTitle} has ${requirementCount} requirement(s) and ${actionCount} action(s) that need coordinated leadership, business, and security follow-through before the next assurance checkpoint.`;
  }
  return `${pspfDomainTitle} has ${requirementCount} requirement(s) and ${actionCount} action(s) needing attention before the next assurance checkpoint.`;
}

function buildEditorNote(
  edition: CisoMagazineEdition,
  pspfDomainTitle: string,
  strategy?: StrategyEntity,
  override?: string
): string {
  const cleanedOverride = override?.trim();
  if (cleanedOverride) {
    return cleanedOverride;
  }
  const educationCue =
    " PSPF sets the assurance obligations, and ISM controls provide the implementation patterns that help teams show those obligations are being met.";
  const audienceCue =
    edition === "cso"
      ? " This edition is written for whole-of-entity action: leaders remove blockers, business owners confirm impacts, and security teams coordinate the response."
      : " This edition is written for security leadership and delivery teams, with emphasis on control ownership, evidence, and action follow-through.";
  if (!strategy) {
    return `${pspfDomainTitle} is summarised from current PSPF records so leaders can see what changed, what needs attention, and what to do next.${educationCue}${audienceCue}`;
  }
  const strategyStatement = strategy.strategyStatement.trim().replace(/[.?!]\s*$/u, "");
  return `${pspfDomainTitle} is framed against ${strategy.title}: ${strategyStatement}.${educationCue}${audienceCue}`;
}

function buildFeatureStories(
  strategy: StrategyEntity | undefined,
  requirements: readonly RequirementEntity[],
  changeRecords: BundleCollections["change-records"],
  masterPlan?: CisoMasterPlanModel
): readonly CisoMagazineStory[] {
  const stories: CisoMagazineStory[] = [];
  if (masterPlan) {
    stories.push(masterPlan.newsletterArticle);
  }
  if (strategy?.choices[0]) {
    stories.push({ title: strategy.choices[0].statement, body: strategy.choices[0].targetPosture });
  }
  const activeChange = changeRecords.find((record) => record.status === "active");
  if (activeChange) {
    stories.push({ title: activeChange.title, body: activeChange.summary });
  }
  if (stories.length === 0) {
    stories.push({
      title: "Assurance work in motion",
      body: `${requirements.length} PSPF Requirement(s) remain in focus for the selected issue scope.`
    });
  }
  return stories.slice(0, 3);
}

function buildAttentionItems(
  requirements: readonly RequirementEntity[],
  domains: readonly Pick<DomainEntity, "id" | "title">[],
  domainTitlesById: ReadonlyMap<string, string>,
  actionLayersByRequirementId: ReadonlyMap<string, CisoMagazineActionLayer>
): readonly CisoMagazineAttentionItem[] {
  const fallbackDomainTitle = domains[0]?.title ?? "Unmapped PSPF Domain";
  return requirements.map((requirement) => ({
    title: requirement.title,
    reason: constructiveAssessmentPhrase(requirement.assessmentStatus),
    pspfDomainTitle: domainTitlesById.get(requirement.domainId) ?? fallbackDomainTitle,
    actionLayer: actionLayersByRequirementId.get(requirement.id) ?? buildDefaultRequirementActionLayer(requirement)
  }));
}

function buildActionStrip(
  actions: readonly ActionEntity[],
  requirementSummariesByTargetId: ReadonlyMap<string, string>
): readonly CisoMagazineActionItem[] {
  return [...actions]
    .sort((left, right) => actionPriority(right) - actionPriority(left))
    .map((action) => ({
      actionId: action.id,
      title: action.title,
      status: label(action.status),
      dueDate: action.dueDate,
      linkedRequirement: requirementSummariesByTargetId.get(action.id),
      latestUpdate: latestActionCommentary(action),
      actionLayer: buildActionItemLayer(action, requirementSummariesByTargetId.get(action.id))
    }));
}

function latestActionCommentary(action: ActionEntity): string | undefined {
  const latest = [...(action.commentary ?? [])]
    .filter((entry) => entry.text.trim().length > 0)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return latest ? `${formatDisplayDate(latest.createdAt)} - ${latest.text}` : undefined;
}

function actionPriority(action: ActionEntity): number {
  if (action.status === "blocked") {
    return 4;
  }
  if (action.impact?.urgency === "overdue") {
    return 3;
  }
  if (action.impact?.urgency === "due-soon") {
    return 2;
  }
  return action.status === "in-progress" ? 1 : 0;
}

function buildCommercialWatch(spendItems: readonly SpendItemEntity[]): readonly CisoMagazineCommercialItem[] {
  return spendItems
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({ title: item.title, status: label(item.status), amount: formatMoney(item.amount) }));
}

function buildReaderActions(
  edition: CisoMagazineEdition,
  requirementCount: number,
  actionCount: number,
  evidenceCount: number
): readonly string[] {
  const audienceActions =
    edition === "cso"
      ? [
          requirementCount > 0
            ? `Executives: remove blockers and require follow-through for ${requirementCount} requirement(s) needing evidence, remediation, or a risk decision.`
            : "Executives: keep blockers visible and require follow-through when a requirement, evidence gap, or risk decision emerges.",
          "Business owners: confirm the systems, data, and decisions most affected by the items in this issue.",
          "Team managers: use this issue to brief staff on what to update, escalate, or evidence this month."
        ]
      : [
          requirementCount > 0
            ? `Security leaders: validate the ${requirementCount} requirement(s) needing attention and assign the next control or evidence step.`
            : "Security leaders: keep control ownership, evidence currency, and escalation paths visible for the next assurance cycle.",
          "Delivery teams: update evidence, action commentary, and control implementation notes so the next issue shows movement."
        ];
  return [
    ...audienceActions,
    actionCount > 0
      ? `Confirm one owner, one next step, and one timeframe for ${actionCount} open action(s).`
      : undefined,
    evidenceCount > 0 ? `Refresh ${evidenceCount} evidence item(s) before the next assurance checkpoint.` : undefined,
    "Share this issue with accountable leaders and capture any contested priorities as Change Records."
  ].filter((item): item is string => Boolean(item));
}

function buildNextIssueTeaser(pspfDomainTitle: string, riskCount: number, spendCount: number): string {
  const commercialText = spendCount > 0 ? ` and ${spendCount} linked commercial planning item(s)` : "";
  return `Next issue should revisit ${pspfDomainTitle} risk movement, ${riskCount} open risk(s)${commercialText}, and any new evidence since this issue was generated.`;
}

function formatMoney(value: SpendItemEntity["amount"]): string {
  if (!value || typeof value.amount !== "number" || !Number.isFinite(value.amount)) {
    return "Not recorded";
  }
  const currency = typeof value.currency === "string" && value.currency ? value.currency : "AUD";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value.amount);
}

function renderHtmlListPanel<T>(
  title: string,
  items: readonly T[],
  formatItem: (item: T) => string,
  emptyText: string,
  extraClass: string
): string {
  const className = ["panel", extraClass].filter(Boolean).join(" ");
  const list =
    items.length === 0
      ? `<p>${escapeHtml(emptyText)}</p>`
      : `<ul>${items.map((item) => `<li>${escapeHtml(formatItem(item))}</li>`).join("")}</ul>`;
  return `<article class="${className}"><h2>${escapeHtml(title)}</h2>${list}</article>`;
}

function renderHtmlStoryPanel(title: string, stories: readonly CisoMagazineStory[]): string {
  if (stories.length === 0) {
    return "";
  }
  return `<article class="panel"><h2>${escapeHtml(title)}</h2>${stories
    .map((story) => `<p><strong>${escapeHtml(story.title)}.</strong> ${escapeHtml(story.body)}</p>`)
    .join("")}</article>`;
}

function compliancePercent(requirements: readonly RequirementEntity[]): number | undefined {
  const applicable = requirements.filter((requirement) => requirement.assessmentStatus !== "not-applicable");
  if (applicable.length === 0) {
    return undefined;
  }
  const met = applicable.filter((requirement) => requirement.assessmentStatus === "met").length;
  return Math.round((met / applicable.length) * 100);
}

function describeComplianceTrend(trend: readonly CisoMagazineTrendPoint[], currentPercent: number | undefined): string {
  if (currentPercent === undefined) {
    return "No applicable requirements in this scope.";
  }
  const points = trend.length > 0 ? trend : [{ day: "current", metPercentage: currentPercent }];
  if (points.length < 2) {
    return `${currentPercent}% met; trend starts from this issue.`;
  }
  const firstValue = points[0]?.metPercentage ?? currentPercent;
  const lastValue = points[points.length - 1]?.metPercentage ?? currentPercent;
  const direction = lastValue > firstValue ? "rising" : lastValue < firstValue ? "easing" : "steady";
  return `${firstValue}% -> ${lastValue}% met over ${points.length} issue point(s); ${direction}.`;
}

function buildExecutiveFraming(
  edition: CisoMagazineEdition,
  pspfDomainTitle: string,
  compliancePercentValue: number | undefined,
  requirementCount: number,
  actionCount: number,
  riskCount: number,
  evidenceCount: number
): readonly CisoMagazineStory[] {
  const complianceText =
    compliancePercentValue === undefined ? "no applicable requirements" : `${compliancePercentValue}% compliance`;
  const audience = edition === "cso" ? "leaders and business owners" : "security leaders and delivery teams";
  return [
    {
      title: "Mission impact",
      body: `${pspfDomainTitle} reporting protects the integrity of the information, services, and decisions the organisation depends on.`
    },
    {
      title: "Current state",
      body: `The current scope is at ${complianceText}, with ${requirementCount} requirement(s), ${actionCount} action(s), and ${evidenceCount} evidence item(s) needing follow-through.`
    },
    {
      title: "Risk if unchanged",
      body: `${riskCount} open risk(s) remain visible to decision-makers; unresolved gaps can weaken defensible decisions, regulatory confidence, and public trust.`
    },
    {
      title: "Who needs to act",
      body: `${audience} should confirm the next practical step, the responsible role or team, and the timeframe before the next assurance cycle.`
    }
  ];
}

function buildRequirementOwnerRoles(mappings: readonly RequirementControlMappingEntity[]): ReadonlyMap<string, string> {
  const rolesByRequirementId = new Map<string, Set<string>>();
  for (const mapping of mappings.filter((item) => item.recordStatus !== "deleted")) {
    const role = mapping.reviewBy?.trim();
    if (!role) {
      continue;
    }
    const roles = rolesByRequirementId.get(mapping.requirementId) ?? new Set<string>();
    roles.add(role);
    rolesByRequirementId.set(mapping.requirementId, roles);
  }
  return new Map(
    [...rolesByRequirementId.entries()].map(([requirementId, roles]) => [
      requirementId,
      [...roles].sort((left, right) => left.localeCompare(right, "en-AU", { sensitivity: "base" })).join(", ")
    ])
  );
}

function buildRequirementActionLayers(
  requirements: readonly RequirementEntity[],
  targetIdsByRequirement: ReadonlyMap<string, { readonly actions: readonly string[] }>,
  actionsById: ReadonlyMap<string, ActionEntity>,
  roleByRequirementId: ReadonlyMap<string, string>,
  pspfDomainTitle: string
): ReadonlyMap<string, CisoMagazineActionLayer> {
  return new Map(
    requirements.map((requirement) => {
      const linkedActions = (targetIdsByRequirement.get(requirement.id)?.actions ?? [])
        .map((actionId) => actionsById.get(actionId))
        .filter((action): action is ActionEntity => Boolean(action && !["done", "cancelled"].includes(action.status)))
        .sort((left, right) => actionPriority(right) - actionPriority(left));
      const priorityAction = linkedActions[0];
      return [
        requirement.id,
        {
          ownerRole: roleByRequirementId.get(requirement.id) ?? "Ownership not confirmed",
          timeframe: priorityAction?.dueDate
            ? `Due ${formatDueDate(priorityAction.dueDate)}`
            : "Before the next assurance checkpoint",
          why: `${requirementReference(requirement)} affects ${pspfDomainTitle} assurance and should be clear enough for leaders to act on.`,
          nextStep: priorityAction?.title ?? "Confirm evidence, remediation, or a risk decision for this requirement.",
          expectedOutcome:
            "Evidence, action status, or an explicit risk decision is recorded before the next reporting cycle."
        }
      ];
    })
  );
}

function buildDefaultRequirementActionLayer(requirement: RequirementEntity): CisoMagazineActionLayer {
  return {
    ownerRole: "Ownership not confirmed",
    timeframe: "Before the next assurance checkpoint",
    why: `${requirementReference(requirement)} needs a clear next step so teams can protect service integrity and public trust.`,
    nextStep: "Confirm the responsible role and the evidence, remediation, or risk decision required.",
    expectedOutcome: "The requirement has an accountable role, current evidence, or a recorded risk decision."
  };
}

function buildActionItemLayer(action: ActionEntity, linkedRequirement: string | undefined): CisoMagazineActionLayer {
  return {
    ownerRole: "Action owner role not confirmed",
    timeframe: action.dueDate ? `Due ${formatDueDate(action.dueDate)}` : "Before the next assurance checkpoint",
    why: linkedRequirement
      ? `${linkedRequirement} depends on this action moving from visibility to completion.`
      : "This action needs a clear owner and timeframe so the next report shows progress.",
    nextStep:
      action.status === "blocked"
        ? "Escalate the blocker and record the decision needed."
        : "Confirm the next delivery step and update the action commentary.",
    expectedOutcome:
      "The action has a current status, a visible next step, and evidence or commentary showing movement."
  };
}

function constructiveAssessmentPhrase(status: RequirementEntity["assessmentStatus"]): string {
  const phrases: Record<RequirementEntity["assessmentStatus"], string> = {
    met: "Evidence indicates this requirement is met.",
    "partially-met": "Needs targeted evidence, remediation, or a risk decision.",
    "in-progress": "Work is underway and needs a clear next evidence or completion step.",
    "not-met": "Needs evidence, remediation, or a risk decision before the next reporting cycle.",
    "not-started": "Needs an owner, a practical first step, and a timeframe.",
    "under-review": "Needs review confirmation and a recorded decision.",
    "not-applicable": "Recorded as not applicable for this scope."
  };
  return phrases[status] ?? `Needs review: ${label(status)}.`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function countBy<T>(items: readonly T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function label(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDisplayDate(value: Date | string): string {
  const date = safeDate(value);
  if (!date) {
    return "unknown";
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDueDate(value: Date | string): string {
  const date = safeDate(value);
  if (!date) {
    return "unknown";
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function safeDate(value: Date | string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
