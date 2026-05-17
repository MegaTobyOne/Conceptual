import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const expectedVersion = packageJson.version;
const versionMatch = expectedVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
assert.ok(versionMatch, `root package version should be semver, got ${expectedVersion}`);
const majorVersion = Number(versionMatch[1]);
const minorVersion = Number(versionMatch[2]);
const axesByMinorVersion = new Map([
  [7, "1.4.0"],
  [8, "1.5.0"],
  [9, "1.6.0"],
  [10, "1.7.0"],
  [11, "1.7.0"],
  [12, "1.7.0"],
  [13, "1.7.0"],
  [14, "1.7.0"],
  [15, "1.7.0"],
  [16, "1.8.0"],
  [17, "1.8.0"]
]);
const expectedAxes = axesByMinorVersion.get(minorVersion) ?? "1.3.0";
const isV1Release = majorVersion === 1;
const isV11OrLaterRelease = isV1Release && minorVersion >= 1;
const packagePaths = [
  "package.json",
  "packages/brief-renderer/package.json",
  "packages/contracts/package.json",
  "packages/core/package.json",
  "packages/explorer/package.json",
  "packages/ism-source-library/package.json",
  "packages/reference-data/package.json",
  "packages/shop/package.json",
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

const e2eScript = minorVersion >= 17 ? "e2e:v1.17" : minorVersion >= 16 ? "e2e:v1.16" : minorVersion >= 14 ? "e2e:v1.14" : minorVersion >= 13 ? "e2e:v1.13" : minorVersion >= 12 ? "e2e:v1.12" : minorVersion >= 11 ? "e2e:v1.11" : minorVersion >= 10 ? "e2e:v1.10" : /^1\.9\.\d+$/.test(expectedVersion) ? "e2e:v1.9" : /^1\.8\.\d+$/.test(expectedVersion) ? "e2e:v1.8" : /^1\.7\.\d+$/.test(expectedVersion) ? "e2e:v1.7" : /^1\.6\.\d+$/.test(expectedVersion) ? "e2e:v1.6" : /^1\.5\.\d+$/.test(expectedVersion) ? "e2e:v1.5" : /^1\.4\.\d+$/.test(expectedVersion) ? "e2e:v1.4" : /^1\.3\.\d+$/.test(expectedVersion) ? "e2e:v1.3" : /^1\.2\.\d+$/.test(expectedVersion) ? "e2e:v1.2" : isV11OrLaterRelease ? "e2e:v1.1" : isV1Release ? "e2e:v1.0" : "e2e:v0.9";
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
  "adr/0044-v1-10-change-records.md",
  "adr/0045-v1-11-explorer-change-story.md",
  "adr/0046-v1-12-planning-lens.md",
  "adr/0047-v1-13-release-assurance.md",
  "adr/0048-v1-14-compliance-history-export-controls.md",
  "adr/0050-v1-15-shop-commercial-planning-foundation.md",
  "adr/0051-v1-16-shop-canonical-commercial-entities.md",
  "adr/0052-v1-17-shop-core-backed-authoring.md",
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

const deferredPackages = minorVersion >= 15 ? ["packages/pub/README.md"] : ["packages/shop/README.md", "packages/pub/README.md"];
for (const deferredPackage of deferredPackages) {
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

if (/^1\.10\.\d+$/.test(expectedVersion)) {
  const v110Adr = await readFile(join(root, "adr/0044-v1-10-change-records.md"), "utf8");
  for (const requiredText of ["v1.10", "Change Record", "change-record", "change-records", "CHG", "changes", "1.7.0"]) {
    assert.equal(v110Adr.includes(requiredText), true, `v1.10 ADR should mention ${requiredText}`);
  }
  const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
  for (const requiredText of ["ChangeRecordEntity", "CHANGE_RECORD_TYPES", "change-record", "change-records", "CHG", "changes", "decisionOwnerRef"]) {
    assert.equal(contracts.includes(requiredText), true, `Contracts v1.10 change-record foundation should mention ${requiredText}`);
  }
  const explorer = await readFile(join(root, "packages/explorer/scripts/build-static.mjs"), "utf8");
  for (const requiredText of ["Why This Changed", "change-records", "Change reasons excluded", "Change decision owner excluded"]) {
    assert.equal(explorer.includes(requiredText), true, `Explorer v1.10 change-record surface should mention ${requiredText}`);
  }
  const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
  for (const requiredText of ["pspf.workshop.openChangeRecords", "pspf.workshop.recordSignificantChange", "Change Records", "Record Significant Change"]) {
    assert.equal(workshopExtension.includes(requiredText), true, `Workshop v1.10 change-record surface should mention ${requiredText}`);
  }
  assert.equal(existsSync(join(root, "schemas/explorer-bundle/1.7.0/collections/change-records.schema.json")), true, "v1.10 change-record schema should exist");
  assert.equal(typeof packageJson.scripts["e2e:v1.10"], "string", "root package should define e2e:v1.10");
  assert.equal(packageJson.scripts["e2e:v1.10"].includes("e2e:v1.9"), true, "e2e:v1.10 should include v1.9 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.10"), true, "release:readiness should run e2e:v1.10");
}

if (/^1\.12\.\d+$/.test(expectedVersion)) {
  const v112Adr = await readFile(join(root, "adr/0046-v1-12-planning-lens.md"), "utf8");
  for (const requiredText of ["v1.12", "Planning lens", "workshop-dashboard", "workshop-evidence-review", "Plan Lens", "1.7.0"]) {
    assert.equal(v112Adr.includes(requiredText), true, `v1.12 ADR should mention ${requiredText}`);
  }
  const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
  for (const requiredText of ["Create Dashboard view", "Create Evidence Review view", "openWorkshopDashboardSavedView", "openWorkshopEvidenceReviewSavedView"]) {
    assert.equal(workshopExtension.includes(requiredText), true, `Workshop v1.12 planning saved-view surface should mention ${requiredText}`);
  }
  const explorer = await readFile(join(root, "packages/explorer/scripts/build-static.mjs"), "utf8");
  for (const requiredText of ["Plan Lens", "planLensPanel", "planItemCount", "Planning lens over existing Actions"]) {
    assert.equal(explorer.includes(requiredText), true, `Explorer v1.12 plan lens should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.12"], "string", "root package should define e2e:v1.12");
  assert.equal(packageJson.scripts["e2e:v1.12"].includes("e2e:v1.11"), true, "e2e:v1.12 should include v1.11 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.12"), true, "release:readiness should run e2e:v1.12");
}

if (/^1\.13\.\d+$/.test(expectedVersion)) {
  const v113Adr = await readFile(join(root, "adr/0047-v1-13-release-assurance.md"), "utf8");
  for (const requiredText of ["v1.13", "Release assurance", "Marketplace", "dry_run", "Gallery API", "receipt tag", "1.7.0"]) {
    assert.equal(v113Adr.includes(requiredText), true, `v1.13 ADR should mention ${requiredText}`);
  }
  const marketplaceWorkflow = await readFile(join(root, ".github/workflows/marketplace.yml"), "utf8");
  for (const requiredText of ["run-name: Marketplace release / target=", "Dry-run summary", "Verify Marketplace version", "Verify receipt tag", "node scripts/verify-marketplace-version.mjs", "dry_run=false"]) {
    assert.equal(marketplaceWorkflow.includes(requiredText), true, `Marketplace v1.13 release assurance should mention ${requiredText}`);
  }
  const marketplaceVerifier = await readFile(join(root, "scripts/verify-marketplace-version.mjs"), "utf8");
  for (const requiredText of ["EXTENSION_ID", "EXPECTED_VERSION", "extensionquery", "filterType: 7", "MARKETPLACE_VERIFY_ATTEMPTS"]) {
    assert.equal(marketplaceVerifier.includes(requiredText), true, `Marketplace verifier should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.13"], "string", "root package should define e2e:v1.13");
  assert.equal(packageJson.scripts["e2e:v1.13"].includes("e2e:v1.12"), true, "e2e:v1.13 should include v1.12 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.13"), true, "release:readiness should run e2e:v1.13");
}

if (/^1\.14\.\d+$/.test(expectedVersion)) {
  const v114Adr = await readFile(join(root, "adr/0048-v1-14-compliance-history-export-controls.md"), "utf8");
  for (const requiredText of ["v1.14", "Compliance history export controls", "Include compliance history", "compliance-events", "1.7.0"]) {
    assert.equal(v114Adr.includes(requiredText), true, `v1.14 ADR should mention ${requiredText}`);
  }
  const explorer = await readFile(join(root, "packages/explorer/scripts/build-static.mjs"), "utf8");
  for (const requiredText of ["include-compliance-history", "Include compliance history", "includeComplianceHistoryInExport", "compliance-events", "pspfExplorerSetIncludeComplianceHistory"]) {
    assert.equal(explorer.includes(requiredText), true, `Explorer v1.14 compliance-history export surface should mention ${requiredText}`);
  }
  const localAuthoringCheck = await readFile(join(root, "scripts/check-explorer-local-authoring.mjs"), "utf8");
  for (const requiredText of ["Compliance history toggle defaults on", "Compliance history included by default", "Compliance history can be excluded", "compliance-events"]) {
    assert.equal(localAuthoringCheck.includes(requiredText), true, `Explorer local-authoring v1.14 check should mention ${requiredText}`);
  }
  const deployAction = await readFile(join(root, ".github/actions/ventraip-deploy/action.yml"), "utf8");
  for (const requiredText of ["explorer/index.html", "schemas/explorer-bundle", "refusing to deploy an empty release", "$DOCROOT/explorer/index.html"]) {
    assert.equal(deployAction.includes(requiredText), true, `VentraIP deploy guard should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.14"], "string", "root package should define e2e:v1.14");
  assert.equal(packageJson.scripts["e2e:v1.14"].includes("e2e:v1.13"), true, "e2e:v1.14 should include v1.13 gates");
  assert.equal(packageJson.scripts["e2e:v1.14"].includes("check:explorer-local-authoring"), true, "e2e:v1.14 should include Explorer local-authoring gate");
  assert.equal(packageJson.scripts["e2e:v1.14"].includes("check:explorer-to-workshop-import"), true, "e2e:v1.14 should include Explorer-to-Workshop import gate");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.14"), true, "release:readiness should run e2e:v1.14");
}

if (/^1\.15\.\d+$/.test(expectedVersion)) {
  const v115Adr = await readFile(join(root, "adr/0050-v1-15-shop-commercial-planning-foundation.md"), "utf8");
  for (const requiredText of ["v1.15", "Shop commercial planning foundation", "workspace-local JSON storage", "pspfShop", "tobyharvey.pspf-shop", "1.7.0"]) {
    assert.equal(v115Adr.includes(requiredText), true, `v1.15 ADR should mention ${requiredText}`);
  }
  const shopPackage = await readFile(join(root, "packages/shop/package.json"), "utf8");
  for (const requiredText of ["pspfShop.suppliersView", "pspfShop.contractsView", "pspfShop.spendView", "pspfShop.forecastView", "pspf.shop.newSupplier", "pspf.shop.newContract", "pspf.shop.newSpendItem"]) {
    assert.equal(shopPackage.includes(requiredText), true, `Shop extension package should mention ${requiredText}`);
  }
  const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
  for (const requiredText of ["SHOP_STORE_VERSION", ".pspf", "shop.json", "deriveForecast", "supplier", "contract", "spendItems"]) {
    assert.equal(shopExtension.includes(requiredText), true, `Shop extension runtime should mention ${requiredText}`);
  }
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.14"), true, "release:readiness should continue to run e2e:v1.14 for standalone Shop foundation");
}

if (/^1\.16\.\d+$/.test(expectedVersion)) {
  const v116Adr = await readFile(join(root, "adr/0051-v1-16-shop-canonical-commercial-entities.md"), "utf8");
  for (const requiredText of ["v1.16", "Shop canonical commercial entities", "supplier", "contract", "spend-item", "1.8.0"]) {
    assert.equal(v116Adr.includes(requiredText), true, `v1.16 ADR should mention ${requiredText}`);
  }
  for (const schemaPath of [
    "schemas/explorer-bundle/1.8.0/collections/suppliers.schema.json",
    "schemas/explorer-bundle/1.8.0/collections/contracts.schema.json",
    "schemas/explorer-bundle/1.8.0/collections/spend-items.schema.json"
  ]) {
    assert.equal(existsSync(join(root, schemaPath)), true, `${schemaPath} should exist`);
  }
  const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
  for (const requiredText of ["SupplierEntity", "ContractEntity", "SpendItemEntity", "suppliers", "contracts", "spend-items", "primaryContact", "restricted"]) {
    assert.equal(contracts.includes(requiredText), true, `Contracts v1.16 commercial entity surface should mention ${requiredText}`);
  }
  const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
  for (const requiredText of ["type SupplierEntity", "type ContractEntity", "type SpendItemEntity", "normaliseMoneyAmount", "mapSpendType", "moneyAmount"]) {
    assert.equal(shopExtension.includes(requiredText), true, `Shop v1.16 canonical local store should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.16"], "string", "root package should define e2e:v1.16");
  assert.equal(packageJson.scripts["e2e:v1.16"].includes("e2e:v1.14"), true, "e2e:v1.16 should include v1.14 gates");
  assert.equal(packageJson.scripts["e2e:v1.16"].includes("check:schema-coverage"), true, "e2e:v1.16 should include schema coverage");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.16"), true, "release:readiness should run e2e:v1.16");
}

if (/^1\.17\.\d+$/.test(expectedVersion)) {
  const v117Adr = await readFile(join(root, "adr/0052-v1-17-shop-core-backed-authoring.md"), "utf8");
  for (const requiredText of ["v1.17", "Shop Core-backed authoring", "Core", "local JSON", "1.8.0"]) {
    assert.equal(v117Adr.includes(requiredText), true, `v1.17 ADR should mention ${requiredText}`);
  }
  const shopPackage = await readFile(join(root, "packages/shop/package.json"), "utf8");
  for (const requiredText of ["tobyharvey.pspf-core", "pspf.shop.importLocalStore", "pspf.shop.editSupplier", "pspf.shop.deleteRecord"]) {
    assert.equal(shopPackage.includes(requiredText), true, `Shop v1.17 package should mention ${requiredText}`);
  }
  const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
  for (const requiredText of ["pspf.core.listEntities", "pspf.core.upsertEntities", "importLocalStore", "sanitiseEntityForPublication", "recordStatus: \"deleted\""]) {
    assert.equal(shopExtension.includes(requiredText), true, `Shop v1.17 Core-backed runtime should mention ${requiredText}`);
  }
  assert.equal(typeof packageJson.scripts["e2e:v1.17"], "string", "root package should define e2e:v1.17");
  assert.equal(packageJson.scripts["e2e:v1.17"].includes("e2e:v1.16"), true, "e2e:v1.17 should include v1.16 gates");
  assert.equal(packageJson.scripts["release:readiness"].includes("e2e:v1.17"), true, "release:readiness should run e2e:v1.17");
}

console.log(`ok v${expectedVersion} release-candidate scope, versions, scripts, and deferrals are consistent`);
