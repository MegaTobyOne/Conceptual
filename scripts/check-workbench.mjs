import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Proves the v1.77 workbench slice wiring (ADR 0103): local-only runtime, isolated storage,
// staged deployment path, and no republishing of the frozen extensions.
const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const adr = read("adr/0103-v1-77-workbench-first-slice-matter-capture-and-recovery.md");
assert.match(adr, /^- Status: accepted/m, "ADR 0103 should be accepted");

const distIndex = join(root, "packages/workbench/dist/index.html");
assert.equal(existsSync(distIndex), true, "build the workbench before running this check (pnpm build)");
const html = readFileSync(distIndex, "utf8");
assert.match(html, /<pspf-workbench>/, "workbench index should mount <pspf-workbench>");
assert.match(html, /lang="en-AU"/, "workbench should declare AU-English");
assert.match(html, /connect-src 'self'/, "workbench CSP should restrict connections to self");

function sourceFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

for (const file of sourceFiles("packages/workbench/src")) {
  const text = read(file);
  assert.doesNotMatch(
    text,
    /\b(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/,
    `${file} must make no network calls (ADR 0103 §2)`
  );
  assert.doesNotMatch(
    text,
    /pspf-explorer\.v\d|packages\/explorer|from ['"][^'"]*explorer/,
    `${file} must not touch Explorer storage`
  );
}

const store = read("packages/workbench/src/data/store.ts");
assert.match(store, /DB_NAME = ["']pspf-workbench\.v1["']/, "workbench should use its own IndexedDB database");

const marketplace = read(".github/workflows/marketplace.yml");
assert.match(
  marketplace,
  /Refuse publication of frozen extensions/,
  "marketplace workflow should refuse non-dry-run publication (ADR 0102 D8(i) amendment)"
);

const webBuild = read("scripts/build-web-release.mjs");
assert.match(webBuild, /"workbench"/, "web release staging should include /workbench");

console.log(
  "ok workbench slice wiring: accepted ADR, local-only source, isolated storage, staged path, frozen extensions guarded"
);
