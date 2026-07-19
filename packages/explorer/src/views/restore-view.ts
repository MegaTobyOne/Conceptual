import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { BackupValidationError, importBackup } from '../data/backup.ts';

@customElement('pspf-restore-view')
export class RestoreView extends LitElement {
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
      input[type='file'] {
        display: block;
        margin-bottom: var(--space-2);
      }
      button {
        font: inherit;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-sm);
        border: 1px solid var(--colour-accent);
        background: var(--colour-accent);
        color: var(--colour-on-accent, white);
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error {
        color: var(--colour-danger, #c0392b);
        margin-top: var(--space-2);
        font-size: var(--text-sm);
      }
      .ok {
        color: var(--colour-success, #1e7e34);
        margin-top: var(--space-2);
        font-size: var(--text-sm);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @state() private accessor file: File | null = null;
  @state() private accessor error = '';
  @state() private accessor ok = '';
  @state() private accessor busy = false;

  override render(): TemplateResult {
    return html`
      <article>
        <h2>Restore from backup</h2>
        <section class="panel">
          <p>
            Restoring will <strong>replace</strong> all data currently in this browser with the
            contents of the backup file. The current PSPF catalogue is unaffected.
          </p>
          <label>
            <span>Backup file</span>
            <input
              type="file"
              accept="application/json,.json"
              @change=${(e: Event): void => this.#onFile(e)}
              data-testid="restore-file"
            />
          </label>
          <button
            type="button"
            ?disabled=${!this.file || this.busy}
            @click=${(): void => void this.#restore()}
            data-testid="restore-button"
          >
            ${this.busy ? 'Restoring…' : 'Restore'}
          </button>
          ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ''}
          ${this.ok ? html`<p class="ok" role="status">${this.ok}</p>` : ''}
        </section>
      </article>
    `;
  }

  #onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.error = '';
    this.ok = '';
  }

  async #restore(): Promise<void> {
    if (!this.store || !this.file) return;
    this.busy = true;
    this.error = '';
    this.ok = '';
    try {
      const text = await this.file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new BackupValidationError('File is not valid JSON.');
      }
      await importBackup(this.store.db, parsed);
      await this.store.loadAll();
      this.ok = 'Backup restored successfully.';
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-restore-view': RestoreView;
  }
}
