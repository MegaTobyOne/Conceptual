import assert from "node:assert/strict";
import test from "node:test";
import { PSPF_DOMAINS, withEnvelope } from "@pspf/contracts";
import type { SourceControlEntity } from "@pspf/contracts";
import { RANKER_DRAFT_REVIEW_BY, buildRankerMappingDrafts } from "./ism-sweep.js";

const NOW = "2026-09-03T04:05:06.000Z";

function sourceControl(controlId: string): SourceControlEntity {
  return withEnvelope(
    "source-control",
    {
      entityType: "source-control",
      title: `Control ${controlId}`,
      controlId,
      statement: "Statement",
      profileTags: ["official"],
      statementChangeStatus: "unchanged",
      externalRefs: [],
      provenance: {
        oscalRelease: "2026-06",
        catalog: "ism",
        profile: null,
        sourceUrl: "https://example.invalid/ism"
      }
    },
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

test("buildRankerMappingDrafts writes the AI-path literal shape with ranker provenance and no lastReviewedAt", () => {
  const req = requirement("Access control policy");
  const control = sourceControl("ISM-0001");
  const [draft] = buildRankerMappingDrafts([{ requirement: req, sourceControl: control, score: 4, rank: 1 }], NOW);

  assert.ok(draft);
  assert.equal(draft.entityType, "requirement-control-mapping");
  assert.equal(draft.title, "Access control policy mapped to ISM-0001");
  assert.equal(draft.requirementId, req.id);
  assert.equal(draft.sourceControlId, control.id);
  assert.equal(draft.coverageQualifier, "partial");
  assert.equal(draft.applicabilityProfile, "all");
  assert.equal(draft.reviewBy, RANKER_DRAFT_REVIEW_BY);
  assert.equal(draft.rationale, "Token-match rank 1 of 3 for Access control policy; review before relying on it.");
  assert.equal(draft.lastReviewedAt, undefined);
  assert.equal("lastReviewedAt" in draft, false);
  assert.deepEqual(draft.provenance, { author: "workshop", createdAt: NOW, oscalRelease: "2026-06" });
  assert.equal(draft.createdAt, NOW);
  assert.equal(draft.updatedAt, NOW);
  assert.equal(draft.sourceProduct, "workshop");
  assert.equal(draft.recordStatus, "active");
});

test("confidence is medium at score >= 3 and low below", () => {
  const req = requirement("Req");
  const drafts = buildRankerMappingDrafts(
    [
      { requirement: req, sourceControl: sourceControl("ISM-0002"), score: 3, rank: 1 },
      { requirement: req, sourceControl: sourceControl("ISM-0003"), score: 2, rank: 2 },
      { requirement: req, sourceControl: sourceControl("ISM-0004"), score: 7, rank: 3 }
    ],
    NOW
  );
  assert.deepEqual(
    drafts.map((draft) => draft.confidence),
    ["medium", "low", "medium"]
  );
  assert.equal(drafts[1]!.rationale, "Token-match rank 2 of 3 for Req; review before relying on it.");
});

test("duplicate requirement × control pairs collapse to the first occurrence", () => {
  const req = requirement("Req");
  const other = requirement("Other");
  const control = sourceControl("ISM-0005");
  const drafts = buildRankerMappingDrafts(
    [
      { requirement: req, sourceControl: control, score: 5, rank: 1 },
      { requirement: req, sourceControl: control, score: 1, rank: 3 },
      { requirement: other, sourceControl: control, score: 2, rank: 1 }
    ],
    NOW
  );
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]!.confidence, "medium");
  assert.equal(drafts[1]!.requirementId, other.id);
  assert.deepEqual(buildRankerMappingDrafts([], NOW), []);
});
