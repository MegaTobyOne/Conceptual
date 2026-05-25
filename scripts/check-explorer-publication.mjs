import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const explorerPath = join(root, "packages", "explorer", "dist", "index.html");
const sampleBundlePath = join(root, "packages", "explorer", "dist", "sample-bundle-enterprise.json");
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
  const firstOpenText = await page.locator("body").innerText();
  const sampleBundlePresent = existsSync(sampleBundlePath);
  const sampleBundle = sampleBundlePresent ? JSON.parse(readFileSyncText(sampleBundlePath)) : undefined;
  const sampleDownloadHref = await page
    .locator('a[download="pspf-sample-bundle-enterprise.json"]')
    .first()
    .getAttribute("href");
  await page.getByRole("button", { name: "Load enterprise sample" }).first().click();
  await page.waitForSelector("#validation:not([hidden])");
  const sampleLoadedFromButton = await page.locator("#welcome").isHidden();
  const bundle = JSON.parse(await readFileSyncText(bundlePath));
  const dataDirectory = join(dirname(bundlePath), "data");
  const byTagPath = join(dataDirectory, "indexes", "by-tag.json");
  const byTagIndex = existsSync(byTagPath) ? JSON.parse(readFileSyncText(byTagPath)) : undefined;
  const hasTagData = (bundle.collections?.tags || []).length > 0;
  const expectedRequirementTitle =
    bundle.collections?.requirements?.[0]?.title || "Validate governance reporting workflow";
  const expectedEvidenceTitle = bundle.collections?.evidence?.[0]?.title;
  await page.evaluate(async (value) => {
    await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
  }, bundle);
  await page.waitForSelector("#validation:not([hidden])");

  const validationInitiallyCollapsed = await page
    .locator("#validation")
    .evaluate((element) => element instanceof HTMLDetailsElement && !element.open);
  await page.locator('.section-nav a[href="#validation"]').click();
  await page.waitForFunction(() => document.querySelector("#validation")?.open === true);
  const validationNavOpened = await page
    .locator("#validation")
    .evaluate((element) => element instanceof HTMLDetailsElement && element.open);
  const requirementsInitiallyCollapsed = await page
    .locator("#requirements")
    .evaluate((element) => element instanceof HTMLDetailsElement && !element.open);
  await page.locator('.section-nav a[href="#requirements"]').click();
  await page.waitForFunction(() => document.querySelector("#requirements")?.open === true);
  const requirementsNavOpened = await page
    .locator("#requirements")
    .evaluate((element) => element instanceof HTMLDetailsElement && element.open);
  const requirementsText = await page.locator("#requirements").innerText();
  const initialRequirementRows = await page.locator("#requirements tbody tr:not([hidden])").count();
  await page.locator("#explorer-search").fill(expectedRequirementTitle);
  await page.waitForFunction(
    () =>
      document.querySelector("#requirements")?.open === true &&
      Array.from(document.querySelectorAll("#requirements tbody tr")).filter((row) => !row.hidden).length === 1
  );
  const explorerSearchResult = await page.evaluate(() => ({
    visibleRequirementRows: Array.from(document.querySelectorAll("#requirements tbody tr")).filter((row) => !row.hidden)
      .length,
    hiddenRequirementRows: Array.from(document.querySelectorAll("#requirements tbody tr")).filter((row) => row.hidden)
      .length,
    statusText: document.querySelector("#explorer-search-status")?.textContent || "",
    matchedText:
      Array.from(document.querySelectorAll("#requirements tbody tr")).find((row) => !row.hidden)?.textContent || ""
  }));
  await page.locator("#explorer-search").fill("");
  await page.waitForFunction(
    (expectedRows) =>
      Array.from(document.querySelectorAll("#requirements tbody tr")).filter((row) => !row.hidden).length ===
      expectedRows,
    initialRequirementRows
  );
  await page.getByRole("button", { name: "Close All" }).click();
  const closeAllCollapsedSections = await page
    .locator("details.panel")
    .evaluateAll((sections) => sections.every((section) => section instanceof HTMLDetailsElement && !section.open));
  await page.evaluate(() => {
    document.querySelectorAll("details.panel").forEach((section) => {
      section.open = true;
    });
  });

  const visibleText = await page.locator("body").innerText();
  const validationFailures = await page.locator("#validation .check.fail").count();
  const copyButtonVisible = await page.getByRole("button", { name: "Copy posture brief" }).isVisible();
  const brief = await page.evaluate(() => globalThis.pspfExplorerCurrentBrief && globalThis.pspfExplorerCurrentBrief());
  const modePillColours = await page.evaluate(() => {
    const baseline = document.querySelector(".mode-step.baseline");
    const local = document.querySelector(".mode-step.local");
    const exportStep = document.querySelector(".mode-step.export");
    return {
      baselineBackground: baseline ? getComputedStyle(baseline).backgroundColor : "missing",
      localBackground: local ? getComputedStyle(local).backgroundColor : "missing",
      exportBackground: exportStep ? getComputedStyle(exportStep).backgroundColor : "missing"
    };
  });
  const statusTableUnderDonut = await page.locator("#summary .panel-lite .table-wrap").count();
  const explorerSearchPlacement = await page.evaluate(() => {
    const summary = document.querySelector("#summary");
    const searchPanel = document.querySelector("#explorer-search-panel");
    const localChanges = document.querySelector("#local-authoring");
    const validation = document.querySelector("#validation");
    const links = document.querySelector("#links");
    const bundleTools = document.querySelector("#bundle-tools");
    const searchInput = document.querySelector("#explorer-search");
    if (!summary || !searchPanel || !localChanges || !validation || !links || !bundleTools || !searchInput) {
      return {
        visible: false,
        afterSummary: false,
        beforeLocalChanges: false,
        validationAfterLinks: false,
        bundleToolsAfterValidation: false,
        searchUsesPanelWidth: false
      };
    }
    const position = summary.compareDocumentPosition(searchPanel);
    const localChangesPosition = searchPanel.compareDocumentPosition(localChanges);
    const validationPosition = links.compareDocumentPosition(validation);
    const bundleToolsPosition = validation.compareDocumentPosition(bundleTools);
    const panelRect = searchPanel.getBoundingClientRect();
    const inputRect = searchInput.getBoundingClientRect();
    return {
      visible: !searchPanel.hidden,
      afterSummary: Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeLocalChanges: Boolean(localChangesPosition & Node.DOCUMENT_POSITION_FOLLOWING),
      validationAfterLinks: Boolean(validationPosition & Node.DOCUMENT_POSITION_FOLLOWING),
      bundleToolsAfterValidation: Boolean(bundleToolsPosition & Node.DOCUMENT_POSITION_FOLLOWING),
      searchUsesPanelWidth: inputRect.width >= panelRect.width - 34
    };
  });
  const rawActionDueDateCount = await page
    .locator('#actions td[data-field="dueDate"]')
    .evaluateAll(
      (cells) => cells.filter((cell) => /\d{4}-\d{2}-\d{2}T|\d{4}-\d{2}-\d{2}/.test(cell.textContent || "")).length
    );
  const desktopLayoutChecks = await collectLayoutChecks(page, "Desktop");
  await page.setViewportSize({ width: 1600, height: 900 });
  const wideLayoutChecks = await collectLayoutChecks(page, "Wide");
  await page.setViewportSize({ width: 390, height: 820 });
  const narrowLayoutChecks = await collectLayoutChecks(page, "Narrow");
  const syntheticExplorerValues = await page.evaluate(async (value) => {
    const clone = JSON.parse(JSON.stringify(value));
    const collections = clone.collections || {};
    const requirement = (collections.requirements || [])[0];
    collections.actions = [
      ...(collections.actions || []),
      {
        id: "ACT-00000000-0000-4000-8000-00000000ABCD",
        entityType: "action",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Synthetic ISO due date action",
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        status: "todo",
        dueDate: "2026-06-30T00:00:00.000Z"
      }
    ];
    collections["requirement-control-mappings"] = [
      ...(collections["requirement-control-mappings"] || []),
      {
        id: "MAP-00000000-0000-4000-8000-00000000ABCD",
        entityType: "requirement-control-mapping",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Manual mapping to unresolved source control",
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        requirementId: requirement?.id || "REQ-00000000-0000-4000-8000-00000000ABCD",
        sourceControlId: "SRC-00000000-0000-4000-8000-00000000ABCD",
        coverageQualifier: "partial",
        applicabilityProfile: "manual",
        confidence: "medium",
        provenance: { oscalRelease: "manual-test" }
      }
    ];
    await globalThis.pspfExplorerRender(clone.manifest, collections);
    document.querySelector("#actions").open = true;
    document.querySelector("#ism-coverage").open = true;
    return {
      actionDueDate: Array.from(document.querySelectorAll('#actions td[data-field="dueDate"]'))
        .at(-1)
        ?.textContent?.trim(),
      manualCoverageControlId: Array.from(document.querySelectorAll('#ism-coverage td[data-field="controlId"]'))
        .at(-1)
        ?.textContent?.trim()
    };
  }, bundle);

  const connectedViewValues = await page.evaluate(async (value) => {
    const clone = JSON.parse(JSON.stringify(value));
    const collections = clone.collections || {};
    const requirement = (collections.requirements || [])[0];
    if (!requirement) {
      return { skipped: true };
    }
    collections.directions = [
      ...(collections.directions || []),
      {
        id: "DIR-00000000-0000-4000-8000-00000000C101",
        entityType: "direction",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Improve governance assurance",
        reference: "DIR-C101",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        responseState: "not-set"
      }
    ];
    collections.risks = [
      ...(collections.risks || []),
      {
        id: "RSK-00000000-0000-4000-8000-00000000C101",
        entityType: "risk",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Governance assurance risk",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        status: "open",
        likelihood: 4,
        impact: 4
      }
    ];
    collections.actions = [
      ...(collections.actions || []),
      {
        id: "ACT-00000000-0000-4000-8000-00000000C101",
        entityType: "action",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Close governance assurance action",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        status: "todo"
      }
    ];
    collections.links = [
      ...(collections.links || []),
      {
        id: "LNK-00000000-0000-4000-8000-00000000C101",
        entityType: "link",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Direction targets requirement",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        linkType: "targets",
        fromId: collections.directions.at(-1).id,
        fromType: "direction",
        toId: requirement.id,
        toType: "requirement"
      },
      {
        id: "LNK-00000000-0000-4000-8000-00000000C102",
        entityType: "link",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Requirement exposed by risk",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        linkType: "exposed-by",
        fromId: requirement.id,
        fromType: "requirement",
        toId: collections.risks.at(-1).id,
        toType: "risk"
      },
      {
        id: "LNK-00000000-0000-4000-8000-00000000C103",
        entityType: "link",
        schemaVersion: clone.manifest.schemaVersion,
        title: "Risk treated by action",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active",
        linkType: "treated-by",
        fromId: collections.risks.at(-1).id,
        fromType: "risk",
        toId: collections.actions.at(-1).id,
        toType: "action"
      }
    ];
    await globalThis.pspfExplorerRender(clone.manifest, collections);
    document.querySelector("#connected-view").open = true;
    await new Promise(requestAnimationFrame);
    const visibleElements = (selector) =>
      Array.from(document.querySelectorAll(selector)).filter((element) => element.offsetParent !== null);
    const uniqueVisibleCvIds = (selector) =>
      new Set(visibleElements(selector).map((element) => element.dataset.cvId).filter(Boolean)).size;
    const requirementCard = visibleElements('#connected-view [data-cv-kind="requirement"]')[0];
    requirementCard?.click();
    await new Promise(requestAnimationFrame);
    const before = {
      cards: document.querySelectorAll("#connected-view [data-cv-card]").length,
      edges: document.querySelectorAll("#connected-view svg path").length,
      highlightedEdges: document.querySelectorAll("#connected-view svg path.cv-highlight").length,
      selectedCards: visibleElements("#connected-view .cv-selected").length,
      selectedRecordIds: uniqueVisibleCvIds("#connected-view .cv-selected"),
      connectedCards: visibleElements("#connected-view .cv-connected").length,
      zoomControls: document.querySelectorAll(
        '#connected-view [data-cv-action="zoom-in"], #connected-view [data-cv-action="zoom-out"], #connected-view [data-cv-action="zoom-reset"]'
      ).length,
      laneControls: document.querySelectorAll("#connected-view [data-cv-lane-toggle]").length,
      zoomLabel: document.querySelector("#connected-view [data-cv-zoom-label]")?.textContent || "",
      actionsMetric:
        Array.from(document.querySelectorAll("#summary .metric")).find((element) =>
          element.textContent.includes("Actions")
        )?.innerText || "",
      actionsCount: Number(
        Array.from(document.querySelectorAll("#summary .metric"))
          .find((element) => element.textContent.includes("Actions"))
          ?.querySelector("strong")?.textContent || "0"
      )
    };
    document.querySelector('#connected-view [data-cv-action="zoom-in"]')?.click();
    document.querySelector('#connected-view [data-cv-lane-toggle="risks"]')?.click();
    await new Promise(requestAnimationFrame);
    before.zoomAfterClick = document.querySelector("#connected-view [data-cv-zoom-label]")?.textContent || "";
    before.risksHiddenAfterToggle =
      document.querySelector('#connected-view [data-cv-lane-kind="risks"]')?.classList.contains("cv-lane-hidden") ||
      false;
    await globalThis.pspfExplorerAddLocalAction(requirement.id, "Local connected action", "todo", "2026-06-30");
    document.querySelector("#connected-view").open = true;
    await new Promise(requestAnimationFrame);
    return {
      skipped: false,
      before,
      after: {
        cards: document.querySelectorAll("#connected-view [data-cv-card]").length,
        edges: document.querySelectorAll("#connected-view svg path").length,
        actionsMetric:
          Array.from(document.querySelectorAll("#summary .metric")).find((element) =>
            element.textContent.includes("Actions")
          )?.innerText || "",
        actionsCount: Number(
          Array.from(document.querySelectorAll("#summary .metric"))
            .find((element) => element.textContent.includes("Actions"))
            ?.querySelector("strong")?.textContent || "0"
        ),
        connectedText: document.querySelector("#connected-view")?.textContent || ""
      }
    };
  }, bundle);

  const checks = [
    check(
      "First open offers sample bundle",
      firstOpenText.includes("Load enterprise sample") && firstOpenText.includes("Download enterprise JSON"),
      firstOpenText
    ),
    check(
      "Explorer ships downloadable sample JSON",
      sampleBundlePresent && sampleBundle?.manifest?.bundleType === "pspf-explorer-bundle",
      sampleBundlePresent
        ? sampleBundle?.manifest?.bundleType || "missing bundle type"
        : "missing sample-bundle-enterprise.json"
    ),
    check(
      "Sample download points to bundled JSON",
      sampleDownloadHref === "./sample-bundle-enterprise.json",
      sampleDownloadHref || "missing download href"
    ),
    check("Sample button loads Explorer", sampleLoadedFromButton, "welcome panel hidden after sample load"),
    check("No page errors", pageErrors.length === 0, pageErrors.join("; ")),
    check("No console errors", consoleErrors.length === 0, consoleErrors.join("; ")),
    check("Validation panel has no failed checks", validationFailures === 0, `${validationFailures} failed check(s)`),
    check(
      "Visible PSPF slice version",
      visibleText.includes(`PSPF v${PSPF_SLICE_VERSION}`),
      `PSPF v${PSPF_SLICE_VERSION}`
    ),
    check(
      "Visible schema version",
      visibleText.includes(`Schema ${VERSION_AXES.schemaVersion}`),
      `Schema ${VERSION_AXES.schemaVersion}`
    ),
    check(
      "Visible bundle version",
      visibleText.includes(`Bundle ${VERSION_AXES.bundleVersion}`),
      `Bundle ${VERSION_AXES.bundleVersion}`
    ),
    check(
      "Visible API version",
      visibleText.includes(`API ${VERSION_AXES.apiVersion}`),
      `API ${VERSION_AXES.apiVersion}`
    ),
    check(
      "Mode strip distinguishes baseline and local",
      modePillColours.baselineBackground !== modePillColours.localBackground &&
        modePillColours.localBackground !== "missing",
      JSON.stringify(modePillColours)
    ),
    check("Copy posture brief button visible", copyButtonVisible, "button"),
    check("Compliance status table sits under donut", statusTableUnderDonut === 1, `${statusTableUnderDonut} table(s)`),
    check(
      "Explorer Search sits below posture brief",
      explorerSearchPlacement.visible &&
        explorerSearchPlacement.afterSummary &&
        explorerSearchPlacement.beforeLocalChanges,
      JSON.stringify(explorerSearchPlacement)
    ),
    check(
      "Explorer Search uses full panel width",
      explorerSearchPlacement.searchUsesPanelWidth,
      JSON.stringify(explorerSearchPlacement)
    ),
    check(
      "Bundle diagnostics sit after record sections",
      explorerSearchPlacement.validationAfterLinks && explorerSearchPlacement.bundleToolsAfterValidation,
      JSON.stringify(explorerSearchPlacement)
    ),
    check("Validation section starts collapsed", validationInitiallyCollapsed, "collapsed by default"),
    check("Validation nav opens section", validationNavOpened, "nav target opens"),
    check("Requirements section starts collapsed", requirementsInitiallyCollapsed, "collapsed by default"),
    check("Requirements nav opens section", requirementsNavOpened, "nav target opens"),
    check(
      "Explorer Search filters requirement rows",
      explorerSearchResult.visibleRequirementRows === 1 && explorerSearchResult.hiddenRequirementRows >= 0,
      `${explorerSearchResult.visibleRequirementRows} visible / ${explorerSearchResult.hiddenRequirementRows} hidden`
    ),
    check(
      "Explorer Search keeps matching requirement readable",
      explorerSearchResult.matchedText.includes(expectedRequirementTitle),
      explorerSearchResult.matchedText || "missing"
    ),
    check(
      "Explorer Search reports row matches",
      explorerSearchResult.statusText.includes("rows match"),
      explorerSearchResult.statusText || "missing"
    ),
    check("Close All collapses record sections", closeAllCollapsedSections, "all details closed"),
    check(
      "Action due dates avoid raw ISO text",
      rawActionDueDateCount === 0,
      `${rawActionDueDateCount} raw date cell(s)`
    ),
    check(
      "Synthetic ISO action due date renders short AU",
      syntheticExplorerValues.actionDueDate === "30 Jun 2026",
      syntheticExplorerValues.actionDueDate || "missing"
    ),
    check(
      "Manual ISM source IDs render compactly",
      syntheticExplorerValues.manualCoverageControlId === "SRC-ABCD",
      syntheticExplorerValues.manualCoverageControlId || "missing"
    ),
    check(
      "Explorer Connected View renders linked chain",
      !connectedViewValues.skipped && connectedViewValues.before.cards >= 4 && connectedViewValues.before.edges >= 3,
      JSON.stringify(connectedViewValues.before)
    ),
    check(
      "Explorer Connected View selection highlights chain",
      !connectedViewValues.skipped &&
        connectedViewValues.before.selectedRecordIds === 1 &&
        connectedViewValues.before.connectedCards >= 3 &&
        connectedViewValues.before.highlightedEdges >= 3,
      JSON.stringify(connectedViewValues.before)
    ),
    check(
      "Explorer Connected View exposes v1.23 controls",
      !connectedViewValues.skipped &&
        connectedViewValues.before.zoomControls === 3 &&
        connectedViewValues.before.laneControls >= 3 &&
        connectedViewValues.before.zoomLabel === "100%",
      JSON.stringify(connectedViewValues.before)
    ),
    check(
      "Explorer Connected View controls apply",
      !connectedViewValues.skipped &&
        connectedViewValues.before.zoomAfterClick === "110%" &&
        connectedViewValues.before.risksHiddenAfterToggle,
      JSON.stringify(connectedViewValues.before)
    ),
    check(
      "Explorer local Action updates overview count",
      !connectedViewValues.skipped &&
        connectedViewValues.after.actionsCount === connectedViewValues.before.actionsCount + 1,
      JSON.stringify({
        before: connectedViewValues.before.actionsMetric,
        after: connectedViewValues.after.actionsMetric
      })
    ),
    check(
      "Explorer local Action appears in Connected View",
      !connectedViewValues.skipped &&
        connectedViewValues.after.cards === connectedViewValues.before.cards + 1 &&
        connectedViewValues.after.edges === connectedViewValues.before.edges + 1 &&
        connectedViewValues.after.connectedText.includes("Local connected action"),
      JSON.stringify(connectedViewValues.after)
    ),
    check(
      "Generated brief includes classification",
      typeof brief === "string" && brief.includes("OFFICIAL: Sensitive"),
      "classification"
    ),
    check(
      "Generated brief excludes sensitive summary",
      typeof brief === "string" && !brief.includes("Internal assessment working note"),
      "summary redaction"
    ),
    check(
      "Generated brief excludes sensitive tag description",
      typeof brief === "string" && !brief.includes("Sensitive tag purpose note"),
      "tag redaction"
    ),
    check(
      "Tag collection exported",
      Array.isArray(bundle.collections?.tags),
      `${bundle.collections?.tags?.length ?? "missing"} tag(s)`
    ),
    check(
      "By-tag index exported",
      hasTagData ? Boolean(byTagIndex && Array.isArray(byTagIndex.tags)) : true,
      byTagPath
    ),
    check(
      "By-tag index excludes sensitive tag description",
      byTagIndex ? !JSON.stringify(byTagIndex).includes("Sensitive tag purpose note") : !hasTagData,
      "default deny"
    ),
    check(
      "Readable requirement title rendered",
      requirementsText.includes(expectedRequirementTitle),
      "requirement title"
    ),
    check(
      "Readable relationship target rendered",
      expectedEvidenceTitle ? visibleText.includes(expectedEvidenceTitle) : true,
      "evidence title"
    ),
    ...desktopLayoutChecks,
    ...wideLayoutChecks,
    ...narrowLayoutChecks
  ];

  const failed = checks.filter((item) => !item.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    explorerPath: relative(root, explorerPath),
    bundlePath: relative(root, bundlePath),
    checks
  };
  await writeFile(
    join(reportDirectory, "explorer-publication-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
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
    if (existsSync(candidate) && bundleMatchesCurrentAxes(candidate)) {
      return candidate;
    }
  }

  return join(root, "packages", "contracts", "test-fixtures", "standard", "bundle.json");
}

function bundleMatchesCurrentAxes(bundlePath) {
  try {
    const bundle = JSON.parse(readFileSyncText(bundlePath));
    return (
      bundle?.manifest?.schemaVersion === VERSION_AXES.schemaVersion &&
      bundle?.manifest?.bundleVersion === VERSION_AXES.bundleVersion &&
      bundle?.manifest?.apiVersion === VERSION_AXES.apiVersion
    );
  } catch {
    return false;
  }
}

function readFileSyncText(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

async function collectLayoutChecks(page, viewportLabel) {
  const result = await page.evaluate((label) => {
    const checks = [];
    const main = document.querySelector("main");
    if (label === "Wide") {
      const mainWidth = main ? main.getBoundingClientRect().width : 0;
      checks.push({
        name: "Wide Explorer workspace uses available width",
        ok: mainWidth >= 1500,
        detail: `${Math.round(mainWidth)}px main width`
      });
    }

    const compactSelectors = [".check", ".version-pill", ".section-nav a"];
    const compactElements = compactSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const wrappedCompact = compactElements.filter((element) => {
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.35;
      return element.getBoundingClientRect().height > lineHeight * 1.75;
    });
    checks.push({
      name: `${label} compact labels stay single line`,
      ok: wrappedCompact.length === 0,
      detail: `${wrappedCompact.length} wrapped label(s)`
    });

    const titleCells = Array.from(
      document.querySelectorAll(
        'td[data-field="title"], td[data-field="requirement"], td[data-field="control"], td[data-field="from"], td[data-field="to"], td[data-field="target"]'
      )
    );
    const minimumWidth = label === "Desktop" ? 250 : 220;
    const narrowTitleCells = titleCells.filter((cell) => cell.getBoundingClientRect().width < minimumWidth);
    checks.push({
      name: `${label} title columns keep readable width`,
      ok: narrowTitleCells.length === 0,
      detail: `${narrowTitleCells.length}/${titleCells.length} title-like cell(s) below ${minimumWidth}px`
    });

    const relationshipFromCells = Array.from(document.querySelectorAll('#links td[data-field="from"]'));
    const narrowRelationshipFromCells = relationshipFromCells.filter(
      (cell) => cell.getBoundingClientRect().width < minimumWidth
    );
    checks.push({
      name: `${label} Relationships From column keeps readable width`,
      ok: narrowRelationshipFromCells.length === 0,
      detail: `${narrowRelationshipFromCells.length}/${relationshipFromCells.length} From cell(s) below ${minimumWidth}px`
    });

    const pageOverflowingElements = Array.from(document.querySelectorAll("body *")).filter((element) => {
      if (element.closest(".table-wrap")) {
        return false;
      }
      return element.getBoundingClientRect().right > window.innerWidth + 1;
    });
    checks.push({
      name: `${label} non-table content avoids horizontal overflow`,
      ok: pageOverflowingElements.length === 0,
      detail: `${pageOverflowingElements.length} overflowing non-table element(s)`
    });

    const denseTables = Array.from(
      document.querySelectorAll("#ism-coverage .table-wrap, #source-controls .table-wrap")
    );
    checks.push({
      name: `${label} dense tables use local overflow wrappers`,
      ok: denseTables.every((wrapper) => getComputedStyle(wrapper).overflowX !== "visible"),
      detail: `${denseTables.length} dense table wrapper(s)`
    });

    return checks;
  }, viewportLabel);
  return result.map((item) => check(item.name, item.ok, item.detail));
}
