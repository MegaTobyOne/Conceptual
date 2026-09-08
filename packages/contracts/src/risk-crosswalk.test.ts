import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExternalRefFromRow,
  buildRiskCrosswalkPreview,
  buildRiskCrosswalkWriteSet,
  findPossibleDuplicateByTitle,
  findRiskByExternalIdentity,
  validateRiskCrosswalkRowInput,
  withEnvelope,
  type RiskCrosswalkRowInput,
  type RiskEntity
} from "./index.js";

function sampleRisk(overrides: Partial<RiskEntity> = {}): RiskEntity {
  return withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Sample risk",
      status: "open",
      likelihood: 3,
      impact: 3,
      ...overrides
    },
    "workshop"
  );
}

function row(overrides: Partial<RiskCrosswalkRowInput> = {}): RiskCrosswalkRowInput {
  return {
    rowNumber: 2,
    title: "Vendor outage risk",
    externalId: "EXT-1",
    externalRating: "High",
    sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

test("validateRiskCrosswalkRowInput requires title/externalId/externalRating/sourceUpdatedAt", () => {
  assert.deepEqual(validateRiskCrosswalkRowInput(row()), []);
  assert.equal(validateRiskCrosswalkRowInput(row({ title: "" })).length, 1);
  assert.equal(validateRiskCrosswalkRowInput(row({ externalId: "" })).length, 1);
  assert.equal(validateRiskCrosswalkRowInput(row({ externalRating: "" })).length, 1);
  assert.equal(validateRiskCrosswalkRowInput(row({ sourceUpdatedAt: "not-a-date" })).length, 1);
});

test("validateRiskCrosswalkRowInput rejects a non-https reference URL", () => {
  assert.equal(validateRiskCrosswalkRowInput(row({ referenceUrl: "http://example.test/r/1" })).length, 1);
  assert.equal(validateRiskCrosswalkRowInput(row({ referenceUrl: "https://user:pass@example.test/r/1" })).length, 1);
  assert.deepEqual(validateRiskCrosswalkRowInput(row({ referenceUrl: "https://example.test/r/1" })), []);
});

test("findRiskByExternalIdentity matches only on sourceRegisterId + externalId", () => {
  const risk = sampleRisk({
    externalRefs: [
      {
        sourceRegisterId: "reg-a",
        externalId: "EXT-1",
        externalRating: "High",
        sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
        reconciledAt: "2026-08-01T00:00:00.000Z"
      }
    ]
  });
  assert.equal(findRiskByExternalIdentity("reg-a", "EXT-1", [risk])?.id, risk.id);
  assert.equal(findRiskByExternalIdentity("reg-b", "EXT-1", [risk]), undefined);
  assert.equal(findRiskByExternalIdentity("reg-a", "EXT-2", [risk]), undefined);
});

test("findPossibleDuplicateByTitle flags exact and near-identical titles, never merges", () => {
  const risks = [sampleRisk({ title: "Vendor outage risk" }), sampleRisk({ title: "Unrelated risk" })];
  assert.equal(findPossibleDuplicateByTitle("Vendor Outage Risk", risks)?.title, "Vendor outage risk");
  assert.equal(findPossibleDuplicateByTitle("Vendor outage riskk", risks)?.title, "Vendor outage risk");
  assert.equal(findPossibleDuplicateByTitle("Completely different title here", risks), undefined);
});

test("buildRiskCrosswalkPreview: no match, no duplicate -> create", () => {
  const preview = buildRiskCrosswalkPreview([row()], [], "reg-a", "2026-09-07T00:00:00.000Z");
  assert.equal(preview.length, 1);
  assert.equal(preview[0]!.action, "create");
});

test("buildRiskCrosswalkPreview: invalid row -> conflict", () => {
  const preview = buildRiskCrosswalkPreview([row({ title: "" })], [], "reg-a");
  assert.equal(preview[0]!.action, "conflict");
  assert.equal(preview[0]!.issues.length > 0, true);
});

test("buildRiskCrosswalkPreview: no identity match but similar title -> unmatched, staged, not merged", () => {
  const existing = [sampleRisk({ title: "Vendor outage risk" })];
  const preview = buildRiskCrosswalkPreview([row({ title: "Vendor Outage Risk" })], existing, "reg-a");
  assert.equal(preview[0]!.action, "unmatched");
  assert.equal(preview[0]!.possibleDuplicateOfRiskId, existing[0]!.id);
  assert.equal(preview[0]!.matchedRiskId, undefined);
});

test("buildRiskCrosswalkPreview: identical externalRef data on a second import -> reuse (idempotent)", () => {
  const now = "2026-09-07T00:00:00.000Z";
  const existing = sampleRisk({
    externalRefs: [buildExternalRefFromRow(row(), "reg-a", "2026-09-01T00:00:00.000Z")]
  });
  const preview = buildRiskCrosswalkPreview([row()], [existing], "reg-a", now);
  assert.equal(preview[0]!.action, "reuse");
  assert.equal(preview[0]!.matchedRiskId, existing.id);
});

test("buildRiskCrosswalkPreview: changed externalRating on a matched row -> update", () => {
  const existing = sampleRisk({
    externalRefs: [buildExternalRefFromRow(row(), "reg-a", "2026-09-01T00:00:00.000Z")]
  });
  const preview = buildRiskCrosswalkPreview([row({ externalRating: "Extreme" })], [existing], "reg-a");
  assert.equal(preview[0]!.action, "update");
  assert.equal(preview[0]!.matchedRiskId, existing.id);
});

test("buildRiskCrosswalkWriteSet only writes create/update rows, leaving reuse/conflict/unmatched untouched", () => {
  const existing = sampleRisk({
    title: "Existing matched risk",
    externalRefs: [buildExternalRefFromRow(row(), "reg-a", "2026-09-01T00:00:00.000Z")]
  });
  const preview = [
    { rowNumber: 1, action: "create" as const, input: row({ rowNumber: 1, externalId: "EXT-NEW" }), issues: [] },
    { rowNumber: 2, action: "reuse" as const, input: row({ rowNumber: 2 }), matchedRiskId: existing.id, issues: [] },
    {
      rowNumber: 3,
      action: "update" as const,
      input: row({ rowNumber: 3, externalId: "EXT-1", externalRating: "Extreme" }),
      matchedRiskId: existing.id,
      issues: []
    },
    { rowNumber: 4, action: "conflict" as const, input: row({ rowNumber: 4, title: "" }), issues: ["bad"] },
    { rowNumber: 5, action: "unmatched" as const, input: row({ rowNumber: 5 }), issues: ["dup"] }
  ];
  const writeSet = buildRiskCrosswalkWriteSet(preview, [existing], "reg-a", "2026-09-07T00:00:00.000Z");
  assert.equal(writeSet.length, 2);
  const created = writeSet.find((risk) => risk.title === "Vendor outage risk" && risk.id !== existing.id);
  assert.ok(created);
  assert.equal(created!.assessment?.basis, "unassessed");
  assert.equal(created!.likelihood, 1);
  assert.equal(created!.impact, 1);
  const updated = writeSet.find((risk) => risk.id === existing.id);
  assert.ok(updated);
  assert.equal(updated!.title, "Existing matched risk", "local title is preserved on update");
  assert.equal(updated!.externalRefs?.find((ref) => ref.externalId === "EXT-1")?.externalRating, "Extreme");
});

test("buildRiskCrosswalkWriteSet: reimporting identical confirmed rows produces the same reuse action, no writes", () => {
  const existing = sampleRisk({
    externalRefs: [buildExternalRefFromRow(row(), "reg-a", "2026-09-01T00:00:00.000Z")]
  });
  const firstPreview = buildRiskCrosswalkPreview([row()], [existing], "reg-a");
  const writeSet = buildRiskCrosswalkWriteSet(firstPreview, [existing], "reg-a");
  assert.equal(writeSet.length, 0, "a reuse row never appears in the write set");
});
