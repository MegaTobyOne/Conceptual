/**
 * Core master-bundle interop (ADR 0009, ADR 0084 Phase C).
 *
 * Import: parse, plan, and apply a manifest-led master bundle exported by
 * pspf-core, mapping Core entities onto local records. Baseline requirements
 * are matched via their canonical PSPF IDs (ADR 0002).
 *
 * Export: rebuild a Core-importable master bundle from local records,
 * preserving pass-through collections from the last imported bundle so the
 * round trip (Core → Explorer → Core) is non-destructive.
 */

import {
  PSPF_SLICE_VERSION,
  VERSION_AXES,
  V0_1_COLLECTIONS,
  hasCompatibleMajorVersion,
} from '@pspf/contracts';
import type {
  Action,
  ComplianceEntry,
  ComplianceState,
  Direction,
  DirectionResponseState,
  EvidenceRef,
  Relationship,
  RelationshipKind,
  Requirement,
  RequirementId,
  Risk,
} from './types.ts';
import {
  ACTION_STATUSES,
  DIRECTION_RESPONSE_STATES,
  RISK_STATUSES,
  asActionId,
  asDirectionId,
  asRelationshipId,
  asRiskId,
} from './types.ts';
import { newId } from './ids.ts';

// ---------- Bundle shapes ----------

export interface CoreRecord {
  id: string;
  entityType?: string;
  title?: string;
  [key: string]: unknown;
}

export type CoreCollections = Record<string, CoreRecord[]>;

export interface CoreManifestCollection {
  name: string;
  path: string;
  count: number;
  hash?: { alg: string; value: string };
}

export interface CoreBundleManifest {
  bundleType: string;
  bundleVersion: string;
  schemaVersion: string;
  apiVersion: string;
  generatedAt?: string;
  generator?: {
    product?: string;
    mode?: string;
    profile?: string;
    productVersion?: string;
    workspaceId?: string;
    snapshotId?: string;
  };
  security?: {
    classification?: string;
    containsSensitiveData?: boolean;
    redactionProfile?: string;
  };
  compatibility?: Record<string, string>;
  collections?: CoreManifestCollection[];
  indexes?: unknown[];
  $schema?: string;
}

export interface CoreBundle {
  manifest: CoreBundleManifest;
  collections: CoreCollections;
}

export const CORE_BUNDLE_TYPE = 'pspf-explorer-bundle' as const;

/** Meta-store keys used to persist round-trip state. */
export const CORE_BUNDLE_META_KEYS = {
  source: 'coreBundle.source',
  idMap: 'coreBundle.idMap',
  importedAt: 'coreBundle.importedAt',
} as const;

export class CoreBundleError extends Error {}

// ---------- Parse & validate ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCoreBundle(value: unknown): CoreBundle {
  if (!isRecord(value)) {
    throw new CoreBundleError('The selected file is not a JSON object.');
  }
  const manifest = value.manifest;
  if (!isRecord(manifest)) {
    throw new CoreBundleError(
      'No manifest found. Select the single master bundle JSON exported by PSPF Core (bundle.json).',
    );
  }
  if (manifest.bundleType !== CORE_BUNDLE_TYPE) {
    const found = typeof manifest.bundleType === 'string' ? manifest.bundleType : 'unknown';
    throw new CoreBundleError(
      `Unsupported bundle type "${found}". Expected "${CORE_BUNDLE_TYPE}".`,
    );
  }
  for (const axis of ['schemaVersion', 'bundleVersion', 'apiVersion'] as const) {
    const actual = manifest[axis];
    if (typeof actual !== 'string' || !hasCompatibleMajorVersion(actual, VERSION_AXES[axis])) {
      const found = typeof actual === 'string' ? actual : 'unknown';
      throw new CoreBundleError(
        `This bundle declares ${axis} ${found}, which is not compatible with ${axis} ${VERSION_AXES[axis]} expected by this Explorer.`,
      );
    }
  }
  const collectionsValue = value.collections;
  if (!isRecord(collectionsValue)) {
    throw new CoreBundleError(
      'No collections found. Select the single master bundle JSON that embeds its collections.',
    );
  }
  const collections: CoreCollections = {};
  for (const [name, records] of Object.entries(collectionsValue)) {
    if (!Array.isArray(records)) {
      throw new CoreBundleError(`Collection "${name}" is not an array of records.`);
    }
    collections[name] = records.filter(
      (record): record is CoreRecord => isRecord(record) && typeof record.id === 'string',
    );
  }
  return { manifest: manifest as unknown as CoreBundleManifest, collections };
}

export function coreBundleIdentity(manifest: CoreBundleManifest): string {
  const stableParts = [
    manifest.generator?.workspaceId,
    manifest.generator?.snapshotId,
    manifest.schemaVersion,
  ].filter((part): part is string => Boolean(part));
  if (stableParts.length > 0) return stableParts.join('::');
  return (
    [manifest.generatedAt, manifest.schemaVersion]
      .filter((part): part is string => Boolean(part))
      .join('::') || 'unknown'
  );
}

export interface CoreChecksumMismatch {
  collection: string;
  expected: string;
  actual: string;
}

/**
 * Verify the manifest's SHA-256 collection checksums against the embedded
 * collections, using the same canonical serialisation as PSPF Core
 * (`JSON.stringify(records, null, 2)` plus a trailing newline). Collections
 * without a SHA-256 manifest entry are skipped, so older sample bundles
 * without hashes still load.
 */
export async function verifyCoreBundleChecksums(
  bundle: CoreBundle,
): Promise<CoreChecksumMismatch[]> {
  const mismatches: CoreChecksumMismatch[] = [];
  for (const entry of bundle.manifest.collections ?? []) {
    if (entry.hash?.alg !== 'SHA-256' || !entry.hash.value) continue;
    const records = bundle.collections[entry.name];
    if (!records) continue;
    const actual = await sha256Hex(`${JSON.stringify(records, null, 2)}\n`);
    if (actual !== entry.hash.value) {
      mismatches.push({ collection: entry.name, expected: entry.hash.value, actual });
    }
  }
  return mismatches;
}

// ---------- Status vocabularies ----------

/** Core AssessmentStatus → local ComplianceState (lossy states carry a note). */
const COMPLIANCE_BY_ASSESSMENT: Record<string, ComplianceState> = {
  met: 'yes',
  'not-met': 'no',
  'partially-met': 'no',
  'not-applicable': 'not-applicable',
};

/** Local ComplianceState → Core AssessmentStatus. */
const ASSESSMENT_BY_COMPLIANCE: Partial<Record<ComplianceState, string>> = {
  yes: 'met',
  no: 'not-met',
  'risk-managed': 'partially-met',
  'not-applicable': 'not-applicable',
};

function clampScore(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  return Math.max(1, Math.min(5, Math.round(num))) as 1 | 2 | 3 | 4 | 5;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

// ---------- Import plan ----------

export interface CoreCompliancePlanItem {
  requirementId: RequirementId;
  canonicalId: string;
  state: ComplianceState;
  sourceStatus: string;
  note?: string;
}

export interface CoreEvidencePlanItem {
  requirementId: RequirementId;
  ref: EvidenceRef;
  bundleId: string;
}

export interface CoreRecordPlanItem<T> {
  record: T;
  bundleId: string;
}

export interface CoreRelationshipPlanItem {
  record: Relationship;
  bundleId: string;
}

export interface CoreSkippedItem {
  collection: string;
  id: string;
  reason: string;
}

export interface CorePassThroughItem {
  collection: string;
  count: number;
}

export interface CoreImportPlan {
  identity: string;
  classification?: string;
  compliance: readonly CoreCompliancePlanItem[];
  evidence: readonly CoreEvidencePlanItem[];
  risks: readonly CoreRecordPlanItem<Risk>[];
  actions: readonly CoreRecordPlanItem<Action>[];
  directions: readonly CoreRecordPlanItem<Direction>[];
  relationships: readonly CoreRelationshipPlanItem[];
  skipped: readonly CoreSkippedItem[];
  passThrough: readonly CorePassThroughItem[];
}

export interface CorePlanContext {
  /** Canonical PSPF requirement ID (REQ-PSPF-2025-NNN) → local requirement ID. */
  canonicalToApp: ReadonlyMap<string, RequirementId>;
  generateId?: () => string;
  now?: string;
}

const MANAGED_COLLECTIONS = new Set([
  'requirements',
  'evidence',
  'actions',
  'risks',
  'directions',
  'links',
]);

function normaliseEndpoints(a: string, b: string): readonly [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function planCoreBundleImport(bundle: CoreBundle, ctx: CorePlanContext): CoreImportPlan {
  const gen = ctx.generateId ?? newId;
  const now = ctx.now ?? new Date().toISOString();
  const skipped: CoreSkippedItem[] = [];
  const passThrough: CorePassThroughItem[] = [];

  // Requirements → compliance states.
  const compliance: CoreCompliancePlanItem[] = [];
  const appIdByBundleId = new Map<string, string>();
  for (const record of bundle.collections.requirements ?? []) {
    const appId = ctx.canonicalToApp.get(record.id);
    if (!appId) {
      skipped.push({
        collection: 'requirements',
        id: record.id,
        reason:
          'Not a PSPF baseline requirement (authored in Workshop); kept in the bundle for round-trip.',
      });
      continue;
    }
    appIdByBundleId.set(record.id, appId);
    const sourceStatus = asString(record.assessmentStatus) ?? 'not-started';
    const state = COMPLIANCE_BY_ASSESSMENT[sourceStatus];
    if (!state) continue;
    const item: CoreCompliancePlanItem = {
      requirementId: appId,
      canonicalId: record.id,
      state,
      sourceStatus,
    };
    if (state !== 'not-applicable' && sourceStatus !== 'met' && sourceStatus !== 'not-met') {
      item.note = `Imported from Core bundle with assessment status "${sourceStatus}".`;
    }
    compliance.push(item);
  }

  // Risks.
  const risks: CoreRecordPlanItem<Risk>[] = [];
  const riskByBundleId = new Map<string, Risk>();
  for (const record of bundle.collections.risks ?? []) {
    const status = asString(record.status);
    const description = asString(record.description);
    const risk: Risk = {
      id: asRiskId(gen()),
      title: asString(record.title) ?? record.id,
      ...(description !== undefined ? { description } : {}),
      likelihood: clampScore(record.likelihood),
      impact: clampScore(record.impact),
      status:
        status && (RISK_STATUSES as readonly string[]).includes(status)
          ? (status as Risk['status'])
          : 'open',
      requirementIds: [],
      actionIds: [],
      createdAt: asString(record.createdAt) ?? now,
      updatedAt: asString(record.updatedAt) ?? now,
    };
    risks.push({ record: risk, bundleId: record.id });
    riskByBundleId.set(record.id, risk);
    appIdByBundleId.set(record.id, risk.id);
  }

  // Actions.
  const actions: CoreRecordPlanItem<Action>[] = [];
  const actionByBundleId = new Map<string, Action>();
  for (const record of bundle.collections.actions ?? []) {
    const status = asString(record.status);
    const description = asString(record.description);
    const dueAt = asString(record.dueDate) ?? asString(record.dueAt);
    const action: Action = {
      id: asActionId(gen()),
      title: asString(record.title) ?? record.id,
      ...(description !== undefined ? { description } : {}),
      type: 'remediation',
      status:
        status && (ACTION_STATUSES as readonly string[]).includes(status)
          ? (status as Action['status'])
          : 'todo',
      ...(dueAt !== undefined ? { dueAt } : {}),
      requirementIds: [],
      riskIds: [],
      createdAt: asString(record.createdAt) ?? now,
      updatedAt: asString(record.updatedAt) ?? now,
    };
    actions.push({ record: action, bundleId: record.id });
    actionByBundleId.set(record.id, action);
    appIdByBundleId.set(record.id, action.id);
  }

  // Directions.
  const directions: CoreRecordPlanItem<Direction>[] = [];
  const directionByBundleId = new Map<string, Direction>();
  for (const record of bundle.collections.directions ?? []) {
    const responseState = asString(record.responseState);
    const sourceAuthority = asString(record.sourceAuthority);
    const descriptionParts = [asString(record.description)];
    if (sourceAuthority) descriptionParts.push(`Source authority: ${sourceAuthority}`);
    const description = descriptionParts.filter(Boolean).join('\n');
    const direction: Direction = {
      id: asDirectionId(gen()),
      reference: asString(record.reference) ?? record.id,
      title: asString(record.title) ?? record.id,
      issuedAt: asString(record.issuedAt) ?? now,
      ...(description !== '' ? { description } : {}),
      requirementIds: [],
      responseState:
        responseState && (DIRECTION_RESPONSE_STATES as readonly string[]).includes(responseState)
          ? (responseState as DirectionResponseState)
          : 'not-set',
      evidence: [],
      createdAt: asString(record.createdAt) ?? now,
      updatedAt: asString(record.updatedAt) ?? now,
    };
    directions.push({ record: direction, bundleId: record.id });
    directionByBundleId.set(record.id, direction);
    appIdByBundleId.set(record.id, direction.id);
  }

  // Evidence records, indexed for link resolution.
  const evidenceRecordById = new Map<string, CoreRecord>();
  for (const record of bundle.collections.evidence ?? []) {
    evidenceRecordById.set(record.id, record);
  }

  // Links → evidence refs, record cross-references, relationships.
  const evidence: CoreEvidencePlanItem[] = [];
  const relationships: CoreRelationshipPlanItem[] = [];
  const seenRelationshipKeys = new Set<string>();
  const linkedEvidenceIds = new Set<string>();

  const pushRelationship = (
    kind: RelationshipKind,
    a: string,
    b: string,
    bundleId: string,
  ): void => {
    const endpoints = normaliseEndpoints(a, b);
    const key = `${kind}:${endpoints[0]}:${endpoints[1]}`;
    if (seenRelationshipKeys.has(key)) return;
    seenRelationshipKeys.add(key);
    relationships.push({
      record: {
        id: asRelationshipId(gen()),
        kind,
        endpoints,
        createdAt: now,
        updatedAt: now,
      },
      bundleId,
    });
  };

  for (const link of bundle.collections.links ?? []) {
    const fromId = asString(link.fromId);
    const toId = asString(link.toId);
    const fromType = asString(link.fromType);
    const toType = asString(link.toType);
    if (!fromId || !toId || !fromType || !toType) {
      skipped.push({
        collection: 'links',
        id: link.id,
        reason: 'Link is missing endpoint details.',
      });
      continue;
    }
    const pair = [
      { id: fromId, type: fromType },
      { id: toId, type: toType },
    ];
    const requirementEnd = pair.find((end) => end.type === 'requirement');
    const riskEnd = pair.find((end) => end.type === 'risk');
    const actionEnd = pair.find((end) => end.type === 'action');
    const directionEnd = pair.find((end) => end.type === 'direction');
    const evidenceEnd = pair.find((end) => end.type === 'evidence');

    if (requirementEnd && evidenceEnd) {
      const appReqId = ctx.canonicalToApp.get(requirementEnd.id);
      const evidenceRecord = evidenceRecordById.get(evidenceEnd.id);
      if (!appReqId || !evidenceRecord) {
        skipped.push({
          collection: 'links',
          id: link.id,
          reason:
            'Evidence link endpoints could not be matched locally; kept in the bundle for round-trip.',
        });
        continue;
      }
      const reference = asString(evidenceRecord.reference);
      const title = asString(evidenceRecord.title);
      const isUrl = reference !== undefined && /^https?:\/\//.test(reference);
      const ref: EvidenceRef = {
        kind: isUrl ? 'url' : 'note',
        value: isUrl
          ? reference
          : [title, reference].filter(Boolean).join(' — ') || evidenceRecord.id,
        addedAt: asString(evidenceRecord.updatedAt) ?? now,
      };
      evidence.push({ requirementId: appReqId, ref, bundleId: evidenceRecord.id });
      linkedEvidenceIds.add(evidenceRecord.id);
      continue;
    }

    const requirementAppId = requirementEnd ? ctx.canonicalToApp.get(requirementEnd.id) : undefined;
    if (requirementEnd && riskEnd) {
      const risk = riskByBundleId.get(riskEnd.id);
      if (requirementAppId && risk) {
        risk.requirementIds = [...risk.requirementIds, requirementAppId];
        pushRelationship('requirement-risk', requirementAppId, risk.id, link.id);
        continue;
      }
    }
    if (requirementEnd && actionEnd) {
      const action = actionByBundleId.get(actionEnd.id);
      if (requirementAppId && action) {
        action.requirementIds = [...action.requirementIds, requirementAppId];
        pushRelationship('requirement-action', requirementAppId, action.id, link.id);
        continue;
      }
    }
    if (requirementEnd && directionEnd) {
      const direction = directionByBundleId.get(directionEnd.id);
      if (requirementAppId && direction) {
        direction.requirementIds = [...direction.requirementIds, requirementAppId];
        pushRelationship('requirement-direction', requirementAppId, direction.id, link.id);
        continue;
      }
    }
    if (riskEnd && actionEnd) {
      const risk = riskByBundleId.get(riskEnd.id);
      const action = actionByBundleId.get(actionEnd.id);
      if (risk && action) {
        risk.actionIds = [...risk.actionIds, action.id];
        action.riskIds = [...action.riskIds, risk.id];
        pushRelationship('risk-action', risk.id, action.id, link.id);
        continue;
      }
    }
    skipped.push({
      collection: 'links',
      id: link.id,
      reason: 'Link endpoints are not modelled locally; kept in the bundle for round-trip.',
    });
  }

  for (const record of bundle.collections.evidence ?? []) {
    if (!linkedEvidenceIds.has(record.id)) {
      skipped.push({
        collection: 'evidence',
        id: record.id,
        reason:
          'Evidence is not linked to a PSPF baseline requirement; kept in the bundle for round-trip.',
      });
    }
  }

  for (const [name, records] of Object.entries(bundle.collections)) {
    if (!MANAGED_COLLECTIONS.has(name) && records.length > 0) {
      passThrough.push({ collection: name, count: records.length });
    }
  }

  const classification = bundle.manifest.security?.classification;
  return {
    identity: coreBundleIdentity(bundle.manifest),
    ...(classification !== undefined ? { classification } : {}),
    compliance,
    evidence,
    risks,
    actions,
    directions,
    relationships,
    skipped,
    passThrough,
  };
}

// ---------- Apply ----------

export interface CoreApplyTarget {
  setCompliance(
    requirementId: RequirementId,
    patch: { state: ComplianceState; notes?: string },
  ): Promise<unknown>;
  addEvidence(requirementId: RequirementId, evidence: EvidenceRef): Promise<unknown>;
  upsertRiskRecord(risk: Risk): Promise<unknown>;
  upsertActionRecord(action: Action): Promise<unknown>;
  upsertDirectionRecord(direction: Direction): Promise<unknown>;
  upsertRelationshipRecord(relationship: Relationship): Promise<unknown>;
}

export interface CoreImportSummary {
  compliance: number;
  evidence: number;
  risks: number;
  actions: number;
  directions: number;
  relationships: number;
}

/**
 * Applies an import plan and returns the id map to persist for round-trip
 * exports (local identity key → original bundle record ID).
 */
export async function applyCoreBundleImport(
  plan: CoreImportPlan,
  target: CoreApplyTarget,
): Promise<{ summary: CoreImportSummary; idMap: Record<string, string> }> {
  const idMap: Record<string, string> = {};
  for (const item of plan.compliance) {
    await target.setCompliance(item.requirementId, {
      state: item.state,
      ...(item.note !== undefined ? { notes: item.note } : {}),
    });
  }
  for (const item of plan.evidence) {
    await target.addEvidence(item.requirementId, item.ref);
    idMap[`evidence:${item.requirementId}:${item.ref.addedAt}:${item.ref.value}`] = item.bundleId;
  }
  for (const item of plan.risks) {
    await target.upsertRiskRecord(item.record);
    idMap[`risk:${item.record.id}`] = item.bundleId;
  }
  for (const item of plan.actions) {
    await target.upsertActionRecord(item.record);
    idMap[`action:${item.record.id}`] = item.bundleId;
  }
  for (const item of plan.directions) {
    await target.upsertDirectionRecord(item.record);
    idMap[`direction:${item.record.id}`] = item.bundleId;
  }
  for (const item of plan.relationships) {
    await target.upsertRelationshipRecord(item.record);
    const [a, b] = item.record.endpoints;
    idMap[`relationship:${item.record.kind}:${a}:${b}`] = item.bundleId;
  }
  return {
    summary: {
      compliance: plan.compliance.length,
      evidence: plan.evidence.length,
      risks: plan.risks.length,
      actions: plan.actions.length,
      directions: plan.directions.length,
      relationships: plan.relationships.length,
    },
    idMap,
  };
}

// ---------- Export ----------

export interface CoreExportInput {
  requirements: readonly Requirement[];
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>;
  risks: readonly Risk[];
  actions: readonly Action[];
  directions: readonly Direction[];
  relationships: readonly Relationship[];
  /** Last imported bundle, if any (pass-through collections come from here). */
  source?: CoreBundle;
  /** Persistent local-identity → bundle-ID map; updated ids are returned. */
  idMap: Record<string, string>;
  now?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function envelope(
  id: string,
  entityType: string,
  title: string,
  createdAt: string,
  now: string,
): CoreRecord {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    title,
    createdAt,
    updatedAt: now,
    sourceProduct: 'explorer',
    recordStatus: 'active',
  };
}

export async function buildCoreBundleExport(
  input: CoreExportInput,
): Promise<{ bundle: CoreBundle; idMap: Record<string, string> }> {
  const now = input.now ?? new Date().toISOString();
  const idMap = { ...input.idMap };
  const idFor = (key: string, prefix: string): string => {
    const existing = idMap[key];
    if (existing) return existing;
    const created = `${prefix}-${crypto.randomUUID()}`;
    idMap[key] = created;
    return created;
  };

  const canonicalByApp = new Map<RequirementId, string>(
    input.requirements.map((requirement) => [requirement.id, requirement.canonicalId]),
  );
  const requirementByApp = new Map<RequirementId, Requirement>(
    input.requirements.map((requirement) => [requirement.id, requirement]),
  );

  const collections: CoreCollections = input.source
    ? (JSON.parse(JSON.stringify(input.source.collections)) as CoreCollections)
    : {};
  for (const collectionName of V0_1_COLLECTIONS) {
    collections[collectionName] ??= [];
  }

  // Requirements: overlay assessment statuses onto baseline records.
  const requirements = collections.requirements ?? [];
  const requirementRecordById = new Map(requirements.map((record) => [record.id, record]));
  for (const [appId, entry] of input.compliance) {
    if (entry.state === 'not-set') continue;
    const canonicalId = canonicalByApp.get(appId);
    const assessmentStatus = ASSESSMENT_BY_COMPLIANCE[entry.state];
    if (!canonicalId || !assessmentStatus) continue;
    const existing = requirementRecordById.get(canonicalId);
    if (existing) {
      existing.assessmentStatus = assessmentStatus;
      existing.updatedAt = now;
      existing.sourceProduct = 'explorer';
    } else {
      const requirement = requirementByApp.get(appId);
      const record: CoreRecord = {
        ...envelope(
          canonicalId,
          'requirement',
          requirement?.title ?? canonicalId,
          entry.createdAt,
          now,
        ),
        assessmentStatus,
      };
      requirements.push(record);
      requirementRecordById.set(canonicalId, record);
    }
  }
  collections.requirements = requirements;

  // Risks, actions, directions: replace collections with local records.
  collections.risks = input.risks.map((risk) => ({
    ...envelope(idFor(`risk:${risk.id}`, 'RSK'), 'risk', risk.title, risk.createdAt, now),
    ...(risk.description !== undefined ? { description: risk.description } : {}),
    status: risk.status,
    likelihood: risk.likelihood,
    impact: risk.impact,
  }));
  collections.actions = input.actions.map((action) => ({
    ...envelope(idFor(`action:${action.id}`, 'ACT'), 'action', action.title, action.createdAt, now),
    ...(action.description !== undefined ? { description: action.description } : {}),
    status: action.status,
    ...(action.dueAt !== undefined ? { dueDate: action.dueAt } : {}),
  }));
  collections.directions = input.directions.map((direction) => ({
    ...envelope(
      idFor(`direction:${direction.id}`, 'DIR'),
      'direction',
      direction.title,
      direction.createdAt,
      now,
    ),
    reference: direction.reference,
    issuedAt: direction.issuedAt,
    responseState: direction.responseState,
  }));

  // Resolve any local endpoint (requirement code or local record id) to its bundle ID.
  const bundleIdForEndpoint = (endpoint: string): { id: string; type: string } | undefined => {
    const canonical = canonicalByApp.get(endpoint as RequirementId);
    if (canonical) return { id: canonical, type: 'requirement' };
    if (input.risks.some((risk) => risk.id === endpoint)) {
      return { id: idFor(`risk:${endpoint}`, 'RSK'), type: 'risk' };
    }
    if (input.actions.some((action) => action.id === endpoint)) {
      return { id: idFor(`action:${endpoint}`, 'ACT'), type: 'action' };
    }
    if (input.directions.some((direction) => direction.id === endpoint)) {
      return { id: idFor(`direction:${endpoint}`, 'DIR'), type: 'direction' };
    }
    return undefined;
  };

  // Links: keep pass-through links unless both endpoints are locally managed
  // kinds (those are rebuilt from local relationships and record arrays).
  const managedTypes = new Set(['requirement', 'risk', 'action', 'direction']);
  const links = (collections.links ?? []).filter((link) => {
    const fromType = asString(link.fromType);
    const toType = asString(link.toType);
    return !(fromType && toType && managedTypes.has(fromType) && managedTypes.has(toType));
  });

  const linkPairs = new Map<string, { kind: RelationshipKind; a: string; b: string }>();
  const addPair = (kind: RelationshipKind, a: string, b: string): void => {
    const endpoints = normaliseEndpoints(a, b);
    linkPairs.set(`${kind}:${endpoints[0]}:${endpoints[1]}`, {
      kind,
      a: endpoints[0],
      b: endpoints[1],
    });
  };
  for (const relationship of input.relationships) {
    addPair(relationship.kind, relationship.endpoints[0], relationship.endpoints[1]);
  }
  for (const risk of input.risks) {
    for (const reqId of risk.requirementIds) addPair('requirement-risk', reqId, risk.id);
    for (const actionId of risk.actionIds) addPair('risk-action', risk.id, actionId);
  }
  for (const action of input.actions) {
    for (const reqId of action.requirementIds) addPair('requirement-action', reqId, action.id);
    for (const riskId of action.riskIds) addPair('risk-action', riskId, action.id);
  }
  for (const direction of input.directions) {
    for (const reqId of direction.requirementIds) {
      addPair('requirement-direction', reqId, direction.id);
    }
  }

  const LINK_SPECS: Record<
    RelationshipKind,
    { linkType: string; fromType: string; toType: string; title: string }
  > = {
    'requirement-risk': {
      linkType: 'exposed-by',
      fromType: 'requirement',
      toType: 'risk',
      title: 'Requirement exposed by risk',
    },
    'requirement-action': {
      linkType: 'addressed-by',
      fromType: 'requirement',
      toType: 'action',
      title: 'Requirement addressed by action',
    },
    'risk-action': {
      linkType: 'treated-by',
      fromType: 'risk',
      toType: 'action',
      title: 'Risk treated by action',
    },
    'requirement-direction': {
      linkType: 'targets',
      fromType: 'direction',
      toType: 'requirement',
      title: 'Direction targets requirement',
    },
  };

  for (const [key, pair] of linkPairs) {
    const spec = LINK_SPECS[pair.kind];
    const endA = bundleIdForEndpoint(pair.a);
    const endB = bundleIdForEndpoint(pair.b);
    if (!endA || !endB) continue;
    const from = endA.type === spec.fromType ? endA : endB;
    const to = endA.type === spec.fromType ? endB : endA;
    if (from.type !== spec.fromType || to.type !== spec.toType) continue;
    links.push({
      ...envelope(idFor(`relationship:${key}`, 'LNK'), 'link', spec.title, now, now),
      linkType: spec.linkType,
      fromId: from.id,
      fromType: from.type,
      toId: to.id,
      toType: to.type,
    });
  }

  // Evidence: pass-through, plus locally added compliance evidence references.
  const evidence = collections.evidence ?? [];
  const evidenceIds = new Set(evidence.map((record) => record.id));
  for (const [appId, entry] of input.compliance) {
    const canonicalId = canonicalByApp.get(appId);
    if (!canonicalId) continue;
    for (const ref of entry.evidence) {
      const key = `evidence:${appId}:${ref.addedAt}:${ref.value}`;
      const knownId = idMap[key];
      if (knownId && evidenceIds.has(knownId)) continue; // imported, already in pass-through
      const isUrl = ref.kind === 'url';
      const evidenceId = idFor(key, 'EVD');
      if (evidenceIds.has(evidenceId)) continue;
      evidenceIds.add(evidenceId);
      const title = isUrl ? 'Explorer evidence reference' : ref.value.slice(0, 96);
      evidence.push({
        ...envelope(evidenceId, 'evidence', title, ref.addedAt, now),
        evidenceType: isUrl ? 'url' : 'document',
        reference: ref.value,
        freshness: 'unknown',
      });
      links.push({
        ...envelope(
          idFor(`evidence-link:${key}`, 'LNK'),
          'link',
          'Evidence supports requirement',
          ref.addedAt,
          now,
        ),
        linkType: 'supported-by',
        fromId: canonicalId,
        fromType: 'requirement',
        toId: evidenceId,
        toType: 'evidence',
      });
    }
  }
  collections.evidence = evidence;
  collections.links = links;

  // Posture: emit the required singleton and refresh its summary counts.
  const previousPosture = collections.posture?.[0];
  collections.posture = [
    {
      ...previousPosture,
      ...envelope(
        'POSTURE',
        'posture',
        typeof previousPosture?.title === 'string'
          ? previousPosture.title
          : 'PSPF Explorer posture',
        typeof previousPosture?.createdAt === 'string' ? previousPosture.createdAt : now,
        now,
      ),
      requirementCount: collections.requirements?.length ?? 0,
      evidenceCount: collections.evidence?.length ?? 0,
      actionCount: collections.actions?.length ?? 0,
      riskCount: collections.risks?.length ?? 0,
      sourceControlCount: collections['source-controls']?.length ?? 0,
      requirementControlMappingCount: collections['requirement-control-mappings']?.length ?? 0,
      directionCount: collections.directions?.length ?? 0,
      changeRecordCount: collections['change-records']?.length ?? 0,
      supplierCount: collections.suppliers?.length ?? 0,
      contractCount: collections.contracts?.length ?? 0,
      spendItemCount: collections['spend-items']?.length ?? 0,
      strategyCount: collections.strategies?.length ?? 0,
    },
  ];

  // Manifest.
  const manifestCollections: CoreManifestCollection[] = [];
  for (const name of V0_1_COLLECTIONS) {
    const records = collections[name] ?? [];
    const serialised = `${JSON.stringify(records, null, 2)}\n`;
    manifestCollections.push({
      name,
      path: `./collections/${name}.json`,
      count: records.length,
      hash: { alg: 'SHA-256', value: await sha256Hex(serialised) },
    });
  }

  const workspaceId =
    input.source?.manifest.generator?.workspaceId ??
    idMap.workspace ??
    `pspf-explorer-web-${crypto.randomUUID()}`;
  idMap.workspace = workspaceId;
  const manifest: CoreBundleManifest = {
    $schema: './schemas/manifest.schema.json',
    bundleType: CORE_BUNDLE_TYPE,
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion,
    apiVersion: VERSION_AXES.apiVersion,
    generatedAt: now,
    generator: {
      product: 'pspf-explorer',
      mode: 'local-authoring',
      productVersion: PSPF_SLICE_VERSION,
      workspaceId,
    },
    compatibility: {
      explorerMin: PSPF_SLICE_VERSION,
      explorerTested: PSPF_SLICE_VERSION,
    },
    security: input.source?.manifest.security ?? {
      classification: 'OFFICIAL: Sensitive',
      containsSensitiveData: true,
      redactionProfile: 'explorer-default',
    },
    collections: manifestCollections,
    indexes: [],
  };

  const currentCollections = Object.fromEntries(
    V0_1_COLLECTIONS.map((collectionName) => [collectionName, collections[collectionName] ?? []]),
  ) as CoreCollections;
  return { bundle: { manifest, collections: currentCollections }, idMap };
}
