// Explorer publication smoke gate (ADR 0004, 0009, 0010, 0011, 0012, 0016).
// Drives the built Vite/Lit Explorer (packages/explorer/dist) served over HTTP
// at the production /explorer/ base path, and verifies:
// - published sample bundles carry no disallowed personal fields and declare
//   OFFICIAL: Sensitive labelling with current version axes;
// - the per-version bundle schema is published;
// - the app renders readable records and the version marker;
// - a Core master bundle loads through the Core exchange with an import plan
//   and applies into browser-local stores;
// - the relationship map surface renders (ADR 0010);
// - the posture brief copy control is present with the OFFICIAL: Sensitive
//   payload (shared brief renderer).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { DISALLOWED_PUBLICATION_FIELDS, VERSION_AXES } from "../packages/contracts/dist/index.js";
import { serveStaticDir } from "./lib/serve-explorer.mjs";

const root = process.cwd();
const distDir = join(root, "packages", "explorer", "dist");
const reportDirectory = join(root, ".tmp", "explorer-publication");
const reportPath = join(reportDirectory, "explorer-publication-report.json");
await mkdir(reportDirectory, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

assert.ok(existsSync(join(distDir, "index.html")), "packages/explorer/dist/index.html missing; run pnpm build first");

// --- Static publication checks -------------------------------------------
const samplePaths = ["sample-bundle-enterprise.json", "sample-bundle-home.json", "sample-bundle.json"];
for (const sampleName of samplePaths) {
  const samplePath = join(distDir, sampleName);
  check(`sample bundle published: ${sampleName}`, existsSync(samplePath));
  if (!existsSync(samplePath)) continue;
  const bundle = JSON.parse(readFileSync(samplePath, "utf8"));
  const keys = new Set();
  collectKeys(bundle, keys);
  const disallowed = DISALLOWED_PUBLICATION_FIELDS.filter((field) => keys.has(field));
  check(
    `no disallowed publication fields in ${sampleName}`,
    disallowed.length === 0,
    disallowed.join(", ") || undefined
  );
  check(
    `sensitive labelling declared in ${sampleName}`,
    bundle.manifest?.security?.classification === "OFFICIAL: Sensitive"
  );
  check(
    `version axes current in ${sampleName}`,
    bundle.manifest?.schemaVersion === VERSION_AXES.schemaVersion &&
      bundle.manifest?.bundleVersion === VERSION_AXES.bundleVersion &&
      bundle.manifest?.apiVersion === VERSION_AXES.apiVersion
  );
  check(`manifest-led master bundle format in ${sampleName}`, bundle.manifest?.bundleType === "pspf-explorer-bundle");
}

const schemaDir = join(root, "schemas", "explorer-bundle", VERSION_AXES.schemaVersion);
check(
  `per-version schema published for ${VERSION_AXES.schemaVersion}`,
  existsSync(join(schemaDir, "manifest.schema.json"))
);

// --- Browser checks --------------------------------------------------------
const server = await serveStaticDir(distDir);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"]
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Fresh browser-local state.
  await page.goto(server.baseUrl);
  await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload();

  await page.locator("pspf-home-view").waitFor({ state: "visible", timeout: 15000 });
  check("home view renders", true);
  const versionMarker = await page.locator("pspf-app").getByText(`v${readRootVersion()}`).count();
  check("version marker visible", versionMarker > 0);

  // Requirements render readable records.
  await page.goto(`${server.baseUrl}#/requirements`);
  const requirementLinks = page.locator("pspf-requirements-view a");
  await requirementLinks.first().waitFor({ state: "visible", timeout: 15000 });
  const requirementCount = await requirementLinks.count();
  check("requirements list renders records", requirementCount > 0, `${requirementCount} links`);

  // Core exchange: load the published enterprise sample bundle.
  await page.goto(`${server.baseUrl}#/core`);
  await page.locator("pspf-core-exchange-view").waitFor({ state: "visible", timeout: 15000 });
  await page
    .locator("pspf-core-exchange-view")
    .getByTestId("core-bundle-file")
    .setInputFiles(join(distDir, "sample-bundle-enterprise.json"));
  const plan = page.locator("pspf-core-exchange-view").getByTestId("import-plan");
  await plan.waitFor({ state: "visible", timeout: 15000 });
  check("core exchange shows import plan for sample bundle", true);
  check("import plan shows sensitive classification", (await plan.textContent())?.includes("OFFICIAL: Sensitive"));
  await page.locator("pspf-core-exchange-view").getByTestId("apply-core-bundle").click();
  await page.locator("pspf-core-exchange-view").locator(".alert.ok").waitFor({ state: "visible", timeout: 15000 });
  check("sample bundle applies to browser-local stores", true);

  // Applied records visible in the risk register.
  await page.goto(`${server.baseUrl}#/risks`);
  const riskItems = page.locator("pspf-risks-view li.risk");
  await riskItems.first().waitFor({ state: "visible", timeout: 15000 });
  check("imported risks render in the risk register", (await riskItems.count()) > 0);

  // Relationship surface (ADR 0010).
  await page.goto(`${server.baseUrl}#/map`);
  await page.locator("pspf-relationship-map-view").waitFor({ state: "visible", timeout: 15000 });
  check("relationship map renders", true);

  // Posture brief copy (shared brief renderer).
  await page.goto(`${server.baseUrl}#/posture`);
  const briefButton = page.locator("pspf-posture-view").getByTestId("copy-posture-brief");
  await briefButton.waitFor({ state: "visible", timeout: 15000 });
  await briefButton.click();
  await page
    .locator("pspf-posture-view")
    .locator(".brief-status")
    .filter({ hasText: "copied" })
    .waitFor({ state: "visible", timeout: 15000 });
  // Runs in the browser context, where navigator is defined.
  const briefText = await page.evaluate("navigator.clipboard.readText()");
  check("posture brief copies markdown", briefText.includes("# PSPF Posture Brief"));
  check("posture brief carries OFFICIAL: Sensitive banner", briefText.includes("OFFICIAL: Sensitive"));
  for (const field of DISALLOWED_PUBLICATION_FIELDS) {
    if (briefText.includes(`"${field}"`)) {
      check(`posture brief must not include ${field}`, false);
    }
  }

  check("no page errors during publication smoke", pageErrors.length === 0, pageErrors.join("; ") || undefined);
} finally {
  await browser.close();
  await server.close();
}

const ok = checks.every((item) => item.ok);
await writeFile(
  reportPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), ok, checks }, null, 2) + "\n",
  "utf8"
);
console.log(`report: ${reportPath}`);
assert.ok(ok, "explorer publication smoke failed");
console.log(`ok explorer publication smoke passed (${checks.length} checks)`);

function collectKeys(value, keys) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
}

function readRootVersion() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
}
