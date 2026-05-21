/**
 * Shared design tokens for PSPF webview surfaces.
 *
 * All tokens layer on top of VS Code's theme variables so the result feels
 * native to whichever colour theme the operator has chosen. Where a token
 * wraps a VS Code variable, a sensible fallback is provided for safety on
 * older clients or if the variable is undefined.
 *
 * Surface variants:
 *   - `extension`  - panels and views inside the host extension (Workshop, Shop, Core)
 *   - `explorer`   - the web Explorer surface (runs outside VS Code)
 *   - `marketing`  - lightweight marketing pages that mimic the extension look
 *
 * The output is plain CSS text intended to be inlined into a single
 * `<style>` block emitted by `shellHtml()`. Inlining keeps webviews
 * self-contained and avoids loading external stylesheets that would
 * require CSP `style-src` exemptions.
 */

export type ShellSurface = "extension" | "explorer" | "marketing";

const SHARED_ROOT_TOKENS = `
:root {
  --pspf-radius: 6px;
  --pspf-radius-sm: 4px;
  --pspf-radius-lg: 10px;
  --pspf-radius-pill: 999px;
  --pspf-pad: 14px;
  --pspf-pad-sm: 8px;
  --pspf-pad-lg: 24px;
  --pspf-gap: 10px;
  --pspf-gap-xs: 4px;
  --pspf-gap-sm: 6px;
  --pspf-gap-md: 12px;
  --pspf-gap-lg: 18px;

  --pspf-type-label: 11px;
  --pspf-type-body: 13px;
  --pspf-type-card-title: 14px;
  --pspf-type-section-title: 16px;
  --pspf-type-page-title: 22px;
  --pspf-line-tight: 1.25;
  --pspf-line-body: 1.45;
  --pspf-letter-label: 0.04em;

  --pspf-button-pad-y: 6px;
  --pspf-button-pad-x: 11px;
  --pspf-input-pad-y: 6px;
  --pspf-input-pad-x: 9px;
  --pspf-pill-pad-y: 2px;
  --pspf-pill-pad-x: 8px;
  --pspf-table-cell-pad-y: 8px;
  --pspf-table-cell-pad-x: 10px;

  --pspf-text: var(--vscode-foreground, #1f2328);
  --pspf-muted: var(--vscode-descriptionForeground, #59636e);
  --pspf-surface: var(--vscode-editor-background, #ffffff);
  --pspf-surface-strong: var(--vscode-input-background, var(--vscode-editor-background, #f6f8fa));
  --pspf-surface-soft: var(--vscode-sideBar-background, var(--vscode-editor-background, #f6f8fa));
  --pspf-border: var(--vscode-panel-border, var(--vscode-input-border, #d0d7de));
  --pspf-border-strong: var(--vscode-sideBarSectionHeader-border, var(--pspf-border));
  --pspf-focus: var(--vscode-focusBorder, #0969da);
  --pspf-primary: #0f766e;
  --pspf-primary-soft: rgba(15, 118, 110, 0.14);
  --pspf-link: var(--vscode-textLink-foreground, #0f766e);
  --pspf-accent: #2563eb;
  --pspf-accent-soft: rgba(37, 99, 235, 0.13);
  --pspf-warn: #d97706;
  --pspf-warn-soft: rgba(217, 119, 6, 0.18);
  --pspf-danger: #b91c1c;
  --pspf-danger-soft: rgba(185, 28, 28, 0.14);
  --pspf-ok: #15803d;
  --pspf-ok-soft: rgba(21, 128, 61, 0.14);
  --pspf-neutral-soft: rgba(89, 99, 110, 0.12);
  --pspf-shadow-raised: 0 10px 30px rgba(0, 0, 0, 0.16);
  --pspf-motion-fast: 80ms;
  --pspf-motion-standard: 140ms;
  --pspf-motion-responsive: 180ms;
  --pspf-ease-standard: ease;
  --pspf-ease-responsive: cubic-bezier(0.16, 1, 0.3, 1);
  --pspf-button-active-scale: 0.97;
  --pspf-spinner-size: 14px;
  --pspf-skeleton-wave-duration: 1.4s;
}
`;

const EXPLORER_FALLBACK_TOKENS = `
:root {
  /*
   * The Explorer surface runs outside the VS Code shell so the
   * --vscode-* fallbacks above provide the active palette. Tighten
   * the typographic scale slightly so dense relationship views read
   * comfortably on a full screen.
   */
  --pspf-pad: 16px;
  --pspf-gap: 12px;
}
`;

const MARKETING_TOKENS = `
:root {
  --pspf-pad: 24px;
  --pspf-gap: 18px;
  --pspf-text: #1f2328;
  --pspf-muted: #59636e;
  --pspf-surface: #ffffff;
  --pspf-surface-strong: #f6f8fa;
  --pspf-surface-soft: #f6f8fa;
  --pspf-border: #d0d7de;
  --pspf-border-strong: #d0d7de;
}
@media (prefers-color-scheme: dark) {
  :root {
    --pspf-text: #e6edf3;
    --pspf-muted: #9198a1;
    --pspf-surface: #0d1117;
    --pspf-surface-strong: #161b22;
    --pspf-surface-soft: #161b22;
    --pspf-border: #30363d;
    --pspf-border-strong: #30363d;
  }
}
`;

const BASE_RULES = `
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: var(--pspf-pad);
  color: var(--pspf-text);
  background: var(--pspf-surface);
  font-family: var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--pspf-type-body);
  line-height: var(--pspf-line-body);
  font-feature-settings: "ss01", "cv01";
}
h1, h2, h3 { margin: 0 0 var(--pspf-gap-sm) 0; font-weight: 600; line-height: 1.25; }
h1 { font-size: 16px; }
h2 { font-size: 14px; }
h3 { font-size: 13px; }
p { margin: 0 0 var(--pspf-gap-sm) 0; }
a { color: var(--pspf-link); }
a:focus-visible { outline: 2px solid var(--pspf-focus); outline-offset: 2px; border-radius: 2px; }
code, kbd, samp { font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Consolas, monospace); font-size: 12px; }

button {
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: var(--pspf-radius-sm);
  background: var(--vscode-button-background, var(--pspf-accent));
  color: var(--vscode-button-foreground, #ffffff);
  padding: var(--pspf-button-pad-y) var(--pspf-button-pad-x);
  font: inherit;
  cursor: pointer;
  transform-origin: center;
  transition: background-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), border-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), opacity var(--pspf-motion-responsive) var(--pspf-ease-responsive), transform var(--pspf-motion-responsive) var(--pspf-ease-responsive);
}
button:hover { background: var(--vscode-button-hoverBackground, var(--pspf-accent)); }
button:active:not(:disabled):not([aria-disabled="true"]) { transform: scale(var(--pspf-button-active-scale)); }
button:focus-visible { outline: 2px solid var(--pspf-focus); outline-offset: 1px; }
button:disabled,
button[aria-disabled="true"] { opacity: 0.55; cursor: not-allowed; }
button[aria-busy="true"],
button[data-state="saving"] { opacity: 0.78; cursor: progress; }
button[aria-busy="true"]::after,
button[data-state="saving"]::after {
  content: "";
  display: inline-block;
  width: var(--pspf-spinner-size);
  height: var(--pspf-spinner-size);
  margin-left: var(--pspf-gap-sm);
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: pspf-spinner-spin 800ms linear infinite;
  vertical-align: text-bottom;
}
button[data-state="saved"] { opacity: 0.86; }

.pspf-button,
a.pspf-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--pspf-gap-sm);
  min-height: 30px;
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: var(--pspf-radius-sm);
  background: var(--vscode-button-background, var(--pspf-accent));
  color: var(--vscode-button-foreground, #ffffff);
  padding: var(--pspf-button-pad-y) var(--pspf-button-pad-x);
  font: inherit;
  font-weight: 600;
  line-height: var(--pspf-line-tight);
  text-decoration: none;
  cursor: pointer;
  transform-origin: center;
  transition: background-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), border-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), opacity var(--pspf-motion-responsive) var(--pspf-ease-responsive), transform var(--pspf-motion-responsive) var(--pspf-ease-responsive);
}
.pspf-button:hover,
a.pspf-button:hover { background: var(--vscode-button-hoverBackground, var(--pspf-accent)); }
.pspf-button:active:not(:disabled):not([aria-disabled="true"]),
a.pspf-button:active:not([aria-disabled="true"]) { transform: scale(var(--pspf-button-active-scale)); }
.pspf-button:focus-visible,
a.pspf-button:focus-visible { outline: 2px solid var(--pspf-focus); outline-offset: 1px; }
.pspf-button[aria-disabled="true"],
.pspf-button:disabled { opacity: 0.55; cursor: not-allowed; }
.pspf-button[aria-busy="true"],
.pspf-button[data-state="saving"] { opacity: 0.78; cursor: progress; }
.pspf-button[aria-busy="true"]::after,
.pspf-button[data-state="saving"]::after {
  content: "";
  display: inline-block;
  width: var(--pspf-spinner-size);
  height: var(--pspf-spinner-size);
  margin-left: var(--pspf-gap-sm);
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: pspf-spinner-spin 800ms linear infinite;
  vertical-align: text-bottom;
}
.pspf-button[data-state="saved"] { opacity: 0.86; }
.pspf-button--secondary,
a.pspf-button--secondary {
  border-color: var(--pspf-border);
  background: var(--vscode-button-secondaryBackground, var(--pspf-surface-strong));
  color: var(--vscode-button-secondaryForeground, var(--pspf-text));
}
.pspf-button--secondary:hover,
a.pspf-button--secondary:hover { background: var(--vscode-button-secondaryHoverBackground, var(--pspf-surface-soft)); }
.pspf-button--small,
a.pspf-button--small {
  min-height: 26px;
  padding: 4px 8px;
  font-size: var(--pspf-type-label);
}

input, select, textarea {
  box-sizing: border-box;
  border: 1px solid var(--vscode-input-border, var(--pspf-border));
  border-radius: var(--pspf-radius-sm);
  background: var(--vscode-input-background, var(--pspf-surface-strong));
  color: var(--vscode-input-foreground, var(--pspf-text));
  padding: var(--pspf-input-pad-y) var(--pspf-input-pad-x);
  font: inherit;
  transition: background-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), border-color var(--pspf-motion-responsive) var(--pspf-ease-responsive), box-shadow var(--pspf-motion-responsive) var(--pspf-ease-responsive);
}
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--pspf-focus);
  outline-offset: -1px;
  border-color: transparent;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pspf-focus) 18%, transparent);
}
input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"] {
  border-color: var(--pspf-danger);
  box-shadow: inset 3px 0 0 var(--pspf-danger);
}
input[aria-invalid="false"], select[aria-invalid="false"], textarea[aria-invalid="false"] {
  border-color: color-mix(in srgb, var(--pspf-ok) 70%, var(--pspf-border));
}

.pspf-field { display: grid; gap: var(--pspf-gap-xs); position: relative; }
.pspf-field__label {
  color: var(--pspf-muted);
  font-size: var(--pspf-type-label);
  font-weight: 700;
  letter-spacing: var(--pspf-letter-label);
  text-transform: uppercase;
  transform-origin: left center;
  transition: color var(--pspf-motion-responsive) var(--pspf-ease-responsive), transform var(--pspf-motion-responsive) var(--pspf-ease-responsive);
}
.pspf-field:focus-within .pspf-field__label { color: var(--pspf-focus); transform: translateY(-1px); }
.pspf-field__control { width: 100%; }
.pspf-field__message { min-height: 1.4em; color: var(--pspf-muted); font-size: var(--pspf-type-label); }
.pspf-field:has([aria-invalid="true"]) .pspf-field__label,
.pspf-field__message--error { color: var(--pspf-danger); }
.pspf-field:has([aria-invalid="false"]) .pspf-field__label,
.pspf-field__message--success { color: var(--pspf-ok); }

.pspf-muted { color: var(--pspf-muted); }
.pspf-eyebrow {
  color: var(--pspf-muted);
  font-size: var(--pspf-type-label);
  font-weight: 700;
  letter-spacing: var(--pspf-letter-label);
  text-transform: uppercase;
}
.pspf-section {
  border: 1px solid var(--pspf-border-strong);
  border-radius: var(--pspf-radius);
  background: var(--pspf-surface);
  padding: var(--pspf-gap);
  margin-bottom: var(--pspf-gap);
}
.pspf-metric {
  border: 1px solid var(--pspf-border);
  border-radius: var(--pspf-radius);
  background: var(--pspf-surface-strong);
  padding: var(--pspf-gap-sm) var(--pspf-gap);
}
.pspf-metric strong {
  display: block;
  color: var(--pspf-text);
  font-size: var(--pspf-type-page-title);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.pspf-metric span { color: var(--pspf-muted); font-size: var(--pspf-type-label); }
.pspf-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--pspf-border);
  border-radius: var(--pspf-radius-pill);
  padding: var(--pspf-pill-pad-y) var(--pspf-pill-pad-x);
  color: var(--pspf-muted);
  background: var(--pspf-surface-strong);
  font-size: var(--pspf-type-label);
  line-height: 1.4;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.pspf-pill--primary { color: var(--pspf-primary); border-color: var(--pspf-primary); background: var(--pspf-primary-soft); }
.pspf-pill--accent { color: var(--pspf-accent); border-color: var(--pspf-accent); background: var(--pspf-accent-soft); }
.pspf-pill--warn { color: var(--pspf-warn); border-color: var(--pspf-warn); background: var(--pspf-warn-soft); }
.pspf-pill--danger { color: var(--pspf-danger); border-color: var(--pspf-danger); background: var(--pspf-danger-soft); }
.pspf-pill--ok { color: var(--pspf-ok); border-color: var(--pspf-ok); background: var(--pspf-ok-soft); }
.pspf-pill--neutral { background: var(--pspf-neutral-soft); }

.pspf-banner {
  border: 1px solid var(--pspf-border);
  border-left: 3px solid var(--pspf-primary);
  border-radius: var(--pspf-radius);
  background: var(--pspf-surface-strong);
  color: var(--pspf-text);
  padding: var(--pspf-gap) var(--pspf-pad);
  font-size: var(--pspf-type-body);
}
.pspf-banner--warn { border-left-color: var(--pspf-warn); background: var(--pspf-warn-soft); }
.pspf-banner--danger { border-left-color: var(--pspf-danger); background: var(--pspf-danger-soft); }
.pspf-banner--ok { border-left-color: var(--pspf-ok); background: var(--pspf-ok-soft); }

.pspf-sensitivity-banner {
  background: var(--pspf-warn-soft);
  border-bottom: 1px solid var(--pspf-warn);
  color: var(--pspf-text);
  padding: 6px var(--pspf-pad);
  font-size: var(--pspf-type-label);
  font-weight: 600;
  letter-spacing: 0.02em;
  margin: calc(-1 * var(--pspf-pad)) calc(-1 * var(--pspf-pad)) var(--pspf-gap) calc(-1 * var(--pspf-pad));
}

.pspf-empty,
.pspf-error {
  border: 1px solid var(--pspf-border);
  border-radius: var(--pspf-radius);
  background: var(--pspf-surface-strong);
  color: var(--pspf-muted);
  padding: var(--pspf-gap) var(--pspf-pad);
}
.pspf-error {
  border-color: var(--pspf-danger);
  background: var(--pspf-danger-soft);
  color: var(--pspf-text);
}

.pspf-inline-status,
.pspf-save-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--pspf-gap-xs);
  min-height: 1.5em;
  color: var(--pspf-muted);
  font-size: var(--pspf-type-label);
  line-height: var(--pspf-line-tight);
  transition: color var(--pspf-motion-responsive) var(--pspf-ease-responsive), opacity var(--pspf-motion-responsive) var(--pspf-ease-responsive);
}
.pspf-inline-status[data-state="saving"],
.pspf-save-indicator[data-state="saving"] { color: var(--pspf-accent); }
.pspf-inline-status[data-state="saved"],
.pspf-save-indicator[data-state="saved"] { color: var(--pspf-ok); }
.pspf-inline-status[data-state="error"],
.pspf-save-indicator[data-state="error"] { color: var(--pspf-danger); }

.pspf-spinner {
  display: inline-block;
  width: var(--pspf-spinner-size);
  height: var(--pspf-spinner-size);
  border: 2px solid color-mix(in srgb, currentColor 26%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: pspf-spinner-spin 800ms linear infinite;
}
.pspf-skeleton {
  color: transparent;
  border-radius: var(--pspf-radius-sm);
  background: linear-gradient(90deg, var(--pspf-surface-strong), color-mix(in srgb, var(--pspf-surface-strong) 76%, var(--pspf-text) 8%), var(--pspf-surface-strong));
  background-size: 220% 100%;
  animation: pspf-skeleton-wave var(--pspf-skeleton-wave-duration) var(--pspf-ease-responsive) infinite;
}
.pspf-skeleton--text { min-height: 1em; }
.pspf-skeleton--block { min-height: 5rem; }

@keyframes pspf-spinner-spin { to { transform: rotate(360deg); } }
@keyframes pspf-skeleton-wave { from { background-position: 220% 0; } to { background-position: -220% 0; } }

.pspf-mode-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pspf-gap-sm);
}
.pspf-mode-step {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--pspf-border);
  border-radius: var(--pspf-radius-pill);
  background: var(--pspf-surface-strong);
  color: var(--pspf-muted);
  padding: 3px 10px;
  font-size: var(--pspf-type-label);
  font-weight: 700;
  white-space: nowrap;
}
.pspf-mode-step[aria-current="step"],
.pspf-mode-step.is-active { color: var(--pspf-primary); border-color: var(--pspf-primary); background: var(--pspf-primary-soft); }

.pspf-table-wrap { overflow-x: auto; }
.pspf-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
}
.pspf-table th,
.pspf-table td {
  border-bottom: 1px solid var(--pspf-border);
  padding: var(--pspf-table-cell-pad-y) var(--pspf-table-cell-pad-x);
  text-align: left;
  vertical-align: top;
}
.pspf-table th {
  color: var(--pspf-muted);
  background: color-mix(in srgb, var(--pspf-surface-strong) 82%, transparent);
  font-size: var(--pspf-type-label);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.pspf-table--sticky th { position: sticky; top: 0; z-index: 1; }
.pspf-table-cell--wide { min-width: 18rem; max-width: 34rem; }
.pspf-table-cell--compact { width: 1%; white-space: nowrap; font-variant-numeric: tabular-nums; }

.pspf-skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--pspf-surface);
  color: var(--pspf-text);
  padding: 6px 10px;
  border: 1px solid var(--pspf-focus);
  border-radius: var(--pspf-radius-sm);
}
.pspf-skip-link:focus { left: 8px; top: 8px; z-index: 100; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
  button:active:not(:disabled):not([aria-disabled="true"]),
  .pspf-button:active:not(:disabled):not([aria-disabled="true"]),
  a.pspf-button:active:not([aria-disabled="true"]) { transform: none; }
  .pspf-skeleton { background: var(--pspf-surface-strong); }
}
`;

/**
 * Returns the design-token CSS for the requested surface, concatenated with
 * the shared base rules. Returned as a single string so callers can embed
 * it directly in a `<style>` element.
 */
export function tokensCss(surface: ShellSurface): string {
  const surfaceTokens =
    surface === "marketing" ? MARKETING_TOKENS : surface === "explorer" ? EXPLORER_FALLBACK_TOKENS : "";
  return [SHARED_ROOT_TOKENS, surfaceTokens, BASE_RULES].filter(Boolean).join("\n");
}
