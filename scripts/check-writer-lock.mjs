import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";

if (process.argv[2] === "--contender") {
  await runContender(process.argv[3]);
} else {
  await runGate();
}

async function runGate() {
  const workspaceRoot = join(process.cwd(), ".tmp", "writer-lock-gate-workspace");
  await rm(workspaceRoot, { recursive: true, force: true });

  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  await service.releaseWriterLock();

  const contenders = [startContender(workspaceRoot), startContender(workspaceRoot)];
  const resultPromises = contenders.map(waitForResult);
  for (const contender of contenders) {
    contender.send("start");
  }
  const results = await Promise.all(resultPromises);
  const winners = results.filter((result) => result.writable);
  const losers = results.filter((result) => !result.writable);
  assert.equal(winners.length, 1, `Expected one writer, received ${JSON.stringify(results)}`);
  assert.equal(losers.length, 1, `Expected one read-only contender, received ${JSON.stringify(results)}`);
  assert.equal(winners[0].writeBlocked, false, winners[0].detail);
  assert.equal(losers[0].writeBlocked, true, losers[0].detail);
  assert.equal(losers[0].initialiseBlocked, true, losers[0].detail);

  const lockPath = join(workspaceRoot, ".pspf", "core", "locks", "writer-v2.lock");
  const staleTime = new Date(Date.now() - 60_000);
  await utimes(lockPath, staleTime, staleTime);
  const liveOwnerChallenger = startContender(workspaceRoot);
  const liveOwnerResult = waitForResult(liveOwnerChallenger);
  liveOwnerChallenger.send("start");
  const challenged = await liveOwnerResult;
  assert.equal(challenged.writable, false, challenged.detail);
  assert.equal(challenged.writeBlocked, true, challenged.detail);
  assert.equal(challenged.initialiseBlocked, true, challenged.detail);
  const challengerExit = waitForExit(liveOwnerChallenger);
  liveOwnerChallenger.send("stop");
  await challengerExit;

  const winner = contenders[results.findIndex((result) => result.writable)];
  const loser = contenders[results.findIndex((result) => !result.writable)];
  assert.ok(winner);
  assert.ok(loser);
  const winnerExit = waitForExit(winner);
  winner.send("stop");
  await winnerExit;
  const loserExit = waitForExit(loser);
  loser.send("stop");
  await loserExit;

  await mkdir(lockPath);
  await writeFile(
    join(workspaceRoot, ".pspf", "core", "locks", "writer-lock.json"),
    `${JSON.stringify({ holderPid: 999999, acquiredAt: staleTime.toISOString(), ownershipToken: "abandoned" })}\n`,
    "utf8"
  );
  await utimes(lockPath, staleTime, staleTime);
  await service.upsertEntity(requirement("Recovered stale writer lock"));
  const recoveredLock = await service.getWriterLock();
  assert.equal(recoveredLock.writable, true, recoveredLock.detail);
  await service.releaseWriterLock();

  console.log("ok writer-lock gate permits exactly one process and safely recovers an abandoned stale lock");
}

async function runContender(workspaceRoot) {
  assert.equal(typeof workspaceRoot, "string");
  const service = createCoreService(workspaceRoot);
  process.on("message", async (message) => {
    if (message === "start") {
      let writeBlocked = false;
      let initialiseBlocked = false;
      try {
        await service.upsertEntity(requirement(`Writer contender ${process.pid}`));
      } catch (error) {
        writeBlocked = /read-only|writer lock/i.test(error instanceof Error ? error.message : String(error));
      }
      if (writeBlocked) {
        try {
          await service.initialiseWorkspace();
        } catch (error) {
          initialiseBlocked = /read-only|writer lock/i.test(error instanceof Error ? error.message : String(error));
        }
      }
      const lock = await service.getWriterLock();
      process.send?.({ writable: lock.writable, writeBlocked, initialiseBlocked, detail: lock.detail });
      return;
    }
    if (message === "stop") {
      await service.releaseWriterLock();
      process.exit(0);
    }
  });
}

function startContender(workspaceRoot) {
  return fork(fileURLToPath(import.meta.url), ["--contender", workspaceRoot], {
    stdio: ["ignore", "inherit", "inherit", "ipc"]
  });
}

function waitForResult(contender) {
  return new Promise((resolve, reject) => {
    contender.once("message", resolve);
    contender.once("error", reject);
    contender.once("exit", (code, signal) => {
      reject(new Error(`Writer-lock contender exited before reporting (${code ?? signal}).`));
    });
  });
}

function waitForExit(contender) {
  return new Promise((resolve, reject) => {
    contender.once("exit", resolve);
    contender.once("error", reject);
  });
}

function requirement(title) {
  return withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title,
      domainId: PSPF_DOMAINS[0].id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
}
