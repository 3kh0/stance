<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { detectCryptoUpDown, upDownOutcomeLabels } from "~/utils/crypto";
import { parseOutcomePrices } from "~/utils/markets";

const props = defineProps<{
  event: MarketFeedEvent;
  livePrice?: number | null;
  upCents?: number | null;
  downCents?: number | null;
  now: number;
}>();

const info = computed(() => detectCryptoUpDown(props.event));
const market = computed(() => props.event.markets?.[0]);
const labels = computed(() => upDownOutcomeLabels(market.value));
const staticOdds = computed(() => parseOutcomePrices(market.value));
const upPct = computed(() => Math.round(props.upCents ?? staticOdds.value.yes * 100));
const downPct = computed(() => Math.round(props.downCents ?? staticOdds.value.no * 100));

const priceToBeat = computed(() => props.event.eventMetadata?.priceToBeat ?? null);
const livePrice = computed(() => props.livePrice ?? null);
const delta = computed(() => (livePrice.value !== null && priceToBeat.value !== null ? livePrice.value - priceToBeat.value : null));
const deltaColor = computed(() => (delta.value === null || delta.value === 0 ? "text-white" : delta.value > 0 ? "text-yes" : "text-no"));
const deltaAbs = computed(() => (delta.value === null ? null : Math.abs(delta.value)));
const deltaArrow = computed(() => (delta.value === null || delta.value === 0 ? "" : delta.value > 0 ? "▲" : "▼"));
const priceDecimals = computed(() => ((livePrice.value ?? priceToBeat.value ?? 0) >= 1000 ? 2 : 4));

const remainingMs = computed(() => (props.now > 0 && info.value?.windowEndMs != null ? info.value.windowEndMs - props.now : null));
const countdown = computed(() => {
  const ms = remainingMs.value;
  if (ms === null) return "—";
  if (ms <= 0) return "Resolving";
  const t = Math.floor(ms / 1000),
    h = Math.floor(t / 3600),
    pad = (n: number) => String(n).padStart(2, "0"),
    rest = `${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  return h > 0 ? `${h}:${rest}` : rest;
});
const urgent = computed(() => remainingMs.value !== null && remainingMs.value > 0 && remainingMs.value < 30_000);
const eventUrl = computed(() => `/event/${props.event.slug ?? props.event.id}?x=${props.event.id}`);
</script>

<template>
  <NuxtLink
    :to="eventUrl"
    class="group/ud flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-[border-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-border-2 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
  >
    <div class="flex items-center gap-2.5">
      <div class="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
        <MarketIcon v-if="event.icon || event.image" :src="event.icon || event.image" :alt="info?.display || 'Coin'" class="h-full w-full object-cover" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-semibold leading-tight text-white">{{ info?.display }}</div>
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Up or Down</div>
      </div>
      <div class="text-right">
        <div class="text-[9px] font-bold uppercase tracking-widest text-text-3">Closes</div>
        <div class="font-mono text-[13px] font-semibold tabular-nums" :class="urgent ? 'text-no' : 'text-white'">{{ countdown }}</div>
      </div>
    </div>

    <div class="flex items-end justify-between gap-2">
      <div class="min-w-0">
        <div class="text-[9px] font-bold uppercase tracking-widest text-text-3">Current</div>
        <div class="font-mono text-[19px] font-semibold leading-none tabular-nums" :class="deltaColor">
          <NumericOdometer v-if="livePrice !== null" :value="livePrice" prefix="$" :minimum-fraction-digits="priceDecimals" :maximum-fraction-digits="priceDecimals" />
          <span v-else class="text-text-3">—</span>
        </div>
        <div v-if="deltaAbs !== null" class="mt-1 flex items-center gap-1 text-[11px] font-semibold leading-none" :class="deltaColor">
          <span aria-hidden="true">{{ deltaArrow }}</span>
          <NumericOdometer :value="deltaAbs" prefix="$" :minimum-fraction-digits="priceDecimals" :maximum-fraction-digits="priceDecimals" />
        </div>
      </div>
      <div v-if="priceToBeat !== null" class="text-right">
        <div class="text-[9px] font-bold uppercase tracking-widest text-text-3">Price to beat</div>
        <div class="font-mono text-[13px] font-semibold leading-none tabular-nums text-text-2">
          <NumericOdometer :value="priceToBeat" prefix="$" :minimum-fraction-digits="priceDecimals" :maximum-fraction-digits="priceDecimals" />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-1.5">
      <div class="font-mono flex h-9 items-center justify-between gap-1.5 rounded-md border border-yes/20 bg-yes-bg px-2.5 text-xs font-semibold text-yes transition-colors duration-150 group-hover/ud:bg-yes-hover">
        <span class="font-sans">{{ labels[0] }}</span>
        <NumericOdometer :value="upPct" suffix="¢" />
      </div>
      <div class="font-mono flex h-9 items-center justify-between gap-1.5 rounded-md border border-no/15 bg-no-bg px-2.5 text-xs font-semibold text-no transition-colors duration-150 group-hover/ud:bg-no-hover">
        <span class="font-sans">{{ labels[1] }}</span>
        <NumericOdometer :value="downPct" suffix="¢" />
      </div>
    </div>
  </NuxtLink>
</template>
