import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import {
  CYBER_REFERENCE_LINKS,
  CYBER_REFERENCE_MAPPINGS,
  PSPF_REFERENCE_DATA_REPORT
} from "../packages/reference-data/dist/index.js";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "cyber-reference-data-gate-workspace");
await rm(workspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();

const report = await service.runDatasetDiagnostics();
assert.equal(report.ok, true, report.summary);
assert.equal(report.counts.cyberFunctions, PSPF_REFERENCE_DATA_REPORT.cyberReference.cyberFunctionCount);
assert.equal(report.counts.mitigationStrategies, PSPF_REFERENCE_DATA_REPORT.cyberReference.mitigationStrategyCount);
assert.equal(report.counts.guidanceFrameworks, PSPF_REFERENCE_DATA_REPORT.cyberReference.guidanceFrameworkCount);
assert.equal(report.counts.controlThemes, PSPF_REFERENCE_DATA_REPORT.cyberReference.controlThemeCount);
assert.equal(report.counts.cyberReferenceMappings, CYBER_REFERENCE_MAPPINGS.length);
assert.equal(report.counts.cyberReferenceLinks, CYBER_REFERENCE_LINKS.length);
assert.equal(report.counts.brokenMappingEndpoints, 0);
assert.equal(report.counts.mismatchedCyberLinks, 0);
assert.equal(report.counts.schemaVersionMismatches, 0);
assert.equal(report.counts.publicationLeaks, 0);

const exported = await service.exportBundle();
const bundle = JSON.parse(await readFile(join(exported.exportDirectory, "bundle.json"), "utf8"));
const exportedMappings = bundle.collections["cyber-reference-mappings"] ?? [];
assert.equal(exportedMappings.length, CYBER_REFERENCE_MAPPINGS.length);
assert.equal(
  exportedMappings.every((mapping) => !("rationale" in mapping)),
  true,
  "public cyber-reference-mappings must not export rationale"
);

const mappingsBeforeReset = (await service.listEntities("cyber-reference-mapping")).length;
assert.equal(mappingsBeforeReset, CYBER_REFERENCE_MAPPINGS.length);
await service.resetWorkspace();
const resetReport = await service.runDatasetDiagnostics();
assert.equal(resetReport.ok, true, resetReport.summary);
assert.equal(resetReport.counts.cyberReferenceMappings, CYBER_REFERENCE_MAPPINGS.length);

console.log("ok cyber reference dataset diagnostics, redaction, export, and clean reset baseline are valid");
