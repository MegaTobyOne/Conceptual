import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Core import review uses the shared v1.50 identity and anatomy", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /homePanelShellHtml/);
  assert.match(source, /product: "core"/);
  assert.match(source, /pageHeaderHtml/);
  assert.match(source, /trustChipsHtml/);
  assert.match(source, /metricStripHtml/);
  assert.match(source, /data-command="applyImport"/);
  assert.match(source, /data-command="cancelImport"/);
});
