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
  "sourceMode",
  "fixtureName",
  "validateRiskSourceProfile",
  "validateRiskSourceBaseUrl",
  "riskSourceLiveUrl",
  "riskSourceLogDirectoryUri",
  "risk-source-runs",
  "writeRiskSourceRunLog",
  "redactDiagnostics",
  "isIncomingRiskError",
  "Select 6clicks risks to apply",
  "writeRiskSourceConfig",
  "6clicks-risk-v1",
  "Apply source values"
]) {
  assert.equal(workshopExtension.includes(requiredText), true, `Workshop integration should mention ${requiredText}`);
}

for (const settingsPanelText of [
  "PSPF Integration Settings",
  "<h1>Integration Setup</h1>",
  'data-command="pspf.workshop.openRiskSourceSettings"',
  'data-command="pspf.workshop.setRiskSourceCredential"',
  'data-command="pspf.workshop.previewRiskSourceImport"',
  'data-command="pspf.workshop.applyRiskSourceImport"',
  'data-command="pspf.workshop.openRiskSourcePanel"'
]) {
  assert.equal(
    workshopExtension.includes(settingsPanelText),
    true,
    `Workshop Settings panel should surface ${settingsPanelText}`
  );
}

assert.equal(workshopPackage.includes('"fixture"'), true, "Workshop should expose fixture mode");
assert.equal(workshopPackage.includes('"live"'), true, "Workshop should expose live mode");
assert.equal(
  workshopExtension.includes('url.protocol === "https:"'),
  true,
  "Workshop should require HTTPS for live 6clicks sources"
);
assert.equal(
  workshopExtension.includes('secretRef: sourceMode === "live" ? riskSourceSecretKey : undefined') &&
    workshopExtension.includes('profile.sourceMode === "fixture"') &&
    workshopExtension.includes("profile.secretRef"),
  true,
  "Workshop should keep fixture mode credential-free"
);
assert.equal(
  workshopExtension.includes("canPickMany: true"),
  true,
  "Workshop apply should require operator record selection"
);
assert.equal(
  /allow-?list/i.test(workshopExtension),
  false,
  "Workshop v1.31 should not introduce endpoint allow-listing"
);

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
assert.equal(contracts.includes('"none"'), true, "contracts should allow fixture-mode local auth metadata");

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

console.log("ok v1.31 risk source integration hardening, config, commands, redaction, and schema are covered");
