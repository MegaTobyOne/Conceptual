import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency } from "./util.js";

test("Shop currency formatting falls back for invalid user currency codes", () => {
  assert.equal(formatCurrency(1234, "not-a-currency"), "AUD 1,234");
  assert.equal(formatCurrency(1234.567, "not-a-currency"), "AUD 1,234.57");
  assert.doesNotMatch(formatCurrency(1234.567, "not-a-currency"), /\.\d{3,}/);
});
