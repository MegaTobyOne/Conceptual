export type ListSortMode = 'updated' | 'alpha';

export interface PersistedListPrefs<TStatus extends string> {
  searchQuery: string;
  sortMode: ListSortMode;
  statusFilter: TStatus | 'all';
  page: number;
  pageSize: number;
}

function localStore(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

function sessionStore(): Storage | undefined {
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readListPrefs<TStatus extends string>(
  key: string,
  statuses: readonly TStatus[],
): PersistedListPrefs<TStatus> | undefined {
  const store = localStore();
  if (!store) return undefined;

  const parsed = parseJson(store.getItem(key));
  if (!isRecord(parsed)) return undefined;

  const searchQuery = typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '';
  const sortMode: ListSortMode = parsed.sortMode === 'alpha' ? 'alpha' : 'updated';
  const statusFilter =
    parsed.statusFilter === 'all' ||
    (typeof parsed.statusFilter === 'string' && statuses.includes(parsed.statusFilter as TStatus))
      ? (parsed.statusFilter as TStatus | 'all')
      : 'all';
  const page =
    typeof parsed.page === 'number' && Number.isFinite(parsed.page) && parsed.page > 0
      ? Math.floor(parsed.page)
      : 1;
  const pageSize: 20 | 50 | 100 =
    parsed.pageSize === 20 || parsed.pageSize === 50 || parsed.pageSize === 100
      ? parsed.pageSize
      : 20;

  return { searchQuery, sortMode, statusFilter, page, pageSize };
}

export function writeListPrefs<TStatus extends string>(
  key: string,
  prefs: PersistedListPrefs<TStatus>,
): void {
  const store = localStore();
  if (!store) return;
  store.setItem(key, JSON.stringify(prefs));
}

export function readSelectionSet(key: string): ReadonlySet<string> {
  const store = sessionStore();
  if (!store) return new Set();

  const parsed = parseJson(store.getItem(key));
  if (!Array.isArray(parsed)) return new Set();

  return new Set(parsed.filter((value): value is string => typeof value === 'string'));
}

export function writeSelectionSet(key: string, ids: ReadonlySet<string>): void {
  const store = sessionStore();
  if (!store) return;
  store.setItem(key, JSON.stringify([...ids]));
}

export function clearLocalValue(key: string): void {
  const store = localStore();
  if (!store) return;
  store.removeItem(key);
}

export function clearSessionValue(key: string): void {
  const store = sessionStore();
  if (!store) return;
  store.removeItem(key);
}
