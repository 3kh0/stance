<script setup lang="ts">
import { CRYPTO_COINS } from "~/utils/cryptoTaxonomy";

const props = defineProps<{
  selectedCoin: string | null;
  livePrice: number | null;
  connected: boolean;
}>();

const emit = defineEmits<{ "update:selectedCoin": [value: string | null] }>();

const selected = computed(() => CRYPTO_COINS.find((c) => c.key === props.selectedCoin) ?? null);

const chipClass = (a: boolean) => ["pm-focus shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150", a ? "border-white/30 bg-white text-bg" : "border-border bg-surface-2 text-text-2 hover:border-border-2 hover:text-white"];
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
      <button type="button" :class="chipClass(selectedCoin === null)" @click="emit('update:selectedCoin', null)">All</button>
      <button v-for="coin in CRYPTO_COINS" :key="coin.key" type="button" :class="chipClass(selectedCoin === coin.key)" @click="emit('update:selectedCoin', coin.key)">
        {{ coin.display }}
      </button>
    </div>

    <div v-if="selected" class="flex shrink-0 items-center gap-2 pr-1">
      <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ selected.name }}</span>
      <span class="font-mono text-[15px] font-semibold tabular-nums text-white">
        <NumericOdometer v-if="livePrice !== null" :value="livePrice" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
        <span v-else class="text-text-3">{{ connected ? "—" : "connecting…" }}</span>
      </span>
    </div>
  </div>
</template>
