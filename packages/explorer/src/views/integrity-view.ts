/**
 * Integrity view: surfaces orphan refs, duplicates, self-loops and
 * dangling relationship endpoints. Runs the scan in a Web Worker so
 * larger datasets don't stall the main thread.
 */

import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import {
  scanIntegrity,
  type IntegrityIssue,
  type IntegrityIssueKind,
  type IntegrityReport,
} from '../domain/integrity.ts';
import { allRequirements } from '../pspf/index.ts';

const ISSUE_LABELS: Record<IntegrityIssueKind, string> = {
  'orphan-ref': 'Orphan reference',
  'orphan-link': 'Dangling endpoint',
  duplicate: 'Duplicate',
  'self-loop': 'Self-loop',
};

@customElement('pspf-integrity-view')
export class IntegrityView extends LitElement {
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
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-bottom: var(--space-3);
      }
      button {
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg-elevated);
        color: var(--colour-fg);
        cursor: pointer;
        font: inherit;
      }
      button:hover {
        background: var(--colour-border);
      }
      .status {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }
      .ok {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        font-size: var(--text-sm);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: var(--space-1) var(--space-2);
        text-align: left;
        border-bottom: 1px solid var(--colour-border);
        font-size: var(--text-sm);
        vertical-align: top;
      }
      th {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pill {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: var(--text-xs);
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
      }
      .pill.orphan-ref,
      .pill.orphan-link {
        border-color: #b91c1c;
        color: #b91c1c;
      }
      .pill.duplicate {
        border-color: #92400e;
        color: #92400e;
      }
      .pill.self-loop {
        border-color: #6d28d9;
        color: #6d28d9;
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [
          this.store.risks,
          this.store.actions,
          this.store.directions,
          this.store.compliance,
          this.store.relationships,
        ]
      : [],
  );

  @state() private accessor report: IntegrityReport | undefined = undefined;
  @state() private accessor running = false;
  @state() private accessor errorMessage = '';

  override render(): TemplateResult {
    const issues = this.report?.issues ?? [];
    return html`
      <article>
        <h2>Integrity</h2>
        <p>
          Scans your local data for orphan references, duplicate titles, self-loops and dangling
          relationship endpoints. The scan runs in a background worker.
        </p>
        <div class="toolbar">
          <button
            type="button"
            data-testid="run-scan"
            ?disabled=${this.running}
            @click=${(): void => void this.#runScan()}
          >
            ${this.running ? 'Scanning…' : 'Run scan'}
          </button>
          <span class="status" data-testid="status">
            ${this.report
              ? `Last scan ${new Date(this.report.scannedAt).toLocaleString()} — ${
                  this.report.totals.records
                } records, ${this.report.totals.issues} issue${
                  this.report.totals.issues === 1 ? '' : 's'
                }`
              : 'No scan yet'}
          </span>
          ${this.errorMessage
            ? html`<span class="status" role="alert" data-testid="error"
                >Worker error: ${this.errorMessage}</span
              >`
            : ''}
        </div>
        ${this.report && issues.length === 0
          ? html`<p class="ok" data-testid="clean">No integrity issues detected.</p>`
          : ''}
        ${issues.length > 0
          ? html`
              <table aria-label="Integrity issues">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Entity</th>
                    <th>ID</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody data-testid="issues">
                  ${issues.map(
                    (i: IntegrityIssue) => html`
                      <tr data-kind=${i.kind} data-entity=${i.entity}>
                        <td><span class="pill ${i.kind}">${ISSUE_LABELS[i.kind]}</span></td>
                        <td>${i.entity}</td>
                        <td><code>${i.id}</code></td>
                        <td>${i.message}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
          : ''}
      </article>
    `;
  }

  async #runScan(): Promise<void> {
    if (!this.store) return;
    this.running = true;
    this.errorMessage = '';
    try {
      const input = this.#buildInput();
      this.report = await this.#scanInWorker(input);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      // Fall back to a main-thread scan so the user still gets a result.
      this.report = scanIntegrity(this.#buildInput());
    } finally {
      this.running = false;
    }
  }

  #buildInput(): Parameters<typeof scanIntegrity>[0] {
    const store = this.store!;
    return {
      requirementIds: allRequirements.map((r) => r.id),
      risks: store.risks.value,
      actions: store.actions.value,
      directions: store.directions.value,
      compliance: [...store.compliance.value.values()],
      relationships: store.relationships.value,
    };
  }

  #scanInWorker(input: Parameters<typeof scanIntegrity>[0]): Promise<IntegrityReport> {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('../workers/integrity.worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      worker.addEventListener(
        'message',
        (event: MessageEvent<{ type: string; report?: IntegrityReport; message?: string }>) => {
          const data = event.data;
          if (data.type === 'report' && data.report) {
            resolve(data.report);
          } else if (data.type === 'error') {
            reject(new Error(data.message ?? 'Unknown worker error'));
          }
          worker.terminate();
        },
      );
      worker.addEventListener('error', (event) => {
        reject(new Error(event.message || 'Worker failed'));
        worker.terminate();
      });
      worker.postMessage({ type: 'scan', input });
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-integrity-view': IntegrityView;
  }
}
