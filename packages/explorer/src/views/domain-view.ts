import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { allDomains, requirementsByDomain } from '../pspf/index.ts';
import type { ComplianceEntry, ComplianceState, DomainKey, RequirementId } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { summariseDomain } from '../domain/summary.ts';
import '../components/compliance-badge.ts';
import '../components/breadcrumbs.ts';

@customElement('pspf-domain-view')
export class DomainView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        font-size: var(--text-xl);
        margin: 0 0 var(--space-2) 0;
      }
      article {
        display: grid;
        gap: var(--space-3);
      }
      .description {
        margin: 0 0 var(--space-3) 0;
        color: var(--colour-fg-muted);
        max-width: 70ch;
      }
      .summary {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
        margin: 0 0 var(--space-3) 0;
      }
      ul.requirements {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      li.requirement {
        display: grid;
        grid-template-columns: minmax(6rem, auto) 1fr auto;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      li.requirement:hover,
      li.requirement:focus-within {
        transform: translateY(-1px);
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-2);
      }
      li.requirement a {
        color: inherit;
        text-decoration: none;
        font-weight: 600;
      }
      li.requirement a:hover,
      li.requirement a:focus-visible {
        text-decoration: underline;
        outline: none;
      }
      .placeholder {
        padding: var(--space-3);
        border: 1px dashed var(--colour-border);
        border-radius: var(--radius-md);
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        background: var(--colour-bg-elevated);
      }
      button.print {
        margin-bottom: var(--space-3);
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg-elevated);
        color: var(--colour-fg);
        cursor: pointer;
        font: inherit;
        transition:
          transform var(--motion-fast) ease,
          border-color var(--motion-fast) ease,
          box-shadow var(--motion-fast) ease;
      }
      button.print:hover,
      button.print:focus-visible {
        outline: none;
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-1);
        transform: translateY(-1px);
      }
      @media print {
        button.print {
          display: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) params: Record<string, string> = {};

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.compliance] : []));

  private get domainKey(): DomainKey | undefined {
    const raw = this.params.key;
    if (typeof raw !== 'string') return undefined;
    return allDomains.find((d) => d.key === raw)?.key;
  }

  override render() {
    const key = this.domainKey;
    const domain = allDomains.find((d) => d.key === key);
    if (!domain) {
      return html`
        <article>
          <h2>Unknown domain</h2>
          <p class="placeholder">
            No domain matched the URL. Go back to the home screen and choose a PSPF domain from the
            overview cards.
          </p>
        </article>
      `;
    }
    const reqs = requirementsByDomain.get(domain.key) ?? [];
    const compliance: ReadonlyMap<RequirementId, ComplianceEntry> =
      this.store?.compliance.value ?? new Map();
    const summary = summariseDomain(domain, compliance);
    return html`
      <article>
        <pspf-breadcrumbs
          .items=${[{ label: 'Home', href: '#/' }, { label: domain.name }]}
        ></pspf-breadcrumbs>
        <h2>${domain.name}</h2>
        <p class="description">${domain.description}</p>
        <p class="summary">
          ${reqs.length} requirements · ${summary.byState.yes} fully implemented ·
          ${summary.byState.no} not yet implemented · ${summary.byState['not-set']} not set
        </p>
        <button
          type="button"
          class="print"
          data-testid="print-summary"
          @click=${(): void => window.print()}
        >
          Print summary
        </button>
        <ul class="requirements">
          ${reqs.map((r): TemplateResult => {
            const entry = compliance.get(r.id);
            const state: ComplianceState = entry ? entry.state : 'not-set';
            return html`
              <li class="requirement">
                <a href="#/requirement/${r.id}">${r.id}</a>
                <span>${r.title}</span>
                <pspf-compliance-badge .state=${state}></pspf-compliance-badge>
              </li>
            `;
          })}
        </ul>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-domain-view': DomainView;
  }
}
