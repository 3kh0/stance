<script setup lang="ts">
import type { Outcome, OrderSide } from "~/types/account";
import EventSportsLineSlider from "~/components/event/SportsLineSlider.vue";
import type { EventTeam, GammaMarket, OrderbookLevel } from "~/types/gamma";
import { chancePct, parseOutcomePrices } from "~/utils/markets";
import { marketTickCents, snapDisplayPrice } from "~/utils/quotes";
import { fmtcp, fmtcn, fmtn, tickDecimals } from "~/utils/prices";
import { marketAtLine, parseMarketOutcomes, sportsDisplayPrice, sportsMarketSideColors, sportsOutcomeColor, sportsOutcomeLabels, sportsSliderLines, sportsSliderValue, teamAbbreviation, type SportsMarketGroup, type SportsMarketTab } from "~/utils/sports";
import type { BookLevelSelection } from "~/utils/markets";

interface MarketWithPrice extends GammaMarket {
  yesPrice: number;
}

const props = defineProps<{
  displayedMarkets: MarketWithPrice[];
  isSportsEvent: boolean;
  isSingleMarket: boolean;
  expandedMarketId: string | null;
  sportsTabs: SportsMarketTab[];
  activeSportsTabKey: string;
  sportsGroups: SportsMarketGroup<MarketWithPrice>[];
  teams: EventTeam[];
  livePrices?: Record<string, Partial<Record<Outcome, number>>>;
  hasMoreMarkets: boolean;
  showAllMarkets: boolean;
  activeMarketTab: "orderbook" | "graph" | "resolution";
  selectedOutcome: Outcome;
  outcomeLabels: [string, string];
  selectedOutcomeLabel: string;
  orderbookLoading: boolean;
  orderbookError: boolean;
  hasOrderbookLiquidity: boolean;
  displayedAsks: OrderbookLevel[];
  displayedBids: OrderbookLevel[];
  orderbookSpread: string | null;
  lastOrderbookPrice: string;
  userOrders: Array<{ id: string; side: OrderSide; price: number; shares: number; filled: number; total: number }>;
  chartTokens: Array<{ tokenId: string; label: string }>;
  resolutionSource?: string;
}>();

const showMarketIcons = computed(() => new Set(props.displayedMarkets.map((m) => m.icon).filter(Boolean)).size > 1);

const emit = defineEmits<{
  "select-sports-tab": [key: string];
  "toggle-market-panel": [market: GammaMarket];
  "select-market-and-outcome": [market: GammaMarket, outcome: Outcome];
  "select-sports-variant": [group: SportsMarketGroup<MarketWithPrice> | undefined, market: MarketWithPrice];
  "update:activeMarketTab": [value: "orderbook" | "graph" | "resolution"];
  "update:selectedOutcome": [value: Outcome];
  "level-click": [payload: { side: BookLevelSelection["side"]; level: OrderbookLevel }];
  "refresh-orderbook": [market: GammaMarket];
  "cancel-order": [id: string];
  "show-all": [];
  "hide-all": [];
}>();

const sportsGroupForMarket = (m: GammaMarket) => props.sportsGroups.find((g) => g.markets.some((c) => c.id === m.id));
const sportsRows = computed(() =>
  props.displayedMarkets.map((market, i) => {
    const group = sportsGroupForMarket(market);
    return {
      market,
      group,
      title: group?.title || market.groupItemTitle || market.question,
      volume: group ? groupVolume(group) : market.volumeNum || market.volume || 0,
      toAdvance: (market.sportsMarketType ?? "").includes("to_advance"),
      halfHeader: props.activeSportsTabKey === "halves" && group?.halfSection && (i === 0 || sportsGroupForMarket(props.displayedMarkets[i - 1]!)?.halfSection?.key !== group.halfSection.key) ? group.halfSection.label : "",
    };
  }),
);

const livePrice = (m: GammaMarket, side: Outcome) => props.livePrices?.[m.id]?.[side] ?? null;
const sidePrice = (m: GammaMarket, side: Outcome) => livePrice(m, side) ?? (props.isSportsEvent ? sportsDisplayPrice(m, side) : null) ?? snapDisplayPrice(parseOutcomePrices(m)[side], m);
const yesPrice = (m: GammaMarket) => sidePrice(m, "yes");
const noPrice = (m: GammaMarket) => sidePrice(m, "no");
const priceCents = (price: number) => Math.round(price * 10000) / 100;
const marketDecimals = (m: GammaMarket) => Math.max(1, tickDecimals(marketTickCents(m)));

const groupVolume = (group: SportsMarketGroup<MarketWithPrice>) => group.markets.reduce((sum, m) => sum + Number(m.volumeNum ?? m.volume ?? 0), 0);

function ternaryOutcomes(group: SportsMarketGroup<MarketWithPrice>) {
  return group.markets
    .map((market) => {
      const label = market.groupItemTitle || parseMarketOutcomes(market)[0];
      const isDraw = /draw/i.test(label);
      return {
        market,
        label,
        abbrev: isDraw ? "DRAW" : teamAbbreviation(label, props.teams),
        price: yesPrice(market),
        isDraw,
        color: isDraw ? undefined : sportsOutcomeColor(label, props.teams),
      };
    })
    .sort((a, b) => b.price - a.price);
}

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
};
const teamStyle = (c: string | undefined) => (c ? { backgroundColor: hexToRgba(c, 0.14), borderColor: hexToRgba(c, 0.42) } : undefined);
const outcomeClass = (c: string | undefined, tone: Outcome) => (c ? "text-white hover:brightness-125" : tone === "yes" ? "border-yes/20 bg-yes-bg text-yes hover:bg-yes-hover" : "border-no/15 bg-no-bg text-no hover:bg-no-hover");
const sideColors = (m: GammaMarket) => (props.isSportsEvent ? sportsMarketSideColors(m, props.teams) : {});

const ledgerLabels = (m: GammaMarket): [string, string] => {
  const base = sportsOutcomeLabels(m, props.teams) as [string, string];
  const [a, b] = parseMarketOutcomes(m);
  const title = (m.groupItemTitle ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (m.sportsMarketType === "moneyline" && /^yes$/i.test(a ?? "") && /^no$/i.test(b ?? "") && title) {
    const abbrev = teamAbbreviation(title, props.teams);
    return [`${abbrev} ${base[0]}`, `${abbrev} ${base[1]}`];
  }
  return base;
};

const activeLineForGroup = (g: SportsMarketGroup<MarketWithPrice>, m: MarketWithPrice) => sportsSliderValue(m, g.markets, props.teams);
</script>

<template>
  <div class="pm-spring-in mt-0 border-t border-border" style="--pm-spring-delay: 160ms">
    <nav v-if="isSportsEvent && sportsTabs.length > 0" class="flex gap-5 overflow-x-auto border-b border-border py-3" aria-label="Sports market categories">
      <button v-for="tab in sportsTabs" :key="tab.key" class="pm-focus shrink-0 text-[12px] font-bold transition-colors duration-150" :class="activeSportsTabKey === tab.key ? 'text-white' : 'text-text-3 hover:text-text-2'" @click="emit('select-sports-tab', tab.key)">
        {{ tab.label }}
      </button>
    </nav>

    <template v-if="isSportsEvent">
      <template v-for="{ market, group, title, volume, halfHeader, toAdvance } in sportsRows" :key="market.id">
        <h3 v-if="halfHeader" class="mb-2 mt-5 text-[15px] font-bold text-white">
          {{ halfHeader }}
        </h3>
        <article class="my-3 overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-150 hover:border-border-2" :class="{ 'border-border-2': expandedMarketId === market.id }">
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(260px,44%)] items-center gap-4 px-4 py-4 max-[760px]:grid-cols-1 max-[760px]:gap-3">
            <button class="pm-focus min-w-0 text-left" @click="emit('toggle-market-panel', market)">
              <div class="flex items-center gap-2">
                <span class="text-[14px] font-bold leading-5 text-white">{{ title }}</span>
                <span v-if="toAdvance" class="inline-flex cursor-help items-center text-text-3" title="This market refers to the final outcome of the match, including extra time and penalty shootouts">
                  <Icon name="lucide:info" class="h-3.5 w-3.5" />
                </span>
                <span v-else class="cursor-help text-[10px] font-bold uppercase tracking-widest text-text-3" title="This market refers only to the outcome within the first 90 minutes of regular play plus stoppage time">Reg Time</span>
              </div>
              <div class="font-mono mt-1 text-[10.5px] font-medium uppercase tracking-wide text-text-3">${{ fmtcn(volume) }} Vol.</div>
            </button>

            <div v-if="group?.layout === 'ternary'" class="grid grid-cols-3 gap-2">
              <button
                v-for="(outcome, i) in ternaryOutcomes(group)"
                :key="outcome.market.id"
                class="pm-focus font-mono flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-[background-color,border-color,filter] duration-150"
                :class="outcome.isDraw ? 'border-border bg-surface-2 text-text hover:border-border-2 hover:text-white' : outcome.color ? 'text-white hover:brightness-125' : i === 0 ? 'border-yes/20 bg-yes-bg text-yes hover:bg-yes-hover' : 'border-no/15 bg-no-bg text-no hover:bg-no-hover'"
                :style="teamStyle(outcome.color)"
                @click="emit('select-market-and-outcome', outcome.market, 'yes')"
              >
                <span class="font-sans font-bold">{{ outcome.abbrev }}</span>
                <NumericOdometer :value="priceCents(outcome.price)" :maximum-fraction-digits="marketDecimals(outcome.market)" suffix="¢" />
              </button>
            </div>

            <div v-else class="grid grid-cols-2 gap-2">
              <button
                class="pm-focus font-mono flex h-11 min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-xs font-semibold transition-[background-color,border-color,filter] duration-150"
                :class="outcomeClass(sideColors(market).yes, 'yes')"
                :style="teamStyle(sideColors(market).yes)"
                @click="emit('select-market-and-outcome', market, 'yes')"
              >
                <span class="truncate font-sans font-bold" :title="sportsOutcomeLabels(market, teams)[0]">{{ sportsOutcomeLabels(market, teams)[0] }}</span>
                <NumericOdometer class="shrink-0" :value="priceCents(yesPrice(market))" :maximum-fraction-digits="marketDecimals(market)" suffix="¢" />
              </button>
              <button
                class="pm-focus font-mono flex h-11 min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-xs font-semibold transition-[background-color,border-color,filter] duration-150"
                :class="outcomeClass(sideColors(market).no, 'no')"
                :style="teamStyle(sideColors(market).no)"
                @click="emit('select-market-and-outcome', market, 'no')"
              >
                <span class="truncate font-sans font-bold" :title="sportsOutcomeLabels(market, teams)[1]">{{ sportsOutcomeLabels(market, teams)[1] }}</span>
                <NumericOdometer class="shrink-0" :value="priceCents(noPrice(market))" :maximum-fraction-digits="marketDecimals(market)" suffix="¢" />
              </button>
            </div>
          </div>

          <EventSportsLineSlider
            v-if="(group?.markets.length || 0) > 1 && group?.layout !== 'ternary'"
            :lines="sportsSliderLines(group?.markets || [], teams)"
            :active-line="activeLineForGroup(group!, market)"
            @select="
              (line) => {
                const next = group ? marketAtLine(group.markets, line, teams) : undefined;
                if (next) emit('select-sports-variant', group, next as MarketWithPrice);
              }
            "
          />

          <EventMarketPanel
            :market="market"
            :expanded="expandedMarketId === market.id"
            :active-tab="activeMarketTab"
            :is-single-market="isSingleMarket"
            :selected-outcome="selectedOutcome"
            :outcome-labels="outcomeLabels"
            :selected-outcome-label="selectedOutcomeLabel"
            :orderbook-loading="orderbookLoading"
            :orderbook-error="orderbookError"
            :has-orderbook-liquidity="hasOrderbookLiquidity"
            :displayed-asks="displayedAsks"
            :displayed-bids="displayedBids"
            :orderbook-spread="orderbookSpread"
            :last-orderbook-price="lastOrderbookPrice"
            :user-orders="userOrders"
            :chart-tokens="chartTokens"
            :resolution-source="resolutionSource"
            @update:active-tab="emit('update:activeMarketTab', $event)"
            @update:selected-outcome="emit('update:selectedOutcome', $event)"
            @level-click="emit('level-click', $event)"
            @cancel-order="emit('cancel-order', $event)"
            @refresh="emit('refresh-orderbook', market)"
          />

          <EventMarketLedger :market="market" :markets="group?.markets" :outcome-labels="ledgerLabels(market)" :labels-for="ledgerLabels" :colors-for="sideColors" :type-label="title" :current-prices="livePrices?.[market.id]" :current-prices-by-market="livePrices" :outcome-colors="sideColors(market)" />
        </article>
      </template>
    </template>

    <template v-else>
      <template v-for="market in displayedMarkets" :key="market.id">
        <div
          v-if="!isSingleMarket"
          class="grid min-h-14 cursor-pointer grid-cols-[minmax(0,1fr)_80px_232px] items-center gap-4 border-b border-border py-2.5 transition-colors duration-100 hover:bg-surface max-[900px]:grid-cols-1"
          :class="{ 'bg-surface': expandedMarketId === market.id }"
          @click="emit('toggle-market-panel', market)"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <MarketIcon v-if="showMarketIcons && market.icon" :src="market.icon" :alt="market.groupItemTitle || market.question" class="h-8 w-8 shrink-0 rounded-md border border-border bg-surface-2 object-cover" />
            <div class="min-w-0">
              <div class="truncate text-[13px] font-semibold leading-5 text-text">{{ market.groupItemTitle || market.question }}</div>
              <div class="font-mono text-[10.5px] font-medium text-text-3">VOL ${{ fmtn(market.volumeNum || market.volume || 0) }}</div>
            </div>
          </div>
          <div class="font-mono text-right text-[22px] font-semibold leading-8 max-[900px]:text-left"><PercentOdometer :value="chancePct(market)" /></div>
          <div class="grid grid-cols-2 justify-end gap-1.5 max-[900px]:w-full">
            <button class="font-mono h-9 rounded-md border border-yes/20 bg-yes-bg px-2 text-xs font-semibold text-yes transition-colors duration-150 hover:bg-yes-hover" @click.stop="emit('select-market-and-outcome', market, 'yes')">YES {{ fmtcp(yesPrice(market)) }}</button>
            <button class="font-mono h-9 rounded-md border border-no/15 bg-no-bg px-2 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover" @click.stop="emit('select-market-and-outcome', market, 'no')">NO {{ fmtcp(noPrice(market)) }}</button>
          </div>
        </div>

        <EventMarketPanel
          :market="market"
          :expanded="expandedMarketId === market.id"
          :active-tab="activeMarketTab"
          :is-single-market="isSingleMarket"
          :selected-outcome="selectedOutcome"
          :outcome-labels="outcomeLabels"
          :selected-outcome-label="selectedOutcomeLabel"
          :orderbook-loading="orderbookLoading"
          :orderbook-error="orderbookError"
          :has-orderbook-liquidity="hasOrderbookLiquidity"
          :displayed-asks="displayedAsks"
          :displayed-bids="displayedBids"
          :orderbook-spread="orderbookSpread"
          :last-orderbook-price="lastOrderbookPrice"
          :user-orders="userOrders"
          :chart-tokens="chartTokens"
          :resolution-source="resolutionSource"
          @update:active-tab="emit('update:activeMarketTab', $event)"
          @update:selected-outcome="emit('update:selectedOutcome', $event)"
          @level-click="emit('level-click', $event)"
          @cancel-order="emit('cancel-order', $event)"
          @refresh="emit('refresh-orderbook', market)"
        />
      </template>
    </template>

    <button v-if="hasMoreMarkets && !showAllMarkets" class="pm-focus mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-text-3 transition-colors duration-150 hover:text-text-2" @click="emit('show-all')">
      <span>View more</span>
      <Icon name="lucide:chevron-down" class="h-3 w-3" />
    </button>
    <button v-if="hasMoreMarkets && showAllMarkets" class="pm-focus mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-text-3 transition-colors duration-150 hover:text-text-2" @click="emit('hide-all')">
      <span>Hide more</span>
      <Icon name="lucide:chevron-down" class="w-4 h-4 rotate-180" />
    </button>
  </div>
</template>
