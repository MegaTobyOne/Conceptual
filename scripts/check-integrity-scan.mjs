import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "integrity-scan-gate-workspace");
await rm(workspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
await service.initialiseWorkspace();

const requirement = withEnvelope(
  "requirement",
  {
    entityType: "requirement",
    title: "Integrity scan valid requirement",
    domainId: PSPF_DOMAINS[0].id,
    assessmentStatus: "in-progress"
  },
  "workshop"
);
const evidence = withEnvelope(
  "evidence",
  {
    entityType: "evidence",
    title: "Integrity scan valid evidence",
    evidenceType: "policy",
    freshness: "current",
    reference: "INT-SCAN-EV-1"
  },
  "workshop"
);
const validLink = withEnvelope(
  "link",
  {
    entityType: "link",
    title: "Requirement supported by evidence",
    linkType: "supported-by",
    fromType: "requirement",
    fromId: requirement.id,
    toType: "evidence",
    toId: evidence.id
  },
  "workshop"
);
await service.upsertEntities([requirement, evidence, validLink]);

const passingReport = await service.runIntegrityScan();
assert.equal(passingReport.ok, true, passingReport.summary);
assert.equal(passingReport.counts.orphanedLinks, 0);
assert.equal(passingReport.counts.mistypedLinks, 0);

const brokenLink = withEnvelope(
  "link",
  {
    entityType: "link",
    title: "Broken link fixture",
    linkType: "supported-by",
    fromType: "requirement",
    fromId: requirement.id,
    toType: "evidence",
    toId: "EVD-00000000-0000-4000-8000-000000000000"
  },
  "workshop"
);
await service.upsertEntity(brokenLink);

const failingReport = await service.runIntegrityScan();
assert.equal(failingReport.ok, false, failingReport.summary);
assert.equal(failingReport.counts.orphanedLinks, 1);
assert.match(failingReport.findings.map((finding) => finding.message).join("\n"), /references missing toId/);

console.log("ok integrity scan passes clean workspace and detects broken-link fixture");
