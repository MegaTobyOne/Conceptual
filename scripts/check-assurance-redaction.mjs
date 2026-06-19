import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "packages/assurance/package.json"), "utf8"));
const extensionSource = await readFile(join(root, "packages/assurance/src/extension.ts"), "utf8");
const modelSource = await readFile(join(root, "packages/assurance/src/pentest-workbench.ts"), "utf8");

assert.equal(manifest.name, "pspf-assurance", "Assurance package has a dedicated extension package");
assert.equal(
  manifest.extensionDependencies?.includes("tobyharvey.pspf-core"),
  true,
  "Assurance depends on Core instead of importing another product runtime"
);
assert.equal(
  manifest.contributes?.commands?.every((command) => command.command.startsWith("pspf.assurance.")),
  true,
  "Assurance contributes only pspf.assurance.* commands in its first slice"
);

const runtimeSource = `${extensionSource}\n${modelSource}`;
const forbiddenRuntimePatterns = [
  [/\bfetch\s*\(/, "fetch calls"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bhttps?:\/\//, "hard-coded network URLs"],
  [/from\s+["']node:https["']/, "node:https imports"],
  [/from\s+["']node:http["']/, "node:http imports"],
  [/from\s+["']@azure\//, "Azure SDK imports"],
  [/from\s+["']openai["']/, "OpenAI SDK imports"],
  [/from\s+["']@anthropic-ai\//, "Anthropic SDK imports"]
];

for (const [pattern, label] of forbiddenRuntimePatterns) {
  assert.equal(pattern.test(runtimeSource), false, `Assurance first slice contains no ${label}`);
}

assert.match(extensionSource, /OFFICIAL: Sensitive/, "Assurance webviews label assessment data as sensitive");
assert.match(extensionSource, /pspf\.core\.validateWorkspace/, "Assurance enters data access through Core validation");
assert.match(extensionSource, /pspf\.core\.listEntities/, "Assurance reads data through the Core command API");
assert.doesNotMatch(
  extensionSource,
  /Person\.name|Person\.email|Assignment\.personId/,
  "Assurance runtime does not emit restricted person fields"
);

console.log("ok Assurance first-slice redaction and offline boundary checks passed");
