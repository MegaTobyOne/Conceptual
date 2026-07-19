import { describe, expect, it } from 'vitest';
import {
  allDomains,
  allRequirements,
  ismResources,
  requirementById,
  requirementsByDomain,
} from './index.ts';
import { DOMAIN_KEYS } from '../data/types.ts';

describe('PSPF static data', () => {
  it('contains exactly 218 requirements (PSPF 2025 release)', () => {
    expect(allRequirements).toHaveLength(218);
  });

  it('covers all six domains', () => {
    expect(allDomains).toHaveLength(6);
    const keys = allDomains.map((d) => d.key).sort();
    expect(keys).toEqual([...DOMAIN_KEYS].sort());
  });

  it('every requirement id is unique', () => {
    const ids = allRequirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every requirement id matches /^[A-Z]+-\\d{3,4}$/', () => {
    const bad = allRequirements.filter((r) => !/^[A-Z]+-\d{3,4}$/.test(r.id));
    expect(bad.map((r) => r.id)).toEqual([]);
  });

  it('every requirement belongs to a known domain', () => {
    const known = new Set<string>(DOMAIN_KEYS);
    const orphans = allRequirements.filter((r) => !known.has(r.domain));
    expect(orphans).toEqual([]);
  });

  it('every requirement title is non-empty', () => {
    const empties = allRequirements.filter((r) => !r.title.trim());
    expect(empties).toEqual([]);
  });

  it('requirementById covers every requirement', () => {
    expect(requirementById.size).toBe(allRequirements.length);
    for (const r of allRequirements) expect(requirementById.get(r.id)).toBe(r);
  });

  it('requirementsByDomain partitions every requirement exactly once', () => {
    let total = 0;
    for (const key of DOMAIN_KEYS) {
      const rs = requirementsByDomain.get(key) ?? [];
      total += rs.length;
      for (const r of rs) expect(r.domain).toBe(key);
    }
    expect(total).toBe(allRequirements.length);
  });

  it('provides ISM resource references for technology requirements', () => {
    const tech = allRequirements.filter((r) => r.domain === 'technology');
    expect(tech.length).toBeGreaterThan(0);
    expect(
      tech.every((r) => (r.references ?? []).some((ref) => ref.includes('cyber.gov.au'))),
    ).toBe(true);
  });

  it('includes curated ISM resource metadata', () => {
    expect(ismResources.length).toBeGreaterThanOrEqual(4);
    expect(ismResources.some((resource) => resource.id === 'ism-oscal-releases')).toBe(true);
  });
});
