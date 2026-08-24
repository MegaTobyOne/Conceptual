// S6 (v1.59.0, ADR 0093): asserts J5 reader-anchored change (last-visit
// anchor, roll-up narrative, in-situ change badges) is wired at the shared
// contracts layer and consumed by Explorer and Workshop.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
assert.equal(
  contracts.includes("export function describeChangeRollup("),
  true,
  "packages/contracts/src/index.ts should define describeChangeRollup"
);

const appStore = await readFile(join(root, "packages/explorer/src/state/app-store.ts"), "utf8");
assert.equal(
  appStore.includes("READER_LAST_VISIT_META_KEY"),
  true,
  "Explorer AppStore should persist a reader-anchor meta key"
);
assert.equal(appStore.includes("lastVisitAt"), true, "Explorer AppStore should expose lastVisitAt");

const analyticsView = await readFile(join(root, "packages/explorer/src/views/analytics-view.ts"), "utf8");
assert.equal(
  analyticsView.includes("'since-visit'"),
  true,
  "Explorer Analytics view should offer a 'since your last visit' change period"
);
assert.equal(
  analyticsView.includes('data-testid="change-rollup"'),
  true,
  "Explorer Analytics view should render the change roll-up narrative"
);

const requirementsView = await readFile(join(root, "packages/explorer/src/views/requirements-view.ts"), "utf8");
assert.equal(
  requirementsView.includes('data-testid="changed-badge"'),
  true,
  "Explorer requirements list should badge rows changed since the reader's last visit"
);

const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
assert.match(
  workshopExtension,
  /Since you were last here on \$\{formatDisplayDate\(new Date\(baseline\.capturedAt\)\)\}/,
  "Workshop Home momentum sentence should anchor to the reader's last visit date"
);

console.log(
  "ok J5 reader-anchored change (last-visit anchor, roll-up, in-situ badges) is wired into Explorer and Workshop"
);
