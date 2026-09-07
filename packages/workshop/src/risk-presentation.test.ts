import test from "node:test";
import assert from "node:assert/strict";
import {
  withEnvelope,
  type ActionEntity,
  type LinkEntity,
  type RiskEntity,
  type RiskEventEntity,
  type RiskFrameworkEntity
} from "@pspf/contracts";
import {
  RISK_OUTPUT_BUILT_IN_PRESETS,
  buildRiskOutputModel,
  defaultRiskOutputPresetId,
  findRiskOutputPreset,
  renderRiskOutputMarkdown,
  renderRiskOutputPlainText,
  renderRiskOutputPrintHtml,
  resolveRiskOutputPresets,
  type RiskOutputContext,
  type RiskOutputView
} from "./risk-presentation.js";

const NOW = "2026-09-07T00:00:00.000Z";

function risk(title: string, overrides: Partial<RiskEntity> = {}): RiskEntity {
  return withEnvelope(
    "risk",
    { entityType: "risk", title, status: "open", likelihood: 3, impact: 3, ...overrides },
    "workshop"
  ) as RiskEntity;
}

function emptyContext(overrides: Partial<RiskOutputContext> = {}): RiskOutputContext {
  return {
    risks: [],
    framework: undefined,
    links: [],
    actions: [],
    controls: [],
    riskEvents: [],
    now: NOW,
    ...overrides
  };
}

function contextFor(risks: readonly RiskEntity[], overrides: Partial<RiskOutputContext> = {}): RiskOutputContext {
  return emptyContext({ risks, ...overrides });
}

test("official preset includes only baseline fields; classification is OFFICIAL", () => {
  const target = risk("Governance review evidence may become stale", {
    reference: "REG-4021",
    ownerTeam: "Platform Engineering",
    reviewBy: "2027-01-01"
  });
  const context = contextFor([target]);
  const preset = findRiskOutputPreset("register", defaultRiskOutputPresetId("register"), undefined);
  const model = buildRiskOutputModel("register", context, preset);
  assert.equal(model.classification, "OFFICIAL");
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0]!.title, target.title);
  assert.equal(model.rows[0]!.fields.length, 0);
  const plainText = renderRiskOutputPlainText(model);
  assert.match(plainText, /OFFICIAL$/m);
  assert.ok(!plainText.includes("REG-4021"));
  assert.ok(!plainText.includes("Platform Engineering"));
});

test("official-sensitive preset opts sensitive fields in by name and escalates classification", () => {
  const target = risk("Supplier resilience gap", {
    reference: "REG-9001",
    ownerTeam: "Commercial Team",
    response: "reduce"
  });
  const context = contextFor([target]);
  const preset = findRiskOutputPreset("register", "register-official-sensitive", undefined);
  const model = buildRiskOutputModel("register", context, preset);
  assert.equal(model.classification, "OFFICIAL: Sensitive");
  const fieldNames = model.rows[0]!.fields.map((field) => field.name);
  assert.ok(fieldNames.includes("reference"));
  assert.ok(fieldNames.includes("ownerTeam"));
  const plainText = renderRiskOutputPlainText(model);
  assert.ok(plainText.includes("REG-9001"));
  assert.ok(plainText.includes("Commercial Team"));
});

test("hostile fixture: a custom-methodology band label, owner team, and rationale carrying a person name never leak in the Official preset in any output format", () => {
  const hostileFramework: RiskFrameworkEntity = withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      categories: [],
      methodologies: [
        {
          id: "methodology-1",
          label: "Custom methodology",
          revisions: [
            {
              revisionId: "r1",
              activatedAt: NOW,
              likelihoodLevels: [{ id: "l1", label: "Low", order: 1 }],
              impactLevels: [{ id: "i1", label: "Low", order: 1 }],
              cells: [{ likelihoodId: "l1", impactId: "i1", bandId: "b1" }],
              bands: [{ id: "b1", label: "Reviewed by Jane Smith personally", order: 1, colourToken: "info" }]
            }
          ]
        }
      ],
      appetiteRules: [],
      sourceRegisters: [],
      presentationPresets: []
    },
    "workshop"
  ) as RiskFrameworkEntity;
  const hostileRisk = risk("Third-party access risk", {
    ownerTeam: "Jane Smith's team",
    assessment: {
      basis: "custom",
      methodologyId: "methodology-1",
      revisionId: "r1",
      current: { likelihoodId: "l1", impactId: "i1" },
      assessedAt: NOW,
      rationale: "Assessed personally by Jane Smith, home phone 0400 000 000"
    },
    assessmentState: "assessed"
  });
  const context = contextFor([hostileRisk], { framework: hostileFramework });
  const officialPreset = findRiskOutputPreset("register", defaultRiskOutputPresetId("register"), hostileFramework);
  const officialModel = buildRiskOutputModel("register", context, officialPreset);

  const officialOutputs = [
    renderRiskOutputPlainText(officialModel),
    renderRiskOutputMarkdown(officialModel),
    renderRiskOutputPrintHtml(officialModel)
  ];
  for (const output of officialOutputs) {
    assert.ok(!output.includes("Jane Smith"), `hostile name leaked: ${output}`);
    assert.ok(!output.includes("0400 000 000"), `hostile phone number leaked: ${output}`);
    assert.ok(!output.includes("Reviewed by Jane Smith personally"), `hostile band label leaked: ${output}`);
  }
  assert.equal(officialModel.classification, "OFFICIAL");

  const sensitivePreset = findRiskOutputPreset("register", "register-official-sensitive", hostileFramework);
  const sensitiveModel = buildRiskOutputModel("register", context, sensitivePreset);
  assert.equal(sensitiveModel.classification, "OFFICIAL: Sensitive");
  const sensitiveOutputs = [
    renderRiskOutputPlainText(sensitiveModel),
    renderRiskOutputMarkdown(sensitiveModel),
    renderRiskOutputPrintHtml(sensitiveModel)
  ];
  for (const output of sensitiveOutputs) {
    assert.ok(output.includes("Jane Smith"), "opted-in sensitive content should be present once named by the preset");
  }
});

test("resolveRiskOutputPresets falls back to built-in presets when the framework declares none", () => {
  const presets = resolveRiskOutputPresets("matrix", undefined);
  assert.deepEqual(
    presets.map((preset) => preset.id),
    RISK_OUTPUT_BUILT_IN_PRESETS.filter((preset) => preset.view === "matrix").map((preset) => preset.id)
  );
});

test("resolveRiskOutputPresets reads workspace-declared presets and drops any unrecognised field name", () => {
  const declaredFramework: RiskFrameworkEntity = withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      categories: [],
      methodologies: [],
      appetiteRules: [],
      sourceRegisters: [],
      presentationPresets: [
        {
          id: "register-board-pack",
          label: "Board pack",
          view: "register",
          config: { fields: ["ownerTeam", "notARealField"], density: "compact", scope: "all" }
        }
      ]
    },
    "workshop"
  ) as RiskFrameworkEntity;
  const presets = resolveRiskOutputPresets("register", declaredFramework);
  assert.equal(presets.length, 1);
  assert.equal(presets[0]!.id, "register-board-pack");
  assert.deepEqual(presets[0]!.fields, ["ownerTeam"]);
  assert.equal(presets[0]!.density, "compact");
});

test("hierarchy view flattens the roll-up forest with depth, deepest risks last within a branch", () => {
  const parent = risk("Parent risk");
  const child = risk("Child risk");
  const link: LinkEntity = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "rolls up",
      linkType: "rolls-up-to",
      fromId: child.id,
      fromType: "risk",
      toId: parent.id,
      toType: "risk"
    },
    "workshop"
  ) as LinkEntity;
  const context = contextFor([parent, child], { links: [link] });
  const preset = findRiskOutputPreset("hierarchy", defaultRiskOutputPresetId("hierarchy"), undefined);
  const model = buildRiskOutputModel("hierarchy", context, preset);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0]!.depth, 0);
  assert.equal(model.rows[1]!.depth, 1);
});

test("bowtie view is scoped to the selected risk only, even when other risks exist", () => {
  const selected = risk("Selected risk", { causes: [{ id: "cause_1", label: "A cause" }] });
  const other = risk("Other risk");
  const context = contextFor([selected, other]);
  const preset = findRiskOutputPreset("bowtie", defaultRiskOutputPresetId("bowtie"), undefined);
  const model = buildRiskOutputModel("bowtie", context, preset, { selectedRiskId: selected.id });
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0]!.id, selected.id);
  assert.ok(model.bowtie);
  assert.equal(model.bowtie!.causes.length, 1);
});

test("matrix view discloses unassessed and not-comparable counts as notes, never coerced into a cell", () => {
  const assessed = risk("Assessed risk");
  const unassessed = risk("Unassessed risk", { assessment: { basis: "unassessed" }, assessmentState: "unassessed" });
  const context = contextFor([assessed, unassessed]);
  const preset = findRiskOutputPreset("matrix", defaultRiskOutputPresetId("matrix"), undefined);
  const model = buildRiskOutputModel("matrix", context, preset);
  assert.ok(model.matrix);
  assert.equal(model.matrix!.unassessedCount, 1);
  assert.ok(model.notes.some((note) => note.includes("1 unassessed")));
});

test("next decision prefers a pending escalation over a plain review date", () => {
  const target = risk("Escalatable risk", { reviewBy: "2027-06-30" });
  const event: RiskEventEntity = withEnvelope(
    "risk-event",
    {
      entityType: "risk-event",
      riskId: target.id,
      kind: "escalation",
      occurredAt: NOW,
      summary: "Escalation raised",
      escalation: { state: "proposed", reason: "Needs executive sign-off" }
    },
    "workshop"
  ) as RiskEventEntity;
  const context = contextFor([target], { riskEvents: [event] });
  const preset = findRiskOutputPreset("cards", "cards-official-sensitive", undefined);
  const model = buildRiskOutputModel("cards", context, preset);
  const nextDecision = model.rows[0]!.fields.find((field) => field.name === "nextDecision");
  assert.ok(nextDecision?.value.includes("Needs executive sign-off"));
});

test("treatment progress counts done vs total treatments and discloses zero treatments plainly", () => {
  const treated = risk("Treated risk");
  const untreated = risk("Untreated risk");
  const treatingAction: ActionEntity = withEnvelope(
    "action",
    { entityType: "action", title: "Close the gap", status: "done" },
    "workshop"
  ) as ActionEntity;
  const link: LinkEntity = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "treated by",
      linkType: "treated-by",
      fromId: treated.id,
      fromType: "risk",
      toId: treatingAction.id,
      toType: "action"
    },
    "workshop"
  ) as LinkEntity;
  const context = contextFor([treated, untreated], { links: [link], actions: [treatingAction] });
  const preset = findRiskOutputPreset("coverage", "coverage-official-sensitive", undefined);
  const model = buildRiskOutputModel("coverage", context, preset);
  const treatedRow = model.rows.find((row) => row.id === treated.id)!;
  const untreatedRow = model.rows.find((row) => row.id === untreated.id)!;
  assert.equal(
    treatedRow.fields.find((field) => field.name === "treatmentProgress")?.value,
    "1 of 1 treatment complete"
  );
  assert.equal(
    untreatedRow.fields.find((field) => field.name === "treatmentProgress")?.value,
    "No treatments recorded"
  );
});

test("print HTML output is self-contained: no external resource references", () => {
  const target = risk("A risk");
  const context = contextFor([target]);
  const preset = findRiskOutputPreset("register", defaultRiskOutputPresetId("register"), undefined);
  const model = buildRiskOutputModel("register", context, preset);
  const html = renderRiskOutputPrintHtml(model);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/https?:\/\//.test(html));
  assert.ok(html.startsWith("<!doctype html>"));
});

const ALL_VIEWS: readonly RiskOutputView[] = ["register", "hierarchy", "matrix", "bowtie", "coverage", "cards"];

test("every view has a built-in Official and Official: Sensitive preset", () => {
  for (const view of ALL_VIEWS) {
    const presets = resolveRiskOutputPresets(view, undefined);
    assert.ok(
      presets.some((preset) => preset.fields.length === 0),
      `${view} missing an Official preset`
    );
    assert.ok(
      presets.some((preset) => preset.fields.length > 0),
      `${view} missing an Official: Sensitive preset`
    );
  }
});
