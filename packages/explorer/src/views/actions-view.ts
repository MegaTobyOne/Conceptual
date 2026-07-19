import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import {
  ACTION_STATUSES,
  ACTION_TYPES,
  type Action,
  type ActionStatus,
  type ActionType,
} from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import {
  clearLocalValue,
  clearSessionValue,
  readListPrefs,
  readSelectionSet,
  writeListPrefs,
  writeSelectionSet,
  type PersistedListPrefs,
} from '../state/list-preferences.ts';
import '../components/list-workbench.ts';

const ACTION_LIST_PREFS_KEY = 'pspf:action-list-prefs';
const ACTION_LIST_SELECTIONS_KEY = 'pspf:action-list-selections';

function isOverdue(a: Action): boolean {
  if (!a.dueAt) return false;
  if (a.status === 'done' || a.status === 'cancelled') return false;
  return new Date(a.dueAt).getTime() < Date.now();
}

@customElement('pspf-actions-view')
export class ActionsView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      article {
        display: grid;
        gap: var(--space-3);
      }
      h2 {
        margin: 0 0 var(--space-3) 0;
        font-size: var(--text-xl);
      }
      .layout {
        display: block;
      }
      h3 {
        margin: 0;
        font-size: var(--text-md);
      }
      .panel-note {
        margin: 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        line-height: 1.5;
      }
      form.create {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-2);
        align-items: stretch;
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-3);
        min-width: 0;
      }
      @media (max-width: 800px) {
        form.create {
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
      textarea,
      select {
        font: inherit;
        color: inherit;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        width: 100%;
        box-sizing: border-box;
        transition:
          border-color var(--motion-fast) ease,
          box-shadow var(--motion-fast) ease,
          background-color var(--motion-fast) ease;
      }
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible,
      button:focus-visible {
        outline: none;
        border-color: var(--colour-accent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--colour-accent) 24%, transparent);
      }
      textarea {
        min-height: 4rem;
        resize: vertical;
      }
      button {
        font: inherit;
        cursor: pointer;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        color: inherit;
        transition:
          transform var(--motion-fast) ease,
          border-color var(--motion-fast) ease,
          background-color var(--motion-fast) ease,
          box-shadow var(--motion-fast) ease;
      }
      button:hover:not(:disabled),
      button:focus-visible:not(:disabled) {
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-1);
        transform: translateY(-1px);
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
      ul.actions {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.action {
        position: relative;
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-left-width: 4px;
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      li.action[data-overdue='true'] {
        --action-accent: #b34a00;
        border-color: #b34a00;
      }
      li.action:hover,
      li.action:focus-within {
        transform: translateY(-1px);
        border-color: var(--action-accent, var(--colour-border));
        box-shadow: var(--shadow-2);
      }
      li.action header {
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .item-header-main {
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
        flex-wrap: wrap;
      }
      .item-toggle {
        white-space: nowrap;
      }
      .pill {
        display: inline-flex;
        padding: 0.25rem var(--space-2);
        border-radius: 999px;
        font-size: var(--text-xs);
        background: color-mix(in srgb, var(--colour-bg) 78%, var(--colour-fg) 22%);
        border: 1px solid var(--colour-border);
        line-height: 1.2;
        white-space: nowrap;
      }
      .pill.overdue {
        background: #b34a00;
        color: #fff;
        border-color: #b34a00;
      }
      .meta {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      p.desc {
        margin: var(--space-2) 0;
        font-size: var(--text-sm);
      }
      .row {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .empty {
        padding: var(--space-3);
        border: 1px dashed var(--colour-border);
        border-radius: var(--radius-md);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        background: var(--colour-bg-elevated);
      }
      .edit-grid {
        display: grid;
        grid-template-columns: 1fr 9rem 9rem 10rem;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .list-tools {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-2);
        min-width: 0;
      }
      .bulk-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: center;
      }
      .status-filters {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .status-filters button[aria-pressed='true'] {
        background: var(--colour-accent);
        color: var(--colour-accent-fg);
        border-color: var(--colour-accent);
      }
      .count {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .pagination {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
      }
      .pagination .controls {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: center;
      }
      @media (max-width: 800px) {
        .edit-grid {
          grid-template-columns: 1fr 1fr;
        }
        .list-tools {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.actions] : []));

  @state() private newTitle = '';
  @state() private newDescription = '';
  @state() private newType: ActionType = 'remediation';
  @state() private newStatus: ActionStatus = 'todo';
  @state() private newDueAt = '';

  @state() private editingId: string | undefined;
  @state() private editTitle = '';
  @state() private editDescription = '';
  @state() private editType: ActionType = 'remediation';
  @state() private editStatus: ActionStatus = 'todo';
  @state() private editDueAt = '';

  @state() private searchQuery = '';
  @state() private sortMode: 'updated' | 'alpha' = 'updated';
  @state() private selectedActionIds: ReadonlySet<string> = new Set();
  @state() private bulkStatus: ActionStatus = 'todo';
  @state() private statusFilter: ActionStatus | 'all' = 'all';
  @state() private page = 1;
  @state() private pageSize = 20;
  @state() private expandedActionIds: ReadonlySet<string> = new Set();

  override connectedCallback(): void {
    super.connectedCallback();
    this.#restorePrefs();
    this.#restoreSelections();
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    if (
      changed.has('searchQuery') ||
      changed.has('sortMode') ||
      changed.has('statusFilter') ||
      changed.has('page') ||
      changed.has('pageSize')
    ) {
      this.#persistPrefs();
    }
    if (changed.has('selectedActionIds')) this.#persistSelections();
  }

  override render(): TemplateResult {
    const allActions = this.store?.actions.value ?? [];
    const visibleActions = this.#visibleActions(allActions);
    const totalPages = Math.max(1, Math.ceil(visibleActions.length / this.pageSize));
    const page = Math.min(this.page, totalPages);
    const actions = visibleActions.slice((page - 1) * this.pageSize, page * this.pageSize);
    return html`
      <article>
        <h2>Action tracker</h2>
        <p>
          Track remediation, uplift, review and investigation actions. Items past their due date are
          flagged as overdue (excluding done/cancelled).
        </p>
        <pspf-list-workbench left-label="Action controls" right-label="Action list">
          <div slot="left">
            <h3>Add action</h3>
            <p class="panel-note">
              Record the task, assign a type and due date, then narrow the list to what needs
              attention now.
            </p>
            ${this.#createForm()}
            ${allActions.length > 0 ? this.#listTools(allActions, visibleActions) : ''}
          </div>
          <div slot="right">
            ${visibleActions.length > 0
              ? this.#pagination(visibleActions.length, totalPages, page)
              : ''}
            ${actions.length === 0
              ? html`<p class="empty">
                  ${allActions.length === 0
                    ? 'No actions recorded yet.'
                    : 'No actions match the current view.'}
                </p>`
              : html`
                  <ul class="actions">
                    ${actions.map((a) => this.#actionItem(a))}
                  </ul>
                `}
          </div>
        </pspf-list-workbench>
      </article>
    `;
  }

  #pagination(totalItems: number, totalPages: number, page: number): TemplateResult {
    const firstItem = totalItems === 0 ? 0 : (page - 1) * this.pageSize + 1;
    const lastItem = Math.min(totalItems, page * this.pageSize);
    return html`
      <section class="pagination" aria-label="Action pagination">
        <div class="count">Showing ${firstItem}-${lastItem} of ${totalItems}</div>
        <div class="controls">
          <label class="field">
            Per page
            <select
              @change=${(e: Event): void => {
                this.pageSize = Number((e.target as HTMLSelectElement).value);
                this.page = 1;
              }}
            >
              ${[20, 50, 100].map(
                (size) =>
                  html`<option value=${size} ?selected=${this.pageSize === size}>${size}</option>`,
              )}
            </select>
          </label>
          <button
            type="button"
            ?disabled=${page <= 1}
            @click=${(): void => {
              this.page = Math.max(1, this.page - 1);
            }}
          >
            Previous
          </button>
          <span class="count">Page ${page} of ${totalPages}</span>
          <button
            type="button"
            ?disabled=${page >= totalPages}
            @click=${(): void => {
              this.page = Math.min(totalPages, this.page + 1);
            }}
          >
            Next
          </button>
        </div>
      </section>
    `;
  }

  #listTools(allActions: readonly Action[], visible: readonly Action[]): TemplateResult {
    const selected = this.selectedActionIds.size;
    return html`
      <section class="list-tools" aria-label="Action list tools">
        <label class="field">
          Search actions
          <input
            type="text"
            placeholder="Search title, description, id, type, or status"
            .value=${this.searchQuery}
            @input=${(e: Event): void => {
              this.searchQuery = (e.target as HTMLInputElement).value;
              this.page = 1;
            }}
          />
        </label>
        <label class="field">
          Sort
          <select
            @change=${(e: Event): void => {
              this.sortMode = (e.target as HTMLSelectElement).value as 'updated' | 'alpha';
              this.page = 1;
            }}
          >
            <option value="updated" ?selected=${this.sortMode === 'updated'}>
              Last modified (newest)
            </option>
            <option value="alpha" ?selected=${this.sortMode === 'alpha'}>Alphabetical (A-Z)</option>
          </select>
        </label>
        <div class="bulk-actions">
          <div class="status-filters" aria-label="Action status filters">
            <button
              type="button"
              aria-pressed=${this.statusFilter === 'all' ? 'true' : 'false'}
              @click=${(): void => {
                this.statusFilter = 'all';
                this.page = 1;
              }}
            >
              All
            </button>
            ${ACTION_STATUSES.map(
              (status) => html`
                <button
                  type="button"
                  aria-pressed=${this.statusFilter === status ? 'true' : 'false'}
                  @click=${(): void => {
                    this.statusFilter = status;
                    this.page = 1;
                  }}
                >
                  ${status}
                </button>
              `,
            )}
          </div>
          <button type="button" @click=${(): void => this.#selectVisible(visible)}>
            Select filtered
          </button>
          <button type="button" @click=${(): void => this.#clearSelection()}>
            Clear selection
          </button>
          <button type="button" @click=${(): void => this.#resetListState()}>
            Reset list settings
          </button>
          <label class="field" style="min-width: 12rem;">
            Bulk status
            <select
              @change=${(e: Event): void => {
                this.bulkStatus = (e.target as HTMLSelectElement).value as ActionStatus;
              }}
            >
              ${ACTION_STATUSES.map(
                (status) =>
                  html`<option value=${status} ?selected=${this.bulkStatus === status}>
                    ${status}
                  </option>`,
              )}
            </select>
          </label>
          <button
            type="button"
            ?disabled=${selected === 0}
            @click=${(): void => void this.#bulkSetStatus()}
          >
            Apply to selected
          </button>
          <button
            type="button"
            ?disabled=${selected === 0}
            @click=${(): void => void this.#bulkDelete()}
          >
            Delete selected
          </button>
          <span class="count"
            >Showing ${visible.length} of ${allActions.length} · Selected ${selected}</span
          >
        </div>
      </section>
    `;
  }

  #createForm(): TemplateResult {
    return html`
      <form
        class="create"
        @submit=${(e: Event): void => {
          e.preventDefault();
          void this.#create();
        }}
      >
        <label class="field">
          Title
          <input
            type="text"
            required
            .value=${this.newTitle}
            @input=${(e: Event): void => {
              this.newTitle = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="field">
          Type
          <select
            .value=${this.newType}
            @change=${(e: Event): void => {
              this.newType = (e.target as HTMLSelectElement).value as ActionType;
            }}
          >
            ${ACTION_TYPES.map((t) => html`<option value=${t}>${t}</option>`)}
          </select>
        </label>
        <label class="field">
          Status
          <select
            .value=${this.newStatus}
            @change=${(e: Event): void => {
              this.newStatus = (e.target as HTMLSelectElement).value as ActionStatus;
            }}
          >
            ${ACTION_STATUSES.map((s) => html`<option value=${s}>${s}</option>`)}
          </select>
        </label>
        <label class="field">
          Due
          <input
            type="date"
            .value=${this.newDueAt}
            @input=${(e: Event): void => {
              this.newDueAt = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <button class="primary" type="submit" ?disabled=${this.newTitle.trim() === ''}>
          Add action
        </button>
      </form>
    `;
  }

  #actionItem(a: Action): TemplateResult {
    const overdue = isOverdue(a);
    const isEditing = this.editingId === a.id;
    const isExpanded = isEditing || this.expandedActionIds.has(a.id);
    const selected = this.selectedActionIds.has(a.id);
    return html`
      <li class="action" data-overdue=${overdue ? 'true' : 'false'}>
        <header>
          <div class="item-header-main">
            <input
              type="checkbox"
              aria-label=${`Select action ${a.title}`}
              .checked=${selected}
              @change=${(e: Event): void =>
                this.#toggleSelected(a.id, (e.target as HTMLInputElement).checked)}
            />
            <strong>${a.title}</strong>
            <span class="pill">${a.type}</span>
            <span class="pill">${a.status}</span>
            ${a.dueAt
              ? html`<span class="pill ${overdue ? 'overdue' : ''}">due ${a.dueAt}</span>`
              : ''}
            <span class="meta">updated ${a.updatedAt.slice(0, 10)}</span>
          </div>
          <button
            class="item-toggle"
            type="button"
            @click=${(): void => this.#toggleExpanded(a.id)}
          >
            ${isExpanded ? 'Close' : 'Open'}
          </button>
        </header>
        ${isExpanded ? (isEditing ? this.#editForm(a) : this.#viewBody(a)) : ''}
      </li>
    `;
  }

  #visibleActions(actions: readonly Action[]): readonly Action[] {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = q
      ? actions.filter((action) => {
          const haystack =
            `${action.id} ${action.title} ${action.description ?? ''} ${action.type} ${action.status} ${action.dueAt ?? ''}`.toLowerCase();
          return haystack.includes(q);
        })
      : actions;
    const statusFiltered =
      this.statusFilter === 'all'
        ? filtered
        : filtered.filter((action) => action.status === this.statusFilter);
    const sorted = [...statusFiltered];
    if (this.sortMode === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'en-AU', { sensitivity: 'base' }));
    } else {
      sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }
    return sorted;
  }

  #toggleSelected(id: string, checked: boolean): void {
    const next = new Set(this.selectedActionIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedActionIds = next;
  }

  #selectVisible(visible: readonly Action[]): void {
    this.selectedActionIds = new Set(visible.map((action) => action.id));
  }

  #clearSelection(): void {
    this.selectedActionIds = new Set();
  }

  #toggleExpanded(id: string): void {
    const next = new Set(this.expandedActionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedActionIds = next;
  }

  #resetListState(): void {
    this.searchQuery = '';
    this.sortMode = 'updated';
    this.statusFilter = 'all';
    this.page = 1;
    this.pageSize = 20;
    this.selectedActionIds = new Set();
    this.expandedActionIds = new Set();
    clearLocalValue(ACTION_LIST_PREFS_KEY);
    clearSessionValue(ACTION_LIST_SELECTIONS_KEY);
  }

  #restorePrefs(): void {
    const prefs = readListPrefs(ACTION_LIST_PREFS_KEY, ACTION_STATUSES);
    if (!prefs) return;
    this.searchQuery = prefs.searchQuery;
    this.sortMode = prefs.sortMode;
    this.statusFilter = prefs.statusFilter;
    this.page = prefs.page;
    this.pageSize = prefs.pageSize;
  }

  #persistPrefs(): void {
    const prefs: PersistedListPrefs<ActionStatus> = {
      searchQuery: this.searchQuery,
      sortMode: this.sortMode,
      statusFilter: this.statusFilter,
      page: this.page,
      pageSize: this.pageSize,
    };
    writeListPrefs(ACTION_LIST_PREFS_KEY, prefs);
  }

  #restoreSelections(): void {
    this.selectedActionIds = readSelectionSet(ACTION_LIST_SELECTIONS_KEY);
  }

  #persistSelections(): void {
    writeSelectionSet(ACTION_LIST_SELECTIONS_KEY, this.selectedActionIds);
  }

  #viewBody(a: Action): TemplateResult {
    return html`
      ${a.description ? html`<p class="desc">${a.description}</p>` : ''}
      <div class="row">
        <button @click=${(): void => this.#startEdit(a)}>Edit</button>
        <button @click=${(): void => void this.#remove(a)}>Delete</button>
      </div>
    `;
  }

  #editForm(a: Action): TemplateResult {
    return html`
      <div class="edit-grid">
        <label class="field">
          Title
          <input
            type="text"
            .value=${this.editTitle}
            @input=${(e: Event): void => {
              this.editTitle = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="field">
          Type
          <select
            .value=${this.editType}
            @change=${(e: Event): void => {
              this.editType = (e.target as HTMLSelectElement).value as ActionType;
            }}
          >
            ${ACTION_TYPES.map((t) => html`<option value=${t}>${t}</option>`)}
          </select>
        </label>
        <label class="field">
          Status
          <select
            .value=${this.editStatus}
            @change=${(e: Event): void => {
              this.editStatus = (e.target as HTMLSelectElement).value as ActionStatus;
            }}
          >
            ${ACTION_STATUSES.map((s) => html`<option value=${s}>${s}</option>`)}
          </select>
        </label>
        <label class="field">
          Due
          <input
            type="date"
            .value=${this.editDueAt}
            @input=${(e: Event): void => {
              this.editDueAt = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
      </div>
      <label class="field" style="margin-top: var(--space-2)">
        Description
        <textarea
          .value=${this.editDescription}
          @input=${(e: Event): void => {
            this.editDescription = (e.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
      </label>
      <div class="row" style="margin-top: var(--space-2)">
        <button class="primary" @click=${(): void => void this.#saveEdit(a)}>Save</button>
        <button @click=${(): void => this.#cancelEdit()}>Cancel</button>
      </div>
    `;
  }

  #startEdit(a: Action): void {
    this.editingId = a.id;
    this.expandedActionIds = new Set(this.expandedActionIds).add(a.id);
    this.editTitle = a.title;
    this.editDescription = a.description ?? '';
    this.editType = a.type;
    this.editStatus = a.status;
    this.editDueAt = a.dueAt ?? '';
  }

  #cancelEdit(): void {
    this.editingId = undefined;
  }

  async #create(): Promise<void> {
    if (!this.store) return;
    const title = this.newTitle.trim();
    if (!title) return;
    const desc = this.newDescription.trim();
    const due = this.newDueAt.trim();
    await this.store.createAction({
      title,
      ...(desc ? { description: desc } : {}),
      type: this.newType,
      status: this.newStatus,
      ...(due ? { dueAt: due } : {}),
      requirementIds: [],
      riskIds: [],
    });
    this.newTitle = '';
    this.newDescription = '';
    this.newType = 'remediation';
    this.newStatus = 'todo';
    this.newDueAt = '';
  }

  async #saveEdit(a: Action): Promise<void> {
    if (!this.store) return;
    const title = this.editTitle.trim();
    if (!title) return;
    const desc = this.editDescription.trim();
    const due = this.editDueAt.trim();
    await this.store.updateAction(a.id, {
      title,
      ...(desc ? { description: desc } : {}),
      type: this.editType,
      status: this.editStatus,
      ...(due ? { dueAt: due } : {}),
    });
    this.editingId = undefined;
  }

  async #remove(a: Action): Promise<void> {
    if (!this.store) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm(`Delete action "${a.title}"?`)
    ) {
      return;
    }
    await this.store.removeAction(a.id);
    const next = new Set(this.selectedActionIds);
    next.delete(a.id);
    this.selectedActionIds = next;
  }

  async #bulkSetStatus(): Promise<void> {
    if (!this.store || this.selectedActionIds.size === 0) return;
    const selected = this.store.actions.value.filter((action) =>
      this.selectedActionIds.has(action.id),
    );
    await Promise.all(
      selected.map((action) => this.store!.updateAction(action.id, { status: this.bulkStatus })),
    );
  }

  async #bulkDelete(): Promise<void> {
    if (!this.store || this.selectedActionIds.size === 0) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm(`Delete ${this.selectedActionIds.size} selected actions?`)
    ) {
      return;
    }
    const ids = [...this.selectedActionIds];
    await Promise.all(ids.map((id) => this.store!.removeAction(id as Action['id'])));
    this.selectedActionIds = new Set();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-actions-view': ActionsView;
  }
}
