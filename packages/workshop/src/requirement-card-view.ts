import type {
  ActionEntity,
  AssessmentStatus,
  DomainEntity,
  EvidenceEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity,
  V01Entity
} from "@pspf/contracts";

export type RequirementCardRag = "green" | "amber" | "red" | "grey";

export interface RequirementCardLinkRef {
  readonly entityType: "evidence" | "action" | "risk";
  readonly id: string;
  readonly title: string;
  readonly detail: string;
}

export interface RequirementCardModel {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly hasSummary: boolean;
  readonly domainId: string;
  readonly domainName: string;
  readonly assessmentStatus: AssessmentStatus;
  readonly statusLabel: string;
  readonly rag: RequirementCardRag;
  readonly evidence: readonly RequirementCardLinkRef[];
  readonly actions: readonly RequirementCardLinkRef[];
  readonly risks: readonly RequirementCardLinkRef[];
  readonly evidenceCount: number;
  readonly actionCount: number;
  readonly riskCount: number;
  readonly evidenceGapCount: number;
  readonly linkedCount: number;
}

export interface RequirementCardDomainGroup {
  readonly domainId: string;
  readonly domainName: string;
  readonly cards: readonly RequirementCardModel[];
  readonly ragCounts: Readonly<Record<RequirementCardRag, number>>;
}

export interface RequirementCardViewModel {
  readonly generatedAt: string;
  readonly groups: readonly RequirementCardDomainGroup[];
  readonly totals: {
    readonly requirements: number;
    readonly green: number;
    readonly amber: number;
    readonly red: number;
    readonly grey: number;
    readonly evidenceGaps: number;
    readonly unlinked: number;
  };
}

const STATUS_LABELS: Readonly<Record<AssessmentStatus, string>> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  met: "Met",
  "partially-met": "Partially met",
  "not-met": "Not met",
  "not-applicable": "Not applicable",
  "under-review": "Under review"
};

export function requirementCardRag(status: AssessmentStatus): RequirementCardRag {
  switch (status) {
    case "met":
      return "green";
    case "partially-met":
    case "in-progress":
    case "under-review":
      return "amber";
    case "not-met":
    case "not-started":
      return "red";
    case "not-applicable":
    default:
      return "grey";
  }
}

export function requirementCardStatusLabel(status: AssessmentStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function buildRequirementCardViewModel(
  entities: readonly V01Entity[],
  domains: readonly Pick<DomainEntity, "id" | "title" | "sortOrder">[],
  options: { readonly now?: Date } = {}
): RequirementCardViewModel {
  const now = options.now ?? new Date();
  const requirements = activeEntities<RequirementEntity>(entities, "requirement");
  const evidence = activeEntities<EvidenceEntity>(entities, "evidence");
  const actions = activeEntities<ActionEntity>(entities, "action");
  const risks = activeEntities<RiskEntity>(entities, "risk");
  const links = activeEntities<LinkEntity>(entities, "link");

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const actionsById = new Map(actions.map((item) => [item.id, item]));
  const risksById = new Map(risks.map((item) => [item.id, item]));

  const evidenceByRequirement = groupTargets(links, "supported-by", "requirement", "evidence");
  const actionsByRequirement = groupTargets(links, "addressed-by", "requirement", "action");
  const risksByRequirement = groupTargets(links, "exposed-by", "requirement", "risk");

  const cards = requirements.map((requirement) => {
    const evidenceRefs = (evidenceByRequirement.get(requirement.id) ?? [])
      .map((id) => evidenceById.get(id))
      .filter((item): item is EvidenceEntity => Boolean(item))
      .map((item) => ({
        entityType: "evidence" as const,
        id: item.id,
        title: item.title,
        detail: freshnessLabel(item.freshness)
      }))
      .sort(compareLinkRefs);
    const actionRefs = (actionsByRequirement.get(requirement.id) ?? [])
      .map((id) => actionsById.get(id))
      .filter((item): item is ActionEntity => Boolean(item))
      .map((item) => ({
        entityType: "action" as const,
        id: item.id,
        title: item.title,
        detail: actionStatusLabel(item.status)
      }))
      .sort(compareLinkRefs);
    const riskRefs = (risksByRequirement.get(requirement.id) ?? [])
      .map((id) => risksById.get(id))
      .filter((item): item is RiskEntity => Boolean(item))
      .map((item) => ({
        entityType: "risk" as const,
        id: item.id,
        title: item.title,
        detail: `Score ${item.likelihood * item.impact}`
      }))
      .sort(compareLinkRefs);
    const evidenceGapCount = evidenceRefs.filter((ref) => ref.detail !== "Current").length;
    const summary = (requirement.summary ?? "").trim();

    return {
      id: requirement.id,
      title: requirement.title,
      summary: summary.length > 0 ? summary : "No summary captured yet.",
      hasSummary: summary.length > 0,
      domainId: requirement.domainId,
      domainName: domainName(requirement.domainId, domains),
      assessmentStatus: requirement.assessmentStatus,
      statusLabel: requirementCardStatusLabel(requirement.assessmentStatus),
      rag: requirementCardRag(requirement.assessmentStatus),
      evidence: evidenceRefs,
      actions: actionRefs,
      risks: riskRefs,
      evidenceCount: evidenceRefs.length,
      actionCount: actionRefs.length,
      riskCount: riskRefs.length,
      evidenceGapCount,
      linkedCount: evidenceRefs.length + actionRefs.length + riskRefs.length
    } satisfies RequirementCardModel;
  });

  const orderedDomains = [...domains].sort((left, right) => left.sortOrder - right.sortOrder);
  const groups = orderedDomains.map((domain) => buildGroup(domain, cards)).filter((group) => group.cards.length > 0);

  const ungrouped = cards.filter((card) => !orderedDomains.some((domain) => domain.id === card.domainId));
  if (ungrouped.length > 0) {
    groups.push({
      domainId: "unassigned",
      domainName: "Unassigned",
      cards: [...ungrouped].sort(compareCards),
      ragCounts: ragCounts(ungrouped)
    });
  }

  return {
    generatedAt: now.toISOString(),
    groups,
    totals: {
      requirements: cards.length,
      green: cards.filter((card) => card.rag === "green").length,
      amber: cards.filter((card) => card.rag === "amber").length,
      red: cards.filter((card) => card.rag === "red").length,
      grey: cards.filter((card) => card.rag === "grey").length,
      evidenceGaps: cards.reduce((total, card) => total + card.evidenceGapCount, 0),
      unlinked: cards.filter((card) => card.linkedCount === 0).length
    }
  };
}

function buildGroup(
  domain: Pick<DomainEntity, "id" | "title">,
  cards: readonly RequirementCardModel[]
): RequirementCardDomainGroup {
  const domainCards = cards.filter((card) => card.domainId === domain.id).sort(compareCards);
  return {
    domainId: domain.id,
    domainName: domain.title,
    cards: domainCards,
    ragCounts: ragCounts(domainCards)
  };
}

function ragCounts(cards: readonly RequirementCardModel[]): Readonly<Record<RequirementCardRag, number>> {
  return {
    green: cards.filter((card) => card.rag === "green").length,
    amber: cards.filter((card) => card.rag === "amber").length,
    red: cards.filter((card) => card.rag === "red").length,
    grey: cards.filter((card) => card.rag === "grey").length
  };
}

function groupTargets(
  links: readonly LinkEntity[],
  linkType: LinkEntity["linkType"],
  fromType: LinkEntity["fromType"],
  toType: LinkEntity["toType"]
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, string[]>();
  for (const link of links) {
    if (link.linkType !== linkType || link.fromType !== fromType || link.toType !== toType) {
      continue;
    }
    const existing = groups.get(link.fromId);
    if (existing) {
      if (!existing.includes(link.toId)) {
        existing.push(link.toId);
      }
    } else {
      groups.set(link.fromId, [link.toId]);
    }
  }
  return groups;
}

function compareCards(left: RequirementCardModel, right: RequirementCardModel): number {
  return (
    ragRank(left.rag) - ragRank(right.rag) || left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" })
  );
}

function compareLinkRefs(left: RequirementCardLinkRef, right: RequirementCardLinkRef): number {
  return left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" });
}

function ragRank(rag: RequirementCardRag): number {
  switch (rag) {
    case "red":
      return 0;
    case "amber":
      return 1;
    case "green":
      return 2;
    default:
      return 3;
  }
}

function freshnessLabel(freshness: EvidenceEntity["freshness"]): string {
  switch (freshness) {
    case "current":
      return "Current";
    case "ageing":
      return "Ageing";
    case "stale":
      return "Stale";
    case "expired":
      return "Expired";
    default:
      return "Unknown";
  }
}

function actionStatusLabel(status: ActionEntity["status"]): string {
  switch (status) {
    case "done":
      return "Done";
    case "in-progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "cancelled":
      return "Cancelled";
    case "todo":
    default:
      return "To do";
  }
}

function domainName(domainId: string, domains: readonly Pick<DomainEntity, "id" | "title">[]): string {
  return domains.find((domain) => domain.id === domainId)?.title ?? domainId;
}

function activeEntities<T extends V01Entity>(
  entities: readonly V01Entity[],
  entityType: T["entityType"]
): readonly T[] {
  return entities.filter(
    (entity): entity is T => entity.entityType === entityType && entity.recordStatus !== "deleted"
  );
}
