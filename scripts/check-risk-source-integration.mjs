import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
const workshopPackage = await readFile(join(root, "packages/workshop/package.json"), "utf8");
const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
const riskSchema = JSON.parse(
  await readFile(join(root, "schemas/explorer-bundle/1.11.0/collections/risks.schema.json"), "utf8")
);

for (const requiredText of [
  "pspf.workshop.openRiskSourcePanel",
  "pspf.workshop.configureRiskSource",
  "pspf.workshop.previewRiskSourceImport",
  "pspf.workshop.applyRiskSourceImport",
  "riskSourceProfileKey",
  "riskSourcePreviewKey",
  "riskSourceRunsKey",
  "riskSourceSecretKey",
  "context.secrets.store(riskSourceSecretKey",
  "secrets.get(profile.secretRef)",
  ".pspf",
  "integrations.json",
  "writeRiskSourceConfig",
  "6clicks-risk-v1",
  "Apply source values"
]) {
  assert.equal(workshopExtension.includes(requiredText), true, `Workshop integration should mention ${requiredText}`);
}

for (const command of [
  "pspf.workshop.openRiskSourcePanel",
  "pspf.workshop.configureRiskSource",
  "pspf.workshop.testRiskSource",
  "pspf.workshop.previewRiskSourceImport",
  "pspf.workshop.applyRiskSourceImport",
  "pspf.workshop.viewRiskSourceRuns"
]) {
  assert.equal(workshopPackage.includes(command), true, `Workshop package should contribute ${command}`);
}

assert.equal(
  contracts.includes("export interface RiskIntegrationMetadata"),
  true,
  "contracts should define RiskIntegrationMetadata"
);
assert.equal(
  contracts.includes('{ field: "integration", publication: "sensitive" }'),
  true,
  "risk integration metadata should be sensitive by default"
);
assert.equal(
  contracts.includes("sourceLabel: entity.integration.sourceLabel") &&
    contracts.includes("remoteUpdatedAt: entity.integration.remoteUpdatedAt"),
  true,
  "publication sanitiser should keep only source label and source update"
);
assert.equal(contracts.includes("rawHash: entity.integration.rawHash"), false, "rawHash must not publish");
assert.equal(contracts.includes("authMode: entity.integration.authMode"), false, "authMode must not publish");
assert.equal(contracts.includes("remoteId: entity.integration.remoteId"), false, "remoteId must not publish");

const integrationSchema = riskSchema.items.properties.integration;
assert.equal(integrationSchema.type, "object", "risk integration schema should be an object");
assert.equal(integrationSchema.additionalProperties, false, "risk integration schema should deny extra fields");
assert.deepEqual(
  integrationSchema.required,
  ["sourceLabel"],
  "risk integration schema should require only sourceLabel"
);
assert.deepEqual(
  Object.keys(integrationSchema.properties).sort(),
  ["remoteUpdatedAt", "sourceLabel"],
  "published risk integration schema should expose only source label and source update"
);

console.log("ok v1.30 risk source integration config, commands, redaction, and schema are covered");
