import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { requirementByCanonicalId, allRequirements } from '../pspf/index.ts';
import type { RequirementId } from '../data/types.ts';
import {
  CORE_BUNDLE_META_KEYS,
  type CoreBundle,
  type CoreImportPlan,
  applyCoreBundleImport,
  buildCoreBundleExport,
  coreBundleIdentity,
  parseCoreBundle,
  planCoreBundleImport,
  verifyCoreBundleChecksums,
} from '../data/core-bundle.ts';

interface SourceStatus {
  identity: string;
  importedAt: string;
  classification?: string;
}

@customElement('pspf-core-exchange-view')
export class CoreExchangeView extends LitElement {
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
      .classification {
        display: inline-block;
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--colour-state-risk-managed-bg, #fff4e0);
        color: var(--colour-state-risk-managed-fg, #6b4300);
        font-size: var(--text-sm);
        font-weight: 600;
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
      td.numeric,
      th.numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      details {
        margin-top: var(--space-2);
        font-size: var(--text-sm);
      }
      .muted {
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @state() private accessor errorMessage = '';
  @state() private accessor okMessage = '';
  @state() private accessor pendingBundle: CoreBundle | null = null;
  @state() private accessor pendingPlan: CoreImportPlan | null = null;
  @state() private accessor sourceStatus: SourceStatus | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.#loadSourceStatus();
  }

  async #loadSourceStatus(): Promise<void> {
    if (!this.store) return;
    const source = (await this.store.getMeta(CORE_BUNDLE_META_KEYS.source)) as
      | CoreBundle
      | undefined;
    const importedAt = (await this.store.getMeta(CORE_BUNDLE_META_KEYS.importedAt)) as
      | string
      | undefined;
    if (source && importedAt) {
      const classification = source.manifest.security?.classification;
      this.sourceStatus = {
        identity: coreBundleIdentity(source.manifest),
        importedAt,
        ...(classification !== undefined ? { classification } : {}),
      };
    } else {
      this.sourceStatus = null;
    }
  }

  override render(): TemplateResult {
    return html`
      <article>
        <h2>Core exchange</h2>
        <p>
          Load a master bundle exported by the PSPF Core extension to bring your organisation's
          assessment data into this Explorer, and export your local changes back for review in
          Workshop or import into Core.
        </p>
        ${this.sourceStatus
          ? html`<p class="muted" data-testid="source-status">
              Working from bundle ${this.sourceStatus.identity}, loaded
              ${new Date(this.sourceStatus.importedAt).toLocaleString()}.
              ${this.sourceStatus.classification
                ? html`<span class="classification">${this.sourceStatus.classification}</span>`
                : ''}
            </p>`
          : html`<p class="muted" data-testid="source-status">
              No Core bundle loaded yet. You can still export your local records as a new bundle.
            </p>`}

        <section class="panel" aria-labelledby="import-heading">
          <h3 id="import-heading">Load a Core bundle</h3>
          <p class="muted">
            Select the single <strong>bundle.json</strong> file exported by PSPF Core. The bundle is
            checked against this Explorer's schema before anything is applied.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            data-testid="core-bundle-file"
            aria-label="Choose Core bundle file"
            @change=${(e: Event): void => void this.#selectBundle(e)}
          />
          ${this.pendingPlan ? this.#renderPlan(this.pendingPlan) : ''}
          ${this.errorMessage
            ? html`<div class="alert error" role="alert">${this.errorMessage}</div>`
            : ''}
          ${this.okMessage ? html`<div class="alert ok" role="status">${this.okMessage}</div>` : ''}
        </section>

        <section class="panel" aria-labelledby="export-heading">
          <h3 id="export-heading">Export for Core and Workshop</h3>
          <p class="muted">
            Builds a master bundle containing your compliance statuses, evidence references, risks,
            actions, directions, and relationships. Anything loaded from the original bundle that
            this Explorer does not edit is preserved unchanged.
          </p>
          <button
            class="primary"
            type="button"
            data-testid="export-core-bundle"
            @click=${(): void => void this.#exportBundle()}
          >
            Download Core bundle
          </button>
        </section>
      </article>
    `;
  }

  #renderPlan(plan: CoreImportPlan): TemplateResult {
    const rows: readonly [string, number][] = [
      ['Compliance statuses', plan.compliance.length],
      ['Evidence references', plan.evidence.length],
      ['Risks', plan.risks.length],
      ['Actions', plan.actions.length],
      ['Directions', plan.directions.length],
      ['Relationships', plan.relationships.length],
    ];
    return html`
      <div data-testid="import-plan">
        <p>
          Ready to load bundle <strong>${plan.identity}</strong>.
          ${plan.classification
            ? html`<span class="classification">${plan.classification}</span>`
            : ''}
        </p>
        <table aria-label="Import plan">
          <thead>
            <tr>
              <th>Records</th>
              <th class="numeric">To apply</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
              ([label, count]) => html`
                <tr>
                  <th scope="row">${label}</th>
                  <td class="numeric">${count}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
        ${plan.passThrough.length > 0
          ? html`<p class="muted">
              Kept for round-trip (not edited here):
              ${plan.passThrough.map((p) => `${p.collection} (${p.count})`).join(', ')}.
            </p>`
          : ''}
        ${plan.skipped.length > 0
          ? html`<details>
              <summary>${plan.skipped.length} records need attention or are kept as-is</summary>
              <ul>
                ${plan.skipped.map((s) => html`<li>${s.collection} ${s.id}: ${s.reason}</li>`)}
              </ul>
            </details>`
          : ''}
        <div style="margin-top: var(--space-2);">
          <button
            class="primary"
            type="button"
            data-testid="apply-core-bundle"
            @click=${(): void => void this.#applyBundle()}
          >
            Apply to this Explorer
          </button>
          <button
            type="button"
            @click=${(): void => {
              this.pendingBundle = null;
              this.pendingPlan = null;
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  async #selectBundle(event: Event): Promise<void> {
    this.errorMessage = '';
    this.okMessage = '';
    this.pendingBundle = null;
    this.pendingPlan = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const bundle = parseCoreBundle(JSON.parse(await file.text()));
      const mismatches = await verifyCoreBundleChecksums(bundle);
      if (mismatches.length > 0) {
        const names = mismatches.map((m) => m.collection).join(', ');
        throw new Error(
          `Checksum mismatch in ${names}. The bundle content does not match its manifest — re-export it from PSPF Core before loading.`,
        );
      }
      const canonicalToApp = new Map<string, RequirementId>(
        [...requirementByCanonicalId].map(([canonicalId, requirement]) => [
          canonicalId,
          requirement.id,
        ]),
      );
      this.pendingPlan = planCoreBundleImport(bundle, { canonicalToApp });
      this.pendingBundle = bundle;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      input.value = '';
    }
  }

  async #applyBundle(): Promise<void> {
    if (!this.store || !this.pendingBundle || !this.pendingPlan) return;
    this.errorMessage = '';
    try {
      const { summary, idMap } = await applyCoreBundleImport(this.pendingPlan, this.store);
      const existingIdMap =
        ((await this.store.getMeta(CORE_BUNDLE_META_KEYS.idMap)) as Record<string, string>) ?? {};
      const importedAt = new Date().toISOString();
      await this.store.setMeta(CORE_BUNDLE_META_KEYS.source, this.pendingBundle);
      await this.store.setMeta(CORE_BUNDLE_META_KEYS.idMap, { ...existingIdMap, ...idMap });
      await this.store.setMeta(CORE_BUNDLE_META_KEYS.importedAt, importedAt);
      await this.store.refreshSnapshotMetrics();
      this.okMessage = `Bundle applied: ${summary.compliance} compliance statuses, ${summary.risks} risks, ${summary.actions} actions, ${summary.directions} directions, ${summary.evidence} evidence references, ${summary.relationships} relationships.`;
      this.pendingBundle = null;
      this.pendingPlan = null;
      await this.#loadSourceStatus();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  async #exportBundle(): Promise<void> {
    if (!this.store) return;
    this.errorMessage = '';
    this.okMessage = '';
    try {
      const source = (await this.store.getMeta(CORE_BUNDLE_META_KEYS.source)) as
        | CoreBundle
        | undefined;
      const idMap =
        ((await this.store.getMeta(CORE_BUNDLE_META_KEYS.idMap)) as Record<string, string>) ?? {};
      const { bundle, idMap: nextIdMap } = await buildCoreBundleExport({
        requirements: allRequirements,
        compliance: this.store.compliance.value,
        risks: this.store.risks.value,
        actions: this.store.actions.value,
        directions: this.store.directions.value,
        relationships: this.store.relationships.value,
        ...(source !== undefined ? { source } : {}),
        idMap,
      });
      await this.store.setMeta(CORE_BUNDLE_META_KEYS.idMap, nextIdMap);
      const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pspf-core-bundle-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.okMessage = 'Core bundle downloaded.';
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-core-exchange-view': CoreExchangeView;
  }
}
