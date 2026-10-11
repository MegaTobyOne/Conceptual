import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const countMatches = (text, pattern) => (text.match(pattern) ?? []).length;
const read = (relativePath) => readFile(join(root, relativePath), "utf8");
const contextSource = await read("packages/webview-shell/src/working-context.ts");
assert.match(contextSource, /export type WorkingContext = "operations" \| "oversight-assurance";/);
assert.match(contextSource, /DEFAULT_WORKING_CONTEXT: WorkingContext = "operations"/);
assert.match(contextSource, /value === "oversight-assurance"/);
assert.match(contextSource, /workingContextLabel/);

const shellIndex = await read("packages/webview-shell/src/index.ts");
for (const exportName of [
  "DEFAULT_WORKING_CONTEXT",
  "normaliseWorkingContext",
  "workingContextLabel",
  "WorkingContext"
]) {
  assert.match(shellIndex, new RegExp(`\\b${exportName}\\b`), `${exportName} must be exported by the shared shell`);
}

const extensionSource = await read("packages/workshop/src/extension.ts");
assert.match(extensionSource, /pspf\.workshop\.workingContext/);
assert.match(extensionSource, /pspf\.workshop\.presentationLens/);
assert.match(
  extensionSource,
  /normalisePresentationLens\(context\.workspaceState\.get<string>\(workshopLensStateKey\)\)/
);
assert.match(extensionSource, /workspaceState\.update\(workshopLensStateKey, undefined\)/);
assert.match(extensionSource, /data-command="workingContext"/);
assert.match(extensionSource, /value="operations"/);
assert.match(extensionSource, /value="oversight-assurance"/);
assert.equal(countMatches(extensionSource, /data-command="workingContext"/g), 1);

const contextBranchStart = extensionSource.indexOf('if (command === "workingContext")');
assert.notEqual(contextBranchStart, -1, "working-context message branch must exist");
const contextBranchEnd = extensionSource.indexOf('if (command === "pspf.workshop.home.refresh")', contextBranchStart);
assert.notEqual(contextBranchEnd, -1, "working-context branch must remain before the Home refresh branch");
const contextBranch = extensionSource.slice(contextBranchStart, contextBranchEnd);
assert.match(contextBranch, /normaliseWorkingContext\(value\)/);
assert.match(contextBranch, /workshopWorkingContext = normaliseWorkingContext\(value\)/);
assert.match(contextBranch, /workspaceState\.update\(workingContextStateKey, workshopWorkingContext\)/);
assert.match(contextBranch, /await this\.refresh\(\)/);
assert.doesNotMatch(
  contextBranch,
  /executeCommand|upsertEntity|deleteEntity|createSnapshot|exportBundle|importBundle|capability|record mutation|open[A-Z]/i,
  "switching context must not invoke records, capabilities, or business commands"
);

const packageJson = JSON.parse(await read("package.json"));
assert.match(packageJson.scripts?.["check:working-context"] ?? "", /check-working-context\.mjs/);

console.log("ok working context: explicit contexts, separate workspace key and safe switch branch");
