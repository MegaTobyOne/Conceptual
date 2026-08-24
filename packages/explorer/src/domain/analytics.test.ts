import { describe, expect, it } from 'vitest';
import {
  actionStatusCounts,
  complianceEventsSince,
  complianceBreakdown,
  directionsSummary,
  ESSENTIAL_EIGHT_CATCHALL_ID,
  ESSENTIAL_EIGHT_REQUIREMENT_IDS,
  essentialEightCoverage,
  evidenceExpiringSoonCount,
  metComplianceBasis,
  overdueActionCount,
  requirementConsequence,
  riskBandCounts,
  riskBandOf,
  topActionBlockers,
  uncoveredRiskStatement,
} from './analytics.ts';
import { allRequirements } from '../pspf/index.ts';
import type {
  Action,
  ComplianceEntry,
  ComplianceEvent,
  Direction,
  RequirementId,
  Risk,
} from '../data/types.ts';
import { asRequirementId } from '../data/types.ts';

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

describe('complianceEventsSince', () => {
  it('filters, sorts and scopes durable compliance events', () => {
    const events = [
      {
        id: '2',
        requirementId: asRequirementId('GOV-001'),
        fromState: 'no',
        toState: 'yes',
        createdAt: '2026-08-20T00:00:00.000Z',
      },
      {
        id: '1',
        requirementId: asRequirementId('GOV-002'),
        fromState: 'not-set',
        toState: 'no',
        createdAt: '2026-08-21T00:00:00.000Z',
      },
    ] as ComplianceEvent[];

    expect(complianceEventsSince(events, new Date('2026-08-20T12:00:00.000Z'))).toHaveLength(1);
    expect(
      complianceEventsSince(
        events,
        new Date('2026-08-01T00:00:00.000Z'),
        asRequirementId('GOV-001'),
      )[0]?.toState,
    ).toBe('yes');
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

describe('metComplianceBasis', () => {
  const reference = new Date('2026-08-24T00:00:00Z');

  it('is zeroed when no requirement is fully implemented', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    const [a] = allRequirements;
    m.set(a!.id, entry(a!.id, 'no'));
    const out = metComplianceBasis(m, reference);
    expect(out).toEqual({
      total: 0,
      asserted: 0,
      evidenced: 0,
      evidencedFresh: 0,
      evidencedFreshPercentage: 0,
    });
  });

  it('treats a met entry with no evidence as asserted', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    const [a] = allRequirements;
    m.set(a!.id, entry(a!.id, 'yes'));
    const out = metComplianceBasis(m, reference);
    expect(out).toEqual({
      total: 1,
      asserted: 1,
      evidenced: 0,
      evidencedFresh: 0,
      evidencedFreshPercentage: 0,
    });
  });

  it('treats a met entry with only old evidence as evidenced, not fresh', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    const [a] = allRequirements;
    m.set(a!.id, {
      requirementId: a!.id,
      state: 'yes',
      evidence: [{ kind: 'note', value: 'old note', addedAt: '2024-01-01T00:00:00Z' }],
      createdAt: now,
      updatedAt: now,
    });
    const out = metComplianceBasis(m, reference);
    expect(out).toEqual({
      total: 1,
      asserted: 0,
      evidenced: 1,
      evidencedFresh: 0,
      evidencedFreshPercentage: 0,
    });
  });

  it('treats a met entry with recent evidence as evidenced-fresh', () => {
    const m = new Map<RequirementId, ComplianceEntry>();
    const [a] = allRequirements;
    m.set(a!.id, {
      requirementId: a!.id,
      state: 'yes',
      evidence: [{ kind: 'note', value: 'recent note', addedAt: '2026-08-01T00:00:00Z' }],
      createdAt: now,
      updatedAt: now,
    });
    const out = metComplianceBasis(m, reference);
    expect(out).toEqual({
      total: 1,
      asserted: 0,
      evidenced: 0,
      evidencedFresh: 1,
      evidencedFreshPercentage: 100,
    });
  });
});

function risk(id: string, requirementIds: RequirementId[], status: Risk['status'] = 'open'): Risk {
  return {
    id: id as Risk['id'],
    title: `Risk ${id}`,
    likelihood: 4,
    impact: 4,
    status,
    requirementIds,
    actionIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('requirementConsequence', () => {
  it('states no open risks are linked when there are none', () => {
    const [a] = allRequirements;
    expect(requirementConsequence(a!.id, 'yes', [])).toBe(
      'No open risks are currently linked to this requirement.',
    );
  });

  it('states exposure when not met with linked open risks', () => {
    const [a] = allRequirements;
    const statement = requirementConsequence(a!.id, 'no', [risk('risk-1', [a!.id])]);
    expect(statement).toMatch(/1 linked risk remains exposed/);
  });
});

describe('uncoveredRiskStatement', () => {
  it('reports all covered when every open risk has a met linked requirement', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'yes'));
    const statement = uncoveredRiskStatement(m, [risk('risk-1', [a!.id])]);
    expect(statement).toBe('All 1 open risk(s) are covered by at least one met requirement.');
  });

  it('reports uncovered risks when no linked requirement is met', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'no'));
    const statement = uncoveredRiskStatement(m, [risk('risk-1', [a!.id])]);
    expect(statement).toBe('1 of 1 open risk has no met requirement covering them.');
  });
});

function action(
  id: string,
  requirementIds: RequirementId[],
  type: Action['type'] = 'remediation',
  status: Action['status'] = 'todo',
): Action {
  return {
    id: id as Action['id'],
    title: `Action ${id}`,
    type,
    status,
    requirementIds,
    riskIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('topActionBlockers', () => {
  it('ranks the action gating the most not-met requirements first', () => {
    const [a, b, c] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'no'));
    m.set(b!.id, entry(b!.id, 'no'));
    m.set(c!.id, entry(c!.id, 'no'));
    const blockers = topActionBlockers(
      [action('a1', [a!.id]), action('a2', [a!.id, b!.id, c!.id])],
      m,
    );
    expect(blockers[0]?.actionId).toBe('a2');
    expect(blockers[0]?.gatedRequirementCount).toBe(3);
  });

  it('excludes requirements that are already met or not applicable', () => {
    const [a, b] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'yes'));
    m.set(b!.id, entry(b!.id, 'no'));
    const blockers = topActionBlockers([action('a1', [a!.id, b!.id])], m);
    expect(blockers[0]?.gatedRequirementCount).toBe(1);
  });

  it('classifies a review-type action as waiting on assessor', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'no'));
    const blockers = topActionBlockers([action('a1', [a!.id], 'review')], m);
    expect(blockers[0]?.blockerClass).toBe('assessor');
  });

  it('excludes done and cancelled actions', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, entry(a!.id, 'no'));
    const blockers = topActionBlockers([action('a1', [a!.id], 'remediation', 'done')], m);
    expect(blockers).toHaveLength(0);
  });
});

describe('evidenceExpiringSoonCount', () => {
  const reference = new Date('2026-08-24T00:00:00Z');

  it('counts met requirements whose evidence expires within 90 days', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, {
      requirementId: a!.id,
      state: 'yes',
      evidence: [
        {
          kind: 'note',
          value: 'ageing',
          addedAt: new Date(reference.getTime() - 160 * 86400000).toISOString(),
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    expect(evidenceExpiringSoonCount(m, reference)).toBe(1);
  });

  it('does not count requirements with fresh evidence', () => {
    const [a] = allRequirements;
    const m = new Map<RequirementId, ComplianceEntry>();
    m.set(a!.id, {
      requirementId: a!.id,
      state: 'yes',
      evidence: [{ kind: 'note', value: 'fresh', addedAt: reference.toISOString() }],
      createdAt: now,
      updatedAt: now,
    });
    expect(evidenceExpiringSoonCount(m, reference)).toBe(0);
  });
});
