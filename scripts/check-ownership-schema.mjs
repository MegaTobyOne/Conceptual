#!/usr/bin/env node
// R2 gate (v1.72.0, ADR 0097 "Brief once, act often"): asserts the ownership-and-narrative schema
// slice is complete without a build. Fails when the three version axes are not all 1.16.0, when the
// 1.16.0 schema directory is missing the narratives collection or the ownerTeam/dueDateHistory fields,
// when the historical 1.15.0 directory has been touched, when the narrative entity or the due-date and
// narrative primitives are absent from @pspf/contracts, when the new fields lack a `sensitive`
// publication policy, when the standard fixture does not exercise the new shape, when Core stops
// appending due-date history / enforcing narrative rules / moving legacy axes forward, when Workshop
// drops the owner-team editing and bulk-assign wiring, when the reporting pack loses its ownership
// readiness codes, when the named tests are missing, or when the surface budget drifts from 72/30.
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
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
const read = (relativePath) => readFile(join(root, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await read(relativePath));

const AXIS = "1.16.0";
const PRIOR_AXIS = "1.15.0";

// 1. Axes and schema directories.
const contracts = await read("packages/contracts/src/index.ts");
const axesBlock = contracts.match(/export const VERSION_AXES = \{([\s\S]*?)\} as const;/);
check(axesBlock !== null, "contracts index.ts declares VERSION_AXES");
for (const axis of ["schemaVersion", "bundleVersion", "apiVersion"]) {
  check(
    new RegExp(`\\b${axis}:\\s*"${AXIS.replace(/\./g, "\\.")}"`).test(axesBlock[1]),
    `VERSION_AXES.${axis} is ${AXIS}`
  );
}

const newSchemaDir = `schemas/explorer-bundle/${AXIS}`;
const priorSchemaDir = `schemas/explorer-bundle/${PRIOR_AXIS}`;
check(await exists(`${newSchemaDir}/manifest.schema.json`), `${newSchemaDir}/manifest.schema.json exists`);
const narrativesSchemaPath = `${newSchemaDir}/collections/narratives.schema.json`;
check(await exists(narrativesSchemaPath), `${narrativesSchemaPath} exists`);
const newActionsSchema = await read(`${newSchemaDir}/collections/actions.schema.json`);
for (const field of ["dueDateHistory", "ownerTeam"]) {
  check(newActionsSchema.includes(`"${field}"`), `${newSchemaDir} actions.schema.json declares ${field}`);
}
const newRequirementsSchema = await read(`${newSchemaDir}/collections/requirements.schema.json`);
check(newRequirementsSchema.includes('"ownerTeam"'), `${newSchemaDir} requirements.schema.json declares ownerTeam`);

check(await exists(`${priorSchemaDir}/collections`), `${priorSchemaDir}/collections still exists`);
const priorCollectionFiles = (await readdir(join(root, priorSchemaDir, "collections"))).sort();
check(
  !priorCollectionFiles.includes("narratives.schema.json"),
  `${priorSchemaDir} does not gain a narratives collection (historical directory untouched)`
);
for (const file of priorCollectionFiles) {
  const content = await read(`${priorSchemaDir}/collections/${file}`);
  assert.ok(!content.includes("ownerTeam"), `${priorSchemaDir}/collections/${file} must not mention ownerTeam`);
  assert.ok(
    !content.includes("dueDateHistory"),
    `${priorSchemaDir}/collections/${file} must not mention dueDateHistory`
  );
}
passed.push(
  `${priorSchemaDir} collections do not mention ownerTeam or dueDateHistory (${priorCollectionFiles.length} files)`
);
const priorRequirementsSchema = await read(`${priorSchemaDir}/collections/requirements.schema.json`);
check(
  priorRequirementsSchema.includes(PRIOR_AXIS),
  `${priorSchemaDir} requirements.schema.json still references ${PRIOR_AXIS}`
);
const newCollectionFiles = (await readdir(join(root, newSchemaDir, "collections"))).sort();
assert.deepEqual(
  newCollectionFiles.filter((file) => file !== "narratives.schema.json"),
  priorCollectionFiles,
  `${newSchemaDir} should publish the ${PRIOR_AXIS} collection set plus narratives only`
);
passed.push(`${newSchemaDir} publishes the ${PRIOR_AXIS} collection set plus narratives.schema.json`);

// 2. Contracts: narrative entity registration and R2 primitives.
const constBlock = (name) => {
  const match = contracts.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\] as const;`));
  assert.ok(match, `contracts index.ts declares ${name}`);
  return match[1];
};
check(/"narrative"/.test(constBlock("V0_1_ENTITY_TYPES")), 'V0_1_ENTITY_TYPES includes "narrative"');
check(/"narratives"/.test(constBlock("V0_1_COLLECTIONS")), 'V0_1_COLLECTIONS includes "narratives"');
check(/^\s*narrative:\s*"NAR",?$/m.test(contracts), 'contracts maps narrative to the "NAR" id prefix');
check(/^\s*narrative:\s*"narratives",?$/m.test(contracts), 'contracts maps narrative to the "narratives" collection');
for (const fn of ["appendDueDateHistory", "summariseSlippage", "validateNarrativeRules", "narrativeSlotFor"]) {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(contracts), `contracts exports ${fn}`);
}
check(contracts.includes('"PSPF_NARRATIVE_RULE_VIOLATION"'), "contracts declares PSPF_NARRATIVE_RULE_VIOLATION");

// 3. Publication policy (ADR 0005 default-deny) and the standard fixture.
const policiesMatch = contracts.match(
  /export const PUBLICATION_FIELD_POLICIES: readonly EntityFieldPolicy\[\] = \[([\s\S]*?)^\] as const;/m
);
check(policiesMatch !== null, "contracts declares PUBLICATION_FIELD_POLICIES");
const policyBlocks = policiesMatch[1].split(/(?=^\s*\{\s*\n\s*entityType:)/m);
const policyBlockFor = (entityType) => {
  const block = policyBlocks.find((entry) => new RegExp(`^\\s*entityType:\\s*"${entityType}",`, "m").test(entry));
  assert.ok(block, `PUBLICATION_FIELD_POLICIES has an entry for ${entityType}`);
  return block;
};
const expectSensitive = (entityType, field) => {
  const block = policyBlockFor(entityType);
  check(
    new RegExp(`\\{\\s*field:\\s*"${field}",\\s*publication:\\s*"sensitive"\\s*\\}`).test(block),
    `PUBLICATION_FIELD_POLICIES ${entityType}.${field} is sensitive`
  );
};
expectSensitive("action", "ownerTeam");
expectSensitive("action", "dueDateHistory");
expectSensitive("requirement", "ownerTeam");
expectSensitive("narrative", "body");

const fixturePath = "packages/contracts/test-fixtures/standard/bundle.json";
const fixture = await readJson(fixturePath);
for (const axis of ["schemaVersion", "bundleVersion", "apiVersion"]) {
  check(fixture.manifest?.[axis] === AXIS, `${fixturePath} manifest.${axis} is ${AXIS}`);
}
check(Array.isArray(fixture.collections?.narratives), `${fixturePath} has a narratives collection`);
check(
  (fixture.manifest?.collections ?? []).some((entry) => entry.name === "narratives"),
  `${fixturePath} manifest lists the narratives collection`
);
// The standard fixture is a publication-mode bundle: sensitive fields must already be stripped.
check(
  !(fixture.collections?.actions ?? []).some((action) => "dueDateHistory" in action || "ownerTeam" in action),
  `${fixturePath} actions carry no sensitive ownerTeam/dueDateHistory`
);
check(
  !(fixture.collections?.requirements ?? []).some((requirement) => "ownerTeam" in requirement),
  `${fixturePath} requirements carry no sensitive ownerTeam`
);
check(
  (fixture.collections?.narratives ?? []).length > 0 &&
    !(fixture.collections?.narratives ?? []).some((narrative) => "body" in narrative),
  `${fixturePath} narratives are present with body stripped`
);

// 4. Core wiring.
const coreService = await read("packages/core/src/service.ts");
check(coreService.includes("appendDueDateHistory("), "Core service.ts calls appendDueDateHistory(");
check(coreService.includes("validateNarrativeRules("), "Core service.ts calls validateNarrativeRules(");
check(/^function assertNarrativeRules\(/m.test(coreService), "Core service.ts defines assertNarrativeRules");
check(
  (coreService.match(/^\s*assertNarrativeRules\(/gm) ?? []).length >= 2,
  "Core service.ts enforces assertNarrativeRules on both import and write paths"
);
const emptyCollectionsStart = coreService.search(/^function createEmptyCollections\(/m);
check(emptyCollectionsStart !== -1, "Core service.ts defines createEmptyCollections");
const emptyCollectionsBody = coreService.slice(
  emptyCollectionsStart,
  coreService.indexOf("\n}\n", emptyCollectionsStart)
);
check(/\bnarratives:\s*\[\]/.test(emptyCollectionsBody), "createEmptyCollections seeds an empty narratives collection");
check(
  /^async function syncWorkspaceVersionMetadata\(/m.test(coreService),
  "Core service.ts defines syncWorkspaceVersionMetadata"
);
check(
  (coreService.match(/^\s*await syncWorkspaceVersionMetadata\(paths\);/gm) ?? []).length >= 1,
  "Core service.ts awaits syncWorkspaceVersionMetadata on a write path"
);
const coreServiceTests = await read("packages/core/src/service.test.ts");
check(
  /^test\("action writes append due-date history/m.test(coreServiceTests),
  'Core service.test.ts has test "action writes append due-date history…"'
);
check(coreServiceTests.includes("dueDateHistory"), "Core service.test.ts asserts on dueDateHistory");
check(
  /^test\("a same-major legacy workspace opens under the current axes/m.test(coreServiceTests),
  'Core service.test.ts has test "a same-major legacy workspace opens under the current axes…"'
);
check(coreServiceTests.includes(`"${PRIOR_AXIS}"`), `Core service.test.ts exercises a ${PRIOR_AXIS} legacy workspace`);

// 5. Workshop wiring.
for (const file of ["packages/workshop/src/owner-team.ts", "packages/workshop/src/owner-team.test.ts"]) {
  check(await exists(file), `${file} exists`);
}
const workshopExtension = await read("packages/workshop/src/extension.ts");
check(
  /^import\s*\{[^}]*\}\s*from\s*"\.\/owner-team\.js";/m.test(workshopExtension),
  'Workshop extension.ts imports from "./owner-team.js"'
);
const contractsImport = workshopExtension.match(/import\s*\{([^}]*)\}\s*from\s*"@pspf\/contracts"/);
check(contractsImport !== null, 'Workshop extension.ts imports from "@pspf/contracts"');
check(
  /\bsummariseSlippage\b/.test(contractsImport[1]),
  "Workshop extension.ts imports summariseSlippage from @pspf/contracts"
);
check(/^function ownerTeamField\(/m.test(workshopExtension), "Workshop extension.ts defines ownerTeamField");
check(
  (workshopExtension.match(/\$\{ownerTeamField\(/g) ?? []).length >= 2,
  "Workshop extension.ts renders ownerTeamField in both the requirement and action editors"
);
check(
  /^async function bulkAssignOwnerTeam\(/m.test(workshopExtension),
  "Workshop extension.ts defines bulkAssignOwnerTeam"
);
check(
  /message\.command === "bulkAssignOwner"/.test(workshopExtension),
  'Workshop extension.ts handles the "bulkAssignOwner" webview message'
);
check(workshopExtension.includes("summariseSlippage("), "Workshop extension.ts calls summariseSlippage(");
const workshopShell = await read("packages/workshop/src/webview/shell.ts");
check(/command === ['"]bulkAssignOwner['"]/.test(workshopShell), 'Workshop webview shell.ts handles "bulkAssignOwner"');

// 6. Reporting pack readiness codes and ownership in Decisions needed.
const reportingPack = await read("packages/brief-renderer/src/reporting-pack.ts");
for (const code of ["gap-without-owner", "action-without-owner"]) {
  check(reportingPack.includes(`| "${code}"`), `reporting-pack.ts declares readiness code "${code}"`);
  check(reportingPack.includes(`code: "${code}"`), `reporting-pack.ts emits readiness code "${code}"`);
}
const decisionsHeading = reportingPack.indexOf('heading: "Decisions needed"');
check(decisionsHeading !== -1, 'reporting-pack.ts builds the "Decisions needed" section');
check(
  reportingPack.lastIndexOf("ownerTeam", decisionsHeading) !== -1,
  "reporting-pack.ts derives the decision owner from ownerTeam ahead of the Decisions needed heading"
);

// 7. Contract tests exist.
for (const file of ["packages/contracts/src/due-date-history.test.ts", "packages/contracts/src/narrative.test.ts"]) {
  check(await exists(file), `${file} exists`);
}

// 8. Publication safety: runtime gate present and registered; schema and policy agree on narrative body.
const personalDataGate = "scripts/check-personal-data-exclusion.mjs";
check(await exists(personalDataGate), `${personalDataGate} exists (runtime redaction gate)`);
const rootPackage = await readJson("package.json");
check(
  (rootPackage.scripts?.["check:gates:run"] ?? "").includes(`node ${personalDataGate}`),
  `check:gates:run runs ${personalDataGate}`
);
const narrativesSchema = await readJson(narrativesSchemaPath);
const narrativeProperties = narrativesSchema.items?.properties ?? narrativesSchema.properties ?? {};
check(
  Object.hasOwn(narrativeProperties, "body"),
  "narratives.schema.json declares body as a property (schema agrees with policy)"
);
check(JSON.stringify(narrativesSchema).includes(`"${AXIS}"`), `narratives.schema.json pins schemaVersion ${AXIS}`);
const fixtureText = JSON.stringify(fixture);
for (const token of ['"email"', '"personId"', "decisionOwnerRef", "person.name"]) {
  check(!fixtureText.includes(token), `${fixturePath} does not contain ${token}`);
}

// 9. Surface budget unchanged from R1.
const baselinePath = "scripts/lib/essentials-surface-baseline.json";
const baseline = await readJson(baselinePath);
check(baseline.workshopCommands === 72, `${baselinePath} workshopCommands is 72 (found ${baseline.workshopCommands})`);
check(
  baseline.workshopWebviewPanels === 30,
  `${baselinePath} workshopWebviewPanels is 30 (found ${baseline.workshopWebviewPanels})`
);

console.log(`ok check-ownership-schema: ${passed.length} assertions passed`);
for (const message of passed) {
  console.log(`  - ${message}`);
}
