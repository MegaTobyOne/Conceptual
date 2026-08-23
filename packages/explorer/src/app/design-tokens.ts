import { css } from 'lit';

/**
 * Shared design tokens for v3.
 * Imported into every component's `static styles` so CSS custom properties
 * are available inside every shadow root.
 */
export const designTokens = css`
  :host {
    /* Canonical Studio System tokens. --colour-* remains a migration alias. */
    --pspf-text: var(--theme-colour-fg, #edf1ef);
    --pspf-muted: var(--theme-colour-fg-muted, #aeb9b5);
    --pspf-surface: var(--theme-colour-bg, #0f1415);
    --pspf-surface-strong: var(--theme-colour-bg-elevated, #171d1d);
    --pspf-surface-subtle: color-mix(in srgb, var(--pspf-surface-strong) 82%, transparent);
    --pspf-border: var(--theme-colour-border, #2c3633);
    --pspf-border-strong: color-mix(in srgb, var(--pspf-border) 72%, var(--pspf-text) 28%);
    --pspf-accent: var(--theme-colour-accent, #82acc8);
    --pspf-link: var(--theme-colour-link, #9dc3dc);
    --pspf-accent-ink: var(--theme-colour-accent-fg, #111514);

    --colour-status-yes: var(--theme-colour-status-yes, #2dd4bf);
    --colour-status-no: var(--theme-colour-status-no, #ef4444);
    --colour-status-risk-managed: var(--theme-colour-status-risk-managed, #facc15);
    --colour-status-not-applicable: var(--theme-colour-status-not-applicable, #94a3b8);
    --colour-status-not-set: var(--theme-colour-status-not-set, #475569);

    /* Risk bands — graduated red/amber/green. */
    --colour-risk-extreme: #99182c;
    --colour-risk-high: #d4451f;
    --colour-risk-medium: #e0903b;
    --colour-risk-low: #2f6f3a;

    /* Action statuses. */
    --colour-action-todo: #475569;
    --colour-action-in-progress: #2563eb;
    --colour-action-blocked: #b34a00;
    --colour-action-done: #2dd4bf;
    --colour-action-cancelled: #94a3b8;

    /* Direction response states. */
    --colour-direction-not-set: #ef4444;
    --colour-direction-no: #d4451f;
    --colour-direction-risk-managed: #facc15;
    --colour-direction-yes: #2dd4bf;

    /* Relationship-map edges. */
    --colour-map-edge-default: #94a3b8;
    --colour-map-edge-requirement-risk: #b34a00;
    --colour-map-edge-requirement-action: #059669;
    --colour-map-edge-risk-action: #2563eb;
    --colour-map-edge-requirement-direction: #7c3aed;
    --colour-map-node-stroke: #0f172a;

    --colour-classification-bg: #f59e0b;
    --colour-classification-fg: #1a1300;

    --pspf-product-core: #91a7aa;
    --pspf-product-assurance: #aaa4d4;
    --pspf-product-workshop: #62b8ae;
    --pspf-product-shop: #d5a466;
    --pspf-product-pub: #c58da5;
    --pspf-product-explorer: #82acc8;
    --pspf-domain-governance: #6ea8ff;
    --pspf-domain-security-risk: #f0a36d;
    --pspf-domain-information: #7ad3a3;
    --pspf-domain-technology: #b39bff;
    --pspf-domain-personnel: #f0c36d;
    --pspf-domain-physical: #d59bff;

    /* Spacing — 4px scale. */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.5rem;
    --space-6: 2rem;
    --space-8: 3rem;

    /* Typography. */
    --font-family-sans:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --font-family-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 0.8125rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;

    /* Shape & motion. */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-2: 0 4px 12px rgba(0, 0, 0, 0.35);
    --motion-fast: 80ms;
    --motion-medium: 180ms;
  }

  :host([data-theme='light']) {
    --theme-colour-bg: #eef1ef;
    --theme-colour-bg-elevated: #fbfcfb;
    --theme-colour-fg: #192220;
    --theme-colour-fg-muted: #596562;
    --theme-colour-border: #dce2df;
    --theme-colour-accent: #3e6582;
    --theme-colour-link: #315d7b;
    --theme-colour-accent-fg: #ffffff;
    --theme-colour-status-yes: #0f766e;
    --theme-colour-status-no: #dc2626;
    --theme-colour-status-risk-managed: #ca8a04;
    --theme-colour-status-not-applicable: #64748b;
    --theme-colour-status-not-set: #94a3b8;
    --pspf-product-core: #536b70;
    --pspf-product-assurance: #625b8f;
    --pspf-product-workshop: #176f68;
    --pspf-product-shop: #986329;
    --pspf-product-pub: #825467;
    --pspf-product-explorer: #3e6582;
    --pspf-domain-governance: #4d7db8;
    --pspf-domain-security-risk: #b86432;
    --pspf-domain-information: #2d8661;
    --pspf-domain-technology: #7262aa;
    --pspf-domain-personnel: #9a7625;
    --pspf-domain-physical: #925b9d;
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --motion-fast: 0ms;
      --motion-medium: 0ms;
    }
  }
`;
