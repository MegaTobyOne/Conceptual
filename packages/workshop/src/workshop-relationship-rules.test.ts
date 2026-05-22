import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Workshop existing-item links use canonical operator link rules", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /operatorLinkRuleForEndpoints/);
  assert.match(source, /function existingItemOperatorRule/);
  assert.match(source, /operatorLinkRuleForEndpoints\(fromType, toType, "workshop"\)/);
  assert.match(source, /return existingItemOperatorRule\(itemType\)\.linkType/);
  assert.match(source, /return existingItemOperatorRule\(itemType\)\.phrase/);
  assert.doesNotMatch(source, /return "supported-by";/);
  assert.doesNotMatch(source, /return "addressed-by";/);
  assert.doesNotMatch(source, /return "exposed-by";/);
});
