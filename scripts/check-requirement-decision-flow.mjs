// E4 (v1.66.0, ADR 0096): asserts Requirement Detail is restructured plain-language-first
// (assess -> justify -> act) in both hosts, with an Advanced disclosure for less-common content and
// create-new (not just link-existing) support for evidence/action/risk in Explorer's guided path.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const explorerRequirementView = await readFile(join(root, "packages/explorer/src/views/requirement-view.ts"), "utf8");
for (const requiredText of [
  "pspf-disclosure",
  'class="flow-step">Assess',
  'class="flow-step">Justify',
  'class="flow-step">Act',
  "#createAction(",
  "#createRisk("
]) {
  assert.equal(
    explorerRequirementView.includes(requiredText),
    true,
    `Explorer requirement-view.ts should include ${requiredText}`
  );
}
// Assess must precede Justify must precede Act in DOM order.
const assessIndex = explorerRequirementView.indexOf('class="flow-step">Assess');
const justifyIndex = explorerRequirementView.indexOf('class="flow-step">Justify');
const actIndex = explorerRequirementView.indexOf('class="flow-step">Act');
assert.equal(
  assessIndex < justifyIndex && justifyIndex < actIndex,
  true,
  "Explorer requirement-view.ts should render Assess before Justify before Act"
);

const disclosureComponent = await readFile(join(root, "packages/explorer/src/components/disclosure.ts"), "utf8");
assert.equal(
  disclosureComponent.includes("pspf-disclosure"),
  true,
  "packages/explorer/src/components/disclosure.ts should define pspf-disclosure"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
for (const requiredText of [
  'class="flow-step">Assess',
  'class="flow-step">Justify',
  'class="flow-step">Act',
  "buildRequirementExplainer"
]) {
  assert.equal(
    workshopExtension.includes(requiredText),
    true,
    `Workshop extension.ts renderRequirementEditor should include ${requiredText}`
  );
}
const workshopAssessIndex = workshopExtension.indexOf('class="flow-step">Assess');
const workshopJustifyIndex = workshopExtension.indexOf('class="flow-step">Justify');
const workshopActIndex = workshopExtension.indexOf('class="flow-step">Act');
assert.equal(
  workshopAssessIndex < workshopJustifyIndex && workshopJustifyIndex < workshopActIndex,
  true,
  "Workshop renderRequirementEditor should render Assess before Justify before Act"
);

console.log(
  "ok check-requirement-decision-flow: Requirement Detail is assess -> justify -> act in both hosts, with Advanced disclosure and create-new linking in Explorer"
);
