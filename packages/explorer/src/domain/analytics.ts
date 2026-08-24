/**
 * Pure analytics helpers: aggregations over the live data stores.
 */

import type {
  Action,
  ComplianceEntry,
  ComplianceEvent,
  ComplianceState,
  Direction,
  DirectionResponseState,
  RequirementId,
  Risk,
  EssentialEightControlKey,
} from '../data/types.ts';
import { asRequirementId } from '../data/types.ts';
import { allRequirements } from '../pspf/index.ts';
import {
  buildConsequenceStatement,
  buildUncoveredRiskStatement,
  classifyBlocker,
  describeChangeRollup,
  isExpiringWithinDays,
  isWithinFreshnessWindow,
  rankBlockersByFanIn,
  summariseAssessmentBasis,
  summariseUncoveredRisk,
  type AssessmentBasisSummary,
  type BlockerClass,
} from '@pspf/contracts';

export interface ComplianceBreakdown {
  total: number;
  byState: Record<ComplianceState, number>;
  compliantPct: number;
}

export const ESSENTIAL_EIGHT_REQUIREMENT_IDS: readonly RequirementId[] = [
  asRequirementId('TECH-099'),
  asRequirementId('TECH-100'),
  asRequirementId('TECH-101'),
  asRequirementId('TECH-102'),
  asRequirementId('TECH-103'),
  asRequirementId('TECH-104'),
  asRequirementId('TECH-105'),
  asRequirementId('TECH-106'),
];

export const ESSENTIAL_EIGHT_CATCHALL_ID: RequirementId = asRequirementId('TECH-107');

export interface EssentialEightCoverage {
  totalControls: number;
  implementedControls: number;
  applicableControls: number;
  implementedPct: number;
  byState: Record<ComplianceState, number>;
  controls: readonly {
    requirementId: RequirementId;
    state: ComplianceState;
    control?: EssentialEightControlKey;
  }[];
  catchall: {
    requirementId: RequirementId;
    state: ComplianceState;
  };
}

export interface DirectionsSummary {
  total: number;
  byState: Record<DirectionResponseState, number>;
  addressedPct: number;
  needsResponseCount: number;
}

const ZERO_BY_STATE: Record<ComplianceState, number> = {
  yes: 0,
  no: 0,
  'risk-managed': 0,
  'not-applicable': 0,
  'not-set': 0,
};

export function complianceBreakdown(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
): ComplianceBreakdown {
  const byState: Record<ComplianceState, number> = { ...ZERO_BY_STATE };
  for (const r of allRequirements) {
    const entry = compliance.get(r.id);
    const state: ComplianceState = entry ? entry.state : 'not-set';
    byState[state] += 1;
  }
  const total = allRequirements.length;
  const denominator = total - byState['not-applicable'];
  const compliantPct = denominator === 0 ? 0 : Math.round((byState.yes / denominator) * 100);
  return { total, byState, compliantPct };
}

/**
 * J1 (v1.53.0 UX review): basis of the 'yes' (fully implemented) compliance
 * entries — how many are backed by evidence, and how much of that evidence
 * falls within the freshness window. A compliance entry with no evidence
 * entries is asserted; with evidence but none recent is evidenced; with at
 * least one recent evidence entry is evidenced-fresh.
 */
export function metComplianceBasis(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
  referenceDate: Date = new Date(),
): AssessmentBasisSummary {
  const metEntries = [...compliance.values()].filter((entry) => entry.state === 'yes');
  return summariseAssessmentBasis(
    metEntries.map((entry) => ({
      evidenceCount: entry.evidence.length,
      freshEvidenceCount: entry.evidence.filter((item) =>
        isWithinFreshnessWindow(item.addedAt, referenceDate),
      ).length,
    })),
  );
}

export type RiskBand = 'low' | 'medium' | 'high' | 'extreme';

/**
 * J2 (v1.55.0 UX review): "why care" statement for a single requirement,
 * derived from its linked open risks and current compliance state.
 */
export function requirementConsequence(
  requirementId: RequirementId,
  state: ComplianceState,
  risks: readonly Risk[],
): string {
  const linkedOpenRisks = risks.filter(
    (risk) => risk.requirementIds.includes(requirementId) && risk.status !== 'closed',
  );
  return buildConsequenceStatement({
    met: state === 'yes',
    openLinkedRiskCount: linkedOpenRisks.length,
    maxLinkedRiskSeverity: linkedOpenRisks.reduce(
      (max, risk) => Math.max(max, risk.likelihood * risk.impact),
      0,
    ),
  });
}

/**
 * Ecosystem-wide "why care" lead statement: of all open risks, how many have
 * no requirement covering them that is currently fully implemented ('yes').
 */
export function uncoveredRiskStatement(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
  risks: readonly Risk[],
): string {
  const metRequirementIds = new Set(
    [...compliance.entries()].filter(([, entry]) => entry.state === 'yes').map(([id]) => id),
  );
  const openRisks = risks.filter((risk) => risk.status !== 'closed');
  const coverage = new Map<string, boolean>(
    openRisks.map((risk) => [risk.id, risk.requirementIds.some((id) => metRequirementIds.has(id))]),
  );
  return buildUncoveredRiskStatement(summariseUncoveredRisk(openRisks, coverage));
}

/**
 * J3 (v1.56.0 UX review): ranks open actions by how many not-met linked
 * requirements they gate, so the highest-leverage blocker surfaces first.
 */
export interface RankedActionBlocker {
  readonly actionId: string;
  readonly title: string;
  readonly gatedRequirementCount: number;
  readonly blockerClass: BlockerClass;
}

export function topActionBlockers(
  actions: readonly Action[],
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
  limit = 5,
): readonly RankedActionBlocker[] {
  const openActions = actions.filter(
    (action) => action.status !== 'done' && action.status !== 'cancelled',
  );
  const candidates = openActions.map((action) => ({
    id: action.id,
    gatedRequirementIds: action.requirementIds.filter((id) => {
      const entry = compliance.get(id);
      const state: ComplianceState = entry ? entry.state : 'not-set';
      return state !== 'yes' && state !== 'not-applicable';
    }),
  }));
  const ranked = rankBlockersByFanIn(candidates, limit);
  const actionsById = new Map(openActions.map((action) => [action.id, action]));
  return ranked.flatMap((entry) => {
    const action = actionsById.get(entry.id as Action['id']);
    if (!action) return [];
    return [
      {
        actionId: entry.id,
        title: action.title,
        gatedRequirementCount: entry.gatedRequirementCount,
        blockerClass: classifyBlocker({
          isReviewType: action.type === 'review',
          hasCommercialLink: false,
        }),
      },
    ];
  });
}

/**
 * Staleness preview: count of requirements whose 'yes' compliance entry has
 * evidence that will fall outside the freshness window within 90 days —
 * i.e. requirements that will become less compliant soon unless refreshed.
 */
export function evidenceExpiringSoonCount(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
  referenceDate: Date = new Date(),
): number {
  let count = 0;
  for (const entry of compliance.values()) {
    if (
      entry.state === 'yes' &&
      entry.evidence.some((item) => isExpiringWithinDays(item.addedAt, referenceDate))
    ) {
      count += 1;
    }
  }
  return count;
}

export function riskBandOf(score: number): RiskBand {
  if (score >= 16) return 'extreme';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function riskBandCounts(risks: readonly Risk[]): Record<RiskBand, number> {
  const out: Record<RiskBand, number> = { low: 0, medium: 0, high: 0, extreme: 0 };
  for (const r of risks) {
    if (r.status === 'closed') continue;
    out[riskBandOf(r.likelihood * r.impact)] += 1;
  }
  return out;
}

export function actionStatusCounts(actions: readonly Action[]): Record<string, number> {
  const out: Record<string, number> = {
    todo: 0,
    'in-progress': 0,
    blocked: 0,
    done: 0,
    cancelled: 0,
  };
  for (const a of actions) {
    out[a.status] = (out[a.status] ?? 0) + 1;
  }
  return out;
}

export function overdueActionCount(actions: readonly Action[], now = Date.now()): number {
  let n = 0;
  for (const a of actions) {
    if (!a.dueAt) continue;
    if (a.status === 'done' || a.status === 'cancelled') continue;
    if (new Date(a.dueAt).getTime() < now) n += 1;
  }
  return n;
}

export interface ComplianceChangePoint {
  requirementId: RequirementId;
  changedAt: string;
  fromState: ComplianceState;
  toState: ComplianceState;
}

export function complianceEventsSince(
  events: readonly ComplianceEvent[],
  from: Date,
  requirementId?: RequirementId,
): readonly ComplianceChangePoint[] {
  const fromTime = from.getTime();
  return events
    .filter((event) => new Date(event.createdAt).getTime() >= fromTime)
    .filter((event) => requirementId === undefined || event.requirementId === requirementId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((event) => ({
      requirementId: event.requirementId,
      changedAt: event.createdAt,
      fromState: event.fromState,
      toState: event.toState,
    }));
}

/**
 * J5 (v1.59.0 UX review): roll-up narrative for a reader-anchored change
 * period. "Improved" and "regressed" are derived from recorded compliance
 * transitions; "went stale" reuses the S3 staleness-preview count so no new
 * event storage is required.
 */
export function changeRollupStatement(
  changes: readonly ComplianceChangePoint[],
  expiringSoonCount: number,
): string {
  const improved = changes.filter((change) => change.toState === 'yes').length;
  const regressed = changes.filter(
    (change) => change.fromState === 'yes' && change.toState !== 'yes',
  ).length;
  return describeChangeRollup({ improved, regressed, wentStale: expiringSoonCount });
}

export function essentialEightCoverage(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
): EssentialEightCoverage {
  const byState: Record<ComplianceState, number> = { ...ZERO_BY_STATE };

  const controls = ESSENTIAL_EIGHT_REQUIREMENT_IDS.map((requirementId) => {
    const requirement = allRequirements.find((entry) => entry.id === requirementId);
    const state: ComplianceState = compliance.get(requirementId)?.state ?? 'not-set';
    byState[state] += 1;
    return {
      requirementId,
      state,
      ...(requirement?.essentialEightControl ? { control: requirement.essentialEightControl } : {}),
    };
  });

  const applicableControls = controls.length - byState['not-applicable'];
  const implementedControls = byState.yes;
  const implementedPct =
    applicableControls === 0 ? 0 : Math.round((implementedControls / applicableControls) * 100);

  return {
    totalControls: controls.length,
    implementedControls,
    applicableControls,
    implementedPct,
    byState,
    controls,
    catchall: {
      requirementId: ESSENTIAL_EIGHT_CATCHALL_ID,
      state: compliance.get(ESSENTIAL_EIGHT_CATCHALL_ID)?.state ?? 'not-set',
    },
  };
}

export function directionsSummary(directions: readonly Direction[]): DirectionsSummary {
  const byState: Record<DirectionResponseState, number> = {
    yes: 0,
    no: 0,
    'risk-managed': 0,
    'not-set': 0,
  };
  for (const direction of directions) {
    byState[direction.responseState] += 1;
  }
  const total = directions.length;
  const needsResponseCount = byState['not-set'];
  const addressed = total - needsResponseCount;
  const addressedPct = total === 0 ? 0 : Math.round((addressed / total) * 100);
  return {
    total,
    byState,
    addressedPct,
    needsResponseCount,
  };
}
