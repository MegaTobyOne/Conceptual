import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLLECTION_BY_ENTITY_TYPE,
  ID_PREFIX_BY_ENTITY_TYPE,
  OPERATOR_LINK_RULES,
  PUBLICATION_FIELD_POLICIES,
  V0_1_COLLECTIONS,
  V0_1_ENTITY_TYPES
} from "../packages/contracts/dist/index.js";

const root = process.cwd();
const schemaRoot = join(root, "schemas/explorer-bundle/1.17.0/collections");
const envelopeFields = new Set([
  "id",
  "entityType",
  "schemaVersion",
  "createdAt",
  "updatedAt",
  "sourceProduct",
  "recordStatus",
  "lifecycleStatus",
  "decisionDate"
]);

assert.ok(V0_1_ENTITY_TYPES.includes("commitment"));
assert.ok(V0_1_ENTITY_TYPES.includes("governance-decision"));
assert.equal(COLLECTION_BY_ENTITY_TYPE.commitment, "commitments");
assert.equal(COLLECTION_BY_ENTITY_TYPE["governance-decision"], "governance-decisions");
assert.equal(ID_PREFIX_BY_ENTITY_TYPE.commitment, "CMT");
assert.equal(ID_PREFIX_BY_ENTITY_TYPE["governance-decision"], "GDE");
assert.ok(V0_1_COLLECTIONS.includes("commitments"));
assert.ok(V0_1_COLLECTIONS.includes("governance-decisions"));

const commitmentPolicy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === "commitment");
const decisionPolicy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === "governance-decision");
assert.ok(commitmentPolicy);
assert.ok(decisionPolicy);
for (const policy of [commitmentPolicy, decisionPolicy]) {
  for (const field of policy.fields) {
    if (!envelopeFields.has(field.field)) {
      assert.equal(field.publication, "sensitive", `${policy.entityType}.${field.field} must be sensitive`);
    }
  }
}

assert.deepEqual(
  OPERATOR_LINK_RULES.find((rule) => rule.fromType === "governance-decision" && rule.toType === "commitment"),
  {
    id: "workshop-governance-decision-changes-commitment",
    sourceProduct: "workshop",
    linkType: "changes",
    fromType: "governance-decision",
    toType: "commitment",
    label: "Link Governance Decision to Commitment",
    phrase: "changes"
  }
);

for (const collection of ["commitments", "governance-decisions"]) {
  assert.ok(existsSync(join(schemaRoot, `${collection}.schema.json`)), `missing ${collection} schema`);
}

const serviceSource = readFileSync(join(root, "packages/core/src/service.ts"), "utf8");
assert.match(serviceSource, /cannot remove a baseline revision/);
assert.match(serviceSource, /cannot rewrite an existing baseline revision/);
assert.match(serviceSource, /Governance decision .* immutable/);

console.log("ok commitment model: contracts, sensitive policies, link rule, schemas, and Core write boundary");
