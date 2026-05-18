import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLICATION_FIELD_POLICIES,
  V0_1_ENTITY_TYPES,
  sanitiseEntityForPublication,
  withEnvelope,
  type RequirementEntity,
  type SpendItemEntity
} from "./index.js";

test("every v0.1 entity type has publication policy metadata", () => {
  const policyTypes = new Set(PUBLICATION_FIELD_POLICIES.map((policy) => policy.entityType));
  assert.deepEqual(policyTypes, new Set(V0_1_ENTITY_TYPES));
});

test("publication sanitiser drops sensitive fields", () => {
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Governance arrangements are established",
      domainId: "DOM-00000000-0000-7000-8000-000000000001",
      assessmentStatus: "in-progress",
      summary: "Operator working note that should not be published by default."
    },
    "workshop"
  );

  const published = sanitiseEntityForPublication(requirement) as RequirementEntity;
  assert.equal(published.title, "Governance arrangements are established");
  assert.equal(published.summary, undefined);
});

test("publication sanitiser fails closed on unknown fields", () => {
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Governance arrangements are established",
      domainId: "DOM-00000000-0000-7000-8000-000000000001",
      assessmentStatus: "in-progress"
    },
    "workshop"
  ) as RequirementEntity & { unexpectedField: string };

  requirement.unexpectedField = "This field has no publication policy.";
  assert.throws(() => sanitiseEntityForPublication(requirement), /Missing publication policy/);
});

test("commercial publication policy excludes sensitive money and restricted supplier contact", () => {
  const spendItem = withEnvelope(
    "spend-item",
    {
      entityType: "spend-item",
      title: "Security monitoring renewal",
      spendType: "opex",
      status: "proposed",
      amount: { amount: 240000, currency: "AUD" },
      financialYear: "2026-27",
      expectedSavings: { amount: 15000, currency: "AUD" },
      assumptions: "Commercial assumptions should not publish.",
      confidence: "medium"
    },
    "shop"
  );

  const published = sanitiseEntityForPublication(spendItem) as SpendItemEntity;
  assert.equal(published.title, "Security monitoring renewal");
  assert.equal(published.amount, undefined);
  assert.equal(published.expectedSavings, undefined);
  assert.equal(published.assumptions, undefined);

  const supplier = withEnvelope(
    "supplier",
    {
      entityType: "supplier",
      name: "Secure Cloud Services",
      supplierType: "managed-service",
      status: "active",
      criticality: "high",
      primaryContact: "Named commercial contact"
    },
    "shop"
  );
  const publishedSupplier = sanitiseEntityForPublication(supplier);
  assert.equal("primaryContact" in publishedSupplier, false);
});