// S1 (v1.54.0, ADR 0088): asserts the assessment-basis trust gradient is
// wired at the shared contracts layer and consumed by Workshop Home,
// Explorer Analytics, and the CISO magazine/posture brief headline.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export type AssessmentBasis",
  "export function assessmentBasis(",
  "export function assessmentBasisLabel(",
  "export function isWithinFreshnessWindow(",
  "export function summariseAssessmentBasis("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(
  workshopExtension.includes("summariseAssessmentBasis"),
  true,
  "Workshop should compute an assessment basis summary"
);
assert.match(
  workshopExtension,
  /model\.metBasis\.evidencedFreshPercentage/,
  "Workshop Home headline should render the evidenced-and-fresh percentage"
);

const explorerAnalytics = await readFile(join(root, "packages/explorer/src/domain/analytics.ts"), "utf8");
assert.equal(
  explorerAnalytics.includes("export function metComplianceBasis("),
  true,
  "Explorer analytics domain should expose metComplianceBasis"
);
const explorerAnalyticsView = await readFile(join(root, "packages/explorer/src/views/analytics-view.ts"), "utf8");
assert.equal(
  explorerAnalyticsView.includes("metComplianceBasis"),
  true,
  "Explorer Analytics view should render the met-compliance basis"
);
assert.match(
  explorerAnalyticsView,
  /data-kpi="met-basis"/,
  "Explorer Analytics view should expose a met-basis KPI note for regression coverage"
);

const briefRenderer = await readFile(join(root, "packages/brief-renderer/src/index.ts"), "utf8");
assert.equal(
  briefRenderer.includes("summariseAssessmentBasis"),
  true,
  "brief-renderer should compute the met-requirements assessment basis"
);
assert.equal(
  briefRenderer.includes("Met requirements evidenced and fresh"),
  true,
  "brief-renderer posture snapshot should carry the basis metric label"
);

console.log("ok assessment-basis trust gradient is wired into Workshop, Explorer, and brief-renderer");
