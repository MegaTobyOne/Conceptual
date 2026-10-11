import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { serveStaticDir } from "./lib/serve-explorer.mjs";
import { fixture, migrated } from "./check-register-migration.mjs";

const root = process.cwd();
const distDir = join(root, "packages", "workbench", "dist");
const reportDirectory = join(root, ".tmp", "accessibility");
const reportPath = join(reportDirectory, "workbench-accessibility-report.json");
await mkdir(reportDirectory, { recursive: true });
assert.ok(existsSync(join(distDir, "index.html")), "packages/workbench/dist/index.html missing; run pnpm build first");

const server = await serveStaticDir(distDir, { basePath: "/workbench/" });
const browser = await chromium.launch({ headless: true });
const results = [];
const pageErrors = [];
const authoringTypes = [
  "requirement",
  "evidence",
  "action",
  "risk",
  "direction",
  "narrative",
  "requirement-control-mapping"
];
let volumeLoadMs;
async function upload(page, button, name, contents) {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(contents) });
}

async function readRegister(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pspf-workbench.v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction(["entities", "links", "changeLog"], "readonly");
      const read = (name) =>
        new Promise((resolve, reject) => {
          const request = transaction.objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const [entities, links, changeLog] = await Promise.all([read("entities"), read("links"), read("changeLog")]);
      return { entities, links, changeLog };
    } finally {
      database.close();
    }
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(server.baseUrl);
  await page.locator("pspf-workbench").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const register = page.locator("pspf-register-view");
  await register.waitFor({ state: "visible" });
  await upload(
    page,
    register.getByRole("button", { name: "Import migration file" }),
    "register-import.json",
    JSON.stringify(migrated)
  );
  await register.getByText(/Migration complete: 29 created/).waitFor();
  const imported = await readRegister(page);
  assert.deepEqual(
    [...imported.entities, ...imported.links].sort((left, right) => left.id.localeCompare(right.id)),
    [...fixture].sort((left, right) => left.id.localeCompare(right.id)),
    "all migrated records must be field-exact in the browser store"
  );

  async function createRecord(type, title, fields) {
    await register.getByLabel("Record type").selectOption(type);
    await register.getByRole("button", { name: "New record" }).click();
    if (title) await register.getByLabel("Title", { exact: true }).fill(title);
    await fields();
    await register.getByRole("button", { name: "Save", exact: true }).click();
    await register
      .getByText(type === "narrative" ? "Narrative revision saved." : "Register record saved.", { exact: true })
      .waitFor();
  }

  await register.getByRole("button", { name: "New record" }).click();
  await register.getByLabel("Title").fill("Accessibility fixture requirement");
  await register.getByRole("combobox", { name: /^Assessment\b/ }).selectOption("under-review");
  await register.getByLabel("Acceptance definition").fill("Quarterly restore tests are independently reviewed.");
  await register.getByRole("button", { name: "Save", exact: true }).click();
  const record = register.getByRole("button", { name: /Accessibility fixture requirement/ });
  await record.waitFor({ state: "visible" });
  await record.focus();
  await record.press("Enter");
  await register.getByText("Change history", { exact: true }).waitFor({ state: "visible" });

  await createRecord("evidence", "Independence restore evidence", async () => {
    await register.getByLabel("Reference", { exact: true }).fill("Synthetic restore-test record");
    await register.getByLabel("Freshness").selectOption("current");
  });
  await createRecord("action", "Independence restore action", async () => {
    await register.getByLabel("Due date").fill("2026-11-01");
    await register.getByLabel("Owner team").fill("Security Operations");
    await register.getByLabel("Planning state").selectOption("committed");
  });
  await register.getByLabel("Due date").fill("2026-11-08");
  await register.getByRole("button", { name: "Save", exact: true }).click();
  await register.getByText(/2026-11-01.*2026-11-08/).waitFor();

  await createRecord("risk", "Independence restore risk", async () => {
    await register.getByLabel("Description").fill("Restore evidence has not been independently verified.");
  });
  let state = await readRegister(page);
  const action = state.entities.find((entity) => entity.title === "Independence restore action");
  const risk = state.entities.find((entity) => entity.title === "Independence restore risk");
  const requirement = state.entities.find((entity) => entity.title === "Accessibility fixture requirement");
  const evidence = state.entities.find((entity) => entity.title === "Independence restore evidence");
  await register.getByRole("combobox", { name: /^Link to\b/ }).selectOption(action.id);
  await register.getByRole("button", { name: "Add typed link" }).click();
  await register.getByText("Typed link saved.", { exact: true }).waitFor();
  await register.getByLabel("Reason", { exact: true }).fill("Independent review needs a funding decision.");
  await register.getByRole("button", { name: "Record escalation" }).click();
  await register.getByText("Risk escalation recorded in history.", { exact: true }).waitFor();

  await register.getByLabel("Record type").selectOption("requirement");
  await register.getByRole("button", { name: /Accessibility fixture requirement/ }).click();
  for (const target of [evidence, action]) {
    await register.getByRole("combobox", { name: /^Link to\b/ }).selectOption(target.id);
    await register.getByRole("button", { name: "Add typed link" }).click();
    await register.getByText("Typed link saved.", { exact: true }).waitFor();
  }

  await createRecord("direction", "Independence restoration direction", async () => {
    await register.getByLabel("Reference", { exact: true }).fill("Synthetic committee direction");
    await register.getByRole("combobox", { name: /^Response\b/ }).selectOption("risk-managed");
  });
  await createRecord("requirement-control-mapping", undefined, async () => {
    await register.getByRole("combobox", { name: /^Requirement\b/ }).selectOption(requirement.id);
    await register.getByLabel("Applicability profile").fill("OFFICIAL");
    await register.getByLabel("Rationale", { exact: true }).fill("Restore evidence supports this ISM control.");
  });
  await register.getByRole("button", { name: "Mark reviewed" }).click();
  await register.getByRole("button", { name: "Save", exact: true }).click();
  await register.getByText("Register record saved.", { exact: true }).waitFor();

  await createRecord("narrative", undefined, async () => {
    await register.getByLabel("Narrative slot").fill("exec-brief.what-changed");
    await register.getByLabel("Narrative", { exact: true }).fill("Restore testing is awaiting independent review.");
  });
  await register
    .getByLabel("Narrative", { exact: true })
    .fill("Independent review is scheduled; funding remains open.");
  await page.reload();
  await page.locator("pspf-register-view").waitFor();
  assert.equal(
    await register.getByLabel("Narrative", { exact: true }).inputValue(),
    "Independent review is scheduled; funding remains open.",
    "unfinished narrative draft should survive reload"
  );
  await register.getByRole("button", { name: "Save", exact: true }).click();
  await register.getByText("Narrative revision saved.", { exact: true }).waitFor();
  state = await readRegister(page);
  const savedAction = state.entities.find((entity) => entity.id === action.id);
  assert.equal(savedAction.dueDateHistory.length, 2);
  assert.ok(state.entities.some((entity) => entity.entityType === "risk-event" && entity.riskId === risk.id));
  assert.ok(state.entities.some((entity) => entity.entityType === "narrative" && entity.supersedesId));
  assert.ok(
    state.entities.some(
      (entity) =>
        entity.entityType === "requirement-control-mapping" &&
        entity.requirementId === requirement.id &&
        entity.lastReviewedAt
    )
  );
  assert.ok(
    state.links.some((link) => link.fromId === risk.id && link.toId === action.id && link.linkType === "treated-by")
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up", exact: true }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /OFFICIAL-Sensitive/);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backupText = Buffer.concat(chunks).toString("utf8");
  assert.equal(JSON.parse(backupText).classification, "OFFICIAL: Sensitive");
  const restoredContext = await browser.newContext();
  const restoredPage = await restoredContext.newPage();
  restoredPage.on("pageerror", (error) => pageErrors.push(error.message));
  await restoredPage.goto(server.baseUrl);
  await upload(
    restoredPage,
    restoredPage.getByRole("button", { name: "Restore", exact: true }),
    "backup.json",
    backupText
  );
  await restoredPage.getByRole("button", { name: "Replace", exact: true }).click();
  await restoredPage
    .getByText("Restored. Earlier backups may contain data you have since erased.", { exact: true })
    .waitFor();
  assert.deepEqual(
    await readRegister(restoredPage),
    state,
    "register records, links and all history must restore exactly into a second profile"
  );
  await restoredContext.close();
  console.log(
    "ok synthetic extension independence: all-type migration, authoring, drafts, links, histories and second-profile restore"
  );

  const secondPage = await context.newPage();
  secondPage.on("pageerror", (error) => pageErrors.push(error.message));
  await secondPage.goto(server.baseUrl);
  await secondPage.locator("pspf-workbench").waitFor({ state: "visible" });
  await secondPage.getByText("Another tab holds the writer lock. This tab is read-only.").waitFor({ state: "visible" });
  await secondPage.close();

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `horizontal overflow at ${width}px`);
    for (const entityType of authoringTypes) {
      await register.getByLabel("Record type").selectOption(entityType);
      await register.locator("aside button.record").first().click();
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const violations = scan.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        description: violation.description,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary
        }))
      }));
      results.push({ entityType, width, zoom: 100, violations });
    }
    await page.screenshot({ path: join(reportDirectory, `workbench-${width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const overflowAtZoom = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflowAtZoom, false, "horizontal overflow at 200% zoom");
  for (const entityType of authoringTypes) {
    await register.getByLabel("Record type").selectOption(entityType);
    await register.locator("aside button.record").first().click();
    const zoomScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    results.push({
      entityType,
      width: 1440,
      zoom: 200,
      violations: zoomScan.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        description: violation.description,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary
        }))
      }))
    });
  }
  await page.screenshot({ path: join(reportDirectory, "workbench-200-percent.png"), fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pspf-workbench.v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("entities", "readwrite");
    const store = transaction.objectStore("entities");
    for (let index = 1; index <= 504; index += 1) {
      const sequence = String(index).padStart(12, "0");
      const record = {
        id: `RSK-00000000-0000-7000-8000-${sequence}`,
        entityType: "risk",
        schemaVersion: "1.17.0",
        title: `Volume fixture risk ${sequence}`,
        status: "open",
        likelihood: 3,
        impact: 3,
        createdAt: "2026-10-10T00:00:00.000Z",
        updatedAt: "2026-10-10T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active"
      };
      store.put(record);
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
  const startedAt = Date.now();
  await page.reload();
  await page.locator("pspf-register-view").waitFor({ state: "visible" });
  const volumeRegister = page.locator("pspf-register-view");
  await volumeRegister.getByLabel("Record type").selectOption("risk");
  await volumeRegister
    .locator("aside button.record")
    .filter({ hasText: "Volume fixture risk 000000000504" })
    .waitFor({ state: "attached" });
  const riskCount = await volumeRegister.locator("aside button.record").count();
  const elapsedMs = Date.now() - startedAt;
  const expectedRiskCount = new Set([
    ...state.entities.filter((entity) => entity.entityType === "risk").map((entity) => entity.id),
    ...Array.from({ length: 504 }, (_, index) => `RSK-00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`)
  ]).size;
  assert.equal(
    riskCount,
    expectedRiskCount,
    "volume fixture should render all 504 Risks alongside the acceptance records"
  );
  volumeLoadMs = elapsedMs;
  assert.ok(elapsedMs < 5000, `504-risk load took ${elapsedMs} ms (budget 5000 ms)`);
  console.log(`ok 504-risk register fixture loaded in ${elapsedMs} ms`);
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join("; ")}`);
} finally {
  await browser.close();
  await server.close();
}

const serious = results.flatMap((result) =>
  result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ ...violation, width: result.width, zoom: result.zoom }))
);
const report = {
  productVersion: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
  generatedAt: new Date().toISOString(),
  target: "packages/workbench/dist served at /workbench/",
  independence: "all 29 types migrated exactly; ported authoring, drafts and histories restored into a second profile",
  volume: { fixtureRiskCount: 504, loadMs: volumeLoadMs, budgetMs: 5000 },
  results,
  seriousOrCriticalCount: serious.length,
  seriousOrCritical: serious
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
assert.deepEqual(serious, [], `serious/critical accessibility findings: ${JSON.stringify(serious, null, 2)}`);
console.log("ok workbench accessibility: 320/768/1440 px, 200% zoom, keyboard and multi-tab checks passed");
