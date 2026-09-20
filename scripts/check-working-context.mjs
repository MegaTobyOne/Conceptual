import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFile(join(root, relativePath), "utf8");
const countMatches = (text, pattern) => (text.match(pattern) ?? []).length;

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

const baseline = JSON.parse(await read("scripts/lib/essentials-surface-baseline.json"));
const packageJson = JSON.parse(await read("package.json"));
const workshopPackage = JSON.parse(await read("packages/workshop/package.json"));
const panelCount = countMatches(extensionSource, /createWebviewPanel\(/g);
assert.ok(
  panelCount <= baseline.workshopWebviewPanels,
  `Workshop panels ${panelCount} exceed ${baseline.workshopWebviewPanels}`
);
const commandCount = workshopPackage.contributes?.commands?.length ?? 0;
assert.ok(
  commandCount <= baseline.workshopCommands,
  `Workshop commands ${commandCount} exceed ${baseline.workshopCommands}`
);
assert.match(packageJson.scripts?.["check:working-context"] ?? "", /check-working-context\.mjs/);

console.log(
  `ok working context: explicit contexts, separate workspace key, safe switch branch, ` +
    `and Essentials surface ${commandCount}/${baseline.workshopCommands} commands, ${panelCount}/${baseline.workshopWebviewPanels} panels`
);
