import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_BY_ENTITY_TYPE,
  ID_PREFIX_BY_ENTITY_TYPE,
  type NarrativeEntity,
  PUBLICATION_FIELD_POLICIES,
  V0_1_COLLECTIONS,
  V0_1_ENTITY_TYPES,
  createEntityId,
  narrativeSlotFor,
  sanitiseEntityForPublication,
  validateNarrativeRules
} from "./index.js";

const STAMP = "2026-09-03T00:00:00.000Z";

function narrative(overrides: Partial<NarrativeEntity> = {}): NarrativeEntity {
  return {
    id: "NAR-00000000-0000-7000-8000-000000000001",
    entityType: "narrative",
    schemaVersion: "1.16.0",
    title: "Where we stand",
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop",
    recordStatus: "active",
    slot: "exec-brief.where-we-stand",
    body: "Governance evidence is current; two technology gaps remain open.",
    audience: "executive",
    ...overrides
  };
}

test("narrative is registered as an entity type, collection, and NAR id prefix", () => {
  assert.ok(V0_1_ENTITY_TYPES.includes("narrative"));
  assert.ok(V0_1_COLLECTIONS.includes("narratives"));
  assert.equal(COLLECTION_BY_ENTITY_TYPE.narrative, "narratives");
  assert.equal(ID_PREFIX_BY_ENTITY_TYPE.narrative, "NAR");
  assert.equal(
    createEntityId("narrative", "00000000-0000-7000-8000-000000000009"),
    "NAR-00000000-0000-7000-8000-000000000009"
  );
});

test("narrative publication policy keeps slot and marks body sensitive", () => {
  const policy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === "narrative");
  assert.ok(policy);
  const byField = new Map(policy.fields.map((field) => [field.field, field.publication]));
  assert.equal(byField.get("slot"), "public");
  assert.equal(byField.get("audience"), "public");
  assert.equal(byField.get("basedOnSnapshotId"), "public");
  assert.equal(byField.get("targetType"), "public");
  assert.equal(byField.get("targetId"), "public");
  assert.equal(byField.get("supersedesId"), "public");
  assert.equal(byField.get("body"), "sensitive");
});

test("sanitiseEntityForPublication strips the narrative body and keeps the slot", () => {
  const sanitised = sanitiseEntityForPublication(
    narrative({
      basedOnSnapshotId: "SNP-00000000-0000-7000-8000-000000000001",
      targetType: "risk",
      targetId: "RSK-00000000-0000-7000-8000-000000000001"
    })
  ) as Partial<NarrativeEntity>;
  assert.equal(sanitised.slot, "exec-brief.where-we-stand");
  assert.equal(sanitised.audience, "executive");
  assert.equal(sanitised.targetId, "RSK-00000000-0000-7000-8000-000000000001");
  assert.equal("body" in sanitised, false);
});

test("sanitiseEntityForPublication fails closed on an undeclared narrative field", () => {
  assert.throws(() =>
    sanitiseEntityForPublication({ ...narrative(), authorName: "Jane" } as unknown as NarrativeEntity)
  );
});

test("validateNarrativeRules: accepts a well-formed narrative", () => {
  assert.deepEqual(validateNarrativeRules([narrative()], []), []);
});

test("validateNarrativeRules: rejects empty slot and body", () => {
  const result = validateNarrativeRules([narrative({ slot: "  ", body: "" })], []);
  assert.deepEqual(
    result.map((violation) => violation.rule),
    ["body-empty", "slot-empty"]
  );
});

test("validateNarrativeRules: supersedesId must name an existing narrative", () => {
  const result = validateNarrativeRules([narrative({ supersedesId: "NAR-00000000-0000-7000-8000-000000000099" })], []);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.rule, "supersedes-missing");
});

test("validateNarrativeRules: superseded narrative must share the slot", () => {
  const earlier = narrative({ id: "NAR-00000000-0000-7000-8000-000000000001", slot: "exec-brief.what-changed" });
  const later = narrative({
    id: "NAR-00000000-0000-7000-8000-000000000002",
    slot: "exec-brief.where-we-stand",
    supersedesId: earlier.id
  });
  const result = validateNarrativeRules([later], [earlier]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.rule, "supersedes-slot-mismatch");
});

test("validateNarrativeRules: accepts a same-slot supersession chain across incoming and existing", () => {
  const earlier = narrative({ id: "NAR-00000000-0000-7000-8000-000000000001" });
  const later = narrative({ id: "NAR-00000000-0000-7000-8000-000000000002", supersedesId: earlier.id });
  assert.deepEqual(validateNarrativeRules([later], [earlier]), []);
  assert.deepEqual(validateNarrativeRules([earlier, later], []), []);
});

test("validateNarrativeRules: a narrative cannot supersede itself", () => {
  const result = validateNarrativeRules([narrative({ supersedesId: "NAR-00000000-0000-7000-8000-000000000001" })], []);
  assert.deepEqual(
    result.map((violation) => violation.rule),
    ["supersedes-self"]
  );
});

test("validateNarrativeRules: skips deleted incoming records and non-narratives", () => {
  const deleted = narrative({ body: "", recordStatus: "deleted" });
  assert.deepEqual(validateNarrativeRules([deleted], []), []);
});

test("validateNarrativeRules: violations are ordered by narrative id then rule and are deterministic", () => {
  const incoming = [
    narrative({ id: "NAR-00000000-0000-7000-8000-000000000002", body: "" }),
    narrative({ id: "NAR-00000000-0000-7000-8000-000000000001", slot: "" })
  ];
  const first = validateNarrativeRules(incoming, []);
  const second = validateNarrativeRules(incoming, []);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((violation) => violation.narrativeId),
    ["NAR-00000000-0000-7000-8000-000000000001", "NAR-00000000-0000-7000-8000-000000000002"]
  );
});

test("narrativeSlotFor: executive-brief slots stand alone", () => {
  assert.equal(narrativeSlotFor("exec-brief.where-we-stand"), "exec-brief.where-we-stand");
  assert.equal(narrativeSlotFor("exec-brief.what-changed", "ignored"), "exec-brief.what-changed");
});

test("narrativeSlotFor: entity-scoped slots interpose the id", () => {
  assert.equal(
    narrativeSlotFor("risk.exec-note", "RSK-00000000-0000-7000-8000-000000000001"),
    "risk.RSK-00000000-0000-7000-8000-000000000001.exec-note"
  );
  assert.equal(narrativeSlotFor("domain.exec-note", "governance"), "domain.governance.exec-note");
  assert.equal(narrativeSlotFor("team.report-card-note", " Cyber Assurance "), "team.Cyber Assurance.report-card-note");
});

test("narrativeSlotFor: entity-scoped slots require an id", () => {
  assert.throws(() => narrativeSlotFor("risk.exec-note"), /requires an entity id/);
  assert.throws(() => narrativeSlotFor("action.exec-note", "   "), /requires an entity id/);
});
