// S5 (v1.58.0, ADR 0092): asserts J4 trajectory (burn-up velocity, an
// assumption-stated range, and a sustain-line note) is wired at the shared
// contracts layer and consumed by Workshop Home and Explorer Analytics.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export function computeClosureVelocity(",
  "export function projectTrajectory(",
  "export function buildSustainNote("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}
assert.match(
  contracts,
  /No positive closure velocity observed/,
  "projectTrajectory must never fall back to an unqualified date"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(
  workshopExtension.includes("computeClosureVelocity"),
  true,
  "Workshop should compute closure velocity from its posture history"
);
assert.equal(
  workshopExtension.includes("<h2>Trajectory</h2>"),
  true,
  "Workshop Home should render a Trajectory section"
);
assert.equal(
  workshopExtension.includes("model.sustainNote"),
  true,
  "Workshop Home should render the sustain-line note"
);

const explorerAnalyticsView = await readFile(join(root, "packages/explorer/src/views/analytics-view.ts"), "utf8");
assert.equal(
  explorerAnalyticsView.includes("computeClosureVelocity"),
  true,
  "Explorer Analytics view should compute closure velocity from snapshot metrics"
);
assert.equal(
  explorerAnalyticsView.includes('data-testid="trajectory-assumption"'),
  true,
  "Explorer Analytics view should render the trajectory assumption"
);
assert.equal(
  explorerAnalyticsView.includes('data-testid="sustain-note"'),
  true,
  "Explorer Analytics view should render the sustain-line note"
);

console.log(
  "ok J4 trajectory (velocity, assumption-stated projection, sustain note) is wired into Workshop and Explorer"
);
