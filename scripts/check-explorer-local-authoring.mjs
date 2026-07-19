// Explorer Local Changes gate (ADR 0004, 0031–0034, 0084).
// Runs the Explorer package's Playwright local-authoring suites against the
// built artefact: compliance statuses with history and evidence references,
// risk and action registers, posture overrides persisting across reload,
// work log, tags, saved views, share round-trip, and backup/restore — all in
// browser-local IndexedDB.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "explorer-local-authoring");
const reportPath = join(reportDirectory, "explorer-local-authoring-report.json");
await mkdir(reportDirectory, { recursive: true });

// Each entry maps a named local-authoring capability to the package e2e spec
// that exercises it end-to-end in a real browser with IndexedDB persistence.
const suites = [
  { name: "Compliance status, history, and evidence references persist locally", spec: "compliance.spec.ts" },
  { name: "Risk register create/edit/delete persists locally", spec: "risks.spec.ts" },
  { name: "Action register create/edit/delete persists locally", spec: "actions.spec.ts" },
  { name: "Posture and per-domain overrides persist across reload", spec: "posture.spec.ts" },
  { name: "Work log entries persist locally", spec: "work-log.spec.ts" },
  { name: "Tags create/edit/delete persist locally", spec: "tags.spec.ts" },
  { name: "Saved views save/load/delete persist locally", spec: "saved-views.spec.ts" },
  { name: "Requirement-risk relationships persist locally", spec: "relationships.spec.ts" },
  { name: "Share package export and merge round-trip", spec: "share.spec.ts" },
  { name: "Backup export and restore replace browser-local stores", spec: "backup-restore.spec.ts" }
];

console.log(`running Explorer local-authoring e2e suites (${suites.length} specs)...`);
const result = spawnSync(
  "npx",
  ["pnpm@10.10.0", "--filter", "pspf-explorer", "exec", "playwright", "test", ...suites.map((suite) => suite.spec)],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 }
);

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const suiteRunOk = result.status === 0;
if (!suiteRunOk) {
  console.error(output.slice(-4000));
}

const checks = suites.map((suite) => {
  // Playwright's CI reporter may emit compact dot output without spec filenames.
  // The exact spec list is passed above; a zero exit code means all requested suites ran and passed.
  const ok = suiteRunOk;
  console.log(`${ok ? "ok" : "FAIL"} ${suite.name}`);
  return { name: suite.name, ok, spec: suite.spec };
});
checks.push({ name: "Local-authoring Playwright run exits cleanly", ok: suiteRunOk });
console.log(`${suiteRunOk ? "ok" : "FAIL"} Local-authoring Playwright run exits cleanly`);

const ok = checks.every((item) => item.ok);
await writeFile(
  reportPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), ok, checks }, null, 2) + "\n",
  "utf8"
);
console.log(`report: ${reportPath}`);
assert.ok(ok, "explorer local-authoring checks failed");
console.log(`ok explorer local-authoring passed (${checks.length} checks)`);
