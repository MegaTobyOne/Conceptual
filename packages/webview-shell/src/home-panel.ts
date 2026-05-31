/**
 * Shared "Home" webview shell used by Workshop, Shop, and Pub sidebar
 * panels. The goal of this helper is to give every PSPF extension the
 * same chrome — header bar, sensitivity banner, anchor navigation, and
 * footer — while letting each extension provide its own body content
 * and a distinctive accent colour.
 *
 * Each extension supplies an `accent` value that drives the header
 * stripe, eyebrow text, focus rings, and hover wash. The bodies use a
 * shared set of class names (`section`, `eyebrow`, `metric`,
 * `action-list`, `button-title`, `button-description`) so we don't end
 * up with three drifting visual languages.
 */

import { tokensCss } from "./tokens.js";
import { commandButtonAcknowledgementScript } from "./interactions.js";

export type HomePanelAccent = "teal" | "blue" | "amber" | "red";

export interface HomePanelNavItem {
  /** Section ID inside the body, without leading `#`. */
  readonly href: string;
  /** Short label shown in the nav row. */
  readonly label: string;
}

export interface HomePanelOptions {
  /** Short extension label, e.g. "PSPF Workshop". */
  readonly extensionLabel: string;
  /** Document `<title>`. */
  readonly title: string;
  /** Short subtitle shown next to the version, e.g. "System of record". */
  readonly tagline: string;
  /** Slice/extension version string, displayed as `v…`. */
  readonly version: string;
  /** Accent colour, see {@link HomePanelAccent}. */
  readonly accent: HomePanelAccent;
  /** Sensitivity banner text shown under the header. */
  readonly sensitivityBanner: string;
  /** Optional anchor nav links rendered as small pills under the banner. */
  readonly nav?: readonly HomePanelNavItem[];
  /** Body fragment placed inside `<main>`. Must already be encoded. */
  readonly body: string;
  /**
   * Optional footer line; defaults to the standard "Local-first PSPF
   * tooling" sentence. Pass an empty string to suppress.
   */
  readonly footer?: string;
}

interface AccentPalette {
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentStrong: string;
  readonly accentInk: string;
}

const ACCENTS: Record<HomePanelAccent, AccentPalette> = {
  teal: {
    accent: "#0f766e",
    accentSoft: "rgba(15, 118, 110, 0.12)",
    accentStrong: "rgba(15, 118, 110, 0.28)",
    accentInk: "#5bb8b0"
  },
  blue: {
    accent: "#2563eb",
    accentSoft: "rgba(37, 99, 235, 0.13)",
    accentStrong: "rgba(37, 99, 235, 0.28)",
    accentInk: "#8cadde"
  },
  amber: {
    accent: "#9a5c00",
    accentSoft: "rgba(154, 92, 0, 0.16)",
    accentStrong: "rgba(154, 92, 0, 0.32)",
    accentInk: "#d19b46"
  },
  red: {
    accent: "#9c315f",
    accentSoft: "rgba(156, 49, 95, 0.14)",
    accentStrong: "rgba(156, 49, 95, 0.30)",
    accentInk: "#d77aa2"
  }
};

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DEFAULT_FOOTER =
  "Local-first PSPF tooling. Workspace data stays on this machine until you export the master bundle.";

function paletteCss(palette: AccentPalette): string {
  return `
    --pspf-home-accent: ${palette.accent};
    --pspf-home-accent-soft: ${palette.accentSoft};
    --pspf-home-accent-strong: ${palette.accentStrong};
    --pspf-home-accent-ink: ${palette.accentInk};
  `;
}

function navHtml(nav: readonly HomePanelNavItem[] | undefined): string {
  if (!nav || nav.length === 0) {
    return "";
  }
  const items = nav
    .map((item) => `<a class="home-nav__item" href="#${escapeAttr(item.href)}">${escapeText(item.label)}</a>`)
    .join("");
  return `<nav class="home-nav" aria-label="Sections">${items}</nav>`;
}

/**
 * Render a complete VS Code sidebar webview document with the shared
 * PSPF Home chrome. The caller supplies the section bodies; everything
 * else (head, header, banner, nav, footer, script bridge) is identical
 * across extensions so the surfaces feel like one product family.
 */
export function homePanelShellHtml(options: HomePanelOptions): string {
  const palette = ACCENTS[options.accent];
  const footer = options.footer ?? DEFAULT_FOOTER;
  const tokens = tokensCss("extension");

  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeText(options.title)}</title>
  <style>
    ${tokens}
    :root { color-scheme: light dark; ${paletteCss(palette)} }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background:
        radial-gradient(circle at top left, var(--pspf-home-accent-soft), transparent 18rem),
        var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-feature-settings: "ss01", "cv01";
    }
    .home-header {
      display: grid;
      gap: 2px;
      padding: var(--pspf-gap-md, 12px);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--pspf-border));
      background: linear-gradient(135deg, var(--pspf-home-accent-strong), transparent 78%);
      border-top: 3px solid var(--pspf-home-accent);
    }
    .home-header strong { font-size: 15px; letter-spacing: 0.01em; }
    .home-header span { color: var(--vscode-descriptionForeground); font-size: 11.5px; }
    .home-sensitivity {
      margin: 0;
      padding: 6px var(--pspf-gap-md, 12px);
      border-bottom: 1px solid var(--pspf-border);
      background: color-mix(in srgb, var(--pspf-home-accent-soft) 80%, transparent);
      color: var(--vscode-descriptionForeground);
      font-size: 11.5px;
    }
    .home-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px var(--pspf-gap-md, 12px);
      border-bottom: 1px solid var(--pspf-border);
      background: var(--vscode-sideBar-background);
    }
    .home-nav__item {
      border: 1px solid var(--pspf-border);
      border-radius: var(--pspf-radius-pill, 999px);
      padding: 3px 9px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      font-size: 11px;
      text-decoration: none;
    }
    .home-nav__item:hover {
      border-color: var(--pspf-home-accent);
      color: var(--vscode-foreground);
      background: color-mix(in srgb, var(--pspf-home-accent) 10%, var(--vscode-editor-background));
    }
    .home-nav__item:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    main { padding: var(--pspf-gap-md, 12px); }
    section {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--pspf-border));
      border-radius: var(--pspf-radius, 8px);
      padding: var(--pspf-gap, 10px);
      margin-bottom: var(--pspf-gap, 10px);
      background: var(--vscode-editor-background);
      scroll-margin-top: 12px;
    }
    section + section { margin-top: 0; }
    section.hero-section {
      border-color: color-mix(in srgb, var(--pspf-home-accent) 45%, var(--pspf-border));
      background: linear-gradient(180deg, color-mix(in srgb, var(--pspf-home-accent) 12%, var(--vscode-editor-background)), var(--vscode-editor-background));
    }
    .eyebrow {
      margin: 0 0 6px;
      color: var(--pspf-home-accent-ink, var(--pspf-home-accent));
      font-size: var(--pspf-type-label, 10.5px);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: var(--pspf-letter-label, 0.06em);
    }
    h2 {
      font-size: 12.5px;
      line-height: 1.25;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .home-posture {
      margin: 0 0 10px;
      color: var(--vscode-foreground);
      font-size: 12.5px;
      line-height: 1.4;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .metric {
      border: 1px solid var(--pspf-border);
      border-radius: var(--pspf-radius, 8px);
      padding: var(--pspf-pad-sm, 8px) var(--pspf-input-pad-x, 8px);
      background: var(--pspf-surface-strong, var(--vscode-editor-background));
    }
    .metric span {
      color: var(--pspf-muted, var(--vscode-descriptionForeground));
      display: block;
      font-size: var(--pspf-type-label, 10.5px);
      text-transform: uppercase;
      letter-spacing: var(--pspf-letter-label, 0.06em);
    }
    .metric strong {
      display: block;
      font-size: var(--pspf-type-page-title, 18px);
      line-height: 1.1;
      margin-top: 3px;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    .action-list { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .action-list.compact { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
    button {
      width: 100%;
      min-width: 0;
      text-align: left;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: var(--pspf-radius-sm, 6px);
      padding: 8px 10px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
      border-color: color-mix(in srgb, var(--pspf-home-accent) 40%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .button-title { display: block; overflow-wrap: anywhere; font-weight: 500; }
    .button-description {
      display: block;
      margin-top: 2px;
      color: var(--vscode-button-secondaryForeground, var(--vscode-descriptionForeground));
      font-size: 11px;
      line-height: 1.35;
      font-weight: 400;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--pspf-border); vertical-align: top; }
    th { color: var(--vscode-descriptionForeground); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag, .badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--pspf-border);
      border-radius: var(--pspf-radius-pill, 999px);
      padding: 3px 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--pspf-home-accent) 8%, var(--vscode-editor-background));
      white-space: nowrap;
    }
    .home-footer {
      padding: 8px var(--pspf-gap-md, 12px) 14px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.45;
      border-top: 1px solid var(--pspf-border);
    }
  </style>
</head>
<body>
  <header class="home-header">
    <strong>${escapeText(options.extensionLabel)}</strong>
    <span>${escapeText(options.tagline)} · v${escapeText(options.version)}</span>
  </header>
  <div class="home-sensitivity" role="note">${escapeText(options.sensitivityBanner)}</div>
  ${navHtml(options.nav)}
  <main>${options.body}</main>
  ${footer ? `<footer class="home-footer">${escapeText(footer)}</footer>` : ""}
  <script>
    const vscode = acquireVsCodeApi();
    ${commandButtonAcknowledgementScript}
    document.querySelectorAll("button[data-command]").forEach((button) => {
      button.addEventListener("click", () => {
        pspfAcknowledgeCommandButton(button);
        vscode.postMessage({ command: button.dataset.command });
      });
    });
  </script>
</body>
</html>`;
}

/** Renders a metric tile for the shared Home grid. */
export function homeMetricCard(label: string, value: number | string): string {
  return `<div class="metric"><span>${escapeText(label)}</span><strong>${escapeText(String(value))}</strong></div>`;
}

/**
 * Renders a click-to-run command button consistent with the shared
 * Home shell. The wire-format is a `data-command` attribute; the
 * shell's bundled script forwards clicks via `vscode.postMessage`.
 */
export function homeActionButton(command: string, text: string, description?: string): string {
  const descriptionHtml = description ? `<span class="button-description">${escapeText(description)}</span>` : "";
  return `<button type="button" data-command="${escapeAttr(command)}"><span class="button-title">${escapeText(text)}</span>${descriptionHtml}</button>`;
}

/**
 * Renders a standard panel section with an eyebrow, heading, and body.
 * Use `id` so the shared nav anchors resolve.
 */
export interface HomeSection {
  readonly id?: string;
  readonly eyebrow?: string;
  readonly heading: string;
  readonly body: string;
  readonly hero?: boolean;
}

export function homeSection(section: HomeSection): string {
  const idAttr = section.id ? ` id="${escapeAttr(section.id)}"` : "";
  const className = section.hero ? "hero-section" : "";
  const eyebrow = section.eyebrow ? `<p class="eyebrow">${escapeText(section.eyebrow)}</p>` : "";
  return `<section${idAttr} class="${className}">${eyebrow}<h2>${escapeText(section.heading)}</h2>${section.body}</section>`;
}

/** A single label/value tile shown in the shared posture header strip. */
export interface HomePostureMetric {
  readonly label: string;
  readonly value: number | string;
}

export interface HomePostureHeaderOptions {
  /** Section anchor id, e.g. "overview". */
  readonly id?: string;
  /** Small uppercase eyebrow above the title, e.g. "Commercial planning". */
  readonly eyebrow?: string;
  /** Prominent product/workspace title — this leads, never an explainer paragraph. */
  readonly title: string;
  /**
   * One short, plain-language posture line, e.g.
   * "12 people across 4 teams". Kept to a single sentence so the header
   * reads as status, not prose.
   */
  readonly posture?: string;
  /** Quick-glance metric tiles rendered in the shared grid. */
  readonly metrics?: readonly HomePostureMetric[];
}

/**
 * Renders the canonical title-first Home header used across every PSPF
 * extension sidebar. Unlike a free-form hero section, this deliberately
 * leads with a bold title and an at-a-glance posture line plus metric
 * tiles — never an explanatory paragraph — so the surfaces feel like one
 * consistent product family.
 */
export function homePostureHeader(options: HomePostureHeaderOptions): string {
  const posture = options.posture ? `<p class="home-posture">${escapeText(options.posture)}</p>` : "";
  const metrics =
    options.metrics && options.metrics.length > 0
      ? `<div class="grid" role="list">${options.metrics
          .map((metric) => homeMetricCard(metric.label, metric.value))
          .join("")}</div>`
      : "";
  return homeSection({
    id: options.id ?? "overview",
    hero: true,
    eyebrow: options.eyebrow,
    heading: options.title,
    body: `${posture}${metrics}`
  });
}
