import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { RISK_STATUSES, type LikelihoodImpact, type Risk, type RiskStatus } from '../data/types.ts';
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

const SCALE: readonly LikelihoodImpact[] = [1, 2, 3, 4, 5];
const RISK_LIST_PREFS_KEY = 'pspf:risk-list-prefs';
const RISK_LIST_SELECTIONS_KEY = 'pspf:risk-list-selections';

function riskScore(r: Pick<Risk, 'likelihood' | 'impact'>): number {
  return r.likelihood * r.impact;
}

function riskBand(score: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (score >= 16) return 'extreme';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

@customElement('pspf-risks-view')
export class RisksView extends LitElement {
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
      input[type='text'],
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
      input[type='text']:focus-visible,
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
      ul.risks {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.risk {
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
      li.risk:hover,
      li.risk:focus-within {
        transform: translateY(-1px);
        border-color: var(--band-accent, var(--colour-border));
        box-shadow: var(--shadow-2);
      }
      li.risk header {
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
      li.risk .score {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px var(--space-1);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: 600;
        background: var(--band-bg, var(--colour-bg));
        color: var(--band-fg, var(--colour-fg));
      }
      li.risk[data-band='low'] {
        --band-accent: #2f6f3a;
        --band-bg: #2f6f3a;
        --band-fg: #fff;
      }
      li.risk[data-band='medium'] {
        --band-accent: #b8860b;
        --band-bg: #b8860b;
        --band-fg: #fff;
      }
      li.risk[data-band='high'] {
        --band-accent: #b34a00;
        --band-bg: #b34a00;
        --band-fg: #fff;
      }
      li.risk[data-band='extreme'] {
        --band-accent: #99182c;
        --band-bg: #99182c;
        --band-fg: #fff;
      }
      li.risk .meta {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      li.risk p.desc {
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
        grid-template-columns: 1fr 8rem 8rem 9rem;
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
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.risks] : []));

  // Create form
  @state() private newTitle = '';
  @state() private newDescription = '';
  @state() private likelihood: LikelihoodImpact = 3;
  @state() private impact: LikelihoodImpact = 3;
  @state() private status: RiskStatus = 'open';

  // Edit state
  @state() private editingId: string | undefined;
  @state() private editTitle = '';
  @state() private editDescription = '';
  @state() private editLikelihood: LikelihoodImpact = 3;
  @state() private editImpact: LikelihoodImpact = 3;
  @state() private editStatus: RiskStatus = 'open';

  @state() private searchQuery = '';
  @state() private sortMode: 'updated' | 'alpha' = 'updated';
  @state() private selectedRiskIds: ReadonlySet<string> = new Set();
  @state() private bulkStatus: RiskStatus = 'open';
  @state() private statusFilter: RiskStatus | 'all' = 'all';
  @state() private page = 1;
  @state() private pageSize = 20;
  @state() private expandedRiskIds: ReadonlySet<string> = new Set();

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
    if (changed.has('selectedRiskIds')) this.#persistSelections();
  }

  override render(): TemplateResult {
    const allRisks = this.store?.risks.value ?? [];
    const visibleRisks = this.#visibleRisks(allRisks);
    const totalPages = Math.max(1, Math.ceil(visibleRisks.length / this.pageSize));
    const page = Math.min(this.page, totalPages);
    const risks = visibleRisks.slice((page - 1) * this.pageSize, page * this.pageSize);
    return html`
      <article>
        <h2>Risk register</h2>
        <p>
          Capture risks against the security programme. Score = likelihood × impact (1–25). Link
          risks to requirements and actions for relationship-map coverage.
        </p>
        <pspf-list-workbench left-label="Risk controls" right-label="Risk list">
          <div slot="left">
            <h3>Add risk</h3>
            <p class="panel-note">
              Capture the issue, score it, and keep the list filtered to the slice you want to work
              on.
            </p>
            ${this.#createForm()}
            ${allRisks.length > 0 ? this.#listTools(allRisks, visibleRisks) : ''}
          </div>
          <div slot="right">
            ${visibleRisks.length > 0
              ? this.#pagination(visibleRisks.length, totalPages, page)
              : ''}
            ${risks.length === 0
              ? html`<p class="empty">
                  ${allRisks.length === 0
                    ? 'No risks recorded yet.'
                    : 'No risks match the current view.'}
                </p>`
              : html`
                  <ul class="risks">
                    ${risks.map((r) => this.#riskItem(r))}
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
      <section class="pagination" aria-label="Risk pagination">
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

  #listTools(allRisks: readonly Risk[], visible: readonly Risk[]): TemplateResult {
    const selected = this.selectedRiskIds.size;
    return html`
      <section class="list-tools" aria-label="Risk list tools">
        <label class="field">
          Search risks
          <input
            type="text"
            placeholder="Search title, description, id, or status"
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
          <div class="status-filters" aria-label="Risk status filters">
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
            ${RISK_STATUSES.map(
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
                this.bulkStatus = (e.target as HTMLSelectElement).value as RiskStatus;
              }}
            >
              ${RISK_STATUSES.map(
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
            >Showing ${visible.length} of ${allRisks.length} · Selected ${selected}</span
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
          Likelihood
          <select
            .value=${String(this.likelihood)}
            @change=${(e: Event): void => {
              this.likelihood = Number((e.target as HTMLSelectElement).value) as LikelihoodImpact;
            }}
          >
            ${SCALE.map((n) => html`<option value=${n}>${n}</option>`)}
          </select>
        </label>
        <label class="field">
          Impact
          <select
            .value=${String(this.impact)}
            @change=${(e: Event): void => {
              this.impact = Number((e.target as HTMLSelectElement).value) as LikelihoodImpact;
            }}
          >
            ${SCALE.map((n) => html`<option value=${n}>${n}</option>`)}
          </select>
        </label>
        <label class="field">
          Status
          <select
            .value=${this.status}
            @change=${(e: Event): void => {
              this.status = (e.target as HTMLSelectElement).value as RiskStatus;
            }}
          >
            ${RISK_STATUSES.map((s) => html`<option value=${s}>${s}</option>`)}
          </select>
        </label>
        <button class="primary" type="submit" ?disabled=${this.newTitle.trim() === ''}>
          Add risk
        </button>
      </form>
    `;
  }

  #riskItem(r: Risk): TemplateResult {
    const isEditing = this.editingId === r.id;
    const isExpanded = isEditing || this.expandedRiskIds.has(r.id);
    const selected = this.selectedRiskIds.has(r.id);
    const score = riskScore(r);
    const band = riskBand(score);
    const ariaLabel = `Risk score ${score}, ${band}`;
    return html`
      <li class="risk" data-band=${band}>
        <header>
          <div class="item-header-main">
            <input
              type="checkbox"
              aria-label=${`Select risk ${r.title}`}
              .checked=${selected}
              @change=${(e: Event): void =>
                this.#toggleSelected(r.id, (e.target as HTMLInputElement).checked)}
            />
            <strong>${r.title}</strong>
            <span class="score" aria-label=${ariaLabel}>
              ${r.likelihood}×${r.impact} → ${score} ${band}
            </span>
            <span class="meta">${r.status}</span>
            <span class="meta">updated ${r.updatedAt.slice(0, 10)}</span>
          </div>
          <button
            class="item-toggle"
            type="button"
            @click=${(): void => this.#toggleExpanded(r.id)}
          >
            ${isExpanded ? 'Close' : 'Open'}
          </button>
        </header>
        ${isExpanded ? (isEditing ? this.#editForm(r) : this.#viewBody(r)) : ''}
      </li>
    `;
  }

  #visibleRisks(risks: readonly Risk[]): readonly Risk[] {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = q
      ? risks.filter((risk) => {
          const haystack =
            `${risk.id} ${risk.title} ${risk.description ?? ''} ${risk.status}`.toLowerCase();
          return haystack.includes(q);
        })
      : risks;
    const statusFiltered =
      this.statusFilter === 'all'
        ? filtered
        : filtered.filter((risk) => risk.status === this.statusFilter);
    const sorted = [...statusFiltered];
    if (this.sortMode === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'en-AU', { sensitivity: 'base' }));
    } else {
      sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }
    return sorted;
  }

  #toggleSelected(id: string, checked: boolean): void {
    const next = new Set(this.selectedRiskIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedRiskIds = next;
  }

  #selectVisible(visible: readonly Risk[]): void {
    this.selectedRiskIds = new Set(visible.map((risk) => risk.id));
  }

  #clearSelection(): void {
    this.selectedRiskIds = new Set();
  }

  #toggleExpanded(id: string): void {
    const next = new Set(this.expandedRiskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedRiskIds = next;
  }

  #resetListState(): void {
    this.searchQuery = '';
    this.sortMode = 'updated';
    this.statusFilter = 'all';
    this.page = 1;
    this.pageSize = 20;
    this.selectedRiskIds = new Set();
    this.expandedRiskIds = new Set();
    clearLocalValue(RISK_LIST_PREFS_KEY);
    clearSessionValue(RISK_LIST_SELECTIONS_KEY);
  }

  #restorePrefs(): void {
    const prefs = readListPrefs(RISK_LIST_PREFS_KEY, RISK_STATUSES);
    if (!prefs) return;
    this.searchQuery = prefs.searchQuery;
    this.sortMode = prefs.sortMode;
    this.statusFilter = prefs.statusFilter;
    this.page = prefs.page;
    this.pageSize = prefs.pageSize;
  }

  #persistPrefs(): void {
    const prefs: PersistedListPrefs<RiskStatus> = {
      searchQuery: this.searchQuery,
      sortMode: this.sortMode,
      statusFilter: this.statusFilter,
      page: this.page,
      pageSize: this.pageSize,
    };
    writeListPrefs(RISK_LIST_PREFS_KEY, prefs);
  }

  #restoreSelections(): void {
    this.selectedRiskIds = readSelectionSet(RISK_LIST_SELECTIONS_KEY);
  }

  #persistSelections(): void {
    writeSelectionSet(RISK_LIST_SELECTIONS_KEY, this.selectedRiskIds);
  }

  #viewBody(r: Risk): TemplateResult {
    return html`
      ${r.description ? html`<p class="desc">${r.description}</p>` : ''}
      <div class="row">
        <button @click=${(): void => this.#startEdit(r)}>Edit</button>
        <button @click=${(): void => void this.#remove(r)}>Delete</button>
      </div>
    `;
  }

  #editForm(r: Risk): TemplateResult {
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
          Likelihood
          <select
            .value=${String(this.editLikelihood)}
            @change=${(e: Event): void => {
              this.editLikelihood = Number(
                (e.target as HTMLSelectElement).value,
              ) as LikelihoodImpact;
            }}
          >
            ${SCALE.map((n) => html`<option value=${n}>${n}</option>`)}
          </select>
        </label>
        <label class="field">
          Impact
          <select
            .value=${String(this.editImpact)}
            @change=${(e: Event): void => {
              this.editImpact = Number((e.target as HTMLSelectElement).value) as LikelihoodImpact;
            }}
          >
            ${SCALE.map((n) => html`<option value=${n}>${n}</option>`)}
          </select>
        </label>
        <label class="field">
          Status
          <select
            .value=${this.editStatus}
            @change=${(e: Event): void => {
              this.editStatus = (e.target as HTMLSelectElement).value as RiskStatus;
            }}
          >
            ${RISK_STATUSES.map((s) => html`<option value=${s}>${s}</option>`)}
          </select>
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
        <button class="primary" @click=${(): void => void this.#saveEdit(r)}>Save</button>
        <button @click=${(): void => this.#cancelEdit()}>Cancel</button>
      </div>
    `;
  }

  #startEdit(r: Risk): void {
    this.editingId = r.id;
    this.expandedRiskIds = new Set(this.expandedRiskIds).add(r.id);
    this.editTitle = r.title;
    this.editDescription = r.description ?? '';
    this.editLikelihood = r.likelihood;
    this.editImpact = r.impact;
    this.editStatus = r.status;
  }

  #cancelEdit(): void {
    this.editingId = undefined;
  }

  async #create(): Promise<void> {
    if (!this.store) return;
    const title = this.newTitle.trim();
    if (!title) return;
    const desc = this.newDescription.trim();
    await this.store.createRisk({
      title,
      ...(desc ? { description: desc } : {}),
      likelihood: this.likelihood,
      impact: this.impact,
      status: this.status,
      requirementIds: [],
      actionIds: [],
    });
    this.newTitle = '';
    this.newDescription = '';
    this.likelihood = 3;
    this.impact = 3;
    this.status = 'open';
  }

  async #saveEdit(r: Risk): Promise<void> {
    if (!this.store) return;
    const title = this.editTitle.trim();
    if (!title) return;
    const desc = this.editDescription.trim();
    await this.store.updateRisk(r.id, {
      title,
      ...(desc ? { description: desc } : {}),
      likelihood: this.editLikelihood,
      impact: this.editImpact,
      status: this.editStatus,
    });
    this.editingId = undefined;
  }

  async #remove(r: Risk): Promise<void> {
    if (!this.store) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm(`Delete risk "${r.title}"?`)
    ) {
      return;
    }
    await this.store.removeRisk(r.id);
    const next = new Set(this.selectedRiskIds);
    next.delete(r.id);
    this.selectedRiskIds = next;
  }

  async #bulkSetStatus(): Promise<void> {
    if (!this.store || this.selectedRiskIds.size === 0) return;
    const selected = this.store.risks.value.filter((risk) => this.selectedRiskIds.has(risk.id));
    await Promise.all(
      selected.map((risk) => this.store!.updateRisk(risk.id, { status: this.bulkStatus })),
    );
  }

  async #bulkDelete(): Promise<void> {
    if (!this.store || this.selectedRiskIds.size === 0) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm(`Delete ${this.selectedRiskIds.size} selected risks?`)
    ) {
      return;
    }
    const ids = [...this.selectedRiskIds];
    await Promise.all(ids.map((id) => this.store!.removeRisk(id as Risk['id'])));
    this.selectedRiskIds = new Set();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-risks-view': RisksView;
  }
}
