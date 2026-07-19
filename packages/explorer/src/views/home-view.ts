import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import type { AppStore } from '../state/app-store.ts';
import { summariseAllDomains, type DomainSummary } from '../domain/summary.ts';
import type { ComplianceEntry, RequirementId } from '../data/types.ts';
import {
  complianceBreakdown,
  directionsSummary,
  essentialEightCoverage,
} from '../domain/analytics.ts';
import { complianceLabel } from '../domain/compliance-display.ts';
import '../components/breadcrumbs.ts';

@customElement('pspf-home-view')
export class HomeView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      article {
        display: grid;
        gap: var(--space-4);
      }
      h1 {
        font-size: clamp(1.75rem, 2vw + 1rem, 2.4rem);
        margin: 0;
        line-height: 1.1;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.9fr);
        gap: var(--space-4);
        align-items: stretch;
        padding: var(--space-4);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-lg);
        background: linear-gradient(135deg, rgba(79, 140, 255, 0.12), rgba(19, 25, 34, 0.6));
      }
      .hero-copy {
        display: grid;
        gap: var(--space-3);
        align-content: start;
      }
      .hero-copy p {
        margin: 0;
      }
      .lede {
        max-width: 60ch;
        color: var(--colour-fg-muted);
        font-size: var(--text-base);
        line-height: 1.6;
      }
      .hero-meta {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      .hero-meta span {
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        border: 1px solid var(--colour-border);
        background: rgba(255, 255, 255, 0.02);
      }
      .hero-panel {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
        box-shadow: var(--shadow-1);
      }
      .hero-panel h2 {
        margin: 0;
        font-size: var(--text-lg);
      }
      .hero-panel p {
        margin: 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        line-height: 1.5;
      }
      .start-grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .start-card {
        display: grid;
        gap: 0.25rem;
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg);
        color: inherit;
        text-decoration: none;
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      .start-card:hover,
      .start-card:focus-visible {
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-2);
        transform: translateY(-1px);
        outline: none;
      }
      .start-card .title {
        font-weight: 700;
      }
      .start-card .text {
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        line-height: 1.45;
      }
      .section-title {
        margin: 0;
        font-size: var(--text-xl);
      }
      .section-note {
        margin: 0;
        color: var(--colour-fg-muted);
        max-width: 60ch;
        line-height: 1.5;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
        gap: var(--space-3);
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .widgets {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: var(--space-3);
      }
      .overview {
        display: grid;
        gap: var(--space-3);
      }
      .overview-panel {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-lg);
        background: var(--colour-bg-elevated);
      }
      .widget {
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        padding: var(--space-3);
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      a.widget {
        text-decoration: none;
        color: inherit;
      }
      a.widget:hover,
      a.widget:focus-visible {
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-2);
        transform: translateY(-1px);
        outline: none;
      }
      .widget .value {
        font-size: 2rem;
        font-weight: 700;
        line-height: 1.1;
      }
      .widget .label {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        text-decoration: none;
        color: inherit;
        transition:
          transform var(--motion-medium) ease,
          border-color var(--motion-medium) ease,
          box-shadow var(--motion-medium) ease,
          background-color var(--motion-medium) ease;
      }
      .card:hover,
      .card:focus-visible {
        border-color: var(--colour-accent);
        box-shadow: var(--shadow-2);
        transform: translateY(-1px);
        outline: none;
      }
      .card h3 {
        margin: 0;
        font-size: var(--text-lg);
      }
      .card p {
        margin: 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      .meter {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .bar {
        height: 6px;
        background: var(--colour-border);
        border-radius: 3px;
        overflow: hidden;
      }
      .bar > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, var(--colour-accent), var(--colour-fg));
      }
      @media (max-width: 900px) {
        .hero {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // Re-render whenever the compliance signal changes.
  // The watcher is held only for its controller lifecycle.
  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store ? [this.store.compliance, this.store.directions] : [],
  );

  override render() {
    const compliance: ReadonlyMap<RequirementId, ComplianceEntry> =
      this.store?.compliance.value ?? new Map();
    const summaries = summariseAllDomains(compliance);
    const overall = complianceBreakdown(compliance);
    const e8 = essentialEightCoverage(compliance);
    const directionStats = directionsSummary(this.store?.directions.value ?? []);
    const quickStarts = [
      {
        href: '#/requirements',
        title: 'Browse requirements',
        text: 'View all PSPF requirements across domains with filtering and compliance status.',
      },
      {
        href: '#/risks',
        title: 'Capture risks',
        text: 'Start with the issues that could affect delivery or compliance the most.',
      },
      {
        href: '#/actions',
        title: 'Track actions',
        text: 'Record remediation work and see what is overdue or still in flight.',
      },
    ] as const;
    return html`
      <article>
        <pspf-breadcrumbs .items=${[{ label: 'Home' }]}></pspf-breadcrumbs>
        <section class="hero" aria-label="Home overview and quick start">
          <div class="hero-copy">
            <h1>PSPF domains, risks, and actions in one working view</h1>
            <p class="lede">
              Welcome to PSPF Explorer v3. Use the quick start links to move into the part of the
              programme you need, then drill into domains, risks, and actions from there. Your work
              stays on this device.
            </p>
            <div class="hero-meta" aria-label="Product highlights">
              <span>Offline first</span>
              <span>Fast local search</span>
              <span>Command palette: Ctrl/Cmd+K</span>
            </div>
          </div>
          <aside class="hero-panel" aria-label="Quick start links">
            <h2>Start here</h2>
            <p>Choose the most common path and get straight to the next decision.</p>
            <ul class="start-grid">
              ${quickStarts.map(
                (item) => html`
                  <li>
                    <a class="start-card" href=${item.href}>
                      <span class="title">${item.title}</span>
                      <span class="text">${item.text}</span>
                    </a>
                  </li>
                `,
              )}
            </ul>
          </aside>
        </section>

        <section class="overview" aria-label="Programme overview">
          <h2 class="section-title">Programme overview</h2>
          <p class="section-note">
            The summary cards below show the current state of the programme, while the domain cards
            provide the quickest path into detailed work.
          </p>
          <div class="overview-panel">
            <section class="widgets" aria-label="Programme overview widgets">
              <div class="widget" data-testid="home-widget-overall">
                <div class="value">${overall.compliantPct}%</div>
                <div class="label">Overall fully implemented (excl. n/a)</div>
              </div>
              <a class="widget" data-testid="home-widget-e8" href="#/essential-eight">
                <div class="value">${e8.implementedPct}%</div>
                <div class="label">
                  Essential Eight (TECH-099 to TECH-106) · catchall TECH-107:
                  ${complianceLabel(e8.catchall.state)}
                </div>
              </a>
              <a class="widget" data-testid="home-widget-directions" href="#/directions/not-set">
                <div class="value">${directionStats.needsResponseCount}</div>
                <div class="label">
                  Directions needing response · addressed ${directionStats.addressedPct}%
                </div>
              </a>
            </section>
          </div>
        </section>

        <section aria-label="Domain cards">
          <h2 class="section-title">PSPF domains</h2>
          <p class="section-note">
            Pick a domain to continue working through its requirements. The card progress bars show
            where attention is still needed.
          </p>
          <ul class="grid">
            ${summaries.map((s) => this.#card(s))}
          </ul>
        </section>
      </article>
    `;
  }

  #card(s: DomainSummary): TemplateResult {
    const pct = Math.round(s.compliantPct * 100);
    return html`
      <li>
        <a class="card" href="#/requirements/${s.domain.key}">
          <h3>${s.domain.name}</h3>
          <p>${s.domain.description}</p>
          <div class="meter">
            <div>${s.byState.yes} of ${s.total} fully implemented · ${pct}%</div>
            <div
              class="bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow=${pct}
              aria-label=${`${s.domain.name} compliance progress`}
            >
              <span style=${`width: ${pct}%`}></span>
            </div>
          </div>
        </a>
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-home-view': HomeView;
  }
}
