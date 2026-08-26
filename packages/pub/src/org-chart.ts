import { escapeHtml } from "@pspf/webview-shell";
import type { PubStore, RoleRecord, TeamRecord } from "./store.js";

export interface OrgRoleView {
  readonly id: string;
  readonly title: string;
  readonly status: "filled" | "vacant" | "acting" | "rotating";
  readonly reportsToRoleId: string;
}

export interface OrgTeamView {
  readonly id: string;
  readonly title: string;
  readonly roles: readonly OrgRoleView[];
  readonly children: readonly OrgTeamView[];
}

export function buildOrganisationTree(store: PubStore): readonly OrgTeamView[] {
  const teamIds = new Set(store.teams.map((team) => team.id));
  const roots = store.teams.filter((team) => !team.parentTeamId || !teamIds.has(team.parentTeamId));
  return sortTeams(roots).map((team) => buildTeamView(store, team, new Set<string>()));
}

export function renderOrganisationOutlineText(store: PubStore, asAt = new Date()): string {
  const lines = [
    "PSPF Pub organisation structure",
    `As at ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(asAt)}`,
    "",
    "This role-and-team view excludes people, assignments, notes and evidence.",
    ""
  ];
  const trees = buildOrganisationTree(store);
  if (trees.length === 0) {
    lines.push("No teams recorded.");
  } else {
    trees.forEach((team) => appendTeam(lines, team, 0));
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderOrganisationOutlineHtml(store: PubStore, asAt = new Date()): string {
  const outline = escapeHtml(renderOrganisationOutlineText(store, asAt));
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PSPF Pub organisation structure</title><style>body{font:16px/1.5 sans-serif;max-width:72rem;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap}</style></head><body><pre>${outline}</pre></body></html>`;
}

function buildTeamView(store: PubStore, team: TeamRecord, seen: ReadonlySet<string>): OrgTeamView {
  const nextSeen = new Set([...seen, team.id]);
  const children = sortTeams(
    store.teams.filter((candidate) => candidate.parentTeamId === team.id && !nextSeen.has(candidate.id))
  ).map((child) => buildTeamView(store, child, nextSeen));
  const roles = store.roles
    .filter((role) => role.teamId === team.id && role.status !== "archived")
    .sort(compareTitles)
    .map((role) => roleView(store, role));
  return { id: team.id, title: displayTitle(team.title, "Untitled team"), roles, children };
}

function roleView(store: PubStore, role: RoleRecord): OrgRoleView {
  const assignments = store.assignments.filter((assignment) => assignment.roleId === role.id);
  const status = assignments.some((assignment) => assignment.status === "rotating")
    ? "rotating"
    : assignments.some((assignment) => assignment.badge.toLocaleLowerCase("en-AU").includes("acting"))
      ? "acting"
      : assignments.length > 0
        ? "filled"
        : "vacant";
  return {
    id: role.id,
    title: displayTitle(role.title, "Untitled role"),
    status,
    reportsToRoleId: role.reportsToRoleId
  };
}

function appendTeam(lines: string[], team: OrgTeamView, depth: number): void {
  const indent = "  ".repeat(depth);
  lines.push(`${indent}${team.title}`);
  team.roles.forEach((role) => lines.push(`${indent}  - ${role.title} [${role.status}]`));
  if (team.roles.length === 0) lines.push(`${indent}  - No active roles`);
  team.children.forEach((child) => appendTeam(lines, child, depth + 1));
}

function sortTeams(teams: readonly TeamRecord[]): readonly TeamRecord[] {
  return [...teams].sort(compareTitles);
}

function compareTitles(left: { title: string }, right: { title: string }): number {
  return displayTitle(left.title, "").localeCompare(displayTitle(right.title, ""), "en-AU", { sensitivity: "base" });
}

function displayTitle(value: unknown, fallback: string): string {
  const title = typeof value === "string" ? value.trim() : "";
  return title || fallback;
}
