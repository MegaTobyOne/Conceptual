import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
const shopForecast = await readFile(join(root, "packages/shop/src/forecast.ts"), "utf8");
const shopSources = `${shopExtension}\n${shopForecast}`;

for (const requiredText of [
  "NEAR_TERM_REVIEW_DAYS = 120",
  "deriveCoverageDashboard",
  "Assurance coverage",
  "Near-term contract review",
  "Funded Actions",
  "Supplier Risk links",
  "deriveForecastMonths",
  "Forecast spend by month",
  "Forward-looking forecast only. Actuals are not shown in this panel.",
  "deriveSavingSchedule",
  "Planned savings schedule",
  "Planned efficiency dividends",
  "planned efficiency dividend",
  "replacement context",
  "Export CSV",
  "Export XLS",
  "renderForecastReportCsv",
  "renderForecastReportXls",
  "pspf.shop.exportForecastCsv",
  "pspf.shop.exportForecastXls",
  "Supplier performance and management checks",
  "FOCI check",
  "Contract artefact links",
  "CPR source",
  "Commonwealth Supplier Code of Conduct",
  "Contract Management Guide",
  "isSupplierAssuranceLink",
  "isContractAssuranceLink",
  "isSpendAssuranceLink",
  'createWebviewPanel("pspfShopForecast"',
  "renderCompactForecastHtml",
  "Open full forecast",
  "enableCommandUris: true",
  "commandUri(group.linkCommand",
  'commandUri("pspf.shop.openForecast"',
  "pspf.shop.linkSupplierToRequirement",
  "pspf.shop.linkContractToRequirement",
  "pspf.shop.linkSpendToAction",
  "pspf.shop.linkSpendItemToContract",
  "Spend items needing contract funding links",
  "Total annual cost",
  "annual-cost",
  "contract funds spend-item",
  "isContractFundingLink",
  "deriveScenarioSummaries",
  "deriveAssuranceSpend",
  "Scenario comparison",
  "Spend by Requirement, tag, and Action",
  "Approved and committed baseline",
  "Include proposed work",
  "promptSpendItemAssuranceLink"
]) {
  assert.equal(shopSources.includes(requiredText), true, `Shop coverage dashboard should mention ${requiredText}`);
}

const renderStart = shopExtension.indexOf("function renderForecastHtml");
const renderEnd = shopExtension.indexOf("function getPublicationStatus");
assert.ok(renderStart > 0 && renderEnd > renderStart, "Shop coverage dashboard render function should be locatable");
const renderBody = shopExtension.slice(renderStart, renderEnd);

for (const excludedText of ["primaryContact", "serviceSummary", "assumptions"]) {
  assert.equal(
    renderBody.includes(excludedText),
    false,
    `Shop coverage dashboard render should not expose ${excludedText}`
  );
}

assert.equal(renderBody.includes("Actuals</"), false, "Shop forecast should not render an Actuals table column");
assert.equal(renderBody.includes("spent"), false, "Shop forecast render should avoid actual-spend language");

console.log("ok Shop commercial coverage dashboard gate passes");
