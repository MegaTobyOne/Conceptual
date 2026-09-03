#!/usr/bin/env node
// R4 gate (v1.74.0, ADR 0097 "Brief once, act often"): asserts the narrative-reuse, suggested-actions,
// and capture-sweep slice is wired end to end without a build. Fails when brief-renderer stops exporting
// resolveOperatorNotes or the posture brief loses its operator sections (Where We Stand / What Changed
// must sit after Summary and Evidence Basis must survive); when the magazine editor-note source or the
// master-plan operator narrative disappear; when the contracts primitives (buildSuggestedActions,
// SUGGESTED_DUE_DAYS, stampNarrativesWithSnapshot) are missing, not re-exported, or untested; when
// Workshop loses the accept-suggestions draft-and-confirm flow, close-reporting-period stamping, the
// evidence/ISM sweeps, or their webview handlers; when narratives stop reaching the share artefacts;
// when any new source file references restricted person fields or US spellings; or when the surface
// budget drifts from 72/30.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const passed = [];
const check = (condition, message) => {
  assert.ok(condition, message);
  passed.push(message);
};
const exists = async (relativePath) => {
  try {
    await access(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
};
const read = (relativePath) => readFile(join(root, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await read(relativePath));
const functionBody = (source, name) => {
  const start = source.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m"));
  assert.ok(start !== -1, `source defines function ${name}`);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end === -1 ? undefined : end);
};
const linesAfter = (source, marker, count, label) => {
  const index = source.indexOf(marker);
  check(index !== -1, `${label} contains ${JSON.stringify(marker)}`);
  return source.slice(index).split("\n").slice(0, count).join("\n");
};
const orderedLiterals = (source, literals, label) => {
  const indices = literals.map((literal) => source.indexOf(literal));
  indices.forEach((index, position) => {
    check(index !== -1, `${label} contains ${JSON.stringify(literals[position])}`);
  });
  for (let i = 1; i < indices.length; i += 1) {
    check(
      indices[i] > indices[i - 1],
      `${label}: ${JSON.stringify(literals[i - 1])} appears before ${JSON.stringify(literals[i])}`
    );
  }
};
const interfaceBody = (source, name, label) => {
  const match = source.match(new RegExp(`^export interface ${name}\\b[^{]*\\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `${label} declares interface ${name}`);
  return match[1];
};
const expectField = (source, label, name, field, optional) => {
  check(
    new RegExp(`^\\s*readonly ${field}${optional ? "\\?" : ""}:`, "m").test(interfaceBody(source, name, label)),
    `${label}: ${name} declares ${field}${optional ? "?" : ""}`
  );
};
const expectExportedFunction = (source, label, fn) => {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(source), `${label} exports ${fn}`);
};
const expectNamedTests = async (path, label) => {
  check(await exists(path), `${path} exists`);
  const names = [...(await read(path)).matchAll(/^test\("([^"]+)"/gm)].map((match) => match[1]);
  check(names.length > 0, `${label} declares named tests`);
  return names;
};
const handlesWebviewMessage = (source, label, message) => {
  check(
    new RegExp(`case "${message}":`).test(source) || new RegExp(`\\.command === "${message}"`).test(source),
    `${label} handles the "${message}" webview message`
  );
};

// 1. Narrative reuse: brief-renderer resolves operator notes once and reuses them in every renderer.
const packPath = "packages/brief-renderer/src/reporting-pack.ts";
const pack = await read(packPath);
expectExportedFunction(pack, "reporting-pack.ts", "resolveOperatorNotes");
const rendererPath = "packages/brief-renderer/src/index.ts";
const renderer = await read(rendererPath);
expectField(renderer, "index.ts", "PostureBriefInput", "narratives", true);
check(
  /^import\s*\{[^}]*\bresolveOperatorNotes\b[^}]*\}\s*from\s*"\.\/reporting-pack\.js";/m.test(renderer),
  'index.ts imports resolveOperatorNotes from "./reporting-pack.js"'
);
check(renderer.includes("resolveOperatorNotes("), "index.ts calls resolveOperatorNotes(");
const postureBriefBody = functionBody(renderer, "renderPostureBriefMarkdown");
orderedLiterals(
  postureBriefBody,
  ['"## Summary"', '"## Where We Stand"', '"## What Changed"', '"## Evidence Basis"'],
  "renderPostureBriefMarkdown"
);
const magazineModel = interfaceBody(renderer, "CisoMagazineModel", "index.ts");
const editorNoteSourceField = magazineModel.match(/^\s*readonly editorNoteSource:\s*([^;]+);/m);
check(editorNoteSourceField !== null, "index.ts: CisoMagazineModel declares editorNoteSource");
let editorNoteSourceType = editorNoteSourceField[1].trim();
const aliasMatch = renderer.match(new RegExp(`^export type ${editorNoteSourceType} = ([^;]+);`, "m"));
if (aliasMatch) {
  editorNoteSourceType = aliasMatch[1];
}
for (const member of ["operator-override", "operator-note", "generated"]) {
  check(editorNoteSourceType.includes(`"${member}"`), `CisoMagazineModel.editorNoteSource union includes "${member}"`);
}
expectField(renderer, "index.ts", "CisoMasterPlanModel", "operatorNarrative", true);
check(
  functionBody(renderer, "renderCisoMasterPlanMarkdown").includes('"## Operator narrative"'),
  'renderCisoMasterPlanMarkdown emits "## Operator narrative"'
);
const narrativeTestPath = "packages/brief-renderer/src/narrative-reuse.test.ts";
const narrativeTestNames = await expectNamedTests(narrativeTestPath, "narrative-reuse.test.ts");
check(
  narrativeTestNames.some((name) => name.includes("superseded")),
  'narrative-reuse.test.ts has a test mentioning "superseded"'
);
check(
  narrativeTestNames.some((name) => /precedence|override/.test(name)),
  'narrative-reuse.test.ts has a test mentioning "precedence" or "override"'
);
check(
  narrativeTestNames.some((name) => /restricted|person/.test(name)),
  'narrative-reuse.test.ts has a test mentioning "restricted" or "person"'
);

// 2. Suggested actions: contracts primitives, re-exports, tests, and the Workshop draft-and-confirm flow.
const suggestedPath = "packages/contracts/src/suggested-actions.ts";
check(await exists(suggestedPath), `${suggestedPath} exists`);
const suggested = await read(suggestedPath);
expectExportedFunction(suggested, "suggested-actions.ts", "buildSuggestedActions");
check(/^export const SUGGESTED_DUE_DAYS\b/m.test(suggested), "suggested-actions.ts exports SUGGESTED_DUE_DAYS");
const periodPath = "packages/contracts/src/reporting-period.ts";
check(await exists(periodPath), `${periodPath} exists`);
const period = await read(periodPath);
expectExportedFunction(period, "reporting-period.ts", "stampNarrativesWithSnapshot");
const contractsIndex = await read("packages/contracts/src/index.ts");
for (const module of ["suggested-actions", "reporting-period"]) {
  check(
    new RegExp(`^export \\* from "\\./${module}\\.js";`, "m").test(contractsIndex),
    `packages/contracts/src/index.ts re-exports "./${module}.js"`
  );
}
await expectNamedTests("packages/contracts/src/suggested-actions.test.ts", "suggested-actions.test.ts");
await expectNamedTests("packages/contracts/src/reporting-period.test.ts", "reporting-period.test.ts");
const suggestionsPath = "packages/workshop/src/reporting-suggestions.ts";
check(await exists(suggestionsPath), `${suggestionsPath} exists`);
const suggestions = await read(suggestionsPath);
for (const fn of ["buildWorkbenchSuggestions", "buildAcceptedActionDrafts"]) {
  expectExportedFunction(suggestions, "reporting-suggestions.ts", fn);
}
await expectNamedTests("packages/workshop/src/reporting-suggestions.test.ts", "reporting-suggestions.test.ts");
const workshopExtension = await read("packages/workshop/src/extension.ts");
for (const message of ["acceptSuggestions", "closeReportingPeriod"]) {
  handlesWebviewMessage(workshopExtension, "Workshop extension.ts", message);
}
check(
  workshopExtension.includes("stampNarrativesWithSnapshot("),
  "Workshop extension.ts calls stampNarrativesWithSnapshot("
);
check(
  workshopExtension.includes("buildRequirementExplainer("),
  "Workshop extension.ts calls buildRequirementExplainer("
);
const acceptHandler = linesAfter(workshopExtension, 'case "acceptSuggestions"', 60, "Workshop extension.ts");
check(
  /\brequirementIds\b/.test(acceptHandler),
  'Workshop acceptSuggestions handler reads the operator selection (requirementIds) within 60 lines of case "acceptSuggestions"'
);
check(
  acceptHandler.includes("buildAcceptedActionDrafts("),
  "Workshop acceptSuggestions handler builds drafts with buildAcceptedActionDrafts("
);
const shell = await read("packages/workshop/src/webview/shell.ts");
for (const message of ["acceptSuggestions", "closeReportingPeriod"]) {
  check(new RegExp(`command === '${message}'`).test(shell), `webview/shell.ts handles "${message}"`);
}

// 3. Capture sweeps: evidence sweep and deterministic ISM ranker drafts.
const evidenceSweepPath = "packages/workshop/src/evidence-sweep.ts";
check(await exists(evidenceSweepPath), `${evidenceSweepPath} exists`);
const evidenceSweep = await read(evidenceSweepPath);
expectExportedFunction(evidenceSweep, "evidence-sweep.ts", "planEvidenceSweep");
check(evidenceSweep.includes('"supported-by"'), 'evidence-sweep.ts links evidence with "supported-by"');
await expectNamedTests("packages/workshop/src/evidence-sweep.test.ts", "evidence-sweep.test.ts");
const ismSweepPath = "packages/workshop/src/ism-sweep.ts";
check(await exists(ismSweepPath), `${ismSweepPath} exists`);
const ismSweep = await read(ismSweepPath);
expectExportedFunction(ismSweep, "ism-sweep.ts", "buildRankerMappingDrafts");
check(
  ismSweep.includes('"Deterministic ranker draft"'),
  'ism-sweep.ts records "Deterministic ranker draft" provenance'
);
check(
  ismSweep.includes('coverageQualifier: "partial"'),
  'ism-sweep.ts drafts mappings with coverageQualifier: "partial"'
);
await expectNamedTests("packages/workshop/src/ism-sweep.test.ts", "ism-sweep.test.ts");
for (const message of ["sweepEvidence", "suggestIsmMappings"]) {
  handlesWebviewMessage(workshopExtension, "Workshop extension.ts", message);
}
check(/command === 'sweepEvidence'/.test(shell), 'webview/shell.ts handles "sweepEvidence"');

// 4. Narratives reach the share artefacts.
const shareInput = linesAfter(workshopExtension, "function buildShareArtefactInput(", 80, "Workshop extension.ts");
check(
  /^\s*narratives:/m.test(shareInput),
  "buildShareArtefactInput passes narratives within 80 lines of its signature"
);
check(
  /\bnarratives:\s*input\.narratives\b/.test(functionBody(workshopExtension, "copyPostureBrief")),
  "copyPostureBrief passes narratives to renderPostureBriefMarkdown"
);

// 5. Publication safety (ADR 0005 default-deny): the new source files never touch person fields.
for (const [label, source] of [
  ["suggested-actions.ts", suggested],
  ["reporting-period.ts", period],
  ["evidence-sweep.ts", evidenceSweep],
  ["ism-sweep.ts", ismSweep],
  ["reporting-suggestions.ts", suggestions]
]) {
  for (const token of [".email", "personId", "decisionOwnerRef", "person.name"]) {
    check(!source.includes(token), `${label} does not reference ${token}`);
  }
}

// 6. Budget and AU English.
const baselinePath = "scripts/lib/essentials-surface-baseline.json";
const baseline = await readJson(baselinePath);
check(baseline.workshopCommands === 72, `${baselinePath} workshopCommands is 72 (found ${baseline.workshopCommands})`);
check(
  baseline.workshopWebviewPanels === 30,
  `${baselinePath} workshopWebviewPanels is 30 (found ${baseline.workshopWebviewPanels})`
);
for (const [label, source] of [
  ["suggested-actions.ts", suggested],
  ["reporting-period.ts", period],
  ["evidence-sweep.ts", evidenceSweep],
  ["ism-sweep.ts", ismSweep],
  ["reporting-suggestions.ts", suggestions]
]) {
  for (const usSpelling of ["organization", "prioritize", "analyze", "behavior"]) {
    check(!new RegExp(usSpelling, "i").test(source), `${label} does not use "${usSpelling}"`);
  }
}

console.log(`ok check-narrative-reuse: ${passed.length} assertions passed`);
for (const message of passed) {
  console.log(`  - ${message}`);
}
