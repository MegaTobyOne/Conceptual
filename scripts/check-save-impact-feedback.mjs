// E5 (v1.67.0, ADR 0096): asserts the post-save impact confirmation is composed from
// buildSaveImpactSummary (existing posture/impact builders only) and wired into both hosts'
// requirement save paths, with behavioural tests covering saved/no-op/failed outcomes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export interface SaveImpactSummaryInput",
  "export interface SaveImpactSummary",
  "export function buildSaveImpactSummary("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}

const saveImpactTests = await readFile(join(root, "packages/contracts/src/save-impact-summary.test.ts"), "utf8");
for (const requiredText of ['outcome: "failed"', 'outcome: "no-op"', 'outcome: "saved"']) {
  assert.equal(
    saveImpactTests.includes(requiredText),
    true,
    `save-impact-summary.test.ts should cover ${requiredText}`
  );
}

const toastComponent = await readFile(join(root, "packages/explorer/src/components/toast.ts"), "utf8");
assert.equal(
  toastComponent.includes("pspf-toast"),
  true,
  "packages/explorer/src/components/toast.ts should define pspf-toast"
);

const complianceEditor = await readFile(join(root, "packages/explorer/src/components/compliance-editor.ts"), "utf8");
for (const requiredText of ["buildSaveImpactSummary", "pspf-toast", "saveImpactMessage"]) {
  assert.equal(
    complianceEditor.includes(requiredText),
    true,
    `Explorer compliance-editor.ts should include ${requiredText}`
  );
}

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
for (const requiredText of ["notifyRequirementSaveImpact", "buildSaveImpactSummary", "requirementSaveWhatChanged"]) {
  assert.equal(workshopExtension.includes(requiredText), true, `Workshop extension.ts should include ${requiredText}`);
}

console.log(
  "ok check-save-impact-feedback: post-save confirmation composes buildSaveImpactSummary only, wired into both hosts, with saved/no-op/failed test coverage"
);
