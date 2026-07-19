#!/usr/bin/env node
/**
 * Perf budget — asserts the production build stays within size budgets.
 *
 * Run with: `npm run perf:budget` (after `npm run build`).
 *
 * The budget covers gzipped JS only — the source maps and unminified bytes
 * never ship. Adjust thresholds when intentional changes land; do not silence
 * the check.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/assets/', import.meta.url));

/** @type {Array<{ pattern: RegExp, label: string, maxGzipKb: number }>} */
const BUDGETS = [
  { pattern: /^index-.*\.js$/, label: 'app shell', maxGzipKb: 38 },
  { pattern: /^pspf-.*\.js$/, label: 'pspf data', maxGzipKb: 22 },
  { pattern: /^requirement-view-.*\.js$/, label: 'requirement view', maxGzipKb: 6.6 },
  { pattern: /^analytics-view-.*\.js$/, label: 'analytics view', maxGzipKb: 4.4 },
  { pattern: /^home-view-.*\.js$/, label: 'home view', maxGzipKb: 3.1 },
  { pattern: /^risks-view-.*\.js$/, label: 'risks view', maxGzipKb: 5.5 },
  { pattern: /^actions-view-.*\.js$/, label: 'actions view', maxGzipKb: 5.5 },
  { pattern: /^directions-view-.*\.js$/, label: 'directions view', maxGzipKb: 5.5 },
  { pattern: /^risk-action-import-view-.*\.js$/, label: 'work import view', maxGzipKb: 8.8 },
  {
    pattern: /^(cytoscape|relationship-map-view)-.*\.js$/,
    label: 'relationship map (lazy)',
    maxGzipKb: 176,
  },
];

// Lazy chunks excluded from the total-JS budget because they only load on a
// specific route. Each must still have its own per-file budget above.
const EXCLUDE_FROM_TOTAL = /^(cytoscape|relationship-map-view)-.*\.js$/;

// Covers all non-map JS route chunks. Raised for the v3.2 long-list, import
// review, Essential Eight, and Directions reporting release scope.
const TOTAL_GZIP_KB_BUDGET = 117;

const files = readdirSync(ROOT).filter((f) => f.endsWith('.js'));
let totalGzip = 0;
let failed = false;

for (const file of files) {
  const path = join(ROOT, file);
  const bytes = readFileSync(path);
  const gz = gzipSync(bytes).length;
  if (!EXCLUDE_FROM_TOTAL.test(file)) totalGzip += gz;

  for (const b of BUDGETS) {
    if (b.pattern.test(file)) {
      const kb = gz / 1024;
      const status = kb <= b.maxGzipKb ? 'OK ' : 'FAIL';
      console.log(
        `${status}  ${b.label.padEnd(20)} ${file}  ${kb.toFixed(2)} KB gz (budget ${b.maxGzipKb} KB)`,
      );
      if (kb > b.maxGzipKb) failed = true;
    }
  }
}

const totalKb = totalGzip / 1024;
const totalStatus = totalKb <= TOTAL_GZIP_KB_BUDGET ? 'OK ' : 'FAIL';
console.log(
  `\n${totalStatus}  total JS gzipped: ${totalKb.toFixed(2)} KB (budget ${TOTAL_GZIP_KB_BUDGET} KB)`,
);
if (totalKb > TOTAL_GZIP_KB_BUDGET) failed = true;

// Verify dist/index.html is not bloated
const indexHtml = statSync(join(ROOT, '..', 'index.html')).size;
console.log(`     index.html: ${(indexHtml / 1024).toFixed(2)} KB`);

if (failed) {
  console.error('\n✗ Perf budget violated.');
  process.exit(1);
}
console.log('\n✓ Perf budget satisfied.');
