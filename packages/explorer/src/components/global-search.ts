import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { searchRecords, type SearchResult } from '../domain/global-search.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';

@customElement('pspf-global-search')
export class GlobalSearch extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
        position: relative;
        min-width: min(28rem, 100%);
      }
      label {
        display: block;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg);
        color: var(--colour-fg);
        font: inherit;
        padding: var(--space-2) var(--space-3);
        min-height: 2.5rem;
      }
      input:focus {
        outline: 2px solid var(--colour-accent);
        outline-offset: 2px;
      }
      .results {
        position: absolute;
        top: calc(100% + var(--space-1));
        left: 0;
        right: 0;
        z-index: 30;
        max-height: min(32rem, 70vh);
        overflow: auto;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg);
        box-shadow: var(--shadow-2);
      }
      .empty,
      .hint {
        margin: 0;
        padding: var(--space-3);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: var(--space-1);
      }
      a {
        display: grid;
        gap: 2px;
        padding: var(--space-2);
        border-radius: var(--radius-sm);
        color: inherit;
        text-decoration: none;
      }
      a:hover,
      a:focus-visible {
        background: var(--colour-bg-elevated);
        outline: none;
      }
      .title {
        font-weight: 700;
        font-size: var(--text-sm);
      }
      .subtitle,
      .snippet {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [this.store.compliance, this.store.directions, this.store.risks, this.store.actions]
      : [],
  );

  @state() private accessor query = '';
  @state() private accessor focused = false;

  override render(): TemplateResult {
    const results = this.#results();
    const showPanel = this.focused && this.query.trim().length > 0;
    return html`
      <label>
        <span class="visually-hidden">Search PSPF Explorer</span>
        <input
          type="search"
          placeholder="Search PSPF..."
          .value=${this.query}
          @input=${(event: Event): void => {
            this.query = (event.target as HTMLInputElement).value;
          }}
          @focus=${(): void => {
            this.focused = true;
          }}
          @keydown=${(event: KeyboardEvent): void => {
            if (event.key === 'Escape') this.focused = false;
          }}
        />
      </label>
      ${showPanel
        ? html`
            <div class="results" role="listbox" aria-label="Search results">
              ${this.query.trim().length < 2
                ? html`<p class="hint">Type at least two characters.</p>`
                : results.length === 0
                  ? html`<p class="empty">No matching results.</p>`
                  : html`
                      <ul>
                        ${results.map(
                          (result) => html`
                            <li>
                              <a href=${result.href} @click=${(): void => this.#close()}>
                                <span class="title">${result.title}</span>
                                <span class="subtitle">${result.subtitle}</span>
                                ${result.snippet
                                  ? html`<span class="snippet">${result.snippet}</span>`
                                  : ''}
                              </a>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
            </div>
          `
        : ''}
    `;
  }

  #results(): readonly SearchResult[] {
    if (!this.store) return [];
    return searchRecords(this.query, {
      compliance: this.store.compliance.value,
      directions: this.store.directions.value,
      risks: this.store.risks.value,
      actions: this.store.actions.value,
    });
  }

  #close(): void {
    this.focused = false;
    this.query = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-global-search': GlobalSearch;
  }
}
