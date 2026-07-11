<script setup lang="ts">
import type { GammaTag, MarketFeedEvent } from "~/types/gamma";
import { useInfiniteScroll } from "~/composables/useInfiniteScroll";
import type { MarketsResponse } from "~/types/markets";
import { MARKETS_PAGE_SIZE } from "~/utils/constants";
import { getFeedErrorMessage, mergeUniqueMarketEvents, parseMarketsPage } from "~/utils/marketFeed";
import { fmtcn } from "~/utils/prices";

type FinanceFilter = "all" | "daily" | "weekly" | "monthly" | "stocks" | "earnings" | "indicies" | "commodities" | "forex" | "privates" | "acquisitions" | "earnings-calendar" | "ipo" | "fed-rates" | "prediction-markets" | "treasuries" | "kpis";
type FinanceRailItem = { label: string; slug: FinanceFilter; icon: string; to?: string };
type FinanceTopFilter = { label: string; slug: string };
type FinanceCounts = Partial<Record<Exclude<FinanceFilter, "earnings-calendar">, number>>;

const FINANCE_RAIL: FinanceRailItem[] = [
  { label: "All", slug: "all", icon: "lucide:grid-2x2" },
  { label: "Daily", slug: "daily", icon: "lucide:calendar-days" },
  { label: "Weekly", slug: "weekly", icon: "lucide:chart-no-axes-column-increasing" },
  { label: "Monthly", slug: "monthly", icon: "lucide:chart-no-axes-combined" },
  { label: "Stocks", slug: "stocks", icon: "lucide:chart-candlestick" },
  { label: "Earnings", slug: "earnings", icon: "lucide:badge-dollar-sign" },
  { label: "Indices", slug: "indicies", icon: "lucide:chart-spline" },
  { label: "Commodities", slug: "commodities", icon: "lucide:gem" },
  { label: "Forex", slug: "forex", icon: "lucide:repeat-2" },
  { label: "Privates", slug: "privates", icon: "lucide:briefcase-business" },
  { label: "Acquisitions", slug: "acquisitions", icon: "lucide:handshake" },
  { label: "Earnings Calendar", slug: "earnings-calendar", icon: "lucide:calendar-range", to: "/earnings" },
  { label: "IPOs", slug: "ipo", icon: "lucide:rocket" },
  { label: "Fed Rates", slug: "fed-rates", icon: "lucide:percent" },
  { label: "Prediction Markets", slug: "prediction-markets", icon: "lucide:badge-question-mark" },
  { label: "Treasuries", slug: "treasuries", icon: "lucide:landmark" },
  { label: "KPIs", slug: "kpis", icon: "lucide:chart-column-increasing" },
];

const BASE_FINANCE_TOP = ["up-or-down", "daily-close"] as const;
const BROAD_FINANCE_TOP = ["spx", "stocks", "indicies", "gold", "silver", "tsla", "nvda"] as const;
const STOCK_TOP = ["nvda", "tsla", "googl", "aapl", "meta", "amzn", "hood", "nflx", "micron", "pltr", "open", "coin"] as const;

const SECTION_TOP_FILTERS: Partial<Record<FinanceFilter, readonly string[]>> = {
  weekly: STOCK_TOP,
  stocks: [...BASE_FINANCE_TOP, ...STOCK_TOP],
  indicies: ["up-or-down", "spx", "nasdaq-100", "dow-jones", "russell-2000", "nya", "ftse-100", "hang-seng", "kospi"],
  commodities: ["up-or-down", "silver", "gold", "oil", "uranium"],
  forex: ["up-or-down", "eurusd", "usdjpy", "usdkrw", "gbpusd", "usdcad"],
};

const TOP_FILTER_LABELS: Record<string, string> = {
  "up-or-down": "Up / Down",
  "daily-close": "Daily Close",
  spx: "S&P 500",
  stocks: "Stocks",
  indicies: "Indices",
  gold: "Gold",
  silver: "Silver",
  tsla: "Tesla",
  nvda: "NVIDIA",
  googl: "GOOGL",
  aapl: "AAPL",
  meta: "META",
  amzn: "AMZN",
  hood: "HOOD",
  nflx: "NFLX",
  micron: "MU",
  pltr: "PLTR",
  open: "OPEN",
  coin: "COIN",
  "nasdaq-100": "Nasdaq 100",
  "dow-jones": "Dow Jones",
  "russell-2000": "Russell 2000",
  nya: "NYA",
  "ftse-100": "FTSE 100",
  "hang-seng": "Hang Seng",
  kospi: "KOSPI",
  oil: "Oil",
  uranium: "Uranium",
  eurusd: "EUR/USD",
  usdjpy: "USD/JPY",
  usdkrw: "USD/KRW",
  gbpusd: "GBP/USD",
  usdcad: "USD/CAD",
};

const TOP_FILTER_ALIASES: Record<string, readonly string[]> = {
  "up-or-down": ["up or down", "up/down", "updown"],
  "daily-close": ["daily close", "close above", "close below", "closes above", "closes below"],
  spx: ["s&p 500", "s&p500", "spx", "s&p", "sp500"],
  "nasdaq-100": ["nasdaq", "qqq", "nasdaq-100", "nasdaq 100"],
  "dow-jones": ["dow jones", "dow", "dji", "djia"],
  "russell-2000": ["russell", "russell 2000", "russell-2000", "iwm"],
  nya: ["nya", "nyse", "new york stock"],
  "ftse-100": ["ftse", "ftse 100", "ftse-100"],
  "hang-seng": ["hang seng", "hsi", "hong kong"],
  kospi: ["kospi", "korea"],
  gold: ["gold", "xau"],
  silver: ["silver", "xag"],
  oil: ["oil", "crude", "wti", "brent"],
  uranium: ["uranium"],
  eurusd: ["eur/usd", "eurusd", "euro"],
  usdjpy: ["usd/jpy", "usdjpy", "yen"],
  usdkrw: ["usd/krw", "usdkrw", "won"],
  gbpusd: ["gbp/usd", "gbpusd", "pound"],
  usdcad: ["usd/cad", "usdcad", "loonie"],
  nvda: ["nvda", "nvidia"],
  tsla: ["tsla", "tesla"],
  googl: ["googl", "goog", "google", "alphabet"],
  aapl: ["aapl", "apple"],
  meta: ["meta", "facebook"],
  amzn: ["amzn", "amazon"],
  hood: ["hood", "robinhood"],
  nflx: ["nflx", "netflix"],
  micron: ["micron", "mu"],
  pltr: ["pltr", "palantir"],
  open: ["open", "opendoor"],
  coin: ["coin", "coinbase"],
};

useSeoMeta({
  title: "Finance - Stance",
  description: "Finance prediction markets across stocks, indices, commodities, rates, IPOs, private markets, and earnings.",
});

const { data: countsData } = await useFetch<FinanceCounts>("/api/finance/counts");

const activeRailSlug = ref<FinanceFilter>("all");
const activeTopSlug = ref("all");
const rawEvents = ref<MarketFeedEvent[]>([]);
const cursor = ref<string | null>(null);
const hasMore = ref(true);
const loading = ref(false);
const initialLoaded = ref(false);
const error = ref<string | null>(null);
const pageError = ref<string | null>(null);
const seenIds = ref(new Set<string>());
const { start, done } = useLoader();
let requestId = 0;

const pageTitle = computed(() => {
  if (activeRailSlug.value === "all") return "Finance";
  return FINANCE_RAIL.find((i) => i.slug === activeRailSlug.value)?.label ?? "Finance";
});
const sectionTopSlugs = computed(() => {
  const s = activeRailSlug.value;
  if (s === "all" || s === "daily") return [...BASE_FINANCE_TOP, ...BROAD_FINANCE_TOP];
  if (s === "monthly") return [...BROAD_FINANCE_TOP];
  return [...(SECTION_TOP_FILTERS[s] ?? [])];
});
const topFilters = computed<FinanceTopFilter[]>(() => (sectionTopSlugs.value.length ? [{ label: "All", slug: "all" }, ...sectionTopSlugs.value.map((s) => ({ slug: s, label: TOP_FILTER_LABELS[s] ?? s.toUpperCase() }))] : []));
const visibleEvents = computed(() => (activeTopSlug.value === "all" ? rawEvents.value : rawEvents.value.filter((e) => eventMatchesTopFilter(e, activeTopSlug.value))));

function selectRail(item: FinanceRailItem) {
  if (item.to || item.slug === activeRailSlug.value) return;
  activeRailSlug.value = item.slug;
  activeTopSlug.value = "all";
  void reset();
}

function selectTop(filter: FinanceTopFilter) {
  if (filter.slug === activeTopSlug.value) return;
  activeTopSlug.value = filter.slug;
  void ensureFilteredResults();
}

function eventMatchesTopFilter(event: MarketFeedEvent, slug: string): boolean {
  const tags = new Set(((event.tags as GammaTag[] | undefined) ?? []).map((t) => t.slug).filter((s): s is string => typeof s === "string"));
  if (tags.has(slug)) return true;
  const hay = [event.title, event.slug]
    .filter((p): p is string => typeof p === "string")
    .join(" ")
    .toLowerCase();
  return Boolean(TOP_FILTER_ALIASES[slug]?.some((a) => hay.includes(a)));
}

const countFor = (i: FinanceRailItem) => countsData.value?.[i.slug as keyof FinanceCounts];
const formatCount = (n?: number) => (typeof n === "number" ? fmtcn(n) : "");

async function fetchPage(rid: number) {
  const query: Record<string, string | number> = { category: activeRailSlug.value, limit: MARKETS_PAGE_SIZE, order: "volume24hr" };
  if (cursor.value) query.cursor = cursor.value;

  const d = await $fetch<MarketsResponse | MarketFeedEvent[]>("/api/finance/markets", { query });
  if (rid !== requestId) return;

  const { events: ev, cursor: nc } = parseMarketsPage(d);
  cursor.value = nc;
  hasMore.value = Boolean(nc);
  rawEvents.value.push(...mergeUniqueMarketEvents(ev, seenIds.value));
  error.value = null;
  pageError.value = null;
}

async function reset() {
  const rid = ++requestId;
  loading.value = true;
  initialLoaded.value = false;
  pageError.value = null;
  try {
    start();
    cursor.value = null;
    hasMore.value = true;
    seenIds.value.clear();
    rawEvents.value = [];
    await fetchPage(rid);
    for (let n = 0; rid === requestId && hasMore.value && visibleEvents.value.length < 12 && n < 4; n++) await fetchPage(rid);
  } catch (err) {
    if (rid === requestId) error.value = getFeedErrorMessage(err);
  } finally {
    if (rid === requestId) {
      initialLoaded.value = true;
      loading.value = false;
      done();
    }
  }
}

async function loadMore() {
  if (loading.value || !initialLoaded.value || !hasMore.value) return;
  const rid = ++requestId;
  loading.value = true;
  pageError.value = null;
  try {
    start();
    await fetchPage(rid);
  } catch (err) {
    if (rid === requestId) {
      const m = getFeedErrorMessage(err);
      if (visibleEvents.value.length > 0) pageError.value = m;
      else error.value = m;
    }
  } finally {
    if (rid === requestId) {
      loading.value = false;
      done();
    }
  }
}

async function ensureFilteredResults() {
  for (let n = 0; !loading.value && hasMore.value && visibleEvents.value.length < 12 && n < 4; n++) await loadMore();
}

const retry = async () => {
  if (!loading.value) await reset();
};
const retryPage = async () => {
  if (!loading.value) await loadMore();
};

await reset();

useInfiniteScroll(() => void loadMore(), { threshold: 0.1 });

const railButtonClass = (active: boolean) => ["pm-focus group flex min-h-10 min-w-max items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold leading-5 transition-colors duration-150 lg:w-full", active ? "bg-surface-2 text-white" : "text-text-2 hover:bg-surface hover:text-white"];
const topButtonClass = (active: boolean) => ["pm-focus inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150", active ? "border-white/35 bg-surface-2 text-white" : "border-border bg-transparent text-text-2 hover:border-border-2 hover:text-white"];
</script>

<template>
  <div class="pm-page">
    <div class="flex flex-col lg:flex-row">
      <aside class="border-b border-border px-4 py-3 lg:sticky lg:top-0 lg:h-[calc(100dvh-3rem)] lg:w-57 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-2">
        <nav class="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Finance categories">
          <template v-for="item in FINANCE_RAIL" :key="item.slug">
            <NuxtLink v-if="item.to" :to="item.to" :class="railButtonClass(false)">
              <span class="flex min-w-0 items-center gap-2.5">
                <Icon :name="item.icon" class="h-4 w-4 shrink-0 text-text-2 transition-colors duration-150 group-hover:text-white" />
                <span class="truncate">{{ item.label }}</span>
              </span>
            </NuxtLink>
            <button v-else type="button" :class="railButtonClass(activeRailSlug === item.slug)" :aria-pressed="activeRailSlug === item.slug" @click="selectRail(item)">
              <span class="flex min-w-0 items-center gap-2.5">
                <Icon :name="item.icon" class="h-4 w-4 shrink-0 transition-colors duration-150" :class="activeRailSlug === item.slug ? 'text-white' : 'text-text-2 group-hover:text-white'" />
                <span class="truncate">{{ item.label }}</span>
              </span>
              <span v-if="formatCount(countFor(item))" class="pm-tabular shrink-0 text-xs font-semibold text-text-3 group-hover:text-text-2">{{ formatCount(countFor(item)) }}</span>
            </button>
          </template>
        </nav>
      </aside>

      <main class="min-w-0 flex-1 px-4 py-5 sm:px-5 lg:px-6">
        <div class="mb-5 flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-bold leading-8 text-white">{{ pageTitle }}</h1>
            <div class="flex items-center gap-2 text-xs font-semibold text-text-3">
              <Icon name="lucide:sliders-horizontal" class="h-4 w-4" />
              <span>24hr Volume</span>
            </div>
          </div>

          <div v-if="topFilters.length" class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6" aria-label="Finance market filters">
            <button v-for="filter in topFilters" :key="filter.slug" type="button" :class="topButtonClass(activeTopSlug === filter.slug)" :aria-pressed="activeTopSlug === filter.slug" @click="selectTop(filter)">
              {{ filter.label }}
            </button>
          </div>
        </div>

        <div v-if="error && visibleEvents.length === 0" class="flex min-h-60 items-center justify-center px-4">
          <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
            <p class="mb-2 text-base font-semibold leading-snug text-no">{{ error }}</p>
            <p class="mb-4 text-sm leading-5 text-text-3">The finance market feed is unavailable right now.</p>
            <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-semibold" :disabled="loading" @click="retry">Retry</button>
          </div>
        </div>

        <div v-else-if="loading && visibleEvents.length === 0" class="pm-grid">
          <div v-for="i in 9" :key="`skeleton-${i}`" class="min-h-42 rounded-xl border border-border bg-surface">
            <div class="flex items-start gap-2 px-3 pt-3">
              <div class="pm-skeleton h-9 w-9 shrink-0 rounded-lg" />
              <div class="flex-1 space-y-2">
                <div class="pm-skeleton h-4 w-3/4" />
                <div class="pm-skeleton h-4 w-1/2" />
              </div>
            </div>
            <div class="space-y-2 px-3 pt-4">
              <div class="pm-skeleton h-7 w-full rounded-md" />
              <div class="pm-skeleton h-7 w-full rounded-md" />
            </div>
            <div class="flex justify-between px-3 pt-4 pb-3">
              <div class="pm-skeleton h-3 w-16" />
              <div class="pm-skeleton h-3 w-10" />
            </div>
          </div>
        </div>

        <div v-else-if="visibleEvents.length === 0" class="flex min-h-60 items-center justify-center px-4">
          <div class="max-w-md text-center text-sm leading-5 text-text-3">No finance markets match this filter right now.</div>
        </div>

        <div v-else class="pm-grid transition-opacity duration-150" :class="{ 'opacity-60': loading }">
          <MarketCard v-for="(event, index) in visibleEvents" :key="event.id" :event="event" :style="{ '--card-index': Math.min(index, 8) }" />
        </div>

        <div v-if="pageError && visibleEvents.length > 0" class="flex justify-center px-4 py-4">
          <div class="inline-flex items-center gap-3 rounded-lg border border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.08)] px-4 py-2 text-sm leading-5 text-[#eab308]">
            <span>{{ pageError }}</span>
            <button class="pm-focus font-semibold hover:text-white" :disabled="loading" @click="retryPage">Retry</button>
          </div>
        </div>

        <div ref="sentinel" class="h-16" />
      </main>
    </div>
  </div>
</template>
