import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { TAG_PRIORITIES, type Tag, type TagId, type TagPriority } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const DEFAULT_COLOUR = '#4f8cff';

@customElement('pspf-tags-view')
export class TagsView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--space-3) 0;
        font-size: var(--text-xl);
      }
      form.create {
        display: grid;
        grid-template-columns: 1fr 8rem 8rem auto;
        gap: var(--space-2);
        align-items: end;
        padding: var(--space-3);
        margin: 0 0 var(--space-3) 0;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      label.field {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      input,
      select,
      button {
        font: inherit;
        color: inherit;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
      }
      button {
        cursor: pointer;
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
      ul.tags {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.tag {
        display: grid;
        grid-template-columns: 1.5rem 1fr 6rem 6rem auto auto;
        gap: var(--space-2);
        align-items: center;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      .swatch {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 50%;
        border: 1px solid var(--colour-border);
      }
      .empty {
        padding: var(--space-3);
        border: 1px dashed var(--colour-border);
        border-radius: var(--radius-md);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      .error {
        grid-column: 1 / -1;
        font-size: var(--text-xs);
        color: var(--colour-status-no);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.tags] : []));

  @state() private draftLabel = '';
  @state() private draftColour = DEFAULT_COLOUR;
  @state() private draftPriority: TagPriority | '' = '';
  @state() private formError: string | undefined;

  @state() private editingId: TagId | undefined;
  @state() private editLabel = '';
  @state() private editColour = '';
  @state() private editPriority: TagPriority | '' = '';
  @state() private editError: string | undefined;

  override render(): TemplateResult {
    const tags = this.store?.tags.value ?? [];
    return html`
      <article>
        <h2>Tags</h2>
        <p>
          Use tags to mark themes, owners or workstreams across requirements, risks and actions.
        </p>

        <form
          class="create"
          @submit=${(e: Event): void => {
            e.preventDefault();
            void this.#create();
          }}
        >
          <label class="field">
            Label
            <input
              type="text"
              required
              .value=${this.draftLabel}
              @input=${(e: Event): void => {
                this.draftLabel = (e.target as HTMLInputElement).value;
              }}
              placeholder="e.g. Quarterly review"
            />
          </label>
          <label class="field">
            Colour
            <input
              type="color"
              .value=${this.draftColour}
              @input=${(e: Event): void => {
                this.draftColour = (e.target as HTMLInputElement).value;
              }}
            />
          </label>
          <label class="field">
            Priority
            <select
              .value=${String(this.draftPriority)}
              @change=${(e: Event): void => {
                const v = (e.target as HTMLSelectElement).value;
                this.draftPriority = v === '' ? '' : (Number(v) as TagPriority);
              }}
            >
              <option value="">—</option>
              ${TAG_PRIORITIES.map((p) => html`<option value=${String(p)}>P${p}</option>`)}
            </select>
          </label>
          <button class="primary" type="submit" ?disabled=${this.draftLabel.trim() === ''}>
            Add tag
          </button>
          ${this.formError ? html`<p class="error">${this.formError}</p>` : ''}
        </form>

        ${tags.length === 0
          ? html`<p class="empty">No tags yet. Add your first one above.</p>`
          : html`
              <ul class="tags">
                ${tags.map((t) => this.#row(t))}
              </ul>
            `}
      </article>
    `;
  }

  #row(t: Tag): TemplateResult {
    if (this.editingId === t.id) {
      return html`
        <li class="tag">
          <span class="swatch" style=${`background:${this.editColour}`}></span>
          <input
            type="text"
            .value=${this.editLabel}
            @input=${(e: Event): void => {
              this.editLabel = (e.target as HTMLInputElement).value;
            }}
          />
          <input
            type="color"
            .value=${this.editColour}
            @input=${(e: Event): void => {
              this.editColour = (e.target as HTMLInputElement).value;
            }}
          />
          <select
            .value=${String(this.editPriority)}
            @change=${(e: Event): void => {
              const v = (e.target as HTMLSelectElement).value;
              this.editPriority = v === '' ? '' : (Number(v) as TagPriority);
            }}
          >
            <option value="">—</option>
            ${TAG_PRIORITIES.map((p) => html`<option value=${String(p)}>P${p}</option>`)}
          </select>
          <button class="primary" @click=${(): void => void this.#saveEdit(t)}>Save</button>
          <button @click=${(): void => this.#cancelEdit()}>Cancel</button>
          ${this.editError ? html`<p class="error">${this.editError}</p>` : ''}
        </li>
      `;
    }
    return html`
      <li class="tag">
        <span class="swatch" style=${`background:${t.colour}`}></span>
        <span><strong>${t.label}</strong></span>
        <span>${t.colour}</span>
        <span>${t.priority ? `P${t.priority}` : '—'}</span>
        <button @click=${(): void => this.#beginEdit(t)}>Edit</button>
        <button @click=${(): void => void this.#remove(t)}>Delete</button>
      </li>
    `;
  }

  async #create(): Promise<void> {
    if (!this.store) return;
    const label = this.draftLabel.trim();
    if (!label) return;
    if (!HEX_COLOUR.test(this.draftColour)) {
      this.formError = 'Colour must be a hex value like #1f2733.';
      return;
    }
    this.formError = undefined;
    await this.store.createTag({
      label,
      colour: this.draftColour,
      ...(this.draftPriority === '' ? {} : { priority: this.draftPriority }),
    });
    this.draftLabel = '';
    this.draftColour = DEFAULT_COLOUR;
    this.draftPriority = '';
  }

  #beginEdit(t: Tag): void {
    this.editingId = t.id;
    this.editLabel = t.label;
    this.editColour = t.colour;
    this.editPriority = t.priority ?? '';
    this.editError = undefined;
  }

  #cancelEdit(): void {
    this.editingId = undefined;
    this.editError = undefined;
  }

  async #saveEdit(t: Tag): Promise<void> {
    if (!this.store) return;
    const label = this.editLabel.trim();
    if (!label) {
      this.editError = 'Label cannot be empty.';
      return;
    }
    if (!HEX_COLOUR.test(this.editColour)) {
      this.editError = 'Colour must be a hex value.';
      return;
    }
    await this.store.updateTag(t.id, {
      label,
      colour: this.editColour,
      ...(this.editPriority === '' ? {} : { priority: this.editPriority }),
    });
    this.editingId = undefined;
    this.editError = undefined;
  }

  async #remove(t: Tag): Promise<void> {
    if (!this.store) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm(`Delete tag "${t.label}"?`)
    ) {
      return;
    }
    await this.store.removeTag(t.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-tags-view': TagsView;
  }
}
