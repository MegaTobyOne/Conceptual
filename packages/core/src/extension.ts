import { basename, relative } from "node:path";
import * as vscode from "vscode";
import { createCoreService, type ImportMode, type ImportResult } from "./service.js";

export function activate(context: vscode.ExtensionContext): Record<string, unknown> {
  const output = vscode.window.createOutputChannel("PSPF Core");
  context.subscriptions.push(output);

  const api = {
    initialiseWorkspace: () => getService().initialiseWorkspace(),
    validateWorkspace: () => getService().validateWorkspace(),
    verifyIntegrity: () => getService().verifyIntegrity(),
    runIntegrityScan: () => getService().runIntegrityScan(),
    createSnapshot: () => getService().createSnapshot(),
    exportBundle: () => getService().exportBundle(),
    planImportBundle: getService().planImportBundle,
    importBundle: getService().importBundle,
    undoLastImport: getService().undoLastImport,
    ensureWorkspaceReady: () => getService().initialiseWorkspace(),
    getWriterLock: () => getService().getWriterLock(),
    upsertEntity: getService().upsertEntity,
    upsertEntities: getService().upsertEntities,
    listEntities: getService().listEntities
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("pspf.core.initialiseWorkspace", async () => {
      const paths = await getService().initialiseWorkspace();
      await vscode.window.showInformationMessage(`PSPF workspace initialised at ${relative(paths.root, paths.pspf)}`);
      return paths;
    }),
    vscode.commands.registerCommand("pspf.core.validateWorkspace", async () => {
      const result = await getService().validateWorkspace();
      await vscode.window.showInformationMessage(result.ok ? result.message : `PSPF validation failed: ${result.message}`);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.verifyIntegrity", async () => {
      const result = await getService().verifyIntegrity();
      await vscode.window.showInformationMessage(result.ok ? "PSPF SQLite integrity check passed." : `PSPF integrity check failed: ${result.detail}`);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.runIntegrityScan", async () => {
      const report = await getService().runIntegrityScan();
      await vscode.window.showInformationMessage(report.ok ? report.summary : `PSPF integrity scan failed: ${report.summary}`);
      return report;
    }),
    vscode.commands.registerCommand("pspf.core.createSnapshot", async () => {
      const snapshot = await getService().createSnapshot();
      await vscode.window.showInformationMessage(`PSPF snapshot created: ${snapshot.title ?? snapshot.id}`);
      return snapshot;
    }),
    vscode.commands.registerCommand("pspf.core.exportBundle", async () => {
      const result = await getService().exportBundle();
      await vscode.window.showInformationMessage(`PSPF master bundle exported to ${result.exportDirectory}`);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.importBundle", async () => {
      return importBundlesFromPicker(output, {
        openTitle: "Import PSPF Master Bundle(s)",
        filterName: "PSPF bundle",
        progressTitle: "Importing PSPF bundle",
        completePrefix: "PSPF import complete",
        errorPrefix: "PSPF bundle import failed"
      });
    }),
    vscode.commands.registerCommand("pspf.core.importExplorerLocalBundle", async () => {
      return importBundlesFromPicker(output, {
        openTitle: "Import Explorer Local JSON Bundle(s)",
        filterName: "Explorer local JSON",
        progressTitle: "Importing Explorer local JSON",
        completePrefix: "PSPF Explorer import complete",
        errorPrefix: "PSPF Explorer import failed"
      });
    }),
    vscode.commands.registerCommand("pspf.core.showWriterLock", async () => {
      const lock = await getService().getWriterLock();
      const message = lock.writable ? lock.detail : `PSPF workspace read-only: ${lock.detail}`;
      await vscode.window.showInformationMessage(message);
      return lock;
    }),
    vscode.commands.registerCommand("pspf.core.undoLastImport", async () => {
      const result = await getService().undoLastImport();
      await vscode.window.showInformationMessage(result.message);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.planImportBundleFromPath", (bundlePath: string, mode: ImportMode) => getService().planImportBundle(bundlePath, mode)),
    vscode.commands.registerCommand("pspf.core.importBundleFromPath", (bundlePath: string, mode: ImportMode) => getService().importBundle(bundlePath, mode)),
    vscode.commands.registerCommand("pspf.core.ensureWorkspaceReady", async () => getService().initialiseWorkspace()),
    vscode.commands.registerCommand("pspf.core.runIntegrityScanHeadless", async () => getService().runIntegrityScan()),
    vscode.commands.registerCommand("pspf.core.upsertEntity", (entity) => getService().upsertEntity(entity)),
    vscode.commands.registerCommand("pspf.core.upsertEntities", (entities) => getService().upsertEntities(entities)),
    vscode.commands.registerCommand("pspf.core.listEntities", (entityType) => getService().listEntities(entityType)),
    vscode.commands.registerCommand("pspf.core.getWorkspacePaths", async () => getService().getWorkspacePaths())
  );

  void initialiseOnActivation(output);

  return api;
}

async function importBundlesFromPicker(
  output: vscode.OutputChannel,
  labels: { readonly openTitle: string; readonly filterName: string; readonly progressTitle: string; readonly completePrefix: string; readonly errorPrefix: string }
): Promise<ImportResult | ImportResult[] | undefined> {
  const pickedFile = await vscode.window.showOpenDialog({
    title: labels.openTitle,
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: true,
    filters: { [labels.filterName]: ["json"] }
  });
  const bundlePaths = (pickedFile || []).map((file) => file.fsPath);
  if (bundlePaths.length === 0) {
    return undefined;
  }

  const pickedMode = await vscode.window.showQuickPick(
    [
      { label: "Additive merge", description: "Add or update bundle records without deleting existing records", value: "additive-merge" as const },
      { label: "Plan, review, apply", description: "Preview changes and confirm before writing", value: "plan-apply" as const },
      { label: "Full replace", description: "Create a rollback snapshot, then replace existing records", value: "full-replace" as const }
    ],
    { title: "Select Import Mode", ignoreFocusOut: true }
  );
  if (!pickedMode) {
    return undefined;
  }

  try {
    if (pickedMode.value === "plan-apply") {
      const plans = await Promise.all(bundlePaths.map((bundlePath) => getService().planImportBundle(bundlePath, "plan-apply")));
      writeImportSummary(output, plans);
      const planSummary = combineImportSummaries(plans);
      const reviewAction = await vscode.window.showWarningMessage(
        `Apply Explorer import plan? ${plans.length} file(s), ${planSummary.created} created, ${planSummary.updated} updated, ${planSummary.unchanged} unchanged.`,
        { modal: true, detail: planDetail(plans) },
        "Apply Import",
        "Show Details"
      );
      if (reviewAction === "Show Details") {
        output.show(true);
        return plans.length === 1 ? plans[0] : plans;
      }
      if (reviewAction !== "Apply Import") {
        return undefined;
      }
      const results = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: labels.progressTitle, cancellable: false },
        async (progress) => {
          const importedResults: ImportResult[] = [];
          for (const [index, bundlePath] of bundlePaths.entries()) {
            progress.report({ message: `${index + 1}/${bundlePaths.length} ${basename(bundlePath)}` });
            importedResults.push(await getService().importBundle(bundlePath, "plan-apply"));
            progress.report({ increment: 100 / bundlePaths.length });
          }
          progress.report({ message: "Import summary ready" });
          return importedResults;
        }
      );
      writeImportSummary(output, results);
      const applySummary = combineImportSummaries(results);
      const action = await vscode.window.showInformationMessage(
        `${labels.completePrefix}: ${results.length} file(s), ${applySummary.created} created, ${applySummary.updated} updated, ${applySummary.unchanged} unchanged.`,
        "Show Details",
        "Undo Import"
      );
      if (action === "Show Details") {
        output.show(true);
      } else if (action === "Undo Import") {
        const undo = await getService().undoLastImport();
        await vscode.window.showInformationMessage(undo.message);
      }
      return results.length === 1 ? results[0] : results;
    }

    const results = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: labels.progressTitle, cancellable: false },
      async (progress) => {
        const importedResults: ImportResult[] = [];
        for (const [index, bundlePath] of bundlePaths.entries()) {
          progress.report({ message: `${index + 1}/${bundlePaths.length} ${basename(bundlePath)}` });
          importedResults.push(await getService().importBundle(bundlePath, pickedMode.value));
          progress.report({ increment: 100 / bundlePaths.length });
        }
        progress.report({ message: "Import summary ready" });
        return importedResults;
      }
    );
    writeImportSummary(output, results);
    const summary = combineImportSummaries(results);
    const action = await vscode.window.showInformationMessage(
      `${labels.completePrefix}: ${results.length} file(s), ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
      "Show Details",
      "Undo Import"
    );
    if (action === "Show Details") {
      output.show(true);
    } else if (action === "Undo Import") {
      const undo = await getService().undoLastImport();
      await vscode.window.showInformationMessage(undo.message);
    }
    return results.length === 1 ? results[0] : results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`${labels.errorPrefix}: ${message}`);
    return undefined;
  }
}

function planDetail(results: readonly ImportResult[]): string {
  return results.flatMap((result) => [
    `${basename(result.bundlePath)}: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.`,
    ...result.summary.examples.slice(0, 5)
  ]).join("\n");
}

function combineImportSummaries(results: readonly ImportResult[]): { created: number; updated: number; unchanged: number } {
  return results.reduce(
    (total, result) => ({
      created: total.created + result.summary.created,
      updated: total.updated + result.summary.updated,
      unchanged: total.unchanged + result.summary.unchanged
    }),
    { created: 0, updated: 0, unchanged: 0 }
  );
}

function writeImportSummary(output: vscode.OutputChannel, results: readonly ImportResult[]): void {
  output.appendLine(`PSPF import summary (${new Date().toISOString()})`);
  for (const result of results) {
    output.appendLine(`- ${basename(result.bundlePath)} (${result.mode}): ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged, ${result.summary.written} written.`);
    for (const [entityType, summary] of Object.entries(result.summary.byType).sort(([left], [right]) => left.localeCompare(right))) {
      output.appendLine(`  ${entityType}: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged`);
    }
    if (result.summary.examples.length > 0) {
      output.appendLine("  Examples:");
      for (const example of result.summary.examples) {
        output.appendLine(`  - ${example}`);
      }
    }
  }
}

export function deactivate(): void {
  // No runtime resources to dispose yet.
}

function getService() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a folder before using PSPF commands.");
  }
  return createCoreService(folder.uri.fsPath);
}

async function initialiseOnActivation(output: vscode.OutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }

  const shouldInitialise = vscode.workspace.getConfiguration("pspf.core", folder.uri).get<boolean>("initialiseOnActivation", false);
  if (!shouldInitialise) {
    return;
  }

  if (!vscode.workspace.isTrusted) {
    output.appendLine("Skipped auto-initialise because the workspace is not trusted.");
    return;
  }

  try {
    const paths = await getService().initialiseWorkspace();
    output.appendLine(`PSPF workspace ready at ${relative(paths.root, paths.pspf)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Auto-initialise failed: ${message}`);
    await vscode.window.showWarningMessage(`PSPF auto-initialise failed: ${message}`);
  }
}
