import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import { VERSION_AXES, V0_1_COLLECTIONS } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const schemaRoot = join(root, "schemas/explorer-bundle", VERSION_AXES.schemaVersion, "collections");
const manifestSchemaPath = join(root, "schemas/explorer-bundle", VERSION_AXES.schemaVersion, "manifest.schema.json");
const standardFixturePath = join(root, "packages/contracts/test-fixtures/standard/bundle.json");
const failures = [];
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const standardFixture = JSON.parse(readFileSync(standardFixturePath, "utf8"));

const manifestSchema = JSON.parse(readFileSync(manifestSchemaPath, "utf8"));
const validateManifest = ajv.compile(manifestSchema);
if (!validateManifest(standardFixture.manifest)) {
  failures.push(`standard fixture manifest schema failed: ${formatAjvErrors(validateManifest.errors)}`);
}

for (const collection of V0_1_COLLECTIONS) {
  const schemaPath = join(schemaRoot, `${collection}.schema.json`);
  if (!existsSync(schemaPath)) {
    failures.push(`missing collection schema for ${collection}`);
    continue;
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (schema.$schema !== "http://json-schema.org/draft-07/schema#") {
    failures.push(`${collection} schema is not Draft 07`);
  }
  if (schema.type !== "array") {
    failures.push(`${collection} schema must describe the collection array`);
  }
  if (schema.items?.additionalProperties !== false) {
    failures.push(`${collection} schema must deny additional properties`);
  }

  const validateCollection = ajv.compile(schema);
  if (!validateCollection(standardFixture.collections[collection] ?? [])) {
    failures.push(`standard fixture ${collection} schema failed: ${formatAjvErrors(validateCollection.errors)}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok Explorer collection schemas exist and validate the standard fixture");

function formatAjvErrors(errors) {
  return (errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
}