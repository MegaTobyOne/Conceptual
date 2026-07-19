import { describe, expect, it } from 'vitest';
import { applyFilters, filtersAreEmpty, summariseFilters } from './filtering.ts';
import type { ComplianceEntry, RequirementId } from '../data/types.ts';
import { allRequirements, requirementsByDomain } from '../pspf/index.ts';

const now = new Date().toISOString();
function entry(id: RequirementId, state: ComplianceEntry['state']): ComplianceEntry {
  return { requirementId: id, state, evidence: [], createdAt: now, updatedAt: now };
}

describe('applyFilters', () => {
  it('returns the full catalogue with no filters', () => {
    const out = applyFilters({}, { compliance: new Map() });
    expect(out).toHaveLength(allRequirements.length);
  });

  it('filters by domain', () => {
    const govCount = (requirementsByDomain.get('governance') ?? []).length;
    const out = applyFilters({ domain: 'governance' }, { compliance: new Map() });
    expect(out).toHaveLength(govCount);
    expect(out.every((r) => r.domain === 'governance')).toBe(true);
  });

  it('filters by compliance states (treats missing entries as not-set)', () => {
    const compliance = new Map<RequirementId, ComplianceEntry>();
    const first = allRequirements[0]!;
    compliance.set(first.id, entry(first.id, 'yes'));
    const yesOnly = applyFilters({ states: ['yes'] }, { compliance });
    expect(yesOnly).toHaveLength(1);
    expect(yesOnly[0]?.id).toBe(first.id);

    const notSet = applyFilters({ states: ['not-set'] }, { compliance });
    expect(notSet).toHaveLength(allRequirements.length - 1);
  });

  it('filters by full-text query', () => {
    const out = applyFilters({ q: allRequirements[0]!.id }, { compliance: new Map() });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((r) => r.id === allRequirements[0]!.id)).toBe(true);
  });
});

describe('filtersAreEmpty / summariseFilters', () => {
  it('detects empty filters', () => {
    expect(filtersAreEmpty({})).toBe(true);
    expect(filtersAreEmpty({ q: '   ' })).toBe(true);
    expect(filtersAreEmpty({ domain: 'risk' })).toBe(false);
  });
  it('summarises non-empty filters', () => {
    expect(summariseFilters({})).toBe('no filters');
    const s = summariseFilters({ domain: 'risk', states: ['yes', 'no'], q: 'mfa' });
    expect(s).toContain('domain=risk');
    expect(s).toContain('yes');
    expect(s).toContain('mfa');
  });
});
