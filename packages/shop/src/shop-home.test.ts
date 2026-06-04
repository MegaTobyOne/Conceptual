import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Shop Home exposes one forecast trendline graphic", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /function renderShopTrendline/);
  assert.match(source, /class="shop-trendline"/);
  assert.match(source, /deriveForecastMonths\(store\.spendItems\)/);
  assert.match(source, /homeSection\(\{[\s\S]*id: "trend",[\s\S]*eyebrow: "Forecast",[\s\S]*heading: "Spending trend"/);
});
