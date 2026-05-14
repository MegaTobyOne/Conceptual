import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const expectedVersion = packageJson.version;
const expectedAxes = "1.3.0";
const isV1Release = /^1\.(0|1|2|3|4)\.\d+$/.test(expectedVersion);
const isV11OrLaterRelease = /^1\.(1|2|3|4)\.\d+$/.test(expectedVersion);
const packagePaths = [
  "package.json",
  "packages/brief-renderer/package.json",
  "packages/contracts/package.json",
  "packages/core/package.json",
  "packages/explorer/package.json",
  "packages/ism-source-library/package.json",
  "packages/workshop/package.json"
];

for (const packagePath of packagePaths) {
  const manifest = JSON.parse(await readFile(join(root, packagePath), "utf8"));
  assert.equal(manifest.version, expectedVersion, `${packagePath} version should be ${expectedVersion}`);
}

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
assert.match(contracts, new RegExp(`PSPF_SLICE_VERSION = "${expectedVersion.replaceAll(".", "\\.")}"`), `PSPF_SLICE_VERSION should be ${expectedVersion}`);
assert.match(contracts, new RegExp(`schemaVersion: "${expectedAxes}"`), "schemaVersion should stay 1.3.0");
assert.match(contracts, new RegExp(`bundleVersion: "${expectedAxes}"`), "bundleVersion should stay 1.3.0");
assert.match(contracts, new RegExp(`apiVersion: "${expectedAxes}"`), "apiVersion should stay 1.3.0");

const e2eScript = /^1\.4\.\d+$/.test(expectedVersion) ? "e2e:v1.4" : /^1\.3\.\d+$/.test(expectedVersion) ? "e2e:v1.3" : /^1\.2\.\d+$/.test(expectedVersion) ? "e2e:v1.2" : isV11OrLaterRelease ? "e2e:v1.1" : isV1Release ? "e2e:v1.0" : "e2e:v0.9";
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
  "pspf-reference-data-baseline-spec.md",
  "pspf-acceptance-and-quality-gates.md",
  "pspf-development-readiness-review.md",
  "pspf-spec-consistency-index.md"
]) {
  assert.equal(existsSync(join(root, requiredPath)), true, `${requiredPath} should exist`);
}

const scenario = await readFile(join(root, "validation-scenario-1-operator-workflow.md"), "utf8");
for (const requiredText of [`PSPF v${expectedVersion}`, "Schema 1.3.0", "Bundle 1.3.0", "Workshop Home", "status bar", "PSPF: Load Sample Workspace", "PSPF: Run Integrity Scan", "Directions", "Action Impact"]) {
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

console.log(`ok v${expectedVersion} release-candidate scope, versions, scripts, and deferrals are consistent`);
