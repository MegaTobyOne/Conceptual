import assert from "node:assert/strict";
import test from "node:test";
import type { NarrativeEntity } from "./index.js";
import { stampNarrativesWithSnapshot } from "./index.js";

const NOW = "2026-09-01T00:00:00.000Z";
const STAMP = "2026-08-01T00:00:00.000Z";

test("re-pins every active narrative to the closing snapshot and omits deleted or already-pinned records", () => {
  const unpinned = narrative("NAR-1", "exec-brief.where-we-stand");
  const pinnedElsewhere = narrative("NAR-2", "exec-brief.what-changed", { basedOnSnapshotId: "SNAP-OLD" });
  const deleted = narrative("NAR-3", "exec-brief.top-exposures", { recordStatus: "deleted" });
  const alreadyPinned = narrative("NAR-4", "domain.DOM-1.exec-note", { basedOnSnapshotId: "SNAP-2026-09" });

  const result = stampNarrativesWithSnapshot([unpinned, pinnedElsewhere, deleted, alreadyPinned], "SNAP-2026-09", NOW);

  assert.deepEqual(result, [
    { ...unpinned, basedOnSnapshotId: "SNAP-2026-09", updatedAt: NOW },
    { ...pinnedElsewhere, basedOnSnapshotId: "SNAP-2026-09", updatedAt: NOW }
  ]);
});

test("returns an empty list when nothing needs stamping", () => {
  const pinned = narrative("NAR-1", "exec-brief.where-we-stand", { basedOnSnapshotId: "SNAP-2" });
  assert.deepEqual(stampNarrativesWithSnapshot([pinned], "SNAP-2", NOW), []);
  assert.deepEqual(stampNarrativesWithSnapshot([], "SNAP-2", NOW), []);
});

test("blank snapshot id throws", () => {
  assert.throws(() => stampNarrativesWithSnapshot([narrative("NAR-1", "x")], "  ", NOW), /requires a snapshot id/);
});

test("same input twice is deep-equal and inputs are not mutated", () => {
  const source = [narrative("NAR-1", "exec-brief.where-we-stand"), narrative("NAR-2", "exec-brief.what-changed")];
  const snapshot = JSON.parse(JSON.stringify(source));

  assert.deepEqual(
    stampNarrativesWithSnapshot(source, "SNAP-1", NOW),
    stampNarrativesWithSnapshot(source, "SNAP-1", NOW)
  );
  assert.deepEqual(JSON.parse(JSON.stringify(source)), snapshot);
  assert.equal(source[0]!.basedOnSnapshotId, undefined);
  assert.equal(source[0]!.updatedAt, STAMP);
});

function narrative(id: string, slot: string, extra: Partial<NarrativeEntity> = {}): NarrativeEntity {
  return {
    id,
    entityType: "narrative",
    schemaVersion: "1.16.0",
    title: slot,
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop",
    recordStatus: "active",
    slot,
    body: `Body for ${slot}.`,
    audience: "executive",
    ...extra
  };
}
