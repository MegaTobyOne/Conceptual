import * as vscode from "vscode";
import type { V01Entity } from "@pspf/contracts";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "@pspf/contracts";
import {
  buildPentestWorkbenchModel,
  PENTEST_FINDING_SEVERITIES,
  type PentestAssessmentModel,
  type PentestFindingModel,
  type PentestFindingQueueId,
  type PentestWorkbenchModel
} from "./pentest-workbench.js";

let homeProvider: AssuranceHomeProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  homeProvider = new AssuranceHomeProvider();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 88);
  statusItem.text = `$(shield) PSPF Assurance v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = `PSPF Assurance ${PSPF_SLICE_VERSION}\nSchema ${VERSION_AXES.schemaVersion} · Bundle ${VERSION_AXES.bundleVersion} · API ${VERSION_AXES.apiVersion}`;
  statusItem.command = "pspf.assurance.openHome";
  statusItem.show();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pspfAssurance.homeView", homeProvider),
    statusItem,
    vscode.window.registerTreeDataProvider("pspfAssurance.assessmentsView", new StaticTreeProvider("Open Assurance Home to review assessments", "shield")),
    vscode.window.registerTreeDataProvider("pspfAssurance.findingsView", new StaticTreeProvider("Open the Penetration Testing Workbench to review findings", "bug")),
    vscode.window.registerTreeDataProvider("pspfAssurance.verificationView", new StaticTreeProvider("Verification queues are shown in the workbench", "verified")),
    vscode.window.registerTreeDataProvider("pspfAssurance.publicationsView", new StaticTreeProvider("Publication readiness checks are planned", "file-lock")),
    vscode.commands.registerCommand("pspf.assurance.openHome", openHome),
    vscode.commands.registerCommand("pspf.assurance.openAssessmentWorkbench", openPentestWorkbench),
    vscode.commands.registerCommand("pspf.assurance.openPentestWorkbench", openPentestWorkbench),
    vscode.commands.registerCommand("pspf.assurance.newAssessment", plannedCommand("New Assessment")),
    vscode.commands.registerCommand("pspf.assurance.newFinding", plannedCommand("New Finding")),
    vscode.commands.registerCommand("pspf.assurance.openVerificationQueue", openPentestWorkbench),
    vscode.commands.registerCommand("pspf.assurance.prepareAssuranceReport", plannedCommand("Prepare Assurance Report")),
    vscode.commands.registerCommand("pspf.assurance.runPublicationReadiness", runPublicationReadiness)
  );
}

export function deactivate(): void {
  // No runtime resources to dispose yet.
}

class StaticTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly item: vscode.TreeItem;

  constructor(labelText: string, iconId: string) {
    this.item = new vscode.TreeItem(labelText, vscode.TreeItemCollapsibleState.None);
    this.item.iconPath = new vscode.ThemeIcon(iconId);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return [this.item];
  }
}

class AssuranceHomeProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { readonly command?: string }) => {
      void this.handleMessage(message.command).catch(async (error: unknown) => {
        await vscode.window.showErrorMessage(`PSPF Assurance action failed: ${errorMessage(error)}`);
      });
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    try {
      const model = buildPentestWorkbenchModel(await listAllEntities());
      this.view.webview.html = renderHome(model);
    } catch (error) {
      this.view.webview.html = shellHtml(
        "PSPF Assurance",
        `<section><h1>Assurance Home</h1><p class="muted">${escapeHtml(errorMessage(error))}</p><div class="form-actions"><button type="button" data-command="pspf.core.initialiseWorkspace">Initialise workspace</button></div></section>`
      );
    }
  }

  private async handleMessage(command: string | undefined): Promise<void> {
    if (!command) {
      return;
    }
    if (command === "refresh") {
      await this.refresh();
      return;
    }
    const allowedCommands = new Set([
      "pspf.core.initialiseWorkspace",
      "pspf.assurance.openPentestWorkbench",
      "pspf.assurance.runPublicationReadiness"
    ]);
    if (!allowedCommands.has(command)) {
      return;
    }
    await vscode.commands.executeCommand(command);
    await this.refresh();
  }
}

async function openHome(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.extension.pspfAssurance");
  await homeProvider?.refresh();
}

async function openPentestWorkbench(): Promise<void> {
  await ensureCoreReady();
  const panel = vscode.window.createWebviewPanel(
    "pspfAssurancePentestWorkbench",
    "PSPF Assurance Penetration Testing Workbench",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  wirePanelMessages(panel, async () => {
    panel.webview.html = renderPentestWorkbench(buildPentestWorkbenchModel(await listAllEntities()));
  });
  panel.webview.html = renderPentestWorkbench(buildPentestWorkbenchModel(await listAllEntities()));
}

async function runPublicationReadiness(): Promise<void> {
  await ensureCoreReady();
  const model = buildPentestWorkbenchModel(await listAllEntities());
  const issues = [
    model.totals.overdue > 0 ? `${model.totals.overdue} overdue finding action(s)` : undefined,
    model.totals.slaAtRisk > 0 ? `${model.totals.slaAtRisk} finding action(s) at SLA risk` : undefined,
    model.totals.pendingVerification > 0
      ? `${model.totals.pendingVerification} finding action(s) pending verification`
      : undefined
  ].filter((item): item is string => Boolean(item));
  if (issues.length === 0) {
    await vscode.window.showInformationMessage("Assurance publication readiness check passed for the current pentest slice.");
    return;
  }
  await vscode.window.showWarningMessage(`Assurance publication readiness needs attention: ${issues.join("; ")}.`);
}

function plannedCommand(title: string): () => Promise<void> {
  return async () => {
    await vscode.window.showInformationMessage(`${title} will arrive with the assurance finding model slice.`);
  };
}

async function ensureCoreReady(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.validateWorkspace");
}

async function listAllEntities(): Promise<readonly V01Entity[]> {
  await ensureCoreReady();
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  return entities ?? [];
}

function wirePanelMessages(panel: vscode.WebviewPanel, refresh: () => Promise<void> = async () => undefined): void {
  panel.webview.onDidReceiveMessage((message: { readonly command?: string; readonly entityType?: string; readonly entityId?: string }) => {
    void handlePanelMessage(message, refresh).catch(async (error: unknown) => {
      await vscode.window.showErrorMessage(`PSPF Assurance action failed: ${errorMessage(error)}`);
    });
  });
}

async function handlePanelMessage(
  message: { readonly command?: string; readonly entityType?: string; readonly entityId?: string },
  refresh: () => Promise<void>
): Promise<void> {
  if (!message.command) {
    return;
  }
  if (message.command === "refresh") {
    await refresh();
    return;
  }
  if (message.command === "openEntity" && message.entityType && message.entityId) {
    await vscode.commands.executeCommand("pspf.workshop.openItemDetail", message.entityType, message.entityId);
    return;
  }
  const allowedCommands = new Set([
    "pspf.assurance.openPentestWorkbench",
    "pspf.workshop.createAction",
    "pspf.workshop.attachEvidence",
    "pspf.workshop.manageTags"
  ]);
  if (allowedCommands.has(message.command)) {
    await vscode.commands.executeCommand(message.command);
    await refresh();
  }
}

function renderHome(model: PentestWorkbenchModel): string {
  return shellHtml(
    "PSPF Assurance",
    `<section>
      <p class="eyebrow">Assurance lifecycle</p>
      <h1>PSPF Assurance</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Local-first assessment and verification workbench.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Assessments", model.totals.assessments)}
        ${metricCard("Findings", model.totals.findings)}
        ${metricCard("Critical/high", model.totals.criticalHighFindings)}
        ${metricCard("Open remediation", model.totals.openFindingActions)}
        ${metricCard("Overdue", model.totals.overdue)}
        ${metricCard("Pending verification", model.totals.pendingVerification)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="pspf.assurance.openPentestWorkbench">Open pentest workbench</button>
        <button type="button" data-command="pspf.assurance.runPublicationReadiness">Run readiness check</button>
        <button type="button" data-command="refresh">Refresh</button>
      </div>
    </section>
    <section>
      <h2>Scope</h2>
      <p class="muted">This first slice preserves the current tag-based pentest read model. New assurance finding entities, approvals, report publishing, and signing arrive in later gated slices.</p>
    </section>`
  );
}

function renderPentestWorkbench(model: PentestWorkbenchModel): string {
  const assessments =
    model.assessments.length > 0
      ? model.assessments.map(renderPentestAssessment).join("")
      : `<section><p class="muted">No penetration testing assessments found. Create a Tag such as PENTEST-2026-Web and apply it to finding Actions to populate this workbench.</p></section>`;
  const severityLegend = PENTEST_FINDING_SEVERITIES.map(
    (severity) =>
      `<span class="pentest-severity-pill" data-severity="${escapeHtml(severity.id)}">${escapeHtml(severity.label)} · ${severity.slaDays} d</span>`
  ).join("");
  return shellHtml(
    "Penetration Testing Workbench",
    `${pentestWorkbenchStyles()}
    <section>
      <p class="eyebrow">Assurance · Third-party assessment</p>
      <h1>Penetration Testing Workbench</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))} · Findings, retests, residual risks and Shop contract context derived from existing Actions, Evidence, Risks, Tags and links.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Assessments", model.totals.assessments)}
        ${metricCard("Findings", model.totals.findings)}
        ${metricCard("Critical/high", model.totals.criticalHighFindings)}
        ${metricCard("Other findings", model.totals.otherFindings)}
        ${metricCard("Open remediation", model.totals.openFindingActions)}
        ${metricCard("Overdue", model.totals.overdue)}
        ${metricCard("SLA at risk", model.totals.slaAtRisk)}
        ${metricCard("Pending verification", model.totals.pendingVerification)}
        ${metricCard("Closed", model.totals.closed)}
        ${metricCard("Retest backlog", model.totals.verificationBacklog)}
        ${metricCard("Residual risks", model.totals.residualRisks)}
      </div>
      <div class="form-actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" data-command="pspf.workshop.createAction">Create finding action</button>
        <button type="button" data-command="pspf.workshop.attachEvidence">Add evidence</button>
        <button type="button" data-command="pspf.workshop.manageTags">Manage Tags</button>
      </div>
      <p class="muted">SLA bands: ${severityLegend}. Severity is inferred from a linked severity Tag or the Action title; unknown severity defaults to Medium so the finding remains visible.</p>
    </section>
    ${renderPentestPipeline(model)}
    ${assessments}`
  );
}

function renderPentestPipeline(model: PentestWorkbenchModel): string {
  const rows = model.assessments.map((assessment) => ({
    target: assessment.engagement.target,
    status: label(assessment.engagement.status),
    tester: assessment.engagement.tester,
    method: assessment.engagement.method,
    window: assessment.engagement.plannedWindow,
    reportDue: assessment.engagement.reportDue,
    retest: assessment.engagement.retestWindow,
    criticalHigh: assessment.engagement.criticalHighFindings,
    other: assessment.engagement.otherFindings,
    openActions: assessment.engagement.openFindingActions
  }));
  return recordTable("Pentest Pipeline", rows, [
    "target",
    "status",
    "tester",
    "method",
    "window",
    "reportDue",
    "retest",
    "criticalHigh",
    "other",
    "openActions"
  ]);
}

function renderPentestAssessment(assessment: PentestAssessmentModel): string {
  const commercialRows = assessment.commercialContext.map((item) => ({
    openEntityType: "contract",
    openEntityId: item.contractId,
    supplier: item.supplierName ?? "Supplier not linked",
    contract: item.contractTitle,
    contractRef: item.contractRef ?? "Not recorded"
  }));
  const riskRows = assessment.residualRisks.map((risk) => ({
    openEntityType: "risk",
    openEntityId: risk.id,
    title: risk.title,
    status: label(risk.status),
    score: risk.score,
    supplierLinked: risk.supplierLinked ? "Yes" : "No"
  }));
  const verificationRows = assessment.verificationBacklog.map((item) => ({
    openEntityType: "evidence",
    openEntityId: item.evidenceId,
    evidence: item.evidenceTitle,
    finding: item.findingTitle,
    severity: item.severityLabel,
    freshness: label(item.freshness),
    dueDate: item.dueDate ?? "Not set"
  }));

  return `<section class="pentest-assessment" aria-labelledby="pentest-${escapeHtml(assessment.tagId)}">
      <header class="pentest-assessment__header">
        <div>
          <p class="eyebrow">${escapeHtml(assessment.tagLabel)}</p>
          <h2 id="pentest-${escapeHtml(assessment.tagId)}">${escapeHtml(assessment.title)}</h2>
          <p class="muted">Started ${escapeHtml(assessment.startedAt ? formatDisplayDate(new Date(assessment.startedAt)) : "not yet")} · ${assessment.findingCount} finding${assessment.findingCount === 1 ? "" : "s"} · ${assessment.closurePercentage}% closed</p>
        </div>
        <div class="pentest-severity-counts" aria-label="Finding count by severity">
          ${PENTEST_FINDING_SEVERITIES.map(
            (severity) =>
              `<span class="pentest-severity-pill" data-severity="${escapeHtml(severity.id)}">${escapeHtml(severity.label)} ${assessment.severityCounts[severity.id]}</span>`
          ).join("")}
        </div>
      </header>
      ${renderPentestEngagementProfile(assessment)}
      <div class="pentest-queue-grid">
        ${renderPentestFindingQueue("Overdue", "overdue", assessment.queues.overdue)}
        ${renderPentestFindingQueue("SLA at risk", "sla-at-risk", assessment.queues["sla-at-risk"])}
        ${renderPentestFindingQueue("Pending verification", "pending-verification", assessment.queues["pending-verification"])}
        ${renderPentestFindingQueue("Closed", "closed", assessment.queues.closed)}
      </div>
    </section>
    ${recordTable(`Retest backlog · ${assessment.tagLabel}`, verificationRows, ["evidence", "finding", "severity", "freshness", "dueDate"])}
    ${recordTable(`Commercial context · ${assessment.tagLabel}`, commercialRows, ["supplier", "contract", "contractRef"])}
    ${recordTable(`Residual risk · ${assessment.tagLabel}`, riskRows, ["title", "status", "score", "supplierLinked"])}`;
}

function renderPentestEngagementProfile(assessment: PentestAssessmentModel): string {
  const engagement = assessment.engagement;
  return `<div class="pentest-engagement-grid" aria-label="Penetration test planning and execution profile">
    ${renderPentestEngagementCard("Target", escapeHtml(engagement.target), escapeHtml(engagement.targetType))}
    ${renderPentestEngagementCard("Tester", escapeHtml(engagement.tester))}
    ${renderPentestEngagementCard("Method", escapeHtml(engagement.method))}
    ${renderPentestEngagementCard("Timing", escapeHtml(engagement.plannedWindow), `Report due ${escapeHtml(engagement.reportDue)} · Retest ${escapeHtml(engagement.retestWindow)}`)}
    ${renderPentestEngagementCard("Finding split", escapeHtml(engagement.executionSummary))}
  </div>`;
}

function renderPentestEngagementCard(title: string, body: string, detail = ""): string {
  return `<article class="pentest-engagement-card"><h3>${escapeHtml(title)}</h3><p>${body}</p>${detail ? `<p class="muted">${detail}</p>` : ""}</article>`;
}

function renderPentestFindingQueue(
  title: string,
  queueId: PentestFindingQueueId,
  findings: readonly PentestFindingModel[]
): string {
  const rows =
    findings.length > 0
      ? findings.map((finding) => renderPentestFindingCard(finding)).join("")
      : `<p class="muted">No findings in this queue.</p>`;
  return `<article class="pentest-queue" data-queue="${escapeHtml(queueId)}">
      <header class="pentest-queue__header">
        <h3>${escapeHtml(title)}</h3>
        ${pill(String(findings.length))}
      </header>
      <div class="pentest-finding-list">${rows}</div>
    </article>`;
}

function renderPentestFindingCard(finding: PentestFindingModel): string {
  const evidenceText =
    finding.verifiedEvidenceIds.length > 0
      ? `${finding.verifiedEvidenceIds.length} verified evidence`
      : finding.linkedEvidenceIds.length > 0
        ? `${finding.linkedEvidenceIds.length} evidence needing verification`
        : "No evidence linked";
  const requirementText =
    finding.linkedRequirementIds.length > 0
      ? `${finding.linkedRequirementIds.length} linked requirement${finding.linkedRequirementIds.length === 1 ? "" : "s"}`
      : "No requirement link";
  return `<article class="pentest-finding-card" data-severity="${escapeHtml(finding.severityId)}">
      <header>
        <span class="pentest-severity-pill" data-severity="${escapeHtml(finding.severityId)}">${escapeHtml(finding.severityLabel)}</span>
        <button type="button" data-command="openEntity" data-entity-type="action" data-entity-id="${escapeHtml(finding.id)}">${escapeHtml(finding.title)}</button>
      </header>
      <p class="muted">${escapeHtml(label(finding.status))} · due ${escapeHtml(finding.dueDate ?? "not set")} · SLA ${escapeHtml(finding.slaDeadline.slice(0, 10))}</p>
      <p class="muted">${escapeHtml(evidenceText)} · ${escapeHtml(requirementText)} · ${escapeHtml(finding.severitySource)}</p>
    </article>`;
}

function shellHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><style>${baseStyles()}</style></head><body>${body}<script>${webviewScript()}</script></body></html>`;
}

function baseStyles(): string {
  return `:root { --surface: var(--vscode-editor-background); --surface-strong: var(--vscode-sideBar-background); --border: var(--vscode-panel-border); --muted: var(--vscode-descriptionForeground); --text: var(--vscode-editor-foreground); --accent: #0f766e; --danger: #b42318; --warn: #b7791f; --ok: #047857; --radius: 8px; --radius-sm: 6px; }
    body { margin: 0; padding: 16px; color: var(--text); background: var(--surface); font-family: var(--vscode-font-family); }
    section { border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin: 0 0 14px; background: color-mix(in srgb, var(--surface) 94%, var(--accent)); }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 24px; } h2 { font-size: 18px; } h3 { font-size: 14px; }
    .muted { color: var(--muted); } .eyebrow { color: var(--accent); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .metric { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: var(--surface-strong); }
    .metric strong { display: block; font-size: 24px; line-height: 1; } .metric span { color: var(--muted); font-size: 12px; }
    .form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; } button { color: inherit; background: var(--surface-strong); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 10px; cursor: pointer; } button:hover { border-color: var(--accent); }
    .table-wrap { overflow: auto; } table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid var(--border); padding: 7px; text-align: left; vertical-align: top; } th { color: var(--muted); font-size: 12px; }
    .pill, .pentest-severity-pill { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 11px; color: var(--muted); }
    .pentest-severity-pill[data-severity="critical"] { border-color: var(--danger); color: var(--danger); }
    .pentest-severity-pill[data-severity="high"] { border-color: #c2410c; color: #c2410c; }
    .pentest-severity-pill[data-severity="medium"] { border-color: var(--warn); color: var(--warn); }
    .pentest-severity-pill[data-severity="low"] { border-color: var(--ok); color: var(--ok); }
    .pentest-assessment__header, .pentest-queue__header { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .pentest-severity-counts, .pentest-finding-list { display: flex; gap: 8px; flex-wrap: wrap; }
    .pentest-engagement-grid, .pentest-queue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .pentest-engagement-card, .pentest-queue, .pentest-finding-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: var(--surface-strong); }
    .pentest-finding-card { flex: 1 1 260px; }`;
}

function pentestWorkbenchStyles(): string {
  return "";
}

function webviewScript(): string {
  return `const vscode = acquireVsCodeApi(); document.addEventListener('click', event => { const target = event.target; if (!(target instanceof Element)) return; const button = target.closest('button[data-command]'); if (!button) return; vscode.postMessage({ command: button.getAttribute('data-command'), entityType: button.getAttribute('data-entity-type'), entityId: button.getAttribute('data-entity-id') }); });`;
}

function recordTable(title: string, rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  if (rows.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="muted">No records yet.</p></section>`;
  }
  const header = columns.map((column) => `<th>${escapeHtml(label(column))}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${cellValue(row[column])}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<section><h2>${escapeHtml(title)}</h2><div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function cellValue(value: unknown): string {
  if (typeof value === "string") {
    return value.startsWith("<button") ? value : escapeHtml(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return escapeHtml(String(value));
  }
  return value === undefined || value === null ? "" : escapeHtml(String(value));
}

function metricCard(labelText: string, value: string | number): string {
  return `<article class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labelText)}</span></article>`;
}

function versionStrip(): string {
  return `<p class="muted">PSPF ${escapeHtml(PSPF_SLICE_VERSION)} · schema ${escapeHtml(VERSION_AXES.schemaVersion)} · bundle ${escapeHtml(VERSION_AXES.bundleVersion)} · API ${escapeHtml(VERSION_AXES.apiVersion)}</p>`;
}

function pill(value: string): string {
  return `<span class="pill">${escapeHtml(value)}</span>`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function label(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("en-AU") + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
