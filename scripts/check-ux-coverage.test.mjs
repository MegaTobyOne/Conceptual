import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { V0_1_ENTITY_TYPES } from "../packages/contracts/dist/index.js";
import { validateUxCoverageMatrix } from "./check-ux-coverage.mjs";

const matrixUrl = new URL("../pspf-entity-ux-coverage.json", import.meta.url);

async function loadMatrix() {
  return JSON.parse(await readFile(matrixUrl, "utf8"));
}

function cloneMatrix(matrix) {
  return JSON.parse(JSON.stringify(matrix));
}

function record(matrix, entityType) {
  const match = matrix.records.find((candidate) => candidate.entityType === entityType);
  assert.ok(match, `Expected ${entityType} fixture record`);
  return match;
}

test("UX coverage fixture validates every contract and Pub local record", async () => {
  const matrix = await loadMatrix();

  const result = validateUxCoverageMatrix(matrix);

  assert.equal(result.contractTypeCount, V0_1_ENTITY_TYPES.length);
  assert.equal(result.pubLocalTypeCount, 5);
  assert.ok(result.relationshipManagerCandidateCount > 0);
});

test("UX coverage rejects missing contract entity decisions", async () => {
  const matrix = cloneMatrix(await loadMatrix());
  matrix.records = matrix.records.filter((candidate) => candidate.entityType !== "requirement");

  assert.throws(() => validateUxCoverageMatrix(matrix), /every contract entity type/);
});

test("UX coverage rejects duplicate entity decisions", async () => {
  const matrix = cloneMatrix(await loadMatrix());
  matrix.records.push({ ...record(matrix, "requirement") });

  assert.throws(() => validateUxCoverageMatrix(matrix), /Duplicate UX coverage record requirement/);
});

test("UX coverage rejects invalid coverage states", async () => {
  const matrix = cloneMatrix(await loadMatrix());
  record(matrix, "supplier").detail = "planned";

  assert.throws(() => validateUxCoverageMatrix(matrix), /supplier\.detail should use a known state/);
});

test("UX coverage rejects editable records with missing core surfaces", async () => {
  const matrix = cloneMatrix(await loadMatrix());
  record(matrix, "pub-role").detail = "missing";

  assert.throws(() => validateUxCoverageMatrix(matrix), /pub-role editable records need detail coverage/);
});

test("UX coverage rejects partial or missing states without an explicit gap", async () => {
  const matrix = cloneMatrix(await loadMatrix());
  record(matrix, "strategy").gap = "";

  assert.throws(() => validateUxCoverageMatrix(matrix), /strategy should describe gaps/);
});
