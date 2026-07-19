import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openPspfDb, runInTx, type PspfDb } from './db.ts';
import {
  asActionId,
  asDirectionId,
  asRelationshipId,
  asRequirementId,
  asRiskId,
  asSavedViewId,
  asTagId,
  asWorkTrackingId,
  type Action,
  type ComplianceEntry,
  type Direction,
  type PostureRecord,
  type Relationship,
  type Risk,
  type SavedView,
  type Tag,
  type WorkTrackingEntry,
} from './types.ts';
import {
  complianceEventsForRequirement,
  countCompliance,
  deleteCompliance,
  getCompliance,
  listCompliance,
  listComplianceEvents,
  putCompliance,
  putComplianceEvent,
} from './compliance-store.ts';
import {
  deleteAction,
  deleteRisk,
  deleteTag,
  getAction,
  getRisk,
  getTag,
  listActions,
  listDirections,
  listRelationships,
  listRisks,
  listSavedViews,
  listTags,
  listWorkTracking,
  putAction,
  putRisk,
  putSavedView,
  putTag,
  putWorkTracking,
  workTrackingForRequirement,
} from './stores.ts';
import { getPosture, putPosture } from './posture-store.ts';
import { getMeta, setMeta } from './meta-store.ts';

const NOW = '2025-01-01T00:00:00.000Z';

let db: PspfDb;
let dbName: string;

beforeEach(async () => {
  dbName = `pspf-test-${Math.random().toString(36).slice(2)}`;
  db = await openPspfDb(dbName);
});

afterEach(async () => {
  db.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete failed'));
    req.onblocked = () => resolve();
  });
});

describe('IndexedDB layer', () => {
  it('opens at version 1 with all expected stores', () => {
    expect(db.version).toBe(3);
    const names = [...db.objectStoreNames].sort();
    expect(names).toEqual(
      [
        'actions',
        'compliance',
        'complianceEvents',
        'directions',
        'meta',
        'posture',
        'relationships',
        'risks',
        'savedViews',
        'tags',
        'workTracking',
      ].sort(),
    );
  });

  it('compliance: round-trips, lists, counts, deletes', async () => {
    const id = asRequirementId('GOV-001');
    const entry: ComplianceEntry = {
      requirementId: id,
      state: 'yes',
      evidence: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putCompliance(db, entry);
    expect(await getCompliance(db, id)).toEqual(entry);
    expect(await countCompliance(db)).toBe(1);
    expect(await listCompliance(db)).toHaveLength(1);
    await deleteCompliance(db, id);
    expect(await getCompliance(db, id)).toBeUndefined();
  });

  it('compliance events: append and query by requirement', async () => {
    const requirementId = asRequirementId('GOV-001');
    await putComplianceEvent(db, {
      id: 'evt-1',
      requirementId,
      fromState: 'not-set',
      toState: 'no',
      noteSnapshot: 'Gap identified',
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(await listComplianceEvents(db)).toHaveLength(1);
    expect(await complianceEventsForRequirement(db, requirementId)).toHaveLength(1);
    expect(await complianceEventsForRequirement(db, asRequirementId('GOV-002'))).toEqual([]);
  });

  it('risks / actions / tags: CRUD via generic store helpers', async () => {
    const risk: Risk = {
      id: asRiskId('01H000000000000000000RISK0'),
      title: 'Phishing',
      likelihood: 3,
      impact: 4,
      status: 'open',
      requirementIds: [],
      actionIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putRisk(db, risk);
    expect(await getRisk(db, risk.id)).toEqual(risk);
    expect(await listRisks(db)).toHaveLength(1);

    const action: Action = {
      id: asActionId('01H000000000000000000ACT00'),
      title: 'Roll out MFA',
      type: 'remediation',
      status: 'todo',
      requirementIds: [],
      riskIds: [risk.id],
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putAction(db, action);
    expect(await getAction(db, action.id)).toEqual(action);
    expect(await listActions(db)).toHaveLength(1);

    const tag: Tag = {
      id: asTagId('01H000000000000000000TAG00'),
      label: 'Critical',
      colour: '#aa0000',
      priority: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putTag(db, tag);
    expect(await getTag(db, tag.id)).toEqual(tag);

    await deleteRisk(db, risk.id);
    await deleteAction(db, action.id);
    await deleteTag(db, tag.id);
    expect(await listRisks(db)).toHaveLength(0);
    expect(await listActions(db)).toHaveLength(0);
    expect(await listTags(db)).toHaveLength(0);
  });

  it('saved views and work-tracking persist; workTracking index by requirementId works', async () => {
    const view: SavedView = {
      id: asSavedViewId('01H000000000000000000VIEW0'),
      name: 'My open items',
      filters: { states: ['no'] },
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putSavedView(db, view);
    expect(await listSavedViews(db)).toEqual([view]);

    const reqId = asRequirementId('GOV-001');
    const note: WorkTrackingEntry = {
      id: asWorkTrackingId('01H000000000000000000WT00X'),
      requirementId: reqId,
      note: 'Drafted policy',
      createdAt: NOW,
      updatedAt: NOW,
    };
    await putWorkTracking(db, note);
    expect(await listWorkTracking(db)).toHaveLength(1);
    expect(await workTrackingForRequirement(db, reqId)).toEqual([note]);
    expect(await workTrackingForRequirement(db, 'NO-MATCH')).toEqual([]);
  });

  it('posture and meta single-row stores work', async () => {
    const posture: PostureRecord = {
      global: { threat: 'elevated', posture: 'shields-up', updatedAt: NOW },
      perDomain: {},
    };
    await putPosture(db, posture);
    const got = await getPosture(db);
    expect(got?.global.threat).toBe('elevated');

    await setMeta(db, 'lastBackupAt', NOW);
    const meta = await getMeta(db, 'lastBackupAt');
    expect(meta?.value).toBe(NOW);
    expect(meta?.updatedAt).toBeDefined();
  });

  it('directions and relationships persist and survive transactions', async () => {
    const direction: Direction = {
      id: asDirectionId('01H000000000000000000DIR00'),
      reference: 'PSPF Direction 2025-01',
      title: 'Foreign interference',
      issuedAt: NOW,
      requirementIds: [],
      responseState: 'not-set',
      evidence: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const rel: Relationship = {
      id: asRelationshipId('01H000000000000000000REL00'),
      kind: 'requirement-action',
      endpoints: ['GOV-001', 'ACT-1'],
      createdAt: NOW,
      updatedAt: NOW,
    };

    await runInTx(db, ['directions', 'relationships'] as const, async (tx) => {
      await tx.objectStore('directions').put(direction);
      await tx.objectStore('relationships').put(rel);
    });

    expect(await listDirections(db)).toEqual([direction]);
    expect(await listRelationships(db)).toEqual([rel]);
  });

  it('runInTx commits all writes atomically', async () => {
    const a: ComplianceEntry = {
      requirementId: asRequirementId('GOV-001'),
      state: 'yes',
      evidence: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const b: ComplianceEntry = {
      requirementId: asRequirementId('GOV-002'),
      state: 'no',
      evidence: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    await runInTx(db, ['compliance'] as const, async (tx) => {
      await tx.objectStore('compliance').put(a);
      await tx.objectStore('compliance').put(b);
    });
    expect(await countCompliance(db)).toBe(2);
  });
});
