import assert from "node:assert/strict";
import test from "node:test";
import { blockerClassLabel, classifyBlocker, isExpiringWithinDays, rankBlockersByFanIn } from "./index.js";

test("rankBlockersByFanIn: ranks by gated requirement count descending", () => {
  const ranked = rankBlockersByFanIn([
    { id: "action-1", gatedRequirementIds: ["r1"] },
    { id: "action-2", gatedRequirementIds: ["r1", "r2", "r3"] },
    { id: "action-3", gatedRequirementIds: [] }
  ]);
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["action-2", "action-1"]
  );
  assert.equal(ranked[0]?.gatedRequirementCount, 3);
});

test("rankBlockersByFanIn: respects the limit", () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    id: `action-${index}`,
    gatedRequirementIds: [`r${index}`]
  }));
  assert.equal(rankBlockersByFanIn(candidates, 3).length, 3);
});

test("classifyBlocker: review-type is assessor regardless of commercial link", () => {
  assert.equal(classifyBlocker({ isReviewType: true, hasCommercialLink: true }), "assessor");
});

test("classifyBlocker: commercial link without review type is funding", () => {
  assert.equal(classifyBlocker({ isReviewType: false, hasCommercialLink: true }), "funding");
});

test("classifyBlocker: default is us", () => {
  assert.equal(classifyBlocker({ isReviewType: false, hasCommercialLink: false }), "us");
});

test("blockerClassLabel: maps every class to a stated label", () => {
  assert.equal(blockerClassLabel("us"), "Waiting on us");
  assert.equal(blockerClassLabel("funding"), "Waiting on funding");
  assert.equal(blockerClassLabel("assessor"), "Waiting on assessor");
  assert.equal(blockerClassLabel("supplier"), "Waiting on supplier");
});

test("isExpiringWithinDays: evidence expiring in 20 days is within a 90-day horizon", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  // Added 160 days ago; 180-day window means it expires in 20 days.
  const addedAt = new Date(reference.getTime() - 160 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isExpiringWithinDays(addedAt, reference), true);
});

test("isExpiringWithinDays: already-expired evidence is not 'expiring soon'", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  const addedAt = new Date(reference.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isExpiringWithinDays(addedAt, reference), false);
});

test("isExpiringWithinDays: freshly added evidence is not expiring soon", () => {
  const reference = new Date("2026-08-24T00:00:00.000Z");
  const addedAt = new Date(reference.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isExpiringWithinDays(addedAt, reference), false);
});

test("isExpiringWithinDays: unparsable timestamp is not expiring soon", () => {
  assert.equal(isExpiringWithinDays("not-a-date", new Date()), false);
});
