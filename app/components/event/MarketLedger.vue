<script setup lang="ts">
import type { Outcome, OrderSide, Position } from "~/types/account";
import type { GammaMarket } from "~/types/gamma";
import { parseClobTokenIds, positionCost, positionCurrentValue, positionKey, positionPnl, positionPnlPercent } from "~/utils/markets";

const props = defineProps<{
  market: GammaMarket;
  outcomeLabels: [string, string];
  markets?: GammaMarket[];
  typeLabel?: string;
  currentPrices?: Partial<Record<Outcome, number>>;
  currentPricesByMarket?: Record<string, Partial<Record<Outcome, number>>>;
  outcomeColors?: Partial<Record<Outcome, string>>;
  labelsFor?: (market: GammaMarket) => [string, string];
  colorsFor?: (market: GammaMarket) => Partial<Record<Outcome, string>>;
}>();

const { account, isLiveAccount, cancelOpenOrder, sellPosition, addTransaction, updatePositionPrice } = useAccount();
const { cancelLiveOrder, placeLiveOrder, syncLiveAccount } = usePolymarket();
const { orders: liveOrders, refresh: refreshLive, start: startLiveOrders, stop: stopLiveOrders } = useLiveOpenOrders();

const ledgerMarkets = computed(() => (props.markets?.length ? props.markets : [props.market]));
const lookupIdFor = (m: GammaMarket) => (isLiveAccount.value ? m.conditionId || "" : m.id);
const labelsForMarket = (m: GammaMarket): [string, string] => props.labelsFor?.(m) ?? props.outcomeLabels;
const colorsForMarket = (m: GammaMarket): Partial<Record<Outcome, string>> => props.colorsFor?.(m) ?? props.outcomeColors ?? {};
const pricesForMarket = (m: GammaMarket) => props.currentPricesByMarket?.[m.id] ?? (m.id === props.market.id ? props.currentPrices : undefined);

interface PositionRow {
  market: GammaMarket;
  position: Position;
  side: Outcome;
  label: string;
  color?: string;
  shares: number;
  avgCents: number;
  currentCents: number;
  cost: number;
  value: number;
  toWin: number;
  pnl: number;
  pnlPercent: number;
}

const positionRows = computed<PositionRow[]>(() => {
  const rows: PositionRow[] = [];
  for (const market of ledgerMarkets.value) {
    const id = lookupIdFor(market);
    if (!id) continue;
    const labels = labelsForMarket(market),
      colors = colorsForMarket(market),
      prices = pricesForMarket(market);
    for (const side of ["yes", "no"] as const) {
      const pos = account.value.positions.find((p) => p.positionKey === positionKey(id, side));
      if (!pos || pos.shares <= 0.005) continue;
      const current = prices?.[side] ?? pos.currentPrice,
        v = { ...pos, currentPrice: current };
      rows.push({ market, position: pos, side, label: labels[side === "yes" ? 0 : 1], color: colors[side], shares: pos.shares, avgCents: pos.entryPrice * 100, currentCents: current * 100, cost: positionCost(v), value: positionCurrentValue(v), toWin: pos.shares, pnl: positionPnl(v), pnlPercent: positionPnlPercent(v) });
    }
  }
  return rows;
});

interface OrderRow {
  id: string;
  side: OrderSide;
  outcome: Outcome;
  label: string;
  color?: string;
  priceCents: number;
  filled: number;
  total: number;
  remaining: number;
  totalUsd: number;
}

const tokenIndex = computed(() => {
  const map = new Map<string, { outcome: Outcome; label: string; color?: string }>();
  for (const market of ledgerMarkets.value) {
    const labels = labelsForMarket(market),
      colors = colorsForMarket(market);
    parseClobTokenIds(market).forEach((token, i) => {
      const outcome: Outcome = i === 1 ? "no" : "yes";
      map.set(token, { outcome, label: labels[i === 1 ? 1 : 0], color: colors[outcome] });
    });
  }
  return map;
});

const groupMarketIds = computed(() => new Set(ledgerMarkets.value.map((m) => m.id)));

const orderRows = computed<OrderRow[]>(() => {
  if (isLiveAccount.value) {
    return liveOrders.value
      .map((o): OrderRow | null => {
        const meta = tokenIndex.value.get(o.asset_id);
        if (!meta) return null;
        const total = Number.parseFloat(o.original_size) || 0,
          filled = Number.parseFloat(o.size_matched) || 0,
          price = Number.parseFloat(o.price) || 0;
        return { id: o.id, side: (o.side?.toLowerCase() === "sell" ? "sell" : "buy") as OrderSide, outcome: meta.outcome, label: meta.label, color: meta.color, priceCents: price * 100, filled, total, remaining: Math.max(total - filled, 0), totalUsd: price * total };
      })
      .filter((o): o is OrderRow => o !== null && o.remaining > 0);
  }
  return account.value.openOrders
    .filter((o) => groupMarketIds.value.has(o.marketId))
    .map((o) => {
      const m = ledgerMarkets.value.find((x) => x.id === o.marketId) ?? props.market;
      return { id: o.id, side: o.side, outcome: o.outcome, label: labelsForMarket(m)[o.outcome === "yes" ? 0 : 1], color: colorsForMarket(m)[o.outcome], priceCents: o.price * 100, filled: 0, total: o.shares, remaining: o.shares, totalUsd: o.price * o.shares };
    });
});

const hasPositions = computed(() => positionRows.value.length > 0);
const hasOrders = computed(() => orderRows.value.length > 0);

const showPositions = ref(false);
const showOrders = ref(false);

const cancellingId = ref<string | null>(null);

async function cancel(id: string) {
  if (cancellingId.value) return;
  cancellingId.value = id;
  try {
    if (isLiveAccount.value) {
      await cancelLiveOrder(id);
      await refreshLive();
    } else cancelOpenOrder(id);
  } catch {
  } finally {
    cancellingId.value = null;
  }
}

async function cancelAll() {
  for (const o of orderRows.value) await cancel(o.id);
}

const exitPosition = ref<Position | null>(null);
const exitPending = ref(false);
const exitError = ref<string | null>(null);

function openExit(row: PositionRow) {
  const live = pricesForMarket(row.market)?.[row.side];
  if (live && live > 0) updatePositionPrice(row.position.marketId, row.side, live);
  exitPosition.value = account.value.positions.find((p) => p.positionKey === row.position.positionKey) ?? row.position;
  exitError.value = null;
}

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
      addTransaction({ type: "sell", marketId: p.marketSlug || p.marketId, marketName: p.question || p.marketName, marketIcon: p.marketIcon, question: p.question, outcome: p.outcome, shares, price: p.currentPrice, amount: Math.floor(shares * p.currentPrice * 100) / 100 });
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

onMounted(startLiveOrders);
onBeforeUnmount(stopLiveOrders);
watch(isLiveAccount, () => void refreshLive());

const POS_GRID = "grid grid-cols-[minmax(96px,1.3fr)_minmax(128px,1.6fr)_minmax(52px,0.7fr)_minmax(64px,0.8fr)_minmax(64px,0.8fr)_minmax(120px,1.3fr)_72px] items-center gap-3";
const ORD_GRID = "grid grid-cols-[minmax(52px,0.7fr)_minmax(128px,1.5fr)_minmax(52px,0.7fr)_minmax(84px,1fr)_minmax(72px,0.9fr)_minmax(108px,1.3fr)_40px] items-center gap-3";
</script>

<template>
  <div>
    <Transition name="ledger-section">
      <section v-if="hasPositions" class="border-t border-border">
        <button type="button" class="pm-focus flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left" :aria-expanded="showPositions" @click="showPositions = !showPositions">
          <span class="flex items-center gap-1.5 text-[13px] font-semibold text-white">
            Positions
            <Icon name="lucide:chevron-down" class="ledger-chevron h-3.5 w-3.5 text-text-3" :class="{ 'is-open': showPositions }" />
          </span>
          <Transition name="ledger-chips">
            <div v-if="!showPositions" class="flex min-w-0 flex-wrap justify-end gap-1.5">
              <span v-for="row in positionRows" :key="`pchip-${row.market.id}-${row.side}`" class="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] leading-4">
                <span v-if="row.color" class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: row.color }" />
                <span class="font-semibold text-text">{{ row.label }}</span>
                <span class="text-border-2">|</span>
                <span class="font-mono text-text-2"><NumericOdometer :value="row.shares" :maximum-fraction-digits="2" /> @ <NumericOdometer :value="row.avgCents" :minimum-fraction-digits="1" :maximum-fraction-digits="1" suffix="¢" /></span>
              </span>
            </div>
          </Transition>
        </button>

        <div class="ledger-collapse" :class="{ 'is-open': showPositions }">
          <div class="ledger-collapse__inner">
            <div class="overflow-x-auto border-t border-border">
              <div class="min-w-160">
                <div :class="POS_GRID" class="border-b border-border px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-text-3">
                  <span>Type</span>
                  <span>Outcome</span>
                  <span>Avg</span>
                  <span class="text-right">Cost</span>
                  <span class="text-right">To win</span>
                  <span class="text-right">Current</span>
                  <span />
                </div>
                <div v-for="row in positionRows" :key="`prow-${row.market.id}-${row.side}`" :class="POS_GRID" class="border-b border-border px-4 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-2">
                  <span class="truncate text-[12.5px] font-semibold text-text">{{ typeLabel || "Position" }}</span>
                  <span class="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] leading-4">
                    <span v-if="row.color" class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: row.color }" />
                    <span class="font-semibold text-text">{{ row.label }}</span>
                    <span class="text-border-2">|</span>
                    <span class="font-mono text-text-2"><NumericOdometer :value="row.shares" :maximum-fraction-digits="2" /></span>
                  </span>
                  <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="row.avgCents" :minimum-fraction-digits="1" :maximum-fraction-digits="1" suffix="¢" /></span>
                  <span class="font-mono text-right text-xs text-text-2"><NumericOdometer :value="row.cost" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
                  <span class="font-mono text-right text-xs text-text-2"><NumericOdometer :value="row.toWin" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
                  <span class="font-mono text-right text-xs font-semibold" :class="row.pnl >= 0 ? 'text-yes' : 'text-no'">
                    <NumericOdometer :value="row.value" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
                    <span class="text-[11px] font-medium">({{ row.pnl >= 0 ? "+" : "−" }}<NumericOdometer :value="Math.abs(row.pnl)" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />)</span>
                  </span>
                  <button
                    type="button"
                    class="pm-focus h-7 justify-self-end rounded-md border border-no/15 bg-no-bg px-3 text-xs font-semibold text-no transition-[background-color,transform] duration-150 hover:bg-no-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="row.value <= 0"
                    @click="openExit(row)"
                  >
                    Sell
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Transition>

    <Transition name="ledger-section">
      <section v-if="hasOrders" class="border-t border-border">
        <button type="button" class="pm-focus flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left" :aria-expanded="showOrders" @click="showOrders = !showOrders">
          <span class="flex items-center gap-1.5 text-[13px] font-semibold text-white">
            Open Orders
            <Icon name="lucide:chevron-down" class="ledger-chevron h-3.5 w-3.5 text-text-3" :class="{ 'is-open': showOrders }" />
          </span>
          <Transition name="ledger-chips">
            <div v-if="!showOrders" class="flex min-w-0 flex-wrap justify-end gap-1.5">
              <span v-for="row in orderRows" :key="`ochip-${row.id}`" class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-2 px-2 py-1 text-[11px] leading-4">
                <span class="font-semibold" :class="row.side === 'buy' ? 'text-yes' : 'text-no'">{{ row.side === "buy" ? "Buy" : "Sell" }}</span>
                <span v-if="row.color" class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: row.color }" />
                <span class="font-semibold text-text">{{ row.label }}</span>
                <span class="text-border-2">|</span>
                <span class="font-mono text-text-2"><NumericOdometer :value="row.remaining" :maximum-fraction-digits="2" /> @ <NumericOdometer :value="row.priceCents" :minimum-fraction-digits="1" :maximum-fraction-digits="1" suffix="¢" /></span>
              </span>
            </div>
          </Transition>
        </button>

        <div class="ledger-collapse" :class="{ 'is-open': showOrders }">
          <div class="ledger-collapse__inner">
            <div class="overflow-x-auto border-t border-border">
              <div class="min-w-160">
                <div :class="ORD_GRID" class="border-b border-border px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-text-3">
                  <span>Side</span>
                  <span>Outcome</span>
                  <span>Price</span>
                  <span>Filled</span>
                  <span class="text-right">Total</span>
                  <span>Exp.</span>
                  <button type="button" class="pm-focus justify-self-end text-[9px] font-bold uppercase tracking-widest text-no transition-colors duration-150 hover:text-white disabled:opacity-50" :disabled="!!cancellingId" @click="cancelAll">Cancel all</button>
                </div>
                <TransitionGroup name="ledger-row" tag="div" class="relative">
                  <div v-for="row in orderRows" :key="`orow-${row.id}`" :class="ORD_GRID" class="border-b border-border px-4 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-2">
                    <span class="text-xs font-semibold capitalize" :class="row.side === 'buy' ? 'text-yes' : 'text-no'">{{ row.side }}</span>
                    <span class="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] leading-4">
                      <span v-if="row.color" class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: row.color }" />
                      <span class="font-semibold text-text">{{ row.label }}</span>
                    </span>
                    <span class="font-mono text-xs font-semibold text-text"><NumericOdometer :value="row.priceCents" :minimum-fraction-digits="1" :maximum-fraction-digits="1" suffix="¢" /></span>
                    <span class="font-mono text-xs text-text-2"><NumericOdometer :value="row.filled" :maximum-fraction-digits="2" /> / <NumericOdometer :value="row.total" :maximum-fraction-digits="2" /></span>
                    <span class="font-mono text-right text-xs text-text-2"><NumericOdometer :value="row.totalUsd" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" /></span>
                    <span class="text-xs text-text-3">Until cancelled</span>
                    <button
                      type="button"
                      class="pm-focus grid h-6 w-6 place-items-center justify-self-end rounded-md text-text-3 transition-[color,background-color,transform] duration-150 hover:bg-no-bg hover:text-no active:scale-90 disabled:opacity-40"
                      :disabled="cancellingId === row.id"
                      :aria-label="`Cancel ${row.side} ${row.label}`"
                      @click="cancel(row.id)"
                    >
                      <Icon :name="cancellingId === row.id ? 'lucide:loader-2' : 'lucide:x'" class="h-3.5 w-3.5" :class="{ 'animate-spin': cancellingId === row.id }" />
                    </button>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Transition>

    <PortfolioExitModal :is-open="!!exitPosition" :position="exitPosition" :pending="exitPending" :error="exitError" :live="isLiveAccount" @close="closeExit" @confirm="confirmExit" />
  </div>
</template>

<style scoped>
.ledger-chevron {
  transition: transform 0.22s cubic-bezier(0.645, 0.045, 0.355, 1);
}
.ledger-chevron.is-open {
  transform: rotate(180deg);
}

.ledger-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.ledger-collapse.is-open {
  grid-template-rows: 1fr;
}
.ledger-collapse__inner {
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.ledger-collapse.is-open .ledger-collapse__inner {
  opacity: 1;
}

.ledger-section-enter-active {
  transition:
    opacity 0.24s cubic-bezier(0.215, 0.61, 0.355, 1),
    transform 0.24s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.ledger-section-leave-active {
  transition:
    opacity 0.16s cubic-bezier(0.215, 0.61, 0.355, 1),
    transform 0.16s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.ledger-section-enter-from,
.ledger-section-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.ledger-chips-enter-active,
.ledger-chips-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.ledger-chips-enter-from,
.ledger-chips-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.ledger-row-enter-active {
  transition:
    opacity 0.22s cubic-bezier(0.215, 0.61, 0.355, 1),
    transform 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
}
.ledger-row-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  position: absolute;
  width: 100%;
}
.ledger-row-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
.ledger-row-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
.ledger-row-move {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .ledger-chevron,
  .ledger-collapse,
  .ledger-collapse__inner,
  .ledger-section-enter-active,
  .ledger-section-leave-active,
  .ledger-chips-enter-active,
  .ledger-chips-leave-active,
  .ledger-row-enter-active,
  .ledger-row-leave-active {
    transition: none;
  }
}
</style>
