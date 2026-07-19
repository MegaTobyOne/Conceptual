import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openPspfDb } from './db.ts';
import {
  exportSharePackage,
  mergeSharePackage,
  validateSharePackage,
  SharePackageValidationError,
} from './share.ts';
import { putTag } from './stores.ts';
import { asTagId, type Tag } from './types.ts';

function newTag(id: string, label: string): Tag {
  const now = new Date().toISOString();
  return {
    id: asTagId(id),
    label,
    colour: '#888888',
    createdAt: now,
    updatedAt: now,
  };
}

describe('share package', () => {
  it('exports and merges, skipping duplicates', async () => {
    globalThis.indexedDB = new IDBFactory();
    const dbA = await openPspfDb();
    await putTag(dbA, newTag('tag-1', 'Critical'));
    const pkg = await exportSharePackage(dbA);
    expect(pkg.pspfShare).toBe('pspf-share-v1');
    expect(pkg.stores.tags?.length).toBe(1);

    globalThis.indexedDB = new IDBFactory();
    const dbB = await openPspfDb();
    const r1 = await mergeSharePackage(dbB, pkg);
    expect(r1.added.tags).toBe(1);
    expect(r1.skipped.tags).toBe(0);

    const r2 = await mergeSharePackage(dbB, pkg);
    expect(r2.added.tags).toBe(0);
    expect(r2.skipped.tags).toBe(1);
  });

  it('rejects malformed packages', () => {
    expect(() => {
      validateSharePackage({ pspfShare: 'wrong' });
    }).toThrow(SharePackageValidationError);
    expect(() => {
      validateSharePackage(null);
    }).toThrow(SharePackageValidationError);
    expect(() => {
      validateSharePackage({ pspfShare: 'pspf-share-v1', schemaVersion: 99, stores: {} });
    }).toThrow(/schemaVersion/);
    expect(() => {
      validateSharePackage({
        pspfShare: 'pspf-share-v1',
        schemaVersion: 3,
        stores: { unknown: [] },
      });
    }).toThrow(/Unknown store/i);
    expect(() => {
      validateSharePackage({
        pspfShare: 'pspf-share-v1',
        schemaVersion: 3,
        stores: { tags: [{ id: '' }] },
      });
    }).toThrow(/tags\[0\]\.id/i);
  });
});
