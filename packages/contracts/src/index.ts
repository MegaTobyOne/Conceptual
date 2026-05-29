export const VERSION_AXES = {
  schemaVersion: "1.12.0",
  bundleVersion: "1.12.0",
  apiVersion: "1.12.0"
} as const;

export const PSPF_SLICE_VERSION = "1.36.0" as const;

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
  "strategy",
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
  "strategies",
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

export interface OperatorLinkRule {
  readonly id: string;
  readonly sourceProduct: SourceProduct;
  readonly linkType: LinkType;
  readonly fromType: V01EntityType;
  readonly toType: V01EntityType;
  readonly label: string;
  readonly phrase: string;
}

export const OPERATOR_LINK_RULES = [
  {
    id: "workshop-requirement-supported-by-evidence",
    sourceProduct: "workshop",
    linkType: "supported-by",
    fromType: "requirement",
    toType: "evidence",
    label: "Link Requirement to Evidence",
    phrase: "supported by"
  },
  {
    id: "workshop-action-supported-by-evidence",
    sourceProduct: "workshop",
    linkType: "supported-by",
    fromType: "action",
    toType: "evidence",
    label: "Link Action to Evidence",
    phrase: "supported by"
  },
  {
    id: "workshop-requirement-addressed-by-action",
    sourceProduct: "workshop",
    linkType: "addressed-by",
    fromType: "requirement",
    toType: "action",
    label: "Link Requirement to Action",
    phrase: "addressed by"
  },
  {
    id: "workshop-requirement-exposed-by-risk",
    sourceProduct: "workshop",
    linkType: "exposed-by",
    fromType: "requirement",
    toType: "risk",
    label: "Link Requirement to Risk",
    phrase: "exposed by"
  },
  {
    id: "workshop-direction-targets-requirement",
    sourceProduct: "workshop",
    linkType: "targets",
    fromType: "direction",
    toType: "requirement",
    label: "Link Direction to Requirement",
    phrase: "targets"
  },
  {
    id: "workshop-change-record-changes-requirement",
    sourceProduct: "workshop",
    linkType: "changes",
    fromType: "change-record",
    toType: "requirement",
    label: "Link Change Record to Requirement",
    phrase: "changes"
  },
  {
    id: "workshop-source-control-supported-by-evidence",
    sourceProduct: "workshop",
    linkType: "supported-by",
    fromType: "source-control",
    toType: "evidence",
    label: "Link ISM Control to Evidence",
    phrase: "supported by"
  },
  {
    id: "workshop-source-control-addressed-by-action",
    sourceProduct: "workshop",
    linkType: "addressed-by",
    fromType: "source-control",
    toType: "action",
    label: "Link ISM Control to Action",
    phrase: "addressed by"
  },
  {
    id: "workshop-source-control-exposed-by-risk",
    sourceProduct: "workshop",
    linkType: "exposed-by",
    fromType: "source-control",
    toType: "risk",
    label: "Link ISM Control to Risk",
    phrase: "exposed by"
  },
  {
    id: "shop-supplier-supports-requirement",
    sourceProduct: "shop",
    linkType: "supports",
    fromType: "supplier",
    toType: "requirement",
    label: "Link Supplier to Requirement",
    phrase: "supports"
  },
  {
    id: "shop-supplier-associated-with-risk",
    sourceProduct: "shop",
    linkType: "associated-with",
    fromType: "supplier",
    toType: "risk",
    label: "Link Supplier to Risk",
    phrase: "associated with"
  },
  {
    id: "shop-contract-supports-requirement",
    sourceProduct: "shop",
    linkType: "supports",
    fromType: "contract",
    toType: "requirement",
    label: "Link Contract to Requirement",
    phrase: "supports"
  },
  {
    id: "shop-contract-funds-spend-item",
    sourceProduct: "shop",
    linkType: "funds",
    fromType: "contract",
    toType: "spend-item",
    label: "Link Contract to Spend Item",
    phrase: "funds"
  },
  {
    id: "shop-spend-item-supports-action",
    sourceProduct: "shop",
    linkType: "supports",
    fromType: "spend-item",
    toType: "action",
    label: "Link Spend Item to Action",
    phrase: "supports"
  },
  {
    id: "shop-spend-item-supports-requirement",
    sourceProduct: "shop",
    linkType: "supports",
    fromType: "spend-item",
    toType: "requirement",
    label: "Link Spend Item to Requirement",
    phrase: "supports"
  }
] as const satisfies readonly OperatorLinkRule[];

export function operatorLinkRuleFor(
  fromType: V01EntityType,
  linkType: LinkType,
  toType: V01EntityType
): OperatorLinkRule | undefined {
  return OPERATOR_LINK_RULES.find(
    (rule) => rule.fromType === fromType && rule.linkType === linkType && rule.toType === toType
  );
}

export function operatorLinkRuleForEndpoints(
  fromType: V01EntityType,
  toType: V01EntityType,
  sourceProduct?: SourceProduct
): OperatorLinkRule | undefined {
  return OPERATOR_LINK_RULES.find(
    (rule) =>
      rule.fromType === fromType &&
      rule.toType === toType &&
      (sourceProduct === undefined || rule.sourceProduct === sourceProduct)
  );
}

export function operatorLinkRulesForSource(sourceProduct: SourceProduct): readonly OperatorLinkRule[] {
  return OPERATOR_LINK_RULES.filter((rule) => rule.sourceProduct === sourceProduct);
}

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

export interface ActionCommentaryEntry {
  readonly createdAt: string;
  readonly text: string;
}

export interface ActionEntity extends EntityEnvelope {
  readonly entityType: "action";
  readonly title: string;
  readonly status: ActionStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly dueDate?: string;
  readonly commentary?: readonly ActionCommentaryEntry[];
  readonly impact?: ActionImpact;
}

export type RiskStatus = "open" | "monitored" | "closed";

export interface RiskIntegrationMetadata {
  readonly source: "6clicks";
  readonly sourceLabel: string;
  readonly remoteId: string;
  readonly remoteUpdatedAt?: string;
  readonly lastSyncedAt: string;
  readonly authMode: "api-key-header" | "bearer-token" | "none";
  readonly rawHash: string;
}

export interface RiskEntity extends EntityEnvelope {
  readonly entityType: "risk";
  readonly title: string;
  readonly status: RiskStatus;
  readonly likelihood: number;
  readonly impact: number;
  readonly integration?: RiskIntegrationMetadata;
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

export const TAG_COLOURS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "grey"] as const;

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
  return (
    normalised.length >= 1 &&
    normalised.length <= TAG_LIMITS.labelMaxLength &&
    TAG_LABEL_ALLOWED_REGEXP.test(normalised)
  );
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

export const SAVED_VIEW_SCOPES = [
  "requirements",
  "explorer-requirements",
  "explorer-relationships",
  "workshop-dashboard",
  "workshop-evidence-review",
  "workshop-source-controls",
  "workshop-requirements"
] as const;
export type SavedViewScope = (typeof SAVED_VIEW_SCOPES)[number];

export const SAVED_VIEW_TAGS_MODES = ["any", "all"] as const;
export type SavedViewTagsMode = (typeof SAVED_VIEW_TAGS_MODES)[number];

export const SAVED_VIEW_EVIDENCE_COVERAGE = ["any", "missing", "linked"] as const;
export type SavedViewEvidenceCoverage = (typeof SAVED_VIEW_EVIDENCE_COVERAGE)[number];

export const SAVED_VIEW_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SavedViewSortDirection = (typeof SAVED_VIEW_SORT_DIRECTIONS)[number];

export const SAVED_VIEW_REQUIREMENT_COLUMNS = [
  "id",
  "title",
  "domainId",
  "assessmentStatus",
  "tags",
  "evidence",
  "actions",
  "risks"
] as const;
export type SavedViewRequirementColumn = (typeof SAVED_VIEW_REQUIREMENT_COLUMNS)[number];

export const SAVED_VIEW_RELATIONSHIP_COLUMNS = ["title", "relationship", "from", "to", "tags"] as const;
export type SavedViewRelationshipColumn = (typeof SAVED_VIEW_RELATIONSHIP_COLUMNS)[number];

export const SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS = [
  "priority",
  "requirement",
  "hint",
  "domain",
  "requirements",
  "evidenceGaps",
  "inProgress",
  "met",
  "notMet",
  "title",
  "status",
  "urgency",
  "total"
] as const;
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
  readonly implementationStatuses?: readonly SourceControlImplementationStatus[];
}

export interface SavedViewPresentation {
  readonly sortKey?: SavedViewRequirementSortKey;
  readonly sortDirection?: SavedViewSortDirection;
  readonly visibleColumns?: readonly (
    | SavedViewRequirementColumn
    | SavedViewRelationshipColumn
    | SavedViewWorkshopDashboardColumn
  )[];
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

export type SourceControlImplementationStatus =
  | "not-implemented"
  | "partial"
  | "implemented"
  | "not-applicable"
  | "under-review";

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
  readonly implementationStatus?: SourceControlImplementationStatus;
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
  readonly strategyCount?: number;
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

export const CHANGE_RECORD_TYPES = [
  "priority",
  "direction",
  "scope",
  "timeline",
  "dependency",
  "risk-response",
  "posture",
  "other"
] as const;
export type ChangeRecordType = (typeof CHANGE_RECORD_TYPES)[number];

export const CHANGE_RECORD_STATUSES = ["proposed", "active", "resolved", "absorbed", "withdrawn"] as const;
export type ChangeRecordStatus = (typeof CHANGE_RECORD_STATUSES)[number];

export const CHANGE_RECORD_PERSISTENCE = ["temporary", "persistent"] as const;
export type ChangeRecordPersistence = (typeof CHANGE_RECORD_PERSISTENCE)[number];

export const CHANGE_RECORD_SOURCES = [
  "executive-direction",
  "risk-event",
  "compliance-event",
  "operational",
  "external-trigger",
  "other"
] as const;
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
export type SavingsType =
  | "avoided-cost"
  | "efficiency"
  | "consolidation"
  | "risk-reduction"
  | "contract-optimisation"
  | "other";
export type ForecastConfidence = "low" | "medium" | "high";

export interface SpendItemEntity extends EntityEnvelope {
  readonly entityType: "spend-item";
  readonly title: string;
  readonly spendType: SpendType;
  readonly status: SpendStatus;
  readonly amount: MoneyAmount;
  readonly financialYear: string;
  readonly costCentre?: string;
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

export type StrategyTrend = "improving" | "steady" | "deteriorating" | "unknown";
export type StrategyConfidence = "low" | "medium" | "high";
export type StrategyMeasureClass =
  | "capability"
  | "essential-eight"
  | "coverage"
  | "exposure"
  | "detection-response"
  | "resilience"
  | "governance-assurance";
export type StrategyReferenceType = "requirement" | "risk" | "action" | "direction";

export interface StrategyReference {
  readonly entityType: StrategyReferenceType;
  readonly entityId: string;
  readonly role: "drives" | "addresses" | "blocked-by" | "evidenced-by" | "monitors";
}

export interface StrategyMeasure {
  readonly id: string;
  readonly title: string;
  readonly measureClass: StrategyMeasureClass;
  readonly baseline?: string;
  readonly current?: string;
  readonly target?: string;
  readonly unit?: string;
  readonly trend: StrategyTrend;
  readonly confidence: StrategyConfidence;
  readonly reviewCadence: "monthly" | "quarterly" | "event-driven";
}

export interface StrategyOutcome {
  readonly id: string;
  readonly statement: string;
  readonly summary: string;
  readonly measures: readonly StrategyMeasure[];
  readonly references: readonly StrategyReference[];
}

export interface StrategicChoice {
  readonly id: string;
  readonly statement: string;
  readonly summary: string;
  readonly capabilityArea: string;
  readonly targetPosture: string;
  readonly executiveOwner?: string;
  readonly trend: StrategyTrend;
  readonly confidence: StrategyConfidence;
  readonly outcomes: readonly StrategyOutcome[];
  readonly references: readonly StrategyReference[];
  readonly rationale?: string;
  readonly constraints?: string;
}

export interface StrategyEntity extends EntityEnvelope {
  readonly entityType: "strategy";
  readonly title: string;
  readonly scope: string;
  readonly timeHorizon: string;
  readonly effectiveAt?: string;
  readonly owner?: string;
  readonly strategyStatement: string;
  readonly riskPostureStatement: string;
  readonly frameworks: readonly string[];
  readonly choices: readonly StrategicChoice[];
  readonly reviewCadence: "monthly" | "quarterly" | "event-driven";
  readonly executiveSummary?: string;
  readonly assumptions?: string;
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
  | StrategyEntity
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
  strategies: StrategyEntity;
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

export const PUBLICATION_FIELD_POLICIES: readonly EntityFieldPolicy[] = [
  {
    entityType: "domain",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "code",
      "sortOrder"
    )
  },
  {
    entityType: "requirement",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "domainId",
        "assessmentStatus"
      ),
      { field: "summary", publication: "sensitive" }
    ]
  },
  {
    entityType: "evidence",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "evidenceType",
      "reference",
      "freshness"
    )
  },
  {
    entityType: "action",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "status",
        "startDate",
        "endDate",
        "dueDate",
        "impact"
      ),
      { field: "commentary", publication: "sensitive" }
    ]
  },
  {
    entityType: "risk",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "status",
        "likelihood",
        "impact"
      ),
      { field: "integration", publication: "sensitive" }
    ]
  },
  {
    entityType: "snapshot",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "snapshotType"
    )
  },
  {
    entityType: "link",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "linkType",
      "fromId",
      "fromType",
      "toId",
      "toType"
    )
  },
  {
    entityType: "tag",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "label",
        "colour",
        "emoji"
      ),
      { field: "description", publication: "sensitive" }
    ]
  },
  {
    entityType: "saved-view",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "name",
      "scope",
      "filters",
      "presentation"
    )
  },
  {
    entityType: "source-control",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "controlId",
        "statement",
        "profileTags",
        "statementChangeStatus",
        "externalRefs",
        "provenance"
      ),
      { field: "localApplicabilityNote", publication: "sensitive" },
      { field: "implementationStatus", publication: "internal" }
    ]
  },
  {
    entityType: "requirement-control-mapping",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "requirementId",
        "sourceControlId",
        "coverageQualifier",
        "applicabilityProfile",
        "confidence",
        "lastReviewedAt",
        "reviewBy",
        "provenance"
      ),
      { field: "rationale", publication: "sensitive" }
    ]
  },
  {
    entityType: "direction",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "reference",
      "issuedAt",
      "sourceAuthority",
      "responseState"
    )
  },
  {
    entityType: "change-record",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "summary",
        "changeType",
        "status",
        "persistence",
        "source",
        "raisedAt",
        "effectiveAt",
        "reviewDueAt"
      ),
      { field: "reason", publication: "sensitive" },
      { field: "impactSummary", publication: "sensitive" },
      { field: "decisionOwnerRef", publication: "restricted" }
    ]
  },
  {
    entityType: "supplier",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "supplierType",
        "status",
        "criticality"
      ),
      { field: "name", publication: "sensitive" },
      { field: "primaryContact", publication: "restricted" },
      { field: "notes", publication: "sensitive" }
    ]
  },
  {
    entityType: "contract",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "supplierId",
        "status",
        "startsAt",
        "endsAt"
      ),
      { field: "contractRef", publication: "sensitive" },
      { field: "value", publication: "sensitive" },
      { field: "serviceSummary", publication: "sensitive" }
    ]
  },
  {
    entityType: "spend-item",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "spendType",
        "status",
        "financialYear",
        "savingsType",
        "paybackPeriodMonths",
        "confidence"
      ),
      { field: "costCentre", publication: "sensitive" },
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
    entityType: "strategy",
    fields: [
      ...publicFields(
        "id",
        "entityType",
        "schemaVersion",
        "title",
        "createdAt",
        "updatedAt",
        "sourceProduct",
        "recordStatus",
        "scope",
        "timeHorizon",
        "effectiveAt",
        "strategyStatement",
        "riskPostureStatement",
        "frameworks",
        "choices",
        "reviewCadence",
        "executiveSummary"
      ),
      { field: "owner", publication: "sensitive" },
      { field: "assumptions", publication: "sensitive" }
    ]
  },
  {
    entityType: "posture",
    fields: publicFields(
      "id",
      "entityType",
      "schemaVersion",
      "title",
      "createdAt",
      "updatedAt",
      "sourceProduct",
      "recordStatus",
      "requirementCount",
      "evidenceCount",
      "actionCount",
      "riskCount",
      "sourceControlCount",
      "requirementControlMappingCount",
      "directionCount",
      "changeRecordCount",
      "supplierCount",
      "contractCount",
      "spendItemCount",
      "strategyCount"
    )
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
  strategy: "strategies",
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
  strategy: "STR",
  posture: "POSTURE"
};

export function createEntityId(
  entityType: Exclude<V01EntityType, "posture">,
  randomUuid = crypto.randomUUID()
): string {
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
  const informationDomain =
    PSPF_DOMAINS.find((domain) => domain.code === "information") ?? PSPF_DOMAINS[1] ?? PSPF_DOMAINS[0]!;
  const personnelDomain =
    PSPF_DOMAINS.find((domain) => domain.code === "personnel") ?? PSPF_DOMAINS[2] ?? PSPF_DOMAINS[0]!;

  const requirementGovernance: RequirementEntity = sampleEntity(
    "requirement",
    "REQ-00000000-0000-4000-8000-000000000801",
    timestamp,
    {
      entityType: "requirement",
      title: "Confirm security governance cadence",
      domainId: governanceDomain.id,
      assessmentStatus: "in-progress",
      summary: "Internal sample note excluded from publication."
    }
  );
  const requirementInformation: RequirementEntity = sampleEntity(
    "requirement",
    "REQ-00000000-0000-4000-8000-000000000802",
    timestamp,
    {
      entityType: "requirement",
      title: "Review information handling controls",
      domainId: informationDomain.id,
      assessmentStatus: "partially-met",
      summary: "Internal sample note excluded from publication."
    }
  );
  const requirementPersonnel: RequirementEntity = sampleEntity(
    "requirement",
    "REQ-00000000-0000-4000-8000-000000000803",
    timestamp,
    {
      entityType: "requirement",
      title: "Validate role-based access review",
      domainId: personnelDomain.id,
      assessmentStatus: "under-review",
      summary: "Internal sample note excluded from publication."
    }
  );

  const evidenceGovernance: EvidenceEntity = sampleEntity(
    "evidence",
    "EVD-00000000-0000-4000-8000-000000000801",
    timestamp,
    {
      entityType: "evidence",
      title: "Governance forum terms of reference",
      evidenceType: "document",
      reference: "sample/governance-forum-tor.pdf",
      freshness: "current"
    }
  );
  const evidenceAccess: EvidenceEntity = sampleEntity(
    "evidence",
    "EVD-00000000-0000-4000-8000-000000000802",
    timestamp,
    {
      entityType: "evidence",
      title: "Access review export",
      evidenceType: "document",
      reference: "sample/access-review-export.csv",
      freshness: "stale"
    }
  );

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

  const directionEncryption: DirectionEntity = sampleEntity(
    "direction",
    "DIR-00000000-0000-4000-8000-000000000801",
    timestamp,
    {
      entityType: "direction",
      title: "Home Affairs Direction - encryption baseline",
      reference: "HA-DIR-2026-01",
      sourceAuthority: "Department of Home Affairs",
      issuedAt: "2026-04-01T00:00:00.000Z",
      responseState: "not-set"
    }
  );
  const directionReporting: DirectionEntity = sampleEntity(
    "direction",
    "DIR-00000000-0000-4000-8000-000000000802",
    timestamp,
    {
      entityType: "direction",
      title: "Home Affairs Direction - assurance reporting",
      reference: "HA-DIR-2026-02",
      sourceAuthority: "Department of Home Affairs",
      issuedAt: "2026-04-15T00:00:00.000Z",
      responseState: "risk-managed"
    }
  );

  const strategy: StrategyEntity = sampleEntity("strategy", "STR-00000000-0000-4000-8000-000000000801", timestamp, {
    entityType: "strategy",
    title: "Cybersecurity Strategy",
    scope: "Enterprise",
    timeHorizon: "2026-2028",
    effectiveAt: "2026-07-01T00:00:00.000Z",
    owner: "CISO",
    strategyStatement: "Focus cyber uplift on governance cadence, encryption assurance, and role-based access review.",
    riskPostureStatement:
      "Reduce likelihood and impact of common and moderately sophisticated attacks while improving PSPF evidence confidence.",
    frameworks: ["PSPF", "Essential Eight"],
    reviewCadence: "quarterly",
    executiveSummary: "Three cyber priorities connect current PSPF assurance work to measurable posture movement.",
    assumptions: "Internal strategic assumptions excluded from publication.",
    choices: [
      {
        id: "choice-governance-cadence",
        statement: "Strengthen governance cadence as the strategic control point for assurance.",
        summary: "Quarterly evidence review keeps PSPF reporting decisions current.",
        capabilityArea: "Governance and assurance",
        targetPosture: "Quarterly evidence review operating with current governance artefacts by 2026-12-31.",
        executiveOwner: "CISO",
        trend: "improving",
        confidence: "medium",
        rationale: "Internal rationale excluded from publication.",
        constraints: "Dependent on governance forum cadence.",
        references: [
          { entityType: "requirement", entityId: requirementGovernance.id, role: "drives" },
          { entityType: "risk", entityId: riskGovernance.id, role: "blocked-by" },
          { entityType: "action", entityId: actionGovernance.id, role: "addresses" },
          { entityType: "direction", entityId: directionReporting.id, role: "monitors" }
        ],
        outcomes: [
          {
            id: "outcome-governance-evidence-current",
            statement: "Governance evidence remains current for executive assurance decisions.",
            summary: "Evidence review cadence is visible and linked to assurance work.",
            references: [
              { entityType: "requirement", entityId: requirementGovernance.id, role: "evidenced-by" },
              { entityType: "action", entityId: actionGovernance.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-governance-review-cadence",
                title: "Governance review cadence",
                measureClass: "governance-assurance",
                baseline: "Ad hoc",
                current: "Quarterly review scheduled",
                target: "Quarterly review complete",
                unit: "cadence",
                trend: "improving",
                confidence: "medium",
                reviewCadence: "quarterly"
              }
            ]
          }
        ]
      },
      {
        id: "choice-encryption-assurance",
        statement: "Reduce exposure from unresolved encryption exceptions.",
        summary: "Encryption exception treatment links Direction response to risk reduction.",
        capabilityArea: "Protective control posture",
        targetPosture:
          "Encryption exceptions reviewed, treated, and tracked against Essential Eight evidence by 2026-12-31.",
        executiveOwner: "CISO",
        trend: "steady",
        confidence: "low",
        references: [
          { entityType: "requirement", entityId: requirementInformation.id, role: "drives" },
          { entityType: "risk", entityId: riskEncryption.id, role: "blocked-by" },
          { entityType: "action", entityId: actionEncryption.id, role: "addresses" },
          { entityType: "direction", entityId: directionEncryption.id, role: "monitors" }
        ],
        outcomes: [
          {
            id: "outcome-encryption-exceptions-treated",
            statement: "Encryption exceptions are visible, risk-assessed, and moving toward treatment.",
            summary: "Exception register is tied to PSPF and Direction response work.",
            references: [
              { entityType: "risk", entityId: riskEncryption.id, role: "blocked-by" },
              { entityType: "action", entityId: actionEncryption.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-encryption-exception-age",
                title: "Encryption exception age",
                measureClass: "exposure",
                baseline: "Unknown",
                current: "Exception register blocked",
                target: "All exceptions reviewed within quarter",
                trend: "steady",
                confidence: "low",
                reviewCadence: "monthly"
              }
            ]
          }
        ]
      },
      {
        id: "choice-access-review",
        statement: "Make role-based access review a repeatable control assurance loop.",
        summary: "Access review evidence links personnel security assurance to open follow-up work.",
        capabilityArea: "Identity and access assurance",
        targetPosture: "Dormant and privileged access findings reviewed monthly with evidence refreshed by 2026-12-31.",
        executiveOwner: "CISO",
        trend: "improving",
        confidence: "medium",
        references: [
          { entityType: "requirement", entityId: requirementPersonnel.id, role: "drives" },
          { entityType: "risk", entityId: riskAccess.id, role: "blocked-by" },
          { entityType: "action", entityId: actionAccess.id, role: "addresses" }
        ],
        outcomes: [
          {
            id: "outcome-access-review-current",
            statement: "Role access review evidence is current and connected to assurance decisions.",
            summary: "Dormant access findings are treated through visible follow-up work.",
            references: [
              { entityType: "requirement", entityId: requirementPersonnel.id, role: "evidenced-by" },
              { entityType: "risk", entityId: riskAccess.id, role: "blocked-by" },
              { entityType: "action", entityId: actionAccess.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-access-review-freshness",
                title: "Access review evidence freshness",
                measureClass: "capability",
                baseline: "Stale review evidence",
                current: "Refresh action open",
                target: "Current review evidence linked monthly",
                unit: "cadence",
                trend: "improving",
                confidence: "medium",
                reviewCadence: "monthly"
              }
            ]
          }
        ]
      }
    ]
  });

  const entities: V01Entity[] = [
    strategy,
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
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000801",
      timestamp,
      "Governance requirement supported by current evidence",
      "supported-by",
      requirementGovernance,
      evidenceGovernance
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000802",
      timestamp,
      "Access requirement supported by stale evidence",
      "supported-by",
      requirementPersonnel,
      evidenceAccess
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000803",
      timestamp,
      "Governance requirement addressed by review action",
      "addressed-by",
      requirementGovernance,
      actionGovernance
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000804",
      timestamp,
      "Information requirement addressed by encryption action",
      "addressed-by",
      requirementInformation,
      actionEncryption
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000805",
      timestamp,
      "Personnel requirement addressed by access action",
      "addressed-by",
      requirementPersonnel,
      actionAccess
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000806",
      timestamp,
      "Governance risk treated by review action",
      "addressed-by",
      riskGovernance,
      actionGovernance
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000807",
      timestamp,
      "Encryption risk treated by encryption action",
      "addressed-by",
      riskEncryption,
      actionEncryption
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000808",
      timestamp,
      "Access risk treated by access action",
      "addressed-by",
      riskAccess,
      actionAccess
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000809",
      timestamp,
      "Encryption Direction targets information requirement",
      "targets",
      directionEncryption,
      requirementInformation
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000810",
      timestamp,
      "Reporting Direction targets governance requirement",
      "targets",
      directionReporting,
      requirementGovernance
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000811",
      timestamp,
      "Encryption Direction addressed by encryption action",
      "addressed-by",
      directionEncryption,
      actionEncryption
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000812",
      timestamp,
      "Reporting Direction addressed by review action",
      "addressed-by",
      directionReporting,
      actionGovernance
    )
  ];

  entities.push(
    ...buildSampleMappings(
      enterpriseSampleMappingSeeds(requirementGovernance, requirementInformation, requirementPersonnel),
      options.sourceControls,
      timestamp
    )
  );

  return entities;
}

/**
 * Backwards-compatible alias. New code should call
 * `buildEnterpriseSampleWorkspaceEntities` (or the new home variant) directly.
 * @deprecated Use `buildEnterpriseSampleWorkspaceEntities` instead.
 */
export const buildEnterpriseSampleWorkspaceEntities = buildSampleWorkspaceEntities;

/**
 * Builds a privacy-safe "Home & small business" sample workspace covering the
 * 15 reference home-control areas. Each Requirement carries a short channelling
 * sentence in its `summary` field linking the area back to PSPF / ISM / Cyber
 * Foundations language. Mappings are mostly `compensating` with `low`/`medium`
 * confidence to reflect that home environments adapt enterprise controls.
 */
export function buildHomeSampleWorkspaceEntities(options: SampleWorkspaceOptions = {}): V01Entity[] {
  const timestamp = options.timestamp ?? "2026-05-11T00:00:00.000Z";
  const governanceDomain = PSPF_DOMAINS.find((domain) => domain.code === "governance") ?? PSPF_DOMAINS[0]!;
  const informationDomain =
    PSPF_DOMAINS.find((domain) => domain.code === "information") ?? PSPF_DOMAINS[1] ?? PSPF_DOMAINS[0]!;
  const personnelDomain =
    PSPF_DOMAINS.find((domain) => domain.code === "personnel") ?? PSPF_DOMAINS[2] ?? PSPF_DOMAINS[0]!;
  const physicalDomain =
    PSPF_DOMAINS.find((domain) => domain.code === "physical") ?? PSPF_DOMAINS[3] ?? informationDomain;

  // 15 home reference control areas. Each becomes a Requirement whose
  // `summary` carries the PSPF/ISM/Foundations channelling sentence.
  interface HomeArea {
    readonly idSuffix: string;
    readonly title: string;
    readonly assessmentStatus: AssessmentStatus;
    readonly domainId: string;
    readonly summary: string;
  }
  const homeAreas: readonly HomeArea[] = [
    {
      idSuffix: "701",
      title: "Asset inventory for household devices and accounts",
      assessmentStatus: "in-progress",
      domainId: informationDomain.id,
      summary:
        "Channels PSPF Information Security domain and ISM 'Asset identification' principle: know which devices and accounts are in scope before applying protections."
    },
    {
      idSuffix: "702",
      title: "Classify what matters most in the household",
      assessmentStatus: "partially-met",
      domainId: informationDomain.id,
      summary:
        "Channels PSPF sensitivity and classifications policy and ISM 'Business criticality rating identification' principle: decide what data and accounts matter most so protections match value."
    },
    {
      idSuffix: "703",
      title: "Patch devices, browsers, and key apps",
      assessmentStatus: "in-progress",
      domainId: informationDomain.id,
      summary:
        "Channels Essential Eight 'Patch applications' and 'Patch operating systems' and ISM 'Vulnerability management' principle: keep devices current to close common exploitation paths."
    },
    {
      idSuffix: "704",
      title: "Multi-factor authentication on important sign-ins",
      assessmentStatus: "partially-met",
      domainId: personnelDomain.id,
      summary:
        "Channels Essential Eight 'Multi-factor authentication' and ISM 'Identity, credential and access management' principle: protect important sign-ins with a second factor."
    },
    {
      idSuffix: "705",
      title: "Use a standard account for daily activity",
      assessmentStatus: "partially-met",
      domainId: personnelDomain.id,
      summary:
        "Channels Essential Eight 'Restrict administrative privileges' and ISM 'Least privilege access' principle: keep daily activity on a non-administrator account."
    },
    {
      idSuffix: "706",
      title: "Install software only from trusted sources",
      assessmentStatus: "in-progress",
      domainId: informationDomain.id,
      summary:
        "Channels Essential Eight 'Application control' and ISM 'Trustworthy software' principle: prefer official stores and signed installers; avoid unknown executables."
    },
    {
      idSuffix: "707",
      title: "Harden browsers and risky defaults",
      assessmentStatus: "in-progress",
      domainId: informationDomain.id,
      summary:
        "Channels Essential Eight 'User application hardening' and ISM 'Secure configuration management' principle: lock down browser plug-ins, macros, and risky defaults."
    },
    {
      idSuffix: "708",
      title: "Separate guest, IoT, and work network traffic",
      assessmentStatus: "not-started",
      domainId: informationDomain.id,
      summary:
        "Channels ISM 'Network segmentation and segregation' principle: keep guest, IoT, and work devices on separated network segments where possible."
    },
    {
      idSuffix: "709",
      title: "Encrypt devices and sensitive backups",
      assessmentStatus: "partially-met",
      domainId: informationDomain.id,
      summary:
        "Channels PSPF Information Security domain and ISM 'Data protection' and 'Cryptographic agility' principles: encrypt devices at rest and protect sensitive backups."
    },
    {
      idSuffix: "710",
      title: "Hold offline or versioned backups of irreplaceable data",
      assessmentStatus: "in-progress",
      domainId: informationDomain.id,
      summary:
        "Channels Essential Eight 'Regular backups' and ISM 'Regular and proven backups' principle: keep tested, offline or versioned copies of family data that cannot be recreated."
    },
    {
      idSuffix: "711",
      title: "Keep enough logs to investigate problems",
      assessmentStatus: "not-started",
      domainId: informationDomain.id,
      summary:
        "Channels ISM 'Centralised event logging' principle: keep sign-in and device records sufficient to investigate something that goes wrong."
    },
    {
      idSuffix: "712",
      title: "Cyber awareness for the household",
      assessmentStatus: "in-progress",
      domainId: personnelDomain.id,
      summary:
        "Channels PSPF awareness obligations and ISM 'Cyber security awareness training' principle: keep household members aware of common scams and clear on reporting paths."
    },
    {
      idSuffix: "713",
      title: "Tailor protections for children and dependants",
      assessmentStatus: "partially-met",
      domainId: personnelDomain.id,
      summary:
        "Channels ISM 'Cyber security and safety' principle: tailor content filtering, age-appropriate access, and supervision for children's devices."
    },
    {
      idSuffix: "714",
      title: "Separate work and personal accounts on shared devices",
      assessmentStatus: "in-progress",
      domainId: personnelDomain.id,
      summary:
        "Channels ISM 'Secure administration' and 'Identity, credential and access management' principles: separate work and personal accounts, and harden working-from-home setups."
    },
    {
      idSuffix: "715",
      title: "Prefer trusted vendors and review their data handling",
      assessmentStatus: "not-started",
      domainId: governanceDomain.id,
      summary:
        "Channels ISM 'Supplier cyber security assurance' and 'Cyber supply chain security' principles: prefer trusted suppliers and check how they handle household data."
    }
  ];
  void physicalDomain; // reserved for future home-physical examples

  const requirements: RequirementEntity[] = homeAreas.map((area) =>
    sampleEntity("requirement", `REQ-00000000-0000-4000-8000-000000000${area.idSuffix}`, timestamp, {
      entityType: "requirement",
      title: area.title,
      domainId: area.domainId,
      assessmentStatus: area.assessmentStatus,
      summary: area.summary
    })
  );
  const reqById = new Map(requirements.map((r) => [r.id, r] as const));
  const reqByArea = (suffix: string) => reqById.get(`REQ-00000000-0000-4000-8000-000000000${suffix}`)!;

  // Evidence (4 items, mixed freshness)
  const evidenceInventory: EvidenceEntity = sampleEntity(
    "evidence",
    "EVD-00000000-0000-4000-8000-000000000721",
    timestamp,
    {
      entityType: "evidence",
      title: "Household device and account inventory",
      evidenceType: "document",
      reference: "sample/home-inventory.csv",
      freshness: "current"
    }
  );
  const evidenceMfa: EvidenceEntity = sampleEntity("evidence", "EVD-00000000-0000-4000-8000-000000000722", timestamp, {
    entityType: "evidence",
    title: "MFA enrolment screenshot for primary accounts",
    evidenceType: "document",
    reference: "sample/home-mfa-enrolment.pdf",
    freshness: "current"
  });
  const evidenceBackup: EvidenceEntity = sampleEntity(
    "evidence",
    "EVD-00000000-0000-4000-8000-000000000723",
    timestamp,
    {
      entityType: "evidence",
      title: "Backup restore test note",
      evidenceType: "note",
      reference: "sample/home-backup-restore-note.txt",
      freshness: "stale"
    }
  );
  const evidenceAwareness: EvidenceEntity = sampleEntity(
    "evidence",
    "EVD-00000000-0000-4000-8000-000000000724",
    timestamp,
    {
      entityType: "evidence",
      title: "Family scam-awareness checklist",
      evidenceType: "document",
      reference: "sample/home-awareness-checklist.pdf",
      freshness: "current"
    }
  );

  // Actions (5 items)
  const actionPatch: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000731", timestamp, {
    entityType: "action",
    title: "Turn on automatic updates for all household devices",
    status: "in-progress",
    dueDate: "2026-06-30T00:00:00.000Z"
  });
  const actionMfa: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000732", timestamp, {
    entityType: "action",
    title: "Enrol MFA on email, banking, and government accounts",
    status: "in-progress",
    dueDate: "2026-06-15T00:00:00.000Z"
  });
  const actionBackup: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000733", timestamp, {
    entityType: "action",
    title: "Test a backup restore and document the result",
    status: "todo",
    dueDate: "2026-07-31T00:00:00.000Z"
  });
  const actionSegmentation: ActionEntity = sampleEntity(
    "action",
    "ACT-00000000-0000-4000-8000-000000000734",
    timestamp,
    {
      entityType: "action",
      title: "Move IoT devices to a separate Wi-Fi network",
      status: "todo",
      dueDate: "2026-08-31T00:00:00.000Z"
    }
  );
  const actionKids: ActionEntity = sampleEntity("action", "ACT-00000000-0000-4000-8000-000000000735", timestamp, {
    entityType: "action",
    title: "Review content filtering and screen-time on children's devices",
    status: "in-progress",
    dueDate: "2026-06-01T00:00:00.000Z"
  });

  // Risks (3 items)
  const riskUnpatched: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000741", timestamp, {
    entityType: "risk",
    title: "Unpatched home devices exploited by commodity malware",
    status: "open",
    likelihood: 3,
    impact: 3
  });
  const riskBackup: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000742", timestamp, {
    entityType: "risk",
    title: "Family photos and records lost without proven backups",
    status: "open",
    likelihood: 2,
    impact: 4
  });
  const riskScam: RiskEntity = sampleEntity("risk", "RSK-00000000-0000-4000-8000-000000000743", timestamp, {
    entityType: "risk",
    title: "Household member falls for phishing or banking scam",
    status: "monitored",
    likelihood: 3,
    impact: 3
  });

  // Strategy with three pragmatic choices
  const strategy: StrategyEntity = sampleEntity("strategy", "STR-00000000-0000-4000-8000-000000000701", timestamp, {
    entityType: "strategy",
    title: "Home & small business cyber plan",
    scope: "Home & small business",
    timeHorizon: "2026",
    effectiveAt: "2026-07-01T00:00:00.000Z",
    owner: "Household lead",
    strategyStatement:
      "Apply the Cyber Foundations in a household-friendly order: know what you have, protect important accounts, and stay recoverable.",
    riskPostureStatement:
      "Reduce likelihood and impact of common commodity attacks (phishing, ransomware, account takeover) for the household and any home-run business activity.",
    frameworks: ["Cyber Foundations", "Essential Eight", "ISM"],
    reviewCadence: "quarterly",
    executiveSummary:
      "Three home-friendly priorities channel PSPF, ISM, and Essential Eight ideas into practical household actions.",
    assumptions: "Internal household assumptions excluded from publication.",
    choices: [
      {
        id: "choice-home-foundations",
        statement: "Know what you have and keep it current.",
        summary: "Asset inventory, classification, patching, and trusted software keep the baseline healthy.",
        capabilityArea: "Foundations",
        targetPosture:
          "Current asset inventory, classified data, and automatic updates on every household device by 2026-12-31.",
        executiveOwner: "Household lead",
        trend: "improving",
        confidence: "medium",
        rationale: "Internal rationale excluded from publication.",
        references: [
          { entityType: "requirement", entityId: reqByArea("701").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("702").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("703").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("706").id, role: "drives" },
          { entityType: "action", entityId: actionPatch.id, role: "addresses" }
        ],
        outcomes: [
          {
            id: "outcome-home-foundations-current",
            statement: "Devices and accounts are inventoried and kept current.",
            summary: "Patch and inventory cadence is visible at a household level.",
            references: [
              { entityType: "requirement", entityId: reqByArea("703").id, role: "evidenced-by" },
              { entityType: "action", entityId: actionPatch.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-home-patch-cadence",
                title: "Devices on automatic updates",
                measureClass: "capability",
                baseline: "Mixed",
                current: "Most devices",
                target: "All household devices",
                unit: "devices",
                trend: "improving",
                confidence: "medium",
                reviewCadence: "quarterly"
              }
            ]
          }
        ]
      },
      {
        id: "choice-home-accounts",
        statement: "Protect important sign-ins and shared devices.",
        summary: "MFA, least privilege, browser hardening, and account separation reduce account takeover risk.",
        capabilityArea: "Accounts and devices",
        targetPosture:
          "MFA on email, banking, and government accounts; daily activity on standard accounts by 2026-09-30.",
        executiveOwner: "Household lead",
        trend: "improving",
        confidence: "medium",
        references: [
          { entityType: "requirement", entityId: reqByArea("704").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("705").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("707").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("714").id, role: "drives" },
          { entityType: "risk", entityId: riskScam.id, role: "blocked-by" },
          { entityType: "action", entityId: actionMfa.id, role: "addresses" }
        ],
        outcomes: [
          {
            id: "outcome-home-mfa-coverage",
            statement: "Important sign-ins are protected by MFA.",
            summary: "MFA is enrolled and recovery paths are documented.",
            references: [
              { entityType: "requirement", entityId: reqByArea("704").id, role: "evidenced-by" },
              { entityType: "action", entityId: actionMfa.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-home-mfa-coverage",
                title: "Important accounts with MFA",
                measureClass: "capability",
                baseline: "Some",
                current: "Most",
                target: "All important accounts",
                unit: "accounts",
                trend: "improving",
                confidence: "medium",
                reviewCadence: "quarterly"
              }
            ]
          }
        ]
      },
      {
        id: "choice-home-resilience",
        statement: "Stay recoverable and ready when things go wrong.",
        summary: "Backups, logging, network separation, and awareness prepare the household to recover.",
        capabilityArea: "Resilience and awareness",
        targetPosture:
          "Tested offline backup, separated IoT network, and family awareness checklist refreshed annually.",
        executiveOwner: "Household lead",
        trend: "steady",
        confidence: "low",
        references: [
          { entityType: "requirement", entityId: reqByArea("708").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("709").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("710").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("711").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("712").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("713").id, role: "drives" },
          { entityType: "requirement", entityId: reqByArea("715").id, role: "drives" },
          { entityType: "risk", entityId: riskBackup.id, role: "blocked-by" },
          { entityType: "risk", entityId: riskUnpatched.id, role: "blocked-by" },
          { entityType: "action", entityId: actionBackup.id, role: "addresses" },
          { entityType: "action", entityId: actionSegmentation.id, role: "addresses" },
          { entityType: "action", entityId: actionKids.id, role: "addresses" }
        ],
        outcomes: [
          {
            id: "outcome-home-backup-tested",
            statement: "A backup restore has been tested in the last twelve months.",
            summary: "Restore test is documented and dated.",
            references: [
              { entityType: "requirement", entityId: reqByArea("710").id, role: "evidenced-by" },
              { entityType: "action", entityId: actionBackup.id, role: "addresses" }
            ],
            measures: [
              {
                id: "measure-home-backup-restore",
                title: "Months since last tested restore",
                measureClass: "exposure",
                baseline: "Not tested",
                current: "Test scheduled",
                target: "≤ 12 months",
                unit: "months",
                trend: "improving",
                confidence: "low",
                reviewCadence: "quarterly"
              }
            ]
          }
        ]
      }
    ]
  });

  const entities: V01Entity[] = [
    strategy,
    ...requirements,
    evidenceInventory,
    evidenceMfa,
    evidenceBackup,
    evidenceAwareness,
    actionPatch,
    actionMfa,
    actionBackup,
    actionSegmentation,
    actionKids,
    riskUnpatched,
    riskBackup,
    riskScam,
    // Evidence links
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000751",
      timestamp,
      "Asset inventory requirement supported by household inventory",
      "supported-by",
      reqByArea("701"),
      evidenceInventory
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000752",
      timestamp,
      "MFA requirement supported by enrolment screenshot",
      "supported-by",
      reqByArea("704"),
      evidenceMfa
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000753",
      timestamp,
      "Backup requirement supported by restore test note",
      "supported-by",
      reqByArea("710"),
      evidenceBackup
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000754",
      timestamp,
      "Awareness requirement supported by family checklist",
      "supported-by",
      reqByArea("712"),
      evidenceAwareness
    ),
    // Action links
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000755",
      timestamp,
      "Patch requirement addressed by automatic-updates action",
      "addressed-by",
      reqByArea("703"),
      actionPatch
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000756",
      timestamp,
      "MFA requirement addressed by enrolment action",
      "addressed-by",
      reqByArea("704"),
      actionMfa
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000757",
      timestamp,
      "Backup requirement addressed by restore-test action",
      "addressed-by",
      reqByArea("710"),
      actionBackup
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000758",
      timestamp,
      "Network segmentation requirement addressed by IoT split action",
      "addressed-by",
      reqByArea("708"),
      actionSegmentation
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000759",
      timestamp,
      "Kids-devices requirement addressed by content-filtering action",
      "addressed-by",
      reqByArea("713"),
      actionKids
    ),
    // Risk links
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000760",
      timestamp,
      "Patching risk treated by automatic-updates action",
      "addressed-by",
      riskUnpatched,
      actionPatch
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000761",
      timestamp,
      "Backup-loss risk treated by restore-test action",
      "addressed-by",
      riskBackup,
      actionBackup
    ),
    sampleLink(
      "LNK-00000000-0000-4000-8000-000000000762",
      timestamp,
      "Scam risk treated by awareness checklist",
      "supported-by",
      riskScam,
      evidenceAwareness
    )
  ];

  entities.push(...buildSampleMappings(homeSampleMappingSeeds(reqByArea), options.sourceControls, timestamp));

  return entities;
}

// === Sample mapping helpers =================================================

interface SampleMappingSeed {
  readonly idSuffix: string;
  readonly requirementId: string;
  readonly requirementTitle: string;
  readonly controlId: string;
  readonly qualifier: CoverageQualifier;
  readonly applicabilityProfile: string;
  readonly confidence: MappingConfidence;
  readonly rationale: string;
  readonly reviewBy?: string;
}

function buildSampleMappings(
  seeds: readonly SampleMappingSeed[],
  sourceControls: readonly SourceControlEntity[] | undefined,
  timestamp: string
): RequirementControlMappingEntity[] {
  if (!sourceControls || sourceControls.length === 0) {
    return [];
  }
  const byControlId = new Map(sourceControls.map((sc) => [sc.controlId, sc] as const));
  const mappings: RequirementControlMappingEntity[] = [];
  for (const seed of seeds) {
    const control = byControlId.get(seed.controlId);
    if (!control) {
      continue;
    }
    mappings.push(
      sampleEntity("requirement-control-mapping", `MAP-00000000-0000-4000-8000-${seed.idSuffix}`, timestamp, {
        entityType: "requirement-control-mapping",
        title: `${seed.requirementTitle} mapped to ${control.controlId}`,
        requirementId: seed.requirementId,
        sourceControlId: control.id,
        coverageQualifier: seed.qualifier,
        applicabilityProfile: seed.applicabilityProfile,
        confidence: seed.confidence,
        lastReviewedAt: timestamp,
        reviewBy: seed.reviewBy ?? "Sample data curator",
        rationale: seed.rationale,
        provenance: {
          author: "sample-workspace",
          createdAt: timestamp,
          oscalRelease: control.provenance.oscalRelease
        }
      })
    );
  }
  return mappings;
}

function enterpriseSampleMappingSeeds(
  requirementGovernance: RequirementEntity,
  requirementInformation: RequirementEntity,
  requirementPersonnel: RequirementEntity
): readonly SampleMappingSeed[] {
  const profile = "official-sensitive";
  const reviewBy = "Sample data curator";
  return [
    // Governance requirement → governance and assurance principles
    {
      idSuffix: "000000000801",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-01",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000802",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-02",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000803",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-04",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000804",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-06",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000805",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-07",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000806",
      requirementId: requirementGovernance.id,
      requirementTitle: requirementGovernance.title,
      controlId: "ism-principle-gov-11",
      qualifier: "compensating",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    // Information requirement → data-protection and configuration principles
    {
      idSuffix: "000000000807",
      requirementId: requirementInformation.id,
      requirementTitle: requirementInformation.title,
      controlId: "ism-principle-pro-08",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000808",
      requirementId: requirementInformation.id,
      requirementTitle: requirementInformation.title,
      controlId: "ism-principle-pro-17",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000809",
      requirementId: requirementInformation.id,
      requirementTitle: requirementInformation.title,
      controlId: "ism-principle-pro-04",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000810",
      requirementId: requirementInformation.id,
      requirementTitle: requirementInformation.title,
      controlId: "ism-principle-ide-03",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000811",
      requirementId: requirementInformation.id,
      requirementTitle: requirementInformation.title,
      controlId: "ism-principle-pro-09",
      qualifier: "compensating",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    // Personnel requirement → identity, access, and awareness principles
    {
      idSuffix: "000000000812",
      requirementId: requirementPersonnel.id,
      requirementTitle: requirementPersonnel.title,
      controlId: "ism-principle-pro-12",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000813",
      requirementId: requirementPersonnel.id,
      requirementTitle: requirementPersonnel.title,
      controlId: "ism-principle-pro-13",
      qualifier: "primary",
      applicabilityProfile: profile,
      confidence: "high",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000814",
      requirementId: requirementPersonnel.id,
      requirementTitle: requirementPersonnel.title,
      controlId: "ism-principle-pro-05",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000815",
      requirementId: requirementPersonnel.id,
      requirementTitle: requirementPersonnel.title,
      controlId: "ism-principle-pro-14",
      qualifier: "compensating",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    },
    {
      idSuffix: "000000000816",
      requirementId: requirementPersonnel.id,
      requirementTitle: requirementPersonnel.title,
      controlId: "ism-principle-gov-12",
      qualifier: "partial",
      applicabilityProfile: profile,
      confidence: "medium",
      rationale: "Internal rationale excluded from publication.",
      reviewBy
    }
  ];
}

function homeSampleMappingSeeds(reqByArea: (suffix: string) => RequirementEntity): readonly SampleMappingSeed[] {
  const profile = "home-and-small-business";
  const reviewBy = "Sample data curator";
  const seed = (
    idSuffix: string,
    suffix: string,
    controlId: string,
    qualifier: CoverageQualifier,
    confidence: MappingConfidence
  ): SampleMappingSeed => {
    const req = reqByArea(suffix);
    return {
      idSuffix,
      requirementId: req.id,
      requirementTitle: req.title,
      controlId,
      qualifier,
      applicabilityProfile: profile,
      confidence,
      rationale: "Internal home-context rationale excluded from publication.",
      reviewBy
    };
  };
  return [
    // 701 Asset inventory
    seed("000000000771", "701", "ism-principle-ide-01", "primary", "medium"),
    seed("000000000772", "701", "ism-principle-ide-05", "partial", "low"),
    // 702 Classify
    seed("000000000773", "702", "ism-principle-ide-02", "primary", "medium"),
    seed("000000000774", "702", "ism-principle-ide-03", "partial", "low"),
    // 703 Patch
    seed("000000000775", "703", "ism-principle-pro-06", "primary", "medium"),
    // 704 MFA
    seed("000000000776", "704", "ism-principle-pro-13", "primary", "medium"),
    // 705 Least privilege
    seed("000000000777", "705", "ism-principle-pro-12", "primary", "medium"),
    // 706 Application control
    seed("000000000778", "706", "ism-principle-pro-07", "compensating", "low"),
    // 707 Browser hardening
    seed("000000000779", "707", "ism-principle-pro-04", "compensating", "low"),
    // 708 Network segmentation
    seed("000000000780", "708", "ism-principle-pro-18", "compensating", "low"),
    // 709 Encryption
    seed("000000000781", "709", "ism-principle-pro-08", "primary", "medium"),
    seed("000000000782", "709", "ism-principle-pro-17", "partial", "low"),
    // 710 Backups
    seed("000000000783", "710", "ism-principle-pro-10", "primary", "medium"),
    // 711 Logging
    seed("000000000784", "711", "ism-principle-det-01", "compensating", "low"),
    // 712 Awareness
    seed("000000000785", "712", "ism-principle-pro-14", "primary", "medium"),
    // 713 Kids devices
    seed("000000000786", "713", "ism-principle-gov-13", "compensating", "low"),
    seed("000000000787", "713", "ism-principle-pro-15", "compensating", "low"),
    // 714 BYO/WFH
    seed("000000000788", "714", "ism-principle-pro-05", "compensating", "low"),
    seed("000000000789", "714", "ism-principle-pro-13", "partial", "low"),
    // 715 Vendor/FOCI
    seed("000000000790", "715", "ism-principle-gov-11", "primary", "medium"),
    seed("000000000791", "715", "ism-principle-pro-16", "partial", "low")
  ];
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

export const DISALLOWED_PUBLICATION_FIELDS = [
  "person.name",
  "person.email",
  "assignment.personId",
  ...PUBLICATION_FIELD_POLICIES.flatMap((policy) =>
    policy.fields
      .filter((fieldPolicy) => fieldPolicy.publication === "restricted")
      .map((fieldPolicy) => `${policy.entityType}.${fieldPolicy.field}`)
  )
] as readonly string[];

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
    if (publication === "public") {
      output[field] = field === "schemaVersion" ? VERSION_AXES.schemaVersion : value;
    }
  }

  if (entity.entityType === "requirement-control-mapping" && output.confidence === undefined) {
    output.confidence = "medium";
  }

  if (entity.entityType === "strategy" && Array.isArray(output.choices)) {
    output.choices = output.choices.map((choice) => {
      const publicChoice = choice as StrategicChoice;
      return {
        id: publicChoice.id,
        statement: publicChoice.statement,
        summary: publicChoice.summary,
        capabilityArea: publicChoice.capabilityArea,
        targetPosture: publicChoice.targetPosture,
        trend: publicChoice.trend,
        confidence: publicChoice.confidence,
        references: publicChoice.references,
        outcomes: publicChoice.outcomes.map((outcome) => ({
          id: outcome.id,
          statement: outcome.statement,
          summary: outcome.summary,
          references: outcome.references
        }))
      };
    });
  }

  if (entity.entityType === "risk" && entity.integration) {
    output.integration = {
      sourceLabel: entity.integration.sourceLabel,
      remoteUpdatedAt: entity.integration.remoteUpdatedAt
    };
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

  const links = entities.filter(
    (
      entity
    ): entity is V01Entity & { linkType: string; fromId: string; fromType: string; toId: string; toType: string } =>
      entity.entityType === "link"
  );
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

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

// --------------------------------------------------------------------------
// Questionnaire-driven population (ADR 0069, v1.33)
// Type-only additions: questionnaire packs are reference data, runs are local
// JSON files; no new entity envelopes or schema directories are introduced.
// --------------------------------------------------------------------------

export type QuestionnaireAnswerValue = "yes-with-link" | "yes" | "partial" | "no" | "unknown" | "na" | "skipped";

export type QuestionnaireDomainFamily = "GOV" | "RISK" | "INFO" | "TECH" | "PER" | "PHYS";

export type QuestionnairePublicationPolicy = "internal" | "restricted" | "public";

export interface QuestionnaireEvidenceTemplate {
  readonly title: string;
  readonly type: string;
  readonly defaultReviewCycleDays: number;
  readonly promptFor: "url" | "note" | "url-or-note";
}

export interface QuestionnaireActionTemplate {
  readonly title: string;
  readonly priority: "low" | "medium" | "high" | "critical";
  readonly dueOffsetDays: number;
}

export interface QuestionnaireRiskTemplate {
  readonly applyOnAnswers: ReadonlyArray<QuestionnaireAnswerValue>;
  readonly title: string;
  readonly likelihood: "rare" | "unlikely" | "possible" | "likely" | "almost-certain";
  readonly consequence: "insignificant" | "minor" | "moderate" | "major" | "severe";
}

export interface QuestionnaireQuestion {
  readonly id: string;
  readonly domain: QuestionnaireDomainFamily;
  readonly requirementRefs: ReadonlyArray<string>;
  readonly prompt: string;
  readonly helpText: string;
  readonly evidenceTemplate: QuestionnaireEvidenceTemplate;
  readonly actionTemplates: Partial<Record<QuestionnaireAnswerValue, QuestionnaireActionTemplate>>;
  readonly riskTemplate?: QuestionnaireRiskTemplate;
  readonly publicationPolicy: QuestionnairePublicationPolicy;
}

export interface QuestionnairePack {
  readonly packId: string;
  readonly packVersion: string;
  readonly title: string;
  readonly description: string;
  readonly scope: "starter" | "domain-deep-dive";
  readonly domain?: QuestionnaireDomainFamily;
  readonly questions: ReadonlyArray<QuestionnaireQuestion>;
}

export interface QuestionnaireAnswerRecord {
  readonly questionId: string;
  readonly value: QuestionnaireAnswerValue;
  readonly evidenceUrl?: string;
  readonly note?: string;
  readonly naRationale?: string;
  readonly answeredAt: string;
}

export type QuestionnaireRunMode =
  | "first-run"
  | "update-stale-or-changed"
  | "update-all-questions"
  | "answer-all-again";

export interface QuestionnaireRunRecord {
  readonly runId: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly mode: QuestionnaireRunMode;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly previousRunId?: string;
  readonly answers: ReadonlyArray<QuestionnaireAnswerRecord>;
  readonly publicationPolicy: QuestionnairePublicationPolicy;
}

export const QUESTIONNAIRE_RUN_DIRECTORY = ".pspf/questionnaire/runs" as const;
