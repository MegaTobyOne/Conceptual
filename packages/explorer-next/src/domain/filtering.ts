/**
 * Pure helpers for filtering the PSPF requirement catalogue.
 */

import type { ComplianceEntry, RequirementId, TagId } from '../data/types.ts';
import type { SavedViewFilters } from '../data/types.ts';
import { allRequirements, type Requirement } from '../pspf/index.ts';

export interface FilterContext {
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>;
  /** Map RequirementId → Set<TagId> for tag-based filtering. */
  requirementTags?: ReadonlyMap<RequirementId, ReadonlySet<TagId>>;
}

export function applyFilters(
  filters: SavedViewFilters,
  ctx: FilterContext,
): readonly Requirement[] {
  const q = filters.q?.trim().toLowerCase();
  return allRequirements.filter((r) => {
    if (filters.domain && r.domain !== filters.domain) return false;
    if (filters.states && filters.states.length > 0) {
      const entry = ctx.compliance.get(r.id);
      const state = entry ? entry.state : 'not-set';
      if (!filters.states.includes(state)) return false;
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      const tags = ctx.requirementTags?.get(r.id);
      if (!tags) return false;
      const hasAny = filters.tagIds.some((t) => tags.has(t));
      if (!hasAny) return false;
    }
    if (q) {
      const hay = `${r.id} ${r.title} ${r.text}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filtersAreEmpty(f: SavedViewFilters): boolean {
  if (f.domain) return false;
  if (f.states?.length) return false;
  if (f.tagIds?.length) return false;
  if (f.q?.trim()) return false;
  return true;
}

export function summariseFilters(f: SavedViewFilters): string {
  const parts: string[] = [];
  if (f.domain) parts.push(`domain=${f.domain}`);
  if (f.states?.length) parts.push(`status: ${f.states.join(', ')}`);
  if (f.tagIds?.length) parts.push(`tags: ${f.tagIds.length}`);
  if (f.q?.trim()) parts.push(`q="${f.q.trim()}"`);
  return parts.length === 0 ? 'no filters' : parts.join(' · ');
}
