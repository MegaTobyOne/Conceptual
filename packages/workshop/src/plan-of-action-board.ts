import type { ActionEntity, ActionImpactUrgency, LinkEntity, V01Entity, V01EntityType } from "@pspf/contracts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PLAN_OF_ACTION_PHASES = [
  {
    id: "assure-evidence",
    title: "Assure evidence",
    summary: "Close missing, stale, changed and unlinked evidence so decisions can stand on current proof."
  },
  {
    id: "reduce-risk",
    title: "Reduce risk",
    summary: "Treat material risks and residual exposure that constrain authorisation or assurance confidence."
  },
  {
    id: "lift-posture",
    title: "Lift posture",
    summary: "Progress control uplift and blocked work that moves PSPF maturity."
  },
  {
    id: "set-direction",
    title: "Set direction",
    summary: "Connect Directions, strategy choices and governance decisions to the work program."
  },
  {
    id: "prepare-reporting",
    title: "Prepare reporting",
    summary: "Package evidence, posture and decision records for reporting and succession."
  }
] as const;

export type PlanOfActionPhaseId = (typeof PLAN_OF_ACTION_PHASES)[number]["id"];

export interface PlanOfActionTaskModel {
  readonly id: string;
  readonly actionId: string;
  readonly phaseId: PlanOfActionPhaseId;
  readonly title: string;
  readonly status: string;
  readonly urgency: ActionImpactUrgency;
  readonly startDate: string;
  readonly endDate: string;
  readonly dueDate?: string;
  readonly showLabelInTimeline: boolean;
  readonly timelineLabel?: string;
  readonly x: number;
  readonly width: number;
  readonly linkedRequirements: number;
  readonly linkedEvidence: number;
  readonly linkedRisks: number;
  readonly linkedDirections: number;
  readonly impactTotal: number;
}

export interface PlanOfActionPhaseModel {
  readonly id: PlanOfActionPhaseId;
  readonly title: string;
  readonly summary: string;
  readonly tasks: readonly PlanOfActionTaskModel[];
}

export interface PlanOfActionBoardModel {
  readonly generatedAt: string;
  readonly timelineStart: string;
  readonly timelineEnd: string;
  readonly today: string;
  readonly todayX: number;
  readonly totalDays: number;
  readonly dayWidth: number;
  readonly timelineWidth: number;
  readonly phases: readonly PlanOfActionPhaseModel[];
  readonly metrics: {
    readonly actions: number;
    readonly blocked: number;
    readonly overdue: number;
    readonly dueSoon: number;
    readonly linkedRequirements: number;
    readonly linkedRisks: number;
  };
}

export function buildPlanOfActionBoardModel(
  entities: readonly V01Entity[],
  options: {
    readonly now?: Date;
    readonly maxTimelineWidth?: number;
    readonly timelineDateHints?: readonly { readonly startDate: string; readonly endDate?: string }[];
  } = {}
): PlanOfActionBoardModel {
  const now = startOfUtcDay(options.now ?? new Date());
  const maxTimelineWidth = options.maxTimelineWidth ?? 1100;
  const actions = entities.filter(
    (entity): entity is ActionEntity => entity.entityType === "action" && entity.recordStatus !== "deleted"
  );
  const links = entities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.recordStatus !== "deleted"
  );
  const taskDates = actions.map((action, index) => deriveTaskDates(action, now, index));
  const hintedDates = (options.timelineDateHints ?? []).flatMap((hint) => {
    const startDate = parseDate(hint.startDate);
    const endDate = parseDate(hint.endDate) ?? startDate;
    return startDate && endDate ? [{ startDate, endDate }] : [];
  });
  const timelineStart = minDate([
    now,
    ...taskDates.map((dates) => dates.startDate),
    ...hintedDates.map((dates) => dates.startDate)
  ]);
  const timelineEnd = maxDate([
    addDays(now, 30),
    ...taskDates.map((dates) => dates.endDate),
    ...hintedDates.map((dates) => dates.endDate)
  ]);
  const totalDays = Math.max(1, diffDays(timelineStart, timelineEnd) + 1);
  const dayWidth = Math.min(18, maxTimelineWidth / totalDays);
  const timelineWidth = Math.ceil(totalDays * dayWidth);
  const tasks = actions
    .map((action, index) => {
      const dates = taskDates[index] ?? deriveTaskDates(action, now, index);
      const phaseId = classifyActionPhase(action);
      const linkedCounts = countActionLinks(action.id, links);
      const x = Math.max(0, Math.round(diffDays(timelineStart, dates.startDate) * dayWidth));
      const durationDays = Math.max(1, diffDays(dates.startDate, dates.endDate) + 1);
      const width = Math.max(18, Math.round(durationDays * dayWidth));
      const showLabelInTimeline = normaliseTaskLabelVisibility();
      return {
        id: action.id,
        actionId: action.id,
        phaseId,
        title: action.title,
        status: action.status,
        urgency: action.impact?.urgency ?? "normal",
        startDate: toIsoDateOnly(dates.startDate),
        endDate: toIsoDateOnly(dates.endDate),
        dueDate: action.dueDate,
        showLabelInTimeline,
        timelineLabel: showLabelInTimeline ? fitPlanOfActionLabel(action.title, width) : undefined,
        x,
        width,
        linkedRequirements: linkedCounts.requirement,
        linkedEvidence: linkedCounts.evidence,
        linkedRisks: linkedCounts.risk,
        linkedDirections: linkedCounts.direction,
        impactTotal: impactTotal(action)
      } satisfies PlanOfActionTaskModel;
    })
    .sort(comparePlanTasks);

  const phases = PLAN_OF_ACTION_PHASES.map((phase) => ({
    ...phase,
    tasks: tasks.filter((task) => task.phaseId === phase.id)
  }));
  const activeTasks = tasks.filter((task) => !["done", "cancelled"].includes(task.status));

  return {
    generatedAt: now.toISOString(),
    timelineStart: toIsoDateOnly(timelineStart),
    timelineEnd: toIsoDateOnly(timelineEnd),
    today: toIsoDateOnly(now),
    todayX: Math.max(0, Math.round(diffDays(timelineStart, now) * dayWidth)),
    totalDays,
    dayWidth,
    timelineWidth,
    phases,
    metrics: {
      actions: activeTasks.length,
      blocked: activeTasks.filter((task) => task.urgency === "blocked").length,
      overdue: activeTasks.filter((task) => task.urgency === "overdue").length,
      dueSoon: activeTasks.filter((task) => task.urgency === "due-soon").length,
      linkedRequirements: uniqueLinkedCount("requirement", links, actions),
      linkedRisks: uniqueLinkedCount("risk", links, actions)
    }
  };
}

export function normaliseTaskLabelVisibility(value?: boolean): boolean {
  return value !== false;
}

export function fitPlanOfActionLabel(title: string, barWidth: number): string | undefined {
  if (barWidth < 44) {
    return undefined;
  }
  const maxCharacters = Math.max(0, Math.floor((barWidth - 14) / 7));
  if (maxCharacters < 4) {
    return undefined;
  }
  if (title.length <= maxCharacters) {
    return title;
  }
  return `${title.slice(0, Math.max(1, maxCharacters - 3)).trimEnd()}...`;
}

function classifyActionPhase(action: ActionEntity): PlanOfActionPhaseId {
  const impact = action.impact;
  if ((impact?.directionUplift ?? 0) > 0) {
    return "set-direction";
  }
  if ((impact?.riskReduction ?? 0) > 0) {
    return "reduce-risk";
  }
  if ((impact?.evidenceUplift ?? 0) > 0) {
    return "assure-evidence";
  }
  if ((impact?.postureUplift ?? 0) > 0 || action.impact?.urgency === "blocked") {
    return "lift-posture";
  }
  return "prepare-reporting";
}

function deriveTaskDates(
  action: ActionEntity,
  now: Date,
  fallbackIndex: number
): { readonly startDate: Date; readonly endDate: Date } {
  const urgency = action.impact?.urgency ?? "normal";
  const endDate = parseDate(action.endDate) ?? parseDate(action.dueDate) ?? addDays(now, 14 + fallbackIndex * 3);
  const durationDays = urgency === "blocked" ? 14 : urgency === "overdue" ? 10 : urgency === "due-soon" ? 7 : 12;
  const startDate = parseDate(action.startDate) ?? addDays(endDate, -(durationDays - 1));
  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
}

function countActionLinks(
  actionId: string,
  links: readonly LinkEntity[]
): Record<"requirement" | "evidence" | "risk" | "direction", number> {
  const linkedIds: Record<"requirement" | "evidence" | "risk" | "direction", Set<string>> = {
    requirement: new Set(),
    evidence: new Set(),
    risk: new Set(),
    direction: new Set()
  };
  for (const link of links) {
    if (link.fromId === actionId) {
      addLinkedId(link.toType, link.toId, linkedIds);
    }
    if (link.toId === actionId) {
      addLinkedId(link.fromType, link.fromId, linkedIds);
    }
  }
  return {
    requirement: linkedIds.requirement.size,
    evidence: linkedIds.evidence.size,
    risk: linkedIds.risk.size,
    direction: linkedIds.direction.size
  };
}

function addLinkedId(
  entityType: V01EntityType,
  entityId: string,
  linkedIds: Record<"requirement" | "evidence" | "risk" | "direction", Set<string>>
): void {
  if (
    entityType === "requirement" ||
    entityType === "evidence" ||
    entityType === "risk" ||
    entityType === "direction"
  ) {
    linkedIds[entityType].add(entityId);
  }
}

function uniqueLinkedCount(
  entityType: "requirement" | "risk",
  links: readonly LinkEntity[],
  actions: readonly ActionEntity[]
): number {
  const actionIds = new Set(actions.map((action) => action.id));
  const linkedIds = new Set<string>();
  for (const link of links) {
    if (link.fromType === entityType && actionIds.has(link.toId)) {
      linkedIds.add(link.fromId);
    }
    if (link.toType === entityType && actionIds.has(link.fromId)) {
      linkedIds.add(link.toId);
    }
  }
  return linkedIds.size;
}

function impactTotal(action: ActionEntity): number {
  const impact = action.impact;
  return impact
    ? (impact.postureUplift ?? 0) +
        (impact.evidenceUplift ?? 0) +
        (impact.riskReduction ?? 0) +
        (impact.directionUplift ?? 0)
    : 0;
}

function comparePlanTasks(left: PlanOfActionTaskModel, right: PlanOfActionTaskModel): number {
  const urgencyOrder: Record<ActionImpactUrgency, number> = { blocked: 0, overdue: 1, "due-soon": 2, normal: 3 };
  return (
    urgencyOrder[left.urgency] - urgencyOrder[right.urgency] ||
    left.endDate.localeCompare(right.endDate) ||
    right.impactTotal - left.impactTotal ||
    left.title.localeCompare(right.title)
  );
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : startOfUtcDay(parsed);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(startDate: Date, endDate: Date): number {
  return Math.round((startOfUtcDay(endDate).getTime() - startOfUtcDay(startDate).getTime()) / MS_PER_DAY);
}

function minDate(dates: readonly Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(dates: readonly Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
