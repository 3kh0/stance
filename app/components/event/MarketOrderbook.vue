<script setup lang="ts">
import type { Outcome, OrderSide } from "~/types/account";
import type { OrderbookLevel } from "~/types/gamma";
import type { BookLevelSelection } from "~/utils/markets";
import { groupByTick } from "~/utils/orderbook";
import { fmtm, fmtClob, decimalcent } from "~/utils/prices";

const props = defineProps<{
  loading: boolean;
  error: boolean;
  hasLiquidity: boolean;
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  isSingleMarket: boolean;
  selectedOutcome: Outcome;
  outcomeLabels: [string, string];
  selectedOutcomeLabel: string;
  spread: string | null;
  lastPrice: string;
  userOrders: Array<{ id: string; side: OrderSide; price: number; shares: number; filled: number; total: number }>;
  active: boolean;
  tickTenths?: number;
  skeletonWidths?: string[];
}>();

type UserOrder = (typeof props.userOrders)[number];

const emit = defineEmits<{
  "update:selectedOutcome": [value: Outcome];
  "level-click": [payload: { side: BookLevelSelection["side"]; level: OrderbookLevel }];
  "cancel-order": [id: string];
  refresh: [];
}>();

const skeletonWidths = computed(() => props.skeletonWidths ?? ["68%", "52%", "41%", "30%", "22%", "14%"]);
const scrollRef = ref<HTMLElement | null>(null);

const tick = computed(() => props.tickTenths ?? 1);
const displayAsks = computed(() => groupByTick(props.asks, tick.value, true));
const displayBids = computed(() => groupByTick(props.bids, tick.value, false));
const hasDecimalPrice = computed(() => decimalcent([...displayAsks.value, ...displayBids.value]));
const maxSize = computed(() => Math.max(...displayAsks.value.map((a) => a.cumulativeTotal), ...displayBids.value.map((b) => b.cumulativeTotal), 1));

const bookPrice = (p: number) => fmtClob(p, hasDecimalPrice.value);
const fmts = (n: number) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const depthWidth = (l: OrderbookLevel) => `${Math.min((l.cumulativeTotal / maxSize.value) * 100, 100)}%`;

const orderAt = (price: number, side: "ask" | "bid") => props.userOrders.find((o) => o.side === (side === "ask" ? "sell" : "buy") && Math.abs(o.price - price) < 0.0005) ?? null;
const askRows = computed(() => displayAsks.value.map((level) => ({ level, order: orderAt(level.price, "ask") })));
const bidRows = computed(() => displayBids.value.map((level) => ({ level, order: orderAt(level.price, "bid") })));

const POP_W = 232;
interface MarkerPopover {
  id: string;
  filled: number;
  total: number;
  remaining: number;
  x: number;
  y: number;
}
const pop = ref<MarkerPopover | null>(null);
let popTimer: ReturnType<typeof setTimeout> | undefined;

const fmtCount = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};
const popPercent = computed(() => (pop.value && pop.value.total > 0 ? Math.min((pop.value.filled / pop.value.total) * 100, 100) : 0));
const popStyle = computed(() => {
  if (!pop.value) return {};
  const left = pop.value.x - POP_W - 10;
  return { left: `${left >= 8 ? left : pop.value.x + 18}px`, top: `${pop.value.y}px`, width: `${POP_W}px` };
});

function openPop(e: MouseEvent, o: UserOrder) {
  clearTimeout(popTimer);
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  pop.value = { id: o.id, filled: o.filled, total: o.total, remaining: Math.max(o.total - o.filled, 0), x: r.left, y: r.top + r.height / 2 };
}
const scheduleClose = () => {
  clearTimeout(popTimer);
  popTimer = setTimeout(() => (pop.value = null), 140);
};
const keepPop = () => clearTimeout(popTimer);
const closePop = () => {
  clearTimeout(popTimer);
  pop.value = null;
};
function cancelOrder(o: UserOrder) {
  emit("cancel-order", o.id);
  pop.value = null;
}

function scrollToSpread() {
  const el = scrollRef.value;
  if (el) el.scrollTop = displayAsks.value.length * 36 + 20 - el.clientHeight / 2;
}

async function centerAfterRender() {
  await nextTick();
  if (typeof window !== "undefined") {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  scrollToSpread();
}

watch(
  () => [props.loading, props.active, props.hasLiquidity, displayAsks.value.length, displayBids.value.length, props.selectedOutcome, props.tickTenths].join(":"),
  async () => {
    if (props.active && !props.loading && props.hasLiquidity) await centerAfterRender();
  },
  { flush: "post" },
);

defineExpose({ centerAfterRender, scrollToSpread });
</script>

<template>
  <div>
    <div class="relative min-h-104.5">
      <div v-if="loading" class="orderbook__skeleton" aria-hidden="true">
        <div class="orderbook__head h-9 items-center border-b border-border">
          <span class="pm-skel ml-1 h-2.5 w-20 rounded-sm" />
          <span class="pm-skel mx-auto h-2.5 w-9 rounded-sm" />
          <span class="pm-skel ml-auto h-2.5 w-11 rounded-sm" />
          <span class="pm-skel ml-auto h-2.5 w-10 rounded-sm" />
        </div>
        <div class="max-h-95.5 overflow-hidden">
          <div>
            <div v-for="n in 5" :key="`sk-ask-${n}`" class="orderbook__row relative h-9 items-center border-b border-border">
              <div class="relative h-full">
                <div class="orderbook__bar orderbook__bar--ask absolute inset-y-0 left-0" :style="{ width: skeletonWidths[n - 1] }" />
              </div>
              <span class="pm-skel mx-auto h-3 w-10 rounded-sm" />
              <span class="pm-skel ml-auto h-3 w-12 rounded-sm" />
              <span class="pm-skel ml-auto h-3 w-14 rounded-sm" />
            </div>
          </div>
          <div class="grid h-10 grid-cols-3 items-center border-y border-border-2 bg-surface px-1">
            <span class="pm-skel h-3 w-16 rounded-sm" />
            <span class="pm-skel mx-auto h-3 w-16 rounded-sm" />
            <span />
          </div>
          <div>
            <div v-for="n in 6" :key="`sk-bid-${n}`" class="orderbook__row relative h-9 items-center border-b border-border">
              <div class="relative h-full">
                <div class="orderbook__bar orderbook__bar--bid absolute inset-y-0 left-0" :style="{ width: skeletonWidths[6 - n] }" />
              </div>
              <span class="pm-skel mx-auto h-3 w-10 rounded-sm" />
              <span class="pm-skel ml-auto h-3 w-12 rounded-sm" />
              <span class="pm-skel ml-auto h-3 w-14 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="error" class="flex min-h-104.5 items-center justify-center text-(--text-muted) text-sm">Order book unavailable</div>
      <div v-else-if="!hasLiquidity" class="flex min-h-104.5 items-center justify-center text-(--text-muted) text-sm">No limit orders near market price</div>
      <template v-else>
        <div class="orderbook__head h-9 items-center border-b border-border text-[10px] font-bold uppercase tracking-widest text-text-3">
          <div class="truncate pl-1">{{ isSingleMarket ? "" : `Trade ${selectedOutcomeLabel}` }}</div>
          <div class="text-center">Price</div>
          <div class="text-right">Shares</div>
          <div class="text-right">Total</div>
        </div>

        <div ref="scrollRef" class="orderbook__scroll relative max-h-95.5 overflow-y-auto overscroll-contain" @scroll.passive="closePop">
          <Transition name="ob-tick">
            <div :key="tick">
              <div>
                <button
                  v-for="{ level: ask, order } in askRows"
                  :key="`ask-${ask.price}`"
                  type="button"
                  class="orderbook__row pm-focus relative h-9 w-full items-center border-b border-border text-left transition-colors duration-150 hover:bg-surface-2"
                  :class="{ 'bg-surface-2': order }"
                  :aria-label="`Buy at ${bookPrice(ask.price)}, ${fmts(ask.size)} shares available`"
                  @click="emit('level-click', { side: 'ask', level: ask })"
                >
                  <div class="relative h-full">
                    <div class="orderbook__bar orderbook__bar--ask absolute inset-y-0 left-0 min-w-0.5" :style="{ width: depthWidth(ask) }" />
                    <span v-if="ask.isEdge" class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-no">Asks</span>
                    <span v-else-if="order" class="ob-marker absolute right-1.5 top-1/2 z-2 -translate-y-1/2" aria-label="Cancel your resting order" @click.stop="cancelOrder(order)" @mouseenter="openPop($event, order)" @mouseleave="scheduleClose">
                      <span class="ob-marker__face text-no" :class="{ 'is-hidden': pop?.id === order.id }"><Icon name="lucide:clock" class="h-3.5 w-3.5" /></span>
                      <span class="ob-marker__face ob-marker__x" :class="{ 'is-shown': pop?.id === order.id }"
                        ><span class="grid h-4.5 w-4.5 place-items-center rounded-full bg-yes text-black"><Icon name="lucide:x" class="h-3 w-3" /></span
                      ></span>
                    </span>
                  </div>
                  <div class="font-mono relative z-1 text-center text-[13px] font-semibold text-no">{{ bookPrice(ask.price) }}</div>
                  <div class="font-mono relative z-1 text-right text-xs tabular-nums text-text-2">{{ fmts(ask.size) }}</div>
                  <div class="font-mono relative z-1 text-right text-xs tabular-nums text-text-2">${{ fmtm(ask.cumulativeTotal) }}</div>
                </button>
              </div>

              <div class="font-mono grid h-10 grid-cols-3 items-center border-y border-border-2 bg-surface text-xs font-semibold tabular-nums text-text-2">
                <span class="pl-1">Last {{ lastPrice }}</span>
                <span class="text-center">Spread {{ spread }}</span>
                <span />
              </div>

              <div>
                <button
                  v-for="{ level: bid, order } in bidRows"
                  :key="`bid-${bid.price}`"
                  type="button"
                  class="orderbook__row pm-focus relative h-9 w-full items-center border-b border-border text-left transition-colors duration-150 hover:bg-surface-2"
                  :class="{ 'bg-surface-2': order }"
                  :aria-label="`Sell at ${bookPrice(bid.price)}, ${fmts(bid.size)} shares wanted`"
                  @click="emit('level-click', { side: 'bid', level: bid })"
                >
                  <div class="relative h-full">
                    <div class="orderbook__bar orderbook__bar--bid absolute inset-y-0 left-0 min-w-0.5" :style="{ width: depthWidth(bid) }" />
                    <span v-if="bid.isEdge" class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-yes">Bids</span>
                    <span v-else-if="order" class="ob-marker absolute right-1.5 top-1/2 z-2 -translate-y-1/2" aria-label="Cancel your resting order" @click.stop="cancelOrder(order)" @mouseenter="openPop($event, order)" @mouseleave="scheduleClose">
                      <span class="ob-marker__face text-yes" :class="{ 'is-hidden': pop?.id === order.id }"><Icon name="lucide:clock" class="h-3.5 w-3.5" /></span>
                      <span class="ob-marker__face ob-marker__x" :class="{ 'is-shown': pop?.id === order.id }"
                        ><span class="grid h-4.5 w-4.5 place-items-center rounded-full bg-yes text-black"><Icon name="lucide:x" class="h-3 w-3" /></span
                      ></span>
                    </span>
                  </div>
                  <div class="font-mono relative z-1 text-center text-[13px] font-semibold text-yes">{{ bookPrice(bid.price) }}</div>
                  <div class="font-mono relative z-1 text-right text-xs tabular-nums text-text-2">{{ fmts(bid.size) }}</div>
                  <div class="font-mono relative z-1 text-right text-xs tabular-nums text-text-2">${{ fmtm(bid.cumulativeTotal) }}</div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="ob-pop">
        <div v-if="pop" class="ob-pop fixed z-60 rounded-lg border border-border-2 bg-surface px-3 py-2.5 shadow-xl" :style="popStyle" @mouseenter="keepPop" @mouseleave="scheduleClose">
          <div class="flex items-center justify-between gap-4">
            <span class="text-xs font-semibold text-white">Filled</span>
            <span class="font-mono text-xs font-semibold text-white">{{ fmtCount(pop.filled) }} / {{ fmtCount(pop.total) }}</span>
          </div>
          <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div class="ob-pop__bar h-full w-full origin-left rounded-full bg-yes" :style="{ transform: `scaleX(${popPercent / 100})` }" />
          </div>
          <div class="font-mono mt-1.5 text-[10.5px] text-text-3">{{ fmtCount(pop.remaining) }} remaining</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ob-marker {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.ob-marker__face {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.ob-marker__face.is-hidden {
  opacity: 0;
  transform: scale(0.5);
  pointer-events: none;
}
.ob-marker__x {
  opacity: 0;
  transform: scale(0.5);
  pointer-events: none;
}
.ob-marker__x.is-shown {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.ob-pop {
  transform: translateY(-50%);
  transform-origin: right center;
}
.ob-pop-enter-active,
.ob-pop-leave-active {
  transition:
    opacity 0.16s cubic-bezier(0.215, 0.61, 0.355, 1),
    transform 0.16s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.ob-pop-enter-from,
.ob-pop-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.96);
}
.ob-pop__bar {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .ob-marker__face,
  .ob-pop-enter-active,
  .ob-pop-leave-active,
  .ob-pop__bar {
    transition: none;
  }
}

.orderbook__head,
.orderbook__row {
  display: grid;
  grid-template-columns: minmax(170px, 44%) minmax(90px, 16%) minmax(110px, 18%) minmax(130px, 22%);
}

.ob-tick-enter-active,
.ob-tick-leave-active {
  transition: opacity 0.26s ease;
}
.ob-tick-leave-active {
  position: absolute;
  inset: 0 0 auto 0;
  width: 100%;
}
.ob-tick-enter-from,
.ob-tick-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ob-tick-enter-active,
  .ob-tick-leave-active {
    transition: none;
  }
}

@media (max-width: 900px) {
  .orderbook__head,
  .orderbook__row {
    grid-template-columns: minmax(90px, 30%) minmax(76px, 20%) minmax(90px, 25%) minmax(90px, 25%);
  }
}

.pm-skel {
  display: block;
  background: linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-border-hover) 37%, var(--color-surface-2) 63%);
  background-size: 400% 100%;
  animation: pm-skel-shimmer 1.4s ease-in-out infinite;
}

.orderbook__skeleton {
  animation: pm-skel-fade 0.2s ease-out;
}

@keyframes pm-skel-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

@keyframes pm-skel-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pm-skel {
    animation: none;
  }
}

.orderbook__scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-hover) transparent;
}

.orderbook__bar--ask {
  background: color-mix(in srgb, var(--color-no) 18%, transparent);
  border-left: 14px solid color-mix(in srgb, var(--color-no) 28%, transparent);
}

.orderbook__bar--bid {
  background: color-mix(in srgb, var(--color-yes) 18%, transparent);
  border-left: 14px solid color-mix(in srgb, var(--color-yes) 28%, transparent);
}
</style>
