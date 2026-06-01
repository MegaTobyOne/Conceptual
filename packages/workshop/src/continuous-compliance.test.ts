import test from "node:test";
import assert from "node:assert/strict";
import {
  PSPF_DOMAINS,
  VERSION_AXES,
  type LinkEntity,
  type RequirementEntity,
  type RiskEntity,
  type StrategyEntity,
  type V01Entity
} from "@pspf/contracts";
import {
  assuranceBandForPercentage,
  buildContinuousComplianceMetroModel,
  buildCyberAwarenessChangeStrategyModel,
  buildHumanCentredRiskModel,
  buildPspfGridModel,
  buildUnifiedSecurityOperatingModel,
  riskSeverityForScore
} from "./continuous-compliance.js";

const TECHNOLOGY_DOMAIN_ID = PSPF_DOMAINS.find((domain) => domain.code === "technology")!.id;
const NOW = new Date("2026-05-20T00:00:00.000Z");

test("assurance bands follow fixed met-percentage thresholds", () => {
  assert.equal(assuranceBandForPercentage(100).id, "established");
  assert.equal(assuranceBandForPercentage(80).id, "established");
  assert.equal(assuranceBandForPercentage(60).id, "progressing");
  assert.equal(assuranceBandForPercentage(30).id, "emerging");
  assert.equal(assuranceBandForPercentage(5).id, "early");
  assert.equal(assuranceBandForPercentage(0).id, "not-started");
});

test("risk severity uses fixed likelihood x impact bands", () => {
  assert.equal(riskSeverityForScore(20).id, "high");
  assert.equal(riskSeverityForScore(15).id, "high");
  assert.equal(riskSeverityForScore(8).id, "medium");
  assert.equal(riskSeverityForScore(4).id, "low");
});

test("PSPF grid view excludes not-applicable requirements from met percentage", () => {
  const entities: V01Entity[] = [
    requirement({ id: "REQ-1", assessmentStatus: "met" }),
    requirement({ id: "REQ-2", assessmentStatus: "not-met" }),
    requirement({ id: "REQ-3", assessmentStatus: "not-applicable" })
  ];
  const model = buildPspfGridModel(entities, { now: NOW });

  assert.equal(model.applicable, 2);
  assert.equal(model.met, 1);
  assert.equal(model.overallMetPercentage, 50);
});

test("human-centred risk view groups risks under the business outcome that references them", () => {
  const entities: V01Entity[] = [
    risk({ id: "RSK-1", title: "Legacy identity exposure", likelihood: 5, impact: 4, status: "open" }),
    strategy({
      capabilityArea: "Identity and access",
      executiveOwner: "Identity Team",
      outcomeId: "OUT-1",
      outcomeStatement: "Trusted access to critical services",
      riskRefId: "RSK-1"
    })
  ];
  const model = buildHumanCentredRiskModel(entities, { now: NOW });

  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0]?.outcomeStatement, "Trusted access to critical services");
  assert.equal(model.groups[0]?.risks[0]?.riskId, "RSK-1");
  assert.equal(model.groups[0]?.risks[0]?.severityId, "high");
  assert.equal(model.unassigned.length, 0);
  assert.equal(model.counts.total, 1);
});

test("human-centred risk view lists risks with no outcome under unassigned", () => {
  const entities: V01Entity[] = [risk({ id: "RSK-9", title: "Orphan risk", likelihood: 1, impact: 1, status: "open" })];
  const model = buildHumanCentredRiskModel(entities, { now: NOW });

  assert.equal(model.groups.length, 0);
  assert.equal(model.unassigned.length, 1);
  assert.equal(model.unassigned[0]?.treatmentLabel, "No treatment yet");
});

test("metro map collapses duplicate capability areas and counts stations", () => {
  const entities: V01Entity[] = [
    strategy({
      capabilityArea: "Network security",
      executiveOwner: "Network Team",
      outcomeId: "OUT-2",
      outcomeStatement: "Segmented and monitored network"
    })
  ];
  const model = buildContinuousComplianceMetroModel(entities, { now: NOW });

  assert.equal(model.hub, "GRC and security management");
  assert.equal(model.totalCapabilities, 1);
  assert.equal(model.totalStations, 1);
  assert.equal(model.lines[0]?.capabilityArea, "Network security");
});

test("operating model maps capability areas to fixed functions and surfaces gaps", () => {
  const entities: V01Entity[] = [
    strategy({
      capabilityArea: "Identity and access management",
      executiveOwner: "Identity Team",
      outcomeId: "OUT-3",
      outcomeStatement: "Least privilege everywhere"
    })
  ];
  const model = buildUnifiedSecurityOperatingModel(entities, { now: NOW });

  assert.equal(model.teams.length, 1);
  assert.equal(model.teams[0]?.name, "Identity Team");
  const identity = model.coverage.find((item) => item.functionId === "identity-access");
  assert.equal(identity?.covered, true);
  assert.equal(model.gapFunctions, model.coverage.length - model.coveredFunctions);
  assert.ok(model.gapFunctions > 0);
});

test("change strategy weaves the live met percentage into the leadership message", () => {
  const entities: V01Entity[] = [
    requirement({ id: "REQ-1", assessmentStatus: "met" }),
    requirement({ id: "REQ-2", assessmentStatus: "not-met" })
  ];
  const model = buildCyberAwarenessChangeStrategyModel(entities, { now: NOW });

  assert.equal(model.metPercentage, 50);
  const leadership = model.messageBlocks.find((block) => block.id === "leadership-update");
  assert.match(leadership?.message ?? "", /50%/);
});

function envelope(
  id: string,
  entityType: V01Entity["entityType"]
): {
  readonly id: string;
  readonly schemaVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sourceProduct: "workshop";
  readonly recordStatus: "active";
  readonly entityType: V01Entity["entityType"];
} {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    sourceProduct: "workshop",
    recordStatus: "active"
  };
}

function requirement(input: {
  readonly id: string;
  readonly assessmentStatus: RequirementEntity["assessmentStatus"];
}): RequirementEntity {
  return {
    ...envelope(input.id, "requirement"),
    entityType: "requirement",
    title: `Requirement ${input.id}`,
    domainId: TECHNOLOGY_DOMAIN_ID,
    assessmentStatus: input.assessmentStatus
  };
}

function risk(input: {
  readonly id: string;
  readonly title: string;
  readonly likelihood: number;
  readonly impact: number;
  readonly status: RiskEntity["status"];
}): RiskEntity {
  return {
    ...envelope(input.id, "risk"),
    entityType: "risk",
    title: input.title,
    status: input.status,
    likelihood: input.likelihood,
    impact: input.impact
  };
}

function strategy(input: {
  readonly capabilityArea: string;
  readonly executiveOwner?: string;
  readonly outcomeId: string;
  readonly outcomeStatement: string;
  readonly riskRefId?: string;
}): StrategyEntity {
  return {
    ...envelope("STR-1", "strategy"),
    entityType: "strategy",
    title: "Cyber strategy",
    scope: "Whole of entity",
    timeHorizon: "FY2026",
    strategyStatement: "Protect critical services",
    riskPostureStatement: "Reduce material risk",
    frameworks: [],
    reviewCadence: "quarterly",
    choices: [
      {
        id: "CHO-1",
        statement: `Invest in ${input.capabilityArea}`,
        summary: "",
        capabilityArea: input.capabilityArea,
        targetPosture: "Managed",
        executiveOwner: input.executiveOwner,
        trend: "improving",
        confidence: "medium",
        references: [],
        outcomes: [
          {
            id: input.outcomeId,
            statement: input.outcomeStatement,
            summary: "",
            measures: [],
            references: input.riskRefId ? [{ entityType: "risk", entityId: input.riskRefId, role: "addresses" }] : []
          }
        ]
      }
    ]
  };
}

function link(input: Pick<LinkEntity, "id" | "fromId" | "fromType" | "toId" | "toType">): LinkEntity {
  return {
    ...envelope(input.id, "link"),
    entityType: "link",
    title: input.id,
    linkType: "associated-with",
    fromId: input.fromId,
    fromType: input.fromType,
    toId: input.toId,
    toType: input.toType
  };
}

void link;
