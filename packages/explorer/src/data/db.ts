/**
 * IndexedDB layer for PSPF Explorer v3.
 *
 * Database: `pspf-explorer.v3`. One DB, multiple object stores.
 * Migrations are forward-only and additive — never mutate prior migrations.
 */

import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type {
  Action,
  ComplianceEntry,
  ComplianceEvent,
  Direction,
  PostureRecord,
  Relationship,
  Risk,
  SavedView,
  Tag,
  WorkTrackingEntry,
} from './types.ts';

export const DB_NAME = 'pspf-explorer.v3';
export const DB_VERSION = 3;

export const POSTURE_KEY = '__posture__' as const;

export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface PspfDbSchema extends DBSchema {
  compliance: {
    key: string;
    value: ComplianceEntry;
    indexes: { 'by-state': string; 'by-updatedAt': string };
  };
  complianceEvents: {
    key: string;
    value: ComplianceEvent;
    indexes: { 'by-requirementId': string; 'by-createdAt': string };
  };
  risks: {
    key: string;
    value: Risk;
    indexes: { 'by-status': string; 'by-updatedAt': string };
  };
  actions: {
    key: string;
    value: Action;
    indexes: { 'by-status': string; 'by-dueAt': string };
  };
  tags: {
    key: string;
    value: Tag;
  };
  savedViews: {
    key: string;
    value: SavedView;
  };
  workTracking: {
    key: string;
    value: WorkTrackingEntry;
    indexes: { 'by-requirementId': string };
  };
  posture: {
    key: string;
    value: PostureRecord & { id: typeof POSTURE_KEY };
  };
  directions: {
    key: string;
    value: Direction;
  };
  relationships: {
    key: string;
    value: Relationship;
    indexes: { 'by-kind': string };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

export type PspfDb = IDBPDatabase<PspfDbSchema>;
export type PspfStoreNames =
  | 'compliance'
  | 'complianceEvents'
  | 'risks'
  | 'actions'
  | 'tags'
  | 'savedViews'
  | 'workTracking'
  | 'posture'
  | 'directions'
  | 'relationships'
  | 'meta';

/**
 * Forward-only migrations. Add a new migration at the next index when bumping
 * DB_VERSION. NEVER edit a previous migration.
 */
const migrations: ((
  db: PspfDb,
  tx: IDBPTransaction<PspfDbSchema, PspfStoreNames[], 'versionchange'>,
) => void)[] = [
  // Migration to v1.
  (db) => {
    const compliance = db.createObjectStore('compliance', { keyPath: 'requirementId' });
    compliance.createIndex('by-state', 'state');
    compliance.createIndex('by-updatedAt', 'updatedAt');

    const risks = db.createObjectStore('risks', { keyPath: 'id' });
    risks.createIndex('by-status', 'status');
    risks.createIndex('by-updatedAt', 'updatedAt');

    const actions = db.createObjectStore('actions', { keyPath: 'id' });
    actions.createIndex('by-status', 'status');
    actions.createIndex('by-dueAt', 'dueAt');

    db.createObjectStore('tags', { keyPath: 'id' });
    db.createObjectStore('savedViews', { keyPath: 'id' });

    const workTracking = db.createObjectStore('workTracking', { keyPath: 'id' });
    workTracking.createIndex('by-requirementId', 'requirementId');

    db.createObjectStore('posture', { keyPath: 'id' });
    db.createObjectStore('directions', { keyPath: 'id' });

    const relationships = db.createObjectStore('relationships', { keyPath: 'id' });
    relationships.createIndex('by-kind', 'kind');

    db.createObjectStore('meta', { keyPath: 'key' });
  },
  // Migration to v2.
  (db) => {
    const complianceEvents = db.createObjectStore('complianceEvents', { keyPath: 'id' });
    complianceEvents.createIndex('by-requirementId', 'requirementId');
    complianceEvents.createIndex('by-createdAt', 'createdAt');
  },
  // Migration to v3.
  (_db, tx) => {
    const directions = tx.objectStore('directions');
    void (async (): Promise<void> => {
      let cursor = await directions.openCursor();
      while (cursor) {
        const value = cursor.value as Partial<Direction>;
        await cursor.update({
          ...value,
          responseState: value.responseState ?? 'not-set',
          evidence: value.evidence ?? [],
        } as Direction);
        cursor = await cursor.continue();
      }
    })();
  },
];

export async function openPspfDb(name: string = DB_NAME): Promise<PspfDb> {
  return openDB<PspfDbSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      for (let v = oldVersion; v < DB_VERSION; v += 1) {
        const migrate = migrations[v];
        if (!migrate) throw new Error(`Missing migration for version ${v + 1}`);
        migrate(db, transaction);
      }
    },
    blocked() {
      console.warn('[pspf-db] open blocked by another tab.');
    },
    blocking(_currentVersion, blockedVersion) {
      // Only reload to release the lock when a newer app version needs to
      // upgrade. Do not reload on database deletion (blockedVersion === null),
      // which would abort in-progress teardown (e.g. test cleanup).
      if (blockedVersion !== null) {
        console.warn('[pspf-db] this tab is blocking a newer version — reloading to release.');
        window.location.reload();
      }
    },
    terminated() {
      console.error('[pspf-db] connection terminated unexpectedly.');
    },
  });
}

/**
 * Atomic write helper. Wraps an idb readwrite transaction over the supplied
 * stores so callers cannot leave a partial envelope behind.
 */
export async function runInTx<T, S extends PspfStoreNames>(
  db: PspfDb,
  stores: readonly S[],
  fn: (tx: IDBPTransaction<PspfDbSchema, S[], 'readwrite'>) => Promise<T>,
): Promise<T> {
  const tx = db.transaction(stores, 'readwrite');
  const result = await fn(tx);
  await tx.done;
  return result;
}
