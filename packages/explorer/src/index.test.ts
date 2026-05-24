import assert from "node:assert/strict";
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
