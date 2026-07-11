<script setup lang="ts">
import type { Outcome, OrderSide } from "~/types/account";
import type { GammaMarket, OrderbookLevel } from "~/types/gamma";
import type { BookLevelSelection } from "~/utils/markets";
import { TICK_TENTHS, tickLabel } from "~/utils/orderbook";
import { decimalcent } from "~/utils/prices";

const props = defineProps<{
  market: GammaMarket;
  expanded: boolean;
  activeTab: "orderbook" | "graph" | "resolution";
  isSingleMarket: boolean;
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

const emit = defineEmits<{
  "update:activeTab": [value: "orderbook" | "graph" | "resolution"];
  "update:selectedOutcome": [value: Outcome];
  "level-click": [payload: { side: BookLevelSelection["side"]; level: OrderbookLevel }];
  "cancel-order": [id: string];
  refresh: [];
}>();

const tabClass = (cur: string, tab: "orderbook" | "graph" | "resolution") => ["pm-focus text-[11px] font-bold uppercase tracking-widest transition-colors duration-150", cur === tab ? "text-white" : "text-text-3 hover:text-text-2"];
const chartMode = ref<"simple" | "advanced">("simple");
const tickTenths = ref(1);
const hasDecimalBook = computed(() => decimalcent([...props.displayedAsks, ...props.displayedBids]));
watch(hasDecimalBook, (d) => {
  if (!d) tickTenths.value = 1;
});
const cycleTick = () => {
  const i = TICK_TENTHS.indexOf(tickTenths.value as (typeof TICK_TENTHS)[number]);
  tickTenths.value = TICK_TENTHS[(i + 1) % TICK_TENTHS.length]!;
};
</script>

<template>
  <Transition name="orderbook-expand">
    <section v-if="expanded" class="border-b border-border m-0 overflow-hidden">
      <div class="flex items-center gap-5 border-b border-border px-4 py-3 max-[900px]:flex-wrap max-[900px]:gap-3">
        <template v-if="isSingleMarket">
          <span class="text-[11px] font-bold uppercase tracking-widest text-white">Order Book</span>
          <span class="h-3 w-px bg-border" />
          <div class="flex items-center gap-3">
            <button class="pm-focus text-[11px] font-bold uppercase tracking-widest transition-colors duration-150" :class="selectedOutcome === 'yes' ? 'text-yes' : 'text-text-3 hover:text-text-2'" @click="emit('update:selectedOutcome', 'yes')">{{ outcomeLabels[0] }}</button>
            <button class="pm-focus text-[11px] font-bold uppercase tracking-widest transition-colors duration-150" :class="selectedOutcome === 'no' ? 'text-no' : 'text-text-3 hover:text-text-2'" @click="emit('update:selectedOutcome', 'no')">{{ outcomeLabels[1] }}</button>
          </div>
        </template>
        <template v-else>
          <button :class="tabClass(activeTab, 'orderbook')" @click="emit('update:activeTab', 'orderbook')">Order Book</button>
          <button :class="tabClass(activeTab, 'graph')" @click="emit('update:activeTab', 'graph')">Graph</button>
          <button :class="tabClass(activeTab, 'resolution')" @click="emit('update:activeTab', 'resolution')">About</button>
        </template>
        <div class="flex-1" />
        <div v-if="isSingleMarket || activeTab === 'orderbook'" class="flex items-center gap-2.5">
          <button class="text-text-3 transition-colors duration-150 hover:text-white" aria-label="Refresh order book" @click="emit('refresh')">
            <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
          </button>
          <button
            v-if="hasDecimalBook"
            class="pm-focus font-mono flex h-5.5 w-11 items-center justify-center overflow-hidden rounded-md border px-2 text-[11px] font-semibold tabular-nums transition-colors duration-150"
            :class="tickTenths > 1 ? 'border-border-hover text-white' : 'border-border text-text-2 hover:border-border-hover hover:text-white'"
            title="Order book tick size — click to change"
            @click="cycleTick"
          >
            <Transition name="tick-swap" mode="out-in">
              <span :key="tickTenths">{{ tickLabel(tickTenths) }}</span>
            </Transition>
          </button>
        </div>
      </div>

      <Transition name="market-tab" mode="out-in">
        <div v-if="isSingleMarket || activeTab === 'orderbook'" key="orderbook" class="min-h-104.5">
          <EventMarketOrderbook
            :loading="orderbookLoading"
            :error="orderbookError"
            :has-liquidity="hasOrderbookLiquidity"
            :asks="displayedAsks"
            :bids="displayedBids"
            :is-single-market="isSingleMarket"
            :selected-outcome="selectedOutcome"
            :outcome-labels="outcomeLabels"
            :selected-outcome-label="selectedOutcomeLabel"
            :spread="orderbookSpread"
            :last-price="lastOrderbookPrice"
            :user-orders="userOrders"
            :active="activeTab === 'orderbook'"
            :tick-tenths="tickTenths"
            @update:selected-outcome="emit('update:selectedOutcome', $event)"
            @level-click="emit('level-click', $event)"
            @cancel-order="emit('cancel-order', $event)"
          />
        </div>

        <div v-else-if="activeTab === 'graph'" key="graph" class="min-h-80 px-4 pt-4.5 pb-5.5">
          <div class="mb-3 flex justify-end">
            <ChartModeToggle v-model="chartMode" />
          </div>
          <Transition name="market-tab" mode="out-in">
            <PriceChart v-if="chartMode === 'simple'" key="line" :tokens="chartTokens" :outcome-title="selectedOutcomeLabel" />
            <AdvancedPriceChart v-else key="candle" :tokens="chartTokens" :outcome-title="selectedOutcomeLabel" />
          </Transition>
        </div>

        <div v-else key="resolution" class="min-h-60 px-4 pt-4.5 pb-6">
          <EventMarketAbout :market="market" :resolution-source="resolutionSource" />
        </div>
      </Transition>
    </section>
  </Transition>
</template>

<style scoped>
.tick-swap-enter-active,
.tick-swap-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}
.tick-swap-enter-from {
  opacity: 0;
  transform: translateY(70%);
}
.tick-swap-leave-to {
  opacity: 0;
  transform: translateY(-70%);
}

@media (prefers-reduced-motion: reduce) {
  .tick-swap-enter-active,
  .tick-swap-leave-active {
    transition: none;
  }
}

.orderbook-expand-enter-active {
  transition:
    max-height 0.32s cubic-bezier(0.34, 1.32, 0.64, 1),
    opacity 0.22s ease-out,
    transform 0.32s cubic-bezier(0.34, 1.32, 0.64, 1);
  overflow: hidden;
}

.orderbook-expand-leave-active {
  transition:
    max-height 0.24s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease-out,
    transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.orderbook-expand-enter-from,
.orderbook-expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.orderbook-expand-enter-to,
.orderbook-expand-leave-from {
  max-height: 640px;
  opacity: 1;
  transform: translateY(0) scale(1);
}

.market-tab-enter-active,
.market-tab-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.market-tab-enter-from,
.market-tab-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
