import test from "node:test";
import assert from "node:assert/strict";
import {
  PSPF_DOMAINS,
  VERSION_AXES,
  type ActionEntity,
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
  buildExposureSummary,
  buildStrategyDeliverySummary,
  buildStrategyPrioritySummary,
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

test("human-centred risk matrix counts risks by impact and likelihood", () => {
  const entities: V01Entity[] = [
    risk({ id: "RSK-1", title: "Low exposure", likelihood: 1, impact: 1, status: "open" }),
    risk({ id: "RSK-2", title: "Medium exposure", likelihood: 4, impact: 2, status: "open" }),
    risk({ id: "RSK-3", title: "High exposure", likelihood: 5, impact: 4, status: "open" })
  ];
  const model = buildHumanCentredRiskModel(entities, { now: NOW });

  assert.equal(model.riskMatrix.length, 25);
  assert.deepEqual(
    model.riskMatrix.find((cell) => cell.likelihood === 1 && cell.impact === 1),
    { likelihood: 1, impact: 1, riskCount: 1, band: "green" }
  );
  assert.deepEqual(
    model.riskMatrix.find((cell) => cell.likelihood === 4 && cell.impact === 2),
    { likelihood: 4, impact: 2, riskCount: 1, band: "amber" }
  );
  assert.deepEqual(
    model.riskMatrix.find((cell) => cell.likelihood === 5 && cell.impact === 4),
    { likelihood: 5, impact: 4, riskCount: 1, band: "red" }
  );
});

test("strategy priority reports no priority before risks are linked", () => {
  const summary = buildStrategyPrioritySummary(
    strategy({
      capabilityArea: "Identity and access",
      executiveOwner: "Identity Team",
      outcomeId: "OUT-1",
      outcomeStatement: "Trusted access to critical services"
    }).choices[0]!,
    new Map()
  );

  assert.equal(summary.band, "none");
  assert.equal(summary.score, 0);
  assert.match(summary.rationale, /No linked risks yet/);
});

test("strategy priority weights linked risk severity with choice trend and confidence", () => {
  const highRisk = risk({ id: "RSK-1", title: "Legacy identity exposure", likelihood: 5, impact: 4, status: "open" });
  const choice = strategy({
    capabilityArea: "Identity and access",
    executiveOwner: "Identity Team",
    outcomeId: "OUT-1",
    outcomeStatement: "Trusted access to critical services",
    riskRefId: "RSK-1",
    trend: "deteriorating",
    confidence: "low"
  }).choices[0]!;
  const summary = buildStrategyPrioritySummary(choice, new Map([[highRisk.id, highRisk]]));

  assert.equal(summary.band, "critical");
  assert.equal(summary.score, 28);
  assert.equal(summary.highRiskCount, 1);
  assert.equal(summary.topRisks[0]?.adjustedScore, 28);
  assert.match(summary.rationale, /Critical priority/);
});

test("strategy priority bands follow fixed adjusted-score thresholds", () => {
  const cases: Array<{
    readonly name: string;
    readonly likelihood: number;
    readonly impact: number;
    readonly trend: StrategyEntity["choices"][number]["trend"];
    readonly confidence: StrategyEntity["choices"][number]["confidence"];
    readonly expectedScore: number;
    readonly expectedBand: "critical" | "high" | "medium" | "low";
  }> = [
    {
      name: "low lower edge",
      likelihood: 1,
      impact: 1,
      trend: "improving",
      confidence: "high",
      expectedScore: 1,
      expectedBand: "low"
    },
    {
      name: "below medium",
      likelihood: 4,
      impact: 2,
      trend: "improving",
      confidence: "medium",
      expectedScore: 9,
      expectedBand: "low"
    },
    {
      name: "medium lower edge",
      likelihood: 3,
      impact: 3,
      trend: "improving",
      confidence: "medium",
      expectedScore: 10,
      expectedBand: "medium"
    },
    {
      name: "below high",
      likelihood: 4,
      impact: 4,
      trend: "steady",
      confidence: "medium",
      expectedScore: 19,
      expectedBand: "medium"
    },
    {
      name: "high lower edge",
      likelihood: 5,
      impact: 4,
      trend: "improving",
      confidence: "high",
      expectedScore: 20,
      expectedBand: "high"
    },
    {
      name: "below critical",
      likelihood: 5,
      impact: 5,
      trend: "steady",
      confidence: "high",
      expectedScore: 27,
      expectedBand: "high"
    },
    {
      name: "critical lower edge",
      likelihood: 5,
      impact: 4,
      trend: "deteriorating",
      confidence: "low",
      expectedScore: 28,
      expectedBand: "critical"
    }
  ];

  for (const entry of cases) {
    const linkedRisk = risk({
      id: `RSK-${entry.expectedScore}`,
      title: entry.name,
      likelihood: entry.likelihood,
      impact: entry.impact,
      status: "open"
    });
    const choice = strategy({
      capabilityArea: "Identity and access",
      executiveOwner: "Identity Team",
      outcomeId: "OUT-1",
      outcomeStatement: "Trusted access to critical services",
      riskRefId: linkedRisk.id,
      trend: entry.trend,
      confidence: entry.confidence
    }).choices[0]!;
    const summary = buildStrategyPrioritySummary(choice, new Map([[linkedRisk.id, linkedRisk]]));

    assert.equal(summary.score, entry.expectedScore, entry.name);
    assert.equal(summary.band, entry.expectedBand, entry.name);
  }
});

test("strategy priority deduplicates direct risk and action references", () => {
  const linkedRisk = risk({ id: "RSK-1", title: "Identity exposure", likelihood: 4, impact: 4, status: "open" });
  const choice = strategy({
    capabilityArea: "Identity and access",
    executiveOwner: "Identity Team",
    outcomeId: "OUT-1",
    outcomeStatement: "Trusted access to critical services",
    riskRefId: "RSK-1",
    actionRefId: "ACT-1"
  }).choices[0]!;
  const duplicatedChoice = {
    ...choice,
    references: [
      ...choice.references,
      { entityType: "risk", entityId: "RSK-1", role: "blocked-by" },
      { entityType: "action", entityId: "ACT-1", role: "addresses" }
    ]
  } satisfies StrategyEntity["choices"][number];
  const summary = buildStrategyPrioritySummary(duplicatedChoice, new Map([[linkedRisk.id, linkedRisk]]));

  assert.equal(summary.topRisks.length, 1);
  assert.equal(summary.linkedActionCount, 1);
});

test("strategy delivery classifies blocked, candidate and completed work", () => {
  const choice = strategy({
    capabilityArea: "Identity and access",
    executiveOwner: "Identity Team",
    outcomeId: "OUT-1",
    outcomeStatement: "Trusted access to critical services",
    actionRefId: "ACT-1"
  }).choices[0]!;
  const candidate = strategy({
    capabilityArea: "Identity and access",
    executiveOwner: "Identity Team",
    outcomeId: "OUT-2",
    outcomeStatement: "Trusted access to critical services",
    actionRefId: "ACT-2"
  }).choices[0]!;
  const action = actionEntity("ACT-1", "blocked");
  const candidateAction = actionEntity("ACT-2", "todo");

  assert.equal(buildStrategyDeliverySummary(choice, new Map([[action.id, action]])).state, "delivery-at-risk");
  assert.equal(
    buildStrategyDeliverySummary(candidate, new Map([[candidateAction.id, candidateAction]])).state,
    "candidate-work"
  );
  assert.equal(buildStrategyDeliverySummary(choice, new Map()).state, "no-delivery-path");
});

test("exposure summary selects the worst explainable component", () => {
  const requirements = [
    requirement({ id: "REQ-1", assessmentStatus: "met" }),
    requirement({ id: "REQ-2", assessmentStatus: "not-met" }),
    requirement({ id: "REQ-3", assessmentStatus: "met" })
  ];
  const summary = buildExposureSummary([
    ...requirements,
    risk({ id: "RSK-1", title: "Material risk", likelihood: 4, impact: 4, status: "open" })
  ]);

  assert.equal(summary.band, "extreme");
  assert.equal(summary.primaryDriver.id, "material-risks");
  assert.match(summary.bandLabel, /Extreme/);
});

test("strategy priority excludes unresolved risks but keeps repair cue", () => {
  const choice = strategy({
    capabilityArea: "Identity and access",
    executiveOwner: "Identity Team",
    outcomeId: "OUT-1",
    outcomeStatement: "Trusted access to critical services",
    riskRefId: "RSK-MISSING"
  }).choices[0]!;
  const summary = buildStrategyPrioritySummary(choice, new Map());

  assert.equal(summary.band, "none");
  assert.equal(summary.unresolvedRiskReferenceCount, 1);
  assert.match(summary.rationale, /unresolved risk reference/);
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

function actionEntity(id: string, status: "todo" | "blocked" | "done"): ActionEntity {
  return {
    ...envelope(id, "action"),
    entityType: "action",
    title: `Action ${id}`,
    status,
    dueDate: "2026-06-30T00:00:00.000Z"
  };
}

function strategy(input: {
  readonly capabilityArea: string;
  readonly executiveOwner?: string;
  readonly outcomeId: string;
  readonly outcomeStatement: string;
  readonly riskRefId?: string;
  readonly actionRefId?: string;
  readonly trend?: StrategyEntity["choices"][number]["trend"];
  readonly confidence?: StrategyEntity["choices"][number]["confidence"];
}): StrategyEntity {
  const references: StrategyEntity["choices"][number]["outcomes"][number]["references"] = [
    ...(input.riskRefId ? ([{ entityType: "risk", entityId: input.riskRefId, role: "blocked-by" }] as const) : []),
    ...(input.actionRefId ? ([{ entityType: "action", entityId: input.actionRefId, role: "addresses" }] as const) : [])
  ];
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
        trend: input.trend ?? "improving",
        confidence: input.confidence ?? "medium",
        references: [],
        outcomes: [
          {
            id: input.outcomeId,
            statement: input.outcomeStatement,
            summary: "",
            measures: [],
            references
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
