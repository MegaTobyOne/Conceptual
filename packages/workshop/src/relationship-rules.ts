import { operatorLinkRuleForEndpoints, type LinkEntity, type OperatorLinkRule } from "@pspf/contracts";

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
