<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { buildStrikeLadder } from "~/utils/cryptoTaxonomy";

const props = defineProps<{
  events: MarketFeedEvent[];
  selectedCoin: string | null;
}>();

const ladders = computed(() => {
  const built = props.events.map(buildStrikeLadder).filter((l): l is NonNullable<typeof l> => l !== null);
  return (props.selectedCoin ? built.filter((l) => l.coin === props.selectedCoin) : built).sort((a, b) => a.horizon.order - b.horizon.order || b.rows.length - a.rows.length);
});
</script>

<template>
  <section v-if="ladders.length > 0" class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-3">Price Forecast</h2>
      <span class="text-[11px] text-text-3">Probability by strike</span>
    </div>
    <div class="pm-grid">
      <CryptoStrikeLadder v-for="ladder in ladders" :key="ladder.event.id" :ladder="ladder" />
    </div>
  </section>
</template>
