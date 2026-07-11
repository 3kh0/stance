<script setup lang="ts">
import type { GammaEvent, GammaMarket, MarketFeedEvent } from "~/types/gamma";
import type { MarketsResponse } from "~/types/markets";
import { positionPnl } from "~/utils/markets";
import { fmtsp, proba } from "~/utils/prices";
import { isSportsEvent, sportsEventUrl } from "~/utils/sports";

interface WatchItem {
  id: string;
  url: string;
  question: string;
  outcome: string | null;
  pct: number | null;
  delta: number | null;
}

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false });
const emit = defineEmits<{ "update:collapsed": [value: boolean] }>();

const { account, hasAccount } = useAccount();
const { items: watchedEntries, load: loadWatchlist, remove: removeWatched } = useWatchlist();
const route = useRoute();

const setCollapsed = (value: boolean) => emit("update:collapsed", value);

onMounted(loadWatchlist);

const { data: trendingData } = useFetch<MarketsResponse | MarketFeedEvent[]>("/api/markets", { query: { limit: 12, order: "volume24hr" }, lazy: true, server: false });

const { data: watchedData } = useFetch<{ events: GammaEvent[] }>("/api/watchlist", { query: computed(() => ({ ids: watchedEntries.value.map((e) => e.id).join(",") })), lazy: true, server: false });

const dc = (m: GammaMarket) => {
  const n = Number.parseFloat(String(m.oneDayPriceChange ?? 0));
  return Number.isFinite(n) ? n : 0;
};

function toItem(ev: MarketFeedEvent | GammaEvent): WatchItem | null {
  const ms = (ev.markets ?? []).filter((m) => m.active !== false && m.closed !== true);
  if (!ms.length || !ev.title) return null;
  const top = [...ms].sort((a, b) => parseOutcomePrices(b).yes - parseOutcomePrices(a).yes)[0]!;
  return {
    id: String(ev.id),
    url: isSportsEvent(ev) ? sportsEventUrl(ev) : `/event/${ev.slug ?? ev.id}?x=${ev.id}`,
    question: ev.title,
    outcome: ms.length > 1 ? top.groupItemTitle?.trim() || top.question?.trim() || null : null,
    pct: Math.round(parseOutcomePrices(top).yes * 100),
    delta: Math.round(dc(top) * 1000) / 10,
  };
}

const isUserList = computed(() => watchedEntries.value.length > 0);

const trendingItems = computed<WatchItem[]>(() => {
  const raw = trendingData.value;
  const evs = (Array.isArray(raw) ? raw : (raw?.data ?? raw?.events ?? [])) as MarketFeedEvent[];
  return evs
    .filter((ev) => !isSportsSiblingEvent(ev))
    .map(toItem)
    .filter((i): i is WatchItem => i !== null)
    .slice(0, 8);
});

const watchlistItems = computed<WatchItem[]>(() => {
  const byId = new Map((watchedData.value?.events ?? []).map((ev) => [String(ev.id), ev]));
  return watchedEntries.value.map((en) => {
    const ev = byId.get(en.id);
    return (ev && toItem(ev)) ?? { id: en.id, url: en.slug ? `/event/${en.slug}?x=${en.id}` : `/event/${en.id}`, question: en.title, outcome: null, pct: null, delta: null };
  });
});

const items = computed<WatchItem[]>(() => (isUserList.value ? watchlistItems.value : trendingItems.value));

const pctClass = (p: number) => proba(p, "text-text-2");
const barClass = (p: number) => (p >= 55 ? "bg-yes" : p <= 45 ? "bg-no" : "bg-text-3");
const deltaClass = (d: number) => (d > 0 ? "text-yes" : d < 0 ? "text-no" : "text-text-3");

const openWithPnl = computed(() => account.value.positions.filter((p) => p.shares > 0).map((p) => ({ key: p.positionKey, url: p.marketSlug ? `/event/${p.marketSlug}` : "/portfolio", name: p.marketName, pnl: positionPnl(p) })));
const openPositions = computed(() => openWithPnl.value.slice(0, 4));
const totalPnl = computed(() => openWithPnl.value.reduce((s, p) => s + p.pnl, 0));
const money = (n: number) => `${n < 0 ? "−" : "+"}$${Math.abs(n).toFixed(2)}`;
</script>

<template>
  <aside class="hidden shrink-0 overflow-hidden border-r border-border bg-bg transition-[width] duration-150 lg:flex" :class="collapsed ? 'w-10 flex-col items-center' : 'w-57 flex-col'">
    <template v-if="collapsed">
      <div class="flex w-full flex-col items-center py-2">
        <button type="button" class="pm-focus grid h-8 w-8 place-items-center rounded-md text-text-3 transition-colors duration-150 hover:bg-surface hover:text-white" aria-label="Expand sidebar" title="Expand sidebar" @click="setCollapsed(false)">
          <Icon name="lucide:panel-left-open" class="h-4 w-4" />
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-center justify-between px-4 pb-2.5 pt-3.5">
        <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ isUserList ? "Watchlist" : "Active Markets" }}</span>
        <button type="button" class="pm-focus -mr-1 grid h-6 w-6 place-items-center rounded text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-white" aria-label="Collapse sidebar" title="Collapse sidebar" @click="setCollapsed(true)">
          <Icon name="lucide:panel-left-close" class="h-3.5 w-3.5" />
        </button>
      </div>
      <p v-if="!isUserList" class="px-4 pb-2.5 text-[10.5px] leading-snug text-text-3">You can add markets to your watchlist by clicking the icon on any market.</p>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="!items.length" class="px-4 py-3">
          <div v-for="i in 6" :key="i" class="mb-4 space-y-2">
            <div class="pm-skeleton h-3.5 w-full" />
            <div class="pm-skeleton h-2 w-2/3" />
          </div>
        </div>
        <NuxtLink
          v-for="item in items"
          :key="item.id"
          :to="item.url"
          class="group/item block border-b border-border px-4 py-2.5 transition-colors duration-100 hover:bg-surface"
          :class="{
            'bg-surface': route.fullPath.startsWith(item.url.split('?')[0] ?? ''),
          }"
        >
          <div class="mb-1.5 flex items-start gap-1.5">
            <span class="line-clamp-2 min-w-0 flex-1 text-xs font-medium leading-relaxed text-text">{{ item.question }}</span>
            <button v-if="isUserList" class="-mr-1 -mt-0.5 hidden h-5 w-5 shrink-0 place-items-center rounded text-text-3 transition-colors duration-100 hover:text-no group-hover/item:grid" :aria-label="`Remove ${item.question} from watchlist`" @click.prevent.stop="removeWatched(item.id)">
              <Icon name="lucide:x" class="h-3 w-3" />
            </button>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="item.pct !== null">
              <span v-if="item.outcome" class="min-w-0 flex-1 truncate text-[11px] font-medium text-text-2" :title="item.outcome">{{ item.outcome }}</span>
              <span class="font-mono shrink-0 text-xs font-semibold" :class="[pctClass(item.pct), { 'w-8': !item.outcome }]">{{ item.pct }}%</span>
              <div v-if="!item.outcome" class="h-0.5 flex-1 overflow-hidden rounded-sm bg-border-2">
                <div class="h-full" :class="barClass(item.pct)" :style="{ width: `${item.pct}%` }" />
              </div>
              <span class="font-mono shrink-0 text-[10.5px] font-medium" :class="deltaClass(item.delta ?? 0)">{{ fmtsp(item.delta ?? 0) }}</span>
            </template>
            <template v-else>
              <span class="font-mono w-8 shrink-0 text-xs font-semibold text-text-3">—</span>
              <div class="h-0.5 flex-1 rounded-sm bg-border-2" />
            </template>
          </div>
        </NuxtLink>
      </div>

      <div v-if="hasAccount() && openPositions.length" class="border-t border-border px-4 py-3">
        <span class="mb-2.5 block text-[10px] font-bold uppercase tracking-widest text-text-3">Open Positions</span>
        <NuxtLink v-for="pos in openPositions" :key="pos.key" :to="pos.url" class="mb-1.5 flex items-center justify-between gap-2 last:mb-0">
          <span class="truncate text-[11.5px] text-text-2 transition-colors duration-100 hover:text-white">{{ pos.name }}</span>
          <span class="font-mono shrink-0 text-[11.5px] font-semibold" :class="pos.pnl >= 0 ? 'text-yes' : 'text-no'">{{ money(pos.pnl) }}</span>
        </NuxtLink>
        <div class="mt-1.5 flex items-center justify-between border-t border-border pt-2">
          <span class="text-[11.5px] text-text-3">Total P&amp;L</span>
          <span class="font-mono text-[11.5px] font-semibold" :class="totalPnl >= 0 ? 'text-yes' : 'text-no'">{{ money(totalPnl) }}</span>
        </div>
      </div>
    </template>
  </aside>
</template>
