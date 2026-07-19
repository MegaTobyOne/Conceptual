/**
 * Backup / restore: dump and reload the entire IndexedDB.
 *
 * Format:
 *   {
 *     pspfBackup: 'v1',
 *     schemaVersion: number,
 *     createdAt: string,
 *     stores: { [storeName]: unknown[] }
 *   }
 */

import { DB_VERSION, POSTURE_KEY, type PspfDb, type PspfStoreNames } from './db.ts';

const BACKUP_FORMAT = 'v1' as const;

const STORE_NAMES = [
  'compliance',
  'complianceEvents',
  'risks',
  'actions',
  'tags',
  'savedViews',
  'workTracking',
  'posture',
  'directions',
  'relationships',
  'meta',
] as const satisfies readonly PspfStoreNames[];

export interface BackupEnvelope {
  pspfBackup: typeof BACKUP_FORMAT;
  schemaVersion: number;
  createdAt: string;
  stores: Partial<Record<(typeof STORE_NAMES)[number], unknown[]>>;
}

export async function exportBackup(db: PspfDb): Promise<BackupEnvelope> {
  const stores: BackupEnvelope['stores'] = {};
  for (const name of STORE_NAMES) {
    const all = await db.getAll(name);
    stores[name] = all;
  }
  return {
    pspfBackup: BACKUP_FORMAT,
    schemaVersion: DB_VERSION,
    createdAt: new Date().toISOString(),
    stores,
  };
}

export class BackupValidationError extends Error {}

interface RawEnvelope {
  pspfBackup?: unknown;
  schemaVersion?: unknown;
  stores?: unknown;
}

const STORE_KEY_FIELDS: Record<(typeof STORE_NAMES)[number], 'id' | 'key' | 'requirementId'> = {
  compliance: 'requirementId',
  complianceEvents: 'id',
  risks: 'id',
  actions: 'id',
  tags: 'id',
  savedViews: 'id',
  workTracking: 'id',
  posture: 'id',
  directions: 'id',
  relationships: 'id',
  meta: 'key',
};

function validateStoreItems(store: (typeof STORE_NAMES)[number], value: unknown): void {
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`stores.${store} must be an array.`);
  }
  const keyField = STORE_KEY_FIELDS[store];
  const items = value as unknown[];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      throw new BackupValidationError(`stores.${store}[${i}] must be an object.`);
    }
    const keyValue = (item as Record<string, unknown>)[keyField];
    if (typeof keyValue !== 'string' || keyValue.trim().length === 0) {
      throw new BackupValidationError(
        `stores.${store}[${i}].${keyField} must be a non-empty string.`,
      );
    }
    if (store === 'posture' && keyValue !== POSTURE_KEY) {
      throw new BackupValidationError(`stores.posture[${i}].id must equal ${POSTURE_KEY}.`);
    }
    if (store === 'relationships') {
      const endpoints = (item as { endpoints?: unknown }).endpoints;
      if (
        !Array.isArray(endpoints) ||
        endpoints.length !== 2 ||
        typeof endpoints[0] !== 'string' ||
        typeof endpoints[1] !== 'string' ||
        endpoints[0].trim().length === 0 ||
        endpoints[1].trim().length === 0
      ) {
        throw new BackupValidationError(
          `stores.relationships[${i}].endpoints must be a pair of non-empty strings.`,
        );
      }
    }
  }
}

export function validateEnvelope(value: unknown): asserts value is BackupEnvelope {
  if (!value || typeof value !== 'object') {
    throw new BackupValidationError('Backup must be a JSON object.');
  }
  const v = value as RawEnvelope;
  if (v.pspfBackup !== BACKUP_FORMAT) {
    throw new BackupValidationError(
      `Unsupported backup format. Expected "${BACKUP_FORMAT}", got "${String(v.pspfBackup)}".`,
    );
  }
  if (typeof v.schemaVersion !== 'number') {
    throw new BackupValidationError('Missing or invalid schemaVersion.');
  }
  if (v.schemaVersion !== DB_VERSION) {
    throw new BackupValidationError(
      `Backup schemaVersion ${String(v.schemaVersion)} does not match current ${DB_VERSION}.`,
    );
  }
  if (!v.stores || typeof v.stores !== 'object') {
    throw new BackupValidationError('Missing stores section.');
  }
  for (const key of Object.keys(v.stores)) {
    if (!(STORE_NAMES as readonly string[]).includes(key)) {
      throw new BackupValidationError(`Unknown store in backup envelope: ${key}.`);
    }
  }
  for (const store of STORE_NAMES) {
    const maybeStore = (v.stores as Record<string, unknown>)[store];
    if (maybeStore === undefined) continue;
    validateStoreItems(store, maybeStore);
  }
}

export async function clearAllStores(db: PspfDb): Promise<void> {
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  await Promise.all(STORE_NAMES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export async function importBackup(db: PspfDb, envelope: unknown): Promise<void> {
  validateEnvelope(envelope);
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    await store.clear();
    const items = envelope.stores[name];
    if (!items) continue;
    for (const item of items) {
      // Envelope is user-supplied JSON; cast to the store's record type.
      await store.put(item as never);
    }
  }
  await tx.done;
}
