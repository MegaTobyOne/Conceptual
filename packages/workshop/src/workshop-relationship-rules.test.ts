import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceEntity, LinkEntity, RequirementEntity } from "@pspf/contracts";
import {
  buildRelationshipConsequence,
  existingItemOperatorRule,
  linkPhraseForExistingItem,
  linkTypeForExistingItem,
  requirementRelationshipItemTypes
} from "./relationship-rules.js";

test("Workshop existing-item links resolve through canonical operator rules", () => {
  assert.deepEqual([...requirementRelationshipItemTypes], ["evidence", "action", "risk", "direction"]);

  assert.deepEqual(
    requirementRelationshipItemTypes.map((itemType) => existingItemOperatorRule(itemType).id),
    [
      "workshop-requirement-supported-by-evidence",
      "workshop-requirement-addressed-by-action",
      "workshop-requirement-exposed-by-risk",
      "workshop-direction-targets-requirement"
    ]
  );
  assert.deepEqual(
    requirementRelationshipItemTypes.map((itemType) => linkTypeForExistingItem(itemType)),
    ["supported-by", "addressed-by", "exposed-by", "targets"]
  );
  assert.deepEqual(
    requirementRelationshipItemTypes.map((itemType) => linkPhraseForExistingItem(itemType)),
    ["supported by", "addressed by", "exposed by", "targets"]
  );
});

test("Workshop relationship consequences explain immediate evidence payoff", () => {
  const requirement = requirementRecord("REQ-1", "DOM-GOV", "Governance arrangements are established");
  const otherRequirement = requirementRecord("REQ-2", "DOM-TECH", "Authentication is controlled");
  const evidence: EvidenceEntity = {
    id: "EVD-1",
    entityType: "evidence",
    title: "Approved authentication policy",
    evidenceType: "document",
    reference: "policy://auth",
    freshness: "current"
  } as EvidenceEntity;
  const existingLink = linkRecord("LNK-OLD", otherRequirement.id, evidence.id);
  const newLink = linkRecord("LNK-NEW", requirement.id, evidence.id);

  const consequence = buildRelationshipConsequence({
    requirement,
    itemType: "evidence",
    linkedItems: [evidence],
    allEntities: [requirement, otherRequirement, evidence, existingLink],
    newLinks: [newLink]
  });

  assert.equal(consequence.title, "Linked 1 Evidence");
  assert.equal(consequence.linksAdded, 1);
  assert.equal(consequence.affectedRequirementCount, 2);
  assert.equal(consequence.affectedDomainCount, 2);
  assert.equal(consequence.evidenceCoverageClosed, 1);
  assert.match(consequence.summary, /Evidence coverage improved for 1 Requirement/);
  assert.deepEqual(consequence.connectedViewFocusIds, ["REQ-1", "EVD-1"]);
});

function requirementRecord(id: string, domainId: string, title: string): RequirementEntity {
  return {
    id,
    entityType: "requirement",
    title,
    domainId,
    assessmentStatus: "in-progress"
  } as RequirementEntity;
}

function linkRecord(id: string, fromId: string, toId: string): LinkEntity {
  return {
    id,
    entityType: "link",
    title: `${fromId} supported by ${toId}`,
    linkType: "supported-by",
    fromId,
    fromType: "requirement",
    toId,
    toType: "evidence"
  } as LinkEntity;
}
