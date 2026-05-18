export const VERSION_AXES = {
  schemaVersion: "1.8.0",
  bundleVersion: "1.8.0",
  apiVersion: "1.8.0"
} as const;

export const PSPF_SLICE_VERSION = "1.18.0" as const;

export type VersionAxes = typeof VERSION_AXES;

export const V0_1_ENTITY_TYPES = [
  "domain",
  "requirement",
  "evidence",
  "action",
  "risk",
  "snapshot",
  "link",
  "tag",
  "saved-view",
  "source-control",
  "requirement-control-mapping",
  "direction",
  "change-record",
  "supplier",
  "contract",
  "spend-item",
  "posture"
] as const;

export type V01EntityType = (typeof V0_1_ENTITY_TYPES)[number];

export const V0_1_COLLECTIONS = [
  "domains",
  "requirements",
  "evidence",
  "actions",
  "risks",
  "snapshots",
  "links",
  "tags",
  "saved-views",
  "source-controls",
  "requirement-control-mappings",
  "directions",
  "change-records",
  "suppliers",
  "contracts",
  "spend-items",
  "posture"
] as const;

export type V01Collection = (typeof V0_1_COLLECTIONS)[number];

export const LINK_TYPES = [
  "in",
  "has",
  "supported-by",
  "addressed-by",
  "exposed-by",
  "owned-by",
  "reviewed-by",
  "cited-by",
  "supports",
  "treated-by",
  "associated-with",
  "sourced-from",
  "included-in",
  "assigned-via",
  "blocked-by",
  "related-to",
  "funds",
  "member-of",
  "holds",
  "targets",
  "generates",
  "includes",
  "tagged-with",
  "changes"
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export type PublicationPolicy = "public" | "internal" | "sensitive" | "restricted";

export type SourceProduct = "core" | "workshop" | "explorer" | "shop";

export type RecordStatus = "active" | "archived" | "inactive" | "deleted";

export interface FieldPolicy {
  readonly field: string;
  readonly publication: PublicationPolicy;
}

export interface EntityFieldPolicy {
  readonly entityType: V01EntityType;
  readonly fields: readonly FieldPolicy[];
}

export interface EntityEnvelope {
  readonly id: string;
  readonly entityType: V01EntityType;
  readonly schemaVersion: string;
  readonly title?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sourceProduct: SourceProduct;
  readonly recordStatus: RecordStatus;
}

export interface DomainEntity extends EntityEnvelope {
  readonly entityType: "domain";
  readonly code: "governance" | "security-risk" | "information" | "technology" | "personnel" | "physical";
  readonly title: string;
  readonly sortOrder: number;
}

export type AssessmentStatus =
  | "not-started"
  | "in-progress"
  | "met"
  | "partially-met"
  | "not-met"
  | "not-applicable"
  | "under-review";

export interface RequirementEntity extends EntityEnvelope {
  readonly entityType: "requirement";
  readonly title: string;
  readonly domainId: string;
  readonly assessmentStatus: AssessmentStatus;
  readonly summary?: string;
}

export type EvidenceFreshness = "current" | "ageing" | "stale" | "expired" | "unknown";

export interface EvidenceEntity extends EntityEnvelope {
  readonly entityType: "evidence";
  readonly title: string;
  readonly evidenceType: "document" | "url" | "note";
  readonly reference: string;
  readonly freshness: EvidenceFreshness;
}

export type ActionStatus = "todo" | "in-progress" | "blocked" | "done" | "cancelled";

export type ActionImpactUrgency = "normal" | "due-soon" | "overdue" | "blocked";

export interface ActionImpact {
  readonly postureUplift: number;
  readonly evidenceUplift: number;
  readonly riskReduction: number;
  readonly directionUplift?: number;
  readonly urgency: ActionImpactUrgency;
  readonly explanation: readonly string[];
}

export interface ActionEntity extends EntityEnvelope {
  readonly entityType: "action";
  readonly title: string;
  readonly status: ActionStatus;
  readonly dueDate?: string;
  readonly impact?: ActionImpact;
}

export type RiskStatus = "open" | "monitored" | "closed";

export interface RiskEntity extends EntityEnvelope {
  readonly entityType: "risk";
  readonly title: string;
  readonly status: RiskStatus;
  readonly likelihood: number;
  readonly impact: number;
}

export interface LinkEntity extends EntityEnvelope {
  readonly entityType: "link";
  readonly linkType: LinkType;
  readonly fromId: string;
  readonly fromType: V01EntityType;
  readonly toId: string;
  readonly toType: V01EntityType;
}

export interface SnapshotEntity extends EntityEnvelope {
  readonly entityType: "snapshot";
  readonly title: string;
  readonly snapshotType: "checkpoint" | "reporting" | "backup" | "pre-migration";
}

export const TAG_COLOURS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "grey"
] as const;

export type TagColour = (typeof TAG_COLOURS)[number];

export const DEFAULT_TAG_COLOUR: TagColour = "grey";

export const TAG_LABEL_ALLOWED_PATTERN = "^[\\p{L}\\p{N} '\\-]+$";
const TAG_LABEL_ALLOWED_REGEXP = new RegExp(TAG_LABEL_ALLOWED_PATTERN, "u");

export const TAG_LIMITS = {
  perWorkspaceHard: 64,
  perWorkspaceSoftWarning: 32,
  perRequirementHard: 16,
  labelMaxLength: 40,
  titleMaxLength: 60,
  descriptionMaxLength: 1000
} as const;

export interface TagEntity extends EntityEnvelope {
  readonly entityType: "tag";
  readonly label: string;
  readonly title: string;
  readonly colour: TagColour;
  readonly description?: string;
  readonly emoji?: string;
}

export function normaliseTagLabel(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

export function isValidTagLabel(value: string): boolean {
  const normalised = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return normalised.length >= 1 && normalised.length <= TAG_LIMITS.labelMaxLength && TAG_LABEL_ALLOWED_REGEXP.test(normalised);
}

export function isValidSingleGrapheme(value: string): boolean {
  if (!value) {
    return true;
  }
  if (!("Segmenter" in Intl)) {
    return false;
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length === 1;
}

export const SAVED_VIEW_SCOPES = ["requirements", "explorer-requirements", "explorer-relationships", "workshop-dashboard", "workshop-evidence-review", "workshop-requirements"] as const;
export type SavedViewScope = (typeof SAVED_VIEW_SCOPES)[number];

export const SAVED_VIEW_TAGS_MODES = ["any", "all"] as const;
export type SavedViewTagsMode = (typeof SAVED_VIEW_TAGS_MODES)[number];

export const SAVED_VIEW_EVIDENCE_COVERAGE = ["any", "missing", "linked"] as const;
export type SavedViewEvidenceCoverage = (typeof SAVED_VIEW_EVIDENCE_COVERAGE)[number];

export const SAVED_VIEW_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SavedViewSortDirection = (typeof SAVED_VIEW_SORT_DIRECTIONS)[number];

export const SAVED_VIEW_REQUIREMENT_COLUMNS = ["id", "title", "domainId", "assessmentStatus", "tags", "evidence", "actions", "risks"] as const;
export type SavedViewRequirementColumn = (typeof SAVED_VIEW_REQUIREMENT_COLUMNS)[number];

export const SAVED_VIEW_RELATIONSHIP_COLUMNS = ["title", "relationship", "from", "to", "tags"] as const;
export type SavedViewRelationshipColumn = (typeof SAVED_VIEW_RELATIONSHIP_COLUMNS)[number];

export const SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS = ["priority", "requirement", "hint", "domain", "requirements", "evidenceGaps", "inProgress", "met", "notMet", "title", "status", "urgency", "total"] as const;
export type SavedViewWorkshopDashboardColumn = (typeof SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS)[number];

export const SAVED_VIEW_REQUIREMENT_SORT_KEYS = ["title", "domainId", "assessmentStatus", "updatedAt"] as const;
export type SavedViewRequirementSortKey = (typeof SAVED_VIEW_REQUIREMENT_SORT_KEYS)[number];

export const SAVED_VIEW_LIMITS = {
  nameMaxLength: 60,
  queryMaxLength: 120,
  visibleColumnsHard: 12
} as const;

export interface SavedViewFilters {
  readonly query?: string;
  readonly domainIds?: readonly string[];
  readonly assessmentStatuses?: readonly AssessmentStatus[];
  readonly tagIds?: readonly string[];
  readonly tagsMode?: SavedViewTagsMode;
  readonly evidenceCoverage?: SavedViewEvidenceCoverage;
  readonly actionStates?: readonly ActionStatus[];
  readonly riskStates?: readonly RiskStatus[];
}

export interface SavedViewPresentation {
  readonly sortKey?: SavedViewRequirementSortKey;
  readonly sortDirection?: SavedViewSortDirection;
  readonly visibleColumns?: readonly (SavedViewRequirementColumn | SavedViewRelationshipColumn | SavedViewWorkshopDashboardColumn)[];
}

export interface SavedViewEntity extends EntityEnvelope {
  readonly entityType: "saved-view";
  readonly title: string;
  readonly name: string;
  readonly scope: SavedViewScope;
  readonly filters: SavedViewFilters;
  readonly presentation?: SavedViewPresentation;
}

export function normaliseSavedViewName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

export function isValidSavedViewName(value: string): boolean {
  const normalised = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return normalised.length >= 1 && normalised.length <= SAVED_VIEW_LIMITS.nameMaxLength;
}

export interface SourceControlExternalRef {
  readonly scheme: "ism-control-id" | "oscal-uuid" | string;
  readonly value: string;
}

export interface SourceControlProvenance {
  readonly oscalRelease: string;
  readonly catalog: string;
  readonly profile: string | null;
  readonly sourceUrl: string;
}

export interface SourceControlEntity extends EntityEnvelope {
  readonly entityType: "source-control";
  readonly title: string;
  readonly controlId: string;
  readonly statement: string;
  readonly profileTags: readonly string[];
  readonly statementChangeStatus: StatementChangeStatus;
  readonly externalRefs: readonly SourceControlExternalRef[];
  readonly provenance: SourceControlProvenance;
  readonly localApplicabilityNote?: string;
}

export type CoverageQualifier = "primary" | "partial" | "compensating";
export type MappingConfidence = "low" | "medium" | "high";
export type StatementChangeStatus = "unchanged" | "changed" | "new" | "removed";

export interface RequirementControlMappingProvenance {
  readonly author: string;
  readonly createdAt: string;
  readonly oscalRelease: string;
}

export interface RequirementControlMappingEntity extends EntityEnvelope {
  readonly entityType: "requirement-control-mapping";
  readonly requirementId: string;
  readonly sourceControlId: string;
  readonly coverageQualifier: CoverageQualifier;
  readonly applicabilityProfile: string;
  readonly confidence: MappingConfidence;
  readonly lastReviewedAt?: string;
  readonly reviewBy?: string;
  readonly rationale?: string;
  readonly provenance: RequirementControlMappingProvenance;
}

export interface PostureEntity extends EntityEnvelope {
  readonly id: "POSTURE";
  readonly entityType: "posture";
  readonly title: string;
  readonly requirementCount: number;
  readonly evidenceCount: number;
  readonly actionCount: number;
  readonly riskCount: number;
  readonly sourceControlCount?: number;
  readonly requirementControlMappingCount?: number;
  readonly directionCount?: number;
  readonly changeRecordCount?: number;
  readonly supplierCount?: number;
  readonly contractCount?: number;
  readonly spendItemCount?: number;
}

export type DirectionResponseState = "not-set" | "yes" | "no" | "risk-managed";

export interface DirectionEntity extends EntityEnvelope {
  readonly entityType: "direction";
  readonly title: string;
  readonly reference: string;
  readonly issuedAt?: string;
  readonly sourceAuthority?: string;
  readonly responseState: DirectionResponseState;
}

export const CHANGE_RECORD_TYPES = ["priority", "direction", "scope", "timeline", "dependency", "risk-response", "posture", "other"] as const;
export type ChangeRecordType = (typeof CHANGE_RECORD_TYPES)[number];

export const CHANGE_RECORD_STATUSES = ["proposed", "active", "resolved", "absorbed", "withdrawn"] as const;
export type ChangeRecordStatus = (typeof CHANGE_RECORD_STATUSES)[number];

export const CHANGE_RECORD_PERSISTENCE = ["temporary", "persistent"] as const;
export type ChangeRecordPersistence = (typeof CHANGE_RECORD_PERSISTENCE)[number];

export const CHANGE_RECORD_SOURCES = ["executive-direction", "risk-event", "compliance-event", "operational", "external-trigger", "other"] as const;
export type ChangeRecordSource = (typeof CHANGE_RECORD_SOURCES)[number];

export interface ChangeRecordEntity extends EntityEnvelope {
  readonly entityType: "change-record";
  readonly title: string;
  readonly summary: string;
  readonly reason?: string;
  readonly impactSummary?: string;
  readonly changeType: ChangeRecordType;
  readonly status: ChangeRecordStatus;
  readonly persistence: ChangeRecordPersistence;
  readonly source: ChangeRecordSource;
  readonly raisedAt: string;
  readonly effectiveAt?: string;
  readonly reviewDueAt?: string;
  readonly decisionOwnerRef?: string;
}

export type SupplierType = "software" | "service" | "advisory" | "managed-service" | "other";
export type SupplierStatus = "active" | "inactive" | "proposed";
export type SupplierCriticality = "low" | "medium" | "high" | "critical";

export interface SupplierEntity extends EntityEnvelope {
  readonly entityType: "supplier";
  readonly name: string;
  readonly supplierType: SupplierType;
  readonly status: SupplierStatus;
  readonly criticality: SupplierCriticality;
  readonly primaryContact?: string;
  readonly notes?: string;
}

export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export interface MoneyAmount {
  readonly amount: number;
  readonly currency: "AUD" | string;
}

export interface ContractEntity extends EntityEnvelope {
  readonly entityType: "contract";
  readonly supplierId: string;
  readonly title: string;
  readonly contractRef?: string;
  readonly status: ContractStatus;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly value?: MoneyAmount;
  readonly serviceSummary?: string;
}

export type SpendType = "capex" | "opex" | "uplift" | "licence" | "service";
export type SpendStatus = "proposed" | "approved" | "committed" | "spent" | "cancelled";
export type SavingsType = "avoided-cost" | "efficiency" | "consolidation" | "risk-reduction" | "contract-optimisation" | "other";
export type ForecastConfidence = "low" | "medium" | "high";

export interface SpendItemEntity extends EntityEnvelope {
  readonly entityType: "spend-item";
  readonly title: string;
  readonly spendType: SpendType;
  readonly status: SpendStatus;
  readonly amount: MoneyAmount;
  readonly financialYear: string;
  readonly forecastStartAt?: string;
  readonly forecastEndAt?: string;
  readonly forecastCost?: MoneyAmount;
  readonly expectedSavings?: MoneyAmount;
  readonly savingsType?: SavingsType;
  readonly paybackPeriodMonths?: number;
  readonly confidence?: ForecastConfidence;
  readonly assumptions?: string;
  readonly notes?: string;
}

export type V01Entity =
  | DomainEntity
  | RequirementEntity
  | EvidenceEntity
  | ActionEntity
  | RiskEntity
  | LinkEntity
  | SnapshotEntity
  | TagEntity
  | SavedViewEntity
  | SourceControlEntity
  | RequirementControlMappingEntity
  | DirectionEntity
  | ChangeRecordEntity
  | SupplierEntity
  | ContractEntity
  | SpendItemEntity
  | PostureEntity;

export type EntityByCollection = {
  domains: DomainEntity;
  requirements: RequirementEntity;
  evidence: EvidenceEntity;
  actions: ActionEntity;
  risks: RiskEntity;
  snapshots: SnapshotEntity;
  links: LinkEntity;
  tags: TagEntity;
  "saved-views": SavedViewEntity;
  "source-controls": SourceControlEntity;
  "requirement-control-mappings": RequirementControlMappingEntity;
  directions: DirectionEntity;
  "change-records": ChangeRecordEntity;
  suppliers: SupplierEntity;
  contracts: ContractEntity;
  "spend-items": SpendItemEntity;
  posture: PostureEntity;
};

export type BundleCollections = {
  [Collection in V01Collection]: EntityByCollection[Collection][];
};

type GeneratedEntityField = "id" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus";

export type EntityFor<EntityType extends V01EntityType> = Extract<V01Entity, { entityType: EntityType }>;

export type EntityDraft<EntityType extends V01EntityType> = Omit<EntityFor<EntityType>, GeneratedEntityField> & {
  entityType: EntityType;
};

export const DISALLOWED_PUBLICATION_FIELDS = [
  "person.name",
  "person.email",
  "assignment.personId"
] as const;

export const PUBLICATION_FIELD_POLICIES: readonly EntityFieldPolicy[] = [
  {
    entityType: "domain",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "code", "sortOrder")
  },
  {
    entityType: "requirement",
    fields: [
      ...publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "domainId", "assessmentStatus"),
      { field: "summary", publication: "sensitive" }
    ]
  },
  {
    entityType: "evidence",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "evidenceType", "reference", "freshness")
  },
  {
    entityType: "action",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "status", "dueDate", "impact")
  },
  {
    entityType: "risk",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "status", "likelihood", "impact")
  },
  {
    entityType: "snapshot",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "snapshotType")
  },
  {
    entityType: "link",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "linkType", "fromId", "fromType", "toId", "toType")
  },
  {
    entityType: "tag",
    fields: [
      ...publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "label", "colour", "emoji"),
      { field: "description", publication: "sensitive" }
    ]
  },
  {
    entityType: "saved-view",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "name", "scope", "filters", "presentation")
  },
  {
    entityType: "source-control",
    fields: [
      ...publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "controlId", "statement", "profileTags", "statementChangeStatus", "externalRefs", "provenance"),
      { field: "localApplicabilityNote", publication: "sensitive" }
    ]
  },
  {
    entityType: "requirement-control-mapping",
    fields: [
      ...internalFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "requirementId", "sourceControlId", "coverageQualifier", "applicabilityProfile", "confidence", "lastReviewedAt", "reviewBy", "provenance"),
      { field: "rationale", publication: "sensitive" }
    ]
  },
  {
    entityType: "direction",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "reference", "issuedAt", "sourceAuthority", "responseState")
  },
  {
    entityType: "change-record",
    fields: [
      ...publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "summary", "changeType", "status", "persistence", "source", "raisedAt", "effectiveAt", "reviewDueAt"),
      { field: "reason", publication: "sensitive" },
      { field: "impactSummary", publication: "sensitive" },
      { field: "decisionOwnerRef", publication: "restricted" }
    ]
  },
  {
    entityType: "supplier",
    fields: [
      ...internalFields("id", "entityType", "schemaVersion", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "supplierType", "status", "criticality"),
      { field: "name", publication: "sensitive" },
      { field: "primaryContact", publication: "restricted" },
      { field: "notes", publication: "sensitive" }
    ]
  },
  {
    entityType: "contract",
    fields: [
      ...internalFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "supplierId", "status", "startsAt", "endsAt"),
      { field: "contractRef", publication: "sensitive" },
      { field: "value", publication: "sensitive" },
      { field: "serviceSummary", publication: "sensitive" }
    ]
  },
  {
    entityType: "spend-item",
    fields: [
      ...internalFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "spendType", "status", "financialYear", "savingsType", "paybackPeriodMonths", "confidence"),
      { field: "amount", publication: "sensitive" },
      { field: "forecastStartAt", publication: "sensitive" },
      { field: "forecastEndAt", publication: "sensitive" },
      { field: "forecastCost", publication: "sensitive" },
      { field: "expectedSavings", publication: "sensitive" },
      { field: "assumptions", publication: "sensitive" },
      { field: "notes", publication: "sensitive" }
    ]
  },
  {
    entityType: "posture",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "requirementCount", "evidenceCount", "actionCount", "riskCount", "sourceControlCount", "requirementControlMappingCount", "directionCount", "changeRecordCount", "supplierCount", "contractCount", "spendItemCount")
  }
] as const;

export const PSPF_DOMAINS: readonly Omit<DomainEntity, "createdAt" | "updatedAt">[] = [
  {
    id: "DOM-00000000-0000-7000-8000-000000000001",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Governance",
    code: "governance",
    sortOrder: 1,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000002",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Security Risk",
    code: "security-risk",
    sortOrder: 2,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000003",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Information",
    code: "information",
    sortOrder: 3,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000004",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Technology",
    code: "technology",
    sortOrder: 4,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000005",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Personnel",
    code: "personnel",
    sortOrder: 5,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000006",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Physical",
    code: "physical",
    sortOrder: 6,
    sourceProduct: "core",
    recordStatus: "active"
  }
] as const;

export const COLLECTION_BY_ENTITY_TYPE: Readonly<Record<V01EntityType, V01Collection>> = {
  domain: "domains",
  requirement: "requirements",
  evidence: "evidence",
  action: "actions",
  risk: "risks",
  snapshot: "snapshots",
  link: "links",
  tag: "tags",
  "saved-view": "saved-views",
  "source-control": "source-controls",
  "requirement-control-mapping": "requirement-control-mappings",
  direction: "directions",
  "change-record": "change-records",
  supplier: "suppliers",
  contract: "contracts",
  "spend-item": "spend-items",
  posture: "posture"
};

export const ID_PREFIX_BY_ENTITY_TYPE: Readonly<Record<V01EntityType, string>> = {
  domain: "DOM",
  requirement: "REQ",
  evidence: "EVD",
  action: "ACT",
  risk: "RSK",
  snapshot: "SNP",
  link: "LNK",
  tag: "TAG",
  "saved-view": "SVW",
  "source-control": "SRC",
  "requirement-control-mapping": "MAP",
  direction: "DIR",
  "change-record": "CHG",
  supplier: "SUP",
  contract: "CTR",
  "spend-item": "SPD",
  posture: "POSTURE"
};

export function createEntityId(entityType: Exclude<V01EntityType, "posture">, randomUuid = crypto.randomUUID()): string {
  return `${ID_PREFIX_BY_ENTITY_TYPE[entityType]}-${randomUuid}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function withEnvelope<EntityType extends V01EntityType>(
  entityType: EntityType,
  value: EntityDraft<EntityType>,
  sourceProduct: SourceProduct = "workshop"
): EntityFor<EntityType> {
  const timestamp = nowIso();
  const id = entityType === "posture" ? "POSTURE" : createEntityId(entityType as Exclude<V01EntityType, "posture">);

  return {
    id,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct,
    recordStatus: "active",
    ...value,
    entityType
  } as unknown as EntityFor<EntityType>;
}

export interface SampleWorkspaceOptions {
  readonly sourceControls?: readonly SourceControlEntity[];
  readonly timestamp?: string;
}

export function buildSampleWorkspaceEntities(options: SampleWorkspaceOptions = {}): V01Entity[] {
  const timestamp = options.timestamp ?? "2026-05-11T00:00:00.000Z";
  const governanceDomain = PSPF_DOMAINS.find((domain) => domain.code === "governance") ?? PSPF_DOMAINS[0]!;
  const informationDomain = PSPF_DOMAINS.find((domain) => domain.code === "information") ?? PSPF_DOMAINS[1] ?? PSPF_DOMAINS[0]!;
  const personnelDomain = PSPF_DOMAINS.find((domain) => domain.code === "personnel") ?? PSPF_DOMAINS[2] ?? PSPF_DOMAINS[0]!;
  const sourceControl = options.sourceControls?.[0];

  const requirementGovernance: RequirementEntity = sampleEntity("requirement", "REQ-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "requirement",
    title: "Confirm security governance cadence",
    domainId: governanceDomain.id,
    assessmentStatus: "in-progress",
    summary: "Internal sample note excluded from publication."
  });
  const requirementInformation: RequirementEntity = sampleEntity("requirement", "REQ-00000000-0000-4000-8000-000000000802", timestamp, {
    entityType: "requirement",
    title: "Review information handling controls",
    domainId: informationDomain.id,
    assessmentStatus: "partially-met",
    summary: "Internal sample note excluded from publication."
  });
  const requirementPersonnel: RequirementEntity = sampleEntity("requirement", "REQ-00000000-0000-4000-8000-000000000803", timestamp, {
    entityType: "requirement",
    title: "Validate role-based access review",
    domainId: personnelDomain.id,
    assessmentStatus: "under-review",
    summary: "Internal sample note excluded from publication."
  });

  const evidenceGovernance: EvidenceEntity = sampleEntity("evidence", "EVD-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "evidence",
    title: "Governance forum terms of reference",
    evidenceType: "document",
    reference: "sample/governance-forum-tor.pdf",
    freshness: "current"
  });
  const evidenceAccess: EvidenceEntity = sampleEntity("evidence", "EVD-00000000-0000-4000-8000-000000000802", timestamp, {
    entityType: "evidence",
    title: "Access review export",
    evidenceType: "document",
    reference: "sample/access-review-export.csv",
    freshness: "stale"
  });

  const actionGovernance: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "action",
    title: "Schedule quarterly governance evidence review",
    status: "todo",
    dueDate: "2026-05-18T00:00:00.000Z"
  });
  const actionEncryption: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000802", timestamp, {
    entityType: "action",
    title: "Resolve encryption exception register",
    status: "blocked",
    dueDate: "2026-05-01T00:00:00.000Z"
  });
  const actionAccess: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000803", timestamp, {
    entityType: "action",
    title: "Refresh role access review evidence",
    status: "in-progress",
    dueDate: "2026-05-14T00:00:00.000Z"
  });

  const riskGovernance: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "risk",
    title: "Governance evidence may fall out of date",
    status: "open",
    likelihood: 3,
    impact: 3
  });
  const riskEncryption: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000802", timestamp, {
    entityType: "risk",
    title: "Encryption exception remains untreated",
    status: "open",
    likelihood: 4,
    impact: 4
  });
  const riskAccess: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000803", timestamp, {
    entityType: "risk",
    title: "Dormant access is retained",
    status: "monitored",
    likelihood: 3,
    impact: 2
  });
  const riskClosed: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000804", timestamp, {
    entityType: "risk",
    title: "Legacy sample risk closed",
    status: "closed",
    likelihood: 1,
    impact: 1
  });

  const directionEncryption: DirectionEntity = sampleEntity("direction", "DIR-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "direction",
    title: "Home Affairs Direction - encryption baseline",
    reference: "HA-DIR-2026-01",
    sourceAuthority: "Department of Home Affairs",
    issuedAt: "2026-04-01T00:00:00.000Z",
    responseState: "not-set"
  });
  const directionReporting: DirectionEntity = sampleEntity("direction", "DIR-00000000-0000-4000-8000-000000000802", timestamp, {
    entityType: "direction",
    title: "Home Affairs Direction - assurance reporting",
    reference: "HA-DIR-2026-02",
    sourceAuthority: "Department of Home Affairs",
    issuedAt: "2026-04-15T00:00:00.000Z",
    responseState: "risk-managed"
  });

  const entities: V01Entity[] = [
    requirementGovernance,
    requirementInformation,
    requirementPersonnel,
    evidenceGovernance,
    evidenceAccess,
    actionGovernance,
    actionEncryption,
    actionAccess,
    riskGovernance,
    riskEncryption,
    riskAccess,
    riskClosed,
    directionEncryption,
    directionReporting,
    sampleLink("LNK-00000000-0000-4000-8000-000000000801", timestamp, "Governance requirement supported by current evidence", "supported-by", requirementGovernance, evidenceGovernance),
    sampleLink("LNK-00000000-0000-4000-8000-000000000802", timestamp, "Access requirement supported by stale evidence", "supported-by", requirementPersonnel, evidenceAccess),
    sampleLink("LNK-00000000-0000-4000-8000-000000000803", timestamp, "Governance requirement addressed by review action", "addressed-by", requirementGovernance, actionGovernance),
    sampleLink("LNK-00000000-0000-4000-8000-000000000804", timestamp, "Information requirement addressed by encryption action", "addressed-by", requirementInformation, actionEncryption),
    sampleLink("LNK-00000000-0000-4000-8000-000000000805", timestamp, "Personnel requirement addressed by access action", "addressed-by", requirementPersonnel, actionAccess),
    sampleLink("LNK-00000000-0000-4000-8000-000000000806", timestamp, "Governance risk treated by review action", "addressed-by", riskGovernance, actionGovernance),
    sampleLink("LNK-00000000-0000-4000-8000-000000000807", timestamp, "Encryption risk treated by encryption action", "addressed-by", riskEncryption, actionEncryption),
    sampleLink("LNK-00000000-0000-4000-8000-000000000808", timestamp, "Access risk treated by access action", "addressed-by", riskAccess, actionAccess),
    sampleLink("LNK-00000000-0000-4000-8000-000000000809", timestamp, "Encryption Direction targets information requirement", "targets", directionEncryption, requirementInformation),
    sampleLink("LNK-00000000-0000-4000-8000-000000000810", timestamp, "Reporting Direction targets governance requirement", "targets", directionReporting, requirementGovernance),
    sampleLink("LNK-00000000-0000-4000-8000-000000000811", timestamp, "Encryption Direction addressed by encryption action", "addressed-by", directionEncryption, actionEncryption),
    sampleLink("LNK-00000000-0000-4000-8000-000000000812", timestamp, "Reporting Direction addressed by review action", "addressed-by", directionReporting, actionGovernance)
  ];

  if (sourceControl) {
    entities.push(sampleEntity("requirement-control-mapping", "MAP-00000000-0000-4000-8000-000000000801", timestamp, {
      entityType: "requirement-control-mapping",
      title: `${requirementGovernance.title} mapped to ${sourceControl.controlId}`,
      requirementId: requirementGovernance.id,
      sourceControlId: sourceControl.id,
      coverageQualifier: "primary",
      applicabilityProfile: "official-sensitive",
      confidence: "medium",
      lastReviewedAt: "2026-05-11T00:00:00.000Z",
      reviewBy: "Sample assurance role",
      rationale: "Internal sample mapping rationale excluded from publication.",
      provenance: {
        author: "sample-workspace",
        createdAt: timestamp,
        oscalRelease: sourceControl.provenance.oscalRelease
      }
    }));
  }

  return entities;
}

function sampleEntity<EntityType extends V01EntityType>(
  entityType: EntityType,
  id: EntityFor<EntityType>["id"],
  timestamp: string,
  value: EntityDraft<EntityType>
): EntityFor<EntityType> {
  return {
    id,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct: "workshop",
    recordStatus: "active",
    ...value,
    entityType
  } as unknown as EntityFor<EntityType>;
}

function sampleLink(
  id: string,
  timestamp: string,
  title: string,
  linkType: LinkType,
  from: V01Entity,
  to: V01Entity
): LinkEntity {
  return sampleEntity("link", id, timestamp, {
    entityType: "link",
    title,
    linkType,
    fromId: from.id,
    fromType: from.entityType,
    toId: to.id,
    toType: to.entityType
  });
}

export function sanitiseEntityForPublication(entity: V01Entity): V01Entity {
  const policy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === entity.entityType);
  if (!policy) {
    throw new Error(`Missing publication policy for entity type ${entity.entityType}`);
  }

  const policiesByField = new Map(policy.fields.map((fieldPolicy) => [fieldPolicy.field, fieldPolicy.publication]));
  const output: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(entity)) {
    const publication = policiesByField.get(field);
    if (!publication) {
      throw new Error(`Missing publication policy for ${entity.entityType}.${field}`);
    }
    if (publication === "restricted") {
      throw new Error(`Restricted field cannot be published: ${entity.entityType}.${field}`);
    }
    if (publication === "public" || publication === "internal") {
      output[field] = field === "schemaVersion" ? VERSION_AXES.schemaVersion : value;
    }
  }

  if (entity.entityType === "requirement-control-mapping" && output.confidence === undefined) {
    output.confidence = "medium";
  }

  return output as unknown as V01Entity;
}

export function enrichActionsWithImpact(entities: readonly V01Entity[]): V01Entity[] {
  const requirements = new Map<string, V01Entity & { assessmentStatus?: string }>();
  const evidenceById = new Map<string, V01Entity & { freshness?: string }>();
  const directionsById = new Map<string, V01Entity & { responseState?: string }>();
  const risksById = new Map<string, V01Entity & { status?: string; likelihood?: number; impact?: number }>();
  for (const entity of entities) {
    if (entity.entityType === "requirement") {
      requirements.set(entity.id, entity as V01Entity & { assessmentStatus?: string });
    } else if (entity.entityType === "evidence") {
      evidenceById.set(entity.id, entity as V01Entity & { freshness?: string });
    } else if (entity.entityType === "direction") {
      directionsById.set(entity.id, entity as V01Entity & { responseState?: string });
    } else if (entity.entityType === "risk") {
      risksById.set(entity.id, entity as V01Entity & { status?: string; likelihood?: number; impact?: number });
    }
  }

  const links = entities.filter((entity): entity is V01Entity & { linkType: string; fromId: string; fromType: string; toId: string; toType: string } => entity.entityType === "link");
  const requirementsByAction = new Map<string, string[]>();
  const evidenceByRequirement = new Map<string, string[]>();
  const risksByAction = new Map<string, string[]>();
  const directionsByAction = new Map<string, string[]>();
  for (const link of links) {
    if (link.linkType === "addressed-by" && link.fromType === "requirement" && link.toType === "action") {
      requirementsByAction.set(link.toId, [...(requirementsByAction.get(link.toId) ?? []), link.fromId]);
    }
    if (link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence") {
      evidenceByRequirement.set(link.fromId, [...(evidenceByRequirement.get(link.fromId) ?? []), link.toId]);
    }
    if (link.linkType === "addressed-by" && link.fromType === "risk" && link.toType === "action") {
      risksByAction.set(link.toId, [...(risksByAction.get(link.toId) ?? []), link.fromId]);
    }
    if (link.linkType === "addressed-by" && link.fromType === "direction" && link.toType === "action") {
      directionsByAction.set(link.toId, [...(directionsByAction.get(link.toId) ?? []), link.fromId]);
    }
  }

  const nonFinalStatuses = new Set(["not-started", "in-progress", "partially-met", "not-met", "under-review"]);
  return entities.map((entity) => {
    if (entity.entityType !== "action") {
      return entity;
    }
    const linkedRequirementIds = requirementsByAction.get(entity.id) ?? [];
    let postureUplift = 0;
    let evidenceUplift = 0;
    const explanation: string[] = [];
    for (const requirementId of linkedRequirementIds) {
      const requirement = requirements.get(requirementId);
      if (requirement && nonFinalStatuses.has(requirement.assessmentStatus ?? "")) {
        postureUplift += 2;
        explanation.push(`Linked to non-final requirement (${requirement.assessmentStatus})`);
      }
      const evidenceIds = evidenceByRequirement.get(requirementId) ?? [];
      const hasCurrentEvidence = evidenceIds.some((id) => evidenceById.get(id)?.freshness === "current");
      if (evidenceIds.length === 0) {
        evidenceUplift += 2;
        explanation.push(`Closes evidence gap on linked requirement`);
      } else if (!hasCurrentEvidence) {
        evidenceUplift += 1;
        explanation.push(`Refreshes ageing or stale evidence`);
      }
    }
    const linkedRiskIds = risksByAction.get(entity.id) ?? [];
    let riskReduction = 0;
    for (const riskId of linkedRiskIds) {
      const risk = risksById.get(riskId);
      if (risk && risk.status !== "closed") {
        const severity = (risk.likelihood ?? 0) * (risk.impact ?? 0);
        riskReduction += severity >= 10 ? 3 : severity >= 5 ? 2 : 1;
        explanation.push(`Treats open risk (severity ${severity})`);
      }
    }
    const linkedDirectionIds = directionsByAction.get(entity.id) ?? [];
    let directionUplift = 0;
    for (const directionId of linkedDirectionIds) {
      const direction = directionsById.get(directionId);
      if (direction && direction.responseState !== "yes") {
        directionUplift += 2;
        explanation.push(`Contributes to Direction response (${direction.responseState})`);
      }
    }
    const action = entity as V01Entity & { status: string; dueDate?: string };
    let urgency: "normal" | "due-soon" | "overdue" | "blocked" = "normal";
    if (action.status === "blocked") {
      urgency = "blocked";
      explanation.push("Action is blocked");
    } else if (action.dueDate) {
      const due = Date.parse(action.dueDate);
      if (!Number.isNaN(due)) {
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (due < now) {
          urgency = "overdue";
          explanation.push("Past due date");
        } else if (due - now < sevenDaysMs) {
          urgency = "due-soon";
          explanation.push("Due within seven days");
        }
      }
    }
    if (explanation.length === 0) {
      explanation.push("No linked requirements, evidence, risks, or Directions");
    }
    const impact = {
      postureUplift,
      evidenceUplift,
      riskReduction,
      directionUplift,
      urgency,
      explanation: Array.from(new Set(explanation))
    };
    return { ...entity, impact } as V01Entity;
  });
}

function publicFields(...fields: readonly string[]): readonly FieldPolicy[] {
  return fields.map((field) => ({ field, publication: "public" as const }));
}

function internalFields(...fields: readonly string[]): readonly FieldPolicy[] {
  return fields.map((field) => ({ field, publication: "internal" as const }));
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}