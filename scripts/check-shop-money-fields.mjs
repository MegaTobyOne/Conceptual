import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");

for (const requiredText of [
  "function moneyInputValue",
  "function moneyAmountValue",
  "function formatMoneyAmount",
  'requiredNumberField(fields.amount, "Amount")'
]) {
  assert.equal(shopExtension.includes(requiredText), true, `Shop money field guard should include ${requiredText}`);
}

for (const unsafePattern of [/\.amount\.amount/u, /\.forecastCost\?\.amount/u, /\.expectedSavings\?\.amount/u]) {
  assert.equal(
    unsafePattern.test(shopExtension),
    false,
    `Shop money fields should use guarded helpers instead of ${unsafePattern}`
  );
}

console.log("ok Shop money fields use guarded dollar-value helpers");
