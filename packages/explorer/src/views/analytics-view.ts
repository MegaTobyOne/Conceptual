import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { COMPLIANCE_STATES, type ComplianceState } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import {
  actionStatusCounts,
  complianceBreakdown,
  directionsSummary,
  essentialEightCoverage,
  overdueActionCount,
  riskBandCounts,
} from '../domain/analytics.ts';
import { directionResponseLabel } from '../domain/reporting.ts';
import { summariseAllDomains } from '../domain/summary.ts';
import { complianceColourVar, complianceLabel } from '../domain/compliance-display.ts';

@customElement('pspf-analytics-view')
export class AnalyticsView extends LitElement {
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
      section.panel {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        margin-bottom: var(--space-3);
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: var(--space-3);
      }
      .kpi {
        display: block;
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg);
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      a.kpi {
        color: inherit;
        text-decoration: none;
      }
      a.kpi:hover,
      a.kpi:focus-visible {
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-2);
        transform: translateY(-1px);
        outline: none;
      }
      .kpi .value {
        font-size: 2rem;
        font-weight: 700;
        line-height: 1.1;
      }
      .kpi .label {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      th,
      td {
        text-align: left;
        padding: var(--space-1) var(--space-2);
        border-bottom: 1px solid var(--colour-border);
      }
      th {
        font-weight: 600;
        color: var(--colour-fg-muted);
      }
      tbody tr:nth-child(even) td {
        background: color-mix(in srgb, var(--colour-bg-elevated) 88%, var(--colour-fg) 12%);
      }
      tbody tr:hover td {
        background: color-mix(in srgb, var(--colour-accent) 8%, var(--colour-bg-elevated));
      }
      .bar {
        display: inline-block;
        height: 0.6rem;
        background: var(--bar-colour, var(--colour-accent));
        border-radius: var(--radius-sm);
        vertical-align: middle;
      }
      .legend {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 2px;
        vertical-align: middle;
        margin-right: 4px;
      }
      .row {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: baseline;
      }
      .visual-grid {
        display: grid;
        gap: var(--space-3);
        grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
      }
      .viz-card {
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg);
        padding: var(--space-3);
        display: grid;
        gap: var(--space-2);
      }
      .viz-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: 700;
      }
      .viz-note {
        margin: 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
      .ring-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .ring {
        width: 8.5rem;
        aspect-ratio: 1;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: conic-gradient(var(--ring-segments));
      }
      .ring-hole {
        width: 5.9rem;
        aspect-ratio: 1;
        border-radius: 999px;
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
        display: grid;
        place-items: center;
        text-align: center;
      }
      .ring-value {
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1;
      }
      .ring-label {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .stack {
        height: 0.9rem;
        border-radius: 999px;
        overflow: hidden;
        display: flex;
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
      }
      .stack > span {
        height: 100%;
        min-width: 2px;
      }
      .split-list {
        display: grid;
        gap: var(--space-1);
      }
      .split-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-xs);
      }
      .spark {
        width: 100%;
        height: 0.5rem;
        border-radius: var(--radius-sm);
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
        overflow: hidden;
      }
      .spark > span {
        display: block;
        height: 100%;
        width: var(--pct, 0%);
        background: var(--spark-colour, var(--colour-accent));
      }
      @media (max-width: 720px) {
        th,
        td {
          padding-left: 0;
          padding-right: 0;
        }
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [this.store.compliance, this.store.risks, this.store.actions, this.store.directions]
      : [],
  );

  override render(): TemplateResult {
    const compliance = this.store?.compliance.value ?? new Map();
    const risks = this.store?.risks.value ?? [];
    const actions = this.store?.actions.value ?? [];
    const directions = this.store?.directions.value ?? [];

    const breakdown = complianceBreakdown(compliance);
    const e8 = essentialEightCoverage(compliance);
    const directionStats = directionsSummary(directions);
    const bands = riskBandCounts(risks);
    const statusCounts = actionStatusCounts(actions);
    const overdue = overdueActionCount(actions);
    const summaries = summariseAllDomains(compliance);
    const riskTotal = bands.low + bands.medium + bands.high + bands.extreme;
    const actionTotal = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);

    let runningCompliancePct = 0;
    const complianceRing = COMPLIANCE_STATES.map((state) => {
      const count = breakdown.byState[state];
      const pct = breakdown.total === 0 ? 0 : (count / breakdown.total) * 100;
      const from = runningCompliancePct;
      runningCompliancePct += pct;
      return `var(${complianceColourVar(state)}) ${from}% ${runningCompliancePct}%`;
    }).join(', ');

    return html`
      <article>
        <h2>Analytics</h2>
        <p>
          Snapshot of programme health: compliance, risk posture, and action throughput. All numbers
          are computed live from the in-browser store.
        </p>

        <section class="panel" aria-label="Headline KPIs">
          <div class="kpi-grid">
            <div class="kpi">
              <div class="value" data-kpi="compliant-pct">${breakdown.compliantPct}%</div>
              <div class="label">Fully implemented (excl. n/a)</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="not-set">${breakdown.byState['not-set']}</div>
              <div class="label">Not yet assessed</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="open-risks">
                ${risks.filter((r) => r.status !== 'closed').length}
              </div>
              <div class="label">Open / monitored risks</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="overdue-actions">${overdue}</div>
              <div class="label">Overdue actions</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="e8-pct">${e8.implementedPct}%</div>
              <div class="label">
                Essential Eight (TECH-099 to TECH-106) · catchall TECH-107:
                ${complianceLabel(e8.catchall.state)}
              </div>
            </div>
            <a class="kpi" href="#/directions/not-set">
              <div class="value" data-kpi="directions-needing-response">
                ${directionStats.needsResponseCount}
              </div>
              <div class="label">
                Directions needing response · addressed ${directionStats.addressedPct}%
              </div>
            </a>
          </div>
        </section>

        <section class="panel" aria-label="Visual status charts">
          <h3>Visual status snapshot</h3>
          <div class="visual-grid">
            <article class="viz-card" aria-label="Compliance mix chart">
              <p class="viz-title">Compliance mix</p>
              <p class="viz-note">
                Includes all requirements, including not-set and not applicable.
              </p>
              <div class="ring-wrap">
                <div
                  class="ring"
                  style=${`--ring-segments: ${complianceRing || '#334155 0% 100%'}`}
                >
                  <div class="ring-hole">
                    <div>
                      <div class="ring-value">${breakdown.compliantPct}%</div>
                      <div class="ring-label">fully implemented</div>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article class="viz-card" aria-label="Risk severity split chart">
              <p class="viz-title">Open risk severity split</p>
              <div class="stack" role="img" aria-label="Risk severity proportions">
                <span
                  style=${`width:${riskTotal === 0 ? 0 : (bands.extreme / riskTotal) * 100}%; background: var(--colour-risk-extreme)`}
                ></span>
                <span
                  style=${`width:${riskTotal === 0 ? 0 : (bands.high / riskTotal) * 100}%; background: var(--colour-risk-high)`}
                ></span>
                <span
                  style=${`width:${riskTotal === 0 ? 0 : (bands.medium / riskTotal) * 100}%; background: var(--colour-risk-medium)`}
                ></span>
                <span
                  style=${`width:${riskTotal === 0 ? 0 : (bands.low / riskTotal) * 100}%; background: var(--colour-risk-low)`}
                ></span>
              </div>
              <div class="split-list">
                ${(
                  [
                    ['Extreme', bands.extreme, 'var(--colour-risk-extreme)'],
                    ['High', bands.high, 'var(--colour-risk-high)'],
                    ['Medium', bands.medium, 'var(--colour-risk-medium)'],
                    ['Low', bands.low, 'var(--colour-risk-low)'],
                  ] as const
                ).map(
                  ([label, count, colour]) => html`
                    <div class="split-item">
                      <span class="legend" style=${`background:${colour}`}></span>
                      <span>${label}</span>
                      <strong>${count}</strong>
                    </div>
                  `,
                )}
              </div>
            </article>

            <article class="viz-card" aria-label="Action throughput chart">
              <p class="viz-title">Action throughput by status</p>
              <div class="split-list">
                ${Object.entries(statusCounts).map(([status, count]) => {
                  const pct = actionTotal === 0 ? 0 : Math.round((count / actionTotal) * 100);
                  return html`
                    <div class="split-item">
                      <span>${status}</span>
                      <span class="spark"
                        ><span
                          style=${`--pct:${pct}%; --spark-colour: var(--colour-action-${status})`}
                        ></span
                      ></span>
                      <strong>${count}</strong>
                    </div>
                  `;
                })}
              </div>
            </article>
          </div>
        </section>

        <section class="panel" aria-label="Directions response coverage">
          <h3>Directions response coverage</h3>
          <table>
            <thead>
              <tr>
                <th>Response</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${directionResponseLabel('yes')}</td>
                <td>${directionStats.byState.yes}</td>
              </tr>
              <tr>
                <td>${directionResponseLabel('no')}</td>
                <td>${directionStats.byState.no}</td>
              </tr>
              <tr>
                <td>${directionResponseLabel('risk-managed')}</td>
                <td>${directionStats.byState['risk-managed']}</td>
              </tr>
              <tr>
                <td>${directionResponseLabel('not-set')}</td>
                <td>${directionStats.byState['not-set']}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="panel" aria-label="Compliance by domain">
          <h3>Compliance by domain</h3>
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Fully implemented %</th>
                <th aria-label="Bar"></th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${summaries.map(
                (s) => html`
                  <tr>
                    <td>${s.domain.name}</td>
                    <td>${s.compliantPct}%</td>
                    <td>
                      <span
                        class="bar"
                        style=${`width:${s.compliantPct}%; --bar-colour: var(${complianceColourVar(
                          'yes',
                        )})`}
                      ></span>
                    </td>
                    <td>${s.total}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </section>

        <section class="panel" aria-label="Compliance state distribution">
          <h3>Compliance state distribution</h3>
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>Count</th>
                <th aria-label="Bar"></th>
              </tr>
            </thead>
            <tbody>
              ${COMPLIANCE_STATES.map((s: ComplianceState) => {
                const count = breakdown.byState[s];
                const pct = breakdown.total === 0 ? 0 : Math.round((count / breakdown.total) * 100);
                return html`
                  <tr>
                    <td>
                      <span
                        class="legend"
                        style=${`background: var(${complianceColourVar(s)})`}
                      ></span>
                      ${complianceLabel(s)}
                    </td>
                    <td>${count}</td>
                    <td>
                      <span
                        class="bar"
                        style=${`width:${pct}%; --bar-colour: var(${complianceColourVar(s)})`}
                      ></span>
                    </td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </section>

        <section class="panel" aria-label="Risks by band">
          <h3>Open risks by band</h3>
          <div class="row">
            <div class="kpi">
              <div class="value" data-kpi="risks-extreme">${bands.extreme}</div>
              <div class="label">Extreme (≥16)</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="risks-high">${bands.high}</div>
              <div class="label">High (10–15)</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="risks-medium">${bands.medium}</div>
              <div class="label">Medium (5–9)</div>
            </div>
            <div class="kpi">
              <div class="value" data-kpi="risks-low">${bands.low}</div>
              <div class="label">Low (1–4)</div>
            </div>
          </div>
        </section>

        <section class="panel" aria-label="Actions by status">
          <h3>Actions by status</h3>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(statusCounts).map(
                ([s, c]) => html`
                  <tr>
                    <td>${s}</td>
                    <td>${c}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </section>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-analytics-view': AnalyticsView;
  }
}
