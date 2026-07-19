/**
 * Risk + Action import: ingest risks and actions emitted by an external
 * system (GRC tooling, spreadsheet exports, prior PSPF Explorer captures).
 *
 * The import is upsert: each entry is matched to an existing record by `id`.
 * If `id` is omitted a fresh ID is generated. The intake payload is validated
 * against a locked schema (unknown fields rejected) and produces a *plan* —
 * a list of additions and updates the user can review and selectively apply.
 *
 * Format:
 *   {
 *     pspfWorkImport: 'v1',
 *     source: string,
 *     capturedAt: ISO8601,
 *     risks?: [
 *       {
 *         id?: string,
 *         title: string,
 *         description?: string,
 *         likelihood: 1 | 2 | 3 | 4 | 5,
 *         impact: 1 | 2 | 3 | 4 | 5,
 *         status: 'open' | 'monitored' | 'closed',
 *         requirementIds?: string[],
 *         actionIds?: string[]
 *       }
 *     ],
 *     actions?: [
 *       {
 *         id?: string,
 *         title: string,
 *         description?: string,
 *         type: 'remediation' | 'uplift' | 'review' | 'investigation',
 *         status: 'todo' | 'in-progress' | 'blocked' | 'done' | 'cancelled',
 *         dueAt?: ISO8601,
 *         requirementIds?: string[],
 *         riskIds?: string[]
 *       }
 *     ]
 *   }
 */

import {
  ACTION_STATUSES,
  ACTION_TYPES,
  RISK_STATUSES,
  asActionId,
  asRequirementId,
  asRiskId,
  type Action,
  type ActionId,
  type ActionStatus,
  type ActionType,
  type LikelihoodImpact,
  type Risk,
  type RiskId,
  type RiskStatus,
} from './types.ts';
import { newId } from './ids.ts';

const FORMAT = 'pspfWorkImport';
const VERSION = 'v1';

export type ImportStatusMode = 'strict' | 'map-common' | 'force';
export type ImportLinkMode = 'as-provided' | 'rebuild-bidirectional';
export type ImportUpdateMode = 'replace-all' | 'patch';

export interface StatusNormalisationOptions {
  mode?: ImportStatusMode;
  /** Optional case-insensitive aliases applied in map-common mode. */
  riskStatusMap?: Readonly<Record<string, RiskStatus>>;
  /** Optional case-insensitive aliases applied in map-common mode. */
  actionStatusMap?: Readonly<Record<string, ActionStatus>>;
  /** Required in force mode when risks are present. */
  forcedRiskStatus?: RiskStatus;
  /** Required in force mode when actions are present. */
  forcedActionStatus?: ActionStatus;
}

export interface RiskActionImportOptions {
  status?: StatusNormalisationOptions;
}

export interface PlanOptions {
  /**
   * `replace-all`: omitted optional import fields clear stored values.
   * `patch`: omitted optional import fields preserve existing values.
   */
  updateMode?: ImportUpdateMode;
  /**
   * `as-provided`: keep provided links (after dedupe + orphan filtering).
   * `rebuild-bidirectional`: rebuild links so risk/action references are symmetric.
   */
  linkMode?: ImportLinkMode;
}

export interface RiskImportEntry {
  id?: string;
  title: string;
  description?: string;
  likelihood: LikelihoodImpact;
  impact: LikelihoodImpact;
  status: RiskStatus;
  requirementIds?: readonly string[];
  actionIds?: readonly string[];
}

export interface ActionImportEntry {
  id?: string;
  title: string;
  description?: string;
  type: ActionType;
  status: ActionStatus;
  dueAt?: string;
  requirementIds?: readonly string[];
  riskIds?: readonly string[];
}

export interface RiskActionImportPayload {
  [FORMAT]: typeof VERSION;
  source: string;
  capturedAt: string;
  risks?: readonly RiskImportEntry[];
  actions?: readonly ActionImportEntry[];
}

export class RiskActionImportValidationError extends Error {}

const ALLOWED_TOP_KEYS = new Set([FORMAT, 'source', 'capturedAt', 'risks', 'actions']);
const ALLOWED_RISK_KEYS = new Set([
  'id',
  'title',
  'description',
  'likelihood',
  'impact',
  'status',
  'requirementIds',
  'actionIds',
]);
const ALLOWED_ACTION_KEYS = new Set([
  'id',
  'title',
  'description',
  'type',
  'status',
  'dueAt',
  'requirementIds',
  'riskIds',
]);

const DEFAULT_RISK_STATUS_MAP: Readonly<Record<string, RiskStatus>> = {
  open: 'open',
  opened: 'open',
  'in progress': 'open',
  'in-progress': 'open',
  active: 'open',
  monitored: 'monitored',
  monitoring: 'monitored',
  watch: 'monitored',
  watching: 'monitored',
  closed: 'closed',
  complete: 'closed',
  completed: 'closed',
  done: 'closed',
  resolved: 'closed',
};

const DEFAULT_ACTION_STATUS_MAP: Readonly<Record<string, ActionStatus>> = {
  todo: 'todo',
  'to do': 'todo',
  'to-do': 'todo',
  pending: 'todo',
  'pending review': 'todo',
  planned: 'todo',
  'not started': 'todo',
  backlog: 'todo',
  open: 'in-progress',
  opened: 'in-progress',
  'in progress': 'in-progress',
  'in-progress': 'in-progress',
  wip: 'in-progress',
  active: 'in-progress',
  doing: 'in-progress',
  underway: 'in-progress',
  ongoing: 'in-progress',
  blocked: 'blocked',
  'on hold': 'blocked',
  'on-hold': 'blocked',
  waiting: 'blocked',
  deferred: 'blocked',
  done: 'done',
  complete: 'done',
  completed: 'done',
  closed: 'done',
  resolved: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  abandoned: 'cancelled',
  rejected: 'cancelled',
};

function normaliseStatusToken(value: string): string {
  return value.trim().toLowerCase();
}

function resolveStatusMode(options?: StatusNormalisationOptions): ImportStatusMode {
  return options?.mode ?? 'strict';
}

function mapWithAliases<S extends string>(
  value: string,
  defaults: Readonly<Record<string, S>>,
  custom?: Readonly<Record<string, S>>,
): S | undefined {
  const key = normaliseStatusToken(value);
  const variants = new Set([
    key,
    key.replaceAll('_', ' '),
    key.replaceAll('_', '-'),
    key.replaceAll(/[\s_]+/g, '-'),
    key.replaceAll(/[\s_-]+/g, ''),
  ]);
  for (const variant of variants) {
    const customMapped = custom?.[variant];
    if (customMapped) return customMapped;
    const defaultMapped = defaults[variant];
    if (defaultMapped) return defaultMapped;
  }
  return undefined;
}

function resolveRiskStatus(
  raw: unknown,
  path: string,
  options?: StatusNormalisationOptions,
): RiskStatus {
  const mode = resolveStatusMode(options);
  if (mode === 'force') {
    if (!options?.forcedRiskStatus) {
      throw new RiskActionImportValidationError(
        `Status mode is force but no forced risk status was provided for ${path}.`,
      );
    }
    return options.forcedRiskStatus;
  }
  if (typeof raw !== 'string') {
    throw new RiskActionImportValidationError(
      `${path}.status must be one of ${RISK_STATUSES.join(', ')}.`,
    );
  }
  if (isRiskStatus(raw)) return raw;
  if (mode === 'map-common') {
    const mapped = mapWithAliases(raw, DEFAULT_RISK_STATUS_MAP, options?.riskStatusMap);
    if (mapped) return mapped;
  }
  throw new RiskActionImportValidationError(
    `${path}.status must be one of ${RISK_STATUSES.join(', ')}.`,
  );
}

function resolveActionStatus(
  raw: unknown,
  path: string,
  options?: StatusNormalisationOptions,
): ActionStatus {
  const mode = resolveStatusMode(options);
  if (mode === 'force') {
    if (!options?.forcedActionStatus) {
      throw new RiskActionImportValidationError(
        `Status mode is force but no forced action status was provided for ${path}.`,
      );
    }
    return options.forcedActionStatus;
  }
  if (typeof raw !== 'string') {
    throw new RiskActionImportValidationError(
      `${path}.status must be one of ${ACTION_STATUSES.join(', ')}.`,
    );
  }
  if (isActionStatus(raw)) return raw;
  if (mode === 'map-common') {
    const mapped = mapWithAliases(raw, DEFAULT_ACTION_STATUS_MAP, options?.actionStatusMap);
    if (mapped) return mapped;
  }
  throw new RiskActionImportValidationError(
    `${path}.status must be one of ${ACTION_STATUSES.join(', ')}.`,
  );
}

function ensureNoExtraKeys(obj: object, allowed: Set<string>, path: string): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new RiskActionImportValidationError(`Unknown field "${path}.${k}"`);
    }
  }
}

function isLikelihoodImpact(v: unknown): v is LikelihoodImpact {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

function isRiskStatus(v: unknown): v is RiskStatus {
  return typeof v === 'string' && (RISK_STATUSES as readonly string[]).includes(v);
}

function isActionStatus(v: unknown): v is ActionStatus {
  return typeof v === 'string' && (ACTION_STATUSES as readonly string[]).includes(v);
}

function isActionType(v: unknown): v is ActionType {
  return typeof v === 'string' && (ACTION_TYPES as readonly string[]).includes(v);
}

function validateIso(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new RiskActionImportValidationError(`Invalid ISO 8601 timestamp at ${path}`);
  }
  return value;
}

function validateStringArray(v: unknown, path: string): readonly string[] {
  if (!Array.isArray(v)) {
    throw new RiskActionImportValidationError(`${path} must be an array of strings.`);
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== 'string' || (v[i] as string).length === 0) {
      throw new RiskActionImportValidationError(`${path}[${i}] must be a non-empty string.`);
    }
  }
  return v as readonly string[];
}

function validateRiskEntry(
  e: unknown,
  path: string,
  statusOptions?: StatusNormalisationOptions,
): RiskImportEntry {
  if (!e || typeof e !== 'object') {
    throw new RiskActionImportValidationError(`${path} must be an object.`);
  }
  ensureNoExtraKeys(e, ALLOWED_RISK_KEYS, path);
  const r = e as Record<string, unknown>;
  if (typeof r.title !== 'string' || r.title.length === 0) {
    throw new RiskActionImportValidationError(`${path}.title is required.`);
  }
  if (!isLikelihoodImpact(r.likelihood)) {
    throw new RiskActionImportValidationError(`${path}.likelihood must be 1-5.`);
  }
  if (!isLikelihoodImpact(r.impact)) {
    throw new RiskActionImportValidationError(`${path}.impact must be 1-5.`);
  }
  const status = resolveRiskStatus(r.status, path, statusOptions);
  if (r.id !== undefined && (typeof r.id !== 'string' || r.id.length === 0)) {
    throw new RiskActionImportValidationError(`${path}.id must be a non-empty string when given.`);
  }
  if (r.description !== undefined && typeof r.description !== 'string') {
    throw new RiskActionImportValidationError(`${path}.description must be a string.`);
  }
  const out: RiskImportEntry = {
    title: r.title,
    likelihood: r.likelihood,
    impact: r.impact,
    status,
    ...(r.id !== undefined ? { id: r.id } : {}),
    ...(r.description !== undefined ? { description: r.description } : {}),
  };
  if (r.requirementIds !== undefined) {
    out.requirementIds = validateStringArray(r.requirementIds, `${path}.requirementIds`);
  }
  if (r.actionIds !== undefined) {
    out.actionIds = validateStringArray(r.actionIds, `${path}.actionIds`);
  }
  return out;
}

function validateActionEntry(
  e: unknown,
  path: string,
  statusOptions?: StatusNormalisationOptions,
): ActionImportEntry {
  if (!e || typeof e !== 'object') {
    throw new RiskActionImportValidationError(`${path} must be an object.`);
  }
  ensureNoExtraKeys(e, ALLOWED_ACTION_KEYS, path);
  const a = e as Record<string, unknown>;
  if (typeof a.title !== 'string' || a.title.length === 0) {
    throw new RiskActionImportValidationError(`${path}.title is required.`);
  }
  if (!isActionType(a.type)) {
    throw new RiskActionImportValidationError(
      `${path}.type must be one of ${ACTION_TYPES.join(', ')}.`,
    );
  }
  const status = resolveActionStatus(a.status, path, statusOptions);
  if (a.id !== undefined && (typeof a.id !== 'string' || a.id.length === 0)) {
    throw new RiskActionImportValidationError(`${path}.id must be a non-empty string when given.`);
  }
  if (a.description !== undefined && typeof a.description !== 'string') {
    throw new RiskActionImportValidationError(`${path}.description must be a string.`);
  }
  if (a.dueAt !== undefined) validateIso(a.dueAt, `${path}.dueAt`);
  const out: ActionImportEntry = {
    title: a.title,
    type: a.type,
    status,
    ...(a.id !== undefined ? { id: a.id } : {}),
    ...(a.description !== undefined ? { description: a.description } : {}),
    ...(typeof a.dueAt === 'string' ? { dueAt: a.dueAt } : {}),
  };
  if (a.requirementIds !== undefined) {
    out.requirementIds = validateStringArray(a.requirementIds, `${path}.requirementIds`);
  }
  if (a.riskIds !== undefined) {
    out.riskIds = validateStringArray(a.riskIds, `${path}.riskIds`);
  }
  return out;
}

export function validateRiskActionImport(
  value: unknown,
  options: RiskActionImportOptions = {},
): RiskActionImportPayload {
  if (!value || typeof value !== 'object') {
    throw new RiskActionImportValidationError('Payload must be a JSON object.');
  }
  ensureNoExtraKeys(value, ALLOWED_TOP_KEYS, '$');
  const v = value as Record<string, unknown>;
  if (v[FORMAT] !== VERSION) {
    throw new RiskActionImportValidationError(
      `Unsupported format. Expected ${FORMAT}="${VERSION}".`,
    );
  }
  if (typeof v.source !== 'string' || v.source.length === 0) {
    throw new RiskActionImportValidationError('Missing or empty "source".');
  }
  validateIso(v.capturedAt, '$.capturedAt');
  const risks: RiskImportEntry[] = [];
  if (v.risks !== undefined) {
    if (!Array.isArray(v.risks)) {
      throw new RiskActionImportValidationError('"risks" must be an array.');
    }
    for (let i = 0; i < v.risks.length; i++) {
      risks.push(validateRiskEntry(v.risks[i], `$.risks[${i}]`, options.status));
    }
  }
  const actions: ActionImportEntry[] = [];
  if (v.actions !== undefined) {
    if (!Array.isArray(v.actions)) {
      throw new RiskActionImportValidationError('"actions" must be an array.');
    }
    for (let i = 0; i < v.actions.length; i++) {
      actions.push(validateActionEntry(v.actions[i], `$.actions[${i}]`, options.status));
    }
  }
  return {
    [FORMAT]: VERSION,
    source: v.source,
    capturedAt: v.capturedAt as string,
    ...(risks.length > 0 ? { risks } : {}),
    ...(actions.length > 0 ? { actions } : {}),
  };
}

// ---------- Plan ----------

export type PlanMode = 'add' | 'update';

export interface RiskPlanItem {
  index: number;
  mode: PlanMode;
  next: Risk;
  previous?: Risk;
  /** Field-level changes (only populated when mode === 'update'). */
  changedFields: readonly string[];
}

export interface ActionPlanItem {
  index: number;
  mode: PlanMode;
  next: Action;
  previous?: Action;
  changedFields: readonly string[];
}

export interface RiskActionImportPlan {
  source: string;
  capturedAt: string;
  risks: readonly RiskPlanItem[];
  actions: readonly ActionPlanItem[];
}

function arraysEqual(a: readonly string[] = [], b: readonly string[] = []): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

function diffRisk(prev: Risk, next: Risk): readonly string[] {
  const changed: string[] = [];
  if (prev.title !== next.title) changed.push('title');
  if ((prev.description ?? '') !== (next.description ?? '')) changed.push('description');
  if (prev.likelihood !== next.likelihood) changed.push('likelihood');
  if (prev.impact !== next.impact) changed.push('impact');
  if (prev.status !== next.status) changed.push('status');
  if (!arraysEqual(prev.requirementIds, next.requirementIds)) changed.push('requirementIds');
  if (!arraysEqual(prev.actionIds, next.actionIds)) changed.push('actionIds');
  return changed;
}

function diffAction(prev: Action, next: Action): readonly string[] {
  const changed: string[] = [];
  if (prev.title !== next.title) changed.push('title');
  if ((prev.description ?? '') !== (next.description ?? '')) changed.push('description');
  if (prev.type !== next.type) changed.push('type');
  if (prev.status !== next.status) changed.push('status');
  if ((prev.dueAt ?? '') !== (next.dueAt ?? '')) changed.push('dueAt');
  if (!arraysEqual(prev.requirementIds, next.requirementIds)) changed.push('requirementIds');
  if (!arraysEqual(prev.riskIds, next.riskIds)) changed.push('riskIds');
  return changed;
}

export interface PlanContext {
  risksById: ReadonlyMap<RiskId, Risk>;
  actionsById: ReadonlyMap<ActionId, Action>;
  /** ID generator — defaults to `newId`. Pluggable for deterministic tests. */
  generateId?: () => string;
}

function dedupe<T extends string>(values: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function recalculateChangedFields(plan: RiskActionImportPlan): void {
  for (const risk of plan.risks) {
    if (risk.mode === 'update' && risk.previous) {
      risk.changedFields = diffRisk(risk.previous, risk.next);
    }
  }
  for (const action of plan.actions) {
    if (action.mode === 'update' && action.previous) {
      action.changedFields = diffAction(action.previous, action.next);
    }
  }
}

function cleanAndRebuildLinks(
  risks: readonly RiskPlanItem[],
  actions: readonly ActionPlanItem[],
  ctx: PlanContext,
  linkMode: ImportLinkMode,
): void {
  const knownRiskIds = new Set<string>(ctx.risksById.keys());
  const knownActionIds = new Set<string>(ctx.actionsById.keys());
  for (const risk of risks) knownRiskIds.add(risk.next.id);
  for (const action of actions) knownActionIds.add(action.next.id);

  for (const risk of risks) {
    risk.next.requirementIds = dedupe(risk.next.requirementIds);
    risk.next.actionIds = dedupe(
      risk.next.actionIds.filter((actionId) => knownActionIds.has(actionId)),
    );
  }

  for (const action of actions) {
    action.next.requirementIds = dedupe(action.next.requirementIds);
    action.next.riskIds = dedupe(action.next.riskIds.filter((riskId) => knownRiskIds.has(riskId)));
  }

  if (linkMode !== 'rebuild-bidirectional') return;

  const riskToActions = new Map(risks.map((item) => [item.next.id, new Set(item.next.actionIds)]));
  const actionToRisks = new Map(actions.map((item) => [item.next.id, new Set(item.next.riskIds)]));

  for (const [riskId, actionIds] of riskToActions) {
    for (const actionId of actionIds) {
      const reverse = actionToRisks.get(actionId);
      if (reverse) reverse.add(riskId);
    }
  }
  for (const [actionId, riskIds] of actionToRisks) {
    for (const riskId of riskIds) {
      const reverse = riskToActions.get(riskId);
      if (reverse) reverse.add(actionId);
    }
  }

  for (const risk of risks) {
    risk.next.actionIds = [...(riskToActions.get(risk.next.id) ?? new Set())]
      .sort()
      .map(asActionId);
  }
  for (const action of actions) {
    action.next.riskIds = [...(actionToRisks.get(action.next.id) ?? new Set())]
      .sort()
      .map(asRiskId);
  }
}

export function planRiskActionImport(
  payload: RiskActionImportPayload,
  ctx: PlanContext,
  options: PlanOptions = {},
): RiskActionImportPlan {
  const gen = ctx.generateId ?? newId;
  const now = new Date().toISOString();
  const updateMode = options.updateMode ?? 'replace-all';
  const linkMode = options.linkMode ?? 'as-provided';

  const risks: RiskPlanItem[] = (payload.risks ?? []).map((entry, index) => {
    const id = entry.id ? asRiskId(entry.id) : asRiskId(gen());
    const previous = entry.id ? ctx.risksById.get(id) : undefined;
    const requirementIds =
      entry.requirementIds !== undefined
        ? entry.requirementIds.map(asRequirementId)
        : updateMode === 'patch' && previous
          ? previous.requirementIds
          : [];
    const actionIds =
      entry.actionIds !== undefined
        ? entry.actionIds.map(asActionId)
        : updateMode === 'patch' && previous
          ? previous.actionIds
          : [];
    const description =
      entry.description ?? (updateMode === 'patch' ? previous?.description : undefined);
    const next: Risk = {
      id,
      title: entry.title,
      ...(description !== undefined ? { description } : {}),
      likelihood: entry.likelihood,
      impact: entry.impact,
      status: entry.status,
      requirementIds,
      actionIds,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    if (previous) {
      return { index, mode: 'update', next, previous, changedFields: diffRisk(previous, next) };
    }
    return { index, mode: 'add', next, changedFields: [] };
  });

  const actions: ActionPlanItem[] = (payload.actions ?? []).map((entry, index) => {
    const id = entry.id ? asActionId(entry.id) : asActionId(gen());
    const previous = entry.id ? ctx.actionsById.get(id) : undefined;
    const requirementIds =
      entry.requirementIds !== undefined
        ? entry.requirementIds.map(asRequirementId)
        : updateMode === 'patch' && previous
          ? previous.requirementIds
          : [];
    const riskIds =
      entry.riskIds !== undefined
        ? entry.riskIds.map(asRiskId)
        : updateMode === 'patch' && previous
          ? previous.riskIds
          : [];
    const description =
      entry.description ?? (updateMode === 'patch' ? previous?.description : undefined);
    const dueAt = entry.dueAt ?? (updateMode === 'patch' ? previous?.dueAt : undefined);
    const next: Action = {
      id,
      title: entry.title,
      ...(description !== undefined ? { description } : {}),
      type: entry.type,
      status: entry.status,
      ...(dueAt !== undefined ? { dueAt } : {}),
      requirementIds,
      riskIds,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    if (previous) {
      return { index, mode: 'update', next, previous, changedFields: diffAction(previous, next) };
    }
    return { index, mode: 'add', next, changedFields: [] };
  });

  const plan: RiskActionImportPlan = {
    source: payload.source,
    capturedAt: payload.capturedAt,
    risks,
    actions,
  };

  cleanAndRebuildLinks(risks, actions, ctx, linkMode);
  recalculateChangedFields(plan);

  return plan;
}

// ---------- Apply ----------

export interface ApplySelection {
  risks: ReadonlySet<number>;
  actions: ReadonlySet<number>;
}

export interface ApplyTarget {
  upsertRiskRecord(risk: Risk): Promise<unknown>;
  upsertActionRecord(action: Action): Promise<unknown>;
}

export interface ApplySummary {
  risksAdded: number;
  risksUpdated: number;
  actionsAdded: number;
  actionsUpdated: number;
}

export async function applyRiskActionImport(
  plan: RiskActionImportPlan,
  selection: ApplySelection,
  target: ApplyTarget,
): Promise<ApplySummary> {
  const summary: ApplySummary = {
    risksAdded: 0,
    risksUpdated: 0,
    actionsAdded: 0,
    actionsUpdated: 0,
  };
  for (const item of plan.risks) {
    if (!selection.risks.has(item.index)) continue;
    await target.upsertRiskRecord(item.next);
    if (item.mode === 'add') summary.risksAdded += 1;
    else summary.risksUpdated += 1;
  }
  for (const item of plan.actions) {
    if (!selection.actions.has(item.index)) continue;
    await target.upsertActionRecord(item.next);
    if (item.mode === 'add') summary.actionsAdded += 1;
    else summary.actionsUpdated += 1;
  }
  return summary;
}
