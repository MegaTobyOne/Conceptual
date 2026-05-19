import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DISALLOWED_PUBLICATION_FIELDS } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const controlFixture = join(root, "packages/contracts/test-fixtures/personal-data/source-with-restricted-fields.json");
const publishedRoots = [
  join(root, "packages/contracts/test-fixtures/standard"),
  join(root, "debug-workspace/.pspf/exchange/exports"),
  join(root, ".tmp/e2e-v0.1-workspace/.pspf/exchange/exports")
];
const failures = [];

const controlValue = JSON.parse(readFileSync(controlFixture, "utf8"));
for (const fieldPath of DISALLOWED_PUBLICATION_FIELDS) {
  if (!containsPath(controlValue, fieldPath.split("."))) {
    failures.push(`control fixture does not exercise ${fieldPath}`);
  }
}

for (const publishedRoot of publishedRoots) {
  if (!existsSync(publishedRoot)) {
    continue;
  }
  for (const filePath of findJsonFiles(publishedRoot)) {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    for (const fieldPath of DISALLOWED_PUBLICATION_FIELDS) {
      if (containsPath(value, fieldPath.split("."))) {
        failures.push(`${relative(root, filePath)} contains disallowed field ${fieldPath}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok personal-data exclusion passed for published fixtures and debug exports");

function findJsonFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      results.push(...findJsonFiles(path));
    } else if (entry.endsWith(".json")) {
      results.push(path);
    }
  }
  return results;
}

function containsPath(value, pathParts) {
  if (pathParts.length === 0) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsPath(item, pathParts));
  }
  if (!value || typeof value !== "object") {
    return false;
  }

  const [head, ...tail] = pathParts;
  if (Object.prototype.hasOwnProperty.call(value, head) && containsPath(value[head], tail)) {
    return true;
  }

  return Object.values(value).some((item) => containsPath(item, pathParts));
}
