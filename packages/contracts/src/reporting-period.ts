// Slice R4 (ADR 0097, v1.74.0): close-of-period helper that pins active narratives to a snapshot.
// Pure and deterministic: `now` is injected and inputs are never mutated.
import type { NarrativeEntity } from "./index.js";

/**
 * Returns updated copies of every active narrative, stamped with `snapshotId` and `updatedAt = now`.
 * Closing a period re-pins all current narratives so the pack can be reproduced at that snapshot;
 * narratives already pinned to this snapshot, or deleted, are omitted so the caller writes only what moved.
 * Input order is preserved.
 */
export function stampNarrativesWithSnapshot(
  narratives: readonly NarrativeEntity[],
  snapshotId: string,
  now: string
): readonly NarrativeEntity[] {
  const trimmedSnapshotId = snapshotId.trim();
  if (trimmedSnapshotId.length === 0) {
    throw new Error("stampNarrativesWithSnapshot requires a snapshot id.");
  }
  return narratives
    .filter((item) => item.recordStatus === "active" && item.basedOnSnapshotId !== trimmedSnapshotId)
    .map((item) => ({ ...item, basedOnSnapshotId: trimmedSnapshotId, updatedAt: now }));
}
