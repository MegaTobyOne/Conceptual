import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';
import type { ComplianceState } from '../data/types.ts';
import { complianceColourVar, complianceLabel } from '../domain/compliance-display.ts';

@customElement('pspf-compliance-badge')
export class ComplianceBadge extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 0.3rem var(--space-2);
        border-radius: 999px;
        font-size: var(--text-xs);
        font-weight: 600;
        background: color-mix(in srgb, var(--colour-bg-elevated) 82%, var(--colour-fg) 18%);
        border: 1px solid
          color-mix(in srgb, var(--colour-border) 72%, var(--swatch, var(--colour-fg-muted)) 28%);
        color: var(--colour-fg);
        line-height: 1.2;
        box-shadow: var(--shadow-1);
        transition:
          transform var(--motion-fast) ease,
          border-color var(--motion-fast) ease,
          box-shadow var(--motion-fast) ease,
          background-color var(--motion-fast) ease;
      }
      :host(:hover),
      :host(:focus-within) {
        transform: translateY(-1px);
        box-shadow: var(--shadow-2);
      }
      .swatch {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 50%;
        background: var(--swatch, var(--colour-fg-muted));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }
      span:last-child {
        white-space: nowrap;
      }
    `,
  ];

  @property({ reflect: true }) state: ComplianceState = 'not-set';

  override render() {
    return html`
      <span class="swatch" style=${`--swatch: var(${complianceColourVar(this.state)})`}></span>
      <span>${complianceLabel(this.state)}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-compliance-badge': ComplianceBadge;
  }
}
