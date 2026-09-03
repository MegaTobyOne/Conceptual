// Slice R3 (ADR 0097, v1.73.0): team report card. Pure, deterministic, offline.
// Groups requirement gaps and actions by `ownerTeam` and applies the fixed verdict
// rules in TEAM_VERDICT_RULES. Owners are teams, never people.
import type { ActionEntity, ActionStatus, AssessmentStatus, LinkEntity, RequirementEntity } from "./index.js";
import { summariseSlippage } from "./index.js";

export type TeamVerdict = "on-track" | "at-risk" | "stalled" | "no-open-work";

export interface TeamReportCardAnchorRecordStatus {
  readonly actions: Readonly<Record<string, string>>;
  readonly requirements: Readonly<Record<string, string>>;
}

export interface TeamReportCardAnchor {
  readonly capturedAt: string;
  readonly recordStatus?: TeamReportCardAnchorRecordStatus;
}

export interface TeamReportCardInput {
  readonly requirements: readonly RequirementEntity[];
  readonly actions: readonly ActionEntity[];
  readonly links: readonly LinkEntity[];
  /** ISO timestamp used as the clock; never read from the system. */
  readonly now: string;
  /** Length of the reporting period in days; defaults to 30. */
  readonly periodDays?: number;
  readonly anchor?: TeamReportCardAnchor;
}

export interface TeamReportCardNextDue {
  readonly actionTitle: string;
  readonly dueDate: string;
}

export interface TeamReportCardRow {
  /** Owner team label as first seen; "Unassigned" when no ownerTeam is recorded. */
  readonly team: string;
  /**
   * Requirements not yet met that this team owns directly, plus unowned gaps whose open
   * linked actions all belong to this team. Every gap is counted against exactly one row.
   */
  readonly gapsOwned: number;
  readonly gapRequirementTitles: readonly string[];
  readonly open: number;
  /** Open actions due on or after `now` and within `periodDays` ahead. */
  readonly dueInPeriod: number;
  /** Open actions whose due date is before `now`. */
  readonly overdue: number;
  /** Open actions with no parsable due date. */
  readonly noDueDate: number;
  /** Open actions whose due date has moved at least once (more than one history entry). */
  readonly slipped: number;
  /** Sum of whole days each slipped action has moved from its first recorded due date. */
  readonly slippedNetDays: number;
  /**
   * Actions marked done in the period. With an anchor that carries record status this is
   * "status became done since the anchor"; otherwise completedAt (or updatedAt) falls within
   * the trailing `periodDays` window ending at `now`.
   */
  readonly closedInPeriod: number;
  /** closedInPeriod per seven days of the closure window, to one decimal; undefined if the window is empty. */
  readonly velocityPerWeek: number | undefined;
  readonly verdict: TeamVerdict;
  /** The rule text from TEAM_VERDICT_RULES that produced the verdict. */
  readonly verdictRule: string;
  /** Earliest open action due on or after `now`, if any. */
  readonly nextDue?: TeamReportCardNextDue;
}

export interface TeamReportCardTotals {
  /** Named teams (excludes the Unassigned row). */
  readonly teams: number;
  readonly unassignedOpen: number;
}

export interface TeamReportCardModel {
  readonly rows: readonly TeamReportCardRow[];
  readonly periodLabel: string;
  /** Whole days in the closure window behind closedInPeriod and velocityPerWeek (anchor age when an anchor with record status is given, else periodDays). */
  readonly closureWindowDays: number;
  readonly generatedAt: string;
  readonly totals: TeamReportCardTotals;
}

/** Fixed verdict rules, evaluated in this order; the first that matches wins. */
export const TEAM_VERDICT_RULES: Readonly<Record<TeamVerdict, string>> = {
  "no-open-work": "No open actions are owned by this team.",
  stalled: "Nothing was closed in the period and at least one open action is overdue or has slipped.",
  "at-risk":
    "At least one open action is overdue, or more open actions have slipped than were closed in the period, or more than half of open actions have no due date.",
  "on-track":
    "No open action is overdue, slipped actions do not outnumber closures in the period, and at least half of open actions carry a due date."
};

export const TEAM_VERDICT_LABELS: Readonly<Record<TeamVerdict, string>> = {
  stalled: "Stalled",
  "at-risk": "At risk",
  "on-track": "On track",
  "no-open-work": "No open work"
};

export const UNASSIGNED_TEAM_LABEL = "Unassigned";

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNASSIGNED_KEY = "";
const GAP_STATUSES: readonly AssessmentStatus[] = [
  "not-met",
  "partially-met",
  "in-progress",
  "not-started",
  "under-review"
];
const OPEN_STATUSES: readonly ActionStatus[] = ["todo", "in-progress", "blocked"];
const VERDICT_ORDER: readonly TeamVerdict[] = ["stalled", "at-risk", "on-track", "no-open-work"];

export function buildTeamReportCard(input: TeamReportCardInput): TeamReportCardModel {
  const nowMs = Date.parse(input.now);
  const periodDays = input.periodDays ?? DEFAULT_PERIOD_DAYS;
  const requirements = live(input.requirements);
  const actions = live(input.actions);
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const actionIdsByRequirement = buildActionIdsByRequirement(live(input.links));

  const teamNames = new Map<string, string>([[UNASSIGNED_KEY, UNASSIGNED_TEAM_LABEL]]);
  for (const record of [...requirements, ...actions]) {
    const label = record.ownerTeam?.trim() ?? "";
    const key = teamKey(label);
    if (key !== UNASSIGNED_KEY && !teamNames.has(key)) {
      teamNames.set(key, label);
    }
  }

  const anchorActions = input.anchor?.recordStatus?.actions;
  const anchorMs = input.anchor?.recordStatus ? Date.parse(input.anchor.capturedAt) : NaN;
  const closureWindowDays =
    Number.isNaN(anchorMs) || Number.isNaN(nowMs) ? periodDays : (nowMs - anchorMs) / MS_PER_DAY;
  const periodStartMs = nowMs - periodDays * MS_PER_DAY;
  const periodEndMs = nowMs + periodDays * MS_PER_DAY;

  const gapsByTeam = new Map<string, string[]>();
  for (const requirement of requirements) {
    if (!GAP_STATUSES.includes(requirement.assessmentStatus)) {
      continue;
    }
    const key = gapOwnerKey(requirement, actionIdsByRequirement, actionsById);
    const titles = gapsByTeam.get(key) ?? [];
    titles.push(requirement.title);
    gapsByTeam.set(key, titles);
  }

  const rows = [...teamNames.entries()].map(([key, team]): TeamReportCardRow => {
    const owned = actions.filter((action) => teamKey(action.ownerTeam) === key);
    const open = owned.filter(isOpen);
    let dueInPeriod = 0;
    let overdue = 0;
    let noDueDate = 0;
    let slipped = 0;
    let slippedNetDays = 0;
    let nextDue: TeamReportCardNextDue | undefined;
    let nextDueMs = Number.POSITIVE_INFINITY;
    for (const action of open) {
      const dueMs = action.dueDate === undefined ? NaN : Date.parse(action.dueDate);
      if (Number.isNaN(dueMs)) {
        noDueDate += 1;
      } else if (dueMs < nowMs) {
        overdue += 1;
      } else {
        if (dueMs <= periodEndMs) {
          dueInPeriod += 1;
        }
        if (dueMs < nextDueMs || (dueMs === nextDueMs && compareText(action.title, nextDue?.actionTitle ?? "") < 0)) {
          nextDueMs = dueMs;
          nextDue = { actionTitle: action.title, dueDate: action.dueDate! };
        }
      }
      const slippage = summariseSlippage(action, input.now);
      if (slippage.changes >= 1) {
        slipped += 1;
        slippedNetDays += slippage.netDays ?? 0;
      }
    }
    const closedInPeriod = owned.filter((action) => {
      if (action.status !== "done") {
        return false;
      }
      if (anchorActions) {
        return anchorActions[action.id] !== "done";
      }
      const closedMs = Date.parse(action.completedAt ?? action.updatedAt);
      return !Number.isNaN(closedMs) && closedMs >= periodStartMs && closedMs <= nowMs;
    }).length;
    const velocityPerWeek =
      closureWindowDays > 0 ? Math.round((closedInPeriod / (closureWindowDays / 7)) * 10) / 10 : undefined;
    const gapTitles = [...(gapsByTeam.get(key) ?? [])].sort(compareText);
    const verdict = decideVerdict({ open: open.length, overdue, slipped, noDueDate, closedInPeriod });
    return {
      team,
      gapsOwned: gapTitles.length,
      gapRequirementTitles: gapTitles,
      open: open.length,
      dueInPeriod,
      overdue,
      noDueDate,
      slipped,
      slippedNetDays,
      closedInPeriod,
      velocityPerWeek,
      verdict,
      verdictRule: TEAM_VERDICT_RULES[verdict],
      ...(nextDue ? { nextDue } : {})
    };
  });

  rows.sort((left, right) => {
    const leftUnassigned = left.team === UNASSIGNED_TEAM_LABEL ? 1 : 0;
    const rightUnassigned = right.team === UNASSIGNED_TEAM_LABEL ? 1 : 0;
    return (
      leftUnassigned - rightUnassigned ||
      VERDICT_ORDER.indexOf(left.verdict) - VERDICT_ORDER.indexOf(right.verdict) ||
      compareText(left.team, right.team)
    );
  });

  const unassigned = rows.find((row) => row.team === UNASSIGNED_TEAM_LABEL);
  return {
    rows,
    periodLabel: input.anchor?.recordStatus
      ? `Since ${formatDate(input.anchor.capturedAt)}`
      : `Last ${periodDays} ${periodDays === 1 ? "day" : "days"}`,
    closureWindowDays: Math.max(0, Math.round(closureWindowDays)),
    generatedAt: input.now,
    totals: {
      teams: rows.length - 1,
      unassignedOpen: unassigned?.open ?? 0
    }
  };
}

/** One sentence naming the verdict and the observed facts that triggered its rule. */
export function describeTeamVerdict(row: TeamReportCardRow): string {
  const actions = (count: number): string => `${count} ${count === 1 ? "action" : "actions"}`;
  switch (row.verdict) {
    case "no-open-work":
      return row.gapsOwned === 0
        ? `${row.team} has no open work and owns no requirement gaps.`
        : `${row.team} has no open work, although it owns ${row.gapsOwned} requirement ${row.gapsOwned === 1 ? "gap" : "gaps"} with no open action to move ${row.gapsOwned === 1 ? "it" : "them"}.`;
    case "stalled":
      return `${row.team} is stalled: nothing was closed in the period while ${actions(row.overdue)} ${row.overdue === 1 ? "is" : "are"} overdue and ${row.slipped} ${row.slipped === 1 ? "has" : "have"} slipped.`;
    case "at-risk":
      return `${row.team} is at risk: ${row.overdue} of ${actions(row.open)} ${row.overdue === 1 ? "is" : "are"} overdue, ${row.slipped} ${row.slipped === 1 ? "has" : "have"} slipped against ${row.closedInPeriod} closed in the period, and ${row.noDueDate} ${row.noDueDate === 1 ? "has" : "have"} no due date.`;
    case "on-track":
      return `${row.team} is on track: ${actions(row.closedInPeriod)} closed in the period, ${row.open} open, none overdue, and ${row.noDueDate} without a due date.`;
  }
}

function decideVerdict(counts: {
  readonly open: number;
  readonly overdue: number;
  readonly slipped: number;
  readonly noDueDate: number;
  readonly closedInPeriod: number;
}): TeamVerdict {
  if (counts.open === 0) {
    return "no-open-work";
  }
  if (counts.closedInPeriod === 0 && (counts.overdue >= 1 || counts.slipped >= 1)) {
    return "stalled";
  }
  if (
    counts.overdue >= 1 ||
    (counts.slipped >= 1 && counts.closedInPeriod < counts.slipped) ||
    counts.noDueDate > counts.open / 2
  ) {
    return "at-risk";
  }
  return "on-track";
}

function gapOwnerKey(
  requirement: RequirementEntity,
  actionIdsByRequirement: ReadonlyMap<string, readonly string[]>,
  actionsById: ReadonlyMap<string, ActionEntity>
): string {
  const own = teamKey(requirement.ownerTeam);
  if (own !== UNASSIGNED_KEY) {
    return own;
  }
  const openLinked = (actionIdsByRequirement.get(requirement.id) ?? [])
    .map((id) => actionsById.get(id))
    .filter((action): action is ActionEntity => action !== undefined && isOpen(action));
  if (openLinked.length === 0) {
    return UNASSIGNED_KEY;
  }
  const keys = new Set(openLinked.map((action) => teamKey(action.ownerTeam)));
  return keys.size === 1 ? [...keys][0]! : UNASSIGNED_KEY;
}

function buildActionIdsByRequirement(links: readonly LinkEntity[]): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType !== "requirement" || link.toType !== "action" || link.linkType !== "addressed-by") {
      continue;
    }
    const current = map.get(link.fromId) ?? [];
    if (!current.includes(link.toId)) {
      current.push(link.toId);
    }
    map.set(link.fromId, current);
  }
  return map;
}

function live<T extends { readonly recordStatus: string }>(items: readonly T[]): readonly T[] {
  return items.filter((item) => item.recordStatus !== "deleted");
}

function isOpen(action: ActionEntity): boolean {
  return OPEN_STATUSES.includes(action.status);
}

function teamKey(label: string | undefined): string {
  const trimmed = label?.trim() ?? "";
  return trimmed.length === 0 ? UNASSIGNED_KEY : trimmed.toLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en-AU", { sensitivity: "base" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// Fixed month table rather than Intl so the label is identical across ICU versions.
function formatDate(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return "an unknown date";
  }
  const date = new Date(ms);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
