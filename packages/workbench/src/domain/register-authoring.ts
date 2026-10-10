import {
  VERSION_AXES,
  createEntityId,
  type ActionEntity,
  type DirectionEntity,
  type EvidenceEntity,
  type NarrativeEntity,
  type RequirementControlMappingEntity,
  type RequirementEntity,
  type RiskEntity
} from "@pspf/contracts";
import type { RegisterEntity } from "./types.ts";

export const REGISTER_AUTHORING_TYPES = [
  "requirement",
  "evidence",
  "action",
  "risk",
  "direction",
  "narrative",
  "requirement-control-mapping"
] as const;

export type RegisterAuthoringType = (typeof REGISTER_AUTHORING_TYPES)[number];

export interface RegisterDraftContext {
  domainId?: string;
  requirementId?: string;
  sourceControlId?: string;
  oscalRelease?: string;
}

export function createRegisterDraft(type: RegisterAuthoringType, context: RegisterDraftContext = {}): RegisterEntity {
  const now = new Date().toISOString();
  const envelope = {
    id: createEntityId(type),
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: now,
    updatedAt: now,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };

  switch (type) {
    case "requirement":
      return {
        ...envelope,
        entityType: type,
        title: "",
        domainId: context.domainId ?? "",
        assessmentStatus: "not-started"
      } satisfies RequirementEntity;
    case "evidence":
      return {
        ...envelope,
        entityType: type,
        title: "",
        evidenceType: "note",
        reference: "",
        freshness: "unknown"
      } satisfies EvidenceEntity;
    case "action":
      return { ...envelope, entityType: type, title: "", status: "todo" } satisfies ActionEntity;
    case "risk":
      return {
        ...envelope,
        entityType: type,
        title: "",
        status: "open",
        likelihood: 3,
        impact: 3
      } satisfies RiskEntity;
    case "direction":
      return {
        ...envelope,
        entityType: type,
        title: "",
        reference: "",
        responseState: "not-set"
      } satisfies DirectionEntity;
    case "narrative":
      return {
        ...envelope,
        entityType: type,
        slot: "exec-brief.where-we-stand",
        body: "",
        audience: "internal"
      } satisfies NarrativeEntity;
    case "requirement-control-mapping":
      return {
        ...envelope,
        entityType: type,
        requirementId: context.requirementId ?? "",
        sourceControlId: context.sourceControlId ?? "",
        coverageQualifier: "primary",
        applicabilityProfile: "",
        confidence: "medium",
        provenance: {
          author: "Workbench operator",
          createdAt: now,
          oscalRelease: context.oscalRelease ?? ""
        }
      } satisfies RequirementControlMappingEntity;
  }
}
