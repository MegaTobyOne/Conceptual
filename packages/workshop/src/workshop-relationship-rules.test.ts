import assert from "node:assert/strict";
import test from "node:test";
import {
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
