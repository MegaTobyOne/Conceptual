import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";
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
assert.equal(initialValidation.counts.domains, 4);

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

const snapshot = await service.createSnapshot();
assert.equal(snapshot.entityType, "snapshot");

const integrity = await service.verifyIntegrity();
assert.equal(integrity.ok, true, integrity.detail);

const validation = await service.validateWorkspace();
assert.equal(validation.ok, true, validation.message);
assert.equal(validation.counts.requirements, 1);
assert.equal(validation.counts.evidence, 1);
assert.equal(validation.counts.actions, 1);
assert.equal(validation.counts.risks, 1);
assert.equal(validation.counts.links, 3);
assert.equal(validation.counts.snapshots, 1);

const exported = await service.exportBundle();
const bundlePath = join(exported.exportDirectory, "bundle.json");
const report = await validateExportBundle(bundlePath, { root });
assert.equal(report.ok, true, report.failures.join("\n"));
assert.equal(report.counts.domains, 4);
assert.equal(report.counts.requirements, 1);
assert.equal(report.counts.evidence, 1);
assert.equal(report.counts.actions, 1);
assert.equal(report.counts.risks, 1);
assert.equal(report.counts.links, 3);
assert.equal(report.counts.snapshots, 1);
const reportPaths = await writeValidationReport(report, join(workspaceRoot, ".pspf", "reports"));

const importService = createCoreService(importWorkspaceRoot);
await importService.initialiseWorkspace();
const imported = await importService.importBundle(bundlePath, "full-replace");
assert.equal(imported.imported, 12);
const importValidation = await importService.validateWorkspace();
assert.equal(importValidation.ok, true, importValidation.message);
assert.equal(importValidation.counts.requirements, 1);
assert.equal(importValidation.counts.evidence, 1);
assert.equal(importValidation.counts.actions, 1);
assert.equal(importValidation.counts.risks, 1);
assert.equal(importValidation.counts.links, 3);

console.log("ok e2e v0.1 workspace initialised, authored, snapshotted, exported, and verified");
console.log(`workspace: ${relative(root, workspaceRoot)}`);
console.log(`import workspace: ${relative(root, importWorkspaceRoot)}`);
console.log(`bundle: ${relative(root, bundlePath)}`);
console.log(`report: ${relative(root, reportPaths.markdownPath)}`);
console.log("explorer: packages/explorer/dist/index.html");