import assert from "node:assert/strict";
import test from "node:test";
import { ID_PREFIX_BY_ENTITY_TYPE, WORKBENCH_ID_PREFIXES } from "./index.js";

test("workbench-local ID prefixes do not collide with canonical entity prefixes", () => {
  const canonicalPrefixes = new Set(Object.values(ID_PREFIX_BY_ENTITY_TYPE));
  for (const prefix of Object.values(WORKBENCH_ID_PREFIXES)) {
    assert.equal(canonicalPrefixes.has(prefix), false, `${prefix} is already a canonical entity prefix`);
  }
});
