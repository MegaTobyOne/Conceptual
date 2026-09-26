import assert from "node:assert/strict";
import test from "node:test";

import { enrichActionsWithImpact, withEnvelope, type RiskEntity } from "./index.js";

function sampleRisk(overrides: Partial<RiskEntity> = {}): RiskEntity {
  return withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Sample risk",
      status: "open",
      likelihood: 1,
      impact: 1,
      ...overrides
    },
    "workshop"
  );
}

test("enrichActionsWithImpact: canonical and legacy risk links count each risk once", () => {
  const action = withEnvelope("action", { entityType: "action", title: "Treat risks", status: "todo" }, "workshop");
  const highRisk = sampleRisk({ likelihood: 4, impact: 4 });
  const mediumRisk = sampleRisk({ likelihood: 3, impact: 3 });
  const unassessedRisk = sampleRisk({ assessment: { basis: "unassessed" } });
  const riskLink = (riskId: string, linkType: "addressed-by" | "treated-by") =>
    withEnvelope(
      "link",
      {
        entityType: "link",
        linkType,
        fromId: riskId,
        fromType: "risk",
        toId: action.id,
        toType: "action"
      },
      "workshop"
    );

  const [enrichedAction] = enrichActionsWithImpact([
    action,
    highRisk,
    mediumRisk,
    unassessedRisk,
    riskLink(highRisk.id, "treated-by"),
    riskLink(highRisk.id, "treated-by"),
    riskLink(highRisk.id, "addressed-by"),
    riskLink(mediumRisk.id, "treated-by"),
    riskLink(unassessedRisk.id, "treated-by")
  ]);

  assert.equal(enrichedAction?.entityType, "action");
  if (enrichedAction?.entityType !== "action") return;
  assert.equal(enrichedAction.impact?.riskReduction, 5);
  assert.deepEqual(enrichedAction.impact?.explanation, [
    "Treats open risk (severity 16)",
    "Treats open risk (severity 9)",
    "1 linked risk(s) excluded from risk-reduction weighting because no comparable assessment is recorded"
  ]);
});
