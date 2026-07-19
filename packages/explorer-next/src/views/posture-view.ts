import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import {
  DOMAIN_KEYS,
  POSTURES,
  THREAT_LEVELS,
  type DomainKey,
  type Posture,
  type PostureRecord,
  type PostureSetting,
  type ThreatLevel,
} from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import '../components/list-workbench.ts';

const DEFAULT_GLOBAL: PostureSetting = {
  threat: 'low',
  posture: 'standard',
  updatedAt: new Date(0).toISOString(),
};

@customElement('pspf-posture-view')
export class PostureView extends LitElement {
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
      .row {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        align-items: end;
      }
      label.field {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
        min-width: 12rem;
      }
      select {
        font: inherit;
        color: inherit;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
      }
      .meta {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      ul.domains {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      li.domain {
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        padding: var(--space-3);
        background: var(--colour-bg);
      }
      .domain-head {
        display: flex;
        gap: var(--space-2);
        justify-content: space-between;
        align-items: flex-start;
      }
      .domain-head-main {
        display: grid;
        gap: 2px;
      }
      .domain-line {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
        align-items: center;
      }
      .domain-controls {
        margin-top: var(--space-2);
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: end;
      }
      .domain-controls .field {
        min-width: 11rem;
      }
      .item-toggle {
        white-space: nowrap;
      }
      .domain-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .count {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .badge {
        display: inline-flex;
        padding: 2px var(--space-1);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        background: var(--badge-bg, var(--colour-bg));
        color: var(--badge-fg, var(--colour-fg));
        border: 1px solid var(--colour-border);
      }
      .badge[data-threat='low'] {
        --badge-bg: #2f6f3a;
        --badge-fg: #fff;
      }
      .badge[data-threat='elevated'] {
        --badge-bg: #b8860b;
        --badge-fg: #fff;
      }
      .badge[data-threat='high'] {
        --badge-bg: #b34a00;
        --badge-fg: #fff;
      }
      .badge[data-threat='critical'] {
        --badge-bg: #99182c;
        --badge-fg: #fff;
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.posture] : []));

  @state() private expandedDomainKeys: ReadonlySet<DomainKey> = new Set();

  override render(): TemplateResult {
    const record = this.store?.posture.value;
    const global = record?.global ?? DEFAULT_GLOBAL;
    const overrideCount = Object.keys(record?.perDomain ?? {}).length;
    return html`
      <article>
        <h2>Posture &amp; threat level</h2>
        <p>
          Set the organisation's overall threat level and security posture, with optional per-domain
          overrides for finer-grained signalling.
        </p>
        <pspf-list-workbench left-label="Posture controls" right-label="Domain posture list">
          <div slot="left">
            <h3>Global posture</h3>
            <p class="panel-note">
              Set the overall posture here first. Domain overrides on the right only need to be used
              when one area should differ from the global stance.
            </p>
            <div class="row">
              <label class="field">
                Threat level
                <select
                  @change=${(e: Event): void => {
                    const v = (e.target as HTMLSelectElement).value as ThreatLevel;
                    void this.#updateGlobal({ threat: v });
                  }}
                >
                  ${THREAT_LEVELS.map(
                    (t) => html`<option value=${t} ?selected=${t === global.threat}>${t}</option>`,
                  )}
                </select>
              </label>
              <label class="field">
                Posture
                <select
                  @change=${(e: Event): void => {
                    const v = (e.target as HTMLSelectElement).value as Posture;
                    void this.#updateGlobal({ posture: v });
                  }}
                >
                  ${POSTURES.map(
                    (p) => html`<option value=${p} ?selected=${p === global.posture}>${p}</option>`,
                  )}
                </select>
              </label>
              <span class="meta">
                Updated
                ${global.updatedAt === DEFAULT_GLOBAL.updatedAt ? 'never' : global.updatedAt}
              </span>
            </div>
            <p class="count">Domain overrides: ${overrideCount}</p>
          </div>

          <div slot="right">
            <h3>Per-domain overrides</h3>
            <ul class="domains">
              ${DOMAIN_KEYS.map((d) => this.#domainItem(d, record, global))}
            </ul>
          </div>
        </pspf-list-workbench>
      </article>
    `;
  }

  #domainItem(
    d: DomainKey,
    record: PostureRecord | undefined,
    global: PostureSetting,
  ): TemplateResult {
    const setting = record?.perDomain[d];
    const expanded = this.expandedDomainKeys.has(d);
    const threat = setting?.threat ?? '';
    const posture = setting?.posture ?? '';
    const effectiveThreat = setting?.threat ?? global.threat;
    const effectivePosture = setting?.posture ?? global.posture;
    return html`
      <li class="domain">
        <div class="domain-head">
          <div class="domain-head-main">
            <strong>${d}</strong>
            <div class="domain-line">
              <span class="badge" data-threat=${effectiveThreat}>${effectiveThreat}</span>
              <span class="badge">${effectivePosture}</span>
              <span class="meta">${setting ? 'override' : 'using global setting'}</span>
            </div>
            <span class="meta">Updated ${setting?.updatedAt ?? global.updatedAt}</span>
          </div>
          <button class="item-toggle" type="button" @click=${(): void => this.#toggleExpanded(d)}>
            ${expanded ? 'Close' : 'Open'}
          </button>
        </div>

        ${expanded
          ? html`
              <div class="domain-controls">
                <label class="field">
                  Threat
                  <select
                    aria-label=${`Threat for ${d}`}
                    @change=${(e: Event): void => {
                      const v = (e.target as HTMLSelectElement).value as ThreatLevel | '';
                      void this.#updateDomain(d, v === '' ? null : { threat: v });
                    }}
                  >
                    <option value="" ?selected=${threat === ''}>(inherit)</option>
                    ${THREAT_LEVELS.map(
                      (t) => html`<option value=${t} ?selected=${t === threat}>${t}</option>`,
                    )}
                  </select>
                </label>

                <label class="field">
                  Posture
                  <select
                    aria-label=${`Posture for ${d}`}
                    @change=${(e: Event): void => {
                      const v = (e.target as HTMLSelectElement).value as Posture | '';
                      void this.#updateDomain(d, v === '' ? null : { posture: v });
                    }}
                  >
                    <option value="" ?selected=${posture === ''}>(inherit)</option>
                    ${POSTURES.map(
                      (p) => html`<option value=${p} ?selected=${p === posture}>${p}</option>`,
                    )}
                  </select>
                </label>

                <div class="domain-actions">
                  <button type="button" @click=${(): void => void this.#updateDomain(d, null)}>
                    Clear override
                  </button>
                </div>
              </div>
            `
          : ''}
      </li>
    `;
  }

  #toggleExpanded(d: DomainKey): void {
    const next = new Set(this.expandedDomainKeys);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    this.expandedDomainKeys = next;
  }

  async #updateGlobal(patch: Partial<Pick<PostureSetting, 'threat' | 'posture'>>): Promise<void> {
    if (!this.store) return;
    const current = this.store.posture.value;
    const global: PostureSetting = {
      threat: current?.global.threat ?? DEFAULT_GLOBAL.threat,
      posture: current?.global.posture ?? DEFAULT_GLOBAL.posture,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const next: PostureRecord = { global, perDomain: { ...(current?.perDomain ?? {}) } };
    await this.store.setPosture(next);
  }

  async #updateDomain(
    d: DomainKey,
    patch: Partial<Pick<PostureSetting, 'threat' | 'posture'>> | null,
  ): Promise<void> {
    if (!this.store) return;
    const current = this.store.posture.value;
    const global = current?.global ?? DEFAULT_GLOBAL;
    const perDomain: PostureRecord['perDomain'] = { ...(current?.perDomain ?? {}) };
    if (patch === null) {
      delete perDomain[d];
    } else {
      const existing = perDomain[d];
      perDomain[d] = {
        threat: existing?.threat ?? global.threat,
        posture: existing?.posture ?? global.posture,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    }
    await this.store.setPosture({ global, perDomain });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-posture-view': PostureView;
  }
}
