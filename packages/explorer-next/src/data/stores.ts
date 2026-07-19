/**
 * Generic CRUD wrappers for keyed-by-id stores.
 */

import type { PspfDb, PspfStoreNames } from './db.ts';
import type {
  Action,
  Direction,
  Relationship,
  Risk,
  SavedView,
  Tag,
  WorkTrackingEntry,
} from './types.ts';

interface Identified {
  id: string;
}

async function listAll<T>(db: PspfDb, store: PspfStoreNames): Promise<T[]> {
  return db.getAll(store) as Promise<T[]>;
}

async function getOne<T>(db: PspfDb, store: PspfStoreNames, id: string): Promise<T | undefined> {
  return db.get(store, id) as Promise<T | undefined>;
}

async function putOne<T extends Identified>(
  db: PspfDb,
  store: PspfStoreNames,
  value: T,
): Promise<void> {
  await db.put(store, value as never);
}

async function deleteOne(db: PspfDb, store: PspfStoreNames, id: string): Promise<void> {
  await db.delete(store, id);
}

// --- Risks ---------------------------------------------------------------
export const listRisks = (db: PspfDb) => listAll<Risk>(db, 'risks');
export const getRisk = (db: PspfDb, id: string) => getOne<Risk>(db, 'risks', id);
export const putRisk = (db: PspfDb, value: Risk) => putOne(db, 'risks', value);
export const deleteRisk = (db: PspfDb, id: string) => deleteOne(db, 'risks', id);

// --- Actions -------------------------------------------------------------
export const listActions = (db: PspfDb) => listAll<Action>(db, 'actions');
export const getAction = (db: PspfDb, id: string) => getOne<Action>(db, 'actions', id);
export const putAction = (db: PspfDb, value: Action) => putOne(db, 'actions', value);
export const deleteAction = (db: PspfDb, id: string) => deleteOne(db, 'actions', id);

// --- Tags ---------------------------------------------------------------
export const listTags = (db: PspfDb) => listAll<Tag>(db, 'tags');
export const getTag = (db: PspfDb, id: string) => getOne<Tag>(db, 'tags', id);
export const putTag = (db: PspfDb, value: Tag) => putOne(db, 'tags', value);
export const deleteTag = (db: PspfDb, id: string) => deleteOne(db, 'tags', id);

// --- Saved views --------------------------------------------------------
export const listSavedViews = (db: PspfDb) => listAll<SavedView>(db, 'savedViews');
export const getSavedView = (db: PspfDb, id: string) => getOne<SavedView>(db, 'savedViews', id);
export const putSavedView = (db: PspfDb, value: SavedView) => putOne(db, 'savedViews', value);
export const deleteSavedView = (db: PspfDb, id: string) => deleteOne(db, 'savedViews', id);

// --- Work tracking ------------------------------------------------------
export const listWorkTracking = (db: PspfDb) => listAll<WorkTrackingEntry>(db, 'workTracking');
export const getWorkTracking = (db: PspfDb, id: string) =>
  getOne<WorkTrackingEntry>(db, 'workTracking', id);
export const putWorkTracking = (db: PspfDb, value: WorkTrackingEntry) =>
  putOne(db, 'workTracking', value);
export const deleteWorkTracking = (db: PspfDb, id: string) => deleteOne(db, 'workTracking', id);

export async function workTrackingForRequirement(
  db: PspfDb,
  requirementId: string,
): Promise<WorkTrackingEntry[]> {
  return db.getAllFromIndex('workTracking', 'by-requirementId', requirementId);
}

// --- Directions ---------------------------------------------------------
export const listDirections = (db: PspfDb) => listAll<Direction>(db, 'directions');
export const getDirection = (db: PspfDb, id: string) => getOne<Direction>(db, 'directions', id);
export const putDirection = (db: PspfDb, value: Direction) => putOne(db, 'directions', value);
export const deleteDirection = (db: PspfDb, id: string) => deleteOne(db, 'directions', id);

// --- Relationships ------------------------------------------------------
export const listRelationships = (db: PspfDb) => listAll<Relationship>(db, 'relationships');
export const getRelationship = (db: PspfDb, id: string) =>
  getOne<Relationship>(db, 'relationships', id);
export const putRelationship = (db: PspfDb, value: Relationship) =>
  putOne(db, 'relationships', value);
export const deleteRelationship = (db: PspfDb, id: string) => deleteOne(db, 'relationships', id);
