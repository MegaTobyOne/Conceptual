import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { allDomains, allRequirements, requirementsByDomain } from '../pspf/index.ts';
import type { ComplianceEntry, ComplianceState, DomainKey, RequirementId } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import '../components/compliance-badge.ts';
import '../components/breadcrumbs.ts';
import '../components/list-workbench.ts';

@customElement('pspf-requirements-view')
export class RequirementsView extends LitElement {
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
      .layout {
        display: block;
      }
      .panel h3 {
        margin: 0;
        font-size: var(--text-lg);
      }
      .panel-note {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
        line-height: 1.45;
      }
      .summary {
        display: grid;
        gap: var(--space-2);
        padding: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        font-size: var(--text-sm);
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .summary-label {
        color: var(--colour-fg-muted);
      }
      .summary-value {
        font-weight: 600;
      }
      fieldset {
        margin: 0;
        padding: 0;
        border: none;
        display: grid;
        gap: var(--space-2);
      }
      fieldset legend {
        font-weight: 600;
        font-size: var(--text-sm);
        margin-bottom: var(--space-1);
      }
      label {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-size: var(--text-sm);
      }
      label input[type='checkbox'] {
        cursor: pointer;
      }
      section.list {
        display: grid;
        gap: var(--space-3);
        min-width: 0;
      }
      .domain-group {
        display: grid;
        gap: var(--space-2);
      }
      .domain-group h3 {
        margin: 0;
        font-size: var(--text-lg);
        padding-bottom: var(--space-1);
        border-bottom: 2px solid var(--colour-border);
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
      @media (max-width: 900px) {
        .layout {
          display: block;
        }
      }
    `,
  ];

  @property({ attribute: false }) params: Record<string, string> = {};

  @state() private selectedDomains = new Set<DomainKey>(allDomains.map((d) => d.key));
  @state() private selectedStates = new Set<ComplianceState>([
    'yes',
    'no',
    'risk-managed',
    'not-applicable',
    'not-set',
  ]);

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.compliance] : []));

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    // Pre-filter to domain from URL param if present
    if (changed.has('params')) {
      const domainKey = this.params.domain as DomainKey | undefined;
      if (domainKey && allDomains.some((d) => d.key === domainKey)) {
        this.selectedDomains = new Set([domainKey]);
      } else if (!domainKey && changed.get('params') !== undefined) {
        // Switching from domain-filtered to all
        this.selectedDomains = new Set(allDomains.map((d) => d.key));
      }
    }
  }

  private toggleDomain(key: DomainKey): void {
    const next = new Set(this.selectedDomains);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedDomains = next;
  }

  private toggleState(state: ComplianceState): void {
    const next = new Set(this.selectedStates);
    if (next.has(state)) {
      next.delete(state);
    } else {
      next.add(state);
    }
    this.selectedStates = next;
  }

  private toggleAllDomains(): void {
    if (this.selectedDomains.size === allDomains.length) {
      this.selectedDomains = new Set();
    } else {
      this.selectedDomains = new Set(allDomains.map((d) => d.key));
    }
  }

  override render() {
    const domainKey = this.params.domain as DomainKey | undefined;
    const filteredDomain = domainKey ? allDomains.find((d) => d.key === domainKey) : undefined;
    const compliance: ReadonlyMap<RequirementId, ComplianceEntry> =
      this.store?.compliance.value ?? new Map();

    // Filter requirements
    const filtered = allRequirements.filter((r) => {
      const domain = allDomains.find((d) => requirementsByDomain.get(d.key)?.includes(r));
      if (!domain || !this.selectedDomains.has(domain.key)) return false;
      const entry = compliance.get(r.id);
      const state: ComplianceState = entry ? entry.state : 'not-set';
      return this.selectedStates.has(state);
    });

    // Group by domain
    const grouped = allDomains
      .filter((d) => this.selectedDomains.has(d.key))
      .map((domain) => {
        const reqs = requirementsByDomain.get(domain.key) ?? [];
        const visible = reqs.filter((r) => {
          const entry = compliance.get(r.id);
          const state: ComplianceState = entry ? entry.state : 'not-set';
          return this.selectedStates.has(state);
        });
        return { domain, requirements: visible };
      })
      .filter((g) => g.requirements.length > 0);

    // Summary stats
    const total = allRequirements.length;
    const yesCount = [...compliance.values()].filter((e) => e.state === 'yes').length;
    const riskManagedCount = [...compliance.values()].filter(
      (e) => e.state === 'risk-managed',
    ).length;
    const notApplicableCount = [...compliance.values()].filter(
      (e) => e.state === 'not-applicable',
    ).length;
    const noCount = [...compliance.values()].filter((e) => e.state === 'no').length;
    const notSetCount = total - yesCount - riskManagedCount - notApplicableCount - noCount;

    const breadcrumbs = filteredDomain
      ? [
          { label: 'Home', href: '#/' },
          { label: 'Requirements', href: '#/requirements' },
          { label: filteredDomain.name },
        ]
      : [{ label: 'Home', href: '#/' }, { label: 'Requirements' }];

    return html`
      <article>
        <pspf-breadcrumbs .items=${breadcrumbs}></pspf-breadcrumbs>
        <h2>${filteredDomain ? filteredDomain.name : 'All Requirements'}</h2>
        ${filteredDomain ? html`<p class="description">${filteredDomain.description}</p>` : ''}
        <pspf-list-workbench
          class="layout"
          left-label="Filters and summary"
          right-label="Requirements list"
          sticky-left
        >
          <div slot="left" class="panel">
            <div class="summary">
              <div class="summary-row">
                <span class="summary-label">Total requirements</span>
                <span class="summary-value">${total}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Fully implemented</span>
                <span class="summary-value">${yesCount}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Risk-managed</span>
                <span class="summary-value">${riskManagedCount}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Not applicable</span>
                <span class="summary-value">${notApplicableCount}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Not implemented</span>
                <span class="summary-value">${noCount}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Not set</span>
                <span class="summary-value">${notSetCount}</span>
              </div>
            </div>

            <fieldset>
              <legend>Domains</legend>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedDomains.size === allDomains.length}
                  .indeterminate=${this.selectedDomains.size > 0 &&
                  this.selectedDomains.size < allDomains.length}
                  @change=${(): void => this.toggleAllDomains()}
                />
                <span>All domains</span>
              </label>
              ${allDomains.map(
                (d) => html`
                  <label>
                    <input
                      type="checkbox"
                      .checked=${this.selectedDomains.has(d.key)}
                      @change=${(): void => this.toggleDomain(d.key)}
                    />
                    <span>${d.name}</span>
                  </label>
                `,
              )}
            </fieldset>

            <fieldset>
              <legend>Compliance state</legend>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedStates.has('yes')}
                  @change=${(): void => this.toggleState('yes')}
                />
                <span>Fully implemented</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedStates.has('risk-managed')}
                  @change=${(): void => this.toggleState('risk-managed')}
                />
                <span>Risk-managed</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedStates.has('not-applicable')}
                  @change=${(): void => this.toggleState('not-applicable')}
                />
                <span>Not applicable</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedStates.has('no')}
                  @change=${(): void => this.toggleState('no')}
                />
                <span>Not implemented</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  .checked=${this.selectedStates.has('not-set')}
                  @change=${(): void => this.toggleState('not-set')}
                />
                <span>Not set</span>
              </label>
            </fieldset>

            <p class="panel-note">
              Showing ${filtered.length} of ${total} requirements across
              ${this.selectedDomains.size}
              ${this.selectedDomains.size === 1 ? 'domain' : 'domains'}.
            </p>
          </div>

          <section class="list" slot="right" aria-label="Requirements list">
            ${grouped.length === 0
              ? html`<div class="placeholder">
                  No requirements match the selected filters. Adjust the domain or compliance state
                  filters to see requirements.
                </div>`
              : grouped.map(
                  (g) => html`
                    <div class="domain-group">
                      <h3>${g.domain.name}</h3>
                      <ul class="requirements">
                        ${g.requirements.map((r): TemplateResult => {
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
                    </div>
                  `,
                )}
          </section>
        </pspf-list-workbench>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-requirements-view': RequirementsView;
  }
}
