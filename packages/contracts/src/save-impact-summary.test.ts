import assert from "node:assert/strict";
import test from "node:test";
import { buildSaveImpactSummary } from "./index.js";

test("buildSaveImpactSummary: failed outcome states not-saved and a retry action", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "",
    outcome: "failed",
    failureReason: "Select a valid assessment status before saving.",
    affectedEvidenceCount: 0,
    affectedActionCount: 0,
    affectedRiskCount: 0,
    postureOrPriorityStatement: "No material risk linked."
  });
  assert.deepEqual(summary, {
    headline: "Not saved",
    detail: "Select a valid assessment status before saving.",
    nextAction: "Fix the issue above and try again."
  });
});

test("buildSaveImpactSummary: failed outcome falls back to a generic detail when no reason is given", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "",
    outcome: "failed",
    affectedEvidenceCount: 0,
    affectedActionCount: 0,
    affectedRiskCount: 0,
    postureOrPriorityStatement: "No material risk linked."
  });
  assert.equal(summary.detail, "The save could not be completed.");
});

test("buildSaveImpactSummary: no-op outcome states nothing changed and no action needed", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "",
    outcome: "no-op",
    affectedEvidenceCount: 0,
    affectedActionCount: 0,
    affectedRiskCount: 0,
    postureOrPriorityStatement: "No material risk linked."
  });
  assert.deepEqual(summary, {
    headline: "No changes to save",
    detail: "Nothing changed since the last save.",
    nextAction: "No further action needed."
  });
});

test("buildSaveImpactSummary: saved outcome states what changed, affected counts, and a stated next action", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "Status: not-met -> met",
    outcome: "saved",
    consequenceStatement: "This requirement is met; 1 linked risk remains open (highest severity moderate).",
    affectedEvidenceCount: 2,
    affectedActionCount: 1,
    affectedRiskCount: 1,
    postureOrPriorityStatement: "Material risk linked."
  });
  assert.equal(summary.headline, "Status: not-met -> met");
  assert.match(summary.detail, /Affects 2 evidence, 1 action\(s\), 1 risk\(s\)\./);
  assert.match(summary.detail, /Material risk linked\./);
  assert.match(summary.detail, /1 linked risk remains open/);
  assert.equal(summary.nextAction, "1 linked action(s) still need attention.");
});

test("buildSaveImpactSummary: saved outcome with no affected records and no open actions states no further action", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "Summary updated.",
    outcome: "saved",
    affectedEvidenceCount: 0,
    affectedActionCount: 0,
    affectedRiskCount: 0,
    postureOrPriorityStatement: "No material risk linked."
  });
  assert.equal(summary.detail, "No linked evidence, actions, or risks affected. No material risk linked.");
  assert.equal(summary.nextAction, "No further action needed right now.");
});

test("buildSaveImpactSummary: saved outcome falls back to a generic headline when nothing is stated as changed", () => {
  const summary = buildSaveImpactSummary({
    whatChanged: "",
    outcome: "saved",
    affectedEvidenceCount: 0,
    affectedActionCount: 0,
    affectedRiskCount: 0,
    postureOrPriorityStatement: "No material risk linked."
  });
  assert.equal(summary.headline, "Saved");
});
