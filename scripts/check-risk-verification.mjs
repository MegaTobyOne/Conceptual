#!/usr/bin/env node
// C1: require current Risk verification evidence before claiming Phase 4B complete.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const RISK_VIEWS = [
  "register",
  "hierarchy",
  "matrix",
  "treatments",
  "bowtie",
  "coverage",
  "cards",
  "framework",
  "record"
];
export const WALKTHROUGH_STEPS = [
  "create-risk",
  "classify-risk",
  "assess-current-target-appetite",
  "reuse-action-across-two-risks",
  "add-control-and-evidence",
  "inspect-five-visuals",
  "record-escalation",
  "produce-risk-card",
  "trace-treatment-through-plan-and-reporting"
];
export const TOUCHED_SURFACES = [
  "risk-record",
  "risk-register",
  "risk-treatments",
  "risk-controls",
  "risk-crosswalk-import",
  "risk-hierarchy",
  "risk-matrix",
  "risk-bowtie",
  "risk-coverage",
  "risk-executive-cards",
  "risk-output",
  "plan-of-action",
  "strategy-reporting"
];
export const LIMITATION_IDS = ["styled-png", "preset-authoring", "filtered-output-scope", "external-provenance-output"];

const AXE_EXPECTATIONS = [
  ...["empty", "volume"].flatMap((fixture) => RISK_VIEWS.map((view) => `${fixture}/${view}/dark`)),
  ...RISK_VIEWS.flatMap((view) => ["dark", "light", "high-contrast"].map((theme) => `typical/${view}/${theme}`))
];
const LAYOUT_EXPECTATIONS = RISK_VIEWS.flatMap((view) =>
  ["dark", "light", "high-contrast"].flatMap((theme) =>
    ["320px", "768px", "1440px", "1440px@200%"].map((layout) => `${view}/${theme}/${layout}`)
  )
);

function assertExactValues(actual, expected, label) {
  assert.ok(Array.isArray(actual), `${label} must be an array`);
  assert.deepEqual([...new Set(actual)].sort(), [...expected].sort(), `${label} does not cover the required set`);
  assert.equal(actual.length, expected.length, `${label} contains duplicate entries`);
}

function assertPassingEvidence(section, label) {
  assert.equal(section?.status, "pass", `${label} evidence is not marked pass`);
  assert.ok(Array.isArray(section.gates) && section.gates.length > 0, `${label} evidence must name its gates`);
  assert.ok(
    section.gates.every((gate) => typeof gate === "string" && gate.trim()),
    `${label} has an empty gate reference`
  );
  assert.ok(
    typeof section.recordedAt === "string" && !Number.isNaN(Date.parse(section.recordedAt)),
    `${label} needs a valid recordedAt`
  );
}

export function validateRiskVerificationEvidence(evidence, report, productVersion, screenshotExists = existsSync) {
  assert.equal(evidence?.productVersion, productVersion, "Risk evidence pack product version is stale");
  assert.equal(report?.productVersion, productVersion, "Risk browser report product version is stale");
  assert.ok(
    typeof report.generatedAt === "string" && !Number.isNaN(Date.parse(report.generatedAt)),
    "Risk browser report needs a valid generatedAt"
  );
  assert.deepEqual(report.views, RISK_VIEWS, "Risk browser report has unexpected view coverage");

  assertExactValues(
    (report.axe ?? []).map((item) => `${item.fixture}/${item.view}/${item.theme}`),
    AXE_EXPECTATIONS,
    "Risk accessibility results"
  );
  assert.ok(
    report.axe.every((item) => item.seriousOrCritical === 0),
    "Risk accessibility report contains serious or critical findings"
  );

  assertExactValues(
    (report.layout ?? []).map((item) => `${item.view}/${item.theme}/${item.layout}`),
    LAYOUT_EXPECTATIONS,
    "Risk layout results"
  );
  assert.ok(
    report.layout.every((item) => item.overflow <= 1 && item.hiddenFocusable === 0),
    "Risk layout report contains overflow or zero-size controls"
  );

  assert.ok(Array.isArray(report.screenshots), "Risk screenshot pack must be an array");
  assert.equal(
    report.screenshots.length,
    LAYOUT_EXPECTATIONS.length,
    "Risk screenshot pack does not match the measured layouts"
  );
  assert.equal(
    new Set(report.screenshots).size,
    report.screenshots.length,
    "Risk screenshot pack contains duplicate files"
  );
  assert.ok(report.screenshots.every(screenshotExists), "Risk screenshot pack is missing one or more images");

  const expectedPerformance = new Map([
    ["register", 250],
    ["matrix", 150]
  ]);
  assertExactValues(
    (report.performance ?? []).map((item) => item.view),
    [...expectedPerformance.keys()],
    "Risk performance results"
  );
  for (const performance of report.performance) {
    assert.ok(performance.riskCount >= 500, `${performance.view} performance fixture has fewer than 500 risks`);
    assert.ok(
      performance.medianMs <= expectedPerformance.get(performance.view),
      `${performance.view} exceeds its render budget`
    );
  }

  assert.equal(evidence.walkthrough?.status, "complete", "live Risk operator walkthrough is not complete");
  assert.ok(
    typeof evidence.walkthrough.recordedAt === "string" && !Number.isNaN(Date.parse(evidence.walkthrough.recordedAt)),
    "walkthrough needs a valid recordedAt"
  );
  assertExactValues(evidence.walkthrough.touchedSurfaces, TOUCHED_SURFACES, "Walkthrough surface coverage");
  const steps = new Map((evidence.walkthrough.steps ?? []).map((step) => [step.id, step]));
  assertExactValues([...steps.keys()], WALKTHROUGH_STEPS, "Walkthrough steps");
  for (const stepId of WALKTHROUGH_STEPS) {
    const step = steps.get(stepId);
    assert.equal(step.status, "pass", `Walkthrough step ${stepId} is not passed`);
    assert.ok(
      typeof step.result === "string" && step.result.trim(),
      `Walkthrough step ${stepId} needs an actual result`
    );
  }

  for (const key of ["redaction", "compatibility", "recovery"]) {
    assertPassingEvidence(evidence[key], key);
  }
  assert.equal(
    evidence.treatmentLinkRegression?.status,
    "pass",
    "POA-01 treatment-link regression evidence is missing"
  );
  assert.ok(
    Array.isArray(evidence.treatmentLinkRegression.tests) && evidence.treatmentLinkRegression.tests.length > 0,
    "POA-01 evidence must name regression tests"
  );

  assertExactValues(
    (evidence.limitations ?? []).map((item) => item.id),
    LIMITATION_IDS,
    "Risk limitation dispositions"
  );
  for (const limitation of evidence.limitations) {
    assert.ok(
      ["closed", "re-deferred", "not-applicable"].includes(limitation.disposition),
      `${limitation.id} has no disposition`
    );
    assert.ok(typeof limitation.reason === "string" && limitation.reason.trim(), `${limitation.id} needs a reason`);
  }

  return { productVersion, viewCount: report.views.length, screenshotCount: report.screenshots.length };
}

function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const evidence = JSON.parse(readFileSync(join(root, "docs/risk-verification-evidence.json"), "utf8"));
  const report = JSON.parse(readFileSync(join(root, ".tmp/accessibility/risk-workbench-report.json"), "utf8"));
  const result = validateRiskVerificationEvidence(evidence, report, packageJson.version);
  console.log(
    `ok Risk verification v${result.productVersion}: ${result.viewCount} views, ${result.screenshotCount} screenshots, walkthrough and trust evidence complete`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
