/**
 * Meta key/value store: schema version, last backup at, integrity status, etc.
 */

import type { PspfDb } from './db.ts';
import type { MetaRecord } from './db.ts';

export async function getMeta(db: PspfDb, key: string): Promise<MetaRecord | undefined> {
  return db.get('meta', key);
}

export async function setMeta(db: PspfDb, key: string, value: unknown): Promise<void> {
  const record: MetaRecord = { key, value, updatedAt: new Date().toISOString() };
  await db.put('meta', record);
}

export async function deleteMeta(db: PspfDb, key: string): Promise<void> {
  await db.delete('meta', key);
}
