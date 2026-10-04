// Risk workbench runtime gate (ADR 0098 D8.4; docs/risk-overhaul-plan.md
// § Implementation and Verification Map items 5 and 6).
//
// Renders the real Workshop Risk workbench markup headlessly and proves three things
// no pure-builder unit test can:
//   1. the Risk editor form actually submits every field `buildUpdatedEntity` reads,
//      and a round trip through both persists the operator's edits;
//   2. every workbench view is accessible (zero serious/critical axe findings) and
//      free of horizontal overflow across VS Code themes, 320/768/1440 px and 200% zoom;
//   3. register and matrix render inside the D8.4 budgets at 500 risks.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { buildSampleWorkspaceEntities, VERSION_AXES } from "../packages/contracts/dist/index.js";
import { shellHtml } from "../packages/workshop/dist/webview/shell.js";

const root = process.cwd();
const harnessPath = join(root, ".tmp", "workshop-render-harness.mjs");
const reportDirectory = join(root, ".tmp", "accessibility");
const screenshotDirectory = join(reportDirectory, "risk-workbench");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const build = spawnSync(
  "npx",
  [
    "pnpm@10.10.0",
    "exec",
    "esbuild",
    "packages/workshop/src/extension.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node22",
    "--alias:vscode=./scripts/lib/vscode-stub.mjs",
    `--outfile=${harnessPath}`,
    "--log-level=error"
  ],
  { cwd: root, stdio: "inherit" }
);
assert.equal(build.status, 0, "failed to bundle the Workshop extension against the vscode stub");

const { __riskWorkbenchTestHooks } = await import(harnessPath);
const { renderRiskWorkbench, buildUpdatedEntity } = __riskWorkbenchTestHooks;

const VIEWS = ["register", "hierarchy", "matrix", "treatments", "bowtie", "coverage", "cards", "framework", "record"];

const THEMES = [
  {
    name: "dark",
    bodyClass: "vscode-dark",
    variables: {
      foreground: "#d6dcda",
      muted: "#aab4b1",
      surface: "#171b1a",
      elevated: "#202624",
      border: "#45504d",
      button: "#365f78",
      buttonForeground: "#ffffff",
      focus: "#8bc7ed"
    }
  },
  {
    name: "light",
    bodyClass: "vscode-light",
    variables: {
      foreground: "#202725",
      muted: "#596562",
      surface: "#fbfcfb",
      elevated: "#eef1ef",
      border: "#c7cfcc",
      button: "#315d7b",
      buttonForeground: "#ffffff",
      focus: "#245b84"
    }
  },
  {
    name: "high-contrast",
    bodyClass: "vscode-high-contrast",
    variables: {
      foreground: "#ffffff",
      muted: "#ffffff",
      surface: "#000000",
      elevated: "#000000",
      border: "#ffffff",
      button: "#000000",
      buttonForeground: "#ffffff",
      focus: "#ffff00"
    }
  }
];

const LAYOUTS = [
  { name: "320px", width: 320, zoom: 1 },
  { name: "768px", width: 768, zoom: 1 },
  { name: "1440px", width: 1440, zoom: 1 },
  { name: "1440px@200%", width: 1440, zoom: 2 }
];

// --- fixtures ----------------------------------------------------------------------

const isRisk = (entity) => entity.entityType === "risk" && entity.recordStatus !== "deleted";
const timestamp = "2026-09-07T00:00:00.000Z";

function envelope(entityType, id, extra) {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    recordStatus: "active",
    sourceProduct: "workshop",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...extra
  };
}

const typicalEntities = buildSampleWorkspaceEntities();
const sampleRisk = typicalEntities.find(isRisk);
assert.ok(sampleRisk, "the enterprise sample must contain a risk");

const emptyEntities = [
  envelope("risk", "RSK-00000000-0000-4000-8000-0000000000ff", {
    title: "Only risk in an otherwise empty workspace",
    status: "open",
    likelihood: 1,
    impact: 1
  })
];

// 500 risks with a deep chain, a shared parent, long labels and unassessed records.
function buildVolumeEntities() {
  const entities = [...typicalEntities];
  const framework = typicalEntities.find((entity) => entity.entityType === "risk-framework");
  const categoryIds = (framework?.categories ?? []).map((category) => category.id);
  const longLabel =
    "Sustained unauthorised access to an internet-facing corporate application because of an unpatched third-party component";
  const ids = [];
  for (let index = 0; index < 500; index += 1) {
    const id = `RSK-11111111-0000-4000-8000-${String(index).padStart(12, "0")}`;
    ids.push(id);
    const unassessed = index % 7 === 0;
    entities.push(
      envelope("risk", id, {
        title: `${longLabel} (volume fixture ${index + 1})`,
        status: index % 5 === 0 ? "monitored" : "open",
        likelihood: (index % 5) + 1,
        impact: ((index * 3) % 5) + 1,
        primaryCategoryId: categoryIds[index % Math.max(categoryIds.length, 1)],
        ...(unassessed ? { assessment: { basis: "unassessed" }, assessmentState: "unassessed" } : {})
      })
    );
  }
  // A 20-deep chain, then the remainder fanned out under a single shared parent.
  for (let index = 1; index < ids.length; index += 1) {
    const parentId = index < 20 ? ids[index - 1] : ids[19];
    entities.push(
      envelope("link", `LNK-11111111-0000-4000-8000-${String(index).padStart(12, "0")}`, {
        title: "rolls up to",
        linkType: "rolls-up-to",
        fromId: ids[index],
        fromType: "risk",
        toId: parentId,
        toType: "risk"
      })
    );
  }
  return entities;
}

const volumeEntities = buildVolumeEntities();

const FIXTURES = [
  { name: "empty", entities: emptyEntities, risk: emptyEntities[0] },
  { name: "typical", entities: typicalEntities, risk: sampleRisk },
  { name: "volume", entities: volumeEntities, risk: volumeEntities.find(isRisk) }
];

function pageHtml(fixture, view, theme) {
  const body = renderRiskWorkbench(fixture.risk, fixture.entities, { riskView: view });
  const variables = theme.variables;
  return shellHtml(`Risk workbench ${view}`, body)
    .replace(
      "</head>",
      `<style>:root {
        --vscode-foreground: ${variables.foreground};
        --vscode-descriptionForeground: ${variables.muted};
        --vscode-sideBar-background: ${variables.surface};
        --vscode-editor-background: ${variables.elevated};
        --vscode-sideBarSectionHeader-border: ${variables.border};
        --vscode-panel-border: ${variables.border};
        --vscode-button-background: ${variables.button};
        --vscode-button-foreground: ${variables.buttonForeground};
        --vscode-button-hoverBackground: ${variables.button};
        --vscode-button-border: ${variables.border};
        --vscode-focusBorder: ${variables.focus};
      }</style></head>`
    )
    .replace(
      "<body>",
      `<body class="${theme.bodyClass}"><script>window.acquireVsCodeApi = () => ({ postMessage() {}, getState() { return {}; }, setState() {} });</script>`
    );
}

// --- 1. editor form contract and save round trip -----------------------------------

const editedFields = {
  title: "Edited during the risk workbench gate",
  reference: "ERR-9001",
  description: "Edited description.",
  status: "monitored",
  ownerTeam: "Digital Security",
  primaryCategoryId: "",
  response: "reduce",
  causes: "First cause\nSecond cause",
  consequences: "First consequence",
  assessmentBasis: "legacy",
  likelihood: "5",
  impact: "4",
  assessmentRationale: "Reassessed by the gate."
};

const browser = await chromium.launch({ headless: true });
const results = { axe: [], layout: [], performance: [], screenshots: [], formContract: undefined };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const typical = FIXTURES.find((fixture) => fixture.name === "typical");
  await page.goto("about:blank");
  await page.setContent(pageHtml(typical, "record", THEMES[0]), { waitUntil: "load" });

  const submitted = await page.evaluate((values) => {
    const form = document.querySelector("form.form-grid");
    if (!form) return { error: "no editor form" };
    for (const [name, value] of Object.entries(values)) {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) continue;
      if (field.tagName === "SELECT" && ![...field.options].some((option) => option.value === value)) continue;
      field.value = value;
    }
    const outsideForm = Object.keys(values).filter(
      (name) => !form.querySelector(`[name="${name}"]`) && document.querySelector(`[name="${name}"]`)
    );
    return { fields: Object.fromEntries(new FormData(form).entries()), outsideForm };
  }, editedFields);

  assert.ok(!submitted.error, submitted.error);
  assert.deepEqual(
    submitted.outsideForm,
    [],
    `these Risk editor fields render outside the form the Save button submits, so they can never be saved: ${submitted.outsideForm.join(", ")}`
  );
  for (const name of Object.keys(editedFields)) {
    assert.ok(name in submitted.fields, `the Risk editor form must submit ${name}`);
  }

  const saved = await buildUpdatedEntity(typical.risk, submitted.fields);
  assert.ok(saved, "buildUpdatedEntity rejected the form the Save button actually submits");
  assert.equal(saved.title, editedFields.title);
  assert.equal(saved.reference, editedFields.reference);
  assert.equal(saved.status, "monitored");
  assert.equal(saved.ownerTeam, editedFields.ownerTeam);
  assert.equal(saved.response, "reduce");
  assert.equal(saved.likelihood, 5);
  assert.equal(saved.impact, 4);
  assert.equal(saved.causes?.length, 2);
  assert.equal(saved.consequences?.length, 1);
  results.formContract = { submitted: Object.keys(submitted.fields).length, savedLikelihood: saved.likelihood };
  console.log(`ok  editor form submits ${Object.keys(submitted.fields).length} fields and saves without rejection`);

  // --- 1b. dirty draft is never discarded silently -------------------------------

  await page.goto("about:blank");
  await page.setContent(
    pageHtml(typical, "record", THEMES[0]).replace(
      "window.acquireVsCodeApi = () => ({ postMessage() {}",
      "window.__pspfPosted = []; window.acquireVsCodeApi = () => ({ postMessage(payload) { window.__pspfPosted.push(payload); }"
    ),
    { waitUntil: "load" }
  );
  const dirtyNavigation = await page.evaluate(() => {
    const form = document.querySelector("form.form-grid");
    const description = form.querySelector('[name="description"]');
    description.value = "Unsaved draft.";
    description.dispatchEvent(new Event("input", { bubbles: true }));
    window.__pspfPosted.length = 0;
    document.querySelector('.risk-workbench__toolbar [data-risk-view="matrix"]').click();
    return window.__pspfPosted.map((payload) => ({
      command: payload.command,
      pendingCommand: payload.pendingCommand,
      pendingRiskView: payload.pendingRiskView
    }));
  });
  const confirmation = dirtyNavigation.find((payload) => payload.command === "confirmDirtyNavigation");
  assert.ok(
    confirmation,
    `switching views with a dirty record must ask before discarding the draft; the webview posted ${JSON.stringify(dirtyNavigation)}`
  );
  assert.equal(confirmation.pendingCommand, "setRiskWorkbenchView");
  assert.equal(confirmation.pendingRiskView, "matrix");
  results.dirtyNavigation = confirmation;
  console.log("ok  a dirty record prompts before a view switch instead of discarding the draft");

  // --- 2. accessibility and layout ------------------------------------------------

  for (const fixture of FIXTURES) {
    const themes = fixture.name === "typical" ? THEMES : [THEMES[0]];
    for (const view of VIEWS) {
      for (const theme of themes) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto("about:blank");
        await page.setContent(pageHtml(fixture, view, theme), { waitUntil: "load" });
        const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const serious = scan.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical"
        );
        assert.equal(
          serious.length,
          0,
          `${fixture.name}/${view}/${theme.name} accessibility: ${JSON.stringify(serious.map((item) => ({ id: item.id, nodes: item.nodes.length })))}`
        );
        results.axe.push({ fixture: fixture.name, view, theme: theme.name, seriousOrCritical: 0 });
      }
    }
  }
  console.log(
    `ok  accessibility: ${results.axe.length} view/theme/fixture combinations, zero serious or critical findings`
  );

  for (const view of VIEWS) {
    for (const theme of THEMES) {
      for (const layout of LAYOUTS) {
        await page.setViewportSize({ width: layout.width, height: 900 });
        await page.goto("about:blank");
        await page.setContent(pageHtml(typical, view, theme), { waitUntil: "load" });
        if (layout.zoom !== 1) {
          await page.evaluate((zoom) => {
            document.documentElement.style.zoom = String(zoom);
          }, layout.zoom);
        }
        const measured = await page.evaluate(() => {
          const doc = document.documentElement;
          const focusable = document.querySelectorAll(
            "a[href], button, select, textarea, input:not([type=hidden]), summary, [tabindex]:not([tabindex='-1'])"
          );
          return {
            overflow: doc.scrollWidth - doc.clientWidth,
            focusable: focusable.length,
            hiddenFocusable: [...focusable].filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width === 0 && rect.height === 0;
            }).length
          };
        });
        assert.ok(
          measured.overflow <= 1,
          `${view}/${theme.name}/${layout.name} overflows horizontally by ${measured.overflow}px`
        );
        assert.equal(
          measured.hiddenFocusable,
          0,
          `${view}/${theme.name}/${layout.name} renders ${measured.hiddenFocusable} zero-size focusable controls`
        );
        results.layout.push({ view, theme: theme.name, layout: layout.name, ...measured });
        await mkdir(screenshotDirectory, { recursive: true });
        const screenshotName = `${view}-${theme.name}-${layout.name.replace(/[^a-z0-9-]/gi, "-")}.png`;
        const screenshotPath = join(screenshotDirectory, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.screenshots.push(screenshotPath);
      }
    }
  }
  console.log(
    `ok  layout: ${results.layout.length} view/theme/viewport combinations, no overflow or zero-size controls`
  );

  assert.deepEqual(pageErrors, [], `webview script errors: ${pageErrors.join("; ")}`);
} finally {
  await browser.close();
}

// --- 3. performance budgets (ADR 0098 D8.4) ----------------------------------------

const volume = FIXTURES.find((fixture) => fixture.name === "volume");
const riskCount = volume.entities.filter(isRisk).length;
assert.ok(riskCount >= 500, `the volume fixture must carry at least 500 risks, has ${riskCount}`);

const BUDGETS = { register: 250, matrix: 150 };
for (const [view, budget] of Object.entries(BUDGETS)) {
  renderRiskWorkbench(volume.risk, volume.entities, { riskView: view }); // warm up
  const samples = [];
  for (let run = 0; run < 5; run += 1) {
    const started = performance.now();
    renderRiskWorkbench(volume.risk, volume.entities, { riskView: view });
    samples.push(performance.now() - started);
  }
  const median = samples.sort((left, right) => left - right)[2];
  assert.ok(
    median <= budget,
    `${view} render took ${median.toFixed(1)}ms at ${riskCount} risks, over the ${budget}ms D8.4 budget`
  );
  results.performance.push({ view, riskCount, medianMs: Number(median.toFixed(1)), budgetMs: budget });
  console.log(`ok  ${view} render ${median.toFixed(1)}ms at ${riskCount} risks (budget ${budget}ms)`);
}

await mkdir(reportDirectory, { recursive: true });
const reportPath = join(reportDirectory, "risk-workbench-report.json");
await writeFile(
  reportPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), productVersion: packageJson.version, views: VIEWS, ...results }, null, 2)}\n`,
  "utf8"
);
console.log(`screenshot pack: ${screenshotDirectory} (${results.screenshots.length} images)`);
console.log(`report: ${reportPath}`);
