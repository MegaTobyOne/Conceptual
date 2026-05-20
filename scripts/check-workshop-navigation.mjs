import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workshopExtension = readFileSync(join(root, "packages/workshop/src/extension.ts"), "utf8");

function functionBody(functionName) {
  const marker = `function ${functionName}`;
  const start = workshopExtension.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const openBrace = workshopExtension.indexOf("{", start);
  assert.notEqual(openBrace, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = openBrace; index < workshopExtension.length; index += 1) {
    const character = workshopExtension[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return workshopExtension.slice(openBrace + 1, index);
      }
    }
  }
  throw new Error(`${functionName} body should close`);
}

const adjacentRequirementBody = functionBody("openAdjacentRequirement");
assert.equal(
  adjacentRequirementBody.includes("openItemDetailForRequirement"),
  false,
  "Requirement previous/next navigation must not open the old standalone item-detail panel"
);
assert.equal(
  adjacentRequirementBody.includes("await openEntityEditor(adjacent.requirement, allEntities)"),
  true,
  "Requirement previous/next navigation should reuse the Requirements workbench editor"
);

assert.equal(
  workshopExtension.includes(
    'adjacentRequirementFromEntities(updated.id, "next", currentEntities, requirementSavedView)'
  ),
  true,
  "Save and next should stay inside the filtered Requirements workbench"
);
assert.equal(
  /if \(message\.command === "saveAndNextEntity"\) \{\s*panel\.dispose\(\);\s*if \(updated\.entityType === "requirement"\)/.test(
    workshopExtension
  ),
  false,
  "Save and next must not dispose the Requirements workbench before moving to the next Requirement"
);
assert.equal(
  workshopExtension.includes("savedViewMatchesRequirement(savedView, requirement, links)"),
  true,
  "Requirement workbench navigation should honour saved-view filters"
);

console.log("ok Workshop Requirement navigation stays on the reusable workbench");
