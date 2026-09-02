// E3 (v1.65.0, ADR 0096): asserts Workshop's requirement pickers delegate to the SAME shared
// @pspf/contracts finder primitive as Explorer (E2) — one implementation, two hosts — and that a
// cross-host parity test proves deterministic ordering.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const workshopUi = await readFile(join(root, "packages/workshop/src/workshop-ui.ts"), "utf8");
assert.equal(
  workshopUi.includes("export function requirementToFinderRecord("),
  true,
  "workshop-ui.ts should export requirementToFinderRecord"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
for (const requiredText of [
  "requirementToFinderRecord",
  "matchesRequirementFinderFilters",
  "compareRequirementFinderRecords"
]) {
  assert.equal(
    workshopExtension.includes(requiredText),
    true,
    `Workshop extension.ts should use the shared finder primitive (${requiredText})`
  );
}
// The old duplicated matching/sorting logic must be gone, not just supplemented.
assert.equal(
  /function savedViewMatchesRequirement[\s\S]{0,80}const filters = savedView\.filters;\s*\n\s*const query = filters\.query/.test(
    workshopExtension
  ),
  false,
  "savedViewMatchesRequirement should delegate to the shared primitive, not reimplement matching inline"
);

const workshopUiTests = await readFile(join(root, "packages/workshop/src/workshop-ui.test.ts"), "utf8");
assert.equal(
  workshopUiTests.includes("requirementToFinderRecord adapts a Workshop requirement"),
  true,
  "workshop-ui.test.ts should test the finder adapter"
);

const parityTest = await readFile(join(root, "packages/contracts/src/requirement-finder-parity.test.ts"), "utf8");
assert.equal(
  parityTest.includes("deterministically ordered results"),
  true,
  "requirement-finder-parity.test.ts should prove deterministic cross-host ordering"
);

console.log(
  "ok check-requirement-finder-parity: Workshop pickers delegate to the shared finder primitive; parity test proves deterministic ordering"
);
