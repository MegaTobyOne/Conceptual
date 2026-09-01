// E1 (v1.63.0, ADR 0096): asserts the plain-language explainer pack is defined once at the
// shared reference-data layer, covers every PSPF baseline section, and is wired into
// requirement detail in both Explorer and Workshop.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const referenceDataIndex = await readFile(join(root, "packages/reference-data/src/index.ts"), "utf8");
for (const requiredText of [
  "RequirementExplainerEntry",
  "REQUIREMENT_EXPLAINERS",
  "RequirementExplainer",
  "RequirementExplainerFacts",
  "buildRequirementExplainer"
]) {
  assert.equal(
    referenceDataIndex.includes(requiredText),
    true,
    `packages/reference-data/src/index.ts should export ${requiredText}`
  );
}

const renderExplainer = await readFile(
  join(root, "packages/reference-data/src/explainers/render-explainer.ts"),
  "utf8"
);
assert.equal(
  renderExplainer.includes("export function buildRequirementExplainer("),
  true,
  "render-explainer.ts should define the one shared buildRequirementExplainer renderer"
);

const sectionExplainers = await readFile(
  join(root, "packages/reference-data/src/explainers/section-explainers.ts"),
  "utf8"
);
for (const requiredField of ["whatThisMeans", "whyItMattersFallback", "whatToDoNextFallback"]) {
  assert.equal(
    sectionExplainers.includes(requiredField),
    true,
    `section-explainers.ts entries should declare ${requiredField}`
  );
}
assert.equal(
  sectionExplainers.includes('publication: "public"'),
  true,
  "section-explainers.ts entries should declare publication explicitly"
);
assert.equal(
  sectionExplainers.includes("attribution:") && sectionExplainers.includes("licence:"),
  true,
  "section-explainers.ts entries should carry source attribution and licence"
);

// Every PSPF baseline section must have a curated explainer entry — fails closed on gaps.
const generatedReferenceData = await readFile(
  join(root, "packages/reference-data/src/generated/reference-data.ts"),
  "utf8"
);
const baselineSectionCodes = new Set(
  [...generatedReferenceData.matchAll(/"sectionCode":\s*"([^"]+)"/g)].map((match) => match[1])
);
const explainerSectionCodes = new Set(
  [...sectionExplainers.matchAll(/sectionCode:\s*"([^"]+)"/g)].map((match) => match[1])
);
const missingSections = [...baselineSectionCodes].filter((code) => !explainerSectionCodes.has(code));
assert.deepEqual(
  missingSections,
  [],
  `section-explainers.ts is missing an explainer entry for PSPF section(s): ${missingSections.join(", ")}`
);
const extraSections = [...explainerSectionCodes].filter((code) => !baselineSectionCodes.has(code));
assert.deepEqual(
  extraSections,
  [],
  `section-explainers.ts has an explainer entry for unknown PSPF section(s): ${extraSections.join(", ")}`
);

const explorerRequirementView = await readFile(join(root, "packages/explorer/src/views/requirement-view.ts"), "utf8");
assert.equal(
  explorerRequirementView.includes("buildRequirementExplainer"),
  true,
  "Explorer requirement view should call the shared buildRequirementExplainer renderer"
);
assert.equal(
  explorerRequirementView.includes('data-testid="explainer"'),
  true,
  "Explorer requirement view should render the three-part explainer section"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(
  workshopExtension.includes("buildRequirementExplainer"),
  true,
  "Workshop requirement detail should call the shared buildRequirementExplainer renderer"
);
assert.equal(
  workshopExtension.includes("<h2>What this means</h2>"),
  true,
  "Workshop requirement detail should render the three-part explainer section"
);

for (const requiredFile of ["docs/lint/banned-jargon.json", "scripts/check-banned-jargon.mjs"]) {
  await readFile(join(root, requiredFile), "utf8").catch(() => {
    throw new Error(`${requiredFile} should exist for the plain-language gate`);
  });
}

console.log(
  "ok check-explainer-content: plain-language explainer pack covers every PSPF section and is wired in both surfaces"
);
