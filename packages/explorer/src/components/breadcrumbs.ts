import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

@customElement('pspf-breadcrumbs')
export class Breadcrumbs extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
        margin: 0 0 var(--space-3) 0;
      }
      nav {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }
      ol {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1);
      }
      li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      li + li::before {
        content: '›';
        color: var(--colour-fg-muted);
      }
      a {
        color: inherit;
      }
      [aria-current='page'] {
        color: var(--colour-fg);
        font-weight: 600;
      }
    `,
  ];

  @property({ attribute: false }) accessor items: readonly BreadcrumbItem[] = [];

  override render(): TemplateResult {
    return html`
      <nav aria-label="Breadcrumb">
        <ol>
          ${this.items.map((item, index) => {
            const isCurrent = index === this.items.length - 1;
            return html`
              <li>
                ${item.href && !isCurrent
                  ? html`<a href=${item.href}>${item.label}</a>`
                  : isCurrent
                    ? html`<span aria-current="page">${item.label}</span>`
                    : html`<span>${item.label}</span>`}
              </li>
            `;
          })}
        </ol>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-breadcrumbs': Breadcrumbs;
  }
}
