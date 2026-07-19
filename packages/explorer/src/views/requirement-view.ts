import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { designTokens } from '../app/design-tokens.ts';
import {
  allDomains,
  allRequirements,
  requirementById,
  essentialEightControls,
} from '../pspf/index.ts';
import { asRequirementId, type ComplianceState, type Relationship } from '../data/types.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import '../components/compliance-badge.ts';
import '../components/compliance-editor.ts';
import '../components/work-log.ts';
import '../components/breadcrumbs.ts';

@customElement('pspf-requirement-view')
export class RequirementView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
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
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg-elevated);
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
        color: var(--colour-fg-muted);
      }
      dd {
        margin: 0;
      }
      p.text {
        max-width: 70ch;
        line-height: 1.5;
      }
      .placeholder {
        padding: var(--space-3);
        border: 1px dashed var(--colour-border);
        border-radius: var(--radius-md);
        color: var(--colour-fg-muted);
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
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
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
        color: var(--colour-fg-muted);
      }
      .linker input,
      .linker select,
      .linker button {
        font: inherit;
        color: inherit;
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
      }
      .linker button {
        cursor: pointer;
      }
      .linker button.primary {
        background: var(--colour-accent);
        color: var(--colour-accent-fg);
        border-color: var(--colour-accent);
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
    return html`
      <article>
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
        <p class="text">${req.text}</p>
        <dl>
          <dt>Domain</dt>
          <dd>${domain?.name ?? req.domain}</dd>
          <dt>Reporting</dt>
          <dd>${req.reportingType}</dd>
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
        <pspf-compliance-editor .requirementId=${req.id}></pspf-compliance-editor>
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
        </section>
        <pspf-work-log .requirementId=${req.id}></pspf-work-log>
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
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-requirement-view': RequirementView;
  }
}
