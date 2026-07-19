/**
 * Domain compliance summary helpers.
 *
 * Pure functions over the immutable PSPF requirement catalogue and a
 * snapshot of compliance entries keyed by RequirementId.
 */

import type { ComplianceEntry, ComplianceState, Domain, RequirementId } from '../data/types.ts';
import { allDomains, requirementsByDomain } from '../pspf/index.ts';

export interface DomainSummary {
  domain: Domain;
  total: number;
  byState: Record<ComplianceState, number>;
  /** Fraction in [0, 1] of requirements with state = 'yes'. */
  compliantPct: number;
}

function emptyByState(): Record<ComplianceState, number> {
  return {
    yes: 0,
    no: 0,
    'risk-managed': 0,
    'not-applicable': 0,
    'not-set': 0,
  };
}

export function summariseDomain(
  domain: Domain,
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
): DomainSummary {
  const reqs = requirementsByDomain.get(domain.key) ?? [];
  const byState = emptyByState();
  for (const req of reqs) {
    const entry = compliance.get(req.id);
    const state: ComplianceState = entry ? entry.state : 'not-set';
    byState[state] += 1;
  }
  const total = reqs.length;
  const compliantPct = total === 0 ? 0 : byState.yes / total;
  return { domain, total, byState, compliantPct };
}

export function summariseAllDomains(
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
): readonly DomainSummary[] {
  return allDomains.map((d) => summariseDomain(d, compliance));
}
