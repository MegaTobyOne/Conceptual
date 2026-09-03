// Slice R1 (ADR 0097, "Brief once, act often"): deterministic Reporting Pack.
// Pure model builder plus Markdown / plain-text renderers. No clock access: `now` is injected.
// Slice R3 adds operator narrative overrides per slot and the team report card.
import type {
  ActionEntity,
  AssessmentBasis,
  AssessmentStatus,
  BlockerClass,
  DirectionEntity,
  DomainEntity,
  EvidenceEntity,
  LinkEntity,
  NarrativeAudience,
  NarrativeEntity,
  NarrativeSlotKind,
  RequirementControlMappingEntity,
  RequirementEntity,
  RiskEntity,
  TeamReportCardModel,
  TeamReportCardRow
} from "@pspf/contracts";
import {
  DEFAULT_EVIDENCE_FRESHNESS_WINDOW_DAYS,
  TEAM_VERDICT_LABELS,
  assessmentBasis,
  blockerClassLabel,
  buildTeamReportCard,
  buildUncoveredRiskStatement,
  classifyBlocker,
  describeChangeRollup,
  describeTeamVerdict,
  isWithinFreshnessWindow,
  narrativeSlotFor,
  rankBlockersByFanIn,
  summariseAssessmentBasis,
  summariseUncoveredRisk
} from "@pspf/contracts";
import { buildRequirementExplainer } from "@pspf/reference-data";
import type { PostureBriefInput } from "./index.js";

export interface ReportingPackScope {
  readonly kind: "me" | "all";
  /** Domain ids included when `kind` is "me"; ignored when `kind` is "all". */
  readonly domainIds: readonly string[];
}

export interface ReportingPackAnchorRecordStatus {
  readonly requirements: Readonly<Record<string, string>>;
  readonly risks: Readonly<Record<string, string>>;
  readonly actions: Readonly<Record<string, string>>;
}

export interface ReportingPackAnchorCounts {
  readonly requirements: Readonly<Record<string, number>>;
  readonly risks: Readonly<Record<string, number>>;
  readonly actions: Readonly<Record<string, number>>;
}

export interface ReportingPackAnchor {
  readonly snapshotId: string;
  readonly title: string;
  readonly capturedAt: string;
  readonly recordStatus?: ReportingPackAnchorRecordStatus;
  readonly counts?: ReportingPackAnchorCounts;
}

export interface ReportingPackInput extends PostureBriefInput {
  readonly scope: ReportingPackScope;
  readonly anchor?: ReportingPackAnchor;
  /** ISO timestamp used as the clock for freshness, overdue, and generation time. */
  readonly now: string;
  readonly evidenceFreshnessWindowDays?: number;
  /** R3: operator narratives; the active record for a slot replaces that slot's generated text. */
  readonly narratives?: readonly NarrativeEntity[];
  /** R3: reporting period for the team report card, in days; defaults to 30. */
  readonly periodDays?: number;
}

/** R3: the operator narrative currently active for a slot. Never a person; body is operator free text. */
export interface OperatorNote {
  readonly narrativeId: string;
  readonly body: string;
  readonly updatedAt: string;
  readonly supersedesId?: string;
}

export interface ExecutiveBriefSection {
  readonly heading: string;
  readonly slot: string;
  readonly verdict: string;
  /** Operator note body when one is active for `slot`, otherwise `generatedParagraphs`. */
  readonly paragraphs: readonly string[];
  readonly generatedParagraphs: readonly string[];
  readonly operatorNote?: OperatorNote;
  readonly bullets: readonly string[];
}

export interface ExecutiveBriefModel {
  readonly sections: readonly ExecutiveBriefSection[];
}

export interface DomainPackResponse {
  readonly requirementId: string;
  readonly title: string;
  readonly assessmentStatus: AssessmentStatus;
  readonly basis: AssessmentBasis;
  readonly rationale?: string;
}

export interface DomainPackEvidence {
  readonly requirementId: string;
  readonly evidenceTitle: string;
  readonly freshness: string;
  readonly reference: string;
}

export interface DomainPackTrend {
  readonly metNow: number;
  readonly metAtAnchor?: number;
  readonly applicable: number;
}

export interface DomainPackAction {
  readonly actionTitle: string;
  readonly status: string;
  readonly dueDate?: string;
  readonly overdue: boolean;
  readonly linkedRequirementTitles: readonly string[];
}

export interface DomainPackModel {
  readonly domainId: string;
  readonly title: string;
  readonly slot: string;
  readonly responses: readonly DomainPackResponse[];
  readonly evidence: readonly DomainPackEvidence[];
  readonly trend: DomainPackTrend;
  /** Operator note body when one is active for `slot`, otherwise `generatedNarrative`. */
  readonly narrative: string;
  readonly generatedNarrative: string;
  readonly operatorNote?: OperatorNote;
  readonly actionPlan: readonly DomainPackAction[];
}

export type ReadinessCode =
  | "gap-without-action"
  | "gap-without-owner"
  | "action-without-due-date"
  | "action-without-owner"
  | "action-overdue"
  | "met-without-current-evidence"
  | "direction-unanswered"
  | "mapping-draft-unreviewed";

export interface ReadinessItem {
  readonly code: ReadinessCode;
  readonly severity: "high" | "medium";
  readonly message: string;
  readonly targetType: "requirement" | "action" | "direction" | "requirement-control-mapping";
  readonly targetId: string;
}

export interface ReportingPackMetadata {
  readonly generatedAt: string;
  readonly scopeLabel: string;
  readonly anchorLabel: string;
  readonly sourceLabel?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
}

export interface ReportingPackModel {
  readonly classification: "OFFICIAL: Sensitive";
  readonly executiveBrief: ExecutiveBriefModel;
  readonly domainPacks: readonly DomainPackModel[];
  readonly teamReportCard?: TeamReportCardModel;
  readonly readiness: readonly ReadinessItem[];
  readonly metadata: ReportingPackMetadata;
}

const HIGH_RISK_RATING = 10;
const DECISIONS_LIMIT = 10;
const TOP_EXPOSURES_LIMIT = 5;
const OPEN_ACTION_STATUSES: readonly ActionEntity["status"][] = ["todo", "in-progress", "blocked"];
const BLOCKER_CLASS_ORDER: readonly BlockerClass[] = ["us", "funding", "assessor", "supplier"];
const EXCLUSION_NOTE =
  "Note: this pack is OFFICIAL: Sensitive and for internal use. Restricted personal fields are excluded; assessment rationale, action commentary, and owner teams are included.";

interface ScopedRecords {
  readonly domains: readonly Pick<DomainEntity, "id" | "title">[];
  readonly requirements: readonly RequirementEntity[];
  readonly actions: readonly ActionEntity[];
  readonly risks: readonly RiskEntity[];
  readonly evidence: readonly EvidenceEntity[];
  readonly directions: readonly DirectionEntity[];
  readonly mappings: readonly RequirementControlMappingEntity[];
  readonly links: readonly LinkEntity[];
  readonly targetsByRequirement: ReadonlyMap<string, RequirementTargets>;
  readonly requirementIdsByTarget: ReadonlyMap<string, readonly string[]>;
  readonly commerciallyLinkedActionIds: ReadonlySet<string>;
}

interface RequirementTargets {
  readonly actions: readonly string[];
  readonly risks: readonly string[];
  readonly evidence: readonly string[];
}

interface Context {
  readonly now: Date;
  readonly windowDays: number;
  readonly scoped: ScopedRecords;
  readonly requirementsById: ReadonlyMap<string, RequirementEntity>;
  readonly actionsById: ReadonlyMap<string, ActionEntity>;
  readonly evidenceById: ReadonlyMap<string, EvidenceEntity>;
  readonly basisByRequirementId: ReadonlyMap<string, AssessmentBasis>;
  readonly rolesByRequirementId: ReadonlyMap<string, string>;
  readonly operatorNotesBySlot: ReadonlyMap<string, OperatorNote>;
  readonly anchor?: ReportingPackAnchor;
}

export function buildReportingPackModel(input: ReportingPackInput): ReportingPackModel {
  const now = safeDate(input.now) ?? new Date(NaN);
  const windowDays = input.evidenceFreshnessWindowDays ?? DEFAULT_EVIDENCE_FRESHNESS_WINDOW_DAYS;
  const scoped = scopeRecords(input);
  const requirementsById = new Map(scoped.requirements.map((item) => [item.id, item]));
  const actionsById = new Map(scoped.actions.map((item) => [item.id, item]));
  const evidenceById = new Map(scoped.evidence.map((item) => [item.id, item]));
  const basisByRequirementId = new Map(
    scoped.requirements.map((requirement) => {
      const linked = (scoped.targetsByRequirement.get(requirement.id)?.evidence ?? [])
        .map((id) => evidenceById.get(id))
        .filter((item): item is EvidenceEntity => item !== undefined);
      const fresh = linked.filter((item) => isEvidenceCurrent(item, now, windowDays));
      return [requirement.id, assessmentBasis(linked.length, fresh.length)];
    })
  );
  const context: Context = {
    now,
    windowDays,
    scoped,
    requirementsById,
    actionsById,
    evidenceById,
    basisByRequirementId,
    rolesByRequirementId: buildRolesByRequirementId(scoped.mappings),
    operatorNotesBySlot: resolveOperatorNotes(input.narratives ?? []),
    anchor: input.anchor
  };

  return {
    classification: "OFFICIAL: Sensitive",
    executiveBrief: {
      sections: [
        withOperatorNote(context, "exec-brief.where-we-stand", buildWhereWeStandSection(context)),
        withOperatorNote(context, "exec-brief.what-changed", buildWhatChangedSection(context)),
        withOperatorNote(context, "exec-brief.top-exposures", buildTopExposuresSection(context)),
        withOperatorNote(context, "exec-brief.decisions-needed", buildDecisionsNeededSection(context))
      ]
    },
    domainPacks: scoped.domains.map((domain) => buildDomainPack(context, domain)),
    teamReportCard: buildTeamReportCard({
      requirements: scoped.requirements,
      actions: scoped.actions,
      links: scoped.links,
      now: input.now,
      periodDays: input.periodDays,
      anchor: input.anchor
        ? {
            capturedAt: input.anchor.capturedAt,
            recordStatus: input.anchor.recordStatus
              ? { actions: input.anchor.recordStatus.actions, requirements: input.anchor.recordStatus.requirements }
              : undefined
          }
        : undefined
    }),
    readiness: buildReadiness(context),
    metadata: {
      generatedAt: input.now,
      scopeLabel: buildScopeLabel(input.scope, scoped.domains),
      anchorLabel: input.anchor
        ? `${input.anchor.title} (captured ${formatDisplayDate(input.anchor.capturedAt)})`
        : "No earlier snapshot",
      sourceLabel: input.sourceLabel,
      bundleVersion: input.bundleVersion,
      schemaVersion: input.schemaVersion
    }
  };
}

// --- Scope ---------------------------------------------------------------------------------

function scopeRecords(input: ReportingPackInput): ScopedRecords {
  const live = <T extends { readonly recordStatus: string }>(items: readonly T[] | undefined): T[] =>
    (items ?? []).filter((item) => item.recordStatus !== "deleted");
  const scopeDomainIds = new Set(input.scope.domainIds);
  const domains =
    input.scope.kind === "all" ? input.domains : input.domains.filter((domain) => scopeDomainIds.has(domain.id));
  const domainIds = new Set(domains.map((domain) => domain.id));
  const requirements = live(input.requirements)
    .filter((requirement) => domainIds.has(requirement.domainId))
    .sort(byTitle);
  const requirementIds = new Set(requirements.map((item) => item.id));
  const links = live(input.links).filter((link) => link.fromType === "requirement" && requirementIds.has(link.fromId));
  const targetsByRequirement = buildTargetsByRequirement(links);
  const requirementIdsByTarget = buildRequirementIdsByTarget(links);
  const inScope = (id: string): boolean => requirementIdsByTarget.has(id);
  const commercialTypes = new Set<string>(["contract", "spend-item", "supplier"]);
  const commerciallyLinkedActionIds = new Set(
    live(input.links).flatMap((link) =>
      link.fromType === "action" && commercialTypes.has(link.toType)
        ? [link.fromId]
        : link.toType === "action" && commercialTypes.has(link.fromType)
          ? [link.toId]
          : []
    )
  );
  // Directions are organisation-wide instruments with no domain, so scope never filters them.
  return {
    domains,
    requirements,
    actions: live(input.actions)
      .filter((item) => inScope(item.id))
      .sort(byTitle),
    risks: live(input.risks)
      .filter((item) => inScope(item.id))
      .sort(byTitle),
    evidence: live(input.evidence)
      .filter((item) => inScope(item.id))
      .sort(byTitle),
    directions: live(input.directions).sort(byTitle),
    mappings: live(input.requirementControlMappings).filter((item) => requirementIds.has(item.requirementId)),
    links,
    targetsByRequirement,
    requirementIdsByTarget,
    commerciallyLinkedActionIds
  };
}

function buildTargetsByRequirement(links: readonly LinkEntity[]): ReadonlyMap<string, RequirementTargets> {
  const map = new Map<string, { actions: string[]; risks: string[]; evidence: string[] }>();
  for (const link of [...links].sort((left, right) => left.toId.localeCompare(right.toId))) {
    const current = map.get(link.fromId) ?? { actions: [], risks: [], evidence: [] };
    if (link.linkType === "addressed-by" && link.toType === "action") {
      current.actions.push(link.toId);
    } else if (link.linkType === "exposed-by" && link.toType === "risk") {
      current.risks.push(link.toId);
    } else if (link.linkType === "supported-by" && link.toType === "evidence") {
      current.evidence.push(link.toId);
    }
    map.set(link.fromId, current);
  }
  return map;
}

function buildRequirementIdsByTarget(links: readonly LinkEntity[]): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) {
    const isWorkLink =
      (link.linkType === "addressed-by" && link.toType === "action") ||
      (link.linkType === "exposed-by" && link.toType === "risk") ||
      (link.linkType === "supported-by" && link.toType === "evidence");
    if (!isWorkLink) {
      continue;
    }
    const current = map.get(link.toId) ?? [];
    if (!current.includes(link.fromId)) {
      current.push(link.fromId);
    }
    map.set(link.toId, current);
  }
  return map;
}

function buildRolesByRequirementId(mappings: readonly RequirementControlMappingEntity[]): ReadonlyMap<string, string> {
  const roles = new Map<string, Set<string>>();
  for (const mapping of mappings) {
    const role = mapping.reviewBy?.trim();
    if (!role) {
      continue;
    }
    const set = roles.get(mapping.requirementId) ?? new Set<string>();
    set.add(role);
    roles.set(mapping.requirementId, set);
  }
  return new Map([...roles.entries()].map(([id, set]) => [id, [...set].sort(compareText).join(", ")]));
}

function buildScopeLabel(scope: ReportingPackScope, domains: readonly Pick<DomainEntity, "title">[]): string {
  if (scope.kind === "all") {
    return "All domains";
  }
  return domains.length === 0
    ? "My domains: none selected"
    : `My domains: ${domains.map((domain) => domain.title).join(", ")}`;
}

// --- Executive brief -----------------------------------------------------------------------

interface GeneratedSection {
  readonly heading: string;
  readonly verdict: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
}

function withOperatorNote(context: Context, kind: NarrativeSlotKind, section: GeneratedSection): ExecutiveBriefSection {
  const slot = narrativeSlotFor(kind);
  const note = operatorNoteFor(context, slot);
  return {
    heading: section.heading,
    slot,
    verdict: section.verdict,
    paragraphs: note ? [note.body] : section.paragraphs,
    generatedParagraphs: section.paragraphs,
    ...(note ? { operatorNote: note } : {}),
    bullets: section.bullets
  };
}

function operatorNoteFor(context: Context, slot: string): OperatorNote | undefined {
  return context.operatorNotesBySlot.get(slot);
}

export interface ResolveOperatorNotesOptions {
  /** When set, only narratives written for this audience are considered. */
  readonly audience?: NarrativeAudience;
}

/**
 * R4: resolves the operator note active for each slot. A narrative counts when its recordStatus is
 * active, its body is non-empty, and no other active record names it in `supersedesId`. Ties on a
 * slot resolve to the latest updatedAt, then the greater id. Pure; input is not mutated.
 */
export function resolveOperatorNotes(
  narratives: readonly NarrativeEntity[],
  options: ResolveOperatorNotesOptions = {}
): ReadonlyMap<string, OperatorNote> {
  const active = narratives.filter(
    (item) =>
      item.recordStatus === "active" &&
      item.body.trim().length > 0 &&
      (options.audience === undefined || item.audience === options.audience)
  );
  const superseded = new Set(active.map((item) => item.supersedesId).filter((id): id is string => id !== undefined));
  const bySlot = new Map<string, NarrativeEntity>();
  for (const item of active) {
    if (superseded.has(item.id)) {
      continue;
    }
    const current = bySlot.get(item.slot);
    if (
      !current ||
      item.updatedAt.localeCompare(current.updatedAt) > 0 ||
      (item.updatedAt === current.updatedAt && item.id.localeCompare(current.id) > 0)
    ) {
      bySlot.set(item.slot, item);
    }
  }
  return new Map(
    [...bySlot.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en-AU", { sensitivity: "base" }))
      .map(([slot, narrative]) => [
        slot,
        {
          narrativeId: narrative.id,
          body: narrative.body.trim(),
          updatedAt: narrative.updatedAt,
          ...(narrative.supersedesId ? { supersedesId: narrative.supersedesId } : {})
        }
      ])
  );
}

function buildWhereWeStandSection(context: Context): GeneratedSection {
  const { scoped, anchor } = context;
  const applicable = scoped.requirements.filter(isApplicable);
  const met = applicable.filter(isMet);
  const basis = summariseAssessmentBasis(
    met.map((requirement) => basisCounts(context.basisByRequirementId.get(requirement.id)))
  );
  const domainList = joinNatural(scoped.domains.map((domain) => domain.title));
  const verdict =
    applicable.length === 0
      ? `Across ${domainList || "the selected scope"}, no applicable requirements are recorded yet.`
      : `Across ${domainList}, ${met.length} of ${applicable.length} applicable ${plural(applicable.length, "requirement is", "requirements are")} met; ${basis.evidencedFresh} ${plural(basis.evidencedFresh, "is", "are")} backed by current evidence.`;
  const paragraphs = [
    met.length === 0
      ? undefined
      : `Of the met requirements, ${basis.asserted} ${plural(basis.asserted, "is", "are")} asserted without evidence and ${basis.evidenced} ${plural(basis.evidenced, "has", "have")} evidence that is no longer current. Current means linked evidence marked current and updated within the last ${context.windowDays} days.`,
    describeTrend(context, met.length, applicable.length, anchor)
  ].filter((item): item is string => item !== undefined);
  const bullets = scoped.domains.map((domain) => {
    const domainApplicable = applicable.filter((requirement) => requirement.domainId === domain.id);
    const domainMet = domainApplicable.filter(isMet);
    const fresh = domainMet.filter(
      (requirement) => context.basisByRequirementId.get(requirement.id) === "evidenced-fresh"
    );
    return `${domain.title}: ${domainMet.length} of ${domainApplicable.length} applicable met; ${fresh.length} backed by current evidence.`;
  });
  return { heading: "Where we stand", verdict, paragraphs, bullets };
}

function describeTrend(
  context: Context,
  metNow: number,
  applicableNow: number,
  anchor: ReportingPackAnchor | undefined
): string {
  if (!anchor) {
    return "No earlier snapshot to compare against.";
  }
  const anchorRate = anchorMetRate(context, anchor);
  if (anchorRate === undefined) {
    return `${anchor.title} does not record requirement counts, so no trend can be stated.`;
  }
  const nowRate = applicableNow === 0 ? 0 : Math.round((metNow / applicableNow) * 100);
  const delta = nowRate - anchorRate.percent;
  const scopeNote = anchorRate.organisationWide ? " (the earlier figure is organisation-wide)" : "";
  if (delta === 0) {
    return `Met rate is unchanged at ${nowRate}% since ${anchor.title}${scopeNote}.`;
  }
  return `Met rate is ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} ${plural(Math.abs(delta), "point", "points")} since ${anchor.title}, from ${anchorRate.percent}% to ${nowRate}%${scopeNote}.`;
}

function anchorMetRate(
  context: Context,
  anchor: ReportingPackAnchor
): { readonly percent: number; readonly organisationWide: boolean } | undefined {
  if (anchor.recordStatus) {
    const statuses = context.scoped.requirements
      .map((requirement) => anchor.recordStatus?.requirements[requirement.id])
      .filter((status): status is string => status !== undefined && status !== "not-applicable");
    if (statuses.length === 0) {
      return undefined;
    }
    const met = statuses.filter((status) => status === "met").length;
    return { percent: Math.round((met / statuses.length) * 100), organisationWide: false };
  }
  if (anchor.counts) {
    const applicable = Object.entries(anchor.counts.requirements)
      .filter(([status]) => status !== "not-applicable")
      .reduce((total, [, count]) => total + count, 0);
    if (applicable === 0) {
      return undefined;
    }
    const met = anchor.counts.requirements["met"] ?? 0;
    return { percent: Math.round((met / applicable) * 100), organisationWide: true };
  }
  return undefined;
}

function buildWhatChangedSection(context: Context): GeneratedSection {
  const { anchor, scoped } = context;
  if (!anchor) {
    return {
      heading: "What changed",
      verdict: "No earlier snapshot recorded.",
      paragraphs: [],
      bullets: []
    };
  }
  const heading = `What changed since ${anchor.title}`;
  if (anchor.recordStatus) {
    const record = anchor.recordStatus;
    const improved: string[] = [];
    const regressed: string[] = [];
    let added = 0;
    for (const requirement of scoped.requirements) {
      const then = record.requirements[requirement.id];
      if (then === undefined) {
        added += 1;
        continue;
      }
      const movement = statusRank(requirement.assessmentStatus) - statusRank(then);
      const line = `${requirement.title} moved from ${label(then)} to ${label(requirement.assessmentStatus)}`;
      if (movement > 0) {
        improved.push(`Improved: ${line}.`);
      } else if (movement < 0) {
        regressed.push(`Regressed: ${line}.`);
      }
    }
    const risksOpened = scoped.risks
      .filter((risk) => risk.status !== "closed" && (record.risks[risk.id] ?? "closed") === "closed")
      .map((risk) => `Risk opened: ${risk.title}.`);
    const risksClosed = scoped.risks
      .filter(
        (risk) => risk.status === "closed" && record.risks[risk.id] !== undefined && record.risks[risk.id] !== "closed"
      )
      .map((risk) => `Risk closed: ${risk.title}.`);
    const actionsCompleted = scoped.actions
      .filter((action) => action.status === "done" && record.actions[action.id] !== "done")
      .map((action) => `Action completed: ${action.title}.`);
    const rollup = describeChangeRollup({ improved: improved.length, regressed: regressed.length, wentStale: 0 });
    return {
      heading,
      verdict: `Compared with ${anchor.title}, requirement status shows ${lowerFirst(rollup)}`,
      paragraphs: [
        `${risksOpened.length} ${plural(risksOpened.length, "risk", "risks")} opened, ${risksClosed.length} closed, and ${actionsCompleted.length} ${plural(actionsCompleted.length, "action", "actions")} completed in this scope.${added > 0 ? ` ${added} ${plural(added, "requirement was", "requirements were")} added after the snapshot and ${plural(added, "is", "are")} not compared.` : ""}`,
        "Improved and regressed compare each requirement's recorded status now with its status in the snapshot."
      ],
      bullets: [...improved, ...regressed, ...risksOpened, ...risksClosed, ...actionsCompleted]
    };
  }
  if (anchor.counts) {
    const metThen = anchor.counts.requirements["met"] ?? 0;
    const metNow = scoped.requirements.filter(isMet).length;
    const openThen = (anchor.counts.risks["open"] ?? 0) + (anchor.counts.risks["monitored"] ?? 0);
    const openNow = scoped.risks.filter((risk) => risk.status !== "closed").length;
    const doneThen = anchor.counts.actions["done"] ?? 0;
    const doneNow = scoped.actions.filter((action) => action.status === "done").length;
    return {
      heading,
      verdict: `Compared with ${anchor.title}, met requirements moved from ${metThen} to ${metNow}, open risks from ${openThen} to ${openNow}, and completed actions from ${doneThen} to ${doneNow}.`,
      paragraphs: ["Comparison uses summary counts only; this snapshot predates per-record history."],
      bullets: []
    };
  }
  return {
    heading,
    verdict: `${anchor.title} carries no comparable record or count data.`,
    paragraphs: [],
    bullets: []
  };
}

function buildTopExposuresSection(context: Context): GeneratedSection {
  const { scoped } = context;
  const openRisks = scoped.risks.filter((risk) => risk.status !== "closed");
  const ranked = [...openRisks].sort(
    (left, right) => riskRating(right) - riskRating(left) || compareText(left.title, right.title)
  );
  const high = ranked.filter((risk) => riskRating(risk) >= HIGH_RISK_RATING);
  const coverage = new Map<string, boolean>();
  for (const risk of openRisks) {
    const linked = linkedRequirements(context, risk.id);
    coverage.set(risk.id, linked.some(isMet));
  }
  const uncovered = buildUncoveredRiskStatement(summariseUncoveredRisk(openRisks, coverage));
  const verdict =
    openRisks.length === 0
      ? "No open risks are linked to requirements in scope."
      : `${high.length} of ${openRisks.length} open ${plural(openRisks.length, "risk is", "risks are")} rated high or extreme.`;
  const bullets = ranked.slice(0, TOP_EXPOSURES_LIMIT).map((risk) => {
    const linked = linkedRequirements(context, risk.id);
    const titles = linked.map((requirement) => requirement.title);
    const worst = [...linked].sort(
      (left, right) =>
        statusRank(left.assessmentStatus) - statusRank(right.assessmentStatus) || compareText(left.title, right.title)
    )[0];
    const consequence = buildExposureConsequence(risk, worst);
    const whyItMatters = worst ? curatedWhyItMatters(worst.id) : undefined;
    return [
      `${risk.title} (rating ${riskRating(risk)}, ${ratingWord(riskRating(risk))}) - linked to ${titles.length > 0 ? joinNatural(titles) : "no requirement"}.`,
      consequence,
      whyItMatters
    ]
      .filter((part): part is string => part !== undefined)
      .join(" ");
  });
  return {
    heading: "Top exposures",
    verdict,
    paragraphs: [
      uncovered,
      `Rating is likelihood multiplied by impact; ${HIGH_RISK_RATING} or more is treated as high or extreme.`
    ],
    bullets
  };
}

function buildExposureConsequence(risk: RiskEntity, worst: RequirementEntity | undefined): string {
  if (!worst) {
    return `No requirement is linked to ${risk.title}, so nothing in the plan currently addresses it.`;
  }
  if (isMet(worst)) {
    return `All linked requirements are met; keeping their evidence current keeps this exposure covered.`;
  }
  return `${worst.title} is ${label(worst.assessmentStatus).toLowerCase()}; until it is addressed, ${risk.title} remains a live exposure.`;
}

function curatedWhyItMatters(requirementId: string): string | undefined {
  const explainer = buildRequirementExplainer({ requirementId });
  return explainer.sourceId === "custom-requirement" ? undefined : explainer.whyItMatters;
}

function buildDecisionsNeededSection(context: Context): GeneratedSection {
  const { scoped, actionsById, rolesByRequirementId } = context;
  const candidates = scoped.actions.filter(isOpenAction).map((action) => ({
    id: action.id,
    gatedRequirementIds: linkedRequirements(context, action.id)
      .filter((requirement) => isApplicable(requirement) && !isMet(requirement))
      .map((requirement) => requirement.id)
  }));
  const ranked = rankBlockersByFanIn(candidates, DECISIONS_LIMIT);
  const entries = ranked
    .map((item) => {
      const action = actionsById.get(item.id);
      if (!action) {
        return undefined;
      }
      const owner = action.ownerTeam?.trim() || ownerRoleFor(item.gatedRequirementIds, rolesByRequirementId);
      // Workshop actions carry no review-type flag, so only funding vs "us" can be derived here.
      const blockerClass =
        action.blockerClass ??
        classifyBlocker({
          isReviewType: false,
          hasCommercialLink: scoped.commerciallyLinkedActionIds.has(action.id)
        });
      return { action, owner, blockerClass, gated: item.gatedRequirementCount };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .sort(
      (left, right) =>
        BLOCKER_CLASS_ORDER.indexOf(left.blockerClass) - BLOCKER_CLASS_ORDER.indexOf(right.blockerClass) ||
        right.gated - left.gated ||
        compareText(left.action.title, right.action.title)
    );
  const needing = entries.filter((entry) => !entry.action.dueDate || entry.owner === undefined).length;
  const bullets = entries.map((entry) => {
    const due = entry.action.dueDate ? `due ${formatDueDate(entry.action.dueDate)}` : "no due date";
    const commentary = latestCommentaryText(entry.action);
    return `${blockerClassLabel(entry.blockerClass)}: ${entry.action.title} - ${due} - owner: ${entry.owner ?? "Ownership not confirmed"} - unblocks ${entry.gated} ${plural(entry.gated, "requirement", "requirements")}${commentary ? ` - latest update: ${commentary}` : ""}.`;
  });
  return {
    heading: "Decisions needed",
    verdict: `${needing} ${plural(needing, "decision needs", "decisions need")} an owner or a date.`,
    paragraphs: [
      entries.length === 0
        ? "No open actions are linked to requirements that are not yet met."
        : "Listed actions are open, gate at least one requirement that is not yet met, and are ranked by how many requirements each one unblocks. Ownership is the action's owner team where one is recorded, otherwise the reviewing role on the requirement's control mappings; where neither is recorded, ownership is not confirmed."
    ],
    bullets
  };
}

function ownerRoleFor(requirementIds: readonly string[], roles: ReadonlyMap<string, string>): string | undefined {
  const names = new Set<string>();
  for (const id of requirementIds) {
    const role = roles.get(id);
    if (role) {
      for (const part of role.split(", ")) {
        names.add(part);
      }
    }
  }
  return names.size === 0 ? undefined : [...names].sort(compareText).join(", ");
}

// --- Domain packs --------------------------------------------------------------------------

function buildDomainPack(context: Context, domain: Pick<DomainEntity, "id" | "title">): DomainPackModel {
  const { scoped, evidenceById, actionsById, anchor, now, windowDays } = context;
  const requirements = scoped.requirements.filter((requirement) => requirement.domainId === domain.id);
  const applicable = requirements.filter(isApplicable);
  const met = applicable.filter(isMet);
  const responses = requirements.map((requirement) => ({
    requirementId: requirement.id,
    title: requirement.title,
    assessmentStatus: requirement.assessmentStatus,
    basis: context.basisByRequirementId.get(requirement.id) ?? "asserted",
    rationale: requirement.assessmentRationale
  }));
  const evidence = requirements
    .flatMap((requirement) =>
      (scoped.targetsByRequirement.get(requirement.id)?.evidence ?? [])
        .map((id) => evidenceById.get(id))
        .filter((item): item is EvidenceEntity => item !== undefined)
        .map((item) => ({
          requirementId: requirement.id,
          evidenceTitle: item.title,
          freshness: describeFreshness(item, now, windowDays),
          reference: item.reference
        }))
    )
    .sort((left, right) => compareText(left.evidenceTitle, right.evidenceTitle));
  const actionIds = new Set(
    requirements.flatMap((requirement) => scoped.targetsByRequirement.get(requirement.id)?.actions ?? [])
  );
  const actionPlan = [...actionIds]
    .map((id) => actionsById.get(id))
    .filter((action): action is ActionEntity => action !== undefined && action.status !== "cancelled")
    .map((action) => ({
      actionTitle: action.title,
      status: label(action.status),
      dueDate: action.dueDate ? formatDueDate(action.dueDate) : undefined,
      overdue: isOverdue(action, now),
      linkedRequirementTitles: linkedRequirements(context, action.id)
        .filter((requirement) => requirement.domainId === domain.id)
        .map((requirement) => requirement.title)
    }))
    .sort((left, right) => compareText(left.actionTitle, right.actionTitle));
  const metAtAnchor = anchor?.recordStatus
    ? requirements.filter((requirement) => anchor.recordStatus?.requirements[requirement.id] === "met").length
    : undefined;
  const slot = narrativeSlotFor("domain.exec-note", domain.id);
  const note = operatorNoteFor(context, slot);
  const generatedNarrative = buildDomainNarrative(context, domain.title, applicable, met);
  return {
    domainId: domain.id,
    title: domain.title,
    slot,
    responses,
    evidence,
    trend: { metNow: met.length, metAtAnchor, applicable: applicable.length },
    narrative: note?.body ?? generatedNarrative,
    generatedNarrative,
    ...(note ? { operatorNote: note } : {}),
    actionPlan
  };
}

function buildDomainNarrative(
  context: Context,
  domainTitle: string,
  applicable: readonly RequirementEntity[],
  met: readonly RequirementEntity[]
): string {
  if (applicable.length === 0) {
    return `${domainTitle} has no applicable requirements recorded, so there is no standing to report.`;
  }
  const standing = `${domainTitle} has ${met.length} of ${applicable.length} applicable ${plural(applicable.length, "requirement", "requirements")} met.`;
  const fresh = met.filter((requirement) => context.basisByRequirementId.get(requirement.id) === "evidenced-fresh");
  const asserted = met.filter((requirement) => context.basisByRequirementId.get(requirement.id) === "asserted");
  const confidence =
    met.length === 0
      ? "No requirement is met yet, so evidence confidence cannot be stated."
      : `${fresh.length} of the ${met.length} met ${plural(met.length, "requirement is", "requirements are")} backed by current evidence${asserted.length > 0 ? `; ${asserted.length} ${plural(asserted.length, "is", "are")} asserted without evidence` : ""}.`;
  const gaps = applicable.filter((requirement) => !isMet(requirement));
  const openActionIds = new Set(
    gaps
      .flatMap((requirement) => context.scoped.targetsByRequirement.get(requirement.id)?.actions ?? [])
      .filter((id) => {
        const action = context.actionsById.get(id);
        return action !== undefined && isOpenAction(action);
      })
  );
  const movement =
    gaps.length === 0
      ? "All applicable requirements are met; keeping evidence current holds this position."
      : openActionIds.size === 0
        ? `${gaps.length} ${plural(gaps.length, "requirement is", "requirements are")} not yet met and none has an open action, so the number will not move without new work.`
        : `Completing the ${openActionIds.size} open ${plural(openActionIds.size, "action", "actions")} linked to requirements not yet met could move up to ${gaps.length} ${plural(gaps.length, "requirement", "requirements")}.`;
  return `${standing} ${confidence} ${movement}`;
}

// --- Readiness -----------------------------------------------------------------------------

function buildReadiness(context: Context): readonly ReadinessItem[] {
  const { scoped, now } = context;
  const items: ReadinessItem[] = [];
  for (const requirement of scoped.requirements.filter(isApplicable)) {
    const openActions = (scoped.targetsByRequirement.get(requirement.id)?.actions ?? [])
      .map((id) => context.actionsById.get(id))
      .filter((action): action is ActionEntity => action !== undefined && isOpenAction(action));
    if (!isMet(requirement) && openActions.length === 0) {
      items.push({
        code: "gap-without-action",
        severity: "high",
        message: `${requirement.title} is ${label(requirement.assessmentStatus).toLowerCase()} with no open action linked.`,
        targetType: "requirement",
        targetId: requirement.id
      });
    }
    if (
      !isMet(requirement) &&
      !requirement.ownerTeam?.trim() &&
      !openActions.some((action) => action.ownerTeam?.trim())
    ) {
      items.push({
        code: "gap-without-owner",
        severity: "medium",
        message: `${requirement.title} is ${label(requirement.assessmentStatus).toLowerCase()} with no owner team on the requirement or any open linked action.`,
        targetType: "requirement",
        targetId: requirement.id
      });
    }
    if (isMet(requirement) && context.basisByRequirementId.get(requirement.id) !== "evidenced-fresh") {
      items.push({
        code: "met-without-current-evidence",
        severity: "medium",
        message: `${requirement.title} is recorded as met without current evidence.`,
        targetType: "requirement",
        targetId: requirement.id
      });
    }
  }
  for (const action of scoped.actions.filter(isOpenAction)) {
    if (!action.ownerTeam?.trim()) {
      items.push({
        code: "action-without-owner",
        severity: "medium",
        message: `${action.title} is open with no owner team.`,
        targetType: "action",
        targetId: action.id
      });
    }
    if (!action.dueDate) {
      items.push({
        code: "action-without-due-date",
        severity: "medium",
        message: `${action.title} is open with no due date.`,
        targetType: "action",
        targetId: action.id
      });
    } else if (isOverdue(action, now)) {
      items.push({
        code: "action-overdue",
        severity: "high",
        message: `${action.title} was due ${formatDueDate(action.dueDate)} and is still open.`,
        targetType: "action",
        targetId: action.id
      });
    }
  }
  for (const direction of scoped.directions) {
    if (direction.responseState === "not-set") {
      items.push({
        code: "direction-unanswered",
        severity: "high",
        message: `${direction.title} has no recorded response.`,
        targetType: "direction",
        targetId: direction.id
      });
    }
  }
  // Rule: a mapping is a draft until someone records a review date; below high confidence that
  // draft should not go out in a pack without the reviewing role confirming it.
  for (const mapping of scoped.mappings) {
    if (!mapping.lastReviewedAt && mapping.confidence !== "high") {
      const requirement = context.requirementsById.get(mapping.requirementId);
      items.push({
        code: "mapping-draft-unreviewed",
        severity: "medium",
        message: `${requirement?.title ?? mapping.requirementId} has a ${mapping.confidence} confidence control mapping that has not been reviewed${mapping.reviewBy?.trim() ? ` (review by ${mapping.reviewBy.trim()})` : ""}.`,
        targetType: "requirement-control-mapping",
        targetId: mapping.id
      });
    }
  }
  return items.sort(
    (left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      compareText(left.message, right.message) ||
      left.code.localeCompare(right.code)
  );
}

// --- Renderers -----------------------------------------------------------------------------

export function renderReportingPackMarkdown(model: ReportingPackModel): string {
  return [
    model.classification,
    "",
    "# PSPF Reporting Pack",
    "",
    ...metadataLines(model.metadata),
    "",
    "## Executive Brief",
    "",
    ...model.executiveBrief.sections.flatMap((section) => sectionMarkdown(section, "###")),
    "## Domain packs",
    "",
    ...model.domainPacks.flatMap(domainPackMarkdown),
    ...(model.teamReportCard
      ? ["## Team report card", "", renderTeamReportCardMarkdown(model.teamReportCard), ""]
      : []),
    "## Readiness before you send",
    "",
    ...readinessLines(model.readiness),
    "",
    EXCLUSION_NOTE
  ].join("\n");
}

export function renderExecutiveBriefMarkdown(model: ReportingPackModel): string {
  return [
    model.classification,
    "",
    "# PSPF Executive Brief",
    "",
    ...metadataLines(model.metadata),
    "",
    ...model.executiveBrief.sections.flatMap((section) => sectionMarkdown(section, "##")),
    EXCLUSION_NOTE
  ].join("\n");
}

export function renderReportingPackPlainText(model: ReportingPackModel): string {
  return [
    model.classification,
    "",
    "PSPF REPORTING PACK",
    "",
    ...metadataLines(model.metadata),
    "",
    underline("EXECUTIVE BRIEF"),
    "",
    ...model.executiveBrief.sections.flatMap(sectionPlainText),
    underline("DOMAIN PACKS"),
    "",
    ...model.domainPacks.flatMap(domainPackPlainText),
    ...(model.teamReportCard
      ? [underline("TEAM REPORT CARD"), "", renderTeamReportCardPlainText(model.teamReportCard), ""]
      : []),
    underline("READINESS BEFORE YOU SEND"),
    "",
    ...readinessLines(model.readiness),
    "",
    EXCLUSION_NOTE
  ].join("\n");
}

export function renderExecutiveBriefPlainText(model: ReportingPackModel): string {
  return [
    model.classification,
    "",
    "PSPF EXECUTIVE BRIEF",
    "",
    ...metadataLines(model.metadata),
    "",
    ...model.executiveBrief.sections.flatMap(sectionPlainText),
    EXCLUSION_NOTE
  ].join("\n");
}

function metadataLines(metadata: ReportingPackMetadata): readonly string[] {
  return [
    `Generated: ${formatDisplayDate(metadata.generatedAt)}`,
    `Scope: ${metadata.scopeLabel}`,
    `Compared with: ${metadata.anchorLabel}`,
    metadata.sourceLabel ? `Source: ${metadata.sourceLabel}` : undefined,
    metadata.bundleVersion ? `Bundle version: ${metadata.bundleVersion}` : undefined,
    metadata.schemaVersion ? `Schema version: ${metadata.schemaVersion}` : undefined
  ].filter((line): line is string => line !== undefined);
}

function sectionMarkdown(section: ExecutiveBriefSection, headingMarker: string): readonly string[] {
  return [
    `${headingMarker} ${section.heading}`,
    "",
    section.verdict,
    "",
    ...section.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(section.bullets.length > 0 ? [...section.bullets.map((bullet) => `- ${bullet}`), ""] : [])
  ];
}

function sectionPlainText(section: ExecutiveBriefSection): readonly string[] {
  return [
    section.heading,
    `  ${section.verdict}`,
    ...section.paragraphs.map((paragraph) => `  ${paragraph}`),
    ...section.bullets.map((bullet) => `  - ${bullet}`),
    ""
  ];
}

function domainPackMarkdown(pack: DomainPackModel): readonly string[] {
  const trend = `Trend: ${pack.trend.metNow} of ${pack.trend.applicable} applicable met${pack.trend.metAtAnchor === undefined ? "" : ` (${pack.trend.metAtAnchor} at the earlier snapshot)`}.`;
  return [
    `### ${pack.title}`,
    "",
    pack.narrative,
    "",
    trend,
    "",
    "#### Responses",
    "",
    ...markdownTable(
      ["Requirement", "ID", "Status", "Basis", "Rationale"],
      pack.responses.map((response) => [
        response.title,
        response.requirementId,
        label(response.assessmentStatus),
        label(response.basis),
        response.rationale ?? ""
      ]),
      "No requirements in this domain."
    ),
    "",
    "#### Evidence",
    "",
    ...markdownTable(
      ["Requirement ID", "Evidence", "Freshness", "Reference"],
      pack.evidence.map((item) => [item.requirementId, item.evidenceTitle, item.freshness, item.reference]),
      "No evidence linked in this domain."
    ),
    "",
    "#### Action plan",
    "",
    ...markdownTable(
      ["Action", "Status", "Due", "Overdue", "Linked requirements"],
      pack.actionPlan.map((item) => [
        item.actionTitle,
        item.status,
        item.dueDate ?? "No due date",
        item.overdue ? "Yes" : "No",
        item.linkedRequirementTitles.join("; ")
      ]),
      "No actions linked in this domain."
    ),
    ""
  ];
}

function domainPackPlainText(pack: DomainPackModel): readonly string[] {
  const trend = `Trend: ${pack.trend.metNow} of ${pack.trend.applicable} applicable met${pack.trend.metAtAnchor === undefined ? "" : ` (${pack.trend.metAtAnchor} at the earlier snapshot)`}.`;
  return [
    pack.title,
    `  ${pack.narrative}`,
    `  ${trend}`,
    "  Responses",
    ...(pack.responses.length === 0
      ? ["    - No requirements in this domain."]
      : pack.responses.map(
          (response) =>
            `    - ${response.title} (${response.requirementId}): ${label(response.assessmentStatus)}; ${label(response.basis)}${response.rationale ? `; ${response.rationale}` : ""}`
        )),
    "  Evidence",
    ...(pack.evidence.length === 0
      ? ["    - No evidence linked in this domain."]
      : pack.evidence.map(
          (item) => `    - ${item.evidenceTitle} (${item.requirementId}): ${item.freshness}; ${item.reference}`
        )),
    "  Action plan",
    ...(pack.actionPlan.length === 0
      ? ["    - No actions linked in this domain."]
      : pack.actionPlan.map(
          (item) =>
            `    - ${item.actionTitle}: ${item.status}; ${item.dueDate ?? "no due date"}${item.overdue ? "; overdue" : ""}; ${item.linkedRequirementTitles.join("; ") || "no linked requirement"}`
        )),
    ""
  ];
}

function readinessLines(items: readonly ReadinessItem[]): readonly string[] {
  if (items.length === 0) {
    return ["- Nothing blocking: all readiness checks passed."];
  }
  return items.map((item) => `- ${item.severity === "high" ? "High" : "Medium"} - ${item.code}: ${item.message}`);
}

// --- Team report card ----------------------------------------------------------------------

const TEAM_CARD_COLUMNS = ["Team", "Gaps", "Open", "Due in period", "Overdue", "Slipped", "Closed", "Verdict"];

export function renderTeamReportCardMarkdown(model: TeamReportCardModel): string {
  return [
    `Period: ${model.periodLabel}. ${teamCardTotalsLine(model)}`,
    "",
    ...markdownTable(TEAM_CARD_COLUMNS, model.rows.map(teamCardCells), "No teams or actions in scope."),
    "",
    ...model.rows.flatMap((row) => [teamCardParagraph(row), ""]),
    TEAM_CARD_RULES_NOTE
  ].join("\n");
}

export function renderTeamReportCardPlainText(model: TeamReportCardModel): string {
  return [
    `Period: ${model.periodLabel}. ${teamCardTotalsLine(model)}`,
    "",
    ...(model.rows.length === 0
      ? ["  No teams or actions in scope."]
      : model.rows.map((row) => {
          const cells = teamCardCells(row);
          return `  ${cells[0]}: ${TEAM_CARD_COLUMNS.slice(1)
            .map((column, index) => `${column} ${cells[index + 1]}`)
            .join("; ")}`;
        })),
    "",
    ...model.rows.flatMap((row) => [`  ${teamCardParagraph(row)}`, ""]),
    `  ${TEAM_CARD_RULES_NOTE}`
  ].join("\n");
}

/** Short note for one team, suitable to send to its lead. Names teams and actions only. */
export function renderTeamCardPlainText(row: TeamReportCardRow, periodLabel: string): string {
  const gaps =
    row.gapsOwned === 0
      ? "Requirement gaps owned: none."
      : `Requirement gaps owned: ${row.gapsOwned} (${row.gapRequirementTitles.join("; ")}).`;
  const slipped =
    row.slipped === 0
      ? "Slipped: none."
      : `Slipped: ${row.slipped} ${plural(row.slipped, "action", "actions")}, ${row.slippedNetDays} ${plural(row.slippedNetDays, "day", "days")} net.`;
  const velocity = row.velocityPerWeek === undefined ? "" : ` (about ${row.velocityPerWeek} per week)`;
  return [
    `Team report card: ${row.team} (${lowerFirst(periodLabel)})`,
    `Verdict: ${TEAM_VERDICT_LABELS[row.verdict]}`,
    describeTeamVerdict(row),
    `Rule: ${row.verdictRule}`,
    gaps,
    `Open actions: ${row.open} (${row.dueInPeriod} due in period, ${row.overdue} overdue, ${row.noDueDate} without a due date).`,
    slipped,
    `Closed in period: ${row.closedInPeriod}${velocity}.`,
    row.nextDue
      ? `Next due: ${row.nextDue.actionTitle} on ${formatDueDate(row.nextDue.dueDate)}.`
      : "Next due: nothing dated ahead."
  ].join("\n");
}

const TEAM_CARD_RULES_NOTE =
  "Verdicts apply fixed rules in order: no open work; stalled; at risk; on track. Each team line states the rule that produced its verdict.";

function teamCardTotalsLine(model: TeamReportCardModel): string {
  return `${model.totals.teams} ${plural(model.totals.teams, "team is", "teams are")} named; ${model.totals.unassignedOpen} open ${plural(model.totals.unassignedOpen, "action has", "actions have")} no owner team.`;
}

function teamCardCells(row: TeamReportCardRow): readonly string[] {
  return [
    row.team,
    String(row.gapsOwned),
    String(row.open),
    String(row.dueInPeriod),
    String(row.overdue),
    String(row.slipped),
    String(row.closedInPeriod),
    TEAM_VERDICT_LABELS[row.verdict]
  ];
}

function teamCardParagraph(row: TeamReportCardRow): string {
  const nextDue = row.nextDue ? ` Next due: ${row.nextDue.actionTitle} on ${formatDueDate(row.nextDue.dueDate)}.` : "";
  return `${describeTeamVerdict(row)} Rule: ${row.verdictRule}${nextDue}`;
}

function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  empty: string
): readonly string[] {
  if (rows.length === 0) {
    return [empty];
  }
  const cell = (value: string): string => value.replaceAll("|", "/").replaceAll("\n", " ");
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)
  ];
}

function underline(heading: string): string {
  return `${heading}\n${"-".repeat(heading.length)}`;
}

// --- Shared helpers ------------------------------------------------------------------------

function linkedRequirements(context: Context, targetId: string): readonly RequirementEntity[] {
  return (context.scoped.requirementIdsByTarget.get(targetId) ?? [])
    .map((id) => context.requirementsById.get(id))
    .filter((requirement): requirement is RequirementEntity => requirement !== undefined)
    .sort(byTitle);
}

function basisCounts(basis: AssessmentBasis | undefined): { evidenceCount: number; freshEvidenceCount: number } {
  switch (basis) {
    case "evidenced-fresh":
      return { evidenceCount: 1, freshEvidenceCount: 1 };
    case "evidenced":
      return { evidenceCount: 1, freshEvidenceCount: 0 };
    default:
      return { evidenceCount: 0, freshEvidenceCount: 0 };
  }
}

function isEvidenceCurrent(item: EvidenceEntity, now: Date, windowDays: number): boolean {
  return item.freshness === "current" && isWithinFreshnessWindow(item.updatedAt, now, windowDays);
}

function describeFreshness(item: EvidenceEntity, now: Date, windowDays: number): string {
  if (item.freshness === "current" && !isWithinFreshnessWindow(item.updatedAt, now, windowDays)) {
    return `Current but not updated in the last ${windowDays} days`;
  }
  return label(item.freshness);
}

function isApplicable(requirement: RequirementEntity): boolean {
  return requirement.assessmentStatus !== "not-applicable";
}

function isMet(requirement: RequirementEntity): boolean {
  return requirement.assessmentStatus === "met";
}

function isOpenAction(action: ActionEntity): boolean {
  return OPEN_ACTION_STATUSES.includes(action.status);
}

function isOverdue(action: ActionEntity, now: Date): boolean {
  const due = safeDate(action.dueDate);
  return isOpenAction(action) && due !== undefined && due.getTime() < now.getTime();
}

function riskRating(risk: RiskEntity): number {
  return risk.likelihood * risk.impact;
}

function ratingWord(rating: number): string {
  return rating >= HIGH_RISK_RATING ? "high or extreme" : rating >= 5 ? "moderate" : "low";
}

function statusRank(status: string): number {
  switch (status) {
    case "met":
      return 3;
    case "partially-met":
      return 2;
    case "in-progress":
    case "under-review":
      return 1;
    default:
      return 0;
  }
}

function severityRank(severity: ReadinessItem["severity"]): number {
  return severity === "high" ? 0 : 1;
}

function latestCommentaryText(action: ActionEntity): string | undefined {
  const latest = [...(action.commentary ?? [])]
    .filter((entry) => entry.text.trim().length > 0)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return latest?.text.trim();
}

function byTitle(left: { readonly title?: string }, right: { readonly title?: string }): number {
  return compareText(left.title ?? "", right.title ?? "");
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en-AU", { sensitivity: "base" });
}

function joinNatural(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

function lowerFirst(value: string): string {
  return value.replace(/^./, (letter) => letter.toLowerCase());
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
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

function formatDueDate(value: Date | string): string {
  const date = safeDate(value);
  if (!date) {
    return "unknown";
  }
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

function safeDate(value: Date | string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
