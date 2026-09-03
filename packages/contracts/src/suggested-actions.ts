// Slice R4 (ADR 0097, v1.74.0): suggested actions for requirement gaps with no open work.
// Pure, deterministic, offline. Owners are teams, never people.
import type {
  ActionEntity,
  ActionStatus,
  AssessmentStatus,
  LinkEntity,
  RequirementEntity,
  RiskEntity
} from "./index.js";

export interface SuggestedActionExplainer {
  readonly whatToDoNext: string;
  readonly sectionCode?: string;
}

export interface SuggestedActionInput {
  readonly requirements: readonly RequirementEntity[];
  readonly actions: readonly ActionEntity[];
  readonly links: readonly LinkEntity[];
  readonly risks: readonly RiskEntity[];
  /** ISO timestamp used as the clock; never read from the system. */
  readonly now: string;
  /** Looks up the requirement explainer; undefined when no reference text exists. */
  readonly explainerFor: (requirementId: string) => SuggestedActionExplainer | undefined;
  /** Maximum suggestions returned; defaults to 10. */
  readonly limit?: number;
}

export interface SuggestedAction {
  readonly requirementId: string;
  readonly requirementTitle: string;
  readonly domainId: string;
  readonly title: string;
  readonly rationale: string;
  readonly ownerTeam?: string;
  /** ISO date (YYYY-MM-DD) `SUGGESTED_DUE_DAYS` after `now`. */
  readonly suggestedDueDate: string;
  readonly impactScore: number;
  /** The facts that produced `impactScore`, one per line. */
  readonly impactExplanation: readonly string[];
}

export const SUGGESTED_DUE_DAYS = 60;

const DEFAULT_LIMIT = 10;
const MAX_TITLE_LENGTH = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GAP_STATUSES: readonly AssessmentStatus[] = [
  "not-met",
  "partially-met",
  "not-started",
  "in-progress",
  "under-review"
];
const OPEN_ACTION_STATUSES: readonly ActionStatus[] = ["todo", "in-progress", "blocked"];
const STATUS_LABELS: Readonly<Record<AssessmentStatus, string>> = {
  "not-started": "not started",
  "in-progress": "in progress",
  met: "met",
  "partially-met": "partially met",
  "not-met": "not met",
  "not-applicable": "not applicable",
  "under-review": "under review"
};
const STATUS_WEIGHT: Readonly<Partial<Record<AssessmentStatus, number>>> = { "not-met": 2, "partially-met": 1 };

/**
 * Suggests one action per applicable requirement gap that has no open linked action.
 * Sorted by impactScore descending, then requirement title (en-AU). Input is not mutated.
 */
export function buildSuggestedActions(input: SuggestedActionInput): readonly SuggestedAction[] {
  const nowMs = Date.parse(input.now);
  if (Number.isNaN(nowMs)) {
    throw new Error("buildSuggestedActions requires an ISO timestamp for now.");
  }
  const suggestedDueDate = new Date(nowMs + SUGGESTED_DUE_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const actionsById = new Map(live(input.actions).map((action) => [action.id, action]));
  const risksById = new Map(live(input.risks).map((risk) => [risk.id, risk]));
  const links = live(input.links).filter((link) => link.fromType === "requirement");
  const actionIdsByRequirement = groupTargets(links, "addressed-by", "action");
  const riskIdsByRequirement = groupTargets(links, "exposed-by", "risk");

  const suggestions = live(input.requirements)
    .filter((requirement) => GAP_STATUSES.includes(requirement.assessmentStatus))
    .filter(
      (requirement) =>
        !(actionIdsByRequirement.get(requirement.id) ?? []).some((id) => {
          const action = actionsById.get(id);
          return action !== undefined && OPEN_ACTION_STATUSES.includes(action.status);
        })
    )
    .map((requirement): SuggestedAction => {
      const openRisks = (riskIdsByRequirement.get(requirement.id) ?? []).filter((id) => {
        const risk = risksById.get(id);
        return risk !== undefined && risk.status !== "closed";
      }).length;
      const statusWeight = STATUS_WEIGHT[requirement.assessmentStatus] ?? 0;
      const statusLabel = STATUS_LABELS[requirement.assessmentStatus];
      const ownerTeam = requirement.ownerTeam?.trim();
      return {
        requirementId: requirement.id,
        requirementTitle: requirement.title,
        domainId: requirement.domainId,
        title: suggestedTitle(input.explainerFor(requirement.id), requirement.title),
        rationale: `Suggested because ${requirement.title} is ${statusLabel} and has no open action.`,
        ...(ownerTeam ? { ownerTeam } : {}),
        suggestedDueDate,
        impactScore: 1 + openRisks * 2 + statusWeight,
        impactExplanation: [
          "Base score of 1 for a requirement gap with no open action.",
          `Linked to ${openRisks} risk(s) not yet closed (+2 each).`,
          `Assessment status is ${statusLabel} (+${statusWeight}).`
        ]
      };
    })
    .sort(
      (left, right) =>
        right.impactScore - left.impactScore ||
        left.requirementTitle.localeCompare(right.requirementTitle, "en-AU", { sensitivity: "base" }) ||
        left.requirementId.localeCompare(right.requirementId)
    );

  return suggestions.slice(0, Math.max(0, limit));
}

function suggestedTitle(explainer: SuggestedActionExplainer | undefined, requirementTitle: string): string {
  const text = explainer?.whatToDoNext.trim() ?? "";
  if (text.length === 0) {
    return `Close the gap for ${requirementTitle}`;
  }
  const sentence = (text.split(/(?<=[.!?])\s+/u)[0] ?? text).trim();
  return sentence.length <= MAX_TITLE_LENGTH ? sentence : `${sentence.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

function groupTargets(
  links: readonly LinkEntity[],
  linkType: LinkEntity["linkType"],
  toType: LinkEntity["toType"]
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) {
    if (link.linkType !== linkType || link.toType !== toType) {
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
