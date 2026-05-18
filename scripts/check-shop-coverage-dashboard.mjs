import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");

for (const requiredText of [
    "NEAR_TERM_REVIEW_DAYS = 120",
    "deriveCoverageDashboard",
    "Assurance coverage",
    "Near-term contract review",
    "Funded Actions",
    "Supplier Risk links",
    "isSupplierAssuranceLink",
    "isContractAssuranceLink",
    "isSpendAssuranceLink",
    "createWebviewPanel(\"pspfShopForecast\"",
    "renderCompactForecastHtml",
    "Open full forecast",
    "enableCommandUris: true",
    "commandUri(group.linkCommand",
    "commandUri(\"pspf.shop.openForecast\"",
    "pspf.shop.linkSupplierToRequirement",
    "pspf.shop.linkContractToRequirement",
    "pspf.shop.linkSpendToAction"
]) {
    assert.equal(shopExtension.includes(requiredText), true, `Shop coverage dashboard should mention ${requiredText}`);
}

const renderStart = shopExtension.indexOf("function renderForecastHtml");
const renderEnd = shopExtension.indexOf("function getPublicationStatus");
assert.ok(renderStart > 0 && renderEnd > renderStart, "Shop coverage dashboard render function should be locatable");
const renderBody = shopExtension.slice(renderStart, renderEnd);

for (const excludedText of ["primaryContact", "serviceSummary", "assumptions"]) {
    assert.equal(renderBody.includes(excludedText), false, `Shop coverage dashboard render should not expose ${excludedText}`);
}

console.log("ok Shop commercial coverage dashboard gate passes");