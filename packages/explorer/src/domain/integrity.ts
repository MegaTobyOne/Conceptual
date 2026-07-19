/**
 * Integrity diagnostics — pure functions over the persisted record set.
 *
 * Detects:
 *   - orphan-ref: a record references a requirement ID that doesn't exist
 *     in the static PSPF data set
 *   - orphan-link: a relationship endpoint points at an entity that no
 *     longer exists (or a wrong-shaped ID)
 *   - duplicate: two user records share the same trimmed lowercased title
 *   - self-loop: a relationship's two endpoints are equal
 *
 * These functions are intentionally independent of any DOM, IndexedDB, or
 * Web Worker primitive so they can be unit-tested in isolation and called
 * from either the main thread (small datasets) or a worker (large ones).
 */

import type {
  Action,
  ComplianceEntry,
  Direction,
  Relationship,
  RequirementId,
  Risk,
} from '../data/types.ts';

export type IntegrityIssueKind = 'orphan-ref' | 'orphan-link' | 'duplicate' | 'self-loop';

export type IntegrityEntityKind = 'risk' | 'action' | 'direction' | 'compliance' | 'relationship';

export interface IntegrityIssue {
  kind: IntegrityIssueKind;
  entity: IntegrityEntityKind;
  id: string;
  message: string;
}

export interface IntegrityInput {
  requirementIds: readonly RequirementId[];
  risks: readonly Risk[];
  actions: readonly Action[];
  directions: readonly Direction[];
  compliance: readonly ComplianceEntry[];
  relationships: readonly Relationship[];
}

export interface IntegrityReport {
  scannedAt: string;
  totals: { records: number; issues: number };
  issues: readonly IntegrityIssue[];
}

const REQ_ID_PATTERN = /^[A-Z]+-\d{3}$/;

function isRequirementShaped(id: string): boolean {
  return REQ_ID_PATTERN.test(id);
}

function normaliseTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function scanIntegrity(input: IntegrityInput): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const reqSet = new Set<string>(input.requirementIds);
  const riskIds = new Set<string>(input.risks.map((r) => r.id));
  const actionIds = new Set<string>(input.actions.map((a) => a.id));
  const directionIds = new Set<string>(input.directions.map((d) => d.id));

  // Orphan refs from risks
  for (const r of input.risks) {
    for (const rid of r.requirementIds) {
      if (!reqSet.has(rid)) {
        issues.push({
          kind: 'orphan-ref',
          entity: 'risk',
          id: r.id,
          message: `Risk "${r.title}" references unknown requirement ${rid}`,
        });
      }
    }
    for (const aid of r.actionIds) {
      if (!actionIds.has(aid)) {
        issues.push({
          kind: 'orphan-ref',
          entity: 'risk',
          id: r.id,
          message: `Risk "${r.title}" references unknown action ${aid}`,
        });
      }
    }
  }

  // Orphan refs from actions
  for (const a of input.actions) {
    for (const rid of a.requirementIds) {
      if (!reqSet.has(rid)) {
        issues.push({
          kind: 'orphan-ref',
          entity: 'action',
          id: a.id,
          message: `Action "${a.title}" references unknown requirement ${rid}`,
        });
      }
    }
    for (const riskId of a.riskIds) {
      if (!riskIds.has(riskId)) {
        issues.push({
          kind: 'orphan-ref',
          entity: 'action',
          id: a.id,
          message: `Action "${a.title}" references unknown risk ${riskId}`,
        });
      }
    }
  }

  // Orphan refs from directions
  for (const d of input.directions) {
    for (const rid of d.requirementIds) {
      if (!reqSet.has(rid)) {
        issues.push({
          kind: 'orphan-ref',
          entity: 'direction',
          id: d.id,
          message: `Direction "${d.reference}" references unknown requirement ${rid}`,
        });
      }
    }
  }

  // Orphan compliance entries
  for (const c of input.compliance) {
    if (!reqSet.has(c.requirementId)) {
      issues.push({
        kind: 'orphan-ref',
        entity: 'compliance',
        id: c.requirementId,
        message: `Compliance entry exists for unknown requirement ${c.requirementId}`,
      });
    }
  }

  // Relationship self-loops + dangling endpoints
  for (const rel of input.relationships) {
    const [a, b] = rel.endpoints;
    if (a === b) {
      issues.push({
        kind: 'self-loop',
        entity: 'relationship',
        id: rel.id,
        message: `Relationship loops on a single endpoint (${a})`,
      });
    }
    for (const ep of [a, b]) {
      const known =
        (isRequirementShaped(ep) && reqSet.has(ep)) ||
        riskIds.has(ep) ||
        actionIds.has(ep) ||
        directionIds.has(ep);
      if (!known) {
        issues.push({
          kind: 'orphan-link',
          entity: 'relationship',
          id: rel.id,
          message: `Relationship endpoint ${ep} does not match any known record`,
        });
      }
    }
  }

  // Duplicate titles within risks / actions / directions
  function reportDuplicates<T extends { id: string }>(
    records: readonly T[],
    titleOf: (r: T) => string,
    entity: IntegrityEntityKind,
    label: string,
  ): void {
    const seen = new Map<string, T>();
    for (const rec of records) {
      const key = normaliseTitle(titleOf(rec));
      if (!key) continue;
      const prior = seen.get(key);
      if (prior) {
        issues.push({
          kind: 'duplicate',
          entity,
          id: rec.id,
          message: `${label} "${titleOf(rec)}" shares a title with ${label.toLowerCase()} ${prior.id}`,
        });
      } else {
        seen.set(key, rec);
      }
    }
  }

  reportDuplicates(input.risks, (r) => r.title, 'risk', 'Risk');
  reportDuplicates(input.actions, (a) => a.title, 'action', 'Action');
  reportDuplicates(input.directions, (d) => d.reference, 'direction', 'Direction reference');

  const totalRecords =
    input.risks.length +
    input.actions.length +
    input.directions.length +
    input.compliance.length +
    input.relationships.length;

  return {
    scannedAt: new Date().toISOString(),
    totals: { records: totalRecords, issues: issues.length },
    issues,
  };
}
