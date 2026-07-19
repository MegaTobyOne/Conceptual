import { describe, expect, it } from 'vitest';
import { summariseAllDomains, summariseDomain } from './summary.ts';
import { allDomains, requirementsByDomain } from '../pspf/index.ts';
import type { ComplianceEntry, RequirementId } from '../data/types.ts';

const now = new Date().toISOString();

function makeEntry(id: RequirementId, state: ComplianceEntry['state']): ComplianceEntry {
  return {
    requirementId: id,
    state,
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('summariseDomain', () => {
  it('treats missing entries as not-set', () => {
    const gov = allDomains.find((d) => d.key === 'governance');
    expect(gov).toBeDefined();
    const summary = summariseDomain(gov!, new Map());
    const reqs = requirementsByDomain.get('governance') ?? [];
    expect(summary.total).toBe(reqs.length);
    expect(summary.byState['not-set']).toBe(reqs.length);
    expect(summary.compliantPct).toBe(0);
  });

  it('counts each state and computes compliantPct', () => {
    const gov = allDomains.find((d) => d.key === 'governance')!;
    const reqs = requirementsByDomain.get('governance') ?? [];
    expect(reqs.length).toBeGreaterThanOrEqual(4);
    const map = new Map<RequirementId, ComplianceEntry>();
    map.set(reqs[0]!.id, makeEntry(reqs[0]!.id, 'yes'));
    map.set(reqs[1]!.id, makeEntry(reqs[1]!.id, 'yes'));
    map.set(reqs[2]!.id, makeEntry(reqs[2]!.id, 'no'));
    map.set(reqs[3]!.id, makeEntry(reqs[3]!.id, 'risk-managed'));
    const s = summariseDomain(gov, map);
    expect(s.byState.yes).toBe(2);
    expect(s.byState.no).toBe(1);
    expect(s.byState['risk-managed']).toBe(1);
    expect(s.byState['not-set']).toBe(reqs.length - 4);
    expect(s.compliantPct).toBeCloseTo(2 / reqs.length, 5);
  });
});

describe('summariseAllDomains', () => {
  it('returns one summary per domain in catalogue order', () => {
    const all = summariseAllDomains(new Map());
    expect(all).toHaveLength(allDomains.length);
    expect(all.map((s) => s.domain.key)).toEqual(allDomains.map((d) => d.key));
  });
});
