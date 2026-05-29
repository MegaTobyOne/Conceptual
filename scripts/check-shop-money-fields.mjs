import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
const shopForecast = await readFile(join(root, "packages/shop/src/forecast.ts"), "utf8");
const shopForecastTest = await readFile(join(root, "packages/shop/src/forecast.test.ts"), "utf8");

for (const requiredText of [
  "export function moneyInputValue",
  "export function moneyAmountValue",
  "export function formatMoneyAmount",
  "export function deriveForecast",
  "export function deriveForecastMonths",
  "export function spendTotals",
  'requiredNumberField(fields.amount, "Amount")'
]) {
  assert.equal(
    `${shopExtension}\n${shopForecast}`.includes(requiredText),
    true,
    `Shop money field guard should include ${requiredText}`
  );
}

for (const requiredTestText of [
  "totals forecast years from forward-looking spend only",
  "allocates forecast cost and savings by month",
  "calculates scenario totals and assurance-link gaps",
  "uses forecast-cost fallback consistently in totals and report columns",
  "formats dollar values for display helpers"
]) {
  assert.equal(shopForecastTest.includes(requiredTestText), true, `Shop money tests should cover ${requiredTestText}`);
}

for (const unsafePattern of [/\.amount\.amount/u, /\.forecastCost\?\.amount/u, /\.expectedSavings\?\.amount/u]) {
  assert.equal(
    unsafePattern.test(`${shopExtension}\n${shopForecast}`),
    false,
    `Shop money fields should use guarded helpers instead of ${unsafePattern}`
  );
}

const forecastTest = spawnSync(process.execPath, ["--test", join(root, "packages/shop/dist/forecast.test.js")], {
  cwd: root,
  encoding: "utf8",
  stdio: "pipe"
});

assert.equal(
  forecastTest.status,
  0,
  `Shop forecast money arithmetic test failed\n${forecastTest.stdout}\n${forecastTest.stderr}`
);

console.log("ok Shop money fields use guarded dollar-value helpers and tested forecast arithmetic");
