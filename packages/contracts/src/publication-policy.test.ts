import assert from "node:assert/strict";
import test from "node:test";
import {
  DISALLOWED_PUBLICATION_FIELDS,
  PUBLICATION_FIELD_POLICIES,
  type StrategyEntity,
  V0_1_ENTITY_TYPES,
  sanitiseEntityForPublication,
  withEnvelope,
  type RequirementEntity,
  type SpendItemEntity,
  type SourceControlEntity
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
  const publishedSupplier = sanitiseEntityForPublication(supplier) as typeof supplier;
  assert.equal("primaryContact" in publishedSupplier, false);
  assert.equal(publishedSupplier.id, supplier.id);
  assert.equal(publishedSupplier.supplierType, "managed-service");
});

test("publication sanitiser excludes nested strategy detail that is not public", () => {
  const strategy = withEnvelope(
    "strategy",
    {
      entityType: "strategy",
      title: "Cybersecurity Strategy",
      scope: "Enterprise",
      timeHorizon: "2026-2028",
      effectiveAt: "2026-07-01T00:00:00.000Z",
      owner: "CISO",
      strategyStatement: "Focus cyber uplift on governance cadence and encryption assurance.",
      riskPostureStatement: "Improve assurance confidence while reducing unmanaged cyber exposure.",
      frameworks: ["PSPF", "Essential Eight"],
      reviewCadence: "quarterly",
      executiveSummary: "Cyber priorities connect assurance work to measurable posture movement.",
      assumptions: "Sensitive strategy assumption that should not publish.",
      choices: [
        {
          id: "choice-governance-cadence",
          statement: "Strengthen governance cadence as the strategic control point for assurance.",
          summary: "Quarterly evidence review keeps PSPF reporting decisions current.",
          capabilityArea: "Governance and assurance",
          targetPosture: "Quarterly evidence review operating with current governance artefacts by 2026-12-31.",
          executiveOwner: "CISO",
          trend: "improving",
          confidence: "medium",
          rationale: "Sensitive strategy rationale that should not publish.",
          constraints: "Sensitive strategy constraint that should not publish.",
          references: [{ entityType: "requirement", entityId: "REQ-1", role: "drives" }],
          outcomes: [
            {
              id: "outcome-governance-evidence-current",
              statement: "Governance evidence remains current for executive assurance decisions.",
              summary: "Evidence review cadence is visible and linked to assurance work.",
              references: [{ entityType: "requirement", entityId: "REQ-1", role: "evidenced-by" }],
              measures: [
                {
                  id: "measure-governance-review-cadence",
                  title: "Governance review cadence",
                  measureClass: "governance-assurance",
                  baseline: "Ad hoc",
                  current: "Quarterly review scheduled",
                  target: "Quarterly review complete",
                  unit: "cadence",
                  trend: "improving",
                  confidence: "medium",
                  reviewCadence: "quarterly"
                }
              ]
            }
          ]
        }
      ]
    },
    "workshop"
  );

  const published = sanitiseEntityForPublication(strategy) as StrategyEntity;
  assert.equal(published.owner, undefined);
  assert.equal(published.assumptions, undefined);
  assert.deepEqual(published.choices, [
    {
      id: "choice-governance-cadence",
      statement: "Strengthen governance cadence as the strategic control point for assurance.",
      summary: "Quarterly evidence review keeps PSPF reporting decisions current.",
      capabilityArea: "Governance and assurance",
      targetPosture: "Quarterly evidence review operating with current governance artefacts by 2026-12-31.",
      trend: "improving",
      confidence: "medium",
      references: [{ entityType: "requirement", entityId: "REQ-1", role: "drives" }],
      outcomes: [
        {
          id: "outcome-governance-evidence-current",
          statement: "Governance evidence remains current for executive assurance decisions.",
          summary: "Evidence review cadence is visible and linked to assurance work.",
          references: [{ entityType: "requirement", entityId: "REQ-1", role: "evidenced-by" }]
        }
      ]
    }
  ]);
});

test("disallowed publication fields include every restricted field path", () => {
  assert.ok(DISALLOWED_PUBLICATION_FIELDS.includes("change-record.decisionOwnerRef"));
  assert.ok(DISALLOWED_PUBLICATION_FIELDS.includes("supplier.primaryContact"));
  assert.ok(DISALLOWED_PUBLICATION_FIELDS.includes("person.name"));
  assert.ok(DISALLOWED_PUBLICATION_FIELDS.includes("assignment.personId"));
});

test("source-control implementation posture is internal and stripped at publication", () => {
  const policy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === "source-control");
  assert.ok(policy, "source-control publication policy is present");
  const fieldPolicy = policy.fields.find((entry) => entry.field === "implementationStatus");
  assert.ok(fieldPolicy, "implementationStatus has a declared publication policy");
  assert.equal(fieldPolicy.publication, "internal");

  const sourceControl = withEnvelope(
    "source-control",
    {
      entityType: "source-control",
      title: "Application control",
      controlId: "ISM-0843",
      statement: "Application control is implemented on workstations.",
      profileTags: ["Essential Eight"],
      statementChangeStatus: "unchanged",
      externalRefs: [],
      provenance: {
        oscalRelease: "2024-03",
        catalog: "ISM",
        profile: null,
        sourceUrl: "https://www.cyber.gov.au/ism"
      },
      implementationStatus: "partial"
    },
    "workshop"
  ) as SourceControlEntity;

  const published = sanitiseEntityForPublication(sourceControl) as SourceControlEntity;
  assert.equal(published.controlId, "ISM-0843");
  assert.equal(published.implementationStatus, undefined);
});
