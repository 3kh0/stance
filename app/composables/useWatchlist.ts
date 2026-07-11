import { LEGACY_PAPERMARKET_WATCHLIST_KEY, WATCHLIST_STORAGE_KEY } from "~/utils/constants";

export interface WatchlistEntry {
  id: string;
  slug?: string;
  title: string;
  addedAt: number;
}

export const useWatchlist = () => {
  const items = useState<WatchlistEntry[]>("stance-watchlist", () => []);
  const loaded = useState<boolean>("stance-watchlist-loaded", () => false);

  const load = () => {
    if (loaded.value || import.meta.server) return;
    loaded.value = true;
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PAPERMARKET_WATCHLIST_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      items.value = parsed.filter((e): e is WatchlistEntry => !!e && typeof e === "object" && typeof (e as WatchlistEntry).id === "string" && typeof (e as WatchlistEntry).title === "string");
      if (!localStorage.getItem(WATCHLIST_STORAGE_KEY)) {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items.value));
        localStorage.removeItem(LEGACY_PAPERMARKET_WATCHLIST_KEY);
      }
    } catch {}
  };

  const persist = () => {
    if (import.meta.server) return;
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items.value));
    } catch {}
  };

  const isWatched = (id: string) => items.value.some((e) => e.id === id);

  const add = (entry: Omit<WatchlistEntry, "addedAt">) => {
    if (!entry.id || isWatched(entry.id)) return;
    items.value = [{ ...entry, addedAt: Date.now() }, ...items.value].slice(0, 20);
    persist();
  };

  const remove = (id: string) => {
    items.value = items.value.filter((e) => e.id !== id);
    persist();
  };

  return {
    items: readonly(items),
    load,
    isWatched,
    add,
    remove,
    toggle: (entry: Omit<WatchlistEntry, "addedAt">) => (isWatched(entry.id) ? remove(entry.id) : add(entry)),
  };
};
