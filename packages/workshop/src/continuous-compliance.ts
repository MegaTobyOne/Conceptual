import type {
  ActionEntity,
  DomainEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity,
  StrategyEntity,
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

export interface HumanCentredRiskItem {
  readonly riskId: string;
  readonly title: string;
  readonly severityId: RiskSeverityId;
  readonly severityLabel: string;
  readonly severityScore: number;
  readonly statusLabel: string;
  readonly treatmentLabel: string;
  readonly linkedActions: number;
}

export interface HumanCentredOutcomeGroup {
  readonly outcomeId: string;
  readonly outcomeStatement: string;
  readonly capabilityArea: string;
  readonly risks: readonly HumanCentredRiskItem[];
}

export interface HumanCentredRiskModel {
  readonly generatedAt: string;
  readonly groups: readonly HumanCentredOutcomeGroup[];
  readonly unassigned: readonly HumanCentredRiskItem[];
  readonly counts: { readonly high: number; readonly medium: number; readonly low: number; readonly total: number };
  readonly treated: number;
  readonly untreated: number;
}

function countRiskLinkedActions(riskId: string, links: readonly LinkEntity[]): number {
  return links.filter(
    (link) =>
      (link.fromType === "risk" && link.fromId === riskId && link.toType === "action") ||
      (link.toType === "risk" && link.toId === riskId && link.fromType === "action")
  ).length;
}

function toRiskItem(risk: RiskEntity, links: readonly LinkEntity[]): HumanCentredRiskItem {
  const score = risk.likelihood * risk.impact;
  const severity = riskSeverityForScore(score);
  const linkedActions = countRiskLinkedActions(risk.id, links);
  const treatmentLabel =
    risk.status === "closed"
      ? "Closed"
      : linkedActions > 0
        ? "Treatment underway"
        : risk.status === "monitored"
          ? "Monitored"
          : "No treatment yet";
  return {
    riskId: risk.id,
    title: risk.title,
    severityId: severity.id,
    severityLabel: severity.label,
    severityScore: score,
    statusLabel: risk.status.charAt(0).toUpperCase() + risk.status.slice(1),
    treatmentLabel,
    linkedActions
  };
}

export function buildHumanCentredRiskModel(
  entities: readonly V01Entity[],
  options: { readonly now?: Date } = {}
): HumanCentredRiskModel {
  const now = options.now ?? new Date();
  const risks = entities.filter(
    (entity): entity is RiskEntity => entity.entityType === "risk" && entity.recordStatus !== "deleted"
  );
  const links = entities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const strategies = entities.filter(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  const riskById = new Map(risks.map((risk) => [risk.id, risk]));
  const assignedRiskIds = new Set<string>();

  const groups: HumanCentredOutcomeGroup[] = [];
  for (const strategy of strategies) {
    for (const choice of strategy.choices) {
      for (const outcome of choice.outcomes) {
        const outcomeRisks = outcome.references
          .filter((reference) => reference.entityType === "risk")
          .map((reference) => riskById.get(reference.entityId))
          .filter((risk): risk is RiskEntity => Boolean(risk))
          .map((risk) => {
            assignedRiskIds.add(risk.id);
            return toRiskItem(risk, links);
          })
          .sort((left, right) => right.severityScore - left.severityScore);
        if (outcomeRisks.length > 0) {
          groups.push({
            outcomeId: outcome.id,
            outcomeStatement: outcome.statement,
            capabilityArea: choice.capabilityArea,
            risks: outcomeRisks
          });
        }
      }
    }
  }

  const unassigned = risks
    .filter((risk) => !assignedRiskIds.has(risk.id))
    .map((risk) => toRiskItem(risk, links))
    .sort((left, right) => right.severityScore - left.severityScore);

  const allItems = [...groups.flatMap((group) => group.risks), ...unassigned];
  const counts = {
    high: allItems.filter((item) => item.severityId === "high").length,
    medium: allItems.filter((item) => item.severityId === "medium").length,
    low: allItems.filter((item) => item.severityId === "low").length,
    total: allItems.length
  };
  const treated = allItems.filter(
    (item) => item.treatmentLabel === "Treatment underway" || item.treatmentLabel === "Closed"
  ).length;

  return {
    generatedAt: now.toISOString(),
    groups,
    unassigned,
    counts,
    treated,
    untreated: counts.total - treated
  };
}

// ---------------------------------------------------------------------------
// Output 6: Continuous Compliance Metro
// ---------------------------------------------------------------------------

/** Fixed central concept for the metro map. */
export const CONTINUOUS_COMPLIANCE_METRO_HUB = "GRC and security management";

export interface MetroStationModel {
  readonly id: string;
  readonly label: string;
  readonly measures: number;
  readonly references: number;
}

export interface MetroLineModel {
  readonly capabilityArea: string;
  readonly choiceStatement: string;
  readonly targetPosture: string;
  readonly trend: string;
  readonly confidence: string;
  readonly stations: readonly MetroStationModel[];
}

export interface ContinuousComplianceMetroModel {
  readonly generatedAt: string;
  readonly hub: string;
  readonly lines: readonly MetroLineModel[];
  readonly totalCapabilities: number;
  readonly totalStations: number;
}

export function buildContinuousComplianceMetroModel(
  entities: readonly V01Entity[],
  options: { readonly now?: Date } = {}
): ContinuousComplianceMetroModel {
  const now = options.now ?? new Date();
  const strategies = entities.filter(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );
  const lines: MetroLineModel[] = [];
  const seenCapabilities = new Set<string>();
  for (const strategy of strategies) {
    for (const choice of strategy.choices) {
      // Fixed ordering follows authoring order; collapse duplicate capability
      // areas to the first authored choice so each line appears once.
      const key = choice.capabilityArea.trim().toLocaleLowerCase("en-AU");
      if (seenCapabilities.has(key)) {
        continue;
      }
      seenCapabilities.add(key);
      lines.push({
        capabilityArea: choice.capabilityArea,
        choiceStatement: choice.statement,
        targetPosture: choice.targetPosture,
        trend: choice.trend,
        confidence: choice.confidence,
        stations: choice.outcomes.map((outcome) => ({
          id: outcome.id,
          label: outcome.statement,
          measures: outcome.measures.length,
          references: outcome.references.length
        }))
      });
    }
  }
  return {
    generatedAt: now.toISOString(),
    hub: CONTINUOUS_COMPLIANCE_METRO_HUB,
    lines,
    totalCapabilities: lines.length,
    totalStations: lines.reduce((total, line) => total + line.stations.length, 0)
  };
}

// ---------------------------------------------------------------------------
// Output 5: Unified Security Operating Model
// ---------------------------------------------------------------------------

/**
 * Fixed canonical security functions for the operating model. Coverage is
 * detected by matching a strategic choice's capability area against the
 * keyword set for each function. The order is fixed across all outputs.
 */
export const CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS = [
  {
    id: "governance-risk",
    label: "Governance and risk",
    keywords: ["govern", "risk", "grc", "assurance", "compliance", "policy"]
  },
  {
    id: "identity-access",
    label: "Identity and access",
    keywords: ["identity", "access", "iam", "privileg", "authentication", "credential"]
  },
  {
    id: "endpoint-protection",
    label: "Endpoint protection",
    keywords: ["endpoint", "device", "workstation", "patch", "hardening", "application control"]
  },
  {
    id: "network-security",
    label: "Network security",
    keywords: ["network", "perimeter", "segmentation", "firewall", "gateway", "boundary"]
  },
  {
    id: "data-information",
    label: "Data and information governance",
    keywords: ["data", "information", "infogov", "classification", "records", "privacy"]
  },
  {
    id: "detection-response",
    label: "Detection and response",
    keywords: ["detect", "response", "soc", "monitor", "incident", "threat", "siem"]
  },
  {
    id: "resilience-recovery",
    label: "Resilience and recovery",
    keywords: ["resilience", "recovery", "backup", "continuity", "restore", "disaster"]
  },
  {
    id: "awareness-culture",
    label: "Awareness and culture",
    keywords: ["awareness", "culture", "training", "people", "change", "behaviour"]
  }
] as const;

export type SecurityFunctionId = (typeof CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS)[number]["id"];

export interface OperatingModelService {
  readonly id: string;
  readonly label: string;
}

export interface OperatingModelTeam {
  readonly name: string;
  readonly capabilityAreas: readonly string[];
  readonly services: readonly OperatingModelService[];
  readonly functionIds: readonly SecurityFunctionId[];
}

export interface OperatingModelFunctionCoverage {
  readonly functionId: SecurityFunctionId;
  readonly label: string;
  readonly covered: boolean;
  readonly teams: readonly string[];
}

export interface UnifiedSecurityOperatingModel {
  readonly generatedAt: string;
  readonly teams: readonly OperatingModelTeam[];
  readonly coverage: readonly OperatingModelFunctionCoverage[];
  readonly unmappedCapabilities: readonly string[];
  readonly coveredFunctions: number;
  readonly gapFunctions: number;
}

function securityFunctionForCapability(capabilityArea: string): SecurityFunctionId | undefined {
  const haystack = capabilityArea.toLocaleLowerCase("en-AU");
  for (const securityFunction of CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS) {
    if (securityFunction.keywords.some((keyword) => haystack.includes(keyword))) {
      return securityFunction.id;
    }
  }
  return undefined;
}

export function buildUnifiedSecurityOperatingModel(
  entities: readonly V01Entity[],
  options: { readonly now?: Date } = {}
): UnifiedSecurityOperatingModel {
  const now = options.now ?? new Date();
  const strategies = entities.filter(
    (entity): entity is StrategyEntity => entity.entityType === "strategy" && entity.recordStatus !== "deleted"
  );

  const teamMap = new Map<
    string,
    { capabilityAreas: Set<string>; services: OperatingModelService[]; functionIds: Set<SecurityFunctionId> }
  >();
  const functionTeams = new Map<SecurityFunctionId, Set<string>>();
  const unmapped = new Set<string>();

  for (const strategy of strategies) {
    for (const choice of strategy.choices) {
      const teamName = choice.executiveOwner?.trim() || "Ownership not set";
      const entry =
        teamMap.get(teamName) ??
        (() => {
          const created = {
            capabilityAreas: new Set<string>(),
            services: [] as OperatingModelService[],
            functionIds: new Set<SecurityFunctionId>()
          };
          teamMap.set(teamName, created);
          return created;
        })();
      entry.capabilityAreas.add(choice.capabilityArea);
      for (const outcome of choice.outcomes) {
        entry.services.push({ id: outcome.id, label: outcome.statement });
      }
      const functionId = securityFunctionForCapability(choice.capabilityArea);
      if (functionId) {
        entry.functionIds.add(functionId);
        const teamsForFunction = functionTeams.get(functionId) ?? new Set<string>();
        teamsForFunction.add(teamName);
        functionTeams.set(functionId, teamsForFunction);
      } else {
        unmapped.add(choice.capabilityArea);
      }
    }
  }

  const teams: OperatingModelTeam[] = [...teamMap.entries()].map(([name, entry]) => ({
    name,
    capabilityAreas: [...entry.capabilityAreas],
    services: entry.services,
    functionIds: CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS.map((item) => item.id).filter((id) =>
      entry.functionIds.has(id)
    )
  }));

  const coverage: OperatingModelFunctionCoverage[] = CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS.map(
    (securityFunction) => {
      const teamsForFunction = [...(functionTeams.get(securityFunction.id) ?? new Set<string>())];
      return {
        functionId: securityFunction.id,
        label: securityFunction.label,
        covered: teamsForFunction.length > 0,
        teams: teamsForFunction
      };
    }
  );

  return {
    generatedAt: now.toISOString(),
    teams,
    coverage,
    unmappedCapabilities: [...unmapped],
    coveredFunctions: coverage.filter((item) => item.covered).length,
    gapFunctions: coverage.filter((item) => !item.covered).length
  };
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
