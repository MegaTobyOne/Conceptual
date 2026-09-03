#!/usr/bin/env node
// R1 gate (v1.71.0, ADR 0097 "Brief once, act often"): asserts the Reporting Workbench slice is
// wired end to end without a build. Fails when the reporting-pack primitive is missing or not
// re-exported, when the executive brief section order drifts, when the named behavioural tests are
// absent, when the Workshop/Core hosts stop calling the primitive or registering their commands,
// when the surface budget or its ADR reference is wrong, or when reporting-pack.ts references
// restricted person/summary/effort fields or US spellings.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const passed = [];
const check = (condition, message) => {
  assert.ok(condition, message);
  passed.push(message);
};
const exists = async (relativePath) => {
  try {
    await access(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
};

// 1. Primitive exists, exports the five functions, and is re-exported from the package index.
const reportingPackPath = "packages/brief-renderer/src/reporting-pack.ts";
check(await exists(reportingPackPath), `${reportingPackPath} exists`);
const reportingPack = await readFile(join(root, reportingPackPath), "utf8");
for (const fn of [
  "buildReportingPackModel",
  "renderReportingPackMarkdown",
  "renderReportingPackPlainText",
  "renderExecutiveBriefMarkdown",
  "renderExecutiveBriefPlainText"
]) {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(reportingPack), `reporting-pack.ts exports ${fn}`);
}
const briefRendererIndex = await readFile(join(root, "packages/brief-renderer/src/index.ts"), "utf8");
check(
  /^export \* from "\.\/reporting-pack\.js";/m.test(briefRendererIndex),
  'packages/brief-renderer/src/index.ts re-exports "./reporting-pack.js"'
);

// 2. Fixed executive section order.
const sectionHeadings = ["Where we stand", "What changed", "Top exposures", "Decisions needed"];
const headingIndices = sectionHeadings.map((heading) => reportingPack.indexOf(`"${heading}`));
headingIndices.forEach((index, position) => {
  check(index !== -1, `reporting-pack.ts defines the "${sectionHeadings[position]}" heading`);
});
for (let i = 1; i < headingIndices.length; i += 1) {
  check(
    headingIndices[i] > headingIndices[i - 1],
    `"${sectionHeadings[i - 1]}" is defined before "${sectionHeadings[i]}" in reporting-pack.ts`
  );
}

// 3. Behavioural tests are present by literal name.
const reportingPackTestPath = "packages/brief-renderer/src/reporting-pack.test.ts";
check(await exists(reportingPackTestPath), `${reportingPackTestPath} exists`);
const reportingPackTests = await readFile(join(root, reportingPackTestPath), "utf8");
for (const testName of [
  "executive brief sections follow the fixed order",
  "verdict sentence precedes bullets in every rendered section",
  "identical input produces identical model and renders",
  "plain text renderers contain no markdown syntax"
]) {
  check(reportingPackTests.includes(`test("${testName}"`), `reporting-pack.test.ts has test "${testName}"`);
}

// 4. Workshop wiring.
const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
const briefRendererImport = workshopExtension.match(/import\s*\{([^}]*)\}\s*from\s*"@pspf\/brief-renderer"/);
check(briefRendererImport !== null, 'Workshop extension.ts imports from "@pspf/brief-renderer"');
check(
  /\bbuildReportingPackModel\b/.test(briefRendererImport[1]),
  "Workshop extension.ts imports buildReportingPackModel from @pspf/brief-renderer"
);
check(
  /registerCommand\(\s*"pspf\.workshop\.openReportingWorkbench"/.test(workshopExtension),
  "Workshop extension.ts registers pspf.workshop.openReportingWorkbench"
);
check(
  workshopExtension.includes("renderExecutiveBriefPlainText"),
  "Workshop extension.ts uses renderExecutiveBriefPlainText"
);
const workshopPackage = JSON.parse(await readFile(join(root, "packages/workshop/package.json"), "utf8"));
check(
  (workshopPackage.contributes?.commands ?? []).some(
    (entry) => entry.command === "pspf.workshop.openReportingWorkbench"
  ),
  "Workshop package.json contributes command pspf.workshop.openReportingWorkbench"
);
const workshopConfiguration = workshopPackage.contributes?.configuration;
const configurationProperties = Array.isArray(workshopConfiguration)
  ? Object.assign({}, ...workshopConfiguration.map((section) => section.properties ?? {}))
  : (workshopConfiguration?.properties ?? {});
check(
  Object.hasOwn(configurationProperties, "pspf.workshop.myDomains"),
  "Workshop package.json contributes configuration pspf.workshop.myDomains"
);
for (const file of [
  "packages/workshop/src/reporting-workbench.ts",
  "packages/workshop/src/reporting-workbench.test.ts"
]) {
  check(await exists(file), `${file} exists`);
}

// 5. Core wiring: snapshot side file carries recordStatus; anchors are listable.
const coreService = await readFile(join(root, "packages/core/src/service.ts"), "utf8");
const createSnapshotStart = coreService.search(/^async function createSnapshot\(/m);
check(createSnapshotStart !== -1, "Core service.ts defines createSnapshot");
const createSnapshotBody = coreService.slice(createSnapshotStart, createSnapshotStart + 2000);
const sideFileWrite = createSnapshotBody.indexOf("writeJson(join(paths.snapshots");
check(sideFileWrite !== -1, "createSnapshot writes the snapshot side file via writeJson(join(paths.snapshots");
check(
  /recordStatus\s*:/.test(createSnapshotBody.slice(sideFileWrite, sideFileWrite + 600)),
  "createSnapshot side file payload includes recordStatus"
);
check(
  /^export async function listSnapshotSideFiles\(/m.test(coreService),
  "Core service.ts exports listSnapshotSideFiles"
);
const coreExtension = await readFile(join(root, "packages/core/src/extension.ts"), "utf8");
check(
  /registerCommand\(\s*"pspf\.core\.listSnapshotAnchors"/.test(coreExtension),
  "Core extension.ts registers pspf.core.listSnapshotAnchors"
);

// 6. Surface budget recorded against ADR 0097.
const baselinePath = "scripts/lib/essentials-surface-baseline.json";
const baseline = JSON.parse(await readFile(join(root, baselinePath), "utf8"));
check(baseline.workshopCommands === 72, `${baselinePath} workshopCommands is 72 (found ${baseline.workshopCommands})`);
check(
  baseline.workshopWebviewPanels === 30,
  `${baselinePath} workshopWebviewPanels is 30 (found ${baseline.workshopWebviewPanels})`
);
check(
  typeof baseline.recordedAtAdr === "string" && /^adr\/0097-.*\.md$/.test(baseline.recordedAtAdr),
  `${baselinePath} recordedAtAdr points at the ADR 0097 file (found ${baseline.recordedAtAdr})`
);
check(await exists(baseline.recordedAtAdr), `${baseline.recordedAtAdr} exists`);
const essentialsCommandsDoc = await readFile(join(root, "docs/workshop-essentials-commands.md"), "utf8");
check(
  /^- `pspf\.workshop\.openReportingWorkbench`/m.test(essentialsCommandsDoc),
  "docs/workshop-essentials-commands.md lists pspf.workshop.openReportingWorkbench"
);

// 7. Publication safety (ADR 0005 default-deny): no restricted person fields, record summaries, or effort basis.
for (const token of [".email", "personId", "decisionOwnerRef", "person.name", ".summary", "effortBasis"]) {
  check(!reportingPack.includes(token), `reporting-pack.ts does not reference ${token}`);
}

// 8. AU English.
for (const usSpelling of ["organization", "prioritize", "analyze"]) {
  check(!new RegExp(usSpelling, "i").test(reportingPack), `reporting-pack.ts does not use "${usSpelling}"`);
}

console.log(`ok check-reporting-workbench: ${passed.length} assertions passed`);
for (const message of passed) {
  console.log(`  - ${message}`);
}
