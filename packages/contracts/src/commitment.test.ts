import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLICATION_FIELD_POLICIES,
  VERSION_AXES,
  operatorLinkRuleFor,
  sanitiseEntityForPublication,
  withEnvelope,
  type CommitmentEntity,
  type GovernanceDecisionEntity
} from "./index.js";

const baseline = {
  revision: "baseline-1",
  outcome: "The service is resilient",
  scope: "Core service",
  accountableOwnerRef: "team:security",
  target: { kind: "date" as const, dueDate: "2026-12-01", timeZone: "Australia/Sydney" },
  acceptanceCriteria: ["Recovery exercise is complete"],
  approvalDecisionId: "GDE-00000000-0000-7000-8000-000000000001",
  effectiveAt: "2026-09-20T00:00:00.000Z",
  recordedAt: "2026-09-20T00:00:00.000Z"
};

function commitment(state: CommitmentEntity["commitmentState"]): CommitmentEntity {
  return withEnvelope(
    "commitment",
    {
      entityType: "commitment",
      title: "Service resilience",
      intendedOutcome: "The service is resilient",
      scope: "Core service",
      accountableOwnerRef: "team:security",
      commitmentState: state,
      baselineRevisions: [baseline],
      currentBaselineRevision: baseline.revision
    },
    "workshop"
  );
}

test("commitment contract keeps baseline revisions append-only by value", () => {
  const original = commitment("agreed");
  const revised: CommitmentEntity = {
    ...original,
    commitmentState: "agreed",
    baselineRevisions: [
      ...original.baselineRevisions,
      { ...baseline, revision: "baseline-2", supersedesRevision: "baseline-1" }
    ],
    currentBaselineRevision: "baseline-2"
  };

  assert.deepEqual(revised.baselineRevisions[0], original.baselineRevisions[0]);
  assert.equal(revised.baselineRevisions[1]?.supersedesRevision, "baseline-1");
  assert.equal(original.baselineRevisions.length, 1);
});

test("commitment and governance decision fields are sensitive at publication", () => {
  const decision: GovernanceDecisionEntity = withEnvelope(
    "governance-decision",
    {
      entityType: "governance-decision",
      title: "Approve resilience baseline",
      kind: "approve",
      targetType: "commitment",
      targetId: "CMT-00000000-0000-7000-8000-000000000001",
      targetRevision: "baseline-1",
      decision: "approved",
      rationale: "Recorded during the management review.",
      authorityRoleRef: "role:security-lead",
      authorityBasis: "Delegated review authority",
      assurance: "operator-recorded",
      effectiveAt: "2026-09-20T00:00:00.000Z",
      recordedAt: "2026-09-20T00:00:00.000Z"
    },
    "workshop"
  );

  const publishedCommitment = sanitiseEntityForPublication(commitment("draft"));
  const publishedDecision = sanitiseEntityForPublication(decision);
  assert.equal(publishedCommitment.title, undefined);
  assert.equal((publishedCommitment as CommitmentEntity).baselineRevisions, undefined);
  assert.equal(publishedDecision.title, undefined);
  assert.equal((publishedDecision as GovernanceDecisionEntity).rationale, undefined);

  for (const entityType of ["commitment", "governance-decision"] as const) {
    const policy = PUBLICATION_FIELD_POLICIES.find((entry) => entry.entityType === entityType);
    assert.ok(policy);
    assert.ok(
      policy.fields
        .filter(
          ({ field }) =>
            ![
              "id",
              "entityType",
              "schemaVersion",
              "createdAt",
              "updatedAt",
              "sourceProduct",
              "recordStatus",
              "lifecycleStatus",
              "decisionDate"
            ].includes(field)
        )
        .every(({ publication }) => publication === "sensitive")
    );
  }
});

test("governance decisions use the single Phase 2 commitment link", () => {
  assert.deepEqual(operatorLinkRuleFor("governance-decision", "changes", "commitment"), {
    id: "workshop-governance-decision-changes-commitment",
    sourceProduct: "workshop",
    linkType: "changes",
    fromType: "governance-decision",
    toType: "commitment",
    label: "Link Governance Decision to Commitment",
    phrase: "changes"
  });
  assert.equal(VERSION_AXES.schemaVersion, "1.17.0");
});
