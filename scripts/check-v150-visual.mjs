import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import {
  attentionListHtml,
  disclosureHtml,
  homePanelShellHtml,
  lensSelectorHtml,
  metricStripHtml,
  pageHeaderHtml,
  traceChainHtml,
  trustChipsHtml
} from "../packages/webview-shell/dist/index.js";

const products = ["core", "assurance", "workshop", "shop", "pub", "explorer"];
const themes = [
  {
    name: "dark",
    bodyClass: "vscode-dark",
    width: 390,
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
    width: 768,
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
    width: 320,
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

function fixtureBody(product) {
  return `<style>main { max-width: 920px; margin: 0 auto; } .fixture-actions { display: flex; gap: 8px; flex-wrap: wrap; }</style>
    <section class="hero-section" id="overview">
      ${pageHeaderHtml({
        eyebrow: `${product} decision surface`,
        title: `PSPF ${product}`,
        description: "Review current posture and continue with the next evidence-backed action."
      })}
      ${trustChipsHtml([
        { label: "OFFICIAL: Sensitive", strong: true },
        { label: "Local workspace" },
        { label: "Current snapshot" }
      ])}
      ${lensSelectorHtml({ lens: "ciso", command: "selectLens" })}
      ${metricStripHtml([
        { label: "Requirements", value: 108 },
        { label: "Needs attention", value: 4 },
        { label: "Evidence current", value: "92%" }
      ])}
    </section>
    <section id="attention">
      <h2>Needs attention</h2>
      ${attentionListHtml([
        {
          title: "Evidence review due",
          detail: "Confirm the linked record before the next decision.",
          tone: "warning",
          actionHtml: '<button type="button" data-command="review">Review</button>'
        },
        { title: "Trace complete", detail: "Requirement, evidence, and action are linked.", tone: "ok" }
      ])}
      ${traceChainHtml([
        { marker: "R", title: "Requirement", detail: "GOV-001" },
        { marker: "E", title: "Evidence", detail: "Policy record" },
        { marker: "A", title: "Action", detail: "Annual review" }
      ])}
      ${disclosureHtml({
        summary: "Advanced fields",
        bodyHtml: "<p>Provenance and compatibility details remain available.</p>",
        open: product === "assurance"
      })}
    </section>`;
}

function vscodeVariables(theme) {
  const value = theme.variables;
  return `<style>:root {
    --vscode-foreground: ${value.foreground};
    --vscode-descriptionForeground: ${value.muted};
    --vscode-sideBar-background: ${value.surface};
    --vscode-editor-background: ${value.elevated};
    --vscode-sideBarSectionHeader-border: ${value.border};
    --vscode-panel-border: ${value.border};
    --vscode-button-background: ${value.button};
    --vscode-button-foreground: ${value.buttonForeground};
    --vscode-button-hoverBackground: ${value.button};
    --vscode-button-border: ${value.border};
    --vscode-focusBorder: ${value.focus};
  }</style>`;
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const theme of themes) {
    await page.setViewportSize({ width: theme.width, height: 800 });
    for (const product of products) {
      const shell = homePanelShellHtml({
        extensionLabel: `PSPF ${product}`,
        title: `PSPF ${product} fixture`,
        tagline: "v1.50 fixture",
        version: "1.51.0",
        product,
        sensitivityBanner: "OFFICIAL: Sensitive · Local-first fixture.",
        nav: [
          { href: "overview", label: "Overview" },
          { href: "attention", label: "Attention" }
        ],
        body: fixtureBody(product)
      })
        .replace("</head>", `${vscodeVariables(theme)}</head>`)
        .replace(
          "<body>",
          `<body class="${theme.bodyClass}"><script>window.acquireVsCodeApi = () => ({ postMessage() {} });</script>`
        );
      await page.setContent(shell, { waitUntil: "load" });

      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = scan.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );
      const overflow = await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth
      );
      const focusableCount = await page.locator("a, button, select, summary").count();
      assert.equal(serious.length, 0, `${product}/${theme.name} accessibility: ${JSON.stringify(serious)}`);
      assert.ok(overflow <= 1, `${product}/${theme.name} horizontal overflow: ${overflow}px`);
      assert.ok(focusableCount >= 5, `${product}/${theme.name} should retain keyboard-operable controls`);
      results.push({ product, theme: theme.name, seriousOrCritical: serious.length, overflow, focusableCount });
    }
    const screenshot = await page.screenshot({ animations: "disabled" });
    assert.ok(screenshot.byteLength > 10_000, `${theme.name} fixture screenshot should be nonblank`);
  }
} finally {
  await browser.close();
}

const reportDirectory = join(process.cwd(), ".tmp", "accessibility");
const reportPath = join(reportDirectory, "v1.50-extension-visual-report.json");
await mkdir(reportDirectory, { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), fixtures: results }, null, 2)}\n`,
  "utf8"
);
console.log(`ok v1.50 extension fixtures: ${results.length} product/theme combinations`);
console.log(`report: ${reportPath}`);
