import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";
import { ISM_SOURCE_CONTROLS, PSPF_BASELINE_DIRECTIONS, PSPF_BASELINE_DIRECTION_LINKS, PSPF_BASELINE_REQUIREMENTS } from "../packages/reference-data/dist/index.js";
import { validateExportBundle, writeValidationReport } from "./lib/export-validation.mjs";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "e2e-v0.1-workspace");
const importWorkspaceRoot = join(root, ".tmp", "e2e-v0.1-import-workspace");
await rm(workspaceRoot, { recursive: true, force: true });
await rm(importWorkspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();

const initialValidation = await service.validateWorkspace();
assert.equal(initialValidation.ok, true, initialValidation.message);
assert.equal(initialValidation.counts.domains, 6);
assert.equal(initialValidation.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length);
assert.equal(initialValidation.counts["source-controls"], ISM_SOURCE_CONTROLS.length);
assert.equal(initialValidation.counts.directions, PSPF_BASELINE_DIRECTIONS.length);
assert.equal(initialValidation.counts.links, PSPF_BASELINE_DIRECTION_LINKS.length);

const requirement = withEnvelope(
  "requirement",
  {
    entityType: "requirement",
    title: "Validate governance reporting workflow",
    domainId: PSPF_DOMAINS[0].id,
    assessmentStatus: "in-progress",
    summary: "Internal assessment working note that must not be exported."
  },
  "workshop"
);
await service.upsertEntity(requirement);

const evidence = withEnvelope(
  "evidence",
  {
    entityType: "evidence",
    title: "Governance committee terms of reference",
    evidenceType: "document",
    reference: "records/governance-committee-tor.pdf",
    freshness: "current"
  },
  "workshop"
);
await service.upsertEntity(evidence);
await service.upsertEntity(withEnvelope(
  "link",
  {
    entityType: "link",
    title: `${requirement.title} supported by ${evidence.title}`,
    linkType: "supported-by",
    fromId: requirement.id,
    fromType: "requirement",
    toId: evidence.id,
    toType: "evidence"
  },
  "workshop"
));

const action = withEnvelope(
  "action",
  {
    entityType: "action",
    title: "Confirm next governance review date",
    status: "todo",
    dueDate: "30 Jun 2026"
  },
  "workshop"
);
await service.upsertEntity(action);
await service.upsertEntity(withEnvelope(
  "link",
  {
    entityType: "link",
    title: `${requirement.title} addressed by ${action.title}`,
    linkType: "addressed-by",
    fromId: requirement.id,
    fromType: "requirement",
    toId: action.id,
    toType: "action"
  },
  "workshop"
));

const risk = withEnvelope(
  "risk",
  {
    entityType: "risk",
    title: "Governance review evidence may become stale",
    status: "open",
    likelihood: 3,
    impact: 3
  },
  "workshop"
);
await service.upsertEntity(risk);
await service.upsertEntity(withEnvelope(
  "link",
  {
    entityType: "link",
    title: `${requirement.title} exposed by ${risk.title}`,
    linkType: "exposed-by",
    fromId: requirement.id,
    fromType: "requirement",
    toId: risk.id,
    toType: "risk"
  },
  "workshop"
));

const sourceControls = await service.listEntities("source-control");
assert.equal(sourceControls.length, ISM_SOURCE_CONTROLS.length);
const sourceControl = sourceControls[0];
const mapping = withEnvelope(
  "requirement-control-mapping",
  {
    entityType: "requirement-control-mapping",
    title: `${requirement.title} mapped to ${sourceControl.controlId}`,
    requirementId: requirement.id,
    sourceControlId: sourceControl.id,
    coverageQualifier: "primary",
    applicabilityProfile: "official-sensitive",
    confidence: "medium",
    lastReviewedAt: "2026-05-10T00:00:00.000Z",
    reviewBy: "Cyber assurance lead",
    rationale: "Sensitive operator interpretation that must not be exported.",
    provenance: {
      author: "e2e",
      createdAt: new Date().toISOString(),
      oscalRelease: sourceControl.provenance.oscalRelease
    }
  },
  "workshop"
);
await service.upsertEntity(mapping);

const direction = withEnvelope(
  "direction",
  {
    entityType: "direction",
    title: "Home Affairs Direction — encryption baseline",
    reference: "HA-DIR-2026-01",
    sourceAuthority: "Department of Home Affairs",
    issuedAt: "2026-04-01T00:00:00.000Z",
    responseState: "not-set"
  },
  "workshop"
);
await service.upsertEntity(direction);
await service.upsertEntity(withEnvelope(
  "link",
  {
    entityType: "link",
    title: `${direction.title} targets ${requirement.title}`,
    linkType: "targets",
    fromId: direction.id,
    fromType: "direction",
    toId: requirement.id,
    toType: "requirement"
  },
  "workshop"
));

const snapshot = await service.createSnapshot();
assert.equal(snapshot.entityType, "snapshot");

const integrity = await service.verifyIntegrity();
assert.equal(integrity.ok, true, integrity.detail);

const validation = await service.validateWorkspace();
assert.equal(validation.ok, true, validation.message);
assert.equal(validation.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 1);
assert.equal(validation.counts.evidence, 1);
assert.equal(validation.counts.actions, 1);
assert.equal(validation.counts.risks, 1);
assert.equal(validation.counts.links, PSPF_BASELINE_DIRECTION_LINKS.length + 4);
assert.equal(validation.counts.snapshots, 1);
assert.equal(validation.counts["source-controls"], ISM_SOURCE_CONTROLS.length);
assert.equal(validation.counts["requirement-control-mappings"], 1);
assert.equal(validation.counts.directions, PSPF_BASELINE_DIRECTIONS.length + 1);

const exported = await service.exportBundle();
const bundlePath = join(exported.exportDirectory, "bundle.json");
const report = await validateExportBundle(bundlePath, { root });
assert.equal(report.ok, true, report.failures.join("\n"));
assert.equal(report.counts.domains, 6);
assert.equal(report.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 1);
assert.equal(report.counts.evidence, 1);
assert.equal(report.counts.actions, 1);
assert.equal(report.counts.risks, 1);
assert.equal(report.counts.links, PSPF_BASELINE_DIRECTION_LINKS.length + 4);
assert.equal(report.counts.snapshots, 1);
assert.equal(report.counts["source-controls"], ISM_SOURCE_CONTROLS.length);
assert.equal(report.counts["requirement-control-mappings"], 1);
assert.equal(report.counts.directions, PSPF_BASELINE_DIRECTIONS.length + 1);
assert.equal(report.mappingRedaction.ok, true, report.mappingRedaction.detail);
assert.equal(report.mappingQuality.checks.every((check) => check.ok), true, JSON.stringify(report.mappingQuality.checks));
assert.equal(report.ismDrift.affectedMappings.length, 1);
const reportPaths = await writeValidationReport(report, join(workspaceRoot, ".pspf", "reports"));

const importService = createCoreService(importWorkspaceRoot);
await importService.initialiseWorkspace();
const imported = await importService.importBundle(bundlePath, "full-replace");
const expectedImported = Object.entries(report.counts)
  .filter(([collection]) => collection !== "posture")
  .reduce((total, [, count]) => total + count, 0);
assert.equal(imported.imported, expectedImported);
const importValidation = await importService.validateWorkspace();
assert.equal(importValidation.ok, true, importValidation.message);
assert.equal(importValidation.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 1);
assert.equal(importValidation.counts.evidence, 1);
assert.equal(importValidation.counts.actions, 1);
assert.equal(importValidation.counts.risks, 1);
assert.equal(importValidation.counts.links, PSPF_BASELINE_DIRECTION_LINKS.length + 4);
assert.equal(importValidation.counts["source-controls"], ISM_SOURCE_CONTROLS.length);
assert.equal(importValidation.counts["requirement-control-mappings"], 1);
assert.equal(importValidation.counts.directions, PSPF_BASELINE_DIRECTIONS.length + 1);
const importedMappings = await importService.listEntities("requirement-control-mapping");
assert.equal(importedMappings[0].confidence, "medium");
assert.equal(importedMappings[0].lastReviewedAt, "2026-05-10T00:00:00.000Z");
assert.equal(importedMappings[0].reviewBy, "Cyber assurance lead");

console.log("ok e2e workspace initialised, authored, mapped to ISM, snapshotted, exported, and verified");
console.log(`workspace: ${relative(root, workspaceRoot)}`);
console.log(`import workspace: ${relative(root, importWorkspaceRoot)}`);
console.log(`bundle: ${relative(root, bundlePath)}`);
console.log(`report: ${relative(root, reportPaths.markdownPath)}`);
console.log("explorer: packages/explorer/dist/index.html");