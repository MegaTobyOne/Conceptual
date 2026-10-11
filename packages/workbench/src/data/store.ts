import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  appendDueDateHistory,
  evaluateRisk,
  operatorLinkRuleFor,
  validateRegisterLinkPairs,
  validateNarrativeRules,
  validateRegisterEntityEnvelope,
  validateRegisterWriteRules,
  type ActionEntity,
  type LinkEntity,
  type RiskEventEntity
} from "@pspf/contracts";
import type { BackupData } from "../domain/backup.ts";
import type { RegisterImportFile } from "../domain/register-import.ts";
import type {
  Draft,
  Edition,
  Matter,
  RegisterChange,
  RegisterEntity,
  RegisterSnapshot,
  Tombstone,
  TrailItem
} from "../domain/types.ts";
import { sha256Hex } from "../domain/hash.ts";

export const DB_NAME = "pspf-workbench.v1";
export const DB_VERSION = 2;

interface WorkbenchDB extends DBSchema {
  entities: {
    key: string;
    value: RegisterEntity;
    indexes: { "by-entity-type": string; "by-updated-at": string; "by-domain": string };
  };
  links: { key: string; value: LinkEntity; indexes: { "by-from": string; "by-to": string } };
  changeLog: { key: string; value: RegisterChange; indexes: { "by-entity": string; "by-recorded-at": string } };
  matters: { key: string; value: Matter };
  trail: { key: string; value: TrailItem; indexes: { "by-matter": string } };
  editions: { key: string; value: Edition; indexes: { "by-matter": string } };
  drafts: { key: string; value: Draft };
  snapshots: { key: string; value: RegisterSnapshot };
  tombstones: { key: string; value: Tombstone };
  meta: { key: string; value: { key: string; value: string } };
}

export class StoreError extends Error {}

export interface RegisterImportResult {
  created: number;
  updated: number;
  unchanged: number;
}

const DATA_STORES = [
  "matters",
  "trail",
  "editions",
  "drafts",
  "snapshots",
  "tombstones",
  "entities",
  "links",
  "changeLog"
] as const;

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
        if (!database.objectStoreNames.contains("matters")) database.createObjectStore("matters", { keyPath: "id" });
        if (!database.objectStoreNames.contains("trail")) {
          database.createObjectStore("trail", { keyPath: "id" }).createIndex("by-matter", "matterId");
        }
        if (!database.objectStoreNames.contains("editions")) {
          database.createObjectStore("editions", { keyPath: "id" }).createIndex("by-matter", "matterId");
        }
        if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "id" });
        if (!database.objectStoreNames.contains("snapshots")) {
          database.createObjectStore("snapshots", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("tombstones")) {
          database.createObjectStore("tombstones", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta", { keyPath: "key" });
        if (!database.objectStoreNames.contains("entities")) {
          const entities = database.createObjectStore("entities", { keyPath: "id" });
          entities.createIndex("by-entity-type", "entityType");
          entities.createIndex("by-updated-at", "updatedAt");
          entities.createIndex("by-domain", "domainId");
        }
        if (!database.objectStoreNames.contains("links")) {
          const links = database.createObjectStore("links", { keyPath: "id" });
          links.createIndex("by-from", "fromId");
          links.createIndex("by-to", "toId");
        }
        if (!database.objectStoreNames.contains("changeLog")) {
          const changeLog = database.createObjectStore("changeLog", { keyPath: "id" });
          changeLog.createIndex("by-entity", "entityId");
          changeLog.createIndex("by-recorded-at", "recordedAt");
        }
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

  // Register

  getRegisterEntity(id: string): Promise<RegisterEntity | undefined> {
    return this.db.get("entities", id);
  }

  async listRegisterEntities(entityType?: RegisterEntity["entityType"]): Promise<RegisterEntity[]> {
    const records = entityType
      ? await this.db.getAllFromIndex("entities", "by-entity-type", entityType)
      : await this.db.getAll("entities");
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveRegisterEntity(entity: RegisterEntity, now: string = new Date().toISOString()): Promise<RegisterEntity> {
    const envelopeViolations = validateRegisterEntityEnvelope(entity);
    if (envelopeViolations.length) throw new StoreError(envelopeViolations.join(" "));
    if (entity.entityType === "risk-event") {
      throw new StoreError("Risk events are append-only; record a new escalation instead.");
    }
    const priorSnapshot = await this.db.get("entities", entity.id);
    const previousRevisionHash = priorSnapshot ? await sha256Hex(stableJson(priorSnapshot)) : "";
    const tx = this.db.transaction(["entities", "changeLog"], "readwrite");
    const entities = tx.objectStore("entities");
    const previous = await entities.get(entity.id);
    if (stableJson(previous) !== stableJson(priorSnapshot)) {
      abortQuietly(tx);
      throw new StoreError(`Register entity ${entity.id} changed during Save; reload before trying again.`);
    }
    if (previous && previous.entityType !== entity.entityType) {
      abortQuietly(tx);
      throw new StoreError(`Register entity ${entity.id} cannot change type.`);
    }
    const existing = await entities.getAll();
    if (entity.entityType === "narrative") {
      const violations = validateNarrativeRules([entity], existing);
      if (violations.length > 0) {
        abortQuietly(tx);
        throw new StoreError(violations[0]!.message);
      }
    }
    const writeViolation = validateRegisterWriteRules([entity])[0];
    if (writeViolation) {
      abortQuietly(tx);
      throw new StoreError(writeViolation);
    }
    const prepared =
      entity.entityType === "action"
        ? appendDueDateHistory(previous?.entityType === "action" ? (previous as ActionEntity) : undefined, entity, now)
        : entity;
    const next = {
      ...prepared,
      ...(prepared.entityType === "risk"
        ? {
            assessmentState: evaluateRisk(
              prepared,
              existing.find((record) => record.entityType === "risk-framework")
            ).state
          }
        : {}),
      createdAt: previous?.createdAt ?? prepared.createdAt,
      updatedAt: now
    } as RegisterEntity;
    const fieldSet = changedFields(previous, next);
    await entities.put(next);
    await tx.objectStore("changeLog").add({
      id: crypto.randomUUID(),
      entityId: entity.id,
      fieldSet,
      previousRevisionHash,
      recordedAt: now
    });
    await tx.done;
    return next;
  }

  async listLinks(entityId?: string): Promise<LinkEntity[]> {
    if (!entityId) return this.db.getAll("links");
    const [from, to] = await Promise.all([
      this.db.getAllFromIndex("links", "by-from", entityId),
      this.db.getAllFromIndex("links", "by-to", entityId)
    ]);
    return [...new Map([...from, ...to].map((link) => [link.id, link])).values()];
  }

  async saveLink(link: LinkEntity, now: string = new Date().toISOString()): Promise<void> {
    const envelopeViolations = validateRegisterEntityEnvelope(link);
    if (envelopeViolations.length) throw new StoreError(envelopeViolations.join(" "));
    const priorSnapshot = await this.db.get("links", link.id);
    const previousRevisionHash = priorSnapshot ? await sha256Hex(stableJson(priorSnapshot)) : "";
    const tx = this.db.transaction(["entities", "links", "changeLog"], "readwrite");
    const previous = await tx.objectStore("links").get(link.id);
    if (stableJson(previous) !== stableJson(priorSnapshot)) {
      abortQuietly(tx);
      throw new StoreError(`Register link ${link.id} changed during Save; reload before trying again.`);
    }
    const from = await tx.objectStore("entities").get(link.fromId);
    const to = await tx.objectStore("entities").get(link.toId);
    const pairViolation = validateRegisterLinkPairs(
      [link],
      [from, to].filter((record): record is RegisterEntity => record !== undefined)
    )[0];
    if (pairViolation) {
      abortQuietly(tx);
      throw new StoreError(pairViolation);
    }
    if (!operatorLinkRuleFor(link.fromType, link.linkType, link.toType)) {
      abortQuietly(tx);
      throw new StoreError(`The ${link.fromType} to ${link.toType} link is not supported for operator authoring.`);
    }
    const next = { ...link, createdAt: previous?.createdAt ?? link.createdAt, updatedAt: now };
    await tx.objectStore("links").put(next);
    await tx.objectStore("changeLog").add({
      id: crypto.randomUUID(),
      entityId: link.id,
      fieldSet: changedFields(previous, next),
      previousRevisionHash,
      recordedAt: now
    });
    await tx.done;
  }

  async recordRiskEscalation(event: RiskEventEntity, now: string = new Date().toISOString()): Promise<void> {
    const envelopeViolations = validateRegisterEntityEnvelope(event);
    if (envelopeViolations.length) throw new StoreError(envelopeViolations.join(" "));
    if (event.kind !== "escalation" || !event.escalation?.reason.trim()) {
      throw new StoreError("An escalation event needs an escalation state and reason.");
    }
    const tx = this.db.transaction(["entities", "changeLog"], "readwrite");
    const entities = tx.objectStore("entities");
    const risk = await entities.get(event.riskId);
    if (!risk || risk.entityType !== "risk") {
      abortQuietly(tx);
      throw new StoreError(`Risk ${event.riskId} does not exist.`);
    }
    if (await entities.get(event.id)) {
      abortQuietly(tx);
      throw new StoreError(`Risk event ${event.id} already exists.`);
    }
    if (event.escalation.destinationRiskId) {
      const destination = await entities.get(event.escalation.destinationRiskId);
      if (!destination || destination.entityType !== "risk") {
        abortQuietly(tx);
        throw new StoreError(`Destination Risk ${event.escalation.destinationRiskId} does not exist.`);
      }
    }
    const next = { ...event, createdAt: now, updatedAt: now };
    await entities.add(next);
    await tx.objectStore("changeLog").add({
      id: crypto.randomUUID(),
      entityId: event.id,
      fieldSet: Object.keys(next).sort(),
      previousRevisionHash: "",
      recordedAt: now
    });
    await tx.done;
  }

  async importRegister(file: RegisterImportFile): Promise<RegisterImportResult> {
    const tx = this.db.transaction(["entities", "links"], "readwrite");
    const entitiesStore = tx.objectStore("entities");
    const linksStore = tx.objectStore("links");
    const currentEntities = await entitiesStore.getAll();
    const currentLinks = await linksStore.getAll();
    const currentById = new Map([...currentEntities, ...currentLinks].map((record) => [record.id, record]));
    const incoming = [...file.entities, ...file.links];
    const available = new Map(currentById);
    const result: RegisterImportResult = { created: 0, updated: 0, unchanged: 0 };

    try {
      for (const record of incoming) {
        const existing = currentById.get(record.id);
        if (!existing) {
          available.set(record.id, record);
          result.created += 1;
          continue;
        }
        if (existing.entityType !== record.entityType) {
          throw new StoreError(`Register record ${record.id} cannot change type during migration.`);
        }
        if (record.updatedAt === existing.updatedAt) {
          if (stableJson(record) !== stableJson(existing)) {
            throw new StoreError(`Register record ${record.id} changed without a newer updatedAt timestamp.`);
          }
          result.unchanged += 1;
        } else if (record.updatedAt > existing.updatedAt) {
          available.set(record.id, record);
          result.updated += 1;
        } else {
          result.unchanged += 1;
        }
      }

      const merged = [...available.values()];
      const mergedEntities = merged.filter((record): record is RegisterEntity => record.entityType !== "link");
      const mergedLinks = merged.filter((record): record is LinkEntity => record.entityType === "link");
      const narrativeViolation = validateNarrativeRules(mergedEntities, [])[0];
      if (narrativeViolation) throw new StoreError(narrativeViolation.message);
      const linkViolation = validateRegisterLinkPairs(mergedLinks, mergedEntities)[0];
      if (linkViolation) throw new StoreError(linkViolation);

      for (const entity of file.entities) {
        if (shouldApplyImport(currentById.get(entity.id), entity)) await entitiesStore.put(entity);
      }
      for (const link of file.links) {
        if (shouldApplyImport(currentById.get(link.id), link)) await linksStore.put(link);
      }
      await tx.done;
      return result;
    } catch (error) {
      abortQuietly(tx);
      throw error;
    }
  }

  async listChangeLog(entityId?: string): Promise<RegisterChange[]> {
    const records = entityId
      ? await this.db.getAllFromIndex("changeLog", "by-entity", entityId)
      : await this.db.getAll("changeLog");
    return records.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
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
      tombstones: await tx.objectStore("tombstones").getAll(),
      entities: await tx.objectStore("entities").getAll(),
      links: await tx.objectStore("links").getAll(),
      changeLog: await tx.objectStore("changeLog").getAll()
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

function changedFields(previous: object | undefined, next: object): string[] {
  if (!previous) return Object.keys(next).sort();
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => field !== "updatedAt" && stableJson(before[field]) !== stableJson(after[field]))
    .sort();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function shouldApplyImport(
  previous: RegisterEntity | LinkEntity | undefined,
  incoming: RegisterEntity | LinkEntity
): boolean {
  return !previous || incoming.updatedAt > previous.updatedAt;
}
