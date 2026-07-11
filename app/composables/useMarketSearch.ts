export interface SearchMarket {
  id?: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  closed?: boolean;
  active?: boolean;
  endDate?: string;
  endDateIso?: string;
}

export interface SearchEventResult {
  id: string;
  slug?: string;
  title?: string;
  image?: string;
  icon?: string;
  closed?: boolean;
  ended?: boolean;
  endDate?: string;
  markets?: SearchMarket[];
}

export interface SearchProfileResult {
  name?: string;
  pseudonym?: string;
  profileImage?: string;
  bio?: string;
  proxyWallet?: string;
  displayUsernamePublic?: boolean;
}

export interface SearchResponse {
  events?: SearchEventResult[];
  profiles?: SearchProfileResult[];
  pagination?: { hasMore?: boolean; totalResults?: number };
}

export interface SearchEventDisplay {
  resolved: boolean;
  percent: number | null;
  endDate: string;
  resolvedLabel: string | null;
  extraCount: number;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function marketYesPrice(m: SearchMarket): number {
  const outcomes = toArray(m.outcomes);
  const prices = toArray(m.outcomePrices);
  if (!prices.length) return 0;
  const yesIdx = outcomes.findIndex((x) => x.toLowerCase() === "yes");
  const n = Number.parseFloat(prices[yesIdx >= 0 ? yesIdx : 0] ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function winningOutcomeLabel(m: SearchMarket): string | null {
  const outcomes = toArray(m.outcomes);
  const prices = toArray(m.outcomePrices);
  if (!prices.length) return null;
  let bestIdx = -1;
  let bestPrice = 0;
  prices.forEach((p, i) => {
    const n = Number.parseFloat(p);
    if (Number.isFinite(n) && n > bestPrice) {
      bestPrice = n;
      bestIdx = i;
    }
  });
  if (bestIdx < 0) return null;
  return m.groupItemTitle?.trim() || outcomes[bestIdx] || null;
}

function formatEndDate(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function describeSearchEvent(ev: SearchEventResult): SearchEventDisplay {
  const markets = ev.markets ?? [];
  const open = markets.filter((m) => m.active !== false && m.closed !== true);

  if (!((ev.closed === true || ev.ended === true) && open.length === 0) && open.length) {
    const top = [...open].sort((a, b) => marketYesPrice(b) - marketYesPrice(a))[0]!;
    return { resolved: false, percent: Math.round(marketYesPrice(top) * 100), endDate: formatEndDate(top.endDate || top.endDateIso || ev.endDate), resolvedLabel: null, extraCount: 0 };
  }

  const primary = markets.filter((m) => m.closed === true)[0] ?? markets[0];
  return { resolved: true, percent: null, endDate: "", resolvedLabel: primary ? winningOutcomeLabel(primary) : null, extraCount: Math.max(0, markets.length - 1) };
}

export function useMarketSearch() {
  const query = ref("");
  const pending = ref(false);
  const results = ref<SearchResponse | null>(null);
  const error = ref<string | null>(null);

  let debounce: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  let requestId = 0;

  const hasResults = computed(() => {
    const r = results.value;
    return r ? (r.events?.length ?? 0) + (r.profiles?.length ?? 0) > 0 : false;
  });

  async function run(q: string) {
    abort?.abort();
    const controller = new AbortController();
    abort = controller;
    const id = ++requestId;
    pending.value = true;
    error.value = null;
    try {
      const data = await $fetch<SearchResponse>("/api/search", { query: { q, limit_per_type: 6 }, signal: controller.signal });
      if (id !== requestId) return;
      results.value = data;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError" || id !== requestId) return;
      error.value = "Search failed";
      results.value = null;
    } finally {
      if (id === requestId) pending.value = false;
    }
  }

  watch(query, (val) => {
    const q = val.trim();
    if (debounce) clearTimeout(debounce);
    if (!q) {
      results.value = null;
      pending.value = false;
      error.value = null;
      abort?.abort();
      return;
    }
    debounce = setTimeout(() => run(q), 200);
  });

  onBeforeUnmount(() => {
    if (debounce) clearTimeout(debounce);
    abort?.abort();
  });

  return { query, pending, results, error, hasResults };
}
