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
    assert.ok(requirement, "fixture should include at least one requirement");

    await page.evaluate(async (value) => {
        await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
    }, bundle);
    await page.waitForSelector("#local-authoring:not([hidden])");

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerSetLocalRequirementStatus(requirementId, "met");
    }, { requirementId: requirement.id });
    await page.waitForFunction((requirementId) => {
        const select = document.querySelector(`select[data-requirement-id="${requirementId}"]`);
        return select?.value === "met";
    }, requirement.id);

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
            hasRestrictedPersonalField: containsRestrictedPersonalField(exported)
        };
    }, { ...bundle, requirementId: requirement.id });

    await page.evaluate(async (value) => {
        await globalThis.pspfExplorerResetLocalData();
        await globalThis.pspfExplorerRender(value.manifest, value.collections || {});
    }, bundle);
    const resetValue = await page.locator(`select[data-requirement-id="${requirement.id}"]`).inputValue();

    const visibleText = await page.locator("body").innerText();
    const storageStatusText = await page.locator("#local-storage-status").textContent();
    const checks = [
        check("No page errors", pageErrors.length === 0, pageErrors.join("; ")),
        check("No console errors", consoleErrors.length === 0, consoleErrors.join("; ")),
        check("Local authoring section visible", visibleText.includes("Local Authoring"), "section"),
        check("Storage status visible", storageStatusText?.includes("IndexedDB"), storageStatusText || "missing"),
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
        check("No local data in localStorage", persisted.localStorageKeys.length === 0, persisted.localStorageKeys.join(", ")),
        check("Export excludes personal fields", !persisted.hasRestrictedPersonalField, "restricted fields"),
        check("Reset restores baseline status", resetValue === requirement.assessmentStatus, resetValue)
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
    console.log("ok Explorer local-authoring phase 1 smoke passed");
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