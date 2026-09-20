#!/usr/bin/env node
// C0 (course-correction-plan.md): enforce the bounded flagship-job evidence pack.
// Failure means a job is missing, its cost exceeds the baseline, the pack is stale,
// or the checked-in pack contains person/free-text data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const FLAGSHIP_JOBS = ["FJ1", "FJ2", "FJ3", "FJ4"];
const COST_KEYS = ["routeChanges", "surfacesOpened", "inputEvents", "answerStep"];
const FORBIDDEN_DATA = /\b(?:person|email|freeText|free-text|operatorName|rationale|notes?)\b/i;

export function reduceJourneyCost(events) {
  assert.ok(Array.isArray(events), "journey events must be an array");
  const surfaces = new Set();
  let answerStep = null;
  const cost = { routeChanges: 0, surfacesOpened: 0, inputEvents: 0, answerStep };

  for (const [index, event] of events.entries()) {
    assert.equal(typeof event, "object", `journey event ${index} must be an object`);
    if (event.type === "route-change") cost.routeChanges += 1;
    if (event.type === "surface-open") {
      assert.equal(typeof event.surface, "string", `journey event ${index} needs a surface id`);
      surfaces.add(event.surface);
    }
    if (event.type === "input") cost.inputEvents += 1;
    if (event.type === "answer-visible" && answerStep === null) {
      assert.equal(Number.isInteger(event.step), true, `journey event ${index} needs an integer answer step`);
      answerStep = event.step;
    }
  }

  cost.surfacesOpened = surfaces.size;
  cost.answerStep = answerStep;
  return cost;
}

function assertCostShape(jobId, cost) {
  for (const key of COST_KEYS) {
    assert.equal(typeof cost?.[key], "number", `${jobId} cost needs numeric ${key}`);
    assert.ok(cost[key] >= 0, `${jobId} cost ${key} must not be negative`);
  }
}

function compareVersions(left, right) {
  const parse = (version) => version.split(".").map((part) => Number.parseInt(part, 10));
  const a = parse(left);
  const b = parse(right);
  assert.equal(a.length, 3, `invalid product version ${left}`);
  assert.equal(b.length, 3, `invalid product version ${right}`);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function validateJourneyCost(pack, baseline, productVersion) {
  assert.equal(
    compareVersions(pack.productVersion, productVersion) >= 0,
    true,
    `evidence pack product version ${pack.productVersion} is older than package.json ${productVersion}`
  );
  assert.equal(
    FORBIDDEN_DATA.test(JSON.stringify(pack)),
    false,
    "journey evidence pack must not contain person or free-text data"
  );

  const jobs = new Map((pack.jobs ?? []).map((job) => [job.id, job]));
  const missingJobs = FLAGSHIP_JOBS.filter((jobId) => !jobs.has(jobId));
  assert.deepEqual(missingJobs, [], `evidence pack is missing flagship records: ${missingJobs.join(", ")}`);
  assert.equal(jobs.size, (pack.jobs ?? []).length, "evidence pack must not contain duplicate flagship records");
  assert.deepEqual(
    [...jobs.keys()].sort(),
    [...FLAGSHIP_JOBS].sort(),
    "evidence pack must contain only FJ1-FJ4 records"
  );

  const baselineJobs = new Map((baseline.jobs ?? []).map((job) => [job.id, job]));
  for (const jobId of FLAGSHIP_JOBS) {
    const job = jobs.get(jobId);
    const baselineJob = baselineJobs.get(jobId);
    assert.ok(baselineJob, `baseline is missing ${jobId}`);
    assertCostShape(jobId, job.cost);
    assertCostShape(jobId, baselineJob.cost);
    for (const key of COST_KEYS) {
      assert.ok(
        job.cost[key] <= baselineJob.cost[key],
        `${jobId} ${key} ${job.cost[key]} exceeds baseline ${baselineJob.cost[key]}`
      );
    }
  }

  return { productVersion: pack.productVersion, jobCount: jobs.size };
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const pack = JSON.parse(await readFile(join(root, "docs/ux-evidence/pack.json"), "utf8"));
  const baseline = JSON.parse(await readFile(join(root, "docs/ux-evidence/baseline.json"), "utf8"));
  const result = validateJourneyCost(pack, baseline, packageJson.version);
  console.log(`ok journey cost v${result.productVersion}: ${result.jobCount} flagship records within baseline`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
