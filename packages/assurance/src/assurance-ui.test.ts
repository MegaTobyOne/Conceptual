import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Assurance Home uses shared PSPF home shell primitives", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /homePanelShellHtml/);
  assert.match(source, /homeMetricCard/);
  assert.match(source, /homeSection/);
  assert.match(source, /homeActionButton/);
  assert.match(source, /accent: "teal"/);
  assert.match(source, /assuranceHomeStyles/);
  assert.match(source, /Assurance Home/);
  assert.match(source, /OFFICIAL: Sensitive assurance workspace/);
  assert.match(source, /OFFICIAL: Sensitive · assessment and verification data stays local/);
  assert.match(source, /pspf\.assurance\.openPentestWorkbench/);
  assert.match(source, /pspf\.assurance\.newAssessment/);
  assert.match(source, /pspf\.assurance\.newFinding/);
  assert.match(source, /pspf\.assurance\.prepareAssuranceReport/);
  assert.match(source, /pspf\.assurance\.runPublicationReadiness/);
});

test("Assurance pentest panel uses Workshop-style panel and table conventions", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /panel-section--hero/);
  assert.match(source, /panel-actions/);
  assert.match(source, /table-layout: fixed/);
  assert.match(source, /data-field="open"/);
  assert.match(source, /tableOpenCell/);
  assert.match(source, /aria-label="Scrollable \$\{escapeHtml\(title\)\} table"/);
});
