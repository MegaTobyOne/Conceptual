import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DISALLOWED_PUBLICATION_FIELDS, PUBLICATION_FIELD_POLICIES } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const failures = [];
const warnings = [];
const policyByEntityType = new Map(PUBLICATION_FIELD_POLICIES.map((policy) => [policy.entityType, policy]));
const publicationRoots = [
  join(root, "packages/contracts/test-fixtures/standard"),
  join(root, "debug-workspace/.pspf/exchange/exports"),
  join(root, ".tmp/e2e-v0.1-workspace/.pspf/exchange/exports")
];
const staticRoots = [join(root, "packages/explorer/dist"), join(root, ".tmp/web-release")];
const webReleaseWorkflow = readFileSync(join(root, ".github/workflows/web-release.yml"), "utf8");
const ventraipDeployAction = readFileSync(join(root, ".github/actions/ventraip-deploy/action.yml"), "utf8");
const forbiddenStaticFilePatterns = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/).*\.(?:db|sqlite|sqlite3|pem|key|p12|pfx|vsix|zip)$/i,
  /(^|\/)pspf-core\.db$/i,
  /(^|\/)workspace\.json$/i,
  /(^|\/)products\.json$/i
];
const secretPatterns = [
  /-----BEGIN (?:RSA |OPENSSH |EC |)PRIVATE KEY-----/,
  /\b(?:api[_-]?key|token|secret|password|client[_-]?secret)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i
];

for (const staticRoot of staticRoots) {
  if (!existsSync(staticRoot)) {
    warnings.push(`${relative(root, staticRoot)} does not exist; build before release deployment`);
    continue;
  }

  for (const filePath of findFiles(staticRoot)) {
    const relativePath = relative(root, filePath);
    if (forbiddenStaticFilePatterns.some((pattern) => pattern.test(relativePath))) {
      failures.push(`${relativePath} must not be included in static deployment artefacts`);
    }
    scanTextForSecrets(filePath, readFileSync(filePath, "utf8"));
  }
}

const checkedBundles = [];
for (const publicationRoot of publicationRoots) {
  if (!existsSync(publicationRoot)) {
    continue;
  }

  for (const filePath of findJsonFiles(publicationRoot)) {
    const text = readFileSync(filePath, "utf8");
    scanTextForSecrets(filePath, text);
    const value = JSON.parse(text);
    const bundle = normaliseBundle(value);
    if (!bundle) {
      continue;
    }

    checkedBundles.push(relative(root, filePath));
    validateBundle(filePath, bundle);
  }
}

assert.ok(checkedBundles.length > 0, "at least one publication bundle should be checked");

const standardBundlePath = join(root, "packages/contracts/test-fixtures/standard/bundle.json");
const standardBundle = normaliseBundle(JSON.parse(readFileSync(standardBundlePath, "utf8")));
assert.ok(standardBundle, "standard fixture is a publication bundle");
assert.ok(
  (standardBundle.collections.requirements ?? []).some(
    (record) => typeof record.title === "string" && record.title.length > 0
  ),
  "public PSPF requirement titles may be published"
);
assert.ok(
  (standardBundle.collections["source-controls"] ?? []).some(
    (record) => typeof record.statement === "string" && record.statement.length > 0
  ),
  "public ISM source-control statements may be published"
);

assert.match(
  ventraipDeployAction,
  /protected_paths:[\s\S]*rsync -a --delete\$RSYNC_PROTECT_ARGS/,
  "VentraIP deploy action must preserve configured docroot child paths during rsync --delete"
);
assert.match(
  webReleaseWorkflow,
  /Deploy to VentraIP production[\s\S]*protected_paths:\s*\|\s*\n\s*test\//,
  "production web deploy must preserve the test/ child docroot"
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

console.log(
  `ok deployment safety passed for ${checkedBundles.length} publication bundle(s) and ${staticRoots.length} static root(s)`
);

function validateBundle(filePath, bundle) {
  for (const fieldPath of DISALLOWED_PUBLICATION_FIELDS) {
    if (containsPath(bundle, fieldPath.split("."))) {
      failures.push(`${relative(root, filePath)} contains disallowed personal field ${fieldPath}`);
    }
  }

  const manifestMode = bundle.manifest?.generator?.mode;
  if (manifestMode && manifestMode !== "publication") {
    failures.push(`${relative(root, filePath)} is not a publication-mode bundle`);
  }

  for (const [collectionName, records] of Object.entries(bundle.collections ?? {})) {
    if (!Array.isArray(records)) {
      failures.push(`${relative(root, filePath)} collection ${collectionName} is not an array`);
      continue;
    }

    for (const [index, record] of records.entries()) {
      validateRecord(filePath, collectionName, index, record);
    }
  }
}

function scanTextForSecrets(filePath, text) {
  if (secretPatterns.some((pattern) => pattern.test(text))) {
    failures.push(`${relative(root, filePath)} contains a value that looks like a secret`);
  }
}

function validateRecord(filePath, collectionName, index, record) {
  if (!record || typeof record !== "object") {
    failures.push(`${relative(root, filePath)} ${collectionName}[${index}] is not an object`);
    return;
  }

  const entityType = record.entityType;
  const policy = policyByEntityType.get(entityType);
  if (!policy) {
    failures.push(
      `${relative(root, filePath)} ${collectionName}[${index}] has missing publication policy for entity type ${String(entityType)}`
    );
    return;
  }

  const fieldPolicies = new Map(policy.fields.map((fieldPolicy) => [fieldPolicy.field, fieldPolicy.publication]));
  for (const field of Object.keys(record)) {
    const publication = fieldPolicies.get(field);
    if (!publication) {
      failures.push(`${relative(root, filePath)} ${entityType}.${field} has no publication policy`);
      continue;
    }
    if (publication === "sensitive" || publication === "restricted") {
      failures.push(`${relative(root, filePath)} ${entityType}.${field} is ${publication} and must not be hosted`);
    }
  }
}

function normaliseBundle(value) {
  if (
    value?.manifest?.bundleType === "pspf-explorer-bundle" &&
    value.collections &&
    typeof value.collections === "object"
  ) {
    return value;
  }
  return undefined;
}

function findFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      results.push(...findFiles(path));
    } else {
      results.push(path);
    }
  }
  return results;
}

function findJsonFiles(directory) {
  return findFiles(directory).filter((filePath) => filePath.endsWith(".json"));
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
