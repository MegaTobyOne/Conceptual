import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { designTokens } from './design-tokens.ts';
import { HashRouter, type RouteMatch } from './router.ts';
import { routes, NAV_GROUPS, NAV_ROUTES, type NavGroupKey } from './routes.ts';
import { AppStore } from '../state/app-store.ts';
import { appStoreContext } from '../state/contexts.ts';
import '../components/command-palette.ts';

type AppTheme = 'dark' | 'light' | 'colorful';

const THEME_STORAGE_KEY = 'pspf-theme';

@customElement('pspf-app')
export class PspfApp extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--colour-bg);
        color: var(--colour-fg);
        font-family: var(--font-family-sans);
      }

      header {
        display: grid;
        grid-template-columns: auto minmax(16rem, 34rem) auto;
        gap: var(--space-3);
        align-items: center;
        padding: var(--space-3) var(--space-4) var(--space-2);
        border-bottom: 1px solid var(--colour-border);
        background: var(--colour-bg-elevated);
      }

      h1 {
        font-size: var(--text-lg);
        font-weight: 600;
        margin: 0;
      }

      h1 a {
        color: inherit;
        text-decoration: none;
      }

      .brand {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .classification {
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--colour-classification-fg);
        background: var(--colour-classification-bg);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
      }

      .header-labels {
        display: flex;
        gap: var(--space-2);
        align-items: center;
      }

      .theme-picker {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .theme-picker select {
        font: inherit;
        letter-spacing: 0;
        text-transform: none;
        font-weight: 600;
        color: var(--colour-fg);
        background: var(--colour-bg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        padding: 0.15rem 0.35rem;
      }

      .theme-picker select:focus-visible {
        outline: 2px solid var(--colour-accent);
        outline-offset: 1px;
      }

      .tlp {
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #111827;
        background: #f59e0b;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
      }

      nav {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--colour-border);
        background: var(--colour-bg);
        font-size: var(--text-sm);
      }

      .nav-group {
        min-width: 0;
      }

      .nav-group-title {
        margin: 0 0 var(--space-1) 0;
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .nav-links {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }

      nav a {
        color: var(--colour-fg-muted);
        text-decoration: none;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        white-space: nowrap;
      }

      nav a:hover,
      nav a:focus-visible,
      nav a[aria-current='page'] {
        color: var(--colour-fg);
        background: var(--colour-bg-elevated);
        border-color: var(--colour-border);
      }

      .mobile-nav {
        display: none;
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--colour-border);
        background: var(--colour-bg);
      }

      .mobile-nav summary {
        cursor: pointer;
        font-weight: 700;
      }

      .mobile-nav nav {
        display: block;
        padding: var(--space-2) 0 0;
        border: 0;
      }

      main {
        flex: 1;
        padding: var(--space-4);
      }

      footer {
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
        border-top: 1px solid var(--colour-border);
        display: flex;
        justify-content: space-between;
      }

      .loading {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
      }

      @media print {
        :host {
          background: white;
          color: black;
        }
        header,
        nav,
        .mobile-nav,
        footer,
        pspf-command-palette {
          display: none !important;
        }
        main {
          padding: 0;
        }
      }

      @media (max-width: 980px) {
        header {
          grid-template-columns: 1fr;
          align-items: stretch;
        }
        .header-labels {
          justify-content: flex-start;
          flex-wrap: wrap;
        }
        nav.primary {
          display: none;
        }
        .mobile-nav {
          display: block;
        }
      }
    `,
  ];

  @state() private store: AppStore | undefined;
  @state() private bootError: string | undefined;
  @state() private activePath = '/';
  @state() private theme: AppTheme = 'dark';

  @provide({ context: appStoreContext })
  private storeContext!: AppStore;

  override connectedCallback(): void {
    super.connectedCallback();
    this.theme = this.loadTheme();
    this.setAttribute('data-theme', this.theme);
    void import('../components/global-search.ts');
    void this.boot();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('theme')) {
      this.setAttribute('data-theme', this.theme);
      this.persistTheme(this.theme);
    }
  }

  private async boot(): Promise<void> {
    try {
      const store = await AppStore.open();
      this.storeContext = store;
      this.store = store;
    } catch (error) {
      this.bootError =
        error instanceof Error ? error.message : 'Could not open the local database.';
    }
  }

  override firstUpdated(_changed: PropertyValues): void {
    const outlet = this.renderRoot.querySelector<HTMLElement>('#outlet');
    if (!outlet) return;
    outlet.addEventListener('route-change', (event: Event) => {
      const detail = (event as CustomEvent<RouteMatch>).detail;
      this.activePath = detail.pathname;
    });
    const router = new HashRouter(outlet, routes);
    router.start();
  }

  private routesForGroup(group: NavGroupKey) {
    return NAV_ROUTES.filter((route) => route.group === group);
  }

  private loadTheme(): AppTheme {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === 'dark' || raw === 'light' || raw === 'colorful') return raw;
    } catch {
      // Ignore storage access failures and keep the default.
    }
    return 'dark';
  }

  private persistTheme(theme: AppTheme): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access failures.
    }
  }

  private onThemeChange = (event: Event): void => {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'dark' || value === 'light' || value === 'colorful') {
      this.theme = value;
    }
  };

  private isActive(path: string): boolean {
    if (path === '/') return this.activePath === '/';
    return this.activePath === path || this.activePath.startsWith(`${path}/`);
  }

  private renderNavLinks(group: NavGroupKey) {
    return html`
      <div class="nav-links">
        ${this.routesForGroup(group).map(
          (route) => html`
            <a href="#${route.path}" aria-current=${this.isActive(route.path) ? 'page' : 'false'}>
              ${route.label}
            </a>
          `,
        )}
      </div>
    `;
  }

  override render() {
    return html`
      <header>
        <div class="brand">
          <h1><a href="#/">PSPF Explorer</a></h1>
        </div>
        <pspf-global-search></pspf-global-search>
        <div class="header-labels">
          <label class="theme-picker" for="theme-select">
            Theme
            <select
              id="theme-select"
              .value=${this.theme}
              @change=${this.onThemeChange}
              aria-label="Choose colour theme"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="colorful">Colorful</option>
            </select>
          </label>
          <span class="classification" aria-label="Information classification"
            >OFFICIAL: Sensitive</span
          >
          <span class="tlp" aria-label="Traffic Light Protocol marking">TLP:AMBER+STRICT</span>
        </div>
      </header>
      <nav class="primary" aria-label="Primary">
        ${NAV_GROUPS.map(
          (group) => html`
            <section class="nav-group" aria-label=${group.label}>
              <p class="nav-group-title">${group.label}</p>
              ${this.renderNavLinks(group.key)}
            </section>
          `,
        )}
      </nav>
      <details class="mobile-nav">
        <summary>Navigation</summary>
        <nav aria-label="Primary mobile">
          ${NAV_GROUPS.map(
            (group) => html`
              <section class="nav-group" aria-label=${group.label}>
                <p class="nav-group-title">${group.label}</p>
                ${this.renderNavLinks(group.key)}
              </section>
            `,
          )}
        </nav>
      </details>
      <main>
        ${this.bootError
          ? html`<p role="alert">Startup failed: ${this.bootError}</p>`
          : !this.store
            ? html`<p class="loading">Loading…</p>`
            : ''}
        <div id="outlet"></div>
      </main>
      <footer>
        <span>v${__APP_VERSION__}</span>
        <span
          >Press <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> for the command palette · Offline-first · No
          telemetry</span
        >
      </footer>
      <pspf-command-palette></pspf-command-palette>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-app': PspfApp;
  }
}
