import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { designTokens } from '../app/design-tokens.ts';

@customElement('pspf-help-view')
export class HelpView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--space-3) 0;
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
      ul {
        margin: 0;
        padding-left: 1.25rem;
      }
      li + li {
        margin-top: var(--space-1);
      }
      kbd {
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: 0 0.25rem;
        font-size: 0.85em;
      }
      a {
        color: var(--colour-link);
      }
    `,
  ];

  override render(): TemplateResult {
    return html`
      <article>
        <h2>Help</h2>
        <p>
          PSPF Explorer is a fully client-side companion for working with the Australian Government
          Protective Security Policy Framework (PSPF). All your data is stored in this browser only
          — nothing is sent to any server.
        </p>

        <section class="panel">
          <h3>Getting started</h3>
          <ul>
            <li>Open the <a href="#/">Home</a> page to browse the six PSPF security domains.</li>
            <li>
              From a domain, open a requirement to record compliance, evidence and work notes.
            </li>
            <li>
              Use <a href="#/posture">Posture</a> to record your organisation’s threat level and
              security posture (globally or per-domain).
            </li>
          </ul>
        </section>

        <section class="panel">
          <h3>Tracking work</h3>
          <ul>
            <li>
              <a href="#/risks">Risks</a> — capture likelihood × impact scoring and link risks to
              requirements and actions.
            </li>
            <li>
              <a href="#/actions">Actions</a> — track tasks with status and due dates. Overdue
              actions surface on the Analytics dashboard.
            </li>
            <li><a href="#/tags">Tags</a> — organise requirements with custom labels.</li>
            <li>
              <a href="#/views">Saved views</a> — store filter combinations for repeat reporting.
            </li>
            <li>
              <a href="#/analytics">Analytics</a> — see compliance coverage, risk bands and action
              throughput at a glance.
            </li>
          </ul>
        </section>

        <section class="panel">
          <h3>Your data</h3>
          <ul>
            <li>
              <a href="#/backup">Backup</a> downloads a JSON snapshot of every record. Keep a copy
              off-device for safety.
            </li>
            <li>
              <a href="#/restore">Restore</a> replaces all records in this browser with the contents
              of a previously downloaded backup.
            </li>
            <li>
              <a href="#/integrity">Integrity</a> shows the integrity status of the local data
              store.
            </li>
            <li>
              The PSPF requirement catalogue ships with the app and is never modified by edits.
              Clearing data only removes your annotations.
            </li>
          </ul>
        </section>

        <section class="panel">
          <h3>Privacy &amp; offline use</h3>
          <p>
            PSPF Explorer is a static web app. After the first load, it works offline — your browser
            holds the entire catalogue and your annotations in IndexedDB. There is no telemetry, no
            accounts, and no network calls for storage.
          </p>
        </section>

        <section class="panel">
          <h3>Keyboard navigation</h3>
          <ul>
            <li><kbd>Tab</kbd> moves through interactive elements.</li>
            <li>
              <kbd>Enter</kbd> activates buttons and links; <kbd>Space</kbd> toggles checkboxes and
              buttons.
            </li>
            <li>Browser back/forward navigate between views via the URL hash.</li>
          </ul>
        </section>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-help-view': HelpView;
  }
}
