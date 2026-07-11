<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { detectCryptoUpDown } from "~/utils/crypto";
import { classifyCryptoEvent } from "~/utils/cryptoTaxonomy";

type CryptoInterval = "5m" | "15m" | "hourly" | "4h" | "daily";

interface CryptoOverview {
  interval: CryptoInterval;
  upDown: MarketFeedEvent[];
  events: MarketFeedEvent[];
}

const selectedCoin = ref<string | null>(null);
const interval = ref<CryptoInterval>("5m");

const { data, pending, error, refresh } = await useFetch<CryptoOverview>("/api/crypto-overview", { query: { interval } });

const upDownEvents = computed(() => data.value?.upDown ?? []);
const cryptoEvents = computed(() => data.value?.events ?? []);
const forecastEvents = computed(() => cryptoEvents.value.filter((e) => classifyCryptoEvent(e) === "forecast"));
const themeEvents = computed(() => cryptoEvents.value.filter((e) => classifyCryptoEvent(e) === "theme"));

const upDownCoins = computed(() => {
  const s = new Set<string>();
  for (const e of upDownEvents.value) {
    const i = detectCryptoUpDown(e);
    if (i) s.add(i.coin);
  }
  return [...s];
});
const { prices, connected } = useCryptoPricesFeed(upDownCoins);

const price = computed(() => (selectedCoin.value ? (prices.value.get(selectedCoin.value) ?? null) : null));
const isEmpty = computed(() => !pending.value && !upDownEvents.value.length && !cryptoEvents.value.length);

useHead({ title: "Crypto" });
</script>

<template>
  <div class="pm-page">
    <div class="pm-container flex flex-col gap-8 py-6">
      <div class="flex flex-col gap-4">
        <h1 class="text-2xl font-bold leading-8 text-white">Crypto</h1>
        <CryptoCoinRail v-model:selected-coin="selectedCoin" :live-price="price" :connected="connected" />
      </div>

      <div v-if="error && !data" class="flex min-h-60 items-center justify-center px-4">
        <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <p class="mb-2 text-base font-semibold leading-snug text-no">Crypto markets are unavailable right now.</p>
          <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-medium" :disabled="pending" @click="refresh()">Retry</button>
        </div>
      </div>

      <div v-else-if="pending && !data" class="pm-grid">
        <div v-for="i in 8" :key="`sk-${i}`" class="h-44 rounded-xl border border-border bg-surface pm-skeleton" />
      </div>

      <div v-else-if="isEmpty" class="flex min-h-60 items-center justify-center px-4 text-sm text-text-3">No crypto markets to show right now.</div>

      <template v-else>
        <CryptoUpDownSection v-model:interval="interval" :events="upDownEvents" :selected-coin="selectedCoin" :prices="prices" />
        <CryptoForecastSection :events="forecastEvents" :selected-coin="selectedCoin" />
        <CryptoThemeSection :events="themeEvents" :selected-coin="selectedCoin" />
      </template>
    </div>
  </div>
</template>
