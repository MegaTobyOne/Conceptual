import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourcePath = new URL("../src/workforce-ui.ts", import.meta.url);

test("workforce cockpit exposes five semantic keyboard-operable views", async () => {
  const source = await readFile(sourcePath, "utf8");
  for (const view of ["Overview", "Obligations", "Capability", "Continuity", "Mobility & career"]) {
    assert.match(source, new RegExp(view.replace("&", "&")));
  }
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /focus-visible/);
});

test("workforce cockpit keeps filters ephemeral and capability counts explicit", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /Filters stay in this panel and are never exported/);
  assert.match(source, /AI fluency only/);
  assert.match(source, /Meeting target/);
  assert.match(source, /Below target/);
  assert.match(source, /Not assessed/);
  assert.match(source, /Missing assessment is not zero capability/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("workforce cockpit labels pathways as evidence-only and has no prohibited export or prediction command", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /They are not recommendations, fit assessments, or promotion decisions/);
  assert.doesNotMatch(source, /exportWorkforce.*Csv|copyPerson|exportPerson/i);
  assert.doesNotMatch(source, /vscode\.lm|fetch\(/);
});
