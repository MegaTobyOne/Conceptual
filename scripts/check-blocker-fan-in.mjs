// S3 (v1.56.0, ADR 0090): asserts the J3 blocker fan-in ranking and
// staleness preview are wired at the shared contracts layer and consumed
// by Workshop Home and Explorer Analytics.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export function rankBlockersByFanIn(",
  "export type BlockerClass",
  "export function classifyBlocker(",
  "export function blockerClassLabel(",
  "export function isExpiringWithinDays("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(workshopExtension.includes("rankBlockersByFanIn"), true, "Workshop should rank blockers by fan-in");
assert.equal(workshopExtension.includes("<h2>Blockers</h2>"), true, "Workshop Home should render a Blockers section");
assert.equal(
  workshopExtension.includes("model.expiringSoonCount"),
  true,
  "Workshop Home should render the staleness preview count"
);

const explorerAnalytics = await readFile(join(root, "packages/explorer/src/domain/analytics.ts"), "utf8");
for (const requiredText of ["export function topActionBlockers(", "export function evidenceExpiringSoonCount("]) {
  assert.equal(
    explorerAnalytics.includes(requiredText),
    true,
    `Explorer analytics domain should define ${requiredText}`
  );
}
const explorerAnalyticsView = await readFile(join(root, "packages/explorer/src/views/analytics-view.ts"), "utf8");
assert.equal(
  explorerAnalyticsView.includes('data-testid="top-blockers"'),
  true,
  "Explorer Analytics view should render a Top blockers table"
);
assert.equal(
  explorerAnalyticsView.includes("expiringSoonCount"),
  true,
  "Explorer Analytics view should render the staleness preview count"
);

console.log("ok J3 blocker fan-in ranking and staleness preview are wired into Workshop and Explorer");
