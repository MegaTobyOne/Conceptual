import { describe, expect, it } from 'vitest';
import {
  actionStatusCounts,
  complianceBreakdown,
  directionsSummary,
  ESSENTIAL_EIGHT_CATCHALL_ID,
  ESSENTIAL_EIGHT_REQUIREMENT_IDS,
  essentialEightCoverage,
  overdueActionCount,
  riskBandCounts,
  riskBandOf,
} from './analytics.ts';
import { allRequirements } from '../pspf/index.ts';
import type { Action, ComplianceEntry, Direction, RequirementId, Risk } from '../data/types.ts';

const now = new Date('2026-05-05T00:00:00Z').toISOString();

function entry(id: RequirementId, state: ComplianceEntry['state']): ComplianceEntry {
  return { requirementId: id, state, evidence: [], createdAt: now, updatedAt: now };
}

describe('complianceBreakdown', () => {
  it('treats missing entries as not-set and ignores n/a in the percentage', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    const [a, b, c] = allRequirements;
    m.set(a!.id, entry(a!.id, 'yes'));
    m.set(b!.id, entry(b!.id, 'not-applicable'));
    m.set(c!.id, entry(c!.id, 'no'));
    const out = complianceBreakdown(m);
    expect(out.total).toBe(allRequirements.length);
    expect(out.byState.yes).toBe(1);
    expect(out.byState['not-applicable']).toBe(1);
    expect(out.byState['not-set']).toBe(allRequirements.length - 3);
    // 1 yes / (total - 1 n/a)
    expect(out.compliantPct).toBe(Math.round((1 / (allRequirements.length - 1)) * 100));
  });
});

describe('riskBandOf / riskBandCounts', () => {
  it('classifies bands correctly', () => {
    expect(riskBandOf(1)).toBe('low');
    expect(riskBandOf(5)).toBe('medium');
    expect(riskBandOf(10)).toBe('high');
    expect(riskBandOf(20)).toBe('extreme');
  });
  it('counts bands and excludes closed risks', () => {
    const r = (l: number, i: number, status: Risk['status']): Risk => ({
      id: `${l}-${i}-${status}` as Risk['id'],
      title: 't',
      likelihood: l as 1,
      impact: i as 1,
      status,
      requirementIds: [],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const counts = riskBandCounts([r(1, 1, 'open'), r(4, 5, 'open'), r(5, 5, 'closed')]);
    expect(counts.low).toBe(1);
    expect(counts.extreme).toBe(1);
    expect(counts.high).toBe(0);
  });
});

describe('actionStatusCounts / overdueActionCount', () => {
  const a = (status: Action['status'], dueAt?: string): Action => ({
    id: `${status}-${dueAt ?? 'x'}` as Action['id'],
    title: 't',
    type: 'remediation',
    status,
    ...(dueAt ? { dueAt } : {}),
    requirementIds: [],
    riskIds: [],
    createdAt: now,
    updatedAt: now,
  });
  it('counts statuses', () => {
    const counts = actionStatusCounts([a('todo'), a('todo'), a('done')]);
    expect(counts.todo).toBe(2);
    expect(counts.done).toBe(1);
  });
  it('counts overdue (excluding done/cancelled)', () => {
    const past = '2020-01-01';
    const future = '2099-01-01';
    const list = [a('in-progress', past), a('done', past), a('todo', future), a('blocked', past)];
    expect(overdueActionCount(list, Date.parse('2026-05-05'))).toBe(2);
  });
});

describe('essentialEightCoverage', () => {
  it('summarises TECH-099..TECH-106 and includes TECH-107 catchall state', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(ESSENTIAL_EIGHT_REQUIREMENT_IDS[0]!, entry(ESSENTIAL_EIGHT_REQUIREMENT_IDS[0]!, 'yes'));
    m.set(ESSENTIAL_EIGHT_REQUIREMENT_IDS[1]!, entry(ESSENTIAL_EIGHT_REQUIREMENT_IDS[1]!, 'yes'));
    m.set(
      ESSENTIAL_EIGHT_REQUIREMENT_IDS[2]!,
      entry(ESSENTIAL_EIGHT_REQUIREMENT_IDS[2]!, 'not-applicable'),
    );
    m.set(ESSENTIAL_EIGHT_CATCHALL_ID, entry(ESSENTIAL_EIGHT_CATCHALL_ID, 'risk-managed'));

    const out = essentialEightCoverage(m);
    expect(out.totalControls).toBe(8);
    expect(out.implementedControls).toBe(2);
    expect(out.applicableControls).toBe(7);
    expect(out.implementedPct).toBe(Math.round((2 / 7) * 100));
    expect(out.catchall.state).toBe('risk-managed');
  });
});

describe('directionsSummary', () => {
  it('summarises direction response states and addressed percentage', () => {
    const direction = (responseState: Direction['responseState']): Direction => ({
      id: `${responseState}-id` as Direction['id'],
      reference: `Dir ${responseState}`,
      title: `Direction ${responseState}`,
      issuedAt: '2026-01-01',
      requirementIds: [],
      responseState,
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });

    const out = directionsSummary([
      direction('yes'),
      direction('risk-managed'),
      direction('not-set'),
    ]);

    expect(out.total).toBe(3);
    expect(out.byState.yes).toBe(1);
    expect(out.byState['risk-managed']).toBe(1);
    expect(out.byState['not-set']).toBe(1);
    expect(out.needsResponseCount).toBe(1);
    expect(out.addressedPct).toBe(Math.round((2 / 3) * 100));
  });
});
