/**
 * Compliance store: single record per RequirementId.
 */

import type { PspfDb } from './db.ts';
import type { ComplianceEntry, ComplianceEvent, RequirementId } from './types.ts';

export async function getCompliance(
  db: PspfDb,
  id: RequirementId,
): Promise<ComplianceEntry | undefined> {
  return db.get('compliance', id);
}

export async function listCompliance(db: PspfDb): Promise<ComplianceEntry[]> {
  return db.getAll('compliance');
}

export async function putCompliance(db: PspfDb, entry: ComplianceEntry): Promise<void> {
  await db.put('compliance', entry);
}

export async function deleteCompliance(db: PspfDb, id: RequirementId): Promise<void> {
  await db.delete('compliance', id);
}

export async function countCompliance(db: PspfDb): Promise<number> {
  return db.count('compliance');
}

export async function listComplianceEvents(db: PspfDb): Promise<ComplianceEvent[]> {
  return db.getAll('complianceEvents');
}

export async function putComplianceEvent(db: PspfDb, event: ComplianceEvent): Promise<void> {
  await db.put('complianceEvents', event);
}

export async function complianceEventsForRequirement(
  db: PspfDb,
  requirementId: RequirementId,
): Promise<ComplianceEvent[]> {
  return db.getAllFromIndex('complianceEvents', 'by-requirementId', requirementId);
}
