import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { V0_1_ENTITY_TYPES } from "../packages/contracts/dist/index.js";

const validCoverageStates = new Set(["complete", "partial", "read-only", "missing", "not-applicable"]);
const validMutability = new Set([
  "user-editable",
  "baseline-readonly",
  "generated-readonly",
  "reference-readonly",
  "local-only"
]);
const validRecordSets = new Set(["contract", "pub-local"]);
const expectedPubLocalTypes = ["pub-person", "pub-team", "pub-role", "pub-assignment", "pub-relationship-note"];
const coverageKeys = ["list", "detail", "create", "edit", "delete", "relationships"];

export function validateUxCoverageMatrix(
  matrix,
  { contractEntityTypes = V0_1_ENTITY_TYPES, pubLocalRecordTypes = expectedPubLocalTypes } = {}
) {
  assert.equal(matrix.matrixVersion, "1.0.0", "UX coverage matrix version should be 1.0.0");
  assert.ok(Array.isArray(matrix.records), "UX coverage matrix should contain records[]");

  const recordsByType = new Map();
  for (const record of matrix.records) {
    assert.equal(typeof record.entityType, "string", "UX coverage record should have entityType");
    assert.equal(recordsByType.has(record.entityType), false, `Duplicate UX coverage record ${record.entityType}`);
    recordsByType.set(record.entityType, record);

    assert.equal(typeof record.label, "string", `${record.entityType} should have a label`);
    assert.equal(validRecordSets.has(record.recordSet), true, `${record.entityType} should use a known recordSet`);
    assert.equal(validMutability.has(record.mutability), true, `${record.entityType} should use a known mutability`);
    assert.equal(typeof record.ownerSurface, "string", `${record.entityType} should have an ownerSurface`);
    assert.equal(typeof record.standard, "string", `${record.entityType} should describe the preferred UX standard`);
    assert.equal(typeof record.gap, "string", `${record.entityType} should describe the current gap or confirm none`);
    assert.equal(typeof record.nextSlice, "string", `${record.entityType} should describe the next refactor slice`);

    for (const key of coverageKeys) {
      assert.equal(typeof record[key], "string", `${record.entityType} should define ${key}`);
      assert.equal(validCoverageStates.has(record[key]), true, `${record.entityType}.${key} should use a known state`);
    }

    const hasKnownGap = coverageKeys.some((key) => record[key] === "partial" || record[key] === "missing");
    assert.equal(
      hasKnownGap ? record.gap.trim().length > 0 : true,
      true,
      `${record.entityType} should describe gaps when coverage is partial or missing`
    );

    if (record.mutability === "user-editable" || record.mutability === "local-only") {
      assert.notEqual(record.list, "missing", `${record.entityType} editable records need list coverage`);
      assert.notEqual(record.detail, "missing", `${record.entityType} editable records need detail coverage`);
      assert.notEqual(record.create, "missing", `${record.entityType} editable records need create coverage`);
    }
  }

  const contractTypes = matrix.records
    .filter((record) => record.recordSet === "contract")
    .map((record) => record.entityType)
    .sort();
  assert.deepEqual(
    contractTypes,
    [...contractEntityTypes].sort(),
    "UX coverage should cover every contract entity type"
  );

  const pubLocalTypes = matrix.records
    .filter((record) => record.recordSet === "pub-local")
    .map((record) => record.entityType)
    .sort();
  assert.deepEqual(
    pubLocalTypes,
    [...pubLocalRecordTypes].sort(),
    "UX coverage should cover current Pub local records"
  );

  const relationshipManagerCandidates = matrix.records.filter(
    (record) => record.relationships === "partial" || record.relationships === "missing"
  );
  assert.ok(
    relationshipManagerCandidates.length > 0,
    "UX coverage should retain relationship-manager candidates until shared implementation is complete"
  );

  return {
    contractTypeCount: contractTypes.length,
    pubLocalTypeCount: pubLocalTypes.length,
    relationshipManagerCandidateCount: relationshipManagerCandidates.length
  };
}

export async function runUxCoverageCheck({ cwd = process.cwd() } = {}) {
  const matrixPath = join(cwd, "pspf-entity-ux-coverage.json");
  const matrix = JSON.parse(await readFile(matrixPath, "utf8"));
  const result = validateUxCoverageMatrix(matrix);
  console.log(
    `ok UX coverage matrix covers ${result.contractTypeCount} contract entity type(s) and ${result.pubLocalTypeCount} Pub local record type(s)`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runUxCoverageCheck();
}
