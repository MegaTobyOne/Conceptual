import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import {
  COMPLIANCE_STATES,
  type ComplianceEntry,
  type ComplianceEvent,
  type ComplianceState,
  type EvidenceRef,
  type RequirementId,
} from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { complianceLabel } from '../domain/compliance-display.ts';
import { formatDateTime } from '../domain/date-display.ts';

@customElement('pspf-compliance-editor')
export class ComplianceEditor extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
        margin-top: var(--space-4);
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      h3 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-md);
      }
      fieldset {
        border: 0;
        padding: 0;
        margin: 0 0 var(--space-3) 0;
      }
      legend {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
        margin-bottom: var(--space-1);
        padding: 0;
      }
      .states {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .states label {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .states label:has(input:checked) {
        border-color: var(--colour-accent);
        background: var(--colour-bg-elevated);
      }
      textarea,
      input[type='text'],
      input[type='url'],
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
        min-height: 4rem;
        resize: vertical;
      }
      .evidence-form {
        display: grid;
        grid-template-columns: 8rem 1fr auto;
        gap: var(--space-2);
        align-items: center;
        margin-top: var(--space-2);
      }
      ul.evidence {
        list-style: none;
        margin: var(--space-2) 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      ul.evidence li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2);
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
      }
      .empty {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
        margin: var(--space-2) 0 0 0;
      }
      button {
        font: inherit;
        cursor: pointer;
        border: 1px solid var(--colour-border);
        background: var(--colour-bg);
        color: inherit;
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
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
      .row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        margin-top: var(--space-2);
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-3);
      }
      ul.history {
        list-style: none;
        margin: var(--space-2) 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      ul.history li {
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
      }
      .history-meta {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
    `,
  ];

  @property({ attribute: false }) requirementId!: RequirementId;

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store ? [this.store.compliance, this.store.complianceEvents] : [],
  );

  @state() private evidenceKind: EvidenceRef['kind'] = 'url';
  @state() private evidenceValue = '';
  @state() private notesDraft: string | undefined;

  private get entry(): ComplianceEntry | undefined {
    return this.store?.compliance.value.get(this.requirementId);
  }

  private get notes(): string {
    return this.notesDraft ?? this.entry?.notes ?? '';
  }

  private get history(): readonly ComplianceEvent[] {
    const events = this.store?.complianceEvents.value ?? [];
    return events
      .filter((event) => event.requirementId === this.requirementId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  override render(): TemplateResult {
    const entry = this.entry;
    const state: ComplianceState = entry?.state ?? 'not-set';
    return html`
      <h3>Update compliance</h3>
      <fieldset>
        <legend>Status</legend>
        <div class="states" role="radiogroup" aria-label="Compliance status">
          ${COMPLIANCE_STATES.map(
            (s) => html`
              <label>
                <input
                  type="radio"
                  name="state"
                  .value=${s}
                  ?checked=${state === s}
                  @change=${(): void => void this.#setState(s)}
                />
                ${complianceLabel(s)}
              </label>
            `,
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Notes</legend>
        <textarea
          .value=${this.notes}
          @input=${(e: Event): void => {
            this.notesDraft = (e.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
        <div class="row">
          <button
            type="button"
            class="primary"
            ?disabled=${this.notesDraft === undefined || this.notesDraft === (entry?.notes ?? '')}
            @click=${(): void => void this.#saveNotes()}
          >
            Save notes
          </button>
          ${this.notesDraft !== undefined
            ? html`
                <button
                  type="button"
                  @click=${(): void => {
                    this.notesDraft = undefined;
                  }}
                >
                  Discard
                </button>
              `
            : ''}
        </div>
      </fieldset>

      <fieldset>
        <legend>Evidence</legend>
        ${entry && entry.evidence.length > 0
          ? html`
              <ul class="evidence">
                ${entry.evidence.map(
                  (e, i) => html`
                    <li>
                      <span><strong>${e.kind}:</strong> ${e.value}</span>
                      <button
                        type="button"
                        aria-label=${`Remove evidence ${i + 1}`}
                        @click=${(): void => void this.#removeEvidence(i)}
                      >
                        Remove
                      </button>
                    </li>
                  `,
                )}
              </ul>
            `
          : html`<p class="empty">No evidence recorded yet.</p>`}
        <div class="evidence-form">
          <select
            aria-label="Evidence kind"
            .value=${this.evidenceKind}
            @change=${(e: Event): void => {
              this.evidenceKind = (e.target as HTMLSelectElement).value as EvidenceRef['kind'];
            }}
          >
            <option value="url">URL</option>
            <option value="note">Note</option>
          </select>
          <input
            type=${this.evidenceKind === 'url' ? 'url' : 'text'}
            aria-label="Evidence value"
            placeholder=${this.evidenceKind === 'url'
              ? 'https://example.gov.au/policy'
              : 'Free-text reference'}
            .value=${this.evidenceValue}
            @input=${(e: Event): void => {
              this.evidenceValue = (e.target as HTMLInputElement).value;
            }}
          />
          <button
            type="button"
            class="primary"
            ?disabled=${this.evidenceValue.trim() === ''}
            @click=${(): void => void this.#addEvidence()}
          >
            Add
          </button>
        </div>
      </fieldset>

      ${entry
        ? html`
            <div class="actions">
              <button type="button" @click=${(): void => void this.#clear()}>
                Clear all compliance data
              </button>
            </div>
          `
        : ''}

      <fieldset>
        <legend>Status history</legend>
        ${this.history.length === 0
          ? html`<p class="empty">No status changes recorded yet.</p>`
          : html`
              <ul class="history">
                ${this.history.map(
                  (event) => html`
                    <li>
                      <div>
                        ${complianceLabel(event.fromState)} → ${complianceLabel(event.toState)}
                      </div>
                      <div class="history-meta">
                        ${formatDateTime(event.createdAt)}${event.noteSnapshot
                          ? html` · note: ${event.noteSnapshot}`
                          : ''}
                      </div>
                    </li>
                  `,
                )}
              </ul>
            `}
      </fieldset>
    `;
  }

  async #setState(next: ComplianceState): Promise<void> {
    if (!this.store) return;
    await this.store.setCompliance(this.requirementId, { state: next });
  }

  async #saveNotes(): Promise<void> {
    if (!this.store) return;
    const entry = this.entry;
    const trimmed = (this.notesDraft ?? '').trim();
    await this.store.setCompliance(this.requirementId, {
      state: entry?.state ?? 'not-set',
      notes: trimmed,
    });
    this.notesDraft = undefined;
  }

  async #addEvidence(): Promise<void> {
    if (!this.store) return;
    const value = this.evidenceValue.trim();
    if (!value) return;
    await this.store.addEvidence(this.requirementId, {
      kind: this.evidenceKind,
      value,
      addedAt: new Date().toISOString(),
    });
    this.evidenceValue = '';
  }

  async #removeEvidence(index: number): Promise<void> {
    if (!this.store) return;
    await this.store.removeEvidence(this.requirementId, index);
  }

  async #clear(): Promise<void> {
    if (!this.store) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('Clear all compliance data for this requirement?')
    ) {
      return;
    }
    await this.store.clearCompliance(this.requirementId);
    this.notesDraft = undefined;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-compliance-editor': ComplianceEditor;
  }
}
