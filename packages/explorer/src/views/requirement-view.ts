import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { PresentationLens } from '@pspf/webview-shell';
import { designTokens } from '../app/design-tokens.ts';
import {
  allDomains,
  allRequirements,
  requirementById,
  essentialEightControls,
} from '../pspf/index.ts';
import { asRequirementId, type ComplianceState, type Relationship } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import { presentationLensContext } from '../state/presentation-lens-context.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import { requirementConsequence } from '../domain/analytics.ts';
import { buildRequirementExplainer } from '@pspf/reference-data';
import '../components/compliance-badge.ts';
import '../components/compliance-editor.ts';
import '../components/work-log.ts';
import '../components/breadcrumbs.ts';
import '../components/disclosure.ts';

@customElement('pspf-requirement-view')
export class RequirementView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      article {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .flow-step {
        margin: var(--space-2) 0 0 0;
        font-size: var(--text-xs);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--pspf-muted);
      }
      header.req {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0 0 var(--space-3) 0;
      }
      h2 {
        margin: 0;
        font-size: var(--text-xl);
      }
      .req-nav {
        display: flex;
        gap: var(--space-2);
        margin: 0 0 var(--space-3) 0;
      }
      .req-nav a,
      .req-nav span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 7.5rem;
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-sm);
        background: var(--pspf-surface-strong);
        color: inherit;
        text-decoration: none;
      }
      .req-nav span {
        opacity: 0.6;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-1) var(--space-3);
        margin: var(--space-3) 0 0 0;
        font-size: var(--text-sm);
      }
      dt {
        color: var(--pspf-muted);
      }
      dd {
        margin: 0;
      }
      p.text {
        max-width: 70ch;
        line-height: 1.5;
      }
      .explainer p.attribution {
        margin: var(--space-2) 0 0 0;
        font-size: var(--text-xs);
        color: var(--pspf-muted);
      }
      .placeholder {
        padding: var(--space-3);
        border: 1px dashed var(--pspf-border);
        border-radius: var(--radius-md);
        color: var(--pspf-muted);
        font-size: var(--text-sm);
      }
      ul.refs {
        margin: 0;
        padding-left: var(--space-4);
        font-size: var(--text-sm);
      }
      .linker {
        margin-top: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-md);
        background: var(--pspf-surface-strong);
      }
      .linker h3 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-md);
      }
      .linker form {
        display: grid;
        grid-template-columns: 12rem 1fr auto;
        gap: var(--space-2);
        align-items: end;
      }
      .linker label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--pspf-muted);
      }
      .linker input,
      .linker select,
      .linker button {
        font: inherit;
        color: inherit;
        background: var(--pspf-surface);
        border: 1px solid var(--pspf-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
      }
      .linker button {
        cursor: pointer;
      }
      .linker button.primary {
        background: var(--pspf-accent);
        color: var(--pspf-accent-ink);
        border-color: var(--pspf-accent);
      }
      .linker .create-new {
        margin-top: var(--space-3);
        padding-top: var(--space-3);
        border-top: 1px solid var(--pspf-border);
      }
      .linker .create-new h4 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-sm);
        color: var(--pspf-muted);
      }
      .linker .create-new form {
        grid-template-columns: 1fr auto;
      }
      .linker .create-new + .create-new {
        margin-top: var(--space-2);
        padding-top: var(--space-2);
        border-top: none;
      }
      ul.linked {
        list-style: none;
        margin: var(--space-2) 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
      }
      ul.linked a {
        color: inherit;
      }
      @media (max-width: 720px) {
        .linker form {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @property({ attribute: false }) params: Record<string, string> = {};

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  @consume({ context: presentationLensContext, subscribe: true })
  private lens: PresentationLens = 'ciso';

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [
          this.store.compliance,
          this.store.relationships,
          this.store.risks,
          this.store.actions,
          this.store.directions,
        ]
      : [],
  );

  @state() private accessor linkTargetType: 'risk' | 'action' | 'direction' = 'risk';
  @state() private accessor linkTargetId = '';
  @state() private accessor newActionTitle = '';
  @state() private accessor newRiskTitle = '';
  @state() private accessor newRiskLikelihood: 1 | 2 | 3 | 4 | 5 = 3;
  @state() private accessor newRiskImpact: 1 | 2 | 3 | 4 | 5 = 3;

  override render() {
    const raw = this.params.id;
    if (typeof raw !== 'string') {
      return html`<p class="placeholder">Missing requirement id.</p>`;
    }
    const req = requirementById.get(asRequirementId(raw));
    if (!req) {
      return html`<p class="placeholder">Unknown requirement: ${raw}.</p>`;
    }
    const domain = allDomains.find((d) => d.key === req.domain);
    const reqIndex = allRequirements.findIndex((r) => r.id === req.id);
    const prevReq = reqIndex > 0 ? allRequirements[reqIndex - 1] : undefined;
    const nextReq =
      reqIndex >= 0 && reqIndex < allRequirements.length - 1
        ? allRequirements[reqIndex + 1]
        : undefined;
    const entry = this.store?.compliance.value.get(req.id);
    const state: ComplianceState = entry ? entry.state : 'not-set';
    const e8 = req.essentialEightControl
      ? essentialEightControls.find((c) => c.key === req.essentialEightControl)
      : undefined;
    const related = (this.store?.relationships.value ?? []).filter((relationship) =>
      relationship.endpoints.includes(req.id),
    );
    const consequence = requirementConsequence(req.id, state, this.store?.risks.value ?? []);
    const openBlockerCount = related.filter((relationship) => {
      const targetId =
        relationship.endpoints.find((endpoint) => endpoint !== req.id) ?? relationship.endpoints[0];
      const action = this.store?.actions.value.find((a) => a.id === targetId);
      return Boolean(action) && action?.status !== 'done' && action?.status !== 'cancelled';
    }).length;
    const explainer = buildRequirementExplainer({
      requirementId: req.canonicalId,
      consequenceStatement: consequence,
      openBlockerCount,
    });
    return html`
      <article data-lens=${this.lens}>
        <pspf-breadcrumbs
          .items=${[
            { label: 'Home', href: '#/' },
            { label: domain?.name ?? req.domain, href: `#/requirements/${req.domain}` },
            { label: req.id },
          ]}
        ></pspf-breadcrumbs>
        <header class="req">
          <h2>${req.id} — ${req.title}</h2>
          <pspf-compliance-badge .state=${state}></pspf-compliance-badge>
        </header>
        <nav class="req-nav" aria-label="Requirement navigation">
          ${prevReq
            ? html`<a href=${`#/requirement/${prevReq.id}`} data-testid="prev-requirement"
                >← Previous</a
              >`
            : html`<span data-testid="prev-requirement-disabled">← Previous</span>`}
          ${nextReq
            ? html`<a href=${`#/requirement/${nextReq.id}`} data-testid="next-requirement"
                >Next →</a
              >`
            : html`<span data-testid="next-requirement-disabled">Next →</span>`}
        </nav>
        <p class="text requirement-text">${req.text}</p>
        <dl class="requirement-context">
          <dt>Domain</dt>
          <dd>${domain?.name ?? req.domain}</dd>
          <dt>Reporting</dt>
          <dd>${req.reportingType}</dd>
        </dl>
        ${e8 || (req.references && req.references.length > 0)
          ? html`
              <pspf-disclosure summary="Essential Eight and references">
                <dl class="requirement-context">
                  ${e8
                    ? html`
                        <dt>Essential Eight</dt>
                        <dd>${e8.name}</dd>
                      `
                    : ''}
                  ${req.references && req.references.length > 0
                    ? html`
                        <dt>References</dt>
                        <dd>
                          <ul class="refs">
                            ${req.references.map((r) => this.#renderReference(r))}
                          </ul>
                        </dd>
                      `
                    : ''}
                </dl>
              </pspf-disclosure>
            `
          : ''}
        <p class="flow-step">Assess</p>
        <pspf-compliance-editor
          class="assessment"
          .requirementId=${req.id}
        ></pspf-compliance-editor>
        <p class="flow-step">Justify</p>
        <section class="consequence" data-testid="consequence">
          <h3>Consequence</h3>
          <p>${consequence}</p>
        </section>
        <section class="explainer" data-testid="explainer">
          <h3>What this means</h3>
          <p>${explainer.whatThisMeans}</p>
          <h3>Why it matters</h3>
          <p>${explainer.whyItMatters}</p>
          <h3>What to do next</h3>
          <p>${explainer.whatToDoNext}</p>
          <p class="attribution">${explainer.attribution}</p>
        </section>
        <p class="flow-step">Act</p>
        <section class="linker">
          <h3>Link this requirement</h3>
          <form
            @submit=${(event: Event): void => {
              event.preventDefault();
              void this.#createRelationship(req.id);
            }}
          >
            <label>
              Target type
              <select
                .value=${this.linkTargetType}
                @change=${(event: Event): void => {
                  this.linkTargetType = (event.target as HTMLSelectElement).value as
                    | 'risk'
                    | 'action'
                    | 'direction';
                  this.linkTargetId = '';
                }}
              >
                <option value="risk">Risk</option>
                <option value="action">Action</option>
                <option value="direction">Direction</option>
              </select>
            </label>
            <label>
              Target
              <select
                aria-label="Target"
                @change=${(event: Event): void => {
                  this.linkTargetId = (event.target as HTMLSelectElement).value;
                }}
              >
                <option value="" ?selected=${this.linkTargetId === ''}>— select —</option>
                ${this.#targetOptions().map(
                  (opt) =>
                    html`<option value=${opt.id} ?selected=${opt.id === this.linkTargetId}>
                      ${opt.label}
                    </option>`,
                )}
              </select>
            </label>
            <button
              type="submit"
              class="primary"
              ?disabled=${!this.#targetOptions().some((opt) => opt.id === this.linkTargetId.trim())}
            >
              Add relationship
            </button>
          </form>
          ${related.length === 0
            ? html`<p class="placeholder">No relationships for this requirement yet.</p>`
            : html`
                <ul class="linked">
                  ${related.map((relationship) => this.#renderRelated(req.id, relationship))}
                </ul>
              `}
          <div class="create-new">
            <h4>Or create a new action</h4>
            <form
              @submit=${(event: Event): void => {
                event.preventDefault();
                void this.#createAction(req.id);
              }}
            >
              <label>
                Action title
                <input
                  type="text"
                  aria-label="New action title"
                  .value=${this.newActionTitle}
                  @input=${(event: Event): void => {
                    const value = (event.target as HTMLInputElement).value;
                    this.newActionTitle = value;
                  }}
                />
              </label>
              <button type="submit" ?disabled=${this.newActionTitle.trim() === ''}>
                Create action
              </button>
            </form>
          </div>
          <div class="create-new">
            <h4>Or create a new risk</h4>
            <form
              @submit=${(event: Event): void => {
                event.preventDefault();
                void this.#createRisk(req.id);
              }}
            >
              <label>
                Risk title
                <input
                  type="text"
                  aria-label="New risk title"
                  .value=${this.newRiskTitle}
                  @input=${(event: Event): void => {
                    const value = (event.target as HTMLInputElement).value;
                    this.newRiskTitle = value;
                  }}
                />
              </label>
              <label>
                Likelihood
                <select
                  aria-label="New risk likelihood"
                  .value=${String(this.newRiskLikelihood)}
                  @change=${(event: Event): void => {
                    this.newRiskLikelihood = Number((event.target as HTMLSelectElement).value) as
                      | 1
                      | 2
                      | 3
                      | 4
                      | 5;
                  }}
                >
                  ${[1, 2, 3, 4, 5].map((n) => html`<option value=${n}>${n}</option>`)}
                </select>
              </label>
              <label>
                Impact
                <select
                  aria-label="New risk impact"
                  .value=${String(this.newRiskImpact)}
                  @change=${(event: Event): void => {
                    this.newRiskImpact = Number((event.target as HTMLSelectElement).value) as
                      | 1
                      | 2
                      | 3
                      | 4
                      | 5;
                  }}
                >
                  ${[1, 2, 3, 4, 5].map((n) => html`<option value=${n}>${n}</option>`)}
                </select>
              </label>
              <button type="submit" ?disabled=${this.newRiskTitle.trim() === ''}>
                Create risk
              </button>
            </form>
          </div>
        </section>
        <pspf-work-log class="work-log" .requirementId=${req.id}></pspf-work-log>
      </article>
    `;
  }

  #targetOptions(): readonly { id: string; label: string }[] {
    if (!this.store) return [];
    switch (this.linkTargetType) {
      case 'risk':
        return this.store.risks.value.map((risk) => ({ id: risk.id, label: risk.title }));
      case 'action':
        return this.store.actions.value.map((action) => ({ id: action.id, label: action.title }));
      case 'direction':
        return this.store.directions.value.map((direction) => ({
          id: direction.id,
          label: `${direction.reference} – ${direction.title}`,
        }));
    }
  }

  #renderRelated(requirementId: string, relationship: Relationship) {
    const target =
      relationship.endpoints.find((endpoint) => endpoint !== requirementId) ??
      relationship.endpoints[0];
    const targetRoute = this.#targetRoute(target);
    const label = this.#lookupTargetLabel(target);
    return html`
      <li>
        ${relationship.kind} ·
        ${targetRoute ? html`<a href=${targetRoute}>${label}</a>` : html`<span>${label}</span>`}
      </li>
    `;
  }

  #lookupTargetLabel(id: string): string {
    const risk = this.store?.risks.value.find((r) => r.id === id);
    if (risk) return risk.title;
    const action = this.store?.actions.value.find((a) => a.id === id);
    if (action) return action.title;
    const direction = this.store?.directions.value.find((d) => d.id === id);
    if (direction) return `${direction.reference} – ${direction.title}`;
    return id;
  }

  #targetRoute(targetId: string): string | undefined {
    if (this.store?.risks.value.some((risk) => risk.id === targetId)) return '#/risks';
    if (this.store?.actions.value.some((action) => action.id === targetId)) return '#/actions';
    if (this.store?.directions.value.some((direction) => direction.id === targetId)) {
      return '#/directions';
    }
    return undefined;
  }

  #renderReference(reference: string) {
    const urlMatch = /https?:\/\/[\w./%#?=&:-]+/.exec(reference);
    if (!urlMatch) return html`<li>${reference}</li>`;

    const url = urlMatch[0];
    const label = reference
      .replace(url, '')
      .replace(/[:\-\s]+$/g, '')
      .trim();
    return html`
      <li>
        ${label ? html`<span>${label}: </span>` : ''}
        <a href=${url} target="_blank" rel="noopener noreferrer">${url}</a>
      </li>
    `;
  }

  async #createRelationship(requirementId: string): Promise<void> {
    if (!this.store) return;
    const targetId = this.linkTargetId.trim();
    if (!this.#targetOptions().some((opt) => opt.id === targetId)) return;

    const kind =
      this.linkTargetType === 'risk'
        ? 'requirement-risk'
        : this.linkTargetType === 'action'
          ? 'requirement-action'
          : 'requirement-direction';
    await this.store.createRelationship({
      kind,
      endpoints: [requirementId, targetId],
    });
    this.linkTargetId = '';
  }

  async #createAction(requirementId: string): Promise<void> {
    if (!this.store) return;
    const title = this.newActionTitle.trim();
    if (!title) return;
    const action = await this.store.createAction({
      title,
      type: 'remediation',
      status: 'todo',
      requirementIds: [],
      riskIds: [],
    });
    await this.store.createRelationship({
      kind: 'requirement-action',
      endpoints: [requirementId, action.id],
    });
    this.newActionTitle = '';
  }

  async #createRisk(requirementId: string): Promise<void> {
    if (!this.store) return;
    const title = this.newRiskTitle.trim();
    if (!title) return;
    const risk = await this.store.createRisk({
      title,
      likelihood: this.newRiskLikelihood,
      impact: this.newRiskImpact,
      status: 'open',
      requirementIds: [],
      actionIds: [],
    });
    await this.store.createRelationship({
      kind: 'requirement-risk',
      endpoints: [requirementId, risk.id],
    });
    this.newRiskTitle = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-requirement-view': RequirementView;
  }
}
