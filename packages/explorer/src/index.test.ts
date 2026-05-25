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
    /renderExplorerSection\(requirementsSection, "Requirements", requirementStatusFilterPanel\(\) \+ tagFilterPanel\(tagModel\)/
  );
  assert.match(source, /renderExplorerSection\(evidenceSection, "Evidence", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(actionsSection, "Actions", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(risksSection, "Risks", tagFilterPanel\(tagModel\)/);
  assert.match(source, /renderExplorerSection\(linksSection, "Relationships Board", tagFilterPanel\(tagModel\)/);
});
