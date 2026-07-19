import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import {
  SHAREABLE_STORES,
  type MergeReport,
  type ShareableStore,
  exportSharePackage,
  mergeSharePackage,
} from '../data/share.ts';

const STORE_LABELS: Record<ShareableStore, string> = {
  risks: 'Risks',
  actions: 'Actions',
  tags: 'Tags',
  savedViews: 'Saved views',
  directions: 'Directions',
  relationships: 'Relationships',
};

@customElement('pspf-share-view')
export class ShareView extends LitElement {
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
      h3 {
        margin: var(--space-3) 0 var(--space-2) 0;
        font-size: var(--text-md);
      }
      .panel {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        margin-bottom: var(--space-3);
      }
      label.row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        padding: 2px 0;
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
      .alert {
        padding: var(--space-2);
        border-radius: var(--radius-sm);
        font-size: var(--text-sm);
        margin-top: var(--space-2);
      }
      .alert.error {
        background: var(--colour-state-no-bg, #fde8e8);
        color: var(--colour-state-no-fg, #7c1d1d);
      }
      .alert.ok {
        background: var(--colour-state-yes-bg, #e6f4ea);
        color: var(--colour-state-yes-fg, #1e4620);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
        margin-top: var(--space-2);
      }
      th,
      td {
        text-align: left;
        padding: var(--space-1) var(--space-2);
        border-bottom: 1px solid var(--colour-border);
      }
      th.numeric,
      td.numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @state() private accessor selection: Record<ShareableStore, boolean> = {
    risks: true,
    actions: true,
    tags: true,
    savedViews: true,
    directions: true,
    relationships: true,
  };

  @state() private accessor errorMessage = '';
  @state() private accessor okMessage = '';
  @state() private accessor lastReport: MergeReport | null = null;

  override render(): TemplateResult {
    return html`
      <article>
        <h2>Share packages</h2>
        <p>
          Export a portable subset of your records, or merge a colleague's package into your
          workspace. Existing records with matching IDs are kept untouched.
        </p>

        <section class="panel" aria-labelledby="export-heading">
          <h3 id="export-heading">Export package</h3>
          ${SHAREABLE_STORES.map(
            (s) => html`
              <label class="row">
                <input
                  type="checkbox"
                  ?checked=${this.selection[s]}
                  @change=${(e: Event): void => {
                    this.selection = {
                      ...this.selection,
                      [s]: (e.target as HTMLInputElement).checked,
                    };
                  }}
                />
                ${STORE_LABELS[s]}
              </label>
            `,
          )}
          <div style="margin-top: var(--space-2);">
            <button
              class="primary"
              type="button"
              data-testid="download-share"
              @click=${(): void => void this.#download()}
            >
              Download package
            </button>
          </div>
        </section>

        <section class="panel" aria-labelledby="import-heading">
          <h3 id="import-heading">Merge package</h3>
          <label class="row">
            <span class="visually-hidden">Choose package file to merge</span>
            <input
              type="file"
              accept="application/json,.json"
              data-testid="merge-file"
              aria-label="Choose package file to merge"
              @change=${(e: Event): void => void this.#merge(e)}
            />
          </label>
          ${this.errorMessage
            ? html`<div class="alert error" role="alert">${this.errorMessage}</div>`
            : ''}
          ${this.okMessage ? html`<div class="alert ok" role="status">${this.okMessage}</div>` : ''}
          ${this.lastReport ? this.#renderReport(this.lastReport) : ''}
        </section>
      </article>
    `;
  }

  #renderReport(report: MergeReport): TemplateResult {
    return html`
      <table aria-label="Merge report">
        <thead>
          <tr>
            <th>Store</th>
            <th class="numeric">Added</th>
            <th class="numeric">Skipped</th>
          </tr>
        </thead>
        <tbody>
          ${SHAREABLE_STORES.map(
            (s) => html`
              <tr>
                <th scope="row">${STORE_LABELS[s]}</th>
                <td class="numeric" data-added=${s}>${report.added[s]}</td>
                <td class="numeric" data-skipped=${s}>${report.skipped[s]}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }

  async #download(): Promise<void> {
    if (!this.store) return;
    this.errorMessage = '';
    this.okMessage = '';
    const selected = SHAREABLE_STORES.filter((s) => this.selection[s]);
    const pkg = await exportSharePackage(this.store.db, selected);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pspf-share-${pkg.createdAt.replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.okMessage = 'Package downloaded.';
  }

  async #merge(event: Event): Promise<void> {
    if (!this.store) return;
    this.errorMessage = '';
    this.okMessage = '';
    this.lastReport = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const report = await mergeSharePackage(this.store.db, parsed);
      this.lastReport = report;
      const totalAdded = SHAREABLE_STORES.reduce((sum, s) => sum + report.added[s], 0);
      const totalSkipped = SHAREABLE_STORES.reduce((sum, s) => sum + report.skipped[s], 0);
      this.okMessage = `Merge complete: ${totalAdded} added, ${totalSkipped} skipped.`;
      await this.store.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      input.value = '';
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-share-view': ShareView;
  }
}
