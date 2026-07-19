import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { applyGrcCapture, type GrcCaptureSummary } from '../data/grc-capture.ts';

const SAMPLE_PAYLOAD = {
  pspfGrcCapture: 'v1',
  source: 'YourGRC',
  capturedAt: '2025-04-01T00:00:00Z',
  entries: [
    {
      requirementId: 'GOV-001',
      state: 'yes',
      evidenceUrl: 'https://intranet.example/evidence/gov-001',
      reviewer: 'CISO',
      reviewedAt: '2025-04-01T00:00:00Z',
    },
  ],
};

@customElement('pspf-grc-view')
export class GrcView extends LitElement {
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
      .panel {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        margin-bottom: var(--space-3);
      }
      pre {
        margin: 0;
        padding: var(--space-2);
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        overflow-x: auto;
      }
      label.row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
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
      ul.rejected {
        list-style: disc;
        margin: var(--space-1) 0 0 var(--space-3);
        font-size: var(--text-sm);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @state() private accessor errorMessage = '';
  @state() private accessor summary: GrcCaptureSummary | null = null;

  override render(): TemplateResult {
    return html`
      <article>
        <h2>GRC capture intake</h2>
        <p>
          Ingest compliance evidence emitted by your GRC platform. Payloads must conform to the
          locked v1 schema; unknown fields are rejected. Existing evidence is preserved &mdash; new
          evidence URLs are appended.
        </p>

        <section class="panel" aria-labelledby="schema-heading">
          <h3 id="schema-heading">Expected payload</h3>
          <pre><code>${JSON.stringify(SAMPLE_PAYLOAD, null, 2)}</code></pre>
        </section>

        <section class="panel" aria-labelledby="upload-heading">
          <h3 id="upload-heading">Upload payload</h3>
          <label class="row">
            <span class="visually-hidden">Choose GRC payload file</span>
            <input
              type="file"
              accept="application/json,.json"
              data-testid="grc-file"
              aria-label="Choose GRC payload file"
              @change=${(e: Event): void => void this.#ingest(e)}
            />
          </label>
          ${this.errorMessage
            ? html`<div class="alert error" role="alert" data-testid="grc-error">
                ${this.errorMessage}
              </div>`
            : ''}
          ${this.summary ? this.#renderSummary(this.summary) : ''}
        </section>
      </article>
    `;
  }

  #renderSummary(s: GrcCaptureSummary): TemplateResult {
    return html`
      <div class="alert ok" role="status" data-testid="grc-summary">
        <div>
          <strong>${s.applied}</strong> entries applied from <strong>${s.source}</strong>
          (captured ${s.capturedAt}).
        </div>
        ${s.rejected.length > 0
          ? html`
              <div>${s.rejected.length} rejected:</div>
              <ul class="rejected">
                ${s.rejected.map(
                  (r) => html`<li><code>${r.requirementId}</code>: ${r.reason}</li>`,
                )}
              </ul>
            `
          : ''}
      </div>
    `;
  }

  async #ingest(event: Event): Promise<void> {
    if (!this.store) return;
    this.errorMessage = '';
    this.summary = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const store = this.store;
      const summary = await applyGrcCapture(parsed, {
        getEvidence: (reqId) => store.compliance.value.get(reqId)?.evidence ?? [],
        setCompliance: (reqId, patch) => store.setCompliance(reqId, patch),
      });
      this.summary = summary;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      input.value = '';
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-grc-view': GrcView;
  }
}
