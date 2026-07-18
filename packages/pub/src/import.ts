import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { AssignmentRecord, PersonRecord, PubStore, RoleRecord, TeamRecord } from "./store.js";
import { validateStore, type StoreValidationIssue } from "./store.js";

export const PUB_IMPORT_TEMPLATE = "Person\tTeam\tRole\tReports to\n";

export interface PubImportRow {
  readonly rowNumber: number;
  readonly person: string;
  readonly team: string;
  readonly role: string;
  readonly reportsTo: string;
}

export interface PubImportPreview {
  readonly rows: readonly PubImportRow[];
  readonly prospectiveStore: PubStore;
  readonly created: {
    readonly people: number;
    readonly teams: number;
    readonly roles: number;
    readonly assignments: number;
  };
  readonly reused: { readonly people: number; readonly teams: number; readonly roles: number };
  readonly issues: readonly StoreValidationIssue[];
}

export function parsePubImportTsv(text: string): readonly PubImportRow[] {
  const records = parse(text, {
    columns: true,
    delimiter: "\t",
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false
  }) as Record<string, string>[];
  return records.map((record, index) => ({
    rowNumber: index + 2,
    person: field(record, "Person"),
    team: field(record, "Team"),
    role: field(record, "Role"),
    reportsTo: field(record, "Reports to")
  }));
}

export function previewPubImport(store: PubStore, rows: readonly PubImportRow[]): PubImportPreview {
  const people = [...store.people];
  const teams = [...store.teams];
  const roles = [...store.roles];
  const assignments = [...store.assignments];
  const created = { people: 0, teams: 0, roles: 0, assignments: 0 };
  const reused = { people: 0, teams: 0, roles: 0 };
  const issues: StoreValidationIssue[] = [];

  rows.forEach((row) => {
    if (!row.person || !row.team || !row.role) {
      issues.push({ path: `row ${row.rowNumber}`, message: "Person, Team and Role are required." });
      return;
    }
    const personResult = exactOne(people, row.person, (person) => person.displayName);
    const teamResult = exactOne(teams, row.team, (team) => team.title);
    if (personResult.ambiguous || teamResult.ambiguous) {
      issues.push({ path: `row ${row.rowNumber}`, message: "Person or Team matches more than one existing record." });
      return;
    }
    const person = personResult.value ?? newPerson(row.person);
    const team = teamResult.value ?? newTeam(row.team);
    if (!personResult.value) {
      people.push(person);
      created.people += 1;
    } else reused.people += 1;
    if (!teamResult.value) {
      teams.push(team);
      created.teams += 1;
    } else reused.teams += 1;

    const roleResult = exactOne(
      roles.filter((role) => role.teamId === team.id),
      row.role,
      (role) => role.title
    );
    if (roleResult.ambiguous) {
      issues.push({ path: `row ${row.rowNumber}`, message: `Role ${row.role} is ambiguous in team ${row.team}.` });
      return;
    }
    const role = roleResult.value ?? newRole(row.role, team.id);
    if (!roleResult.value) {
      roles.push(role);
      created.roles += 1;
    } else reused.roles += 1;
    if (!assignments.some((assignment) => assignment.personId === person.id && assignment.roleId === role.id)) {
      assignments.push(newAssignment(person.id, role.id));
      created.assignments += 1;
    }
  });

  rows.forEach((row) => {
    if (!row.reportsTo) return;
    const team = exactOne(teams, row.team, (item) => item.title).value;
    const role = team
      ? exactOne(
          roles.filter((item) => item.teamId === team.id),
          row.role,
          (item) => item.title
        ).value
      : undefined;
    const manager = exactOne(roles, row.reportsTo, (item) => item.title);
    if (!role || !manager.value || manager.ambiguous) {
      issues.push({
        path: `row ${row.rowNumber}.Reports to`,
        message: `Reports-to role ${row.reportsTo} must match one role title exactly.`
      });
      return;
    }
    const index = roles.findIndex((item) => item.id === role.id);
    roles[index] = { ...role, reportsToRoleId: manager.value.id };
  });

  const prospectiveStore: PubStore = { ...store, people, teams, roles, assignments };
  issues.push(...validateStore(prospectiveStore));
  return { rows, prospectiveStore, created, reused, issues };
}

function field(record: Record<string, string>, name: string): string {
  const key = Object.keys(record).find(
    (candidate) => candidate.trim().toLocaleLowerCase("en-AU") === name.toLocaleLowerCase("en-AU")
  );
  return key ? String(record[key] ?? "").trim() : "";
}

function exactOne<T>(
  items: readonly T[],
  query: string,
  label: (item: T) => string
): { value?: T; ambiguous: boolean } {
  const normalised = query.trim().toLocaleLowerCase("en-AU");
  const matches = items.filter((item) => label(item).trim().toLocaleLowerCase("en-AU") === normalised);
  return { value: matches.length === 1 ? matches[0] : undefined, ambiguous: matches.length > 1 };
}

function id(prefix: string): string {
  return `PUB-${prefix}-${randomUUID()}`;
}
function newPerson(displayName: string): PersonRecord {
  return {
    id: id("PER"),
    displayName,
    stakeholderType: "staff",
    organisation: "",
    currentRole: "",
    resumeUrl: "",
    resumeText: "",
    nextMilestone: "",
    nextAction: "",
    lifecycle: [],
    performanceCycles: [],
    notes: ""
  };
}
function newTeam(title: string): TeamRecord {
  return {
    id: id("TEM"),
    title,
    parentTeamId: "",
    ownedControlRefs: [],
    ownedRequirementRefs: [],
    controlSetRefs: [],
    teamItems: [],
    responsibility: "",
    notes: ""
  };
}
function newRole(title: string, teamId: string): RoleRecord {
  return {
    id: id("ROL"),
    title,
    teamId,
    status: "active",
    reportsToRoleId: "",
    functionalOutcome: "",
    contribution: "",
    positionDescriptionUrl: "",
    positionDescriptionText: ""
  };
}
function newAssignment(personId: string, roleId: string): AssignmentRecord {
  return { id: id("ASM"), personId, roleId, status: "active", allocation: "primary", reviewBy: "", badge: "" };
}
