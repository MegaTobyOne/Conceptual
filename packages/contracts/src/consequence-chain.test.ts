import assert from "node:assert/strict";
import test from "node:test";
import { buildConsequenceStatement, buildUncoveredRiskStatement, summariseUncoveredRisk } from "./index.js";

test("buildConsequenceStatement: met with no open risks", () => {
  assert.equal(
    buildConsequenceStatement({ met: true, openLinkedRiskCount: 0, maxLinkedRiskSeverity: 0 }),
    "No open risks are currently linked to this requirement."
  );
});

test("buildConsequenceStatement: not met with no open risks", () => {
  assert.equal(
    buildConsequenceStatement({ met: false, openLinkedRiskCount: 0, maxLinkedRiskSeverity: 0 }),
    "No open risks are currently linked to this requirement, but it is not yet met."
  );
});

test("buildConsequenceStatement: not met with open material risk", () => {
  const statement = buildConsequenceStatement({ met: false, openLinkedRiskCount: 2, maxLinkedRiskSeverity: 16 });
  assert.match(statement, /2 linked risks remain exposed/);
  assert.match(statement, /material/);
});

test("buildConsequenceStatement: met with open low-severity risk uses singular wording", () => {
  const statement = buildConsequenceStatement({ met: true, openLinkedRiskCount: 1, maxLinkedRiskSeverity: 2 });
  assert.match(statement, /1 linked risk remains open/);
  assert.match(statement, /low-severity/);
});

test("summariseUncoveredRisk: counts open risks lacking met coverage", () => {
  const summary = summariseUncoveredRisk(
    [{ id: "risk-1" }, { id: "risk-2" }, { id: "risk-3" }],
    new Map([
      ["risk-1", true],
      ["risk-2", false]
    ])
  );
  assert.deepEqual(summary, {
    openRiskCount: 3,
    uncoveredRiskCount: 2,
    uncoveredRiskIds: ["risk-2", "risk-3"]
  });
});

test("buildUncoveredRiskStatement: no open risks", () => {
  assert.equal(
    buildUncoveredRiskStatement({ openRiskCount: 0, uncoveredRiskCount: 0, uncoveredRiskIds: [] }),
    "No open risks are recorded."
  );
});

test("buildUncoveredRiskStatement: all covered", () => {
  assert.equal(
    buildUncoveredRiskStatement({ openRiskCount: 4, uncoveredRiskCount: 0, uncoveredRiskIds: [] }),
    "All 4 open risk(s) are covered by at least one met requirement."
  );
});

test("buildUncoveredRiskStatement: some uncovered, singular wording", () => {
  assert.equal(
    buildUncoveredRiskStatement({ openRiskCount: 4, uncoveredRiskCount: 1, uncoveredRiskIds: ["risk-1"] }),
    "1 of 4 open risk has no met requirement covering them."
  );
});
