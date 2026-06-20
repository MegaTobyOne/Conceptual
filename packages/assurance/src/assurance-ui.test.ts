import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Assurance Home uses shared PSPF home shell primitives", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(manifest, /"activationEvents"/);
  assert.match(manifest, /"onStartupFinished"/);
  assert.match(manifest, /"workspaceContains:\.pspf\/core\/pspf-core\.db"/);
  assert.match(source, /homePanelShellHtml/);
  assert.match(source, /homeMetricCard/);
  assert.match(source, /homeSection/);
  assert.match(source, /homeActionButton/);
  assert.match(source, /renderHomeLoading/);
  assert.match(source, /Loading local Assurance workspace state/);
  assert.match(source, /isWorkspaceInitialised/);
  assert.match(source, /pspf\.core\.getWorkspacePaths/);
  assert.doesNotMatch(source, /pspf\.core\.validateWorkspace/);
  assert.match(source, /Initialise the local PSPF workspace before using Assurance actions/);
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

test("Assurance finding model slice wires creation commands to Core writes", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /registerCommand\("pspf\.assurance\.newAssessment", createAssuranceAssessment\)/);
  assert.match(source, /registerCommand\("pspf\.assurance\.newFinding", createAssuranceFinding\)/);
  assert.match(source, /registerCommand\("pspf\.assurance\.prepareAssuranceReport", prepareAssuranceReport\)/);
  assert.match(source, /pspf\.core\.upsertEntity/);
  assert.match(source, /pspf\.core\.upsertEntities/);
  assert.match(source, /linkType: "tagged-with"/);
  assert.match(source, /PENTEST-/);
  assert.doesNotMatch(source, /plannedCommand\("New Assessment"\)/);
  assert.doesNotMatch(source, /plannedCommand\("New Finding"\)/);
});

test("Assurance report command opens a local Markdown working report", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function renderAssuranceReportMarkdown\(model: PentestWorkbenchModel\): string/);
  assert.match(source, /vscode\.workspace\.openTextDocument/);
  assert.match(source, /language: "markdown"/);
  assert.match(source, /# PSPF Assurance Report/);
  assert.match(source, /OFFICIAL: Sensitive - local assurance working report/);
  assert.match(source, /Prepared a local Assurance report/);
  assert.doesNotMatch(source, /Prepare Assurance Report"\)\)/);
});

test("Assurance pentest panel uses Workshop-style panel and table conventions", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /panel-section--hero/);
  assert.match(source, /panel-actions/);
  assert.match(source, /table-layout: fixed/);
  assert.match(source, /\.pentest-pipeline table \{ min-width: 1180px; \}/);
  assert.match(source, /data-field=\"criticalHigh\"\].*text-align: right/s);
  assert.match(source, /font-variant-numeric: tabular-nums/);
  assert.match(source, /data-field="open"/);
  assert.match(source, /tableOpenCell/);
  assert.match(source, /aria-label="Scrollable \$\{escapeHtml\(title\)\} table"/);
});
