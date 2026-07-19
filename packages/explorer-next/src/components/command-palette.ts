/**
 * Keyboard command palette: global navigator opened with Cmd/Ctrl+K.
 *
 * Shows the union of nav routes plus a few synthetic actions (e.g. Run
 * integrity scan, Toggle posture). Filterable by substring on label or
 * route. Pure DOM — no external dialog dependency. Focus trap is light:
 * the input is focused on open and Esc closes.
 */

import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';
import { NAV_ROUTES } from '../app/routes.ts';

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

@customElement('pspf-command-palette')
export class CommandPalette extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: none;
        align-items: flex-start;
        justify-content: center;
        padding-top: 12vh;
        background: rgba(15, 23, 42, 0.45);
      }
      :host([open]) {
        display: flex;
      }
      .panel {
        width: min(560px, 90vw);
        background: var(--colour-bg);
        color: var(--colour-fg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
        overflow: hidden;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2) var(--space-3);
        border: none;
        border-bottom: 1px solid var(--colour-border);
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: var(--text-base);
        outline: none;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 50vh;
        overflow-y: auto;
      }
      li {
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        font-size: var(--text-sm);
        border-top: 1px solid var(--colour-border);
      }
      li:first-child {
        border-top: none;
      }
      li[aria-selected='true'] {
        background: var(--colour-bg-elevated);
      }
      .hint {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
      .empty {
        padding: var(--space-3);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        text-align: center;
      }
    `,
  ];

  @state() private accessor open = false;
  @state() private accessor query_ = '';
  @state() private accessor activeIndex = 0;
  @query('input') private accessor inputEl!: HTMLInputElement;

  #onKeydown = (event: KeyboardEvent): void => {
    const isOpenCombo =
      (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
    if (isOpenCombo) {
      event.preventDefault();
      this.#toggle();
    } else if (this.open && event.key === 'Escape') {
      event.preventDefault();
      this.#close();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.#onKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onKeydown);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      // Reflect attribute for :host([open]) selector
      this.setAttribute('open', '');
      queueMicrotask(() => this.inputEl?.focus());
    } else if (changed.has('open') && !this.open) {
      this.removeAttribute('open');
    }
  }

  #toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.query_ = '';
      this.activeIndex = 0;
    }
  }

  #close(): void {
    this.open = false;
  }

  #commands(): readonly Command[] {
    const navCmds: Command[] = NAV_ROUTES.map((r) => ({
      id: `nav:${r.path}`,
      label: `Go to ${r.label}`,
      hint: `#${r.path}`,
      run: (): void => {
        window.location.hash = `#${r.path}`;
      },
    }));
    const actions: Command[] = [
      {
        id: 'action:home',
        label: 'Reset to Home',
        hint: '#/',
        run: (): void => {
          window.location.hash = '#/';
        },
      },
    ];
    return [...navCmds, ...actions];
  }

  #filtered(): readonly Command[] {
    const q = this.query_.trim().toLowerCase();
    if (!q) return this.#commands();
    return this.#commands().filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }

  #onInput(event: Event): void {
    this.query_ = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  }

  #onInputKey(event: KeyboardEvent): void {
    const items = this.#filtered();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.#close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = items[this.activeIndex];
      if (target) {
        target.run();
        this.#close();
      }
    }
  }

  override render(): TemplateResult {
    const items = this.#filtered();
    return html`
      <div
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        @click=${(e: Event): void => e.stopPropagation()}
        @keydown=${(e: KeyboardEvent): void => e.stopPropagation()}
      >
        <input
          type="search"
          aria-label="Filter commands"
          placeholder="Type to filter… (Esc to close)"
          .value=${this.query_}
          @input=${(e: Event): void => this.#onInput(e)}
          @keydown=${(e: KeyboardEvent): void => this.#onInputKey(e)}
        />
        ${items.length === 0
          ? html`<p class="empty">No matching commands.</p>`
          : html`
              <ul role="listbox" aria-label="Commands" data-testid="command-list">
                ${items.map(
                  (c, idx) => html`
                    <li
                      role="option"
                      aria-selected=${idx === this.activeIndex ? 'true' : 'false'}
                      data-command-id=${c.id}
                      tabindex="-1"
                      @mouseenter=${(): void => {
                        this.activeIndex = idx;
                      }}
                      @click=${(): void => {
                        c.run();
                        this.#close();
                      }}
                      @keydown=${(e: KeyboardEvent): void => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          c.run();
                          this.#close();
                        }
                      }}
                    >
                      <span>${c.label}</span>
                      <span class="hint">${c.hint}</span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-command-palette': CommandPalette;
  }
}
