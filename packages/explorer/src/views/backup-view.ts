import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { exportBackup, clearAllStores } from '../data/backup.ts';

@customElement('pspf-backup-view')
export class BackupView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--space-3) 0;
      }
      section.panel {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        margin-bottom: var(--space-3);
      }
      section.danger {
        border-color: var(--colour-danger, #c0392b);
      }
      button {
        font: inherit;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-sm);
        border: 1px solid var(--colour-border);
        background: var(--colour-bg-elevated);
        cursor: pointer;
      }
      button.primary {
        background: var(--colour-accent);
        color: var(--colour-on-accent, white);
        border-color: var(--colour-accent);
      }
      button.danger {
        background: var(--colour-danger, #c0392b);
        color: white;
        border-color: var(--colour-danger, #c0392b);
      }
      .status {
        margin-top: var(--space-2);
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @state() private accessor status = '';

  override render(): TemplateResult {
    return html`
      <article>
        <h2>Backup &amp; clear data</h2>
        <section class="panel">
          <h3>Download a backup</h3>
          <p>
            Saves every record (compliance, risks, actions, tags, saved views, work tracking,
            posture, directions, relationships and metadata) to a JSON file you can store offline or
            share with another browser.
          </p>
          <button
            class="primary"
            type="button"
            @click=${(): void => void this.#download()}
            data-testid="download-backup"
          >
            Download backup JSON
          </button>
          ${this.status ? html`<p class="status" role="status">${this.status}</p>` : ''}
        </section>

        <section class="panel danger" aria-label="Clear all data">
          <h3>Clear all data</h3>
          <p>
            Deletes every record from this browser. The PSPF requirement catalogue itself is never
            touched. This action cannot be undone — download a backup first.
          </p>
          <button
            class="danger"
            type="button"
            @click=${(): void => void this.#clear()}
            data-testid="clear-all"
          >
            Clear all data
          </button>
        </section>
      </article>
    `;
  }

  async #download(): Promise<void> {
    if (!this.store) return;
    const env = await exportBackup(this.store.db);
    const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `pspf-explorer-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.status = `Backup downloaded at ${new Date().toLocaleTimeString()}.`;
  }

  async #clear(): Promise<void> {
    if (!this.store) return;
    const ok = window.confirm(
      'This will permanently delete all data stored in this browser. Continue?',
    );
    if (!ok) return;
    await clearAllStores(this.store.db);
    await this.store.loadAll();
    this.status = 'All data cleared.';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-backup-view': BackupView;
  }
}
