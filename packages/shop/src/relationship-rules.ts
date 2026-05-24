import {
  operatorLinkRuleFor,
  type ActionEntity,
  type ContractEntity,
  type LinkType,
  type RequirementEntity,
  type RiskEntity,
  type SpendItemEntity,
  type SupplierEntity
} from "@pspf/contracts";
import { type RelationshipManagerAction } from "@pspf/webview-shell";
import { commandUri, formatToken } from "./webview/util.js";

export type SupplierRecord = SupplierEntity;
export type ContractRecord = ContractEntity;
export type SpendItemRecord = SpendItemEntity;
export type LinkableTarget = RequirementEntity | ActionEntity | RiskEntity | SpendItemRecord;
export type CommercialSource = SupplierRecord | ContractRecord | SpendItemRecord;

export interface CommercialLinkSpec {
  readonly linkType: LinkType;
  readonly targetType: LinkableTarget["entityType"];
  readonly label: string;
}

export function commercialLinkSpec(
  fromType: CommercialSource["entityType"],
  linkType: LinkType,
  targetType: LinkableTarget["entityType"]
): CommercialLinkSpec {
  const rule = operatorLinkRuleFor(fromType, linkType, targetType);
  if (!rule) {
    throw new Error(`Missing Shop operator link rule for ${fromType} ${linkType} ${targetType}`);
  }
  return { linkType: rule.linkType, targetType, label: commercialLinkTargetLabel(targetType) };
}

export function shopDetailRelationshipActions(
  entity: SupplierRecord | ContractRecord | SpendItemRecord
): RelationshipManagerAction[] {
  switch (entity.entityType) {
    case "supplier":
      return [
        shopRelationshipAction(entity, "supports", "requirement", "pspf.shop.linkSupplierToRequirement"),
        shopRelationshipAction(entity, "associated-with", "risk", "pspf.shop.linkSupplierToRisk")
      ];
    case "contract":
      return [
        shopRelationshipAction(entity, "supports", "requirement", "pspf.shop.linkContractToRequirement"),
        shopRelationshipAction(entity, "funds", "spend-item", "pspf.shop.linkContractToSpendItem")
      ];
    case "spend-item":
      return [
        shopRelationshipAction(entity, "funds", "contract", "pspf.shop.linkSpendItemToContract"),
        shopRelationshipAction(entity, "supports", "action", "pspf.shop.linkSpendToAction"),
        shopRelationshipAction(entity, "supports", "requirement", "pspf.shop.linkSpendToRequirement")
      ];
  }
}

export function shopRelationshipAction(
  entity: SupplierRecord | ContractRecord | SpendItemRecord,
  linkType: LinkType,
  toType: LinkableTarget["entityType"] | "contract",
  command: string
): RelationshipManagerAction {
  const fromType = toType === "contract" ? "contract" : entity.entityType;
  const targetType = toType === "contract" ? "spend-item" : toType;
  const rule = operatorLinkRuleFor(fromType, linkType, targetType);
  if (!rule) {
    throw new Error(`Missing Shop operator link rule for ${fromType} ${linkType} ${targetType}`);
  }
  return {
    label: rule.label,
    fromLabel: formatToken(rule.fromType),
    phrase: rule.phrase,
    toLabel: formatToken(rule.toType),
    href: commandUri(command, [entity])
  };
}

function commercialLinkTargetLabel(targetType: LinkableTarget["entityType"]): string {
  if (targetType === "spend-item") {
    return "Spend item";
  }
  return targetType.charAt(0).toUpperCase() + targetType.slice(1);
}
