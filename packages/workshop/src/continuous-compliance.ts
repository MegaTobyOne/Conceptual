import type {
  ActionEntity,
  DomainEntity,
  EvidenceEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity,
  StrategicChoice,
  V01Entity
} from "@pspf/contracts";
import { PSPF_DOMAINS } from "@pspf/contracts";

/**
 * Continuous Compliance Outputs — shared taxonomy and pure model builders.
 *
 * This module is the single source of fixed ordering and controlled vocabulary
 * for the business-facing "Continuous Compliance" outputs (see
 * continuous-compliance-outputs-spec). Every output renderer in the Workshop
 * extension references the constants and builders here so that domains,
 * assurance labels, and groupings appear in the same sequence with the same
 * wording across all outputs.
 *
 * Builders are kept pure (they take entity arrays and return view models) so
 * they can be unit tested without the VS Code host.
 */

/**
 * Domain scope for the Continuous Compliance outputs.
 *
 * The spec limits scope to cybersecurity and information governance and names
 * four in-scope domains: technology, governance, risk, and information. These
 * map onto canonical PSPF domain codes. The order here is the FIXED ordering
 * that every output must use.
 */
export const CONTINUOUS_COMPLIANCE_DOMAIN_ORDER = ["technology", "governance", "security-risk", "information"] as const;

export type ContinuousComplianceDomainCode = (typeof CONTINUOUS_COMPLIANCE_DOMAIN_ORDER)[number];

/**
 * Accessible grouping labels and short explanations for each in-scope domain.
 * The spec asks for "accessible labels" and "a short explanation of what each
 * grouping represents" rather than raw framework language.
 */
export const CONTINUOUS_COMPLIANCE_GROUPINGS: Readonly<
  Record<ContinuousComplianceDomainCode, { readonly label: string; readonly hint: string }>
> = {
  technology: {
    label: "Technology and systems",
    hint: "Securing systems, devices, and the controls that protect them day to day."
  },
  governance: {
    label: "Governance and accountability",
    hint: "Leadership, oversight, and the decisions that keep security on track."
  },
  "security-risk": {
    label: "Security risk",
    hint: "Understanding and treating the risks that could disrupt the business."
  },
  information: {
    label: "Information protection",
    hint: "Handling and safeguarding information according to its sensitivity."
  }
};

/**
 * Controlled assurance vocabulary. These labels are the ONLY assurance words
 * used across the outputs, so a reader sees the same language everywhere.
 * Ordered strongest-to-weakest.
 */
export const CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS = [
  { id: "established", label: "Established", minMetPercentage: 80 },
  { id: "progressing", label: "Progressing", minMetPercentage: 50 },
  { id: "emerging", label: "Emerging", minMetPercentage: 20 },
  { id: "early", label: "Early", minMetPercentage: 1 },
  { id: "not-started", label: "Not started", minMetPercentage: 0 }
] as const;

export type AssuranceBandId = (typeof CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS)[number]["id"];

export function assuranceBandForPercentage(metPercentage: number): {
  readonly id: AssuranceBandId;
  readonly label: string;
} {
  const band =
    CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS.find((candidate) => metPercentage >= candidate.minMetPercentage) ??
    CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS[CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS.length - 1]!;
  return { id: band.id, label: band.label };
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function inScopeDomains(
  entities: readonly V01Entity[]
): readonly { code: ContinuousComplianceDomainCode; id: string; title: string }[] {
  const authored = entities.filter(
    (entity): entity is DomainEntity => entity.entityType === "domain" && entity.recordStatus !== "deleted"
  );
  return CONTINUOUS_COMPLIANCE_DOMAIN_ORDER.map((code) => {
    const fromWorkspace = authored.find((domain) => domain.code === code);
    const fromCanonical = PSPF_DOMAINS.find((domain) => domain.code === code);
    const source = fromWorkspace ?? fromCanonical;
    return {
      code,
      id: source?.id ?? code,
      title: source?.title ?? code
    };
  });
}

function evidenceLinkedRequirementIds(entities: readonly V01Entity[]): ReadonlySet<string> {
  const links = entities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  return new Set(
    links
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
}

function isRecentlyUpdated(entity: { readonly updatedAt: string }, now: Date, withinDays: number): boolean {
  const updated = Date.parse(entity.updatedAt);
  if (Number.isNaN(updated)) {
    return false;
  }
  const ageDays = (now.getTime() - updated) / (24 * 60 * 60 * 1000);
  return ageDays >= 0 && ageDays <= withinDays;
}

// ---------------------------------------------------------------------------
// Output 4: PSPF Grid View
// ---------------------------------------------------------------------------

export interface PspfGridCellModel {
  readonly domainCode: ContinuousComplianceDomainCode;
  readonly domainTitle: string;
  readonly groupingLabel: string;
  readonly groupingHint: string;
  readonly applicable: number;
  readonly met: number;
  readonly metPercentage: number;
  readonly evidenceCoverage: number;
  readonly assuranceBandId: AssuranceBandId;
  readonly assuranceLabel: string;
  readonly recentlyUpdated: number;
}

export interface PspfGridModel {
  readonly generatedAt: string;
  readonly overallMetPercentage: number;
  readonly overallEvidenceCoverage: number;
  readonly applicable: number;
  readonly met: number;
  readonly cells: readonly PspfGridCellModel[];
  readonly milestones: readonly string[];
}

export function buildPspfGridModel(
  entities: readonly V01Entity[],
  options: { readonly now?: Date; readonly recentWindowDays?: number } = {}
): PspfGridModel {
  const now = options.now ?? new Date();
  const recentWindowDays = options.recentWindowDays ?? 30;
  const requirements = entities.filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  const evidenceRequirementIds = evidenceLinkedRequirementIds(entities);
  const domains = inScopeDomains(entities);

  let overallApplicable = 0;
  let overallMet = 0;
  let overallEvidence = 0;

  const cells: PspfGridCellModel[] = domains.map((domain) => {
    const domainRequirements = requirements.filter((requirement) => requirement.domainId === domain.id);
    const applicable = domainRequirements.filter((requirement) => requirement.assessmentStatus !== "not-applicable");
    const met = applicable.filter((requirement) => requirement.assessmentStatus === "met").length;
    const evidenceCovered = applicable.filter((requirement) => evidenceRequirementIds.has(requirement.id)).length;
    const metPercentage = percent(met, applicable.length);
    const band = assuranceBandForPercentage(metPercentage);
    const grouping = CONTINUOUS_COMPLIANCE_GROUPINGS[domain.code];

    overallApplicable += applicable.length;
    overallMet += met;
    overallEvidence += evidenceCovered;

    return {
      domainCode: domain.code,
      domainTitle: domain.title,
      groupingLabel: grouping.label,
      groupingHint: grouping.hint,
      applicable: applicable.length,
      met,
      metPercentage,
      evidenceCoverage: percent(evidenceCovered, applicable.length),
      assuranceBandId: band.id,
      assuranceLabel: band.label,
      recentlyUpdated: domainRequirements.filter((requirement) => isRecentlyUpdated(requirement, now, recentWindowDays))
        .length
    };
  });

  return {
    generatedAt: now.toISOString(),
    overallMetPercentage: percent(overallMet, overallApplicable),
    overallEvidenceCoverage: percent(overallEvidence, overallApplicable),
    applicable: overallApplicable,
    met: overallMet,
    cells,
    milestones: buildGridMilestones(entities, now, recentWindowDays)
  };
}

function buildGridMilestones(entities: readonly V01Entity[], now: Date, withinDays: number): readonly string[] {
  const requirements = entities.filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  const actions = entities.filter(
    (entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted"
  );
  const risks = entities.filter(
    (entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted"
  );
  const milestones: string[] = [];
  const newlyMet = requirements.filter(
    (requirement) => requirement.assessmentStatus === "met" && isRecentlyUpdated(requirement, now, withinDays)
  ).length;
  if (newlyMet > 0) {
    milestones.push(`${newlyMet} requirement${newlyMet === 1 ? "" : "s"} reached met in the last ${withinDays} days.`);
  }
  const closedActions = actions.filter(
    (action) => action.status === "done" && isRecentlyUpdated(action, now, withinDays)
  ).length;
  if (closedActions > 0) {
    milestones.push(`${closedActions} action${closedActions === 1 ? "" : "s"} completed recently.`);
  }
  const closedRisks = risks.filter(
    (risk) => risk.status === "closed" && isRecentlyUpdated(risk, now, withinDays)
  ).length;
  if (closedRisks > 0) {
    milestones.push(`${closedRisks} risk${closedRisks === 1 ? "" : "s"} closed recently.`);
  }
  if (milestones.length === 0) {
    milestones.push(
      "No recent assurance movement recorded yet. Update requirement, action, and risk status to show progress."
    );
  }
  return milestones;
}

// ---------------------------------------------------------------------------
// Output 1: Human-Centred Risk View
// ---------------------------------------------------------------------------

/**
 * Fixed severity vocabulary for the Human-Centred Risk View. Severity is the
 * product of likelihood and impact (each 1-5), banded with controlled labels.
 */
export const CONTINUOUS_COMPLIANCE_RISK_SEVERITIES = [
  { id: "high", label: "High", minScore: 15 },
  { id: "medium", label: "Medium", minScore: 8 },
  { id: "low", label: "Low", minScore: 1 }
] as const;

export type RiskSeverityId = (typeof CONTINUOUS_COMPLIANCE_RISK_SEVERITIES)[number]["id"];

export function riskSeverityForScore(score: number): { readonly id: RiskSeverityId; readonly label: string } {
  const band =
    CONTINUOUS_COMPLIANCE_RISK_SEVERITIES.find((candidate) => score >= candidate.minScore) ??
    CONTINUOUS_COMPLIANCE_RISK_SEVERITIES[CONTINUOUS_COMPLIANCE_RISK_SEVERITIES.length - 1]!;
  return { id: band.id, label: band.label };
}

// ---------------------------------------------------------------------------
// Strategy priority: risk -> priority -> choices
// ---------------------------------------------------------------------------

export type StrategyPriorityBand = "critical" | "high" | "medium" | "low" | "none";

export interface StrategyPriorityRisk {
  readonly riskId: string;
  readonly title: string;
  readonly likelihood: number;
  readonly impact: number;
  readonly severityId: RiskSeverityId;
  readonly severityLabel: string;
  readonly severityScore: number;
  readonly adjustedScore: number;
  readonly outcomeId?: string;
  readonly outcomeStatement?: string;
}

export interface StrategyPrioritySummary {
  readonly choiceId: string;
  readonly band: StrategyPriorityBand;
  readonly bandLabel: string;
  readonly score: number;
  readonly highRiskCount: number;
  readonly averageAdjustedScore: number;
  readonly topRisks: readonly StrategyPriorityRisk[];
  readonly linkedActionCount: number;
  readonly unresolvedRiskReferenceCount: number;
  readonly rationale: string;
}

export type StrategyDeliveryState =
  | "no-delivery-path"
  | "candidate-work"
  | "in-delivery"
  | "delivery-at-risk"
  | "delivered-verify-benefit"
  | "outcome-progressing";

export interface StrategyDeliverySummary {
  readonly state: StrategyDeliveryState;
  readonly linkedActionCount: number;
  readonly candidateActionCount: number;
  readonly committedActionCount: number;
  readonly activeActionCount: number;
  readonly blockedActionCount: number;
  readonly overdueActionCount: number;
  readonly completedActionCount: number;
  readonly unresolvedActionReferenceCount: number;
  readonly decision: string;
}

export function buildStrategyDeliverySummary(
  choice: StrategicChoice,
  actionsById: ReadonlyMap<string, ActionEntity>
): StrategyDeliverySummary {
  const actionIds = new Set([
    ...choice.references
      .filter((reference) => reference.entityType === "action")
      .map((reference) => reference.entityId),
    ...choice.outcomes.flatMap((outcome) =>
      outcome.references.filter((reference) => reference.entityType === "action").map((reference) => reference.entityId)
    )
  ]);
  const linkedActions = [...actionIds].map((actionId) => actionsById.get(actionId));
  const unresolvedActionReferenceCount = linkedActions.filter(
    (action) => !action || action.recordStatus === "deleted"
  ).length;
  const resolvedActions = linkedActions.filter(
    (action): action is ActionEntity => action !== undefined && action.recordStatus !== "deleted"
  );
  const candidateActionCount = resolvedActions.filter((action) => action.status === "todo").length;
  const committedActionCount = resolvedActions.filter((action) => action.status !== "todo").length;
  const activeActionCount = resolvedActions.filter((action) => !["done", "cancelled"].includes(action.status)).length;
  const blockedActionCount = resolvedActions.filter(
    (action) => action.status === "blocked" || action.impact?.urgency === "blocked"
  ).length;
  const overdueActionCount = resolvedActions.filter((action) => action.impact?.urgency === "overdue").length;
  const completedActionCount = resolvedActions.filter((action) => action.status === "done").length;
  const state: StrategyDeliveryState =
    resolvedActions.length === 0
      ? "no-delivery-path"
      : blockedActionCount > 0 || overdueActionCount > 0
        ? "delivery-at-risk"
        : completedActionCount === resolvedActions.length
          ? choice.outcomes.some((outcome) => outcome.measures.some((measure) => measure.trend === "improving"))
            ? "outcome-progressing"
            : "delivered-verify-benefit"
          : committedActionCount === 0
            ? "candidate-work"
            : "in-delivery";

  return {
    state,
    linkedActionCount: actionIds.size,
    candidateActionCount,
    committedActionCount,
    activeActionCount,
    blockedActionCount,
    overdueActionCount,
    completedActionCount,
    unresolvedActionReferenceCount,
    decision: strategyDeliveryDecision(state)
  };
}

function strategyDeliveryDecision(state: StrategyDeliveryState): string {
  switch (state) {
    case "no-delivery-path":
      return "Choose a delivery response for this strategic choice.";
    case "candidate-work":
      return "Commit, defer or exclude the candidate work.";
    case "in-delivery":
      return "Review progress and the next delivery milestone.";
    case "delivery-at-risk":
      return "Resolve the delivery risk or re-sequence the work.";
    case "delivered-verify-benefit":
      return "Verify the benefit or revise the strategic choice.";
    case "outcome-progressing":
      return "Continue delivery and review the outcome measure.";
  }
}

export type ExposureBand = "low" | "moderate" | "high" | "extreme";

export interface ExposureComponent {
  readonly id: "requirement-gaps" | "material-risks" | "evidence-weakness" | "delivery-risk";
  readonly label: string;
  readonly band: ExposureBand;
  readonly count: number;
}

export interface ExposureSummary {
  readonly band: ExposureBand;
  readonly bandLabel: string;
  readonly primaryDriver: ExposureComponent;
  readonly components: readonly ExposureComponent[];
}

export function buildExposureSummary(entities: readonly V01Entity[]): ExposureSummary {
  const requirements = entities.filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  const risks = entities.filter(
    (entity): entity is RiskEntity =>
      entity.entityType === "risk" && entity.recordStatus !== "deleted" && entity.status !== "closed"
  );
  const evidence = entities.filter(
    (entity): entity is EvidenceEntity => entity.entityType === "evidence" && entity.recordStatus !== "deleted"
  );
  const actions = entities.filter(
    (entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted"
  );
  const components: ExposureComponent[] = [
    exposureComponent(
      "requirement-gaps",
      "Requirement gaps",
      requirements.filter((item) => ["not-started", "not-met", "partially-met"].includes(item.assessmentStatus)).length,
      requirements.length
    ),
    exposureComponent(
      "material-risks",
      "Material Risks",
      risks.filter((item) => item.likelihood * item.impact >= 10).length,
      risks.length
    ),
    exposureComponent(
      "evidence-weakness",
      "Evidence weakness",
      evidence.filter((item) => ["stale", "expired", "unknown"].includes(item.freshness)).length,
      evidence.length
    ),
    exposureComponent(
      "delivery-risk",
      "Blocked or overdue Actions",
      actions.filter((item) => ["blocked", "overdue"].includes(item.impact?.urgency ?? "")).length,
      actions.length
    )
  ];
  const primaryDriver = components.reduce((current, component) =>
    exposureRank(component.band) > exposureRank(current.band) ||
    (exposureRank(component.band) === exposureRank(current.band) && component.count > current.count)
      ? component
      : current
  );
  return {
    band: primaryDriver.band,
    bandLabel: labelExposureBand(primaryDriver.band),
    primaryDriver,
    components
  };
}

function exposureComponent(
  id: ExposureComponent["id"],
  labelText: string,
  count: number,
  total: number
): ExposureComponent {
  const ratio = total === 0 ? 0 : count / total;
  const band: ExposureBand =
    ratio >= 0.5 || count >= 5 ? "extreme" : ratio >= 0.25 || count >= 2 ? "high" : count > 0 ? "moderate" : "low";
  return { id, label: labelText, band, count };
}

function exposureRank(band: ExposureBand): number {
  return { low: 0, moderate: 1, high: 2, extreme: 3 }[band];
}

function labelExposureBand(band: ExposureBand): string {
  return band[0]!.toUpperCase() + band.slice(1);
}

const STRATEGY_PRIORITY_BANDS = [
  { id: "critical", label: "Critical priority", minScore: 28 },
  { id: "high", label: "High priority", minScore: 20 },
  { id: "medium", label: "Medium priority", minScore: 10 },
  { id: "low", label: "Low priority", minScore: 1 },
  { id: "none", label: "No risk priority yet", minScore: 0 }
] as const;

function strategyTrendModifier(trend: StrategicChoice["trend"]): number {
  switch (trend) {
    case "deteriorating":
      return 5;
    case "steady":
      return 2;
    case "unknown":
      return 1;
    case "improving":
      return 0;
  }
}

function strategyConfidenceModifier(confidence: StrategicChoice["confidence"]): number {
  switch (confidence) {
    case "low":
      return 3;
    case "medium":
      return 1;
    case "high":
      return 0;
  }
}

function strategyPriorityBandForScore(score: number): { readonly id: StrategyPriorityBand; readonly label: string } {
  const band = STRATEGY_PRIORITY_BANDS.find((candidate) => score >= candidate.minScore)!;
  return { id: band.id, label: band.label };
}

export function buildStrategyPrioritySummary(
  choice: StrategicChoice,
  risksById: ReadonlyMap<string, RiskEntity>
): StrategyPrioritySummary {
  const riskRefs: Array<{ readonly riskId: string; readonly outcomeId?: string; readonly outcomeStatement?: string }> =
    [
      ...choice.references
        .filter((reference) => reference.entityType === "risk")
        .map((reference) => ({ riskId: reference.entityId })),
      ...choice.outcomes.flatMap((outcome) =>
        outcome.references
          .filter((reference) => reference.entityType === "risk")
          .map((reference) => ({
            riskId: reference.entityId,
            outcomeId: outcome.id,
            outcomeStatement: outcome.statement
          }))
      )
    ];
  const actionIds = new Set([
    ...choice.references
      .filter((reference) => reference.entityType === "action")
      .map((reference) => reference.entityId),
    ...choice.outcomes.flatMap((outcome) =>
      outcome.references.filter((reference) => reference.entityType === "action").map((reference) => reference.entityId)
    )
  ]);
  const seenRiskIds = new Set<string>();
  const unresolvedRiskIds = new Set<string>();
  const modifier = strategyTrendModifier(choice.trend) + strategyConfidenceModifier(choice.confidence);
  const priorityRisks: StrategyPriorityRisk[] = [];

  for (const reference of riskRefs) {
    if (seenRiskIds.has(reference.riskId)) {
      continue;
    }
    seenRiskIds.add(reference.riskId);
    const risk = risksById.get(reference.riskId);
    if (!risk || risk.recordStatus === "deleted") {
      unresolvedRiskIds.add(reference.riskId);
      continue;
    }
    const severityScore = risk.likelihood * risk.impact;
    const severity = riskSeverityForScore(severityScore);
    priorityRisks.push({
      riskId: risk.id,
      title: risk.title,
      likelihood: risk.likelihood,
      impact: risk.impact,
      severityId: severity.id,
      severityLabel: severity.label,
      severityScore,
      adjustedScore: severityScore + modifier,
      outcomeId: reference.outcomeId,
      outcomeStatement: reference.outcomeStatement
    });
  }

  const sortedRisks = priorityRisks.sort(
    (left, right) =>
      right.adjustedScore - left.adjustedScore ||
      right.severityScore - left.severityScore ||
      left.title.localeCompare(right.title, "en-AU")
  );
  const score = sortedRisks[0]?.adjustedScore ?? 0;
  const band = strategyPriorityBandForScore(score);
  const highRiskCount = sortedRisks.filter((risk) => risk.severityId === "high").length;
  const averageAdjustedScore = sortedRisks.length
    ? Number((sortedRisks.reduce((total, risk) => total + risk.adjustedScore, 0) / sortedRisks.length).toFixed(1))
    : 0;
  const rationale = strategyPriorityRationale({
    bandLabel: band.label,
    riskCount: sortedRisks.length,
    highRiskCount,
    linkedActionCount: actionIds.size,
    unresolvedRiskReferenceCount: unresolvedRiskIds.size,
    score
  });

  return {
    choiceId: choice.id,
    band: band.id,
    bandLabel: band.label,
    score,
    highRiskCount,
    averageAdjustedScore,
    topRisks: sortedRisks.slice(0, 3),
    linkedActionCount: actionIds.size,
    unresolvedRiskReferenceCount: unresolvedRiskIds.size,
    rationale
  };
}

function strategyPriorityRationale(input: {
  readonly bandLabel: string;
  readonly riskCount: number;
  readonly highRiskCount: number;
  readonly linkedActionCount: number;
  readonly unresolvedRiskReferenceCount: number;
  readonly score: number;
}): string {
  if (input.riskCount === 0) {
    return input.unresolvedRiskReferenceCount > 0
      ? `${input.unresolvedRiskReferenceCount} unresolved risk reference${input.unresolvedRiskReferenceCount === 1 ? "" : "s"} need repair before priority can be calculated.`
      : "No linked risks yet. Link risks to infer strategic priority.";
  }
  const riskText = `${input.riskCount} linked risk${input.riskCount === 1 ? "" : "s"}`;
  const highRiskText =
    input.highRiskCount > 0
      ? `, including ${input.highRiskCount} high risk${input.highRiskCount === 1 ? "" : "s"}`
      : "";
  const actionText = `${input.linkedActionCount} linked action${input.linkedActionCount === 1 ? "" : "s"}`;
  const repairText =
    input.unresolvedRiskReferenceCount > 0
      ? ` ${input.unresolvedRiskReferenceCount} unresolved risk reference${input.unresolvedRiskReferenceCount === 1 ? "" : "s"} also need repair.`
      : "";
  return `${input.bandLabel} from ${riskText}${highRiskText}; score ${input.score}; ${actionText}.${repairText}`;
}

// ---------------------------------------------------------------------------
// Output 3: Cyber Awareness Change Strategy
// ---------------------------------------------------------------------------

/** Fixed core communication themes for cyber change. */
export const CONTINUOUS_COMPLIANCE_CHANGE_THEMES = [
  {
    id: "shared-responsibility",
    label: "Shared responsibility",
    summary: "Security is everyone's job, supported by specialists — not something done to people by a separate team."
  },
  {
    id: "everyday-resilience",
    label: "Everyday resilience",
    summary: "Good security habits keep services running and protect the people who rely on them."
  },
  {
    id: "clear-and-simple",
    label: "Clear and simple",
    summary: "Plain language and small, practical steps make the right action the easy action."
  },
  {
    id: "trust-and-transparency",
    label: "Trust and transparency",
    summary: "We explain why a control exists and what it protects, so people can make informed choices."
  }
] as const;

/** Fixed plain-language translations for common technical terms. */
export const CONTINUOUS_COMPLIANCE_TERM_TRANSLATIONS = [
  {
    term: "Multi-factor authentication (MFA)",
    plain: "A second check, like a code on your phone, that proves it is really you."
  },
  { term: "Phishing", plain: "A fake message that tries to trick you into giving away access or information." },
  { term: "Patching", plain: "Applying updates that fix known weaknesses before they can be used against us." },
  { term: "Least privilege", plain: "Giving people just the access they need to do their job, and no more." },
  { term: "Zero trust", plain: "Checking every request, every time, instead of assuming the inside is safe." },
  { term: "Incident response", plain: "The agreed steps we follow quickly when something goes wrong." }
] as const;

export interface ChangeMessageBlock {
  readonly id: string;
  readonly scenario: string;
  readonly themeId: (typeof CONTINUOUS_COMPLIANCE_CHANGE_THEMES)[number]["id"];
  readonly message: string;
}

export interface CyberAwarenessChangeStrategyModel {
  readonly generatedAt: string;
  readonly themes: typeof CONTINUOUS_COMPLIANCE_CHANGE_THEMES;
  readonly translations: typeof CONTINUOUS_COMPLIANCE_TERM_TRANSLATIONS;
  readonly messageBlocks: readonly ChangeMessageBlock[];
  readonly metPercentage: number;
}

export function buildCyberAwarenessChangeStrategyModel(
  entities: readonly V01Entity[],
  options: { readonly now?: Date } = {}
): CyberAwarenessChangeStrategyModel {
  const now = options.now ?? new Date();
  const requirements = entities.filter(
    (entity): entity is RequirementEntity => entity.entityType === "requirement" && entity.recordStatus !== "deleted"
  );
  const applicable = requirements.filter((requirement) => requirement.assessmentStatus !== "not-applicable");
  const met = applicable.filter((requirement) => requirement.assessmentStatus === "met").length;
  const metPercentage = percent(met, applicable.length);

  const messageBlocks: readonly ChangeMessageBlock[] = [
    {
      id: "leadership-update",
      scenario: "Leadership or board update",
      themeId: "shared-responsibility",
      message: `Our security posture is at ${metPercentage}% of applicable obligations met. Continued progress depends on every team owning its part, with the security function providing tools, guidance, and assurance.`
    },
    {
      id: "all-staff-reminder",
      scenario: "All-staff reminder",
      themeId: "clear-and-simple",
      message:
        "If a message feels urgent, unexpected, or too good to be true, pause and check. Reporting something suspicious is always the right call — you will never be in trouble for it."
    },
    {
      id: "new-control-rollout",
      scenario: "Introducing a new control",
      themeId: "trust-and-transparency",
      message:
        "We are turning on this control to protect the services our community relies on. Here is what changes for you, why it matters, and where to get help if you get stuck."
    },
    {
      id: "incident-stand-down",
      scenario: "After an incident or near miss",
      themeId: "everyday-resilience",
      message:
        "Thanks to quick reporting and a clear response, we contained this with minimal impact. Here is what we learned and the small change we are making so we are even better prepared next time."
    }
  ];

  return {
    generatedAt: now.toISOString(),
    themes: CONTINUOUS_COMPLIANCE_CHANGE_THEMES,
    translations: CONTINUOUS_COMPLIANCE_TERM_TRANSLATIONS,
    messageBlocks,
    metPercentage
  };
}
