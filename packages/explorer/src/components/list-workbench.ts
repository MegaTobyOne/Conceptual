import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

@customElement('pspf-list-workbench')
export class ListWorkbench extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
      }

      .layout > * {
        min-width: 0;
      }

      section.panel {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        min-width: 0;
      }

      .left.sticky {
        position: sticky;
        top: var(--space-3);
      }

      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .left.sticky {
          position: static;
        }
      }
    `,
  ];

  @property({ attribute: 'left-label' }) leftLabel = 'Filters and controls';
  @property({ attribute: 'right-label' }) rightLabel = 'List';
  @property({ type: Boolean, attribute: 'sticky-left' }) stickyLeft = false;

  override render(): TemplateResult {
    const leftClass = this.stickyLeft ? 'panel left sticky' : 'panel left';
    return html`
      <div class="layout">
        <section class=${leftClass} aria-label=${this.leftLabel}>
          <slot name="left"></slot>
        </section>
        <section class="panel right" aria-label=${this.rightLabel}>
          <slot name="right"></slot>
          <slot name="right-footer"></slot>
        </section>
      </div>
      ${this.#hasDefaultSlot() ? html`<slot></slot>` : nothing}
    `;
  }

  #hasDefaultSlot(): boolean {
    return !!this.querySelector(':scope > :not([slot])');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-list-workbench': ListWorkbench;
  }
}
