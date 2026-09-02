// E5 (v1.67.0, ADR 0096): minimal, dismissible inline banner for post-save impact feedback —
// no stacking or auto-dismiss animation, per the confirmed minimal-UI scope for this slice.
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

@customElement('pspf-toast')
export class Toast extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      .banner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--pspf-accent);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--pspf-accent) 12%, var(--pspf-surface-strong));
        font-size: var(--text-sm);
        line-height: 1.4;
      }
      button {
        font: inherit;
        cursor: pointer;
        border: none;
        background: transparent;
        color: inherit;
        opacity: 0.7;
      }
      button:hover,
      button:focus-visible {
        opacity: 1;
      }
    `,
  ];

  @property({ type: String }) message = '';

  override render() {
    if (!this.message) return '';
    return html`
      <div class="banner" role="status" data-testid="save-impact-banner">
        <span>${this.message}</span>
        <button
          type="button"
          aria-label="Dismiss"
          @click=${(): void => {
            this.dispatchEvent(new CustomEvent('dismiss'));
          }}
        >
          ✕
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-toast': Toast;
  }
}
