import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  ISM_SOURCE_CONTROLS,
  PREVIOUS_ISM_SOURCE_CONTROLS
} from "../packages/ism-source-library/dist/index.js";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "ism-drift");
await mkdir(reportDirectory, { recursive: true });

const previousByControlId = new Map(PREVIOUS_ISM_SOURCE_CONTROLS.map((control) => [control.controlId, control]));
const currentByControlId = new Map(ISM_SOURCE_CONTROLS.map((control) => [control.controlId, control]));
const changedControlIds = new Set();
const driftRows = [];

for (const current of ISM_SOURCE_CONTROLS) {
  const previous = previousByControlId.get(current.controlId);
  const computedStatus = !previous ? "new" : previous.statement === current.statement ? "unchanged" : "changed";
  driftRows.push({
    controlId: current.controlId,
    previousRelease: previous?.provenance?.oscalRelease ?? "not present",
    currentRelease: current.provenance.oscalRelease,
    declaredStatus: current.statementChangeStatus,
    computedStatus
  });
  assert.equal(current.statementChangeStatus, computedStatus, `${current.controlId} declared drift status does not match seeded source comparison`);
  if (["changed", "new", "removed"].includes(computedStatus)) {
    changedControlIds.add(current.controlId);
  }
}

for (const previous of PREVIOUS_ISM_SOURCE_CONTROLS) {
  if (!currentByControlId.has(previous.controlId)) {
    driftRows.push({
      controlId: previous.controlId,
      previousRelease: previous.provenance.oscalRelease,
      currentRelease: "not present",
      declaredStatus: "removed",
      computedStatus: "removed"
    });
    changedControlIds.add(previous.controlId);
  }
}

const seededChangedControl = ISM_SOURCE_CONTROLS.find((control) => control.statementChangeStatus === "changed");
const seededUnchangedControl = ISM_SOURCE_CONTROLS.find((control) => control.statementChangeStatus === "unchanged");
assert.ok(seededChangedControl, "seeded drift fixture must include at least one changed ISM statement");
assert.ok(changedControlIds.has(seededChangedControl.controlId), `seeded drift fixture must detect changed ${seededChangedControl.controlId} statement`);
if (seededUnchangedControl) {
  assert.equal(changedControlIds.has(seededUnchangedControl.controlId), false, `unchanged ${seededUnchangedControl.controlId} must not be flagged`);
}

const bundlePath = findBundlePath();
const affectedMappings = [];
if (bundlePath) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const sourceControlsById = new Map((bundle.collections?.["source-controls"] ?? []).map((control) => [control.id, control]));
  for (const mapping of bundle.collections?.["requirement-control-mappings"] ?? []) {
    const sourceControl = sourceControlsById.get(mapping.sourceControlId);
    if (sourceControl && changedControlIds.has(sourceControl.controlId)) {
      affectedMappings.push({
        mappingId: mapping.id,
        requirementId: mapping.requirementId,
        sourceControlId: sourceControl.id,
        controlId: sourceControl.controlId,
        confidence: mapping.confidence ?? "medium",
        reviewBy: mapping.reviewBy ?? undefined,
        lastReviewedAt: mapping.lastReviewedAt ?? undefined
      });
    }
  }
}

const mappingCount = bundlePath ? JSON.parse(readFileSync(bundlePath, "utf8")).collections?.["requirement-control-mappings"]?.length ?? 0 : 0;
if (mappingCount > 0 && affectedMappings.length === 0) {
  console.warn("warning: bundle contains mappings but none target the seeded changed ISM control");
}

const report = {
  generatedAt: new Date().toISOString(),
  previousControls: PREVIOUS_ISM_SOURCE_CONTROLS.length,
  currentControls: ISM_SOURCE_CONTROLS.length,
  changedControlIds: Array.from(changedControlIds).sort(),
  bundlePath: bundlePath ? relative(root, bundlePath) : undefined,
  affectedMappings,
  driftRows
};

const reportPath = join(reportDirectory, "ism-drift-report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("ok ISM drift detection passed");
console.log(`changed controls: ${report.changedControlIds.join(", ")}`);
console.log(`affected mappings: ${affectedMappings.length}`);
console.log(`report: ${relative(root, reportPath)}`);

function findBundlePath() {
  const e2eReportPath = join(root, ".tmp", "e2e-v0.1-workspace", ".pspf", "reports", "e2e-v0.1-report.json");
  if (existsSync(e2eReportPath)) {
    const report = JSON.parse(readFileSync(e2eReportPath, "utf8"));
    const candidate = join(root, report.bundlePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const standardFixture = join(root, "packages", "contracts", "test-fixtures", "standard", "bundle.json");
  return existsSync(standardFixture) ? standardFixture : undefined;
}
