// Explorer-to-Workshop import gate (ADR 0004, 0009, 0084).
// End-to-end round trip through the real surfaces:
// 1. Serve the built Explorer and load the published enterprise sample bundle
//    through the Core exchange view (checksums verified in-app).
// 2. Apply it to browser-local stores, author a local risk, then download the
//    Core bundle export from the UI.
// 3. Import that export into a fresh Core workspace with full-replace and
//    assert validation passes and Workshop-visible records survive.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createCoreService } from "../packages/core/dist/service.js";
import { serveStaticDir } from "./lib/serve-explorer.mjs";

const root = process.cwd();
const distDir = join(root, "packages", "explorer", "dist");
const reportDirectory = join(root, ".tmp", "explorer-to-workshop-import");
const reportPath = join(reportDirectory, "explorer-to-workshop-import-report.json");
await mkdir(reportDirectory, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

assert.ok(existsSync(join(distDir, "index.html")), "packages/explorer/dist/index.html missing; run pnpm build first");

const localRiskTitle = `Explorer import risk ${Date.now()}`;
const downloadDir = join(reportDirectory, "downloads");
await rm(downloadDir, { recursive: true, force: true });
await mkdir(downloadDir, { recursive: true });

const server = await serveStaticDir(distDir);
const browser = await chromium.launch({ headless: true });
let exportPath;
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

  // Load and apply the sample bundle through the Core exchange view.
  await page.goto(`${server.baseUrl}#/core`);
  const exchange = page.locator("pspf-core-exchange-view");
  await exchange.waitFor({ state: "visible", timeout: 15000 });
  await exchange.getByTestId("core-bundle-file").setInputFiles(join(distDir, "sample-bundle-enterprise.json"));
  await exchange.getByTestId("import-plan").waitFor({ state: "visible", timeout: 15000 });
  await exchange.getByTestId("apply-core-bundle").click();
  await exchange.locator(".alert.ok").waitFor({ state: "visible", timeout: 15000 });
  check("sample bundle loads and applies through the Core exchange", true);

  // Author a local risk so the export carries an Explorer-authored record.
  await page.goto(`${server.baseUrl}#/risks`);
  const risksView = page.locator("pspf-risks-view");
  await risksView.waitFor({ state: "visible", timeout: 15000 });
  await risksView.getByLabel("Title").fill(localRiskTitle);
  await risksView.getByLabel("Likelihood").selectOption("4");
  await risksView.getByLabel("Impact").selectOption("4");
  await risksView.getByRole("button", { name: "Add risk" }).click();
  await risksView.locator("li.risk", { hasText: localRiskTitle }).waitFor({ state: "visible", timeout: 15000 });
  check("local risk authored in the Explorer", true);

  // Download the Core bundle export from the UI.
  await page.goto(`${server.baseUrl}#/core`);
  await exchange.waitFor({ state: "visible", timeout: 15000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await exchange.getByTestId("export-core-bundle").click();
  const download = await downloadPromise;
  exportPath = join(downloadDir, download.suggestedFilename() || "explorer-core-bundle.json");
  await download.saveAs(exportPath);
  check("Explorer downloads a Core bundle export", existsSync(exportPath));

  check("no page errors during export flow", pageErrors.length === 0, pageErrors.join("; ") || undefined);
} finally {
  await browser.close();
  await server.close();
}

// Import the Explorer export into a fresh Core workspace.
const exported = JSON.parse(readFileSync(exportPath, "utf8"));
check("export is a manifest-led master bundle", exported.manifest?.bundleType === "pspf-explorer-bundle");
const workspaceDir = join(tmpdir(), `pspf-explorer-import-${Date.now()}`);
await mkdir(workspaceDir, { recursive: true });
try {
  const service = createCoreService(workspaceDir);
  await service.initialiseWorkspace();
  const importResult = await service.importBundle(exportPath, "full-replace");
  check(
    "Core imports the Explorer export with full-replace",
    importResult.imported > 0,
    `${importResult.imported} records`
  );
  const validation = await service.validateWorkspace();
  check(
    "imported workspace passes Core validation",
    validation.ok,
    validation.ok ? undefined : JSON.stringify(validation.issues ?? []).slice(0, 400)
  );
  const risks = await service.listEntities("risk");
  const importedRisk = risks.find((risk) => risk.title === localRiskTitle);
  check("Explorer-authored risk is Workshop-visible after import", Boolean(importedRisk));
  const requirements = await service.listEntities("requirement");
  check("requirements survive the round trip", requirements.length > 0, `${requirements.length} requirements`);
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

const ok = checks.every((item) => item.ok);
await writeFile(
  reportPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), ok, checks }, null, 2) + "\n",
  "utf8"
);
console.log(`report: ${reportPath}`);
assert.ok(ok, "explorer-to-workshop import checks failed");
console.log(`ok explorer-to-workshop import passed (${checks.length} checks)`);
