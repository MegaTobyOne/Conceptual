import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatShortAuDateTime, normaliseShortAuDateTime, shortWorkshopPanelTitle } from "./workshop-ui.js";

test("requirement editor tabs use the requirement number instead of the full title", () => {
  const title = shortWorkshopPanelTitle({
    entityType: "requirement",
    id: "REQ-00000000-0000-4000-8000-000000000801",
    title: "17 Validate governance reporting workflow"
  });

  assert.equal(title, "Requirement 17");
});

test("other edit tabs use compact type and id labels", () => {
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "action",
      id: "ACT-00000000-0000-4000-8000-000000000801",
      title: "Confirm next governance review date"
    }),
    "Action ACT-0801"
  );
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "evidence",
      id: "EVD-00000000-0000-4000-8000-000000000802",
      title: "A very long evidence title"
    }),
    "Evidence EVD-0802"
  );
  assert.equal(
    shortWorkshopPanelTitle({
      entityType: "direction",
      id: "DIR-00000000-0000-4000-8000-000000000803",
      title: "Long direction title",
      reference: "HA-DIR-2026-01"
    }),
    "Direction HA-DIR-2026-01"
  );
});

test("due dates render as short AU dates without raw ISO noise", () => {
  assert.equal(formatShortAuDateTime("2026-06-30T00:00:00.000Z"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("30/06/2026"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("30 Jun 2026"), "30 Jun 2026");
  assert.equal(normaliseShortAuDateTime("today", new Date(2026, 4, 19, 15, 45)), "19 May 2026");
});

test("requirement browser exposes domain tabs, Directions lens, and clearable filter count", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /class="requirement-page__tabs"/);
  assert.match(source, /data-requirement-tab="directions"/);
  assert.match(source, /data-requirement-content="directions"/);
  assert.match(source, /data-clear-requirement-filters/);
  assert.match(source, /directionTargetRequirementIds/);
});

test("Workshop Strategy trends render labelled arrow indicators", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function trendIndicator\(value: string\)/);
  assert.match(source, /trend: trendIndicator\(choice\.trend\)/);
  assert.match(source, /trend: trendIndicator\(measure\.trend\)/);
  assert.match(source, /class="trend-indicator"/);
});

test("Essential Eight dashboard renders visual posture charts", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /function renderEssentialEightComplianceDonut/);
  assert.match(source, /function renderEssentialEightEvidenceChart/);
  assert.match(source, /function renderEssentialEightStrategyChart/);
  assert.match(source, /class="e8-donut"/);
  assert.match(source, /Compliance Status/);
  assert.match(source, /Evidence Coverage/);
  assert.match(source, /Strategy Readiness/);
  assert.match(source, /readonly statusCounts/);
  assert.match(source, /readonly strategyStatusCounts/);
});

test("Workshop exposes ISM Review Workbench queues", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /pspf\.workshop\.openIsmReviewWorkbench/);
  assert.match(source, /allowedCommands = new Set\([\s\S]*"pspf\.workshop\.openIsmReviewWorkbench"/);
  assert.match(source, /function buildIsmReviewWorkbenchRows/);
  assert.match(source, /risk-without-action/);
  assert.match(source, /needs-direct-work/);
  assert.match(source, /data-ism-review-filter/);
  assert.match(source, /id="ism-review-category-filter"/);
});

test("ISM source controls browser exposes category filter", async () => {
  const source = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");

  assert.match(source, /ISM_SOURCE_CONTROL_CATEGORIES/);
  assert.match(source, /homeButton\("pspf\.workshop\.browseIsmSourceControls", "ISM controls"/);
  assert.match(source, /allowedCommands = new Set\([\s\S]*"pspf\.workshop\.browseIsmSourceControls"/);
  assert.match(source, /id="ism-category-filter"/);
  assert.match(source, /data-category/);
  assert.match(source, /function ismSourceControlCategory/);
});

test("ISM control detail buttons post source-control payloads", async () => {
  const extensionSource = await readFile(new URL("../src/extension.ts", import.meta.url), "utf8");
  const shellSource = await readFile(new URL("../src/webview/shell.ts", import.meta.url), "utf8");
  const commands = [
    "openIsmControlDetail",
    "setIsmControlImplementationStatus",
    "mapRequirementToCurrentIsmControl",
    "linkEvidenceToIsmControl",
    "linkActionToIsmControl",
    "linkRiskToIsmControl",
    "attachEvidenceForIsmControl",
    "createActionForIsmControl",
    "createRiskForIsmControl"
  ];

  for (const command of commands) {
    assert.match(
      extensionSource,
      new RegExp(`data-command="${command}" data-source-control-id=`),
      `${command} should render with source-control context`
    );
    assert.match(
      shellSource,
      new RegExp(
        `command === '${command}'[\\s\\S]*sourceControlId: button\\.getAttribute\\('data-source-control-id'\\)`
      ),
      `${command} should post source-control context to the extension host`
    );
  }
});
