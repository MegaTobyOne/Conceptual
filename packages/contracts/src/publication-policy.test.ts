import assert from "node:assert/strict";
import test from "node:test";
import {
  DISALLOWED_PUBLICATION_FIELDS,
  PUBLICATION_FIELD_POLICIES,
  type LinkEntity,
  type RiskControlEntity,
  type RiskEntity,
  type RiskEventEntity,
  type RiskFrameworkEntity,
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

test("link evidence notes are sensitive by default", () => {
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "Evidence supports Requirement",
      linkType: "supported-by",
      fromId: "REQ-1",
      fromType: "requirement",
      toId: "EVD-1",
      toType: "evidence",
      evidenceNote: "Internal explanation of why this evidence is relevant.",
      evidenceSection: "Chapter 4.2"
    },
    "workshop"
  );

  const published = sanitiseEntityForPublication(link) as LinkEntity;
  assert.equal(published.evidenceNote, undefined);
  assert.equal(published.evidenceSection, undefined);
  assert.equal(published.linkType, "supported-by");
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
      billingCadence: "annual",
      expectedSavings: { amount: 15000, currency: "AUD" },
      assumptions: "Commercial assumptions should not publish.",
      confidence: "medium"
    },
    "shop"
  );

  const published = sanitiseEntityForPublication(spendItem) as SpendItemEntity;
  assert.equal(published.title, "Security monitoring renewal");
  assert.equal(published.amount, undefined);
  assert.equal(published.billingCadence, undefined);
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

// Phase 1A (ADR 0098): Risk overhaul publication policy.
test("Risk overhaul entity types have declared publication policies", () => {
  for (const entityType of ["risk-framework", "risk-control", "risk-event"] as const) {
    assert.ok(
      PUBLICATION_FIELD_POLICIES.some((entry) => entry.entityType === entityType),
      `${entityType} should have a publication policy`
    );
  }
});

test("publication sanitiser strips every new sensitive Risk field but keeps assessmentState and primaryCategoryId", () => {
  const risk = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Third-party access is not reviewed",
      status: "open",
      likelihood: 4,
      impact: 4,
      reference: "OPERATOR-REF-001",
      description: "Internal working note that should not be published.",
      causes: [{ id: "cause_1", label: "Weak access control" }],
      consequences: [{ id: "cons_1", label: "Unauthorised access" }],
      primaryCategoryId: "cat_supplier-risk",
      ownerTeam: "Security Operations",
      reviewBy: "2027-01-01T00:00:00.000Z",
      assessment: { basis: "unassessed" },
      assessmentState: "unassessed",
      response: "reduce",
      externalRefs: [
        {
          sourceRegisterId: "6clicks",
          externalId: "EXT-1",
          externalRating: "High",
          sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
          reconciledAt: "2026-08-02T00:00:00.000Z"
        }
      ]
    },
    "workshop"
  ) as RiskEntity;

  const published = sanitiseEntityForPublication(risk) as RiskEntity;
  assert.equal(published.title, "Third-party access is not reviewed");
  assert.equal(published.likelihood, 4);
  assert.equal(published.impact, 4);
  assert.equal(published.primaryCategoryId, "cat_supplier-risk");
  assert.equal(published.assessmentState, "unassessed");
  assert.equal(published.reference, undefined);
  assert.equal(published.description, undefined);
  assert.equal(published.causes, undefined);
  assert.equal(published.consequences, undefined);
  assert.equal(published.ownerTeam, undefined);
  assert.equal(published.reviewBy, undefined);
  assert.equal(published.assessment, undefined);
  assert.equal(published.response, undefined);
  assert.equal(published.externalRefs, undefined);
});

test("publication sanitiser strips linkRole-carrying and control-application link metadata", () => {
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "Risk relates to enterprise Risk",
      linkType: "related-to",
      fromId: "RSK-1",
      fromType: "risk",
      toId: "RSK-2",
      toType: "risk",
      linkRole: "secondary-enterprise-association"
    },
    "workshop"
  );

  const published = sanitiseEntityForPublication(link) as LinkEntity;
  assert.equal(published.linkRole, "secondary-enterprise-association");

  const mitigatedByLink = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "Risk mitigated by Risk Control",
      linkType: "mitigated-by",
      fromId: "RSK-1",
      fromType: "risk",
      toId: "RCT-1",
      toType: "risk-control",
      application: {
        role: "preventive",
        applicability: "All privileged accounts",
        effectiveness: "effective",
        rationale: "Internal rationale that should not publish.",
        anchorIds: ["cause_1"]
      }
    },
    "workshop"
  );

  const publishedApplication = sanitiseEntityForPublication(mitigatedByLink) as LinkEntity;
  assert.equal(publishedApplication.application, undefined);
});

test("Risk overhaul entities round-trip through the sanitiser with only structural fields public", () => {
  const framework = withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      title: "Workspace risk framework",
      categories: [{ id: "cat_1", label: "Cyber", order: 1, archived: false }],
      methodologies: [],
      appetiteRules: [],
      sourceRegisters: [],
      presentationPresets: []
    },
    "core"
  ) as RiskFrameworkEntity;
  const publishedFramework = sanitiseEntityForPublication(framework) as RiskFrameworkEntity;
  assert.equal(publishedFramework.categories, undefined);
  assert.equal(publishedFramework.id, framework.id);

  const control = withEnvelope(
    "risk-control",
    {
      entityType: "risk-control",
      title: "MFA enforcement for privileged access",
      definition: "All privileged accounts require MFA.",
      ownerTeam: "Identity Team",
      state: "active"
    },
    "workshop"
  ) as RiskControlEntity;
  const publishedControl = sanitiseEntityForPublication(control) as RiskControlEntity;
  assert.equal(publishedControl.definition, undefined);
  assert.equal(publishedControl.title, undefined);

  const event = withEnvelope(
    "risk-event",
    {
      entityType: "risk-event",
      riskId: "RSK-1",
      kind: "escalation",
      occurredAt: "2026-09-07T00:00:00.000Z",
      summary: "Escalated to enterprise risk committee."
    },
    "core"
  ) as RiskEventEntity;
  const publishedEvent = sanitiseEntityForPublication(event) as RiskEventEntity;
  assert.equal(publishedEvent.summary, undefined);
  assert.equal(publishedEvent.riskId, undefined);
});
