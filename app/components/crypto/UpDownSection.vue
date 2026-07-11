<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { detectCryptoUpDown } from "~/utils/crypto";
import { CRYPTO_COINS } from "~/utils/cryptoTaxonomy";
import { parseClobTokenIds } from "~/utils/markets";
import { outcomeDisplayCents } from "~/utils/quotes";

type CryptoInterval = "5m" | "15m" | "hourly" | "4h" | "daily";

const props = defineProps<{
  events: MarketFeedEvent[];
  selectedCoin: string | null;
  prices: Map<string, number>;
  interval: CryptoInterval;
}>();

const emit = defineEmits<{ "update:interval": [value: CryptoInterval] }>();

const now = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  now.value = Date.now();
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => timer && clearInterval(timer));

const cards = computed(() => {
  const byCoin = new Map<string, MarketFeedEvent>();
  for (const e of props.events) {
    const info = detectCryptoUpDown(e);
    if (!info) continue;
    const ex = byCoin.get(info.coin);
    const exEnd = ex ? (detectCryptoUpDown(ex)?.windowEndMs ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    if (!ex || (info.windowEndMs ?? Number.POSITIVE_INFINITY) < exEnd) byCoin.set(info.coin, e);
  }
  const ordered = CRYPTO_COINS.map((c) => ({ coin: c.key, event: byCoin.get(c.key) })).filter((e): e is { coin: string; event: MarketFeedEvent } => Boolean(e.event));
  return props.selectedCoin ? ordered.filter((e) => e.coin === props.selectedCoin) : ordered;
});

const tokenIds = computed(() => {
  const ids = new Set<string>();
  for (const c of cards.value) for (const t of parseClobTokenIds(c.event.markets?.[0])) ids.add(t);
  return [...ids];
});
const { revision, getBestQuote, lastTradePrice } = useClobMarketChannel(tokenIds);

const liveOdds = computed<Record<string, { up: number; down: number }>>(() => {
  void revision.value;
  const src = { getBestQuote, lastTradePrice: lastTradePrice.value };
  const map: Record<string, { up: number; down: number }> = {};
  for (const c of cards.value) {
    const m = c.event.markets?.[0];
    if (m) map[c.event.id] = { up: outcomeDisplayCents(m, "yes", src), down: outcomeDisplayCents(m, "no", src) };
  }
  return map;
});

const intervalOptions: { value: CryptoInterval; label: string }[] = [
  { value: "5m", label: "5M" },
  { value: "15m", label: "15M" },
  { value: "hourly", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "daily", label: "1D" },
];

const INTERVAL_NOUNS: Record<CryptoInterval, string> = {
  "5m": "5-minute",
  "15m": "15-minute",
  hourly: "hourly",
  "4h": "4-hour",
  daily: "daily",
};
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-3">Up or Down</h2>
        <span class="flex h-1.5 w-1.5 items-center"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-yes" /></span>
      </div>
      <div class="flex items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5">
        <button v-for="opt in intervalOptions" :key="opt.value" type="button" class="font-mono pm-focus rounded px-2.5 py-1 text-[11px] font-bold tabular-nums transition-colors duration-150" :class="interval === opt.value ? 'bg-bg text-white' : 'text-text-3 hover:text-text'" @click="emit('update:interval', opt.value)">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div v-if="cards.length > 0" class="pm-grid">
      <CryptoUpDownCard v-for="card in cards" :key="card.event.id" :event="card.event" :now="now" :live-price="prices.get(card.coin) ?? null" :up-cents="liveOdds[card.event.id]?.up ?? null" :down-cents="liveOdds[card.event.id]?.down ?? null" />
    </div>
    <div v-else class="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-3">No live {{ INTERVAL_NOUNS[interval] }} windows open right now.</div>
  </section>
</template>
