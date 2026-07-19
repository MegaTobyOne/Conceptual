import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import type { ComplianceEntry, ComplianceState, RequirementId } from '../data/types.ts';
import { requirementById } from '../pspf/index.ts';
import {
  ESSENTIAL_EIGHT_CATCHALL_ID,
  ESSENTIAL_EIGHT_REQUIREMENT_IDS,
  essentialEightCoverage,
} from '../domain/analytics.ts';
import { complianceLabel } from '../domain/compliance-display.ts';
import '../components/compliance-badge.ts';
import '../components/breadcrumbs.ts';

@customElement('pspf-essential-eight-view')
export class EssentialEightView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-xl);
      }
      .lede {
        margin: 0 0 var(--space-3) 0;
        color: var(--colour-fg-muted);
        max-width: 70ch;
      }
      .summary {
        margin: 0 0 var(--space-3) 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
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
        grid-template-columns: minmax(7rem, auto) 1fr auto;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      li.requirement a {
        color: inherit;
        text-decoration: none;
        font-weight: 600;
      }
      li.requirement a:hover {
        text-decoration: underline;
      }
      .meta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () => (this.store ? [this.store.compliance] : []));

  override render(): TemplateResult {
    const compliance: ReadonlyMap<RequirementId, ComplianceEntry> =
      this.store?.compliance.value ?? new Map();
    const e8 = essentialEightCoverage(compliance);
    const ids = [...ESSENTIAL_EIGHT_REQUIREMENT_IDS, ESSENTIAL_EIGHT_CATCHALL_ID];

    return html`
      <article>
        <pspf-breadcrumbs
          .items=${[{ label: 'Home', href: '#/' }, { label: 'Essential Eight focus' }]}
        ></pspf-breadcrumbs>
        <h2>Essential Eight focus</h2>
        <p class="lede">
          Prioritised view of the Essential Eight requirements (TECH-099 to TECH-106) plus TECH-107
          for remaining mitigation strategies.
        </p>
        <p class="summary">
          Essential Eight fully implemented: ${e8.implementedPct}% (${e8.implementedControls} of
          ${e8.applicableControls} applicable controls). TECH-107 catchall:
          ${complianceLabel(e8.catchall.state)}.
        </p>

        <ul class="requirements" data-testid="essential-eight-requirements">
          ${ids.map((id) => {
            const requirement = requirementById.get(id);
            if (!requirement) return html``;
            const entry = compliance.get(id);
            const state: ComplianceState = entry ? entry.state : 'not-set';
            return html`
              <li class="requirement">
                <a href="#/requirement/${requirement.id}">${requirement.id}</a>
                <span>
                  ${requirement.title}
                  ${requirement.essentialEightControl
                    ? html`<span class="meta">· ${requirement.essentialEightControl}</span>`
                    : ''}
                </span>
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
    'pspf-essential-eight-view': EssentialEightView;
  }
}
