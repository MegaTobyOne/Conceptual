import { copyFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { commandButtonAcknowledgementScript, pill as shellPill, tokensCss } from "@pspf/webview-shell";
import * as vscode from "vscode";
import { createCoreService, type ImportMode, type ImportResult } from "./service.js";

export function activate(context: vscode.ExtensionContext): Record<string, unknown> {
  const output = vscode.window.createOutputChannel("PSPF Core");
  context.subscriptions.push(output);

  const api = {
    initialiseWorkspace: () => getService().initialiseWorkspace(),
    resetWorkspace: () => getService().resetWorkspace(),
    validateWorkspace: () => getService().validateWorkspace(),
    verifyIntegrity: () => getService().verifyIntegrity(),
    runIntegrityScan: () => getService().runIntegrityScan(),
    runDatasetDiagnostics: () => getService().runDatasetDiagnostics(),
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
    vscode.commands.registerCommand("pspf.core.resetWorkspace", async () => {
      const action = await vscode.window.showWarningMessage(
        "Reset PSPF workspace data and return to a clean reference-data baseline? This removes local PSPF records, snapshots, imports, exports and logs in this workspace.",
        { modal: true },
        "Reset workspace"
      );
      if (action !== "Reset workspace") {
        return { reset: false };
      }
      const result = await getService().resetWorkspace();
      await vscode.window.showInformationMessage(result.message);
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.validateWorkspace", async () => {
      const result = await getService().validateWorkspace();
      await vscode.window.showInformationMessage(
        result.ok ? result.message : `PSPF validation failed: ${result.message}`
      );
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.verifyIntegrity", async () => {
      const result = await getService().verifyIntegrity();
      await vscode.window.showInformationMessage(
        result.ok ? "PSPF SQLite integrity check passed." : `PSPF integrity check failed: ${result.detail}`
      );
      return result;
    }),
    vscode.commands.registerCommand("pspf.core.runIntegrityScan", async () => {
      const report = await getService().runIntegrityScan();
      await vscode.window.showInformationMessage(
        report.ok ? report.summary : `PSPF integrity scan failed: ${report.summary}`
      );
      return report;
    }),
    vscode.commands.registerCommand("pspf.core.runDatasetDiagnostics", async () => {
      const report = await getService().runDatasetDiagnostics();
      const action = await vscode.window.showInformationMessage(
        report.ok ? report.summary : `PSPF dataset diagnostics failed: ${report.summary}`,
        ...(report.ok ? [] : ["Reset workspace"])
      );
      if (action === "Reset workspace") {
        return vscode.commands.executeCommand("pspf.core.resetWorkspace");
      }
      return report;
    }),
    vscode.commands.registerCommand("pspf.core.createSnapshot", async () => {
      const snapshot = await getService().createSnapshot();
      await vscode.window.showInformationMessage(`PSPF snapshot created: ${snapshot.title ?? snapshot.id}`);
      return snapshot;
    }),
    vscode.commands.registerCommand("pspf.core.exportBundle", async () => {
      const saveUri = await vscode.window.showSaveDialog({
        title: "Save PSPF JSON Bundle",
        defaultUri: vscode.Uri.file(
          join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
            `pspf-master-bundle-${new Date().toISOString().slice(0, 10)}.json`
          )
        ),
        filters: { "PSPF JSON bundle": ["json"] }
      });
      if (!saveUri) {
        return undefined;
      }
      const result = await getService().exportBundle();
      const bundlePath = join(result.exportDirectory, "bundle.json");
      await copyFile(bundlePath, saveUri.fsPath);
      const action = await vscode.window.showInformationMessage(
        `PSPF JSON bundle saved to ${saveUri.fsPath}`,
        "Open File"
      );
      if (action === "Open File") {
        await vscode.commands.executeCommand("vscode.open", saveUri);
      }
      return { ...result, bundlePath: saveUri.fsPath };
    }),
    vscode.commands.registerCommand("pspf.core.importBundle", async () => {
      return importBundlesFromPicker(output, {
        openTitle: "Import PSPF Master JSON Bundle(s)",
        filterName: "PSPF master JSON bundle",
        progressTitle: "Importing PSPF master JSON bundle",
        completePrefix: "PSPF import complete",
        errorPrefix: "PSPF master JSON bundle import failed"
      });
    }),
    vscode.commands.registerCommand("pspf.core.importExplorerLocalBundle", async () => {
      return importBundlesFromPicker(output, {
        openTitle: "Import PSPF Master JSON Bundle(s)",
        filterName: "PSPF master JSON bundle",
        progressTitle: "Importing PSPF master JSON bundle",
        completePrefix: "PSPF master JSON import complete",
        errorPrefix: "PSPF master JSON import failed"
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
    vscode.commands.registerCommand("pspf.core.planImportBundleFromPath", (bundlePath: string, mode: ImportMode) =>
      getService().planImportBundle(bundlePath, mode)
    ),
    vscode.commands.registerCommand("pspf.core.importBundleFromPath", (bundlePath: string, mode: ImportMode) =>
      getService().importBundle(bundlePath, mode)
    ),
    vscode.commands.registerCommand("pspf.core.ensureWorkspaceReady", async () => getService().initialiseWorkspace()),
    vscode.commands.registerCommand("pspf.core.runIntegrityScanHeadless", async () => getService().runIntegrityScan()),
    vscode.commands.registerCommand("pspf.core.runDatasetDiagnosticsHeadless", async () =>
      getService().runDatasetDiagnostics()
    ),
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
  labels: {
    readonly openTitle: string;
    readonly filterName: string;
    readonly progressTitle: string;
    readonly completePrefix: string;
    readonly errorPrefix: string;
  }
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
      {
        label: "Additive merge",
        description: "Add or update bundle records without deleting existing records",
        value: "additive-merge" as const
      },
      {
        label: "Plan, review, apply",
        description: "Preview changes and confirm before writing",
        value: "plan-apply" as const
      },
      {
        label: "Full replace",
        description: "Create a rollback snapshot, then replace existing records",
        value: "full-replace" as const
      }
    ],
    { title: "Select Import Mode", ignoreFocusOut: true }
  );
  if (!pickedMode) {
    return undefined;
  }

  try {
    if (pickedMode.value === "plan-apply") {
      const plans = await Promise.all(
        bundlePaths.map((bundlePath) => getService().planImportBundle(bundlePath, "plan-apply"))
      );
      writeImportSummary(output, plans);
      const planSummary = combineImportSummaries(plans);
      const reviewAction = await openImportReviewSurface(output, plans, planSummary);
      if (reviewAction !== "apply") {
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

function openImportReviewSurface(
  output: vscode.OutputChannel,
  plans: readonly ImportResult[],
  planSummary: { readonly created: number; readonly updated: number; readonly unchanged: number }
): Promise<"apply" | "cancel"> {
  const panel = vscode.window.createWebviewPanel(
    "pspfWorkshopImportReview",
    "PSPF Workshop Import Review",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  panel.webview.html = importReviewHtml(plans, planSummary);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (action: "apply" | "cancel") => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(action);
      panel.dispose();
    };

    const messageSubscription = panel.webview.onDidReceiveMessage((message: { readonly command?: string }) => {
      if (message.command === "applyImport") {
        finish("apply");
        return;
      }
      if (message.command === "showDetails") {
        output.show(true);
        return;
      }
      if (message.command === "cancelImport") {
        finish("cancel");
      }
    });
    const disposeSubscription = panel.onDidDispose(() => finish("cancel"));
    panel.onDidDispose(() => {
      messageSubscription.dispose();
      disposeSubscription.dispose();
    });
  });
}

function importReviewHtml(
  plans: readonly ImportResult[],
  planSummary: { readonly created: number; readonly updated: number; readonly unchanged: number }
): string {
  const fileCount = plans.length;
  const written = plans.reduce((total, plan) => total + plan.summary.written, 0);
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PSPF Workshop Import Review</title>
  <style>
    ${tokensCss("extension")}
    :root { color-scheme: light dark; --core-accent-strong: rgba(37, 99, 235, 0.28); }
    body { margin: 0; padding: 0; color: var(--pspf-text); background: radial-gradient(circle at top left, var(--pspf-accent-soft), transparent 28rem), var(--pspf-surface); }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 18px var(--pspf-pad-lg); background: linear-gradient(135deg, var(--core-accent-strong) 0%, var(--pspf-surface) 70%); border-bottom: 1px solid var(--pspf-border); }
    header strong { display: block; font-size: 22px; }
    header span { color: var(--pspf-muted); font-size: var(--pspf-type-body); }
    main { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 24px 0; }
    section { background: var(--pspf-surface); border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius); padding: var(--pspf-pad); margin-bottom: var(--pspf-pad); }
    h1, h2, h3 { margin-top: 0; }
    .core-sensitivity { margin: 0; padding: 8px var(--pspf-pad-lg); }
    .version-strip, .toolbar { display: flex; flex-wrap: wrap; gap: var(--pspf-pad-sm); align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .pspf-metric strong { font-size: 28px; margin-top: 4px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; min-width: min(760px, 100%); border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--pspf-border); padding: var(--pspf-table-cell-pad-y) var(--pspf-table-cell-pad-x); text-align: left; vertical-align: top; }
    th { color: var(--pspf-muted); font-size: var(--pspf-type-body); }
    td { overflow-wrap: anywhere; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    .pspf-button--danger { border-color: var(--pspf-warn); background: var(--pspf-warn-soft); color: var(--pspf-text); }
    .muted { color: var(--pspf-muted); }
  </style>
</head>
<body>
  <header><div><strong>PSPF Workshop</strong><span>System of record import review</span></div><div class="version-strip">${shellPill("Plan, review, apply", "accent")}${shellPill("Explorer local bundle")}</div></header>
  <div class="pspf-sensitivity-banner core-sensitivity">OFFICIAL: Sensitive · Review every Explorer local change before writing to Workshop</div>
  <main>
    <section>
      <h1>Import Review</h1>
      <p class="muted">This is a read-only plan. Nothing is written until you choose Apply Import.</p>
      <div class="pspf-mode-strip"><span class="pspf-mode-step is-active">Review plan</span><span class="pspf-mode-step">Apply to Workshop</span><span class="pspf-mode-step">Undo available after apply</span></div>
      <div class="grid">
        ${metric("Files", fileCount)}
        ${metric("Created", planSummary.created)}
        ${metric("Updated", planSummary.updated)}
        ${metric("Unchanged", planSummary.unchanged)}
        ${metric("Will write", written)}
      </div>
      <div class="toolbar" style="margin-top: 14px;">
        <button type="button" class="pspf-button" data-command="applyImport">Apply Import</button>
        <button type="button" class="pspf-button pspf-button--secondary" data-command="showDetails">Show Details</button>
        <button type="button" class="pspf-button pspf-button--danger" data-command="cancelImport">Cancel</button>
      </div>
    </section>
    ${plans.map(importPlanCard).join("")}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    ${commandButtonAcknowledgementScript}
    document.addEventListener("click", (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest("button[data-command]") : null;
      if (button) {
        pspfAcknowledgeCommandButton(button);
        vscode.postMessage({ command: button.dataset.command });
      }
    });
  </script>
</body>
</html>`;
}

function metric(label: string, value: number): string {
  return `<div class="pspf-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function importPlanCard(plan: ImportResult): string {
  const byTypeRows = Object.entries(plan.summary.byType)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([entityType, summary]) =>
        `<tr><td>${escapeHtml(entityType)}</td><td>${summary.created}</td><td>${summary.updated}</td><td>${summary.unchanged}</td><td>${summary.written}</td></tr>`
    )
    .join("");
  const conflictItems =
    plan.summary.conflicts.length > 0
      ? plan.summary.conflicts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : '<li><span class="muted">No updates or conflicts in this file.</span></li>';
  const exampleItems =
    plan.summary.examples.length > 0
      ? plan.summary.examples.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : '<li><span class="muted">No example changes.</span></li>';
  return `<section>
    <h2>${escapeHtml(basename(plan.bundlePath))}</h2>
    <p class="muted">${escapeHtml(plan.bundlePath)}</p>
    <div class="grid">
      ${metric("Incoming", plan.summary.total)}
      ${metric("Created", plan.summary.created)}
      ${metric("Updated", plan.summary.updated)}
      ${metric("Unchanged", plan.summary.unchanged)}
      ${metric("Will write", plan.summary.written)}
    </div>
    <h3>Record Types</h3>
    <div class="table-wrap"><table><thead><tr><th>Type</th><th>Created</th><th>Updated</th><th>Unchanged</th><th>Will write</th></tr></thead><tbody>${byTypeRows}</tbody></table></div>
    <h3>Updates To Review</h3>
    <ul>${conflictItems}</ul>
    <h3>Examples</h3>
    <ul>${exampleItems}</ul>
  </section>`;
}

function combineImportSummaries(results: readonly ImportResult[]): {
  created: number;
  updated: number;
  unchanged: number;
} {
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
    output.appendLine(
      `- ${basename(result.bundlePath)} (${result.mode}): ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged, ${result.summary.written} written.`
    );
    for (const [entityType, summary] of Object.entries(result.summary.byType).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      output.appendLine(
        `  ${entityType}: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged`
      );
    }
    if (result.summary.examples.length > 0) {
      output.appendLine("  Examples:");
      for (const example of result.summary.examples) {
        output.appendLine(`  - ${example}`);
      }
    }
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const shouldInitialise = vscode.workspace
    .getConfiguration("pspf.core", folder.uri)
    .get<boolean>("initialiseOnActivation", false);
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
