import type { DirectionEntity, LinkEntity, RequirementEntity, SourceControlEntity } from "@pspf/contracts";
export {
    ISM_OSCAL_RELEASE,
    ISM_SOURCE_CONTROLS,
    PSPF_BASELINE_DOMAINS,
    PSPF_BASELINE_DIRECTIONS,
    PSPF_BASELINE_DIRECTION_LINKS,
    PREVIOUS_ISM_SOURCE_CONTROLS,
    PSPF_BASELINE_REQUIREMENTS,
    PSPF_REFERENCE_DATA_REPORT,
    PSPF_REFERENCE_DOMAINS,
    PSPF_REQUIREMENT_REFERENCES,
    REFERENCE_DATA_SOURCES
} from "./generated/reference-data.js";

export type PspfDomainFamily = "GOV" | "RISK" | "INFO" | "TECH" | "PER" | "PHYS";

export interface ReferenceSourceDescriptor {
    readonly sourceId: string;
    readonly title: string;
    readonly sourceUrl: string;
    readonly localPath: string;
    readonly sha256: string;
    readonly publicationDate: string;
    readonly lastUpdated?: string;
    readonly licence: string;
    readonly attribution: string;
}

export interface PspfReferenceDomain {
    readonly family: PspfDomainFamily;
    readonly domainId: string;
    readonly title: string;
    readonly sortOrder: number;
}

export interface PspfRequirementReference {
    readonly requirementNumber: number;
    readonly requirementId: string;
    readonly statement: string;
    readonly domainFamily: PspfDomainFamily;
    readonly sectionCode: string;
    readonly sectionTitle: string;
    readonly applicability: string;
    readonly startDate: string;
    readonly releaseDecision: "Retain" | "Modify" | "Retire" | "New";
    readonly questionType: "Yes/No" | "Yes/No/NA" | "Performance";
    readonly mandatory: string;
    readonly scored: "Scored" | "Unscored";
    readonly sourceId: string;
    readonly sourceUrl: string;
    readonly sourceHash: string;
    readonly licence: string;
    readonly attribution: string;
}

export interface PspfReferenceDataReport {
    readonly generatedAt: string;
    readonly pspf: {
        readonly displayedRequirementCount: number;
        readonly minRequirementNumber: number;
        readonly maxRequirementNumber: number;
        readonly missingRequirementNumbers: readonly number[];
        readonly duplicateRequirementNumbers: readonly number[];
        readonly domainFamilies: readonly PspfDomainFamily[];
        readonly publishedDirectionCount: number;
        readonly directionsReflectedInRequirements: number;
    };
    readonly ism: {
        readonly oscalRelease: string;
        readonly sourceControlCount: number;
        readonly changedFixtureControlId: string;
    };
}

export type PspfBaselineRequirement = Omit<RequirementEntity, "createdAt" | "updatedAt">;
export type PspfBaselineDirection = Omit<DirectionEntity, "createdAt" | "updatedAt">;
export type PspfBaselineDirectionLink = Omit<LinkEntity, "createdAt" | "updatedAt">;
export type IsmReferenceSourceControl = Omit<SourceControlEntity, "createdAt" | "updatedAt">;