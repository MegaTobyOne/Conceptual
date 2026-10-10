import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BackupData } from "../domain/backup.ts";
import type { Draft, Edition, Matter, RegisterSnapshot, Tombstone, TrailItem } from "../domain/types.ts";

export const DB_NAME = "pspf-workbench.v1";
export const DB_VERSION = 1;

interface WorkbenchDB extends DBSchema {
  matters: { key: string; value: Matter };
  trail: { key: string; value: TrailItem; indexes: { "by-matter": string } };
  editions: { key: string; value: Edition; indexes: { "by-matter": string } };
  drafts: { key: string; value: Draft };
  snapshots: { key: string; value: RegisterSnapshot };
  tombstones: { key: string; value: Tombstone };
  meta: { key: string; value: { key: string; value: string } };
}

export class StoreError extends Error {}

const DATA_STORES = ["matters", "trail", "editions", "drafts", "snapshots", "tombstones"] as const;

/** Abort and swallow the transaction's own rejection; the caller throws a meaningful error. */
function abortQuietly(tx: { abort(): void; done: Promise<void> }): void {
  tx.done.catch(() => undefined);
  try {
    tx.abort();
  } catch {
    // already finished or aborted
  }
}

export class Store {
  private constructor(private readonly db: IDBPDatabase<WorkbenchDB>) {}

  static async open(name: string = DB_NAME): Promise<Store> {
    const db = await openDB<WorkbenchDB>(name, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("matters", { keyPath: "id" });
        database.createObjectStore("trail", { keyPath: "id" }).createIndex("by-matter", "matterId");
        database.createObjectStore("editions", { keyPath: "id" }).createIndex("by-matter", "matterId");
        database.createObjectStore("drafts", { keyPath: "id" });
        database.createObjectStore("snapshots", { keyPath: "id" });
        database.createObjectStore("tombstones", { keyPath: "id" });
        database.createObjectStore("meta", { keyPath: "key" });
      }
    });
    return new Store(db);
  }

  close(): void {
    this.db.close();
  }

  // Matters

  /** Saves in one transaction, logging the previous value of every changed text field. */
  async saveMatter(matter: Matter, now: string = new Date().toISOString()): Promise<Matter> {
    const tx = this.db.transaction("matters", "readwrite");
    const previous = await tx.store.get(matter.id);
    const next: Matter = { ...matter, updatedAt: now, log: [...(previous?.log ?? matter.log)] };
    if (previous) {
      for (const field of ["title", "scope", "intendedOutcome", "followUpState", "nextStep"] as const) {
        if (previous[field] !== matter[field]) {
          next.log.push({ at: now, field, previous: previous[field] });
        }
      }
    }
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  getMatter(id: string): Promise<Matter | undefined> {
    return this.db.get("matters", id);
  }

  async listMatters(): Promise<Matter[]> {
    const all = await this.db.getAll("matters");
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  // Trail items are append-only: correct by superseding, never overwrite.

  async addTrailItems(items: TrailItem[]): Promise<void> {
    const tx = this.db.transaction(["trail", "matters"], "readwrite");
    for (const item of items) {
      if (!(await tx.objectStore("matters").get(item.matterId))) {
        abortQuietly(tx);
        throw new StoreError(`Matter ${item.matterId} does not exist.`);
      }
      if (await tx.objectStore("trail").get(item.id)) {
        abortQuietly(tx);
        throw new StoreError(`Trail item ${item.id} already exists.`);
      }
      await tx.objectStore("trail").add(item);
    }
    await tx.done;
  }

  listTrail(matterId: string): Promise<TrailItem[]> {
    return this.db.getAllFromIndex("trail", "by-matter", matterId);
  }

  // Editions are immutable once issued.

  async issueEdition(edition: Edition): Promise<void> {
    const tx = this.db.transaction("editions", "readwrite");
    if (await tx.store.get(edition.id)) {
      abortQuietly(tx);
      throw new StoreError("An issued edition cannot be changed; issue a corrected edition instead.");
    }
    await tx.store.add(edition);
    await tx.done;
  }

  listEditions(matterId: string): Promise<Edition[]> {
    return this.db.getAllFromIndex("editions", "by-matter", matterId);
  }

  // Drafts autosave separately from records.

  saveDraft(draft: Draft): Promise<string> {
    return this.db.put("drafts", draft);
  }

  getDraft(id: string): Promise<Draft | undefined> {
    return this.db.get("drafts", id);
  }

  deleteDraft(id: string): Promise<void> {
    return this.db.delete("drafts", id);
  }

  listDrafts(): Promise<Draft[]> {
    return this.db.getAll("drafts");
  }

  // Register snapshots

  addSnapshot(snapshot: RegisterSnapshot): Promise<string> {
    return this.db.put("snapshots", snapshot);
  }

  async latestSnapshot(): Promise<RegisterSnapshot | undefined> {
    const all = await this.db.getAll("snapshots");
    return all.sort((a, b) => a.importedAt.localeCompare(b.importedAt)).at(-1);
  }

  listSnapshots(): Promise<RegisterSnapshot[]> {
    return this.db.getAll("snapshots");
  }

  getSnapshot(id: string): Promise<RegisterSnapshot | undefined> {
    return this.db.get("snapshots", id);
  }

  // Erasure: removes the matter and everything attached, leaving only a tombstone.

  async eraseMatter(matterId: string, now: string = new Date().toISOString()): Promise<void> {
    const tx = this.db.transaction([...DATA_STORES], "readwrite");
    const trailStore = tx.objectStore("trail");
    for (const key of await trailStore.index("by-matter").getAllKeys(matterId)) await trailStore.delete(key);
    const editionStore = tx.objectStore("editions");
    for (const key of await editionStore.index("by-matter").getAllKeys(matterId)) await editionStore.delete(key);
    const draftStore = tx.objectStore("drafts");
    for (const draft of await draftStore.getAll()) {
      if (draft.context.selection === matterId) await draftStore.delete(draft.id);
    }
    await tx.objectStore("matters").delete(matterId);
    await tx.objectStore("tombstones").put({ id: matterId, erasedAt: now });
    await tx.done;
  }

  listTombstones(): Promise<Tombstone[]> {
    return this.db.getAll("tombstones");
  }

  // Backup and restore

  async exportAll(): Promise<BackupData> {
    const tx = this.db.transaction([...DATA_STORES], "readonly");
    const data = {
      matters: await tx.objectStore("matters").getAll(),
      trail: await tx.objectStore("trail").getAll(),
      editions: await tx.objectStore("editions").getAll(),
      drafts: await tx.objectStore("drafts").getAll(),
      snapshots: await tx.objectStore("snapshots").getAll(),
      tombstones: await tx.objectStore("tombstones").getAll()
    };
    await tx.done;
    return data;
  }

  /** One transaction: if any write fails the transaction aborts and prior contents remain. */
  async replaceAll(data: BackupData): Promise<void> {
    const tx = this.db.transaction([...DATA_STORES], "readwrite");
    tx.done.catch(() => undefined);
    try {
      for (const name of DATA_STORES) {
        const store = tx.objectStore(name);
        await store.clear();
        for (const record of data[name]) await (store as unknown as { put(v: unknown): Promise<unknown> }).put(record);
      }
      await tx.done;
    } catch (error) {
      abortQuietly(tx);
      throw error;
    }
  }

  // Meta

  async getMeta(key: string): Promise<string | undefined> {
    return (await this.db.get("meta", key))?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.put("meta", { key, value });
  }
}
