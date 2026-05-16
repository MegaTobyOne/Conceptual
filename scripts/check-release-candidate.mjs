import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const expectedVersion = packageJson.version;
const expectedAxes = /^1\.9\.\d+$/.test(expectedVersion) ? "1.6.0" : /^1\.8\.\d+$/.test(expectedVersion) ? "1.5.0" : /^1\.7\.\d+$/.test(expectedVersion) ? "1.4.0" : "1.3.0";
const isV1Release = /^1\.(0|1|2|3|4|5|6|7|8|9)\.\d+$/.test(expectedVersion);
const isV11OrLaterRelease = /^1\.(1|2|3|4|5|6|7|8|9)\.\d+$/.test(expectedVersion);
const packagePaths = [
  "package.json",
  "packages/brief-renderer/package.json",
  "packages/contracts/package.json",
  "packages/core/package.json",
  "packages/explorer/package.json",
  "packages/ism-source-library/package.json",
  "packages/reference-data/package.json",
  "packages/workshop/package.json"
];

for (const packagePath of packagePaths) {
  const manifest = JSON.parse(await readFile(join(root, packagePath), "utf8"));
  assert.equal(manifest.version, expectedVersion, `${packagePath} version should be ${expectedVersion}`);
}

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
assert.match(contracts, new RegExp(`PSPF_SLICE_VERSION = "${expectedVersion.replaceAll(".", "\\.")}"`), `PSPF_SLICE_VERSION should be ${expectedVersion}`);
assert.match(contracts, new RegExp(`schemaVersion: "${expectedAxes}"`), `schemaVersion should be ${expectedAxes}`);
assert.match(contracts, new RegExp(`bundleVersion: "${expectedAxes}"`), `bundleVersion should be ${expectedAxes}`);
assert.match(contracts, new RegExp(`apiVersion: "${expectedAxes}"`), `apiVersion should be ${expectedAxes}`);

const e2eScript = /^1\.9\.\d+$/.test(expectedVersion) ? "e2e:v1.9" : /^1\.8\.\d+$/.test(expectedVersion) ? "e2e:v1.8" : /^1\.7\.\d+$/.test(expectedVersion) ? "e2e:v1.7" : /^1\.6\.\d+$/.test(expectedVersion) ? "e2e:v1.6" : /^1\.5\.\d+$/.test(expectedVersion) ? "e2e:v1.5" : /^1\.4\.\d+$/.test(expectedVersion) ? "e2e:v1.4" : /^1\.3\.\d+$/.test(expectedVersion) ? "e2e:v1.3" : /^1\.2\.\d+$/.test(expectedVersion) ? "e2e:v1.2" : isV11OrLaterRelease ? "e2e:v1.1" : isV1Release ? "e2e:v1.0" : "e2e:v0.9";
for (const scriptName of [e2eScript, "check:release-candidate", "check:gates", "validate:debug-workspace", "release:readiness"]) {
  assert.equal(typeof packageJson.scripts[scriptName], "string", `root package should define ${scriptName}`);
}

for (const requiredPath of [
  "adr/0027-v0-9-release-candidate-freeze.md",
  "validation-scenario-1-operator-workflow.md",
  isV1Release ? "adr/0028-v1-0-initial-assurance-user-testing-release.md" : "adr/0027-v0-9-release-candidate-freeze.md",
  "adr/0029-v1-0-reference-data-baseline.md",
  "adr/0030-v1-0-1-validation-closure-and-explorer-local-authoring-phase-1.md",
  "adr/0031-v1-1-explorer-local-authoring-phase-1.md",
  "adr/0032-v1-2-explorer-local-evidence-references.md",
  "adr/0033-v1-3-explorer-local-actions.md",
  "adr/0034-v1-4-explorer-local-risks-and-conflicts.md",
  "adr/0035-v1-5-plan-apply-import-and-undo.md",
  "adr/0036-v1-5-1-explorer-workshop-product-boundary-and-identity.md",
  "adr/0037-v1-6-workshop-import-review-and-identity.md",
  "adr/0041-v1-7-tags-and-filters-foundation.md",
  "adr/0042-v1-8-saved-views.md",
  "adr/0043-v1-9-saved-view-expansion.md",
  "pspf-reference-data-baseline-spec.md",
  "pspf-acceptance-and-quality-gates.md",
  "pspf-development-readiness-review.md",
  "pspf-spec-consistency-index.md"
]) {
  assert.equal(existsSync(join(root, requiredPath)), true, `${requiredPath} should exist`);
}

const scenario = await readFile(join(root, "validation-scenario-1-operator-workflow.md"), "utf8");
for (const requiredText of [`PSPF v${expectedVersion}`, `Schema ${expectedAxes}`, `Bundle ${expectedAxes}`, "Workshop Home", "status bar", "PSPF: Load Sample Workspace", "PSPF: Run Integrity Scan", "Directions", "Action Impact"]) {
  assert.equal(scenario.includes(requiredText), true, `validation scenario should mention ${requiredText}`);
}

for (const deferredPackage of ["packages/shop/README.md", "packages/pub/README.md"]) {
  const text = await readFile(join(root, deferredPackage), "utf8");
  assert.match(text, /deferred/i, `${deferredPackage} should remain a deferral note for ${expectedVersion}`);
}

if (isV1Release) {
  const referenceBaselineAdr = await readFile(join(root, "adr/0029-v1-0-reference-data-baseline.md"), "utf8");
  for (const requiredText of ["218", "GOV", "RISK", "INFO", "TECH", "PER", "PHYS", "v2026.03.24", "no runtime egress"]) {
    assert.equal(referenceBaselineAdr.includes(requiredText), true, `reference baseline ADR should mention ${requiredText}`);
  }

  const patchAdr = await readFile(join(root, "adr/0030-v1-0-1-validation-closure-and-explorer-local-authoring-phase-1.md"), "utf8");
  for (const requiredText of ["v1.0.1", "manual validation", "Explorer local-authoring phase 1", "IndexedDB", "1.3.0"]) {
    assert.equal(patchAdr.includes(requiredText), true, `v1.0.1 ADR should mention ${requiredText}`);
  }
}

if (isV11OrLaterRelease) {
  const v11Adr = await readFile(join(root, "adr/0031-v1-1-explorer-local-authoring-phase-1.md"), "utf8");
  for (const requiredText of ["v1.1", "IndexedDB", "assessmentStatus", "local-authoring", "1.3.0", "plan-apply"]) {
    assert.equal(v11Adr.includes(requiredText), true, `v1.1 ADR should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["check:explorer-local-authoring"], "string", "root package should define check:explorer-local-authoring");
}

if (/^1\.2\.\d+$/.test(expectedVersion)) {
  const v12Adr = await readFile(join(root, "adr/0032-v1-2-explorer-local-evidence-references.md"), "utf8");
  for (const requiredText of ["v1.2", "evidence", "supported-by", "IndexedDB", "1.3.0", "local-authoring"]) {
    assert.equal(v12Adr.includes(requiredText), true, `v1.2 ADR should mention ${requiredText}`);
  }
}

if (/^1\.3\.\d+$/.test(expectedVersion)) {
  const v13Adr = await readFile(join(root, "adr/0033-v1-3-explorer-local-actions.md"), "utf8");
  for (const requiredText of ["v1.3", "Action", "addressed-by", "IndexedDB", "1.3.0", "local-authoring"]) {
    assert.equal(v13Adr.includes(requiredText), true, `v1.3 ADR should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["check:explorer-to-workshop-import"], "string", "root package should define check:explorer-to-workshop-import");
  assert.equal(packageJson.scripts["e2e:v1.3"].includes("check:explorer-to-workshop-import"), true, "e2e:v1.3 should run Explorer-to-Workshop import gate");
}

if (/^1\.4\.\d+$/.test(expectedVersion)) {
  const v14Adr = await readFile(join(root, "adr/0034-v1-4-explorer-local-risks-and-conflicts.md"), "utf8");
  for (const requiredText of ["v1.4", "Risk", "exposed-by", "conflict", "IndexedDB", "1.3.0", "plan-apply"]) {
    assert.equal(v14Adr.includes(requiredText), true, `v1.4 ADR should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.4"], "string", "root package should define e2e:v1.4");
  assert.equal(packageJson.scripts["e2e:v1.4"].includes("e2e:v1.3"), true, "e2e:v1.4 should include v1.3 round-trip gates");
}

if (/^1\.(5|6)\.\d+$/.test(expectedVersion)) {
  const v15Adr = await readFile(join(root, "adr/0035-v1-5-plan-apply-import-and-undo.md"), "utf8");
  for (const requiredText of ["v1.5", "plan-apply", "read-only", "Apply Import", "Undo", "1.3.0", "manual operator validation was clean"]) {
    assert.equal(v15Adr.includes(requiredText), true, `v1.5 ADR should mention ${requiredText}`);
  }
  const v151Adr = await readFile(join(root, "adr/0036-v1-5-1-explorer-workshop-product-boundary-and-identity.md"), "utf8");
  for (const requiredText of ["v1.5.1", "Local Changes", "system of record", "portable assurance view", "1.3.0"]) {
    assert.equal(v151Adr.includes(requiredText), true, `v1.5.1 ADR should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.5"], "string", "root package should define e2e:v1.5");
  assert.equal(packageJson.scripts["e2e:v1.5"].includes("e2e:v1.4"), true, "e2e:v1.5 should include v1.4 gates");
}

if (/^1\.6\.\d+$/.test(expectedVersion)) {
  const v16Adr = await readFile(join(root, "adr/0037-v1-6-workshop-import-review-and-identity.md"), "utf8");
  for (const requiredText of ["v1.6", "PSPF Workshop Import Review", "System of record", "Apply Import", "Undo Import", "1.3.0"]) {
    assert.equal(v16Adr.includes(requiredText), true, `v1.6 ADR should mention ${requiredText}`);
  }
  const coreExtension = await readFile(join(root, "packages/core/src/extension.ts"), "utf8");
  for (const requiredText of ["pspfWorkshopImportReview", "PSPF Workshop Import Review", "Apply Import", "Show Details", "Cancel", "System of record import review"]) {
    assert.equal(coreExtension.includes(requiredText), true, `Core import review surface should mention ${requiredText}`);
  }
  const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
  for (const requiredText of ["System of record", "Workshop is the decision surface", "Local workspace writes stay in Workshop"]) {
    assert.equal(workshopExtension.includes(requiredText), true, `Workshop identity should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.6"], "string", "root package should define e2e:v1.6");
  assert.equal(packageJson.scripts["e2e:v1.6"].includes("e2e:v1.5"), true, "e2e:v1.6 should include v1.5 gates");
  assert.equal(packageJson.scripts["e2e:v1.6"].includes("check:explorer-to-workshop-import"), true, "e2e:v1.6 should include Explorer-to-Workshop import gate");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.6"), true, "release:readiness should run e2e:v1.6");
}

if (/^1\.7\.\d+$/.test(expectedVersion)) {
  const v17Adr = await readFile(join(root, "adr/0041-v1-7-tags-and-filters-foundation.md"), "utf8");
  for (const requiredText of ["v1.7", "tagged-with", "1.4.0", "indexes/by-tag.json", "Tag.description", "Requirements"]) {
    assert.equal(v17Adr.includes(requiredText), true, `v1.7 ADR should mention ${requiredText}`);
  }
  const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
  for (const requiredText of ["DEFAULT_TAG_COLOUR", "TAG_LIMITS", "normaliseTagLabel", "tagged-with"]) {
    assert.equal(contracts.includes(requiredText), true, `Contracts tag foundation should mention ${requiredText}`);
  }
  const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
  for (const requiredText of ["pspf.workshop.manageTags", "pspf.workshop.applyTag", "pspf.workshop.removeTag", "pspf.workshop.filterRequirementsByTag"]) {
    assert.equal(workshopExtension.includes(requiredText), true, `Workshop tag command should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.7"], "string", "root package should define e2e:v1.7");
  assert.equal(packageJson.scripts["e2e:v1.7"].includes("e2e:v1.6"), true, "e2e:v1.7 should include v1.6 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.7"), true, "release:readiness should run e2e:v1.7");
}

if (/^1\.8\.\d+$/.test(expectedVersion)) {
  const v18Adr = await readFile(join(root, "adr/0042-v1-8-saved-views.md"), "utf8");
  for (const requiredText of ["v1.8", "Saved views", "saved-view", "saved-views", "SVW", "1.5.0", "filters.query"]) {
    assert.equal(v18Adr.includes(requiredText), true, `v1.8 ADR should mention ${requiredText}`);
  }
  const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
  for (const requiredText of ["SavedViewEntity", "normaliseSavedViewName", "SAVED_VIEW_REQUIREMENT_COLUMNS", "saved-view", "SVW"]) {
    assert.equal(contracts.includes(requiredText), true, `Contracts saved-view foundation should mention ${requiredText}`);
  }
  const explorer = await readFile(join(root, "packages/explorer/scripts/build-static.mjs"), "utf8");
  for (const requiredText of ["Saved views", "saveCurrentRequirementsView", "applySavedView", "requirement-saved-views", "saved-views"]) {
    assert.equal(explorer.includes(requiredText), true, `Explorer saved-view surface should mention ${requiredText}`);
  }
  assert.equal(existsSync(join(root, "schemas/explorer-bundle/1.5.0/collections/saved-views.schema.json")), true, "v1.8 saved-view schema should exist");
  assert.equal(typeof packageJson.scripts["e2e:v1.8"], "string", "root package should define e2e:v1.8");
  assert.equal(packageJson.scripts["e2e:v1.8"].includes("e2e:v1.7"), true, "e2e:v1.8 should include v1.7 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.8"), true, "release:readiness should run e2e:v1.8");
}

if (/^1\.9\.\d+$/.test(expectedVersion)) {
  const v19Adr = await readFile(join(root, "adr/0043-v1-9-saved-view-expansion.md"), "utf8");
  for (const requiredText of ["v1.9", "explorer-relationships", "workshop-requirements", "1.6.0", "Reload your PSPF JSON"]) {
    assert.equal(v19Adr.includes(requiredText), true, `v1.9 ADR should mention ${requiredText}`);
  }
  const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
  for (const requiredText of ["explorer-requirements", "explorer-relationships", "workshop-requirements", "SAVED_VIEW_RELATIONSHIP_COLUMNS", "SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS"]) {
    assert.equal(contracts.includes(requiredText), true, `Contracts v1.9 saved-view expansion should mention ${requiredText}`);
  }
  const explorer = await readFile(join(root, "packages/explorer/scripts/build-static.mjs"), "utf8");
  for (const requiredText of ["Relationship views", "saveCurrentRelationshipsView", "Reload your PSPF JSON", "explorer-relationships"]) {
    assert.equal(explorer.includes(requiredText), true, `Explorer v1.9 saved-view surface should mention ${requiredText}`);
  }
  const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
  for (const requiredText of ["pspf.workshop.manageSavedViews", "Saved Views", "workshop-requirements", "openWorkshopRequirementsView"]) {
    assert.equal(workshopExtension.includes(requiredText), true, `Workshop v1.9 saved-view surface should mention ${requiredText}`);
  }
  assert.equal(existsSync(join(root, "schemas/explorer-bundle/1.6.0/collections/saved-views.schema.json")), true, "v1.9 saved-view schema should exist");
  assert.equal(typeof packageJson.scripts["e2e:v1.9"], "string", "root package should define e2e:v1.9");
  assert.equal(packageJson.scripts["e2e:v1.9"].includes("e2e:v1.8"), true, "e2e:v1.9 should include v1.8 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.9"), true, "release:readiness should run e2e:v1.9");
}

console.log(`ok v${expectedVersion} release-candidate scope, versions, scripts, and deferrals are consistent`);
