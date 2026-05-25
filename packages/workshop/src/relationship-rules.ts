import {
  operatorLinkRuleForEndpoints,
  type ActionEntity,
  type DirectionEntity,
  type EvidenceEntity,
  type LinkEntity,
  type OperatorLinkRule,
  type RequirementEntity,
  type RiskEntity,
  type V01Entity
} from "@pspf/contracts";

export type LinkableItemType = "evidence" | "action" | "risk" | "direction";

export const requirementRelationshipItemTypes = [
  "evidence",
  "action",
  "risk",
  "direction"
] as const satisfies readonly LinkableItemType[];

export function linkTypeForExistingItem(itemType: LinkableItemType): LinkEntity["linkType"] {
  return existingItemOperatorRule(itemType).linkType;
}

export function linkPhraseForExistingItem(itemType: LinkableItemType): string {
  return existingItemOperatorRule(itemType).phrase;
}

export function existingItemOperatorRule(itemType: LinkableItemType): OperatorLinkRule {
  const fromType = itemType === "direction" ? "direction" : "requirement";
  const toType = itemType === "direction" ? "requirement" : itemType;
  const rule = operatorLinkRuleForEndpoints(fromType, toType, "workshop");
  if (!rule) {
    throw new Error(`Missing Workshop operator link rule for ${fromType} to ${toType}`);
  }
  return rule;
}

export interface RelationshipConsequence {
  readonly title: string;
  readonly summary: string;
  readonly linksAdded: number;
  readonly affectedRequirementCount: number;
  readonly affectedDomainCount: number;
  readonly evidenceCoverageClosed: number;
  readonly connectedViewFocusIds: readonly string[];
}

export function buildRelationshipConsequence(input: {
  readonly requirement: RequirementEntity;
  readonly itemType: LinkableItemType;
  readonly linkedItems: readonly LinkableExistingEntity[];
  readonly allEntities: readonly V01Entity[];
  readonly newLinks: readonly LinkEntity[];
}): RelationshipConsequence {
  const activeLinks = input.allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const allLinks = [...activeLinks, ...input.newLinks];
  const affectedRequirementIds = new Set<string>();
  affectedRequirementIds.add(input.requirement.id);
  for (const item of input.linkedItems) {
    for (const requirementId of requirementIdsForLinkedItem(item, allLinks)) {
      affectedRequirementIds.add(requirementId);
    }
  }
  const requirements = input.allEntities.filter(
    (entity): entity is RequirementEntity =>
      entity.entityType === "requirement" && affectedRequirementIds.has(entity.id)
  );
  const affectedDomainCount = new Set(requirements.map((requirement) => requirement.domainId)).size;
  const previouslySupportedRequirementIds = new Set(
    activeLinks
      .filter(
        (link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence"
      )
      .map((link) => link.fromId)
  );
  const evidenceCoverageClosed = input.newLinks.filter(
    (link) =>
      link.linkType === "supported-by" &&
      link.fromType === "requirement" &&
      link.toType === "evidence" &&
      !previouslySupportedRequirementIds.has(link.fromId)
  ).length;
  const focusIds = uniqueStrings([
    input.requirement.id,
    ...input.linkedItems.map((item) => item.id),
    ...input.newLinks.flatMap((link) => [link.fromId, link.toId])
  ]);

  return {
    title: relationshipConsequenceTitle(input.itemType, input.linkedItems.length),
    summary: relationshipConsequenceSummary({
      itemType: input.itemType,
      linkedCount: input.linkedItems.length,
      affectedRequirementCount: affectedRequirementIds.size,
      affectedDomainCount,
      evidenceCoverageClosed
    }),
    linksAdded: input.newLinks.length,
    affectedRequirementCount: affectedRequirementIds.size,
    affectedDomainCount,
    evidenceCoverageClosed,
    connectedViewFocusIds: focusIds
  };
}

export type LinkableExistingEntity = EvidenceEntity | ActionEntity | RiskEntity | DirectionEntity;

function requirementIdsForLinkedItem(item: LinkableExistingEntity, links: readonly LinkEntity[]): readonly string[] {
  return links
    .filter((link) =>
      item.entityType === "direction"
        ? link.fromId === item.id && link.toType === "requirement"
        : link.toId === item.id && link.fromType === "requirement"
    )
    .map((link) => (item.entityType === "direction" ? link.toId : link.fromId));
}

function relationshipConsequenceTitle(itemType: LinkableItemType, linkedCount: number): string {
  return `Linked ${linkedCount} ${entityLabel(itemType, linkedCount)}`;
}

function relationshipConsequenceSummary(input: {
  readonly itemType: LinkableItemType;
  readonly linkedCount: number;
  readonly affectedRequirementCount: number;
  readonly affectedDomainCount: number;
  readonly evidenceCoverageClosed: number;
}): string {
  const scope = `${input.affectedRequirementCount} ${plural("Requirement", input.affectedRequirementCount)} across ${input.affectedDomainCount} ${plural("domain", input.affectedDomainCount)}`;
  switch (input.itemType) {
    case "evidence":
      return input.evidenceCoverageClosed > 0
        ? `Evidence coverage improved for ${input.evidenceCoverageClosed} ${plural("Requirement", input.evidenceCoverageClosed)}; the linked evidence now supports ${scope}.`
        : `The linked evidence now supports ${scope}.`;
    case "action":
      return `The linked ${entityLabel(input.itemType, input.linkedCount)} now carries remediation context for ${scope}.`;
    case "risk":
      return `The linked ${entityLabel(input.itemType, input.linkedCount)} now explains risk context for ${scope}.`;
    case "direction":
      return `The linked ${entityLabel(input.itemType, input.linkedCount)} now traces current direction context to ${scope}.`;
  }
}

function entityLabel(itemType: LinkableItemType, count: number): string {
  const singular = itemType === "direction" ? "Direction" : itemType === "evidence" ? "Evidence" : titleCase(itemType);
  return itemType === "evidence" ? singular : plural(singular, count);
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function plural(value: string, count: number): string {
  return count === 1 ? value : `${value}s`;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
