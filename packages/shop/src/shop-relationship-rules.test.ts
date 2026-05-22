import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Shop link commands use canonical operator link rules", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /operatorLinkRuleFor/);
  assert.match(source, /commercialLinkSpec\("supplier", "supports", "requirement"\)/);
  assert.match(source, /commercialLinkSpec\("supplier", "associated-with", "risk"\)/);
  assert.match(source, /commercialLinkSpec\("contract", "supports", "requirement"\)/);
  assert.match(source, /commercialLinkSpec\("contract", "funds", "spend-item"\)/);
  assert.match(source, /commercialLinkSpec\("spend-item", "supports", "action"\)/);
  assert.match(source, /commercialLinkSpec\("spend-item", "supports", "requirement"\)/);
  assert.match(source, /relationshipManagerHtml/);
  assert.match(source, /function renderAssuranceRelationshipActions/);
  assert.doesNotMatch(source, /linkCommercialRecord\([^\n]+\{ linkType: "supports", targetType: "requirement"/);
  assert.doesNotMatch(source, /linkCommercialRecord\([^\n]+\{ linkType: "associated-with", targetType: "risk"/);
});
