import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { buildSampleWorkspaceEntities } from "../packages/contracts/dist/index.js";
import {
  ISM_SOURCE_CONTROLS,
  PSPF_BASELINE_DIRECTIONS,
  PSPF_BASELINE_DIRECTION_LINKS,
  PSPF_BASELINE_REQUIREMENTS
} from "../packages/reference-data/dist/index.js";
import { validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "sample-workspace-gate");
await rm(workspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();
let sourceControls = await service.listEntities("source-control");
await service.upsertEntity({
  ...sourceControls[0],
  id: "SRC-00000000-0000-7000-8000-000000000999",
  title: "Retired generated ISM fixture",
  controlId: "ISM-RETIRED-FIXTURE",
  statement: "Retired generated fixture that should be pruned during reference-data refresh.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
sourceControls = await service.listEntities("source-control");
assert.equal(
  sourceControls.length,
  ISM_SOURCE_CONTROLS.length,
  "Core refresh should prune retired generated source controls from existing workspaces."
);
const sampleEntities = buildSampleWorkspaceEntities({ sourceControls });
await service.upsertEntities(sampleEntities);

const validation = await service.validateWorkspace();
assert.equal(validation.ok, true, validation.message);
assert.equal(validation.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 3);
assert.equal(validation.counts.evidence, 2);
assert.equal(validation.counts.actions, 3);
assert.equal(validation.counts.risks, 4);
assert.equal(validation.counts.directions, PSPF_BASELINE_DIRECTIONS.length + 2);
assert.equal(validation.counts.links, PSPF_BASELINE_DIRECTION_LINKS.length + 12);
assert.equal(validation.counts["source-controls"], ISM_SOURCE_CONTROLS.length);
assert.equal(validation.counts["requirement-control-mappings"], 1);

const scan = await service.runIntegrityScan();
assert.equal(scan.ok, true, scan.summary);

const exported = await service.exportBundle();
const report = await validateExportBundle(join(exported.exportDirectory, "bundle.json"), { root });
assert.equal(report.ok, true, report.failures.join("\n"));
assert.equal(report.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 3);
assert.equal(report.counts.directions, PSPF_BASELINE_DIRECTIONS.length + 2);
assert.equal(
  report.redactionChecks.every((check) => check.ok),
  true,
  JSON.stringify(report.redactionChecks)
);
assert.equal(report.mappingRedaction.ok, true, report.mappingRedaction.detail);

const actions = await service.listEntities("action");
const enrichedActions = actions.filter((action) => action.impact);
assert.equal(enrichedActions.length, 0, "Core storage should not persist derived action impact before export.");

console.log("ok sample workspace loads, validates, scans, exports, and remains publication-safe");
