import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, formatCurrency, formatToken } from "./util.js";

test("Shop webview formatting tolerates malformed persisted values", () => {
  const cases: readonly [unknown, string][] = [
    [undefined, ""],
    [null, ""],
    ["", ""],
    [12, "12"],
    [false, "False"],
    [{ legacy: true }, "[object Object]"]
  ];

  for (const [value, expectedToken] of cases) {
    assert.doesNotThrow(() => escapeHtml(value));
    assert.equal(formatToken(value), expectedToken);
  }

  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("Shop currency formatting falls back for invalid user currency codes", () => {
  assert.equal(formatCurrency(1234, "not-a-currency"), "AUD 1,234");
  assert.equal(formatCurrency(1234.567, "not-a-currency"), "AUD 1,234.57");
  assert.doesNotMatch(formatCurrency(1234.567, "not-a-currency"), /\.\d{3,}/);
});
