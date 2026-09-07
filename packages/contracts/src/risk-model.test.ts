import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_5X5_METHODOLOGY,
  LEGACY_METHODOLOGY_ID,
  LEGACY_METHODOLOGY_REVISION_ID,
  detectRollUpCycle,
  evaluateRisk,
  resolveAppetite,
  validateControlApplicationAnchors,
  validateFramework,
  validateRollUpEdges,
  withEnvelope,
  type RiskAppetiteRule,
  type RiskAssessment,
  type RiskEntity,
  type RiskFrameworkEntity,
  type RiskMethodology,
  type RiskMethodologyRevision
} from "./index.js";

function sampleRisk(overrides: Partial<RiskEntity> = {}): RiskEntity {
  return withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Sample risk",
      status: "open",
      likelihood: 1,
      impact: 1,
      ...overrides
    },
    "workshop"
  );
}

function frameworkWith(
  methodologies: readonly RiskMethodology[],
  appetiteRules: RiskAppetiteRule[] = []
): RiskFrameworkEntity {
  return withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      categories: [],
      methodologies,
      appetiteRules,
      sourceRegisters: [],
      presentationPresets: []
    },
    "core"
  );
}

function squareMethodology(id: string, size: number): RiskMethodology {
  const likelihoodLevels = Array.from({ length: size }, (_, i) => ({
    id: `L${i + 1}`,
    label: String(i + 1),
    order: i + 1
  }));
  const impactLevels = Array.from({ length: size }, (_, i) => ({
    id: `I${i + 1}`,
    label: String(i + 1),
    order: i + 1
  }));
  const bands = [
    { id: "low", label: "Low", order: 1 },
    { id: "high", label: "High", order: 2 }
  ];
  const cells = likelihoodLevels.flatMap((likelihood) =>
    impactLevels.map((impact) => ({
      likelihoodId: likelihood.id,
      impactId: impact.id,
      bandId: likelihood.order + impact.order > size ? "high" : "low"
    }))
  );
  return {
    id,
    label: id,
    revisions: [
      { revisionId: "r1", activatedAt: "2026-01-01T00:00:00.000Z", likelihoodLevels, impactLevels, cells, bands }
    ]
  };
}

// --- Legacy band boundaries (invariant E5: <5 Low, 5-9 Medium, 10-15 High, >=16 Extreme) -------

test("evaluateRisk: legacy band boundaries match invariant E5", () => {
  const cases: ReadonlyArray<[number, number, string]> = [
    [2, 2, "Low"], // 4
    [1, 5, "Medium"], // 5
    [3, 3, "Medium"], // 9
    [2, 5, "High"], // 10
    [3, 5, "High"], // 15
    [4, 4, "Extreme"] // 16
  ];
  for (const [likelihood, impact, expectedLabel] of cases) {
    const evaluation = evaluateRisk(sampleRisk({ likelihood, impact }));
    assert.equal(evaluation.state, "legacy");
    assert.equal(evaluation.band?.label, expectedLabel, `${likelihood} x ${impact}`);
    assert.equal(evaluation.score, likelihood * impact);
  }
});

test("evaluateRisk: no assessment field reads entity likelihood/impact as legacy (D1.2)", () => {
  const evaluation = evaluateRisk(sampleRisk({ likelihood: 5, impact: 5 }));
  assert.equal(evaluation.state, "legacy");
  assert.equal(evaluation.methodologyRef?.methodologyId, LEGACY_METHODOLOGY_ID);
  assert.equal(evaluation.methodologyRef?.revisionId, LEGACY_METHODOLOGY_REVISION_ID);
});

test("evaluateRisk: unassessed never yields a band or score (D1.4)", () => {
  const risk = sampleRisk({ assessment: { basis: "unassessed" } });
  const evaluation = evaluateRisk(risk);
  assert.equal(evaluation.state, "unassessed");
  assert.equal(evaluation.band, undefined);
  assert.equal(evaluation.score, undefined);
});

test("evaluateRisk: custom assessment with no framework is not-comparable, never a band", () => {
  const assessment: RiskAssessment = {
    basis: "custom",
    methodologyId: "custom-methodology",
    revisionId: "r1",
    current: { likelihoodId: "L1", impactId: "I1" },
    assessedAt: "2026-09-07T00:00:00.000Z"
  };
  const evaluation = evaluateRisk(sampleRisk({ assessment }));
  assert.equal(evaluation.state, "not-comparable");
  assert.equal(evaluation.band, undefined);
  assert.equal(evaluation.score, undefined);
});

test("evaluateRisk: custom assessment resolved against a framework is assessed with a band", () => {
  const methodology = squareMethodology("custom-3x3", 3);
  const framework = frameworkWith([methodology]);
  const assessment: RiskAssessment = {
    basis: "custom",
    methodologyId: "custom-3x3",
    revisionId: "r1",
    current: { likelihoodId: "L3", impactId: "I3" },
    assessedAt: "2026-09-07T00:00:00.000Z"
  };
  const evaluation = evaluateRisk(sampleRisk({ assessment }), framework);
  assert.equal(evaluation.state, "assessed");
  assert.equal(evaluation.band?.id, "high");
});

test("evaluateRisk: custom assessment referencing an unknown cell is not-comparable", () => {
  const methodology = squareMethodology("custom-3x3", 3);
  const framework = frameworkWith([methodology]);
  const assessment: RiskAssessment = {
    basis: "custom",
    methodologyId: "custom-3x3",
    revisionId: "r1",
    current: { likelihoodId: "L9", impactId: "I9" },
    assessedAt: "2026-09-07T00:00:00.000Z"
  };
  const evaluation = evaluateRisk(sampleRisk({ assessment }), framework);
  assert.equal(evaluation.state, "not-comparable");
  assert.equal(evaluation.band, undefined);
});

// --- Matrix validation (2-10 levels, invalid/missing cells rejected) ---------------------------

test("validateFramework: the seeded legacy 5x5 methodology is valid", () => {
  const framework = frameworkWith([LEGACY_5X5_METHODOLOGY]);
  assert.deepEqual(validateFramework(framework), []);
});

test("validateFramework: a publication-sanitised framework shell validates instead of throwing (D2.8)", () => {
  const {
    methodologies: _methodologies,
    categories: _categories,
    appetiteRules: _appetiteRules,
    ...shell
  } = frameworkWith([LEGACY_5X5_METHODOLOGY]);
  const sanitised = shell as RiskFrameworkEntity;
  assert.deepEqual(validateFramework(sanitised), []);
  const evaluation = evaluateRisk(sampleRisk({}), sanitised);
  assert.equal(evaluation.state, "legacy");
  assert.equal(resolveAppetite(sampleRisk({}), sanitised, evaluation, new Date().toISOString()).state, "not-set");
});

test("validateFramework: accepts 3x3 and 2x10 matrices with complete cells", () => {
  const framework3x3 = frameworkWith([squareMethodology("m-3x3", 3)]);
  assert.deepEqual(validateFramework(framework3x3), []);

  const framework2x10 = frameworkWith([
    {
      id: "m-2x10",
      label: "2x10",
      revisions: [
        {
          revisionId: "r1",
          likelihoodLevels: [
            { id: "L1", label: "1", order: 1 },
            { id: "L2", label: "2", order: 2 }
          ],
          impactLevels: Array.from({ length: 10 }, (_, i) => ({ id: `I${i + 1}`, label: String(i + 1), order: i + 1 })),
          cells: [1, 2].flatMap((l) =>
            Array.from({ length: 10 }, (_, i) => ({ likelihoodId: `L${l}`, impactId: `I${i + 1}`, bandId: "low" }))
          ),
          bands: [{ id: "low", label: "Low", order: 1 }]
        }
      ]
    }
  ]);
  assert.deepEqual(validateFramework(framework2x10), []);
});

test("validateFramework: rejects a matrix with a missing cell", () => {
  const methodology = squareMethodology("m-missing-cell", 3);
  const revision = methodology.revisions[0]!;
  const brokenMethodology: RiskMethodology = {
    ...methodology,
    revisions: [{ ...revision, cells: revision.cells.slice(1) }]
  };
  const framework = frameworkWith([brokenMethodology]);
  const issues = validateFramework(framework);
  assert.ok(issues.some((issue) => issue.message.includes("missing cell")));
});

test("validateFramework: rejects a cell referencing an unknown band", () => {
  const methodology = squareMethodology("m-bad-band", 3);
  const revision = methodology.revisions[0]!;
  const brokenRevision: RiskMethodologyRevision = {
    ...revision,
    cells: [{ ...revision.cells[0]!, bandId: "not-a-band" }, ...revision.cells.slice(1)]
  };
  const framework = frameworkWith([{ ...methodology, revisions: [brokenRevision] }]);
  const issues = validateFramework(framework);
  assert.ok(issues.some((issue) => issue.message.includes("unknown band")));
});

test("validateFramework: rejects fewer than 2 or more than 10 levels per axis", () => {
  const tooFew = frameworkWith([squareMethodology("m-too-few", 1)]);
  assert.ok(validateFramework(tooFew).some((issue) => issue.message.includes("between 2 and 10")));

  const tooMany = frameworkWith([squareMethodology("m-too-many", 11)]);
  assert.ok(validateFramework(tooMany).some((issue) => issue.message.includes("between 2 and 10")));
});

// --- Revision immutability (D2.4) ---------------------------------------------------------------

test("validateFramework: an activated revision cannot be modified in place", () => {
  const methodology = squareMethodology("m-immutable", 3);
  const stored = frameworkWith([methodology]);
  const revision = methodology.revisions[0]!;
  const mutated: RiskMethodology = {
    ...methodology,
    revisions: [{ ...revision, cells: [{ ...revision.cells[0]!, bandId: "high" }, ...revision.cells.slice(1)] }]
  };
  const incoming = frameworkWith([mutated]);
  const issues = validateFramework(incoming, stored);
  assert.ok(issues.some((issue) => issue.message.includes("immutable once activated")));
});

test("validateFramework: an unactivated revision may still be edited", () => {
  const methodology = squareMethodology("m-draft", 3);
  const draftRevision: RiskMethodologyRevision = { ...methodology.revisions[0]!, activatedAt: undefined };
  const draftMethodology: RiskMethodology = { ...methodology, revisions: [draftRevision] };
  const stored = frameworkWith([draftMethodology]);
  const edited: RiskMethodology = {
    ...draftMethodology,
    revisions: [
      { ...draftRevision, cells: [{ ...draftRevision.cells[0]!, bandId: "high" }, ...draftRevision.cells.slice(1)] }
    ]
  };
  const incoming = frameworkWith([edited]);
  assert.deepEqual(validateFramework(incoming, stored), []);
});

test("validateFramework: a new revision appended after an activated one is not a mutation", () => {
  const methodology = squareMethodology("m-new-revision", 3);
  const stored = frameworkWith([methodology]);
  const revision = methodology.revisions[0]!;
  const withNewRevision: RiskMethodology = {
    ...methodology,
    revisions: [revision, { ...revision, revisionId: "r2", activatedAt: undefined }]
  };
  const incoming = frameworkWith([withNewRevision]);
  assert.deepEqual(validateFramework(incoming, stored), []);
});

// --- Appetite inheritance, expiry (D2.7) and "not set" ------------------------------------------

function ruleFor(
  scope: RiskAppetiteRule["scope"],
  allowedBandIds: readonly string[],
  reviewBy?: string
): RiskAppetiteRule {
  return {
    id: `rule-${JSON.stringify(scope)}`,
    scope,
    methodologyId: LEGACY_METHODOLOGY_ID,
    revisionId: LEGACY_METHODOLOGY_REVISION_ID,
    allowedBandIds,
    rationale: "Test rationale",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    reviewBy
  };
}

test("resolveAppetite: no framework is 'not set'", () => {
  const risk = sampleRisk({ likelihood: 5, impact: 5 });
  const evaluation = evaluateRisk(risk);
  assert.deepEqual(resolveAppetite(risk, undefined, evaluation, "2026-09-07T00:00:00.000Z"), { state: "not-set" });
});

test("resolveAppetite: no matching rule is 'not set'", () => {
  const risk = sampleRisk({ likelihood: 5, impact: 5 });
  const framework = frameworkWith([LEGACY_5X5_METHODOLOGY], []);
  const evaluation = evaluateRisk(risk);
  assert.deepEqual(resolveAppetite(risk, framework, evaluation, "2026-09-07T00:00:00.000Z"), { state: "not-set" });
});

test("resolveAppetite: the nearest category rule overrides the workspace rule", () => {
  const risk = sampleRisk({ likelihood: 4, impact: 4, primaryCategoryId: "cat_child" });
  const framework = frameworkWith(
    [LEGACY_5X5_METHODOLOGY],
    [
      ruleFor({ kind: "workspace" }, ["low", "medium"]),
      ruleFor({ kind: "category", categoryId: "cat_child" }, ["extreme"])
    ]
  );
  const withCategories: RiskFrameworkEntity = {
    ...framework,
    categories: [{ id: "cat_child", label: "Child", parentId: "cat_parent", order: 1, archived: false }]
  };
  const evaluation = evaluateRisk(risk); // 4 x 4 = 16 -> Extreme
  const resolution = resolveAppetite(risk, withCategories, evaluation, "2026-09-07T00:00:00.000Z");
  assert.equal(resolution.state, "in-appetite");
});

test("resolveAppetite: walks parentId upward when the primary category has no direct rule", () => {
  const risk = sampleRisk({ likelihood: 4, impact: 4, primaryCategoryId: "cat_child" });
  const framework = frameworkWith(
    [LEGACY_5X5_METHODOLOGY],
    [ruleFor({ kind: "category", categoryId: "cat_parent" }, ["extreme"])]
  );
  const withCategories: RiskFrameworkEntity = {
    ...framework,
    categories: [
      { id: "cat_child", label: "Child", parentId: "cat_parent", order: 1, archived: false },
      { id: "cat_parent", label: "Parent", order: 1, archived: false }
    ]
  };
  const evaluation = evaluateRisk(risk);
  const resolution = resolveAppetite(risk, withCategories, evaluation, "2026-09-07T00:00:00.000Z");
  assert.equal(resolution.state, "in-appetite");
});

test("resolveAppetite: an over-appetite band is reported even with an applicable rule", () => {
  const risk = sampleRisk({ likelihood: 1, impact: 1 });
  const framework = frameworkWith([LEGACY_5X5_METHODOLOGY], [ruleFor({ kind: "workspace" }, ["extreme"])]);
  const evaluation = evaluateRisk(risk); // Low
  const resolution = resolveAppetite(risk, framework, evaluation, "2026-09-07T00:00:00.000Z");
  assert.equal(resolution.state, "over-appetite");
});

test("resolveAppetite: D2.7 an expired rule still applies but is flagged stale", () => {
  const risk = sampleRisk({ likelihood: 1, impact: 1 });
  const framework = frameworkWith(
    [LEGACY_5X5_METHODOLOGY],
    [ruleFor({ kind: "workspace" }, ["low"], "2020-01-01T00:00:00.000Z")]
  );
  const evaluation = evaluateRisk(risk);
  const resolution = resolveAppetite(risk, framework, evaluation, "2026-09-07T00:00:00.000Z");
  assert.equal(resolution.state, "in-appetite");
  assert.equal((resolution as { stale: boolean }).stale, true);
});

test("resolveAppetite: a future reviewBy is not stale", () => {
  const risk = sampleRisk({ likelihood: 1, impact: 1 });
  const framework = frameworkWith(
    [LEGACY_5X5_METHODOLOGY],
    [ruleFor({ kind: "workspace" }, ["low"], "2030-01-01T00:00:00.000Z")]
  );
  const evaluation = evaluateRisk(risk);
  const resolution = resolveAppetite(risk, framework, evaluation, "2026-09-07T00:00:00.000Z");
  assert.equal((resolution as { stale: boolean }).stale, false);
});

// --- Roll-up cycle and self-link detection (D3.1/D3.3) ------------------------------------------

test("detectRollUpCycle: a self-link is a cycle", () => {
  const result = detectRollUpCycle([{ fromId: "RSK-1", toId: "RSK-1" }]);
  assert.equal(result.hasCycle, true);
});

test("detectRollUpCycle: an acyclic chain has no cycle", () => {
  const result = detectRollUpCycle([
    { fromId: "RSK-1", toId: "RSK-2" },
    { fromId: "RSK-2", toId: "RSK-3" }
  ]);
  assert.equal(result.hasCycle, false);
});

test("detectRollUpCycle: a longer cycle is detected", () => {
  const result = detectRollUpCycle([
    { fromId: "RSK-1", toId: "RSK-2" },
    { fromId: "RSK-2", toId: "RSK-3" },
    { fromId: "RSK-3", toId: "RSK-1" }
  ]);
  assert.equal(result.hasCycle, true);
});

test("validateRollUpEdges: rejects self-link, dangling endpoints and more than one parent", () => {
  const knownIds = new Set(["RSK-1", "RSK-2"]);
  const issues = validateRollUpEdges(
    [
      { fromId: "RSK-1", toId: "RSK-1" },
      { fromId: "RSK-1", toId: "RSK-2" },
      { fromId: "RSK-2", toId: "RSK-9" }
    ],
    knownIds
  );
  assert.ok(issues.some((issue) => issue.message.includes("cannot roll up to itself")));
  assert.ok(issues.some((issue) => issue.message.includes("at most one rolls-up-to parent")));
  assert.ok(issues.some((issue) => issue.message.includes("does not exist")));
});

test("validateRollUpEdges: a valid chain has no issues", () => {
  const knownIds = new Set(["RSK-1", "RSK-2", "RSK-3"]);
  const issues = validateRollUpEdges(
    [
      { fromId: "RSK-1", toId: "RSK-2" },
      { fromId: "RSK-2", toId: "RSK-3" }
    ],
    knownIds
  );
  assert.deepEqual(issues, []);
});

// --- Control application anchors (D3.6) -----------------------------------------------------------

test("validateControlApplicationAnchors: rejects anchors that do not resolve on the risk", () => {
  const risk = sampleRisk({
    causes: [{ id: "cause_1", label: "Weak access control" }],
    consequences: [{ id: "cons_1", label: "Unauthorised access" }]
  });
  const unresolved = validateControlApplicationAnchors(risk, {
    role: "preventive",
    applicability: "All privileged accounts",
    effectiveness: "not-assessed",
    anchorIds: ["cause_1", "cons_missing"]
  });
  assert.deepEqual(unresolved, ["cons_missing"]);
});

test("validateControlApplicationAnchors: every anchor resolving is valid", () => {
  const risk = sampleRisk({
    causes: [{ id: "cause_1", label: "Weak access control" }],
    consequences: [{ id: "cons_1", label: "Unauthorised access" }]
  });
  const unresolved = validateControlApplicationAnchors(risk, {
    role: "both",
    applicability: "All privileged accounts",
    effectiveness: "effective",
    anchorIds: ["cause_1", "cons_1"]
  });
  assert.deepEqual(unresolved, []);
});
