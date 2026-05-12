import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const extensionPackages = [
  {
    name: "Core",
    directory: "packages/core",
    expectedCommands: [
      "pspf.core.initialiseWorkspace",
      "pspf.core.validateWorkspace",
      "pspf.core.verifyIntegrity",
      "pspf.core.runIntegrityScan",
      "pspf.core.createSnapshot",
      "pspf.core.exportBundle",
      "pspf.core.importBundle",
      "pspf.core.showWriterLock"
    ]
  },
  {
    name: "Workshop",
    directory: "packages/workshop",
    dependency: "pspf.pspf-core",
    expectedCommands: [
      "pspf.workshop.openWelcome",
      "pspf.workshop.openHome",
      "pspf.workshop.loadSampleWorkspace",
      "pspf.workshop.createRequirement",
      "pspf.workshop.attachEvidence",
      "pspf.workshop.createAction",
      "pspf.workshop.createRisk",
      "pspf.workshop.openAssessmentDashboard",
      "pspf.workshop.openEvidenceReviewQueue",
      "pspf.workshop.openItemDetail",
      "pspf.workshop.browseIsmSourceControls",
      "pspf.workshop.createRequirementControlMapping",
      "pspf.workshop.registerDirection",
      "pspf.workshop.updateDirectionResponse",
      "pspf.workshop.openDirectionDetail",
      "pspf.workshop.copyPostureBrief"
    ]
  }
];

for (const extensionPackage of extensionPackages) {
  const packagePath = join(root, extensionPackage.directory, "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(manifest.private, true, `${extensionPackage.name} package remains private for rehearsal only`);
  assert.equal(manifest.publisher, "pspf", `${extensionPackage.name} publisher metadata is present`);
  assert.equal(manifest.main, "./dist/extension.js", `${extensionPackage.name} main points at built extension output`);
  await access(join(root, extensionPackage.directory, "dist", "extension.js"));
  const commands = new Set((manifest.contributes?.commands ?? []).map((command) => command.command));
  for (const expectedCommand of extensionPackage.expectedCommands) {
    assert.equal(commands.has(expectedCommand), true, `${extensionPackage.name} manifest contributes ${expectedCommand}`);
  }
  if (extensionPackage.name === "Workshop") {
    assert.equal(manifest.contributes?.viewsContainers?.activitybar?.some((container) => container.id === "pspfWorkshop"), true, "Workshop contributes an Activity Bar container");
    assert.equal(manifest.contributes?.views?.pspfWorkshop?.some((view) => view.id === "pspfWorkshop.homeView" && view.type === "webview"), true, "Workshop contributes the Home webview view");
  }
  if (extensionPackage.dependency) {
    assert.equal(manifest.extensionDependencies?.includes(extensionPackage.dependency), true, `${extensionPackage.name} declares Core extension dependency`);
  }
}

console.log("ok Core and Workshop extension package shapes match ADR 0007 rehearsal expectations");
