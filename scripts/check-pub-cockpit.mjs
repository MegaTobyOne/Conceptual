import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import { AxeBuilder } from "@axe-core/playwright";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = process.cwd();
const reportPath = join(root, ".tmp", "accessibility", "pub-cockpit-report.json");
const module = await loadCockpitModule();
const store = largeFixture(module.emptyStore);
const renderTimes = [];

module.renderWorkforceCockpitHtml(store);
for (let index = 0; index < 10; index += 1) {
  const startedAt = performance.now();
  module.renderWorkforceCockpitHtml(store);
  renderTimes.push(performance.now() - startedAt);
}
renderTimes.sort((left, right) => left - right);
const renderP95Ms = renderTimes[Math.ceil(renderTimes.length * 0.95) - 1];
const renderThresholdMs = 1000;
assert.ok(
  renderP95Ms <= renderThresholdMs,
  `Pub cockpit render p95 ${renderP95Ms.toFixed(1)}ms exceeds ${renderThresholdMs}ms`
);

const browser = await chromium.launch({ headless: true });
const viewportResults = [];
try {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "narrow", width: 390, height: 844 }
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.evaluate(() => {
      globalThis.acquireVsCodeApi = () => ({ postMessage() {} });
    });
    await page.setContent(module.renderWorkforceCockpitHtml(store), { waitUntil: "load" });
    await page.addStyleTag({
      content:
        ":root{--vscode-foreground:#202124;--vscode-editor-background:#fff;--vscode-sideBar-background:#f3f4f6;--vscode-panel-border:#c5c7ca;--vscode-descriptionForeground:#555b63;--vscode-focusBorder:#005fb8;--vscode-testing-iconFailed:#b42318;--vscode-editorWarning-foreground:#8a4b08}"
    });
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    viewportResults.push({
      viewport: viewport.name,
      violationCount: results.violations.length,
      seriousOrCritical: seriousOrCritical.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target)
      }))
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const seriousOrCritical = viewportResults.flatMap((result) => result.seriousOrCritical);
await mkdir(join(root, ".tmp", "accessibility"), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      fixturePeople: store.people.length,
      renderP95Ms: Number(renderP95Ms.toFixed(1)),
      renderThresholdMs,
      viewports: viewportResults
    },
    null,
    2
  )}\n`,
  "utf8"
);
assert.equal(
  seriousOrCritical.length,
  0,
  seriousOrCritical.map((violation) => `${violation.id}: ${violation.help}`).join("\n")
);
console.log(`ok Pub cockpit 500-person render p95 ${renderP95Ms.toFixed(1)}ms`);
console.log("ok Pub cockpit axe scan found zero serious/critical findings at desktop and narrow widths");
console.log(`report: ${relative(root, reportPath)}`);

async function loadCockpitModule() {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
    stdin: {
      contents:
        'export { renderWorkforceCockpitHtml } from "./packages/pub/src/workforce-ui.ts"; export { emptyStore } from "./packages/pub/src/store.ts";',
      resolveDir: root,
      sourcefile: "pub-cockpit-check-entry.ts"
    },
    plugins: [
      {
        name: "vscode-stub",
        setup(context) {
          context.onResolve({ filter: /^vscode$/ }, () => ({ path: "vscode", namespace: "stub" }));
          context.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents:
              "export const commands = {}; export const env = {}; export const window = {}; export const Uri = {};",
            loader: "js"
          }));
        }
      }
    ]
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function largeFixture(emptyStore) {
  const now = new Date("2026-07-18T00:00:00.000Z");
  const base = emptyStore(now);
  const teams = Array.from({ length: 10 }, (_, index) => ({
    id: `TEAM-${index}`,
    title: `Team ${index + 1}`,
    parentTeamId: "",
    ownedControlRefs: [],
    ownedRequirementRefs: [],
    controlSetRefs: [],
    teamItems: [],
    responsibility: "",
    notes: ""
  }));
  const roles = Array.from({ length: 50 }, (_, index) => ({
    id: `ROLE-${index}`,
    title: `Role ${index + 1}`,
    teamId: teams[index % teams.length].id,
    status: "active",
    reportsToRoleId: "",
    functionalOutcome: "",
    contribution: "",
    positionDescriptionUrl: "",
    positionDescriptionText: ""
  }));
  const people = Array.from({ length: 500 }, (_, index) => ({
    id: `PERSON-${index}`,
    displayName: `Person ${index + 1}`,
    stakeholderType: "staff",
    organisation: "Example agency",
    currentRole: "",
    resumeUrl: "",
    resumeText: "",
    nextMilestone: "",
    nextAction: "",
    lifecycle: [],
    performanceCycles: [],
    notes: ""
  }));
  const assignments = people.map((person, index) => ({
    id: `ASSIGNMENT-${index}`,
    personId: person.id,
    roleId: roles[index % roles.length].id,
    status: index % 17 === 0 ? "needs-backup" : "active",
    allocation: "",
    reviewBy: "",
    badge: ""
  }));
  const skills = Array.from({ length: 5 }, (_, index) => ({
    id: `SKILL-${index}`,
    title: `Skill ${index + 1}`,
    category: index === 0 ? "ai-fluency" : "cyber",
    levelAnchors: ["Aware", "Working", "Practised", "Advanced", "Leading"],
    status: "active"
  }));
  return {
    ...base,
    people,
    teams,
    roles,
    assignments,
    learningRequirements: [
      {
        id: "LEARNING-1",
        title: "Annual security learning",
        scopeType: "all",
        scopeId: "",
        recurrence: "annual",
        criticality: "mandatory",
        dueDate: "2026-07-01",
        status: "active"
      }
    ],
    personLearningRecords: people.slice(0, 400).map((person, index) => ({
      id: `LEARNING-RECORD-${index}`,
      personId: person.id,
      learningRequirementId: "LEARNING-1",
      dueDate: "2026-07-01",
      state: index % 4 === 0 ? "completed" : "in-progress",
      completedAt: index % 4 === 0 ? "2026-06-01" : "",
      evidenceRef: "",
      exemptionReason: ""
    })),
    skills,
    roleSkillRequirements: roles.flatMap((role) =>
      skills.map((skill, index) => ({
        id: `ROLE-SKILL-${role.id}-${skill.id}`,
        roleId: role.id,
        skillId: skill.id,
        targetLevel: index + 1,
        importance: "required"
      }))
    ),
    personSkillAssessments: people
      .filter((_, index) => index % 3 !== 0)
      .flatMap((person, personIndex) =>
        skills.map((skill, skillIndex) => ({
          id: `ASSESSMENT-${person.id}-${skill.id}`,
          personId: person.id,
          skillId: skill.id,
          level: ((personIndex + skillIndex) % 5) + 1,
          source: "manager",
          assessedAt: "2026-01-15",
          reviewBy: "2027-01-15",
          evidenceNote: ""
        }))
      ),
    successionPlans: roles.slice(0, 25).map((role, index) => ({
      id: `SUCCESSION-${index}`,
      roleId: role.id,
      criticality: "important",
      status: "approved",
      reviewBy: "2027-01-15",
      candidates: [],
      reviewHistory: []
    }))
  };
}
