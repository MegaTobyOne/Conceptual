import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { PresentationLens } from '@pspf/webview-shell';
import { designTokens } from '../app/design-tokens.ts';
import { allDomains, allRequirements } from '../pspf/index.ts';
import {
  asRequirementId,
  type ComplianceEntry,
  type ComplianceState,
  type DomainKey,
  type Requirement,
  type RequirementId,
  type Action,
  type Risk,
} from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import { presentationLensContext } from '../state/presentation-lens-context.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { complianceEventsSince } from '../domain/analytics.ts';
import {
  assessmentBasis,
  buildRequirementFinderResultSummary,
  isWithinFreshnessWindow,
  searchRequirements,
  type RequirementFinderRecord,
} from '@pspf/contracts';
import { PSPF_REQUIREMENT_REFERENCES } from '@pspf/reference-data';
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
        color: var(--pspf-muted);
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
        color: var(--pspf-muted);
        line-height: 1.45;
      }
      .summary {
        display: grid;
        gap: var(--space-2);
        padding: var(--space-2);
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-sm);
        background: var(--pspf-surface);
        font-size: var(--text-sm);
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .summary-label {
        color: var(--pspf-muted);
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
        border-bottom: 2px solid var(--pspf-border);
      }
      .section-group {
        display: grid;
        gap: var(--space-1);
      }
      .section-group h4 {
        margin: var(--space-1) 0 0 0;
        font-size: var(--text-sm);
        color: var(--pspf-muted);
        font-weight: 600;
      }
      .search-field {
        display: grid;
        gap: var(--space-1);
      }
      .search-field label {
        font-weight: 600;
        font-size: var(--text-sm);
      }
      .search-field input[type='search'] {
        font: inherit;
        color: inherit;
        background: var(--pspf-surface);
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
      }
      .requirement-summary {
        grid-column: 1 / -1;
        margin: 0;
        font-size: var(--text-xs);
        color: var(--pspf-muted);
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
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-md);
        background: var(--pspf-surface-strong);
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      li.requirement:hover,
      li.requirement:focus-within {
        transform: translateY(-1px);
        border-color: var(--pspf-accent);
        box-shadow: var(--shadow-2);
      }
      .requirement-status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .changed-badge {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 999px;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--pspf-accent-contrast, #fff);
        background: var(--pspf-accent);
        white-space: nowrap;
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
        border: 1px dashed var(--pspf-border);
        border-radius: var(--radius-md);
        color: var(--pspf-muted);
        font-size: var(--text-sm);
        background: var(--pspf-surface-strong);
      }
      @media (max-width: 900px) {
        .layout {
          display: block;
        }
      }
    `,
  ];

  @property({ attribute: false }) params: Record<string, string> = {};

  @state() private searchQuery = '';
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

  @consume({ context: presentationLensContext, subscribe: true })
  private lens: PresentationLens = 'ciso';

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store ? [this.store.compliance, this.store.complianceEvents] : [],
  );

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

  private updateSearchQuery(value: string): void {
    this.searchQuery = value;
  }

  override render() {
    const domainKey = this.params.domain as DomainKey | undefined;
    const filteredDomain = domainKey ? allDomains.find((d) => d.key === domainKey) : undefined;
    const compliance: ReadonlyMap<RequirementId, ComplianceEntry> =
      this.store?.compliance.value ?? new Map();
    // J5 (v1.59.0 UX review): badge rows changed since the reader's last visit.
    // No badges on a reader's first-ever visit, since there is no prior anchor to compare against.
    const changedSinceVisit = this.store?.lastVisitAt
      ? new Set(
          complianceEventsSince(
            this.store.complianceEvents.value,
            new Date(this.store.lastVisitAt),
          ).map((change) => change.requirementId),
        )
      : new Set<RequirementId>();

    // Filter and order via the shared requirement finder primitive (ADR 0096 E2).
    const domainOrder = allDomains.map((d) => d.key);
    const now = new Date();
    const finderRecords: RequirementFinderRecord[] = allRequirements.map((r) => {
      const entry = compliance.get(r.id);
      const state: ComplianceState = entry ? entry.state : 'not-set';
      return {
        id: r.id,
        title: r.title,
        searchText: `${r.text} ${r.references?.join(' ') ?? ''} ${entry?.notes ?? ''}`,
        domainId: r.domain,
        status: state,
      };
    });
    const finderResults = searchRequirements(
      finderRecords,
      {
        query: this.searchQuery,
        domainIds: [...this.selectedDomains],
        statuses: [...this.selectedStates],
      },
      domainOrder,
    );
    const requirementsById = new Map(allRequirements.map((r) => [r.id, r]));
    const filtered = finderResults
      .map((result) => requirementsById.get(asRequirementId(result.id)))
      .filter((r): r is Requirement => r !== undefined);

    // PSPF Release 2025 baseline section lookup, for section browsing within each domain.
    const sectionByRequirementId = new Map(
      PSPF_REQUIREMENT_REFERENCES.map((ref) => [ref.requirementId as string, ref]),
    );

    const risksByRequirementId = new Map<RequirementId, Risk[]>();
    for (const risk of this.store?.risks.value ?? []) {
      for (const reqId of risk.requirementIds) {
        risksByRequirementId.set(reqId, [...(risksByRequirementId.get(reqId) ?? []), risk]);
      }
    }
    const actionsByRequirementId = new Map<RequirementId, Action[]>();
    for (const action of this.store?.actions.value ?? []) {
      for (const reqId of action.requirementIds) {
        actionsByRequirementId.set(reqId, [...(actionsByRequirementId.get(reqId) ?? []), action]);
      }
    }
    const stateLabel: Record<ComplianceState, string> = {
      yes: 'Fully implemented',
      'risk-managed': 'Risk-managed',
      'not-applicable': 'Not applicable',
      no: 'Not implemented',
      'not-set': 'Not set',
    };
    // Result decision summary: current assessment, evidence confidence, open actions, material risk.
    const summaryFor = (r: Requirement): string => {
      const entry = compliance.get(r.id);
      const state: ComplianceState = entry ? entry.state : 'not-set';
      const evidenceCount = entry?.evidence.length ?? 0;
      const freshEvidenceCount = (entry?.evidence ?? []).filter((e) =>
        isWithinFreshnessWindow(e.addedAt, now),
      ).length;
      const openActionCount = (actionsByRequirementId.get(r.id) ?? []).filter(
        (a) => a.status !== 'done' && a.status !== 'cancelled',
      ).length;
      const hasMaterialRisk = (risksByRequirementId.get(r.id) ?? []).some(
        (risk) => risk.status !== 'closed' && risk.likelihood * risk.impact >= 10,
      );
      const evidenceBasis =
        evidenceCount > 0 ? assessmentBasis(evidenceCount, freshEvidenceCount) : undefined;
      return buildRequirementFinderResultSummary({
        statusLabel: stateLabel[state],
        ...(evidenceBasis ? { evidenceBasis } : {}),
        openActionCount,
        hasMaterialRisk,
      });
    };

    // Group by domain, then by PSPF section within each domain, for section browsing.
    const grouped = allDomains
      .filter((d) => this.selectedDomains.has(d.key))
      .map((domain) => {
        const domainRequirements = filtered.filter((r) => r.domain === domain.key);
        const sections = new Map<
          string,
          { sectionCode: string; sectionTitle: string; requirements: Requirement[] }
        >();
        const noSection: Requirement[] = [];
        for (const r of domainRequirements) {
          const ref = sectionByRequirementId.get(r.canonicalId);
          if (!ref) {
            noSection.push(r);
            continue;
          }
          const group = sections.get(ref.sectionCode) ?? {
            sectionCode: ref.sectionCode,
            sectionTitle: ref.sectionTitle,
            requirements: [],
          };
          group.requirements.push(r);
          sections.set(ref.sectionCode, group);
        }
        return {
          domain,
          requirements: domainRequirements,
          sections: [...sections.values()].sort((a, b) =>
            a.sectionCode.localeCompare(b.sectionCode),
          ),
          noSection,
        };
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
    const lensDescription =
      'Review readiness and open the requirements driving material decisions.';

    return html`
      <article data-lens=${this.lens}>
        <pspf-breadcrumbs .items=${breadcrumbs}></pspf-breadcrumbs>
        <h2>${filteredDomain ? filteredDomain.name : 'All Requirements'}</h2>
        <p class="description">${filteredDomain?.description ?? lensDescription}</p>
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

            <div class="search-field">
              <label for="requirement-finder-query">Search requirements</label>
              <input
                type="search"
                id="requirement-finder-query"
                data-testid="requirement-finder-query"
                placeholder="Search id, title, or text"
                .value=${this.searchQuery}
                @input=${(event: Event): void => {
                  const value = (event.target as HTMLInputElement).value;
                  this.updateSearchQuery(value);
                }}
              />
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
              Showing ${filtered.length} of ${total}
              requirements${this.searchQuery ? ` matching "${this.searchQuery}"` : ''} across
              ${this.selectedDomains.size}
              ${this.selectedDomains.size === 1 ? 'domain' : 'domains'}.
            </p>
          </div>

          <section class="list" slot="right" aria-label="Requirements list">
            ${grouped.length === 0
              ? html`<div class="placeholder">
                  No requirements match the selected filters. Adjust the domain, compliance state,
                  or search filters to see requirements.
                </div>`
              : grouped.map(
                  (g) => html`
                    <div class="domain-group">
                      <h3>${g.domain.name}</h3>
                      ${g.sections.map(
                        (section) => html`
                          <div class="section-group" data-testid="section-group">
                            <h4>${section.sectionCode} — ${section.sectionTitle}</h4>
                            <ul class="requirements">
                              ${section.requirements.map((r) =>
                                this.#renderRequirementItem(
                                  r,
                                  compliance,
                                  changedSinceVisit,
                                  summaryFor,
                                ),
                              )}
                            </ul>
                          </div>
                        `,
                      )}
                      ${g.noSection.length > 0
                        ? html`
                            <ul class="requirements">
                              ${g.noSection.map((r) =>
                                this.#renderRequirementItem(
                                  r,
                                  compliance,
                                  changedSinceVisit,
                                  summaryFor,
                                ),
                              )}
                            </ul>
                          `
                        : ''}
                    </div>
                  `,
                )}
          </section>
        </pspf-list-workbench>
      </article>
    `;
  }

  #renderRequirementItem(
    r: Requirement,
    compliance: ReadonlyMap<RequirementId, ComplianceEntry>,
    changedSinceVisit: ReadonlySet<RequirementId>,
    summaryFor: (r: Requirement) => string,
  ): TemplateResult {
    const entry = compliance.get(r.id);
    const state: ComplianceState = entry ? entry.state : 'not-set';
    return html`
      <li class="requirement">
        <a href="#/requirement/${r.id}">${r.id}</a>
        <span>${r.title}</span>
        <span class="requirement-status">
          ${changedSinceVisit.has(r.id)
            ? html`<span class="changed-badge" data-testid="changed-badge">Changed</span>`
            : ''}
          <pspf-compliance-badge .state=${state}></pspf-compliance-badge>
        </span>
        <p class="requirement-summary" data-testid="requirement-summary">${summaryFor(r)}</p>
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-requirements-view': RequirementsView;
  }
}
