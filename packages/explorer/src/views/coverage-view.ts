import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { COMPLIANCE_STATES, type ComplianceState } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { summariseAllDomains } from '../domain/summary.ts';
import { complianceColourVar, complianceLabel } from '../domain/compliance-display.ts';
import { directionsSummary, essentialEightCoverage } from '../domain/analytics.ts';
import { directionResponseLabel } from '../domain/reporting.ts';

@customElement('pspf-coverage-view')
export class CoverageView extends LitElement {
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
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      th,
      td {
        padding: var(--space-2);
        text-align: left;
        border-bottom: 1px solid var(--colour-border);
      }
      th {
        font-weight: 600;
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      th.numeric,
      td.numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      tr.totals {
        font-weight: 600;
        background: var(--colour-bg);
      }
      .legend {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 2px;
        vertical-align: middle;
        margin-right: 4px;
      }
      a.domain-link,
      a.summary-link {
        color: var(--colour-link);
        text-decoration: none;
      }
      a.domain-link:hover,
      a.summary-link:hover {
        text-decoration: underline;
      }
      .muted {
        color: var(--colour-fg-muted);
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        font-size: var(--text-xs);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store ? [this.store.compliance, this.store.directions] : [],
  );

  override render(): TemplateResult {
    const compliance = this.store?.compliance.value ?? new Map();
    const directions = this.store?.directions.value ?? [];
    const summaries = summariseAllDomains(compliance);
    const e8 = essentialEightCoverage(compliance);
    const directionStats = directionsSummary(directions);

    const totals: Record<ComplianceState, number> = {
      yes: 0,
      no: 0,
      'risk-managed': 0,
      'not-applicable': 0,
      'not-set': 0,
    };
    let grandTotal = 0;
    for (const s of summaries) {
      grandTotal += s.total;
      for (const state of COMPLIANCE_STATES) totals[state] += s.byState[state];
    }
    const overallApplicable = grandTotal - totals['not-applicable'];
    const overallCompliantPct =
      overallApplicable === 0 ? 0 : Math.round((totals.yes / overallApplicable) * 100);

    return html`
      <article>
        <h2>Coverage matrix</h2>
        <p>
          Per-domain compliance state breakdown. The Fully implemented % column is the share of
          <em>applicable</em> requirements marked fully implemented; requirements marked
          not&nbsp;applicable are excluded from both the numerator and denominator so they don't
          drag the rating down.
        </p>
        <div class="panel" data-testid="coverage-matrix">
          <table aria-label="Coverage matrix by domain and state">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                ${COMPLIANCE_STATES.map(
                  (s) =>
                    html`<th class="numeric" scope="col">
                      <span
                        class="legend"
                        style=${`background: var(${complianceColourVar(s)})`}
                      ></span>
                      ${complianceLabel(s)}
                    </th>`,
                )}
                <th class="numeric" scope="col">Total</th>
                <th
                  class="numeric"
                  scope="col"
                  title="Share of applicable requirements (Total minus Not applicable) marked Fully implemented"
                >
                  Fully implemented&nbsp;%<br /><span class="muted">(excl. n/a)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              ${summaries.map((s) => {
                const applicable = s.total - s.byState['not-applicable'];
                const pct = applicable === 0 ? 0 : Math.round((s.byState.yes / applicable) * 100);
                return html`
                  <tr data-domain=${s.domain.key}>
                    <th scope="row">
                      <a class="domain-link" href="#/requirements/${s.domain.key}"
                        >${s.domain.name}</a
                      >
                    </th>
                    ${COMPLIANCE_STATES.map(
                      (state) =>
                        html`<td class="numeric" data-state=${state}>${s.byState[state]}</td>`,
                    )}
                    <td class="numeric">${s.total}</td>
                    <td class="numeric" data-compliant-pct>${pct}%</td>
                  </tr>
                `;
              })}
              <tr class="totals">
                <th scope="row">All domains</th>
                ${COMPLIANCE_STATES.map(
                  (state) =>
                    html`<td class="numeric" data-total-state=${state}>${totals[state]}</td>`,
                )}
                <td class="numeric" data-grand-total>${grandTotal}</td>
                <td class="numeric" data-overall-compliant-pct>${overallCompliantPct}%</td>
              </tr>
              <tr class="totals" data-testid="coverage-essential-eight">
                <th scope="row">
                  Essential Eight<br /><span class="muted"
                    >TECH-099 to TECH-106 · TECH-107 catchall</span
                  >
                </th>
                ${COMPLIANCE_STATES.map(
                  (state) => html`<td class="numeric">${e8.byState[state]}</td>`,
                )}
                <td class="numeric">${e8.totalControls}</td>
                <td class="numeric">
                  ${e8.implementedPct}%<br />
                  <span class="muted">TECH-107: ${complianceLabel(e8.catchall.state)}</span>
                </td>
              </tr>
              <tr class="totals" data-testid="coverage-directions">
                <th scope="row">
                  <a class="summary-link" href="#/directions/not-set">Directions</a><br /><span
                    class="muted"
                    >Response coverage across the register</span
                  >
                </th>
                <td class="numeric">${directionStats.byState.yes}</td>
                <td class="numeric">${directionStats.byState.no}</td>
                <td class="numeric">${directionStats.byState['risk-managed']}</td>
                <td class="numeric">&mdash;</td>
                <td class="numeric">${directionStats.byState['not-set']}</td>
                <td class="numeric">${directionStats.total}</td>
                <td class="numeric">
                  ${directionStats.addressedPct}%<br />
                  <span class="muted"
                    >${directionResponseLabel('not-set')}:
                    ${directionStats.needsResponseCount}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-coverage-view': CoverageView;
  }
}
