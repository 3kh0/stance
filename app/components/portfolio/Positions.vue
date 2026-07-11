<script setup lang="ts">
import type { Position } from "~/composables/useAccount";
import type { GammaMarket } from "~/types/gamma";
import { parseOutcomePrices, positionCost, positionCurrentValue, positionPnl, positionPnlPercent } from "~/utils/markets";

interface PortfolioMarketRefresh {
  markets: Array<Pick<GammaMarket, "id" | "conditionId" | "question" | "icon" | "outcomePrices" | "events"> & { eventSlug?: string }>;
  failedIds: string[];
}

interface PositionRow {
  position: Position;
  title: string;
  icon?: string;
  eventSlug?: string;
  cost: number;
  maxPayout: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  avgCents: number;
  currentCents: number;
  stale: boolean;
}

const { account, isLiveAccount, updatePositionPrice, sellPosition, addTransaction } = useAccount();
const { syncLiveAccount, placeLiveOrder } = usePolymarket();
const LinkOrDiv = resolveComponent("NuxtLink");

const search = ref("");
const sortDirection = ref<"desc" | "asc">("desc");
const refreshing = ref(false);
const refreshError = ref("");
const staleMarketIds = ref(new Set<string>());
const marketMeta = ref<Record<string, { question?: string; icon?: string; eventSlug?: string }>>({});
const exitPosition = ref<Position | null>(null);
const exitPending = ref(false);
const exitError = ref<string | null>(null);

const GRID = "grid grid-cols-[minmax(220px,2.4fr)_minmax(104px,1fr)_minmax(76px,0.8fr)_minmax(76px,0.8fr)_minmax(124px,1.1fr)_64px] items-center gap-3";

const positionIds = computed(() => [...new Set(account.value.positions.map((p) => p.marketId))].sort());

const rows = computed<PositionRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  return account.value.positions
    .map((p) => {
      const m = marketMeta.value[p.marketId] || {};
      return {
        position: p,
        title: m.question || p.question || p.marketName.replace(/\s+-\s+(Yes|No)$/i, ""),
        icon: m.icon || p.marketIcon,
        eventSlug: m.eventSlug || p.marketSlug,
        cost: positionCost(p),
        maxPayout: p.shares,
        value: positionCurrentValue(p),
        pnl: positionPnl(p),
        pnlPercent: positionPnlPercent(p),
        avgCents: p.entryPrice * 100,
        currentCents: p.currentPrice * 100,
        stale: staleMarketIds.value.has(p.marketId),
      };
    })
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.position.outcome.includes(q))
    .sort((a, b) => (sortDirection.value === "desc" ? b.value - a.value : a.value - b.value));
});

const totalValue = computed(() => account.value.positions.reduce((s, p) => s + positionCurrentValue(p), 0));
const totalOpenPnl = computed(() => account.value.positions.reduce((s, p) => s + positionPnl(p), 0));
const hasPositions = computed(() => account.value.positions.length > 0);

onMounted(refreshPrices);
watch(() => positionIds.value.join(","), refreshPrices);

async function refreshPrices() {
  if (isLiveAccount.value) {
    refreshing.value = true;
    refreshError.value = "";
    try {
      await syncLiveAccount();
    } catch {
      refreshError.value = "Using last known prices";
    } finally {
      refreshing.value = false;
    }
    return;
  }

  const ids = positionIds.value;
  if (!ids.length) return;
  refreshing.value = true;
  refreshError.value = "";

  try {
    const data = await $fetch<PortfolioMarketRefresh>(`/api/portfolio/markets?ids=${encodeURIComponent(ids.join(","))}`);
    const nextMeta = { ...marketMeta.value };
    const stale = new Set(data.failedIds);
    const returned = new Set<string>();

    for (const market of data.markets) {
      const matchIds = [market.id, market.conditionId].filter((id): id is string => !!id);
      const { yes, no } = parseOutcomePrices(market);
      const meta = {
        question: market.question,
        icon: market.icon,
        eventSlug: market.eventSlug || market.events?.find((e) => typeof e.slug === "string" && e.slug.length > 0)?.slug,
      };
      for (const id of matchIds) {
        returned.add(id);
        nextMeta[id] = meta;
      }
      for (const p of account.value.positions.filter((x) => matchIds.includes(x.marketId))) {
        const price = p.outcome === "yes" ? yes : no;
        if (Number.isFinite(price) && price > 0) updatePositionPrice(p.marketId, p.outcome, price);
        else stale.add(p.marketId);
      }
    }
    for (const id of ids) if (!returned.has(id)) stale.add(id);
    marketMeta.value = nextMeta;
    staleMarketIds.value = stale;
  } catch {
    refreshError.value = "Using last known prices";
    staleMarketIds.value = new Set(ids);
  } finally {
    refreshing.value = false;
  }
}

const toggleValueSort = () => (sortDirection.value = sortDirection.value === "desc" ? "asc" : "desc");
const rowHref = (row: PositionRow) => (row.eventSlug ? `/event/${row.eventSlug}` : undefined);
const openExit = (p: Position) => {
  exitPosition.value = p;
  exitError.value = null;
};
const closeExit = () => {
  exitPosition.value = null;
  exitPending.value = false;
  exitError.value = null;
};

async function confirmExit(shares: number) {
  const p = exitPosition.value;
  if (!p) return;

  if (isLiveAccount.value) {
    if (!p.tokenId) {
      exitError.value = "This position can't be sold from here — open its market instead.";
      return;
    }
    exitPending.value = true;
    exitError.value = null;
    try {
      await placeLiveOrder({ tokenID: p.tokenId, side: "sell", amount: shares, negRisk: p.negRisk });
      addTransaction({
        type: "sell",
        marketId: p.marketSlug || p.marketId,
        marketName: p.question || p.marketName,
        marketIcon: p.marketIcon,
        question: p.question,
        outcome: p.outcome,
        shares,
        price: p.currentPrice,
        amount: Math.floor(shares * p.currentPrice * 100) / 100,
      });
      await syncLiveAccount().catch(() => {});
      closeExit();
    } catch (e) {
      exitError.value = e instanceof Error ? e.message : "Order failed. Please try again.";
    } finally {
      exitPending.value = false;
    }
    return;
  }

  sellPosition(p.marketId, p.outcome, shares, p.currentPrice, { marketName: p.marketName, marketSlug: p.marketSlug, marketIcon: p.marketIcon, question: p.question });
  closeExit();
}
</script>

<template>
  <section class="pm-panel overflow-hidden" aria-labelledby="portfolio-positions-title">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-border px-4 py-3">
      <div class="min-w-0">
        <h2 id="portfolio-positions-title" class="text-[13px] font-semibold leading-5 text-white">Open positions</h2>
        <p class="font-mono mt-0.5 flex items-baseline gap-1.5 text-[11px] leading-4 text-text-2">
          <NumericOdometer :value="totalValue" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
          <span class="font-sans font-medium text-text-3">value</span>
          <span class="whitespace-nowrap font-semibold" :class="totalOpenPnl >= 0 ? 'text-yes' : 'text-no'">{{ totalOpenPnl >= 0 ? "+" : "−" }}<NumericOdometer :value="Math.abs(totalOpenPnl)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
        </p>
      </div>
      <div class="ml-auto flex items-center gap-1.5 max-md:w-full">
        <label class="relative flex items-center max-md:flex-1">
          <Icon name="lucide:search" class="pointer-events-none absolute left-2.5 h-3 w-3 text-text-3" />
          <span class="sr-only">Search positions</span>
          <input v-model="search" type="search" placeholder="Search" class="pm-focus h-8 w-44 rounded-md border border-border bg-surface-2 pl-8 pr-2.5 text-base text-text transition-colors duration-150 placeholder:text-text-3 focus:border-border-2 max-md:w-full md:text-xs" />
        </label>
        <button
          type="button"
          class="pm-focus font-mono flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border px-2.5 text-[11px] font-medium text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white"
          :aria-pressed="sortDirection === 'asc'"
          @click="toggleValueSort"
        >
          Value {{ sortDirection === "desc" ? "↓" : "↑" }}
        </button>
      </div>
    </div>
    <div v-if="refreshing || refreshError" class="border-b border-border px-4 py-2 text-[10.5px] font-semibold leading-4" :class="refreshError ? 'text-(--market-warning)' : 'text-text-3'">
      {{ refreshing ? "Refreshing live prices..." : refreshError }}
    </div>
    <div v-if="!hasPositions" class="flex min-h-45 items-center justify-center px-6 py-12 text-center">
      <p class="text-sm leading-5 text-text-3">No open positions yet. Buy shares from a market to track them here.</p>
    </div>
    <div v-else-if="rows.length === 0" class="flex min-h-45 items-center justify-center px-6 py-12 text-center">
      <p class="text-sm leading-5 text-text-3">No positions match your search.</p>
    </div>
    <template v-else>
      <div class="max-md:hidden" role="table" aria-label="Open positions">
        <div :class="GRID" class="border-b border-border px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-text-3" role="row">
          <span role="columnheader">Market</span>
          <span role="columnheader">Avg → Now</span>
          <span role="columnheader" class="text-right">Cost</span>
          <span role="columnheader" class="text-right">To win</span>
          <button role="columnheader" type="button" class="pm-focus text-right uppercase tracking-widest text-inherit transition-colors duration-150 hover:text-text-2" @click="toggleValueSort">Value {{ sortDirection === "desc" ? "↓" : "↑" }}</button>
          <span role="columnheader" aria-label="Actions" />
        </div>
        <div v-for="row in rows" :key="row.position.positionKey" :class="GRID" class="border-b border-border px-4 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-2" role="row">
          <div class="min-w-0" role="cell">
            <component :is="rowHref(row) ? LinkOrDiv : 'div'" :to="rowHref(row)" class="group/pos flex min-w-0 items-center gap-2.5" :class="rowHref(row) ? 'pm-focus' : ''">
              <MarketIcon v-if="row.icon" :src="row.icon" :alt="row.title" class="h-8 w-8 shrink-0 rounded-md border border-border object-cover" />
              <span v-else class="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-text-3">
                <Icon name="lucide:trending-up" class="h-3.5 w-3.5" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-[12.5px] font-semibold leading-5 text-text" :class="rowHref(row) ? 'transition-colors duration-150 group-hover/pos:text-white' : ''" :title="row.title">{{ row.title }}</span>
                <span class="mt-0.5 flex items-center gap-1.5">
                  <span class="font-mono rounded-sm px-1.5 text-[10px] font-semibold leading-4" :class="row.position.outcome === 'yes' ? 'bg-yes-bg text-yes' : 'bg-no-bg text-no'">{{ row.position.outcome === "yes" ? "Yes" : "No" }}</span>
                  <span class="font-mono text-[10.5px] leading-4 text-text-3"><NumericOdometer :value="row.position.shares" :maximum-fraction-digits="2" /> sh</span>
                  <span v-if="row.stale" class="rounded-sm border border-[rgba(254,154,0,0.25)] bg-[rgba(254,154,0,0.08)] px-1.5 text-[9px] font-bold uppercase tracking-widest leading-4 text-(--market-warning)">Stale</span>
                </span>
              </span>
            </component>
          </div>
          <div class="font-mono whitespace-nowrap text-xs font-semibold text-text" role="cell">
            <NumericOdometer :value="row.avgCents" :maximum-fraction-digits="1" suffix="¢" />
            <span class="mx-0.5 font-normal text-text-3">→</span>
            <NumericOdometer :value="row.currentCents" :maximum-fraction-digits="1" suffix="¢" />
          </div>
          <div class="font-mono whitespace-nowrap text-right text-xs text-text-2" role="cell">
            <NumericOdometer :value="row.cost" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
          </div>
          <div class="font-mono whitespace-nowrap text-right text-xs text-text-2" role="cell">
            <NumericOdometer :value="row.maxPayout" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
          </div>
          <div class="text-right" role="cell">
            <div class="font-mono whitespace-nowrap text-[13px] font-semibold leading-5 text-white">
              <NumericOdometer :value="row.value" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
            </div>
            <div class="font-mono whitespace-nowrap text-[10.5px] font-medium leading-4" :class="row.pnl >= 0 ? 'text-yes' : 'text-no'">
              {{ row.pnl >= 0 ? "+" : "−" }}<NumericOdometer :value="Math.abs(row.pnl)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
              <NumericOdometer :value="Math.abs(row.pnlPercent)" :maximum-fraction-digits="1" prefix="(" suffix="%)" />
            </div>
          </div>
          <div class="flex justify-end" role="cell">
            <button class="pm-focus h-7.5 rounded-md border border-no/15 bg-no-bg px-3 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover disabled:cursor-not-allowed disabled:opacity-40" type="button" :disabled="row.value <= 0" @click="openExit(row.position)">Sell</button>
          </div>
        </div>
      </div>
      <ul class="md:hidden" aria-label="Open positions">
        <li v-for="row in rows" :key="row.position.positionKey" class="border-b border-border px-4 py-3 last:border-b-0">
          <component :is="rowHref(row) ? LinkOrDiv : 'div'" :to="rowHref(row)" class="flex items-start gap-2.5" :class="rowHref(row) ? 'pm-focus' : ''">
            <MarketIcon v-if="row.icon" :src="row.icon" :alt="row.title" class="h-9 w-9 shrink-0 rounded-md border border-border object-cover" />
            <span v-else class="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-text-3">
              <Icon name="lucide:trending-up" class="h-4 w-4" />
            </span>
            <span class="min-w-0 flex-1 pt-px">
              <span class="line-clamp-2 text-[12.5px] font-semibold leading-snug text-text">{{ row.title }}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="font-mono block whitespace-nowrap text-[13px] font-semibold leading-5 text-white"><NumericOdometer :value="row.value" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
              <span class="font-mono block whitespace-nowrap text-[10.5px] font-medium leading-4" :class="row.pnl >= 0 ? 'text-yes' : 'text-no'">{{ row.pnl >= 0 ? "+" : "−" }}<NumericOdometer :value="Math.abs(row.pnl)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
            </span>
          </component>
          <div class="mt-2 flex items-center gap-2">
            <span class="font-mono rounded-sm px-1.5 text-[10px] font-semibold leading-4.5" :class="row.position.outcome === 'yes' ? 'bg-yes-bg text-yes' : 'bg-no-bg text-no'">{{ row.position.outcome === "yes" ? "Yes" : "No" }}</span>
            <span class="font-mono text-[10.5px] text-text-3"><NumericOdometer :value="row.position.shares" :maximum-fraction-digits="2" /> sh</span>
            <span class="font-mono whitespace-nowrap text-[10.5px] text-text-2"><NumericOdometer :value="row.avgCents" :maximum-fraction-digits="1" suffix="¢" /><span class="mx-0.5 text-text-3">→</span><NumericOdometer :value="row.currentCents" :maximum-fraction-digits="1" suffix="¢" /></span>
            <span v-if="row.stale" class="rounded-sm border border-[rgba(254,154,0,0.25)] bg-[rgba(254,154,0,0.08)] px-1.5 text-[9px] font-bold uppercase tracking-widest leading-4 text-(--market-warning)">Stale</span>
            <button class="pm-focus ml-auto h-7.5 rounded-md border border-no/15 bg-no-bg px-3.5 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover disabled:cursor-not-allowed disabled:opacity-40" type="button" :disabled="row.value <= 0" @click="openExit(row.position)">Sell</button>
          </div>
        </li>
      </ul>
    </template>

    <PortfolioExitModal :is-open="!!exitPosition" :position="exitPosition" :pending="exitPending" :error="exitError" :live="isLiveAccount" @close="closeExit" @confirm="confirmExit" />
  </section>
</template>
