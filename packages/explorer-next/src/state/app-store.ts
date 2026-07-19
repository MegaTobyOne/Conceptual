/**
 * Central application store.
 *
 * Wraps the open IndexedDB plus a set of @preact/signals-core signals that
 * mirror persisted state. Mutations always write through to IndexedDB first,
 * then update the corresponding signal so subscribers see consistent values.
 */

import { signal, type Signal } from '@preact/signals-core';
import {
  complianceEventsForRequirement,
  countCompliance,
  deleteCompliance,
  listCompliance,
  listComplianceEvents,
  putCompliance,
  putComplianceEvent,
} from '../data/compliance-store.ts';
import { openPspfDb, type PspfDb } from '../data/db.ts';
import { newId } from '../data/ids.ts';
import { getMeta, setMeta } from '../data/meta-store.ts';
import { getPosture, putPosture } from '../data/posture-store.ts';
import {
  deleteAction,
  deleteDirection,
  deleteRisk,
  deleteSavedView,
  deleteTag,
  deleteWorkTracking,
  listActions,
  listDirections,
  listRelationships,
  putRelationship,
  deleteRelationship,
  listRisks,
  listSavedViews,
  listTags,
  listWorkTracking,
  putAction,
  putDirection,
  putRisk,
  putSavedView,
  putTag,
  putWorkTracking,
} from '../data/stores.ts';
import {
  asActionId,
  asDirectionId,
  asRelationshipId,
  asRiskId,
  asSavedViewId,
  asTagId,
  asWorkTrackingId,
  type Action,
  type ActionId,
  type ComplianceEntry,
  type ComplianceEvent,
  type ComplianceState,
  type Direction,
  type DirectionId,
  type DirectionResponseState,
  type Relationship,
  type RelationshipId,
  type EvidenceRef,
  type PostureRecord,
  type RequirementId,
  type Risk,
  type RiskId,
  type SavedView,
  type SavedViewFilters,
  type SavedViewId,
  type Tag,
  type TagId,
  type WorkTrackingEntry,
  type WorkTrackingId,
} from '../data/types.ts';
import { requirementById } from '../pspf/index.ts';

type DirectionInput = Omit<
  Direction,
  'id' | 'createdAt' | 'updatedAt' | 'responseState' | 'evidence'
> &
  Partial<Pick<Direction, 'responseState' | 'evidence'>>;

type DirectionPatch = Partial<Omit<Direction, 'description' | 'responseNotes'>> & {
  description?: string | undefined;
  responseNotes?: string | undefined;
};

function normaliseDirection(direction: Direction): Direction {
  return {
    ...direction,
    responseState: direction.responseState ?? ('not-set' satisfies DirectionResponseState),
    evidence: direction.evidence ?? [],
  };
}

function normaliseRelationshipEndpoints(
  endpoints: readonly [string, string],
): readonly [string, string] {
  const [a, b] = endpoints;
  return a <= b ? [a, b] : [b, a];
}

export class AppStore {
  readonly db: PspfDb;

  readonly compliance: Signal<ReadonlyMap<RequirementId, ComplianceEntry>>;
  readonly complianceEvents: Signal<readonly ComplianceEvent[]>;
  readonly risks: Signal<readonly Risk[]>;
  readonly actions: Signal<readonly Action[]>;
  readonly tags: Signal<readonly Tag[]>;
  readonly savedViews: Signal<readonly SavedView[]>;
  readonly workTracking: Signal<readonly WorkTrackingEntry[]>;
  readonly directions: Signal<readonly Direction[]>;
  readonly relationships: Signal<readonly Relationship[]>;
  readonly posture: Signal<PostureRecord | undefined>;
  readonly ready: Signal<boolean>;

  constructor(db: PspfDb) {
    this.db = db;
    this.compliance = signal(new Map());
    this.complianceEvents = signal([]);
    this.risks = signal([]);
    this.actions = signal([]);
    this.tags = signal([]);
    this.savedViews = signal([]);
    this.workTracking = signal([]);
    this.directions = signal([]);
    this.relationships = signal([]);
    this.posture = signal(undefined);
    this.ready = signal(false);
  }

  static async open(name?: string): Promise<AppStore> {
    const db = await openPspfDb(name);
    const store = new AppStore(db);
    await store.loadAll();
    return store;
  }

  async loadAll(): Promise<void> {
    const [
      compliance,
      complianceEvents,
      risks,
      actions,
      tags,
      savedViews,
      workTracking,
      directions,
      relationships,
      posture,
    ] = await Promise.all([
      listCompliance(this.db),
      listComplianceEvents(this.db),
      listRisks(this.db),
      listActions(this.db),
      listTags(this.db),
      listSavedViews(this.db),
      listWorkTracking(this.db),
      listDirections(this.db),
      listRelationships(this.db),
      getPosture(this.db),
    ]);
    this.compliance.value = new Map(compliance.map((e) => [e.requirementId, e]));
    this.complianceEvents.value = complianceEvents;
    this.risks.value = risks;
    this.actions.value = actions;
    this.tags.value = tags;
    this.savedViews.value = savedViews;
    this.workTracking.value = workTracking;
    this.directions.value = directions.map(normaliseDirection);
    this.relationships.value = relationships;
    this.posture.value = posture;
    this.ready.value = true;
  }

  // ---------- Compliance ----------

  async setCompliance(
    requirementId: RequirementId,
    patch: Partial<Omit<ComplianceEntry, 'requirementId' | 'createdAt' | 'updatedAt'>> & {
      state: ComplianceState;
    },
  ): Promise<ComplianceEntry> {
    const existing = this.compliance.value.get(requirementId);
    const now = new Date().toISOString();
    const nextNotes =
      patch.notes === undefined
        ? existing?.notes
        : patch.notes.trim() === ''
          ? undefined
          : patch.notes.trim();
    const entry: ComplianceEntry = {
      requirementId,
      state: patch.state,
      evidence: patch.evidence ?? existing?.evidence ?? [],
      ...(patch.targetMaturity !== undefined ? { targetMaturity: patch.targetMaturity } : {}),
      ...(patch.reviewedAt !== undefined ? { reviewedAt: patch.reviewedAt } : {}),
      ...(patch.reviewer !== undefined ? { reviewer: patch.reviewer } : {}),
      ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await putCompliance(this.db, entry);

    const fromState: ComplianceState = existing?.state ?? 'not-set';
    if (fromState !== entry.state) {
      const event: ComplianceEvent = {
        id: newId(),
        requirementId,
        fromState,
        toState: entry.state,
        ...(entry.notes !== undefined ? { noteSnapshot: entry.notes } : {}),
        createdAt: now,
        updatedAt: now,
      };
      await putComplianceEvent(this.db, event);
      this.complianceEvents.value = [...this.complianceEvents.value, event];
    }

    const next = new Map(this.compliance.value);
    next.set(requirementId, entry);
    this.compliance.value = next;
    return entry;
  }

  async addEvidence(requirementId: RequirementId, evidence: EvidenceRef): Promise<void> {
    const existing = this.compliance.value.get(requirementId);
    const base: ComplianceEntry =
      existing ??
      ({
        requirementId,
        state: 'not-set',
        evidence: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies ComplianceEntry);
    await this.setCompliance(requirementId, {
      state: base.state,
      evidence: [...base.evidence, evidence],
      ...(base.targetMaturity !== undefined ? { targetMaturity: base.targetMaturity } : {}),
      ...(base.reviewedAt !== undefined ? { reviewedAt: base.reviewedAt } : {}),
      ...(base.reviewer !== undefined ? { reviewer: base.reviewer } : {}),
      ...(base.notes !== undefined ? { notes: base.notes } : {}),
    });
  }

  async clearCompliance(requirementId: RequirementId): Promise<void> {
    await deleteCompliance(this.db, requirementId);
    const next = new Map(this.compliance.value);
    next.delete(requirementId);
    this.compliance.value = next;
  }

  async removeEvidence(requirementId: RequirementId, index: number): Promise<void> {
    const existing = this.compliance.value.get(requirementId);
    if (!existing) return;
    if (index < 0 || index >= existing.evidence.length) return;
    const evidence = existing.evidence.filter((_, i) => i !== index);
    await this.setCompliance(requirementId, {
      state: existing.state,
      evidence,
      ...(existing.targetMaturity !== undefined ? { targetMaturity: existing.targetMaturity } : {}),
      ...(existing.reviewedAt !== undefined ? { reviewedAt: existing.reviewedAt } : {}),
      ...(existing.reviewer !== undefined ? { reviewer: existing.reviewer } : {}),
      ...(existing.notes !== undefined ? { notes: existing.notes } : {}),
    });
  }

  async complianceCount(): Promise<number> {
    return countCompliance(this.db);
  }

  async complianceHistory(requirementId: RequirementId): Promise<readonly ComplianceEvent[]> {
    return complianceEventsForRequirement(this.db, requirementId);
  }

  // ---------- Risks ----------

  async createRisk(input: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Risk> {
    const now = new Date().toISOString();
    const risk: Risk = { ...input, id: asRiskId(newId()), createdAt: now, updatedAt: now };
    await putRisk(this.db, risk);
    this.risks.value = [...this.risks.value, risk];
    return risk;
  }

  async updateRisk(id: RiskId, patch: Partial<Risk>): Promise<Risk> {
    const existing = this.risks.value.find((r) => r.id === id);
    if (!existing) throw new Error(`Risk ${id} not found`);
    const updated: Risk = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    await putRisk(this.db, updated);
    this.risks.value = this.risks.value.map((r) => (r.id === id ? updated : r));
    return updated;
  }

  async removeRisk(id: RiskId): Promise<void> {
    await deleteRisk(this.db, id);
    this.risks.value = this.risks.value.filter((r) => r.id !== id);
  }

  /**
   * Upsert a fully-formed Risk (with id) — used by importers that need to
   * preserve externally-assigned IDs and timestamps. `updatedAt` is refreshed.
   */
  async upsertRiskRecord(risk: Risk): Promise<Risk> {
    const now = new Date().toISOString();
    const existing = this.risks.value.find((r) => r.id === risk.id);
    const next: Risk = {
      ...risk,
      createdAt: existing?.createdAt ?? risk.createdAt ?? now,
      updatedAt: now,
    };
    await putRisk(this.db, next);
    this.risks.value = existing
      ? this.risks.value.map((r) => (r.id === next.id ? next : r))
      : [...this.risks.value, next];
    return next;
  }

  // ---------- Actions ----------

  async createAction(input: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>): Promise<Action> {
    const now = new Date().toISOString();
    const action: Action = { ...input, id: asActionId(newId()), createdAt: now, updatedAt: now };
    await putAction(this.db, action);
    this.actions.value = [...this.actions.value, action];
    return action;
  }

  async updateAction(id: ActionId, patch: Partial<Action>): Promise<Action> {
    const existing = this.actions.value.find((a) => a.id === id);
    if (!existing) throw new Error(`Action ${id} not found`);
    const updated: Action = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    await putAction(this.db, updated);
    this.actions.value = this.actions.value.map((a) => (a.id === id ? updated : a));
    return updated;
  }

  async removeAction(id: ActionId): Promise<void> {
    await deleteAction(this.db, id);
    this.actions.value = this.actions.value.filter((a) => a.id !== id);
  }

  /**
   * Upsert a fully-formed Action (with id) — used by importers that need to
   * preserve externally-assigned IDs and timestamps. `updatedAt` is refreshed.
   */
  async upsertActionRecord(action: Action): Promise<Action> {
    const now = new Date().toISOString();
    const existing = this.actions.value.find((a) => a.id === action.id);
    const next: Action = {
      ...action,
      createdAt: existing?.createdAt ?? action.createdAt ?? now,
      updatedAt: now,
    };
    await putAction(this.db, next);
    this.actions.value = existing
      ? this.actions.value.map((a) => (a.id === next.id ? next : a))
      : [...this.actions.value, next];
    return next;
  }

  // ---------- Tags ----------

  async createTag(input: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tag> {
    const now = new Date().toISOString();
    const tag: Tag = { ...input, id: asTagId(newId()), createdAt: now, updatedAt: now };
    await putTag(this.db, tag);
    this.tags.value = [...this.tags.value, tag];
    return tag;
  }

  async updateTag(id: TagId, patch: Partial<Tag>): Promise<Tag> {
    const existing = this.tags.value.find((t) => t.id === id);
    if (!existing) throw new Error(`Tag ${id} not found`);
    const updated: Tag = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    await putTag(this.db, updated);
    this.tags.value = this.tags.value.map((t) => (t.id === id ? updated : t));
    return updated;
  }

  async removeTag(id: TagId): Promise<void> {
    await deleteTag(this.db, id);
    this.tags.value = this.tags.value.filter((t) => t.id !== id);
  }

  // ---------- Saved views ----------

  async createSavedView(name: string, filters: SavedViewFilters): Promise<SavedView> {
    const now = new Date().toISOString();
    const view: SavedView = {
      id: asSavedViewId(newId()),
      name,
      filters,
      createdAt: now,
      updatedAt: now,
    };
    await putSavedView(this.db, view);
    this.savedViews.value = [...this.savedViews.value, view];
    return view;
  }

  async removeSavedView(id: SavedViewId): Promise<void> {
    await deleteSavedView(this.db, id);
    this.savedViews.value = this.savedViews.value.filter((v) => v.id !== id);
  }

  // ---------- Work tracking ----------

  async addWorkTracking(
    requirementId: RequirementId,
    note: string,
    effort?: string,
  ): Promise<WorkTrackingEntry> {
    const now = new Date().toISOString();
    const entry: WorkTrackingEntry = {
      id: asWorkTrackingId(newId()),
      requirementId,
      note,
      ...(effort !== undefined ? { effort } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await putWorkTracking(this.db, entry);
    this.workTracking.value = [...this.workTracking.value, entry];
    return entry;
  }

  async removeWorkTracking(id: WorkTrackingId): Promise<void> {
    await deleteWorkTracking(this.db, id);
    this.workTracking.value = this.workTracking.value.filter((w) => w.id !== id);
  }

  // ---------- Posture ----------

  async setPosture(record: PostureRecord): Promise<void> {
    await putPosture(this.db, record);
    this.posture.value = record;
  }

  // ---------- Directions ----------

  async createDirection(input: DirectionInput): Promise<Direction> {
    const now = new Date().toISOString();
    const direction: Direction = {
      ...input,
      responseState: input.responseState ?? 'not-set',
      evidence: input.evidence ?? [],
      id: asDirectionId(newId()),
      createdAt: now,
      updatedAt: now,
    };
    await putDirection(this.db, direction);
    this.directions.value = [...this.directions.value, direction];
    return direction;
  }

  async updateDirection(id: DirectionId, patch: DirectionPatch): Promise<Direction> {
    const existing = this.directions.value.find((d) => d.id === id);
    if (!existing) throw new Error(`Direction ${id} not found`);
    const merged = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    } as Direction & { description?: string | undefined; responseNotes?: string | undefined };
    if (Object.hasOwn(patch, 'description') && patch.description === undefined) {
      delete merged.description;
    }
    if (Object.hasOwn(patch, 'responseNotes') && patch.responseNotes === undefined) {
      delete merged.responseNotes;
    }
    const updated: Direction = normaliseDirection(merged);
    await putDirection(this.db, updated);
    this.directions.value = this.directions.value.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async removeDirection(id: DirectionId): Promise<void> {
    await deleteDirection(this.db, id);
    this.directions.value = this.directions.value.filter((d) => d.id !== id);
  }

  // ---------- Relationships ----------

  #relationshipEndpointExists(kind: Relationship['kind'], endpoint: string): boolean {
    switch (kind) {
      case 'requirement-risk':
      case 'requirement-action':
      case 'requirement-direction':
        return (
          requirementById.has(endpoint as RequirementId) ||
          this.risks.value.some((risk) => risk.id === endpoint) ||
          this.actions.value.some((action) => action.id === endpoint) ||
          this.directions.value.some((direction) => direction.id === endpoint)
        );
      case 'risk-action':
        return (
          this.risks.value.some((risk) => risk.id === endpoint) ||
          this.actions.value.some((action) => action.id === endpoint)
        );
    }
  }

  #isKindCompatible(kind: Relationship['kind'], a: string, b: string): boolean {
    const isRequirement =
      requirementById.has(a as RequirementId) || requirementById.has(b as RequirementId);
    const isRiskPair =
      this.risks.value.some((risk) => risk.id === a) ||
      this.risks.value.some((risk) => risk.id === b);
    const isActionPair =
      this.actions.value.some((action) => action.id === a) ||
      this.actions.value.some((action) => action.id === b);
    const isDirectionPair =
      this.directions.value.some((direction) => direction.id === a) ||
      this.directions.value.some((direction) => direction.id === b);

    switch (kind) {
      case 'requirement-risk':
        return isRequirement && isRiskPair;
      case 'requirement-action':
        return isRequirement && isActionPair;
      case 'risk-action':
        return isRiskPair && isActionPair;
      case 'requirement-direction':
        return isRequirement && isDirectionPair;
    }
  }

  #validateRelationshipInput(
    kind: Relationship['kind'],
    endpoints: readonly [string, string],
  ): void {
    const [aRaw, bRaw] = endpoints;
    const a = aRaw.trim();
    const b = bRaw.trim();
    if (!a || !b) {
      throw new Error('Relationship endpoints must be non-empty.');
    }
    if (a === b) {
      throw new Error('Relationship endpoints cannot be identical.');
    }
    if (!this.#relationshipEndpointExists(kind, a) || !this.#relationshipEndpointExists(kind, b)) {
      throw new Error('Relationship endpoint does not exist.');
    }
    if (!this.#isKindCompatible(kind, a, b)) {
      throw new Error(`Relationship endpoints are not valid for kind "${kind}".`);
    }
    const normalised = normaliseRelationshipEndpoints([a, b]);
    const duplicate = this.relationships.value.some(
      (relationship) =>
        relationship.kind === kind &&
        relationship.endpoints[0] === normalised[0] &&
        relationship.endpoints[1] === normalised[1],
    );
    if (duplicate) {
      throw new Error('Relationship already exists.');
    }
  }

  async createRelationship(
    input: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Relationship> {
    const now = new Date().toISOString();
    this.#validateRelationshipInput(input.kind, input.endpoints);
    const endpoints = normaliseRelationshipEndpoints([
      input.endpoints[0].trim(),
      input.endpoints[1].trim(),
    ]);
    const relationship: Relationship = {
      ...input,
      endpoints,
      id: asRelationshipId(newId()),
      createdAt: now,
      updatedAt: now,
    };
    await putRelationship(this.db, relationship);
    this.relationships.value = [...this.relationships.value, relationship];
    return relationship;
  }

  async removeRelationship(id: RelationshipId): Promise<void> {
    await deleteRelationship(this.db, id);
    this.relationships.value = this.relationships.value.filter((r) => r.id !== id);
  }

  // ---------- Meta ----------

  async getMeta(key: string): Promise<unknown> {
    const record = await getMeta(this.db, key);
    return record?.value;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await setMeta(this.db, key, value);
  }
}
