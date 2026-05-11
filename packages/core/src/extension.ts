import { relative } from "node:path";
import * as vscode from "vscode";
import { createCoreService, type ImportMode } from "./service.js";

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
    importBundle: getService().importBundle,
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
      const pickedFile = await vscode.window.showOpenDialog({
        title: "Import PSPF Master Bundle",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { "PSPF bundle": ["json"] }
      });
      const bundlePath = pickedFile?.[0]?.fsPath;
      if (!bundlePath) {
        return undefined;
      }

      const pickedMode = await vscode.window.showQuickPick(
        [
          { label: "Additive merge", description: "Add or update bundle records without deleting existing records", value: "additive-merge" as const },
          { label: "Full replace", description: "Create a rollback snapshot, then replace existing records", value: "full-replace" as const }
        ],
        { title: "Select Import Mode", ignoreFocusOut: true }
      );
      if (!pickedMode) {
        return undefined;
      }

      const result = await getService().importBundle(bundlePath, pickedMode.value);
      await vscode.window.showInformationMessage(`PSPF bundle import complete: ${result.imported} record(s), ${result.mode}.`);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.showWriterLock", async () => {
      const lock = await getService().getWriterLock();
      const message = lock.writable ? lock.detail : `PSPF workspace read-only: ${lock.detail}`;
      await vscode.window.showInformationMessage(message);
      return lock;
    }),
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
