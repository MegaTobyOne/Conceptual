import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const explorerPath = join(root, "packages", "explorer", "dist", "index.html");
const bundlePath = findBundlePath();
const reportDirectory = join(root, ".tmp", "explorer-publication");
await mkdir(reportDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(pathToFileURL(explorerPath).href);
  await page.waitForFunction(() => typeof globalThis.pspfExplorerRender === "function");
  const bundle = JSON.parse(await readFileSyncText(bundlePath));
  await page.evaluate(async (value) => {
    await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
  }, bundle);
  await page.waitForSelector("#validation:not([hidden])");

  const visibleText = await page.locator("body").innerText();
  const validationFailures = await page.locator("#validation .check.fail").count();
  const copyButtonVisible = await page.getByRole("button", { name: "Copy posture brief" }).isVisible();
  const brief = await page.evaluate(() => globalThis.pspfExplorerCurrentBrief && globalThis.pspfExplorerCurrentBrief());

  const checks = [
    check("No page errors", pageErrors.length === 0, pageErrors.join("; ")),
    check("No console errors", consoleErrors.length === 0, consoleErrors.join("; ")),
    check("Validation panel has no failed checks", validationFailures === 0, `${validationFailures} failed check(s)`),
    check("Visible PSPF slice version", visibleText.includes(`PSPF v${PSPF_SLICE_VERSION}`), `PSPF v${PSPF_SLICE_VERSION}`),
    check("Visible schema version", visibleText.includes(`Schema ${VERSION_AXES.schemaVersion}`), `Schema ${VERSION_AXES.schemaVersion}`),
    check("Visible bundle version", visibleText.includes(`Bundle ${VERSION_AXES.bundleVersion}`), `Bundle ${VERSION_AXES.bundleVersion}`),
    check("Visible API version", visibleText.includes(`API ${VERSION_AXES.apiVersion}`), `API ${VERSION_AXES.apiVersion}`),
    check("Copy posture brief button visible", copyButtonVisible, "button"),
    check("Generated brief includes classification", typeof brief === "string" && brief.includes("OFFICIAL: Sensitive"), "classification"),
    check("Generated brief excludes sensitive summary", typeof brief === "string" && !brief.includes("Internal assessment working note"), "summary redaction"),
    check("Readable requirement title rendered", visibleText.includes("Validate governance reporting workflow"), "requirement title"),
    check("Readable relationship target rendered", visibleText.includes("Governance committee terms of reference"), "evidence title")
  ];

  const failed = checks.filter((item) => !item.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    explorerPath: relative(root, explorerPath),
    bundlePath: relative(root, bundlePath),
    checks
  };
  await writeFile(join(reportDirectory, "explorer-publication-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  assert.equal(failed.length, 0, failed.map((item) => `${item.name}: ${item.detail}`).join("\n"));
  console.log("ok Explorer publication smoke passed");
  console.log(`report: ${relative(root, join(reportDirectory, "explorer-publication-report.json"))}`);
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

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}
