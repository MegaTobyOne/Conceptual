import assert from "node:assert/strict";
import test from "node:test";
import { describeChangeRollup } from "./index.js";

test("describeChangeRollup: no changes at all", () => {
  assert.equal(
    describeChangeRollup({ improved: 0, regressed: 0, wentStale: 0 }),
    "No recorded changes in this period."
  );
});

test("describeChangeRollup: only improvements", () => {
  assert.equal(describeChangeRollup({ improved: 3, regressed: 0, wentStale: 0 }), "3 improved.");
});

test("describeChangeRollup: mixed narrative in improved/regressed/stale order", () => {
  assert.equal(
    describeChangeRollup({ improved: 3, regressed: 1, wentStale: 2 }),
    "3 improved, 1 regressed, 2 went stale."
  );
});

test("describeChangeRollup: omits zero-count categories", () => {
  assert.equal(describeChangeRollup({ improved: 0, regressed: 1, wentStale: 0 }), "1 regressed.");
});
