export const VERSION_AXES = {
  schemaVersion: "1.3.0",
  bundleVersion: "1.3.0",
  apiVersion: "1.3.0"
} as const;

export const PSPF_SLICE_VERSION = "0.7.0" as const;

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
  "source-control",
  "requirement-control-mapping",
  "direction",
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
  "source-controls",
  "requirement-control-mappings",
  "directions",
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
  "includes"
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export type PublicationPolicy = "public" | "internal" | "sensitive" | "restricted";

export type SourceProduct = "core" | "workshop" | "explorer";

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
  readonly code: "governance" | "information" | "personnel" | "physical";
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

export interface TagEntity extends EntityEnvelope {
  readonly entityType: "tag";
  readonly title: string;
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

export type V01Entity =
  | DomainEntity
  | RequirementEntity
  | EvidenceEntity
  | ActionEntity
  | RiskEntity
  | LinkEntity
  | SnapshotEntity
  | TagEntity
  | SourceControlEntity
  | RequirementControlMappingEntity
  | DirectionEntity
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
  "source-controls": SourceControlEntity;
  "requirement-control-mappings": RequirementControlMappingEntity;
  directions: DirectionEntity;
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
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus")
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
    entityType: "posture",
    fields: publicFields("id", "entityType", "schemaVersion", "title", "createdAt", "updatedAt", "sourceProduct", "recordStatus", "requirementCount", "evidenceCount", "actionCount", "riskCount", "sourceControlCount", "requirementControlMappingCount", "directionCount")
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
    title: "Information",
    code: "information",
    sortOrder: 2,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000003",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Personnel",
    code: "personnel",
    sortOrder: 3,
    sourceProduct: "core",
    recordStatus: "active"
  },
  {
    id: "DOM-00000000-0000-7000-8000-000000000004",
    entityType: "domain",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: "Physical",
    code: "physical",
    sortOrder: 4,
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
  "source-control": "source-controls",
  "requirement-control-mapping": "requirement-control-mappings",
  direction: "directions",
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
  "source-control": "SRC",
  "requirement-control-mapping": "MAP",
  direction: "DIR",
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