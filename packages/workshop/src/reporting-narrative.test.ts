import test from "node:test";
import assert from "node:assert/strict";
import type { NarrativeEntity } from "@pspf/contracts";
import {
  buildNarrativeDraft,
  collectRetireChain,
  narrativeTitleForSlot,
  resolveRestoreTarget
} from "./reporting-narrative.js";

function narrative(overrides: Partial<NarrativeEntity> & { readonly id: string }): NarrativeEntity {
  return {
    entityType: "narrative",
    schemaVersion: "1.16.0",
    title: "Narrative",
    slot: "exec-brief.where-we-stand",
    body: "Body text.",
    audience: "executive",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    sourceProduct: "workshop",
    recordStatus: "active",
    ...overrides
  };
}

test("narrative titles come from the heading, then the slot, and stay within 120 characters", () => {
  assert.equal(narrativeTitleForSlot("exec-brief.top-exposures"), "Narrative: Top exposures");
  assert.equal(narrativeTitleForSlot("domain.DOM-INFO.exec-note"), "Narrative: Domain DOM-INFO");
  assert.equal(
    narrativeTitleForSlot("domain.DOM-INFO.exec-note", "Information security"),
    "Narrative: Information security"
  );
  assert.equal(narrativeTitleForSlot("team.report-card-note"), "Narrative: team.report-card-note");
  const long = narrativeTitleForSlot("exec-brief.what-changed", "x".repeat(200));
  assert.equal(long.length, 120);
  assert.ok(long.endsWith("…"));
});

test("buildNarrativeDraft trims, validates, and maps form fields to an executive narrative draft", () => {
  const result = buildNarrativeDraft(
    {
      slot: " domain.DOM-INFO.exec-note ",
      heading: "Information security",
      body: "  We closed the two overdue actions.\n\nOne gap remains.  ",
      targetType: "domain",
      targetId: "DOM-INFO",
      supersedesId: "NAR-1"
    },
    { basedOnSnapshotId: "SNP-9" }
  );
  assert.ok(result.ok);
  assert.equal(result.heading, "Information security");
  assert.deepEqual(result.draft, {
    entityType: "narrative",
    title: "Narrative: Information security",
    slot: "domain.DOM-INFO.exec-note",
    body: "We closed the two overdue actions.\n\nOne gap remains.",
    audience: "executive",
    basedOnSnapshotId: "SNP-9",
    targetType: "domain",
    targetId: "DOM-INFO",
    supersedesId: "NAR-1"
  });

  const bare = buildNarrativeDraft({ slot: "exec-brief.where-we-stand", body: "Steady." }, {});
  assert.ok(bare.ok);
  assert.equal(bare.heading, "Where we stand");
  assert.deepEqual(Object.keys(bare.draft).sort(), ["audience", "body", "entityType", "slot", "title"]);
});

test("buildNarrativeDraft rejects empty bodies and missing slots", () => {
  const noBody = buildNarrativeDraft({ slot: "exec-brief.where-we-stand", body: "   " }, {});
  assert.equal(noBody.ok, false);
  assert.match(noBody.ok ? "" : noBody.reason, /Write something/);
  const noSlot = buildNarrativeDraft({ body: "Text" }, {});
  assert.equal(noSlot.ok, false);
});

test("resolveRestoreTarget retires the current record when the superseded one is still active", () => {
  const previous = narrative({ id: "NAR-1" });
  const current = narrative({ id: "NAR-2", supersedesId: "NAR-1", updatedAt: "2026-09-02T00:00:00.000Z" });
  const target = resolveRestoreTarget(current, [previous, current]);
  assert.equal(target?.mode, "retire-current");
  assert.equal(target?.previous.id, "NAR-1");
});

test("resolveRestoreTarget recreates the previous body when the superseded record was retired", () => {
  const previous = narrative({ id: "NAR-1", recordStatus: "deleted", body: "Older wording." });
  const current = narrative({ id: "NAR-2", supersedesId: "NAR-1" });
  const target = resolveRestoreTarget(current, [previous, current]);
  assert.equal(target?.mode, "recreate");
  assert.equal(target?.previous.body, "Older wording.");
});

test("resolveRestoreTarget returns undefined without a valid predecessor in the same slot", () => {
  assert.equal(resolveRestoreTarget(narrative({ id: "NAR-1" }), []), undefined);
  const current = narrative({ id: "NAR-2", supersedesId: "NAR-1" });
  assert.equal(resolveRestoreTarget(current, [current]), undefined);
  const otherSlot = narrative({ id: "NAR-1", slot: "exec-brief.what-changed" });
  assert.equal(resolveRestoreTarget(current, [otherSlot, current]), undefined);
  assert.equal(resolveRestoreTarget(narrative({ id: "NAR-3", supersedesId: "NAR-3" }), []), undefined);
});

test("collectRetireChain returns the current record and every active record it supersedes", () => {
  const first = narrative({ id: "NAR-1" });
  const second = narrative({ id: "NAR-2", supersedesId: "NAR-1", recordStatus: "deleted" });
  const third = narrative({ id: "NAR-3", supersedesId: "NAR-2" });
  const fourth = narrative({ id: "NAR-4", supersedesId: "NAR-3" });
  const chain = collectRetireChain(fourth, [first, second, third, fourth]);
  assert.deepEqual(
    chain.map((item) => item.id),
    ["NAR-4", "NAR-3", "NAR-1"]
  );
});

test("collectRetireChain tolerates cycles and missing predecessors", () => {
  const a = narrative({ id: "NAR-A", supersedesId: "NAR-B" });
  const b = narrative({ id: "NAR-B", supersedesId: "NAR-A" });
  assert.deepEqual(
    collectRetireChain(a, [a, b]).map((item) => item.id),
    ["NAR-A", "NAR-B"]
  );
  assert.deepEqual(
    collectRetireChain(narrative({ id: "NAR-C", supersedesId: "NAR-Z" }), []).map((item) => item.id),
    ["NAR-C"]
  );
});
