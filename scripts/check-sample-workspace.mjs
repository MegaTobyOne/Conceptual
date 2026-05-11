import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { buildSampleWorkspaceEntities } from "../packages/contracts/dist/index.js";
import { validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "sample-workspace-gate");
await rm(workspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();
const sourceControls = await service.listEntities("source-control");
const sampleEntities = buildSampleWorkspaceEntities({ sourceControls });
await service.upsertEntities(sampleEntities);

const validation = await service.validateWorkspace();
assert.equal(validation.ok, true, validation.message);
assert.equal(validation.counts.requirements, 3);
assert.equal(validation.counts.evidence, 2);
assert.equal(validation.counts.actions, 3);
assert.equal(validation.counts.risks, 4);
assert.equal(validation.counts.directions, 2);
assert.equal(validation.counts.links, 12);
assert.equal(validation.counts["requirement-control-mappings"], 1);

const scan = await service.runIntegrityScan();
assert.equal(scan.ok, true, scan.summary);

const exported = await service.exportBundle();
const report = await validateExportBundle(join(exported.exportDirectory, "bundle.json"), { root });
assert.equal(report.ok, true, report.failures.join("\n"));
assert.equal(report.counts.requirements, 3);
assert.equal(report.counts.directions, 2);
assert.equal(report.redactionChecks.every((check) => check.ok), true, JSON.stringify(report.redactionChecks));
assert.equal(report.mappingRedaction.ok, true, report.mappingRedaction.detail);

const actions = await service.listEntities("action");
const enrichedActions = actions.filter((action) => action.impact);
assert.equal(enrichedActions.length, 0, "Core storage should not persist derived action impact before export.");

console.log("ok sample workspace loads, validates, scans, exports, and remains publication-safe");
