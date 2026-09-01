// E2 (v1.64.0, ADR 0096): asserts the shared requirement finder primitive is defined once at the
// contracts layer, has a deterministic behavioural test, and is wired into the Explorer requirements
// route (search, PSPF section browsing, and result decision summaries) without adding a new route.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
for (const requiredText of [
  "export interface RequirementFinderRecord",
  "export interface RequirementFinderFilters",
  "export function matchesRequirementFinderFilters<",
  "export function compareRequirementFinderRecords<",
  "export function searchRequirements<",
  "export function buildRequirementFinderResultSummary("
]) {
  assert.equal(contracts.includes(requiredText), true, `packages/contracts/src/index.ts should define ${requiredText}`);
}

const finderTests = await readFile(join(root, "packages/contracts/src/requirement-finder.test.ts"), "utf8");
assert.equal(
  finderTests.includes("searchRequirements: filters and sorts deterministically"),
  true,
  "requirement-finder.test.ts should prove deterministic ordering"
);

const requirementsView = await readFile(join(root, "packages/explorer/src/views/requirements-view.ts"), "utf8");
for (const requiredText of [
  "searchRequirements",
  "buildRequirementFinderResultSummary",
  'data-testid="requirement-finder-query"',
  'data-testid="section-group"',
  'data-testid="requirement-summary"'
]) {
  assert.equal(
    requirementsView.includes(requiredText),
    true,
    `Explorer requirements-view.ts should include ${requiredText}`
  );
}

// E2 must not add a new Explorer route — the finder enhances the existing /requirements route.
const routes = await readFile(join(root, "packages/explorer/src/app/routes.ts"), "utf8");
assert.equal(
  /path:\s*['"]\/requirements['"]/.test(routes),
  true,
  "Explorer should still route /requirements to the enhanced requirements view (no new finder route)"
);
assert.equal(
  /path:\s*['"][^'"]*finder[^'"]*['"]/i.test(routes),
  false,
  "E2 must enhance the existing /requirements route, not add a separate finder route (essentials surface budget is frozen)"
);

console.log(
  "ok check-requirement-finder: shared finder primitive is defined once and wired into the Explorer requirements route"
);
