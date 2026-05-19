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
    dependency: "tobyharvey.pspf-core",
    expectedCommands: [
      "pspf.workshop.openWelcome",
      "pspf.workshop.openHome",
      "pspf.workshop.loadSampleWorkspace",
      "pspf.workshop.createRequirement",
      "pspf.workshop.attachEvidence",
      "pspf.workshop.createAction",
      "pspf.workshop.createRisk",
      "pspf.workshop.openAssessmentDashboard",
      "pspf.workshop.openStrategyMap",
      "pspf.workshop.openEvidenceReviewQueue",
      "pspf.workshop.openItemDetail",
      "pspf.workshop.browseIsmSourceControls",
      "pspf.workshop.createRequirementControlMapping",
      "pspf.workshop.registerDirection",
      "pspf.workshop.updateDirectionResponse",
      "pspf.workshop.openDirectionDetail",
      "pspf.workshop.copyPostureBrief"
    ]
  },
  {
    name: "Shop",
    directory: "packages/shop",
    dependency: "tobyharvey.pspf-core",
    expectedCommands: [
      "pspf.shop.openHome",
      "pspf.shop.loadSample",
      "pspf.shop.importLocalStore",
      "pspf.shop.newSupplier",
      "pspf.shop.newContract",
      "pspf.shop.newSpendItem",
      "pspf.shop.openForecast",
      "pspf.shop.editSupplier",
      "pspf.shop.editContract",
      "pspf.shop.editSpendItem",
      "pspf.shop.deleteRecord",
      "pspf.shop.linkSupplierToRequirement",
      "pspf.shop.linkSupplierToRisk",
      "pspf.shop.linkContractToRequirement",
      "pspf.shop.linkContractToSpendItem",
      "pspf.shop.linkSpendToAction",
      "pspf.shop.linkSpendToRequirement"
    ]
  }
];

for (const extensionPackage of extensionPackages) {
  const packagePath = join(root, extensionPackage.directory, "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(manifest.private, true, `${extensionPackage.name} remains blocked from npm publishing; Marketplace publishing uses vsce`);
  assert.equal(manifest.license, "MIT", `${extensionPackage.name} package declares the MIT licence`);
  assert.equal(manifest.repository?.url, "git+https://github.com/MegaTobyOne/Conceptual.git", `${extensionPackage.name} package declares the repository URL`);
  assert.equal(manifest.repository?.directory, extensionPackage.directory, `${extensionPackage.name} package repository directory is accurate`);
  assert.equal(manifest.publisher, "tobyharvey", `${extensionPackage.name} publisher metadata matches the v1.0 Marketplace publisher`);
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
  if (extensionPackage.name === "Shop") {
    assert.equal(manifest.contributes?.viewsContainers?.activitybar?.some((container) => container.id === "pspfShop"), true, "Shop contributes an Activity Bar container");
    assert.equal(manifest.contributes?.views?.pspfShop?.some((view) => view.id === "pspfShop.forecastView" && view.type === "webview"), true, "Shop contributes the Forecast webview view");
    assert.equal(manifest.contributes?.views?.pspfShop?.some((view) => view.id === "pspfShop.suppliersView"), true, "Shop contributes the Suppliers tree view");
    assert.equal(manifest.contributes?.views?.pspfShop?.some((view) => view.id === "pspfShop.contractsView"), true, "Shop contributes the Contracts tree view");
    assert.equal(manifest.contributes?.views?.pspfShop?.some((view) => view.id === "pspfShop.spendView"), true, "Shop contributes the Spend tree view");
  }
  if (extensionPackage.dependency) {
    assert.equal(manifest.extensionDependencies?.includes(extensionPackage.dependency), true, `${extensionPackage.name} declares Core extension dependency`);
  }
}

console.log("ok Core, Workshop, and Shop extension package shapes match the Marketplace deployment baseline");
