import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { findLatestBundle, validateExportBundle, writeValidationReport } from "./lib/export-validation.mjs";

const root = process.cwd();
const workspaceRoot = join(root, "debug-workspace");
const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();
await service.exportBundle();
const bundlePath = findLatestBundle(workspaceRoot);

if (!bundlePath || !existsSync(bundlePath)) {
  console.error("No debug export found. Run the Extension Host, then PSPF: Export Master Bundle.");
  process.exit(1);
}

const report = await validateExportBundle(bundlePath, { root });
const reportDirectory = join(workspaceRoot, ".pspf", "reports");
await mkdir(reportDirectory, { recursive: true });
const reportPaths = await writeValidationReport(report, reportDirectory, "debug-workspace-report");

if (!report.ok) {
  console.error(report.failures.join("\n"));
  console.error(`report: ${relative(root, reportPaths.markdownPath)}`);
  process.exit(1);
}

console.log(`ok debug workspace export validates: ${relative(root, bundlePath)}`);
console.log(`report: ${relative(root, reportPaths.markdownPath)}`);
console.log(`explorer: ${report.explorerPath}`);
console.log(`counts requirements=${report.counts.requirements} evidence=${report.counts.evidence} actions=${report.counts.actions} risks=${report.counts.risks} links=${report.counts.links}`);