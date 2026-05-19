import assert from "node:assert/strict";
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";
import { PSPF_BASELINE_REQUIREMENTS } from "../packages/reference-data/dist/index.js";

const root = process.cwd();
const sourceWorkspace = join(root, ".tmp", "backup-source-workspace");
const restoredWorkspace = join(root, ".tmp", "backup-restored-workspace");
await rm(sourceWorkspace, { recursive: true, force: true });
await rm(restoredWorkspace, { recursive: true, force: true });

const source = createCoreService(sourceWorkspace);
const sourcePaths = await source.initialiseWorkspace();
await source.upsertEntity(
  withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Backup and restore dry-run requirement",
      domainId: PSPF_DOMAINS[0].id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  )
);
await source.createSnapshot();

await cp(sourcePaths.pspf, join(restoredWorkspace, ".pspf"), { recursive: true });
const restored = createCoreService(restoredWorkspace);
const integrity = await restored.verifyIntegrity();
assert.equal(integrity.ok, true, integrity.detail);
const validation = await restored.validateWorkspace();
assert.equal(validation.ok, true, validation.message);
assert.equal(validation.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + 1);

console.log("ok backup/restore dry-run restored .pspf and passed integrity plus Core validation");
