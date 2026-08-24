// S2 (v1.55.0, ADR 0089): asserts the J2 consequence chain is wired at the
// shared contracts layer and consumed by Workshop, Explorer, and the
// posture brief / CISO magazine lead statement.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export function buildConsequenceStatement(",
  "export function summariseUncoveredRisk(",
  "export function buildUncoveredRiskStatement("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(
  workshopExtension.includes("<h2>Consequence</h2>"),
  true,
  "Workshop requirement detail should render a Consequence section"
);
assert.equal(
  workshopExtension.includes("model.uncoveredRiskStatement"),
  true,
  "Workshop Home should render the uncovered-risk lead statement"
);

const explorerAnalytics = await readFile(join(root, "packages/explorer/src/domain/analytics.ts"), "utf8");
for (const requiredText of ["export function requirementConsequence(", "export function uncoveredRiskStatement("]) {
  assert.equal(
    explorerAnalytics.includes(requiredText),
    true,
    `Explorer analytics domain should define ${requiredText}`
  );
}
const explorerRequirementView = await readFile(join(root, "packages/explorer/src/views/requirement-view.ts"), "utf8");
assert.equal(
  explorerRequirementView.includes('data-testid="consequence"'),
  true,
  "Explorer requirement view should render a Consequence section"
);
const explorerAnalyticsView = await readFile(join(root, "packages/explorer/src/views/analytics-view.ts"), "utf8");
assert.equal(
  explorerAnalyticsView.includes('data-testid="uncovered-risk-lead"'),
  true,
  "Explorer Analytics view should lead with the uncovered-risk statement"
);

const briefRenderer = await readFile(join(root, "packages/brief-renderer/src/index.ts"), "utf8");
assert.equal(
  briefRenderer.includes("uncoveredRiskLead"),
  true,
  "brief-renderer should compute and expose the uncovered-risk lead statement"
);
assert.equal(
  briefRenderer.includes("Open risks with no met requirement covering them"),
  true,
  "brief-renderer posture snapshot should lead with the uncovered-risk metric"
);

console.log("ok J2 consequence chain is wired into Workshop, Explorer, and brief-renderer");
