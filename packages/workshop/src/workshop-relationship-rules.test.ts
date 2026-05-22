import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Workshop existing-item links use canonical operator link rules", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /relationshipManagerHtml/);
  assert.match(source, /type RelationshipManagerAction/);
  assert.match(source, /function renderRequirementRelationshipManager/);
  assert.match(source, /renderRequirementRelationshipManager\(requirement, allEntities\)/);
  assert.match(
    source,
    /requirementRelationshipItemTypes = \[[\s\S]*"evidence"[\s\S]*"action"[\s\S]*"risk"[\s\S]*"direction"/
  );
  assert.match(source, /operatorLinkRuleForEndpoints/);
  assert.match(source, /function existingItemOperatorRule/);
  assert.match(source, /operatorLinkRuleForEndpoints\(fromType, toType, "workshop"\)/);
  assert.match(source, /return existingItemOperatorRule\(itemType\)\.linkType/);
  assert.match(source, /return existingItemOperatorRule\(itemType\)\.phrase/);
  assert.doesNotMatch(source, /return "supported-by";/);
  assert.doesNotMatch(source, /return "addressed-by";/);
  assert.doesNotMatch(source, /return "exposed-by";/);
});
