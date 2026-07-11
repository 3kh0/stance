<template>
  <div v-if="resolution" class="relative overflow-hidden rounded-xl border border-border-2 bg-surface">
    <div class="pointer-events-none absolute inset-0 opacity-60" :class="resolution.side === 'yes' ? 'bg-[radial-gradient(circle_at_12%_20%,rgba(38,166,154,0.16),transparent_38%)]' : 'bg-[radial-gradient(circle_at_12%_20%,rgba(239,83,80,0.14),transparent_38%)]'" />
    <div class="relative flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div class="flex min-w-0 items-center gap-3.5">
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full border" :class="resolution.side === 'yes' ? 'border-yes/25 bg-yes-bg text-yes' : 'border-no/25 bg-no-bg text-no'">
          <Icon name="lucide:check" class="h-5 w-5" stroke-width="3" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-text-3">Market Resolved</div>
          <div class="mt-0.5 text-xl font-bold text-white">
            Outcome:
            <span :class="resolution.side === 'yes' ? 'text-yes' : 'text-no'">{{ resolution.label }}</span>
          </div>
          <div v-if="marketTitle" class="mt-1 truncate text-xs text-text-3">{{ marketTitle }}</div>
        </div>
      </div>

      <NuxtLink v-if="liveMarketTo" :to="liveMarketTo" class="pm-focus inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border-2 bg-bg px-3.5 text-xs font-bold text-text transition-colors duration-150 hover:border-white/30 hover:text-white">
        View live {{ info.display }} market
        <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>
  </div>

  <div v-else class="overflow-hidden rounded-xl border border-border bg-surface">
    <div class="flex items-stretch divide-x divide-border">
      <div class="min-w-0 flex-1 px-4 py-3">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Price to Beat</div>
        <div v-if="priceToBeat !== null" class="font-mono mt-1 text-[19px] font-semibold leading-none tabular-nums text-text-2">${{ formatPrice(priceToBeat) }}</div>
        <div v-else class="font-mono mt-1 text-[19px] font-semibold leading-none text-text-3">—</div>
      </div>

      <div class="min-w-0 flex-[1.3] px-4 py-3">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">Current price</span>
        </div>
        <div class="mt-1 flex items-baseline gap-2">
          <div class="font-mono text-[22px] font-semibold leading-none" :class="priceColor">
            <NumericOdometer v-if="price !== null" :value="price" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
            <span v-else class="text-text-3">connecting…</span>
          </div>
          <span v-if="delta !== null" class="font-mono text-[11px] font-semibold tabular-nums" :class="priceColor">{{ delta >= 0 ? "▲" : "▼" }} ${{ formatPrice(Math.abs(delta)) }}</span>
        </div>
      </div>

      <div class="hidden shrink-0 flex-col items-end justify-center px-4 py-3 sm:flex">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ countdownLabel }}</div>
        <div class="font-mono mt-1 text-[19px] font-semibold leading-none tabular-nums" :class="countdownMs !== null && countdownMs < 30_000 ? 'text-no' : 'text-white'">{{ countdownText }}</div>
      </div>

      <NuxtLink v-if="liveMarketTo" :to="liveMarketTo" class="pm-focus hidden shrink-0 items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-text transition-colors duration-150 hover:text-white sm:flex">
        Live market
        <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>

    <NuxtLink v-if="liveMarketTo" :to="liveMarketTo" class="pm-focus flex h-10 items-center justify-center gap-2 border-t border-border px-4 text-xs font-bold text-text transition-colors duration-150 hover:text-white sm:hidden">
      View live {{ info.display }} market
      <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { Outcome } from "~/types/account";
import type { CryptoUpDownInfo } from "~/utils/crypto";
import type { FinanceUpDownInfo } from "~/utils/finance";
import { currentCryptoUpDownSlug } from "~/utils/crypto";
import { fmtm as formatPrice } from "~/utils/prices";

const props = defineProps<{
  info: CryptoUpDownInfo | FinanceUpDownInfo;
  resolution?: { label: string; side: Outcome } | null;
  marketTitle?: string;
  price?: number | null;
  priceToBeat?: number | null;
  connected?: boolean;
}>();

const price = computed(() => props.price ?? null);
const priceToBeat = computed(() => props.priceToBeat ?? null);

const isMounted = ref(false);
const now = ref(props.info.windowStartMs ?? Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  isMounted.value = true;
  now.value = Date.now();
  timer = setInterval(() => (now.value = Date.now()), 500);
});
onBeforeUnmount(() => timer && clearInterval(timer));

const delta = computed(() => (price.value !== null && priceToBeat.value !== null ? price.value - priceToBeat.value : null));
const priceColor = computed(() => (delta.value === null || delta.value === 0 ? "text-white" : delta.value > 0 ? "text-yes" : "text-no"));
const countdownMs = computed(() => (isMounted.value && props.info.windowEndMs !== null ? props.info.windowEndMs - now.value : null));
const countdownLabel = computed(() => (countdownMs.value !== null && countdownMs.value <= 0 ? "Status" : "Closes in"));
const countdownText = computed(() => {
  const ms = countdownMs.value;
  if (ms === null) return "—";
  if (ms <= 0) return liveMarketTo.value ? "Window closed" : "Awaiting result";
  const t = Math.floor(ms / 1000),
    h = Math.floor(t / 3600),
    pad = (n: number) => String(n).padStart(2, "0"),
    rest = `${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  return h > 0 ? `${h}:${rest}` : rest;
});

const liveMarketTo = computed(() => {
  if (props.info.source === "equity") return null;
  const cur = currentCryptoUpDownSlug(props.info, now.value);
  const viewed = props.info.windowStartMs === null ? null : currentCryptoUpDownSlug(props.info, props.info.windowStartMs);
  return !cur || cur === viewed ? null : `/event/${cur}`;
});
</script>
