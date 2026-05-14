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
const reportDirectory = join(root, ".tmp", "explorer-local-authoring");
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
    const bundle = JSON.parse(readFileSyncText(bundlePath));
    const requirement = bundle.collections.requirements.find((item) => item.assessmentStatus !== "met") || bundle.collections.requirements[0];
    const finderTargetRequirement = bundle.collections.requirements.find((item) => item.id !== requirement.id) || requirement;
    assert.ok(requirement, "fixture should include at least one requirement");

    await page.evaluate(async (value) => {
        await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
        document.querySelector("#local-authoring").open = true;
    }, bundle);
    await page.waitForSelector("#local-authoring:not([hidden])");
    const pickerVisible = await page.locator("#local-requirement-list").isVisible();
    const initialVisibleRequirements = await page.locator(".local-requirement-option:not([hidden])").count();
    await page.locator("#local-requirement-filter").fill(finderTargetRequirement.id);
    await page.waitForFunction((title) => document.querySelector('[aria-labelledby="local-selected-heading"]')?.textContent?.includes(title), finderTargetRequirement.title);
    const finderExactMatch = await page.evaluate((expectedId) => ({
        filteredVisible: Array.from(document.querySelectorAll(".local-requirement-option")).filter((button) => !button.hidden).length,
        retainedQuery: document.querySelector("#local-requirement-filter")?.value === expectedId
    }), finderTargetRequirement.id);
    await page.locator("#local-requirement-filter").fill("zzz-no-match-pspf");
    await page.waitForFunction(() => document.querySelector('[aria-labelledby="local-selected-heading"]')?.textContent?.includes("No Requirement selected"));
    const finderNoMatch = await page.evaluate(() => ({
        filteredVisible: Array.from(document.querySelectorAll(".local-requirement-option")).filter((button) => !button.hidden).length,
        emptyVisible: !document.querySelector("#local-requirement-empty")?.hidden
    }));
    await page.locator("#local-requirement-filter").fill("");
    await page.waitForFunction(() => document.querySelectorAll(".local-requirement-option:not([hidden])").length > 1);

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerSetLocalRequirementStatus(requirementId, "met");
    }, { requirementId: requirement.id });
    const localAuthoringOpenAfterStatusSave = await page.locator("#local-authoring").evaluate((section) => section instanceof HTMLDetailsElement && section.open);
    await page.waitForFunction((requirementId) => {
        const select = document.querySelector(`select[data-requirement-id="${requirementId}"]`);
        return select?.value === "met";
    }, requirement.id);

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerAddLocalEvidenceReference(requirementId, "Local test evidence", "https://example.gov.au/evidence/local-test");
    }, { requirementId: requirement.id });
    await page.waitForFunction(() => document.querySelector("#local-authoring")?.textContent?.includes("Local evidence references: 1"));
    const localAuthoringOpenAfterEvidenceSave = await page.locator("#local-authoring").evaluate((section) => section instanceof HTMLDetailsElement && section.open);

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerAddLocalAction(requirementId, "Local follow-up action", "todo", "2026-06-30");
    }, { requirementId: requirement.id });
    await page.waitForFunction(() => document.querySelector("#local-authoring")?.textContent?.includes("Local actions: 1"));
    const localAuthoringOpenAfterActionSave = await page.locator("#local-authoring").evaluate((section) => section instanceof HTMLDetailsElement && section.open);

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerAddLocalRisk(requirementId, "Local test risk", "open", 4, 5);
    }, { requirementId: requirement.id });
    await page.waitForFunction(() => document.querySelector("#local-authoring")?.textContent?.includes("Local risks: 1"));
    const localAuthoringOpenAfterRiskSave = await page.locator("#local-authoring").evaluate((section) => section instanceof HTMLDetailsElement && section.open);

    const conflictVisible = await page.evaluate(async (value) => {
        const changedBundle = JSON.parse(JSON.stringify(value.bundle));
        const changedRequirement = changedBundle.collections.requirements.find((item) => item.id === value.requirementId);
        changedRequirement.assessmentStatus = "not-applicable";
        await globalThis.pspfExplorerRender(changedBundle.manifest, changedBundle.collections || {});
        const section = document.querySelector("#local-authoring");
        return section?.textContent?.includes("Local status conflicts: 1") && section?.textContent?.includes("Baseline changed");
    }, { bundle, requirementId: requirement.id });

    const persisted = await page.evaluate(async (value) => {
        function containsRestrictedPersonalField(target) {
            if (Array.isArray(target)) {
                return target.some((item) => containsRestrictedPersonalField(item));
            }
            if (!target || typeof target !== "object") {
                return false;
            }
            for (const key of Object.keys(target)) {
                if (key === "personId" || key === "email" || key === "name" && target.entityType === "person") {
                    return true;
                }
                if (containsRestrictedPersonalField(target[key])) {
                    return true;
                }
            }
            return false;
        }

        await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
        const select = document.querySelector(`select[data-requirement-id="${value.requirementId}"]`);
        const exported = await globalThis.pspfExplorerExportLocalBundle();
        const exportedRequirement = exported.collections.requirements.find((item) => item.id === value.requirementId);
        const exportedEvidence = exported.collections.evidence.find((item) => item.title === "Local test evidence");
        const exportedLink = exported.collections.links.find((item) => item.fromId === value.requirementId && item.toId === exportedEvidence?.id && item.linkType === "supported-by");
        const exportedAction = exported.collections.actions.find((item) => item.title === "Local follow-up action");
        const exportedActionLink = exported.collections.links.find((item) => item.fromId === value.requirementId && item.toId === exportedAction?.id && item.linkType === "addressed-by");
        const exportedRisk = exported.collections.risks.find((item) => item.title === "Local test risk");
        const exportedRiskLink = exported.collections.links.find((item) => item.fromId === value.requirementId && item.toId === exportedRisk?.id && item.linkType === "exposed-by");
        return {
            selectValue: select?.value,
            localBadgeCount: document.querySelectorAll(".local-badge").length,
            localStorageKeys: Object.keys(localStorage).filter((key) => key.startsWith("pspf")),
            exportedMode: exported.manifest.generator.mode,
            exportedProduct: exported.manifest.generator.product,
            exportedVersion: exported.manifest.generator.productVersion,
            schemaVersion: exported.manifest.schemaVersion,
            bundleVersion: exported.manifest.bundleVersion,
            apiVersion: exported.manifest.apiVersion,
            collectionCount: exported.manifest.collections.length,
            exportedStatus: exportedRequirement?.assessmentStatus,
            exportedSourceProduct: exportedRequirement?.sourceProduct,
            exportedEvidenceReference: exportedEvidence?.reference,
            exportedEvidenceSourceProduct: exportedEvidence?.sourceProduct,
            exportedLinkType: exportedLink?.linkType,
            exportedLinkSourceProduct: exportedLink?.sourceProduct,
            exportedActionStatus: exportedAction?.status,
            exportedActionDueDate: exportedAction?.dueDate,
            exportedActionSourceProduct: exportedAction?.sourceProduct,
            exportedActionLinkType: exportedActionLink?.linkType,
            exportedActionLinkSourceProduct: exportedActionLink?.sourceProduct,
            exportedRiskStatus: exportedRisk?.status,
            exportedRiskLikelihood: exportedRisk?.likelihood,
            exportedRiskImpact: exportedRisk?.impact,
            exportedRiskSourceProduct: exportedRisk?.sourceProduct,
            exportedRiskLinkType: exportedRiskLink?.linkType,
            exportedRiskLinkSourceProduct: exportedRiskLink?.sourceProduct,
            hasRestrictedPersonalField: containsRestrictedPersonalField(exported)
        };
    }, { ...bundle, requirementId: requirement.id });

    await page.evaluate(async (value) => {
        await globalThis.pspfExplorerResetLocalData();
        await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
    }, bundle);
    const resetValue = await page.locator(`select[data-requirement-id="${requirement.id}"]`).inputValue();
    const resetEvidenceCount = await page.evaluate(() => document.querySelector("#local-authoring")?.textContent?.includes("Local evidence references: 0"));
    const resetActionCount = await page.evaluate(() => document.querySelector("#local-authoring")?.textContent?.includes("Local actions: 0"));
    const resetRiskCount = await page.evaluate(() => document.querySelector("#local-authoring")?.textContent?.includes("Local risks: 0"));

    const visibleText = await page.locator("body").innerText();
    const storageStatusText = await page.locator("#local-storage-status").textContent();
    const checks = [
        check("No page errors", pageErrors.length === 0, pageErrors.join("; ")),
        check("No console errors", consoleErrors.length === 0, consoleErrors.join("; ")),
        check("Local authoring section visible", visibleText.includes("Local Authoring"), "section"),
        check("Local Requirement picker visible", pickerVisible, "picker"),
        check("Local Requirement filter narrows list", finderExactMatch.filteredVisible > 0 && finderExactMatch.filteredVisible < initialVisibleRequirements, `${finderExactMatch.filteredVisible}/${initialVisibleRequirements}`),
        check("Local Requirement finder moves workspace", finderExactMatch.filteredVisible === 1 && finderExactMatch.retainedQuery, `visible=${finderExactMatch.filteredVisible}`),
        check("Local Requirement finder shows no-match state", finderNoMatch.filteredVisible === 0 && finderNoMatch.emptyVisible, `visible=${finderNoMatch.filteredVisible}`),
        check("Storage status visible", storageStatusText?.includes("IndexedDB"), storageStatusText || "missing"),
        check("Local Authoring stays open after status save", localAuthoringOpenAfterStatusSave, "section focus"),
        check("Local Authoring stays open after evidence save", localAuthoringOpenAfterEvidenceSave, "section focus"),
        check("Local Authoring stays open after action save", localAuthoringOpenAfterActionSave, "section focus"),
        check("Local Authoring stays open after risk save", localAuthoringOpenAfterRiskSave, "section focus"),
        check("Local status conflict visible", conflictVisible, "baseline conflict"),
        check("Local status persisted in IndexedDB", persisted.selectValue === "met", persisted.selectValue || "missing"),
        check("Local badge visible", persisted.localBadgeCount > 0, `${persisted.localBadgeCount} badge(s)`),
        check("Export uses local-authoring mode", persisted.exportedMode === "local-authoring", persisted.exportedMode),
        check("Export product is Explorer", persisted.exportedProduct === "pspf-explorer", persisted.exportedProduct),
        check("Export product version", persisted.exportedVersion === PSPF_SLICE_VERSION, persisted.exportedVersion),
        check("Schema axis stable", persisted.schemaVersion === VERSION_AXES.schemaVersion, persisted.schemaVersion),
        check("Bundle axis stable", persisted.bundleVersion === VERSION_AXES.bundleVersion, persisted.bundleVersion),
        check("API axis stable", persisted.apiVersion === VERSION_AXES.apiVersion, persisted.apiVersion),
        check("Exports complete master collection set", persisted.collectionCount === 12, `${persisted.collectionCount} collection(s)`),
        check("Exported requirement carries local status", persisted.exportedStatus === "met", persisted.exportedStatus || "missing"),
        check("Exported local status source is Explorer", persisted.exportedSourceProduct === "explorer", persisted.exportedSourceProduct || "missing"),
        check("Exported local evidence reference present", persisted.exportedEvidenceReference === "https://example.gov.au/evidence/local-test", persisted.exportedEvidenceReference || "missing"),
        check("Exported local evidence source is Explorer", persisted.exportedEvidenceSourceProduct === "explorer", persisted.exportedEvidenceSourceProduct || "missing"),
        check("Exported local evidence link present", persisted.exportedLinkType === "supported-by", persisted.exportedLinkType || "missing"),
        check("Exported local evidence link source is Explorer", persisted.exportedLinkSourceProduct === "explorer", persisted.exportedLinkSourceProduct || "missing"),
        check("Exported local action present", persisted.exportedActionStatus === "todo", persisted.exportedActionStatus || "missing"),
        check("Exported local action due date present", persisted.exportedActionDueDate === "2026-06-30", persisted.exportedActionDueDate || "missing"),
        check("Exported local action source is Explorer", persisted.exportedActionSourceProduct === "explorer", persisted.exportedActionSourceProduct || "missing"),
        check("Exported local action link present", persisted.exportedActionLinkType === "addressed-by", persisted.exportedActionLinkType || "missing"),
        check("Exported local action link source is Explorer", persisted.exportedActionLinkSourceProduct === "explorer", persisted.exportedActionLinkSourceProduct || "missing"),
        check("Exported local risk present", persisted.exportedRiskStatus === "open", persisted.exportedRiskStatus || "missing"),
        check("Exported local risk likelihood present", persisted.exportedRiskLikelihood === 4, String(persisted.exportedRiskLikelihood || "missing")),
        check("Exported local risk impact present", persisted.exportedRiskImpact === 5, String(persisted.exportedRiskImpact || "missing")),
        check("Exported local risk source is Explorer", persisted.exportedRiskSourceProduct === "explorer", persisted.exportedRiskSourceProduct || "missing"),
        check("Exported local risk link present", persisted.exportedRiskLinkType === "exposed-by", persisted.exportedRiskLinkType || "missing"),
        check("Exported local risk link source is Explorer", persisted.exportedRiskLinkSourceProduct === "explorer", persisted.exportedRiskLinkSourceProduct || "missing"),
        check("No local data in localStorage", persisted.localStorageKeys.length === 0, persisted.localStorageKeys.join(", ")),
        check("Export excludes personal fields", !persisted.hasRestrictedPersonalField, "restricted fields"),
        check("Reset restores baseline status", resetValue === requirement.assessmentStatus, resetValue),
        check("Reset clears local evidence references", resetEvidenceCount, "local evidence count"),
        check("Reset clears local actions", resetActionCount, "local action count"),
        check("Reset clears local risks", resetRiskCount, "local risk count")
    ];

    const failed = checks.filter((item) => !item.ok);
    const report = {
        generatedAt: new Date().toISOString(),
        explorerPath: relative(root, explorerPath),
        bundlePath: relative(root, bundlePath),
        requirementId: requirement.id,
        checks
    };
    await writeFile(join(reportDirectory, "explorer-local-authoring-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    assert.equal(failed.length, 0, failed.map((item) => `${item.name}: ${item.detail}`).join("\n"));
    console.log("ok Explorer local-authoring smoke passed");
    console.log(`report: ${relative(root, join(reportDirectory, "explorer-local-authoring-report.json"))}`);
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