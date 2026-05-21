import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "@pspf/contracts";
import { tokensCss } from "@pspf/webview-shell";

const PUB_STORE_VERSION = "1.0.0";
const PUB_STORE_PATH = [".pspf", "pub", "pub.json"] as const;
const STAKEHOLDER_TYPES = ["staff", "service-provider", "customer", "partner", "other"] as const;
const ASSIGNMENT_STATUSES = ["active", "planned", "rotating", "needs-backup"] as const;

interface PubStore {
  readonly pubStoreVersion: string;
  readonly updatedAt: string;
  readonly people: readonly PersonRecord[];
  readonly roles: readonly RoleRecord[];
  readonly assignments: readonly AssignmentRecord[];
  readonly relationshipNotes: readonly RelationshipNoteRecord[];
}

type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];
type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

interface PersonRecord {
  readonly id: string;
  readonly displayName: string;
  readonly stakeholderType: StakeholderType;
  readonly organisation: string;
  readonly currentRole: string;
  readonly nextMilestone: string;
  readonly nextAction: string;
  readonly notes: string;
}

interface RoleRecord {
  readonly id: string;
  readonly title: string;
  readonly team: string;
  readonly functionalOutcome: string;
  readonly requirementRef: string;
  readonly directionRef: string;
  readonly actionRef: string;
  readonly contribution: string;
}

interface AssignmentRecord {
  readonly id: string;
  readonly personId: string;
  readonly roleId: string;
  readonly status: AssignmentStatus;
  readonly allocation: string;
  readonly reviewBy: string;
  readonly badge: string;
}

interface RelationshipNoteRecord {
  readonly id: string;
  readonly personId: string;
  readonly createdAt: string;
  readonly summary: string;
  readonly nextContactAt: string;
}

let homeViewProvider: PubHomeViewProvider | undefined;
let activePanel: vscode.WebviewPanel | undefined;

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
    vscode.commands.registerCommand("pspf.pub.loadSample", loadSample),
    vscode.commands.registerCommand("pspf.pub.newPerson", newPerson),
    vscode.commands.registerCommand("pspf.pub.newRole", newRole),
    vscode.commands.registerCommand("pspf.pub.newAssignment", newAssignment),
    vscode.commands.registerCommand("pspf.pub.recordRelationshipNote", recordRelationshipNote),
    vscode.commands.registerCommand("pspf.pub.openOrgChart", () =>
      openPubPanel("Organisation chart", renderOrgChartHtml)
    ),
    vscode.commands.registerCommand("pspf.pub.openPeople", () => openPubPanel("People", renderPeopleHtml)),
    vscode.commands.registerCommand("pspf.pub.openRoles", () => openPubPanel("Roles", renderRolesHtml)),
    vscode.commands.registerCommand("pspf.pub.openAssignments", () =>
      openPubPanel("Assignments", renderAssignmentsHtml)
    ),
    vscode.commands.registerCommand("pspf.pub.openRelationshipLog", () =>
      openPubPanel("Relationship log", renderRelationshipLogHtml)
    )
  );
}

export function deactivate(): void {
  homeViewProvider = undefined;
  activePanel = undefined;
}

async function openHome(): Promise<void> {
  await vscode.commands.executeCommand("pspfPub.homeView.focus");
  await refreshHome();
}

async function loadSample(): Promise<void> {
  const store = await loadStore();
  if (store.people.length > 0 || store.roles.length > 0 || store.assignments.length > 0) {
    const answer = await vscode.window.showWarningMessage(
      "Replace current Pub records with sample people and relationship data?",
      "Replace sample",
      "Cancel"
    );
    if (answer !== "Replace sample") {
      return;
    }
  }

  await saveStore(buildSampleStore());
  await refreshHome();
  vscode.window.showInformationMessage("Loaded PSPF Pub sample data.");
}

async function newPerson(): Promise<void> {
  const displayName = await promptRequiredText("Display name", "Used locally only; not exported to Explorer bundles.");
  if (!displayName) {
    return;
  }
  const stakeholderType = await promptPick("Stakeholder type", STAKEHOLDER_TYPES, "staff");
  if (!stakeholderType) {
    return;
  }
  const organisation = await promptOptionalText(
    "Organisation or team",
    "Internal team, supplier, customer, or partner"
  );
  const currentRole = await promptOptionalText("Current role or relationship", "Example: Security adviser");
  const nextMilestone = await promptOptionalText("Next milestone or anniversary", "Example: 2026-06-30 access review");
  const nextAction = await promptOptionalText("Next action", "Example: confirm rotation window");
  const notes = await promptOptionalText("Local notes", "Sensitive relationship context stays local-only");

  const store = await loadStore();
  const person: PersonRecord = {
    id: localId("PER"),
    displayName,
    stakeholderType,
    organisation,
    currentRole,
    nextMilestone,
    nextAction,
    notes
  };
  await saveStore({ ...store, people: [...store.people, person] });
  await refreshHome();
  vscode.window.showInformationMessage(`Added Pub person ${displayName}.`);
}

async function newRole(): Promise<void> {
  const title = await promptRequiredText("Role title");
  if (!title) {
    return;
  }
  const team = await promptOptionalText("Team or organisation unit");
  const functionalOutcome = await promptOptionalText("Functional outcome", "Example: Access review sustainability");
  const requirementRef = await promptOptionalText("Linked Requirement or outcome reference", "Example: REQ-...");
  const directionRef = await promptOptionalText("Linked Direction reference", "Example: DIR-...");
  const actionRef = await promptOptionalText("Linked Action reference", "Example: ACT-...");
  const contribution = await promptOptionalText(
    "Compliance contribution",
    "How this role improves or sustains assurance"
  );

  const store = await loadStore();
  const role: RoleRecord = {
    id: localId("ROL"),
    title,
    team,
    functionalOutcome,
    requirementRef,
    directionRef,
    actionRef,
    contribution
  };
  await saveStore({ ...store, roles: [...store.roles, role] });
  await refreshHome();
  vscode.window.showInformationMessage(`Added Pub role ${title}.`);
}

async function newAssignment(): Promise<void> {
  const store = await loadStore();
  if (store.people.length === 0 || store.roles.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub person and one Pub role before creating an assignment.");
    return;
  }
  const person = await pickPerson(store, "Assign person");
  if (!person) {
    return;
  }
  const role = await pickRole(store, "Assign role");
  if (!role) {
    return;
  }
  const status = await promptPick("Assignment status", ASSIGNMENT_STATUSES, "active");
  if (!status) {
    return;
  }
  const allocation = await promptOptionalText("Allocation", "Example: primary, backup, 0.4 FTE, monthly review");
  const reviewBy = await promptOptionalText("Review by", "Example: 2026-07-31");
  const badge = await promptOptionalText("Action badge", "Example: rotation due, milestone, anniversary");

  const assignment: AssignmentRecord = {
    id: localId("ASM"),
    personId: person.id,
    roleId: role.id,
    status,
    allocation,
    reviewBy,
    badge
  };
  await saveStore({ ...store, assignments: [...store.assignments, assignment] });
  await refreshHome();
  vscode.window.showInformationMessage(`Assigned ${person.displayName} to ${role.title}.`);
}

async function recordRelationshipNote(): Promise<void> {
  const store = await loadStore();
  if (store.people.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub person before recording a relationship note.");
    return;
  }
  const person = await pickPerson(store, "Relationship note for");
  if (!person) {
    return;
  }
  const summary = await promptRequiredText("Relationship note", "Local-only note; avoid unnecessary sensitive detail.");
  if (!summary) {
    return;
  }
  const nextContactAt = await promptOptionalText("Next contact or follow-up date", "Example: 2026-06-14");
  const relationshipNote: RelationshipNoteRecord = {
    id: localId("REL"),
    personId: person.id,
    createdAt: new Date().toISOString(),
    summary,
    nextContactAt
  };
  await saveStore({ ...store, relationshipNotes: [relationshipNote, ...store.relationshipNotes] });
  await refreshHome();
  vscode.window.showInformationMessage(`Recorded Pub relationship note for ${person.displayName}.`);
}

async function openPubPanel(title: string, renderer: (store: PubStore) => string): Promise<void> {
  const store = await loadStore();
  if (activePanel) {
    activePanel.title = `PSPF Pub ${title}`;
    activePanel.reveal(vscode.ViewColumn.One);
  } else {
    activePanel = vscode.window.createWebviewPanel("pspfPubPanel", `PSPF Pub ${title}`, vscode.ViewColumn.One, {
      enableScripts: false
    });
    activePanel.onDidDispose(() => {
      activePanel = undefined;
    });
  }
  activePanel.webview.html = renderer(store);
}

class PubHomeViewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: false };
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.webviewView) {
      return;
    }
    const store = await loadStore();
    this.webviewView.webview.html = renderHomeHtml(store);
  }
}

async function refreshHome(): Promise<void> {
  await homeViewProvider?.refresh();
}

async function loadStore(): Promise<PubStore> {
  const storePath = getStorePath();
  try {
    const text = await readFile(storePath, "utf8");
    const parsed = JSON.parse(text) as Partial<PubStore>;
    return normaliseStore(parsed);
  } catch (error) {
    if (isFileNotFound(error)) {
      return emptyStore();
    }
    throw error;
  }
}

async function saveStore(store: PubStore): Promise<void> {
  const updatedStore: PubStore = { ...store, pubStoreVersion: PUB_STORE_VERSION, updatedAt: new Date().toISOString() };
  const storePath = getStorePath();
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(updatedStore, null, 2)}\n`, "utf8");
}

function getStorePath(): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace folder before using PSPF Pub.");
  }
  return join(workspaceFolder.uri.fsPath, ...PUB_STORE_PATH);
}

function emptyStore(): PubStore {
  return {
    pubStoreVersion: PUB_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    people: [],
    roles: [],
    assignments: [],
    relationshipNotes: []
  };
}

function normaliseStore(store: Partial<PubStore>): PubStore {
  return {
    pubStoreVersion: typeof store.pubStoreVersion === "string" ? store.pubStoreVersion : PUB_STORE_VERSION,
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : new Date().toISOString(),
    people: Array.isArray(store.people) ? store.people : [],
    roles: Array.isArray(store.roles) ? store.roles : [],
    assignments: Array.isArray(store.assignments) ? store.assignments : [],
    relationshipNotes: Array.isArray(store.relationshipNotes) ? store.relationshipNotes : []
  };
}

function buildSampleStore(): PubStore {
  const people: readonly PersonRecord[] = [
    {
      id: "PUB-PER-access-owner",
      displayName: "Access assurance lead",
      stakeholderType: "staff",
      organisation: "Information Security",
      currentRole: "Runs quarterly access review",
      nextMilestone: "2026-06-30 access review evidence",
      nextAction: "Confirm reviewer rotation",
      notes: "Local-only relationship context for planning coverage."
    },
    {
      id: "PUB-PER-provider-manager",
      displayName: "Managed service contact",
      stakeholderType: "service-provider",
      organisation: "External SOC provider",
      currentRole: "Supports monitoring and escalation",
      nextMilestone: "2026-07-15 service review",
      nextAction: "Check escalation roster",
      notes: "Keep contact context local; publish role/team contribution only in a later slice if approved."
    }
  ];
  const roles: readonly RoleRecord[] = [
    {
      id: "PUB-ROL-access-review-owner",
      title: "Access review owner",
      team: "Information Security",
      functionalOutcome: "Sustained access review cadence",
      requirementRef: "Personnel security Requirement",
      directionRef: "Role-based access Direction",
      actionRef: "Refresh access review evidence",
      contribution: "Keeps review evidence current and makes reviewer backup visible."
    },
    {
      id: "PUB-ROL-monitoring-provider",
      title: "Monitoring service provider",
      team: "External SOC provider",
      functionalOutcome: "Continuous monitoring coverage",
      requirementRef: "Technology monitoring Requirement",
      directionRef: "Incident reporting Direction",
      actionRef: "Confirm escalation path",
      contribution: "Shows where supplier roster coverage contributes to sustainable monitoring."
    }
  ];
  return {
    pubStoreVersion: PUB_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    people,
    roles,
    assignments: [
      {
        id: "PUB-ASM-access-owner-primary",
        personId: people[0]!.id,
        roleId: roles[0]!.id,
        status: "needs-backup",
        allocation: "primary",
        reviewBy: "2026-06-30",
        badge: "backup needed"
      },
      {
        id: "PUB-ASM-provider-monitoring",
        personId: people[1]!.id,
        roleId: roles[1]!.id,
        status: "active",
        allocation: "service window",
        reviewBy: "2026-07-15",
        badge: "service review"
      }
    ],
    relationshipNotes: [
      {
        id: "PUB-REL-provider-review",
        personId: people[1]!.id,
        createdAt: new Date().toISOString(),
        summary: "Confirm provider roster aligns to incident escalation expectations before the next service review.",
        nextContactAt: "2026-07-01"
      }
    ]
  };
}

function renderHomeHtml(store: PubStore): string {
  const axes = `Schema ${VERSION_AXES.schemaVersion} - Bundle ${VERSION_AXES.bundleVersion} - API ${VERSION_AXES.apiVersion}`;
  const upcomingBadges = deriveUpcomingBadges(store);
  return pageHtml(
    "PSPF Pub",
    `<main>
    <section class="hero">
      <p class="meta">PSPF Pub v${escapeHtml(PSPF_SLICE_VERSION)} - ${escapeHtml(axes)}</p>
      <h1>People, roles, teams, assignments, and stakeholder relationships</h1>
      <p>Pub is the local-only people context surface for understanding who has a stake in protecting information, where responsibility needs attention, how the organisation chart supports assurance work, and which relationship log entries need follow-up.</p>
      <div class="tags">
        <span class="tag">${store.people.length} people</span>
        <span class="tag">${store.roles.length} roles</span>
        <span class="tag">${store.assignments.length} assignments</span>
        <span class="tag">no Explorer publication in v1.28</span>
      </div>
    </section>
    <section class="grid two" aria-label="Pub action signals">
      ${summaryCard("Upcoming badges", upcomingBadges.length === 0 ? "Load sample data or add assignments to see action, review, rotation, and anniversary signals." : upcomingBadges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(""))}
      ${summaryCard("Local-only boundary", "Person display names, relationship notes, development context, performance context, and assignment-to-person mappings stay in .pspf/pub/pub.json and are not added to Explorer bundles.")}
    </section>
    <section class="grid" aria-label="Pub foundation areas">
      ${foundationCard("Organisation chart", "Role, team, milestone, anniversary, and action badges for upcoming work and sustainability signals.")}
      ${foundationCard("Relationship context", "Staff, service providers, customers, relationship notes, team events, and stakeholder history kept local by default.")}
      ${foundationCard("Assignments and rotations", "Assignment boards, roster opportunities, staff rotations, and role contribution views for future implementation.")}
    </section>
  </main>`
  );
}

function renderOrgChartHtml(store: PubStore): string {
  const rows = store.roles
    .map((role) => {
      const assignments = store.assignments.filter((assignment) => assignment.roleId === role.id);
      const assignedPeople =
        assignments.map((assignment) => personName(store, assignment.personId)).join(", ") || "No assignment";
      const badges = assignments.map((assignment) => assignment.badge).filter(Boolean);
      return `<tr><td>${escapeHtml(role.team)}</td><td>${escapeHtml(role.title)}</td><td>${escapeHtml(assignedPeople)}</td><td>${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(" ") || "No badge"}</td><td>${escapeHtml(role.functionalOutcome)}</td></tr>`;
    })
    .join("");
  return pageHtml(
    "PSPF Pub Organisation Chart",
    sectionHtml(
      "Organisation chart",
      "Local role/team view with action and sustainability badges. Person names stay local-only.",
      tableHtml(["Team", "Role", "Assigned", "Badges", "Functional outcome"], rows, 5)
    )
  );
}

function renderPeopleHtml(store: PubStore): string {
  const rows = store.people
    .map(
      (person) =>
        `<tr><td>${escapeHtml(person.displayName)}</td><td>${escapeHtml(person.stakeholderType)}</td><td>${escapeHtml(person.organisation)}</td><td>${escapeHtml(person.currentRole)}</td><td>${escapeHtml(person.nextAction || person.nextMilestone)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub People",
    sectionHtml(
      "People directory",
      "Local-only people and stakeholder context. Do not treat these display names as publishable data.",
      tableHtml(["Name", "Type", "Organisation", "Role", "Next signal"], rows, 5)
    )
  );
}

function renderRolesHtml(store: PubStore): string {
  const rows = store.roles
    .map(
      (role) =>
        `<tr><td>${escapeHtml(role.title)}</td><td>${escapeHtml(role.team)}</td><td>${escapeHtml(role.functionalOutcome)}</td><td>${escapeHtml(role.requirementRef)}</td><td>${escapeHtml(role.actionRef)}</td><td>${escapeHtml(role.contribution)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Roles",
    sectionHtml(
      "Role contribution",
      "Role and team contribution context can help show how responsibilities sustain compliance improvements.",
      tableHtml(["Role", "Team", "Outcome", "Requirement", "Action", "Contribution"], rows, 6)
    )
  );
}

function renderAssignmentsHtml(store: PubStore): string {
  const rows = store.assignments
    .map((assignment) => {
      const role = store.roles.find((candidate) => candidate.id === assignment.roleId);
      return `<tr><td>${escapeHtml(personName(store, assignment.personId))}</td><td>${escapeHtml(role?.title ?? "Unknown role")}</td><td>${escapeHtml(assignment.status)}</td><td>${escapeHtml(assignment.allocation)}</td><td>${escapeHtml(assignment.reviewBy)}</td><td>${escapeHtml(assignment.badge)}</td></tr>`;
    })
    .join("");
  return pageHtml(
    "PSPF Pub Assignments",
    sectionHtml(
      "Assignment board",
      "Assignment status highlights backup, rotation, review, and roster opportunities without publishing person identity.",
      tableHtml(["Person", "Role", "Status", "Allocation", "Review by", "Badge"], rows, 6)
    )
  );
}

function renderRelationshipLogHtml(store: PubStore): string {
  const rows = store.relationshipNotes
    .map(
      (note) =>
        `<tr><td>${escapeHtml(personName(store, note.personId))}</td><td>${escapeHtml(formatDate(note.createdAt))}</td><td>${escapeHtml(note.summary)}</td><td>${escapeHtml(note.nextContactAt)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Relationship Log",
    sectionHtml(
      "Relationship log",
      "Mini CRM notes for staff, providers, customers, and other stakeholders. These notes are local-only by default.",
      tableHtml(["Person", "Recorded", "Summary", "Next contact"], rows, 4)
    )
  );
}

function pageHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${tokensCss}
    body { margin: 0; padding: 18px; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    main, .grid { display: grid; gap: 14px; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .hero, .card, section.panel { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 14px; background: var(--vscode-sideBar-background); }
    .hero { border-left: 4px solid #c45a64; background: color-mix(in srgb, var(--vscode-editor-background) 88%, #c45a64 12%); }
    h1, h2, p { margin: 0; }
    h1 { font-size: 1.3rem; line-height: 1.25; }
    h2 { font-size: 0.98rem; margin-bottom: 8px; }
    p { line-height: 1.5; }
    .meta, .tag, .muted { color: var(--vscode-descriptionForeground); font-size: 0.82rem; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .tag, .badge { display: inline-flex; align-items: center; border: 1px solid var(--vscode-panel-border); border-radius: 999px; padding: 4px 8px; white-space: nowrap; }
    .badge { margin: 2px 4px 2px 0; color: var(--vscode-editor-foreground); background: color-mix(in srgb, var(--vscode-editor-background) 78%, #c45a64 22%); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; vertical-align: top; }
    th { color: var(--vscode-descriptionForeground); font-weight: 650; }
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body>${body}</body>
</html>`;
}

function sectionHtml(title: string, description: string, content: string): string {
  return `<section class="panel"><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p>${content}</section>`;
}

function tableHtml(headers: readonly string[], rows: string, emptyColumnCount: number): string {
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rows || `<tr><td colspan="${emptyColumnCount}">No Pub records yet. Use the Pub commands to add local records or load the sample.</td></tr>`}</tbody></table>`;
}

function summaryCard(title: string, body: string): string {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${body}</p></article>`;
}

function foundationCard(title: string, body: string): string {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`;
}

function deriveUpcomingBadges(store: PubStore): readonly string[] {
  const assignmentBadges = store.assignments
    .flatMap((assignment) => [assignment.badge, assignment.reviewBy])
    .filter(Boolean);
  const personSignals = store.people.flatMap((person) => [person.nextMilestone, person.nextAction]).filter(Boolean);
  return [...assignmentBadges, ...personSignals].slice(0, 8);
}

async function promptRequiredText(prompt: string, placeHolder?: string): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({ prompt, placeHolder, ignoreFocusOut: true });
  const trimmed = input?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

async function promptOptionalText(prompt: string, placeHolder?: string): Promise<string> {
  const input = await vscode.window.showInputBox({ prompt, placeHolder, ignoreFocusOut: true });
  return input?.trim() ?? "";
}

async function promptPick<const Value extends string>(
  prompt: string,
  values: readonly Value[],
  defaultValue?: Value
): Promise<Value | undefined> {
  const selected = await vscode.window.showQuickPick(
    values.map((value) => ({ label: value, picked: value === defaultValue })),
    { placeHolder: prompt, ignoreFocusOut: true }
  );
  return selected?.label as Value | undefined;
}

async function pickPerson(store: PubStore, placeHolder: string): Promise<PersonRecord | undefined> {
  const selected = await vscode.window.showQuickPick(
    store.people.map((person) => ({ label: person.displayName, description: person.currentRole, person })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.person;
}

async function pickRole(store: PubStore, placeHolder: string): Promise<RoleRecord | undefined> {
  const selected = await vscode.window.showQuickPick(
    store.roles.map((role) => ({ label: role.title, description: role.team, role })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.role;
}

function personName(store: PubStore, personId: string): string {
  return store.people.find((person) => person.id === personId)?.displayName ?? "Unknown person";
}

function localId(prefix: string): string {
  return `PUB-${prefix}-${randomUUID()}`;
}

function formatDate(value: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-AU");
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
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
