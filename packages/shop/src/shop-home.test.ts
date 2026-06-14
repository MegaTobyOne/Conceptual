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

test("Shop puts Forecast before maintenance surfaces", async () => {
  const source = await readFile(sourcePath, "utf8");
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.ok(manifest.indexOf('"id": "pspfShop.forecastView"') < manifest.indexOf('"id": "pspfShop.homeView"'));
  assert.ok(source.indexOf('homeSection({ id: "forecast"') < source.indexOf('homeSection({ id: "create"'));
  assert.ok(
    source.indexOf('{ href: "forecast", label: "Forecast" }') < source.indexOf('{ href: "trend", label: "Trend" }')
  );
});

test("Shop Home exposes create and edit panels", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /homeSection\(\{ id: "create", eyebrow: "Author", heading: "Create records"/);
  assert.match(source, /homeSection\(\{ id: "edit", eyebrow: "Maintain", heading: "Edit records"/);
  assert.match(source, /homeActionButton\("pspf\.shop\.newSupplier", "New supplier"/);
  assert.match(source, /homeActionButton\("pspf\.shop\.editSupplier", "Edit supplier"/);
  assert.match(source, /homeActionButton\("pspf\.shop\.editContract", "Edit contract"/);
  assert.match(source, /homeActionButton\("pspf\.shop\.editSpendItem", "Edit spend item"/);
  assert.match(source, /async function pickShopRecord/);
});

test("Shop Forecast exposes contract risk attention signals", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /interface ContractRisk/);
  assert.match(source, /function deriveContractRisks/);
  assert.match(source, /contractRisks: deriveContractRisks\(store, links, supplierRisks, supplierById, today\)/);
  assert.match(source, /<h2>Contract risk<\/h2>/);
  assert.match(
    source,
    /Derived attention view across renewal pressure, supplier criticality, linked supplier risks, assurance links, funding links, and contract value/
  );
  assert.match(source, /csvSection\("Contract risk"/);
  assert.match(source, /htmlTable\("Contract risk"/);
});

test("Shop money storage helpers round dollar values to cents", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /function roundMoneyAmount\(value: number\): number/);
  assert.match(source, /return Math\.round\(value \* 100\) \/ 100/);
  assert.match(source, /return \{ amount: roundMoneyAmount\(amount\), currency \}/);
  assert.match(source, /amount: roundMoneyAmount\(value\.amount\)/);
});

test("Shop spend item editor manages recurring cost cadence", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /const BILLING_CADENCES = \["one-off", "monthly", "annual"\] as const/);
  assert.match(source, /readonly billingCadence\?: unknown/);
  assert.match(source, /billingCadence = includedField\(BILLING_CADENCES, fields\.billingCadence\) \?\? "one-off"/);
  assert.match(source, /selectControl\("billingCadence", "Cost cadence", BILLING_CADENCES/);
  assert.match(source, /readonly cashflowMonth\?: unknown/);
  assert.match(source, /selectControl\("cashflowMonth", "Cashflow month", cashflowMonthOptions/);
  assert.match(source, /label: "Cost cadence", value: formatToken\(entity\.billingCadence \?\? "one-off"\)/);
  assert.match(source, /label: "Cashflow month", value: entity\.cashflowMonth \?\? "Not recorded"/);
});
