#!/usr/bin/env node
// R3 gate (v1.73.0, ADR 0097 "Brief once, act often"): asserts the team report card and operator
// narrative slice is wired end to end without a build. Fails when the team-report-card primitive is
// missing, not re-exported, or loses one of its four verdicts or their rule text; when the verdict
// rule is no longer carried on each row and printed alongside the verdict; when the reporting pack
// drops narrative overrides, the team report card, or renders it outside the Domain packs -> Readiness
// slot; when narrative selection stops honouring recordStatus and supersedesId; when Workshop loses
// the narrative editing, teams tab, or copy wiring; when the narrative UX coverage regresses; when the
// two new source files reference restricted person/summary/effort fields or US spellings; or when the
// surface budget drifts from 72/30.
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
  const start = source.search(new RegExp(`^(?:export )?function ${name}\\(`, "m"));
  assert.ok(start !== -1, `source defines function ${name}`);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end === -1 ? undefined : end);
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

const VERDICTS = ["on-track", "at-risk", "stalled", "no-open-work"];

// 1. Contracts primitive: exports, verdict union, rules, re-export, and tests.
const cardPath = "packages/contracts/src/team-report-card.ts";
check(await exists(cardPath), `${cardPath} exists`);
const card = await read(cardPath);
for (const fn of ["buildTeamReportCard", "describeTeamVerdict"]) {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(card), `team-report-card.ts exports ${fn}`);
}
for (const constant of ["TEAM_VERDICT_RULES", "TEAM_VERDICT_LABELS", "UNASSIGNED_TEAM_LABEL"]) {
  check(new RegExp(`^export const ${constant}\\b`, "m").test(card), `team-report-card.ts exports ${constant}`);
}
const verdictUnion = card.match(/^export type TeamVerdict = ([^;]+);/m);
check(verdictUnion !== null, "team-report-card.ts declares the TeamVerdict union");
const unionMembers = [...verdictUnion[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(
  unionMembers,
  [...VERDICTS].sort(),
  `TeamVerdict must be exactly ${VERDICTS.join("|")} (found ${unionMembers.join("|")})`
);
passed.push(`TeamVerdict is exactly ${VERDICTS.join("|")}`);
const rulesBlock = card.match(/^export const TEAM_VERDICT_RULES[^=]*=\s*\{([\s\S]*?)^\};/m);
check(rulesBlock !== null, "team-report-card.ts declares the TEAM_VERDICT_RULES object");
for (const verdict of VERDICTS) {
  check(
    new RegExp(`^\\s*(?:"${verdict}"|${verdict}):\\s*\\n?\\s*"[^"]+"`, "m").test(rulesBlock[1]),
    `TEAM_VERDICT_RULES has a non-empty rule for ${verdict}`
  );
}
const contractsIndex = await read("packages/contracts/src/index.ts");
check(
  /^export \* from "\.\/team-report-card\.js";/m.test(contractsIndex),
  'packages/contracts/src/index.ts re-exports "./team-report-card.js"'
);
const cardTestPath = "packages/contracts/src/team-report-card.test.ts";
check(await exists(cardTestPath), `${cardTestPath} exists`);
const cardTests = await read(cardTestPath);
const cardTestNames = [...cardTests.matchAll(/^test\("([^"]+)"/gm)].map((match) => match[1]);
check(cardTestNames.length > 0, "team-report-card.test.ts declares named tests");
check(
  cardTestNames.some((name) => name.includes("Unassigned")),
  'team-report-card.test.ts has a test mentioning "Unassigned"'
);
check(
  cardTestNames.some((name) => /determinism|identical/.test(name)),
  'team-report-card.test.ts has a test mentioning "determinism" or "identical"'
);
check(
  cardTestNames.some((name) => name.includes("stalled")),
  'team-report-card.test.ts has a test mentioning "stalled"'
);

// 2. Verdict rule honesty: each row carries the rule that produced its verdict, and it is printed.
const rowInterface = card.match(/^export interface TeamReportCardRow \{([\s\S]*?)^\}/m);
check(rowInterface !== null, "team-report-card.ts declares TeamReportCardRow");
check(/^\s*readonly verdictRule: string;/m.test(rowInterface[1]), "TeamReportCardRow declares verdictRule");
check(
  /verdictRule:\s*TEAM_VERDICT_RULES\[verdict\]/.test(functionBody(card, "buildTeamReportCard")),
  "buildTeamReportCard sets verdictRule from TEAM_VERDICT_RULES[verdict]"
);
const describeBody = functionBody(card, "describeTeamVerdict");
check(
  /\brow\.verdict\b/.test(describeBody) && VERDICTS.every((verdict) => describeBody.includes(`case "${verdict}"`)),
  "describeTeamVerdict switches on row.verdict and handles all four verdicts"
);

// 3. brief-renderer reporting pack: input/model shape, renderers, section order, tests.
const packPath = "packages/brief-renderer/src/reporting-pack.ts";
const pack = await read(packPath);
const interfaceBody = (name) => {
  const match = pack.match(new RegExp(`^export interface ${name}\\b[^{]*\\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `reporting-pack.ts declares interface ${name}`);
  return match[1];
};
const expectField = (name, field, optional) => {
  check(
    new RegExp(`^\\s*readonly ${field}${optional ? "\\?" : ""}:`, "m").test(interfaceBody(name)),
    `${name} declares ${field}${optional ? "?" : ""}`
  );
};
expectField("ReportingPackInput", "narratives", true);
expectField("ReportingPackInput", "periodDays", true);
expectField("ExecutiveBriefSection", "slot", false);
expectField("ExecutiveBriefSection", "generatedParagraphs", false);
expectField("ExecutiveBriefSection", "operatorNote", true);
expectField("DomainPackModel", "slot", false);
expectField("DomainPackModel", "operatorNote", true);
check(
  /^\s*readonly teamReportCard\??:/m.test(interfaceBody("ReportingPackModel")),
  "ReportingPackModel declares teamReportCard"
);
for (const fn of ["renderTeamReportCardMarkdown", "renderTeamReportCardPlainText", "renderTeamCardPlainText"]) {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(pack), `reporting-pack.ts exports ${fn}`);
}
// The rule text reaches the reader: both the pack paragraph and the per-team card print row.verdictRule.
check(
  pack.includes("Rule: ${row.verdictRule}") &&
    functionBody(pack, "renderTeamCardPlainText").includes("row.verdictRule"),
  "reporting-pack.ts prints row.verdictRule (Rule: …) in the team card renderers"
);
const packMarkdownBody = functionBody(pack, "renderReportingPackMarkdown");
orderedLiterals(
  packMarkdownBody,
  ['"## Domain packs"', '"## Team report card"', '"## Readiness before you send"'],
  "renderReportingPackMarkdown"
);
const packPlainBody = functionBody(pack, "renderReportingPackPlainText");
orderedLiterals(
  packPlainBody,
  ['underline("DOMAIN PACKS")', 'underline("TEAM REPORT CARD")', 'underline("READINESS BEFORE YOU SEND")'],
  "renderReportingPackPlainText"
);
orderedLiterals(
  pack,
  ['"Where we stand"', '"What changed"', '"Top exposures"', '"Decisions needed"'],
  "reporting-pack.ts executive headings"
);
const packTests = await read("packages/brief-renderer/src/reporting-pack.test.ts");
const packTestNames = [...packTests.matchAll(/^test\("([^"]+)"/gm)].map((match) => match[1]);
for (const phrase of ["narrative override", "superseded", "team report card"]) {
  check(
    packTestNames.some((name) => name.includes(phrase)),
    `reporting-pack.test.ts has a test mentioning "${phrase}"`
  );
}

// 4. Narrative selection safety: only active records, and superseded records never win.
// R4 renamed the private selectActiveNarratives to the exported resolveOperatorNotes.
const selectionName = "resolveOperatorNotes";
const selectionBody = functionBody(pack, selectionName);
passed.push(`reporting-pack.ts defines ${selectionName}`);
check(
  /recordStatus\s*===\s*"active"/.test(selectionBody),
  `${selectionName} keeps records with recordStatus === "active" only`
);
check(/\bsupersedesId\b/.test(selectionBody), `${selectionName} honours supersedesId`);
check(
  functionBody(pack, "buildReportingPackModel").includes(`${selectionName}(`),
  `buildReportingPackModel calls ${selectionName}(`
);

// 5. Workshop wiring.
const narrativeHelperPath = "packages/workshop/src/reporting-narrative.ts";
for (const file of [narrativeHelperPath, "packages/workshop/src/reporting-narrative.test.ts"]) {
  check(await exists(file), `${file} exists`);
}
const narrativeHelper = await read(narrativeHelperPath);
for (const fn of ["buildNarrativeDraft", "narrativeTitleForSlot", "resolveRestoreTarget", "collectRetireChain"]) {
  check(new RegExp(`^export function ${fn}\\(`, "m").test(narrativeHelper), `reporting-narrative.ts exports ${fn}`);
}
check(
  /audience:\s*"executive"/.test(functionBody(narrativeHelper, "buildNarrativeDraft")),
  'buildNarrativeDraft creates narratives with audience: "executive"'
);
const workshopExtension = await read("packages/workshop/src/extension.ts");
check(
  /^import\s*\{[^}]*\}\s*from\s*"\.\/reporting-narrative\.js";/m.test(workshopExtension),
  'Workshop extension.ts imports from "./reporting-narrative.js"'
);
const briefRendererImport = workshopExtension.match(/import\s*\{([^}]*)\}\s*from\s*"@pspf\/brief-renderer"/);
check(briefRendererImport !== null, 'Workshop extension.ts imports from "@pspf/brief-renderer"');
for (const fn of ["renderTeamReportCardPlainText", "renderTeamCardPlainText"]) {
  check(new RegExp(`\\b${fn}\\b`).test(briefRendererImport[1]), `Workshop extension.ts imports ${fn}`);
}
const packInputBody = functionBody(workshopExtension, "buildReportingPackInput");
check(
  /narratives:[\s\S]*?entityType === "narrative"[\s\S]*?audience === "executive"/.test(packInputBody),
  'buildReportingPackInput filters narratives to audience === "executive"'
);
check(/\bperiodDays:/.test(packInputBody), "buildReportingPackInput passes periodDays");
check(/tab:\s*"executive"\s*\|[^;]*"teams"/.test(workshopExtension), 'Reporting Workbench tab union includes "teams"');
for (const fn of ["reportingTeamCardHtml", "reportingNarrativeHtml"]) {
  check(new RegExp(`^function ${fn}\\(`, "m").test(workshopExtension), `Workshop extension.ts defines ${fn}`);
}
for (const message of ["saveNarrative", "useGenerated", "restorePrevious"]) {
  check(
    new RegExp(`case "${message}":`).test(workshopExtension),
    `Workshop extension.ts handles the "${message}" webview message`
  );
}
for (const format of ["teams-plain", "team-card"]) {
  check(
    new RegExp(`case "${format}":`).test(workshopExtension) && workshopExtension.includes(`data-format="${format}"`),
    `Workshop extension.ts supports copy format "${format}"`
  );
}
check(
  (workshopExtension.match(/withEnvelope\(\s*"narrative"/g) ?? []).length >= 2,
  'Workshop extension.ts creates narratives with withEnvelope("narrative", …) on save and restore'
);
check(
  workshopExtension.includes("audience: target.previous.audience"),
  "Workshop restorePrevious preserves the previous narrative's audience"
);
const shell = await read("packages/workshop/src/webview/shell.ts");
for (const message of ["saveNarrative", "useGenerated", "restorePrevious"]) {
  check(new RegExp(`command === '${message}'`).test(shell), `webview/shell.ts handles "${message}"`);
}

// 6. Publication safety (ADR 0005 default-deny): owners are teams, never people.
for (const token of [".email", "personId", "decisionOwnerRef", "person.name"]) {
  check(!pack.includes(token), `reporting-pack.ts does not reference ${token}`);
  check(!card.includes(token), `team-report-card.ts does not reference ${token}`);
}
for (const token of [".summary", "effortBasis"]) {
  check(!card.includes(token), `team-report-card.ts does not reference ${token}`);
}
check(card.includes("ownerTeam"), "team-report-card.ts derives owner labels from ownerTeam");
check(!/assignment/i.test(card), "team-report-card.ts does not reference assignment records");

// 7. UX coverage: narrative is user-editable with complete create/edit.
const coveragePath = "pspf-entity-ux-coverage.json";
const coverage = await readJson(coveragePath);
const narrativeCoverage = (coverage.records ?? []).find((record) => record.entityType === "narrative");
check(narrativeCoverage !== undefined, `${coveragePath} has a narrative entry`);
check(narrativeCoverage.mutability === "user-editable", `${coveragePath} narrative.mutability is "user-editable"`);
check(narrativeCoverage.create === "complete", `${coveragePath} narrative.create is "complete"`);
check(narrativeCoverage.edit === "complete", `${coveragePath} narrative.edit is "complete"`);

// 8. Budget and AU English.
const baselinePath = "scripts/lib/essentials-surface-baseline.json";
const baseline = await readJson(baselinePath);
check(baseline.workshopCommands === 72, `${baselinePath} workshopCommands is 72 (found ${baseline.workshopCommands})`);
check(
  baseline.workshopWebviewPanels === 30,
  `${baselinePath} workshopWebviewPanels is 30 (found ${baseline.workshopWebviewPanels})`
);
for (const [label, source] of [
  ["team-report-card.ts", card],
  ["reporting-narrative.ts", narrativeHelper]
]) {
  for (const usSpelling of ["organization", "prioritize", "analyze"]) {
    check(!new RegExp(usSpelling, "i").test(source), `${label} does not use "${usSpelling}"`);
  }
}

console.log(`ok check-team-report-card: ${passed.length} assertions passed`);
for (const message of passed) {
  console.log(`  - ${message}`);
}
