import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals-core';
import { AppStore } from './app-store.ts';
import { openPspfDb, type PspfDb } from '../data/db.ts';
import { asRequirementId } from '../data/types.ts';

let db: PspfDb;
let dbName: string;
let store: AppStore;

beforeEach(async () => {
  dbName = `pspf-store-test-${Math.random().toString(36).slice(2)}`;
  db = await openPspfDb(dbName);
  store = new AppStore(db);
  await store.loadAll();
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

describe('AppStore', () => {
  it('initialises with empty signal values and ready=true after loadAll', () => {
    expect(store.compliance.value.size).toBe(0);
    expect(store.risks.value).toEqual([]);
    expect(store.actions.value).toEqual([]);
    expect(store.tags.value).toEqual([]);
    expect(store.savedViews.value).toEqual([]);
    expect(store.workTracking.value).toEqual([]);
    expect(store.posture.value).toBeUndefined();
    expect(store.ready.value).toBe(true);
  });

  it('setCompliance writes through and notifies subscribers', async () => {
    const id = asRequirementId('GOV-001');
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(store.compliance.value.size);
    });
    await store.setCompliance(id, { state: 'yes' });
    dispose();
    expect(seen).toEqual([0, 1]);
    expect(store.compliance.value.get(id)?.state).toBe('yes');
    expect(await store.complianceCount()).toBe(1);
  });

  it('setCompliance preserves createdAt across updates', async () => {
    const id = asRequirementId('GOV-002');
    const first = await store.setCompliance(id, { state: 'no' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.setCompliance(id, { state: 'risk-managed' });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
  });

  it('setCompliance preserves notes when changing only status', async () => {
    const id = asRequirementId('GOV-006');
    await store.setCompliance(id, { state: 'no', notes: 'Initial gap note' });
    await store.setCompliance(id, { state: 'risk-managed' });
    expect(store.compliance.value.get(id)?.notes).toBe('Initial gap note');
  });

  it('setCompliance writes compliance events when status changes', async () => {
    const id = asRequirementId('GOV-007');
    await store.setCompliance(id, { state: 'not-set' });
    await store.setCompliance(id, { state: 'no', notes: 'Control not implemented yet' });
    await store.setCompliance(id, { state: 'yes' });

    const history = await store.complianceHistory(id);
    expect(history).toHaveLength(2);
    expect(history[0]?.fromState).toBe('not-set');
    expect(history[0]?.toState).toBe('no');
    expect(history[1]?.fromState).toBe('no');
    expect(history[1]?.toState).toBe('yes');
  });

  it('addEvidence appends to the list', async () => {
    const id = asRequirementId('GOV-003');
    await store.addEvidence(id, { kind: 'note', value: 'first', addedAt: '2025-01-01' });
    await store.addEvidence(id, { kind: 'url', value: 'https://x', addedAt: '2025-01-02' });
    const entry = store.compliance.value.get(id);
    expect(entry?.evidence).toHaveLength(2);
    expect(entry?.state).toBe('not-set');
  });

  it('removeEvidence drops the entry at the given index and is a no-op for invalid input', async () => {
    const id = asRequirementId('GOV-004');
    await store.addEvidence(id, { kind: 'note', value: 'a', addedAt: '2025-01-01' });
    await store.addEvidence(id, { kind: 'note', value: 'b', addedAt: '2025-01-02' });
    await store.addEvidence(id, { kind: 'note', value: 'c', addedAt: '2025-01-03' });
    await store.removeEvidence(id, 1);
    const entry = store.compliance.value.get(id);
    expect(entry?.evidence.map((e) => e.value)).toEqual(['a', 'c']);
    // Out-of-range index is a safe no-op.
    await store.removeEvidence(id, 99);
    expect(store.compliance.value.get(id)?.evidence).toHaveLength(2);
    // Unknown requirement is a safe no-op.
    await store.removeEvidence(asRequirementId('GOV-999'), 0);
  });

  it('clearCompliance removes both DB row and signal entry', async () => {
    const id = asRequirementId('GOV-005');
    await store.setCompliance(id, { state: 'yes', notes: 'done' });
    expect(store.compliance.value.has(id)).toBe(true);
    await store.clearCompliance(id);
    expect(store.compliance.value.has(id)).toBe(false);
  });

  it('createRisk / updateRisk / removeRisk roundtrip via signal and DB', async () => {
    const r = await store.createRisk({
      title: 'Phishing',
      likelihood: 3,
      impact: 4,
      status: 'open',
      requirementIds: [],
      actionIds: [],
    });
    expect(store.risks.value).toHaveLength(1);
    await store.updateRisk(r.id, { status: 'monitored' });
    expect(store.risks.value[0]?.status).toBe('monitored');
    await store.removeRisk(r.id);
    expect(store.risks.value).toHaveLength(0);
  });

  it('createAction / updateAction / removeAction roundtrip', async () => {
    const a = await store.createAction({
      title: 'Roll out MFA',
      type: 'remediation',
      status: 'todo',
      requirementIds: [],
      riskIds: [],
    });
    await store.updateAction(a.id, { status: 'in-progress' });
    expect(store.actions.value[0]?.status).toBe('in-progress');
    await store.removeAction(a.id);
    expect(store.actions.value).toHaveLength(0);
  });

  it('createTag / saved view / work tracking signals update synchronously after await', async () => {
    const tag = await store.createTag({ label: 'Critical', colour: '#a00', priority: 1 });
    expect(store.tags.value.map((t) => t.id)).toContain(tag.id);

    const view = await store.createSavedView('Open items', { states: ['no'] });
    expect(store.savedViews.value).toHaveLength(1);
    await store.removeSavedView(view.id);
    expect(store.savedViews.value).toHaveLength(0);

    const note = await store.addWorkTracking(asRequirementId('GOV-001'), 'Drafted policy', '1h');
    expect(store.workTracking.value).toHaveLength(1);
    await store.removeWorkTracking(note.id);
    expect(store.workTracking.value).toHaveLength(0);
  });

  it('persistence: re-opening DB and re-loading recovers signal state', async () => {
    const id = asRequirementId('GOV-099');
    await store.setCompliance(id, { state: 'yes' });
    db.close();

    const db2 = await openPspfDb(dbName);
    const store2 = new AppStore(db2);
    await store2.loadAll();
    expect(store2.compliance.value.get(id)?.state).toBe('yes');
    db2.close();
    db = await openPspfDb(dbName);
    store = new AppStore(db);
  });

  it('updateRisk on missing id throws', async () => {
    await expect(store.updateRisk(asRequirementId('does-not-exist') as never, {})).rejects.toThrow(
      /not found/,
    );
  });

  it('createRelationship rejects duplicate links and self-loops', async () => {
    const reqId = asRequirementId('GOV-001');
    const risk = await store.createRisk({
      title: 'Identity spoofing',
      likelihood: 3,
      impact: 3,
      status: 'open',
      requirementIds: [],
      actionIds: [],
    });

    await store.createRelationship({
      kind: 'requirement-risk',
      endpoints: [reqId, risk.id],
    });

    await expect(
      store.createRelationship({
        kind: 'requirement-risk',
        endpoints: [reqId, risk.id],
      }),
    ).rejects.toThrow(/already exists/i);

    await expect(
      store.createRelationship({
        kind: 'requirement-risk',
        endpoints: [reqId, reqId],
      }),
    ).rejects.toThrow(/cannot be identical/i);
  });

  it('createRelationship rejects kind-incompatible endpoints', async () => {
    const reqId = asRequirementId('GOV-001');
    const action = await store.createAction({
      title: 'Audit control operation',
      type: 'review',
      status: 'todo',
      requirementIds: [],
      riskIds: [],
    });

    await expect(
      store.createRelationship({
        kind: 'requirement-risk',
        endpoints: [reqId, action.id],
      }),
    ).rejects.toThrow(/not valid for kind/i);
  });
});
