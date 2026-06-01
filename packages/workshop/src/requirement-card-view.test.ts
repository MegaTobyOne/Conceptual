import test from "node:test";
import assert from "node:assert/strict";
import {
  PSPF_DOMAINS,
  VERSION_AXES,
  type AssessmentStatus,
  type EvidenceEntity,
  type LinkEntity,
  type RequirementEntity,
  type RiskEntity,
  type ActionEntity,
  type V01Entity,
  type V01EntityType
} from "@pspf/contracts";
import {
  buildRequirementCardViewModel,
  requirementCardRag,
  requirementCardStatusLabel
} from "./requirement-card-view.js";

const governanceDomainId = PSPF_DOMAINS.find((domain) => domain.code === "governance")!.id;
const personnelDomainId = PSPF_DOMAINS.find((domain) => domain.code === "personnel")!.id;

test("RAG mapping follows the traffic-light bands", () => {
  assert.equal(requirementCardRag("met"), "green");
  assert.equal(requirementCardRag("partially-met"), "amber");
  assert.equal(requirementCardRag("in-progress"), "amber");
  assert.equal(requirementCardRag("under-review"), "amber");
  assert.equal(requirementCardRag("not-met"), "red");
  assert.equal(requirementCardRag("not-started"), "red");
  assert.equal(requirementCardRag("not-applicable"), "grey");
  assert.equal(requirementCardStatusLabel("partially-met"), "Partially met");
});

test("card view groups requirements by domain and counts linked records", () => {
  const reqGovernance = requirement("REQ-GOV", "Maintain governance committee", governanceDomainId, "met");
  const reqPersonnel = requirement("REQ-PER", "Review privileged access", personnelDomainId, "partially-met");
  const currentEvidence = evidence("EVD-1", "Committee minutes", "current");
  const staleEvidence = evidence("EVD-2", "Access review", "stale");
  const followUp = action("ACT-1", "Tighten dormant accounts", "in-progress");
  const exposure = riskEntity("RSK-1", "Privileged misuse");

  const entities: V01Entity[] = [
    reqGovernance,
    reqPersonnel,
    currentEvidence,
    staleEvidence,
    followUp,
    exposure,
    link("L1", "supported-by", reqGovernance.id, "requirement", currentEvidence.id, "evidence"),
    link("L2", "supported-by", reqPersonnel.id, "requirement", staleEvidence.id, "evidence"),
    link("L3", "addressed-by", reqPersonnel.id, "requirement", followUp.id, "action"),
    link("L4", "exposed-by", reqPersonnel.id, "requirement", exposure.id, "risk")
  ];

  const model = buildRequirementCardViewModel(entities, PSPF_DOMAINS);

  assert.equal(model.totals.requirements, 2);
  assert.equal(model.totals.green, 1);
  assert.equal(model.totals.amber, 1);
  assert.equal(model.totals.evidenceGaps, 1);

  const governanceGroup = model.groups.find((group) => group.domainId === governanceDomainId)!;
  const personnelGroup = model.groups.find((group) => group.domainId === personnelDomainId)!;
  assert.equal(governanceGroup.cards.length, 1);
  assert.equal(governanceGroup.cards[0]?.rag, "green");
  assert.equal(governanceGroup.cards[0]?.evidenceCount, 1);

  const personnelCard = personnelGroup.cards[0]!;
  assert.equal(personnelCard.evidenceCount, 1);
  assert.equal(personnelCard.actionCount, 1);
  assert.equal(personnelCard.riskCount, 1);
  assert.equal(personnelCard.evidenceGapCount, 1);
  assert.equal(personnelCard.linkedCount, 3);
});

test("domains with no requirements are omitted and groups follow domain order", () => {
  const reqPersonnel = requirement("REQ-PER", "Review privileged access", personnelDomainId, "not-met");
  const reqGovernance = requirement("REQ-GOV", "Maintain governance committee", governanceDomainId, "met");
  const model = buildRequirementCardViewModel([reqPersonnel, reqGovernance], PSPF_DOMAINS);

  assert.equal(model.groups.length, 2);
  assert.equal(model.groups[0]?.domainId, governanceDomainId);
  assert.equal(model.groups[1]?.domainId, personnelDomainId);
  assert.equal(model.totals.unlinked, 2);
});

function envelope(id: string, entityType: V01EntityType, createdAt = "2026-05-01T00:00:00.000Z") {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt,
    updatedAt: createdAt,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
}

function requirement(
  id: string,
  title: string,
  domainId: string,
  assessmentStatus: AssessmentStatus
): RequirementEntity {
  return {
    ...envelope(id, "requirement"),
    entityType: "requirement",
    title,
    domainId,
    assessmentStatus,
    summary: "Internal note excluded from publication."
  };
}

function evidence(id: string, title: string, freshness: EvidenceEntity["freshness"]): EvidenceEntity {
  return {
    ...envelope(id, "evidence"),
    entityType: "evidence",
    title,
    evidenceType: "note",
    reference: "Internal note",
    freshness
  };
}

function action(id: string, title: string, status: ActionEntity["status"]): ActionEntity {
  return {
    ...envelope(id, "action"),
    entityType: "action",
    title,
    status
  };
}

function riskEntity(id: string, title: string): RiskEntity {
  return {
    ...envelope(id, "risk"),
    entityType: "risk",
    title,
    status: "monitored",
    likelihood: 3,
    impact: 4
  };
}

function link(
  id: string,
  linkType: LinkEntity["linkType"],
  fromId: string,
  fromType: V01EntityType,
  toId: string,
  toType: V01EntityType
): LinkEntity {
  return {
    ...envelope(id, "link"),
    entityType: "link",
    title: `${fromId} ${linkType} ${toId}`,
    linkType,
    fromId,
    fromType,
    toId,
    toType
  };
}
