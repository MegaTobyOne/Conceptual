import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createCoreService } from "../packages/core/dist/service.js";
import { PSPF_BASELINE_REQUIREMENTS } from "../packages/reference-data/dist/index.js";

const root = process.cwd();
const explorerPath = join(root, "packages", "explorer", "dist", "index.html");
const sourceBundlePath = findBundlePath();
const reportDirectory = join(root, ".tmp", "explorer-to-workshop-import");
const exportBundlePath = join(reportDirectory, "explorer-local-authoring-bundle.json");
const importWorkspaceRoot = join(root, ".tmp", "explorer-to-workshop-import-workspace");
const additiveImportWorkspaceRoot = join(root, ".tmp", "explorer-to-workshop-additive-import-workspace");
const partialFullReplaceWorkspaceRoot = join(root, ".tmp", "explorer-to-workshop-full-replace-partial-workspace");
const historicalMappingWorkspaceRoot = join(root, ".tmp", "explorer-to-workshop-historical-mapping-workspace");
const planApplyWorkspaceRoot = join(root, ".tmp", "explorer-to-workshop-plan-apply-workspace");
await rm(importWorkspaceRoot, { recursive: true, force: true });
await rm(additiveImportWorkspaceRoot, { recursive: true, force: true });
await rm(partialFullReplaceWorkspaceRoot, { recursive: true, force: true });
await rm(historicalMappingWorkspaceRoot, { recursive: true, force: true });
await rm(planApplyWorkspaceRoot, { recursive: true, force: true });
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
    const sourceBundle = JSON.parse(readFileSyncText(sourceBundlePath));
    const requirement = sourceBundle.collections.requirements.find((item) => item.assessmentStatus !== "met") || sourceBundle.collections.requirements[0];
    assert.ok(requirement, "fixture should include at least one requirement");

    await page.evaluate(async (bundle) => {
        await globalThis.pspfExplorerRender(bundle.manifest, bundle.collections || {});
    }, sourceBundle);
    await page.waitForSelector("#local-authoring:not([hidden])");

    await page.evaluate(async ({ requirementId }) => {
        await globalThis.pspfExplorerSetLocalRequirementStatus(requirementId, "met");
        await globalThis.pspfExplorerAddLocalEvidenceReference(requirementId, "Explorer import evidence", "https://example.gov.au/evidence/import-roundtrip");
        await globalThis.pspfExplorerAddLocalAction(requirementId, "Explorer import action", "todo", "2026-06-30");
        await globalThis.pspfExplorerAddLocalRisk(requirementId, "Explorer import risk", "open", 4, 5);
    }, { requirementId: requirement.id });
    await page.waitForFunction(() => document.querySelector("#local-authoring")?.textContent?.includes("Local risks: 1"));

    const explorerBundle = await page.evaluate(async () => globalThis.pspfExplorerExportLocalBundle());
    await writeFile(exportBundlePath, `${JSON.stringify(explorerBundle, null, 2)}\n`, "utf8");

    const importService = createCoreService(importWorkspaceRoot);
    await importService.initialiseWorkspace();
    const imported = await importService.importBundle(exportBundlePath, "full-replace");
    const validation = await importService.validateWorkspace();
    const importedRequirements = await importService.listEntities("requirement");
    const importedEvidence = await importService.listEntities("evidence");
    const importedActions = await importService.listEntities("action");
    const importedRisks = await importService.listEntities("risk");
    const importedLinks = await importService.listEntities("link");

    const importedRequirement = importedRequirements.find((item) => item.id === requirement.id);
    const importedEvidenceRecord = importedEvidence.find((item) => item.title === "Explorer import evidence");
    const importedActionRecord = importedActions.find((item) => item.title === "Explorer import action");
    const importedRiskRecord = importedRisks.find((item) => item.title === "Explorer import risk");
    const importedEvidenceLink = importedLinks.find((item) => item.fromId === requirement.id && item.toId === importedEvidenceRecord?.id && item.linkType === "supported-by");
    const importedActionLink = importedLinks.find((item) => item.fromId === requirement.id && item.toId === importedActionRecord?.id && item.linkType === "addressed-by");
    const importedRiskLink = importedLinks.find((item) => item.fromId === requirement.id && item.toId === importedRiskRecord?.id && item.linkType === "exposed-by");
    const expectedImported = Object.entries(explorerBundle.collections)
        .filter(([collection]) => collection !== "posture")
        .reduce((total, [, records]) => total + records.length, 0);

    const partialBundle = JSON.parse(JSON.stringify(explorerBundle));
    partialBundle.collections["source-controls"] = [];
    const partialBundlePath = join(reportDirectory, "explorer-local-authoring-additive-without-source-controls.json");
    await writeFile(partialBundlePath, `${JSON.stringify(partialBundle, null, 2)}\n`, "utf8");
    const historicalMappingBundle = JSON.parse(JSON.stringify(partialBundle));
    historicalMappingBundle.collections["requirement-control-mappings"][0].id = "MAP-47cd1747-8119-4c0f-8dbd-27d735e036fd";
    historicalMappingBundle.collections["requirement-control-mappings"][0].sourceControlId = "SRC-00000000-0000-7000-8000-000000000102";
    const historicalMappingBundlePath = join(reportDirectory, "explorer-local-authoring-historical-mapping.json");
    await writeFile(historicalMappingBundlePath, `${JSON.stringify(historicalMappingBundle, null, 2)}\n`, "utf8");
    const additiveImportService = createCoreService(additiveImportWorkspaceRoot);
    await additiveImportService.initialiseWorkspace();
    const baselineRequirementsBeforeAdditive = await additiveImportService.listEntities("requirement");
    const changedRequirementBeforeAdditive = baselineRequirementsBeforeAdditive.find((item) => item.id === requirement.id);
    const unchangedRequirementBeforeAdditive = baselineRequirementsBeforeAdditive.find((item) => item.id !== requirement.id);
    assert.ok(changedRequirementBeforeAdditive, "fixture should include the changed baseline requirement before additive import");
    assert.ok(unchangedRequirementBeforeAdditive, "fixture should include an unchanged baseline requirement");
    const additiveImported = await additiveImportService.importBundle(partialBundlePath, "additive-merge");
    const additiveValidation = await additiveImportService.validateWorkspace();
    const additiveImportedAgain = await additiveImportService.importBundle(partialBundlePath, "additive-merge");
    const additiveRequirements = await additiveImportService.listEntities("requirement");
    const additiveRequirement = additiveRequirements.find((item) => item.id === requirement.id);
    const unchangedRequirementAfterAdditive = additiveRequirements.find((item) => item.id === unchangedRequirementBeforeAdditive.id);
    const additiveEvidenceRecord = (await additiveImportService.listEntities("evidence")).find((item) => item.title === "Explorer import evidence");
    const additiveActionRecord = (await additiveImportService.listEntities("action")).find((item) => item.title === "Explorer import action");
    const additiveRiskRecord = (await additiveImportService.listEntities("risk")).find((item) => item.title === "Explorer import risk");
    const planApplyService = createCoreService(planApplyWorkspaceRoot);
    await planApplyService.initialiseWorkspace();
    const planBeforeRequirement = (await planApplyService.listEntities("requirement")).find((item) => item.id === requirement.id);
    assert.ok(planBeforeRequirement, "fixture should include the changed baseline requirement before plan apply");
    const plan = await planApplyService.planImportBundle(partialBundlePath, "plan-apply");
    const planAfterPlanningRequirement = (await planApplyService.listEntities("requirement")).find((item) => item.id === requirement.id);
    const planApplied = await planApplyService.importBundle(partialBundlePath, "plan-apply");
    const planAfterApplyRequirement = (await planApplyService.listEntities("requirement")).find((item) => item.id === requirement.id);
    const planUndo = await planApplyService.undoLastImport();
    const planAfterUndoRequirement = (await planApplyService.listEntities("requirement")).find((item) => item.id === requirement.id);
    const partialFullReplaceImportService = createCoreService(partialFullReplaceWorkspaceRoot);
    await partialFullReplaceImportService.initialiseWorkspace();
    const partialFullReplaceImported = await partialFullReplaceImportService.importBundle(partialBundlePath, "full-replace");
    const partialFullReplaceValidation = await partialFullReplaceImportService.validateWorkspace();
    const partialFullReplaceSourceControls = await partialFullReplaceImportService.listEntities("source-control");
    const partialFullReplaceRequirement = (await partialFullReplaceImportService.listEntities("requirement")).find((item) => item.id === requirement.id);
    const historicalMappingImportService = createCoreService(historicalMappingWorkspaceRoot);
    await historicalMappingImportService.initialiseWorkspace();
    const historicalMappingImported = await historicalMappingImportService.importBundle(historicalMappingBundlePath, "full-replace");
    const historicalMappings = await historicalMappingImportService.listEntities("requirement-control-mapping");
    const historicalMapping = historicalMappings.find((item) => item.id === "MAP-47cd1747-8119-4c0f-8dbd-27d735e036fd");

    const checks = [
        check("No page errors", pageErrors.length === 0, pageErrors.join("; ")),
        check("No console errors", consoleErrors.length === 0, consoleErrors.join("; ")),
        check("Explorer export uses local-authoring mode", explorerBundle.manifest.generator.mode === "local-authoring", explorerBundle.manifest.generator.mode),
        check("Explorer export bundle written", existsSync(exportBundlePath), relative(root, exportBundlePath)),
        check("Core imports exported Explorer bundle", imported.imported === expectedImported, `${imported.imported}/${expectedImported}`),
        check("Import summary reports created local records", imported.summary.created >= 3, `${imported.summary.created} created`),
        check("Import summary includes status change example", imported.summary.examples.some((item) => item.includes("status") && item.includes("Met")), imported.summary.examples.join("; ")),
        check("Imported workspace validates", validation.ok, validation.message),
        check("Workshop-visible Requirement carries local status", importedRequirement?.assessmentStatus === "met", importedRequirement?.assessmentStatus || "missing"),
        check("Workshop-visible Requirement source is Explorer", importedRequirement?.sourceProduct === "explorer", importedRequirement?.sourceProduct || "missing"),
        check("Workshop-visible evidence imported", importedEvidenceRecord?.sourceProduct === "explorer", importedEvidenceRecord?.sourceProduct || "missing"),
        check("Workshop-visible evidence link imported", importedEvidenceLink?.sourceProduct === "explorer", importedEvidenceLink?.sourceProduct || "missing"),
        check("Workshop-visible action imported", importedActionRecord?.status === "todo", importedActionRecord?.status || "missing"),
        check("Workshop-visible action due date imported", importedActionRecord?.dueDate === "2026-06-30", importedActionRecord?.dueDate || "missing"),
        check("Workshop-visible action source is Explorer", importedActionRecord?.sourceProduct === "explorer", importedActionRecord?.sourceProduct || "missing"),
        check("Workshop-visible action link imported", importedActionLink?.sourceProduct === "explorer", importedActionLink?.sourceProduct || "missing"),
        check("Workshop-visible risk imported", importedRiskRecord?.status === "open", importedRiskRecord?.status || "missing"),
        check("Workshop-visible risk score imported", importedRiskRecord?.likelihood === 4 && importedRiskRecord?.impact === 5, `${importedRiskRecord?.likelihood || "missing"}/${importedRiskRecord?.impact || "missing"}`),
        check("Workshop-visible risk source is Explorer", importedRiskRecord?.sourceProduct === "explorer", importedRiskRecord?.sourceProduct || "missing"),
        check("Workshop-visible risk link imported", importedRiskLink?.sourceProduct === "explorer", importedRiskLink?.sourceProduct || "missing"),
        check("Baseline Requirements retained", importedRequirements.length === PSPF_BASELINE_REQUIREMENTS.length + 1, `${importedRequirements.length} requirement(s)`),
        check("Additive import accepts existing source controls", additiveImported.imported > 0 && additiveValidation.ok, `${additiveImported.imported} record(s)`),
        check("Additive import summary reports updates", additiveImported.summary.updated > 0, `${additiveImported.summary.updated} updated`),
        check("Repeated additive import reports no changes", additiveImportedAgain.imported === 0 && additiveImportedAgain.summary.written === 0 && additiveImportedAgain.summary.unchanged > 0, `${additiveImportedAgain.imported} imported, ${additiveImportedAgain.summary.unchanged} unchanged`),
        check("Additive import carries local status", additiveRequirement?.assessmentStatus === "met", additiveRequirement?.assessmentStatus || "missing"),
        check("Additive import preserves changed Requirement createdAt", additiveRequirement?.createdAt === changedRequirementBeforeAdditive.createdAt, additiveRequirement?.createdAt || "missing"),
        check("Additive import leaves unchanged Requirement createdAt", unchangedRequirementAfterAdditive?.createdAt === unchangedRequirementBeforeAdditive.createdAt, unchangedRequirementAfterAdditive?.createdAt || "missing"),
        check("Additive import carries local evidence", additiveEvidenceRecord?.sourceProduct === "explorer", additiveEvidenceRecord?.sourceProduct || "missing"),
        check("Additive import carries local action", additiveActionRecord?.sourceProduct === "explorer", additiveActionRecord?.sourceProduct || "missing"),
        check("Additive import carries local risk", additiveRiskRecord?.sourceProduct === "explorer", additiveRiskRecord?.sourceProduct || "missing"),
        check("Plan-apply reports a reviewable plan", plan.imported > 0 && plan.summary.updated > 0 && plan.summary.conflicts.length > 0, `${plan.imported} planned, ${plan.summary.conflicts.length} conflict(s)`),
        check("Plan-apply planning makes no writes", planAfterPlanningRequirement?.assessmentStatus === planBeforeRequirement.assessmentStatus, planAfterPlanningRequirement?.assessmentStatus || "missing"),
        check("Plan-apply applies after confirmation", planApplied.imported > 0 && planAfterApplyRequirement?.assessmentStatus === "met", `${planApplied.imported} imported, ${planAfterApplyRequirement?.assessmentStatus || "missing"}`),
        check("Plan-apply undo restores previous records", planUndo.undone && planAfterUndoRequirement?.assessmentStatus === planBeforeRequirement.assessmentStatus, planUndo.message),
        check("Full-replace import preserves referenced source controls", partialFullReplaceImported.imported > 0 && partialFullReplaceValidation.ok && partialFullReplaceSourceControls.length > 0, `${partialFullReplaceImported.imported} record(s), ${partialFullReplaceSourceControls.length} source control(s)`),
        check("Full-replace partial import carries local status", partialFullReplaceRequirement?.assessmentStatus === "met", partialFullReplaceRequirement?.assessmentStatus || "missing"),
        check("Historical mapping source-control reference imports", historicalMappingImported.imported > 0 && historicalMapping?.sourceControlId === "SRC-00000000-0000-7000-8000-000000000102", historicalMapping?.sourceControlId || "missing")
    ];
    const failed = checks.filter((item) => !item.ok);
    const report = {
        generatedAt: new Date().toISOString(),
        explorerPath: relative(root, explorerPath),
        sourceBundlePath: relative(root, sourceBundlePath),
        exportBundlePath: relative(root, exportBundlePath),
        partialBundlePath: relative(root, partialBundlePath),
        historicalMappingBundlePath: relative(root, historicalMappingBundlePath),
        importWorkspaceRoot: relative(root, importWorkspaceRoot),
        additiveImportWorkspaceRoot: relative(root, additiveImportWorkspaceRoot),
        planApplyWorkspaceRoot: relative(root, planApplyWorkspaceRoot),
        partialFullReplaceWorkspaceRoot: relative(root, partialFullReplaceWorkspaceRoot),
        historicalMappingWorkspaceRoot: relative(root, historicalMappingWorkspaceRoot),
        requirementId: requirement.id,
        checks
    };
    await writeFile(join(reportDirectory, "explorer-to-workshop-import-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    assert.equal(failed.length, 0, failed.map((item) => `${item.name}: ${item.detail}`).join("\n"));
    console.log("ok Explorer local-authoring export imports into Core/Workshop workspace");
    console.log(`report: ${relative(root, join(reportDirectory, "explorer-to-workshop-import-report.json"))}`);
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