import assert from "node:assert/strict";
import test from "node:test";
import { assessmentBasis, assessmentBasisLabel, isWithinFreshnessWindow, summariseAssessmentBasis } from "./index.js";

test("assessmentBasis: no evidence is asserted", () => {
  assert.equal(assessmentBasis(0, 0), "asserted");
});

test("assessmentBasis: evidence present but none fresh is evidenced", () => {
  assert.equal(assessmentBasis(2, 0), "evidenced");
});

test("assessmentBasis: at least one fresh evidence item is evidenced-fresh", () => {
  assert.equal(assessmentBasis(2, 1), "evidenced-fresh");
});

test("assessmentBasisLabel: maps every basis to a stated label", () => {
  assert.equal(assessmentBasisLabel("asserted"), "Asserted (no evidence)");
  assert.equal(assessmentBasisLabel("evidenced"), "Evidenced");
  assert.equal(assessmentBasisLabel("evidenced-fresh"), "Evidenced and fresh");
});

test("isWithinFreshnessWindow: recent timestamp is within the default window", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  const recent = new Date(reference.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isWithinFreshnessWindow(recent, reference), true);
});

test("isWithinFreshnessWindow: timestamp older than the window is stale", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  const old = new Date(reference.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isWithinFreshnessWindow(old, reference), false);
});

test("isWithinFreshnessWindow: future or unparsable timestamps are not fresh", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  const future = new Date(reference.getTime() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isWithinFreshnessWindow(future, reference), false);
  assert.equal(isWithinFreshnessWindow("not-a-date", reference), false);
});

test("summariseAssessmentBasis: aggregates counts and evidenced-fresh percentage", () => {
  const summary = summariseAssessmentBasis([
    { evidenceCount: 0, freshEvidenceCount: 0 },
    { evidenceCount: 1, freshEvidenceCount: 0 },
    { evidenceCount: 1, freshEvidenceCount: 1 },
    { evidenceCount: 2, freshEvidenceCount: 2 }
  ]);
  assert.deepEqual(summary, {
    total: 4,
    asserted: 1,
    evidenced: 1,
    evidencedFresh: 2,
    evidencedFreshPercentage: 50
  });
});

test("summariseAssessmentBasis: empty input is zeroed, not NaN", () => {
  const summary = summariseAssessmentBasis([]);
  assert.deepEqual(summary, {
    total: 0,
    asserted: 0,
    evidenced: 0,
    evidencedFresh: 0,
    evidencedFreshPercentage: 0
  });
});
