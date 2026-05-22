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
  assert.match(source, /vscode\.commands\.registerCommand\("pspf\.shop\.openDetail", openShopDetail\)/);
  assert.match(source, /function openShopDetail/);
  assert.match(source, /function renderShopDetailHtml/);
  assert.match(source, /function shopDetailRows/);
  assert.match(source, /function shopDetailRelationshipActions/);
  assert.match(source, /function shopRelationshipAction/);
  assert.match(source, /"pspf\.shop\.openDetail"/);
  assert.match(source, /this\.command = \{ command: openCommand, title: "Open detail", arguments: \[entity\] \}/);
  assert.doesNotMatch(source, /linkCommercialRecord\([^\n]+\{ linkType: "supports", targetType: "requirement"/);
  assert.doesNotMatch(source, /linkCommercialRecord\([^\n]+\{ linkType: "associated-with", targetType: "risk"/);
});
