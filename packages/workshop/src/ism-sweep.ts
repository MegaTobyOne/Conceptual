import type { RequirementControlMappingEntity, RequirementEntity, SourceControlEntity } from "@pspf/contracts";
import { withEnvelope } from "@pspf/contracts";

export interface RankerMappingPair {
  readonly requirement: Pick<RequirementEntity, "id" | "title">;
  readonly sourceControl: SourceControlEntity;
  /** Token-match score from the deterministic ranker. */
  readonly score: number;
  /** 1-based position among the ranker's top candidates for this requirement. */
  readonly rank: number;
}

export const RANKER_DRAFT_REVIEW_BY = "Deterministic ranker draft";
export const RANKER_DRAFT_CANDIDATE_LIMIT = 3;
export const RANKER_MEDIUM_CONFIDENCE_SCORE = 3;

/**
 * R4 (v1.74.0, ADR 0097): turn accepted ranker pairs into draft mappings with the same literal shape
 * as the AI-assisted path, except `lastReviewedAt` is deliberately omitted so the reporting pack's
 * `mapping-draft-unreviewed` readiness item surfaces them. Duplicate requirement × control pairs
 * collapse to the first occurrence.
 */
export function buildRankerMappingDrafts(
  pairs: readonly RankerMappingPair[],
  now: string
): RequirementControlMappingEntity[] {
  const seen = new Set<string>();
  const drafts: RequirementControlMappingEntity[] = [];
  for (const pair of pairs) {
    const key = `${pair.requirement.id}|${pair.sourceControl.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    drafts.push({
      ...withEnvelope(
        "requirement-control-mapping",
        {
          entityType: "requirement-control-mapping",
          title: `${pair.requirement.title} mapped to ${pair.sourceControl.controlId}`,
          requirementId: pair.requirement.id,
          sourceControlId: pair.sourceControl.id,
          coverageQualifier: "partial",
          applicabilityProfile: "all",
          confidence: pair.score >= RANKER_MEDIUM_CONFIDENCE_SCORE ? "medium" : "low",
          reviewBy: RANKER_DRAFT_REVIEW_BY,
          rationale: `Token-match rank ${pair.rank} of ${RANKER_DRAFT_CANDIDATE_LIMIT} for ${pair.requirement.title}; review before relying on it.`,
          provenance: {
            author: "workshop",
            createdAt: now,
            oscalRelease: pair.sourceControl.provenance.oscalRelease
          }
        },
        "workshop"
      ),
      createdAt: now,
      updatedAt: now
    });
  }
  return drafts;
}
