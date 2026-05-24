import assert from "node:assert/strict";
import test from "node:test";
import { VERSION_AXES, type SupplierEntity } from "@pspf/contracts";
import { commercialLinkSpec, shopDetailRelationshipActions } from "./relationship-rules.js";

test("Shop commercial link specs resolve through canonical operator rules", () => {
  assert.deepEqual(
    [
      commercialLinkSpec("supplier", "supports", "requirement"),
      commercialLinkSpec("supplier", "associated-with", "risk"),
      commercialLinkSpec("contract", "supports", "requirement"),
      commercialLinkSpec("contract", "funds", "spend-item"),
      commercialLinkSpec("spend-item", "supports", "action"),
      commercialLinkSpec("spend-item", "supports", "requirement")
    ],
    [
      { linkType: "supports", targetType: "requirement", label: "Requirement" },
      { linkType: "associated-with", targetType: "risk", label: "Risk" },
      { linkType: "supports", targetType: "requirement", label: "Requirement" },
      { linkType: "funds", targetType: "spend-item", label: "Spend item" },
      { linkType: "supports", targetType: "action", label: "Action" },
      { linkType: "supports", targetType: "requirement", label: "Requirement" }
    ]
  );
});

test("Shop detail relationship actions use shared manager labels and commands", () => {
  const supplier: SupplierEntity = {
    id: "SUP-00000000-0000-4000-8000-000000000001",
    entityType: "supplier",
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    sourceProduct: "shop",
    recordStatus: "active",
    name: "Secure Cloud Services",
    supplierType: "managed-service",
    status: "active",
    criticality: "high"
  };

  const actions = shopDetailRelationshipActions(supplier);
  assert.deepEqual(
    actions.map((action) => [action.label, action.fromLabel, action.phrase, action.toLabel]),
    [
      ["Link Supplier to Requirement", "Supplier", "supports", "Requirement"],
      ["Link Supplier to Risk", "Supplier", "associated with", "Risk"]
    ]
  );
  assert.equal(actions[0]?.href?.startsWith("command:pspf.shop.linkSupplierToRequirement?"), true);
  assert.equal(actions[1]?.href?.startsWith("command:pspf.shop.linkSupplierToRisk?"), true);
});
