<script setup lang="ts">
import type { OrderSide } from "~/types/account";
import type { LiveOpenOrder } from "~/composables/usePolymarket";
import { formatRelativeTime } from "~/utils/markets";
import { fmts } from "~/utils/prices";

interface OrderRow {
  id: string;
  title: string;
  to?: string;
  outcomeLabel?: string;
  placedAt: number;
  side: OrderSide;
  priceCents: number;
  remaining: number;
  value: number;
}

const { account, activeAccountId, isLiveAccount, cancelOpenOrder } = useAccount();
const { fetchLiveOpenOrders, cancelLiveOrder } = usePolymarket();

const liveOrders = ref<LiveOpenOrder[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const cancellingId = ref<string | null>(null);
const mounted = ref(false);

const paperOrders = computed(() => [...account.value.openOrders].sort((a, b) => b.createdAt - a.createdAt));
const sortedLiveOrders = computed(() => [...liveOrders.value].sort((a, b) => b.created_at - a.created_at));

const liveRemaining = (o: LiveOpenOrder) => Math.max(Number.parseFloat(o.original_size) - Number.parseFloat(o.size_matched), 0);
const orderValue = (price: number, shares: number) => Math.ceil(price * shares * 100) / 100;
const liveCreatedAt = (o: LiveOpenOrder) => (o.created_at < 1_000_000_000_000 ? o.created_at * 1000 : o.created_at);
const shortMarket = (id: string) => (id.length > 18 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id);

const rows = computed<OrderRow[]>(() => {
  if (isLiveAccount.value) {
    return sortedLiveOrders.value.map((o) => {
      const price = Number.parseFloat(o.price);
      const remaining = liveRemaining(o);
      return {
        id: o.id,
        title: `${o.outcome || "Outcome"} · ${shortMarket(o.market)}`,
        placedAt: liveCreatedAt(o),
        side: o.side.toLowerCase() === "buy" ? "buy" : "sell",
        priceCents: price * 100,
        remaining,
        value: orderValue(price, remaining),
      };
    });
  }
  return paperOrders.value.map((o) => ({
    id: o.id,
    title: o.question || o.marketName,
    to: o.marketSlug ? `/event/${o.marketSlug}` : undefined,
    outcomeLabel: o.outcome === "yes" ? "Yes" : "No",
    placedAt: o.createdAt,
    side: o.side,
    priceCents: o.price * 100,
    remaining: o.shares,
    value: orderValue(o.price, o.shares),
  }));
});

async function refreshLiveOrders() {
  if (!isLiveAccount.value) {
    liveOrders.value = [];
    error.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    liveOrders.value = await fetchLiveOpenOrders();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't load open orders.";
  } finally {
    loading.value = false;
  }
}

async function cancel(orderId: string) {
  cancellingId.value = orderId;
  if (!isLiveAccount.value) {
    cancelOpenOrder(orderId);
    cancellingId.value = null;
    return;
  }
  error.value = null;
  try {
    await cancelLiveOrder(orderId);
    await refreshLiveOrders();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't cancel the order.";
  } finally {
    cancellingId.value = null;
  }
}

watch(activeAccountId, () => {
  if (mounted.value) void refreshLiveOrders();
});
onMounted(() => {
  mounted.value = true;
  void refreshLiveOrders();
});
</script>

<template>
  <section class="pm-panel overflow-hidden" aria-labelledby="portfolio-orders-title">
    <div class="flex min-h-13 items-center justify-between gap-3 border-b border-border px-4">
      <div>
        <h2 id="portfolio-orders-title" class="text-[13px] font-semibold text-white">Open orders</h2>
        <p class="mt-0.5 text-[10.5px] text-text-3">Resting limit orders that have not fully filled.</p>
      </div>
      <button v-if="isLiveAccount" type="button" class="pm-focus shrink-0 text-[10px] font-bold uppercase tracking-widest text-text-3 transition-colors duration-150 hover:text-white disabled:opacity-50" :disabled="loading" @click="refreshLiveOrders">
        {{ loading ? "Loading" : "Refresh" }}
      </button>
    </div>
    <div v-if="error" class="border-b border-no/25 bg-no-bg px-4 py-2.5 text-[11px] font-semibold text-no" role="alert">{{ error }}</div>
    <div v-if="isLiveAccount && loading && !rows.length" class="flex min-h-45 items-center justify-center px-6 py-12 text-center text-sm text-text-3">Loading open orders...</div>
    <div v-else-if="!rows.length" class="flex min-h-45 items-center justify-center px-6 py-12 text-center text-sm text-text-3">No open {{ isLiveAccount ? "live" : "paper" }} orders.</div>
    <template v-else>
      <div class="max-md:hidden">
        <div class="grid grid-cols-[minmax(200px,1fr)_64px_80px_110px_88px] items-center gap-3 border-b border-border px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-text-3">
          <span>Market</span>
          <span>Side</span>
          <span class="text-right">Price</span>
          <span class="text-right">Remaining</span>
          <span class="text-right">Action</span>
        </div>
        <div v-for="order in rows" :key="order.id" class="grid grid-cols-[minmax(200px,1fr)_64px_80px_110px_88px] items-center gap-3 border-b border-border px-4 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-2">
          <div class="min-w-0">
            <NuxtLink v-if="order.to" :to="order.to" class="pm-focus block truncate text-[12.5px] font-semibold text-text transition-colors duration-150 hover:text-white">{{ order.title }}</NuxtLink>
            <div v-else class="truncate text-[12.5px] font-semibold text-text">{{ order.title }}</div>
            <div class="mt-0.5 text-[10px] text-text-3">
              <template v-if="order.outcomeLabel">{{ order.outcomeLabel }} · </template>Placed {{ formatRelativeTime(order.placedAt) }}
            </div>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest" :class="order.side === 'buy' ? 'text-yes' : 'text-no'">{{ order.side }}</span>
          <span class="font-mono text-right text-xs font-semibold text-text">{{ order.priceCents.toFixed(1) }}¢</span>
          <div class="text-right">
            <div class="font-mono text-xs font-semibold text-text">{{ fmts(order.remaining) }}</div>
            <div class="font-mono text-[10px] text-text-3">${{ order.value.toFixed(2) }}</div>
          </div>
          <button type="button" class="pm-focus justify-self-end text-[10px] font-bold uppercase tracking-widest text-no transition-colors duration-150 hover:text-white disabled:opacity-50" :disabled="cancellingId === order.id" @click="cancel(order.id)">
            {{ cancellingId === order.id ? "Cancelling" : "Cancel" }}
          </button>
        </div>
      </div>
      <ul class="md:hidden">
        <li v-for="order in rows" :key="order.id" class="border-b border-border px-4 py-3 last:border-b-0">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <NuxtLink v-if="order.to" :to="order.to" class="pm-focus line-clamp-2 text-[12.5px] font-semibold leading-snug text-text">{{ order.title }}</NuxtLink>
              <div v-else class="line-clamp-2 text-[12.5px] font-semibold leading-snug text-text">{{ order.title }}</div>
            </div>
            <button type="button" class="pm-focus shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-no transition-colors duration-150 disabled:opacity-50" :disabled="cancellingId === order.id" @click="cancel(order.id)">
              {{ cancellingId === order.id ? "Cancelling" : "Cancel" }}
            </button>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[10px] font-bold uppercase tracking-widest" :class="order.side === 'buy' ? 'text-yes' : 'text-no'">{{ order.outcomeLabel ? `${order.side} ${order.outcomeLabel}` : order.side }}</span>
            <span class="font-mono text-[10.5px] font-semibold text-text">{{ order.priceCents.toFixed(1) }}¢</span>
            <span class="font-mono text-[10.5px] text-text-2">{{ fmts(order.remaining) }} sh (${{ order.value.toFixed(2) }})</span>
            <span class="text-[10px] text-text-3">{{ formatRelativeTime(order.placedAt) }}</span>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
