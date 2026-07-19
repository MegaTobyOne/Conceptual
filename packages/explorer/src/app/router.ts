/**
 * Tiny hash-based router for PSPF Explorer.
 *
 * - Reads `window.location.hash` for the current path (`#/foo` → `/foo`).
 * - Matches against a route table with `:param` placeholders.
 * - Lazily imports the view module before mounting the custom element.
 * - Emits a `route-change` event on the outlet for tests/observers.
 */

export interface RouteSpec {
  /** Express-style path. `/`, `/foo`, `/foo/:bar`, `(.*)` for catch-all. */
  path: string;
  /** Custom-element tag to mount when the route matches. */
  component: string;
  /** Lazy import for the module that defines the component. */
  load: () => Promise<unknown>;
}

export interface RouteMatch {
  spec: RouteSpec;
  params: Readonly<Record<string, string>>;
  pathname: string;
}

interface CompiledRoute {
  spec: RouteSpec;
  pattern: RegExp;
  keys: string[];
}

function compile(spec: RouteSpec): CompiledRoute {
  if (spec.path === '(.*)') {
    return { spec, pattern: /^.*$/, keys: [] };
  }
  const keys: string[] = [];
  const pattern = spec.path.replace(/\/:([A-Za-z_][\w]*)/g, (_, key: string) => {
    keys.push(key);
    return '/([^/]+)';
  });
  return { spec, pattern: new RegExp(`^${pattern}/?$`), keys };
}

function currentPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === '#') return '/';
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  return path || '/';
}

function match(routes: readonly CompiledRoute[], pathname: string): RouteMatch | undefined {
  for (const r of routes) {
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => {
      const v = m[i + 1];
      if (v !== undefined) params[k] = decodeURIComponent(v);
    });
    return { spec: r.spec, params, pathname };
  }
  return undefined;
}

export class HashRouter {
  #routes: readonly CompiledRoute[];
  #outlet: HTMLElement;
  #current: HTMLElement | undefined;
  #onHashChange = (): void => {
    void this.render();
  };
  #lastPath = '';

  constructor(outlet: HTMLElement, specs: readonly RouteSpec[]) {
    this.#outlet = outlet;
    this.#routes = specs.map(compile);
  }

  start(): void {
    window.addEventListener('hashchange', this.#onHashChange);
    void this.render();
  }

  stop(): void {
    window.removeEventListener('hashchange', this.#onHashChange);
  }

  async render(): Promise<RouteMatch | undefined> {
    const pathname = currentPath();
    if (pathname === this.#lastPath && this.#current) {
      return match(this.#routes, pathname);
    }
    this.#lastPath = pathname;
    const found = match(this.#routes, pathname);
    if (!found) return undefined;

    await found.spec.load();

    const next = document.createElement(found.spec.component) as HTMLElement & {
      params?: Record<string, string>;
      pathname?: string;
    };
    next.params = found.params;
    next.pathname = pathname;

    this.#outlet.replaceChildren(next);
    this.#current = next;

    this.#outlet.dispatchEvent(
      new CustomEvent<RouteMatch>('route-change', { detail: found, bubbles: true, composed: true }),
    );
    return found;
  }
}

export function navigate(pathname: string): void {
  window.location.hash = `#${pathname}`;
}
