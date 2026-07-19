/**
 * Shared base class for placeholder Phase 1 view shells.
 *
 * Real implementations replace these one at a time.
 */

import { LitElement, css, html, type TemplateResult } from 'lit';
import { designTokens } from '../app/design-tokens.ts';

export abstract class ViewBase extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        font-size: var(--text-xl);
        margin: 0 0 var(--space-3) 0;
      }
      .placeholder {
        padding: var(--space-3);
        border: 1px dashed var(--colour-border);
        border-radius: var(--radius-md);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
    `,
  ];

  protected abstract heading(): string;
  protected body(): TemplateResult {
    return html`<p class="placeholder">View not yet implemented.</p>`;
  }

  override render() {
    return html`
      <article>
        <h2>${this.heading()}</h2>
        ${this.body()}
      </article>
    `;
  }
}
