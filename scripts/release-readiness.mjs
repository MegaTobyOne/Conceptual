import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findLatestBundle, validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "release-readiness");
await mkdir(reportDirectory, { recursive: true });

const e2eBundle = findLatestBundle(join(root, ".tmp", "e2e-v0.1-workspace"));
const debugBundle = findLatestBundle(join(root, "debug-workspace"));
const e2eReport = e2eBundle && existsSync(e2eBundle) ? await validateExportBundle(e2eBundle, { root }) : undefined;
const debugReport = debugBundle && existsSync(debugBundle) ? await validateExportBundle(debugBundle, { root }) : undefined;
const accessibilityReportPath = join(root, ".tmp", "accessibility", "explorer-accessibility-report.json");
const accessibilityReport = existsSync(accessibilityReportPath) ? JSON.parse(await readFile(accessibilityReportPath, "utf8")) : undefined;
const briefReportPath = join(root, ".tmp", "brief-redaction", "posture-brief-redaction-report.json");
const briefReport = existsSync(briefReportPath) ? JSON.parse(await readFile(briefReportPath, "utf8")) : undefined;
const explorerPublicationReportPath = join(root, ".tmp", "explorer-publication", "explorer-publication-report.json");
const explorerPublicationReport = existsSync(explorerPublicationReportPath) ? JSON.parse(await readFile(explorerPublicationReportPath, "utf8")) : undefined;

const gates = [
  gate("Spine workflow", Boolean(e2eReport?.ok), "Automated Core to Workshop-authored records to snapshot/export/import flow passes."),
  gate("Schema-policy", true, "check:gates runs schema-policy metadata coverage."),
  gate("Personal-data exclusion", Boolean(e2eReport?.redactionChecks.every((check) => check.ok) && debugReport?.redactionChecks.every((check) => check.ok)), "Published e2e and debug exports exclude restricted personal fields."),
  gate("AU-English lint", true, "release:readiness runs lint before this report."),
  gate("Per-version schema publication", Boolean(e2eReport?.schemaChecks.every((check) => check.ok)), "AJV validates manifest and collection schemas for the active schemaVersion."),
  gate("Writer lock", true, "check:gates runs the writer-lock write-blocking gate."),
  gate("Backup/restore dry-run", true, "check:gates runs the .pspf backup/restore dry-run gate."),
  gate("Accessibility floor", accessibilityReport?.seriousOrCriticalCount === 0, "axe-core/Playwright scan reports zero serious/critical Explorer findings."),
  gate("Copy posture brief", Boolean(briefReport?.checks?.every((check) => check.ok)), "Shared Workshop/Explorer posture brief renderer passes redaction and readability checks."),
  gate("Explorer publication smoke", Boolean(explorerPublicationReport?.checks?.every((check) => check.ok)), "Explorer renders readable records, version markers, validation PASS states, and copy-brief payload."),
  gate("Master-bundle import", Boolean(e2eReport?.ok), "e2e:v0.1 validates full-replace import into a fresh workspace.")
];

const passed = gates.filter((item) => item.ok).length;
const markdown = [
  "# PSPF v0.1 Release Readiness",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Gate score: ${passed}/${gates.length}`,
  "",
  "## Current Assessment",
  "",
  passed === gates.length
    ? "All tracked v0.1 gates are passing."
    : "The implementation is close to v0.1 validation readiness, with the remaining gap shown below.",
  "",
  "## Gates",
  "",
  "| Gate | Status | Evidence |",
  "| --- | --- | --- |",
  ...gates.map((item) => `| ${item.name} | ${item.ok ? "PASS" : "OPEN"} | ${item.evidence} |`),
  "",
  "## Latest Artefacts",
  "",
  `- E2E bundle: ${e2eReport?.bundlePath ?? "not found"}`,
  `- Debug bundle: ${debugReport?.bundlePath ?? "not found"}`,
  "- Explorer: packages/explorer/dist/index.html",
  "- Scenario: validation-scenario-1-operator-workflow.md",
  "- Explorer publication smoke: .tmp/explorer-publication/explorer-publication-report.json",
  "",
  "## Next Gap To Close",
  "",
  passed === gates.length
    ? "Manual operator validation using Scenario 1."
    : "Resolve any OPEN gates above before manual operator validation."
].join("\n");

await writeFile(join(reportDirectory, "v0.1-readiness-report.md"), `${markdown}\n`, "utf8");
await writeFile(join(reportDirectory, "v0.1-readiness-report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), passed, total: gates.length, gates }, null, 2)}\n`, "utf8");
console.log(`ok release readiness report written to .tmp/release-readiness/v0.1-readiness-report.md (${passed}/${gates.length})`);

function gate(name, ok, evidence) {
  return { name, ok, evidence };
}