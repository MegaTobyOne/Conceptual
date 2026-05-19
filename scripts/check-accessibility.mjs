import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

const root = process.cwd();
const explorerPath = join(root, "packages", "explorer", "dist", "index.html");
const bundlePath = findBundlePath();
const reportDirectory = join(root, ".tmp", "accessibility");
await mkdir(reportDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(pathToFileURL(explorerPath).href);
  await page.waitForFunction(() => typeof globalThis.pspfExplorerRender === "function");
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  await page.evaluate(async (value) => {
    await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
  }, bundle);
  await page.waitForSelector("#validation:not([hidden])");
  assert.deepEqual(pageErrors, []);

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  const report = {
    generatedAt: new Date().toISOString(),
    explorerPath: relative(root, explorerPath),
    bundlePath: relative(root, bundlePath),
    violationCount: results.violations.length,
    seriousOrCriticalCount: seriousOrCritical.length,
    seriousOrCritical: seriousOrCritical.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target)
    }))
  };

  await writeFile(
    join(reportDirectory, "explorer-accessibility-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  assert.equal(
    seriousOrCritical.length,
    0,
    seriousOrCritical.map((violation) => `${violation.id}: ${violation.help}`).join("\n")
  );
  console.log("ok Explorer accessibility floor passed with zero serious/critical axe findings");
  console.log(`report: ${relative(root, join(reportDirectory, "explorer-accessibility-report.json"))}`);
} finally {
  await browser.close();
}

function findBundlePath() {
  const e2eReportPath = join(root, ".tmp", "e2e-v0.1-workspace", ".pspf", "reports", "e2e-v0.1-report.json");
  if (existsSync(e2eReportPath)) {
    const report = JSON.parse(readFileSyncText(e2eReportPath));
    const candidate = join(root, report.bundlePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(root, "packages", "contracts", "test-fixtures", "standard", "bundle.json");
}

function readFileSyncText(path) {
  return readFileSync(path, "utf8");
}
