import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const expectedVersion = packageJson.version;
const expectedAxes = "1.3.0";
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

const e2eScript = expectedVersion === "1.0.0" ? "e2e:v1.0" : "e2e:v0.9";
for (const scriptName of [e2eScript, "check:release-candidate", "check:gates", "validate:debug-workspace", "release:readiness"]) {
  assert.equal(typeof packageJson.scripts[scriptName], "string", `root package should define ${scriptName}`);
}

for (const requiredPath of [
  "adr/0027-v0-9-release-candidate-freeze.md",
  "validation-scenario-1-operator-workflow.md",
  expectedVersion === "1.0.0" ? "adr/0028-v1-0-initial-assurance-user-testing-release.md" : "adr/0027-v0-9-release-candidate-freeze.md",
  "adr/0029-v1-0-reference-data-baseline.md",
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

if (expectedVersion === "1.0.0") {
  const referenceBaselineAdr = await readFile(join(root, "adr/0029-v1-0-reference-data-baseline.md"), "utf8");
  for (const requiredText of ["218", "GOV", "RISK", "INFO", "TECH", "PER", "PHYS", "v2026.03.24", "no runtime egress"]) {
    assert.equal(referenceBaselineAdr.includes(requiredText), true, `reference baseline ADR should mention ${requiredText}`);
  }
}

console.log(`ok v${expectedVersion} release-candidate scope, versions, scripts, and deferrals are consistent`);
