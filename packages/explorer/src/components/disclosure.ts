// E4 (v1.66.0, ADR 0096): Explorer's disclosure wrapper for specialist/less-common content, mirroring
// webview-shell's disclosureHtml() (Workshop) so both hosts use the same collapsed-by-default pattern.
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

@customElement('pspf-disclosure')
export class Disclosure extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      details {
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-md);
        background: var(--pspf-surface-strong);
      }
      summary {
        cursor: pointer;
        padding: var(--space-2) var(--space-3);
        font-weight: 600;
        font-size: var(--text-sm);
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary::before {
        content: '▸ ';
      }
      details[open] summary::before {
        content: '▾ ';
      }
      .body {
        padding: 0 var(--space-3) var(--space-3) var(--space-3);
      }
    `,
  ];

  @property({ type: String }) summary = 'Advanced';
  @property({ type: Boolean }) open = false;

  override render() {
    return html`
      <details ?open=${this.open}>
        <summary>${this.summary}</summary>
        <div class="body"><slot></slot></div>
      </details>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-disclosure': Disclosure;
  }
}
