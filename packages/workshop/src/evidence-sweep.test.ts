import assert from "node:assert/strict";
import test from "node:test";
import { PSPF_DOMAINS, withEnvelope } from "@pspf/contracts";
import type { EvidenceEntity, LinkEntity } from "@pspf/contracts";
import { isEvidenceSweepAction, planEvidenceSweep } from "./evidence-sweep.js";

const NOW = "2026-09-03T01:02:03.000Z";

function evidence(title: string, freshness: EvidenceEntity["freshness"]): EvidenceEntity {
  return withEnvelope(
    "evidence",
    { entityType: "evidence", title, evidenceType: "note", reference: `ref-${title}`, freshness },
    "workshop"
  );
}

function requirement(title: string) {
  return withEnvelope(
    "requirement",
    { entityType: "requirement", title, domainId: PSPF_DOMAINS[0]!.id, assessmentStatus: "not-met" },
    "workshop"
  );
}

test("confirm-current and mark-stale rewrite freshness on every selected record with updatedAt = now", () => {
  const items = [evidence("Policy", "stale"), evidence("Register", "current")];

  const confirmed = planEvidenceSweep("confirm-current", items, [], [], NOW);
  assert.equal(confirmed.upserts.length, 2);
  assert.equal(confirmed.skippedPairs, 0);
  for (const upsert of confirmed.upserts) {
    assert.equal(upsert.entityType, "evidence");
    assert.equal((upsert as EvidenceEntity).freshness, "current");
    assert.equal(upsert.updatedAt, NOW);
  }
  assert.equal(confirmed.upserts[0]!.id, items[0]!.id);
  assert.equal(confirmed.upserts[0]!.createdAt, items[0]!.createdAt);

  const stale = planEvidenceSweep("mark-stale", items, [], [], NOW);
  assert.deepEqual(
    stale.upserts.map((upsert) => (upsert as EvidenceEntity).freshness),
    ["stale", "stale"]
  );
});

test("link-requirements creates one supported-by link per pair and skips pairs that already exist", () => {
  const [policy, register] = [evidence("Policy", "current"), evidence("Register", "current")];
  const [reqA, reqB] = [requirement("Req A"), requirement("Req B")];
  const existing: LinkEntity = withEnvelope(
    "link",
    {
      entityType: "link",
      linkType: "supported-by",
      fromId: reqA.id,
      fromType: "requirement",
      toId: policy!.id,
      toType: "evidence"
    },
    "workshop"
  );
  const deletedDuplicate: LinkEntity = {
    ...withEnvelope(
      "link",
      {
        entityType: "link",
        linkType: "supported-by",
        fromId: reqB.id,
        fromType: "requirement",
        toId: register!.id,
        toType: "evidence"
      },
      "workshop"
    ),
    recordStatus: "deleted"
  };

  const plan = planEvidenceSweep(
    "link-requirements",
    [policy!, register!],
    [reqA, reqB],
    [existing, deletedDuplicate],
    NOW
  );

  assert.equal(plan.skippedPairs, 1);
  assert.equal(plan.upserts.length, 3);
  const pairs = plan.upserts.map((upsert) => {
    assert.equal(upsert.entityType, "link");
    const link = upsert as LinkEntity;
    assert.equal(link.linkType, "supported-by");
    assert.equal(link.fromType, "requirement");
    assert.equal(link.toType, "evidence");
    assert.equal(link.createdAt, NOW);
    assert.equal(link.updatedAt, NOW);
    return `${link.fromId}|${link.toId}`;
  });
  assert.deepEqual(
    pairs.sort(),
    [`${reqA.id}|${register!.id}`, `${reqB.id}|${policy!.id}`, `${reqB.id}|${register!.id}`].sort()
  );
  assert.equal(plan.upserts[0]!.title, "Req A supported by Register");
});

test("empty evidence selection is a no-op for every action", () => {
  const req = requirement("Req");
  for (const action of ["confirm-current", "mark-stale", "link-requirements"] as const) {
    assert.deepEqual(planEvidenceSweep(action, [], [req], [], NOW), { upserts: [], skippedPairs: 0 });
  }
  assert.deepEqual(planEvidenceSweep("link-requirements", [evidence("Lonely", "current")], [], [], NOW), {
    upserts: [],
    skippedPairs: 0
  });
});

test("isEvidenceSweepAction accepts only the three sweep actions", () => {
  assert.equal(isEvidenceSweepAction("confirm-current"), true);
  assert.equal(isEvidenceSweepAction("mark-stale"), true);
  assert.equal(isEvidenceSweepAction("link-requirements"), true);
  assert.equal(isEvidenceSweepAction("delete"), false);
  assert.equal(isEvidenceSweepAction(undefined), false);
});
