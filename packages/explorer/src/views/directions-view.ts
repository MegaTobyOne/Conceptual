/**
 * PSPF Directions register.
 *
 * Directions are ad-hoc supplementary instructions issued by Home Affairs
 * (or sector-specific authorities) that bind to one or more PSPF
 * requirements. This view supports CRUD plus response tracking.
 */

import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import {
  DIRECTION_RESPONSE_STATES,
  asRequirementId,
  type Direction,
  type DirectionId,
  type DirectionResponseState,
  type EvidenceRef,
} from '../data/types.ts';
import {
  directionResponseLabel,
  directionSummary,
  directionsRegisterSummary,
} from '../domain/reporting.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import '../components/list-workbench.ts';

function parseRequirementIds(raw: string): readonly ReturnType<typeof asRequirementId>[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(asRequirementId);
}

function evidence(kind: EvidenceRef['kind'], value: string): EvidenceRef | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  return { kind, value: clean, addedAt: new Date().toISOString() };
}

@customElement('pspf-directions-view')
export class DirectionsView extends LitElement {
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
        margin: 0 0 var(--space-2) 0;
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
      .intro {
        margin: 0 0 var(--space-3) 0;
        color: var(--colour-fg-muted);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }
      .metric {
        padding: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      .metric strong {
        display: block;
        font-size: var(--text-lg);
      }
      .metric span {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
      form.create,
      form.edit {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-2);
        align-items: stretch;
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-3);
        background: var(--colour-bg-elevated);
        min-width: 0;
      }
      form.create .full,
      form.edit .full {
        grid-column: 1 / -1;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: var(--space-2);
        align-items: center;
        margin-bottom: var(--space-3);
        flex-wrap: wrap;
      }
      .filters {
        display: flex;
        gap: var(--space-2);
        align-items: end;
        flex-wrap: wrap;
      }
      @media (max-width: 900px) {
        .summary,
        form.create,
        form.edit {
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
      }
      textarea {
        min-height: 3.5rem;
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
      ul.list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.direction {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      .item-head {
        display: flex;
        justify-content: space-between;
        gap: var(--space-2);
        align-items: flex-start;
      }
      .item-head-main {
        display: grid;
        gap: 2px;
      }
      .item-toggle {
        white-space: nowrap;
      }
      .response-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        font-size: var(--text-xs);
        font-weight: 700;
        white-space: nowrap;
      }
      .ref {
        font-family: var(--font-family-mono);
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }
      .meta,
      .evidence-list {
        display: flex;
        gap: var(--space-3);
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
        margin-top: var(--space-1);
        flex-wrap: wrap;
      }
      .response-notes {
        padding: var(--space-2);
        border-left: 3px solid var(--colour-accent);
        background: var(--colour-bg);
        margin: var(--space-2) 0 0;
      }
      .req-list {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
        margin-top: var(--space-1);
      }
      .req-list a {
        font-family: var(--font-family-mono);
        font-size: var(--text-xs);
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: 2px 6px;
        color: var(--colour-accent);
        text-decoration: none;
      }
      .actions {
        display: flex;
        gap: var(--space-1);
        margin-top: var(--space-2);
        flex-wrap: wrap;
      }
      .empty,
      .copy-status {
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @property({ attribute: false }) params: Record<string, string> = {};

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.directions] : []));

  @state() private accessor reference = '';
  @state() private accessor newTitle = '';
  @state() private accessor issuedAt = '';
  @state() private accessor description = '';
  @state() private accessor reqRefs = '';
  @state() private accessor responseState: DirectionResponseState = 'not-set';
  @state() private accessor responseNotes = '';
  @state() private accessor evidenceKind: EvidenceRef['kind'] = 'note';
  @state() private accessor evidenceValue = '';

  @state() private accessor filterState: DirectionResponseState | 'all' = 'all';
  @state() private accessor editingId: DirectionId | null = null;
  @state() private accessor editReference = '';
  @state() private accessor editTitle = '';
  @state() private accessor editIssuedAt = '';
  @state() private accessor editDescription = '';
  @state() private accessor editReqRefs = '';
  @state() private accessor editResponseState: DirectionResponseState = 'not-set';
  @state() private accessor editResponseNotes = '';
  @state() private accessor editEvidenceKind: EvidenceRef['kind'] = 'note';
  @state() private accessor editEvidenceValue = '';
  @state() private accessor copyStatus = '';
  @state() private accessor expandedDirectionIds: ReadonlySet<DirectionId> = new Set();

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('params')) {
      const routeState = this.params.state;
      this.filterState = this.#isDirectionState(routeState) ? routeState : 'all';
    }
  }

  override render(): TemplateResult {
    const directions = this.store?.directions.value ?? [];
    const filtered =
      this.filterState === 'all'
        ? directions
        : directions.filter((d) => d.responseState === this.filterState);
    return html`
      <article>
        <h2>Directions register</h2>
        <p class="intro">
          Track PSPF Directions, record whether each one has been dealt with, and copy a summary for
          Teams, email, or briefing packs.
        </p>
        <pspf-list-workbench left-label="Direction controls" right-label="Direction list">
          <div slot="left">
            <h3>Summary and filters</h3>
            <p class="panel-note">
              Use the filter to narrow the register, then add a direction or copy the current
              summary for a brief or meeting note.
            </p>
            ${this.#summary(directions)} ${this.#createForm()}
            <div class="toolbar">
              <div class="filters">
                <label class="field">
                  Show
                  <select
                    @change=${(e: Event): void => {
                      this.filterState = (e.target as HTMLSelectElement).value as
                        | DirectionResponseState
                        | 'all';
                    }}
                  >
                    <option value="all" ?selected=${this.filterState === 'all'}>
                      All Directions
                    </option>
                    ${DIRECTION_RESPONSE_STATES.map(
                      (state) =>
                        html`<option value=${state} ?selected=${this.filterState === state}>
                          ${directionResponseLabel(state)}
                        </option>`,
                    )}
                  </select>
                </label>
              </div>
              <button
                type="button"
                @click=${(): void => void this.#copyText(directionsRegisterSummary(filtered))}
              >
                Copy register summary
              </button>
              ${this.copyStatus
                ? html`<span class="copy-status" role="status">${this.copyStatus}</span>`
                : ''}
            </div>
          </div>
          <div slot="right">
            ${filtered.length === 0
              ? html`<p class="empty" data-testid="empty">No Directions match the current view.</p>`
              : html`<ul class="list">
                  ${filtered.map((d) => this.#renderItem(d))}
                </ul>`}
          </div>
        </pspf-list-workbench>
      </article>
    `;
  }

  #summary(directions: readonly Direction[]): TemplateResult {
    const count = (state: DirectionResponseState): number =>
      directions.filter((direction) => direction.responseState === state).length;
    return html`
      <section class="summary" aria-label="Direction response summary">
        <div class="metric"><strong>${count('yes')}</strong><span>Dealt with</span></div>
        <div class="metric"><strong>${count('no')}</strong><span>Not dealt with</span></div>
        <div class="metric"><strong>${count('risk-managed')}</strong><span>Risk-managed</span></div>
        <div class="metric"><strong>${count('not-set')}</strong><span>Needs response</span></div>
      </section>
    `;
  }

  #isDirectionState(value: string | undefined): value is DirectionResponseState {
    return (
      typeof value === 'string' &&
      DIRECTION_RESPONSE_STATES.includes(value as DirectionResponseState)
    );
  }

  #createForm(): TemplateResult {
    return html`
      <form
        class="create"
        @submit=${(e: Event): void => {
          e.preventDefault();
          void this.#create();
        }}
        aria-label="Add direction"
      >
        <label class="field"
          >Reference<input
            type="text"
            required
            placeholder="e.g. PSPF Direction 001-2025"
            .value=${this.reference}
            @input=${(e: Event): void => {
              this.reference = (e.target as HTMLInputElement).value;
            }}
        /></label>
        <label class="field"
          >Title<input
            type="text"
            required
            .value=${this.newTitle}
            @input=${(e: Event): void => {
              this.newTitle = (e.target as HTMLInputElement).value;
            }}
        /></label>
        <label class="field"
          >Issued<input
            type="date"
            required
            .value=${this.issuedAt}
            @input=${(e: Event): void => {
              this.issuedAt = (e.target as HTMLInputElement).value;
            }}
        /></label>
        <label class="field"
          >Response${this.#stateSelect(this.responseState, (value) => {
            this.responseState = value;
          })}</label
        >
        <button class="primary" type="submit" ?disabled=${!this.#canCreate()}>Add direction</button>
        <label class="field full"
          >Description<textarea
            .value=${this.description}
            @input=${(e: Event): void => {
              this.description = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </label>
        <label class="field full"
          >Linked requirement IDs (comma or space separated, e.g. GOV-1 INF-3)<input
            type="text"
            .value=${this.reqRefs}
            @input=${(e: Event): void => {
              this.reqRefs = (e.target as HTMLInputElement).value;
            }}
        /></label>
        <label class="field full"
          >Response notes<textarea
            .value=${this.responseNotes}
            @input=${(e: Event): void => {
              this.responseNotes = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </label>
        <label class="field"
          >Evidence type<select
            .value=${this.evidenceKind}
            @change=${(e: Event): void => {
              this.evidenceKind = (e.target as HTMLSelectElement).value as EvidenceRef['kind'];
            }}
          >
            <option value="note">Note</option>
            <option value="url">URL</option>
          </select></label
        >
        <label class="field full"
          >Evidence<input
            type="text"
            .value=${this.evidenceValue}
            @input=${(e: Event): void => {
              this.evidenceValue = (e.target as HTMLInputElement).value;
            }}
        /></label>
      </form>
    `;
  }

  #stateSelect(
    value: DirectionResponseState,
    onChange: (value: DirectionResponseState) => void,
  ): TemplateResult {
    return html`
      <select
        .value=${value}
        @change=${(e: Event): void =>
          onChange((e.target as HTMLSelectElement).value as DirectionResponseState)}
      >
        ${DIRECTION_RESPONSE_STATES.map(
          (state) =>
            html`<option value=${state} ?selected=${state === value}>
              ${directionResponseLabel(state)}
            </option>`,
        )}
      </select>
    `;
  }

  #renderItem(d: Direction): TemplateResult {
    if (this.editingId === d.id) return this.#renderEdit(d);
    const isEditing = this.editingId === d.id;
    const isExpanded = isEditing || this.expandedDirectionIds.has(d.id);
    return html`
      <li class="direction" data-id=${d.id}>
        <div class="item-head">
          <div class="item-head-main">
            <strong>${d.title}</strong>
            <div class="ref">${d.reference}</div>
            <div class="meta"><span>Issued: ${d.issuedAt}</span></div>
          </div>
          <div class="actions">
            <span class="response-badge" data-state=${d.responseState}>
              ${directionResponseLabel(d.responseState)}
            </span>
            <button
              class="item-toggle"
              type="button"
              @click=${(): void => this.#toggleExpanded(d.id)}
            >
              ${isExpanded ? 'Close' : 'Open'}
            </button>
          </div>
        </div>
        ${isExpanded
          ? html`
              ${d.description ? html`<p>${d.description}</p>` : ''}
              ${d.responseNotes ? html`<p class="response-notes">${d.responseNotes}</p>` : ''}
              ${d.evidence.length > 0
                ? html`<div class="evidence-list" aria-label="Evidence">
                    ${d.evidence.map((entry) => html`<span>${entry.kind}: ${entry.value}</span>`)}
                  </div>`
                : ''}
              ${d.requirementIds.length > 0
                ? html`<div class="req-list" aria-label="Linked requirements">
                    ${d.requirementIds.map((id) => html`<a href="#/requirement/${id}">${id}</a>`)}
                  </div>`
                : ''}
              <div class="actions">
                <button @click=${(): void => this.#startEdit(d)}>Edit</button>
                <button @click=${(): void => void this.#copyText(directionSummary(d))}>
                  Copy summary
                </button>
                <button @click=${(): void => void this.#remove(d)}>Delete</button>
              </div>
            `
          : ''}
      </li>
    `;
  }

  #toggleExpanded(id: DirectionId): void {
    const next = new Set(this.expandedDirectionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedDirectionIds = next;
  }

  #renderEdit(d: Direction): TemplateResult {
    return html`
      <li class="direction" data-id=${d.id}>
        <form
          class="edit"
          @submit=${(e: Event): void => {
            e.preventDefault();
            void this.#saveEdit(d);
          }}
        >
          <label class="field"
            >Reference<input
              type="text"
              required
              .value=${this.editReference}
              @input=${(e: Event): void => {
                this.editReference = (e.target as HTMLInputElement).value;
              }}
          /></label>
          <label class="field"
            >Title<input
              type="text"
              required
              .value=${this.editTitle}
              @input=${(e: Event): void => {
                this.editTitle = (e.target as HTMLInputElement).value;
              }}
          /></label>
          <label class="field"
            >Issued<input
              type="date"
              required
              .value=${this.editIssuedAt}
              @input=${(e: Event): void => {
                this.editIssuedAt = (e.target as HTMLInputElement).value;
              }}
          /></label>
          <label class="field"
            >Response${this.#stateSelect(this.editResponseState, (value) => {
              this.editResponseState = value;
            })}</label
          >
          <div class="actions">
            <button class="primary" type="submit">Save</button
            ><button type="button" @click=${(): void => this.#cancelEdit()}>Cancel</button>
          </div>
          <label class="field full"
            >Description<textarea
              .value=${this.editDescription}
              @input=${(e: Event): void => {
                this.editDescription = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </label>
          <label class="field full"
            >Linked requirement IDs<input
              type="text"
              .value=${this.editReqRefs}
              @input=${(e: Event): void => {
                this.editReqRefs = (e.target as HTMLInputElement).value;
              }}
          /></label>
          <label class="field full"
            >Response notes<textarea
              .value=${this.editResponseNotes}
              @input=${(e: Event): void => {
                this.editResponseNotes = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </label>
          <label class="field"
            >Evidence type<select
              .value=${this.editEvidenceKind}
              @change=${(e: Event): void => {
                this.editEvidenceKind = (e.target as HTMLSelectElement)
                  .value as EvidenceRef['kind'];
              }}
            >
              <option value="note">Note</option>
              <option value="url">URL</option>
            </select></label
          >
          <label class="field full"
            >Add evidence<input
              type="text"
              .value=${this.editEvidenceValue}
              @input=${(e: Event): void => {
                this.editEvidenceValue = (e.target as HTMLInputElement).value;
              }}
          /></label>
        </form>
      </li>
    `;
  }

  #canCreate(): boolean {
    return (
      this.reference.trim().length > 0 &&
      this.newTitle.trim().length > 0 &&
      this.issuedAt.length > 0
    );
  }

  async #create(): Promise<void> {
    if (!this.store || !this.#canCreate()) return;
    const entry = evidence(this.evidenceKind, this.evidenceValue);
    await this.store.createDirection({
      reference: this.reference.trim(),
      title: this.newTitle.trim(),
      issuedAt: this.issuedAt,
      responseState: this.responseState,
      evidence: entry ? [entry] : [],
      ...(this.description.trim() ? { description: this.description.trim() } : {}),
      ...(this.responseNotes.trim() ? { responseNotes: this.responseNotes.trim() } : {}),
      requirementIds: parseRequirementIds(this.reqRefs),
    });
    this.reference = '';
    this.newTitle = '';
    this.issuedAt = '';
    this.description = '';
    this.reqRefs = '';
    this.responseState = 'not-set';
    this.responseNotes = '';
    this.evidenceValue = '';
  }

  #startEdit(d: Direction): void {
    this.editingId = d.id;
    this.expandedDirectionIds = new Set(this.expandedDirectionIds).add(d.id);
    this.editReference = d.reference;
    this.editTitle = d.title;
    this.editIssuedAt = d.issuedAt;
    this.editDescription = d.description ?? '';
    this.editReqRefs = d.requirementIds.join(', ');
    this.editResponseState = d.responseState;
    this.editResponseNotes = d.responseNotes ?? '';
    this.editEvidenceValue = '';
  }

  #cancelEdit(): void {
    this.editingId = null;
  }

  async #saveEdit(d: Direction): Promise<void> {
    if (!this.store) return;
    const desc = this.editDescription.trim();
    const notes = this.editResponseNotes.trim();
    const entry = evidence(this.editEvidenceKind, this.editEvidenceValue);
    await this.store.updateDirection(d.id, {
      reference: this.editReference.trim(),
      title: this.editTitle.trim(),
      issuedAt: this.editIssuedAt,
      responseState: this.editResponseState,
      evidence: entry ? [...d.evidence, entry] : d.evidence,
      ...(desc ? { description: desc } : { description: undefined }),
      ...(notes ? { responseNotes: notes } : { responseNotes: undefined }),
      requirementIds: parseRequirementIds(this.editReqRefs),
    });
    this.editingId = null;
  }

  async #copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus = 'Copied summary.';
    } catch {
      this.copyStatus = 'Copy failed.';
    }
  }

  async #remove(d: Direction): Promise<void> {
    if (!this.store) return;
    const ok = window.confirm(`Delete direction "${d.reference}"?`);
    if (!ok) return;
    await this.store.removeDirection(d.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-directions-view': DirectionsView;
  }
}
