import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { V0_1_COLLECTIONS, VERSION_AXES } from "@pspf/contracts";
import { explorerPublicationMode } from "./index.js";

test("Explorer publication mode advertises the active compatibility axes", () => {
  assert.equal(explorerPublicationMode.mode, "publication");
  assert.deepEqual(explorerPublicationMode.supportedVersions, VERSION_AXES);
});

test("Explorer publication mode requires every canonical collection exactly once", () => {
  assert.deepEqual(explorerPublicationMode.requiredCollections, V0_1_COLLECTIONS);
  assert.equal(new Set(explorerPublicationMode.requiredCollections).size, V0_1_COLLECTIONS.length);
});

test("Explorer lists use tag filtering instead of saved-view controls", async () => {
  const source = await readFile(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.equal(source.includes("saved-view-picker"), false);
  assert.equal(source.includes("save-requirements-view"), false);
  assert.match(
    source,
    /renderExplorerSection\(requirementsSection, "Requirements", requirementTabsPanel\(requirements\) \+ requirementFilterStatusPanel\(\) \+ requirementStatusFilterPanel\(\) \+ tagFilterPanel\(tagModel\)/
  );
  assert.match(source, /renderExplorerSection\(evidenceSection, "Evidence", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(actionsSection, "Actions", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(risksSection, "Risks", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(linksSection, "Relationships Board", tagFilterPanel\(tagModel\)/);
});

test("Explorer Requirements expose domain tabs, Directions lens, and filtered-count cue", async () => {
  const source = await readFile(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.match(source, /function requirementTabsPanel\(requirements\)/);
  assert.match(source, /data-requirement-tab="directions"/);
  assert.match(source, /data-requirement-filter-status/);
  assert.match(source, /currentRequirementTab !== "all"/);
  assert.match(
    source,
    /link\.fromType === "direction" && link\.toType === "requirement" && link\.linkType === "targets"/
  );
});

test("Explorer exposes unified obligation and public ISM review navigation", async () => {
  const source = await readFile(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.match(source, /<a href="#obligations">Obligations<\/a>/);
  assert.match(source, /renderExplorerSection\(obligationsSection, "Obligations"/);
  assert.match(source, /Unified read-only navigation across PSPF Requirements and public ISM catalogue controls/);
  assert.match(source, /summariseDirectSourceControlWork\(collections\.links \|\| \[\]\)/);
  assert.match(source, /Implementation posture is an internal Workshop field and is not published here/);
  assert.match(
    source,
    /table\(sourceControls, \["controlId", "title", "requirements", "evidence", "actions", "risks", "profiles", "release", "drift"\]\)/
  );
});

test("Explorer Strategy trends render labelled arrow indicators", async () => {
  const source = await readFile(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.match(source, /function trendIndicator\(value\)/);
  assert.match(source, /trend: trendIndicator\(choice\.trend \|\| "unknown"\)/);
  assert.match(source, /class="trend-indicator"/);
  assert.match(source, /&uarr;.*&rarr;.*&darr;/s);
});
