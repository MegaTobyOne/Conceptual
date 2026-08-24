import assert from "node:assert/strict";
import test from "node:test";
import { buildSustainNote, computeClosureVelocity, projectTrajectory } from "./index.js";

test("computeClosureVelocity: needs at least two points", () => {
  assert.equal(computeClosureVelocity([]), undefined);
  assert.equal(computeClosureVelocity([{ date: "2026-01-01T00:00:00Z", value: 50 }]), undefined);
});

test("computeClosureVelocity: computes positive points-per-day", () => {
  const velocity = computeClosureVelocity([
    { date: "2026-01-01T00:00:00Z", value: 50 },
    { date: "2026-01-11T00:00:00Z", value: 60 }
  ]);
  assert.equal(velocity?.windowDays, 10);
  assert.equal(velocity?.pointsPerDay, 1);
});

test("computeClosureVelocity: negative trend yields negative velocity", () => {
  const velocity = computeClosureVelocity([
    { date: "2026-01-01T00:00:00Z", value: 60 },
    { date: "2026-01-11T00:00:00Z", value: 50 }
  ]);
  assert.equal(velocity?.pointsPerDay, -1);
});

test("computeClosureVelocity: rejects non-chronological or unparsable points", () => {
  assert.equal(
    computeClosureVelocity([
      { date: "2026-01-11T00:00:00Z", value: 50 },
      { date: "2026-01-01T00:00:00Z", value: 60 }
    ]),
    undefined
  );
  assert.equal(
    computeClosureVelocity([
      { date: "not-a-date", value: 50 },
      { date: "2026-01-11T00:00:00Z", value: 60 }
    ]),
    undefined
  );
});

test("projectTrajectory: already-reached target is reachable with no assumption needed", () => {
  const reference = new Date("2026-08-24T00:00:00Z");
  const projection = projectTrajectory(100, undefined, 100, reference);
  assert.equal(projection.reachable, true);
  assert.equal(projection.assumption, "Target already reached.");
  assert.equal(projection.estimatedDate, reference.toISOString());
});

test("projectTrajectory: no velocity is not reachable and states why", () => {
  const reference = new Date("2026-08-24T00:00:00Z");
  const projection = projectTrajectory(50, undefined, 100, reference);
  assert.equal(projection.reachable, false);
  assert.match(projection.assumption, /No positive closure velocity/);
});

test("projectTrajectory: no velocity with blockers names the blocker count", () => {
  const reference = new Date("2026-08-24T00:00:00Z");
  const projection = projectTrajectory(50, undefined, 100, reference, 3);
  assert.match(projection.assumption, /resolving the top 3 blocker\(s\)/);
});

test("projectTrajectory: positive velocity yields a range and stated assumption, never a bare date", () => {
  const reference = new Date("2026-08-24T00:00:00Z");
  const projection = projectTrajectory(50, { pointsPerDay: 1, windowDays: 30 }, 100, reference);
  assert.equal(projection.reachable, true);
  assert.match(projection.assumption, /Assumes the observed closure rate/);
  assert.ok(projection.estimatedDate);
  assert.ok(projection.rangeLowDate);
  assert.ok(projection.rangeHighDate);
  assert.ok(new Date(projection.rangeLowDate ?? "") < new Date(projection.rangeHighDate ?? ""));
});

test("projectTrajectory: couples the range to blockers when supplied", () => {
  const reference = new Date("2026-08-24T00:00:00Z");
  const projection = projectTrajectory(50, { pointsPerDay: 1, windowDays: 30 }, 100, reference, 2);
  assert.match(projection.assumption, /resolving the top 2 blocker\(s\) would shift this range earlier/);
});

test("buildSustainNote: zero expiring is a clean statement", () => {
  assert.equal(buildSustainNote(0), "No met requirements are due to lose evidence backing in the next 90 days.");
});

test("buildSustainNote: singular wording for one", () => {
  assert.equal(
    buildSustainNote(1),
    "1 met requirement needs refreshed evidence within 90 days to sustain the current position."
  );
});

test("buildSustainNote: plural wording for more than one", () => {
  assert.equal(
    buildSustainNote(3),
    "3 met requirements need refreshed evidence within 90 days to sustain the current position."
  );
});
