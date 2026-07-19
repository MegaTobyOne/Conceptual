// Explorer accessibility gate: axe-core scan of the built Explorer served at
// the production /explorer/ base path. Loads the published enterprise sample
// bundle first so scanned views carry real records, then scans the key
// routes. Fails on any serious or critical WCAG finding.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { serveStaticDir } from "./lib/serve-explorer.mjs";

const root = process.cwd();
const distDir = join(root, "packages", "explorer", "dist");
const reportDirectory = join(root, ".tmp", "accessibility");
const reportPath = join(reportDirectory, "explorer-accessibility-report.json");
await mkdir(reportDirectory, { recursive: true });

assert.ok(existsSync(join(distDir, "index.html")), "packages/explorer/dist/index.html missing; run pnpm build first");

const routes = ["#/", "#/requirements", "#/risks", "#/actions", "#/posture", "#/core", "#/map", "#/analytics"];

const server = await serveStaticDir(distDir);
const browser = await chromium.launch({ headless: true });
const routeResults = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(server.baseUrl);
  await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload();
  await page.locator("pspf-home-view").waitFor({ state: "visible", timeout: 15000 });

  // Load real records so authored views are scanned in a populated state.
  await page.goto(`${server.baseUrl}#/core`);
  const exchange = page.locator("pspf-core-exchange-view");
  await exchange.waitFor({ state: "visible", timeout: 15000 });
  await exchange.getByTestId("core-bundle-file").setInputFiles(join(distDir, "sample-bundle-enterprise.json"));
  await exchange.getByTestId("import-plan").waitFor({ state: "visible", timeout: 15000 });
  await exchange.getByTestId("apply-core-bundle").click();
  await exchange.locator(".alert.ok").waitFor({ state: "visible", timeout: 15000 });

  for (const route of routes) {
    await page.goto(`${server.baseUrl}${route}`);
    // Let the lazily loaded view settle before scanning.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(250);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const violations = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? "unknown",
      description: violation.description,
      nodes: violation.nodes.length
    }));
    routeResults.push({ route, violations });
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log(
      `${serious.length === 0 ? "ok" : "FAIL"} ${route} — ${violations.length} findings, ${serious.length} serious/critical`
    );
  }

  assert.deepEqual(pageErrors, [], `page errors during accessibility scan: ${pageErrors.join("; ")}`);
} finally {
  await browser.close();
  await server.close();
}

const allViolations = routeResults.flatMap((r) => r.violations.map((v) => ({ ...v, route: r.route })));
const seriousOrCritical = allViolations.filter(
  (violation) => violation.impact === "serious" || violation.impact === "critical"
);
const report = {
  generatedAt: new Date().toISOString(),
  target: "packages/explorer/dist served at /explorer/",
  routes: routeResults,
  totalViolationCount: allViolations.length,
  seriousOrCriticalCount: seriousOrCritical.length,
  seriousOrCritical
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`report: ${reportPath}`);
assert.equal(
  seriousOrCritical.length,
  0,
  `serious/critical accessibility findings: ${JSON.stringify(seriousOrCritical, null, 2)}`
);
console.log(`ok accessibility floor met across ${routes.length} routes (0 serious/critical findings)`);
