import * as vscode from "vscode";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "@pspf/contracts";
import { tokensCss } from "@pspf/webview-shell";

let homeViewProvider: PubHomeViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  homeViewProvider = new PubHomeViewProvider();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 70);
  statusItem.text = `$(organization) PSPF Pub v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = `PSPF Pub ${PSPF_SLICE_VERSION}\nSchema ${VERSION_AXES.schemaVersion} - Bundle ${VERSION_AXES.bundleVersion} - API ${VERSION_AXES.apiVersion}`;
  statusItem.command = "pspf.pub.openHome";
  statusItem.show();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pspfPub.homeView", homeViewProvider),
    statusItem,
    vscode.commands.registerCommand("pspf.pub.openHome", openHome),
    vscode.commands.registerCommand("pspf.pub.openOrgChart", () => openFoundationSurface("organisation chart")),
    vscode.commands.registerCommand("pspf.pub.openPeople", () => openFoundationSurface("people directory")),
    vscode.commands.registerCommand("pspf.pub.openRoles", () => openFoundationSurface("role directory")),
    vscode.commands.registerCommand("pspf.pub.openAssignments", () => openFoundationSurface("assignment board")),
    vscode.commands.registerCommand("pspf.pub.openRelationshipLog", () => openFoundationSurface("relationship log"))
  );
}

export function deactivate(): void {
  homeViewProvider = undefined;
}

function openHome(): void {
  void vscode.commands.executeCommand("pspfPub.homeView.focus");
}

function openFoundationSurface(surfaceName: string): void {
  openHome();
  vscode.window.showInformationMessage(`PSPF Pub ${surfaceName} is part of the v1.28 foundation surface.`);
}

class PubHomeViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: false };
    webviewView.webview.html = renderHomeHtml();
  }
}

function renderHomeHtml(): string {
  const axes = `Schema ${VERSION_AXES.schemaVersion} - Bundle ${VERSION_AXES.bundleVersion} - API ${VERSION_AXES.apiVersion}`;
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${tokensCss}
    body {
      margin: 0;
      padding: 18px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    main {
      display: grid;
      gap: 14px;
    }
    .hero {
      border: 1px solid var(--vscode-panel-border);
      border-left: 4px solid #c45a64;
      border-radius: 8px;
      padding: 16px;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, #c45a64 12%);
    }
    h1, h2, p {
      margin: 0;
    }
    h1 {
      font-size: 1.3rem;
      line-height: 1.25;
    }
    h2 {
      font-size: 0.95rem;
      margin-bottom: 8px;
    }
    p {
      line-height: 1.5;
    }
    .meta, .tag {
      color: var(--vscode-descriptionForeground);
      font-size: 0.82rem;
    }
    .grid {
      display: grid;
      gap: 10px;
    }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background: var(--vscode-sideBar-background);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }
    .tag {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 4px 8px;
      white-space: nowrap;
    }
  </style>
  <title>PSPF Pub</title>
</head>
<body>
  <main>
    <section class="hero">
      <p class="meta">PSPF Pub v${escapeHtml(PSPF_SLICE_VERSION)} - ${escapeHtml(axes)}</p>
      <h1>People, roles, teams, assignments, and stakeholder relationships</h1>
      <p>Pub is the local-only staff and stakeholder context surface for understanding who has a stake in protecting information and where responsibility needs attention.</p>
      <div class="tags">
        <span class="tag">local-only people context</span>
        <span class="tag">Core dependent</span>
        <span class="tag">no Explorer publication in v1.28</span>
      </div>
    </section>
    <section class="grid" aria-label="Pub foundation areas">
      ${foundationCard("Organisation chart", "Role, team, milestone, anniversary, and action badges for upcoming work and sustainability signals.")}
      ${foundationCard("Relationship context", "Staff, service providers, customers, relationship notes, team events, and stakeholder history kept local by default.")}
      ${foundationCard("Assignments and rotations", "Assignment boards, roster opportunities, staff rotations, and role contribution views for future implementation.")}
    </section>
  </main>
</body>
</html>`;
}

function foundationCard(title: string, body: string): string {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
