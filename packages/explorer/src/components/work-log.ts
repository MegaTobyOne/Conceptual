import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import type { RequirementId, WorkTrackingEntry } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { formatDateTime } from '../domain/date-display.ts';

@customElement('pspf-work-log')
export class WorkLog extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
        margin-top: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      h3 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-md);
      }
      form.add {
        display: grid;
        grid-template-columns: 1fr 6rem auto;
        gap: var(--space-2);
        align-items: end;
      }
      @media (max-width: 700px) {
        form.add {
          grid-template-columns: 1fr;
        }
      }
      label.field {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      input,
      textarea {
        font: inherit;
        color: inherit;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        width: 100%;
        box-sizing: border-box;
      }
      button {
        font: inherit;
        cursor: pointer;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        color: inherit;
      }
      button.primary {
        background: var(--colour-accent);
        color: var(--colour-accent-fg);
        border-color: var(--colour-accent);
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      ul.entries {
        list-style: none;
        margin: var(--space-3) 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.entry {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--space-2);
        align-items: start;
        padding: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
      }
      li.entry .meta {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
        margin-top: 2px;
      }
      li.entry p {
        margin: 0;
        font-size: var(--text-sm);
        white-space: pre-wrap;
      }
      .empty {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }
    `,
  ];

  @property({ attribute: false }) requirementId!: RequirementId;

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.workTracking] : []));

  @state() private noteDraft = '';
  @state() private effortDraft = '';

  override render(): TemplateResult {
    const all = this.store?.workTracking.value ?? [];
    const entries = all
      .filter((e) => e.requirementId === this.requirementId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return html`
      <h3>Work log</h3>
      <form
        class="add"
        @submit=${(e: Event): void => {
          e.preventDefault();
          void this.#add();
        }}
      >
        <label class="field">
          Note
          <input
            type="text"
            required
            placeholder="What was done?"
            .value=${this.noteDraft}
            @input=${(e: Event): void => {
              this.noteDraft = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="field">
          Effort
          <input
            type="text"
            placeholder="e.g. 2h"
            .value=${this.effortDraft}
            @input=${(e: Event): void => {
              this.effortDraft = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <button class="primary" type="submit" ?disabled=${this.noteDraft.trim() === ''}>
          Log work
        </button>
      </form>
      ${entries.length === 0
        ? html`<p class="empty">No work logged for this requirement yet.</p>`
        : html`
            <ul class="entries">
              ${entries.map((e) => this.#entryItem(e))}
            </ul>
          `}
    `;
  }

  #entryItem(e: WorkTrackingEntry): TemplateResult {
    return html`
      <li class="entry">
        <div>
          <p>${e.note}</p>
          <div class="meta">
            ${formatDateTime(e.createdAt)}${e.effort ? html` · effort: ${e.effort}` : ''}
          </div>
        </div>
        <button @click=${(): void => void this.#remove(e)}>Remove</button>
      </li>
    `;
  }

  async #add(): Promise<void> {
    if (!this.store) return;
    const note = this.noteDraft.trim();
    if (!note) return;
    const effort = this.effortDraft.trim();
    await this.store.addWorkTracking(this.requirementId, note, effort || undefined);
    this.noteDraft = '';
    this.effortDraft = '';
  }

  async #remove(e: WorkTrackingEntry): Promise<void> {
    if (!this.store) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('Remove this work-log entry?')
    ) {
      return;
    }
    await this.store.removeWorkTracking(e.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-work-log': WorkLog;
  }
}
