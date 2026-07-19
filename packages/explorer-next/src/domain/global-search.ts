import type { Action, ComplianceEntry, Direction, RequirementId, Risk } from '../data/types.ts';
import { allRequirements, type Requirement } from '../pspf/index.ts';

export type SearchResultKind = 'requirement' | 'direction' | 'risk' | 'action';

export interface SearchRecordContext {
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>;
  directions: readonly Direction[];
  risks: readonly Risk[];
  actions: readonly Action[];
}

export interface SearchResult {
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  href: string;
  snippet: string;
}

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

function snippet(text: string, needle: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  const index = lower.indexOf(needle);
  if (index === -1) return clean.slice(0, 140);
  const start = Math.max(0, index - 45);
  const end = Math.min(clean.length, index + needle.length + 90);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function requirementResults(
  q: string,
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
): SearchResult[] {
  return allRequirements
    .filter((r: Requirement) => {
      const entry = compliance.get(r.id);
      const haystack = `${r.id} ${r.title} ${r.text} ${r.references?.join(' ') ?? ''} ${entry?.notes ?? ''} ${entry?.evidence.map((e) => e.value).join(' ') ?? ''}`;
      return includes(haystack, q);
    })
    .slice(0, 12)
    .map((r) => ({
      kind: 'requirement' as const,
      title: `${r.id} ${r.title}`,
      subtitle: `Requirement · ${r.domain}`,
      href: `#/requirement/${r.id}`,
      snippet: snippet(`${r.text} ${compliance.get(r.id)?.notes ?? ''}`, q),
    }));
}

export function searchRecords(query: string, ctx: SearchRecordContext): readonly SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: SearchResult[] = [...requirementResults(q, ctx.compliance)];

  for (const direction of ctx.directions) {
    const haystack = `${direction.reference} ${direction.title} ${direction.description ?? ''} ${direction.responseNotes ?? ''} ${direction.requirementIds.join(' ')} ${direction.evidence.map((e) => e.value).join(' ')}`;
    if (!includes(haystack, q)) continue;
    results.push({
      kind: 'direction',
      title: direction.title,
      subtitle: `Direction · ${direction.reference}`,
      href: '#/directions',
      snippet: snippet(haystack, q),
    });
  }

  for (const risk of ctx.risks) {
    const haystack = `${risk.title} ${risk.description ?? ''} ${risk.status} ${risk.requirementIds.join(' ')}`;
    if (!includes(haystack, q)) continue;
    results.push({
      kind: 'risk',
      title: risk.title,
      subtitle: `Risk · ${risk.status}`,
      href: '#/risks',
      snippet: snippet(haystack, q),
    });
  }

  for (const action of ctx.actions) {
    const haystack = `${action.title} ${action.description ?? ''} ${action.status} ${action.type} ${action.requirementIds.join(' ')}`;
    if (!includes(haystack, q)) continue;
    results.push({
      kind: 'action',
      title: action.title,
      subtitle: `Action · ${action.status}`,
      href: '#/actions',
      snippet: snippet(haystack, q),
    });
  }

  return results.slice(0, 30);
}
