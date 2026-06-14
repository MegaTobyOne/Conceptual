import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const workshopPackage = JSON.parse(await readFile(join(root, "packages/workshop/package.json"), "utf8"));
const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
const coreService = await readFile(join(root, "packages/core/src/service.ts"), "utf8");
const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");

const aiCommands = ["pspf.workshop.aiDraftRequirementFromInterview", "pspf.workshop.aiSuggestIsmMappings"];
const commands = workshopPackage.contributes?.commands ?? [];
for (const command of aiCommands) {
  const contribution = commands.find((item) => item.command === command);
  assert.ok(contribution, `Workshop should contribute ${command}`);
  assert.equal(contribution.enablement, "pspf:aiEnabled", `${command} should be disabled unless AI context is enabled`);
}

const commandPalette = workshopPackage.contributes?.menus?.commandPalette ?? [];
for (const command of aiCommands) {
  const contribution = commandPalette.find((item) => item.command === command);
  assert.ok(contribution, `Command palette should declare ${command}`);
  assert.equal(contribution.when, "pspf:aiEnabled", `${command} should be hidden from the command palette by default`);
}

assert.equal(
  workshopPackage.contributes.configuration.properties["pspf.ai.enabled"].default,
  false,
  "AI user setting must default disabled"
);
assert.equal(
  workshopPackage.contributes.configuration.properties["pspf.ai.provider"].default,
  "vscode-lm",
  "Release 1 provider should default to VS Code LM API"
);
assert.ok(
  workshopExtension.includes('const aiContextEnabledKey = "pspf:aiEnabled"'),
  "Workshop should define AI context key"
);
assert.ok(
  workshopExtension.includes('executeCommand("setContext", aiContextEnabledKey, enabled)'),
  "Workshop should update AI context key"
);
assert.ok(workshopExtension.includes("readWorkspaceAiPolicyDisabled"), "Workshop should read workspace AI policy");
assert.ok(
  workshopExtension.includes("raw.ai?.disabled !== false"),
  "AI policy should require explicit ai.disabled=false to enable"
);
assert.ok(
  workshopExtension.includes("isVscodeLanguageModelAvailable"),
  "Workshop should require model provider availability"
);
assert.ok(workshopExtension.includes("ensureAiCommandReady"), "AI commands should share an enablement guard");
assert.ok(
  workshopExtension.includes("requestAiText(prompt, aiContext)"),
  "AI commands should invoke the model through one helper"
);
for (const blockName of ["requestAiText", "aiDraftRequirementFromInterview", "aiSuggestIsmMappings"]) {
  const block = functionBlock(workshopExtension, blockName);
  assert.ok(block, `Workshop should define ${blockName}`);
  assert.ok(!/fetch\s*\(/.test(block), `${blockName} must not introduce direct fetch/network calls`);
}

assert.ok(coreService.includes('"policies.json"'), "Core should seed policies.json");
assert.ok(
  coreService.includes("ai") && coreService.includes("disabled: true"),
  "Core should seed AI disabled by policy"
);

for (const code of [
  "PSPF_AI_MODEL_UNAVAILABLE",
  "PSPF_AI_ACCESS_DENIED",
  "PSPF_AI_TIMEOUT",
  "PSPF_AI_PROMPT_REDACTION_FAILED",
  "PSPF_AI_POLICY_INVALID"
]) {
  assert.ok(contracts.includes(code), `Contracts should define ${code}`);
}
assert.ok(contracts.includes("export function isAiEnabled"), "Contracts should expose the shared AI enablement gate");

assert.ok(
  rootPackage.scripts?.["check:gates:run"]?.includes("check-ai-kill-switch.mjs"),
  "check:gates:run should include AI kill-switch gate"
);

console.log("ok AI kill-switch, command visibility, provider boundary, and default-disabled policy are covered");

function functionBlock(source, name) {
  const start =
    source.indexOf(`function ${name}`) === -1
      ? source.indexOf(`async function ${name}`)
      : source.indexOf(`function ${name}`);
  if (start === -1) {
    return undefined;
  }
  const next = source.indexOf("\nfunction ", start + 1);
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const candidates = [next, nextAsync].filter((index) => index > start).sort((left, right) => left - right);
  const end = candidates[0] ?? source.length;
  return source.slice(start, end);
}
