import assert from "node:assert/strict";
import test from "node:test";

import {
  LINK_TYPES,
  OPERATOR_LINK_RULES,
  V0_1_ENTITY_TYPES,
  operatorLinkRuleFor,
  operatorLinkRuleForEndpoints,
  operatorLinkRulesForSource
} from "./index.js";

test("operator link rules only use canonical link and entity types", () => {
  const linkTypes = new Set(LINK_TYPES);
  const entityTypes = new Set(V0_1_ENTITY_TYPES);

  for (const rule of OPERATOR_LINK_RULES) {
    assert.ok(linkTypes.has(rule.linkType), `${rule.id} should use a canonical link type`);
    assert.ok(entityTypes.has(rule.fromType), `${rule.id} should use a canonical fromType`);
    assert.ok(entityTypes.has(rule.toType), `${rule.id} should use a canonical toType`);
    assert.ok(rule.label.trim().length > 0, `${rule.id} should have an operator label`);
    assert.ok(rule.phrase.trim().length > 0, `${rule.id} should have a relationship phrase`);
  }
});

test("operator link rules have unique endpoint triples", () => {
  const keys = OPERATOR_LINK_RULES.map((rule) => `${rule.fromType}:${rule.linkType}:${rule.toType}`);

  assert.equal(new Set(keys).size, keys.length);
});

test("operator link rules cover current Workshop relationship commands", () => {
  assert.equal(operatorLinkRuleFor("requirement", "supported-by", "evidence")?.sourceProduct, "workshop");
  assert.equal(operatorLinkRuleFor("requirement", "addressed-by", "action")?.sourceProduct, "workshop");
  assert.equal(operatorLinkRuleFor("requirement", "exposed-by", "risk")?.sourceProduct, "workshop");
  assert.equal(operatorLinkRuleFor("direction", "targets", "requirement")?.sourceProduct, "workshop");
  assert.equal(operatorLinkRuleFor("change-record", "changes", "requirement")?.sourceProduct, "workshop");
});

test("operator link rules can resolve the Workshop existing-item link by endpoints", () => {
  assert.equal(operatorLinkRuleForEndpoints("requirement", "evidence", "workshop")?.linkType, "supported-by");
  assert.equal(operatorLinkRuleForEndpoints("requirement", "action", "workshop")?.linkType, "addressed-by");
  assert.equal(operatorLinkRuleForEndpoints("requirement", "risk", "workshop")?.linkType, "exposed-by");
  assert.equal(operatorLinkRuleForEndpoints("direction", "requirement", "workshop")?.linkType, "targets");
});

test("operator link rules cover current Shop relationship commands", () => {
  assert.equal(operatorLinkRuleFor("supplier", "supports", "requirement")?.sourceProduct, "shop");
  assert.equal(operatorLinkRuleFor("supplier", "associated-with", "risk")?.sourceProduct, "shop");
  assert.equal(operatorLinkRuleFor("contract", "supports", "requirement")?.sourceProduct, "shop");
  assert.equal(operatorLinkRuleFor("contract", "funds", "spend-item")?.sourceProduct, "shop");
  assert.equal(operatorLinkRuleFor("spend-item", "supports", "action")?.sourceProduct, "shop");
  assert.equal(operatorLinkRuleFor("spend-item", "supports", "requirement")?.sourceProduct, "shop");
});

test("operator link rules can be grouped by source product for shared UI affordances", () => {
  const workshopRules = operatorLinkRulesForSource("workshop");
  const shopRules = operatorLinkRulesForSource("shop");

  assert.ok(workshopRules.length > 0);
  assert.ok(shopRules.length > 0);
  assert.ok(workshopRules.every((rule) => rule.sourceProduct === "workshop"));
  assert.ok(shopRules.every((rule) => rule.sourceProduct === "shop"));
});
