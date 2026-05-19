/**
 * `shellHtml()` returns a complete HTML document string for a PSPF webview
 * surface. The shape is intentionally narrow: callers pass their own
 * `<body>` content, plus any surface-specific options, and receive a
 * deterministic document with consistent doctype, meta tags, a single
 * inlined `<style>` block built from {@link tokensCss}, and an optional
 * Content-Security-Policy meta tag.
 *
 * CSP modes:
 *   - `strict`        - inline scripts must declare the supplied `nonce`;
 *                       no remote sources permitted. Use this once a
 *                       surface has been audited to no longer rely on
 *                       unrestricted inline scripts.
 *   - `nonce-styles`  - styles inline (so the shell tokens still apply);
 *                       scripts require nonce. Useful interim posture.
 *   - `relaxed`       - inline scripts and styles permitted. Matches the
 *                       current legacy posture of Workshop/Shop webviews
 *                       and is the default so the shell can be adopted
 *                       without immediately tightening security.
 *   - `none`          - emit no CSP meta tag. Use only for static
 *                       marketing pages served behind a host that sets a
 *                       stronger CSP via HTTP headers.
 */

import { tokensCss, type ShellSurface } from "./tokens.js";

export type CspMode = "strict" | "nonce-styles" | "relaxed" | "none";
export type PillTone = "primary" | "accent" | "warn" | "danger" | "ok" | "neutral";
export type BannerTone = "info" | "warn" | "danger" | "ok";

export interface ShellHtmlOptions {
  /** Surface variant used to select the token palette. */
  surface: ShellSurface;
  /** Document title; emitted verbatim inside `<title>`. */
  title: string;
  /** HTML fragment placed inside `<body>`. Must already be safely encoded. */
  body: string;
  /** Optional CSP mode. Defaults to `relaxed` for ease of migration. */
  csp?: CspMode;
  /**
   * Nonce required when `csp` is `strict` or `nonce-styles`. Callers
   * should generate this via {@link cspNonce} and apply the same value
   * to inline `<script nonce>` tags in `body` and `extraScript`.
   */
  nonce?: string;
  /** Optional `<html lang>` value. Defaults to `en-AU`. */
  lang?: string;
  /**
   * Optional sensitivity banner text rendered at the top of `<body>`.
   * If omitted, no banner is shown.
   */
  sensitivityBanner?: string;
  /** Optional extra CSS appended after the shared tokens block. */
  extraStyle?: string;
  /** Optional extra `<head>` content (e.g. additional `<meta>` tags). */
  extraHead?: string;
}

/**
 * Generates a 128-bit random nonce, base64url-encoded, suitable for
 * the `nonce` attribute of inline `<script>` tags under a strict CSP.
 *
 * Falls back to `Math.random` if `globalThis.crypto` is unavailable
 * (only in degraded test runners; production paths always have WebCrypto).
 */
export function cspNonce(): string {
  const bytes = new Uint8Array(16);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // btoa is available in Node 22 and in all webview runtimes we target.
  const b64 = (globalThis as { btoa?: (s: string) => string }).btoa
    ? (globalThis as { btoa: (s: string) => string }).btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Minimal HTML-text escape for content placed inside element text nodes
 * (NOT attribute values). Sufficient for the few static labels the
 * shell injects itself; callers are expected to encode their own body.
 */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildCspMeta(mode: CspMode, nonce: string | undefined): string {
  switch (mode) {
    case "none":
      return "";
    case "strict":
      if (!nonce) {
        throw new Error("shellHtml: csp 'strict' requires a nonce");
      }
      return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'self' 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src data:;" />`;
    case "nonce-styles":
      if (!nonce) {
        throw new Error("shellHtml: csp 'nonce-styles' requires a nonce");
      }
      return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'self' 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src data:;" />`;
    case "relaxed":
    default:
      return "";
  }
}

/**
 * Renders a `<span class="pspf-pill">` containing the supplied version
 * string, with an optional accent variant. Pure HTML helper - safe to
 * concatenate into a `body` argument.
 */
export function versionPill(version: string, variant?: "accent" | "warn" | "ok"): string {
  const modifier = variant ? ` pspf-pill--${variant}` : "";
  return `<span class="pspf-pill${modifier}">v${escapeText(version)}</span>`;
}

export function pill(label: string, tone?: PillTone): string {
  const modifier = tone ? ` pspf-pill--${tone}` : "";
  return `<span class="pspf-pill${modifier}">${escapeText(label)}</span>`;
}

export function bannerHtml(message: string, tone: BannerTone = "info", role = "note"): string {
  const modifier = tone === "info" ? "" : ` pspf-banner--${tone}`;
  return `<div class="pspf-banner${modifier}" role="${escapeAttribute(role)}">${escapeText(message)}</div>`;
}

export function shellHtml(options: ShellHtmlOptions): string {
  const {
    surface,
    title,
    body,
    csp = "relaxed",
    nonce,
    lang = "en-AU",
    sensitivityBanner,
    extraStyle = "",
    extraHead = ""
  } = options;

  const cssText = tokensCss(surface) + (extraStyle ? "\n" + extraStyle : "");
  const cspMeta = buildCspMeta(csp, nonce);
  const banner = sensitivityBanner
    ? `<div class="pspf-sensitivity-banner" role="note">${escapeText(sensitivityBanner)}</div>`
    : "";

  return `<!doctype html>
<html lang="${escapeText(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${cspMeta}
    <title>${escapeText(title)}</title>
    <style>${cssText}</style>
    ${extraHead}
  </head>
  <body>
    <a class="pspf-skip-link" href="#pspf-main">Skip to main content</a>
    ${banner}
    <main id="pspf-main">
${body}
    </main>
  </body>
</html>`;
}
