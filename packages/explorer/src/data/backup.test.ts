import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openPspfDb, type PspfDb } from './db.ts';
import {
  BackupValidationError,
  clearAllStores,
  exportBackup,
  importBackup,
  validateEnvelope,
} from './backup.ts';
import { putRisk, putTag } from './stores.ts';
import { asRiskId, asTagId } from './types.ts';

let db: PspfDb;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  db = await openPspfDb(`backup-test-${counter}`);
});

const now = new Date().toISOString();

describe('backup round-trip', () => {
  it('exports, clears, and re-imports identical data', async () => {
    await putRisk(db, {
      id: asRiskId('r1'),
      title: 'r1',
      likelihood: 3,
      impact: 4,
      status: 'open',
      requirementIds: [],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await putTag(db, {
      id: asTagId('t1'),
      label: 't1',
      colour: '#ff0000',
      createdAt: now,
      updatedAt: now,
    });

    const env = await exportBackup(db);
    expect(env.pspfBackup).toBe('v1');
    expect(env.stores.risks).toHaveLength(1);
    expect(env.stores.tags).toHaveLength(1);

    await clearAllStores(db);
    const empty = await exportBackup(db);
    expect(empty.stores.risks).toHaveLength(0);
    expect(empty.stores.tags).toHaveLength(0);

    await importBackup(db, env);
    const round = await exportBackup(db);
    expect(round.stores.risks).toHaveLength(1);
    expect(round.stores.tags).toHaveLength(1);
  });
});

describe('validateEnvelope', () => {
  it('rejects non-objects', () => {
    expect(() => validateEnvelope(null)).toThrow(BackupValidationError);
    expect(() => validateEnvelope(42)).toThrow(BackupValidationError);
  });
  it('rejects wrong format tag', () => {
    expect(() => validateEnvelope({ pspfBackup: 'v999', schemaVersion: 1, stores: {} })).toThrow(
      BackupValidationError,
    );
  });
  it('rejects mismatched schema version', () => {
    expect(() => validateEnvelope({ pspfBackup: 'v1', schemaVersion: 99, stores: {} })).toThrow(
      BackupValidationError,
    );
  });

  it('rejects unknown stores and malformed records', () => {
    expect(() =>
      validateEnvelope({
        pspfBackup: 'v1',
        schemaVersion: 3,
        stores: { unknownStore: [] },
      }),
    ).toThrow(/Unknown store/i);

    expect(() =>
      validateEnvelope({
        pspfBackup: 'v1',
        schemaVersion: 3,
        stores: {
          risks: [{ id: '' }],
        },
      }),
    ).toThrow(/risks\[0\]\.id/i);
  });
});
