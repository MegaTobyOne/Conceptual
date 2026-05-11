import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import Ajv from "ajv";
import { DISALLOWED_PUBLICATION_FIELDS, VERSION_AXES, V0_1_COLLECTIONS } from "../../packages/contracts/dist/index.js";

export async function validateExportBundle(bundlePath, options = {}) {
  const root = options.root ?? process.cwd();
  const exportDirectory = dirname(bundlePath);
  const failures = [];
  const warnings = [];
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const manifest = bundle.manifest ?? {};
  const collections = bundle.collections ?? {};

  check(manifest.bundleType === "pspf-explorer-bundle", "manifest.bundleType is pspf-explorer-bundle", failures);
  check(manifest.bundleVersion === VERSION_AXES.bundleVersion, `bundleVersion is ${VERSION_AXES.bundleVersion}`, failures);
  check(manifest.schemaVersion === VERSION_AXES.schemaVersion, `schemaVersion is ${VERSION_AXES.schemaVersion}`, failures);
  check(manifest.apiVersion === VERSION_AXES.apiVersion, `apiVersion is ${VERSION_AXES.apiVersion}`, failures);
  check(manifest.generator?.mode === "publication", "generator mode is publication", failures);
  check(manifest.security?.classification === "OFFICIAL: Sensitive", "classification is OFFICIAL: Sensitive", failures);

  const manifestCollectionNames = (manifest.collections ?? []).map((collection) => collection.name);
  check(JSON.stringify(manifestCollectionNames) === JSON.stringify(V0_1_COLLECTIONS), "manifest lists every active collection in order", failures);

  const counts = {};
  for (const collectionName of V0_1_COLLECTIONS) {
    const records = collections[collectionName];
    check(Array.isArray(records), `${collectionName} collection is present`, failures);
    counts[collectionName] = Array.isArray(records) ? records.length : 0;
  }

  const hashChecks = [];
  for (const collection of manifest.collections ?? []) {
    const collectionPath = join(exportDirectory, "data", collection.path.replace(/^\.\//, ""));
    const expectedCount = counts[collection.name] ?? 0;
    check(collection.count === expectedCount, `${collection.name} manifest count matches bundle count`, failures);

    if (existsSync(collectionPath)) {
      const text = await readFile(collectionPath, "utf8");
      const actualHash = sha256(text);
      const ok = actualHash === collection.hash?.value;
      hashChecks.push({ name: collection.name, ok, path: relative(root, collectionPath) });
      check(ok, `${collection.name} collection hash matches manifest`, failures);
    } else {
      warnings.push(`${relative(root, collectionPath)} not found; skipped file hash check`);
      hashChecks.push({ name: collection.name, ok: false, path: relative(root, collectionPath), skipped: true });
    }
  }

  const posture = collections.posture?.[0];
  if (posture) {
    check(posture.requirementCount === counts.requirements, "posture requirement count matches collection", failures);
    check(posture.evidenceCount === counts.evidence, "posture evidence count matches collection", failures);
    check(posture.actionCount === counts.actions, "posture action count matches collection", failures);
    check(posture.riskCount === counts.risks, "posture risk count matches collection", failures);
  } else {
    failures.push("posture record is present");
  }

  const redactionChecks = [];
  for (const fieldPath of DISALLOWED_PUBLICATION_FIELDS) {
    const ok = !containsPath(bundle, fieldPath.split("."));
    redactionChecks.push({ fieldPath, ok });
    check(ok, `published bundle excludes ${fieldPath}`, failures);
  }

  const mappingRationaleExcluded = !containsPath(collections["requirement-control-mappings"] ?? [], ["rationale"]);
  check(mappingRationaleExcluded, "published mappings exclude sensitive rationale", failures);

  const mappingQuality = validateMappingQuality(collections["requirement-control-mappings"] ?? []);
  for (const qualityCheck of mappingQuality.checks) {
    check(qualityCheck.ok, qualityCheck.detail, failures);
  }

  const ismDrift = summariseIsmDrift(collections);
  check(ismDrift.sourceControlsWithStatus === (collections["source-controls"] ?? []).length, "source controls carry statement drift status", failures);

  const schemaChecks = await validateBundleSchemas(root, manifest, collections);
  for (const schemaCheck of schemaChecks) {
    check(schemaCheck.ok, schemaCheck.detail, failures);
  }

  return {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    bundlePath: relative(root, bundlePath),
    exportDirectory: relative(root, exportDirectory),
    explorerPath: "packages/explorer/dist/index.html",
    failures,
    warnings,
    manifest: {
      bundleVersion: manifest.bundleVersion,
      schemaVersion: manifest.schemaVersion,
      apiVersion: manifest.apiVersion,
      generatedAt: manifest.generatedAt,
      classification: manifest.security?.classification,
      generatorMode: manifest.generator?.mode
    },
    counts,
    hashChecks,
    redactionChecks,
    mappingRedaction: {
      ok: mappingRationaleExcluded,
      detail: mappingRationaleExcluded ? "Mapping rationale excluded from published bundle" : "Mapping rationale leaked into published bundle"
    },
    mappingQuality,
    ismDrift,
    schemaChecks,
    expectedExplorer: buildExpectedExplorer(collections)
  };
}

export async function writeValidationReport(report, reportDirectory, baseName = "e2e-v0.1-report") {
  await mkdir(reportDirectory, { recursive: true });
  const jsonPath = join(reportDirectory, `${baseName}.json`);
  const markdownPath = join(reportDirectory, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, toMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

export function findLatestBundle(workspaceRoot) {
  const exportsRoot = join(workspaceRoot, ".pspf", "exchange", "exports");
  if (!existsSync(exportsRoot)) {
    return undefined;
  }
  const directories = readdirSync(exportsRoot)
    .map((entry) => join(exportsRoot, entry))
    .filter((entry) => statSync(entry).isDirectory())
    .sort((left, right) => basename(left).localeCompare(basename(right)));
  const latest = directories.at(-1);
  return latest ? join(latest, "bundle.json") : undefined;
}

export function containsPath(value, pathParts) {
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

function buildExpectedExplorer(collections) {
  return {
    postureCounts: {
      requirements: collections.requirements?.length ?? 0,
      evidence: collections.evidence?.length ?? 0,
      actions: collections.actions?.length ?? 0,
      risks: collections.risks?.length ?? 0
    },
    requirements: (collections.requirements ?? []).map((record) => record.title),
    evidence: (collections.evidence ?? []).map((record) => record.title),
    actions: (collections.actions ?? []).map((record) => record.title),
    risks: (collections.risks ?? []).map((record) => record.title),
    relationshipCount: collections.links?.length ?? 0,
    sourceControls: (collections["source-controls"] ?? []).map((record) => record.controlId),
    requirementControlMappingCount: collections["requirement-control-mappings"]?.length ?? 0
  };
}

function toMarkdown(report) {
  const status = report.ok ? "PASS" : "FAIL";
  const lines = [
    "# PSPF E2E Report",
    "",
    `Status: ${status}`,
    `Generated: ${report.generatedAt}`,
    `Bundle: ${report.bundlePath}`,
    `Explorer: ${report.explorerPath}`,
    "",
    "## Behaviour Created",
    "",
    `- Requirements: ${report.counts.requirements}`,
    `- Evidence: ${report.counts.evidence}`,
    `- Actions: ${report.counts.actions}`,
    `- Risks: ${report.counts.risks}`,
    `- ISM source controls: ${report.counts["source-controls"] ?? 0}`,
    `- ISM mappings: ${report.counts["requirement-control-mappings"] ?? 0}`,
    `- Relationship links: ${report.counts.links}`,
    `- Snapshots: ${report.counts.snapshots}`,
    "",
    "## Explorer Expectations",
    "",
    ...report.expectedExplorer.requirements.map((title) => `- Requirement: ${title}`),
    ...report.expectedExplorer.evidence.map((title) => `- Evidence: ${title}`),
    ...report.expectedExplorer.actions.map((title) => `- Action: ${title}`),
    ...report.expectedExplorer.risks.map((title) => `- Risk: ${title}`),
    ...report.expectedExplorer.sourceControls.map((controlId) => `- ISM source control: ${controlId}`),
    `- ISM mappings: ${report.expectedExplorer.requirementControlMappingCount}`,
    `- Relationships Board links: ${report.expectedExplorer.relationshipCount}`,
    "",
    "## Checks",
    "",
    ...report.schemaChecks.map((check) => `- Schema ${check.name}: ${check.ok ? "PASS" : "FAIL"}`),
    ...report.hashChecks.map((check) => `- Hash ${check.name}: ${check.ok ? "PASS" : "FAIL"}`),
    ...report.redactionChecks.map((check) => `- Redaction ${check.fieldPath}: ${check.ok ? "PASS" : "FAIL"}`),
    `- Mapping rationale redaction: ${report.mappingRedaction.ok ? "PASS" : "FAIL"}`,
    `- Mapping confidence: ${report.mappingQuality.checks.every((check) => check.ok) ? "PASS" : "FAIL"}`,
    `- ISM drift status: ${report.ismDrift.sourceControlsWithStatus}/${report.counts["source-controls"] ?? 0} source controls`,
    `- ISM mappings needing drift review: ${report.ismDrift.affectedMappings.length}`
  ];

  if (report.failures.length > 0) {
    lines.push("", "## Failures", "", ...report.failures.map((failure) => `- ${failure}`));
  }
  if (report.warnings.length > 0) {
    lines.push("", "## Warnings", "", ...report.warnings.map((warning) => `- ${warning}`));
  }

  return `${lines.join("\n")}\n`;
}

async function validateBundleSchemas(root, manifest, collections) {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const schemaRoot = join(root, "schemas", "explorer-bundle", VERSION_AXES.schemaVersion);
  const checks = [];
  const manifestSchema = JSON.parse(await readFile(join(schemaRoot, "manifest.schema.json"), "utf8"));
  const validateManifest = ajv.compile(manifestSchema);
  checks.push(schemaCheck("manifest", validateManifest(manifest), validateManifest.errors));

  for (const collectionName of V0_1_COLLECTIONS) {
    const schema = JSON.parse(await readFile(join(schemaRoot, "collections", `${collectionName}.schema.json`), "utf8"));
    const validateCollection = ajv.compile(schema);
    checks.push(schemaCheck(collectionName, validateCollection(collections[collectionName] ?? []), validateCollection.errors));
  }

  return checks;
}

function schemaCheck(name, ok, errors) {
  const detail = ok
    ? `${name} validates against schema`
    : `${name} schema validation failed: ${(errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ")}`;
  return { name, ok: Boolean(ok), detail };
}

function validateMappingQuality(mappings) {
  const validConfidence = new Set(["low", "medium", "high"]);
  const checks = [
    {
      name: "confidence-present",
      ok: mappings.every((mapping) => validConfidence.has(mapping.confidence)),
      detail: "published mappings carry confidence"
    },
    {
      name: "review-date-format",
      ok: mappings.every((mapping) => !mapping.lastReviewedAt || !Number.isNaN(Date.parse(mapping.lastReviewedAt))),
      detail: "mapping lastReviewedAt is ISO date-time when present"
    },
    {
      name: "reviewer-free-text",
      ok: mappings.every((mapping) => !mapping.reviewBy || typeof mapping.reviewBy === "string"),
      detail: "mapping reviewBy is optional free text"
    }
  ];
  return {
    checks,
    confidenceCounts: mappings.reduce((counts, mapping) => {
      const confidence = validConfidence.has(mapping.confidence) ? mapping.confidence : "missing";
      counts[confidence] = (counts[confidence] ?? 0) + 1;
      return counts;
    }, {})
  };
}

function summariseIsmDrift(collections) {
  const sourceControls = collections["source-controls"] ?? [];
  const sourceControlsById = new Map(sourceControls.map((sourceControl) => [sourceControl.id, sourceControl]));
  const affectedStatuses = new Set(["changed", "new", "removed"]);
  const affectedMappings = [];
  for (const mapping of collections["requirement-control-mappings"] ?? []) {
    const sourceControl = sourceControlsById.get(mapping.sourceControlId);
    if (sourceControl && affectedStatuses.has(sourceControl.statementChangeStatus)) {
      affectedMappings.push({
        mappingId: mapping.id,
        requirementId: mapping.requirementId,
        sourceControlId: mapping.sourceControlId,
        controlId: sourceControl.controlId,
        status: sourceControl.statementChangeStatus,
        confidence: mapping.confidence
      });
    }
  }
  return {
    sourceControlsWithStatus: sourceControls.filter((sourceControl) => typeof sourceControl.statementChangeStatus === "string").length,
    affectedMappings
  };
}

function check(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}