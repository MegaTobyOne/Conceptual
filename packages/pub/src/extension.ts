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
const PUB_WEBVIEW_COMMANDS = new Set<string>([
  "pspf.pub.loadSample",
  "pspf.pub.newPerson",
  "pspf.pub.newTeam",
  "pspf.pub.openTeamDetail",
  "pspf.pub.editTeam",
  "pspf.pub.newRole",
  "pspf.pub.newAssignment",
  "pspf.pub.recordRelationshipNote",
  "pspf.pub.openOrgChart",
  "pspf.pub.openPeople",
  "pspf.pub.openTeams",
  "pspf.pub.openRoles",
  "pspf.pub.openAssignments",
  "pspf.pub.openRelationshipLog"
] as const);

interface PubStore {
  readonly pubStoreVersion: string;
  readonly updatedAt: string;
  readonly people: readonly PersonRecord[];
  readonly teams: readonly TeamRecord[];
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
  readonly teamId: string;
  readonly functionalOutcome: string;
  readonly contribution: string;
}

interface TeamRecord {
  readonly id: string;
  readonly title: string;
  readonly ownedControlRefs: readonly string[];
  readonly controlSetRefs: readonly string[];
  readonly responsibility: string;
  readonly notes: string;
}

interface SourceControlRecord {
  readonly entityType: "source-control";
  readonly id: string;
  readonly title: string;
  readonly controlId: string;
  readonly statement?: string;
  readonly profileTags?: readonly string[];
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

interface PubWebviewMessage {
  readonly command?: string;
  readonly action?: string;
  readonly teamId?: string;
  readonly fields?: TeamEditorFields;
}

interface TeamEditorFields {
  readonly title?: unknown;
  readonly ownedControlRefs?: unknown;
  readonly additionalControlRefs?: unknown;
  readonly controlSetRefs?: unknown;
  readonly responsibility?: unknown;
  readonly notes?: unknown;
}

let homeViewProvider: PubHomeViewProvider | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let teamEditorPanel: vscode.WebviewPanel | undefined;

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
    vscode.commands.registerCommand("pspf.pub.newTeam", newTeam),
    vscode.commands.registerCommand("pspf.pub.openTeamDetail", openTeamDetail),
    vscode.commands.registerCommand("pspf.pub.editTeam", editTeam),
    vscode.commands.registerCommand("pspf.pub.newRole", newRole),
    vscode.commands.registerCommand("pspf.pub.newAssignment", newAssignment),
    vscode.commands.registerCommand("pspf.pub.recordRelationshipNote", recordRelationshipNote),
    vscode.commands.registerCommand("pspf.pub.openOrgChart", () =>
      openPubPanel("Organisation chart", renderOrgChartHtml)
    ),
    vscode.commands.registerCommand("pspf.pub.openPeople", () => openPubPanel("People", renderPeopleHtml)),
    vscode.commands.registerCommand("pspf.pub.openTeams", () => openPubPanel("Teams", renderTeamsHtml)),
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
  teamEditorPanel = undefined;
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
  const store = await loadStore();
  if (store.teams.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub team before creating a role.");
    return;
  }
  const title = await promptRequiredText("Role title");
  if (!title) {
    return;
  }
  const team = await pickTeam(store, "Owning team");
  if (!team) {
    return;
  }
  const functionalOutcome = await promptOptionalText("Functional outcome", "Example: Access review sustainability");
  const contribution = await promptOptionalText(
    "Compliance contribution",
    "How this role helps the team sustain owned controls"
  );

  const role: RoleRecord = {
    id: localId("ROL"),
    title,
    teamId: team.id,
    functionalOutcome,
    contribution
  };
  await saveStore({ ...store, roles: [...store.roles, role] });
  await refreshHome();
  vscode.window.showInformationMessage(`Added Pub role ${title}.`);
}

async function newTeam(): Promise<void> {
  await openTeamEditor();
}

async function openTeamDetail(): Promise<void> {
  const store = await loadStore();
  const team = await pickTeam(store, "Open team detail");
  if (!team) {
    return;
  }
  await openPubPanel(`Team: ${team.title}`, (currentStore) => renderTeamDetailHtml(currentStore, team.id));
}

async function editTeam(): Promise<void> {
  const store = await loadStore();
  const team = await pickTeam(store, "Edit team");
  if (!team) {
    return;
  }
  await openTeamEditor(team);
}

async function openTeamEditor(team?: TeamRecord): Promise<void> {
  const sourceControls = await listSourceControls();
  const title = team ? `Edit Pub Team: ${team.title}` : "New Pub Team";
  if (teamEditorPanel) {
    teamEditorPanel.title = title;
    teamEditorPanel.reveal(vscode.ViewColumn.One);
  } else {
    teamEditorPanel = vscode.window.createWebviewPanel("pspfPubTeamEditor", title, vscode.ViewColumn.One, {
      enableScripts: true
    });
    teamEditorPanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handleTeamEditorMessage(message);
    });
    teamEditorPanel.onDidDispose(() => {
      teamEditorPanel = undefined;
    });
  }
  teamEditorPanel.webview.html = renderTeamEditorHtml(team, sourceControls);
}

async function handleTeamEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelTeam") {
    teamEditorPanel?.dispose();
    return;
  }
  if (message.action !== "saveTeam" && message.action !== "saveAndCloseTeam") {
    return;
  }

  const team = parseTeamEditorFields(message.fields, message.teamId);
  if (!team) {
    vscode.window.showWarningMessage("Team title is required before saving.");
    return;
  }

  const store = await loadStore();
  const existing = store.teams.some((candidate) => candidate.id === team.id);
  await saveStore({
    ...store,
    teams: existing
      ? store.teams.map((candidate) => (candidate.id === team.id ? team : candidate))
      : [...store.teams, team]
  });
  await refreshHome();

  if (message.action === "saveAndCloseTeam") {
    teamEditorPanel?.dispose();
    await openPubPanel(`Team: ${team.title}`, (currentStore) => renderTeamDetailHtml(currentStore, team.id));
  } else {
    await openTeamEditor(team);
  }
  vscode.window.showInformationMessage(`Saved Pub team ${team.title}.`);
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
      enableScripts: true
    });
    activePanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handlePubWebviewCommand(message.command);
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
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handlePubWebviewCommand(message.command);
    });
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

async function handlePubWebviewCommand(command: string | undefined): Promise<void> {
  if (!command || !PUB_WEBVIEW_COMMANDS.has(command)) {
    return;
  }
  await vscode.commands.executeCommand(command);
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
    teams: [],
    roles: [],
    assignments: [],
    relationshipNotes: []
  };
}

function normaliseStore(store: Partial<PubStore>): PubStore {
  const teams = normaliseTeams(store);
  return {
    pubStoreVersion: typeof store.pubStoreVersion === "string" ? store.pubStoreVersion : PUB_STORE_VERSION,
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : new Date().toISOString(),
    people: Array.isArray(store.people) ? store.people : [],
    teams,
    roles: normaliseRoles(store, teams),
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
      teamId: "PUB-TEM-information-security",
      functionalOutcome: "Sustained access review cadence",
      contribution: "Keeps review evidence current and makes reviewer backup visible."
    },
    {
      id: "PUB-ROL-monitoring-provider",
      title: "Monitoring service provider",
      teamId: "PUB-TEM-external-soc-provider",
      functionalOutcome: "Continuous monitoring coverage",
      contribution: "Shows where supplier roster coverage contributes to sustainable monitoring."
    }
  ];
  const teams: readonly TeamRecord[] = [
    {
      id: "PUB-TEM-information-security",
      title: "Information Security",
      ownedControlRefs: ["ISM-1401", "ISM-1402"],
      controlSetRefs: ["Access control operations"],
      responsibility: "Owns access review control operation and reviewer backup coverage.",
      notes: "Team ownership is local-only until a future Pub publication ADR defines redaction and review gates."
    },
    {
      id: "PUB-TEM-external-soc-provider",
      title: "External SOC provider",
      ownedControlRefs: ["ISM-0988"],
      controlSetRefs: ["Monitoring and escalation"],
      responsibility: "Operates monitoring controls and escalation roster coverage.",
      notes: "Service-provider responsibility context stays local-only by default."
    }
  ];
  return {
    pubStoreVersion: PUB_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    people,
    teams,
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
        <span class="tag">${store.teams.length} teams</span>
        <span class="tag">${store.roles.length} roles</span>
        <span class="tag">${store.assignments.length} assignments</span>
        <span class="tag">no Explorer publication in v1.28</span>
      </div>
    </section>
    <section class="grid two" aria-label="Pub action signals">
      ${summaryCard("Upcoming badges", upcomingBadges.length === 0 ? "Load sample data or add assignments to see action, review, rotation, and anniversary signals." : upcomingBadges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(""))}
      ${summaryCard("Local-only boundary", "Person display names, relationship notes, development context, performance context, and assignment-to-person mappings stay in .pspf/pub/pub.json and are not added to Explorer bundles.")}
    </section>
    <section class="panel" aria-label="Pub primary actions">
      <h1>Core Pub actions</h1>
      <div class="action-list">
        ${commandButton("pspf.pub.openTeams", "Teams", "Review local team control ownership")}
        ${commandButton("pspf.pub.openTeamDetail", "Team detail", "Open one team with roles, assignments, gaps, and notes")}
        ${commandButton("pspf.pub.editTeam", "Edit team", "Update local team ownership and responsibility")}
        ${commandButton("pspf.pub.openOrgChart", "Organisation chart", "See teams, roles, owned controls, and assignment badges")}
        ${commandButton("pspf.pub.openAssignments", "Assignments", "Review people-to-role coverage")}
        ${commandButton("pspf.pub.openRelationshipLog", "Relationship log", "Review stakeholder follow-up notes")}
      </div>
    </section>
    <section class="panel" aria-label="Pub creation actions">
      <h1>Create local records</h1>
      <div class="action-list compact">
        ${commandButton("pspf.pub.newTeam", "New team", "Add local team-owned controls")}
        ${commandButton("pspf.pub.newRole", "New role", "Attach a role to a team")}
        ${commandButton("pspf.pub.newPerson", "New person", "Add local-only person context")}
        ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign a person to a role")}
        ${commandButton("pspf.pub.recordRelationshipNote", "Relationship note", "Record a local follow-up")}
        ${commandButton("pspf.pub.loadSample", "Load sample", "Replace current Pub data with sample records")}
      </div>
    </section>
    <section class="grid" aria-label="Pub foundation areas">
      ${foundationCard("Organisation chart", "Role, team, milestone, anniversary, and action badges for upcoming work and sustainability signals.")}
      ${foundationCard("Team control ownership", "Teams own controls and control sets; roles and assignments explain who helps sustain that ownership.")}
      ${foundationCard("Relationship context", "Staff, service providers, customers, relationship notes, team events, and stakeholder history kept local by default.")}
      ${foundationCard("Assignments and rotations", "Assignment boards, roster opportunities, staff rotations, and role contribution views for future implementation.")}
    </section>
  </main>`
  );
}

function renderOrgChartHtml(store: PubStore): string {
  const rows = store.roles
    .map((role) => {
      const team = teamForRole(store, role);
      const assignments = store.assignments.filter((assignment) => assignment.roleId === role.id);
      const assignedPeople =
        assignments.map((assignment) => personName(store, assignment.personId)).join(", ") || "No assignment";
      const badges = assignments.map((assignment) => assignment.badge).filter(Boolean);
      return `<tr><td>${escapeHtml(team?.title ?? "Unknown team")}</td><td>${escapeHtml(controlSummary(team))}</td><td>${escapeHtml(role.title)}</td><td>${escapeHtml(assignedPeople)}</td><td>${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(" ") || "No badge"}</td><td>${escapeHtml(role.functionalOutcome)}</td></tr>`;
    })
    .join("");
  return pageHtml(
    "PSPF Pub Organisation Chart",
    sectionHtml(
      "Organisation chart",
      "Local team-control ownership view with role, assignment, action, and sustainability badges. Person names stay local-only.",
      tableHtml(["Team", "Owned controls", "Role", "Assigned", "Badges", "Functional outcome"], rows, 6)
    )
  );
}

function renderTeamsHtml(store: PubStore): string {
  const rows = store.teams
    .map(
      (team) =>
        `<tr><td>${escapeHtml(team.title)}</td><td>${escapeHtml(team.ownedControlRefs.join(", "))}</td><td>${escapeHtml(team.controlSetRefs.join(", "))}</td><td>${escapeHtml(team.responsibility)}</td><td>${teamHealthBadges(store, team)}</td><td>${escapeHtml(team.notes)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Teams",
    sectionHtml(
      "Team control ownership",
      "Teams own controls or control sets. Roles and assignments describe how people sustain that ownership locally.",
      tableHtml(["Team", "Owned controls", "Control sets", "Responsibility", "Gaps", "Notes"], rows, 6)
    )
  );
}

function renderTeamDetailHtml(store: PubStore, teamId: string): string {
  const team = store.teams.find((candidate) => candidate.id === teamId);
  if (!team) {
    return pageHtml(
      "PSPF Pub Team",
      sectionHtml("Team not found", "This team exists only in Pub local storage and could not be resolved.", "")
    );
  }
  const teamRoles = store.roles.filter((role) => role.teamId === team.id);
  const teamAssignments = store.assignments.filter((assignment) =>
    teamRoles.some((role) => role.id === assignment.roleId)
  );
  const roleRows = teamRoles
    .map((role) => {
      const assignments = teamAssignments.filter((assignment) => assignment.roleId === role.id);
      const assignedPeople = assignments.map((assignment) => personName(store, assignment.personId)).join(", ");
      const badges = assignments.map((assignment) => assignment.badge).filter(Boolean);
      return `<tr><td>${escapeHtml(role.title)}</td><td>${escapeHtml(role.functionalOutcome)}</td><td>${escapeHtml(assignedPeople || "No assignment")}</td><td>${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join(" ") || "No badge"}</td><td>${escapeHtml(role.contribution)}</td></tr>`;
    })
    .join("");
  return pageHtml(
    `PSPF Pub ${team.title}`,
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only team detail</p>
        <h1>${escapeHtml(team.title)}</h1>
        <p>${escapeHtml(team.responsibility || "No responsibility recorded yet.")}</p>
        <div class="tags">
          ${team.ownedControlRefs.map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`).join("")}
          ${team.controlSetRefs.map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`).join("")}
        </div>
      </section>
      <section class="grid two" aria-label="Team health">
        ${summaryCard("Coverage", teamHealthBadges(store, team))}
        ${summaryCard("Local-only notes", escapeHtml(team.notes || "No local team notes recorded."))}
      </section>
      <section class="panel" aria-label="Team actions">
        <h1>Team actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editTeam", "Edit team", "Update local control ownership")}
          ${commandButton("pspf.pub.newRole", "New role", "Add role coverage for a team")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign a person to a role")}
          ${commandButton("pspf.pub.recordRelationshipNote", "Relationship note", "Record local follow-up context")}
        </div>
      </section>
      ${sectionHtml(
        "Roles and assignments",
        "Roles and person assignments stay in Pub local storage and explain how this team sustains its owned controls.",
        tableHtml(["Role", "Outcome", "Assigned", "Badges", "Contribution"], roleRows, 5)
      )}
    </main>`
  );
}

function renderTeamEditorHtml(team: TeamRecord | undefined, sourceControls: readonly SourceControlRecord[]): string {
  const selectedControlRefs = new Set(team?.ownedControlRefs ?? []);
  const knownControlIds = new Set(sourceControls.map((sourceControl) => sourceControl.controlId));
  const localControlRefs = (team?.ownedControlRefs ?? []).filter((ref) => !knownControlIds.has(ref));
  return pageHtml(
    team ? `Edit Pub Team ${team.title}` : "New Pub Team",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only CRUD pilot</p>
        <h1>${team ? `Edit ${escapeHtml(team.title)}` : "New team"}</h1>
        <p>Team detail stays in Pub local storage. Save writes to .pspf/pub/pub.json only.</p>
      </section>
      <form class="editor-form" data-team-id="${escapeHtml(team?.id ?? "")}">
        <section class="panel">
          <h1>Team details</h1>
          <label>
            <span>Team title</span>
            <input name="title" value="${escapeHtml(team?.title ?? "")}" required autofocus tabindex="1" />
          </label>
          <label>
            <span>Control ownership responsibility</span>
            <textarea name="responsibility" tabindex="2" rows="4">${escapeHtml(team?.responsibility ?? "")}</textarea>
          </label>
          <label>
            <span>Owned control sets</span>
            <textarea name="controlSetRefs" tabindex="3" rows="3" placeholder="E8 ML2, Access control operations">${escapeHtml((team?.controlSetRefs ?? []).join(", "))}</textarea>
          </label>
        </section>
        <section class="panel">
          <h1>Owned ISM controls</h1>
          <div class="checkbox-list">
            ${sourceControls.length === 0 ? `<p class="muted">No ISM source controls are available from Core yet. Add local refs below.</p>` : sourceControls.map((sourceControl, index) => controlCheckbox(sourceControl, selectedControlRefs, index + 4)).join("")}
          </div>
          <label>
            <span>Additional local control refs</span>
            <textarea name="additionalControlRefs" tabindex="${sourceControls.length + 4}" rows="3" placeholder="Comma-separated refs not in the ISM list">${escapeHtml(localControlRefs.join(", "))}</textarea>
          </label>
        </section>
        <section class="panel">
          <h1>Local-only notes</h1>
          <label>
            <span>Notes</span>
            <textarea name="notes" tabindex="${sourceControls.length + 5}" rows="5">${escapeHtml(team?.notes ?? "")}</textarea>
          </label>
          <div class="form-actions">
            <button type="button" data-action="saveTeam" tabindex="${sourceControls.length + 6}"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndCloseTeam" tabindex="${sourceControls.length + 7}"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Team detail</span></button>
            <button type="button" data-action="cancelTeam" tabindex="${sourceControls.length + 8}"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function controlCheckbox(
  sourceControl: SourceControlRecord,
  selectedControlRefs: ReadonlySet<string>,
  tabIndex: number
): string {
  const checked = selectedControlRefs.has(sourceControl.controlId) ? " checked" : "";
  return `<label class="checkbox-row"><input type="checkbox" name="ownedControlRefs" value="${escapeHtml(sourceControl.controlId)}" tabindex="${tabIndex}"${checked} /><span><strong>${escapeHtml(sourceControl.controlId)}</strong> ${escapeHtml(sourceControl.title)}</span></label>`;
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
        `<tr><td>${escapeHtml(role.title)}</td><td>${escapeHtml(teamForRole(store, role)?.title ?? "Unknown team")}</td><td>${escapeHtml(controlSummary(teamForRole(store, role)))}</td><td>${escapeHtml(role.functionalOutcome)}</td><td>${escapeHtml(role.contribution)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Roles",
    sectionHtml(
      "Role contribution",
      "Role contribution context shows how people help teams sustain owned controls and control sets.",
      tableHtml(["Role", "Team", "Owned controls", "Outcome", "Contribution"], rows, 5)
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
    .action-list { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .action-list.compact { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    button { width: 100%; min-width: 0; border: 1px solid var(--vscode-button-border, transparent); border-radius: 6px; padding: 8px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; text-align: left; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .button-title { display: block; overflow-wrap: anywhere; font-weight: 600; }
    .button-description { display: block; margin-top: 2px; color: var(--vscode-button-secondaryForeground, var(--vscode-descriptionForeground)); font-size: 0.78rem; line-height: 1.35; font-weight: 400; }
    .form-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
    .editor-form { display: grid; gap: 14px; }
    label { display: grid; gap: 5px; margin-top: 10px; font-size: 0.86rem; }
    input, textarea { box-sizing: border-box; width: 100%; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 6px; padding: 8px 10px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); font: inherit; }
    textarea { resize: vertical; line-height: 1.45; }
    input:focus-visible, textarea:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .checkbox-list { display: grid; gap: 6px; max-height: 18rem; overflow: auto; padding-right: 4px; }
    .checkbox-row { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; margin-top: 0; padding: 6px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); }
    .checkbox-row input { width: auto; margin-top: 2px; }
    .checkbox-row span { overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; vertical-align: top; }
    th { color: var(--vscode-descriptionForeground); font-weight: 650; }
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body>${body}<script>
  const vscode = acquireVsCodeApi();
  document.querySelectorAll("button[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      button.setAttribute("aria-busy", "true");
      vscode.postMessage({ command: button.dataset.command });
      setTimeout(() => button.removeAttribute("aria-busy"), 800);
    });
  });
  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      button.setAttribute("aria-busy", "true");
      if (!form) {
        vscode.postMessage({ action: button.dataset.action });
        return;
      }
      const data = new FormData(form);
      vscode.postMessage({
        action: button.dataset.action,
        teamId: form.dataset.teamId,
        fields: {
          title: data.get("title"),
          ownedControlRefs: data.getAll("ownedControlRefs"),
          additionalControlRefs: data.get("additionalControlRefs"),
          controlSetRefs: data.get("controlSetRefs"),
          responsibility: data.get("responsibility"),
          notes: data.get("notes")
        }
      });
      setTimeout(() => button.removeAttribute("aria-busy"), 800);
    });
  });
</script></body>
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

function commandButton(command: string, text: string, description?: string): string {
  const descriptionHtml = description ? `<span class="button-description">${escapeHtml(description)}</span>` : "";
  return `<button type="button" data-command="${escapeHtml(command)}"><span class="button-title">${escapeHtml(text)}</span>${descriptionHtml}</button>`;
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
    store.roles.map((role) => ({ label: role.title, description: teamForRole(store, role)?.title, role })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.role;
}

async function pickTeam(store: PubStore, placeHolder: string): Promise<TeamRecord | undefined> {
  const selected = await vscode.window.showQuickPick(
    store.teams.map((team) => ({ label: team.title, description: controlSummary(team), team })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.team;
}

function parseTeamEditorFields(
  fields: TeamEditorFields | undefined,
  teamId: string | undefined
): TeamRecord | undefined {
  const title = stringField(fields?.title).trim();
  if (!title) {
    return undefined;
  }
  return {
    id: teamId && teamId.trim().length > 0 ? teamId : localId("TEM"),
    title,
    ownedControlRefs: uniqueStrings([
      ...stringArrayField(fields?.ownedControlRefs),
      ...splitRefs(stringField(fields?.additionalControlRefs))
    ]),
    controlSetRefs: splitRefs(stringField(fields?.controlSetRefs)),
    responsibility: stringField(fields?.responsibility).trim(),
    notes: stringField(fields?.notes).trim()
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArrayField(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function listSourceControls(): Promise<readonly SourceControlRecord[]> {
  try {
    const entities = await vscode.commands.executeCommand<readonly unknown[]>(
      "pspf.core.listEntities",
      "source-control"
    );
    return (entities ?? []).filter(isSourceControlRecord);
  } catch {
    return [];
  }
}

function isSourceControlRecord(value: unknown): value is SourceControlRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SourceControlRecord>;
  return (
    candidate.entityType === "source-control" &&
    typeof candidate.id === "string" &&
    typeof candidate.controlId === "string" &&
    typeof candidate.title === "string"
  );
}

function normaliseTeams(store: Partial<PubStore>): readonly TeamRecord[] {
  if (Array.isArray(store.teams)) {
    return store.teams;
  }
  const legacyRoles = Array.isArray(store.roles)
    ? (store.roles as readonly (Partial<RoleRecord> & { team?: string })[])
    : [];
  const legacyTeamNames = [...new Set(legacyRoles.map((role) => role.team).filter(isNonEmptyString))];
  return legacyTeamNames.map((teamName) => ({
    id: localId("TEM"),
    title: teamName,
    ownedControlRefs: [],
    controlSetRefs: [],
    responsibility: "",
    notes: "Migrated from the previous role-level team field."
  }));
}

function normaliseRoles(store: Partial<PubStore>, teams: readonly TeamRecord[]): readonly RoleRecord[] {
  if (!Array.isArray(store.roles)) {
    return [];
  }
  return (store.roles as readonly (Partial<RoleRecord> & { team?: string })[]).map((role) => ({
    id: typeof role.id === "string" ? role.id : localId("ROL"),
    title: typeof role.title === "string" ? role.title : "Untitled role",
    teamId:
      typeof role.teamId === "string"
        ? role.teamId
        : (teams.find((team) => team.title === role.team)?.id ?? teams[0]?.id ?? ""),
    functionalOutcome: typeof role.functionalOutcome === "string" ? role.functionalOutcome : "",
    contribution: typeof role.contribution === "string" ? role.contribution : ""
  }));
}

function teamForRole(store: PubStore, role: RoleRecord): TeamRecord | undefined {
  return store.teams.find((team) => team.id === role.teamId);
}

function controlSummary(team: TeamRecord | undefined): string {
  if (!team) {
    return "No team";
  }
  const refs = [...team.ownedControlRefs, ...team.controlSetRefs];
  return refs.length === 0 ? "No controls recorded" : refs.join(", ");
}

function teamHealthBadges(store: PubStore, team: TeamRecord): string {
  const roles = store.roles.filter((role) => role.teamId === team.id);
  const assignments = store.assignments.filter((assignment) => roles.some((role) => role.id === assignment.roleId));
  const gaps = [
    team.ownedControlRefs.length === 0 && team.controlSetRefs.length === 0 ? "no controls" : "",
    roles.length === 0 ? "no roles" : "",
    roles.some((role) => !assignments.some((assignment) => assignment.roleId === role.id)) ? "unassigned role" : "",
    assignments.some((assignment) => assignment.status === "needs-backup") ? "backup needed" : ""
  ].filter(isNonEmptyString);
  return gaps.length === 0
    ? '<span class="badge">covered</span>'
    : gaps.map((gap) => `<span class="badge">${escapeHtml(gap)}</span>`).join("");
}

function splitRefs(value: string): readonly string[] {
  return value
    .split(",")
    .map((ref) => ref.trim())
    .filter(isNonEmptyString);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(isNonEmptyString))];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
