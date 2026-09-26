import assert from "node:assert/strict";
import test from "node:test";

import {
  LIMITATION_IDS,
  RISK_VIEWS,
  TOUCHED_SURFACES,
  WALKTHROUGH_STEPS,
  validateRiskVerificationEvidence
} from "./check-risk-verification.mjs";

const productVersion = "1.76.0";

function completeEvidence() {
  return {
    productVersion,
    walkthrough: {
      status: "complete",
      recordedAt: "2026-09-26T00:00:00.000Z",
      touchedSurfaces: [...TOUCHED_SURFACES],
      steps: WALKTHROUGH_STEPS.map((id) => ({ id, status: "pass", result: "Completed with recorded result." }))
    },
    redaction: { status: "pass", recordedAt: "2026-09-26T00:00:00.000Z", gates: ["check:personal-data"] },
    compatibility: {
      status: "pass",
      recordedAt: "2026-09-26T00:00:00.000Z",
      gates: ["check:schema-coverage", "check:schema-policy"]
    },
    recovery: { status: "pass", recordedAt: "2026-09-26T00:00:00.000Z", gates: ["backup-restore-dry-run"] },
    treatmentLinkRegression: { status: "pass", tests: ["contracts/action-impact", "workshop/plan-of-action-board"] },
    limitations: LIMITATION_IDS.map((id) => ({
      id,
      disposition: "re-deferred",
      reason: "Explicitly deferred with a bounded follow-up."
    }))
  };
}

function browserReport() {
  const axe = [
    ...["empty", "volume"].flatMap((fixture) =>
      RISK_VIEWS.map((view) => ({ fixture, view, theme: "dark", seriousOrCritical: 0 }))
    ),
    ...RISK_VIEWS.flatMap((view) =>
      ["dark", "light", "high-contrast"].map((theme) => ({ fixture: "typical", view, theme, seriousOrCritical: 0 }))
    )
  ];
  const layout = RISK_VIEWS.flatMap((view) =>
    ["dark", "light", "high-contrast"].flatMap((theme) =>
      ["320px", "768px", "1440px", "1440px@200%"].map((layoutName) => ({
        view,
        theme,
        layout: layoutName,
        overflow: 0,
        hiddenFocusable: 0
      }))
    )
  );
  const screenshots = layout.map((item) => `${item.view}-${item.theme}-${item.layout}.png`);
  return {
    generatedAt: "2026-09-26T00:00:00.000Z",
    productVersion,
    views: [...RISK_VIEWS],
    axe,
    layout,
    screenshots,
    performance: [
      { view: "register", riskCount: 504, medianMs: 20, budgetMs: 250 },
      { view: "matrix", riskCount: 504, medianMs: 20, budgetMs: 150 }
    ]
  };
}

test("risk verification accepts complete current evidence", () => {
  const result = validateRiskVerificationEvidence(completeEvidence(), browserReport(), productVersion, () => true);
  assert.deepEqual(result, { productVersion, viewCount: 9, screenshotCount: 108 });
});

test("risk verification rejects stale evidence", () => {
  const report = browserReport();
  report.productVersion = "1.75.0";
  assert.throws(
    () => validateRiskVerificationEvidence(completeEvidence(), report, productVersion, () => true),
    /report product version is stale/
  );
});

test("risk verification rejects an incomplete live walkthrough", () => {
  const evidence = completeEvidence();
  evidence.walkthrough.status = "pending";
  assert.throws(
    () => validateRiskVerificationEvidence(evidence, browserReport(), productVersion, () => true),
    /walkthrough is not complete/
  );
});

test("risk verification rejects missing screenshot files", () => {
  assert.throws(
    () => validateRiskVerificationEvidence(completeEvidence(), browserReport(), productVersion, () => false),
    /missing one or more images/
  );
});

test("risk verification rejects missing touched surfaces", () => {
  const evidence = completeEvidence();
  evidence.walkthrough.touchedSurfaces.pop();
  assert.throws(
    () => validateRiskVerificationEvidence(evidence, browserReport(), productVersion, () => true),
    /Walkthrough surface coverage/
  );
});
