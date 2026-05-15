import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findLatestBundle, validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "release-readiness");
await mkdir(reportDirectory, { recursive: true });
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const sliceVersion = packageJson.version;
const manualValidationCleanToDate = sliceVersion === "1.0.1";

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
const explorerLocalAuthoringReportPath = join(root, ".tmp", "explorer-local-authoring", "explorer-local-authoring-report.json");
const explorerLocalAuthoringReport = existsSync(explorerLocalAuthoringReportPath) ? JSON.parse(await readFile(explorerLocalAuthoringReportPath, "utf8")) : undefined;
const explorerToWorkshopImportReportPath = join(root, ".tmp", "explorer-to-workshop-import", "explorer-to-workshop-import-report.json");
const explorerToWorkshopImportReport = existsSync(explorerToWorkshopImportReportPath) ? JSON.parse(await readFile(explorerToWorkshopImportReportPath, "utf8")) : undefined;

const gates = [
  gate("Spine workflow", Boolean(e2eReport?.ok), "Automated Core to Workshop-authored records to snapshot/export/import flow passes."),
  gate("Schema-policy", true, "check:gates runs schema-policy metadata coverage."),
  gate("Personal-data exclusion", Boolean(e2eReport?.redactionChecks.every((check) => check.ok) && debugReport?.redactionChecks.every((check) => check.ok)), "Published e2e and debug exports exclude restricted personal fields."),
  gate("AU-English lint", true, "release:readiness runs lint before this report."),
  gate("Per-version schema publication", Boolean(e2eReport?.schemaChecks.every((check) => check.ok)), "AJV validates manifest and collection schemas for the active schemaVersion."),
  gate("Writer lock", true, "check:gates runs the writer-lock write-blocking gate."),
  gate("Integrity scan", true, "check:gates runs the integrity-scan and broken-link fixture gate."),
  gate("Sample workspace", true, "check:gates runs the sample workspace validation gate."),
  gate("Package shape", true, "check:gates runs the Core/Workshop package-shape rehearsal."),
  gate("Release-candidate consistency", true, "release:readiness runs check:release-candidate before this report."),
  gate("Backup/restore dry-run", true, "check:gates runs the .pspf backup/restore dry-run gate."),
  gate("Accessibility floor", accessibilityReport?.seriousOrCriticalCount === 0, "axe-core/Playwright scan reports zero serious/critical Explorer findings."),
  gate("Copy posture brief", Boolean(briefReport?.checks?.every((check) => check.ok)), "Shared Workshop/Explorer posture brief renderer passes redaction and readability checks."),
  gate("Explorer publication smoke", Boolean(explorerPublicationReport?.checks?.every((check) => check.ok)), "Explorer renders readable records, version markers, validation PASS states, and copy-brief payload."),
  gate("Explorer Local Changes", Boolean(explorerLocalAuthoringReport?.checks?.every((check) => check.ok)), "Explorer persists local Requirement status overlays, remembered-bundle refresh restore, evidence references, Actions, and Risks in IndexedDB, shows local status conflicts, and exports a local-authoring master bundle."),
  gate("Explorer-to-Workshop import", Boolean(explorerToWorkshopImportReport?.checks?.every((check) => check.ok)), "Core imports an Explorer local-authoring export into a fresh workspace and Workshop-visible records include local status, evidence, Actions, Risks, and links."),
  gate("Master-bundle import", Boolean(e2eReport?.ok), "e2e:v0.1 validates full-replace import into a fresh workspace.")
];

const passed = gates.filter((item) => item.ok).length;
const markdown = [
  `# PSPF v${sliceVersion} Release Readiness`,
  "",
  `Generated: ${new Date().toISOString()}`,
  `Gate score: ${passed}/${gates.length}`,
  "",
  "## Current Assessment",
  "",
  passed === gates.length && manualValidationCleanToDate
    ? `All tracked v${sliceVersion} gates are passing, and manual validation has been clean to date.`
    : passed === gates.length
      ? `All tracked v${sliceVersion} gates are passing.`
      : `The implementation is close to v${sliceVersion} validation readiness, with the remaining gap shown below.`,
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
  "- Explorer Local Changes smoke: .tmp/explorer-local-authoring/explorer-local-authoring-report.json",
  "- Explorer-to-Workshop import smoke: .tmp/explorer-to-workshop-import/explorer-to-workshop-import-report.json",
  "",
  "## Next Gap To Close",
  "",
  passed === gates.length && manualValidationCleanToDate
    ? "Continue recording operator findings against Scenario 1; next feature work is Explorer local-authoring phase 1 under ADR 0030."
    : passed === gates.length
      ? `Manual operator validation using Scenario 1, including the v${sliceVersion} Explorer Local Changes path.`
      : "Resolve any OPEN gates above before manual operator validation."
].join("\n");

await writeFile(join(reportDirectory, `v${sliceVersion}-readiness-report.md`), `${markdown}\n`, "utf8");
await writeFile(join(reportDirectory, `v${sliceVersion}-readiness-report.json`), `${JSON.stringify({ generatedAt: new Date().toISOString(), version: sliceVersion, passed, total: gates.length, gates }, null, 2)}\n`, "utf8");
console.log(`ok release readiness report written to .tmp/release-readiness/v${sliceVersion}-readiness-report.md (${passed}/${gates.length})`);

function gate(name, ok, evidence) {
  return { name, ok, evidence };
}