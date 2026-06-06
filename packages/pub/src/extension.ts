import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "@pspf/contracts";
import {
  commandButtonAcknowledgementScript,
  homeActionButton,
  homePanelShellHtml,
  homePostureHeader,
  homeSection,
  tokensCss
} from "@pspf/webview-shell";

const PUB_STORE_VERSION = "1.1.0";
const PUB_STORE_PATH = [".pspf", "pub", "pub.json"] as const;
const STAKEHOLDER_TYPES = ["staff", "service-provider", "customer", "partner", "other"] as const;
const ASSIGNMENT_STATUSES = ["active", "planned", "rotating", "needs-backup"] as const;
const ROLE_STATUSES = ["active", "archived"] as const;
const PERSON_LIFECYCLE_STEPS = ["acceptable-use", "orientation", "probation", "separation"] as const;
const PERFORMANCE_CYCLE_STATUSES = ["planned", "in-progress", "completed", "at-risk"] as const;
const PUB_WEBVIEW_COMMANDS = new Set<string>([
  "pspf.pub.loadSample",
  "pspf.pub.newPerson",
  "pspf.pub.openPersonDetail",
  "pspf.pub.editPerson",
  "pspf.pub.newTeam",
  "pspf.pub.openTeamDetail",
  "pspf.pub.editTeam",
  "pspf.pub.exportTeamScopeBrief",
  "pspf.pub.newRole",
  "pspf.pub.openRoleDetail",
  "pspf.pub.editRole",
  "pspf.pub.archiveRole",
  "pspf.pub.newAssignment",
  "pspf.pub.openAssignmentDetail",
  "pspf.pub.editAssignment",
  "pspf.pub.recordRelationshipNote",
  "pspf.pub.openRelationshipNoteDetail",
  "pspf.pub.editRelationshipNote",
  "pspf.pub.openOrgChart",
  "pspf.pub.openPeople",
  "pspf.pub.openTeams",
  "pspf.pub.openRoles",
  "pspf.pub.openAssignments",
  "pspf.pub.openRelationshipLog",
  "pspf.pub.openPeopleCulture"
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
type PersonLifecycleStepId = (typeof PERSON_LIFECYCLE_STEPS)[number];
type PerformanceCycleStatus = (typeof PERFORMANCE_CYCLE_STATUSES)[number];

interface PersonLifecycleRecord {
  readonly stepId: PersonLifecycleStepId;
  readonly completed: boolean;
  readonly completedAt: string;
  readonly notes: string;
}

interface PerformanceCycleRecord {
  readonly id: string;
  readonly year: string;
  readonly status: PerformanceCycleStatus;
  readonly mandatoryBehaviours: string;
  readonly roleSpecificCapabilities: string;
  readonly personalGoals: string;
  readonly targets: string;
  readonly courses: string;
  readonly certifications: string;
  readonly reviewBy: string;
}

interface PersonRecord {
  readonly id: string;
  readonly displayName: string;
  readonly stakeholderType: StakeholderType;
  readonly organisation: string;
  readonly currentRole: string;
  readonly resumeUrl: string;
  readonly resumeText: string;
  readonly nextMilestone: string;
  readonly nextAction: string;
  readonly lifecycle: readonly PersonLifecycleRecord[];
  readonly performanceCycles: readonly PerformanceCycleRecord[];
  readonly notes: string;
}

interface RoleRecord {
  readonly id: string;
  readonly title: string;
  readonly teamId: string;
  readonly status: RoleStatus;
  readonly reportsToRoleId: string;
  readonly functionalOutcome: string;
  readonly contribution: string;
  readonly positionDescriptionUrl: string;
  readonly positionDescriptionText: string;
}

type RoleStatus = (typeof ROLE_STATUSES)[number];

interface TeamRecord {
  readonly id: string;
  readonly title: string;
  readonly parentTeamId: string;
  readonly ownedControlRefs: readonly string[];
  readonly ownedRequirementRefs: readonly string[];
  readonly controlSetRefs: readonly string[];
  readonly teamItems: readonly TeamItemRecord[];
  readonly responsibility: string;
  readonly notes: string;
}

interface TeamItemRecord {
  readonly id: string;
  readonly title: string;
  readonly itemType: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly includeInPlan: boolean;
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

interface RequirementRecord {
  readonly entityType: "requirement";
  readonly id: string;
  readonly title: string;
  readonly assessmentStatus?: string;
  readonly domainId?: string;
}

interface RequirementControlMappingRecord {
  readonly entityType: "requirement-control-mapping";
  readonly id: string;
  readonly requirementId: string;
  readonly sourceControlId: string;
  readonly coverageQualifier?: string;
  readonly applicabilityProfile?: string;
  readonly confidence?: string;
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
  readonly personId?: string;
  readonly roleId?: string;
  readonly assignmentId?: string;
  readonly relationshipNoteId?: string;
  readonly fields?: PubEditorFields;
}

type PubEditorFields = TeamEditorFields &
  PersonEditorFields &
  RoleEditorFields &
  AssignmentEditorFields &
  RelationshipNoteEditorFields;

interface TeamEditorFields {
  readonly [key: string]: unknown;
  readonly title?: unknown;
  readonly parentTeamId?: unknown;
  readonly ownedControlRefs?: unknown;
  readonly additionalControlRefs?: unknown;
  readonly ownedRequirementRefs?: unknown;
  readonly additionalRequirementRefs?: unknown;
  readonly controlSetRefs?: unknown;
  readonly responsibility?: unknown;
  readonly teamItems?: unknown;
  readonly notes?: unknown;
}

interface PersonEditorFields {
  readonly [key: string]: unknown;
  readonly displayName?: unknown;
  readonly stakeholderType?: unknown;
  readonly organisation?: unknown;
  readonly currentRole?: unknown;
  readonly resumeUrl?: unknown;
  readonly resumeText?: unknown;
  readonly nextMilestone?: unknown;
  readonly nextAction?: unknown;
  readonly notes?: unknown;
}

interface RoleEditorFields {
  readonly title?: unknown;
  readonly teamId?: unknown;
  readonly status?: unknown;
  readonly reportsToRoleId?: unknown;
  readonly functionalOutcome?: unknown;
  readonly contribution?: unknown;
  readonly positionDescriptionUrl?: unknown;
  readonly positionDescriptionText?: unknown;
}

interface AssignmentEditorFields {
  readonly personId?: unknown;
  readonly roleId?: unknown;
  readonly status?: unknown;
  readonly allocation?: unknown;
  readonly reviewBy?: unknown;
  readonly badge?: unknown;
}

interface RelationshipNoteEditorFields {
  readonly personId?: unknown;
  readonly createdAt?: unknown;
  readonly summary?: unknown;
  readonly nextContactAt?: unknown;
}

let homeViewProvider: PubHomeViewProvider | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let teamEditorPanel: vscode.WebviewPanel | undefined;
let personEditorPanel: vscode.WebviewPanel | undefined;
let roleEditorPanel: vscode.WebviewPanel | undefined;
let assignmentEditorPanel: vscode.WebviewPanel | undefined;
let relationshipNoteEditorPanel: vscode.WebviewPanel | undefined;

function formatPubToken(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

class PubMessageTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, iconId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

class PubRecordTreeItem<T> extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    iconId: string,
    openCommand: string,
    record: T,
    contextValue: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconId);
    this.command = { command: openCommand, title: "Open detail", arguments: [record] };
    this.contextValue = contextValue;
  }
}

abstract class PubTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changedEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.changedEmitter.event;

  refresh(): void {
    this.changedEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  abstract getChildren(): Promise<vscode.TreeItem[]>;
}

class PeopleTreeProvider extends PubTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const store = await loadStore();
    if (store.people.length === 0) {
      return [new PubMessageTreeItem("No people yet", "Use New Person or Load Sample", "info")];
    }
    return store.people.map((person) => {
      const detail = [formatPubToken(person.stakeholderType), person.currentRole || person.organisation]
        .filter(Boolean)
        .join(" · ");
      return new PubRecordTreeItem(
        person.displayName,
        detail,
        "account",
        "pspf.pub.openPersonDetail",
        person,
        "pspfPubPerson"
      );
    });
  }
}

class TeamsTreeProvider extends PubTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const store = await loadStore();
    if (store.teams.length === 0) {
      return [new PubMessageTreeItem("No teams yet", "Use New Team or Load Sample", "info")];
    }
    return store.teams.map((team) => {
      const roleCount = activeRolesForTeam(store, team.id).length;
      const detail = roleCount === 1 ? "1 role" : `${roleCount} roles`;
      return new PubRecordTreeItem(team.title, detail, "organization", "pspf.pub.openTeamDetail", team, "pspfPubTeam");
    });
  }
}

class RolesTreeProvider extends PubTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const store = await loadStore();
    if (store.roles.length === 0) {
      return [new PubMessageTreeItem("No roles yet", "Use New Role or Load Sample", "info")];
    }
    return store.roles.map((role) => {
      const team = store.teams.find((candidate) => candidate.id === role.teamId);
      return new PubRecordTreeItem(
        role.title,
        team?.title ?? "Unassigned team",
        "person",
        "pspf.pub.openRoleDetail",
        role,
        "pspfPubRole"
      );
    });
  }
}

class AssignmentsTreeProvider extends PubTreeProvider {
  async getChildren(): Promise<vscode.TreeItem[]> {
    const store = await loadStore();
    if (store.assignments.length === 0) {
      return [new PubMessageTreeItem("No assignments yet", "Use New Assignment or Load Sample", "info")];
    }
    return store.assignments.map((assignment) => {
      const person = store.people.find((candidate) => candidate.id === assignment.personId);
      const role = store.roles.find((candidate) => candidate.id === assignment.roleId);
      const label = `${person?.displayName ?? "Unknown person"} → ${role?.title ?? "Unknown role"}`;
      return new PubRecordTreeItem(
        label,
        formatPubToken(assignment.status),
        "key",
        "pspf.pub.openAssignmentDetail",
        assignment,
        "pspfPubAssignment"
      );
    });
  }
}

const pubTreeProviders: PubTreeProvider[] = [];

export function activate(context: vscode.ExtensionContext): void {
  homeViewProvider = new PubHomeViewProvider();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 70);
  statusItem.text = `$(organization) PSPF Pub v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = `PSPF Pub ${PSPF_SLICE_VERSION}\nSchema ${VERSION_AXES.schemaVersion} - Bundle ${VERSION_AXES.bundleVersion} - API ${VERSION_AXES.apiVersion}`;
  statusItem.command = "pspf.pub.openHome";
  statusItem.show();

  const peopleTree = new PeopleTreeProvider();
  const teamsTree = new TeamsTreeProvider();
  const rolesTree = new RolesTreeProvider();
  const assignmentsTree = new AssignmentsTreeProvider();
  pubTreeProviders.length = 0;
  pubTreeProviders.push(peopleTree, teamsTree, rolesTree, assignmentsTree);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("pspfPub.homeView", homeViewProvider),
    statusItem,
    vscode.window.registerTreeDataProvider("pspfPub.peopleView", peopleTree),
    vscode.window.registerTreeDataProvider("pspfPub.teamsView", teamsTree),
    vscode.window.registerTreeDataProvider("pspfPub.rolesView", rolesTree),
    vscode.window.registerTreeDataProvider("pspfPub.assignmentsView", assignmentsTree),
    vscode.commands.registerCommand("pspf.pub.openHome", openHome),
    vscode.commands.registerCommand("pspf.pub.loadSample", loadSample),
    vscode.commands.registerCommand("pspf.pub.newPerson", newPerson),
    vscode.commands.registerCommand("pspf.pub.openPersonDetail", openPersonDetail),
    vscode.commands.registerCommand("pspf.pub.editPerson", editPerson),
    vscode.commands.registerCommand("pspf.pub.newTeam", newTeam),
    vscode.commands.registerCommand("pspf.pub.openTeamDetail", openTeamDetail),
    vscode.commands.registerCommand("pspf.pub.editTeam", editTeam),
    vscode.commands.registerCommand("pspf.pub.exportTeamScopeBrief", exportTeamScopeBrief),
    vscode.commands.registerCommand("pspf.pub.newRole", newRole),
    vscode.commands.registerCommand("pspf.pub.openRoleDetail", openRoleDetail),
    vscode.commands.registerCommand("pspf.pub.editRole", editRole),
    vscode.commands.registerCommand("pspf.pub.archiveRole", archiveRole),
    vscode.commands.registerCommand("pspf.pub.newAssignment", newAssignment),
    vscode.commands.registerCommand("pspf.pub.openAssignmentDetail", openAssignmentDetail),
    vscode.commands.registerCommand("pspf.pub.editAssignment", editAssignment),
    vscode.commands.registerCommand("pspf.pub.recordRelationshipNote", recordRelationshipNote),
    vscode.commands.registerCommand("pspf.pub.openRelationshipNoteDetail", openRelationshipNoteDetail),
    vscode.commands.registerCommand("pspf.pub.editRelationshipNote", editRelationshipNote),
    vscode.commands.registerCommand("pspf.pub.openOrgChart", () =>
      openPubPanel("Organisation chart", renderOrgChartHtml)
    ),
    vscode.commands.registerCommand("pspf.pub.openPeople", () => openPubPanel("People", renderPeopleHtml)),
    vscode.commands.registerCommand("pspf.pub.openPeopleCulture", () =>
      openPubPanel("People and Culture", renderPeopleCultureHtml)
    ),
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
  personEditorPanel = undefined;
  roleEditorPanel = undefined;
  assignmentEditorPanel = undefined;
  relationshipNoteEditorPanel = undefined;
  pubTreeProviders.length = 0;
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
  const resumeUrl = await promptOptionalText("Resume link", "Local file path or URL to a resume/CV");
  const resumeText = await promptOptionalText("Resume notes", "Optional pasted resume summary or capability notes");
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
    resumeUrl,
    resumeText,
    nextMilestone,
    nextAction,
    lifecycle: defaultPersonLifecycle(),
    performanceCycles: [blankPerformanceCycle()],
    notes
  };
  await saveStore({ ...store, people: [...store.people, person] });
  await refreshHome();
  vscode.window.showInformationMessage(`Added Pub person ${displayName}.`);
}

async function openPersonDetail(personArg?: PersonRecord): Promise<void> {
  const store = await loadStore();
  const person = personArg ?? (await pickPerson(store, "Open person detail"));
  if (!person) {
    return;
  }
  await openPubPanel(`Person: ${person.displayName}`, (currentStore) =>
    renderPersonDetailHtml(currentStore, person.id)
  );
}

async function editPerson(): Promise<void> {
  const store = await loadStore();
  const person = await pickPerson(store, "Edit person");
  if (!person) {
    return;
  }
  await openPersonEditor(person);
}

async function openPersonEditor(person?: PersonRecord): Promise<void> {
  const title = person ? `Edit Pub Person: ${person.displayName}` : "New Pub Person";
  if (personEditorPanel) {
    personEditorPanel.title = title;
    personEditorPanel.reveal(vscode.ViewColumn.One);
  } else {
    personEditorPanel = vscode.window.createWebviewPanel("pspfPubPersonEditor", title, vscode.ViewColumn.One, {
      enableScripts: true
    });
    personEditorPanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handlePersonEditorMessage(message);
    });
    personEditorPanel.onDidDispose(() => {
      personEditorPanel = undefined;
    });
  }
  personEditorPanel.webview.html = renderPersonEditorHtml(person);
}

async function handlePersonEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelPerson") {
    personEditorPanel?.dispose();
    return;
  }
  if (message.action !== "savePerson" && message.action !== "saveAndClosePerson") {
    return;
  }

  const store = await loadStore();
  const person = parsePersonEditorFields(message.fields, message.personId);
  if (!person) {
    vscode.window.showWarningMessage("Person display name is required before saving.");
    return;
  }
  const existing = store.people.some((candidate) => candidate.id === person.id);
  await saveStore({
    ...store,
    people: existing
      ? store.people.map((candidate) => (candidate.id === person.id ? person : candidate))
      : [...store.people, person]
  });
  await refreshHome();

  if (message.action === "saveAndClosePerson") {
    personEditorPanel?.dispose();
    await openPubPanel(`Person: ${person.displayName}`, (currentStore) =>
      renderPersonDetailHtml(currentStore, person.id)
    );
  } else {
    await openPersonEditor(person);
  }
  vscode.window.showInformationMessage(`Saved Pub person ${person.displayName}.`);
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
  const reportsToRole = await pickOptionalRole(store, "Reports to role");
  const functionalOutcome = await promptOptionalText("Functional outcome", "Example: Access review sustainability");
  const contribution = await promptOptionalText(
    "Compliance contribution",
    "How this role helps the team sustain owned controls"
  );
  const positionDescriptionUrl = await promptOptionalText(
    "Position description link",
    "Local file path or URL to the PD"
  );
  const positionDescriptionText = await promptOptionalText(
    "Position description text",
    "Optional pasted PD duties, accountabilities, or selection criteria"
  );

  const role: RoleRecord = {
    id: localId("ROL"),
    title,
    teamId: team.id,
    status: "active",
    reportsToRoleId: reportsToRole?.id ?? "",
    functionalOutcome,
    contribution,
    positionDescriptionUrl,
    positionDescriptionText
  };
  await saveStore({ ...store, roles: [...store.roles, role] });
  await refreshHome();
  vscode.window.showInformationMessage(`Added Pub role ${title}.`);
}

async function openRoleDetail(roleArg?: RoleRecord): Promise<void> {
  const store = await loadStore();
  const role = roleArg ?? (await pickRole(store, "Open role detail"));
  if (!role) {
    return;
  }
  await openPubPanel(`Role: ${role.title}`, (currentStore) => renderRoleDetailHtml(currentStore, role.id));
}

async function editRole(): Promise<void> {
  const store = await loadStore();
  const role = await pickRole(store, "Edit role");
  if (!role) {
    return;
  }
  await openRoleEditor(role);
}

async function archiveRole(): Promise<void> {
  const store = await loadStore();
  const activeRoles = store.roles.filter((role) => role.status !== "archived");
  if (activeRoles.length === 0) {
    vscode.window.showInformationMessage("No active Pub roles are available to archive.");
    return;
  }
  const picked = await vscode.window.showQuickPick(
    activeRoles.map((role) => ({ label: role.title, description: teamForRole(store, role)?.title, role })),
    { title: "Archive Pub Role", placeHolder: "Choose the role to remove from active coverage", ignoreFocusOut: true }
  );
  if (!picked) {
    return;
  }
  const confirmed = await vscode.window.showWarningMessage(
    `Archive ${picked.role.title}? Existing assignments stay local, but the role stops counting as active coverage.`,
    { modal: true },
    "Archive role"
  );
  if (confirmed !== "Archive role") {
    return;
  }
  await saveStore({
    ...store,
    roles: store.roles.map((role) => (role.id === picked.role.id ? { ...role, status: "archived" } : role))
  });
  await refreshHome();
  await openPubPanel("Roles", renderRolesHtml);
  vscode.window.showInformationMessage(`Archived Pub role ${picked.role.title}.`);
}

async function openRoleEditor(role?: RoleRecord): Promise<void> {
  const store = await loadStore();
  if (store.teams.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub team before editing a role.");
    return;
  }
  const title = role ? `Edit Pub Role: ${role.title}` : "New Pub Role";
  if (roleEditorPanel) {
    roleEditorPanel.title = title;
    roleEditorPanel.reveal(vscode.ViewColumn.One);
  } else {
    roleEditorPanel = vscode.window.createWebviewPanel("pspfPubRoleEditor", title, vscode.ViewColumn.One, {
      enableScripts: true
    });
    roleEditorPanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handleRoleEditorMessage(message);
    });
    roleEditorPanel.onDidDispose(() => {
      roleEditorPanel = undefined;
    });
  }
  roleEditorPanel.webview.html = renderRoleEditorHtml(store, role);
}

async function handleRoleEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelRole") {
    roleEditorPanel?.dispose();
    return;
  }
  if (message.action !== "saveRole" && message.action !== "saveAndCloseRole") {
    return;
  }

  const store = await loadStore();
  const role = parseRoleFormFields(message.fields, message.roleId, store);
  if (!role) {
    vscode.window.showWarningMessage("Role title and team are required before saving.");
    return;
  }
  const existing = store.roles.some((candidate) => candidate.id === role.id);
  await saveStore({
    ...store,
    roles: existing
      ? store.roles.map((candidate) => (candidate.id === role.id ? role : candidate))
      : [...store.roles, role]
  });
  await refreshHome();

  if (message.action === "saveAndCloseRole") {
    roleEditorPanel?.dispose();
    await openPubPanel(`Role: ${role.title}`, (currentStore) => renderRoleDetailHtml(currentStore, role.id));
  } else {
    await openRoleEditor(role);
  }
  vscode.window.showInformationMessage(`Saved Pub role ${role.title}.`);
}

async function newTeam(): Promise<void> {
  await openTeamEditor();
}

async function openTeamDetail(teamArg?: TeamRecord): Promise<void> {
  const store = await loadStore();
  const team = teamArg ?? (await pickTeam(store, "Open team detail"));
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

async function exportTeamScopeBrief(): Promise<void> {
  const store = await loadStore();
  const team = await pickTeam(store, "Export team scope brief");
  if (!team) {
    return;
  }
  const [sourceControls, requirements, mappings] = await Promise.all([
    listSourceControls(),
    listRequirements(),
    listRequirementControlMappings()
  ]);
  const markdown = renderTeamScopeBriefMarkdown(team, store, sourceControls, requirements, mappings);
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage("Open a workspace folder before exporting a Pub team scope brief.");
    return;
  }
  const fileName = `team-${slugify(team.title) || team.id.toLocaleLowerCase("en-AU")}-scope-brief.md`;
  const exportPath = join(workspaceFolder.uri.fsPath, ".pspf", "pub", "exports", fileName);
  await mkdir(dirname(exportPath), { recursive: true });
  await writeFile(exportPath, markdown, "utf8");
  const document = await vscode.workspace.openTextDocument(exportPath);
  await vscode.window.showTextDocument(document, { preview: false });
  const action = await vscode.window.showInformationMessage(
    `Team scope brief exported to ${join(".pspf", "pub", "exports", fileName)}.`,
    "Copy to clipboard"
  );
  if (action === "Copy to clipboard") {
    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage("Team scope brief copied to clipboard.");
  }
}

function renderTeamScopeBriefMarkdown(
  team: TeamRecord,
  store: PubStore,
  sourceControls: readonly SourceControlRecord[],
  requirements: readonly RequirementRecord[],
  mappings: readonly RequirementControlMappingRecord[]
): string {
  const generatedAt = new Date().toISOString();
  const sourceControlsByControlId = new Map(
    sourceControls.map((sourceControl) => [sourceControl.controlId.toLocaleUpperCase("en-AU"), sourceControl])
  );
  const sourceControlsById = new Map(sourceControls.map((sourceControl) => [sourceControl.id, sourceControl]));
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));

  const lines: string[] = [];
  lines.push(`# Team scope brief: ${team.title}`);
  lines.push("");
  lines.push(
    `_Generated ${generatedAt} from PSPF Pub local data. Person names and relationship notes are not included._`
  );
  lines.push("");
  lines.push("## Responsibility");
  lines.push("");
  lines.push(team.responsibility || "_No responsibility recorded yet._");
  lines.push("");

  if (team.controlSetRefs.length > 0) {
    lines.push("## Owned control sets");
    lines.push("");
    for (const ref of team.controlSetRefs) {
      lines.push(`- ${ref}`);
    }
    lines.push("");
  }

  lines.push("## Owned ISM controls");
  lines.push("");
  if (team.ownedControlRefs.length === 0) {
    lines.push("_No ISM controls are linked to this team yet._");
  } else {
    lines.push("| Control | Title |");
    lines.push("| --- | --- |");
    for (const ref of team.ownedControlRefs) {
      const sourceControl = sourceControlsByControlId.get(ref.toLocaleUpperCase("en-AU"));
      lines.push(`| ${ref} | ${sourceControl?.title ?? "Not found in Core"} |`);
    }
  }
  lines.push("");

  lines.push("## Directly linked PSPF requirements");
  lines.push("");
  if (team.ownedRequirementRefs.length === 0) {
    lines.push("_No PSPF requirements are directly linked to this team yet._");
  } else {
    lines.push("| Requirement | Title | Status |");
    lines.push("| --- | --- | --- |");
    for (const ref of team.ownedRequirementRefs) {
      const requirement = requirementsById.get(ref);
      lines.push(
        `| ${ref} | ${requirement?.title ?? "Not found in Core"} | ${label(requirement?.assessmentStatus ?? "not-recorded")} |`
      );
    }
  }
  lines.push("");

  const ownedRefsUpper = new Set(team.ownedControlRefs.map((ref) => ref.toLocaleUpperCase("en-AU")));
  const mappedRows = mappings.filter((mapping) => {
    const sourceControl = sourceControlsById.get(mapping.sourceControlId);
    return sourceControl ? ownedRefsUpper.has(sourceControl.controlId.toLocaleUpperCase("en-AU")) : false;
  });
  lines.push("## PSPF requirements via mapped ISM controls");
  lines.push("");
  if (mappedRows.length === 0) {
    lines.push("_No Core Requirement-to-ISM mappings resolve from this team's owned controls._");
  } else {
    lines.push("| Control | Requirement | Coverage | Profile | Confidence |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const mapping of mappedRows) {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      const requirement = requirementsById.get(mapping.requirementId);
      lines.push(
        `| ${sourceControl?.controlId ?? mapping.sourceControlId} | ${requirement?.title ?? mapping.requirementId} | ${label(mapping.coverageQualifier ?? "not-recorded")} | ${mapping.applicabilityProfile ?? "Not recorded"} | ${label(mapping.confidence ?? "not-recorded")} |`
      );
    }
  }
  lines.push("");

  const teamRoles = activeRolesForTeam(store, team.id);
  lines.push("## Roles supporting this team");
  lines.push("");
  if (teamRoles.length === 0) {
    lines.push("_No roles are recorded for this team yet._");
  } else {
    lines.push("| Role | Outcome | Assignments |");
    lines.push("| --- | --- | --- |");
    for (const role of teamRoles) {
      const assignmentCount = store.assignments.filter((assignment) => assignment.roleId === role.id).length;
      lines.push(
        `| ${role.title} | ${role.functionalOutcome || "_Not recorded_"} | ${assignmentCount} ${assignmentCount === 1 ? "assignment" : "assignments"} |`
      );
    }
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(
    "_Redaction: Pub person names, person identifiers, team notes, and relationship notes are local-only and are not included in this brief. Share this Markdown file directly with the team to inform their scope and goals._"
  );
  lines.push("");
  return lines.join("\n");
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("en-AU")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function openTeamEditor(team?: TeamRecord): Promise<void> {
  const store = await loadStore();
  const [sourceControls, requirements, mappings] = await Promise.all([
    listSourceControls(),
    listRequirements(),
    listRequirementControlMappings()
  ]);
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
  teamEditorPanel.webview.html = renderTeamEditorHtml(team, store, sourceControls, requirements, mappings);
}

async function handleTeamEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelTeam") {
    teamEditorPanel?.dispose();
    return;
  }
  if (message.action !== "saveTeam" && message.action !== "saveAndCloseTeam") {
    return;
  }

  const store = await loadStore();
  const parsed = parseTeamEditorFields(message.fields, message.teamId, store);
  if (!parsed) {
    vscode.window.showWarningMessage("Team title is required before saving.");
    return;
  }
  const { team, roles, assignments, people } = parsed;

  const existing = store.teams.some((candidate) => candidate.id === team.id);
  await saveStore({
    ...store,
    people,
    teams: existing
      ? store.teams.map((candidate) => (candidate.id === team.id ? team : candidate))
      : [...store.teams, team],
    roles,
    assignments
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

async function openAssignmentDetail(assignmentArg?: AssignmentRecord): Promise<void> {
  const store = await loadStore();
  const assignment = assignmentArg ?? (await pickAssignment(store, "Open assignment detail"));
  if (!assignment) {
    return;
  }
  await openPubPanel("Assignment detail", (currentStore) => renderAssignmentDetailHtml(currentStore, assignment.id));
}

async function editAssignment(): Promise<void> {
  const store = await loadStore();
  const assignment = await pickAssignment(store, "Edit assignment");
  if (!assignment) {
    return;
  }
  await openAssignmentEditor(assignment);
}

async function openAssignmentEditor(assignment?: AssignmentRecord): Promise<void> {
  const store = await loadStore();
  if (store.people.length === 0 || store.roles.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub person and one Pub role before editing an assignment.");
    return;
  }
  const title = assignment ? "Edit Pub Assignment" : "New Pub Assignment";
  if (assignmentEditorPanel) {
    assignmentEditorPanel.title = title;
    assignmentEditorPanel.reveal(vscode.ViewColumn.One);
  } else {
    assignmentEditorPanel = vscode.window.createWebviewPanel("pspfPubAssignmentEditor", title, vscode.ViewColumn.One, {
      enableScripts: true
    });
    assignmentEditorPanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handleAssignmentEditorMessage(message);
    });
    assignmentEditorPanel.onDidDispose(() => {
      assignmentEditorPanel = undefined;
    });
  }
  assignmentEditorPanel.webview.html = renderAssignmentEditorHtml(store, assignment);
}

async function handleAssignmentEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelAssignment") {
    assignmentEditorPanel?.dispose();
    return;
  }
  if (message.action !== "saveAssignment" && message.action !== "saveAndCloseAssignment") {
    return;
  }

  const store = await loadStore();
  const assignment = parseAssignmentFormFields(message.fields, message.assignmentId, store);
  if (!assignment) {
    vscode.window.showWarningMessage("Person and role are required before saving an assignment.");
    return;
  }
  const existing = store.assignments.some((candidate) => candidate.id === assignment.id);
  await saveStore({
    ...store,
    assignments: existing
      ? store.assignments.map((candidate) => (candidate.id === assignment.id ? assignment : candidate))
      : [...store.assignments, assignment]
  });
  await refreshHome();

  if (message.action === "saveAndCloseAssignment") {
    assignmentEditorPanel?.dispose();
    await openPubPanel("Assignment detail", (currentStore) => renderAssignmentDetailHtml(currentStore, assignment.id));
  } else {
    await openAssignmentEditor(assignment);
  }
  vscode.window.showInformationMessage("Saved Pub assignment.");
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

async function openRelationshipNoteDetail(): Promise<void> {
  const store = await loadStore();
  const relationshipNote = await pickRelationshipNote(store, "Open relationship note detail");
  if (!relationshipNote) {
    return;
  }
  await openPubPanel("Relationship note detail", (currentStore) =>
    renderRelationshipNoteDetailHtml(currentStore, relationshipNote.id)
  );
}

async function editRelationshipNote(): Promise<void> {
  const store = await loadStore();
  const relationshipNote = await pickRelationshipNote(store, "Edit relationship note");
  if (!relationshipNote) {
    return;
  }
  await openRelationshipNoteEditor(relationshipNote);
}

async function openRelationshipNoteEditor(relationshipNote?: RelationshipNoteRecord): Promise<void> {
  const store = await loadStore();
  if (store.people.length === 0) {
    vscode.window.showWarningMessage("Add at least one Pub person before editing a relationship note.");
    return;
  }
  const title = relationshipNote ? "Edit Pub Relationship Note" : "New Pub Relationship Note";
  if (relationshipNoteEditorPanel) {
    relationshipNoteEditorPanel.title = title;
    relationshipNoteEditorPanel.reveal(vscode.ViewColumn.One);
  } else {
    relationshipNoteEditorPanel = vscode.window.createWebviewPanel(
      "pspfPubRelationshipNoteEditor",
      title,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    relationshipNoteEditorPanel.webview.onDidReceiveMessage((message: PubWebviewMessage) => {
      void handleRelationshipNoteEditorMessage(message);
    });
    relationshipNoteEditorPanel.onDidDispose(() => {
      relationshipNoteEditorPanel = undefined;
    });
  }
  relationshipNoteEditorPanel.webview.html = renderRelationshipNoteEditorHtml(store, relationshipNote);
}

async function handleRelationshipNoteEditorMessage(message: PubWebviewMessage): Promise<void> {
  if (message.action === "cancelRelationshipNote") {
    relationshipNoteEditorPanel?.dispose();
    return;
  }
  if (message.action !== "saveRelationshipNote" && message.action !== "saveAndCloseRelationshipNote") {
    return;
  }

  const store = await loadStore();
  const relationshipNote = parseRelationshipNoteFormFields(message.fields, message.relationshipNoteId, store);
  if (!relationshipNote) {
    vscode.window.showWarningMessage("Person and relationship note summary are required before saving.");
    return;
  }
  const existing = store.relationshipNotes.some((candidate) => candidate.id === relationshipNote.id);
  await saveStore({
    ...store,
    relationshipNotes: existing
      ? store.relationshipNotes.map((candidate) =>
          candidate.id === relationshipNote.id ? relationshipNote : candidate
        )
      : [relationshipNote, ...store.relationshipNotes]
  });
  await refreshHome();

  if (message.action === "saveAndCloseRelationshipNote") {
    relationshipNoteEditorPanel?.dispose();
    await openPubPanel("Relationship note detail", (currentStore) =>
      renderRelationshipNoteDetailHtml(currentStore, relationshipNote.id)
    );
  } else {
    await openRelationshipNoteEditor(relationshipNote);
  }
  vscode.window.showInformationMessage("Saved Pub relationship note.");
}

async function openPubPanel(title: string, renderer: (store: PubStore) => string | Promise<string>): Promise<void> {
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
  activePanel.webview.html = await renderer(store);
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
  for (const provider of pubTreeProviders) {
    provider.refresh();
  }
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
    people: normalisePeople(store),
    teams,
    roles: normaliseRoles(store, teams),
    assignments: normaliseAssignments(store),
    relationshipNotes: Array.isArray(store.relationshipNotes) ? store.relationshipNotes : []
  };
}

function normalisePeople(store: Partial<PubStore>): readonly PersonRecord[] {
  if (!Array.isArray(store.people)) {
    return [];
  }
  return (store.people as readonly Partial<PersonRecord>[]).map((person) => ({
    id: typeof person.id === "string" ? person.id : localId("PER"),
    displayName: typeof person.displayName === "string" ? person.displayName : "Unnamed person",
    stakeholderType: isStakeholderType(person.stakeholderType) ? person.stakeholderType : "staff",
    organisation: typeof person.organisation === "string" ? person.organisation : "",
    currentRole: typeof person.currentRole === "string" ? person.currentRole : "",
    resumeUrl: typeof person.resumeUrl === "string" ? person.resumeUrl : "",
    resumeText: typeof person.resumeText === "string" ? person.resumeText : "",
    nextMilestone: typeof person.nextMilestone === "string" ? person.nextMilestone : "",
    nextAction: typeof person.nextAction === "string" ? person.nextAction : "",
    lifecycle: normalisePersonLifecycle(person.lifecycle),
    performanceCycles: normalisePerformanceCycles(person.performanceCycles),
    notes: typeof person.notes === "string" ? person.notes : ""
  }));
}

function normalisePersonLifecycle(value: unknown): readonly PersonLifecycleRecord[] {
  const incoming = Array.isArray(value) ? (value as readonly Partial<PersonLifecycleRecord>[]) : [];
  return PERSON_LIFECYCLE_STEPS.map((stepId) => {
    const existing = incoming.find((item) => item.stepId === stepId);
    return {
      stepId,
      completed: existing?.completed === true,
      completedAt: typeof existing?.completedAt === "string" ? existing.completedAt : "",
      notes: typeof existing?.notes === "string" ? existing.notes : ""
    };
  });
}

function normalisePerformanceCycles(value: unknown): readonly PerformanceCycleRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as readonly Partial<PerformanceCycleRecord>[])
    .map((cycle) => ({
      id: typeof cycle.id === "string" ? cycle.id : localId("PFC"),
      year: typeof cycle.year === "string" ? cycle.year : "",
      status: isPerformanceCycleStatus(cycle.status) ? cycle.status : "planned",
      mandatoryBehaviours: typeof cycle.mandatoryBehaviours === "string" ? cycle.mandatoryBehaviours : "",
      roleSpecificCapabilities:
        typeof cycle.roleSpecificCapabilities === "string" ? cycle.roleSpecificCapabilities : "",
      personalGoals: typeof cycle.personalGoals === "string" ? cycle.personalGoals : "",
      targets: typeof cycle.targets === "string" ? cycle.targets : "",
      courses: typeof cycle.courses === "string" ? cycle.courses : "",
      certifications: typeof cycle.certifications === "string" ? cycle.certifications : "",
      reviewBy: typeof cycle.reviewBy === "string" ? cycle.reviewBy : ""
    }))
    .filter((cycle) =>
      [
        cycle.year,
        cycle.mandatoryBehaviours,
        cycle.roleSpecificCapabilities,
        cycle.personalGoals,
        cycle.targets,
        cycle.courses,
        cycle.certifications,
        cycle.reviewBy
      ].some(isNonEmptyString)
    );
}

function normaliseAssignments(store: Partial<PubStore>): readonly AssignmentRecord[] {
  if (!Array.isArray(store.assignments)) {
    return [];
  }
  return (store.assignments as readonly Partial<AssignmentRecord>[]).map((assignment) => ({
    id: typeof assignment.id === "string" ? assignment.id : localId("ASM"),
    personId: typeof assignment.personId === "string" ? assignment.personId : "",
    roleId: typeof assignment.roleId === "string" ? assignment.roleId : "",
    status: isAssignmentStatus(assignment.status) ? assignment.status : "active",
    allocation: typeof assignment.allocation === "string" ? assignment.allocation : "",
    reviewBy: typeof assignment.reviewBy === "string" ? assignment.reviewBy : "",
    badge: typeof assignment.badge === "string" ? assignment.badge : ""
  }));
}

function buildSampleStore(): PubStore {
  const people: readonly PersonRecord[] = [
    {
      id: "PUB-PER-access-owner",
      displayName: "Access assurance lead",
      stakeholderType: "staff",
      organisation: "Information Security",
      currentRole: "Runs quarterly access review",
      resumeUrl: "",
      resumeText: "Access assurance, control operation, evidence review, and reviewer coordination.",
      nextMilestone: "2026-06-30 access review evidence",
      nextAction: "Confirm reviewer rotation",
      lifecycle: [
        {
          stepId: "acceptable-use",
          completed: true,
          completedAt: "2026-01-12",
          notes: "Annual acceptable use attestation recorded."
        },
        {
          stepId: "orientation",
          completed: true,
          completedAt: "2026-01-19",
          notes: "Security and evidence-handling orientation complete."
        },
        { stepId: "probation", completed: true, completedAt: "2026-04-12", notes: "Probation review completed." },
        { stepId: "separation", completed: false, completedAt: "", notes: "Not applicable while active." }
      ],
      performanceCycles: [
        {
          id: "PUB-PFC-access-owner-2026",
          year: "2026",
          status: "in-progress",
          mandatoryBehaviours: "Security-aware decision making and respectful collaboration",
          roleSpecificCapabilities: "Access review coordination and evidence quality",
          personalGoals: "Build backup reviewer coverage",
          targets: "Quarterly access review completed within the evidence window",
          courses: "Evidence handling refresher",
          certifications: "Internal access reviewer authorisation",
          reviewBy: "2026-12-01"
        }
      ],
      notes: "Local-only relationship context for planning coverage."
    },
    {
      id: "PUB-PER-provider-manager",
      displayName: "Managed service contact",
      stakeholderType: "service-provider",
      organisation: "External SOC provider",
      currentRole: "Supports monitoring and escalation",
      resumeUrl: "",
      resumeText: "Monitoring service delivery, escalation management, and service review participation.",
      nextMilestone: "2026-07-15 service review",
      nextAction: "Check escalation roster",
      lifecycle: [
        {
          stepId: "acceptable-use",
          completed: true,
          completedAt: "2026-02-01",
          notes: "Provider acceptable use acknowledgement recorded."
        },
        {
          stepId: "orientation",
          completed: true,
          completedAt: "2026-02-08",
          notes: "Local escalation and reporting orientation complete."
        },
        { stepId: "probation", completed: false, completedAt: "", notes: "Managed through provider governance." },
        {
          stepId: "separation",
          completed: false,
          completedAt: "",
          notes: "Confirm offboarding with provider if engagement ends."
        }
      ],
      performanceCycles: [
        {
          id: "PUB-PFC-provider-manager-2026",
          year: "2026",
          status: "planned",
          mandatoryBehaviours: "Clear escalation communication",
          roleSpecificCapabilities: "Monitoring handover and incident escalation",
          personalGoals: "Reduce escalation ambiguity across service windows",
          targets: "Service review actions closed by agreed dates",
          courses: "Local incident escalation briefing",
          certifications: "Provider SOC training maintained",
          reviewBy: "2026-07-15"
        }
      ],
      notes: "Keep contact context local; publish role/team contribution only in a later slice if approved."
    }
  ];
  const roles: readonly RoleRecord[] = [
    {
      id: "PUB-ROL-access-review-owner",
      title: "Access review owner",
      teamId: "PUB-TEM-information-security",
      status: "active",
      reportsToRoleId: "",
      functionalOutcome: "Sustained access review cadence",
      contribution: "Keeps review evidence current and makes reviewer backup visible.",
      positionDescriptionUrl: "",
      positionDescriptionText:
        "Own quarterly access reviews, coordinate reviewers, retain evidence, and escalate exceptions."
    },
    {
      id: "PUB-ROL-monitoring-provider",
      title: "Monitoring service provider",
      teamId: "PUB-TEM-external-soc-provider",
      status: "active",
      reportsToRoleId: "PUB-ROL-access-review-owner",
      functionalOutcome: "Continuous monitoring coverage",
      contribution: "Shows where supplier roster coverage contributes to sustainable monitoring.",
      positionDescriptionUrl: "",
      positionDescriptionText:
        "Maintain monitoring coverage, provide escalation support, and contribute evidence for service reviews."
    }
  ];
  const teams: readonly TeamRecord[] = [
    {
      id: "PUB-TEM-information-security",
      title: "Information Security",
      parentTeamId: "",
      ownedControlRefs: ["ISM-1401", "ISM-1402"],
      ownedRequirementRefs: ["REQ-PSPF-2025-008"],
      controlSetRefs: ["Access control operations"],
      teamItems: [
        {
          id: "PUB-TMI-access-review-window",
          title: "Access review evidence window",
          itemType: "reminder",
          startDate: "2026-06-24",
          endDate: "2026-06-30",
          includeInPlan: true,
          notes: "Team-wide evidence pressure date for access review owners."
        }
      ],
      responsibility: "Owns access review control operation and reviewer backup coverage.",
      notes: "Team ownership is local-only until a future Pub publication ADR defines redaction and review gates."
    },
    {
      id: "PUB-TEM-external-soc-provider",
      title: "External SOC provider",
      parentTeamId: "PUB-TEM-information-security",
      ownedControlRefs: ["ISM-0988"],
      ownedRequirementRefs: [],
      controlSetRefs: ["Monitoring and escalation"],
      teamItems: [
        {
          id: "PUB-TMI-provider-service-review",
          title: "Provider service review",
          itemType: "event",
          startDate: "2026-07-15",
          endDate: "",
          includeInPlan: true,
          notes: "Use to check for conflicts with monitoring uplift and evidence reminders."
        }
      ],
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
  const upcomingBadges = deriveUpcomingBadges(store);
  const posture = `${store.people.length} ${store.people.length === 1 ? "person" : "people"} across ${store.teams.length} ${store.teams.length === 1 ? "team" : "teams"} · local-only, never exported to Explorer.`;

  const coreActions = `<div class="action-list">
    ${homeActionButton("pspf.pub.openOrgChart", "Organisation chart", "See teams, roles, owned controls, and assignment badges")}
    ${homeActionButton("pspf.pub.openPeopleCulture", "People & Culture", "Review lifecycle, probation, acceptable use, and performance cycles")}
    ${homeActionButton("pspf.pub.openRelationshipLog", "Relationship log", "Open the relationship log of stakeholder follow-up notes")}
    ${homeActionButton("pspf.pub.recordRelationshipNote", "Record relationship note", "Record a local follow-up")}
  </div>`;

  const createActions = `<div class="action-list compact">
    ${homeActionButton("pspf.pub.newPerson", "New person", "Add local-only person context")}
    ${homeActionButton("pspf.pub.newTeam", "New team", "Add local team-owned controls")}
    ${homeActionButton("pspf.pub.newRole", "New role", "Attach a role to a team")}
    ${homeActionButton("pspf.pub.newAssignment", "New assignment", "Assign a person to a role")}
    ${homeActionButton("pspf.pub.loadSample", "Load sample", "Replace current Pub data with sample records")}
  </div>`;

  const editActions = `<div class="action-list compact">
    ${homeActionButton("pspf.pub.editPerson", "Edit person", "Choose and update a local person")}
    ${homeActionButton("pspf.pub.editTeam", "Edit team", "Choose and update a team")}
    ${homeActionButton("pspf.pub.editRole", "Edit role", "Choose and update a role")}
    ${homeActionButton("pspf.pub.editAssignment", "Edit assignment", "Choose and update an assignment")}
    ${homeActionButton("pspf.pub.editRelationshipNote", "Edit relationship note", "Choose and update a follow-up note")}
  </div>`;

  const body = [
    `<style>
      .pub-action-radar { display: grid; gap: 8px; }
      .pub-action-radar__track { display: grid; gap: 6px; }
      .pub-action-radar__item { display: grid; grid-template-columns: 10px minmax(0, 1fr); gap: 7px; align-items: center; color: var(--vscode-descriptionForeground); font-size: 12px; }
      .pub-action-radar__item i { width: 10px; height: 10px; border-radius: 50%; background: var(--pspf-home-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--pspf-home-accent) 14%, transparent); }
      .pub-action-radar__item span { overflow-wrap: anywhere; }
    </style>`,
    homePostureHeader({
      id: "overview",
      eyebrow: "Local people context",
      title: "PSPF Pub",
      posture,
      metrics: [
        { label: "People", value: store.people.length },
        { label: "Teams", value: store.teams.length },
        { label: "Roles", value: store.roles.length },
        { label: "Assignments", value: store.assignments.length }
      ]
    }),
    homeSection({
      id: "signals",
      eyebrow: "Now",
      heading: "Upcoming actions",
      body: renderPubUpcomingActionsGraphic(upcomingBadges)
    }),
    homeSection({ id: "actions", eyebrow: "Open", heading: "People & relationship tools", body: coreActions }),
    homeSection({ id: "create", eyebrow: "Author", heading: "Create local records", body: createActions }),
    homeSection({ id: "edit", eyebrow: "Maintain", heading: "Edit local records", body: editActions })
  ].join("");

  return homePanelShellHtml({
    extensionLabel: "PSPF Pub",
    title: "PSPF Pub",
    tagline: "Local-only people context",
    version: PSPF_SLICE_VERSION,
    accent: "red",
    sensitivityBanner:
      "OFFICIAL: Sensitive · local-only people context · no Explorer publication in v1.29 — Pub data stays on this workspace and is never exported to Explorer.",
    nav: [
      { href: "overview", label: "Overview" },
      { href: "signals", label: "Signals" },
      { href: "actions", label: "Open" },
      { href: "create", label: "Create" },
      { href: "edit", label: "Edit" }
    ],
    body
  });
}

function renderPubUpcomingActionsGraphic(upcomingBadges: readonly string[]): string {
  if (upcomingBadges.length === 0) {
    return `<p class="muted">Load sample data or add assignments to see action, review, rotation, and anniversary signals.</p>`;
  }
  return `<div class="pub-action-radar" aria-label="Upcoming Pub actions">
    <div class="pub-action-radar__track">
      ${upcomingBadges
        .slice(0, 5)
        .map(
          (badge) =>
            `<div class="pub-action-radar__item"><i aria-hidden="true"></i><span>${escapeHtml(badge)}</span></div>`
        )
        .join("")}
    </div>
    ${upcomingBadges.length > 5 ? `<p class="muted">${upcomingBadges.length - 5} more signal${upcomingBadges.length - 5 === 1 ? "" : "s"} in the local Pub store.</p>` : ""}
  </div>`;
}

function renderOrgChartHtml(store: PubStore): string {
  const teamDepth = teamDepthMap(store.teams);
  const graphic = renderOrgChartGraphic(store, teamDepth);
  const rows = [...store.teams]
    .sort(
      (left, right) =>
        (teamDepth.get(left.id) ?? 0) - (teamDepth.get(right.id) ?? 0) || left.title.localeCompare(right.title)
    )
    .flatMap((team) => {
      const teamRoles = store.roles.filter((role) => role.teamId === team.id);
      return (teamRoles.length > 0 ? teamRoles : [blankRole(team.id)]).map((role) => {
        const assignments = store.assignments.filter((assignment) => assignment.roleId === role.id);
        const assignedPeople =
          assignments.map((assignment) => personName(store, assignment.personId)).join(", ") || "No assignment";
        return `<tr><td>${escapeHtml(`${"  ".repeat(teamDepth.get(team.id) ?? 0)}${team.title}`)}</td><td>${escapeHtml(teamTitle(store, team.parentTeamId) || "Top level")}</td><td>${escapeHtml(role.title || "No role yet")}</td><td>${escapeHtml(roleTitle(store, role.reportsToRoleId) || "No reporting role")}</td><td>${escapeHtml(assignedPeople)}</td></tr>`;
      });
    })
    .join("");
  return pageHtml(
    "PSPF Pub Organisation Chart",
    `<main>${sectionHtml(
      "Organisation chart",
      "Local team hierarchy, role reporting lines, and who is assigned. Person names stay local-only.",
      graphic
    )}${sectionHtml(
      "Organisation chart detail",
      "Supporting table for scanning structure, reporting lines, and current assignments.",
      tableHtml(["Team", "Parent", "Role", "Reports to", "Assigned"], rows, 5)
    )}</main>`
  );
}

function renderOrgChartGraphic(store: PubStore, teamDepth: ReadonlyMap<string, number>): string {
  if (store.teams.length === 0) {
    return `<div class="org-chart-empty">No Pub teams yet. Load the sample or add teams, roles, and assignments to build the chart.</div>`;
  }
  const teamIds = new Set(store.teams.map((team) => team.id));
  const rootTeams = store.teams
    .filter((team) => !team.parentTeamId || !teamIds.has(team.parentTeamId))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  return `<div class="org-chart-graphic" role="tree" aria-label="Pub organisation chart graphic view">${rootTeams
    .map((team) => renderOrgChartTeamNode(store, team, teamDepth, new Set<string>()))
    .join("")}</div>`;
}

function renderOrgChartTeamNode(
  store: PubStore,
  team: TeamRecord,
  teamDepth: ReadonlyMap<string, number>,
  seenTeamIds: ReadonlySet<string>
): string {
  const nextSeenTeamIds = new Set([...seenTeamIds, team.id]);
  const childTeams = store.teams
    .filter((candidate) => candidate.parentTeamId === team.id && !nextSeenTeamIds.has(candidate.id))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  const teamRoles = store.roles
    .filter((role) => role.teamId === team.id && role.status !== "archived")
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }));
  const roleCards = teamRoles.length
    ? teamRoles.map((role) => renderOrgChartRoleCard(store, role)).join("")
    : `<article class="org-role-card org-role-card--empty"><strong>No role yet</strong><span>Add roles to show coverage and reporting lines.</span></article>`;
  const backItems = renderOrgChartTeamBack(team);
  const childHtml = childTeams.length
    ? `<div class="org-child-teams" role="group">${childTeams
        .map((childTeam) => renderOrgChartTeamNode(store, childTeam, teamDepth, nextSeenTeamIds))
        .join("")}</div>`
    : "";

  return `<article class="org-team-node" role="treeitem" aria-level="${(teamDepth.get(team.id) ?? 0) + 1}">
    <div class="org-team-card">
      <div class="org-card-face org-card-face--front">
        <div class="org-team-heading"><span class="org-node-kicker">Team</span><h2>${escapeHtml(team.title)}</h2></div>
        <p class="muted">${escapeHtml(team.responsibility || "No team responsibility recorded yet.")}</p>
        <div class="org-role-grid">${roleCards}</div>
      </div>
      <div class="org-card-face org-card-face--back" aria-label="${escapeHtml(team.title)} accountabilities and team dates">
        ${backItems}
      </div>
    </div>
    ${childHtml}
  </article>`;
}

function renderOrgChartTeamBack(team: TeamRecord): string {
  const requirements = team.ownedRequirementRefs.length
    ? team.ownedRequirementRefs.map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`).join("")
    : `<span class="org-card-empty">No PSPF requirements linked</span>`;
  const controls = [...team.ownedControlRefs, ...team.controlSetRefs].length
    ? [...team.ownedControlRefs, ...team.controlSetRefs]
        .map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`)
        .join("")
    : `<span class="org-card-empty">No controls linked</span>`;
  const dates = team.teamItems.length
    ? `<ul class="org-team-date-list">${team.teamItems
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(formatTeamItemDateRange(item))}${item.includeInPlan ? " · Plan date" : ""}</span></li>`
        )
        .join("")}</ul>`
    : `<p class="org-card-empty">No team news or dates recorded.</p>`;
  return `<h3>Accountable scope</h3>
    <div class="org-back-group"><strong>Requirements</strong><div class="tags">${requirements}</div></div>
    <div class="org-back-group"><strong>Controls</strong><div class="tags">${controls}</div></div>
    <div class="org-back-group"><strong>Team news and dates</strong>${dates}</div>`;
}

function renderOrgChartRoleCard(store: PubStore, role: RoleRecord): string {
  const assignments = store.assignments
    .filter((assignment) => assignment.roleId === role.id)
    .sort((left, right) => personName(store, left.personId).localeCompare(personName(store, right.personId), "en-AU"));
  const assignmentHtml = assignments.length
    ? assignments.map((assignment) => renderOrgChartAssignmentChip(store, assignment)).join("")
    : `<span class="org-assignment-chip org-assignment-chip--gap">No assignment</span>`;
  const reportsTo = roleTitle(store, role.reportsToRoleId);
  return `<article class="org-role-card">
    <div class="org-role-heading"><strong>${escapeHtml(role.title)}</strong>${reportsTo ? `<span>Reports to ${escapeHtml(reportsTo)}</span>` : `<span>No reporting role</span>`}</div>
    <div class="org-assignment-row">${assignmentHtml}</div>
  </article>`;
}

function renderOrgChartAssignmentChip(store: PubStore, assignment: AssignmentRecord): string {
  return `<span class="org-assignment-chip"><strong>${escapeHtml(personName(store, assignment.personId))}</strong></span>`;
}

function renderTeamsHtml(store: PubStore): string {
  const rows = store.teams
    .map(
      (team) =>
        `<tr><td>${escapeHtml(team.title)}</td><td>${escapeHtml(team.ownedControlRefs.join(", "))}</td><td>${escapeHtml(team.controlSetRefs.join(", "))}</td><td>${escapeHtml(team.responsibility)}</td><td>${teamHealthBadges(store, team)}</td><td>${escapeHtml(team.teamItems.map(formatTeamItemSummary).join("; ") || "No team dates")}</td><td>${escapeHtml(team.notes)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Teams",
    sectionHtml(
      "Team control ownership",
      "Teams own controls or control sets. Roles and assignments describe how people sustain that ownership locally.",
      tableHtml(["Team", "Owned controls", "Control sets", "Responsibility", "Gaps", "Team dates", "Notes"], rows, 7)
    )
  );
}

async function renderTeamDetailHtml(store: PubStore, teamId: string): Promise<string> {
  const team = store.teams.find((candidate) => candidate.id === teamId);
  if (!team) {
    return pageHtml(
      "PSPF Pub Team",
      sectionHtml("Team not found", "This team exists only in Pub local storage and could not be resolved.", "")
    );
  }
  const teamRoles = activeRolesForTeam(store, team.id);
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
  const requirementRows = await teamRequirementRows(team);
  const directRequirementRows = await teamDirectRequirementRows(team);
  const teamItemRows = team.teamItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(label(item.itemType))}</td><td>${escapeHtml(formatTeamItemDateRange(item))}</td><td>${escapeHtml(item.includeInPlan ? "Yes" : "No")}</td><td>${escapeHtml(item.notes || "No notes")}</td></tr>`
    )
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
          ${team.ownedRequirementRefs.map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`).join("")}
          ${team.controlSetRefs.map((ref) => `<span class="tag">${escapeHtml(ref)}</span>`).join("")}
        </div>
      </section>
      <section class="grid two" aria-label="Team health">
        ${summaryCard("Coverage", teamHealthBadges(store, team))}
        ${summaryCard("Compliance status", teamComplianceStatus(store, team))}
        ${summaryCard("Local-only notes", escapeHtml(team.notes || "No local team notes recorded."))}
      </section>
      <section class="panel" aria-label="Team actions">
        <h1>Team actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editTeam", "Edit team", "Update local control ownership")}
          ${commandButton("pspf.pub.exportTeamScopeBrief", "Share scope brief", "Export this team's scope and goals as Markdown")}
          ${commandButton("pspf.pub.newRole", "New role", "Add role coverage for a team")}
          ${commandButton("pspf.pub.archiveRole", "Archive role", "Remove a role from active coverage without deleting it")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign a person to a role")}
          ${commandButton("pspf.pub.recordRelationshipNote", "Relationship note", "Record local follow-up context")}
        </div>
      </section>
      ${sectionHtml(
        "Team news and dates",
        "Team-wide items such as enterprise bargaining, census windows, leave pressure or local events. Items marked for the Plan of Action remain local and can appear as optional schedule dates.",
        tableHtml(["Item", "Type", "Date", "Plan date", "Notes"], teamItemRows, 5)
      )}
      ${sectionHtml(
        "Roles and assignments",
        "Roles and person assignments stay in Pub local storage and explain how this team sustains its owned controls.",
        tableHtml(["Role", "Outcome", "Assigned", "Badges", "Contribution"], roleRows, 5)
      )}
      ${sectionHtml(
        "Directly linked PSPF requirements",
        "PSPF requirements the team is explicitly accountable for. Use these to frame the team's scope and goals when sharing.",
        tableHtml(["Requirement", "Title", "Status"], directRequirementRows, 3)
      )}
      ${sectionHtml(
        "PSPF Requirements via ISM controls",
        "This local view resolves team-owned ISM controls through Core Requirement-to-ISM mappings. It does not publish Pub team or person data.",
        tableHtml(["Control", "Requirement", "Coverage", "Profile", "Confidence", "Status"], requirementRows, 6)
      )}
    </main>`
  );
}

async function teamDirectRequirementRows(team: TeamRecord): Promise<string> {
  if (team.ownedRequirementRefs.length === 0) {
    return "";
  }
  const requirements = await listRequirements();
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  return team.ownedRequirementRefs
    .map((ref) => {
      const requirement = requirementsById.get(ref);
      return `<tr><td>${escapeHtml(ref)}</td><td>${escapeHtml(requirement?.title ?? "Not found in Core")}</td><td>${escapeHtml(label(requirement?.assessmentStatus ?? "not-recorded"))}</td></tr>`;
    })
    .join("");
}

async function teamRequirementRows(team: TeamRecord): Promise<string> {
  const [sourceControls, mappings, requirements] = await Promise.all([
    listSourceControls(),
    listRequirementControlMappings(),
    listRequirements()
  ]);
  const ownedRefs = new Set(team.ownedControlRefs.map((ref) => ref.toLocaleUpperCase("en-AU")));
  const sourceControlsById = new Map(sourceControls.map((sourceControl) => [sourceControl.id, sourceControl]));
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  return mappings
    .filter((mapping) => {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      return sourceControl ? ownedRefs.has(sourceControl.controlId.toLocaleUpperCase("en-AU")) : false;
    })
    .map((mapping) => {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      const requirement = requirementsById.get(mapping.requirementId);
      return `<tr><td>${escapeHtml(sourceControl?.controlId ?? mapping.sourceControlId)}</td><td>${escapeHtml(requirement?.title ?? mapping.requirementId)}</td><td>${escapeHtml(label(mapping.coverageQualifier ?? "not-recorded"))}</td><td>${escapeHtml(mapping.applicabilityProfile ?? "Not recorded")}</td><td>${escapeHtml(label(mapping.confidence ?? "not-recorded"))}</td><td>${escapeHtml(label(requirement?.assessmentStatus ?? "not-recorded"))}</td></tr>`;
    })
    .join("");
}

function renderTeamEditorHtml(
  team: TeamRecord | undefined,
  store: PubStore,
  sourceControls: readonly SourceControlRecord[],
  requirements: readonly RequirementRecord[],
  mappings: readonly RequirementControlMappingRecord[]
): string {
  const selectedControlRefs = new Set(team?.ownedControlRefs ?? []);
  const knownControlIds = new Set(sourceControls.map((sourceControl) => sourceControl.controlId));
  const localControlRefs = (team?.ownedControlRefs ?? []).filter((ref) => !knownControlIds.has(ref));
  const selectedRequirementRefs = new Set(team?.ownedRequirementRefs ?? []);
  const knownRequirementIds = new Set(requirements.map((requirement) => requirement.id));
  const localRequirementRefs = (team?.ownedRequirementRefs ?? []).filter((ref) => !knownRequirementIds.has(ref));
  const teamRoles = team ? activeRolesForTeam(store, team.id) : [];
  const teamAssignments = store.assignments.filter((assignment) =>
    teamRoles.some((role) => role.id === assignment.roleId)
  );
  const teamPeople = store.people.filter((person) =>
    teamAssignments.some((assignment) => assignment.personId === person.id)
  );
  const controlsBase = 5;
  const additionalControlsTab = controlsBase + 1;
  const requirementsBase = additionalControlsTab + 1;
  const additionalRequirementsTab = requirementsBase + 1;
  const teamItemsTab = additionalRequirementsTab + 1;
  const notesTab = teamItemsTab + Math.max(1, team?.teamItems.length ?? 0) * 6;
  const scopePickerHtml = renderTeamScopePicker(
    sourceControls,
    requirements,
    mappings,
    selectedControlRefs,
    selectedRequirementRefs,
    controlsBase,
    requirementsBase
  );
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
            <span>Parent team</span>
            <select name="parentTeamId" tabindex="2">
              <option value="">No parent team</option>
              ${store.teams
                .filter((candidate) => candidate.id !== team?.id)
                .map(
                  (candidate) =>
                    `<option value="${escapeHtml(candidate.id)}"${candidate.id === team?.parentTeamId ? " selected" : ""}>${escapeHtml(candidate.title)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>
            <span>Control ownership responsibility</span>
            <textarea name="responsibility" tabindex="3" rows="4">${escapeHtml(team?.responsibility ?? "")}</textarea>
          </label>
          <label>
            <span>Owned control sets</span>
            <textarea name="controlSetRefs" tabindex="4" rows="3" placeholder="E8 ML2, Access control operations">${escapeHtml((team?.controlSetRefs ?? []).join(", "))}</textarea>
          </label>
        </section>
        <section class="panel">
          <h1>Team scope picker</h1>
          <p class="muted">Search and tick the PSPF requirements and ISM controls this team owns. Mapping hints show where Core already links requirements and controls.</p>
          ${scopePickerHtml}
          <label>
            <span>Additional local control refs</span>
            <textarea name="additionalControlRefs" tabindex="${additionalControlsTab}" rows="3" placeholder="Comma-separated refs not in the ISM list">${escapeHtml(localControlRefs.join(", "))}</textarea>
          </label>
          <label>
            <span>Additional local requirement refs</span>
            <textarea name="additionalRequirementRefs" tabindex="${additionalRequirementsTab}" rows="3" placeholder="Comma-separated refs not in the PSPF list">${escapeHtml(localRequirementRefs.join(", "))}</textarea>
          </label>
        </section>
        <section class="panel">
          <h1>Roles and PDs</h1>
          <p class="muted">Edit roles owned by this team. Add a new role by filling the blank role at the end.</p>
          ${team ? [...teamRoles, blankRole(team.id)].map((role) => roleEditorFields(role, store)).join("") : `<p class="muted">Save the team before adding roles.</p>`}
        </section>
        <section class="panel">
          <h1>Assignments</h1>
          <p class="muted">Edit people-to-role coverage for this team. Add a new assignment by filling the blank row.</p>
          ${team ? [...teamAssignments, blankAssignment(teamRoles[0]?.id ?? "")].map((assignment) => assignmentEditorFields(assignment, store, teamRoles)).join("") : `<p class="muted">Save the team before adding assignments.</p>`}
        </section>
        <section class="panel">
          <h1>People and resumes</h1>
          <p class="muted">Edit people currently assigned to this team. Add a new local person by filling the blank person at the end.</p>
          ${team ? [...teamPeople, blankPerson()].map((person) => personEditorFields(person)).join("") : `<p class="muted">Save the team before adding people.</p>`}
        </section>
        <section class="panel">
          <h1>Team news and dates</h1>
          <p class="muted">Add team-wide items such as enterprise bargaining, census periods, shutdown dates, surveys or local reminders. Tick Plan date when the item should be available on the Workshop Plan of Action.</p>
          ${team ? [...team.teamItems, blankTeamItem()].map((item, index) => teamItemEditorFields(item, teamItemsTab + index * 6)).join("") : `<p class="muted">Save the team before adding team-wide dated items.</p>`}
        </section>
        <section class="panel">
          <h1>Local-only notes</h1>
          <label>
            <span>Notes</span>
            <textarea name="notes" tabindex="${notesTab}" rows="5">${escapeHtml(team?.notes ?? "")}</textarea>
          </label>
          <div class="form-actions">
            <button type="button" data-action="saveTeam" tabindex="${notesTab + 1}"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndCloseTeam" tabindex="${notesTab + 2}"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Team detail</span></button>
            <button type="button" data-action="cancelTeam" tabindex="${notesTab + 3}"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function teamItemEditorFields(item: TeamItemRecord, baseTabIndex: number): string {
  const isBlank = item.title.length === 0;
  return `<fieldset class="nested-editor"><legend>${escapeHtml(isBlank ? "New team item" : item.title)}</legend>
    <input type="hidden" name="teamItem.${escapeHtml(item.id)}.id" value="${escapeHtml(item.id)}" />
    <label><span>Title</span><input name="teamItem.${escapeHtml(item.id)}.title" value="${escapeHtml(item.title)}" placeholder="Enterprise bargaining, census, team planning day" tabindex="${baseTabIndex}" /></label>
    <label><span>Type</span><input name="teamItem.${escapeHtml(item.id)}.itemType" value="${escapeHtml(item.itemType)}" placeholder="news, date, reminder, event" tabindex="${baseTabIndex + 1}" /></label>
    <label><span>Start date</span><input name="teamItem.${escapeHtml(item.id)}.startDate" value="${escapeHtml(item.startDate)}" placeholder="2026-07-01" tabindex="${baseTabIndex + 2}" /></label>
    <label><span>End date</span><input name="teamItem.${escapeHtml(item.id)}.endDate" value="${escapeHtml(item.endDate)}" placeholder="Optional, for a period" tabindex="${baseTabIndex + 3}" /></label>
    <label class="checkbox-line"><input type="checkbox" name="teamItem.${escapeHtml(item.id)}.includeInPlan" value="true"${item.includeInPlan ? " checked" : ""} tabindex="${baseTabIndex + 4}" /> <span>Show as optional Plan of Action date</span></label>
    <label><span>Notes</span><textarea name="teamItem.${escapeHtml(item.id)}.notes" rows="3" tabindex="${baseTabIndex + 5}">${escapeHtml(item.notes)}</textarea></label>
  </fieldset>`;
}

function roleEditorFields(role: RoleRecord, store: PubStore): string {
  const isBlank = role.title.length === 0;
  return `<fieldset class="nested-editor"><legend>${escapeHtml(isBlank ? "New role" : role.title)}</legend>
    <input type="hidden" name="role.${escapeHtml(role.id)}.id" value="${escapeHtml(role.id)}" />
    <label><span>Role title</span><input name="role.${escapeHtml(role.id)}.title" value="${escapeHtml(role.title)}" /></label>
    <label><span>Status</span><select name="role.${escapeHtml(role.id)}.status">${ROLE_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${status === role.status ? " selected" : ""}>${escapeHtml(label(status))}</option>`).join("")}</select></label>
    <label><span>Reports to</span><select name="role.${escapeHtml(role.id)}.reportsToRoleId"><option value="">No reporting role</option>${store.roles
      .filter((candidate) => candidate.id !== role.id)
      .map(
        (candidate) =>
          `<option value="${escapeHtml(candidate.id)}"${candidate.id === role.reportsToRoleId ? " selected" : ""}>${escapeHtml(candidate.title)}</option>`
      )
      .join("")}</select></label>
    <label><span>Functional outcome</span><textarea name="role.${escapeHtml(role.id)}.functionalOutcome" rows="2">${escapeHtml(role.functionalOutcome)}</textarea></label>
    <label><span>Control contribution</span><textarea name="role.${escapeHtml(role.id)}.contribution" rows="2">${escapeHtml(role.contribution)}</textarea></label>
    <label><span>PD link</span><input name="role.${escapeHtml(role.id)}.positionDescriptionUrl" value="${escapeHtml(role.positionDescriptionUrl)}" placeholder="Local file path or URL" /></label>
    <label><span>PD text</span><textarea name="role.${escapeHtml(role.id)}.positionDescriptionText" rows="5">${escapeHtml(role.positionDescriptionText)}</textarea></label>
  </fieldset>`;
}

function assignmentEditorFields(
  assignment: AssignmentRecord,
  store: PubStore,
  teamRoles: readonly RoleRecord[]
): string {
  const isBlank = assignment.personId.length === 0 && assignment.roleId.length === 0;
  return `<fieldset class="nested-editor"><legend>${escapeHtml(isBlank ? "New assignment" : personName(store, assignment.personId))}</legend>
    <input type="hidden" name="assignment.${escapeHtml(assignment.id)}.id" value="${escapeHtml(assignment.id)}" />
    <label><span>Person</span><select name="assignment.${escapeHtml(assignment.id)}.personId"><option value="">Select person</option>${store.people.map((person) => `<option value="${escapeHtml(person.id)}"${person.id === assignment.personId ? " selected" : ""}>${escapeHtml(person.displayName)}</option>`).join("")}</select></label>
    <label><span>Role</span><select name="assignment.${escapeHtml(assignment.id)}.roleId"><option value="">Select role</option>${teamRoles.map((role) => `<option value="${escapeHtml(role.id)}"${role.id === assignment.roleId ? " selected" : ""}>${escapeHtml(role.title || "Untitled role")}</option>`).join("")}</select></label>
    <label><span>Status</span><select name="assignment.${escapeHtml(assignment.id)}.status">${ASSIGNMENT_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${status === assignment.status ? " selected" : ""}>${escapeHtml(label(status))}</option>`).join("")}</select></label>
    <label><span>Allocation</span><input name="assignment.${escapeHtml(assignment.id)}.allocation" value="${escapeHtml(assignment.allocation)}" /></label>
    <label><span>Review by</span><input name="assignment.${escapeHtml(assignment.id)}.reviewBy" value="${escapeHtml(assignment.reviewBy)}" /></label>
    <label><span>Badge</span><input name="assignment.${escapeHtml(assignment.id)}.badge" value="${escapeHtml(assignment.badge)}" /></label>
  </fieldset>`;
}

function personEditorFields(person: PersonRecord): string {
  const isBlank = person.displayName.length === 0;
  return `<fieldset class="nested-editor"><legend>${escapeHtml(isBlank ? "New person" : person.displayName)}</legend>
    <input type="hidden" name="person.${escapeHtml(person.id)}.id" value="${escapeHtml(person.id)}" />
    <label><span>Display name</span><input name="person.${escapeHtml(person.id)}.displayName" value="${escapeHtml(person.displayName)}" /></label>
    <label><span>Stakeholder type</span><select name="person.${escapeHtml(person.id)}.stakeholderType">${STAKEHOLDER_TYPES.map((type) => `<option value="${escapeHtml(type)}"${type === person.stakeholderType ? " selected" : ""}>${escapeHtml(label(type))}</option>`).join("")}</select></label>
    <label><span>Organisation</span><input name="person.${escapeHtml(person.id)}.organisation" value="${escapeHtml(person.organisation)}" /></label>
    <label><span>Current role</span><input name="person.${escapeHtml(person.id)}.currentRole" value="${escapeHtml(person.currentRole)}" /></label>
    <label><span>Resume link</span><input name="person.${escapeHtml(person.id)}.resumeUrl" value="${escapeHtml(person.resumeUrl)}" placeholder="Local file path or URL" /></label>
    <label><span>Resume text</span><textarea name="person.${escapeHtml(person.id)}.resumeText" rows="5">${escapeHtml(person.resumeText)}</textarea></label>
    <label><span>Next milestone</span><input name="person.${escapeHtml(person.id)}.nextMilestone" value="${escapeHtml(person.nextMilestone)}" /></label>
    <label><span>Next action</span><input name="person.${escapeHtml(person.id)}.nextAction" value="${escapeHtml(person.nextAction)}" /></label>
    ${personLifecycleEditorFields(person, `person.${person.id}.`)}
    ${performanceCycleEditorFields(person.performanceCycles[0] ?? blankPerformanceCycle(), `person.${person.id}.`)}
    <label><span>Notes</span><textarea name="person.${escapeHtml(person.id)}.notes" rows="3">${escapeHtml(person.notes)}</textarea></label>
  </fieldset>`;
}

function personLifecycleEditorFields(person: PersonRecord, prefix: string): string {
  return PERSON_LIFECYCLE_STEPS.map((stepId) => {
    const step = person.lifecycle.find((item) => item.stepId === stepId) ?? blankPersonLifecycleStep(stepId);
    const fieldPrefix = `${prefix}lifecycle.${stepId}`;
    return `<fieldset class="nested-editor"><legend>${escapeHtml(label(stepId))}</legend>
      <label class="checkbox-line"><input type="checkbox" name="${escapeHtml(fieldPrefix)}.completed" value="true"${step.completed ? " checked" : ""} /> <span>Completed</span></label>
      <label><span>Completed date</span><input name="${escapeHtml(fieldPrefix)}.completedAt" value="${escapeHtml(step.completedAt)}" placeholder="2026-06-30" /></label>
      <label><span>Notes</span><textarea name="${escapeHtml(fieldPrefix)}.notes" rows="2">${escapeHtml(step.notes)}</textarea></label>
    </fieldset>`;
  }).join("");
}

function performanceCycleEditorFields(cycle: PerformanceCycleRecord, prefix: string): string {
  const fieldPrefix = `${prefix}performanceCycle`;
  return `<fieldset class="nested-editor"><legend>${escapeHtml(cycle.year || "Current cycle")}</legend>
    <input type="hidden" name="${escapeHtml(fieldPrefix)}.id" value="${escapeHtml(cycle.id)}" />
    <label><span>Cycle year</span><input name="${escapeHtml(fieldPrefix)}.year" value="${escapeHtml(cycle.year)}" placeholder="2026" /></label>
    <label><span>Status</span><select name="${escapeHtml(fieldPrefix)}.status">${PERFORMANCE_CYCLE_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${status === cycle.status ? " selected" : ""}>${escapeHtml(label(status))}</option>`).join("")}</select></label>
    <label><span>Mandatory behaviours</span><textarea name="${escapeHtml(fieldPrefix)}.mandatoryBehaviours" rows="2">${escapeHtml(cycle.mandatoryBehaviours)}</textarea></label>
    <label><span>Role-specific capabilities</span><textarea name="${escapeHtml(fieldPrefix)}.roleSpecificCapabilities" rows="2">${escapeHtml(cycle.roleSpecificCapabilities)}</textarea></label>
    <label><span>Personal goals</span><textarea name="${escapeHtml(fieldPrefix)}.personalGoals" rows="2">${escapeHtml(cycle.personalGoals)}</textarea></label>
    <label><span>Targets</span><textarea name="${escapeHtml(fieldPrefix)}.targets" rows="2">${escapeHtml(cycle.targets)}</textarea></label>
    <label><span>Courses</span><textarea name="${escapeHtml(fieldPrefix)}.courses" rows="2">${escapeHtml(cycle.courses)}</textarea></label>
    <label><span>Certifications</span><textarea name="${escapeHtml(fieldPrefix)}.certifications" rows="2">${escapeHtml(cycle.certifications)}</textarea></label>
    <label><span>Review by</span><input name="${escapeHtml(fieldPrefix)}.reviewBy" value="${escapeHtml(cycle.reviewBy)}" placeholder="2026-12-01" /></label>
  </fieldset>`;
}

function renderPersonDetailHtml(store: PubStore, personId: string): string {
  const person = store.people.find((candidate) => candidate.id === personId);
  if (!person) {
    return pageHtml(
      "PSPF Pub Person",
      sectionHtml("Person not found", "This person exists only in Pub local storage and could not be resolved.", "")
    );
  }
  const assignments = store.assignments.filter((assignment) => assignment.personId === person.id);
  const assignmentRows = assignments
    .map((assignment) => {
      const role = store.roles.find((candidate) => candidate.id === assignment.roleId);
      const team = role ? teamForRole(store, role) : undefined;
      return `<tr><td>${escapeHtml(role?.title ?? "Unknown role")}</td><td>${escapeHtml(team?.title ?? "Unknown team")}</td><td>${escapeHtml(label(assignment.status))}</td><td>${escapeHtml(assignment.allocation || "Not recorded")}</td><td>${escapeHtml(assignment.reviewBy || "Not recorded")}</td><td>${escapeHtml(assignment.badge || "No badge")}</td></tr>`;
    })
    .join("");
  const noteRows = store.relationshipNotes
    .filter((note) => note.personId === person.id)
    .map(
      (note) =>
        `<tr><td>${escapeHtml(formatDate(note.createdAt))}</td><td>${escapeHtml(note.summary)}</td><td>${escapeHtml(note.nextContactAt || "Not recorded")}</td></tr>`
    )
    .join("");
  return pageHtml(
    `PSPF Pub ${person.displayName}`,
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only person detail</p>
        <h1>${escapeHtml(person.displayName)}</h1>
        <p>${escapeHtml(person.currentRole || "No current role recorded yet.")}</p>
        <div class="tags">
          <span class="tag">${escapeHtml(label(person.stakeholderType))}</span>
          <span class="tag">${escapeHtml(person.organisation || "No organisation recorded")}</span>
          <span class="tag">local-only</span>
        </div>
      </section>
      <section class="grid two" aria-label="Person local context">
        ${summaryCard("Resume", escapeHtml(person.resumeUrl || person.resumeText || "No resume context recorded."))}
        ${summaryCard("Next signal", escapeHtml(person.nextAction || person.nextMilestone || "No next signal recorded."))}
        ${summaryCard("P&C lifecycle", escapeHtml(personLifecycleSummary(person)))}
        ${summaryCard("Performance cycle", escapeHtml(personPerformanceSummary(person)))}
        ${summaryCard("Local-only notes", escapeHtml(person.notes || "No local notes recorded."))}
      </section>
      <section class="panel" aria-label="Person actions">
        <h1>Person actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editPerson", "Edit person", "Update local person fields")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign this person to a role")}
          ${commandButton("pspf.pub.recordRelationshipNote", "Relationship note", "Record local follow-up context")}
        </div>
      </section>
      ${sectionHtml(
        "Assignments",
        "Assignments connect this local person to Pub roles without publishing person identity.",
        tableHtml(["Role", "Team", "Status", "Allocation", "Review by", "Badge"], assignmentRows, 6)
      )}
      ${sectionHtml(
        "People & Culture lifecycle",
        "Acceptable use, orientation, probation, and separation steps are tracked locally so assurance teams can see the people controls around relied-on roles.",
        tableHtml(["Step", "Done", "Completed", "Notes"], personLifecycleRows(person), 4)
      )}
      ${sectionHtml(
        "Annual performance cycle",
        "Mandatory behaviours, role-specific capabilities, personal goals, targets, courses and certifications stay local-only.",
        tableHtml(
          [
            "Year",
            "Status",
            "Mandatory behaviours",
            "Capabilities",
            "Goals",
            "Targets",
            "Courses",
            "Certifications",
            "Review by"
          ],
          personPerformanceRows(person),
          9
        )
      )}
      ${sectionHtml(
        "Relationship notes",
        "Mini CRM notes for this person stay local-only by default.",
        tableHtml(["Recorded", "Summary", "Next contact"], noteRows, 3)
      )}
    </main>`
  );
}

function renderPersonEditorHtml(person: PersonRecord | undefined): string {
  const current = person ?? blankPerson();
  return pageHtml(
    person ? `Edit Pub Person ${person.displayName}` : "New Pub Person",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only CRUD pilot</p>
        <h1>${person ? `Edit ${escapeHtml(person.displayName)}` : "New person"}</h1>
        <p>Person detail stays in Pub local storage. Save writes to .pspf/pub/pub.json only.</p>
      </section>
      <form class="editor-form" data-person-id="${escapeHtml(person?.id ?? "")}">
        <section class="panel">
          <h1>Person details</h1>
          <label><span>Display name</span><input name="displayName" value="${escapeHtml(current.displayName)}" required autofocus /></label>
          <label><span>Stakeholder type</span><select name="stakeholderType">${STAKEHOLDER_TYPES.map((type) => `<option value="${escapeHtml(type)}"${type === current.stakeholderType ? " selected" : ""}>${escapeHtml(label(type))}</option>`).join("")}</select></label>
          <label><span>Organisation</span><input name="organisation" value="${escapeHtml(current.organisation)}" /></label>
          <label><span>Current role</span><input name="currentRole" value="${escapeHtml(current.currentRole)}" /></label>
        </section>
        <section class="panel">
          <h1>Resume and signals</h1>
          <label><span>Resume link</span><input name="resumeUrl" value="${escapeHtml(current.resumeUrl)}" placeholder="Local file path or URL" /></label>
          <label><span>Resume text</span><textarea name="resumeText" rows="5">${escapeHtml(current.resumeText)}</textarea></label>
          <label><span>Next milestone</span><input name="nextMilestone" value="${escapeHtml(current.nextMilestone)}" /></label>
          <label><span>Next action</span><input name="nextAction" value="${escapeHtml(current.nextAction)}" /></label>
        </section>
        <section class="panel">
          <h1>People & Culture lifecycle</h1>
          <p class="muted">Track acceptable use, orientation, probation, and separation locally for P&C compliance assurance.</p>
          ${personLifecycleEditorFields(current, "")}
        </section>
        <section class="panel">
          <h1>Annual performance cycle</h1>
          <p class="muted">Capture mandatory behaviours, role-specific capabilities, personal goals, targets, courses and certifications.</p>
          ${performanceCycleEditorFields(current.performanceCycles[0] ?? blankPerformanceCycle(), "")}
        </section>
        <section class="panel">
          <h1>Local-only notes</h1>
          <label><span>Notes</span><textarea name="notes" rows="5">${escapeHtml(current.notes)}</textarea></label>
          <div class="form-actions">
            <button type="button" data-action="savePerson"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndClosePerson"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Person detail</span></button>
            <button type="button" data-action="cancelPerson"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function renderRoleDetailHtml(store: PubStore, roleId: string): string {
  const role = store.roles.find((candidate) => candidate.id === roleId);
  if (!role) {
    return pageHtml(
      "PSPF Pub Role",
      sectionHtml("Role not found", "This role exists only in Pub local storage and could not be resolved.", "")
    );
  }
  const team = teamForRole(store, role);
  const assignments = store.assignments.filter((assignment) => assignment.roleId === role.id);
  const assignmentRows = assignments
    .map(
      (assignment) =>
        `<tr><td>${escapeHtml(personName(store, assignment.personId))}</td><td>${escapeHtml(label(assignment.status))}</td><td>${escapeHtml(assignment.allocation || "Not recorded")}</td><td>${escapeHtml(assignment.reviewBy || "Not recorded")}</td><td>${escapeHtml(assignment.badge || "No badge")}</td></tr>`
    )
    .join("");
  const childRows = store.roles
    .filter((candidate) => candidate.reportsToRoleId === role.id)
    .map(
      (candidate) =>
        `<tr><td>${escapeHtml(candidate.title)}</td><td>${escapeHtml(teamForRole(store, candidate)?.title ?? "Unknown team")}</td><td>${escapeHtml(candidate.functionalOutcome || "Not recorded")}</td></tr>`
    )
    .join("");
  return pageHtml(
    `PSPF Pub ${role.title}`,
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only role detail</p>
        <h1>${escapeHtml(role.title)}</h1>
        <p>${escapeHtml(role.functionalOutcome || "No functional outcome recorded yet.")}</p>
        <div class="tags">
          <span class="tag">${escapeHtml(label(role.status))}</span>
          <span class="tag">${escapeHtml(team?.title ?? "Unknown team")}</span>
          <span class="tag">Reports to ${escapeHtml(roleTitle(store, role.reportsToRoleId) || "no reporting role")}</span>
          <span class="tag">local-only</span>
        </div>
      </section>
      <section class="grid two" aria-label="Role local context">
        ${summaryCard("Owned controls", escapeHtml(controlSummary(team)))}
        ${summaryCard("Contribution", escapeHtml(role.contribution || "No contribution recorded."))}
        ${summaryCard("Position description", escapeHtml(role.positionDescriptionUrl || role.positionDescriptionText || "No PD context recorded."))}
      </section>
      <section class="panel" aria-label="Role actions">
        <h1>Role actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editRole", "Edit role", "Update local role fields")}
          ${commandButton("pspf.pub.archiveRole", "Archive role", "Remove a role from active coverage without deleting it")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign a person to this role")}
          ${commandButton("pspf.pub.openTeamDetail", "Team detail", "Open the owning team")}
        </div>
      </section>
      ${sectionHtml(
        "Assignments",
        "Assignments show local people currently connected to this role.",
        tableHtml(["Person", "Status", "Allocation", "Review by", "Badge"], assignmentRows, 5)
      )}
      ${sectionHtml(
        "Reporting roles",
        "Roles reporting to this role help explain local accountability shape.",
        tableHtml(["Role", "Team", "Outcome"], childRows, 3)
      )}
    </main>`
  );
}

function renderRoleEditorHtml(store: PubStore, role: RoleRecord | undefined): string {
  const current = role ?? blankRole(store.teams[0]?.id ?? "");
  return pageHtml(
    role ? `Edit Pub Role ${role.title}` : "New Pub Role",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only CRUD pilot</p>
        <h1>${role ? `Edit ${escapeHtml(role.title)}` : "New role"}</h1>
        <p>Role detail stays in Pub local storage. Save writes to .pspf/pub/pub.json only.</p>
      </section>
      <form class="editor-form" data-role-id="${escapeHtml(role?.id ?? "")}">
        <section class="panel">
          <h1>Role details</h1>
          <label><span>Role title</span><input name="title" value="${escapeHtml(current.title)}" required autofocus /></label>
          <label><span>Status</span><select name="status">${ROLE_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${status === current.status ? " selected" : ""}>${escapeHtml(label(status))}</option>`).join("")}</select></label>
          <label><span>Owning team</span><select name="teamId" required>${store.teams.map((team) => `<option value="${escapeHtml(team.id)}"${team.id === current.teamId ? " selected" : ""}>${escapeHtml(team.title)}</option>`).join("")}</select></label>
          <label><span>Reports to</span><select name="reportsToRoleId"><option value="">No reporting role</option>${store.roles
            .filter((candidate) => candidate.id !== role?.id)
            .map(
              (candidate) =>
                `<option value="${escapeHtml(candidate.id)}"${candidate.id === current.reportsToRoleId ? " selected" : ""}>${escapeHtml(candidate.title)}</option>`
            )
            .join("")}</select></label>
        </section>
        <section class="panel">
          <h1>Contribution</h1>
          <label><span>Functional outcome</span><textarea name="functionalOutcome" rows="3">${escapeHtml(current.functionalOutcome)}</textarea></label>
          <label><span>Control contribution</span><textarea name="contribution" rows="4">${escapeHtml(current.contribution)}</textarea></label>
        </section>
        <section class="panel">
          <h1>Position description</h1>
          <label><span>PD link</span><input name="positionDescriptionUrl" value="${escapeHtml(current.positionDescriptionUrl)}" placeholder="Local file path or URL" /></label>
          <label><span>PD text</span><textarea name="positionDescriptionText" rows="6">${escapeHtml(current.positionDescriptionText)}</textarea></label>
          <div class="form-actions">
            <button type="button" data-action="saveRole"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndCloseRole"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Role detail</span></button>
            <button type="button" data-action="cancelRole"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function renderAssignmentDetailHtml(store: PubStore, assignmentId: string): string {
  const assignment = store.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment) {
    return pageHtml(
      "PSPF Pub Assignment",
      sectionHtml(
        "Assignment not found",
        "This assignment exists only in Pub local storage and could not be resolved.",
        ""
      )
    );
  }
  const person = store.people.find((candidate) => candidate.id === assignment.personId);
  const role = store.roles.find((candidate) => candidate.id === assignment.roleId);
  const team = role ? teamForRole(store, role) : undefined;
  const relatedNotes = store.relationshipNotes
    .filter((note) => note.personId === assignment.personId)
    .map(
      (note) =>
        `<tr><td>${escapeHtml(formatDate(note.createdAt))}</td><td>${escapeHtml(note.summary)}</td><td>${escapeHtml(note.nextContactAt || "Not recorded")}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Assignment",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only assignment detail</p>
        <h1>${escapeHtml(person?.displayName ?? "Unknown person")} -> ${escapeHtml(role?.title ?? "Unknown role")}</h1>
        <p>${escapeHtml(assignment.allocation || "No allocation recorded yet.")}</p>
        <div class="tags">
          <span class="tag">${escapeHtml(label(assignment.status))}</span>
          <span class="tag">${escapeHtml(team?.title ?? "Unknown team")}</span>
          <span class="tag">local-only</span>
        </div>
      </section>
      <section class="grid two" aria-label="Assignment local context">
        ${summaryCard("Person", escapeHtml(person?.displayName ?? "Unknown person"))}
        ${summaryCard("Role", escapeHtml(role?.title ?? "Unknown role"))}
        ${summaryCard("Review by", escapeHtml(assignment.reviewBy || "Not recorded"))}
        ${summaryCard("Badge", escapeHtml(assignment.badge || "No badge"))}
      </section>
      <section class="panel" aria-label="Assignment actions">
        <h1>Assignment actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editAssignment", "Edit assignment", "Update local assignment fields")}
          ${commandButton("pspf.pub.openPersonDetail", "Person detail", "Open the assigned person")}
          ${commandButton("pspf.pub.openRoleDetail", "Role detail", "Open the assigned role")}
        </div>
      </section>
      ${sectionHtml(
        "Person relationship notes",
        "Relationship notes for the assigned person stay local-only by default.",
        tableHtml(["Recorded", "Summary", "Next contact"], relatedNotes, 3)
      )}
    </main>`
  );
}

function renderAssignmentEditorHtml(store: PubStore, assignment: AssignmentRecord | undefined): string {
  const current = assignment ?? blankAssignment(store.roles[0]?.id ?? "");
  return pageHtml(
    assignment ? "Edit Pub Assignment" : "New Pub Assignment",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only CRUD pilot</p>
        <h1>${assignment ? "Edit assignment" : "New assignment"}</h1>
        <p>Assignment detail stays in Pub local storage. Save writes to .pspf/pub/pub.json only.</p>
      </section>
      <form class="editor-form" data-assignment-id="${escapeHtml(assignment?.id ?? "")}">
        <section class="panel">
          <h1>Assignment details</h1>
          <label><span>Person</span><select name="personId" required>${store.people.map((person) => `<option value="${escapeHtml(person.id)}"${person.id === current.personId ? " selected" : ""}>${escapeHtml(person.displayName)}</option>`).join("")}</select></label>
          <label><span>Role</span><select name="roleId" required>${store.roles.map((role) => `<option value="${escapeHtml(role.id)}"${role.id === current.roleId ? " selected" : ""}>${escapeHtml(role.title)}</option>`).join("")}</select></label>
          <label><span>Status</span><select name="status">${ASSIGNMENT_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${status === current.status ? " selected" : ""}>${escapeHtml(label(status))}</option>`).join("")}</select></label>
        </section>
        <section class="panel">
          <h1>Coverage signals</h1>
          <label><span>Allocation</span><input name="allocation" value="${escapeHtml(current.allocation)}" placeholder="primary, backup, 0.4 FTE, monthly review" /></label>
          <label><span>Review by</span><input name="reviewBy" value="${escapeHtml(current.reviewBy)}" placeholder="2026-07-31" /></label>
          <label><span>Badge</span><input name="badge" value="${escapeHtml(current.badge)}" placeholder="rotation due, milestone, anniversary" /></label>
          <div class="form-actions">
            <button type="button" data-action="saveAssignment"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndCloseAssignment"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Assignment detail</span></button>
            <button type="button" data-action="cancelAssignment"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function renderRelationshipNoteDetailHtml(store: PubStore, relationshipNoteId: string): string {
  const relationshipNote = store.relationshipNotes.find((candidate) => candidate.id === relationshipNoteId);
  if (!relationshipNote) {
    return pageHtml(
      "PSPF Pub Relationship Note",
      sectionHtml(
        "Relationship note not found",
        "This relationship note exists only in Pub local storage and could not be resolved.",
        ""
      )
    );
  }
  const person = store.people.find((candidate) => candidate.id === relationshipNote.personId);
  const personAssignments = store.assignments.filter((assignment) => assignment.personId === relationshipNote.personId);
  const assignmentRows = personAssignments
    .map((assignment) => {
      const role = store.roles.find((candidate) => candidate.id === assignment.roleId);
      return `<tr><td>${escapeHtml(role?.title ?? "Unknown role")}</td><td>${escapeHtml(label(assignment.status))}</td><td>${escapeHtml(assignment.allocation || "Not recorded")}</td><td>${escapeHtml(assignment.badge || "No badge")}</td></tr>`;
    })
    .join("");
  return pageHtml(
    "PSPF Pub Relationship Note",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only relationship note detail</p>
        <h1>${escapeHtml(person?.displayName ?? "Unknown person")}</h1>
        <p>${escapeHtml(relationshipNote.summary)}</p>
        <div class="tags">
          <span class="tag">Recorded ${escapeHtml(formatDate(relationshipNote.createdAt) || "Not recorded")}</span>
          <span class="tag">Next ${escapeHtml(relationshipNote.nextContactAt || "not recorded")}</span>
          <span class="tag">local-only</span>
        </div>
      </section>
      <section class="grid two" aria-label="Relationship note local context">
        ${summaryCard("Person", escapeHtml(person?.displayName ?? "Unknown person"))}
        ${summaryCard("Recorded", escapeHtml(formatDate(relationshipNote.createdAt) || "Not recorded"))}
        ${summaryCard("Next contact", escapeHtml(relationshipNote.nextContactAt || "Not recorded"))}
      </section>
      <section class="panel" aria-label="Relationship note actions">
        <h1>Relationship note actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editRelationshipNote", "Edit note", "Update local relationship note fields")}
          ${commandButton("pspf.pub.openPersonDetail", "Person detail", "Open the related person")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign this person to a role")}
        </div>
      </section>
      ${sectionHtml(
        "Person assignments",
        "Assignments for the related person stay in Pub local storage.",
        tableHtml(["Role", "Status", "Allocation", "Badge"], assignmentRows, 4)
      )}
    </main>`
  );
}

function renderRelationshipNoteEditorHtml(
  store: PubStore,
  relationshipNote: RelationshipNoteRecord | undefined
): string {
  const current = relationshipNote ?? blankRelationshipNote(store.people[0]?.id ?? "");
  return pageHtml(
    relationshipNote ? "Edit Pub Relationship Note" : "New Pub Relationship Note",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only CRUD pilot</p>
        <h1>${relationshipNote ? "Edit relationship note" : "New relationship note"}</h1>
        <p>Relationship note detail stays in Pub local storage. Save writes to .pspf/pub/pub.json only.</p>
      </section>
      <form class="editor-form" data-relationship-note-id="${escapeHtml(relationshipNote?.id ?? "")}">
        <section class="panel">
          <h1>Relationship note details</h1>
          <label><span>Person</span><select name="personId" required>${store.people.map((person) => `<option value="${escapeHtml(person.id)}"${person.id === current.personId ? " selected" : ""}>${escapeHtml(person.displayName)}</option>`).join("")}</select></label>
          <label><span>Recorded at</span><input name="createdAt" value="${escapeHtml(current.createdAt)}" placeholder="${escapeHtml(new Date().toISOString())}" /></label>
          <label><span>Summary</span><textarea name="summary" rows="5" required>${escapeHtml(current.summary)}</textarea></label>
          <label><span>Next contact</span><input name="nextContactAt" value="${escapeHtml(current.nextContactAt)}" placeholder="2026-06-14" /></label>
          <div class="form-actions">
            <button type="button" data-action="saveRelationshipNote"><span class="button-title">Save</span><span class="button-description">Write and keep editing</span></button>
            <button type="button" data-action="saveAndCloseRelationshipNote"><span class="button-title">Save and close</span><span class="button-description">Write, close, and open Note detail</span></button>
            <button type="button" data-action="cancelRelationshipNote"><span class="button-title">Cancel</span><span class="button-description">Close without writing</span></button>
          </div>
        </section>
      </form>
    </main>`
  );
}

function blankRole(teamId: string): RoleRecord {
  return {
    id: localId("ROL"),
    title: "",
    teamId,
    status: "active",
    reportsToRoleId: "",
    functionalOutcome: "",
    contribution: "",
    positionDescriptionUrl: "",
    positionDescriptionText: ""
  };
}

function blankAssignment(roleId: string): AssignmentRecord {
  return { id: localId("ASM"), personId: "", roleId, status: "active", allocation: "", reviewBy: "", badge: "" };
}

function blankRelationshipNote(personId: string): RelationshipNoteRecord {
  return { id: localId("REL"), personId, createdAt: new Date().toISOString(), summary: "", nextContactAt: "" };
}

function blankPerson(): PersonRecord {
  return {
    id: localId("PER"),
    displayName: "",
    stakeholderType: "staff",
    organisation: "",
    currentRole: "",
    resumeUrl: "",
    resumeText: "",
    nextMilestone: "",
    nextAction: "",
    lifecycle: defaultPersonLifecycle(),
    performanceCycles: [blankPerformanceCycle()],
    notes: ""
  };
}

function defaultPersonLifecycle(): readonly PersonLifecycleRecord[] {
  return PERSON_LIFECYCLE_STEPS.map(blankPersonLifecycleStep);
}

function blankPersonLifecycleStep(stepId: PersonLifecycleStepId): PersonLifecycleRecord {
  return { stepId, completed: false, completedAt: "", notes: "" };
}

function blankPerformanceCycle(): PerformanceCycleRecord {
  return {
    id: localId("PFC"),
    year: new Date().getFullYear().toString(),
    status: "planned",
    mandatoryBehaviours: "",
    roleSpecificCapabilities: "",
    personalGoals: "",
    targets: "",
    courses: "",
    certifications: "",
    reviewBy: ""
  };
}

function renderTeamScopePicker(
  sourceControls: readonly SourceControlRecord[],
  requirements: readonly RequirementRecord[],
  mappings: readonly RequirementControlMappingRecord[],
  selectedControlRefs: ReadonlySet<string>,
  selectedRequirementRefs: ReadonlySet<string>,
  controlsTabIndex: number,
  requirementsTabIndex: number
): string {
  const sourceControlsById = new Map(sourceControls.map((sourceControl) => [sourceControl.id, sourceControl]));
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const controlsByRequirement = new Map<string, string[]>();
  const requirementsByControl = new Map<string, string[]>();
  for (const mapping of mappings) {
    const sourceControl = sourceControlsById.get(mapping.sourceControlId);
    const requirement = requirementsById.get(mapping.requirementId);
    if (!sourceControl || !requirement) {
      continue;
    }
    controlsByRequirement.set(requirement.id, [
      ...(controlsByRequirement.get(requirement.id) ?? []),
      `${sourceControl.controlId} ${sourceControl.title}`
    ]);
    requirementsByControl.set(sourceControl.controlId, [
      ...(requirementsByControl.get(sourceControl.controlId) ?? []),
      `${requirement.id} ${requirement.title}`
    ]);
  }
  const requirementRows =
    requirements.length === 0
      ? `<p class="muted scope-picker-empty">No PSPF requirements are available from Core yet. Add local refs below.</p>`
      : requirements
          .map((requirement) =>
            requirementPickerRow(
              requirement,
              selectedRequirementRefs,
              controlsByRequirement.get(requirement.id) ?? [],
              requirementsTabIndex
            )
          )
          .join("");
  const controlRows =
    sourceControls.length === 0
      ? `<p class="muted scope-picker-empty">No ISM source controls are available from Core yet. Add local refs below.</p>`
      : sourceControls
          .map((sourceControl) =>
            controlPickerRow(
              sourceControl,
              selectedControlRefs,
              requirementsByControl.get(sourceControl.controlId) ?? [],
              controlsTabIndex
            )
          )
          .join("");
  return `<div class="scope-picker" data-scope-picker>
    <div class="scope-picker-summary" aria-live="polite">
      <span data-scope-count="requirements">${selectedRequirementRefs.size} requirements selected</span>
      <span data-scope-count="controls">${selectedControlRefs.size} controls selected</span>
    </div>
    <div class="scope-picker-toolbar">
      <label><span>Search scope</span><input type="search" data-scope-search placeholder="Search ID, title, status or mapped context" /></label>
      <label><span>Filter</span><select data-scope-filter><option value="all">All</option><option value="selected">Selected</option><option value="mapped">Mapped</option><option value="unselected">Unselected</option></select></label>
    </div>
    <div class="scope-picker-tabs" role="tablist" aria-label="Team scope lists">
      <button type="button" class="scope-picker-tab is-active" data-scope-tab="requirements" role="tab" aria-selected="true">Requirements</button>
      <button type="button" class="scope-picker-tab" data-scope-tab="controls" role="tab" aria-selected="false">ISM controls</button>
    </div>
    <div class="scope-picker-list" data-scope-panel="requirements">${requirementRows}</div>
    <div class="scope-picker-list" data-scope-panel="controls" hidden>${controlRows}</div>
  </div>`;
}

function controlPickerRow(
  sourceControl: SourceControlRecord,
  selectedControlRefs: ReadonlySet<string>,
  mappedRequirementLabels: readonly string[],
  tabIndex: number
): string {
  const checked = selectedControlRefs.has(sourceControl.controlId) ? " checked" : "";
  const mappedText =
    mappedRequirementLabels.length > 0 ? mappedRequirementLabels.join(" ") : "No mapped PSPF requirements";
  return `<label class="checkbox-row scope-picker-row" data-scope-kind="control" data-selected="${checked ? "true" : "false"}" data-mapped="${mappedRequirementLabels.length > 0 ? "true" : "false"}" data-search="${escapeHtml(`${sourceControl.controlId} ${sourceControl.title} ${mappedText}`)}"><input type="checkbox" name="ownedControlRefs" value="${escapeHtml(sourceControl.controlId)}" tabindex="${tabIndex}"${checked} /><span><strong>${escapeHtml(sourceControl.controlId)}</strong> ${escapeHtml(sourceControl.title)}<small>${escapeHtml(mappedRequirementLabels.length > 0 ? `Mapped requirements: ${mappedRequirementLabels.slice(0, 3).join("; ")}` : "No mapped PSPF requirements")}</small></span></label>`;
}

function requirementPickerRow(
  requirement: RequirementRecord,
  selectedRequirementRefs: ReadonlySet<string>,
  mappedControlLabels: readonly string[],
  tabIndex: number
): string {
  const checked = selectedRequirementRefs.has(requirement.id) ? " checked" : "";
  const mappedText = mappedControlLabels.length > 0 ? mappedControlLabels.join(" ") : "No mapped ISM controls";
  const status = requirement.assessmentStatus ?? "not-recorded";
  return `<label class="checkbox-row scope-picker-row" data-scope-kind="requirement" data-selected="${checked ? "true" : "false"}" data-mapped="${mappedControlLabels.length > 0 ? "true" : "false"}" data-search="${escapeHtml(`${requirement.id} ${requirement.title} ${status} ${mappedText}`)}"><input type="checkbox" name="ownedRequirementRefs" value="${escapeHtml(requirement.id)}" tabindex="${tabIndex}"${checked} /><span><strong>${escapeHtml(requirement.id)}</strong> ${escapeHtml(requirement.title)}<small>${escapeHtml(`${label(status)} · ${mappedControlLabels.length > 0 ? `Mapped controls: ${mappedControlLabels.slice(0, 3).join("; ")}` : "No mapped ISM controls"}`)}</small></span></label>`;
}

function renderPeopleHtml(store: PubStore): string {
  const rows = store.people
    .map(
      (person) =>
        `<tr><td>${escapeHtml(person.displayName)}</td><td>${escapeHtml(label(person.stakeholderType))}</td><td>${escapeHtml(person.organisation)}</td><td>${escapeHtml(person.currentRole)}</td><td>${escapeHtml(personLifecycleSummary(person))}</td><td>${escapeHtml(personPerformanceSummary(person))}</td><td>${escapeHtml(person.resumeUrl || "Not linked")}</td><td>${escapeHtml(person.resumeText || "Not captured")}</td><td>${escapeHtml(person.nextAction || person.nextMilestone)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub People",
    `<main>
      <section class="panel" aria-label="People actions">
        <h1>People actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.openPersonDetail", "Person detail", "Open a local person record")}
          ${commandButton("pspf.pub.editPerson", "Edit person", "Update all person fields")}
          ${commandButton("pspf.pub.openPeopleCulture", "P&C compliance", "Open lifecycle and performance compliance")}
          ${commandButton("pspf.pub.newPerson", "New person", "Add local-only person context")}
        </div>
      </section>
      ${sectionHtml(
        "People directory",
        "Local-only people and stakeholder context. Do not treat these display names as publishable data.",
        tableHtml(
          [
            "Name",
            "Type",
            "Organisation",
            "Role",
            "Lifecycle",
            "Performance",
            "Resume link",
            "Resume text",
            "Next signal"
          ],
          rows,
          9
        )
      )}
    </main>`
  );
}

function renderPeopleCultureHtml(store: PubStore): string {
  const rows = store.people
    .map((person) => {
      const missing = missingLifecycleSteps(person).map(label).join(", ") || "Complete";
      const cycle = latestPerformanceCycle(person);
      return `<tr><td>${escapeHtml(person.displayName)}</td><td>${escapeHtml(person.currentRole || "Not recorded")}</td><td>${escapeHtml(personLifecycleSummary(person))}</td><td>${escapeHtml(missing)}</td><td>${escapeHtml(cycle?.year ?? "Not recorded")}</td><td>${escapeHtml(cycle ? label(cycle.status) : "Not recorded")}</td><td>${escapeHtml(cycle?.targets || "Not recorded")}</td><td>${escapeHtml(cycle?.courses || "Not recorded")}</td><td>${escapeHtml(cycle?.certifications || "Not recorded")}</td><td>${escapeHtml(cycle?.reviewBy || person.nextMilestone || "Not recorded")}</td></tr>`;
    })
    .join("");
  return pageHtml(
    "PSPF Pub People and Culture",
    `<main>
      <section class="hero">
        <p class="meta">Pub local-only People & Culture view</p>
        <h1>People & Culture compliance</h1>
        <p>Lifecycle and annual performance-cycle context for the people relied on by PSPF teams, roles and assignments.</p>
        <div class="tags">
          <span class="tag">${store.people.length} people</span>
          <span class="tag">${peopleWithCompleteLifecycle(store)} lifecycle complete</span>
          <span class="tag">${peopleWithPerformanceCycles(store)} performance cycles</span>
          <span class="tag">local-only</span>
        </div>
      </section>
      <section class="panel" aria-label="People and Culture actions">
        <h1>P&C actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.editPerson", "Edit person", "Update lifecycle and performance fields")}
          ${commandButton("pspf.pub.openPeople", "People directory", "Open the full people list")}
          ${commandButton("pspf.pub.openAssignments", "Assignments", "Review relied-on roles and coverage")}
        </div>
      </section>
      ${sectionHtml(
        "People & Culture compliance board",
        "Acceptable use, orientation, probation, separation, behaviours, capabilities, goals, targets, courses and certifications are stored locally in Pub only.",
        tableHtml(
          [
            "Person",
            "Role",
            "Lifecycle",
            "Missing lifecycle",
            "Cycle",
            "Status",
            "Targets",
            "Courses",
            "Certifications",
            "Review by"
          ],
          rows,
          10
        )
      )}
    </main>`
  );
}

function renderRolesHtml(store: PubStore): string {
  const rows = store.roles
    .map(
      (role) =>
        `<tr><td>${escapeHtml(role.title)}</td><td>${escapeHtml(teamForRole(store, role)?.title ?? "Unknown team")}</td><td>${escapeHtml(roleTitle(store, role.reportsToRoleId) || "No reporting role")}</td><td>${escapeHtml(controlSummary(teamForRole(store, role)))}</td><td>${escapeHtml(role.positionDescriptionUrl || "Not linked")}</td><td>${escapeHtml(role.positionDescriptionText || "Not captured")}</td><td>${escapeHtml(role.functionalOutcome)}</td><td>${escapeHtml(role.contribution)}</td></tr>`
    )
    .join("");
  return pageHtml(
    "PSPF Pub Roles",
    `<main>
      <section class="panel" aria-label="Role actions">
        <h1>Role actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.openRoleDetail", "Role detail", "Open a local role record")}
          ${commandButton("pspf.pub.editRole", "Edit role", "Update all role fields")}
          ${commandButton("pspf.pub.newRole", "New role", "Attach a role to a team")}
        </div>
      </section>
      ${sectionHtml(
        "Role contribution",
        "Role contribution context shows how people help teams sustain owned controls and control sets.",
        tableHtml(
          ["Role", "Team", "Reports to", "Owned controls", "PD link", "PD text", "Outcome", "Contribution"],
          rows,
          8
        )
      )}
    </main>`
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
    `<main>
      <section class="panel" aria-label="Assignment actions">
        <h1>Assignment actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.openAssignmentDetail", "Assignment detail", "Open a local assignment record")}
          ${commandButton("pspf.pub.editAssignment", "Edit assignment", "Update all assignment fields")}
          ${commandButton("pspf.pub.newAssignment", "New assignment", "Assign a person to a role")}
        </div>
      </section>
      ${sectionHtml(
        "Assignment board",
        "Assignment status highlights backup, rotation, review, and roster opportunities without publishing person identity.",
        tableHtml(["Person", "Role", "Status", "Allocation", "Review by", "Badge"], rows, 6)
      )}
    </main>`
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
    `<main>
      <section class="panel" aria-label="Relationship note actions">
        <h1>Relationship note actions</h1>
        <div class="action-list compact">
          ${commandButton("pspf.pub.openRelationshipNoteDetail", "Note detail", "Open a local relationship note")}
          ${commandButton("pspf.pub.editRelationshipNote", "Edit note", "Update all relationship note fields")}
          ${commandButton("pspf.pub.recordRelationshipNote", "New note", "Record a local follow-up")}
        </div>
      </section>
      ${sectionHtml(
        "Relationship log",
        "Mini CRM notes for staff, providers, customers, and other stakeholders. These notes are local-only by default.",
        tableHtml(["Person", "Recorded", "Summary", "Next contact"], rows, 4)
      )}
    </main>`
  );
}

function pageHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${tokensCss("extension")}
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
    .org-chart-graphic { display: grid; gap: 18px; margin-top: 14px; overflow-x: auto; padding: 2px 2px 8px; }
    .org-chart-empty { margin-top: 12px; border: 1px dashed var(--vscode-panel-border); border-radius: 8px; padding: 18px; color: var(--vscode-descriptionForeground); }
    .org-team-node { display: grid; gap: 14px; min-width: min(980px, 100%); }
    .org-team-card { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, #c45a64 28%); border-radius: 10px; padding: 14px; background: color-mix(in srgb, var(--vscode-editor-background) 82%, #c45a64 18%); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
    .org-card-face { display: grid; align-content: start; gap: 10px; min-height: 220px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; background: var(--vscode-sideBar-background); }
    .org-card-face--back { background: color-mix(in srgb, var(--vscode-editor-background) 86%, #4f7f9f 14%); }
    .org-back-group { display: grid; gap: 6px; }
    .org-card-empty { color: var(--vscode-descriptionForeground); font-size: 0.82rem; }
    .org-team-date-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .org-team-date-list li { display: grid; gap: 2px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 7px 8px; background: var(--vscode-editor-background); }
    .org-team-date-list span { color: var(--vscode-descriptionForeground); font-size: 0.78rem; }
    .org-team-heading, .org-role-heading { display: grid; gap: 3px; }
    .org-team-heading h2 { margin: 0; font-size: 1.05rem; }
    .org-node-kicker, .org-role-heading span, .org-assignment-chip small { color: var(--vscode-descriptionForeground); font-size: 0.76rem; }
    .org-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    .org-role-card { display: grid; gap: 8px; min-height: 118px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 10px; background: var(--vscode-sideBar-background); }
    .org-role-card--empty { border-style: dashed; color: var(--vscode-descriptionForeground); }
    .org-assignment-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
    .org-assignment-chip { display: inline-grid; gap: 1px; max-width: 100%; border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 62%, #c45a64 38%); border-radius: 999px; padding: 5px 9px; background: color-mix(in srgb, var(--vscode-editor-background) 72%, #c45a64 28%); }
    .org-assignment-chip strong, .org-assignment-chip small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .org-assignment-chip--gap { color: var(--vscode-descriptionForeground); background: transparent; border-style: dashed; }
    .org-child-teams { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-left: 22px; padding-left: 22px; border-left: 2px solid color-mix(in srgb, var(--vscode-panel-border) 70%, #c45a64 30%); }
    .org-child-teams > .org-team-node::before { content: ""; position: absolute; width: 22px; border-top: 2px solid color-mix(in srgb, var(--vscode-panel-border) 70%, #c45a64 30%); transform: translate(-23px, 28px); }
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
    input, textarea, select { box-sizing: border-box; width: 100%; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 6px; padding: 8px 10px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); font: inherit; }
    textarea { resize: vertical; line-height: 1.45; }
    input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    fieldset.nested-editor { display: grid; gap: 8px; margin: 12px 0 0; padding: 12px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; }
    fieldset.nested-editor legend { padding: 0 6px; color: var(--vscode-descriptionForeground); font-weight: 650; }
    .checkbox-list { display: grid; gap: 6px; max-height: 18rem; overflow: auto; padding-right: 4px; }
    .checkbox-row { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; margin-top: 0; padding: 6px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); }
    .checkbox-row input { width: auto; margin-top: 2px; }
    .checkbox-row span { display: grid; gap: 2px; overflow-wrap: anywhere; }
    .checkbox-row small { color: var(--vscode-descriptionForeground); font-size: 0.76rem; line-height: 1.35; }
    .scope-picker { display: grid; gap: 10px; margin-top: 12px; }
    .scope-picker-summary { display: flex; flex-wrap: wrap; gap: 8px; }
    .scope-picker-summary span { border: 1px solid var(--vscode-panel-border); border-radius: 999px; padding: 4px 8px; color: var(--vscode-descriptionForeground); font-size: 0.8rem; }
    .scope-picker-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, 220px); gap: 10px; align-items: end; }
    .scope-picker-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .scope-picker-tab { background: var(--vscode-button-secondaryBackground, var(--vscode-editor-background)); color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); }
    .scope-picker-tab.is-active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .scope-picker-list { display: grid; gap: 6px; max-height: 24rem; overflow: auto; padding-right: 4px; }
    .scope-picker-row[hidden], .scope-picker-list[hidden] { display: none; }
    @media (max-width: 680px) { .scope-picker-toolbar { grid-template-columns: 1fr; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; vertical-align: top; }
    th { color: var(--vscode-descriptionForeground); font-weight: 650; }
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body>${body}<script>
  const vscode = acquireVsCodeApi();
  ${commandButtonAcknowledgementScript}
  document.querySelectorAll("button[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      pspfAcknowledgeCommandButton(button);
      vscode.postMessage({ command: button.dataset.command });
    });
  });
  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      pspfAcknowledgeCommandButton(button);
      if (!form) {
        vscode.postMessage({ action: button.dataset.action });
        return;
      }
      const data = new FormData(form);
      const fields = {};
      for (const [key, value] of data.entries()) {
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
          const current = fields[key];
          fields[key] = Array.isArray(current) ? [...current, value] : [current, value];
        } else {
          fields[key] = value;
        }
      }
      fields.ownedControlRefs = data.getAll("ownedControlRefs");
      fields.ownedRequirementRefs = data.getAll("ownedRequirementRefs");
      vscode.postMessage({
        action: button.dataset.action,
        teamId: form.dataset.teamId,
        personId: form.dataset.personId,
        roleId: form.dataset.roleId,
        assignmentId: form.dataset.assignmentId,
        relationshipNoteId: form.dataset.relationshipNoteId,
        fields
      });
    });
  });
  document.querySelectorAll("[data-scope-picker]").forEach((picker) => {
    const search = picker.querySelector("[data-scope-search]");
    const filter = picker.querySelector("[data-scope-filter]");
    const tabs = Array.from(picker.querySelectorAll("[data-scope-tab]"));
    const panels = Array.from(picker.querySelectorAll("[data-scope-panel]"));
    const updateCounts = () => {
      const requirementCount = picker.querySelectorAll('input[name="ownedRequirementRefs"]:checked').length;
      const controlCount = picker.querySelectorAll('input[name="ownedControlRefs"]:checked').length;
      const requirementLabel = picker.querySelector('[data-scope-count="requirements"]');
      const controlLabel = picker.querySelector('[data-scope-count="controls"]');
      if (requirementLabel) {
        requirementLabel.textContent = requirementCount + (requirementCount === 1 ? " requirement selected" : " requirements selected");
      }
      if (controlLabel) {
        controlLabel.textContent = controlCount + (controlCount === 1 ? " control selected" : " controls selected");
      }
    };
    const applyFilter = () => {
      const query = String(search?.value || "").trim().toLocaleLowerCase("en-AU");
      const mode = String(filter?.value || "all");
      picker.querySelectorAll("[data-scope-kind]").forEach((row) => {
        const input = row.querySelector('input[type="checkbox"]');
        const isSelected = Boolean(input?.checked);
        row.dataset.selected = isSelected ? "true" : "false";
        const matchesQuery = !query || String(row.dataset.search || "").toLocaleLowerCase("en-AU").includes(query);
        const matchesMode = mode === "all" || (mode === "selected" && isSelected) || (mode === "unselected" && !isSelected) || (mode === "mapped" && row.dataset.mapped === "true");
        row.hidden = !(matchesQuery && matchesMode);
      });
      updateCounts();
    };
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const active = tab.dataset.scopeTab;
        tabs.forEach((candidate) => {
          const selected = candidate.dataset.scopeTab === active;
          candidate.classList.toggle("is-active", selected);
          candidate.setAttribute("aria-selected", selected ? "true" : "false");
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.scopePanel !== active;
        });
        applyFilter();
      });
    });
    search?.addEventListener("input", applyFilter);
    filter?.addEventListener("change", applyFilter);
    picker.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", applyFilter);
    });
    applyFilter();
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

async function pickAssignment(store: PubStore, placeHolder: string): Promise<AssignmentRecord | undefined> {
  const selected = await vscode.window.showQuickPick(
    store.assignments.map((assignment) => ({
      label: `${personName(store, assignment.personId)} -> ${roleTitle(store, assignment.roleId) ?? "Unknown role"}`,
      description: label(assignment.status),
      assignment
    })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.assignment;
}

async function pickRelationshipNote(store: PubStore, placeHolder: string): Promise<RelationshipNoteRecord | undefined> {
  const selected = await vscode.window.showQuickPick(
    store.relationshipNotes.map((relationshipNote) => ({
      label: personName(store, relationshipNote.personId),
      description: formatDate(relationshipNote.createdAt),
      detail: relationshipNote.summary,
      relationshipNote
    })),
    { placeHolder, ignoreFocusOut: true }
  );
  return selected?.relationshipNote;
}

async function pickOptionalRole(store: PubStore, placeHolder: string): Promise<RoleRecord | undefined> {
  if (store.roles.length === 0) {
    return undefined;
  }
  const selected = await vscode.window.showQuickPick(
    [
      { label: "No reporting role", description: "Leave blank", role: undefined },
      ...store.roles.map((role) => ({ label: role.title, description: teamForRole(store, role)?.title, role }))
    ],
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

interface TeamEditorResult {
  readonly team: TeamRecord;
  readonly roles: readonly RoleRecord[];
  readonly assignments: readonly AssignmentRecord[];
  readonly people: readonly PersonRecord[];
}

function parseTeamEditorFields(
  fields: TeamEditorFields | undefined,
  teamId: string | undefined,
  store: PubStore
): TeamEditorResult | undefined {
  const title = stringField(fields?.title).trim();
  if (!title) {
    return undefined;
  }
  const resolvedTeamId = teamId && teamId.trim().length > 0 ? teamId : localId("TEM");
  return {
    team: {
      id: resolvedTeamId,
      title,
      parentTeamId: stringField(fields?.parentTeamId),
      ownedControlRefs: uniqueStrings([
        ...stringArrayField(fields?.ownedControlRefs),
        ...splitRefs(stringField(fields?.additionalControlRefs))
      ]),
      ownedRequirementRefs: uniqueStrings([
        ...stringArrayField(fields?.ownedRequirementRefs),
        ...splitRefs(stringField(fields?.additionalRequirementRefs))
      ]),
      controlSetRefs: splitRefs(stringField(fields?.controlSetRefs)),
      teamItems: parseTeamItemEditorFields(fields, store, resolvedTeamId),
      responsibility: stringField(fields?.responsibility).trim(),
      notes: stringField(fields?.notes).trim()
    },
    people: parsePeopleEditorFields(fields, store),
    roles: parseRoleEditorFields(fields, store, resolvedTeamId),
    assignments: parseAssignmentEditorFields(fields, store)
  };
}

function parseTeamItemEditorFields(
  fields: TeamEditorFields | undefined,
  store: PubStore,
  teamId: string
): readonly TeamItemRecord[] {
  const teamItemIds = formIndexedIds(fields, "teamItem");
  const editedTeamItemIds = new Set(teamItemIds);
  const editedTeamItems = teamItemIds
    .map(
      (itemId): TeamItemRecord => ({
        id: itemId,
        title: stringField(fields?.[`teamItem.${itemId}.title`]).trim(),
        itemType: stringField(fields?.[`teamItem.${itemId}.itemType`]).trim() || "date",
        startDate: stringField(fields?.[`teamItem.${itemId}.startDate`]).trim(),
        endDate: stringField(fields?.[`teamItem.${itemId}.endDate`]).trim(),
        includeInPlan: booleanField(fields?.[`teamItem.${itemId}.includeInPlan`]),
        notes: stringField(fields?.[`teamItem.${itemId}.notes`]).trim()
      })
    )
    .filter((item) => item.title.length > 0 || item.startDate.length > 0);
  return [
    ...(store.teams.find((team) => team.id === teamId)?.teamItems.filter((item) => !editedTeamItemIds.has(item.id)) ??
      []),
    ...editedTeamItems
  ];
}

function parseRoleEditorFields(
  fields: TeamEditorFields | undefined,
  store: PubStore,
  teamId: string
): readonly RoleRecord[] {
  const roleIds = formIndexedIds(fields, "role");
  const editedRoleIds = new Set(roleIds);
  const editedRoles = roleIds
    .map((roleId) => {
      const status = fields?.[`role.${roleId}.status`];
      return {
        id: roleId,
        title: stringField(fields?.[`role.${roleId}.title`]).trim(),
        teamId,
        status: isRoleStatus(status) ? status : "active",
        reportsToRoleId: stringField(fields?.[`role.${roleId}.reportsToRoleId`]),
        functionalOutcome: stringField(fields?.[`role.${roleId}.functionalOutcome`]).trim(),
        contribution: stringField(fields?.[`role.${roleId}.contribution`]).trim(),
        positionDescriptionUrl: stringField(fields?.[`role.${roleId}.positionDescriptionUrl`]).trim(),
        positionDescriptionText: stringField(fields?.[`role.${roleId}.positionDescriptionText`]).trim()
      };
    })
    .filter((role) => role.title.length > 0);
  return [...store.roles.filter((role) => !editedRoleIds.has(role.id)), ...editedRoles];
}

function parsePeopleEditorFields(fields: TeamEditorFields | undefined, store: PubStore): readonly PersonRecord[] {
  const personIds = formIndexedIds(fields, "person");
  const editedPersonIds = new Set(personIds);
  const editedPeople = personIds
    .map((personId): PersonRecord => {
      const stakeholderType = fields?.[`person.${personId}.stakeholderType`];
      return {
        id: personId,
        displayName: stringField(fields?.[`person.${personId}.displayName`]).trim(),
        stakeholderType: isStakeholderType(stakeholderType) ? stakeholderType : "staff",
        organisation: stringField(fields?.[`person.${personId}.organisation`]).trim(),
        currentRole: stringField(fields?.[`person.${personId}.currentRole`]).trim(),
        resumeUrl: stringField(fields?.[`person.${personId}.resumeUrl`]).trim(),
        resumeText: stringField(fields?.[`person.${personId}.resumeText`]).trim(),
        nextMilestone: stringField(fields?.[`person.${personId}.nextMilestone`]).trim(),
        nextAction: stringField(fields?.[`person.${personId}.nextAction`]).trim(),
        lifecycle: parsePersonLifecycleFields(fields, `person.${personId}.`),
        performanceCycles: parsePerformanceCycleFields(fields, `person.${personId}.`),
        notes: stringField(fields?.[`person.${personId}.notes`]).trim()
      };
    })
    .filter((person) => person.displayName.length > 0);
  return [...store.people.filter((person) => !editedPersonIds.has(person.id)), ...editedPeople];
}

function parsePersonEditorFields(
  fields: PersonEditorFields | undefined,
  personId: string | undefined
): PersonRecord | undefined {
  const displayName = stringField(fields?.displayName).trim();
  if (!displayName) {
    return undefined;
  }
  const stakeholderType = fields?.stakeholderType;
  return {
    id: personId && personId.trim().length > 0 ? personId : localId("PER"),
    displayName,
    stakeholderType: isStakeholderType(stakeholderType) ? stakeholderType : "staff",
    organisation: stringField(fields?.organisation).trim(),
    currentRole: stringField(fields?.currentRole).trim(),
    resumeUrl: stringField(fields?.resumeUrl).trim(),
    resumeText: stringField(fields?.resumeText).trim(),
    nextMilestone: stringField(fields?.nextMilestone).trim(),
    nextAction: stringField(fields?.nextAction).trim(),
    lifecycle: parsePersonLifecycleFields(fields, ""),
    performanceCycles: parsePerformanceCycleFields(fields, ""),
    notes: stringField(fields?.notes).trim()
  };
}

function parsePersonLifecycleFields(
  fields: PersonEditorFields | TeamEditorFields | undefined,
  prefix: string
): readonly PersonLifecycleRecord[] {
  return PERSON_LIFECYCLE_STEPS.map((stepId) => ({
    stepId,
    completed: booleanField(fields?.[`${prefix}lifecycle.${stepId}.completed`]),
    completedAt: stringField(fields?.[`${prefix}lifecycle.${stepId}.completedAt`]).trim(),
    notes: stringField(fields?.[`${prefix}lifecycle.${stepId}.notes`]).trim()
  }));
}

function parsePerformanceCycleFields(
  fields: PersonEditorFields | TeamEditorFields | undefined,
  prefix: string
): readonly PerformanceCycleRecord[] {
  const fieldPrefix = `${prefix}performanceCycle`;
  const status = fields?.[`${fieldPrefix}.status`];
  const cycle: PerformanceCycleRecord = {
    id: stringField(fields?.[`${fieldPrefix}.id`]).trim() || localId("PFC"),
    year: stringField(fields?.[`${fieldPrefix}.year`]).trim(),
    status: isPerformanceCycleStatus(status) ? status : "planned",
    mandatoryBehaviours: stringField(fields?.[`${fieldPrefix}.mandatoryBehaviours`]).trim(),
    roleSpecificCapabilities: stringField(fields?.[`${fieldPrefix}.roleSpecificCapabilities`]).trim(),
    personalGoals: stringField(fields?.[`${fieldPrefix}.personalGoals`]).trim(),
    targets: stringField(fields?.[`${fieldPrefix}.targets`]).trim(),
    courses: stringField(fields?.[`${fieldPrefix}.courses`]).trim(),
    certifications: stringField(fields?.[`${fieldPrefix}.certifications`]).trim(),
    reviewBy: stringField(fields?.[`${fieldPrefix}.reviewBy`]).trim()
  };
  return normalisePerformanceCycles([cycle]);
}

function parseRoleFormFields(
  fields: RoleEditorFields | undefined,
  roleId: string | undefined,
  store: PubStore
): RoleRecord | undefined {
  const title = stringField(fields?.title).trim();
  const teamId = stringField(fields?.teamId).trim();
  if (!title || !store.teams.some((team) => team.id === teamId)) {
    return undefined;
  }
  const reportsToRoleId = stringField(fields?.reportsToRoleId).trim();
  return {
    id: roleId && roleId.trim().length > 0 ? roleId : localId("ROL"),
    title,
    teamId,
    status: isRoleStatus(fields?.status) ? fields.status : "active",
    reportsToRoleId: reportsToRoleId === roleId ? "" : reportsToRoleId,
    functionalOutcome: stringField(fields?.functionalOutcome).trim(),
    contribution: stringField(fields?.contribution).trim(),
    positionDescriptionUrl: stringField(fields?.positionDescriptionUrl).trim(),
    positionDescriptionText: stringField(fields?.positionDescriptionText).trim()
  };
}

function parseAssignmentFormFields(
  fields: AssignmentEditorFields | undefined,
  assignmentId: string | undefined,
  store: PubStore
): AssignmentRecord | undefined {
  const personId = stringField(fields?.personId).trim();
  const roleId = stringField(fields?.roleId).trim();
  if (!store.people.some((person) => person.id === personId) || !store.roles.some((role) => role.id === roleId)) {
    return undefined;
  }
  const status = fields?.status;
  return {
    id: assignmentId && assignmentId.trim().length > 0 ? assignmentId : localId("ASM"),
    personId,
    roleId,
    status: isAssignmentStatus(status) ? status : "active",
    allocation: stringField(fields?.allocation).trim(),
    reviewBy: stringField(fields?.reviewBy).trim(),
    badge: stringField(fields?.badge).trim()
  };
}

function parseRelationshipNoteFormFields(
  fields: RelationshipNoteEditorFields | undefined,
  relationshipNoteId: string | undefined,
  store: PubStore
): RelationshipNoteRecord | undefined {
  const personId = stringField(fields?.personId).trim();
  const summary = stringField(fields?.summary).trim();
  if (!summary || !store.people.some((person) => person.id === personId)) {
    return undefined;
  }
  return {
    id: relationshipNoteId && relationshipNoteId.trim().length > 0 ? relationshipNoteId : localId("REL"),
    personId,
    createdAt: stringField(fields?.createdAt).trim() || new Date().toISOString(),
    summary,
    nextContactAt: stringField(fields?.nextContactAt).trim()
  };
}

function parseAssignmentEditorFields(
  fields: TeamEditorFields | undefined,
  store: PubStore
): readonly AssignmentRecord[] {
  const assignmentIds = formIndexedIds(fields, "assignment");
  const editedAssignmentIds = new Set(assignmentIds);
  const editedAssignments = assignmentIds
    .map((assignmentId): AssignmentRecord => {
      const status = fields?.[`assignment.${assignmentId}.status`];
      return {
        id: assignmentId,
        personId: stringField(fields?.[`assignment.${assignmentId}.personId`]),
        roleId: stringField(fields?.[`assignment.${assignmentId}.roleId`]),
        status: isAssignmentStatus(status) ? status : "active",
        allocation: stringField(fields?.[`assignment.${assignmentId}.allocation`]).trim(),
        reviewBy: stringField(fields?.[`assignment.${assignmentId}.reviewBy`]).trim(),
        badge: stringField(fields?.[`assignment.${assignmentId}.badge`]).trim()
      };
    })
    .filter((assignment) => assignment.personId.length > 0 && assignment.roleId.length > 0);
  return [...store.assignments.filter((assignment) => !editedAssignmentIds.has(assignment.id)), ...editedAssignments];
}

function formIndexedIds(fields: TeamEditorFields | undefined, prefix: string): readonly string[] {
  return uniqueStrings(
    Object.keys(fields ?? {})
      .map((key) => key.match(new RegExp(`^${prefix}\\.([^.]*)\\.`))?.[1] ?? "")
      .filter(isNonEmptyString)
  );
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArrayField(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function booleanField(value: unknown): boolean {
  return value === true || value === "true" || value === "on";
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

async function listRequirements(): Promise<readonly RequirementRecord[]> {
  try {
    const entities = await vscode.commands.executeCommand<readonly unknown[]>("pspf.core.listEntities", "requirement");
    return (entities ?? []).filter(isRequirementRecord);
  } catch {
    return [];
  }
}

async function listRequirementControlMappings(): Promise<readonly RequirementControlMappingRecord[]> {
  try {
    const entities = await vscode.commands.executeCommand<readonly unknown[]>(
      "pspf.core.listEntities",
      "requirement-control-mapping"
    );
    return (entities ?? []).filter(isRequirementControlMappingRecord);
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

function isRequirementRecord(value: unknown): value is RequirementRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<RequirementRecord>;
  return (
    candidate.entityType === "requirement" && typeof candidate.id === "string" && typeof candidate.title === "string"
  );
}

function isRequirementControlMappingRecord(value: unknown): value is RequirementControlMappingRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<RequirementControlMappingRecord>;
  return (
    candidate.entityType === "requirement-control-mapping" &&
    typeof candidate.id === "string" &&
    typeof candidate.requirementId === "string" &&
    typeof candidate.sourceControlId === "string"
  );
}

function normaliseTeams(store: Partial<PubStore>): readonly TeamRecord[] {
  if (Array.isArray(store.teams)) {
    return (store.teams as readonly Partial<TeamRecord>[]).map((team) => ({
      id: typeof team.id === "string" ? team.id : localId("TEM"),
      title: typeof team.title === "string" ? team.title : "Untitled team",
      parentTeamId: typeof team.parentTeamId === "string" ? team.parentTeamId : "",
      ownedControlRefs: Array.isArray(team.ownedControlRefs) ? team.ownedControlRefs.filter(isNonEmptyString) : [],
      ownedRequirementRefs: Array.isArray(team.ownedRequirementRefs)
        ? team.ownedRequirementRefs.filter(isNonEmptyString)
        : [],
      controlSetRefs: Array.isArray(team.controlSetRefs) ? team.controlSetRefs.filter(isNonEmptyString) : [],
      teamItems: normaliseTeamItems(team.teamItems),
      responsibility: typeof team.responsibility === "string" ? team.responsibility : "",
      notes: typeof team.notes === "string" ? team.notes : ""
    }));
  }
  const legacyRoles = Array.isArray(store.roles)
    ? (store.roles as readonly (Partial<RoleRecord> & { team?: string })[])
    : [];
  const legacyTeamNames = [...new Set(legacyRoles.map((role) => role.team).filter(isNonEmptyString))];
  return legacyTeamNames.map((teamName) => ({
    id: localId("TEM"),
    title: teamName,
    parentTeamId: "",
    ownedControlRefs: [],
    ownedRequirementRefs: [],
    controlSetRefs: [],
    teamItems: [],
    responsibility: "",
    notes: "Migrated from the previous role-level team field."
  }));
}

function normaliseTeamItems(value: unknown): readonly TeamItemRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as readonly Partial<TeamItemRecord>[])
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : localId("TMI"),
      title: typeof item.title === "string" ? item.title : "Untitled team item",
      itemType: typeof item.itemType === "string" ? item.itemType : "date",
      startDate: typeof item.startDate === "string" ? item.startDate : "",
      endDate: typeof item.endDate === "string" ? item.endDate : "",
      includeInPlan: typeof item.includeInPlan === "boolean" ? item.includeInPlan : false,
      notes: typeof item.notes === "string" ? item.notes : ""
    }))
    .filter((item) => item.title.length > 0 || item.startDate.length > 0);
}

function normaliseRoles(store: Partial<PubStore>, teams: readonly TeamRecord[]): readonly RoleRecord[] {
  if (!Array.isArray(store.roles)) {
    return [];
  }
  return (store.roles as readonly (Partial<RoleRecord> & { team?: string })[]).map((role) => ({
    id: typeof role.id === "string" ? role.id : localId("ROL"),
    title: typeof role.title === "string" ? role.title : "Untitled role",
    status: isRoleStatus(role.status) ? role.status : "active",
    teamId:
      typeof role.teamId === "string"
        ? role.teamId
        : (teams.find((team) => team.title === role.team)?.id ?? teams[0]?.id ?? ""),
    reportsToRoleId: typeof role.reportsToRoleId === "string" ? role.reportsToRoleId : "",
    functionalOutcome: typeof role.functionalOutcome === "string" ? role.functionalOutcome : "",
    contribution: typeof role.contribution === "string" ? role.contribution : "",
    positionDescriptionUrl: typeof role.positionDescriptionUrl === "string" ? role.positionDescriptionUrl : "",
    positionDescriptionText: typeof role.positionDescriptionText === "string" ? role.positionDescriptionText : ""
  }));
}

function teamForRole(store: PubStore, role: RoleRecord): TeamRecord | undefined {
  return store.teams.find((team) => team.id === role.teamId);
}

function activeRolesForTeam(store: PubStore, teamId: string): readonly RoleRecord[] {
  return store.roles.filter((role) => role.teamId === teamId && role.status !== "archived");
}

function teamTitle(store: PubStore, teamId: string): string | undefined {
  return store.teams.find((team) => team.id === teamId)?.title;
}

function roleTitle(store: PubStore, roleId: string): string | undefined {
  return store.roles.find((role) => role.id === roleId)?.title;
}

function teamDepthMap(teams: readonly TeamRecord[]): ReadonlyMap<string, number> {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const depthById = new Map<string, number>();
  const resolveDepth = (team: TeamRecord, seen = new Set<string>()): number => {
    if (depthById.has(team.id)) {
      return depthById.get(team.id) ?? 0;
    }
    if (!team.parentTeamId || seen.has(team.id)) {
      depthById.set(team.id, 0);
      return 0;
    }
    const parent = byId.get(team.parentTeamId);
    const depth = parent ? resolveDepth(parent, new Set([...seen, team.id])) + 1 : 0;
    depthById.set(team.id, depth);
    return depth;
  };
  teams.forEach((team) => resolveDepth(team));
  return depthById;
}

function controlSummary(team: TeamRecord | undefined): string {
  if (!team) {
    return "No team";
  }
  const refs = [...team.ownedControlRefs, ...team.controlSetRefs];
  return refs.length === 0 ? "No controls recorded" : refs.join(", ");
}

function label(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("en-AU") + part.slice(1))
    .join(" ");
}

function teamHealthBadges(store: PubStore, team: TeamRecord): string {
  const roles = activeRolesForTeam(store, team.id);
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

function teamComplianceStatus(store: PubStore, team: TeamRecord): string {
  const roles = activeRolesForTeam(store, team.id);
  const assignments = store.assignments.filter((assignment) => roles.some((role) => role.id === assignment.roleId));
  return [
    `${team.ownedControlRefs.length} ISM control${team.ownedControlRefs.length === 1 ? "" : "s"}`,
    `${team.ownedRequirementRefs.length} PSPF requirement${team.ownedRequirementRefs.length === 1 ? "" : "s"}`,
    `${roles.length} active role${roles.length === 1 ? "" : "s"}`,
    `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`
  ]
    .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
    .join(" ");
}

function personLifecycleSummary(person: PersonRecord): string {
  const completed = person.lifecycle.filter((step) => step.completed).length;
  return `${completed} of ${PERSON_LIFECYCLE_STEPS.length} P&C lifecycle steps complete`;
}

function missingLifecycleSteps(person: PersonRecord): readonly PersonLifecycleStepId[] {
  return PERSON_LIFECYCLE_STEPS.filter(
    (stepId) => person.lifecycle.find((step) => step.stepId === stepId)?.completed !== true
  );
}

function personLifecycleRows(person: PersonRecord): string {
  return PERSON_LIFECYCLE_STEPS.map((stepId) => {
    const step = person.lifecycle.find((item) => item.stepId === stepId) ?? blankPersonLifecycleStep(stepId);
    return `<tr><td>${escapeHtml(label(step.stepId))}</td><td>${escapeHtml(step.completed ? "Yes" : "No")}</td><td>${escapeHtml(formatDate(step.completedAt) || "Not recorded")}</td><td>${escapeHtml(step.notes || "No notes")}</td></tr>`;
  }).join("");
}

function latestPerformanceCycle(person: PersonRecord): PerformanceCycleRecord | undefined {
  return [...person.performanceCycles].sort((left, right) => right.year.localeCompare(left.year))[0];
}

function personPerformanceSummary(person: PersonRecord): string {
  const cycle = latestPerformanceCycle(person);
  return cycle ? `${cycle.year} ${label(cycle.status)}` : "No annual performance cycle recorded";
}

function personPerformanceRows(person: PersonRecord): string {
  return person.performanceCycles
    .map(
      (cycle) =>
        `<tr><td>${escapeHtml(cycle.year || "Not recorded")}</td><td>${escapeHtml(label(cycle.status))}</td><td>${escapeHtml(cycle.mandatoryBehaviours || "Not recorded")}</td><td>${escapeHtml(cycle.roleSpecificCapabilities || "Not recorded")}</td><td>${escapeHtml(cycle.personalGoals || "Not recorded")}</td><td>${escapeHtml(cycle.targets || "Not recorded")}</td><td>${escapeHtml(cycle.courses || "Not recorded")}</td><td>${escapeHtml(cycle.certifications || "Not recorded")}</td><td>${escapeHtml(cycle.reviewBy || "Not recorded")}</td></tr>`
    )
    .join("");
}

function peopleWithCompleteLifecycle(store: PubStore): number {
  return store.people.filter((person) => missingLifecycleSteps(person).length === 0).length;
}

function peopleWithPerformanceCycles(store: PubStore): number {
  return store.people.filter((person) => person.performanceCycles.length > 0).length;
}

function isRoleStatus(value: unknown): value is RoleStatus {
  return typeof value === "string" && ROLE_STATUSES.includes(value as RoleStatus);
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

function blankTeamItem(): TeamItemRecord {
  return {
    id: localId("TMI"),
    title: "",
    itemType: "date",
    startDate: "",
    endDate: "",
    includeInPlan: false,
    notes: ""
  };
}

function formatTeamItemSummary(item: TeamItemRecord): string {
  return `${item.title} (${formatTeamItemDateRange(item)})`;
}

function formatTeamItemDateRange(item: TeamItemRecord): string {
  const start = formatDate(item.startDate) || "No date";
  const end = formatDate(item.endDate);
  return end && end !== start ? `${start} to ${end}` : start;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStakeholderType(value: unknown): value is StakeholderType {
  return typeof value === "string" && STAKEHOLDER_TYPES.includes(value as StakeholderType);
}

function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && ASSIGNMENT_STATUSES.includes(value as AssignmentStatus);
}

function isPerformanceCycleStatus(value: unknown): value is PerformanceCycleStatus {
  return typeof value === "string" && PERFORMANCE_CYCLE_STATUSES.includes(value as PerformanceCycleStatus);
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
