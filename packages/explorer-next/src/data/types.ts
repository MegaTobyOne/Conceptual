/**
 * Core domain types for PSPF Explorer v3.
 *
 * Branded ID types give compile-time safety with zero runtime cost.
 * Persisted records share a common `BaseRecord` shape (id + timestamps).
 *
 * Schema id for export envelopes: `pspf-explorer.v3`.
 */

// ---------- Branded IDs ----------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type RequirementId = Brand<string, 'RequirementId'>;
export type RiskId = Brand<string, 'RiskId'>;
export type ActionId = Brand<string, 'ActionId'>;
export type DirectionId = Brand<string, 'DirectionId'>;
export type TagId = Brand<string, 'TagId'>;
export type SavedViewId = Brand<string, 'SavedViewId'>;
export type WorkTrackingId = Brand<string, 'WorkTrackingId'>;
export type RelationshipId = Brand<string, 'RelationshipId'>;

export const asRequirementId = (s: string): RequirementId => s as RequirementId;
export const asRiskId = (s: string): RiskId => s as RiskId;
export const asActionId = (s: string): ActionId => s as ActionId;
export const asDirectionId = (s: string): DirectionId => s as DirectionId;
export const asTagId = (s: string): TagId => s as TagId;
export const asSavedViewId = (s: string): SavedViewId => s as SavedViewId;
export const asWorkTrackingId = (s: string): WorkTrackingId => s as WorkTrackingId;
export const asRelationshipId = (s: string): RelationshipId => s as RelationshipId;

// ---------- Domains ----------

export const DOMAIN_KEYS = [
  'governance',
  'information',
  'personnel',
  'physical',
  'risk',
  'technology',
] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export interface Domain {
  key: DomainKey;
  /** Display name, e.g. "Governance". */
  name: string;
  /** Short paragraph describing the domain's scope. */
  description: string;
  /** Source-of-truth requirement-id prefix(es) for this domain (e.g. ['GOV']). */
  prefixes: readonly string[];
}

// ---------- Requirements ----------

export type ReportingType = 'maturity' | 'binary' | 'narrative' | 'metric' | 'unspecified';

export interface Requirement {
  id: RequirementId;
  domain: DomainKey;
  /** Short title (one line). */
  title: string;
  /** Full requirement text. */
  text: string;
  /** Optional cross-references (other requirement IDs, policy URLs, etc.). */
  references?: readonly string[];
  /** Reporting question type per PSPF 2025 release schedule. */
  reportingType: ReportingType;
  /** Essential Eight control association, if any (TECH only). */
  essentialEightControl?: EssentialEightControlKey;
}

// ---------- Essential Eight ----------

export const ESSENTIAL_EIGHT_CONTROLS = [
  'patch-applications',
  'patch-operating-systems',
  'multi-factor-authentication',
  'restrict-administrative-privileges',
  'application-control',
  'restrict-microsoft-office-macros',
  'user-application-hardening',
  'regular-backups',
] as const;
export type EssentialEightControlKey = (typeof ESSENTIAL_EIGHT_CONTROLS)[number];

export interface EssentialEightControl {
  key: EssentialEightControlKey;
  name: string;
  description: string;
  /** Maturity levels defined for this control (1..4). */
  maturityLevels: readonly (1 | 2 | 3 | 4)[];
}

// ---------- Compliance ----------

export const COMPLIANCE_STATES = [
  'yes',
  'no',
  'risk-managed',
  'not-applicable',
  'not-set',
] as const;
export type ComplianceState = (typeof COMPLIANCE_STATES)[number];

export type MaturityLevel = 1 | 2 | 3 | 4;

export interface EvidenceRef {
  kind: 'url' | 'note';
  /** URL string or free-text note. URLs are rendered as text-with-explicit-open. */
  value: string;
  addedAt: string; // ISO 8601
}

export const DIRECTION_RESPONSE_STATES = ['yes', 'no', 'risk-managed', 'not-set'] as const;
export type DirectionResponseState = (typeof DIRECTION_RESPONSE_STATES)[number];

export interface BaseRecord {
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceEntry extends BaseRecord {
  requirementId: RequirementId;
  state: ComplianceState;
  evidence: readonly EvidenceRef[];
  targetMaturity?: MaturityLevel;
  reviewedAt?: string;
  reviewer?: string;
  notes?: string;
}

export interface ComplianceEvent extends BaseRecord {
  id: string;
  requirementId: RequirementId;
  fromState: ComplianceState;
  toState: ComplianceState;
  noteSnapshot?: string;
}

// ---------- Risk ----------

export const RISK_STATUSES = ['open', 'monitored', 'closed'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export type LikelihoodImpact = 1 | 2 | 3 | 4 | 5;

export interface Risk extends BaseRecord {
  id: RiskId;
  title: string;
  description?: string;
  likelihood: LikelihoodImpact;
  impact: LikelihoodImpact;
  status: RiskStatus;
  requirementIds: readonly RequirementId[];
  actionIds: readonly ActionId[];
}

// ---------- Action ----------

export const ACTION_TYPES = ['remediation', 'uplift', 'review', 'investigation'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = ['todo', 'in-progress', 'blocked', 'done', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface Action extends BaseRecord {
  id: ActionId;
  title: string;
  description?: string;
  type: ActionType;
  status: ActionStatus;
  dueAt?: string;
  requirementIds: readonly RequirementId[];
  riskIds: readonly RiskId[];
}

// ---------- Tags ----------

export const TAG_PRIORITIES = [1, 2, 3, 4] as const;
export type TagPriority = (typeof TAG_PRIORITIES)[number];

export interface Tag extends BaseRecord {
  id: TagId;
  label: string;
  /** Hex colour string, validated at write time. */
  colour: string;
  priority?: TagPriority;
}

// ---------- Saved views ----------

export interface SavedViewFilters {
  domain?: DomainKey;
  states?: readonly ComplianceState[];
  tagIds?: readonly TagId[];
  q?: string;
}

export interface SavedView extends BaseRecord {
  id: SavedViewId;
  name: string;
  filters: SavedViewFilters;
}

// ---------- Work tracking ----------

export interface WorkTrackingEntry extends BaseRecord {
  id: WorkTrackingId;
  requirementId: RequirementId;
  note: string;
  /** Optional logged effort (free text, e.g. "3h"). */
  effort?: string;
}

// ---------- Posture / threat level ----------

export const THREAT_LEVELS = ['low', 'elevated', 'high', 'critical'] as const;
export type ThreatLevel = (typeof THREAT_LEVELS)[number];

export const POSTURES = ['standard', 'shields-up', 'active-defence'] as const;
export type Posture = (typeof POSTURES)[number];

export interface PostureSetting {
  threat: ThreatLevel;
  posture: Posture;
  updatedAt: string;
}

export interface PostureRecord {
  global: PostureSetting;
  perDomain: Partial<Record<DomainKey, PostureSetting>>;
}

// ---------- Phase 2 placeholders ----------

export interface Direction extends BaseRecord {
  id: DirectionId;
  reference: string;
  title: string;
  issuedAt: string;
  description?: string;
  requirementIds: readonly RequirementId[];
  responseState: DirectionResponseState;
  evidence: readonly EvidenceRef[];
  responseNotes?: string;
}

export type RelationshipKind =
  | 'requirement-risk'
  | 'requirement-action'
  | 'risk-action'
  | 'requirement-direction';

export interface Relationship extends BaseRecord {
  id: RelationshipId;
  kind: RelationshipKind;
  /** Pair of endpoint IDs, normalised at write time so `[a,b]` and `[b,a]` are equivalent. */
  endpoints: readonly [string, string];
}

// ---------- Export envelope ----------

export const SCHEMA_ID = 'pspf-explorer.v3' as const;
export const SCHEMA_VERSION = 1 as const;

export interface ExportEnvelopeData {
  compliance: readonly ComplianceEntry[];
  risks: readonly Risk[];
  actions: readonly Action[];
  tags: readonly Tag[];
  savedViews: readonly SavedView[];
  workTracking: readonly WorkTrackingEntry[];
  posture: PostureRecord;
  directions?: readonly Direction[];
  relationships?: readonly Relationship[];
}

export interface ExportEnvelope {
  schema: typeof SCHEMA_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  data: ExportEnvelopeData;
}
