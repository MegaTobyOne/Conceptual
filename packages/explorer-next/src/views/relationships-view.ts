import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import type { Relationship, RelationshipKind } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { allRequirements } from '../pspf/index.ts';
import '../components/list-workbench.ts';

const KINDS: readonly {
  value: RelationshipKind;
  label: string;
  left: string;
  right: string;
}[] = [
  {
    value: 'requirement-risk',
    label: 'Requirement ↔ Risk',
    left: 'Requirement',
    right: 'Risk',
  },
  {
    value: 'requirement-action',
    label: 'Requirement ↔ Action',
    left: 'Requirement',
    right: 'Action',
  },
  {
    value: 'risk-action',
    label: 'Risk ↔ Action',
    left: 'Risk',
    right: 'Action',
  },
  {
    value: 'requirement-direction',
    label: 'Requirement ↔ Direction',
    left: 'Requirement',
    right: 'Direction',
  },
];

@customElement('pspf-relationships-view')
export class RelationshipsView extends LitElement {
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
      ul.relationships {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      li.relationship {
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        padding: var(--space-3);
      }
      .item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .item-head-main {
        display: grid;
        gap: 2px;
      }
      .kind-label {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .endpoint {
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
        font-size: var(--text-sm);
      }
      .endpoint-list {
        display: grid;
        gap: var(--space-1);
        margin-top: var(--space-2);
      }
      .endpoint-row {
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
        flex-wrap: wrap;
      }
      .endpoint-row strong {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
        min-width: 6rem;
      }
      .item-toggle {
        white-space: nowrap;
      }
      .actions {
        margin-top: var(--space-2);
      }
      .empty {
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      fieldset.filter {
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        margin-bottom: var(--space-2);
      }
      fieldset.filter legend {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [this.store.relationships, this.store.risks, this.store.actions, this.store.directions]
      : [],
  );

  @state() private accessor kind: RelationshipKind = 'requirement-risk';
  @state() private accessor left = '';
  @state() private accessor right = '';
  @state() private accessor filterKind: RelationshipKind | 'all' = 'all';
  @state() private accessor expandedRelationshipIds: ReadonlySet<string> = new Set();

  #requirementOptions = allRequirements.map((req) => ({
    id: req.id,
    label: `${req.id} – ${req.title}`,
  }));

  override render(): TemplateResult {
    const all = this.store?.relationships.value ?? [];
    const visible = this.filterKind === 'all' ? all : all.filter((r) => r.kind === this.filterKind);
    const meta = KINDS.find((k) => k.value === this.kind) ?? KINDS[0]!;
    const leftOptions = this.#endpointOptions(this.kind, 'left');
    const rightOptions = this.#endpointOptions(this.kind, 'right');

    return html`
      <article>
        <h2>Relationships</h2>
        <p>
          Cross-link requirements, risks, actions and directions. Relationships are symmetric;
          ordering of endpoints is normalised on save.
        </p>
        <pspf-list-workbench left-label="Relationship controls" right-label="Relationship table">
          <div slot="left">
            <h3>Build links</h3>
            <p class="panel-note">
              Choose the relationship type, then connect the two endpoints. The left panel updates
              automatically as the kind changes.
            </p>
            <form
              class="create"
              @submit=${(e: Event): void => {
                e.preventDefault();
                void this.#create();
              }}
              aria-label="Add relationship"
            >
              <label class="field">
                Kind
                <select
                  @change=${(e: Event): void => {
                    this.kind = (e.target as HTMLSelectElement).value as RelationshipKind;
                    this.left = '';
                    this.right = '';
                  }}
                >
                  ${KINDS.map(
                    (k) =>
                      html`<option value=${k.value} ?selected=${k.value === this.kind}>
                        ${k.label}
                      </option>`,
                  )}
                </select>
              </label>
              <label class="field">
                ${meta.left}
                <select
                  aria-label=${meta.left}
                  required
                  @change=${(e: Event): void => {
                    this.left = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="" ?selected=${this.left === ''}>— select —</option>
                  ${leftOptions.map(
                    (opt) =>
                      html`<option value=${opt.id} ?selected=${opt.id === this.left}>
                        ${opt.label}
                      </option>`,
                  )}
                </select>
              </label>
              <label class="field">
                ${meta.right}
                <select
                  aria-label=${meta.right}
                  required
                  @change=${(e: Event): void => {
                    this.right = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="" ?selected=${this.right === ''}>— select —</option>
                  ${rightOptions.map(
                    (opt) =>
                      html`<option value=${opt.id} ?selected=${opt.id === this.right}>
                        ${opt.label}
                      </option>`,
                  )}
                </select>
              </label>
              <button class="primary" type="submit" ?disabled=${!this.#canCreate()}>
                Add link
              </button>
            </form>

            <fieldset class="filter">
              <legend>Filter</legend>
              <select
                aria-label="Filter by kind"
                @change=${(e: Event): void => {
                  this.filterKind = (e.target as HTMLSelectElement).value as
                    | RelationshipKind
                    | 'all';
                }}
              >
                <option value="all" ?selected=${this.filterKind === 'all'}>All kinds</option>
                ${KINDS.map(
                  (k) =>
                    html`<option value=${k.value} ?selected=${k.value === this.filterKind}>
                      ${k.label}
                    </option>`,
                )}
              </select>
            </fieldset>
          </div>

          <div slot="right">
            ${visible.length === 0
              ? html`<p class="empty" data-testid="empty">No relationships recorded.</p>`
              : html`<ul class="relationships">
                  ${visible.map((r) => this.#renderItem(r))}
                </ul>`}
          </div>
        </pspf-list-workbench>
      </article>
    `;
  }

  #renderItem(r: Relationship): TemplateResult {
    const expanded = this.expandedRelationshipIds.has(r.id);
    const label = KINDS.find((k) => k.value === r.kind)?.label ?? r.kind;
    return html`
      <li class="relationship" data-id=${r.id}>
        <div class="item-head">
          <div class="item-head-main">
            <strong>${this.#lookupLabel(r.endpoints[0])}</strong>
            <span class="kind-label">${label}</span>
          </div>
          <button
            class="item-toggle"
            type="button"
            @click=${(): void => this.#toggleExpanded(r.id)}
          >
            ${expanded ? 'Close' : 'Open'}
          </button>
        </div>
        ${expanded
          ? html`
              <div class="endpoint-list">
                <div class="endpoint-row">
                  <strong>Endpoint A</strong>
                  <span class="endpoint">${this.#lookupLabel(r.endpoints[0])}</span>
                </div>
                <div class="endpoint-row">
                  <strong>Endpoint B</strong>
                  <span class="endpoint">${this.#lookupLabel(r.endpoints[1])}</span>
                </div>
              </div>
              <div class="actions">
                <button @click=${(): void => void this.#remove(r)} aria-label="Delete relationship">
                  Delete
                </button>
              </div>
            `
          : ''}
      </li>
    `;
  }

  #toggleExpanded(id: string): void {
    const next = new Set(this.expandedRelationshipIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedRelationshipIds = next;
  }

  #canCreate(): boolean {
    const left = this.left.trim();
    const right = this.right.trim();
    if (left.length === 0 || right.length === 0) return false;
    return (
      this.#isValidEndpoint(this.kind, 'left', left) &&
      this.#isValidEndpoint(this.kind, 'right', right)
    );
  }

  async #create(): Promise<void> {
    if (!this.store || !this.#canCreate()) return;
    await this.store.createRelationship({
      kind: this.kind,
      endpoints: [this.left.trim(), this.right.trim()],
    });
    this.left = '';
    this.right = '';
  }

  #endpointOptions(
    kind: RelationshipKind,
    side: 'left' | 'right',
  ): readonly {
    id: string;
    label: string;
  }[] {
    const risks = (this.store?.risks.value ?? []).map((risk) => ({
      id: risk.id,
      label: risk.title,
    }));
    const actions = (this.store?.actions.value ?? []).map((action) => ({
      id: action.id,
      label: action.title,
    }));
    const directions = (this.store?.directions.value ?? []).map((direction) => ({
      id: direction.id,
      label: `${direction.reference} – ${direction.title}`,
    }));
    switch (kind) {
      case 'requirement-risk':
        return side === 'left' ? this.#requirementOptions : risks;
      case 'requirement-action':
        return side === 'left' ? this.#requirementOptions : actions;
      case 'risk-action':
        return side === 'left' ? risks : actions;
      case 'requirement-direction':
        return side === 'left' ? this.#requirementOptions : directions;
    }
  }

  #isValidEndpoint(kind: RelationshipKind, side: 'left' | 'right', id: string): boolean {
    const value = id.trim();
    if (value.length === 0) return false;
    const options = this.#endpointOptions(kind, side);
    return options.some((opt) => opt.id === value);
  }

  #lookupLabel(id: string): string {
    const req = allRequirements.find((r) => r.id === id);
    if (req) return `${req.id} – ${req.title}`;
    const risk = this.store?.risks.value.find((r) => r.id === id);
    if (risk) return risk.title;
    const action = this.store?.actions.value.find((a) => a.id === id);
    if (action) return action.title;
    const direction = this.store?.directions.value.find((d) => d.id === id);
    if (direction) return `${direction.reference} – ${direction.title}`;
    return id;
  }

  async #remove(r: Relationship): Promise<void> {
    if (!this.store) return;
    const ok = window.confirm('Delete this relationship?');
    if (!ok) return;
    await this.store.removeRelationship(r.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-relationships-view': RelationshipsView;
  }
}
