import type {
  ActionEntity,
  BundleCollections,
  DirectionEntity,
  DomainEntity,
  EvidenceEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity,
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
  readonly sourceLabel?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
}

export type CisoMagazinePspfDomainScope = "all" | "GOV" | "RISK" | "INFO" | "TECH" | "PER" | "PHYS";

export interface CisoMagazineInput extends PostureBriefInput {
  readonly issueTitle?: string;
  readonly issueNumber?: string;
  readonly periodLabel?: string;
  readonly audience?: "internal" | "executive" | "external";
  readonly domainScope?: CisoMagazinePspfDomainScope;
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
  readonly pspfDomainScope: CisoMagazinePspfDomainScope;
  readonly pspfDomainTitle: string;
  readonly coverHook: string;
  readonly editorNote: string;
  readonly postureSnapshot: readonly CisoMagazineMetric[];
  readonly featureStories: readonly CisoMagazineStory[];
  readonly attentionItems: readonly CisoMagazineAttentionItem[];
  readonly actionStrip: readonly CisoMagazineActionItem[];
  readonly commercialWatch: readonly CisoMagazineCommercialItem[];
  readonly masterPlan: CisoMasterPlanModel;
  readonly readerActions: readonly string[];
  readonly nextIssueTeaser: string;
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
  readonly pspfDomainTitle: string;
}

export interface CisoMagazineActionItem {
  readonly actionId: string;
  readonly title: string;
  readonly status: string;
  readonly dueDate?: string;
  readonly linkedRequirement?: string;
  readonly latestUpdate?: string;
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
  readonly newsletterArticle: CisoMagazineStory;
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
  const pspfDomainScope = input.domainScope ?? "all";
  const scopedDomains = selectPspfDomains(input.domains, pspfDomainScope);
  const scopedDomainIds = new Set(scopedDomains.map((domain) => domain.id));
  const scopedRequirements = input.requirements.filter(
    (requirement) => pspfDomainScope === "all" || scopedDomainIds.has(requirement.domainId)
  );
  const scopedRequirementIds = new Set(scopedRequirements.map((requirement) => requirement.id));
  const requirementsById = new Map(input.requirements.map((requirement) => [requirement.id, requirement]));
  const domainTitlesById = new Map(input.domains.map((domain) => [domain.id, domain.title]));
  const requirementTitlesByTargetId = buildRequirementTitlesByTargetId(input.links, requirementsById);
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
      !["done", "cancelled"].includes(action.status) && (pspfDomainScope === "all" || scopedActionIds.has(action.id))
  );
  const openRisks = input.risks.filter(
    (risk) => risk.status !== "closed" && (pspfDomainScope === "all" || scopedRiskIds.has(risk.id))
  );
  const evidenceNeedingReview = input.evidence.filter(
    (item) => item.freshness !== "current" && (pspfDomainScope === "all" || scopedEvidenceIds.has(item.id))
  );
  const requirementsNeedingAttention = scopedRequirements.filter((requirement) =>
    ["not-started", "in-progress", "partially-met", "not-met", "under-review"].includes(requirement.assessmentStatus)
  );
  const activeStrategy = (input.strategies ?? []).find((strategy) => strategy.recordStatus !== "deleted");
  const linkedSpendItems = (input.spendItems ?? []).filter(
    (item) =>
      pspfDomainScope === "all" ||
      isSpendItemLinkedToScopedWork(item, input.links, scopedRequirementIds, scopedActionIds)
  );
  const pspfDomainTitle = pspfDomainScope === "all" ? "All PSPF Domains" : (scopedDomains[0]?.title ?? pspfDomainScope);
  const masterPlan = buildCisoMasterPlanModel({
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
    sourceLabel: input.sourceLabel,
    bundleVersion: input.bundleVersion,
    schemaVersion: input.schemaVersion
  });

  return {
    classification: "OFFICIAL: Sensitive",
    title: input.issueTitle ?? "Digital CISO Magazine",
    issueNumber: input.issueNumber ?? "Issue 1",
    periodLabel: input.periodLabel ?? "Current assurance period",
    generatedAt: formatDisplayDate(input.generatedAt),
    sourceLabel: input.sourceLabel,
    bundleVersion: input.bundleVersion,
    schemaVersion: input.schemaVersion,
    audience: input.audience ?? "internal",
    pspfDomainScope,
    pspfDomainTitle,
    coverHook: buildCoverHook(requirementsNeedingAttention.length, openActions.length, pspfDomainTitle),
    editorNote: buildEditorNote(pspfDomainTitle, activeStrategy),
    postureSnapshot: [
      { label: "PSPF Requirements in scope", value: String(scopedRequirements.length) },
      { label: "Requirements needing attention", value: String(requirementsNeedingAttention.length) },
      { label: "Open actions", value: String(openActions.length) },
      { label: "Open risks", value: String(openRisks.length) },
      { label: "Evidence items needing review", value: String(evidenceNeedingReview.length) }
    ],
    featureStories: buildFeatureStories(
      activeStrategy,
      requirementsNeedingAttention,
      input.changeRecords ?? [],
      masterPlan
    ),
    attentionItems: buildAttentionItems(requirementsNeedingAttention, input.domains, domainTitlesById).slice(0, 8),
    actionStrip: buildActionStrip(openActions, requirementTitlesByTargetId).slice(0, 8),
    commercialWatch: buildCommercialWatch(linkedSpendItems).slice(0, 6),
    masterPlan,
    readerActions: buildReaderActions(
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
  const articleBody = `${streams.length} CISO plan stream(s) are combined into the Master Plan for ${horizon}. The plan starts from strategy, uses the Plan of Action as the delivery spine, includes ${initiativePlans.length} idea or initiative plan(s), and calls out ${dependencies.length} dependency or supplier milestone(s) that could change the path.`;

  return {
    title: "CISO Master Plan",
    horizon,
    direction,
    streams,
    initiativePlans,
    phases,
    dependencies,
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
    "Note: this generated plan is a shareable planning view over existing PSPF records. Adapt it as decisions and dependencies change."
  ].join("\n");
}

const roadmapInitiativeStages = ["Design", "Build", "Verify", "Monitor"] as const;

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

  for (const action of actions) {
    const parsed = parseInitiativeStage(action.title);
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
    "## Current Posture Snapshot",
    "",
    ...model.postureSnapshot.map((metric) => `- ${metric.label}: ${metric.value}`),
    "",
    "## Feature Stories",
    "",
    ...model.featureStories.flatMap((story) => [`### ${story.title}`, "", story.body, ""]),
    "## Attention Required",
    "",
    ...(model.attentionItems.length === 0
      ? ["- No immediate attention items in this PSPF Domain scope."]
      : model.attentionItems.map((item) => `- ${item.title} (${item.pspfDomainTitle}) - ${item.reason}`)),
    "",
    "## Action Strip",
    "",
    ...(model.actionStrip.length === 0
      ? ["- No open actions in this PSPF Domain scope."]
      : model.actionStrip.map(
          (item) =>
            `- ${item.title} (${item.status}${item.dueDate ? `, due ${item.dueDate}` : ""}) - ${item.linkedRequirement ?? "No linked Requirement"}${item.latestUpdate ? `; latest update: ${item.latestUpdate}` : ""}`
        )),
    "",
    "## Commercial Watch",
    "",
    ...(model.commercialWatch.length === 0
      ? ["- No linked Shop spend items in this issue scope."]
      : model.commercialWatch.map((item) => `- ${item.title} (${item.status}) - ${item.amount}`)),
    "",
    "## CISO Master Plan",
    "",
    model.masterPlan.newsletterArticle.body,
    "",
    ...model.masterPlan.streams.map((stream) => `- ${stream.title} (${stream.status}) - ${stream.basis}`),
    "",
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
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { color-scheme: light; --ink: #201f1e; --paper: #fffaf0; --panel: #ffffff; --line: #2f6f73; --accent: #b54708; --muted: #62625f; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--paper); font-family: Georgia, 'Times New Roman', serif; }
    .issue { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .classification { background: #f4c542; color: #1f1a00; font: 700 13px/1.4 Arial, sans-serif; padding: 8px 12px; text-transform: uppercase; }
    .cover { border: 4px solid var(--ink); background: linear-gradient(135deg, #fffaf0 0%, #ffffff 60%, #d8f0ef 100%); padding: 24px; min-height: 360px; display: grid; gap: 20px; align-content: space-between; }
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
    </section>
    <section class="grid" aria-label="Magazine stories">
      <article class="panel"><div class="section-label">Editor's note</div><p>${escapeHtml(model.editorNote)}</p></article>
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
        (item) => `${item.title} (${item.pspfDomainTitle}) - ${item.reason}`,
        "No immediate attention items in this PSPF Domain scope.",
        "attention"
      )}
      ${renderHtmlListPanel(
        "Action strip",
        model.actionStrip,
        (item) =>
          `${item.title} (${item.status}${item.dueDate ? `, due ${item.dueDate}` : ""}) - ${item.linkedRequirement ?? "No linked Requirement"}${item.latestUpdate ? `; latest update: ${item.latestUpdate}` : ""}`,
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
    <section class="grid" aria-label="CISO Master Plan">
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
    </section>
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
  const requirementTitlesByTargetId = buildRequirementTitlesByTargetId(input.links, requirementsById);
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
            `- ${action.title} (${label(action.status)}${action.dueDate ? `, due ${action.dueDate}` : ""}) - ${requirementTitlesByTargetId.get(action.id) ?? "No linked requirement"}${latestActionCommentary(action) ? `; latest update: ${latestActionCommentary(action)}` : ""}`
        )),
    "",
    "## Open Risks",
    "",
    ...(openRisks.length === 0
      ? ["- None recorded."]
      : openRisks.map(
          (risk) =>
            `- ${risk.title} (${label(risk.status)}, likelihood ${risk.likelihood}, impact ${risk.impact}) - ${requirementTitlesByTargetId.get(risk.id) ?? "No linked requirement"}`
        )),
    "",
    "## Directions",
    "",
    ...(directions.length === 0
      ? ["- None registered."]
      : directions.map(
          (direction) =>
            `- ${direction.reference}: ${direction.title} (${label(direction.responseState)}${direction.sourceAuthority ? `, ${direction.sourceAuthority}` : ""})`
        )),
    "",
    "Note: internal summaries and restricted personal fields are excluded from this brief."
  ].join("\n");
}

export const POSTURE_BRIEF_BROWSER_SCRIPT = String.raw`globalThis.pspfBriefRenderer = (() => {
  function renderPostureBriefMarkdown(input) {
    const requirementsById = new Map((input.requirements || []).map((requirement) => [requirement.id, requirement]));
    const requirementTitlesByTargetId = buildRequirementTitlesByTargetId(input.links || [], requirementsById);
    const evidenceIdsByRequirement = buildIdsByRequirement(input.links || [], "supported-by", "evidence");
    const evidenceById = new Map((input.evidence || []).map((item) => [item.id, item]));
    const openActions = (input.actions || []).filter((action) => !["done", "cancelled"].includes(action.status));
    const openRisks = (input.risks || []).filter((risk) => risk.status !== "closed");
    const directions = input.directions || [];
    const strategy = (input.strategies || []).find((item) => item.recordStatus !== "deleted");
    const directionsNeedingResponse = directions.filter((direction) => direction.responseState === "not-set" || direction.responseState === "no").length;
    const currentEvidenceRequirements = (input.requirements || []).filter((requirement) => (evidenceIdsByRequirement.get(requirement.id) || []).some((evidenceId) => evidenceById.get(evidenceId)?.freshness === "current")).length;
    const evidenceNeedsReview = (input.evidence || []).filter((item) => item.freshness !== "current").length;
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
      ...(openActions.length === 0 ? ["- None recorded."] : openActions.map((action) => "- " + action.title + " (" + label(action.status) + (action.dueDate ? ", due " + action.dueDate : "") + ") - " + (requirementTitlesByTargetId.get(action.id) || "No linked requirement") + (latestActionCommentary(action) ? "; latest update: " + latestActionCommentary(action) : ""))),
      "",
      "## Open Risks",
      "",
      ...(openRisks.length === 0 ? ["- None recorded."] : openRisks.map((risk) => "- " + risk.title + " (" + label(risk.status) + ", likelihood " + risk.likelihood + ", impact " + risk.impact + ") - " + (requirementTitlesByTargetId.get(risk.id) || "No linked requirement"))),
      "",
      "## Directions",
      "",
      ...(directions.length === 0 ? ["- None registered."] : directions.map((direction) => "- " + direction.reference + ": " + direction.title + " (" + label(direction.responseState) + (direction.sourceAuthority ? ", " + direction.sourceAuthority : "") + ")")),
      "",
      "Note: internal summaries and restricted personal fields are excluded from this brief."
    ].join("\n");
  }
  function statusRows(requirements) {
    const counts = countBy(requirements, (requirement) => requirement.assessmentStatus);
    const rows = Object.entries(counts).map(([status, count]) => "- " + label(status) + ": " + count);
    return rows.length > 0 ? rows : ["- None recorded."];
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
  function buildRequirementTitlesByTargetId(links, requirementsById) {
    const titlesByTargetId = new Map();
    for (const link of links) {
      if (link.fromType !== "requirement") {
        continue;
      }
      const requirement = requirementsById.get(link.fromId);
      if (!requirement) {
        continue;
      }
      titlesByTargetId.set(link.toId, [...(titlesByTargetId.get(link.toId) || []), requirement.title]);
    }
    return new Map(Array.from(titlesByTargetId.entries()).map(([targetId, titles]) => [targetId, titles.join("; ")]));
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
    return value ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "unknown";
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

function buildRequirementTitlesByTargetId(
  links: readonly LinkEntity[],
  requirementsById: ReadonlyMap<string, RequirementEntity>
): ReadonlyMap<string, string> {
  const titlesByTargetId = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType !== "requirement") {
      continue;
    }
    const requirement = requirementsById.get(link.fromId);
    if (!requirement) {
      continue;
    }
    titlesByTargetId.set(link.toId, [...(titlesByTargetId.get(link.toId) ?? []), requirement.title]);
  }
  return new Map(Array.from(titlesByTargetId.entries()).map(([targetId, titles]) => [targetId, titles.join("; ")]));
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

function buildCoverHook(requirementCount: number, actionCount: number, pspfDomainTitle: string): string {
  if (requirementCount === 0 && actionCount === 0) {
    return `${pspfDomainTitle} is steady this issue, with no immediate attention items in the selected scope.`;
  }
  return `${pspfDomainTitle} has ${requirementCount} requirement(s) and ${actionCount} action(s) needing attention before the next assurance checkpoint.`;
}

function buildEditorNote(pspfDomainTitle: string, strategy?: StrategyEntity): string {
  if (!strategy) {
    return `${pspfDomainTitle} is summarised from current PSPF records so leaders can see what changed, what needs attention, and what to do next.`;
  }
  return `${pspfDomainTitle} is framed against ${strategy.title}: ${strategy.strategyStatement}`;
}

function buildFeatureStories(
  strategy: StrategyEntity | undefined,
  requirements: readonly RequirementEntity[],
  changeRecords: BundleCollections["change-records"],
  masterPlan: CisoMasterPlanModel
): readonly CisoMagazineStory[] {
  const stories: CisoMagazineStory[] = [];
  stories.push(masterPlan.newsletterArticle);
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
  domainTitlesById: ReadonlyMap<string, string>
): readonly CisoMagazineAttentionItem[] {
  const fallbackDomainTitle = domains[0]?.title ?? "Unmapped PSPF Domain";
  return requirements.map((requirement) => ({
    title: requirement.title,
    reason: `Assessment is ${label(requirement.assessmentStatus)}.`,
    pspfDomainTitle: domainTitlesById.get(requirement.domainId) ?? fallbackDomainTitle
  }));
}

function buildActionStrip(
  actions: readonly ActionEntity[],
  requirementTitlesByTargetId: ReadonlyMap<string, string>
): readonly CisoMagazineActionItem[] {
  return [...actions]
    .sort((left, right) => actionPriority(right) - actionPriority(left))
    .map((action) => ({
      actionId: action.id,
      title: action.title,
      status: label(action.status),
      dueDate: action.dueDate,
      linkedRequirement: requirementTitlesByTargetId.get(action.id),
      latestUpdate: latestActionCommentary(action)
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

function buildReaderActions(requirementCount: number, actionCount: number, evidenceCount: number): readonly string[] {
  return [
    requirementCount > 0 ? `Review ${requirementCount} PSPF Requirement(s) that still need attention.` : undefined,
    actionCount > 0 ? `Confirm owners and next steps for ${actionCount} open action(s).` : undefined,
    evidenceCount > 0 ? `Refresh ${evidenceCount} evidence item(s) before the next assurance checkpoint.` : undefined,
    "Share this issue with accountable leaders and capture any contested priorities as Change Records."
  ].filter((item): item is string => Boolean(item));
}

function buildNextIssueTeaser(pspfDomainTitle: string, riskCount: number, spendCount: number): string {
  const commercialText = spendCount > 0 ? ` and ${spendCount} linked commercial planning item(s)` : "";
  return `Next issue should revisit ${pspfDomainTitle} risk movement, ${riskCount} open risk(s)${commercialText}, and any new evidence since this issue was generated.`;
}

function formatMoney(value: SpendItemEntity["amount"]): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: value.currency }).format(value.amount);
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
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
