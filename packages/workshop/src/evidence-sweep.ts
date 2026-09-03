import type { EvidenceEntity, LinkEntity, RequirementEntity, V01Entity } from "@pspf/contracts";
import { withEnvelope } from "@pspf/contracts";

export type EvidenceSweepAction = "confirm-current" | "mark-stale" | "link-requirements";

export interface EvidenceSweepPlan {
  readonly upserts: V01Entity[];
  /** Requirement × evidence pairs skipped because a supported-by link already exists. */
  readonly skippedPairs: number;
}

export function isEvidenceSweepAction(value: unknown): value is EvidenceSweepAction {
  return value === "confirm-current" || value === "mark-stale" || value === "link-requirements";
}

/**
 * R4 (v1.74.0, ADR 0097): plan a bulk sweep over Evidence Review Queue selections. Pure — the caller
 * persists `upserts` through Core. Freshness sweeps rewrite every selected record (updatedAt acts as
 * the confirmation timestamp); link sweeps create one supported-by link per requirement × evidence
 * pair not already present in `existingLinks`.
 */
export function planEvidenceSweep(
  action: EvidenceSweepAction,
  evidence: readonly EvidenceEntity[],
  requirements: readonly Pick<RequirementEntity, "id" | "title">[],
  existingLinks: readonly LinkEntity[],
  now: string
): EvidenceSweepPlan {
  if (evidence.length === 0) {
    return { upserts: [], skippedPairs: 0 };
  }
  if (action === "confirm-current" || action === "mark-stale") {
    const freshness = action === "confirm-current" ? "current" : "stale";
    return {
      upserts: evidence.map((item) => ({ ...item, freshness, updatedAt: now })),
      skippedPairs: 0
    };
  }

  const existingPairs = new Set(
    existingLinks
      .filter(
        (link) =>
          link.recordStatus !== "deleted" &&
          link.linkType === "supported-by" &&
          link.fromType === "requirement" &&
          link.toType === "evidence"
      )
      .map((link) => `${link.fromId}|${link.toId}`)
  );
  const upserts: V01Entity[] = [];
  let skippedPairs = 0;
  for (const requirement of requirements) {
    for (const item of evidence) {
      const key = `${requirement.id}|${item.id}`;
      if (existingPairs.has(key)) {
        skippedPairs += 1;
        continue;
      }
      existingPairs.add(key);
      upserts.push({
        ...withEnvelope(
          "link",
          {
            entityType: "link",
            title: `${requirement.title} supported by ${item.title}`,
            linkType: "supported-by",
            fromId: requirement.id,
            fromType: "requirement",
            toId: item.id,
            toType: "evidence"
          },
          "workshop"
        ),
        createdAt: now,
        updatedAt: now
      });
    }
  }
  return { upserts, skippedPairs };
}
