/**
 * Pure analytics helpers: aggregations over the live data stores.
 */

import type {
  Action,
  ComplianceEntry,
  ComplianceState,
  Direction,
  DirectionResponseState,
  RequirementId,
  Risk,
  EssentialEightControlKey,
} from '../data/types.ts';
import { asRequirementId } from '../data/types.ts';
import { allRequirements } from '../pspf/index.ts';

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

export type RiskBand = 'low' | 'medium' | 'high' | 'extreme';

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
