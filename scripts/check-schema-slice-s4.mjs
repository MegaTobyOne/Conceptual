// S4 (v1.57.0, ADR 0091): the one batched schema-axis bump for this UX
// stream. Asserts VERSION_AXES moved to 1.15.0 together, the new schema
// directory exists, the two new fields have declared publication policy,
// and Workshop exposes them for editing.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PUBLICATION_FIELD_POLICIES, VERSION_AXES } from "../packages/contracts/dist/index.js";

const root = process.cwd();

assert.equal(VERSION_AXES.schemaVersion, "1.15.0", "schemaVersion should be 1.15.0");
assert.equal(VERSION_AXES.bundleVersion, "1.15.0", "bundleVersion should move with schemaVersion");
assert.equal(VERSION_AXES.apiVersion, "1.15.0", "apiVersion should move with schemaVersion");

const priorSchemaDir = join(root, "schemas/explorer-bundle/1.14.0/collections");
const newSchemaDir = join(root, "schemas/explorer-bundle/1.15.0/collections");
assert.equal(existsSync(newSchemaDir), true, "schemas/explorer-bundle/1.15.0/collections should exist");
assert.deepEqual(
  readdirSync(newSchemaDir).sort(),
  readdirSync(priorSchemaDir).sort(),
  "1.15.0 should publish the same collection set as 1.14.0"
);

const priorContent = readFileSync(
  join(root, "schemas/explorer-bundle/1.14.0/collections/requirements.schema.json"),
  "utf8"
);
assert.equal(
  priorContent.includes("1.14.0"),
  true,
  "the historic 1.14.0 schema directory must remain byte-identical (still references 1.14.0)"
);

const requirementPolicy = PUBLICATION_FIELD_POLICIES.find((policy) => policy.entityType === "requirement");
const actionPolicy = PUBLICATION_FIELD_POLICIES.find((policy) => policy.entityType === "action");
assert.ok(requirementPolicy, "requirement should have a publication policy");
assert.ok(actionPolicy, "action should have a publication policy");
for (const field of ["acceptanceDefinition", "acceptanceDefinitionUpdatedAt"]) {
  const policy = requirementPolicy.fields.find((entry) => entry.field === field);
  assert.ok(policy, `requirement.${field} should have a declared publication policy`);
  assert.equal(policy.publication, "sensitive", `requirement.${field} should be sensitive`);
}
const blockerClassPolicy = actionPolicy.fields.find((entry) => entry.field === "blockerClass");
assert.ok(blockerClassPolicy, "action.blockerClass should have a declared publication policy");
assert.equal(blockerClassPolicy.publication, "sensitive", "action.blockerClass should be sensitive");

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
assert.match(
  contracts,
  /export type BlockerClass = "us" \| "funding" \| "assessor" \| "supplier"/,
  "BlockerClass should include the operator-set supplier class"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.equal(
  workshopExtension.includes('"acceptanceDefinition"'),
  true,
  "Workshop requirement editor should expose the acceptance definition field"
);
assert.equal(
  workshopExtension.includes('"blockerClass"'),
  true,
  "Workshop action editor should expose the blocker class override field"
);

console.log("ok v1.57.0 schema axis bump (acceptanceDefinition, blockerClass) is complete and policy-declared");
