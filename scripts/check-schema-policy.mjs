import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLICATION_FIELD_POLICIES,
  V0_1_ENTITY_TYPES,
  sanitiseEntityForPublication
} from "../packages/contracts/dist/index.js";

const root = process.cwd();
const standardFixture = JSON.parse(
  readFileSync(join(root, "packages/contracts/test-fixtures/standard/bundle.json"), "utf8")
);
const failures = [];

for (const entityType of V0_1_ENTITY_TYPES) {
  const policy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === entityType);
  if (!policy) {
    failures.push(`missing publication policy for ${entityType}`);
    continue;
  }

  const seen = new Set();
  for (const fieldPolicy of policy.fields) {
    if (!fieldPolicy.field || !fieldPolicy.publication) {
      failures.push(`${entityType} has an incomplete field policy`);
    }
    if (seen.has(fieldPolicy.field)) {
      failures.push(`${entityType}.${fieldPolicy.field} has duplicate publication policy`);
    }
    seen.add(fieldPolicy.field);
  }
}

for (const [collectionName, records] of Object.entries(standardFixture.collections)) {
  for (const record of records) {
    try {
      sanitiseEntityForPublication(record);
    } catch (error) {
      failures.push(`${collectionName}/${record.id ?? "unknown"}: ${error.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok schema-policy metadata covers v0.1 entities and the standard fixture");
