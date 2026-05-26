import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const workspaceRoot = join(root, ".tmp", "writer-lock-gate-workspace");
await rm(workspaceRoot, { recursive: true, force: true });

const service = createCoreService(workspaceRoot);
const paths = await service.initialiseWorkspace();
const lock = await service.getWriterLock();
assert.equal(lock.writable, true, lock.detail);
assert.equal(lock.policy, "single-writer");

await writeLockState(paths, {
  holderPid: 1,
  acquiredAt: new Date().toISOString(),
  writable: false,
  detail: "Simulated second-window writer lock."
});

const readOnlyLock = await service.getWriterLock();
assert.equal(readOnlyLock.writable, false, readOnlyLock.detail);
assert.equal(readOnlyLock.policy, "single-writer");

const requirement = withEnvelope(
  "requirement",
  {
    entityType: "requirement",
    title: "Writer lock should block this write",
    domainId: PSPF_DOMAINS[0].id,
    assessmentStatus: "in-progress"
  },
  "workshop"
);

await assert.rejects(() => service.upsertEntity(requirement), /read-only|writer lock/i);

await writeLockState(paths, {
  holderPid: 999999,
  acquiredAt: new Date().toISOString(),
  writable: false,
  detail: "Simulated stale second-window writer lock."
});

const recoveredLock = await service.getWriterLock();
assert.equal(recoveredLock.writable, true, recoveredLock.detail);
await service.upsertEntity(requirement);
console.log("ok writer-lock gate blocks live second-window writes and recovers stale locks");

async function writeLockState(paths, value) {
  await rm(join(paths.locks, "writer.lock"), { force: true });
  await writeFile(join(paths.locks, "writer.lock"), `${value.holderPid}\n`, "utf8");
  await writeFile(
    join(paths.locks, "writer-lock.json"),
    `${JSON.stringify({ ...value, currentPid: process.pid, policy: "single-writer" }, null, 2)}\n`,
    "utf8"
  );
}
